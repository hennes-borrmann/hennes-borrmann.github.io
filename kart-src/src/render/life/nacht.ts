// Leben in der Nachtschicht: eine Stadt, die nachts lebt. Auf einer Hochstraße
// rings um die Strecke strömt der Verkehr in beide Richtungen, Leuchtreklamen
// darauf flackern, am Himmel zieht ein Luftschiff mit Laufschrift seine Runden,
// ein Flugzeug blinkt vorbei, Suchscheinwerfer schwenken, und über der Skyline
// geht immer wieder ein Feuerwerk hoch.
//
// Die Hochstraße folgt freien Straßenzügen zwischen den Häusern der Kulisse:
// gesucht wird im Belegungsraster (siehe werkshof.ts), nicht an festen Stellen.

import * as THREE from 'three';
import { MeshBuilder, seeded, shade, type RGB, type V3 } from '../build';
import type { FxSink } from '../fxApi';
import type { Life } from '../life';
import { addSmoothNormals, outlineMaterial, rgb, toonMaterial } from '../toon';
import type { World } from '../world';
import { Belegung } from './werkshof';

const UP = new THREE.Vector3(0, 1, 0);

/** Fester Zufall aus zwei Zahlen (für Feuerwerk ohne gespeicherten Zustand). */
function hash(a: number, b: number): number {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Geschlossener Linienzug mit Bogenlänge: Lage und Richtung an jeder Stelle. */
class Ring {
  readonly x: Float32Array;
  readonly z: Float32Array;
  readonly len: number;
  private readonly cum: Float32Array;

  constructor(pts: [number, number][]) {
    const n = pts.length;
    this.x = new Float32Array(n);
    this.z = new Float32Array(n);
    this.cum = new Float32Array(n + 1);
    for (let i = 0; i < n; i++) {
      this.x[i] = pts[i][0];
      this.z[i] = pts[i][1];
    }
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      this.cum[i + 1] = this.cum[i] + Math.hypot(this.x[j] - this.x[i], this.z[j] - this.z[i]);
    }
    this.len = this.cum[n];
  }

  /** Punkt bei Bogenlänge s, seitlich um lat versetzt; Richtung (dx, dz) in out[2], out[3]. */
  at(s: number, lat: number, out: Float32Array): void {
    const n = this.x.length;
    s = ((s % this.len) + this.len) % this.len;
    // Binäre Suche im kumulierten Abstand
    let lo = 0;
    let hi = n;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (this.cum[mid] <= s) lo = mid;
      else hi = mid;
    }
    const j = (lo + 1) % n;
    const seg = this.cum[lo + 1] - this.cum[lo] || 1;
    const f = (s - this.cum[lo]) / seg;
    const dx = (this.x[j] - this.x[lo]) / seg;
    const dz = (this.z[j] - this.z[lo]) / seg;
    out[0] = this.x[lo] + (this.x[j] - this.x[lo]) * f - dz * lat;
    out[1] = this.z[lo] + (this.z[j] - this.z[lo]) * f + dx * lat;
    out[2] = dx;
    out[3] = dz;
  }
}

