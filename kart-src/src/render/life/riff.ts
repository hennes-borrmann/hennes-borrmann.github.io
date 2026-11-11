// Tiefseeriff lebt: am Meeresboden ein Riff aus Geweih-, Tisch-, Hirn-, Fächer-
// und Röhrenkorallen, Schwämmen, Anemonen, Felsbögen und -nadeln, Muscheln und
// Seesternen; im Seegraswald wiegen sich hohe Kelp-Stränge, am Graben stehen
// dunkle Felswände mit Leuchtalgen, und um die Abzweigung durch das Wrack liegt
// ein gesunkener Dampfer – schräg, bewachsen, mit Masten, Schornstein, Anker und
// verstreuter Ladung. Im Wasser ziehen Fischschwärme in Bögen, Rochen und eine
// Schildkröte gleiten vorbei, am Rand der Sicht ein Wal; Quallen steigen
// pulsierend auf, Krebse laufen über die Felsen, aus Spalten perlen Blasen.
// Von der Oberfläche fallen schräge Lichtbahnen, in Kameranähe treiben
// Schwebteilchen. Über Wasser: Lagune mit Palmeninseln, Leuchtfeuer, Bojen,
// Boote und Möwen, am Steg Fässer, Netze und Lampen.
//
// Reine Kulisse: alles wird mit festem Zufall aus der Strecke abgeleitet und
// hält Abstand – nichts auf Fahrbahn und Seitenstreifen, mindestens RAND Meter
// neben der Kante (auch an den Abzweigungen), nichts in den Blasensäulen und
// um die Schubringe; Fische, die über die Fahrbahn ziehen, bleiben mindestens
// LUFT Meter über ihr. Im Lauf wird nichts neu angelegt.
//
// Zeichenaufrufe (hoch): Riff + Kontur, Leuchtendes, Kelp, Fische + Kontur,
// Tiere + Kontur, Blasen, Lichtbahnen = 10. Niedrig: ohne Konturen = 7.

import * as THREE from 'three';
import { PULSE_BUBBLE } from '../../game/mechanics';
import { EDGE_DECK, EDGE_GAP, EDGE_TUNNEL, rightX, rightZ } from '../../game/track';
import { MeshBuilder, mixRgb, seeded, shade, smooth, type RGB, type V3 } from '../build';
import type { FxSink } from '../fxApi';
import type { Life } from '../life';
import { addSmoothNormals, outlineMaterial, rgb, toonMaterial } from '../toon';
import type { World } from '../world';

/** Mindestabstand aller Kulisse zur Fahrbahnkante (Meter). */
const RAND = 2.5;
/** So hoch bleibt der Raum über der Fahrbahn frei (Meter). */
const LUFT = 9;
/** Um Tunnel liegt Fels (world.ts): dort beginnt der freie Platz erst weiter draußen. */
const TUNNEL_PLUS = 8.5;
const TAU = Math.PI * 2;

// --- Farben ------------------------------------------------------------------------

const C_WEISS: RGB = [1, 1, 1];
const C_DUNKEL = rgb(0x14182a);
const C_SAND = rgb(0xf1e2b4);
const C_SAND_D = rgb(0xd9c48a);
const C_HOLZ = rgb(0x9a6a40);
const C_HOLZ_D = rgb(0x6e4a2c);
const C_ROST = rgb(0x9a4f2a);
const C_GRABEN = rgb(0x231d3a);
const C_GRABEN_D = rgb(0x16132a);
const C_ALGE = rgb(0x4f9a5f);
const KORALLEN = [0xff5f7e, 0xff8a3d, 0xffc93c, 0xa45ee5, 0xe8483f, 0x2ec4b6, 0xff9ecf, 0x6c63ff, 0xf15bb5].map(rgb);
const FELSEN = [0x6c5a86, 0x5b4b78, 0x7f6f99, 0x564a70].map(rgb);
const SCHWAEMME = [0xf9a03f, 0xa45ee5, 0xffd23f, 0xe8483f, 0x2ec4b6].map(rgb);
const STERNE = [0xff7a1f, 0xe8483f, 0x3a86ff, 0xa45ee5, 0xffc93c].map(rgb);
const LEUCHT = [0x5effd6, 0x7ef0ff, 0xb6ff6a].map(rgb);

// --- Bausteine -----------------------------------------------------------------------

const UP = new THREE.Vector3(0, 1, 0);
const mP = new THREE.Matrix4();
const mL = new THREE.Matrix4();
const mT = new THREE.Matrix4();
const qT = new THREE.Quaternion();
const eT = new THREE.Euler(0, 0, 0, 'YXZ');
const vT = new THREE.Vector3();
const sT = new THREE.Vector3();
const vA = new THREE.Vector3();

/** Rahmen für zusammengesetzte Stücke: Ort, Drehung (Gieren, Nicken, Rollen), Größe. */
function rahmen(x: number, y: number, z: number, yaw: number, s: number, rx = 0, rz = 0): void {
  eT.set(rx, yaw, rz, 'YXZ');
  qT.setFromEuler(eT);
  mP.compose(vT.set(x, y, z), qT, sT.set(s, s, s));
}
/** Punkt im Rahmen. */
function pt(x: number, y: number, z: number): V3 {
  vA.set(x, y, z).applyMatrix4(mP);
  return [vA.x, vA.y, vA.z];
}
/** Grundform im Rahmen: lokal verschoben, gedreht (YXZ) und gestreckt. */
function teil(b: MeshBuilder, geo: THREE.BufferGeometry, c: RGB, x: number, y: number, z: number, rx: number, ry: number, rz: number, sx: number, sy: number, sz: number): void {
  eT.set(rx, ry, rz, 'YXZ');
  qT.setFromEuler(eT);
  mL.compose(vT.set(x, y, z), qT, sT.set(sx, sy, sz));
  mT.multiplyMatrices(mP, mL);
  b.add(geo, c, mT);
}
/** Wie teil, aber die Dreiecke abwechselnd in zwei Farben (Muster für Hirnkorallen, Panzer). */
function teilBunt(b: MeshBuilder, geo: THREE.BufferGeometry, cA: RGB, cB: RGB, x: number, y: number, z: number, sx: number, sy: number, sz: number, ry = 0): void {
  eT.set(0, ry, 0, 'YXZ');
  qT.setFromEuler(eT);
  mL.compose(vT.set(x, y, z), qT, sT.set(sx, sy, sz));
  mT.multiplyMatrices(mP, mL);
  const p = geo.getAttribute('position');
  for (let i = 0; i + 2 < p.count; i += 3) {
    const v: V3[] = [];
    for (let q = 0; q < 3; q++) {
      vA.fromBufferAttribute(p, i + q).applyMatrix4(mT);
      v.push([vA.x, vA.y, vA.z]);
    }
    b.tri(v[0], v[1], v[2], (i / 3) % 3 === 0 ? cB : cA);
  }
}
/** Stab im Rahmen von a nach e (lokal); geo ist eine Grundform der Höhe 1 entlang y. */
function stab(b: MeshBuilder, geo: THREE.BufferGeometry, c: RGB, a: V3, e: V3, r: number): void {
  const dx = e[0] - a[0];
  const dy = e[1] - a[1];
  const dz = e[2] - a[2];
  const len = Math.hypot(dx, dy, dz);
  if (len < 1e-4) return;
  qT.setFromUnitVectors(UP, vA.set(dx / len, dy / len, dz / len));
  mL.compose(vT.set((a[0] + e[0]) / 2, (a[1] + e[1]) / 2, (a[2] + e[2]) / 2), qT, sT.set(r, len, r));
  mT.multiplyMatrices(mP, mL);
  b.add(geo, c, mT);
}
/** Prisma mit n Ecken im Rahmen: unten Radius r0 auf y0, oben r1 auf y1; Deckel nach Wunsch. */
function prisma(b: MeshBuilder, n: number, r0: number, r1: number, y0: number, y1: number, cs: RGB, ctop: RGB | null, cbot: RGB | null, rot = 0): void {
  const lo: V3[] = [];
  const hi: V3[] = [];
  for (let k = 0; k < n; k++) {
    const a = rot + (k / n) * TAU;
    lo.push(pt(Math.cos(a) * r0, y0, Math.sin(a) * r0));
    hi.push(pt(Math.cos(a) * r1, y1, Math.sin(a) * r1));
  }
  for (let k = 0; k < n; k++) {
    const j = (k + 1) % n;
    b.quad(lo[j], lo[k], hi[k], hi[j], k % 2 ? cs : shade(cs, 0.88));
  }
  for (let k = 1; k < n - 1; k++) {
    if (ctop) b.tri(hi[0], hi[k + 1], hi[k], ctop);
    if (cbot) b.tri(lo[0], lo[k], lo[k + 1], cbot);
  }
}
/** Viereck, dessen sichtbare Seite in Richtung n zeigt. */
function quadN(b: MeshBuilder, a: V3, c1: V3, c2: V3, d: V3, n: V3, color: RGB): void {
  const ux = c1[0] - a[0];
  const uy = c1[1] - a[1];
  const uz = c1[2] - a[2];
  const vx = c2[0] - a[0];
  const vy = c2[1] - a[1];
  const vz = c2[2] - a[2];
  const cx = uy * vz - uz * vy;
  const cy = uz * vx - ux * vz;
  const cz = ux * vy - uy * vx;
  if (cx * n[0] + cy * n[1] + cz * n[2] >= 0) b.quad(a, c1, c2, d, color);
  else b.quad(d, c2, c1, a, color);
}
function triN(b: MeshBuilder, a: V3, c1: V3, c2: V3, n: V3, color: RGB): void {
  const cx = (c1[1] - a[1]) * (c2[2] - a[2]) - (c1[2] - a[2]) * (c2[1] - a[1]);
  const cy = (c1[2] - a[2]) * (c2[0] - a[0]) - (c1[0] - a[0]) * (c2[2] - a[2]);
  const cz = (c1[0] - a[0]) * (c2[1] - a[1]) - (c1[1] - a[1]) * (c2[0] - a[0]);
  if (cx * n[0] + cy * n[1] + cz * n[2] >= 0) b.tri(a, c1, c2, color);
  else b.tri(a, c2, c1, color);
}

/** Zwei fertige Geometrien (Position, Farbe, Normale) zu einer. */
function verbinde(a: THREE.BufferGeometry, b: THREE.BufferGeometry): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  for (const name of ['position', 'color', 'normal']) {
    const x = a.getAttribute(name).array as Float32Array;
    const y = b.getAttribute(name).array as Float32Array;
    const out = new Float32Array(x.length + y.length);
    out.set(x, 0);
    out.set(y, x.length);
    g.setAttribute(name, new THREE.BufferAttribute(out, 3));
  }
  g.computeBoundingSphere();
  return g;
}

// --- Tiere (ein Netz, Ecken je Bild umgerechnet) ---------------------------------------

const K_ROCHEN = 0;
const K_KROETE = 1;
const K_WAL = 2;
const K_QUALLE = 3;
const K_KREBS = 4;
const K_MOEWE = 5;
const K_STARR = 6;

interface Vorlage {
  pos: Float32Array;
  nor: Float32Array;
  onor: Float32Array;
  col: Float32Array;
  /** Biegegewicht je Ecke (Bedeutung je Art). */
  flex: Float32Array;
  /** Die ersten nSolid Ecken bekommen eine Kontur, der Rest (flache Teile) nicht. */
  nSolid: number;
}

/** Vorlage aus festem Körper (mit Kontur) und flachen Teilen (ohne). */
function vorlage(solid: MeshBuilder, flat: MeshBuilder, flex: (x: number, y: number, z: number, flat: boolean) => number): Vorlage {
  const gs = addSmoothNormals(solid.build());
  const gf = flat.empty ? null : flat.build();
  const ns = gs.getAttribute('position').count;
  const nf = gf ? gf.getAttribute('position').count : 0;
  const n = ns + nf;
  const v: Vorlage = { pos: new Float32Array(n * 3), nor: new Float32Array(n * 3), onor: new Float32Array(n * 3), col: new Float32Array(n * 3), flex: new Float32Array(n), nSolid: ns };
  v.pos.set(gs.getAttribute('position').array as Float32Array, 0);
  v.nor.set(gs.getAttribute('normal').array as Float32Array, 0);
  v.onor.set(gs.getAttribute('onormal').array as Float32Array, 0);
  v.col.set(gs.getAttribute('color').array as Float32Array, 0);
  if (gf) {
    v.pos.set(gf.getAttribute('position').array as Float32Array, ns * 3);
    v.nor.set(gf.getAttribute('normal').array as Float32Array, ns * 3);
    v.col.set(gf.getAttribute('color').array as Float32Array, ns * 3);
    gf.dispose();
  }
  gs.dispose();
  for (let i = 0; i < n; i++) v.flex[i] = flex(v.pos[i * 3], v.pos[i * 3 + 1], v.pos[i * 3 + 2], i >= ns);
  return v;
}

// --- Schwärme ------------------------------------------------------------------------

interface Art {
  farben: number[];
  len: number;
  form: [number, number, number];
  n0: number;
  n1: number;
  spread: number;
  speed: number;
}
const ARTEN: Art[] = [
  // Sardinen: viele kleine, silbrig
  { farben: [0xcfe3f5, 0xa9c9ea, 0xe3eef8], len: 0.5, form: [0.75, 0.8, 1], n0: 18, n1: 26, spread: 3.2, speed: 4.2 },
  // Doktorfische: hochrückig, blau
  { farben: [0x2f6fe0, 0x3d86ff], len: 0.9, form: [0.75, 1.6, 1], n0: 6, n1: 9, spread: 2.4, speed: 2.6 },
  // Falterfische: rund und gelb
  { farben: [0xffd23f, 0xffe066, 0xffb81f], len: 0.6, form: [0.7, 1.9, 0.9], n0: 5, n1: 8, spread: 2, speed: 2 },
  // Kleine Orange
  { farben: [0xff7a1f, 0xff9a3f], len: 0.45, form: [1, 1.25, 1], n0: 5, n1: 7, spread: 1.4, speed: 1.6 },
  // Papageifische: groß, türkis
  { farben: [0x22c6a0, 0x3fd0c9, 0x7be0b0], len: 1.4, form: [1, 1.2, 1], n0: 3, n1: 5, spread: 2.6, speed: 2.2 },
  // Schnapper: rot
  { farben: [0xe8483f, 0xff6f61], len: 1.0, form: [0.9, 1.05, 1], n0: 5, n1: 7, spread: 2.5, speed: 3 },
];

interface Schwarm {
  cx: number;
  cy: number;
  cz: number;
  /** Achsen der Bahn (Einheitsvektoren) und Halbachsen. */
  ax: number;
  az: number;
  rx: number;
  ry: number;
  w: number;
  ph: number;
  first: number;
  count: number;
  len: number;
  form: [number, number, number];
}

// --- Kulisse ------------------------------------------------------------------------

