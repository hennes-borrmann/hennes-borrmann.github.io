// Kulissen der vier Welten. Jedes Requisit ist eine kleine, eingefärbte
// Geometrie, die viele Male mit einem einzigen Zeichenaufruf gesetzt wird.
// Verteilt wird mit festem Zufall entlang der Strecke – nie auf der Fahrbahn.

import * as THREE from 'three';
import { SURFACE_INDEX } from '../game/surface';
import { EDGE_DECK, EDGE_TUNNEL, rightX, rightZ } from '../game/track';
import { MeshBuilder, mixRgb, noise, seeded, shade, textTexture, type RGB } from './build';
import { addSmoothNormals, outlineMaterial, rgb, toonMaterial } from './toon';
import type { World } from './world';

interface Placement {
  x: number;
  y: number;
  z: number;
  rot: number;
  sx: number;
  sy: number;
  sz: number;
  color?: number;
}

const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpE = new THREE.Euler();
const tmpV = new THREE.Vector3();
const tmpS = new THREE.Vector3();

function mat(x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx): THREE.Matrix4 {
  tmpE.set(rx, ry, rz);
  tmpQ.setFromEuler(tmpE);
  return tmpM.compose(tmpV.set(x, y, z), tmpQ, tmpS.set(sx, sy, sz)).clone();
}

