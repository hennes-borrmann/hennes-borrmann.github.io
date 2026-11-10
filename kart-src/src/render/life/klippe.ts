// Möwenklippe lebt: Möwenschwärme kreisen über Bucht und Klippe und ziehen ab
// und zu hoch über die Strecke hinweg, an der Küste rollen Wellenkämme heran
// und laufen als Schaum aus, ein Fischkutter tuckert mit Qualm durch die Bucht,
// Bojen schaukeln, das Leuchtfeuer dreht sich und weit draußen taucht ab und zu
// ein Wal auf.
//
// Reine Kulisse: alles wird mit festem Zufall aus der Strecke abgeleitet und
// über world.clearance() von der Fahrbahn ferngehalten. Im Lauf wird nichts neu
// angelegt – Zustände liegen in vorab angelegten Feldern.

import * as THREE from 'three';
import { rightX, rightZ } from '../../game/track';
import { MeshBuilder, mixRgb, seeded, smooth, type RGB, type V3 } from '../build';
import type { FxSink } from '../fxApi';
import type { Life } from '../life';
import { addSmoothNormals, outlineMaterial, rgb, toonMaterial } from '../toon';
import type { World } from '../world';

/** Größe der Möwen (gut 4 m Spannweite – sie sollen auch von weitem lesbar sein). */
const GULL_SCALE = 2;
/** Takt der Brandung in Sekunden. */
const SURF_PERIOD = 5.5;
/** So weit draußen beginnt ein Wellenkamm. */
const CREST_RUN = 26;

interface Swarm {
  /** Ankerplatz, an dem gerade gekreist wird, und das Ziel eines Überflugs. */
  from: number;
  to: number;
  /** 0 = kreisen, 1 = Überflug. */
  mode: number;
  t0: number;
  until: number;
  dur: number;
  dir: number;
  /** Mindesthöhe je Stützstelle des Überflugs (über der Strecke). */
  req: Float32Array;
  len: number;
  /** Aktuelle Mitte des Schwarms. */
  cx: number;
  cy: number;
  cz: number;
}