export function buildNachtLife(world: World): Life {
  const t = world.track;
  const th = world.theme;
  const group = new THREE.Group();
  const disposables: { dispose(): void }[] = [];
  const rnd = seeded(8800 + t.index * 17);
  const detail = world.detail;
  const lines = detail > 0;
  const cx = world.center.x;
  const cz = world.center.z;
  const bel = new Belegung(world, 2, 300);
  const toon = toonMaterial({ vertexColors: true });
  disposables.push(toon);

  // --- Hochstraße: geschlossene Schleife um die Strecke ----------------------------
  // Im Raster der Belegung wird der kürzeste Rundweg gesucht, der die Strecke
  // umschließt, überall genug Abstand zur Bande hält und zwischen den Häusern
  // hindurchpasst. Danach wird er zu geraden Stücken gestrafft und an den Ecken
  // gerundet – eine Stadtautobahn, die sich durch die Häuserschluchten zieht.
  const HW = 4.2; // halbe Breite der Fahrbahn
  const GAP = 16; // mindestens so weit hinter der Bande
  const LANE = 1.6;
  const N = bel.n;
  const C = bel.cell;
  const cellOf = (x: number, z: number): number => {
    const ix = Math.min(N - 1, Math.max(0, Math.floor((x - bel.x0) / C)));
    const iz = Math.min(N - 1, Math.max(0, Math.floor((z - bel.z0) / C)));
    return iz * N + ix;
  };
  const tdist = bel.bande;
  // Gesperrt: zu nah an der Strecke oder an einem Haus (um die halbe Breite aufgeweitet).
  // "Nah" (teurer): knapp neben Häusern – die Straße soll nicht an den Wänden kleben.
  const dilate = (src: Uint8Array, r: number): Uint8Array => {
    const tmp = new Uint8Array(N * N);
    const out = new Uint8Array(N * N);
    for (let iz = 0; iz < N; iz++) {
      for (let ix = 0; ix < N; ix++) {
        if (!src[iz * N + ix]) continue;
        for (let k = Math.max(0, ix - r); k <= Math.min(N - 1, ix + r); k++) tmp[iz * N + k] = 1;
      }
    }
    for (let iz = 0; iz < N; iz++) {
      for (let ix = 0; ix < N; ix++) {
        if (!tmp[iz * N + ix]) continue;
        for (let k = Math.max(0, iz - r); k <= Math.min(N - 1, iz + r); k++) out[k * N + ix] = 1;
      }
    }
    return out;
  };
  const occ = new Uint8Array(N * N);
  for (let k = 0; k < N * N; k++) occ[k] = bel.top[k] > -Infinity ? 1 : 0;
  const blocked = dilate(occ, Math.ceil((HW + 1) / C));
  const near = dilate(occ, Math.ceil((HW + 5) / C));
  for (let k = 0; k < N * N; k++) if (tdist[k] < GAP + HW) blocked[k] = 1;

  // Kürzester Rundweg: Dijkstra mit einem Schnitt. Vom östlichsten Streckenpunkt
  // läuft ein Strahl nach Osten, über den kein Schritt führen darf; Start direkt
  // nördlich, Ziel direkt südlich davon. Jeder Weg vom einen zum anderen muss
  // also um den Streckenpunkt herum – und weil die gesperrte Zone um die Strecke
  // zusammenhängt, um die ganze Strecke.
  let east = 0;
  for (let i = 1; i < t.total; i++) if (t.px[i] > t.px[east]) east = i;
  const e0 = cellOf(t.px[east], t.pz[east]);
  const ix0 = e0 % N;
  const iz0 = Math.max(1, Math.floor(e0 / N));
  const path: number[] = [];
  // Liegt der erste freie Start in einem abgeschlossenen Hinterhof, den nächsten probieren.
  let sx = ix0;
  for (let attempt = 0; attempt < 6 && path.length === 0; attempt++) {
    let found = false;
    for (let ix = sx + 1; ix < N; ix++) {
      const free = !blocked[iz0 * N + ix] && !blocked[(iz0 - 1) * N + ix];
      // Erst hinter einem gesperrten Stück neu ansetzen (sonst derselbe Hof).
      if (free && (attempt === 0 || blocked[iz0 * N + ix - 1] || blocked[(iz0 - 1) * N + ix - 1])) {
        sx = ix;
        found = true;
        break;
      }
    }
    if (!found) break;
    const S = iz0 * N + sx;
    const T = (iz0 - 1) * N + sx;
    const cost = new Float64Array(N * N).fill(Infinity);
    const prev = new Int32Array(N * N).fill(-1);
    // Binärer Heap über (Kosten, Zelle)
    const cap = N * N * 2;
    const hk = new Float64Array(cap);
    const hv = new Int32Array(cap);
    let hn = 0;
    const push = (k: number, v: number): void => {
      if (hn >= cap) return;
      let i = hn++;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (hk[p] <= k) break;
        hk[i] = hk[p];
        hv[i] = hv[p];
        i = p;
      }
      hk[i] = k;
      hv[i] = v;
    };
    const pop = (): number => {
      const top = hv[0];
      const k = hk[--hn];
      const v = hv[hn];
      let i = 0;
      for (;;) {
        let c = i * 2 + 1;
        if (c >= hn) break;
        if (c + 1 < hn && hk[c + 1] < hk[c]) c++;
        if (hk[c] >= k) break;
        hk[i] = hk[c];
        hv[i] = hv[c];
        i = c;
      }
      hk[i] = k;
      hv[i] = v;
      return top;
    };
    cost[S] = 0;
    push(0, S);
    const DX = [1, -1, 0, 0, 1, 1, -1, -1];
    const DZ = [0, 0, 1, -1, 1, -1, 1, -1];
    const DL = [1, 1, 1, 1, Math.SQRT2, Math.SQRT2, Math.SQRT2, Math.SQRT2];
    while (hn > 0) {
      const kk = hk[0];
      const at = pop();
      if (at === T) break;
      // Veraltete Einträge (die Zelle wurde inzwischen günstiger erreicht) überspringen.
      if (kk > cost[at]) continue;
      const ax = at % N;
      const az = (at - ax) / N;
      const ca = cost[at];
      for (let d = 0; d < 8; d++) {
        const bx = ax + DX[d];
        const bz = az + DZ[d];
        if (bx < 0 || bz < 0 || bx >= N || bz >= N) continue;
        // Schnitt: kein Schritt zwischen den Reihen iz0-1 und iz0 östlich des Streckenpunkts.
        if (az !== bz && Math.min(az, bz) === iz0 - 1 && Math.min(ax, bx) > ix0) continue;
        const b = bz * N + bx;
        if (blocked[b]) continue;
        const nc = ca + DL[d] * (near[b] ? 1.7 : 1);
        if (nc < cost[b]) {
          cost[b] = nc;
          prev[b] = at;
          push(nc, b);
        }
      }
    }
    if (prev[T] >= 0) for (let k = T; k >= 0 && path.length < N * N; k = prev[k]) path.push(k);
  }

  // Straffen: von jedem Eckpunkt so weit geradeaus, wie die Sichtlinie frei bleibt.
  const px = (k: number): number => bel.x0 + ((k % N) + 0.5) * C;
  const pz = (k: number): number => bel.z0 + (Math.floor(k / N) + 0.5) * C;
  const los = (a: number, b: number): boolean => {
    const x0 = px(a);
    const z0 = pz(a);
    const x1 = px(b);
    const z1 = pz(b);
    const n = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / (C * 0.5));
    for (let i = 1; i < n; i++) if (blocked[cellOf(x0 + ((x1 - x0) * i) / n, z0 + ((z1 - z0) * i) / n)]) return false;
    return true;
  };
  const corners: [number, number][] = [];
  if (path.length > 8) {
    const idx: number[] = [0];
    let i = 0;
    while (i < path.length - 1) {
      let j = i + 1;
      while (j + 1 < path.length && los(path[i], path[j + 1])) j++;
      idx.push(j);
      i = j;
    }
    // Der Startpunkt liegt willkürlich: fällt er auf eine Gerade, weg damit.
    if (idx.length > 3 && los(path[idx[idx.length - 1]], path[idx[1]])) idx.shift();
    if (idx[idx.length - 1] === path.length - 1 && idx[0] === 0 && los(path[idx[idx.length - 2]], path[0])) idx.pop();
    for (const k of idx) corners.push([px(path[k]), pz(path[k])]);
  }
  // Ecken runden (quadratische Bézierkurve durch den Eckpunkt als Stützpunkt).
  const ringPts: [number, number][] = [];
  const NC = corners.length;
  for (let k = 0; k < NC; k++) {
    const [ax, az] = corners[(k - 1 + NC) % NC];
    const [vx, vz] = corners[k];
    const [bx, bz] = corners[(k + 1) % NC];
    const la = Math.hypot(vx - ax, vz - az);
    const lb = Math.hypot(bx - vx, bz - vz);
    const r = Math.min(12, la * 0.45, lb * 0.45);
    const p0x = vx + ((ax - vx) / la) * r;
    const p0z = vz + ((az - vz) / la) * r;
    const p2x = vx + ((bx - vx) / lb) * r;
    const p2z = vz + ((bz - vz) / lb) * r;
    for (let q = 0; q <= 5; q++) {
      const f = q / 5;
      const g = 1 - f;
      ringPts.push([g * g * p0x + 2 * g * f * vx + f * f * p2x, g * g * p0z + 2 * g * f * vz + f * f * p2z]);
    }
  }
  if (ringPts.length < 3) ringPts.push([cx, cz], [cx + 1, cz], [cx, cz + 1]);
  const hasRoad = NC >= 3;
  const ring = new Ring(ringPts);
  // Höhe der Fahrbahn: etwas unter der typischen Höhe der Strecke. Läge sie
  // höher, sähe man von der Strecke aus nur ihre Unterseite; läge sie tief unter
  // einer aufgeständerten Strecke, verschwände der Verkehr hinter der Bande.
  const ys = Array.from(t.py.subarray(0, t.total)).sort((a, b) => a - b);
  const DECK_Y = Math.max(1.1, ys[Math.floor(ys.length / 2)] - 1.5);

  // Fahrbahnplatte, Brüstungen, Stützen
  const signs: { x: number; z: number; rot: number }[] = [];
  /** Leuchtbänder an der Platte: Anfang, Ende, Höhe, Farbe. */
  const stripQueue: [V3, V3, number, RGB][] = [];
  /** Laternenköpfe über dem Mittelstreifen. */
  const lampQueue: V3[] = [];
  const glowB = new MeshBuilder();
  const SIGN_W = 13;
  const SIGN_H = 3.25;
  const SIGN_Y = DECK_Y + 8;
  if (hasRoad) {
    const b = new MeshBuilder();
    const slab = rgb(th.deckDark);
    const road = rgb(0x30334a);
    const wall = rgb(th.pillar);
    const pole = rgb(0x12142a);
    // Die längsten Stücke bekommen Leuchtreklamen.
    const lens = corners.map((c, k) => Math.hypot(corners[(k + 1) % NC][0] - c[0], corners[(k + 1) % NC][1] - c[1]));
    const signSegs = new Set(
      lens
        .map((l, k) => [l, k])
        .filter(([l]) => l > 22)
        .sort((a, b2) => b2[0] - a[0])
        .slice(0, detail === 0 ? 3 : 6)
        .map(([, k]) => k),
    );
    const pad = new THREE.CylinderGeometry(HW, HW, 1.4, 6);
    const padM = new THREE.Matrix4();
    for (let k = 0; k < NC; k++) {
      const [ax, az] = corners[k];
      const [bx, bz] = corners[(k + 1) % NC];
      const len = lens[k];
      const ux = (bx - ax) / len;
      const uz = (bz - az) / len;
      const rot = Math.atan2(-uz, ux);
      const mx = (ax + bx) / 2;
      const mz = (az + bz) / 2;
      // Innen = die Seite, auf der die Strecke näher liegt.
      const inward = tdist[cellOf(mx - uz * (HW + 6), mz + ux * (HW + 6))] < tdist[cellOf(mx + uz * (HW + 6), mz - ux * (HW + 6))] ? 1 : -1;
      if (DECK_Y < 3) {
        b.box(mx, DECK_Y / 2 - 0.1, mz, len, DECK_Y + 0.2, HW * 2, slab, rot, road);
        b.add(pad, road, padM.makeScale(1, (DECK_Y + 0.2) / 1.4, 1).setPosition(ax, DECK_Y / 2 - 0.12, az));
      } else {
        b.box(mx, DECK_Y - 0.7, mz, len, 1.4, HW * 2, slab, rot, road);
        b.add(pad, road, padM.makeTranslation(ax, DECK_Y - 0.72, az));
        const nS = Math.max(1, Math.round(len / 32));
        for (let q = 0; q < nS; q++) {
          const sx = ax + ((bx - ax) * q) / nS;
          const sz = az + ((bz - az) * q) / nS;
          b.box(sx, (DECK_Y - 1.4) / 2, sz, 1.6, DECK_Y - 1.4, 2.6, wall, rot);
        }
      }
      // Niedrige Leitwände außen, in der Mitte Laternen
      for (const sg of [-1, 1]) b.box(mx - uz * sg * (HW - 0.2), DECK_Y + 0.22, mz + ux * sg * (HW - 0.2), len, 0.44, 0.4, wall, rot);
      const nP = Math.floor(len / 55);
      for (let q = 0; q < nP; q++) {
        const f = (q + 0.5) / nP;
        const lx = ax + (bx - ax) * f;
        const lz = az + (bz - az) * f;
        b.box(lx, DECK_Y + 3.5, lz, 0.25, 7, 0.25, pole, rot);
        b.box(lx, DECK_Y + 7, lz, 0.2, 0.2, 3.2, pole, rot);
        for (const e of [-1, 1]) lampQueue.push([lx - uz * e * 1.5, DECK_Y + 6.85, lz + ux * e * 1.5]);
      }
      // Leuchtbänder an den Stirnseiten der Platte: innen Türkis, außen Magenta
      for (const sg of [-1, 1]) {
        const nx = -uz * sg;
        const nz = ux * sg;
        const off = HW + 0.03;
        const p0: V3 = [ax + nx * off, DECK_Y - 0.55, az + nz * off];
        const p1: V3 = [bx + nx * off, DECK_Y - 0.55, bz + nz * off];
        stripQueue.push([p0, p1, 0.32, sg === inward ? rgb(0x3ff2e2) : rgb(0xff5ad2)]);
      }
      // Leuchtreklame auf hohen Masten über der inneren Brüstung, zur Strecke gewandt
      if (signSegs.has(k)) {
        const sx = mx - uz * inward * (HW - 0.6);
        const sz = mz + ux * inward * (HW - 0.6);
        for (const e of [-1, 1]) b.box(sx + ux * e * 4.5, (DECK_Y + SIGN_Y) / 2, sz + uz * e * 4.5, 0.35, SIGN_Y - DECK_Y, 0.35, pole, rot);
        signs.push({ x: sx - uz * inward * 0.3, z: sz + ux * inward * 0.3, rot: Math.atan2(-uz * inward, ux * inward) + Math.PI / 2 });
      }
    }
    pad.dispose();
    const geo = b.build();
    const deck = new THREE.Mesh(geo, toon);
    group.add(deck);
    disposables.push(geo);
    // Keine Kontur: nachts sieht man Tusche auf dem dunklen Beton kaum, sie kostete
    // aber die Dreiecke der ganzen Straße ein zweites Mal.
  }

  // --- Leuchtreklame und Leuchtbänder: ein Netz mit einer Textur -------------------
  // Atlas: vier Schriftzüge untereinander, darunter ein weißes Feld für die Bänder.
  const WORDS: [string, string][] = [
    ['NUDELBAR', '#ff5ad2'],
    ['KARAOKE', '#3ff2e2'],
    ['PFANDHAUS', '#ffd23f'],
    ['OFFEN', '#ff6a3d'],
  ];
  const atlas = document.createElement('canvas');
  atlas.width = 512;
  atlas.height = 640;
  {
    const g = atlas.getContext('2d')!;
    WORDS.forEach(([word, col], k) => {
      const y = k * 128;
      g.fillStyle = '#0c0718';
      g.fillRect(0, y, 512, 128);
      g.strokeStyle = col;
      g.lineWidth = 8;
      g.strokeRect(8, y + 8, 496, 112);
      g.fillStyle = col;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.shadowColor = col;
      g.shadowBlur = 14;
      g.font = '900 78px "Arial Narrow", "Helvetica Neue", Arial, sans-serif';
      const w = g.measureText(word).width;
      if (w > 450) g.font = `900 ${Math.floor((78 * 450) / w)}px "Arial Narrow", "Helvetica Neue", Arial, sans-serif`;
      g.fillText(word, 256, y + 68);
      g.shadowBlur = 0;
    });
    g.fillStyle = '#ffffff';
    g.fillRect(0, 512, 512, 128);
  }
  const atlasTex = new THREE.CanvasTexture(atlas);
  atlasTex.colorSpace = THREE.SRGBColorSpace;
  atlasTex.anisotropy = 4;
  const white: RGB = [1, 1, 1];
  // Schilder zuerst: Schild k belegt die Ecken k*6 … k*6+5 (zum Flackern).
  signs.forEach((s, k) => {
    const row = k % WORDS.length;
    const c = Math.cos(s.rot);
    const n = Math.sin(s.rot);
    const P = (lx: number, ly: number): V3 => [s.x + lx * c, SIGN_Y + ly, s.z - lx * n];
    const v0 = 1 - (row + 1) / 5;
    const v1 = 1 - row / 5;
    glowB.quadUv(P(-SIGN_W / 2, 0), P(SIGN_W / 2, 0), P(SIGN_W / 2, SIGN_H), P(-SIGN_W / 2, SIGN_H), white, 1, v0, 0, v1);
  });
  for (const [p0, p1, h, c] of stripQueue) {
    glowB.quadUv(p0, p1, [p1[0], p1[1] + h, p1[2]], [p0[0], p0[1] + h, p0[2]], c, 0.5, 0.05, 0.5, 0.15);
  }
  for (const [x, y, z] of lampQueue) {
    // Leuchtende Unterseite des Laternenkopfs
    glowB.quadUv([x - 0.35, y, z - 0.6], [x + 0.35, y, z - 0.6], [x + 0.35, y, z + 0.6], [x - 0.35, y, z + 0.6], rgb(0xfff0b8), 0.5, 0.05, 0.5, 0.15);
    glowB.quadUv([x - 0.35, y + 0.25, z - 0.6], [x - 0.35, y, z - 0.6], [x - 0.35, y, z + 0.6], [x - 0.35, y + 0.25, z + 0.6], rgb(0xfff0b8), 0.5, 0.05, 0.5, 0.15);
    glowB.quadUv([x + 0.35, y, z - 0.6], [x + 0.35, y + 0.25, z - 0.6], [x + 0.35, y + 0.25, z + 0.6], [x + 0.35, y, z + 0.6], rgb(0xfff0b8), 0.5, 0.05, 0.5, 0.15);
  }
  const glowGeo = glowB.build();
  const glowCol = glowGeo.getAttribute('color') as THREE.BufferAttribute;
  glowCol.setUsage(THREE.DynamicDrawUsage);
  const glowMat = new THREE.MeshBasicMaterial({ map: atlasTex, vertexColors: true, side: THREE.DoubleSide });
  const glowMesh = new THREE.Mesh(glowGeo, glowMat);
  group.add(glowMesh);
  disposables.push(glowGeo, glowMat, atlasTex);

  // --- Verkehr ---------------------------------------------------------------------
  const perLane = !hasRoad ? 0 : Math.min(detail === 0 ? 18 : 34, Math.max(6, Math.floor(ring.len / (detail === 0 ? 42 : 21))));
  const nCars = perLane * 2;
  const carPos = new Float32Array(nCars);
  const carCols = [0x2a2d48, 0x5a2a3a, 0xffd23f, 0x3d5a80, 0x7a7f99, 0x1f6f6a, 0xc0c4d8, 0x8a2f4f, 0xffd23f, 0x44476a];
  let cars: THREE.InstancedMesh;
  let carLights: THREE.InstancedMesh;
  {
    const b = new MeshBuilder();
    b.box(0, 0.62, 0, 4.2, 0.75, 1.85, [1, 1, 1]);
    b.box(-0.3, 1.25, 0, 2.3, 0.55, 1.65, [0.55, 0.6, 0.75]);
    const geo = b.build();
    cars = new THREE.InstancedMesh(geo, toon, nCars);
    cars.frustumCulled = false;
    cars.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const col = new THREE.Color();
    for (let k = 0; k < nCars; k++) {
      cars.setColorAt(k, col.set(carCols[Math.floor(rnd() * carCols.length)]));
      // Ungleichmäßige Lücken – wie echter Verkehr.
      carPos[k] = ((k % perLane) + (rnd() - 0.5) * 0.7) * (ring.len / perLane);
    }
    group.add(cars);
    disposables.push(geo, cars);

    // Scheinwerfer (warmweiß) vorn, Rücklichter (rot) hinten
    const lb = new MeshBuilder();
    const head = rgb(0xfff4c8);
    const tail = rgb(0xff2a3a);
    // Bewusst übergroß: aus 20–60 m sollen sie als Lichterkette lesbar sein.
    for (const z of [-0.6, 0.6]) lb.quad([2.13, 0.45, z - 0.36], [2.13, 0.45, z + 0.36], [2.13, 0.95, z + 0.36], [2.13, 0.95, z - 0.36], head);
    lb.quad([-2.13, 0.55, 0.95], [-2.13, 0.55, -0.95], [-2.13, 0.92, -0.95], [-2.13, 0.92, 0.95], tail);
    const lgeo = lb.build();
    const lmat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: false });
    carLights = new THREE.InstancedMesh(lgeo, lmat, nCars);
    carLights.instanceMatrix = cars.instanceMatrix;
    carLights.frustumCulled = false;
    group.add(carLights);
    disposables.push(lgeo, lmat, carLights);
  }

  // --- Luftschiff mit Laufschrift -------------------------------------------------
  const zeppelin = new THREE.Group();
  const ZA = 22; // halbe Länge
  const ZR = 6.5; // Radius
  const blimpR = world.radius + 50;
  let blimpY = 60;
  for (let k = 0; k < 48; k++) {
    const a = (k / 48) * Math.PI * 2;
    blimpY = Math.max(blimpY, bel.maxIn(cx + Math.cos(a) * blimpR, cz + Math.sin(a) * blimpR, 22) + 18);
  }
  let bandTex: THREE.CanvasTexture;
  {
    const b = new MeshBuilder();
    const sphere = new THREE.SphereGeometry(1, 14, 8);
    sphere.rotateZ(Math.PI / 2);
    b.add(sphere, rgb(0xc9cfe8), new THREE.Matrix4().makeScale(ZA, ZR, ZR));
    sphere.dispose();
    const fin = rgb(0xff4d6d);
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2;
      const fy = Math.cos(a) * 4.6;
      const fz = Math.sin(a) * 4.6;
      const g = new THREE.BoxGeometry(6.5, k % 2 === 0 ? 4.2 : 0.4, k % 2 === 0 ? 0.4 : 4.2);
      b.add(g, fin, new THREE.Matrix4().makeTranslation(-ZA + 4.2, fy, fz));
      g.dispose();
    }
    b.box(1, -ZR - 0.5, 0, 6.5, 1.8, 2.6, rgb(0x3a3d56));
    const geo = addSmoothNormals(b.build());
    const body = new THREE.Mesh(geo, toon);
    zeppelin.add(body);
    if (lines) {
      const ol = new THREE.Mesh(geo, outlineMaterial(0.06));
      ol.name = 'outline';
      zeppelin.add(ol);
    }
    disposables.push(geo);

    // Laufschrift: gebogenes Band auf beiden Flanken, Text läuft über die Textur.
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 96;
    const g = c.getContext('2d')!;
    g.fillStyle = '#120a24';
    g.fillRect(0, 0, 1024, 96);
    g.fillStyle = '#ff5ad2';
    g.shadowColor = '#ff5ad2';
    g.shadowBlur = 10;
    g.font = '900 60px "Arial Narrow", "Helvetica Neue", Arial, sans-serif';
    g.textBaseline = 'middle';
    g.fillText('NACHTSCHICHT  ★  KART-GRAND-PRIX  ★', 20, 52);
    bandTex = new THREE.CanvasTexture(c);
    bandTex.colorSpace = THREE.SRGBColorSpace;
    bandTex.wrapS = THREE.RepeatWrapping;
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    const NX = 16;
    const NP = 4;
    const X0 = -13;
    const X1 = 13;
    for (const side of [1, -1]) {
      const base = pos.length / 3;
      for (let i = 0; i <= NX; i++) {
        const x = X0 + ((X1 - X0) * i) / NX;
        const r = ZR * Math.sqrt(1 - (x / ZA) ** 2) * 1.025;
        for (let j = 0; j <= NP; j++) {
          const phi = -0.34 + (0.68 * j) / NP;
          pos.push(x, Math.sin(phi) * r, side * Math.cos(phi) * r);
          const u = side > 0 ? i / NX : 1 - i / NX;
          uv.push(u * 0.7, j / NP);
        }
      }
      for (let i = 0; i < NX; i++) {
        for (let j = 0; j < NP; j++) {
          const a = base + i * (NP + 1) + j;
          const b2 = a + NP + 1;
          idx.push(a, b2, b2 + 1, a, b2 + 1, a + 1);
        }
      }
    }
    const bg = new THREE.BufferGeometry();
    bg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    bg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    bg.setIndex(idx);
    const bm = new THREE.MeshBasicMaterial({ map: bandTex, side: THREE.DoubleSide });
    const band = new THREE.Mesh(bg, bm);
    zeppelin.add(band);
    disposables.push(bg, bm, bandTex);
  }
  group.add(zeppelin);

  // --- Suchscheinwerfer auf hohen Dächern ----------------------------------------
  const beams: { x: number; y: number; z: number; ph: number }[] = [];
  {
    const want = detail === 0 ? 2 : 4;
    const step = 4;
    for (let s = 0; s < want; s++) {
      // Je Himmelsrichtung das höchste Dach im Ring hinter der Hochstraße.
      const a0 = (s / want) * Math.PI * 2 + 0.4;
      let best = -Infinity;
      let bx = 0;
      let bz = 0;
      for (let r = world.radius + 50; r < world.radius + 200; r += step) {
        for (let da = -0.5; da <= 0.5; da += 0.06) {
          const x = cx + Math.cos(a0 + da) * r;
          const z = cz + Math.sin(a0 + da) * r;
          const y = bel.maxIn(x, z, 1);
          if (y > best && y < 200) {
            best = y;
            bx = x;
            bz = z;
          }
        }
      }
      if (best > 25) beams.push({ x: bx, y: best + 0.6, z: bz, ph: rnd() * 10 });
    }
  }
  const BEAM_H = 330;
  const beamGeo = new THREE.ConeGeometry(11, BEAM_H, 12, 1, true);
  beamGeo.rotateX(Math.PI);
  beamGeo.translate(0, BEAM_H / 2, 0);
  {
    const p = beamGeo.getAttribute('position');
    const col = new Float32Array(p.count * 3);
    const base = rgb(0x8fa8ff);
    for (let i = 0; i < p.count; i++) {
      const k = 1 - p.getY(i) / BEAM_H;
      col.set(shade(base, 0.32 * k), i * 3);
    }
    beamGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  }
  const beamMat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: false,
  });
  // Additiv ist die Reihenfolge egal: ein Durchgang statt zwei für die Doppelseite.
  beamMat.forceSinglePass = true;
  const beamMesh = new THREE.InstancedMesh(beamGeo, beamMat, Math.max(1, beams.length));
  beamMesh.count = beams.length;
  beamMesh.frustumCulled = false;
  beamMesh.renderOrder = 4;
  group.add(beamMesh);
  disposables.push(beamGeo, beamMat, beamMesh);

  // --- Lichtpunkte: Luftschiff, Flugzeug, Scheinwerferfüße, Feuerwerksblitz ---------
  const iZep = 0; // Bug (rot), Heck (weiß), Gondel (gelb)
  const iPlane = 3; // links rot, rechts grün, Blitzer weiß
  const iBeam = 6;
  const iFlash = iBeam + beams.length;
  const nGlow = iFlash + 1;
  const dotGeo = new THREE.IcosahedronGeometry(0.5, 0);
  const dotMat = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false });
  const dots = new THREE.InstancedMesh(dotGeo, dotMat, nGlow);
  dots.frustumCulled = false;
  dots.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  {
    const col = new THREE.Color();
    const cols = [0xff3b4f, 0xffffff, 0xffd86a, 0xff3b4f, 0x3bff7a, 0xffffff];
    for (let k = 0; k < nGlow; k++) dots.setColorAt(k, col.set(k < 6 ? cols[k] : k < iFlash ? 0xdfe8ff : 0xfff2d0));
  }
  group.add(dots);
  disposables.push(dotGeo, dotMat, dots);

  // --- Pro Bild --------------------------------------------------------------------
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler(0, 0, 0, 'YXZ');
  const v = new THREE.Vector3();
  const s1 = new THREE.Vector3(1, 1, 1);
  const r4 = new Float32Array(4);
  const setDot = (k: number, x: number, y: number, z: number, size: number): void => {
    const z0 = Math.max(0, size);
    m4.makeScale(z0, z0, z0);
    m4.setPosition(x, y, z);
    dots.setMatrixAt(k, m4);
  };
  const dotAt = (k: number, obj: THREE.Object3D, lx: number, ly: number, lz: number, size: number): void => {
    v.set(lx, ly, lz);
    obj.localToWorld(v);
    setDot(k, v.x, v.y, v.z, size);
  };

  // Feuerwerk
  const SHOW = 9; // Sekunden je Feuerwerk
  const ROCKETS = detail === 0 ? 2 : 3;
  const RISE = 1.7;
  const BURST_N = detail === 0 ? 30 : 52;
  const fireCols = [0xff5ad2, 0x3ff2e2, 0xffd23f, 0xff6a3d, 0xb58bff, 0x7dff8a];
  const trail = { t: 0 };
  /** Startpunkt, Platzhöhe und Farben einer Rakete (fest aus Nummer der Vorstellung und der Rakete). */
  const rocket = (show: number, r: number, out: Float32Array): void => {
    const a = hash(show, r) * Math.PI * 2;
    const d = world.radius + 90 + hash(r + 3, show) * 130;
    const x = cx + Math.cos(a) * d;
    const z = cz + Math.sin(a) * d;
    out[0] = x;
    out[1] = z;
    out[2] = Math.max(0, bel.maxIn(x, z, 1));
    out[3] = 135 + hash(show + 7, r) * 50;
  };
  const rk = new Float32Array(4);
  let flashT = -10;
  let flashX = 0;
  let flashY = 0;
  let flashZ = 0;

  // Flugzeug: quert alle 70 s den Himmel auf neuem Kurs.
  const PLANE = 70;

  const nSigns = signs.length;
  const baseCol = Float32Array.from(glowCol.array as Float32Array);

  return {
    group,
    update(time: number, dt: number, _cam: THREE.Vector3, fx: FxSink): void {
      // Verkehr: Spur A im Kreis vorwärts, Spur B rückwärts.
      for (let k = 0; k < nCars; k++) {
        const laneB = k >= perLane;
        const s = laneB ? carPos[k] - time * 12.5 : carPos[k] + time * 15;
        ring.at(s, laneB ? -LANE : LANE, r4);
        const dx = laneB ? -r4[2] : r4[2];
        const dz = laneB ? -r4[3] : r4[3];
        q.setFromAxisAngle(UP, Math.atan2(-dz, dx));
        m4.compose(v.set(r4[0], DECK_Y, r4[1]), q, s1);
        cars.setMatrixAt(k, m4);
      }
      cars.instanceMatrix.needsUpdate = true;

      // Leuchtreklame: meist an, ab und zu ein Flackern; „OFFEN“ blinkt.
      for (let k = 0; k < nSigns; k++) {
        let on = 1;
        if (k % WORDS.length === 3) on = Math.sin(time * 3.4 + k) > -0.3 ? 1 : 0.15;
        else if (Math.sin(time * 0.31 + k * 2.3) > 0.86) on = Math.sin(time * 47 + k * 7) + Math.sin(time * 29) > 0 ? 1 : 0.12;
        for (let i = k * 6; i < k * 6 + 6; i++) glowCol.setXYZ(i, baseCol[i * 3] * on, baseCol[i * 3 + 1] * on, baseCol[i * 3 + 2] * on);
      }
      if (nSigns > 0) glowCol.needsUpdate = true;

      // Luftschiff: große, langsame Runde, leicht schaukelnd.
      const za = time * (5 / blimpR) + 1.3;
      zeppelin.position.set(cx + Math.cos(za) * blimpR, blimpY + Math.sin(time * 0.4) * 1.5, cz + Math.sin(za) * blimpR);
      // Flugrichtung = Tangente (-sin, cos); lokale +x zeigt nach vorn.
      zeppelin.rotation.set(Math.sin(time * 0.33) * 0.03, Math.atan2(-Math.cos(za), -Math.sin(za)), Math.sin(time * 0.4) * 0.02);
      zeppelin.updateMatrixWorld();
      bandTex.offset.x = time * 0.045;
      dotAt(iZep, zeppelin, ZA + 0.3, 0, 0, Math.sin(time * 2.5) > 0.4 ? 1.8 : 0);
      dotAt(iZep + 1, zeppelin, -ZA - 0.2, 0.5, 0, 1.2);
      dotAt(iZep + 2, zeppelin, 3.4, -ZR - 0.5, 0, 1.1);

      // Flugzeug hoch oben: nur Positionslichter und Blitzer.
      {
        const n = Math.floor(time / PLANE);
        const f = time / PLANE - n;
        const a = hash(n, 11) * Math.PI * 2;
        const off = (hash(n, 12) - 0.5) * world.radius;
        const D = world.radius + 900;
        const dx = Math.cos(a);
        const dz = Math.sin(a);
        const px = cx - dx * D + -dz * off + dx * 2 * D * f;
        const pz = cz - dz * D + dx * off + dz * 2 * D * f;
        const py = 230 + hash(n, 13) * 60;
        setDot(iPlane, px + dz * 9, py, pz - dx * 9, 3);
        setDot(iPlane + 1, px - dz * 9, py, pz + dx * 9, 3);
        setDot(iPlane + 2, px, py + 1, pz, (time * 1.1) % 1 < 0.08 ? 5 : 0);
      }

      // Suchscheinwerfer: schwenken in langsamen Achten über den Himmel.
      for (let k = 0; k < beams.length; k++) {
        const b = beams[k];
        e.set(0.32 + Math.sin(time * 0.23 + b.ph) * 0.22, time * 0.17 + b.ph + Math.sin(time * 0.11 + b.ph) * 1.2, 0, 'YXZ');
        q.setFromEuler(e);
        m4.compose(v.set(b.x, b.y, b.z), q, s1);
        beamMesh.setMatrixAt(k, m4);
        setDot(iBeam + k, b.x, b.y, b.z, 2.2);
      }
      if (beams.length > 0) beamMesh.instanceMatrix.needsUpdate = true;

      // Feuerwerk: Raketen steigen mit Funkenschweif auf und zerplatzen in Farbkugeln.
      if (dt > 0) {
        const show = Math.floor(time / SHOW);
        const p = time - show * SHOW;
        const prev = p - dt;
        trail.t += dt;
        const doTrail = trail.t > 0.06;
        if (doTrail) trail.t = 0;
        for (let r = 0; r < ROCKETS; r++) {
          const t0 = r * 0.75 + hash(show, r + 20) * 0.4;
          if (p < t0 || prev > t0 + RISE) continue;
          rocket(show, r, rk);
          const yb = rk[3];
          if (p < t0 + RISE) {
            if (doTrail) {
              const k = (p - t0) / RISE;
              const y = rk[2] + (yb - rk[2]) * (1 - (1 - k) * (1 - k));
              fx.spark(rk[0], y, rk[1], 0, -4, 0, 0.6, 2.4, 0xffc27a, 0);
            }
          } else if (prev < t0 + RISE) {
            // Knall: Kugel aus Funken (Fibonacci-Kugel), dazu ein kurzer Blitz.
            const c1 = fireCols[Math.floor(hash(show, r + 40) * fireCols.length)];
            const c2 = fireCols[Math.floor(hash(show + 1, r + 41) * fireCols.length)];
            const sp = 30 + hash(show, r + 50) * 10;
            for (let i = 0; i < BURST_N; i++) {
              const yy = 1 - (2 * (i + 0.5)) / BURST_N;
              const rr = Math.sqrt(1 - yy * yy);
              const a = i * 2.39996;
              const vs = i % 3 === 0 ? sp * 0.55 : sp;
              fx.spark(rk[0], yb, rk[1], Math.cos(a) * rr * vs, yy * vs + 3, Math.sin(a) * rr * vs, 1.7, i % 3 === 0 ? 6 : 9, i % 3 === 0 ? c2 : c1, 4);
            }
            flashT = time;
            flashX = rk[0];
            flashY = yb;
            flashZ = rk[1];
          }
        }
      }
      const fl = time - flashT;
      setDot(iFlash, flashX, flashY, flashZ, fl >= 0 && fl < 0.25 ? 26 * (1 - fl / 0.25) : 0);
      dots.instanceMatrix.needsUpdate = true;
    },
    dispose(): void {
      for (const d of disposables) d.dispose();
    },
  };
}
