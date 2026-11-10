// Glutkessel lebt: zwei bis drei große Vulkane rund um die Strecke, die
// abwechselnd ausbrechen – erst grollt und glüht der Krater, dann schießt eine
// Lavafontäne hoch, eine Aschewolke quillt auf und Lavabomben fliegen mit
// Leuchtspur in hohem Bogen in den Lavasee. Dazu blubbert der See, Glutfunken
// treiben durch die Luft und der große Vulkan am Horizont raucht.
//
// Alles steht abseits der Fahrbahn: Plätze werden mit festem Zufall aus der
// Strecke abgeleitet und über world.clearance() geprüft. Im Lauf wird nichts
// neu angelegt – Zustände liegen in vorab angelegten Feldern.

import * as THREE from 'three';
import { rightX, rightZ } from '../../game/track';
import { MeshBuilder, mixRgb, noise, seeded, shade, type RGB, type V3 } from '../build';
import type { FxSink } from '../fxApi';
import type { Life } from '../life';
import { addSmoothNormals, outlineMaterial, rgb, toonMaterial } from '../toon';
import type { World } from '../world';

/** Ablauf eines Ausbruchs in Sekunden ab Beginn des Grollens. */
const RUMBLE = 2.6;
const FOUNTAIN = 3.6;
const TAIL = 3.5;
/** Schwerkraft der Lavabomben (etwas stärker als echt – der Bogen soll zügig sein). */
const BOMB_G = 15;
/** Werte je Bombenziel: x, y, z, vx, vy, vz, Flugzeit. */
const TGT = 7;

interface Vulkan {
  x: number;
  z: number;
  /** Fuß (unter dem Lavaspiegel) und Höhe des Kegels. */
  base: number;
  h: number;
  rTop: number;
  rBase: number;
  /** Höhe des Kraterrands und der Lava im Krater. */
  top: number;
  craterY: number;
  seed: number;
  /** Beginn des laufenden bzw. nächsten Ausbruchs. */
  start: number;
  next: number;
  /** Glut im Krater 0..1 (Rinnen, Kraterlava, Fontäne). */
  heat: number;
  smokeT: number;
  ashT: number;
  sparkT: number;
  blasted: boolean;
  bombsLaunched: number;
  /** Mögliche Einschläge samt Wurfbahn (je TGT Werte). */
  targets: Float32Array;
  nTargets: number;
}