export function buildKlippeLife(world: World): Life {
  const t = world.track;
  const th = world.theme;
  const group = new THREE.Group();
  const disposables: { dispose(): void }[] = [];
  const detail = world.detail;
  const sea = th.liquidY ?? -2.2;
  const rnd = seeded(7300 + t.index * 41);
  const toon = toonMaterial({ vertexColors: true });
  disposables.push(toon);

  /** Höhe der nächsten Fahrbahn. */
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
  /** Offenes, tiefes Wasser? */
  const deep = (x: number, z: number, depth: number): boolean => world.heightAt(x, z) < sea - depth;

  // --- Möwen -----------------------------------------------------------------------
  // Ankerplätze, über denen die Schwärme kreisen: abseits der Strecke, über Wasser
  // oder Klippe. Beim Kreisen kommt keine Möwe der Fahrbahn näher als 10 m.
  const anchors: number[] = []; // x, y, z, Kreisradius
  for (let k = 0; k < 500 && anchors.length < 6 * 4; k++) {
    const a = rnd() * Math.PI * 2;
    const d = world.radius * (0.25 + rnd() * 1.1);
    const x = world.center.x + Math.cos(a) * d;
    const z = world.center.z + Math.sin(a) * d;
    const c = world.clearance(x, z);
    if (c < 30 || c > 110) continue;
    let free = true;
    for (let q = 0; q < anchors.length; q += 4) if (Math.hypot(x - anchors[q], z - anchors[q + 2]) < 60) free = false;
    if (!free) continue;
    const y = Math.max(world.heightAt(x, z), sea) + 13 + rnd() * 12;
    anchors.push(x, y, z, Math.min(20, c - 10));
  }
  const nAnch = anchors.length / 4;
  const nSwarm = Math.min(nAnch, detail === 0 ? 2 : 3);
  const perSwarm = detail === 0 ? 5 : 7;
  const nGull = nSwarm * perSwarm;
  const REQ = 16;
  const swarms: Swarm[] = [];
  for (let s = 0; s < nSwarm; s++) {
    const from = Math.floor((s / nSwarm) * nAnch);
    swarms.push({
      from,
      to: from,
      mode: 0,
      t0: 0,
      until: 6 + s * 9 + rnd() * 6,
      dur: 1,
      dir: s % 2 === 0 ? 1 : -1,
      req: new Float32Array(REQ),
      len: 0,
      cx: anchors[from * 4],
      cy: anchors[from * 4 + 1],
      cz: anchors[from * 4 + 2],
    });
  }
  // Je Möwe: Winkelversatz, Radiusanteil, Höhenversatz, Flügelschlag-Phase, Gleitphase
  const gP = new Float32Array(Math.max(1, nGull) * 5);
  for (let g = 0; g < nGull; g++) gP.set([rnd() * Math.PI * 2, 0.5 + rnd() * 0.5, (rnd() - 0.5) * 6, rnd() * 10, rnd() * 10], g * 5);
  const gPrev = new Float32Array(Math.max(1, nGull) * 3);
  const gYaw = new Float32Array(Math.max(1, nGull));
  const gRoll = new Float32Array(Math.max(1, nGull));
  let gullInit = false;

  // Körper: Rumpf, Kopf, gelber Schnabel, Schwanz – Blick nach +z.
  const gb = new MeshBuilder();
  {
    const m = new THREE.Matrix4();
    const ico = new THREE.IcosahedronGeometry(1, 0);
    gb.add(ico, rgb(0xf7f7f2), m.compose(new THREE.Vector3(0, 0, 0), new THREE.Quaternion(), new THREE.Vector3(0.2, 0.19, 0.55)));
    gb.add(ico, rgb(0xffffff), m.compose(new THREE.Vector3(0, 0.07, 0.5), new THREE.Quaternion(), new THREE.Vector3(0.14, 0.14, 0.16)));
    ico.dispose();
    const beak = new THREE.ConeGeometry(0.05, 0.22, 4);
    gb.add(beak, rgb(0xffb21f), m.compose(new THREE.Vector3(0, 0.05, 0.72), new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)), new THREE.Vector3(1, 1, 1)));
    beak.dispose();
    const tailC = rgb(0xd9dde3);
    gb.tri([0, 0.04, -0.4], [-0.16, 0.02, -0.78], [0.16, 0.02, -0.78], tailC);
    gb.tri([0, 0.0, -0.4], [0.16, 0.02, -0.78], [-0.16, 0.02, -0.78], tailC);
  }
  const bodyGeo = addSmoothNormals(gb.build());
  // Flügel: flacher Keil nach +x, oben und unten gleich – der linke ist der um die
  // Längsachse gedrehte rechte. Schwarze Spitzen wie bei echten Möwen.
  const wb = new MeshBuilder();
  {
    const grey = rgb(0xc5d0dc);
    const tip = rgb(0x2a2f3a);
    const T = 0.05;
    const rows: [number, number, number, RGB][] = [
      // x, Vorderkante z, Hinterkante z, Farbe des Stücks nach außen
      [0.08, 0.24, -0.3, grey],
      [0.75, 0.24, -0.24, grey],
      [1.35, 0.04, -0.1, tip],
    ];
    for (let k = 0; k < rows.length - 1; k++) {
      const [x0, f0, b0] = rows[k];
      const [x1, f1, b1, c] = rows[k + 1];
      const thk0 = T * (1 - k * 0.4);
      const thk1 = T * (1 - (k + 1) * 0.4);
      // oben
      wb.quad([x0, thk0, b0], [x0, thk0, f0], [x1, thk1, f1], [x1, thk1, b1], c);
      // unten
      wb.quad([x0, -thk0, f0], [x0, -thk0, b0], [x1, -thk1, b1], [x1, -thk1, f1], mixRgb(c, [1, 1, 1], 0.35));
      // Vorder- und Hinterkante
      wb.quad([x0, -thk0, f0], [x1, -thk1, f1], [x1, thk1, f1], [x0, thk0, f0], c);
      wb.quad([x1, -thk1, b1], [x0, -thk0, b0], [x0, thk0, b0], [x1, thk1, b1], c);
    }
  }
  const wingGeo = addSmoothNormals(wb.build());
  const nG = Math.max(1, nGull);
  const gullBodies = new THREE.InstancedMesh(bodyGeo, toon, nG);
  const gullWings = new THREE.InstancedMesh(wingGeo, toon, nG * 2);
  gullBodies.frustumCulled = false;
  gullWings.frustumCulled = false;
  group.add(gullBodies, gullWings);
  disposables.push(bodyGeo, wingGeo, gullBodies, gullWings);
  if (detail === 2) {
    const bo = new THREE.InstancedMesh(bodyGeo, outlineMaterial(0.05), nG);
    const wo = new THREE.InstancedMesh(wingGeo, outlineMaterial(0.05), nG * 2);
    bo.instanceMatrix = gullBodies.instanceMatrix;
    wo.instanceMatrix = gullWings.instanceMatrix;
    bo.frustumCulled = wo.frustumCulled = false;
    bo.name = wo.name = 'outline';
    group.add(bo, wo);
    disposables.push(bo, wo);
  }

  // --- Brandung --------------------------------------------------------------------
  // Küstenpunkte: von der Bande aus nach außen, bis das Gelände unter den Meeresspiegel fällt.
  const shore: number[] = []; // x, z, Richtung zum Meer (x, z), Phase
  const maxShore = detail === 0 ? 60 : 110;
  for (let i = 0; i < t.n && shore.length < maxShore * 5 * 3; i += 4) {
    for (const sgn of [-1, 1]) {
      let prevY = Infinity;
      let prevLat = 0;
      for (let lat = t.wh[i] + 1; lat < t.wh[i] + 150; lat += 3) {
        const x = t.px[i] + rightX(t, i) * sgn * lat;
        const z = t.pz[i] + rightZ(t, i) * sgn * lat;
        const y = world.heightAt(x, z);
        if (y < sea) {
          if (prevY === Infinity) break; // schon an der Bande Wasser (Steg)
          const f = (prevY - sea) / (prevY - y);
          const l = prevLat + (lat - prevLat) * f;
          const sx = t.px[i] + rightX(t, i) * sgn * l;
          const sz = t.pz[i] + rightZ(t, i) * sgn * l;
          if (world.clearance(sx, sz) < 1.5) break;
          let free = true;
          for (let q = 0; q < shore.length; q += 5) if (Math.hypot(sx - shore[q], sz - shore[q + 1]) < 7) free = false;
          if (!free) break;
          // Richtung zum Meer: bergab.
          const gx = world.heightAt(sx + 2, sz) - world.heightAt(sx - 2, sz);
          const gz = world.heightAt(sx, sz + 2) - world.heightAt(sx, sz - 2);
          const gl = Math.hypot(gx, gz);
          const nx = gl > 1e-3 ? -gx / gl : rightX(t, i) * sgn;
          const nz = gl > 1e-3 ? -gz / gl : rightZ(t, i) * sgn;
          shore.push(sx, sz, nx, nz, i * 0.011 + rnd() * 0.08);
          break;
        }
        prevY = y;
        prevLat = lat;
      }
    }
  }
  // Ausdünnen auf die Höchstzahl, gleichmäßig über die Küste verteilt.
  const nShoreAll = shore.length / 5;
  const nShore = Math.min(nShoreAll, maxShore);
  const shoreIdx = new Int32Array(Math.max(1, nShore));
  for (let k = 0; k < nShore; k++) shoreIdx[k] = Math.floor((k * nShoreAll) / nShore);
  const nCrest = Math.ceil(nShore / 2);

  // Schaumbogen: flacher Halbmond, Mitte zur Küste gewölbt (lokal: x längs, +z aufs Meer).
  const fb = new MeshBuilder();
  {
    const white: RGB = [1, 1, 1];
    const N = 6;
    for (let k = 0; k < N; k++) {
      const u0 = -1 + (2 * k) / N;
      const u1 = -1 + (2 * (k + 1)) / N;
      const arc = (u: number): number => -(1 - u * u) * 0.9;
      // Landseitige Kante gewellt wie gezeichneter Schaum.
      const thk = (u: number): number => (1 - u * u) * 1.2 + 0.15 + Math.abs(Math.sin(u * Math.PI * 1.5)) * 0.35 * (1 - u * u);
      const a: V3 = [u0 * 4, 0, arc(u0)];
      const b: V3 = [u1 * 4, 0, arc(u1)];
      const c: V3 = [u1 * 4, 0, arc(u1) + thk(u1)];
      const d: V3 = [u0 * 4, 0, arc(u0) + thk(u0)];
      fb.quad(a, d, c, b, white);
    }
  }
  const foamGeo = fb.build();
  const foamMat = new THREE.MeshBasicMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  const surf = new THREE.InstancedMesh(foamGeo, foamMat, Math.max(1, nShore + nCrest));
  surf.frustumCulled = false;
  {
    const c = new THREE.Color();
    for (let k = 0; k < nShore; k++) surf.setColorAt(k, c.set(0xffffff));
    for (let k = 0; k < nCrest; k++) surf.setColorAt(nShore + k, c.set(0xd8f6ff));
    if (surf.instanceColor) surf.instanceColor.needsUpdate = true;
  }
  group.add(surf);
  disposables.push(foamGeo, foamMat, surf);
  const shoreCycle = new Int32Array(Math.max(1, nShore)).fill(-1);

  // --- Fischkutter -------------------------------------------------------------------
  const kb = new MeshBuilder();
  {
    const hull = rgb(0xd8433a);
    const hullD = rgb(0x8f2a2a);
    const stripe = rgb(0xf7f2e4);
    const deckC = rgb(0xc08a52);
    // Rumpf: spitzer Bug (+z), breites Heck, schräge Seiten.
    const L = 5;
    const W = 1.7;
    const top: V3[] = [
      [0, 1.4, L + 0.6],
      [W, 1.2, L * 0.45],
      [W, 1.1, -L],
      [-W, 1.1, -L],
      [-W, 1.2, L * 0.45],
    ];
    const bot: V3[] = [
      [0, -0.4, L - 0.2],
      [W * 0.55, -0.6, L * 0.35],
      [W * 0.6, -0.5, -L + 0.3],
      [-W * 0.6, -0.5, -L + 0.3],
      [-W * 0.55, -0.6, L * 0.35],
    ];
    for (let k = 0; k < 5; k++) {
      const j = (k + 1) % 5;
      kb.quad(bot[k], bot[j], top[j], top[k], k === 2 ? hullD : hull);
    }
    kb.quad(bot[0], bot[4], bot[3], bot[1], hullD);
    kb.tri(bot[1], bot[3], bot[2], hullD);
    // Deck
    kb.tri(top[0], top[1], top[4], deckC);
    kb.quad(top[1], top[2], top[3], top[4], deckC);
    // Weißer Streifen an der Bordwand
    kb.box(W + 0.02, 0.85, 0, 0.06, 0.22, L * 1.6, stripe);
    kb.box(-W - 0.02, 0.85, 0, 0.06, 0.22, L * 1.6, stripe);
    // Steuerhaus mit Fenstern, Dach, Schornstein
    kb.box(0, 2.3, -1.6, 2.4, 2.2, 2.6, rgb(0xf7f2e4));
    kb.box(0, 2.6, -0.28, 2.0, 0.7, 0.06, rgb(0x2f6fa8));
    kb.box(1.22, 2.6, -1.6, 0.06, 0.7, 1.8, rgb(0x2f6fa8));
    kb.box(-1.22, 2.6, -1.6, 0.06, 0.7, 1.8, rgb(0x2f6fa8));
    kb.box(0, 3.5, -1.6, 2.8, 0.25, 3.0, rgb(0x30364a));
    kb.box(0, 4.3, -2.4, 0.6, 1.4, 0.6, rgb(0x2a2733), 0, rgb(0xd8433a));
    // Mast mit Ausleger und Netz
    kb.box(0, 4, 2.4, 0.18, 6, 0.18, rgb(0x6a4a34));
    kb.box(0, 4.6, 0.6, 0.12, 0.12, 3.6, rgb(0x6a4a34));
    kb.box(0, 1.7, 3.2, 1.6, 0.6, 1.2, rgb(0x3f9a7a));
  }
  const boatGeo = addSmoothNormals(kb.build());
  // Bahnen: Kreise über tiefem Wasser, deren Rand überall 25 m von der Bande bleibt.
  const paths: number[] = []; // cx, cz, r, Richtung, Phase
  const wantBoats = detail === 0 ? 1 : 2;
  for (let k = 0; k < 400 && paths.length < wantBoats * 5; k++) {
    const a = rnd() * Math.PI * 2;
    const d = world.radius * (0.7 + rnd() * 0.9);
    const cx = world.center.x + Math.cos(a) * d;
    const cz = world.center.z + Math.sin(a) * d;
    const r = 26 + rnd() * 30;
    let ok = world.clearance(cx, cz) < r + 140;
    for (let s = 0; s < 16 && ok; s++) {
      const b = (s / 16) * Math.PI * 2;
      const x = cx + Math.cos(b) * r;
      const z = cz + Math.sin(b) * r;
      if (world.clearance(x, z) < 25 || !deep(x, z, 2)) ok = false;
    }
    for (let q = 0; q < paths.length && ok; q += 5) if (Math.hypot(cx - paths[q], cz - paths[q + 1]) < r + paths[q + 2] + 15) ok = false;
    if (ok) paths.push(cx, cz, r, rnd() < 0.5 ? 1 : -1, rnd() * Math.PI * 2);
  }
  const nBoat = paths.length / 5;
  const boats = new THREE.InstancedMesh(boatGeo, toon, Math.max(1, nBoat));
  boats.count = nBoat;
  boats.frustumCulled = false;
  group.add(boats);
  disposables.push(boatGeo, boats);
  if (detail > 0) {
    const bo = new THREE.InstancedMesh(boatGeo, outlineMaterial(0.06), Math.max(1, nBoat));
    bo.count = nBoat;
    bo.instanceMatrix = boats.instanceMatrix;
    bo.frustumCulled = false;
    bo.name = 'outline';
    group.add(bo);
    disposables.push(bo);
  }
  const boatT = new Float32Array(Math.max(1, nBoat));

  // --- Bojen ---------------------------------------------------------------------------
  const yb = new MeshBuilder();
  {
    const red = rgb(0xe8402f);
    const white = rgb(0xf7f2e4);
    const m = new THREE.Matrix4();
    const add = (geo: THREE.BufferGeometry, c: RGB, y: number): void => {
      yb.add(geo, c, m.makeTranslation(0, y, 0));
      geo.dispose();
    };
    add(new THREE.CylinderGeometry(0.9, 0.7, 1.2, 8), red, 0);
    add(new THREE.CylinderGeometry(0.5, 0.75, 1.0, 8), white, 1.1);
    add(new THREE.CylinderGeometry(0.3, 0.45, 0.9, 8), red, 2.0);
    add(new THREE.SphereGeometry(0.32, 8, 5), rgb(0xfff06a), 2.65);
  }
  const buoyGeo = addSmoothNormals(yb.build());
  const buoyPos: number[] = [];
  const wantBuoys = detail === 0 ? 4 : 8;
  for (let k = 0; k < 500 && buoyPos.length < wantBuoys * 3; k++) {
    const i = Math.floor(rnd() * t.n);
    const lat = (rnd() < 0.5 ? -1 : 1) * (t.wh[i] + 14 + rnd() * 50);
    const x = t.px[i] + rightX(t, i) * lat;
    const z = t.pz[i] + rightZ(t, i) * lat;
    if (!deep(x, z, 1.2) || world.clearance(x, z) < 12) continue;
    let free = true;
    for (let q = 0; q < buoyPos.length; q += 3) if (Math.hypot(x - buoyPos[q], z - buoyPos[q + 2]) < 30) free = false;
    for (let q = 0; q < paths.length; q += 5) if (Math.abs(Math.hypot(x - paths[q], z - paths[q + 1]) - paths[q + 2]) < 10) free = false;
    if (free) buoyPos.push(x, rnd() * 10, z);
  }
  const nBuoy = buoyPos.length / 3;
  const buoys = new THREE.InstancedMesh(buoyGeo, toon, Math.max(1, nBuoy));
  buoys.count = nBuoy;
  buoys.frustumCulled = false;
  group.add(buoys);
  disposables.push(buoyGeo, buoys);

  // --- Leuchtfeuer --------------------------------------------------------------------
  // Der Leuchtturm steht in scenery.ts; hier nur sein Lichtkegel – dieselbe Stelle
  // wie dort berechnet.
  const li = Math.round(t.n * 0.845) % t.n;
  const llat = t.wh[li] + 13;
  const lhx = t.px[li] + rightX(t, li) * llat;
  const lhz = t.pz[li] + rightZ(t, li) * llat;
  const lhy = world.heightAt(lhx, lhz) - 0.5 + 23.5;
  const beamGeo = new THREE.BufferGeometry();
  {
    // Zwei Lichtkegel gegenüber, je 70 m lang.
    const b = new MeshBuilder();
    const N = 10;
    for (const sgn of [-1, 1]) {
      for (let k = 0; k < N; k++) {
        const a0 = (k / N) * Math.PI * 2;
        const a1 = ((k + 1) / N) * Math.PI * 2;
        const p = (a: number, x: number, r: number): V3 => [sgn * x, Math.sin(a) * r - x * 0.04, Math.cos(a) * r];
        b.quad(p(a0, 0.8, 0.7), p(a1, 0.8, 0.7), p(a1, 70, 8), p(a0, 70, 8), [1, 1, 1]);
      }
    }
    const g = b.build();
    beamGeo.setAttribute('position', g.getAttribute('position'));
    g.dispose();
  }
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xfff3b0,
    transparent: true,
    opacity: 0.14,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    forceSinglePass: true,
  });
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.position.set(lhx, lhy, lhz);
  beam.renderOrder = 4;
  group.add(beam);
  disposables.push(beamGeo, beamMat);

  // --- Wal -----------------------------------------------------------------------------
  const whb = new MeshBuilder();
  {
    const back = rgb(0x253a55);
    const belly = rgb(0x8fa9c2);
    const m = new THREE.Matrix4();
    const ico = new THREE.IcosahedronGeometry(1, 1);
    whb.add(ico, back, m.compose(new THREE.Vector3(0, 0, 0), new THREE.Quaternion(), new THREE.Vector3(2.2, 1.6, 6.5)));
    whb.add(ico, belly, m.compose(new THREE.Vector3(0, -0.7, 1.5), new THREE.Quaternion(), new THREE.Vector3(1.8, 1.0, 4.2)));
    whb.add(ico, back, m.compose(new THREE.Vector3(0, 0.1, -6.8), new THREE.Quaternion(), new THREE.Vector3(0.9, 0.8, 2.8)));
    ico.dispose();
    // Fluke
    whb.quad([0, 0.15, -8.6], [3.2, 0.1, -10.6], [1.2, 0.1, -9.9], [0, 0.1, -9.4], back);
    whb.quad([0, 0.15, -8.6], [0, 0.1, -9.4], [-1.2, 0.1, -9.9], [-3.2, 0.1, -10.6], back);
    whb.quad([0, -0.05, -8.6], [0, -0.05, -9.4], [1.2, -0.05, -9.9], [3.2, -0.05, -10.6], belly);
    whb.quad([0, -0.05, -8.6], [-3.2, -0.05, -10.6], [-1.2, -0.05, -9.9], [0, -0.05, -9.4], belly);
    // Finne
    whb.tri([0, 1.4, -2.4], [0, 2.3, -3.4], [0, 1.4, -3.6], back);
    whb.tri([0, 1.4, -2.4], [0, 1.4, -3.6], [0, 2.3, -3.4], back);
  }
  const whaleGeo = whb.build();
  const whale = new THREE.Mesh(whaleGeo, toon);
  whale.scale.setScalar(1.4);
  whale.visible = false;
  group.add(whale);
  disposables.push(whaleGeo);
  const whaleSpots: number[] = [];
  for (let k = 0; k < 600 && whaleSpots.length < 12 * 3; k++) {
    const a = rnd() * Math.PI * 2;
    const d = world.radius * (0.7 + rnd() * 1.2);
    const x = world.center.x + Math.cos(a) * d;
    const z = world.center.z + Math.sin(a) * d;
    const c = world.clearance(x, z);
    if (c < 45 || c > 200 || !deep(x, z, 3) || !deep(x + 12, z, 3) || !deep(x - 12, z, 3) || !deep(x, z + 12, 3) || !deep(x, z - 12, 3)) continue;
    whaleSpots.push(x, z, rnd() * Math.PI * 2);
  }
  const nWhaleSpots = whaleSpots.length / 3;
  let whaleT0 = -100;
  let whaleNext = 9;
  let whaleSpot = 0;
  let whaleSpout = 0;
  const WHALE_DUR = 8;

  // --- Hilfsobjekte für update() -------------------------------------------------------
  const m4 = new THREE.Matrix4();
  const wing = new THREE.Matrix4();
  const out = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler(0, 0, 0, 'YXZ');
  const pv = new THREE.Vector3();
  const sv = new THREE.Vector3();
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  let gishPick = 0;

  /** Startet einen Überflug von Schwarm s zu einem anderen Ankerplatz. */
  const startTransit = (s: Swarm, time: number): void => {
    let to = s.from;
    for (let k = 0; k < 6 && to === s.from; k++) to = Math.floor(rnd() * nAnch);
    if (to === s.from) {
      s.until = time + 8;
      return;
    }
    const ax = anchors[s.from * 4];
    const az = anchors[s.from * 4 + 2];
    const bx = anchors[to * 4];
    const bz = anchors[to * 4 + 2];
    s.len = Math.hypot(bx - ax, bz - az);
    // Wo der Weg die Strecke kreuzt, fliegt der Schwarm hoch über ihr (Spielraum für
    // Versatz und Nachführung der Höhe: jede Möwe bleibt mindestens 12 m darüber).
    for (let k = 0; k < REQ; k++) {
      const f = (k + 0.5) / REQ;
      const x = ax + (bx - ax) * f;
      const z = az + (bz - az) * f;
      s.req[k] = world.clearance(x, z) < 14 ? roadY(x, z) + 27 : -1e9;
    }
    s.to = to;
    s.mode = 1;
    s.t0 = time;
    s.dur = s.len / 11;
  };

  return {
    group,
    update(time: number, dt: number, cam: THREE.Vector3, fx: FxSink): void {
      // --- Möwen ---
      for (let si = 0; si < nSwarm; si++) {
        const s = swarms[si];
        let ring = 1;
        let ty = anchors[s.from * 4 + 1];
        let rr = anchors[s.from * 4 + 3];
        if (s.mode === 0) {
          s.cx = anchors[s.from * 4];
          s.cz = anchors[s.from * 4 + 2];
          if (time >= s.until) startTransit(s, time);
        }
        if (s.mode === 1) {
          const f = Math.min(1, (time - s.t0) / s.dur);
          const k = smooth(f);
          const ax = anchors[s.from * 4];
          const ay = anchors[s.from * 4 + 1];
          const az = anchors[s.from * 4 + 2];
          const bx = anchors[s.to * 4];
          const by = anchors[s.to * 4 + 1];
          const bz = anchors[s.to * 4 + 2];
          s.cx = ax + (bx - ax) * k;
          s.cz = az + (bz - az) * k;
          let y = ay + (by - ay) * k;
          for (let r = 0; r < REQ; r++) {
            const need = s.req[r] - Math.abs(k - (r + 0.5) / REQ) * s.len * 0.35;
            if (need > y) y = need;
          }
          ty = y;
          rr += (anchors[s.to * 4 + 3] - rr) * k;
          // Unterwegs zieht sich der Schwarm zusammen.
          ring = 1 - 0.75 * Math.sin(Math.PI * Math.min(1, f * 1.15));
          if (f >= 1) {
            s.mode = 0;
            s.from = s.to;
            s.until = time + 14 + rnd() * 16;
          }
        }
        // Höhe weich nachführen, damit beim Wechsel nichts springt.
        s.cy += (ty - s.cy) * Math.min(1, dt * 1.5);
        for (let k = 0; k < perSwarm; k++) {
          const g = si * perSwarm + k;
          const o = g * 5;
          const rad = rr * gP[o + 1] * ring + 2;
          const a = gP[o] + (s.dir * time * 9) / (16 * gP[o + 1]);
          const x = s.cx + Math.cos(a) * rad;
          const z = s.cz + Math.sin(a) * rad;
          const y = s.cy + gP[o + 2] + Math.sin(time * 0.8 + gP[o + 3]) * 1.2;
          // Richtung aus der Bewegung, sanft nachgeführt; Schräglage in der Kurve.
          if (!gullInit) {
            gPrev[g * 3] = x - Math.sin(a) * s.dir;
            gPrev[g * 3 + 1] = y;
            gPrev[g * 3 + 2] = z + Math.cos(a) * s.dir;
            gYaw[g] = Math.atan2(x - gPrev[g * 3], z - gPrev[g * 3 + 2]);
          }
          const vx = x - gPrev[g * 3];
          const vz = z - gPrev[g * 3 + 2];
          let roll = gRoll[g];
          if (vx * vx + vz * vz > 1e-6) {
            const want = Math.atan2(vx, vz);
            let d = want - gYaw[g];
            d = Math.atan2(Math.sin(d), Math.cos(d));
            const turn = dt > 0 ? d / dt : 0;
            gYaw[g] += d * Math.min(1, dt * 8 + 0.2);
            roll += (Math.max(-0.7, Math.min(0.7, -turn * 0.6)) - roll) * Math.min(1, dt * 3);
          }
          gRoll[g] = roll;
          const climb = dt > 0 ? (y - gPrev[g * 3 + 1]) / Math.max(0.3, Math.hypot(vx, vz)) : 0;
          gPrev[g * 3] = x;
          gPrev[g * 3 + 1] = y;
          gPrev[g * 3 + 2] = z;
          e.set(-Math.max(-0.4, Math.min(0.4, climb)), gYaw[g], roll);
          q.setFromEuler(e);
          pv.set(x, y, z);
          sv.setScalar(GULL_SCALE);
          m4.compose(pv, q, sv);
          gullBodies.setMatrixAt(g, m4);
          // Flügelschlag im Wechsel mit Gleitflug.
          const flap = smooth((Math.sin(time * 0.55 + gP[o + 4]) + 0.15) * 2.5);
          const ang = 0.14 + flap * Math.sin(time * 9.5 + gP[o + 3]) * 0.7;
          wing.makeRotationZ(ang);
          wing.setPosition(0.14, 0.06, 0.05);
          out.multiplyMatrices(m4, wing);
          gullWings.setMatrixAt(g * 2, out);
          wing.makeRotationZ(Math.PI - ang);
          wing.setPosition(-0.14, 0.06, 0.05);
          out.multiplyMatrices(m4, wing);
          gullWings.setMatrixAt(g * 2 + 1, out);
        }
      }
      gullInit = true;
      gullBodies.instanceMatrix.needsUpdate = true;
      gullWings.instanceMatrix.needsUpdate = true;

      // --- Brandung ---
      for (let k = 0; k < nShore; k++) {
        const o = shoreIdx[k] * 5;
        const x = shore[o];
        const z = shore[o + 1];
        const nx = shore[o + 2];
        const nz = shore[o + 3];
        const cyc = time / SURF_PERIOD - shore[o + 4];
        const n = Math.floor(cyc);
        const w = cyc - n;
        const yaw = Math.atan2(nx, nz);
        e.set(0, yaw, 0);
        q.setFromEuler(e);
        // Schaum: schwillt an, wenn der Kamm ankommt (w = 0.8), und läuft wieder aus.
        let since = w - 0.8;
        if (since < 0) since += 1;
        const sw = Math.max(0, 1 - since * 1.7);
        const push = 3.2 - 2.6 * sw;
        pv.set(x + nx * push, sea + 0.1, z + nz * push);
        sv.set(1.15 + 0.35 * sw, 1, 1.1 + 2.4 * sw);
        m4.compose(pv, q, sv);
        surf.setMatrixAt(k, m4);
        // Wellenkamm: läuft von draußen heran und wird dabei breiter.
        if (k % 2 === 0) {
          const ci = nShore + k / 2;
          if (w < 0.8) {
            const f = w / 0.8;
            const d = CREST_RUN * (1 - f);
            pv.set(x + nx * d, sea + 0.18, z + nz * d);
            const grow = Math.min(1, f * 3);
            sv.set(0.5 + 0.9 * f, 1, 0.35 + 0.5 * grow);
            m4.compose(pv, q, sv);
            surf.setMatrixAt(ci, m4);
          } else surf.setMatrixAt(ci, zero);
        }
        // Gischt an der Kante, nur in Sichtweite.
        if (shoreCycle[k] !== n && w >= 0.8) {
          shoreCycle[k] = n;
          gishPick = (gishPick + 7) % 10;
          if (gishPick < 3 && Math.abs(x - cam.x) + Math.abs(z - cam.z) < 130) {
            for (let p = 0; p < 2; p++) {
              fx.puff(x + nx * 3 + (rnd() - 0.5) * 3, sea + 0.6, z + nz * 3 + (rnd() - 0.5) * 3, -nx * 2 + (rnd() - 0.5) * 2, 5 + rnd() * 3, -nz * 2 + (rnd() - 0.5) * 2, 1.1, 1.4 + rnd() * 0.8, 0xffffff, 0.8, 9);
            }
          }
        }
      }
      surf.instanceMatrix.needsUpdate = true;

      // --- Kutter ---
      for (let b = 0; b < nBoat; b++) {
        const o = b * 5;
        const cx = paths[o];
        const cz = paths[o + 1];
        const r = paths[o + 2];
        const dir = paths[o + 3];
        const a = paths[o + 4] + (dir * time * 2.6) / r;
        const x = cx + Math.cos(a) * r;
        const z = cz + Math.sin(a) * r;
        // Fahrtrichtung = Tangente des Kreises.
        const yaw = Math.atan2(-Math.sin(a) * dir, Math.cos(a) * dir);
        e.set(Math.sin(time * 0.9 + b) * 0.05, yaw, Math.sin(time * 1.3 + b * 2) * 0.08 + 0.05 * dir);
        q.setFromEuler(e);
        pv.set(x, sea - 0.15 + Math.sin(time * 1.1 + b) * 0.25, z);
        sv.setScalar(1.3);
        m4.compose(pv, q, sv);
        boats.setMatrixAt(b, m4);
        // Qualm aus dem Schornstein, Gischt am Bug.
        boatT[b] -= dt;
        if (boatT[b] <= 0) {
          boatT[b] = 0.65;
          const fx0 = Math.sin(yaw);
          const fz0 = Math.cos(yaw);
          fx.puff(x - fx0 * 3.1, sea + 7.6, z - fz0 * 3.1, -fx0 * 1.5 + 0.6, 2.5, -fz0 * 1.5, 3.2, 1.4 + rnd() * 0.6, rnd() < 0.5 ? 0x5a5866 : 0x77748a, 1.1, -1.5);
          fx.puff(x + fx0 * 7, sea + 0.4, z + fz0 * 7, fx0 * 2 + fz0 * (rnd() - 0.5) * 3, 2, fz0 * 2 - fx0 * (rnd() - 0.5) * 3, 0.9, 1.2, 0xffffff, 0.6, 6);
        }
      }
      if (nBoat > 0) boats.instanceMatrix.needsUpdate = true;

      // --- Bojen ---
      for (let b = 0; b < nBuoy; b++) {
        const ph = buoyPos[b * 3 + 1];
        e.set(Math.sin(time * 1.4 + ph) * 0.14, ph, Math.sin(time * 1.1 + ph * 1.7) * 0.14);
        q.setFromEuler(e);
        pv.set(buoyPos[b * 3], sea - 0.2 + Math.sin(time * 1.7 + ph) * 0.22, buoyPos[b * 3 + 2]);
        sv.setScalar(1.3);
        m4.compose(pv, q, sv);
        buoys.setMatrixAt(b, m4);
      }
      if (nBuoy > 0) buoys.instanceMatrix.needsUpdate = true;

      // --- Leuchtfeuer ---
      beam.rotation.y = time * 0.8;

      // --- Wal ---
      if (time >= whaleNext && nWhaleSpots > 0) {
        // Eine Stelle in Sichtweite der Kamera bevorzugen.
        let best = 0;
        let bestD = Infinity;
        for (let k = 0; k < 4; k++) {
          const c = Math.floor(rnd() * nWhaleSpots);
          const d = Math.abs(Math.hypot(whaleSpots[c * 3] - cam.x, whaleSpots[c * 3 + 1] - cam.z) - 150);
          if (d < bestD) {
            bestD = d;
            best = c;
          }
        }
        whaleSpot = best;
        whaleT0 = time;
        whaleNext = time + 24 + rnd() * 20;
        whaleSpout = 0;
      }
      const wt = time - whaleT0;
      if (wt >= 0 && wt < WHALE_DUR) {
        const hd = whaleSpots[whaleSpot * 3 + 2];
        const fx0 = Math.sin(hd);
        const fz0 = Math.cos(hd);
        // Auftauchen, Rücken zeigen, abtauchen – dabei hebt sich die Fluke.
        const rise = smooth(wt / 1.6);
        const dive = smooth((wt - 3.8) / 3);
        const x = whaleSpots[whaleSpot * 3] + fx0 * wt * 2.2;
        const z = whaleSpots[whaleSpot * 3 + 1] + fz0 * wt * 2.2;
        whale.position.set(x, sea - 4.6 + rise * 3.6 - dive * 3.4, z);
        whale.rotation.set(dive * 0.55 - (1 - rise) * 0.15, hd, 0, 'YXZ');
        whale.visible = true;
        // Fontäne aus dem Blasloch
        if (wt > 1.1 && wt < 2.1) {
          whaleSpout -= dt;
          while (whaleSpout <= 0) {
            whaleSpout += 0.09;
            fx.puff(x + fx0 * 5, sea + 1.6, z + fz0 * 5, (rnd() - 0.5) * 7, 14 + rnd() * 6, (rnd() - 0.5) * 7, 1.7, 1.8 + rnd() * 1.2, 0xf2fbff, 2.2, 8);
          }
        }
        // Platscher beim Auftauchen und wenn die Fluke wegtaucht.
        if ((wt < 0.5 && wt + dt >= 0.5) || (wt < 6.6 && wt + dt >= 6.6)) {
          const back = wt > 3 ? -9 : 2;
          for (let k = 0; k < 5; k++) {
            const a = (k / 5) * Math.PI * 2;
            fx.puff(x + fx0 * back + Math.cos(a) * 2.5, sea + 0.4, z + fz0 * back + Math.sin(a) * 2.5, Math.cos(a) * 5, 6 + rnd() * 3, Math.sin(a) * 5, 1.2, 1.8 + rnd(), 0xffffff, 1, 9);
          }
        }
      } else whale.visible = false;
    },
    dispose(): void {
      for (const d of disposables) d.dispose();
    },
  };
}