export function buildRiffLife(world: World): Life {
  const t = world.track;
  const group = new THREE.Group();
  const disposables: { dispose(): void }[] = [];
  const detail = world.detail;
  const lines = detail > 0;
  const rnd = seeded(5150 + t.index * 53);
  const sea = t.sea;
  const T = t.total;
  const pick = <X>(a: X[]): X => a[Math.floor(rnd() * a.length) % a.length];
  const meterOf = (k: number): number => t.prog[k] * t.step;

  // Grundformen (am Ende wieder freigegeben)
  const G = {
    ico0: new THREE.IcosahedronGeometry(1, 0),
    ico1: new THREE.IcosahedronGeometry(1, 1),
    dode: new THREE.DodecahedronGeometry(1, 0),
    ast: new THREE.CylinderGeometry(0.55, 1, 1, 3, 1, true),
    rohr: new THREE.CylinderGeometry(1, 1.12, 1, 5, 1, true),
    scheibe: new THREE.CircleGeometry(1, 5),
    kegel3: new THREE.ConeGeometry(1, 1, 3, 1, true),
    kegel5: new THREE.ConeGeometry(1, 1, 5, 1, true),
    zyl6: new THREE.CylinderGeometry(1, 1, 1, 6),
    zyl8: new THREE.CylinderGeometry(1, 1, 1, 8),
    box: new THREE.BoxGeometry(1, 1, 1),
    okt: new THREE.OctahedronGeometry(1, 0),
    halb: new THREE.SphereGeometry(1, 6, 2, 0, TAU, 0, Math.PI / 2),
  };

  // --- Platz -------------------------------------------------------------------------
  let nah = 0;
  /** Abstand zur nächsten Fahrbahnkante über alle Wege (Tunnel mit Felsmantel); merkt den Abschnitt in nah. */
  const kante = (x: number, z: number): number => {
    let best = Infinity;
    let bk = 0;
    for (let k = 0; k < T; k += 2) {
      const d = Math.hypot(x - t.px[k], z - t.pz[k]) - t.wh[k] - (t.edge[k] & EDGE_TUNNEL ? TUNNEL_PLUS : 0);
      if (d < best) {
        best = d;
        bk = k;
      }
    }
    nah = bk;
    return best - 0.3;
  };
  // Blasenschlote und Schubringe: auch daneben bleibt Luft.
  const sperr: number[] = [];
  for (const p of t.pulses) if (p.kind === PULSE_BUBBLE) sperr.push(p.x, p.z, p.radius + 3);
  for (const r of t.rings) sperr.push(r.x, r.z, r.radius + 3);
  const gesperrt = (x: number, z: number, r: number): boolean => {
    for (let q = 0; q < sperr.length; q += 3) if (Math.hypot(x - sperr[q], z - sperr[q + 1]) < sperr[q + 2] + r) return true;
    return false;
  };
  // Belegung: was schon steht (x, z, r) in einem Raster.
  const ZELLE = 8;
  const raster = new Map<number, number[]>();
  const rk = (ix: number, iz: number): number => (ix + 4096) * 8192 + (iz + 4096);
  const belege = (x: number, z: number, r: number): void => {
    const key = rk(Math.floor(x / ZELLE), Math.floor(z / ZELLE));
    let a = raster.get(key);
    if (!a) raster.set(key, (a = []));
    a.push(x, z, r);
  };
  const belegt = (x: number, z: number, r: number, f = 0.85): boolean => {
    const reach = r + 18;
    const ix0 = Math.floor((x - reach) / ZELLE);
    const ix1 = Math.floor((x + reach) / ZELLE);
    const iz0 = Math.floor((z - reach) / ZELLE);
    const iz1 = Math.floor((z + reach) / ZELLE);
    for (let ix = ix0; ix <= ix1; ix++) {
      for (let iz = iz0; iz <= iz1; iz++) {
        const a = raster.get(rk(ix, iz));
        if (!a) continue;
        for (let q = 0; q < a.length; q += 3) if (Math.hypot(x - a[q], z - a[q + 1]) < (r + a[q + 2]) * f) return true;
      }
    }
    return false;
  };
  /** Frei für ein Stück mit Radius r? */
  const frei = (x: number, z: number, r: number): boolean => kante(x, z) >= RAND + r && !gesperrt(x, z, r);

  // --- Netze ---------------------------------------------------------------------------
  const bo = new MeshBuilder(); // mit Kontur
  const bn = new MeshBuilder(); // ohne Kontur (flache und kleine Teile)
  const bg = new MeshBuilder(); // leuchtend
  const kelp: number[] = []; // x, y, z, Höhe, Breite, Drehung
  const krebsPlatz: number[] = []; // x, y, z
  const blasenPlatz: number[] = []; // x, y, z

  // === Korallen und Co. =================================================================

  const geweih = (b: MeshBuilder, x: number, y: number, z: number, s: number, c: RGB): void => {
    rahmen(x, y, z, rnd() * TAU, s);
    const tip = mixRgb(c, C_WEISS, 0.4);
    const n = 3 + Math.floor(rnd() * 2);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + rnd() * 0.7;
      const tilt = 0.25 + rnd() * 0.5;
      const len = 0.8 + rnd() * 0.7;
      const e: V3 = [Math.sin(tilt) * Math.cos(a) * len, Math.cos(tilt) * len, Math.sin(tilt) * Math.sin(a) * len];
      stab(b, G.ast, c, [0, -0.1, 0], e, 0.14);
      const f = 0.5 + rnd() * 0.25;
      const st: V3 = [e[0] * f, e[1] * f, e[2] * f];
      const a2 = a + (i % 2 ? 0.9 : -0.9);
      const t2 = tilt * 0.5 + 0.2;
      const l2 = len * 0.6;
      stab(b, G.ast, tip, st, [st[0] + Math.sin(t2) * Math.cos(a2) * l2, st[1] + Math.cos(t2) * l2, st[2] + Math.sin(t2) * Math.sin(a2) * l2], 0.1);
    }
  };
  const tisch = (b: MeshBuilder, x: number, y: number, z: number, s: number, c: RGB): void => {
    rahmen(x, y, z, rnd() * TAU, s, (rnd() - 0.5) * 0.15, (rnd() - 0.5) * 0.15);
    stab(b, G.ast, shade(c, 0.8), [0, -0.1, 0], [0, 0.75, 0], 0.22);
    const R = 1.3 + rnd() * 0.5;
    prisma(b, 7, R * 0.8, R, 0.72, 0.95, shade(c, 0.85), mixRgb(c, C_WEISS, 0.25), shade(c, 0.6), rnd());
    if (rnd() < 0.5) prisma(b, 6, R * 0.45, R * 0.55, 0.95, 1.15, c, mixRgb(c, C_WEISS, 0.4), null, rnd());
  };
  const hirn = (b: MeshBuilder, x: number, y: number, z: number, s: number, c: RGB): void => {
    rahmen(x, y, z, rnd() * TAU, s);
    teilBunt(b, G.dode, c, mixRgb(c, C_DUNKEL, 0.3), 0, 0.15, 0, 1, 0.62, 0.95, rnd());
  };
  const faecher = (b: MeshBuilder, x: number, y: number, z: number, s: number, c: RGB): void => {
    rahmen(x, y, z, rnd() * TAU, s, (rnd() - 0.5) * 0.3);
    const inner = mixRgb(c, C_DUNKEL, 0.25);
    const base = pt(0, 0.25, 0);
    const N = 6;
    const ring: V3[] = [];
    const mid: V3[] = [];
    for (let k = 0; k <= N; k++) {
      const a = 0.3 + (k / N) * (Math.PI - 0.6);
      const r = 1.3 * (0.85 + rnd() * 0.3);
      ring.push(pt(Math.cos(a) * r, 0.25 + Math.sin(a) * r * 1.1, 0));
      mid.push(pt(Math.cos(a) * r * 0.55, 0.25 + Math.sin(a) * r * 0.6, 0));
    }
    for (let k = 0; k < N; k++) {
      b.tri(base, mid[k], mid[k + 1], inner);
      b.quad(mid[k], ring[k], ring[k + 1], mid[k + 1], k % 2 ? c : mixRgb(c, C_WEISS, 0.15));
    }
    stab(bn, G.ast, shade(c, 0.6), [0, -0.1, 0], [0, 0.3, 0], 0.12);
  };
  const roehre = (x: number, y: number, z: number, s: number, c: RGB): void => {
    rahmen(x, y, z, rnd() * TAU, s);
    const n = 3 + Math.floor(rnd() * 3);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + rnd();
      const d = i === 0 ? 0 : 0.35 + rnd() * 0.25;
      const h = (i === 0 ? 1.8 : 0.8 + rnd() * 1.0) * (0.9 + rnd() * 0.2);
      const r = 0.2 + rnd() * 0.1;
      const cc = i % 2 ? c : mixRgb(c, C_WEISS, 0.2);
      teil(bn, G.rohr, cc, Math.cos(a) * d, h / 2 - 0.1, Math.sin(a) * d, 0, 0, 0, r, h, r);
      teil(bn, G.scheibe, C_DUNKEL, Math.cos(a) * d, h - 0.18, Math.sin(a) * d, -Math.PI / 2, 0, 0, r * 0.98, r * 0.98, 1);
    }
  };
  const schwamm = (x: number, y: number, z: number, s: number, c: RGB): void => {
    rahmen(x, y, z, rnd() * TAU, s);
    const n = rnd() < 0.5 ? 1 : 2;
    for (let i = 0; i < n; i++) {
      const ox = i * 0.8;
      const h = i ? 1.1 : 1.6;
      rahmen(x + ox * s, y, z + ox * 0.3 * s, rnd() * TAU, s * (i ? 0.75 : 1));
      prisma(bn, 7, 0.45, 0.7, -0.1, h, c, null, null, rnd());
      prisma(bn, 7, 0.55, 0.6, h - 0.25, h - 0.24, C_DUNKEL, C_DUNKEL, null);
    }
  };
  const anemone = (x: number, y: number, z: number, s: number, c: RGB, arme: RGB): void => {
    rahmen(x, y, z, rnd() * TAU, s);
    prisma(bn, 5, 0.38, 0.32, -0.05, 0.4, c, mixRgb(c, C_DUNKEL, 0.3), null);
    const n = 7;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      const tilt = 0.35 + (i % 2) * 0.25;
      teil(bn, G.kegel3, arme, Math.cos(a) * 0.24 + Math.cos(a) * Math.sin(tilt) * 0.3, 0.4 + Math.cos(tilt) * 0.3, Math.sin(a) * 0.24 + Math.sin(a) * Math.sin(tilt) * 0.3, tilt, Math.PI / 2 - a, 0, 0.07, 0.6, 0.07);
    }
  };
  const fels = (x: number, y: number, z: number, s: number, c: RGB, krebs: boolean): void => {
    rahmen(x, y, z, rnd() * TAU, s);
    const n = 1 + Math.floor(rnd() * 3);
    let top = 0;
    for (let i = 0; i < n; i++) {
      const a = rnd() * TAU;
      const d = i ? 0.8 + rnd() * 0.4 : 0;
      const sx = (i ? 0.6 : 1) * (0.9 + rnd() * 0.4);
      const sy = (i ? 0.5 : 0.8) * (0.8 + rnd() * 0.5);
      teil(s > 1.7 || i === 0 ? bo : bn, G.ico0, i % 2 ? shade(c, 0.85) : c, Math.cos(a) * d, sy * 0.45, Math.sin(a) * d, rnd() * 0.4, rnd() * TAU, rnd() * 0.4, sx, sy, sx * (0.8 + rnd() * 0.3));
      if (i === 0) top = sy * 1.3;
    }
    // Algenpolster obendrauf
    if (rnd() < 0.5) teil(bn, G.halb, C_ALGE, 0, top - 0.25, 0, 0, rnd(), 0, 0.5, 0.25, 0.45);
    if (krebs) krebsPlatz.push(x, y + top * s, z);
  };
  const muschel = (x: number, y: number, z: number, s: number): void => {
    rahmen(x, y, z, rnd() * TAU, s);
    const sh = rgb(0xd9d2c3);
    teil(bn, G.halb, sh, 0, 0.12, 0, Math.PI, 0, 0, 0.7, 0.32, 0.45);
    teil(bn, G.halb, shade(sh, 0.9), 0, 0.14, -0.08, -0.55, 0, 0, 0.7, 0.32, 0.45);
    teil(bn, G.scheibe, pick([rgb(0x3a86ff), rgb(0xa45ee5), rgb(0x2ec4b6)]), 0, 0.16, 0.02, -Math.PI / 2 - 0.25, 0, 0, 0.6, 0.38, 1);
  };
  const seestern = (x: number, y: number, z: number, s: number): void => {
    rahmen(x, y + 0.03, z, rnd() * TAU, s);
    const c = pick(STERNE);
    const mitte = pt(0, 0.14, 0);
    const p: V3[] = [];
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * TAU;
      const r = k % 2 ? 0.2 : 0.5;
      p.push(pt(Math.cos(a) * r, k % 2 ? 0.06 : 0.02, Math.sin(a) * r));
    }
    for (let k = 0; k < 10; k++) bn.tri(mitte, p[(k + 1) % 10], p[k], k % 2 ? c : mixRgb(c, C_WEISS, 0.25));
  };
  const kiste = (x: number, y: number, z: number, s: number): void => {
    rahmen(x, y, z, rnd() * TAU, s, (rnd() - 0.5) * 0.3, (rnd() - 0.5) * 0.3);
    if (rnd() < 0.5) {
      teil(bo, G.box, C_HOLZ, 0, 0.45, 0, 0, 0, 0, 1.1, 1.0, 1.1);
      teil(bn, G.box, C_HOLZ_D, 0, 0.45, 0, 0, 0, 0, 1.14, 0.18, 1.14);
    } else {
      teil(bo, G.zyl8, pick([rgb(0x3a6fb0), C_ROST, rgb(0x5d7a3a)]), 0, 0.3, 0, Math.PI / 2, 0, 0, 0.45, 1.2, 0.45);
    }
  };
  const leuchtalge = (x: number, y: number, z: number, s: number): void => {
    rahmen(x, y, z, rnd() * TAU, s);
    const c = pick(LEUCHT);
    for (let i = 0; i < 3; i++) teil(bg, G.okt, i ? c : mixRgb(c, C_WEISS, 0.5), (rnd() - 0.5) * 0.9, rnd() * 0.6, (rnd() - 0.5) * 0.9, rnd(), rnd() * 3, 0, 0.2, 0.5, 0.2);
  };

  // Arten: Höhe und Radius je Größe 1, Größenbereich
  const ART = [
    { h: 1.9, r: 1.4, s0: 1.6, s1: 3.0 }, // 0 Geweih
    { h: 1.2, r: 1.8, s0: 1.4, s1: 2.6 }, // 1 Tisch
    { h: 0.8, r: 1.1, s0: 1.3, s1: 2.6 }, // 2 Hirn
    { h: 1.8, r: 1.3, s0: 1.5, s1: 2.8 }, // 3 Fächer
    { h: 2.0, r: 0.9, s0: 1.3, s1: 2.3 }, // 4 Röhren
    { h: 1.7, r: 1.1, s0: 1.3, s1: 2.3 }, // 5 Schwamm
    { h: 0.9, r: 0.7, s0: 1.0, s1: 1.6 }, // 6 Anemone
    { h: 1.3, r: 1.7, s0: 1.0, s1: 2.6 }, // 7 Fels
    { h: 0.5, r: 0.7, s0: 0.8, s1: 1.3 }, // 8 Muschel
    { h: 0.15, r: 0.5, s0: 0.7, s1: 1.3 }, // 9 Seestern
    { h: 1.2, r: 1.0, s0: 0.8, s1: 1.3 }, // 10 Kiste
  ];
  const setzeArt = (art: number, x: number, y: number, z: number, s: number): void => {
    switch (art) {
      case 0:
        geweih(bn, x, y, z, s, pick(KORALLEN));
        break;
      case 1:
        tisch(bo, x, y, z, s, pick(KORALLEN));
        break;
      case 2:
        hirn(bo, x, y, z, s, pick(KORALLEN));
        break;
      case 3:
        faecher(bn, x, y, z, s, pick(KORALLEN));
        break;
      case 4:
        roehre(x, y, z, s, pick(KORALLEN));
        break;
      case 5:
        schwamm(x, y, z, s, pick(SCHWAEMME));
        break;
      case 6:
        anemone(x, y, z, s, pick([rgb(0xff5f7e), rgb(0xa45ee5), rgb(0xff8a3d)]), pick([rgb(0x9be564), rgb(0xffc93c), rgb(0xff9ecf), rgb(0x5effd6)]));
        break;
      case 7:
        fels(x, y, z, s, pick(FELSEN), true);
        break;
      case 8:
        muschel(x, y, z, s);
        break;
      case 9:
        seestern(x, y, z, s);
        break;
      default:
        kiste(x, y, z, s);
    }
  };
  /** Setzt ein Stück, wenn Platz und Wasser genug da sind. Liefert true bei Erfolg. */
  const versuche = (art: number, x: number, z: number, sWant: number, budget = Infinity): boolean => {
    const a = ART[art];
    const r = a.r * sWant;
    if (!frei(x, z, r) || belegt(x, z, r)) return false;
    const y = world.heightAt(x, z) - 0.12;
    const avail = sea - 0.9 - y;
    let s = sWant;
    if (a.h * s > avail) s = avail / a.h;
    if (s < 0.45) return false;
    if (bo.triangles + bn.triangles > budget) return false;
    setzeArt(art, x, y, z, s);
    belege(x, z, a.r * s);
    return true;
  };

  // === Wrack (um den Tunnel der Abzweigung b) ===========================================
  const wrackSegs: number[] = [];
  for (const br of t.branches) {
    const segs: number[] = [];
    for (let g = br.first; g < br.first + br.count; g++) if (t.edge[g] & EDGE_TUNNEL && t.deep[g]) segs.push(g);
    if (segs.length > wrackSegs.length) wrackSegs.splice(0, wrackSegs.length, ...segs);
  }
  if (wrackSegs.length > 8) {
    const ringe: number[] = [];
    for (let i = 0; i < wrackSegs.length; i += 4) ringe.push(wrackSegs[i]);
    if (ringe[ringe.length - 1] !== wrackSegs[wrackSegs.length - 1]) ringe.push(wrackSegs[wrackSegs.length - 1]);
    let nr = ringe.length;
    const mitte = ringe[Math.floor(nr / 2)];
    // Weg von der Hauptstrecke: auf diese Seite neigt sich das Schiff, dort liegt die Ladung.
    let dMin = Infinity;
    let side = 1;
    for (let k = 0; k < t.n; k += 2) {
      const d = Math.hypot(t.px[k] - t.px[mitte], t.pz[k] - t.pz[mitte]);
      if (d < dMin) {
        dMin = d;
        side = rightX(t, mitte) * (t.px[k] - t.px[mitte]) + rightZ(t, mitte) * (t.pz[k] - t.pz[mitte]) > 0 ? -1 : 1;
      }
    }
    const W = t.wh[mitte] + 0.75;
    const B = W + 8.2;
    // Deck auf halber Höhe: der Fels über dem Tunnel füllt den Laderaum, sonst ragte alles aus dem Wasser.
    const DK = 9;
    const V0 = 3;
    const RHO = 0.13 * side;
    /** Rumpfpunkt am Ring i: u nach rechts, v über der Fahrbahn – um die Längsachse geneigt. */
    const hp = (g: number, u: number, v: number, along = 0): V3 => {
      const uu = u * Math.cos(RHO) - (v - V0) * Math.sin(RHO);
      const vv = V0 + u * Math.sin(RHO) + (v - V0) * Math.cos(RHO);
      return [t.px[g] + rightX(t, g) * uu + t.tx[g] * along, t.py[g] + vv, t.pz[g] + rightZ(t, g) * uu + t.tz[g] * along];
    };
    // Rumpf nur, wo er den Fahrbahnen außerhalb des Tunnels nicht zu nahe kommt (an der Gabelung
    // liegt die Hauptstrecke dicht daneben): das längste zusammenhängende Stück.
    {
      const ok = ringe.map((g) => {
        for (const su of [-1, 1]) {
          for (const v of [2.4, DK + 0.7]) {
            for (const al of [-2, 2]) {
              const p = hp(g, su * (B + 0.3), v, al);
              for (let k = 0; k < T; k++) {
                if (t.edge[k] & EDGE_TUNNEL) continue;
                if (Math.hypot(p[0] - t.px[k], p[2] - t.pz[k]) - t.wh[k] < RAND + 0.8) return false;
              }
            }
          }
        }
        return true;
      });
      let best0 = 0;
      let bestN = 0;
      for (let i = 0; i < ok.length; ) {
        if (!ok[i]) {
          i++;
          continue;
        }
        let j = i;
        while (j < ok.length && ok[j]) j++;
        if (j - i > bestN) {
          bestN = j - i;
          best0 = i;
        }
        i = j;
      }
      ringe.splice(0, ringe.length, ...ringe.slice(best0, best0 + bestN));
      nr = ringe.length;
    }
    // Querschnitt, einmal herum: Deck links innen → Deck → rechts über die Reling hinab → Kiel → links hinauf.
    const PROF: [number, number][] = [
      [-(B - 0.3), DK],
      [B - 0.3, DK],
      [B - 0.3, DK + 0.7],
      [B, DK + 0.7],
      [B, 4.9],
      [B, 4.1],
      [B, 2.4],
      [0.92 * B, -1.2],
      [0.55 * B, -3.6],
      [0, -4.2],
      [-0.55 * B, -3.6],
      [-0.92 * B, -1.2],
      [-B, 2.4],
      [-B, 4.1],
      [-B, 4.9],
      [-B, DK + 0.7],
      [-(B - 0.3), DK + 0.7],
    ];
    const NP = PROF.length;
    const farbe = (k: number, r: number): RGB => {
      if (k === 0) return r % 2 ? rgb(0x7a6048) : rgb(0x6a523b); // Deck
      if (k === 1 || k === NP - 1) return rgb(0x4a3a30); // Reling innen
      if (k === 2 || k === NP - 2) return r % 4 === 1 ? C_ALGE : rgb(0x2b3d45); // Reling oben
      if (k === 4 || k === NP - 5) return rgb(0xe6dcc6); // weißer Streifen
      if (k >= 6 && k <= NP - 7) return k === 6 || k === NP - 7 ? rgb(0x8f3a2c) : rgb(0x7a3026); // Unterwasserschiff
      const h = (r * 7 + k * 3) % 9;
      return h === 0 ? C_ROST : h === 4 ? C_ALGE : rgb(0x2b3d45);
    };
    for (let r = 0; r + 1 < nr; r++) {
      const g0 = ringe[r];
      const g1 = ringe[r + 1];
      for (let k = 0; k < NP; k++) {
        const j = (k + 1) % NP;
        const a0 = hp(g0, PROF[k][0], PROF[k][1]);
        const a1 = hp(g0, PROF[j][0], PROF[j][1]);
        const b0 = hp(g1, PROF[k][0], PROF[k][1]);
        const b1 = hp(g1, PROF[j][0], PROF[j][1]);
        // Außen: Normale im Querschnitt nach außen (Umlauf im Uhrzeigersinn, rechts = +u)
        const du = PROF[j][0] - PROF[k][0];
        const dv = PROF[j][1] - PROF[k][1];
        const nu = -dv;
        const nv = du;
        const mid = hp(g0, (PROF[k][0] + PROF[j][0]) / 2 + nu, (PROF[k][1] + PROF[j][1]) / 2 + nv);
        const m0 = hp(g0, (PROF[k][0] + PROF[j][0]) / 2, (PROF[k][1] + PROF[j][1]) / 2);
        quadN(bo, a0, a1, b1, b0, [mid[0] - m0[0], mid[1] - m0[1], mid[2] - m0[2]], farbe(k, r));
      }
      // Bullaugen auf beiden Seiten
      for (const su of [-1, 1]) {
        const p = (al: number, dv: number): V3 => hp(g0, su * (B + 0.05), 8 + dv, al);
        const out: V3 = [rightX(t, g0) * su, 0, rightZ(t, g0) * su];
        quadN(bn, p(1.0, -0.4), p(1.8, -0.4), p(1.8, 0.4), p(1.0, 0.4), out, C_DUNKEL);
      }
    }
    // Stirnwände an den Bruchkanten, mit dem Tunnelloch darin
    const IN: [number, number][] = [
      [-1, 0],
      [-1, 0.45],
      [-0.74, 0.78],
      [-0.38, 0.95],
      [0, 1],
      [0.38, 0.95],
      [0.74, 0.78],
      [1, 0.45],
      [1, 0],
    ];
    for (const end of [0, nr - 1]) {
      const g = ringe[end];
      const sgn = end === 0 ? -1 : 1;
      const push = 0.4 * sgn;
      const Wt = t.wh[g] + 0.5 + 0.25 + 0.35;
      const cont: THREE.Vector2[] = [];
      for (let k = 0; k < NP; k++) {
        const u = PROF[k][0];
        const v = PROF[k][1];
        cont.push(new THREE.Vector2(u * Math.cos(RHO) - (v - V0) * Math.sin(RHO), V0 + u * Math.sin(RHO) + (v - V0) * Math.cos(RHO)));
      }
      const hole: THREE.Vector2[] = [];
      for (let k = IN.length - 1; k >= 0; k--) hole.push(new THREE.Vector2(IN[k][0] * Wt, IN[k][1] === 0 ? -1.2 : IN[k][1] * 7.4 + 0.35));
      const faces = THREE.ShapeUtils.triangulateShape(cont, [hole]);
      const all = cont.concat(hole);
      const P3 = (v: THREE.Vector2): V3 => [t.px[g] + rightX(t, g) * v.x + t.tx[g] * push, t.py[g] + v.y, t.pz[g] + rightZ(t, g) * v.x + t.tz[g] * push];
      const n: V3 = [t.tx[g] * sgn, 0, t.tz[g] * sgn];
      // Vorn (Fahrtrichtung zuerst erreicht) die Bruchkante – rostig, mit Zacken; hinten das Heck.
      const bruch = end === 0;
      for (const f of faces) {
        const cy = (all[f[0]].y + all[f[1]].y + all[f[2]].y) / 3;
        const c = bruch ? (cy > DK - 1 ? rgb(0x2e2a3a) : rgb(0x262233)) : cy < 2.4 ? rgb(0x8f3a2c) : rgb(0x34505c);
        triN(bo, P3(all[f[0]]), P3(all[f[1]]), P3(all[f[2]]), n, c);
      }
      // dunkler Rand der Bordwand
      {
        const off = 0.07 * sgn;
        const cx0 = 0;
        const cy0 = V0 + 2;
        for (let k = 2; k < NP - 1; k++) {
          const a = cont[k];
          const b = cont[k + 1];
          const ins = (v: THREE.Vector2): THREE.Vector2 => {
            const dx = cx0 - v.x;
            const dy = cy0 - v.y;
            const l = Math.hypot(dx, dy) || 1;
            return new THREE.Vector2(v.x + (dx / l) * 0.8, v.y + (dy / l) * 0.8);
          };
          const q = [P3(a), P3(b), P3(ins(b)), P3(ins(a))];
          for (const v of q) {
            v[0] += t.tx[g] * off;
            v[2] += t.tz[g] * off;
          }
          quadN(bn, q[0], q[1], q[2], q[3], n, bruch ? (k % 3 === 0 ? rgb(0xd0703c) : rgb(0xb85a34)) : rgb(0x22343c));
        }
        if (bruch) {
          // Zwischendecks als dunkle Linien, links und rechts des Lochs
          for (const vv of [1.8, 5.6]) {
            for (const su of [-1, 1]) {
              const u0 = su * (Wt + 0.6);
              const u1 = su * (B - 0.9);
              const q2 = [P3(new THREE.Vector2(u0, vv)), P3(new THREE.Vector2(u1, vv + (u1 - u0) * Math.tan(RHO))), P3(new THREE.Vector2(u1, vv + 0.45 + (u1 - u0) * Math.tan(RHO))), P3(new THREE.Vector2(u0, vv + 0.45))];
              for (const v of q2) {
                v[0] += t.tx[g] * off;
                v[2] += t.tz[g] * off;
              }
              quadN(bn, q2[0], q2[1], q2[2], q2[3], n, rgb(0x9a4f2a));
            }
          }
        }
      }
      if (bruch) {
        // Zacken der aufgerissenen Bordwand
        for (let k = 2; k < NP - 1; k++) {
          if (k > 7 && k < NP - 8) continue;
          const a = cont[k];
          const b = cont[k + 1];
          const len = 0.8 + ((k * 7) % 5) * 0.35;
          const tipV = new THREE.Vector2((a.x + b.x) / 2, (a.y + b.y) / 2);
          const pa = P3(a);
          const pb = P3(b);
          const pc = P3(tipV);
          pc[0] += t.tx[g] * sgn * len;
          pc[2] += t.tz[g] * sgn * len;
          triN(bo, pa, pb, pc, [rightX(t, g) * Math.sign(a.x || 1), 0.3, rightZ(t, g) * Math.sign(a.x || 1)], rgb(0x2b3d45));
        }
      } else {
        // weißer Streifen links und rechts des Lochs (geneigt wie der Rumpf)
        const roll = (u: number, v: number): THREE.Vector2 => new THREE.Vector2(u * Math.cos(RHO) - (v - V0) * Math.sin(RHO), V0 + u * Math.sin(RHO) + (v - V0) * Math.cos(RHO));
        for (const su of [-1, 1]) {
          const u0 = su * (Wt + 1.4);
          const u1 = su * (B - 0.05);
          const a = P3(roll(u0, 4.1));
          const b = P3(roll(u1, 4.1));
          const c = P3(roll(u1, 4.9));
          const d = P3(roll(u0, 4.9));
          for (const v of [a, b, c, d]) {
            v[0] += t.tx[g] * 0.05 * sgn;
            v[2] += t.tz[g] * 0.05 * sgn;
          }
          quadN(bn, a, b, c, d, n, rgb(0xe6dcc6));
        }
      }
    }
    /** Rahmen auf dem Deck am Anteil f der Länge, seitlich u. */
    const deck = (f: number, u: number, extraRoll = 0, s = 1): number => {
      const ri = Math.max(0, Math.min(nr - 1, Math.round(f * (nr - 1))));
      const g = ringe[ri];
      const p = hp(g, u, DK);
      rahmen(p[0], p[1], p[2], Math.atan2(t.tx[g], t.tz[g]), s, 0, -RHO + extraRoll);
      return g;
    };
    const away = side;
    // Der Laderaum ist verschüttet (dort liegt der Fels des Tunnels); auf den Decksstreifen
    // daneben: Poller, Winden, ein Rettungsboot, Bewuchs.
    const strip = B - 2.4;
    for (const su of [-1, 1]) {
      let n = 0;
      for (let f = 0.08; f < 0.95; f += 0.16, n++) {
        deck(f, su * strip);
        if (n % 2 === 0) {
          teil(bo, G.zyl6, rgb(0x3b3f4c), 0, 0.4, -0.5, 0, 0, 0, 0.32, 0.8, 0.32);
          teil(bo, G.zyl6, rgb(0x3b3f4c), 0, 0.4, 0.5, 0, 0, 0, 0.32, 0.8, 0.32);
        } else {
          teil(bo, G.box, rgb(0x5d6a3a), 0, 0.5, 0, 0, 0, 0, 1.4, 1.0, 1.2);
          teil(bo, G.zyl8, C_ROST, 0, 1.0, 0, 0, 0, Math.PI / 2, 0.45, 1.6, 0.45);
        }
      }
    }
    deck(0.55, away * strip, away * 0.25);
    teil(bo, G.okt, rgb(0xe8e2d0), 0, 0.9, 0, 0, 0, 0, 1.0, 0.6, 3.2);
    teil(bn, G.box, rgb(0xd8433a), 0, 1.15, 0, 0, 0, 0, 1.6, 0.12, 2.6);
    // Großmast: steht noch und ragt aus dem Wasser; vorn ein abgeknickter Mast nach außen
    {
      const g = deck(0.82, away * (strip - 0.6));
      const hm = Math.max(8, sea + 4 - (t.py[g] + DK));
      const top: V3 = [0, hm, -0.6];
      stab(bo, G.zyl6, rgb(0x5a4436), [0, -0.2, 0], top, 0.34);
      stab(bo, G.box, rgb(0x5a4436), [-5, hm * 0.62, -0.4], [5, hm * 0.62, -0.4], 0.26);
      for (const su of [-1, 1]) stab(bn, G.ast, rgb(0x2a2733), [0, hm * 0.95, -0.6], [su * 3.5, 0.6, 0.5], 0.06);
      deck(0.2, away * strip);
      const tip: V3 = [-away * 10 * Math.sin(0.95), 10 * Math.cos(0.95), 1.5];
      const tw = pt(tip[0], tip[1], tip[2]);
      if (kante(tw[0], tw[2]) > RAND + 1) {
        stab(bo, G.zyl6, rgb(0x5a4436), [0, -0.2, 0], tip, 0.3);
        stab(bo, G.box, rgb(0x5a4436), [tip[0] * 0.7, tip[1] * 0.7, tip[2] * 0.7 - 3], [tip[0] * 0.7, tip[1] * 0.7, tip[2] * 0.7 + 3], 0.22);
      }
    }
    // Bewuchs auf den Decksstreifen: Korallen, Anemonen, Kelp
    for (let i = 0; i < 12; i++) {
      const f = 0.05 + rnd() * 0.9;
      const u = (rnd() < 0.5 ? -1 : 1) * (B - 1.2 - rnd() * 3);
      const ri = Math.round(f * (nr - 1));
      const g = ringe[ri];
      const p = hp(g, u, DK);
      if (p[1] > sea - 1.4) continue;
      if (i < 5) kelp.push(p[0], p[1] - 0.1, p[2], Math.max(2.5, Math.min(7, sea - 1.2 - p[1])), 1.3, rnd() * TAU);
      else if (i % 3 === 0) anemone(p[0], p[1], p[2], 1.1, rgb(0xff5f7e), rgb(0x9be564));
      else if (i % 3 === 1) faecher(bn, p[0], p[1], p[2], 1.2, pick(KORALLEN));
      else geweih(bo, p[0], p[1], p[2], 1.0, pick(KORALLEN));
    }
    // Der Schornstein ist abgebrochen und liegt neben dem Rumpf
    {
      const g = ringe[Math.round(0.45 * (nr - 1))];
      const lat = away * (B + 5.5);
      const x = t.px[g] + rightX(t, g) * lat;
      const z = t.pz[g] + rightZ(t, g) * lat;
      if (frei(x, z, 4.2) && !belegt(x, z, 4)) {
        const y = world.heightAt(x, z);
        rahmen(x, y + 1.1, z, Math.atan2(t.tx[g], t.tz[g]) + away * 0.5, 1, 0, Math.PI / 2 - 0.15);
        teil(bo, G.zyl8, rgb(0xb8322a), 0, 0, 0, 0, 0, 0, 1.7, 6.4, 1.7);
        teil(bo, G.zyl8, rgb(0x1f1d24), 0, 3.0, 0, 0, 0, 0, 1.76, 1.0, 1.76);
        teil(bn, G.scheibe, C_DUNKEL, 0, 3.52, 0, -Math.PI / 2, 0, 0, 1.6, 1.6, 1);
        const fp = pt(0, 3.6, 0.8);
        blasenPlatz.push(fp[0], fp[1], fp[2]);
        belege(x, z, 4);
      }
    }
    // Ladung neben dem Rumpf, Anker mit Kette
    for (let i = 0; i < 7; i++) {
      const f = 0.3 + rnd() * 0.6;
      const g = ringe[Math.round(f * (nr - 1))];
      const lat = away * (B + 3 + rnd() * 9);
      const x = t.px[g] + rightX(t, g) * lat + t.tx[g] * (rnd() - 0.5) * 4;
      const z = t.pz[g] + rightZ(t, g) * lat + t.tz[g] * (rnd() - 0.5) * 4;
      if (i < 2) {
        if (!frei(x, z, 3.5) || belegt(x, z, 3.2)) continue;
        const y = world.heightAt(x, z);
        rahmen(x, y, z, Math.atan2(t.tx[g], t.tz[g]) + (rnd() - 0.5) * 1.2, 1, (rnd() - 0.5) * 0.2, (rnd() - 0.5) * 0.35);
        const cc = pick([rgb(0xd8433a), rgb(0x2f6fa8), rgb(0xe0a21c)]);
        teil(bo, G.box, cc, 0, 1.2, 0, 0, 0, 0, 2.4, 2.6, 6);
        for (let q = -2; q <= 2; q++) teil(bn, G.box, shade(cc, 0.75), 0, 1.2, q * 1.15, 0, 0, 0, 2.48, 2.3, 0.18);
        teil(bn, G.box, C_ALGE, 0, 2.55, 0.5, 0, 0, 0, 1.6, 0.1, 3.2);
        belege(x, z, 3.2);
      } else if (frei(x, z, 1.2) && !belegt(x, z, 1)) {
        kiste(x, world.heightAt(x, z), z, 1);
        belege(x, z, 1);
      }
    }
    {
      const g = ringe[1];
      const lat = away * (B + 7);
      const ax = t.px[g] + rightX(t, g) * lat - t.tx[g] * 2;
      const az = t.pz[g] + rightZ(t, g) * lat - t.tz[g] * 2;
      if (frei(ax, az, 3) && !belegt(ax, az, 3)) {
        const ay = world.heightAt(ax, az);
        const yaw = Math.atan2(t.tx[g], t.tz[g]) + 0.6;
        rahmen(ax, ay + 0.35, az, yaw, 1.3, 0, Math.PI / 2 - 0.25);
        const ac = rgb(0x3b3f4c);
        teil(bo, G.box, ac, 0, 0, 0, 0, 0, 0, 0.45, 0.45, 4.2);
        teil(bo, G.box, ac, 0, 0, 1.9, 0, 0, 0, 2.6, 0.4, 0.4);
        teil(bo, G.box, ac, 0.9, 0, -1.6, 0, 0.6, 0, 0.4, 0.4, 1.8);
        teil(bo, G.box, ac, -0.9, 0, -1.6, 0, -0.6, 0, 0.4, 0.4, 1.8);
        teil(bo, G.okt, ac, 1.45, 0, -0.9, 0, 0.6, 0, 0.55, 0.2, 0.7);
        teil(bo, G.okt, ac, -1.45, 0, -0.9, 0, -0.6, 0, 0.55, 0.2, 0.7);
        const ring = pt(0, 0, 2.3);
        // Kette von der Klüse am Bug zum Ankerring
        const k0 = hp(ringe[0], away * (B + 0.1), DK - 1.5, 3);
        rahmen(0, 0, 0, 0, 1);
        const N = 14;
        let prev: V3 = k0;
        for (let q = 1; q <= N; q++) {
          const f = q / N;
          const sag = Math.sin(f * Math.PI) * 2.5;
          const p: V3 = [k0[0] + (ring[0] - k0[0]) * f, k0[1] + (ring[1] - k0[1]) * f - sag, k0[2] + (ring[2] - k0[2]) * f];
          p[1] = Math.max(p[1], world.heightAt(p[0], p[2]) + 0.15);
          stab(bo, q % 2 ? G.box : G.okt, rgb(0x2e3038), prev, p, 0.22);
          prev = p;
        }
        belege(ax, az, 3);
      }
    }
    // Abgebrochener Bug: liegt gekippt neben der Bruchkante
    {
      const g = ringe[0];
      const Bb = B * 0.85;
      const Lb = 17;
      const HALF: [number, number][] = [
        [Bb, DK + 1.2],
        [Bb, 4.9],
        [Bb, 4.1],
        [Bb, 2.4],
        [0.92 * Bb, -1.2],
        [0.55 * Bb, -3.6],
        [0, -4.2],
      ];
      let placed = false;
      for (let tries = 0; tries < 14 && !placed; tries++) {
        const lat = away * (B + 11 + tries * 1.5);
        const al = -4 - (tries % 3) * 4;
        const x = t.px[g] + rightX(t, g) * lat + t.tx[g] * al;
        const z = t.pz[g] + rightZ(t, g) * lat + t.tz[g] * al;
        const yaw = Math.atan2(t.tx[g], t.tz[g]) + Math.PI + away * 0.5;
        const fx = Math.sin(yaw);
        const fz = Math.cos(yaw);
        let ok = frei(x, z, 6) && !belegt(x, z, 5, 0.6);
        for (const d of [-3, 6, 12, 18]) if (ok && !frei(x + fx * d, z + fz * d, 4.5)) ok = false;
        if (!ok) continue;
        const y = world.heightAt(x, z);
        rahmen(x, y - 1.2, z, yaw, 1, -0.1, away * 0.45);
        const sec = (f: number, k: number, su: number): V3 => {
          const [u, v] = HALF[k];
          const w = 1 - Math.pow(f, 1.6);
          const rise = f * f * 2.5;
          return pt(su * u * w, v + 4.2 + rise * (k === 6 ? 2 : 1), f * Lb + (v + 4.2) * 0.28 * f);
        };
        const F = [0, 0.35, 0.68, 1];
        for (let i = 0; i + 1 < F.length; i++) {
          for (const su of [-1, 1]) {
            for (let k = 0; k + 1 < HALF.length; k++) {
              const a0 = sec(F[i], k, su);
              const a1 = sec(F[i], k + 1, su);
              const b0 = sec(F[i + 1], k, su);
              const b1 = sec(F[i + 1], k + 1, su);
              const c = k === 1 ? rgb(0xe6dcc6) : k >= 3 ? rgb(0x8f3a2c) : (i + k) % 3 === 0 ? C_ROST : rgb(0x2b3d45);
              const out = pt(su * 3, 0, F[i] * Lb);
              const mid = pt(0, 0, F[i] * Lb);
              quadN(bo, a0, a1, b1, b0, [out[0] - mid[0], out[1] - mid[1], out[2] - mid[2]], c);
            }
            // Deck
            const d0 = sec(F[i], 0, su);
            const d1 = sec(F[i + 1], 0, su);
            const m0 = sec(F[i], 0, 0);
            const m1 = sec(F[i + 1], 0, 0);
            m0[1] -= 0.6;
            m1[1] -= 0.6;
            quadN(bo, d0, m0, m1, d1, [mP.elements[4], mP.elements[5], mP.elements[6]], rgb(0x6a523b));
          }
        }
        // Bruchfläche
        const ring: V3[] = [];
        for (let k = 0; k < HALF.length; k++) ring.push(sec(0, k, 1));
        for (let k = HALF.length - 2; k >= 1; k--) ring.push(sec(0, k, -1));
        const c0 = pt(0, 4.2 + 4, -0.1);
        for (let k = 0; k < ring.length; k++) triN(bo, c0, ring[k], ring[(k + 1) % ring.length], [-fx, 0, -fz], rgb(0x7a5a44));
        // Ankerklüse und Bewuchs
        const kl = pt(Bb * 0.7 + 0.05, DK + 2, Lb * 0.75);
        rahmen(kl[0], kl[1], kl[2], yaw, 1);
        teil(bn, G.zyl6, C_DUNKEL, 0, 0, 0, 0, 0, Math.PI / 2, 0.45, 0.2, 0.45);
        belege(x + fx * 6, z + fz * 6, 9);
        placed = true;
      }
    }
    for (const g of ringe) belege(t.px[g], t.pz[g], B + 1.5);
  }

  // === Graben: dunkle Felswände und Leuchtalgen ===========================================
  {
    const runs: [number, number][] = [];
    for (let i = 0; i < T; i++) {
      if (!(t.edge[i] & EDGE_GAP) || !t.deep[i]) continue;
      if (t.edge[t.prev[i]] & EDGE_GAP) continue;
      let j = i;
      while (t.edge[t.next[j]] & EDGE_GAP && t.next[j] !== i) j = t.next[j];
      runs.push([i, j]);
    }
    for (const [g0, g1] of runs) {
      const gm = Math.round((g0 + g1) / 2);
      const L = ((g1 - g0 + 1) * t.step) / 2;
      const ax = t.tx[gm];
      const az = t.tz[gm];
      const rx = rightX(t, gm);
      const rz = rightZ(t, gm);
      for (const su of [-1, 1]) {
        let blocked = 0;
        for (let d = t.wh[gm] + RAND + 1.6; d < 46 && blocked < 2; d += 2.4) {
          let any = false;
          for (const e of [-1, 1]) {
            const al = e * (L + 1.6 + rnd() * 1.4);
            const x = t.px[gm] + rx * su * d + ax * al;
            const z = t.pz[gm] + rz * su * d + az * al;
            if (!frei(x, z, 1.6)) continue;
            any = true;
            const y = world.heightAt(x, z);
            const h = Math.min(3.5 + rnd() * 4 + d * 0.06, sea - 1.5 - y);
            if (h < 1.5) continue;
            rahmen(x, y - 0.3, z, Math.atan2(ax, az) + (rnd() - 0.5) * 0.4, 1, (rnd() - 0.5) * 0.15, (rnd() - 0.5) * 0.2);
            teil(bo, G.ico0, rnd() < 0.5 ? C_GRABEN : C_GRABEN_D, 0, h * 0.45, 0, 0, rnd(), 0, 1.6 + rnd() * 0.6, h * 0.62, 1.2);
            // Leuchtalgen auf der Seite zum Graben
            leuchtalge(x - ax * e * 0.9, y + h * 0.95, z - az * e * 0.9, 1.1 + rnd() * 0.5);
            belege(x, z, 1.6);
          }
          // dunkler Grund zwischen den Wänden
          if (any) {
            const p = (dd: number, al: number): V3 => {
              const x = t.px[gm] + rx * su * dd + ax * al;
              const z = t.pz[gm] + rz * su * dd + az * al;
              return [x, world.heightAt(x, z) + 0.08, z];
            };
            quadN(bn, p(d - 1.2, -L), p(d + 1.2, -L), p(d + 1.2, L), p(d - 1.2, L), [0, 1, 0], C_GRABEN_D);
          } else blocked++;
        }
      }
    }
  }

  // === Felsbögen und Felsnadeln ==========================================================
  const bogen = (x: number, y: number, z: number, yaw: number, span: number, h: number): void => {
    const c = pick(FELSEN);
    const N = 9;
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * Math.PI;
      rahmen(x, y, z, yaw, 1);
      const px = Math.cos(a) * span * 0.5;
      const py = Math.sin(a) * h;
      const sz = 1.3 + rnd() * 0.5;
      teil(bo, G.ico0, i % 2 ? c : shade(c, 0.85), px, py, 0, rnd(), rnd() * 3, rnd(), sz, sz * 0.9, sz * 1.1);
    }
    // Bewuchs oben
    for (let i = 0; i < 3; i++) {
      const a = 0.3 + rnd() * 2.5;
      rahmen(x, y, z, yaw, 1);
      const p = pt(Math.cos(a) * span * 0.5, Math.sin(a) * h + 1.1, 0);
      if (i === 0) geweih(bo, p[0], p[1], p[2], 0.8, pick(KORALLEN));
      else anemone(p[0], p[1], p[2], 0.8, pick([rgb(0xff5f7e), rgb(0xa45ee5)]), rgb(0xffc93c));
    }
  };
  const nadel = (x: number, y: number, z: number, h: number): void => {
    const c = pick(FELSEN);
    rahmen(x, y, z, rnd() * TAU, 1, (rnd() - 0.5) * 0.15, (rnd() - 0.5) * 0.15);
    teil(bo, G.kegel5, c, 0, h * 0.5, 0, 0, rnd(), 0, 1.8, h, 1.8);
    teil(bo, G.ico0, shade(c, 0.85), 0.8, 0.8, 0.3, rnd(), rnd(), 0, 1.4, 1.2, 1.3);
    teil(bo, G.ico0, c, -0.5, h * 0.45, 0.2, rnd(), rnd(), 0, 0.9, 0.8, 0.9);
    leuchtalge(x + 0.6, y + h * 0.3, z, 0.8);
  };
  {
    const WANT = [
      [1, 610, 0],
      [0, 470, 1],
      [0, 700, 0],
      [0, 1060, 0],
      [0, 1215, 1],
      [1, 590, 0],
      [1, 650, 1],
      [1, 760, 0],
      [1, 1020, 1],
      [1, 1100, 0],
      [1, 1180, 0],
    ];
    for (const [art, m, sd] of WANT) {
      const k0 = Math.round(m / t.step) % t.n;
      for (let tries = 0; tries < 12; tries++) {
        const k = (k0 + Math.floor((rnd() - 0.5) * 30) + t.n) % t.n;
        const su = (sd ? 1 : -1) * (tries % 3 === 2 ? -1 : 1);
        if (art === 0) {
          const span = 10 + rnd() * 4;
          const lat = su * (t.wh[k] + RAND + 3 + rnd() * 8);
          const x = t.px[k] + rightX(t, k) * lat;
          const z = t.pz[k] + rightZ(t, k) * lat;
          const yaw = Math.atan2(t.tx[k], t.tz[k]) + Math.PI / 2;
          const lx = Math.cos(yaw) * span * 0.5;
          const lz = -Math.sin(yaw) * span * 0.5;
          if (!frei(x + lx, z + lz, 2) || !frei(x - lx, z - lz, 2) || !frei(x, z, 2) || belegt(x, z, span * 0.5)) continue;
          const y = Math.min(world.heightAt(x + lx, z + lz), world.heightAt(x - lx, z - lz)) - 0.4;
          const h = Math.min(9, sea - 2.6 - y);
          if (h < 4) continue;
          bogen(x, y, z, yaw, span, h);
          belege(x, z, span * 0.5 + 1);
          break;
        } else {
          const lat = su * (t.wh[k] + RAND + 2.5 + rnd() * 14);
          const x = t.px[k] + rightX(t, k) * lat;
          const z = t.pz[k] + rightZ(t, k) * lat;
          if (!frei(x, z, 2.4) || belegt(x, z, 2.4)) continue;
          const y = world.heightAt(x, z) - 0.3;
          const h = Math.min(7 + rnd() * 6, sea - 1.5 - y);
          if (h < 4) continue;
          nadel(x, y, z, h);
          belege(x, z, 2.4);
          break;
        }
      }
    }
  }

  // === Über Wasser: Insel mit Leuchtfeuer, Palmeninseln, Steg ===============================
  const palme = (x: number, y: number, z: number, s: number): void => {
    const lean = 0.15 + rnd() * 0.25;
    const yaw = rnd() * TAU;
    rahmen(x, y, z, yaw, s);
    const N = 5;
    let prev: V3 = [0, 0, 0];
    for (let i = 1; i <= N; i++) {
      const f = i / N;
      const p: V3 = [0, f * 6, Math.sin(lean) * 6 * f * f];
      stab(bo, G.zyl6, i % 2 ? rgb(0x8a6a48) : rgb(0x9c7a52), prev, p, 0.28 - f * 0.08);
      prev = p;
    }
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * TAU + rnd() * 0.3;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const l = 2.6;
      const q = (d: number, w: number, dy: number): V3 => pt(prev[0] + ca * d - sa * w, prev[1] + dy, prev[2] + sa * d + ca * w);
      const c = k % 2 ? rgb(0x3fae4a) : rgb(0x56c45a);
      bn.quad(q(0, 0, 0), q(l * 0.5, -0.45, 0.35), q(l * 0.5, 0.45, 0.35), q(0, 0, 0), c);
      bn.tri(q(0, 0, 0), q(l * 0.5, -0.45, 0.35), q(l * 0.5, 0.45, 0.35), c);
      bn.tri(q(l * 0.5, -0.45, 0.35), q(l, 0, -0.7), q(l * 0.5, 0.45, 0.35), shade(c, 0.85));
    }
    teil(bo, G.ico0, rgb(0x6b4a2a), 0, prev[1] - 0.3, prev[2], 0, 0, 0, 0.35, 0.35, 0.35);
  };
  const insel = (x: number, z: number, R: number, hoch: number): void => {
    const N = 10;
    const top: V3[] = [];
    const bot: V3[] = [];
    const mitte: V3 = [x, sea + hoch + 0.6, z];
    for (let k = 0; k < N; k++) {
      const a = (k / N) * TAU;
      const r = R * (0.8 + rnd() * 0.35);
      const px = x + Math.cos(a) * r;
      const pz = z + Math.sin(a) * r;
      top.push([px, sea + hoch * (0.4 + rnd() * 0.3), pz]);
      const bx = x + Math.cos(a) * r * 1.5;
      const bz = z + Math.sin(a) * r * 1.5;
      bot.push([bx, Math.min(sea - 1, world.heightAt(bx, bz)) - 1, bz]);
    }
    for (let k = 0; k < N; k++) {
      const j = (k + 1) % N;
      bo.tri(mitte, top[j], top[k], k % 2 ? C_SAND : mixRgb(C_SAND, C_WEISS, 0.2));
      bo.quad(bot[k], bot[j], top[j], top[k], C_SAND_D);
    }
    belege(x, z, R * 1.2);
  };
  // Leuchtfeuer bei den Stützpunkten 27–28 (Ende der Runde, vor dem Steg)
  let leuchtX = NaN;
  let leuchtZ = NaN;
  let leuchtY = 0;
  {
    const k0 = Math.round((t.n * 26.9) / 29);
    const k1 = Math.round((t.n * 28.6) / 29);
    let best = -Infinity;
    for (let k = k0; k <= k1; k += 4) {
      for (const su of [-1, 1]) {
        for (let lat = t.wh[k] + 16; lat < t.wh[k] + 40; lat += 4) {
          const x = t.px[k] + rightX(t, k) * su * lat;
          const z = t.pz[k] + rightZ(t, k) * su * lat;
          if (!frei(x, z, 12) || belegt(x, z, 12)) continue;
          // außen an der Runde, nah an der Fahrbahn
          const out = Math.hypot(x - world.center.x, z - world.center.z) * 0.02 - lat * 0.1;
          if (out > best) {
            best = out;
            leuchtX = x;
            leuchtZ = z;
          }
          break;
        }
      }
    }
    if (Number.isFinite(leuchtX)) {
      insel(leuchtX, leuchtZ, 9, 1.4);
      leuchtY = sea + 1.6;
      rahmen(leuchtX, leuchtY, leuchtZ, 0.3, 1);
      const white = rgb(0xf4f1e8);
      const red = rgb(0xd8433a);
      teil(bo, G.zyl8, white, 0, 7, 0, 0, 0, 0, 1.5, 14, 1.5);
      for (const yy of [3, 8.5]) teil(bo, G.zyl8, red, 0, yy, 0, 0, 0, 0, 1.56 - yy * 0.015, 2.2, 1.56 - yy * 0.015);
      teil(bo, G.zyl8, rgb(0x2a2733), 0, 14.2, 0, 0, 0, 0, 2.2, 0.4, 2.2);
      teil(bg, G.zyl8, rgb(0xfff3a0), 0, 15.4, 0, 0, 0, 0, 1.05, 2.0, 1.05);
      teil(bo, G.kegel5, red, 0, 17.2, 0, 0, 0, 0, 1.5, 1.6, 1.5);
      teil(bo, G.box, rgb(0xe6dcc6), 3.2, 1.2, 1, 0, 0.3, 0, 3, 2.4, 3.6);
      teil(bo, G.box, red, 3.2, 2.7, 1, 0, 0.3, 0, 3.4, 0.6, 4);
      for (let i = 0; i < 3; i++) {
        const a = 2 + i * 1.3;
        palme(leuchtX + Math.cos(a) * 5.5, leuchtY - 0.3, leuchtZ + Math.sin(a) * 5.5, 0.9 + rnd() * 0.3);
      }
      for (let i = 0; i < 5; i++) {
        const a = rnd() * TAU;
        fels(leuchtX + Math.cos(a) * 9, sea - 0.6, leuchtZ + Math.sin(a) * 9, 1 + rnd() * 0.6, pick(FELSEN), false);
      }
    }
  }
  // Palmeninselchen in der Lagune
  {
    const want = detail === 0 ? 2 : 4;
    let got = 0;
    for (let tries = 0; tries < 300 && got < want; tries++) {
      const k = Math.floor(rnd() * t.n);
      const m = meterOf(k);
      if (m > 230 && m < 1290) continue;
      const su = rnd() < 0.5 ? -1 : 1;
      const lat = su * (t.wh[k] + 26 + rnd() * 60);
      const x = t.px[k] + rightX(t, k) * lat;
      const z = t.pz[k] + rightZ(t, k) * lat;
      const R = 4 + rnd() * 3;
      if (!frei(x, z, R * 1.6 + 6) || belegt(x, z, R * 1.5 + 8) || world.heightAt(x, z) > sea - 0.3) continue;
      insel(x, z, R, 0.7);
      const np = 1 + Math.floor(rnd() * 3);
      for (let i = 0; i < np; i++) palme(x + (rnd() - 0.5) * R * 0.8, sea + 0.5, z + (rnd() - 0.5) * R * 0.8, 0.8 + rnd() * 0.4);
      got++;
    }
  }
  // Steg: Laternen an Pfählen, zwei Anleger mit Fässern, Kisten und Netz
  {
    let lampN = 0;
    let lastM = -Infinity;
    for (let k = 0; k < t.n; k++) {
      const m = meterOf(k);
      if (!(t.edge[k] & EDGE_DECK) || t.deep[k] || m - lastM < 24) continue;
      lastM = m;
      const su = lampN % 2 ? 1 : -1;
      lampN++;
      const lat = su * (t.wh[k] + RAND + 0.4);
      const x = t.px[k] + rightX(t, k) * lat;
      const z = t.pz[k] + rightZ(t, k) * lat;
      if (gesperrt(x, z, 0.5) || kante(x, z) < RAND) continue;
      const y0 = Math.min(world.heightAt(x, z), sea) - 1;
      const top = t.py[k] + 3.6;
      rahmen(x, 0, z, Math.atan2(t.tx[k], t.tz[k]), 1);
      teil(bo, G.box, C_HOLZ_D, 0, (y0 + top) / 2, 0, 0, 0, 0, 0.32, top - y0, 0.32);
      teil(bo, G.box, rgb(0x2a2733), 0, top + 0.1, 0, 0, 0, 0, 0.7, 0.18, 0.7);
      teil(bg, G.box, rgb(0xffd77a), 0, top + 0.55, 0, 0, 0, 0, 0.45, 0.7, 0.45);
      teil(bo, G.kegel5, rgb(0x2a2733), 0, top + 1.1, 0, 0, 0, 0, 0.5, 0.4, 0.5);
    }
    for (const [m, su] of [
      [45, 1],
      [115, -1],
    ] as [number, number][]) {
      const k = Math.round(m / t.step);
      if (!(t.edge[k] & EDGE_DECK)) continue;
      const lat = su * (t.wh[k] + RAND + 2.4);
      const x = t.px[k] + rightX(t, k) * lat;
      const z = t.pz[k] + rightZ(t, k) * lat;
      if (kante(x, z) < RAND + 1.9) continue;
      const y = t.py[k] - 0.15;
      const yb = Math.min(world.heightAt(x, z), sea) - 1;
      rahmen(x, y, z, Math.atan2(t.tx[k], t.tz[k]), 1);
      teil(bo, G.box, C_HOLZ, 0, -0.15, 0, 0, 0, 0, 3.6, 0.3, 4.4);
      for (const [px, pz] of [
        [-1.6, -2],
        [1.6, -2],
        [-1.6, 2],
        [1.6, 2],
      ])
        teil(bo, G.box, C_HOLZ_D, px, (yb - y) / 2, pz, 0, 0, 0, 0.3, y - yb + 0.3, 0.3);
      // Fässer
      for (let i = 0; i < 3; i++) teil(bo, G.zyl8, i === 1 ? rgb(0x3a6fb0) : rgb(0xb5543c), -0.9 + i * 0.75, 0.5, -1.2 + (i % 2) * 0.6, 0, rnd(), 0, 0.36, 1, 0.36);
      teil(bo, G.box, C_HOLZ_D, 0.8, 0.4, 1.2, 0, 0.3, 0, 0.9, 0.8, 0.9);
      // Netz zum Trocknen auf einem Gestell
      teil(bo, G.box, C_HOLZ_D, -1.3, 0.9, 1.6, 0, 0, 0, 0.12, 1.8, 0.12);
      teil(bo, G.box, C_HOLZ_D, 1.3, 0.9, 1.6, 0, 0, 0, 0.12, 1.8, 0.12);
      teil(bo, G.box, C_HOLZ_D, 0, 1.8, 1.6, 0, 0, 0, 2.7, 0.1, 0.1);
      for (let q = 0; q < 4; q++) {
        const a = pt(-1.25 + q * 0.62, 1.78, 1.6);
        const b = pt(-1.25 + (q + 1) * 0.62, 1.78, 1.6);
        const c = pt(-1.25 + (q + 1) * 0.62 + 0.1, 0.5 + (q % 2) * 0.25, 1.75);
        const d = pt(-1.25 + q * 0.62 + 0.1, 0.5 + ((q + 1) % 2) * 0.25, 1.75);
        bn.quad(a, b, c, d, q % 2 ? rgb(0x2f6b5a) : rgb(0x3d7f6a));
      }
      teil(bg, G.box, rgb(0xffd77a), 1.5, 2.2, -1.9, 0, 0, 0, 0.35, 0.5, 0.35);
      teil(bo, G.box, C_HOLZ_D, 1.5, 1, -1.9, 0, 0, 0, 0.18, 2, 0.18);
    }
  }

  let vorKand = 0;
  // === Riff am Boden: Kandidaten, gemischt, bis das Budget erreicht ist =====================
  const Z_FLACH = 0;
  const Z_GRABEN = 2;
  const Z_KELP = 3;
  const zoneOf = (m: number): number => (m < 168 ? -1 : m < 275 ? Z_FLACH : m < 535 ? 1 : m < 830 ? Z_GRABEN : m < 965 ? Z_KELP : m < 1150 ? 4 : m < 1300 ? 5 : -1);
  const DICHTE = [0.45, 1, 0.65, 0.45, 0.55, 0.95];
  const GEWICHT: number[][] = [
    [0.5, 0.3, 1, 0.4, 0.3, 0.3, 1, 1, 2, 3, 0],
    [3, 2, 2, 2, 2, 1.5, 1.5, 1.4, 0.7, 0.8, 0],
    [1, 0.5, 0.8, 1.6, 1, 1.5, 1, 3, 0.5, 0.6, 0],
    [0.4, 0.2, 0.5, 0.8, 0.5, 1, 1.5, 2.5, 1, 1, 0],
    [0.8, 0.5, 0.8, 1.5, 1, 2, 1, 2, 0.5, 0.6, 1.5],
    [2.5, 2.5, 2, 2, 1.5, 1, 1, 1, 0.6, 0.6, 0],
  ];
  const waehle = (zo: number): number => {
    const w = GEWICHT[zo];
    let sum = 0;
    for (const v of w) sum += v;
    let r = rnd() * sum;
    for (let i = 0; i < w.length; i++) {
      r -= w[i];
      if (r <= 0) return i;
    }
    return 7;
  };
  {
    const kand: number[] = []; // x, z, zone
    for (let k = 0; k < T; k += 2) {
      const zo = zoneOf(meterOf(k));
      if (zo < 0 || !t.deep[k]) continue;
      for (const su of [-1, 1]) {
        for (let rep = 0; rep < 2; rep++) {
          if (rnd() > DICHTE[zo] * 0.6) continue;
          const lat = su * (t.wh[k] + RAND + 0.6 + (rnd() < 0.85 ? 20 * Math.pow(rnd(), 1.3) : 20 + rnd() * 25));
          const al = (rnd() - 0.5) * 2;
          kand.push(t.px[k] + rightX(t, k) * lat + t.tx[k] * al, t.pz[k] + rightZ(t, k) * lat + t.tz[k] * al, zo);
        }
      }
    }
    // mischen
    const nk = kand.length / 3;
    const order = new Int32Array(nk);
    for (let i = 0; i < nk; i++) order[i] = i;
    for (let i = nk - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      const tmp = order[i];
      order[i] = order[j];
      order[j] = tmp;
    }
    vorKand = bo.triangles + bn.triangles;
    const budget = vorKand + [8500, 12000, 15000][detail];
    for (let q = 0; q < nk; q++) {
      const o = order[q] * 3;
      const zo = kand[o + 2];
      const art = waehle(zo);
      const a = ART[art];
      const s = a.s0 + rnd() * (a.s1 - a.s0);
      if (!versuche(art, kand[o], kand[o + 1], s, budget)) continue;
      // kleine Nachbarn: Riffgruppen
      if (zo !== Z_KELP && rnd() < 0.55) {
        for (let n = 0; n < 2; n++) {
          const ang = rnd() * TAU;
          const d = a.r * s + 0.8 + rnd() * 1.5;
          versuche(pick([6, 9, 8, 2, 0]), kand[o] + Math.cos(ang) * d, kand[o + 1] + Math.sin(ang) * d, 0.7 + rnd() * 0.4, budget);
        }
      }
    }
  }

  // === Kelp: Seegraswald, dazu einzelne Stränge und Seegras im Flachen =====================
  {
    const want = [70, 105, 140][detail];
    const tufts = [16, 24, 30][detail];
    let n = 0;
    let nt = 0;
    for (let tries = 0; tries < 4000 && (n < want || nt < tufts); tries++) {
      const k = Math.floor(rnd() * T);
      const m = meterOf(k);
      const zo = zoneOf(m);
      if (zo < 0 || !t.deep[k]) continue;
      const tuft = zo === Z_FLACH || m > 1250;
      if (tuft ? nt >= tufts : n >= want) continue;
      if (!tuft && zo !== Z_KELP && rnd() > 0.12) continue;
      const su = rnd() < 0.5 ? -1 : 1;
      const lat = su * (t.wh[k] + RAND + 2.6 + (tuft ? 8 : 30) * Math.pow(rnd(), 1.6));
      const x = t.px[k] + rightX(t, k) * lat + t.tx[k] * (rnd() - 0.5) * 2;
      const z = t.pz[k] + rightZ(t, k) * lat + t.tz[k] * (rnd() - 0.5) * 2;
      if (!frei(x, z, 2.6) || belegt(x, z, 0.6, 1)) continue;
      const y = world.heightAt(x, z) - 0.2;
      const room = sea - 1.4 - y;
      if (tuft) {
        if (room < 1.5) continue;
        kelp.push(x, y, z, Math.min(room, 1.2 + rnd() * 1.4), 0.55 + rnd() * 0.25, rnd() * TAU);
        nt++;
      } else {
        if (room < 4) continue;
        kelp.push(x, y, z, room * (0.6 + rnd() * 0.35), 1.3 + rnd() * 0.7, rnd() * TAU);
        n++;
      }
      belege(x, z, 0.5);
    }
  }

  // === Blasenquellen und Krebsplätze ======================================================
  {
    const want = [6, 9, 12][detail];
    for (let tries = 0; tries < 400 && blasenPlatz.length / 3 < want; tries++) {
      const k = Math.floor(rnd() * T);
      const zo = zoneOf(meterOf(k));
      if (zo < 0 || zo === Z_FLACH || !t.deep[k]) continue;
      const su = rnd() < 0.5 ? -1 : 1;
      const lat = su * (t.wh[k] + RAND + 1.5 + rnd() * 16);
      const x = t.px[k] + rightX(t, k) * lat;
      const z = t.pz[k] + rightZ(t, k) * lat;
      if (!frei(x, z, 1.2) || belegt(x, z, 1)) continue;
      let ok = true;
      for (let q = 0; q < blasenPlatz.length; q += 3) if (Math.hypot(x - blasenPlatz[q], z - blasenPlatz[q + 2]) < 40) ok = false;
      if (!ok) continue;
      const y = world.heightAt(x, z);
      // Spalte: zwei dunkle Brocken mit Lücke
      rahmen(x, y, z, rnd() * TAU, 1);
      teil(bo, G.ico0, C_GRABEN, -0.9, 0.3, 0, rnd(), rnd(), 0, 0.9, 0.6, 1.2);
      teil(bo, G.ico0, C_GRABEN_D, 0.9, 0.3, 0, rnd(), rnd(), 0, 0.8, 0.7, 1.1);
      blasenPlatz.push(x, y + 0.2, z);
      belege(x, z, 1.5);
    }
  }

  // === Statische Netze ===================================================================
  const toon = toonMaterial({ vertexColors: true, side: THREE.DoubleSide });
  disposables.push(toon);
  {
    const go = addSmoothNormals(bo.build());
    const gn = bn.build();
    const body = verbinde(go, gn);
    gn.dispose();
    const mesh = new THREE.Mesh(body, toon);
    group.add(mesh);
    disposables.push(body);
    if (lines) {
      const ol = new THREE.Mesh(go, outlineMaterial(0.045));
      ol.name = 'outline';
      group.add(ol);
      disposables.push(go);
    } else go.dispose();
  }
  const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  {
    const gg = bg.build();
    const glow = new THREE.Mesh(gg, glowMat);
    group.add(glow);
    disposables.push(gg, glowMat);
  }

  // === Kelp (instanziert, wiegt sich im Shader) ==========================================
  const zeit = { value: 0 };
  const nKelp = kelp.length / 6;
  {
    const kb = new MeshBuilder();
    const stiel = rgb(0x5a7d2a);
    const blattA = rgb(0x7fbf3a);
    const blattB = rgb(0x9ad04a);
    const N = 6;
    for (let i = 0; i < N; i++) {
      const y0 = i / N;
      const y1 = (i + 1) / N;
      const w = 0.05;
      kb.quad([-w, y0, 0], [w, y0, 0], [w * 0.8, y1, 0], [-w * 0.8, y1, 0], shade(stiel, 0.8 + 0.2 * y0));
      // Blatt: abwechselnd nach links/rechts und in zwei Ebenen
      const yb = y0 + 0.04;
      const sgn = i % 2 ? 1 : -1;
      const L = 0.5 * (1 - y0 * 0.35);
      if (i % 4 < 2) kb.quad([0, yb, 0], [sgn * L * 0.5, yb + 0.03, 0.09], [sgn * L, yb + 0.1, 0], [sgn * L * 0.5, yb + 0.06, -0.09], i % 2 ? blattA : blattB);
      else kb.quad([0, yb, 0], [0.09, yb + 0.03, sgn * L * 0.5], [0, yb + 0.1, sgn * L], [-0.09, yb + 0.06, sgn * L * 0.5], i % 2 ? blattA : blattB);
    }
    // oberstes Blatt
    kb.tri([0, 1, 0], [0.12, 0.96, 0], [0, 1.08, 0], blattB);
    const kgeo = kb.build();
    const kmat = toonMaterial({ vertexColors: true, side: THREE.DoubleSide });
    kmat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = zeit;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;').replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        {
          #ifdef USE_INSTANCING
            vec2 kp = vec2(instanceMatrix[3][0], instanceMatrix[3][2]);
          #else
            vec2 kp = vec2(0.0);
          #endif
          float kh = max(position.y, 0.0);
          float kw = kh * kh * (0.6 + 0.4 * kh);
          transformed.x += sin(uTime * 0.85 + kp.x * 0.13 + kp.y * 0.07 - kh * 1.6) * kw * 0.75;
          transformed.z += sin(uTime * 0.63 + kp.y * 0.11 + kp.x * 0.05 - kh * 1.2) * kw * 0.45;
        }`,
      );
    };
    const km = new THREE.InstancedMesh(kgeo, kmat, Math.max(1, nKelp));
    km.count = nKelp;
    km.frustumCulled = false;
    for (let i = 0; i < nKelp; i++) {
      const o = i * 6;
      eT.set(0, kelp[o + 5], 0, 'YXZ');
      qT.setFromEuler(eT);
      mT.compose(vT.set(kelp[o], kelp[o + 1], kelp[o + 2]), qT, sT.set(kelp[o + 4], kelp[o + 3], kelp[o + 4]));
      km.setMatrixAt(i, mT);
    }
    km.instanceMatrix.needsUpdate = true;
    group.add(km);
    disposables.push(kgeo, kmat, km);
  }

  // === Fischschwärme ======================================================================
  const schwaerme: Schwarm[] = [];
  const fishCol: number[] = [];
  {
    const maxFish = [80, 130, 170][detail];
    const wantS = [9, 13, 16][detail];
    let nFish = 0;
    // Ein Sardinenschwarm zieht hoch über den Seegraswald hinweg – mit LUFT Abstand zur Fahrbahn.
    for (let s = 0; s < wantS + 1 && nFish < maxFish; s++) {
      const quer = s === wantS;
      const art = quer ? ARTEN[0] : ARTEN[s % ARTEN.length];
      const n = Math.min(maxFish - nFish, art.n0 + Math.floor(rnd() * (art.n1 - art.n0 + 1)));
      if (n < 3) break;
      let placed = false;
      for (let tries = 0; tries < 30 && !placed; tries++) {
        const m = quer ? 870 + rnd() * 80 : 210 + ((s + rnd() * 0.8) / wantS) * 1060;
        const k = Math.round(m / t.step) % t.n;
        if (!t.deep[k]) continue;
        const su = (s + tries) % 2 ? 1 : -1;
        const rx = quer ? 22 : 7 + rnd() * 8;
        const ry = quer ? 7 : 2.5 + rnd() * 3;
        const lat = quer ? 0 : su * (t.wh[k] + RAND + art.spread + ry + 1 + rnd() * 8);
        const cx = t.px[k] + rightX(t, k) * lat;
        const cz = t.pz[k] + rightZ(t, k) * lat;
        // Bahnachsen: quer → über die Fahrbahn (rechts), sonst längs
        const ax = quer ? rightX(t, k) : t.tx[k];
        const az = quer ? rightZ(t, k) : t.tz[k];
        let cy = quer ? sea - 1.6 - art.spread * 0.4 : t.py[k] + 1.8 + rnd() * 3;
        let ok = true;
        for (let q = 0; q < 24 && ok; q++) {
          const a = (q / 24) * TAU;
          const x = cx + ax * Math.cos(a) * rx - az * Math.sin(a) * ry;
          const z = cz + az * Math.cos(a) * rx + ax * Math.sin(a) * ry;
          const ground = world.heightAt(x, z) + 1 + art.spread * 0.4;
          if (cy < ground) cy = ground;
          const d = kante(x, z);
          if (d < RAND + art.spread + 1) {
            // über der Fahrbahn: nur mit LUFT darunter
            if (cy - art.spread * 0.4 < t.py[nah] + LUFT + 0.5) ok = false;
          }
        }
        if (!ok || cy > sea - 1.2 - art.spread * 0.4) continue;
        const first = nFish;
        for (let i = 0; i < n; i++) {
          // Versatz im Schwarm (lokal: x quer, y hoch, z längs), Größe, Phase
          const r = Math.cbrt(rnd());
          const a = rnd() * TAU;
          fishCol.push(Math.cos(a) * r * art.spread, (rnd() - 0.5) * art.spread * 0.8, Math.sin(a) * r * art.spread, 0.85 + rnd() * 0.3, rnd() * TAU, pick(art.farben));
        }
        nFish += n;
        schwaerme.push({ cx, cy, cz, ax, az, rx, ry, w: ((rnd() < 0.5 ? -1 : 1) * art.speed) / Math.max(rx, ry), ph: rnd() * TAU, first, count: n, len: art.len, form: art.form });
        placed = true;
      }
    }
  }
  const nFish = fishCol.length / 6;
  const fishTime = zeit;
  const FISCH_GLSL = `
    {
      #ifdef USE_INSTANCING
        float fPh = instanceMatrix[3][0] * 1.7 + instanceMatrix[3][2] * 1.3;
      #else
        float fPh = 0.0;
      #endif
      float fT = clamp(0.2 - transformed.z, 0.0, 1.0);
      transformed.x += sin(uTime * 9.0 + fPh - transformed.z * 5.0) * 0.2 * fT * fT;
    }`;
  let fishMesh: THREE.InstancedMesh | null = null;
  {
    const fb = new MeshBuilder();
    const fo = new MeshBuilder();
    const nose: V3 = [0, 0, 0.5];
    const tail: V3 = [0, 0, -0.32];
    const top: V3 = [0, 0.2, 0.05];
    const bot: V3 = [0, -0.17, 0.05];
    const l: V3 = [-0.1, 0, 0.05];
    const r: V3 = [0.1, 0, 0.05];
    const cT: RGB = [0.72, 0.72, 0.78];
    const cS: RGB = [1, 1, 1];
    const cB: RGB = [1, 1, 0.97];
    for (const b of [fb, fo]) {
      b.tri(nose, top, r, cT);
      b.tri(nose, l, top, cT);
      b.tri(tail, r, top, cT);
      b.tri(tail, top, l, cT);
      b.tri(nose, r, bot, cS);
      b.tri(nose, bot, l, cS);
      b.tri(tail, bot, r, cB);
      b.tri(tail, l, bot, cB);
    }
    // Schwanz- und Rückenflosse (flach, ohne Kontur)
    fb.tri(tail, [0, 0.17, -0.55], [0, -0.17, -0.55], cT);
    fb.tri([0, 0.19, 0.0], [0, 0.17, -0.25], [0, 0.3, -0.18], cT);
    const fgeo = fb.build();
    const fmat = toonMaterial({ vertexColors: true, side: THREE.DoubleSide });
    fmat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = fishTime;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;').replace('#include <begin_vertex>', '#include <begin_vertex>' + FISCH_GLSL);
    };
    fishMesh = new THREE.InstancedMesh(fgeo, fmat, Math.max(1, nFish));
    fishMesh.count = nFish;
    fishMesh.frustumCulled = false;
    const c = new THREE.Color();
    for (let i = 0; i < Math.max(1, nFish); i++) fishMesh.setColorAt(i, c.set(nFish ? fishCol[i * 6 + 5] : 0xffffff));
    if (fishMesh.instanceColor) fishMesh.instanceColor.needsUpdate = true;
    group.add(fishMesh);
    disposables.push(fgeo, fmat, fishMesh);
    const ogeo = addSmoothNormals(fo.build());
    if (lines && detail === 2) {
      const om = outlineMaterial(0.035).clone();
      om.uniforms.uTime = fishTime;
      om.vertexShader = om.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;').replace('vec3 transformed = position;', 'vec3 transformed = position;' + FISCH_GLSL);
      const ol = new THREE.InstancedMesh(ogeo, om, Math.max(1, nFish));
      ol.count = nFish;
      ol.instanceMatrix = fishMesh.instanceMatrix;
      ol.frustumCulled = false;
      ol.name = 'outline';
      group.add(ol);
      disposables.push(om, ol);
    }
    disposables.push(ogeo);
  }

  // === Tiere: Rochen, Schildkröte, Wal, Quallen, Krebse, Möwen, Boote, Bojen ================
  const vorlagen: Vorlage[] = [];
  const mk = (): [MeshBuilder, MeshBuilder] => [new MeshBuilder(), new MeshBuilder()];
  rahmen(0, 0, 0, 0, 1);
  // 0 Rochen (Nase +z, Spannweite ±2.2)
  {
    const [s, f] = mk();
    const top = rgb(0x34506e);
    const bel = rgb(0xe9f1f6);
    const nose: V3 = [0, 0, 1.2];
    const R: V3 = [2.2, 0, -0.2];
    const L: V3 = [-2.2, 0, -0.2];
    const back: V3 = [0, 0, -1.0];
    const up: V3 = [0, 0.3, 0.15];
    const dn: V3 = [0, -0.14, 0.15];
    const mR: V3 = [1.0, 0.12, 0.45];
    const mL2: V3 = [-1.0, 0.12, 0.45];
    s.tri(nose, mR, up, top);
    s.tri(mR, R, up, shade(top, 0.9));
    s.tri(R, back, up, top);
    s.tri(back, L, up, top);
    s.tri(L, mL2, up, shade(top, 0.9));
    s.tri(mL2, nose, up, top);
    s.tri(nose, dn, mR, bel);
    s.tri(mR, dn, R, bel);
    s.tri(R, dn, back, bel);
    s.tri(back, dn, L, bel);
    s.tri(L, dn, mL2, bel);
    s.tri(mL2, dn, nose, bel);
    // Hörner und Schwanz
    f.tri([0.35, 0, 1.0], [0.55, -0.05, 1.45], [0.6, 0, 1.0], top);
    f.tri([-0.35, 0, 1.0], [-0.6, 0, 1.0], [-0.55, -0.05, 1.45], top);
    f.tri([0, 0.05, -0.9], [0.06, 0, -0.9], [0, 0, -3.4], top);
    vorlagen.push(vorlage(s, f, (x) => Math.pow(Math.min(1, Math.abs(x) / 2.2), 1.4)));
  }
  // 1 Schildkröte
  {
    const [s, f] = mk();
    const shell = rgb(0x5f7f3a);
    const skin = rgb(0x9fb36a);
    rahmen(0, 0, 0, 0, 1);
    teilBunt(s, G.halb, shell, rgb(0x7a9a45), 0, 0, 0, 1, 0.45, 1.3);
    teil(s, G.scheibe, rgb(0xd8c890), 0, -0.02, 0, Math.PI / 2, 0, 0, 1, 1.3, 1);
    teil(s, G.ico0, skin, 0, 0.05, 1.45, 0, 0, 0, 0.32, 0.28, 0.4);
    for (const [x, z, l] of [
      [1, 0.6, 1],
      [-1, 0.6, 1],
      [0.8, -0.9, 0.6],
      [-0.8, -0.9, 0.6],
    ])
      teil(s, G.okt, skin, x * (1 + l * 0.15), -0.05, z, 0, x > 0 ? -0.5 : 0.5, 0, 0.8 * l, 0.08, 0.3 * l);
    vorlagen.push(vorlage(s, f, (x) => (Math.abs(x) > 0.9 ? Math.abs(x) - 0.9 : 0)));
  }
  // 2 Wal
  {
    const [s, f] = mk();
    const back = rgb(0x3b5878);
    const belly = rgb(0xa9bfd0);
    rahmen(0, 0, 0, 0, 1);
    teil(s, G.ico1, back, 0, 0, 0, 0, 0, 0, 2.2, 1.8, 6.5);
    teil(s, G.ico1, belly, 0, -0.75, 1.6, 0, 0, 0, 1.8, 1.0, 4.2);
    teil(s, G.ico0, back, 0, 0.1, -6.8, 0, 0, 0, 0.9, 0.8, 2.8);
    teil(s, G.okt, back, 0, 0.1, -9.6, 0, 0, 0, 3.2, 0.18, 1.0);
    teil(s, G.okt, back, 1.9, -0.8, 1.5, 0.3, -0.6, -0.5, 1.6, 0.12, 0.5);
    teil(s, G.okt, back, -1.9, -0.8, 1.5, 0.3, 0.6, 0.5, 1.6, 0.12, 0.5);
    f.tri([0, 1.4, -2.4], [0, 2.3, -3.4], [0, 1.4, -3.6], back);
    vorlagen.push(vorlage(s, f, (_x, _y, z) => smooth((-z - 3) / 7)));
  }
  // 3, 4 Quallen (rosa und violett): Glocke (Gewicht −1), Fäden (Gewicht = Tiefe)
  for (const [bell, fad] of [
    [0xff8fc8, 0xffd0ea],
    [0xb58cff, 0xe2d4ff],
  ]) {
    const [s, f] = mk();
    rahmen(0, 0, 0, 0, 1);
    teilBunt(s, G.halb, rgb(bell), mixRgb(rgb(bell), C_WEISS, 0.35), 0, 0, 0, 1, 0.85, 1);
    teil(s, G.scheibe, shade(rgb(bell), 0.75), 0, 0.01, 0, Math.PI / 2, 0, 0, 0.95, 0.95, 1);
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * TAU;
      const x = Math.cos(a) * 0.75;
      const z = Math.sin(a) * 0.75;
      f.quad([x - 0.05, 0, z], [x + 0.05, 0, z], [x * 0.8 + 0.03, -2.2, z * 0.8], [x * 0.8 - 0.03, -2.2, z * 0.8], rgb(fad));
    }
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * TAU + 0.5;
      f.quad([Math.cos(a) * 0.15, -0.02, Math.sin(a) * 0.15], [Math.cos(a + 1) * 0.15, -0.02, Math.sin(a + 1) * 0.15], [Math.cos(a + 0.5) * 0.25, -1.3, Math.sin(a + 0.5) * 0.25], [Math.cos(a + 0.5) * 0.1, -1.1, Math.sin(a + 0.5) * 0.1], rgb(bell));
    }
    vorlagen.push(vorlage(s, f, (_x, y) => (y >= 0 ? -1 : -y)));
  }
  // 5 Krebs
  {
    const [s, f] = mk();
    const red = rgb(0xe8483f);
    rahmen(0, 0, 0, 0, 1);
    teil(s, G.ico0, red, 0, 0.2, 0, 0, 0, 0, 0.45, 0.2, 0.32);
    teil(s, G.okt, shade(red, 0.9), 0.48, 0.25, 0.32, 0, 0.4, 0, 0.2, 0.13, 0.15);
    teil(s, G.okt, shade(red, 0.9), -0.48, 0.25, 0.32, 0, -0.4, 0, 0.2, 0.13, 0.15);
    teil(s, G.box, C_DUNKEL, 0.1, 0.4, 0.25, 0, 0, 0, 0.05, 0.12, 0.05);
    teil(s, G.box, C_DUNKEL, -0.1, 0.4, 0.25, 0, 0, 0, 0.05, 0.12, 0.05);
    for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) f.tri([sx * 0.35, 0.18, -0.15 + k * 0.15], [sx * 0.65, 0.0, -0.25 + k * 0.17], [sx * 0.36, 0.2, -0.1 + k * 0.15], shade(red, 0.75));
    vorlagen.push(vorlage(s, f, (x, _y, z) => (Math.abs(x) > 0.3 && z > 0.18 ? 1 : 0)));
  }
  // 6 Möwe
  {
    const [s, f] = mk();
    rahmen(0, 0, 0, 0, 1);
    teil(s, G.ico0, rgb(0xf7f7f2), 0, 0, 0, 0, 0, 0, 0.2, 0.19, 0.55);
    teil(s, G.ico0, C_WEISS, 0, 0.07, 0.5, 0, 0, 0, 0.14, 0.14, 0.16);
    teil(s, G.kegel3, rgb(0xffb21f), 0, 0.05, 0.72, Math.PI / 2, 0, 0, 0.05, 0.22, 0.05);
    teil(s, G.okt, rgb(0xc5d0dc), 0.7, 0.05, 0, 0, 0, 0, 0.7, 0.04, 0.25);
    teil(s, G.okt, rgb(0xc5d0dc), -0.7, 0.05, 0, 0, 0, 0, 0.7, 0.04, 0.25);
    teil(s, G.okt, rgb(0x2a2f3a), 1.35, 0.05, -0.05, 0, 0, 0, 0.18, 0.03, 0.1);
    teil(s, G.okt, rgb(0x2a2f3a), -1.35, 0.05, -0.05, 0, 0, 0, 0.18, 0.03, 0.1);
    vorlagen.push(vorlage(s, f, (x) => Math.max(0, Math.abs(x) - 0.15)));
  }
  // 7 Auslegerkanu
  {
    const [s, f] = mk();
    rahmen(0, 0, 0, 0, 1);
    teil(s, G.okt, rgb(0xa0603a), 0, 0.1, 0, 0, 0, 0, 0.45, 0.4, 2.6);
    teil(s, G.box, rgb(0x5a3a22), 0, 0.42, 0, 0, 0, 0, 0.5, 0.06, 3.2);
    teil(s, G.okt, rgb(0xe8e2d0), 1.7, 0.05, 0, 0, 0, 0, 0.16, 0.14, 1.6);
    teil(s, G.box, rgb(0x6e4a2c), 0.85, 0.4, 0.8, 0, 0, 0, 1.9, 0.08, 0.1);
    teil(s, G.box, rgb(0x6e4a2c), 0.85, 0.4, -0.8, 0, 0, 0, 1.9, 0.08, 0.1);
    teil(s, G.box, rgb(0xd8433a), 0, 0.5, 1.6, 0, 0, 0, 0.3, 0.15, 0.3);
    vorlagen.push(vorlage(s, f, () => 0));
  }
  // 8 Segelboot
  {
    const [s, f] = mk();
    rahmen(0, 0, 0, 0, 1);
    teil(s, G.okt, rgb(0xf2efe6), 0, 0.2, 0, 0, 0, 0, 0.9, 0.6, 3);
    teil(s, G.box, rgb(0x2f6fa8), 0, 0.62, -0.3, 0, 0, 0, 1.2, 0.12, 3.4);
    teil(s, G.box, rgb(0x5a4436), 0, 3, 0.3, 0, 0, 0, 0.1, 5, 0.1);
    f.tri([0, 0.9, 0.35], [0, 5.3, 0.35], [0, 0.9, -2.2], rgb(0xff6f61));
    f.tri([0, 1.0, 0.45], [0, 4.4, 0.5], [0, 1.0, 1.9], rgb(0xfff6d6));
    vorlagen.push(vorlage(s, f, () => 0));
  }
  // 9 Boje
  {
    const [s, f] = mk();
    rahmen(0, 0, 0, 0, 1);
    teil(s, G.zyl6, rgb(0xe8402f), 0, 0, 0, 0, 0, 0, 0.8, 1.2, 0.8);
    teil(s, G.zyl6, rgb(0xf7f2e4), 0, 1.0, 0, 0, 0, 0, 0.5, 0.8, 0.5);
    teil(s, G.kegel5, rgb(0xe8402f), 0, 1.85, 0, 0, 0, 0, 0.45, 0.9, 0.45);
    teil(s, G.ico0, rgb(0xfff06a), 0, 2.45, 0, 0, 0, 0, 0.3, 0.3, 0.3);
    vorlagen.push(vorlage(s, f, () => 0));
  }
  const V_ROCHEN = 0;
  const V_KROETE = 1;
  const V_WAL = 2;
  const V_QUALLE = 3;
  const V_KREBS = 5;
  const V_MOEWE = 6;
  const V_KANU = 7;
  const V_SEGEL = 8;
  const V_BOJE = 9;

  // Darsteller: Vorlage, Art der Biegung und Bahn
  const akt: { v: number; kind: number; p: number[] }[] = [];
  /** Kreisbahn um (x, z) mit Radius r, deren Rand überall min Meter neben der Fahrbahn bleibt. */
  const kreisFrei = (x: number, z: number, r: number, min: number): boolean => {
    for (let q = 0; q < 16; q++) {
      const a = (q / 16) * TAU;
      if (kante(x + Math.cos(a) * r, z + Math.sin(a) * r) < min) return false;
    }
    return true;
  };
  /** Tiefster Boden unter einer Kreisbahn (höchster Punkt des Geländes). */
  const kreisBoden = (x: number, z: number, r: number): number => {
    let y = -Infinity;
    for (let q = 0; q < 12; q++) {
      const a = (q / 12) * TAU;
      y = Math.max(y, world.heightAt(x + Math.cos(a) * r, z + Math.sin(a) * r));
    }
    return y;
  };
  const unterwasserPunkt = (dMin: number, dMax: number): [number, number, number] | null => {
    for (let tries = 0; tries < 60; tries++) {
      const k = Math.floor(rnd() * T);
      const m = meterOf(k);
      if (!t.deep[k] || m < 280 || m > 1260) continue;
      const lat = (rnd() < 0.5 ? -1 : 1) * (t.wh[k] + dMin + rnd() * (dMax - dMin));
      const x = t.px[k] + rightX(t, k) * lat;
      const z = t.pz[k] + rightZ(t, k) * lat;
      if (kante(x, z) < dMin) continue;
      return [x, z, k];
    }
    return null;
  };
  // Rochen und Schildkröten auf Kreisen neben dem Riff
  for (const [v, n, rad, size, speed, hy] of [
    [V_ROCHEN, [1, 2, 3][detail], 14, 1.7, 2.6, 4],
    [V_KROETE, [1, 1, 2][detail], 9, 1.1, 1.4, 3],
  ]) {
    let got = 0;
    for (let tries = 0; tries < 40 && got < n; tries++) {
      const p = unterwasserPunkt(22, 55);
      if (!p) continue;
      const [x, z] = p;
      const r = rad * (0.8 + rnd() * 0.5);
      if (!kreisFrei(x, z, r, RAND + 4)) continue;
      const y = Math.min(sea - 2.5, kreisBoden(x, z, r) + hy + rnd() * 2);
      if (y < kreisBoden(x, z, r) + 1.5) continue;
      akt.push({ v, kind: v === V_ROCHEN ? K_ROCHEN : K_KROETE, p: [x, y, z, r, ((rnd() < 0.5 ? -1 : 1) * speed) / r, rnd() * TAU, size] });
      got++;
    }
  }
  // Wal: weit draußen, am Rand der Sicht
  {
    for (let tries = 0; tries < 60; tries++) {
      const a = rnd() * TAU;
      const d = world.radius * (0.6 + rnd() * 0.6);
      const x = world.center.x + Math.cos(a) * d;
      const z = world.center.z + Math.sin(a) * d;
      const r = 45;
      const c = kante(x, z);
      if (c < 110 || c > 200 || !kreisFrei(x, z, r, 70)) continue;
      const y = Math.min(sea - 9, kreisBoden(x, z, r) + 9);
      akt.push({ v: V_WAL, kind: K_WAL, p: [x, y, z, r, -2.2 / r, rnd() * TAU, 1.5] });
      break;
    }
  }
  // Quallen: steigen pulsierend auf und sinken langsam wieder
  {
    const n = [5, 7, 9][detail];
    for (let i = 0; i < n; i++) {
      const p = unterwasserPunkt(12, 40);
      if (!p) continue;
      const [x, z] = p;
      if (belegt(x, z, 1.5)) continue;
      const lo = world.heightAt(x, z) + 3.5;
      const hi = sea - 2.2;
      if (hi - lo < 2) continue;
      akt.push({ v: V_QUALLE + (i % 2), kind: K_QUALLE, p: [x, lo, z, hi, 22 + rnd() * 14, rnd() * TAU, 0.7 + rnd() * 0.6] });
    }
  }
  // Krebse auf Felsen
  {
    const n = Math.min([5, 8, 10][detail], krebsPlatz.length / 3);
    for (let i = 0; i < n; i++) {
      const j = Math.floor((i * krebsPlatz.length) / 3 / n) * 3;
      const x = krebsPlatz[j];
      const z = krebsPlatz[j + 2];
      if (kante(x, z) < RAND + 1 || kante(x, z) > 25) continue;
      akt.push({ v: V_KREBS, kind: K_KREBS, p: [x, krebsPlatz[j + 1] - 0.05, z, rnd() * TAU, rnd() * TAU, 0.9 + rnd() * 0.4] });
    }
  }
  // Möwen über der Lagune
  {
    const n = [4, 5, 6][detail];
    let cx = NaN;
    let cz = NaN;
    for (let tries = 0; tries < 80; tries++) {
      const k = Math.floor((rnd() * 0.12 + (rnd() < 0.5 ? 0 : 0.88)) * t.n) % t.n;
      const su = rnd() < 0.5 ? -1 : 1;
      const lat = su * (t.wh[k] + 25 + rnd() * 30);
      const x = t.px[k] + rightX(t, k) * lat;
      const z = t.pz[k] + rightZ(t, k) * lat;
      if (kante(x, z) < 20) continue;
      cx = x;
      cz = z;
      break;
    }
    if (Number.isFinite(cx)) for (let i = 0; i < n; i++) akt.push({ v: V_MOEWE, kind: K_MOEWE, p: [cx + (rnd() - 0.5) * 20, sea + 14 + rnd() * 8, cz + (rnd() - 0.5) * 20, 9 + rnd() * 8, (i % 2 ? 1 : -1) * (0.45 + rnd() * 0.2), rnd() * TAU, 1.7] });
  }
  // Boote und Bojen in der Lagune
  {
    const boote = [
      [V_KANU, [2, 3, 3][detail], 15],
      [V_SEGEL, 1, 22],
      [V_BOJE, [3, 4, 5][detail], 9],
    ];
    for (const [v, n, dmin] of boote) {
      let got = 0;
      for (let tries = 0; tries < 200 && got < n; tries++) {
        const k = Math.floor(rnd() * t.n);
        const m = meterOf(k);
        if (v === V_BOJE ? m < 120 || (m > 240 && m < 1270) : m > 220 && m < 1290) continue;
        const su = rnd() < 0.5 ? -1 : 1;
        const lat = su * (t.wh[k] + dmin + rnd() * (v === V_BOJE ? 10 : 45));
        const x = t.px[k] + rightX(t, k) * lat;
        const z = t.pz[k] + rightZ(t, k) * lat;
        if (kante(x, z) < dmin || belegt(x, z, 4) || world.heightAt(x, z) > sea - 1.2) continue;
        akt.push({ v, kind: K_STARR, p: [x, sea, z, rnd() * TAU, rnd() * TAU, v === V_BOJE ? 1.1 : 1.2] });
        belege(x, z, 3);
        got++;
      }
    }
  }
  // Netz der Tiere zusammensetzen
  let nVert = 0;
  for (const a of akt) nVert += vorlagen[a.v].pos.length / 3;
  const tPos = new Float32Array(Math.max(3, nVert * 3));
  const tNor = new Float32Array(Math.max(3, nVert * 3));
  const tOnor = new Float32Array(Math.max(3, nVert * 3));
  const tCol = new Float32Array(Math.max(3, nVert * 3));
  const aOff = new Int32Array(Math.max(1, akt.length));
  const solidIdx: number[] = [];
  {
    let o = 0;
    for (let i = 0; i < akt.length; i++) {
      const v = vorlagen[akt[i].v];
      aOff[i] = o;
      tCol.set(v.col, o * 3);
      for (let q = 0; q < v.nSolid; q++) solidIdx.push(o + q);
      o += v.pos.length / 3;
    }
  }
  const tierGeo = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(tPos, 3).setUsage(THREE.DynamicDrawUsage);
  const norAttr = new THREE.BufferAttribute(tNor, 3).setUsage(THREE.DynamicDrawUsage);
  const onorAttr = new THREE.BufferAttribute(tOnor, 3).setUsage(THREE.DynamicDrawUsage);
  tierGeo.setAttribute('position', posAttr);
  tierGeo.setAttribute('normal', norAttr);
  tierGeo.setAttribute('color', new THREE.BufferAttribute(tCol, 3));
  tierGeo.setAttribute('onormal', onorAttr);
  if (nVert === 0) tierGeo.setDrawRange(0, 0);
  const tiere = new THREE.Mesh(tierGeo, toon);
  tiere.frustumCulled = false;
  group.add(tiere);
  disposables.push(tierGeo);
  if (lines && solidIdx.length > 0) {
    const og = new THREE.BufferGeometry();
    og.setAttribute('position', posAttr);
    og.setAttribute('onormal', onorAttr);
    og.setIndex(solidIdx);
    const ol = new THREE.Mesh(og, outlineMaterial(0.04));
    ol.frustumCulled = false;
    ol.name = 'outline';
    group.add(ol);
    disposables.push(og);
  }
  /** Rechnet die Ecken von Darsteller i mit Matrix m um; k1, k2 steuern die Biegung. */
  const setze = (i: number, m: THREE.Matrix4, k1: number, k2: number): void => {
    const a = akt[i];
    const v = vorlagen[a.v];
    const e = m.elements;
    const sc = Math.hypot(e[0], e[1], e[2]) || 1;
    const inv = 1 / sc;
    const n = v.pos.length / 3;
    const o = aOff[i] * 3;
    const kind = a.kind;
    for (let q = 0; q < n; q++) {
      const q3 = q * 3;
      let x = v.pos[q3];
      let y = v.pos[q3 + 1];
      let z = v.pos[q3 + 2];
      const w = v.flex[q];
      if (w !== 0) {
        switch (kind) {
          case K_ROCHEN:
            y += k2 * w * Math.sin(k1 - Math.abs(x) * 0.7);
            break;
          case K_KROETE:
            y += k2 * w * Math.sin(k1 + (x > 0 ? 0 : Math.PI) + (z > 0 ? 0 : 1.5));
            break;
          case K_WAL:
            y += k2 * w;
            break;
          case K_QUALLE:
            if (w < 0) {
              const f = 1 + k2 * 0.2;
              x *= f;
              z *= f;
              y *= 1 - k2 * 0.15;
            } else {
              x += Math.sin(k1 + y * 2.4) * 0.14 * w;
              z += Math.cos(k1 * 0.8 + y * 2.0) * 0.1 * w;
              y += k2 * 0.12;
            }
            break;
          case K_KREBS:
            y += k2 * w;
            break;
          case K_MOEWE:
            y += k2 * w;
            break;
        }
      }
      tPos[o + q3] = e[0] * x + e[4] * y + e[8] * z + e[12];
      tPos[o + q3 + 1] = e[1] * x + e[5] * y + e[9] * z + e[13];
      tPos[o + q3 + 2] = e[2] * x + e[6] * y + e[10] * z + e[14];
      const nx = v.nor[q3];
      const ny = v.nor[q3 + 1];
      const nz = v.nor[q3 + 2];
      tNor[o + q3] = (e[0] * nx + e[4] * ny + e[8] * nz) * inv;
      tNor[o + q3 + 1] = (e[1] * nx + e[5] * ny + e[9] * nz) * inv;
      tNor[o + q3 + 2] = (e[2] * nx + e[6] * ny + e[10] * nz) * inv;
      if (q < v.nSolid) {
        const ox = v.onor[q3];
        const oy = v.onor[q3 + 1];
        const oz = v.onor[q3 + 2];
        tOnor[o + q3] = (e[0] * ox + e[4] * oy + e[8] * oz) * inv;
        tOnor[o + q3 + 1] = (e[1] * ox + e[5] * oy + e[9] * oz) * inv;
        tOnor[o + q3 + 2] = (e[2] * ox + e[6] * oy + e[10] * oz) * inv;
      }
    }
  };

  // === Blasen ============================================================================
  const PER = 6;
  const nQuell = blasenPlatz.length / 3;
  const blasenMat = toonMaterial({ color: 0xc9f6ff, emissive: 0x3a8aa0, emissiveIntensity: 0.6 });
  const blasenGeo = new THREE.IcosahedronGeometry(1, 0);
  const blasen = new THREE.InstancedMesh(blasenGeo, blasenMat, Math.max(1, nQuell * PER));
  blasen.count = nQuell * PER;
  blasen.frustumCulled = false;
  group.add(blasen);
  disposables.push(blasenMat, blasenGeo, blasen);
  const blasenTempo = new Float32Array(Math.max(1, nQuell));
  for (let i = 0; i < nQuell; i++) blasenTempo[i] = 1.1 + rnd() * 0.8;

  // === Lichtbahnen ===========================================================================
  const nLicht = [5, 8, 10][detail];
  const TILE = 150;
  const lichtAnker = new Float32Array(nLicht * 3);
  for (let i = 0; i < nLicht; i++) lichtAnker.set([rnd() * TILE, rnd() * TILE, 2.5 + rnd() * 4], i * 3);
  let licht: THREE.InstancedMesh | null = null;
  {
    // von der Sonne weg geneigt
    const sx = -0.35 * 0.55;
    const sz = -0.3 * 0.55;
    const hiC: RGB = [0.085, 0.11, 0.105];
    const p = (x: number, y: number, z: number): V3 => [x * (1 - y * 0.6) + sx * -y, y, z * (1 - y * 0.6) + sz * -y];
    // zwei gekreuzte Bänder, je drei Spalten: Mitte hell, Ränder schwarz (= unsichtbar bei
    // additiver Mischung), nach unten verlaufend
    const lpos: number[] = [];
    const lcol: number[] = [];
    for (const [ux, uz] of [
      [1, 0],
      [0, 1],
    ]) {
      for (const [x0, x1] of [
        [-0.5, 0],
        [0, 0.5],
      ]) {
        const v = [p(x0 * ux, 0, x0 * uz), p(x1 * ux, 0, x1 * uz), p(x1 * ux, -1, x1 * uz), p(x0 * ux, -1, x0 * uz)];
        const w = [x0 === 0 ? 1 : 0, x1 === 0 ? 1 : 0, 0, 0];
        for (const i of [0, 1, 2, 0, 2, 3]) {
          lpos.push(...v[i]);
          lcol.push(hiC[0] * w[i], hiC[1] * w[i], hiC[2] * w[i]);
        }
      }
    }
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.Float32BufferAttribute(lpos, 3));
    lg.setAttribute('color', new THREE.Float32BufferAttribute(lcol, 3));
    const lm = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false, forceSinglePass: true });
    licht = new THREE.InstancedMesh(lg, lm, nLicht);
    licht.frustumCulled = false;
    licht.renderOrder = 3;
    const c = new THREE.Color(0, 0, 0);
    for (let i = 0; i < nLicht; i++) licht.setColorAt(i, c);
    licht.visible = false;
    group.add(licht);
    disposables.push(lg, lm, licht);
  }

  for (const g of Object.values(G)) g.dispose();

  // --- Hilfsobjekte für update() --------------------------------------------------------
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler(0, 0, 0, 'YXZ');
  const pv = new THREE.Vector3();
  const sv = new THREE.Vector3();
  const cc = new THREE.Color();
  let teilchenT = 0;

  return {
    group,
    update(time: number, dt: number, cam: THREE.Vector3, fx: FxSink): void {
      zeit.value = time;
      const depth = world.depth;

      // --- Fische ---
      if (fishMesh && nFish > 0) {
        for (const s of schwaerme) {
          const a = s.ph + s.w * time;
          const ca = Math.cos(a);
          const sa = Math.sin(a);
          const x = s.cx + s.ax * ca * s.rx - s.az * sa * s.ry;
          const z = s.cz + s.az * ca * s.rx + s.ax * sa * s.ry;
          // Richtung = Ableitung der Bahn
          const sg = s.w >= 0 ? 1 : -1;
          const dx = (-s.ax * sa * s.rx - s.az * ca * s.ry) * sg;
          const dz = (-s.az * sa * s.rx + s.ax * ca * s.ry) * sg;
          const yaw = Math.atan2(dx, dz);
          const cy = Math.cos(yaw);
          const sy = Math.sin(yaw);
          for (let i = 0; i < s.count; i++) {
            const o = (s.first + i) * 6;
            const ph = fishCol[o + 4];
            const ox = fishCol[o] + Math.sin(time * 0.9 + ph) * 0.35;
            const oy = fishCol[o + 1] + Math.sin(time * 1.3 + ph * 2) * 0.25;
            const oz = fishCol[o + 2];
            pv.set(x + ox * cy + oz * sy, s.cy + oy, z - ox * sy + oz * cy);
            e.set(Math.sin(time * 1.3 + ph * 2) * 0.12, yaw + Math.sin(time * 1.7 + ph) * 0.15, 0, 'YXZ');
            q.setFromEuler(e);
            const L = s.len * fishCol[o + 3];
            sv.set(L * s.form[0], L * s.form[1], L * s.form[2]);
            m4.compose(pv, q, sv);
            fishMesh.setMatrixAt(s.first + i, m4);
          }
        }
        fishMesh.instanceMatrix.needsUpdate = true;
      }

      // --- Tiere ---
      for (let i = 0; i < akt.length; i++) {
        const a = akt[i];
        const p = a.p;
        let k1 = 0;
        let k2 = 0;
        switch (a.kind) {
          case K_ROCHEN:
          case K_KROETE:
          case K_WAL:
          case K_MOEWE: {
            const ang = p[5] + p[4] * time;
            const dir = p[4] >= 0 ? 1 : -1;
            const x = p[0] + Math.cos(ang) * p[3];
            const z = p[2] + Math.sin(ang) * p[3];
            const yaw = Math.atan2(-Math.sin(ang) * dir, Math.cos(ang) * dir);
            const bob = a.kind === K_WAL ? Math.sin(time * 0.3 + p[5]) * 1.2 : Math.sin(time * 0.5 + p[5]) * 0.6;
            const bank = a.kind === K_MOEWE ? -0.35 * dir : a.kind === K_ROCHEN ? -0.2 * dir : 0;
            e.set(a.kind === K_WAL ? Math.cos(time * 0.3 + p[5]) * 0.06 : 0, yaw, bank, 'YXZ');
            q.setFromEuler(e);
            m4.compose(pv.set(x, p[1] + bob, z), q, sv.setScalar(p[6]));
            if (a.kind === K_ROCHEN) {
              k1 = time * 1.5 + p[5];
              k2 = 0.55;
            } else if (a.kind === K_KROETE) {
              k1 = time * 1.6 + p[5];
              k2 = 0.35;
            } else if (a.kind === K_WAL) {
              k2 = Math.sin(time * 0.7 + p[5]) * 1.3;
            } else {
              const flap = smooth((Math.sin(time * 0.6 + p[5]) + 0.2) * 2.5);
              k2 = (0.12 + flap * Math.sin(time * 9 + p[5]) * 0.55) * 1;
            }
            break;
          }
          case K_QUALLE: {
            const per = p[4];
            const u = 0.5 - 0.5 * Math.cos(((time + p[5] * per) / per) * TAU);
            const y = p[1] + (p[3] - p[1]) * u;
            const pulse = Math.max(0, Math.sin(time * 2.4 + p[5] * 3));
            e.set(Math.sin(time * 0.4 + p[5]) * 0.12, p[5], Math.cos(time * 0.35 + p[5]) * 0.12, 'YXZ');
            q.setFromEuler(e);
            m4.compose(pv.set(p[0] + Math.sin(time * 0.15 + p[5]) * 2, y, p[2] + Math.cos(time * 0.12 + p[5]) * 2), q, sv.setScalar(p[6]));
            k1 = time * 2 + p[5];
            k2 = pulse;
            break;
          }
          case K_KREBS: {
            // seitwärts hin und her, mit Pausen
            const c = Math.sin(time * 0.6 + p[4]);
            const step = Math.sign(c) * Math.pow(Math.abs(c), 0.5) * 0.5;
            const yaw = p[3];
            e.set(0, yaw, 0, 'YXZ');
            q.setFromEuler(e);
            m4.compose(pv.set(p[0] + Math.cos(yaw) * step, p[1], p[2] - Math.sin(yaw) * step), q, sv.setScalar(p[5]));
            k2 = Math.max(0, Math.sin(time * 3 + p[4])) * 0.12;
            break;
          }
          default: {
            // Boote und Bojen schaukeln
            const ph = p[4];
            e.set(Math.sin(time * 1.3 + ph) * 0.08, p[3], Math.sin(time * 1.05 + ph * 1.7) * 0.1, 'YXZ');
            q.setFromEuler(e);
            m4.compose(pv.set(p[0], p[1] - 0.2 + Math.sin(time * 1.6 + ph) * 0.18, p[2]), q, sv.setScalar(p[5]));
          }
        }
        setze(i, m4, k1, k2);
      }
      if (akt.length > 0) {
        posAttr.needsUpdate = true;
        norAttr.needsUpdate = true;
        onorAttr.needsUpdate = true;
      }

      // --- Blasen ---
      for (let s = 0; s < nQuell; s++) {
        const x0 = blasenPlatz[s * 3];
        const y0 = blasenPlatz[s * 3 + 1];
        const z0 = blasenPlatz[s * 3 + 2];
        const len = Math.max(1, sea - 0.3 - y0);
        for (let j = 0; j < PER; j++) {
          const u = (time * blasenTempo[s] / len + j / PER + s * 0.37) % 1;
          const y = y0 + u * len;
          const r = (0.12 + 0.22 * u) * smooth(u / 0.05) * smooth((1 - u) / 0.04);
          pv.set(x0 + Math.sin(time * 3 + j * 2 + s) * 0.18 * u, y, z0 + Math.cos(time * 2.6 + j * 1.7) * 0.18 * u);
          e.set(0, 0, 0, 'YXZ');
          q.setFromEuler(e);
          m4.compose(pv, q, sv.set(r, r * 0.85, r));
          blasen.setMatrixAt(s * PER + j, m4);
        }
      }
      if (nQuell > 0) blasen.instanceMatrix.needsUpdate = true;

      // --- Lichtbahnen (nur unter Wasser) ---
      if (licht) {
        licht.visible = depth > 0.02;
        if (licht.visible) {
          for (let i = 0; i < nLicht; i++) {
            const o = i * 3;
            const ax = lichtAnker[o] + Math.sin(time * 0.05 + i) * 6;
            const az = lichtAnker[o + 1] + Math.cos(time * 0.04 + i * 1.3) * 6;
            const x = cam.x + (((ax - cam.x) % TILE) + TILE * 1.5) % TILE - TILE / 2;
            const z = cam.z + (((az - cam.z) % TILE) + TILE * 1.5) % TILE - TILE / 2;
            const d = Math.hypot(x - cam.x, z - cam.z);
            const w = lichtAnker[o + 2];
            // Nie über der Fahrbahn: der Schacht (unten bis 1,6 w breit, dazu die Neigung) bleibt neben der Strecke.
            const frei = d < TILE / 2 ? kante(x, z) - RAND - w * 0.9 - 6 : 0;
            const f = smooth((TILE / 2 - d) / 25) * smooth((d - 8) / 12) * smooth(frei / 6) * depth * (0.65 + 0.35 * Math.sin(time * 0.35 + i * 2.1));
            e.set(0, i * 0.7, 0, 'YXZ');
            q.setFromEuler(e);
            m4.compose(pv.set(x, sea - 0.2, z), q, sv.set(f > 0 ? w : 0, 24, f > 0 ? w : 0));
            licht.setMatrixAt(i, m4);
            licht.setColorAt(i, cc.setRGB(f, f, f));
          }
          licht.instanceMatrix.needsUpdate = true;
          if (licht.instanceColor) licht.instanceColor.needsUpdate = true;
        }
      }

      // --- Leuchtendes pulsiert sacht ---
      glowMat.color.setScalar(0.82 + 0.18 * Math.sin(time * 1.7));

      // --- Schwebteilchen in Kameranähe (nur hohe Qualität, nur unter Wasser) ---
      if (detail === 2 && depth > 0.5) {
        teilchenT -= dt;
        while (teilchenT <= 0) {
          teilchenT += 0.07;
          const a = rnd() * TAU;
          const r = 3 + rnd() * 11;
          fx.spark(cam.x + Math.cos(a) * r, cam.y + (rnd() - 0.4) * 6, cam.z + Math.sin(a) * r, (rnd() - 0.5) * 0.3, 0.05 + rnd() * 0.15, (rnd() - 0.5) * 0.3, 2.2 + rnd() * 1.5, 0.07 + rnd() * 0.08, rnd() < 0.7 ? 0xd8fff2 : 0xfff6c8, 0);
        }
      }
    },
    dispose(): void {
      for (const d of disposables) d.dispose();
    },
  };
}