export function buildGlutLife(world: World): Life {
  const t = world.track;
  const th = world.theme;
  const group = new THREE.Group();
  const disposables: { dispose(): void }[] = [];
  const detail = world.detail;
  const liquid = th.liquidY ?? -3.5;
  const rnd = seeded(4400 + t.index * 53);

  /** Höhe der nächsten Fahrbahn unter (bzw. neben) einem Punkt. */
  const roadY = (x: number, z: number): number => {
    let best = Infinity;
    let y = 0;
    for (let k = 0; k < t.n; k += 2) {
      const d = (x - t.px[k]) ** 2 + (z - t.pz[k]) ** 2;
      if (d < best) {
        best = d;
        y = t.py[k];
      }
    }
    return y;
  };

  // --- Plätze der Vulkane --------------------------------------------------------
  // Viele Kandidaten rund um die Strecke; genommen werden die, die nah genug
  // stehen, um beim Fahren ständig im Blick zu sein, deren Fuß aber mindestens
  // 25 m von jeder Bande entfernt bleibt – und die sich nicht gegenseitig verdecken.
  const want = detail === 0 ? 2 : 3;
  const cands: { x: number; z: number; h: number; rBase: number; score: number }[] = [];
  for (let k = 0; k < 360; k++) {
    const a = rnd() * Math.PI * 2;
    const d = world.radius * (0.55 + rnd() * 1.0);
    const x = world.center.x + Math.cos(a) * d;
    const z = world.center.z + Math.sin(a) * d;
    const h = 74 + rnd() * 32;
    const rBase = h * 0.8;
    const c = world.clearance(x, z);
    const gap = c - rBase;
    if (gap < 26) continue;
    // Bevorzugt 30–60 m Abstand zwischen Fuß und Bande.
    cands.push({ x, z, h, rBase, score: Math.abs(gap - 42) + rnd() * 10 });
  }
  cands.sort((p, q) => p.score - q.score);
  const vulkane: Vulkan[] = [];
  for (const c of cands) {
    if (vulkane.length >= want) break;
    let ok = true;
    for (const v of vulkane) {
      const sep = Math.hypot(c.x - v.x, c.z - v.z);
      // Winkel zwischen beiden, von der Mitte aus gesehen.
      const d = Math.atan2(c.z - world.center.z, c.x - world.center.x) - Math.atan2(v.z - world.center.z, v.x - world.center.x);
      const ang = Math.abs(Math.atan2(Math.sin(d), Math.cos(d)));
      if (sep < c.rBase + v.rBase + 40 || ang < 1.4) ok = false;
    }
    if (!ok) continue;
    // Fuß knapp unter dem tiefsten Punkt des Geländes ringsum.
    let low = liquid;
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      low = Math.min(low, world.heightAt(c.x + Math.cos(a) * c.rBase * 0.8, c.z + Math.sin(a) * c.rBase * 0.8));
    }
    const base = low - 4;
    const n = vulkane.length;
    vulkane.push({
      x: c.x,
      z: c.z,
      base,
      h: c.h,
      rTop: c.h * 0.15,
      rBase: c.rBase,
      top: base + c.h,
      craterY: base + c.h - 2.6,
      seed: n * 7.3 + 1.1,
      start: -1e9,
      // Erster Ausbruch bald nach dem Start, danach versetzt.
      next: 4 + n * 7 + rnd() * 3,
      heat: 0,
      smokeT: rnd(),
      ashT: 0,
      sparkT: 0,
      blasted: true,
      bombsLaunched: 99,
      targets: new Float32Array(12 * TGT),
      nTargets: 0,
    });
  }

  /** Punkt auf der (verbeulten) Kegelfläche: Winkel a, Höhe u 0..1, um out nach außen versetzt. */
  const surf = (v: Vulkan, a: number, u: number, out = 0): V3 => {
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const bump = 1 + (noise(ca * 2.2 + v.seed, sa * 2.2 + u * 2.5) - 0.5) * 0.38 * (1 - u * 0.5);
    const r = (v.rTop + (v.rBase - v.rTop) * Math.pow(1 - u, 1.85)) * bump + out;
    const rim = u >= 0.999 ? (noise(ca * 3 + v.seed, sa * 3) - 0.5) * 3.2 : 0;
    return [v.x + ca * r, v.base + v.h * u + rim + out * 0.4, v.z + sa * r];
  };

  // --- Kegel: ein Netz für alle, mit Tuschekontur --------------------------------
  const cone = new MeshBuilder();
  const S = detail === 0 ? 13 : 18;
  const U = [0, 0.16, 0.32, 0.47, 0.6, 0.72, 0.82, 0.9, 0.96, 1];
  const cLow = rgb(th.ground[2]);
  const cMid = mixRgb(rgb(th.ground[2]), rgb(0x241a2b), 0.45);
  const cTop = rgb(0x221827);
  const cAsh = rgb(th.ground[3]);
  const cHot = rgb(0x7a2e2a);
  for (const v of vulkane) {
    const crnd = seeded(91 + Math.round(v.seed * 10));
    // Helle Ascheschlieren und frisch erkaltete, rötliche Bahnen: je Spalte, von oben nach unten.
    const streak: number[] = [];
    for (let i = 0; i < S; i++) {
      const r = crnd();
      streak.push(r < 0.2 ? 1 : r < 0.32 ? 2 : 0);
    }
    for (let j = 0; j < U.length - 1; j++) {
      for (let i = 0; i < S; i++) {
        const a0 = (i / S) * Math.PI * 2;
        const a1 = ((i + 1) / S) * Math.PI * 2;
        const u0 = U[j];
        const u1 = U[j + 1];
        const um = (u0 + u1) / 2;
        let col = um < 0.4 ? mixRgb(cLow, cMid, um / 0.4) : mixRgb(cMid, cTop, Math.min(1, (um - 0.4) / 0.5));
        if (streak[i] === 1 && j >= 2) col = mixRgb(col, cAsh, 0.45);
        else if (streak[i] === 2 && j >= 4) col = mixRgb(col, cHot, 0.55);
        col = shade(col, 0.95 + crnd() * 0.1);
        cone.quad(surf(v, a1, u0), surf(v, a0, u0), surf(v, a0, u1), surf(v, a1, u1), col);
      }
    }
    // Kraterlippe: vom Rand nach innen hinunter zur Lava.
    for (let i = 0; i < S; i++) {
      const a0 = (i / S) * Math.PI * 2;
      const a1 = ((i + 1) / S) * Math.PI * 2;
      const o0 = surf(v, a0, 1);
      const o1 = surf(v, a1, 1);
      const in0: V3 = [v.x + Math.cos(a0) * v.rTop * 0.72, v.craterY - 1.5, v.z + Math.sin(a0) * v.rTop * 0.72];
      const in1: V3 = [v.x + Math.cos(a1) * v.rTop * 0.72, v.craterY - 1.5, v.z + Math.sin(a1) * v.rTop * 0.72];
      cone.quad(o1, o0, in0, in1, rgb(0x4a2228));
    }
  }
  const coneGeo = addSmoothNormals(cone.build());
  const coneMat = toonMaterial({ vertexColors: true });
  const coneMesh = new THREE.Mesh(coneGeo, coneMat);
  group.add(coneMesh);
  disposables.push(coneGeo, coneMat);
  if (detail > 0) {
    const ol = new THREE.Mesh(coneGeo, outlineMaterial(0.25));
    ol.name = 'outline';
    group.add(ol);
  }

  // --- Glut: Lavarinnen und Kraterlava (Farben wandern pro Bild) -------------------
  const gPos: number[] = [];
  /** Je Dreieck: Vulkan, Weg entlang der Rinne (−1 = Kraterlava), Versatz der Rinne. */
  const fV: number[] = [];
  const fS: number[] = [];
  const fO: number[] = [];
  const tri = (a: V3, b: V3, c: V3, vi: number, s: number, o: number): void => {
    gPos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    fV.push(vi);
    fS.push(s);
    fO.push(o);
  };
  vulkane.forEach((v, vi) => {
    const nR = detail === 0 ? 3 : 4;
    const a0 = rnd() * Math.PI * 2;
    for (let r = 0; r < nR; r++) {
      const aR = a0 + (r / nR) * Math.PI * 2 + (rnd() - 0.5) * 0.8;
      const off = rnd() * 10;
      const M = 12;
      let s = 0;
      let prevL: V3 | null = null;
      let prevR: V3 | null = null;
      let prevC: V3 | null = null;
      for (let m = 0; m <= M; m++) {
        const u = 0.985 - (m / M) * 0.985;
        const a = aR + (noise(r * 3.1 + v.seed, u * 2.2) - 0.5) * 0.55;
        const c = surf(v, a, u, 0.75);
        const w = 1.4 + (1 - u) * 2.6;
        const tx = -Math.sin(a) * w;
        const tz = Math.cos(a) * w;
        const L: V3 = [c[0] - tx, c[1], c[2] - tz];
        const R: V3 = [c[0] + tx, c[1], c[2] + tz];
        if (prevL && prevR && prevC) {
          s += Math.hypot(c[0] - prevC[0], c[1] - prevC[1], c[2] - prevC[2]);
          tri(prevL, L, R, vi, s, off);
          tri(prevL, R, prevR, vi, s, off);
        }
        prevL = L;
        prevR = R;
        prevC = c;
      }
    }
    // Glutkranz außen unter dem Rand: dunkel glimmend, beim Grollen pulsierend hell.
    const KR = S;
    for (let i = 0; i < KR; i++) {
      const b0 = (i / KR) * Math.PI * 2;
      const b1 = ((i + 1) / KR) * Math.PI * 2;
      const lo0 = surf(v, b0, 0.93, 0.5);
      const lo1 = surf(v, b1, 0.93, 0.5);
      const hi0 = surf(v, b0, 1, 0.5);
      const hi1 = surf(v, b1, 1, 0.5);
      // Unterkante gezackt: Lava, die über die Lippe rinnt.
      if (i % 2 === 0) {
        lo0[1] -= 1.6;
        lo1[1] -= 0.4;
      } else lo1[1] -= 1.6;
      tri(lo1, lo0, hi0, vi, -2, i * 0.37);
      tri(lo1, hi0, hi1, vi, -2, i * 0.37);
    }
    // Kraterlava: Fächer, hebt sich beim Grollen.
    const K = 10;
    for (let i = 0; i < K; i++) {
      const b0 = (i / K) * Math.PI * 2;
      const b1 = ((i + 1) / K) * Math.PI * 2;
      const rr = v.rTop * 0.78;
      tri([v.x, v.craterY, v.z], [v.x + Math.cos(b1) * rr, v.craterY, v.z + Math.sin(b1) * rr], [v.x + Math.cos(b0) * rr, v.craterY, v.z + Math.sin(b0) * rr], vi, -1, 0);
    }
  });
  const glowGeo = new THREE.BufferGeometry();
  const glowPos = new Float32Array(gPos);
  const glowCol = new Float32Array(gPos.length);
  const posAttr = new THREE.BufferAttribute(glowPos, 3);
  const colAttr = new THREE.BufferAttribute(glowCol, 3);
  posAttr.setUsage(THREE.DynamicDrawUsage);
  colAttr.setUsage(THREE.DynamicDrawUsage);
  glowGeo.setAttribute('position', posAttr);
  glowGeo.setAttribute('color', colAttr);
  glowGeo.computeBoundingSphere();
  const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const glowMesh = new THREE.Mesh(glowGeo, glowMat);
  group.add(glowMesh);
  disposables.push(glowGeo, glowMat);
  const nFaces = fV.length;
  const lavaC = th.liquid.map((c) => rgb(c));
  const crust = rgb(0x5a1a14);
  const crustHot = rgb(0xa2300f);

  // --- Fontäne bzw. aufquellende Lava über dem Krater ----------------------------
  const jetGeo = new THREE.CylinderGeometry(1, 0.42, 1, 10, 3, true);
  jetGeo.translate(0, 0.5, 0);
  {
    const p = jetGeo.getAttribute('position');
    const col = new Float32Array(p.count * 3);
    const cBot = rgb(0xfff2b0);
    const cMidJ = rgb(0xffb52e);
    const cTopJ = rgb(0xff5a1f);
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      // Zackige Oberkante wie eine gezeichnete Flamme.
      if (y > 0.99) p.setY(i, 1 + (i % 2 === 0 ? 0.22 : -0.12));
      col.set(y < 0.4 ? mixRgb(cBot, cMidJ, y / 0.4) : mixRgb(cMidJ, cTopJ, (y - 0.4) / 0.6), i * 3);
    }
    jetGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  }
  const jetMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const jets = new THREE.InstancedMesh(jetGeo, jetMat, Math.max(1, vulkane.length));
  jets.frustumCulled = false;
  group.add(jets);
  disposables.push(jetGeo, jetMat, jets);

  // --- Lavabomben ------------------------------------------------------------------
  const perEruption = detail === 0 ? 3 : 4;
  const nBombs = Math.max(1, vulkane.length * perEruption);
  const bombGeo = new THREE.IcosahedronGeometry(1, 0);
  {
    const p = bombGeo.getAttribute('position');
    const col = new Float32Array(p.count * 3);
    const hot = rgb(0xffb52e);
    const dark = rgb(0x3a1e26);
    for (let f = 0; f < p.count / 3; f++) {
      const c = f % 3 === 0 ? dark : f % 3 === 1 ? hot : rgb(0xff7a1f);
      for (let k = 0; k < 3; k++) col.set(c, (f * 3 + k) * 3);
    }
    bombGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  }
  addSmoothNormals(bombGeo);
  const bombMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  const bombs = new THREE.InstancedMesh(bombGeo, bombMat, nBombs);
  bombs.frustumCulled = false;
  group.add(bombs);
  disposables.push(bombGeo, bombMat, bombs);
  if (detail === 2) {
    const bombOl = new THREE.InstancedMesh(bombGeo, outlineMaterial(0.1), nBombs);
    bombOl.instanceMatrix = bombs.instanceMatrix;
    bombOl.frustumCulled = false;
    bombOl.name = 'outline';
    group.add(bombOl);
    disposables.push(bombOl);
  }
  // Leuchtspur: ein spitzer Glutschweif hinter jeder Bombe (spart viele Funken).
  const trailGeo = new THREE.CylinderGeometry(1, 0.06, 1, 7, 2, true);
  trailGeo.translate(0, -0.5, 0);
  {
    const p = trailGeo.getAttribute('position');
    const col = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) col.set(p.getY(i) > -0.1 ? rgb(0xfff2b0) : p.getY(i) > -0.6 ? rgb(0xffb52e) : rgb(0xff4d0f), i * 3);
    trailGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  }
  const trailMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const trails = new THREE.InstancedMesh(trailGeo, trailMat, nBombs);
  trails.frustumCulled = false;
  group.add(trails);
  disposables.push(trailGeo, trailMat, trails);
  const bActive = new Uint8Array(nBombs);
  const bT0 = new Float32Array(nBombs);
  const bVul = new Uint8Array(nBombs);
  const bTgt = new Uint8Array(nBombs);
  const bTrail = new Float32Array(nBombs);
  const bSize = new Float32Array(nBombs);

  // Ziele der Bomben: Lava oder Fels mindestens 12 m neben der Bande; tief über
  // der Strecke darf die Bahn nie verlaufen.
  for (const v of vulkane) {
    for (let k = 0; k < 220 && v.nTargets < 12; k++) {
      const a = rnd() * Math.PI * 2;
      const d = v.rBase * 0.75 + 10 + rnd() * 75;
      const x = v.x + Math.cos(a) * d;
      const z = v.z + Math.sin(a) * d;
      if (world.clearance(x, z) < 12) continue;
      const y = Math.max(world.heightAt(x, z), liquid);
      const apex = 16 + rnd() * 22;
      const vy = Math.sqrt(2 * BOMB_G * apex);
      const drop = v.top + 2 - y;
      const T = (vy + Math.sqrt(vy * vy + 2 * BOMB_G * drop)) / BOMB_G;
      const vx = (x - v.x) / T;
      const vz = (z - v.z) / T;
      let ok = true;
      for (let s = 1; s < 16 && ok; s++) {
        const tt = (s / 16) * T;
        const px = v.x + vx * tt;
        const pz = v.z + vz * tt;
        const py = v.top + 2 + vy * tt - 0.5 * BOMB_G * tt * tt;
        const c = world.clearance(px, pz);
        if (c < 12 && py < roadY(px, pz) + 22) ok = false;
        // Nicht durch den eigenen Kegel.
        const dc = Math.hypot(px - v.x, pz - v.z);
        if (dc < v.rBase && py < v.base + v.h * (1 - Math.pow(Math.max(0, (dc - v.rTop) / (v.rBase - v.rTop)), 1 / 1.85)) + 3) ok = false;
      }
      if (!ok) continue;
      v.targets.set([x, y, z, vx, vy, vz, T], v.nTargets * TGT);
      v.nTargets++;
    }
  }

  // --- Blasen im Lavasee -----------------------------------------------------------
  const nBub = detail === 0 ? 10 : 22;
  const bub: number[] = [];
  for (let k = 0; k < 600 && bub.length < nBub * 5; k++) {
    const i = Math.floor(rnd() * t.n);
    const lat = (rnd() < 0.5 ? -1 : 1) * (t.wh[i] + 13 + rnd() * 55);
    const x = t.px[i] + rightX(t, i) * lat;
    const z = t.pz[i] + rightZ(t, i) * lat;
    if (world.heightAt(x, z) > liquid - 0.8 || world.clearance(x, z) < 12) continue;
    let free = true;
    for (const v of vulkane) if (Math.hypot(x - v.x, z - v.z) < v.rBase * 0.85 + 3) free = false;
    for (let q = 0; q < bub.length; q += 5) if (Math.hypot(x - bub[q], z - bub[q + 1]) < 9) free = false;
    if (!free) continue;
    // x, z, Größe, Takt, Versatz
    bub.push(x, z, 1.1 + rnd() * 1.6, 2.4 + rnd() * 3, rnd() * 10);
  }
  const nB = bub.length / 5;
  const bubGeo = new THREE.SphereGeometry(1, 9, 4, 0, Math.PI * 2, 0, Math.PI / 2);
  {
    const p = bubGeo.getAttribute('position');
    const col = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) col.set(p.getY(i) > 0.7 ? rgb(0xffe27a) : p.getY(i) > 0.3 ? rgb(0xffb52e) : rgb(0xff6a1f), i * 3);
    bubGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  }
  const bubMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  const bubbles = new THREE.InstancedMesh(bubGeo, bubMat, Math.max(1, nB));
  bubbles.frustumCulled = false;
  group.add(bubbles);
  disposables.push(bubGeo, bubMat, bubbles);
  const bubCycle = new Int32Array(Math.max(1, nB)).fill(-1);

  // Der große Vulkan am Horizont (aus scenery.ts): Krater, aus dem es raucht.
  const farX = world.center.x + 1700 * 0.72;
  const farZ = world.center.z + 1700 * 0.5;
  const farY = 566;

  // --- Hilfsobjekte für update() ---------------------------------------------------
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const pv = new THREE.Vector3();
  const sv = new THREE.Vector3();
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  const dir = new THREE.Vector3();
  const yAxis = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < nBombs; i++) {
    bombs.setMatrixAt(i, zero);
    trails.setMatrixAt(i, zero);
  }
  const ashCols = [0x3b2d42, 0x4f3d4f, 0x2c2232, 0x5c4656];
  let emberT = 0;
  let farT = 0;
  let farBurst = 12;

  const startEruption = (v: Vulkan, time: number): void => {
    v.start = time;
    v.next = time + 12 + rnd() * 13;
    v.blasted = false;
    v.bombsLaunched = 0;
    v.ashT = 0;
    v.sparkT = 0;
  };

  const launchBomb = (v: Vulkan, vi: number, time: number): void => {
    if (v.nTargets === 0) return;
    const slot = vi * perEruption + v.bombsLaunched;
    if (slot >= nBombs) return;
    bActive[slot] = 1;
    bT0[slot] = time;
    bVul[slot] = vi;
    bTgt[slot] = Math.floor(rnd() * v.nTargets);
    bTrail[slot] = 0;
    bSize[slot] = 2.1 + rnd() * 1.2;
  };

  const impact = (x: number, y: number, z: number, fx: FxSink): void => {
    if (y <= liquid + 0.3) {
      // Platsch in der Lava: Spritzer und zähe Lavaklumpen.
      for (let k = 0; k < 6; k++) {
        const a = rnd() * Math.PI * 2;
        const s = 3 + rnd() * 5;
        fx.spark(x, liquid + 0.5, z, Math.cos(a) * s, 10 + rnd() * 12, Math.sin(a) * s, 0.9 + rnd() * 0.3, 1.6 + rnd() * 1.2, rnd() < 0.5 ? 0xffe27a : 0xff9a1f, 14);
      }
      for (let k = 0; k < 2; k++) {
        const a = rnd() * Math.PI * 2;
        fx.puff(x, liquid + 0.8, z, Math.cos(a) * 6, 12 + rnd() * 6, Math.sin(a) * 6, 1.3, 1.8 + rnd(), 0xff7a1f, -0.6, 16);
      }
      fx.puff(x, liquid + 1.5, z, 0, 3, 0, 3, 3.2, 0x4f3d4f, 2.2, -1.5);
    } else {
      // Einschlag auf Fels: Funkenstoß und dunkler Staub.
      for (let k = 0; k < 8; k++) {
        const a = rnd() * Math.PI * 2;
        const s = 6 + rnd() * 8;
        fx.spark(x, y + 0.8, z, Math.cos(a) * s, 5 + rnd() * 9, Math.sin(a) * s, 0.8 + rnd() * 0.4, 1.4 + rnd(), rnd() < 0.5 ? 0xffd26a : 0xff7a1f, 12);
      }
      for (let k = 0; k < 3; k++) {
        const a = rnd() * Math.PI * 2;
        fx.puff(x + Math.cos(a) * 1.5, y + 1, z + Math.sin(a) * 1.5, Math.cos(a) * 4, 2 + rnd() * 2, Math.sin(a) * 4, 2.4, 2.8 + rnd(), 0x3b2d42, 2, -1);
      }
    }
  };

  return {
    group,
    update(time: number, dt: number, cam: THREE.Vector3, fx: FxSink): void {
      // --- Vulkane ---
      for (let vi = 0; vi < vulkane.length; vi++) {
        const v = vulkane[vi];
        if (time >= v.next) startEruption(v, time);
        const tau = time - v.start;
        const tf = tau - RUMBLE;
        let heat: number;
        let jetH = 0;
        let jetW = 0;
        if (tau < RUMBLE) {
          // Grollen: der Krater pulsiert immer schneller, Lava quillt über den Rand.
          const k = tau / RUMBLE;
          heat = 0.25 + 0.5 * k + 0.25 * Math.sin(tau * (7 + 9 * k)) * k;
          jetH = 2 + k * 7 + Math.sin(tau * (6 + 10 * k)) * 2 * k;
          jetW = v.rTop * (0.62 + 0.18 * k);
        } else if (tf < FOUNTAIN) {
          // Fontäne: schießt hoch, hält, sackt wieder ab.
          const up = Math.min(1, tf / 0.35);
          const down = tf > FOUNTAIN - 1 ? Math.max(0, FOUNTAIN - tf) : 1;
          const k = up * down;
          heat = 1;
          jetH = 5 + k * (44 + Math.sin(tf * 17) * 3 + Math.sin(tf * 5.3) * 5);
          jetW = v.rTop * (0.45 + 0.15 * k) + Math.sin(tf * 23) * 0.4;
        } else {
          const k = Math.min(1, (tf - FOUNTAIN) / TAIL);
          heat = Math.max(0.25, 1 - k);
          jetH = Math.max(0, 1 - k * 2.5) * 4;
          jetW = v.rTop * 0.5;
        }
        // Zwischen den Ausbrüchen glimmt der Krater nur.
        if (tau > RUMBLE + FOUNTAIN + TAIL) heat = 0.25 + Math.sin(time * 1.3 + v.seed) * 0.04;
        v.heat = heat;

        pv.set(v.x, v.craterY - 1, v.z);
        e.set(0, time * 0.7 + v.seed, 0);
        q.setFromEuler(e);
        sv.set(jetW, Math.max(0.01, jetH), jetW);
        m4.compose(pv, q, sv);
        jets.setMatrixAt(vi, m4);

        // Asche quillt hinter der Fontäne (von der Kamera aus gesehen) – sonst verdeckt sie sie.
        let bx = v.x - cam.x;
        let bz = v.z - cam.z;
        const bl = Math.hypot(bx, bz) || 1;
        bx /= bl;
        bz /= bl;

        // Rauch: leicht zwischen den Ausbrüchen, dichter beim Grollen.
        v.smokeT -= dt;
        if (v.smokeT <= 0) {
          const rumbling = tau < RUMBLE;
          v.smokeT = rumbling ? 0.3 : tau < RUMBLE + FOUNTAIN + TAIL ? 0.5 : 0.85;
          const a = rnd() * Math.PI * 2;
          const col = rumbling && rnd() < 0.5 ? 0x7a3a3a : ashCols[Math.floor(rnd() * ashCols.length)];
          fx.puff(v.x + Math.cos(a) * v.rTop * 0.4 + bx * 3, v.top + 1, v.z + Math.sin(a) * v.rTop * 0.4 + bz * 3, 1.2, 5, 0.6, 5.5, 4 + rnd() * 2.5, col, 2.2, -2.5);
          if (rumbling) {
            // Erste Glutspritzer über dem Rand.
            for (let k = 0; k < 2; k++) {
              const b = rnd() * Math.PI * 2;
              fx.spark(v.x + Math.cos(b) * 3, v.top + 3, v.z + Math.sin(b) * 3, Math.cos(b) * 4, 10 + rnd() * 8, Math.sin(b) * 4, 1, 2 + rnd(), 0xffb52e, 9);
            }
          }
        }

        if (tau >= RUMBLE && !v.blasted) {
          // Der Knall: Glutstoß und ein Kranz aus Aschebällchen.
          v.blasted = true;
          for (let k = 0; k < 10; k++) {
            const a = (k / 10) * Math.PI * 2;
            fx.puff(v.x + Math.cos(a) * v.rTop * 0.7 + bx * 4, v.top + 1, v.z + Math.sin(a) * v.rTop * 0.7 + bz * 4, Math.cos(a) * 12, 9 + rnd() * 6, Math.sin(a) * 12, 6, 6 + rnd() * 2, k % 3 === 0 ? 0x8a3f2c : ashCols[k % ashCols.length], 3, -3);
          }
          for (let k = 0; k < 16; k++) {
            const a = rnd() * Math.PI * 2;
            const s = 6 + rnd() * 10;
            fx.spark(v.x, v.top + 3, v.z, Math.cos(a) * s, 22 + rnd() * 18, Math.sin(a) * s, 1.2, 3 + rnd() * 1.5, rnd() < 0.5 ? 0xffe27a : 0xff9a1f, 9);
          }
        }
        // Bomben: kurz nacheinander geworfen.
        while (v.bombsLaunched < perEruption && tau >= RUMBLE + v.bombsLaunched * 0.28) {
          launchBomb(v, vi, v.start + RUMBLE + v.bombsLaunched * 0.28);
          v.bombsLaunched++;
        }
        if (tf >= 0 && tf < FOUNTAIN) {
          // Lavafontäne aus Funken.
          v.sparkT -= dt;
          while (v.sparkT <= 0) {
            v.sparkT += detail === 0 ? 0.14 : 0.1;
            const a = rnd() * Math.PI * 2;
            const s = rnd() * 6;
            fx.spark(v.x + Math.cos(a) * 1.5, v.top + jetH * 0.6, v.z + Math.sin(a) * 1.5, Math.cos(a) * s, 18 + rnd() * 22, Math.sin(a) * s, 1.2, 3.6 + rnd() * 2, rnd() < 0.4 ? 0xfff2b0 : rnd() < 0.5 ? 0xffb52e : 0xff6a1f, 9);
          }
          // Aufsteigende Aschesäule.
          v.ashT -= dt;
          while (v.ashT <= 0) {
            v.ashT += detail === 0 ? 0.36 : 0.24;
            const a = rnd() * Math.PI * 2;
            const lit = tf < 1.5 && rnd() < 0.35;
            fx.puff(v.x + Math.cos(a) * 2 + bx * 12, v.top + 6 + jetH * 0.4, v.z + Math.sin(a) * 2 + bz * 12, Math.cos(a) * 3 + bx * 4 + 1.5, 16 + rnd() * 10, Math.sin(a) * 3 + bz * 4, 9, 7 + rnd() * 4, lit ? 0x8a3f2c : ashCols[Math.floor(rnd() * ashCols.length)], 4.5, -5);
          }
        }
      }
      jets.instanceMatrix.needsUpdate = true;

      // --- Glut in Rinnen und Krater ---
      for (let f = 0; f < nFaces; f++) {
        const v = vulkane[fV[f]];
        const s = fS[f];
        let c: RGB;
        if (s === -2) {
          // Glutkranz
          const p = 0.5 + 0.5 * Math.sin(time * (3 + v.heat * 12) + fO[f]);
          c = v.heat < 0.35 ? (p > 0.6 ? crustHot : crust) : v.heat > 0.8 || p > 0.55 ? lavaC[2] : lavaC[1];
        } else if (s < 0) {
          const p = 0.5 + 0.5 * Math.sin(time * (v.heat > 0.5 ? 9 : 2.2) + v.seed);
          c = v.heat > 0.6 ? (p > 0.5 ? lavaC[2] : lavaC[1]) : p > 0.7 ? lavaC[1] : lavaC[0];
          const y = v.craterY + v.heat * 1.8;
          glowPos[f * 9 + 1] = y;
          glowPos[f * 9 + 4] = y;
          glowPos[f * 9 + 7] = y;
        } else {
          // Bänder wandern abwärts; heißer = schneller und heller.
          const ph = s * 0.075 - time * (0.22 + v.heat * 0.5) + fO[f];
          let k = ph - Math.floor(ph);
          k += v.heat * 0.3;
          c = k < 0.5 ? lavaC[0] : k < 0.85 ? lavaC[1] : lavaC[2];
          // Unten erkaltet die Lava zu dunkler Kruste.
          if (s > 46 + v.heat * 30 && k < 0.6) c = crust;
        }
        for (let k = 0; k < 3; k++) {
          glowCol[f * 9 + k * 3] = c[0];
          glowCol[f * 9 + k * 3 + 1] = c[1];
          glowCol[f * 9 + k * 3 + 2] = c[2];
        }
      }
      colAttr.needsUpdate = true;
      posAttr.needsUpdate = true;

      // --- Lavabomben ---
      for (let i = 0; i < nBombs; i++) {
        if (!bActive[i]) continue;
        const v = vulkane[bVul[i]];
        const o = bTgt[i] * TGT;
        const T = v.targets[o + 6];
        const tt = time - bT0[i];
        if (tt >= T) {
          bActive[i] = 0;
          bombs.setMatrixAt(i, zero);
          trails.setMatrixAt(i, zero);
          impact(v.targets[o], v.targets[o + 1], v.targets[o + 2], fx);
          continue;
        }
        const x = v.x + v.targets[o + 3] * tt;
        const y = v.top + 2 + v.targets[o + 4] * tt - 0.5 * BOMB_G * tt * tt;
        const z = v.z + v.targets[o + 5] * tt;
        pv.set(x, y, z);
        e.set(tt * 3.1 + i, tt * 2.3, 0);
        q.setFromEuler(e);
        sv.setScalar(bSize[i]);
        m4.compose(pv, q, sv);
        bombs.setMatrixAt(i, m4);
        // Leuchtspur: Schweif entgegen der Flugrichtung, dazu vereinzelte Funken.
        dir.set(v.targets[o + 3], v.targets[o + 4] - BOMB_G * tt, v.targets[o + 5]);
        const speed = dir.length();
        dir.multiplyScalar(1 / speed);
        q.setFromUnitVectors(yAxis, dir);
        const len = Math.min(18, Math.max(5, speed * 0.6));
        sv.set(bSize[i] * 0.85, len, bSize[i] * 0.85);
        m4.compose(pv, q, sv);
        trails.setMatrixAt(i, m4);
        bTrail[i] -= dt;
        while (bTrail[i] <= 0) {
          bTrail[i] += detail === 0 ? 0.7 : 0.45;
          fx.spark(x - dir.x * len * 0.5, y - dir.y * len * 0.5, z - dir.z * len * 0.5, 0, 0, 0, 1.0, bSize[i] * 1.3, 0xff8a2a, -1);
        }
      }
      bombs.instanceMatrix.needsUpdate = true;
      trails.instanceMatrix.needsUpdate = true;

      // --- Blasen im Lavasee ---
      for (let b = 0; b < nB; b++) {
        const o = b * 5;
        const per = bub[o + 3];
        const cyc = (time + bub[o + 4]) / per;
        const n = Math.floor(cyc);
        const k = cyc - n;
        const x = bub[o];
        const z = bub[o + 1];
        if (bubCycle[b] !== n) {
          if (bubCycle[b] >= 0) {
            // Plopp: nur in Sichtweite Funken, ab und zu eine kleine Fontäne.
            const near = Math.abs(x - cam.x) + Math.abs(z - cam.z) < 170;
            if (near) {
              const fountain = n % 5 === 1;
              const cnt = fountain ? 6 : 2;
              for (let s = 0; s < cnt; s++) {
                const a = rnd() * Math.PI * 2;
                const sp = fountain ? 1.5 : 3;
                fx.spark(x, liquid + 0.6, z, Math.cos(a) * sp, (fountain ? 13 : 6) + rnd() * 5, Math.sin(a) * sp, 1.1, fountain ? 1.6 : 1.1, rnd() < 0.5 ? 0xffe27a : 0xff9a1f, 12);
              }
              if (fountain) fx.puff(x, liquid + 1, z, 0, 9, 0, 1.2, 1.6, 0xff7a1f, -0.5, 14);
            }
          }
          bubCycle[b] = n;
        }
        // Wächst langsam, steht kurz, platzt.
        const r = bub[o + 2];
        const s = k < 0.75 ? r * Math.pow(k / 0.75, 0.7) : 0;
        pv.set(x, liquid - 0.25, z);
        sv.set(s, s * (0.75 + 0.15 * Math.sin(time * 6 + b)), s);
        q.identity();
        m4.compose(pv, q, sv);
        bubbles.setMatrixAt(b, m4);
      }
      bubbles.instanceMatrix.needsUpdate = true;

      // --- Treibende Glutfunken rund um die Kamera ---
      emberT -= dt;
      while (emberT <= 0) {
        emberT += detail === 0 ? 0.35 : 0.22;
        const a = rnd() * Math.PI * 2;
        const d = 10 + rnd() * 35;
        fx.spark(cam.x + Math.cos(a) * d, cam.y - 3 + rnd() * 14, cam.z + Math.sin(a) * d, 0.8 + rnd(), 1 + rnd() * 1.5, 0.4, 1.2, 0.35 + rnd() * 0.3, rnd() < 0.5 ? 0xffb52e : 0xff6a1f, -1.2);
      }

      // --- Der ferne Riese raucht und spuckt ab und zu ---
      farT -= dt;
      if (farT <= 0) {
        farT = 1.4;
        fx.puff(farX + (rnd() - 0.5) * 60, farY, farZ + (rnd() - 0.5) * 60, -6, 22, -3, 14, 70 + rnd() * 40, ashCols[Math.floor(rnd() * ashCols.length)], 14, -2);
      }
      farBurst -= dt;
      if (farBurst <= 0) {
        farBurst = 18 + rnd() * 14;
        for (let k = 0; k < 10; k++) {
          const a = rnd() * Math.PI * 2;
          fx.spark(farX, farY, farZ, Math.cos(a) * 30, 60 + rnd() * 40, Math.sin(a) * 30, 1.2, 30 + rnd() * 15, k % 2 === 0 ? 0xffb52e : 0xff6a1f, 30);
        }
      }
    },
    dispose(): void {
      for (const d of disposables) d.dispose();
    },
  };
}