export function buildScenery(world: World): { group: THREE.Group; dispose(): void } {
  const t = world.track;
  const th = world.theme;
  const group = new THREE.Group();
  const disposables: { dispose(): void }[] = [];
  const rnd = seeded(1000 + t.index * 97);
  const dense = world.detail === 0 ? 0.5 : 1;
  const toon = toonMaterial({ vertexColors: true });
  const glow = new THREE.MeshBasicMaterial({ vertexColors: true });
  disposables.push(toon, glow);

  /** Abstand zur nächsten Fahrbahn-Bande (negativ = auf der Strecke). */
  const clearance = (x: number, z: number): number => world.clearance(x, z);

  /** Zufällige Plätze neben der Strecke, zwischen minOut und maxOut Metern hinter der Bande. */
  const scatter = (
    count: number,
    minOut: number,
    maxOut: number,
    margin: number,
    accept?: (y: number, x: number, z: number) => boolean,
  ): Placement[] => {
    const out: Placement[] = [];
    const want = Math.round(count * dense);
    for (let tries = 0; out.length < want && tries < want * 12; tries++) {
      const i = Math.floor(rnd() * t.n);
      if (t.edge[i] & EDGE_DECK && th.liquidY !== null) continue;
      if (t.edge[i] & EDGE_TUNNEL) continue;
      const lat = (rnd() < 0.5 ? -1 : 1) * (t.wh[i] + 0.5 + minOut + rnd() * (maxOut - minOut));
      const x = t.px[i] + rightX(t, i) * lat;
      const z = t.pz[i] + rightZ(t, i) * lat;
      if (clearance(x, z) < margin) continue;
      const y = world.heightAt(x, z);
      if (th.liquidY !== null && y < th.liquidY + 0.5) continue;
      if (accept && !accept(y, x, z)) continue;
      const s = 0.8 + rnd() * 0.5;
      out.push({ x, y, z, rot: rnd() * Math.PI * 2, sx: s, sy: s, sz: s });
    }
    return out;
  };

  const place = (geo: THREE.BufferGeometry, list: Placement[], material: THREE.Material = toon, outline = false, into: THREE.Group = group): void => {
    if (list.length === 0) {
      geo.dispose();
      return;
    }
    const mesh = new THREE.InstancedMesh(geo, material, list.length);
    const col = new THREE.Color();
    list.forEach((p, i) => {
      mesh.setMatrixAt(i, mat(p.x, p.y, p.z, 0, p.rot, 0, p.sx, p.sy, p.sz));
      if (p.color !== undefined) mesh.setColorAt(i, col.set(p.color));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
    into.add(mesh);
    disposables.push(geo, mesh);
    if (outline && world.detail === 2) {
      addSmoothNormals(geo);
      const ol = new THREE.InstancedMesh(geo, outlineMaterial(0.06), list.length);
      ol.instanceMatrix = mesh.instanceMatrix;
      ol.boundingSphere = mesh.boundingSphere;
      ol.name = 'outline';
      into.add(ol);
      disposables.push(ol);
    }
  };

  const cyl = (rTop: number, rBot: number, h: number, sides = 7): THREE.BufferGeometry => new THREE.CylinderGeometry(rTop, rBot, h, sides, 1);
  const ico = (r: number, detail = 0): THREE.BufferGeometry => new THREE.IcosahedronGeometry(r, detail);
  /** Fügt eine Wegwerf-Geometrie ein und gibt sie gleich wieder frei. */
  const put = (b: MeshBuilder, geo: THREE.BufferGeometry, color: RGB, m: THREE.Matrix4): void => {
    b.add(geo, color, m);
    geo.dispose();
  };

  // --- Gemeinsam: Richtungstafeln in engen Kurven --------------------------------
  {
    const c = document.createElement('canvas');
    c.width = 192;
    c.height = 96;
    const g = c.getContext('2d')!;
    g.fillStyle = '#ffd23f';
    g.fillRect(0, 0, 192, 96);
    g.strokeStyle = '#16131c';
    g.lineWidth = 10;
    g.strokeRect(5, 5, 182, 86);
    g.fillStyle = '#16131c';
    for (let k = 0; k < 3; k++) {
      const x = 30 + k * 48;
      g.beginPath();
      g.moveTo(x, 20);
      g.lineTo(x + 22, 20);
      g.lineTo(x + 46, 48);
      g.lineTo(x + 22, 76);
      g.lineTo(x, 76);
      g.lineTo(x + 24, 48);
      g.closePath();
      g.fill();
    }
    const texR = new THREE.CanvasTexture(c);
    texR.colorSpace = THREE.SRGBColorSpace;
    const texL = texR.clone();
    texL.wrapS = THREE.RepeatWrapping;
    texL.repeat.x = -1;
    texL.needsUpdate = true;
    const right: Placement[] = [];
    const left: Placement[] = [];
    for (let i = 0; i < t.total; i += 5) {
      const k = t.curv[i];
      if (Math.abs(k) < 1 / 30) continue;
      // Wo zwei Fahrbahnen ineinander liegen, stünde die Tafel mitten auf der anderen.
      if (t.twin[i] >= 0) continue;
      // Außenseite der Kurve; in Fahrtrichtung lesbar.
      const sgn = k > 0 ? -1 : 1;
      if (t.edge[i] & (sgn < 0 ? 1 : 2)) continue;
      const lat = sgn * (t.wh[i] + 0.9);
      const p: Placement = {
        x: t.px[i] + rightX(t, i) * lat,
        y: t.py[i] + lat * t.bank[i] + 1.75,
        z: t.pz[i] + rightZ(t, i) * lat,
        rot: Math.atan2(-t.tx[i], -t.tz[i]),
        sx: 1,
        sy: 1,
        sz: 1,
      };
      (k > 0 ? right : left).push(p);
    }
    const board = (): THREE.BufferGeometry => new THREE.PlaneGeometry(2.5, 1.25);
    const mR = new THREE.MeshBasicMaterial({ map: texR, side: THREE.DoubleSide });
    const mL = new THREE.MeshBasicMaterial({ map: texL, side: THREE.DoubleSide });
    if (th.stars) {
      mR.color.setScalar(0.85);
      mL.color.setScalar(0.85);
    }
    place(board(), right, mR);
    place(board(), left, mL);
    disposables.push(texR, texL, mR, mL);
  }

  // --- Gemeinsam: Wald entlang der Waldwege --------------------------------------------
  {
    const dirt = SURFACE_INDEX.dirt;
    const spots: Placement[] = [];
    const cap = Math.round(170 * dense);
    for (let i = 0; i < t.total && spots.length < cap; i++) {
      if (t.surf[i] !== dirt || t.edge[i] & (EDGE_DECK | EDGE_TUNNEL)) continue;
      // Dicht an den Weg heran, dahinter lichter – auf jeder Seite etwa ein Baum alle drei Meter.
      for (const sgn of [-1, 1]) {
        if (rnd() > 0.34) continue;
        const lat = sgn * (t.wh[i] + 1.6 + rnd() * rnd() * 16);
        const x = t.px[i] + rightX(t, i) * lat + (rnd() - 0.5) * 2;
        const z = t.pz[i] + rightZ(t, i) * lat + (rnd() - 0.5) * 2;
        if (world.clearance(x, z) < 1.2) continue;
        const y = world.heightAt(x, z);
        if (th.liquidY !== null && y < th.liquidY + 0.6) continue;
        const k = 0.8 + rnd() * 0.7;
        spots.push({ x, y: y - 0.2, z, rot: rnd() * Math.PI * 2, sx: k, sy: k * (0.9 + rnd() * 0.4), sz: k });
      }
    }
    if (spots.length > 0) {
      // Kiefer: Stamm und drei gestufte Kronen
      const fb = new MeshBuilder();
      const needle = th.stars ? rgb(0x1f4a44) : rgb(0x2f7d4f);
      const needleD = th.stars ? rgb(0x183a36) : rgb(0x256642);
      put(fb, cyl(0.22, 0.34, 2.6, 5), th.stars ? rgb(0x3a2c33) : rgb(0x7a5230), mat(0, 1.3, 0));
      put(fb, new THREE.ConeGeometry(2.1, 3.2, 6), needleD, mat(0, 3.6, 0));
      put(fb, new THREE.ConeGeometry(1.6, 2.8, 6), needle, mat(0, 5.4, 0, 0, 0.5, 0));
      put(fb, new THREE.ConeGeometry(1.05, 2.4, 6), needleD, mat(0, 7.1, 0, 0, 1, 0));
      place(fb.build(), spots, toon);
    }
  }

  // --- Gemeinsam: Tafel im Keil jeder Gabelung – hier teilt sich die Strecke ----------
  if (t.branches.length > 0) {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 128;
    const g = c.getContext('2d')!;
    g.fillStyle = '#ffd23f';
    g.fillRect(0, 0, 256, 128);
    g.strokeStyle = '#16131c';
    g.lineWidth = 12;
    g.strokeRect(6, 6, 244, 116);
    g.lineWidth = 16;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    for (const dir of [-1, 1]) {
      const x0 = 128 + dir * 22;
      const x1 = 128 + dir * 84;
      g.beginPath();
      g.moveTo(x0, 100);
      g.lineTo(x0, 70);
      g.lineTo(x1, 34);
      g.stroke();
      g.beginPath();
      g.moveTo(x1 - dir * 34, 30);
      g.lineTo(x1, 34);
      g.lineTo(x1 - dir * 8, 66);
      g.stroke();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide });
    if (th.stars) material.color.setScalar(0.85);
    const signs: Placement[] = [];
    for (const b of t.branches) {
      // Letzter Abschnitt, auf dem beide Fahrbahnen noch ineinander liegen: dahinter beginnt der Keil.
      let last = -1;
      for (let k = 0; k < b.count && t.twin[b.first + k] >= 0; k++) last = b.first + k;
      if (last < 0) continue;
      const other = t.twin[last];
      const ax = (t.tx[last] + t.tx[other]) / 2;
      const az = (t.tz[last] + t.tz[other]) / 2;
      signs.push({
        x: (t.px[last] + t.px[other]) / 2 + ax * 5,
        y: Math.max(t.py[last], t.py[other]) + 2.6,
        z: (t.pz[last] + t.pz[other]) / 2 + az * 5,
        rot: Math.atan2(-ax, -az),
        sx: 1,
        sy: 1,
        sz: 1,
      });
    }
    place(new THREE.PlaneGeometry(4.4, 2.2), signs, material);
    disposables.push(tex, material);
  }

  // --- Ferne Kulisse: Ring am Horizont ---------------------------------------------
  {
    const b = new MeshBuilder();
    const R = 1700;
    const N = 96;
    const base = rgb(th.fog);
    const dark = mixRgb(base, rgb(th.sky[0]), 0.45);
    for (let i = 0; i < N; i++) {
      const a0 = (i / N) * Math.PI * 2;
      const a1 = ((i + 1) / N) * Math.PI * 2;
      const am = (a0 + a1) / 2;
      const p = (a: number, y: number): [number, number, number] => [world.center.x + Math.cos(a) * R, y, world.center.z + Math.sin(a) * R];
      const n1 = noise(i * 0.37, t.index * 3.1);
      const n2 = noise(i * 1.3 + 5, t.index);
      const col = shade(dark, 0.85 + n2 * 0.3);
      const y0 = -40;
      if (t.def.theme === 'nacht' || t.def.theme === 'werkshof') {
        // Dächer und Türme: rechteckige Umrisse
        const tall = t.def.theme === 'nacht' ? 90 + n1 * 330 + (n2 > 0.75 ? 160 : 0) : 40 + n1 * 90;
        b.quad(p(a1, y0), p(a0, y0), p(a0, tall), p(a1, tall), col);
        if (t.def.theme === 'werkshof' && n2 > 0.72) {
          const w = (a1 - a0) * 0.16;
          b.quad(p(am + w, y0), p(am - w, y0), p(am - w, tall + 150), p(am + w, tall + 150), shade(col, 0.9));
        }
      } else {
        // Berge und Inseln: gezackte Umrisse
        const peak = t.def.theme === 'glut' ? 120 + n1 * 300 : 20 + n1 * 90 * (n2 > 0.45 ? 1 : 0.1);
        b.quad(p(a1, y0), p(a0, y0), p(a0, peak * 0.45), p(a1, peak * 0.55), col);
        b.tri(p(a1, peak * 0.55), p(a0, peak * 0.45), p(am, peak), col);
      }
    }
    if (t.def.theme === 'glut') {
      // Der große Vulkan: steht im Osten und glüht.
      const cone = new THREE.CylinderGeometry(120, 520, 620, 9, 1, true);
      put(b, cone, shade(dark, 0.8), mat(world.center.x + R * 0.72, 250, world.center.z + R * 0.5));
    }
    const ringMat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(b.build(), ringMat);
    ring.renderOrder = -8;
    group.add(ring);
    disposables.push(ring.geometry, ringMat);
    if (t.def.theme === 'glut') {
      const lavaMat = new THREE.MeshBasicMaterial({ color: 0xff8a2a, fog: false });
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(124, 124, 14, 9), lavaMat);
      cap.position.set(world.center.x + R * 0.72, 556, world.center.z + R * 0.5);
      group.add(cap);
      disposables.push(cap.geometry, lavaMat);
    }
  }

  const theme = t.def.theme;

  // --- Werkshof ----------------------------------------------------------------
  if (theme === 'werkshof') {
    const paint = [0xff5a4e, 0x1fc8b6, 0xffd23f, 0x4f7bd8, 0xf2efe6, 0xff9a3c];
    // Container (Farbe je Stück), manche doppelt gestapelt
    const cb = new MeshBuilder();
    cb.box(0, 1.3, 0, 6.1, 2.6, 2.44, [1, 1, 1]);
    for (const x of [-2.95, 2.95]) cb.box(x, 1.3, 0, 0.22, 2.7, 2.54, [0.55, 0.55, 0.6]);
    for (let k = -2; k <= 2; k++) cb.box(k * 1.05, 1.3, 0, 0.12, 2.3, 2.5, [0.86, 0.86, 0.9]);
    const containers: Placement[] = [];
    for (const p of scatter(30, 2.2, 38, 4.5, (y) => y < 3)) {
      const i = Math.floor(rnd() * t.n);
      p.rot = Math.round(rnd() * 3) * (Math.PI / 2) + Math.atan2(t.tx[i], t.tz[i]) * 0;
      p.sx = p.sy = p.sz = 1;
      p.color = paint[Math.floor(rnd() * paint.length)];
      containers.push(p);
      if (rnd() < 0.45) containers.push({ ...p, y: p.y + 2.6, color: paint[Math.floor(rnd() * paint.length)] });
    }
    place(cb.build(), containers, toon, true);

    // Werkhallen mit Sägezahndach
    const hb = new MeshBuilder();
    const wall = rgb(0xd9c7a8);
    hb.box(0, 4.5, 0, 28, 9, 17, wall);
    hb.box(0, 5.2, 8.56, 26, 1.6, 0.1, rgb(0x6fd0e6));
    hb.box(0, 5.2, -8.56, 26, 1.6, 0.1, rgb(0x6fd0e6));
    for (let k = 0; k < 4; k++) {
      const x = -10.5 + k * 7;
      const z0 = -8.5;
      const z1 = 8.5;
      const roof = rgb(0xb5543c);
      hb.tri([x - 3.5, 9, z1], [x + 3.5, 9, z1], [x + 3.5, 12, z1], wall);
      hb.tri([x + 3.5, 9, z0], [x - 3.5, 9, z0], [x + 3.5, 12, z0], wall);
      hb.quad([x - 3.5, 9, z1], [x + 3.5, 12, z1], [x + 3.5, 12, z0], [x - 3.5, 9, z0], roof);
      hb.quad([x + 3.5, 9, z1], [x + 3.5, 9, z0], [x + 3.5, 12, z0], [x + 3.5, 12, z1], rgb(0x9fe3f2));
    }
    place(
      hb.build(),
      scatter(7, 34, 110, 26).map((p) => ({ ...p, sx: 1, sy: 0.9 + rnd() * 0.5, sz: 1, rot: Math.round(rnd() * 3) * (Math.PI / 2) })),
      toon,
      true,
    );

    // Schornsteine mit Ringen
    const sb = new MeshBuilder();
    for (let k = 0; k < 6; k++) {
      const r0 = 2.1 - k * 0.14;
      put(sb, cyl(r0 - 0.14, r0, 6, 8), k >= 4 ? (k % 2 === 0 ? rgb(0xff5a4e) : rgb(0xf7f2e4)) : rgb(0xb98a6a), mat(0, 3 + k * 6, 0));
    }
    place(sb.build(), scatter(5, 50, 130, 30), toon, true);

    // Portalkran
    const kb = new MeshBuilder();
    const yel = rgb(0xffc72e);
    for (const x of [-9, 9]) {
      kb.box(x, 7, -3, 0.9, 14, 0.9, yel);
      kb.box(x, 7, 3, 0.9, 14, 0.9, yel);
      kb.box(x, 0.4, 0, 1.4, 0.8, 8, rgb(0x2f2c39));
    }
    kb.box(0, 14.6, 0, 26, 1.6, 2.2, yel);
    kb.box(3, 12.8, 0, 3, 2.2, 2.6, rgb(0x2f2c39));
    kb.box(3, 9.5, 0, 0.2, 5, 0.2, rgb(0x2f2c39));
    place(
      kb.build(),
      scatter(3, 16, 50, 14).map((p) => ({ ...p, sx: 1, sy: 1, sz: 1 })),
      toon,
      true,
    );

    // Reifenstapel und Pappeln
    const tb = new MeshBuilder();
    for (let k = 0; k < 3; k++) put(tb, new THREE.TorusGeometry(0.55, 0.26, 5, 10), rgb(0x2a2733), mat(0, 0.28 + k * 0.5, 0, Math.PI / 2));
    place(tb.build(), scatter(26, 0.6, 1.4, 0.9), toon);
    const pb = new MeshBuilder();
    put(pb, cyl(0.25, 0.35, 2.4, 6), rgb(0x6a4a34), mat(0, 1.2, 0));
    put(pb, ico(1, 1), rgb(0x5f9a45), mat(0, 5.4, 0, 0, 0, 0, 1.7, 3.6, 1.7));
    place(pb.build(), scatter(34, 5, 70, 5), toon, true);
  }

  // --- Möwenklippe -------------------------------------------------------------
  if (theme === 'klippe') {
    // Palmen am Strand
    const pb = new MeshBuilder();
    const trunk = rgb(0xa9794a);
    const leaf = rgb(0x3fae5a);
    const leafD = rgb(0x2f8a4a);
    const segs = [
      [0, 0.8, 0],
      [0.22, 2.3, 0.1],
      [0.6, 3.7, 0.2],
      [1.15, 5.0, 0.3],
    ];
    segs.forEach((s, k) => put(pb, cyl(0.2 - k * 0.02, 0.27 - k * 0.02, 1.7, 6), trunk, mat(s[0], s[1], 0, 0, 0, -s[2])));
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2;
      const c = Math.cos(a);
      const s = Math.sin(a);
      const o: [number, number, number] = [1.4, 5.9, 0];
      const m: [number, number, number] = [1.4 + c * 1.7, 6.3, s * 1.7];
      const e: [number, number, number] = [1.4 + c * 3.3, 4.9, s * 3.3];
      const w = 0.55;
      const l: [number, number, number] = [m[0] - s * w, m[1] - 0.1, m[2] + c * w];
      const r: [number, number, number] = [m[0] + s * w, m[1] - 0.1, m[2] - c * w];
      for (const [col, flip] of [
        [leaf, false],
        [leafD, true],
      ] as [RGB, boolean][]) {
        if (!flip) {
          pb.tri(o, l, r, col);
          pb.tri(l, e, r, col);
        } else {
          pb.tri(o, r, l, col);
          pb.tri(l, r, e, col);
        }
      }
    }
    place(pb.build(), scatter(26, 1.5, 34, 2.2, (y) => y < 5), toon);

    // Kiefern auf der Hochfläche
    const tb = new MeshBuilder();
    put(tb, cyl(0.22, 0.34, 2.2, 6), rgb(0x7a5230), mat(0, 1.1, 0));
    put(tb, ico(1.5, 1), rgb(0x3f9a52), mat(0, 3.3, 0, 0, 0, 0, 1.25, 1, 1.25));
    put(tb, ico(1.1, 1), rgb(0x55b566), mat(0.3, 4.6, 0.1));
    place(tb.build(), scatter(40, 2, 60, 3, (y) => y > 6), toon, true);

    // Felsen
    const rb = new MeshBuilder();
    put(rb, ico(1.2, 0), rgb(0xd9d2c2), mat(0, 0.5, 0, 0.3, 0, 0.2, 1.3, 0.8, 1));
    place(
      rb.build(),
      scatter(46, 1.2, 70, 2).map((p) => ({ ...p, sx: p.sx * (0.7 + rnd() * 1.8), sy: p.sy * (0.7 + rnd() * 1.4), sz: p.sz * (0.7 + rnd() * 1.8) })),
      toon,
      true,
    );

    // Sonnenschirme am Strand
    const ub = new MeshBuilder();
    put(ub, cyl(0.05, 0.05, 2.4, 5), rgb(0xf2efe6), mat(0, 1.2, 0));
    const cone = new THREE.ConeGeometry(1.6, 0.7, 8, 1, true).toNonIndexed();
    const cp = cone.getAttribute('position');
    const v = new THREE.Vector3();
    for (let i = 0; i < cp.count; i += 3) {
      const tri: [number, number, number][] = [];
      for (let k = 0; k < 3; k++) {
        v.fromBufferAttribute(cp, i + k);
        tri.push([v.x, v.y + 2.5, v.z]);
      }
      ub.tri(tri[0], tri[1], tri[2], Math.floor(i / 6) % 2 === 0 ? rgb(0xff7a59) : rgb(0xffffff));
    }
    cone.dispose();
    place(ub.build(), scatter(14, 2, 22, 2.5, (y) => y < 1.6), toon);

    // Leuchtturm an der Nordwest-Ecke
    const lb = new MeshBuilder();
    for (let k = 0; k < 5; k++) put(lb, cyl(2.3 - k * 0.3, 2.6 - k * 0.3, 4.4, 10), k % 2 === 0 ? rgb(0xffffff) : rgb(0xff5a4e), mat(0, 2.2 + k * 4.4, 0));
    put(lb, cyl(1.9, 1.9, 0.4, 10), rgb(0x30364a), mat(0, 22.2, 0));
    put(lb, cyl(1.0, 1.0, 2.2, 8), rgb(0xfff06a), mat(0, 23.5, 0));
    put(lb, new THREE.ConeGeometry(1.7, 1.8, 8), rgb(0xff5a4e), mat(0, 25.5, 0));
    const li = t.landmark;
    const llat = t.wh[li] + 13;
    const lx = t.px[li] + rightX(t, li) * llat;
    const lz = t.pz[li] + rightZ(t, li) * llat;
    place(lb.build(), [{ x: lx, y: world.heightAt(lx, lz) - 0.5, z: lz, rot: 0, sx: 1, sy: 1, sz: 1 }], toon, true);

    // Segelboote auf dem Meer
    const bb = new MeshBuilder();
    bb.box(0, 0.35, 0, 1.5, 0.9, 4.4, rgb(0xffffff), 0, rgb(0xc08a52));
    put(bb, cyl(0.06, 0.06, 5, 5), rgb(0x30364a), mat(0, 3, 0.2));
    for (const [c, flip] of [
      [rgb(0xff7a59), false],
      [rgb(0xff7a59), true],
    ] as [RGB, boolean][]) {
      const a: [number, number, number] = [0, 0.9, 0];
      const b2: [number, number, number] = [0, 5.4, 0.2];
      const c2: [number, number, number] = [0, 0.9, -2.3];
      if (flip) bb.tri(a, c2, b2, c);
      else bb.tri(a, b2, c2, c);
    }
    const boats: Placement[] = [];
    for (let tries = 0; boats.length < 9 && tries < 200; tries++) {
      const a = rnd() * Math.PI * 2;
      const d = world.radius * (0.55 + rnd() * 1.1);
      const x = world.center.x + Math.cos(a) * d;
      const z = world.center.z + Math.sin(a) * d;
      if (clearance(x, z) < 14 || world.heightAt(x, z) > th.liquidY! - 1.5) continue;
      boats.push({ x, y: th.liquidY! - 0.1, z, rot: rnd() * 6.3, sx: 1.6, sy: 1.6, sz: 1.6 });
    }
    // Schwimmen: steigen und fallen mit dem Pegel (world.floating).
    place(bb.build(), boats, toon, true, world.floating);
  }

  // --- Glutkessel --------------------------------------------------------------
  if (theme === 'glut') {
    const rock = rgb(0x3a2c40);
    const rockL = rgb(0x6b5565);
    // Felszacken
    const sb = new MeshBuilder();
    put(sb, new THREE.ConeGeometry(1.4, 6, 5), rock, mat(0, 2.6, 0, 0.12, 0, 0.1));
    put(sb, new THREE.ConeGeometry(0.8, 3.2, 5), rockL, mat(1.1, 1.2, 0.4, -0.2, 0, -0.35));
    place(
      sb.build(),
      scatter(70, 1.4, 70, 2.4).map((p) => ({ ...p, sy: p.sy * (0.8 + rnd() * 2.2), sx: p.sx * (0.8 + rnd() * 1.2), sz: p.sz * (0.8 + rnd() * 1.2) })),
      toon,
      true,
    );
    // Brocken
    const bb = new MeshBuilder();
    put(bb, ico(1.3, 0), rockL, mat(0, 0.6, 0, 0.4, 0.2, 0.1, 1.2, 0.85, 1));
    place(
      bb.build(),
      scatter(44, 1.2, 60, 2).map((p) => ({ ...p, sx: p.sx * (0.6 + rnd() * 1.6), sy: p.sy * (0.6 + rnd() * 1.2), sz: p.sz * (0.6 + rnd() * 1.6) })),
      toon,
      true,
    );
    // Verkohlte Bäume
    const tb = new MeshBuilder();
    const char = rgb(0x1f1826);
    put(tb, cyl(0.12, 0.3, 4.4, 5), char, mat(0, 2.2, 0, 0, 0, 0.06));
    put(tb, cyl(0.05, 0.12, 2.2, 4), char, mat(0.7, 3.4, 0, 0, 0, -0.9));
    put(tb, cyl(0.05, 0.11, 1.8, 4), char, mat(-0.6, 3.9, 0.2, 0.3, 0, 0.8));
    put(tb, cyl(0.04, 0.09, 1.3, 4), char, mat(0.1, 4.8, -0.4, -0.7, 0, 0.1));
    place(tb.build(), scatter(22, 2, 40, 2.5), toon);
    // Glutkristalle: leuchten von selbst
    const kb = new MeshBuilder();
    put(kb, new THREE.OctahedronGeometry(0.7), rgb(0xff9a1f), mat(0, 0.9, 0, 0, 0, 0.2, 0.7, 1.6, 0.7));
    put(kb, new THREE.OctahedronGeometry(0.45), rgb(0xffe27a), mat(0.6, 0.5, 0.2, 0.2, 0, -0.5, 0.7, 1.4, 0.7));
    place(kb.build(), scatter(34, 0.9, 16, 1.4), glow);
  }

  // --- Nachtschicht ------------------------------------------------------------
  if (theme === 'nacht') {
    // Fensterraster als Textur: 8 × 8 Fenster, zufällig erleuchtet
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d')!;
    g.fillStyle = '#181a33';
    g.fillRect(0, 0, 128, 128);
    const lit = ['#ffd86a', '#ffd86a', '#fff1b8', '#58e6dc', '#ff6ab0'];
    const wr = seeded(4711);
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        g.fillStyle = wr() < 0.42 ? lit[Math.floor(wr() * lit.length)] : '#262a4a';
        g.fillRect(x * 16 + 4, y * 16 + 4, 9, 9);
      }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.magFilter = THREE.NearestFilter;
    const bb = new MeshBuilder();
    const roofs = new MeshBuilder();
    const white: RGB = [1, 1, 1];
    const cellSize = 40;
    const span = world.radius + 230;
    const lights: number[] = [];
    for (let gx = -span; gx <= span; gx += cellSize) {
      for (let gz = -span; gz <= span; gz += cellSize) {
        if (rnd() < 0.22) continue;
        const w = 16 + rnd() * 14;
        const d = 16 + rnd() * 14;
        const x = world.center.x + gx + (rnd() - 0.5) * 8;
        const z = world.center.z + gz + (rnd() - 0.5) * 8;
        const gap = clearance(x, z) - Math.max(w, d) * 0.72;
        if (gap < 5) continue;
        // Nah an der Strecke niedriger, damit die Fahrbahn nicht im Schatten verschwindet.
        const h = Math.min(18 + rnd() * 70, 14 + gap * 1.6) * (world.detail === 0 && rnd() < 0.4 ? 0 : 1);
        if (h < 6) continue;
        const u0 = Math.floor(rnd() * 8) / 8;
        const faces: [number, number, number, number, number][] = [
          [x - w / 2, z + d / 2, x + w / 2, z + d / 2, w],
          [x + w / 2, z + d / 2, x + w / 2, z - d / 2, d],
          [x + w / 2, z - d / 2, x - w / 2, z - d / 2, w],
          [x - w / 2, z - d / 2, x - w / 2, z + d / 2, d],
        ];
        for (const [ax, az, bx, bz, len] of faces) {
          bb.quadUv([ax, 0, az], [bx, 0, bz], [bx, h, bz], [ax, h, az], white, u0, 0, u0 + Math.round(len / 4) / 8, Math.round(h / 3.6) / 8);
        }
        roofs.quad([x - w / 2, h, z + d / 2], [x + w / 2, h, z + d / 2], [x + w / 2, h, z - d / 2], [x - w / 2, h, z - d / 2], rgb(0x23263f));
        if (rnd() < 0.5) roofs.box(x + (rnd() - 0.5) * w * 0.4, h + 1.2, z + (rnd() - 0.5) * d * 0.4, 4, 2.4, 4, rgb(0x2d3050));
        if (h > 44) {
          roofs.box(x, h + 5, z, 0.3, 10, 0.3, rgb(0x2d3050));
          lights.push(x, h + 10.4, z);
        }
      }
    }
    const bMat = new THREE.MeshBasicMaterial({ map: tex });
    const buildings = new THREE.Mesh(bb.build(), bMat);
    const roofMesh = new THREE.Mesh(roofs.build(), toon);
    group.add(buildings, roofMesh);
    disposables.push(buildings.geometry, roofMesh.geometry, bMat, tex);
    if (lights.length > 0) {
      const lg = new THREE.BufferGeometry();
      lg.setAttribute('position', new THREE.Float32BufferAttribute(lights, 3));
      const lm = new THREE.PointsMaterial({ color: 0xff3d5a, size: 5, sizeAttenuation: false, fog: false });
      group.add(new THREE.Points(lg, lm));
      disposables.push(lg, lm);
    }

    // Laternen an der Hochstraße
    const lb = new MeshBuilder();
    const pole = rgb(0x12142a);
    for (let i = 4; i < t.n; i += 13) {
      if (t.edge[i] & 7) continue;
      const sgn = Math.floor(i / 13) % 2 === 0 ? -1 : 1;
      const lat = sgn * (t.wh[i] + 0.25);
      const x = t.px[i] + rightX(t, i) * lat;
      const z = t.pz[i] + rightZ(t, i) * lat;
      const y = t.py[i] + lat * t.bank[i] + 0.9;
      const rot = Math.atan2(t.tx[i], t.tz[i]);
      lb.box(x, y + 2.2, z, 0.16, 4.4, 0.16, pole, rot);
      const ix = x - rightX(t, i) * sgn * 1.1;
      const iz = z - rightZ(t, i) * sgn * 1.1;
      lb.box((x + ix) / 2, y + 4.4, (z + iz) / 2, 1.3, 0.14, 0.14, pole, rot);
      lb.box(ix, y + 4.25, iz, 0.5, 0.22, 0.5, sgn < 0 ? rgb(0xfff1a8) : rgb(0x8ff7ee), rot);
    }
    const lamps = new THREE.Mesh(lb.build(), glow);
    group.add(lamps);
    disposables.push(lamps.geometry);

    // Leuchtreklame auf Masten neben der Strecke
    const words: [string, string, string][] = [
      ['KINO', '#ff3d9a', '#1a0a22'],
      ['IMBISS', '#ffd23f', '#1a1408'],
      ['24 h', '#1fd6c8', '#06201e'],
      ['HOTEL', '#ff6a3d', '#200d06'],
      ['SPÄTI', '#8ff7ee', '#06201e'],
      ['TAXI', '#ffd23f', '#1a1408'],
      ['DISCO', '#c58bff', '#150a22'],
      ['BAR', '#ff3d9a', '#1a0a22'],
    ];
    const mast = new MeshBuilder();
    words.forEach(([text, fg, bg], k) => {
      const i = Math.floor(((k + 0.5) / words.length) * t.n);
      const sgn = k % 2 === 0 ? 1 : -1;
      const lat = sgn * (t.wh[i] + 5);
      const x = t.px[i] + rightX(t, i) * lat;
      const z = t.pz[i] + rightZ(t, i) * lat;
      if (clearance(x, z) < 3) return;
      const y = t.py[i] + 6.5;
      const signTex = textTexture(text, { w: 256, h: 112, bg, fg, border: fg });
      const m = new THREE.MeshBasicMaterial({ map: signTex, side: THREE.DoubleSide, fog: false });
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(7.4, 3.2), m);
      sign.position.set(x, y, z);
      sign.rotation.y = Math.atan2(-t.tx[i], -t.tz[i]) + sgn * 0.5;
      group.add(sign);
      mast.box(x, y / 2 - 1, z, 0.5, y, 0.5, pole);
      disposables.push(sign.geometry, m, signTex);
    });
    if (!mast.empty) {
      const mm = new THREE.Mesh(mast.build(), toon);
      group.add(mm);
      disposables.push(mm.geometry);
    }
  }

  return {
    group,
    dispose(): void {
      for (const d of disposables) d.dispose();
    },
  };
}
