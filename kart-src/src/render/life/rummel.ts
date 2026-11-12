// Kulisse des Achterbahn-Rummels: ein Jahrmarkt am frühen Abend.
//
// Über dem Festplatz steht das Eingangstor mit der Leuchtschrift „RUMMEL“, daneben
// Tribüne, Fahnen, Kassenhäuschen und Zuschauer mit Luftballons und Zuckerwatte.
// Mitten im Platz dreht sich langsam das Riesenrad, ringsum Festzelte, Buden und
// Lichterketten. Am Lifthügel liegt draußen der Rand des Rummels (Zaun, Wohnwagen,
// Bäume, dahinter die Stadt mit erleuchteten Fenstern). Unter der großen Abfahrt
// fliegen die Sitze des Kettenkarussells, daneben Zirkuszelt und Tretbootteich; in
// der Steilkurve dreht sich ein Karussell mit eigenen Tieren, Zuschauer sehen vom
// Hügel zur Bahn hinauf. Nach der Bremsstrecke: Autoscooter-Halle und Losbuden,
// dann das schiefe Geisterhaus um die Röhre und die Budengasse zurück zum Start.
//
// Licht ohne Lichtquellen: alle Glühbirnen sind kleine unbeleuchtete Körper
// (MeshBasicMaterial), der Schein darum additive Scheiben, deren Rand schwarz ist –
// so läuft er ohne Textur weich aus. Lauflichter schalten höchstens 2,5-mal je
// Sekunde weiter, und immer nur ein Teil der Birnen zugleich.
//
// Technik (harte Vorgabe, siehe toon.ts): nur Eckenfarben, Toon-Material mit
// Kontur, MeshBasicMaterial und Netze, deren Ecken je Bild aus einer Grundform und
// der Lage jedes Teils neu berechnet werden – keine eigenen Shader, keine
// Texturen, keine Lichtquellen. Alles Sichtbare ist eine reine Funktion der Zeit;
// im Lauf wird nichts angelegt.

import * as THREE from 'three';
import { EDGE_DECK, EDGE_TUNNEL, rightX, rightZ } from '../../game/track';
import { MeshBuilder, mixRgb, seeded, shade, smooth, type RGB, type V3 } from '../build';
import type { Life } from '../life';
import { addSmoothNormals, outlineMaterial, rgb, toonMaterial } from '../toon';
import { TUNNEL_H, type World } from '../world';

// --- Farben -------------------------------------------------------------------------
const RED = rgb(0xe2483a);
const RED_D = rgb(0x9a2433);
const WHITE = rgb(0xf6f0dc);
const TURQ = rgb(0x2ec4b6);
const PINK = rgb(0xff6fa8);
const VIOLET = rgb(0x8a5ad8);
const BLUE = rgb(0x3f7fd6);
const ORANGE = rgb(0xff8a3a);
const MINT = rgb(0x7fe0a0);
const WOOD = rgb(0x9a6a42);
const WOOD_D = rgb(0x6a4a30);
const DARK = rgb(0x2a2638);
const METAL = rgb(0xd8dce6);
const SKIN = [rgb(0xf2c8a0), rgb(0xd9a070), rgb(0x9a6440), rgb(0xf6d8b8)];
const CLOTH = [RED, TURQ, PINK, VIOLET, BLUE, ORANGE, MINT, WHITE, rgb(0x4a8a5a)];
const BRIGHT = [RED, TURQ, PINK, VIOLET, BLUE, ORANGE, MINT];
/** Glühbirnen: warmes Lichterketten-Weiß und bunte. */
const BULB = rgb(0xfff0c4);
const BULB_COL = [rgb(0xff7a9a), rgb(0x7ff0e8), rgb(0xffb070), rgb(0xd0a0ff), BULB];

// --- Bausteine ---------------------------------------------------------------------

/** Zeichnet in einem lokalen Rahmen (Ursprung, Drehung um die Hochachse) in einen MeshBuilder. */
class Kit {
  ox = 0;
  oy = 0;
  oz = 0;
  c = 1;
  s = 0;
  constructor(readonly mb: MeshBuilder) {}
  at(x: number, y: number, z: number, yaw = 0): this {
    this.ox = x;
    this.oy = y;
    this.oz = z;
    this.c = Math.cos(yaw);
    this.s = Math.sin(yaw);
    return this;
  }
  p(x: number, y: number, z: number): V3 {
    return [this.ox + x * this.c + z * this.s, this.oy + y, this.oz - x * this.s + z * this.c];
  }
  /** Dreieck, das von ref weg zeigt (Punkte in Weltlage). */
  to(a: V3, b: V3, c: V3, col: RGB, ref: V3): void {
    const ux = b[0] - a[0];
    const uy = b[1] - a[1];
    const uz = b[2] - a[2];
    const vx = c[0] - a[0];
    const vy = c[1] - a[1];
    const vz = c[2] - a[2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    const mx = (a[0] + b[0] + c[0]) / 3 - ref[0];
    const my = (a[1] + b[1] + c[1]) / 3 - ref[1];
    const mz = (a[2] + b[2] + c[2]) / 3 - ref[2];
    if (nx * mx + ny * my + nz * mz >= 0) this.mb.tri(a, b, c, col);
    else this.mb.tri(a, c, b, col);
  }
  qo(a: V3, b: V3, c: V3, d: V3, col: RGB, ref: V3): void {
    this.to(a, b, c, col, ref);
    this.to(a, c, d, col, ref);
  }
  /** Fläche in lokalen Koordinaten, gegen den Uhrzeigersinn von der sichtbaren Seite. */
  quad(a: V3, b: V3, c: V3, d: V3, col: RGB): void {
    this.mb.quad(this.p(a[0], a[1], a[2]), this.p(b[0], b[1], b[2]), this.p(c[0], c[1], c[2]), this.p(d[0], d[1], d[2]), col);
  }
  /** Beidseitige Fläche (Fahnen, Wimpel, Markisenkanten). */
  quad2(a: V3, b: V3, c: V3, d: V3, col: RGB, back?: RGB): void {
    this.quad(a, b, c, d, col);
    this.quad(d, c, b, a, back ?? col);
  }
  tri(a: V3, b: V3, c: V3, col: RGB): void {
    this.mb.tri(this.p(a[0], a[1], a[2]), this.p(b[0], b[1], b[2]), this.p(c[0], c[1], c[2]), col);
  }
  tri2(a: V3, b: V3, c: V3, col: RGB): void {
    this.mb.tri(this.p(a[0], a[1], a[2]), this.p(b[0], b[1], b[2]), this.p(c[0], c[1], c[2]), col);
    this.mb.tri(this.p(a[0], a[1], a[2]), this.p(c[0], c[1], c[2]), this.p(b[0], b[1], b[2]), col);
  }
  /** Quader (ohne Boden), lokal um rot gedreht. */
  box(cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, col: RGB, top?: RGB, rot = 0): void {
    const c = Math.cos(rot);
    const s = Math.sin(rot);
    const hx = sx / 2;
    const hy = sy / 2;
    const hz = sz / 2;
    const q = (x: number, y: number, z: number): V3 => this.p(cx + x * c + z * s, cy + y, cz - x * s + z * c);
    const v = [q(-hx, -hy, -hz), q(hx, -hy, -hz), q(hx, hy, -hz), q(-hx, hy, -hz), q(-hx, -hy, hz), q(hx, -hy, hz), q(hx, hy, hz), q(-hx, hy, hz)];
    const ref = this.p(cx, cy, cz);
    this.qo(v[4], v[5], v[6], v[7], col, ref);
    this.qo(v[1], v[0], v[3], v[2], col, ref);
    this.qo(v[5], v[1], v[2], v[6], col, ref);
    this.qo(v[0], v[4], v[7], v[3], col, ref);
    this.qo(v[7], v[6], v[2], v[3], top ?? col, ref);
  }
  /** Prisma bzw. Kegelstumpf mit n Seiten (ohne Boden); colB färbt jede zweite Seite. */
  prism(cx: number, y0: number, cz: number, r0: number, r1: number, h: number, n: number, col: RGB, colB?: RGB, top?: RGB | null, rot = 0): void {
    const ref = this.p(cx, y0 + h * 0.4, cz);
    const pt = (k: number, r: number, y: number): V3 => {
      const a = rot + (k / n) * Math.PI * 2;
      return this.p(cx + Math.cos(a) * r, y, cz + Math.sin(a) * r);
    };
    const tc = this.p(cx, y0 + h, cz);
    for (let k = 0; k < n; k++) {
      const cc = colB && k % 2 === 1 ? colB : col;
      if (r1 > 0.001) this.qo(pt(k, r0, y0), pt(k + 1, r0, y0), pt(k + 1, r1, y0 + h), pt(k, r1, y0 + h), cc, ref);
      else this.to(pt(k, r0, y0), pt(k + 1, r0, y0), tc, cc, ref);
      if (r1 > 0.001 && top !== null) this.to(pt(k, r1, y0 + h), pt(k + 1, r1, y0 + h), tc, top ?? cc, this.p(cx, y0 + h - 1, cz));
    }
  }
  /** Balken von a nach b (lokal) mit quadratischem Querschnitt w. */
  beam(a: V3, b: V3, w: number, col: RGB): void {
    const A = this.p(a[0], a[1], a[2]);
    const B = this.p(b[0], b[1], b[2]);
    let dx = B[0] - A[0];
    let dy = B[1] - A[1];
    let dz = B[2] - A[2];
    const l = Math.hypot(dx, dy, dz) || 1;
    dx /= l;
    dy /= l;
    dz /= l;
    // e1 = d × oben (bzw. × x bei senkrechten Balken), e2 = e1 × d
    let ex = -dz;
    let ey = 0;
    let ez = dx;
    if (Math.hypot(ex, ez) < 0.1) {
      ex = 0;
      ey = dz;
      ez = -dy;
    }
    const el = Math.hypot(ex, ey, ez);
    ex *= w / 2 / el;
    ey *= w / 2 / el;
    ez *= w / 2 / el;
    const fx = ey * dz - ez * dy;
    const fy = ez * dx - ex * dz;
    const fz = ex * dy - ey * dx;
    const corner = (P: V3, s1: number, s2: number): V3 => [P[0] + ex * s1 + fx * s2, P[1] + ey * s1 + fy * s2, P[2] + ez * s1 + fz * s2];
    const ref: V3 = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2, (A[2] + B[2]) / 2];
    const S: [number, number][] = [
      [1, 1],
      [-1, 1],
      [-1, -1],
      [1, -1],
    ];
    for (let k = 0; k < 4; k++) {
      const [a1, a2] = S[k];
      const [b1, b2] = S[(k + 1) % 4];
      this.qo(corner(A, a1, a2), corner(A, b1, b2), corner(B, b1, b2), corner(B, a1, a2), col, ref);
    }
  }
  /** Achtflächner (Köpfe, Ballons, Baumkronen). */
  octa(cx: number, cy: number, cz: number, rx: number, ry: number, rz: number, col: RGB, low?: RGB): void {
    const ref = this.p(cx, cy, cz);
    const T = this.p(cx, cy + ry, cz);
    const D = this.p(cx, cy - ry, cz);
    const ring = [this.p(cx + rx, cy, cz), this.p(cx, cy, cz + rz), this.p(cx - rx, cy, cz), this.p(cx, cy, cz - rz)];
    for (let k = 0; k < 4; k++) {
      this.to(ring[k], ring[(k + 1) % 4], T, col, ref);
      this.to(ring[k], ring[(k + 1) % 4], D, low ?? col, ref);
    }
  }
}

/** Teile, die sich bewegen: ein Netz, dessen Ecken je Bild aus Grundform und Lage neu entstehen. */
class Moving {
  private readonly geos: THREE.BufferGeometry[] = [];
  /** Je Teil: Art des Flatterns (0 keins, 1 Fahne längs x, 2 Flügelschlag), Stärke, Takt, Phase. */
  private readonly waveP: number[] = [];
  starts: Int32Array = new Int32Array(0);
  counts: Int32Array = new Int32Array(0);
  mats: Float32Array = new Float32Array(0);
  geometry = new THREE.BufferGeometry();
  private bp = new Float32Array(0);
  private bn = new Float32Array(0);
  private bo = new Float32Array(0);
  get parts(): number {
    return this.geos.length;
  }
  add(mb: MeshBuilder, wave = 0, amp = 0, freq = 0, ph = 0): number {
    const g = mb.build();
    addSmoothNormals(g);
    this.geos.push(g);
    this.waveP.push(wave, amp, freq, ph);
    return this.geos.length - 1;
  }
  build(): THREE.BufferGeometry {
    let n = 0;
    const np = this.geos.length;
    this.starts = new Int32Array(np);
    this.counts = new Int32Array(np);
    for (let k = 0; k < np; k++) {
      this.starts[k] = n;
      this.counts[k] = this.geos[k].getAttribute('position').count;
      n += this.counts[k];
    }
    this.bp = new Float32Array(n * 3);
    this.bn = new Float32Array(n * 3);
    this.bo = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    for (let k = 0; k < np; k++) {
      const g = this.geos[k];
      const o = this.starts[k] * 3;
      this.bp.set(g.getAttribute('position').array as Float32Array, o);
      this.bn.set(g.getAttribute('normal').array as Float32Array, o);
      this.bo.set(g.getAttribute('onormal').array as Float32Array, o);
      col.set(g.getAttribute('color').array as Float32Array, o);
      g.dispose();
    }
    const pos = new THREE.BufferAttribute(new Float32Array(n * 3), 3);
    const nor = new THREE.BufferAttribute(new Float32Array(n * 3), 3);
    const onr = new THREE.BufferAttribute(new Float32Array(n * 3), 3);
    pos.setUsage(THREE.DynamicDrawUsage);
    nor.setUsage(THREE.DynamicDrawUsage);
    onr.setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute('position', pos);
    this.geometry.setAttribute('normal', nor);
    this.geometry.setAttribute('onormal', onr);
    this.geometry.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    this.mats = new Float32Array(np * 16);
    for (let k = 0; k < np; k++) this.mats.set(IDENT, k * 16);
    return this.geometry;
  }
  set(part: number, m: THREE.Matrix4): void {
    this.mats.set(m.elements, part * 16);
  }
  update(time: number): void {
    const P = this.geometry.getAttribute('position') as THREE.BufferAttribute;
    const N = this.geometry.getAttribute('normal') as THREE.BufferAttribute;
    const O = this.geometry.getAttribute('onormal') as THREE.BufferAttribute;
    const pa = P.array as Float32Array;
    const na = N.array as Float32Array;
    const oa = O.array as Float32Array;
    const bp = this.bp;
    const bn = this.bn;
    const bo = this.bo;
    for (let k = 0; k < this.starts.length; k++) {
      const e = this.mats;
      const m = k * 16;
      const wave = this.waveP[k * 4];
      const amp = this.waveP[k * 4 + 1];
      const wt = time * this.waveP[k * 4 + 2] + this.waveP[k * 4 + 3];
      const end = (this.starts[k] + this.counts[k]) * 3;
      for (let i = this.starts[k] * 3; i < end; i += 3) {
        let x = bp[i];
        let y = bp[i + 1];
        let z = bp[i + 2];
        if (wave === 1) z += amp * x * Math.sin(wt - x * 1.1);
        else if (wave === 2) y += amp * Math.abs(x) * Math.sin(wt);
        pa[i] = e[m] * x + e[m + 4] * y + e[m + 8] * z + e[m + 12];
        pa[i + 1] = e[m + 1] * x + e[m + 5] * y + e[m + 9] * z + e[m + 13];
        pa[i + 2] = e[m + 2] * x + e[m + 6] * y + e[m + 10] * z + e[m + 14];
        x = bn[i];
        y = bn[i + 1];
        z = bn[i + 2];
        na[i] = e[m] * x + e[m + 4] * y + e[m + 8] * z;
        na[i + 1] = e[m + 1] * x + e[m + 5] * y + e[m + 9] * z;
        na[i + 2] = e[m + 2] * x + e[m + 6] * y + e[m + 10] * z;
        x = bo[i];
        y = bo[i + 1];
        z = bo[i + 2];
        oa[i] = e[m] * x + e[m + 4] * y + e[m + 8] * z;
        oa[i + 1] = e[m + 1] * x + e[m + 5] * y + e[m + 9] * z;
        oa[i + 2] = e[m + 2] * x + e[m + 6] * y + e[m + 10] * z;
      }
    }
    P.needsUpdate = true;
    N.needsUpdate = true;
    O.needsUpdate = true;
  }
}

const IDENT = new THREE.Matrix4().elements;

interface LPart {
  pos: number[];
  col: number[];
  /** Je Ecke: Lauflicht-Gruppe (0 ruhig, 1 dreiphasig, 2 im Wechsel) und Phase. */
  grp: number[];
  idx: number[];
  moving: boolean;
  start: number;
  count: number;
}

/**
 * Glühbirnen und Schein: kleine Vierflächner bzw. Scheiben mit Eckenfarben, ohne
 * Beleuchtung. Teile können bewegt werden (Riesenrad, Karussell, Augen) und eine
 * eigene Helligkeit haben (Glocke, Feuerwerk).
 */
class Lights {
  readonly parts: LPart[] = [];
  private cur: LPart;
  geometry = new THREE.BufferGeometry();
  bright: Float32Array = new Float32Array(0);
  private bp = new Float32Array(0);
  private bc = new Float32Array(0);
  private bg = new Uint8Array(0);
  private movingVerts = 0;
  private step = -1;
  constructor() {
    this.cur = this.newPart(false);
  }
  private newPart(moving: boolean): LPart {
    const p: LPart = { pos: [], col: [], grp: [], idx: [], moving, start: 0, count: 0 };
    this.parts.push(p);
    return p;
  }
  part(moving = true): number {
    this.cur = this.newPart(moving);
    return this.parts.length - 1;
  }
  use(id: number): void {
    this.cur = this.parts[id];
  }
  private v(x: number, y: number, z: number, c: RGB, grp: number): number {
    const p = this.cur;
    p.pos.push(x, y, z);
    p.col.push(c[0], c[1], c[2]);
    p.grp.push(grp);
    return p.pos.length / 3 - 1;
  }
  /** Birne: Vierflächner der Größe s (von allen Seiten sichtbar). grp: 0 ruhig, 1–3 Lauflicht-Phase, 4–5 Wechsel. */
  bulb(x: number, y: number, z: number, s: number, c: RGB, grp = 0): void {
    const a = this.v(x, y + s, z, c, grp);
    const b = this.v(x + s * 0.94, y - s / 3, z, c, grp);
    const d = this.v(x - s * 0.47, y - s / 3, z + s * 0.82, c, grp);
    const e = this.v(x - s * 0.47, y - s / 3, z - s * 0.82, c, grp);
    this.cur.idx.push(a, b, d, a, d, e, a, e, b, b, e, d);
  }
  /** Scheibe in der Ebene (u, w) um (x, y, z) mit Radius r; Rand in rim (Schwarz = weicher Schein). */
  disc(x: number, y: number, z: number, u: V3, w: V3, r: number, c: RGB, rim: RGB, grp = 0, n = 8, ry = r): void {
    const m = this.v(x, y, z, c, grp);
    const first = this.cur.pos.length / 3;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      const ca = Math.cos(a) * r;
      const sa = Math.sin(a) * ry;
      this.v(x + u[0] * ca + w[0] * sa, y + u[1] * ca + w[1] * sa, z + u[2] * ca + w[2] * sa, rim, grp);
    }
    for (let k = 0; k < n; k++) this.cur.idx.push(m, first + k, first + ((k + 1) % n));
  }
  get empty(): boolean {
    return this.parts.every((p) => p.pos.length === 0);
  }
  build(): THREE.BufferGeometry {
    const order = [...this.parts.filter((p) => p.moving), ...this.parts.filter((p) => !p.moving)];
    let n = 0;
    let ni = 0;
    for (const p of order) {
      p.start = n;
      p.count = p.pos.length / 3;
      n += p.count;
      ni += p.idx.length;
      if (p.moving) this.movingVerts = n;
    }
    this.bp = new Float32Array(n * 3);
    this.bc = new Float32Array(n * 3);
    this.bg = new Uint8Array(n);
    const idx = n > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
    let ii = 0;
    for (const p of order) {
      this.bp.set(p.pos, p.start * 3);
      this.bc.set(p.col, p.start * 3);
      this.bg.set(p.grp, p.start);
      for (const k of p.idx) idx[ii++] = k + p.start;
    }
    const pos = new THREE.BufferAttribute(new Float32Array(this.bp), 3);
    pos.setUsage(THREE.DynamicDrawUsage);
    const col = new THREE.BufferAttribute(new Float32Array(this.bc), 3);
    col.setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute('position', pos);
    this.geometry.setAttribute('color', col);
    this.geometry.setIndex(new THREE.BufferAttribute(idx, 1));
    this.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    this.bright = new Float32Array(this.parts.length).fill(1);
    for (const p of this.parts) {
      p.pos.length = 0;
      p.col.length = 0;
      p.grp.length = 0;
      p.idx.length = 0;
    }
    return this.geometry;
  }
  /** Lage eines bewegten Teils. */
  set(part: number, m: THREE.Matrix4): void {
    const p = this.parts[part];
    const e = m.elements;
    const a = this.geometry.getAttribute('position').array as Float32Array;
    const bp = this.bp;
    for (let i = p.start * 3, end = (p.start + p.count) * 3; i < end; i += 3) {
      const x = bp[i];
      const y = bp[i + 1];
      const z = bp[i + 2];
      a[i] = e[0] * x + e[4] * y + e[8] * z + e[12];
      a[i + 1] = e[1] * x + e[5] * y + e[9] * z + e[13];
      a[i + 2] = e[2] * x + e[6] * y + e[10] * z + e[14];
    }
  }
  /** Nach set(): bewegte Ecken hochladen. */
  flush(): void {
    const P = this.geometry.getAttribute('position') as THREE.BufferAttribute;
    P.clearUpdateRanges();
    P.addUpdateRange(0, this.movingVerts * 3);
    P.needsUpdate = true;
  }
  private paint(p: LPart, step: number, out: Float32Array): void {
    const b = this.bright[this.parts.indexOf(p)];
    this.paintRange(p.start, p.count, b, step, out);
  }
  private paintRange(start: number, count: number, b: number, step: number, out: Float32Array): void {
    const bc = this.bc;
    const bg = this.bg;
    for (let v = start; v < start + count; v++) {
      const g = bg[v];
      let f = b;
      if (g >= 1 && g <= 3) f *= (g + step) % 3 === 0 ? 1 : 0.32;
      else if (g >= 4) f *= (g + step) % 2 === 0 ? 1 : 0.4;
      out[v * 3] = bc[v * 3] * f;
      out[v * 3 + 1] = bc[v * 3 + 1] * f;
      out[v * 3 + 2] = bc[v * 3 + 2] * f;
    }
  }
  /** Lauflichter weiterschalten (nur wenn der Schritt wechselt) und Teile mit eigener Helligkeit nachfärben. */
  recolor(step: number, live: Int32Array, nLive: number): void {
    const C = this.geometry.getAttribute('color') as THREE.BufferAttribute;
    const out = C.array as Float32Array;
    if (step !== this.step) {
      this.step = step;
      for (let k = 0; k < this.parts.length; k++) {
        const p = this.parts[k];
        this.paintRange(p.start, p.count, this.bright[k], step, out);
      }
      C.clearUpdateRanges();
      C.needsUpdate = true;
      return;
    }
    if (nLive === 0) return;
    C.clearUpdateRanges();
    for (let k = 0; k < nLive; k++) {
      const p = this.parts[live[k]];
      this.paintRange(p.start, p.count, this.bright[live[k]], step, out);
      C.addUpdateRange(p.start * 3, p.count * 3);
    }
    C.needsUpdate = true;
  }
  /** (nur für paint – nicht im Lauf benutzt) */
  repaintAll(step: number): void {
    const out = this.geometry.getAttribute('color').array as Float32Array;
    for (const p of this.parts) this.paint(p, step, out);
  }
}

// --- Leuchtschrift (5 × 7 Punkte) ---------------------------------------------------
const FONT: Record<string, string[]> = {
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
};

export function buildRummelLife(world: World): Life {
  const t = world.track;
  const group = new THREE.Group();
  const disposables: { dispose(): void }[] = [];
  const detail = world.detail;
  const hi = detail > 0;
  const rnd = seeded(9100 + t.index * 37);
  const toon = toonMaterial({ vertexColors: true });
  disposables.push(toon);

  const nearB = new MeshBuilder();
  const farB = new MeshBuilder();
  const near = new Kit(nearB);
  const far = new Kit(farB);
  const mov = new Moving();
  /** Kleine bewegte Teile ohne Kontur (Ballons, Arme, Fahnen, Sitze …). */
  const small = new Moving();
  const lights = new Lights();
  const glow = new Lights();
  /** Teile der Lichter mit eigener, je Bild wechselnder Helligkeit. */
  const liveL: number[] = [];
  const liveG: number[] = [];

  // --- Strecke: Abstände --------------------------------------------------------------
  const sx: number[] = [];
  const sz: number[] = [];
  const sw: number[] = [];
  const sd: number[] = [];
  for (let i = 0; i < t.total; i += 2) {
    sx.push(t.px[i]);
    sz.push(t.pz[i]);
    const deck = (t.edge[i] & EDGE_DECK) !== 0;
    sw.push(t.wh[i] + (t.edge[i] & EDGE_TUNNEL ? 7 : 0));
    sd.push(deck ? 1 : 0);
  }
  /** Ist um (x, z) im Radius r Platz? (3 m neben der Bande, 8 m neben der Deckkante) */
  const free = (x: number, z: number, r: number): boolean => {
    for (let k = 0; k < sx.length; k++) {
      const d = Math.hypot(x - sx[k], z - sz[k]) - sw[k] - r;
      if (d < (sd[k] ? 8 : 3)) return false;
    }
    return true;
  };
  const ground = (x: number, z: number): number => world.heightAt(x, z);
  /** Punkt neben der Strecke: Abschnitt i, seitlich lat (rechts positiv). */
  const LX = (i: number, lat: number): number => t.px[i] + rightX(t, i) * lat;
  const LZ = (i: number, lat: number): number => t.pz[i] + rightZ(t, i) * lat;
  /** Drehung, mit der lokales +z in Fahrtrichtung zeigt (lokales +x zeigt dann nach links). */
  const yawAt = (i: number): number => Math.atan2(t.tx[i], t.tz[i]);
  /** Drehung, mit der lokales +z von (x, z) zur Fahrbahnmitte von i zeigt. */
  const faceRoad = (i: number, x: number, z: number): number => Math.atan2(t.px[i] - x, t.pz[i] - z);

  const m4 = new THREE.Matrix4();
  const m5 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler(0, 0, 0, 'YXZ');
  const v = new THREE.Vector3();
  const sc = new THREE.Vector3(1, 1, 1);

  // --- Kleine Bausteine -----------------------------------------------------------------

  /** Mensch (lokal am Boden, Blick nach +z), gut 1,75 m groß. */
  const person = (k: Kit, x: number, y: number, z: number, size = 1): void => {
    const cloth = CLOTH[Math.floor(rnd() * CLOTH.length)];
    const skin = SKIN[Math.floor(rnd() * SKIN.length)];
    const s = size;
    k.prism(x, y, z, 0.17 * s, 0.29 * s, 1.45 * s, 4, cloth, undefined, null, Math.PI / 4);
    k.octa(x, y + 1.62 * s, z, 0.17 * s, 0.2 * s, 0.17 * s, skin, skin);
  };

  /** Luftballon samt Schnur als bewegtes Teil; Lage setzt update(). */
  const balloons: number[] = []; // Teil, x, y, z, Phase
  const balloonGeo = (c: RGB): MeshBuilder => {
    const mb = new MeshBuilder();
    const k = new Kit(mb);
    k.octa(0, 1.45, 0, 0.36, 0.44, 0.36, c, shade(c, 0.8));
    k.beam([0, 0, 0], [0, 1.02, 0], 0.03, rgb(0xeeeeee));
    return mb;
  };
  const addBalloon = (x: number, y: number, z: number): void => {
    const c = BRIGHT[Math.floor(rnd() * BRIGHT.length)];
    balloons.push(small.add(balloonGeo(c)), x, y, z, rnd() * 10);
  };

  /** Winkende Arme: Teil, Schulter x, y, z, Drehung, Phase. */
  const arms: number[] = [];
  const armGeo = (c: RGB): MeshBuilder => {
    const mb = new MeshBuilder();
    new Kit(mb).beam([0, 0, 0], [0, 0.72, 0], 0.13, c);
    return mb;
  };

  /** Mensch mit Zubehör: Ballon, Zuckerwatte oder winkender Arm. */
  const visitor = (k: Kit, x: number, y: number, z: number, yaw: number, extra: number): void => {
    k.at(x, y, z, yaw);
    person(k, 0, 0, 0);
    if (extra < 0.18 && balloons.length < 34 * 5) {
      // Ballon an der Hand (rechts)
      const hx = x + Math.cos(yaw) * -0.32;
      const hz = z - Math.sin(yaw) * -0.32;
      addBalloon(hx, y + 1.15, hz);
    } else if (extra < 0.3) {
      // Zuckerwatte
      k.beam([-0.3, 1.0, 0.2], [-0.3, 1.45, 0.25], 0.04, WHITE);
      k.octa(-0.3, 1.62, 0.25, 0.2, 0.2, 0.2, rgb(0xff9cc8));
    } else if (extra < 0.45 && arms.length < 30 * 6) {
      const sx0 = x + Math.cos(yaw) * 0.32;
      const sz0 = z - Math.sin(yaw) * 0.32;
      arms.push(small.add(armGeo(SKIN[Math.floor(rnd() * 4)])), sx0, y + 1.38, sz0, yaw, rnd() * 10);
    }
  };

  /** Fahne an einem Mast: Teil, x, y, z, Drehung. */
  const flags: number[] = [];
  const flagGeo = (a: RGB, b: RGB, w = 2.4, h = 1.4): MeshBuilder => {
    const mb = new MeshBuilder();
    const k = new Kit(mb);
    const n = 4;
    for (let s = 0; s < n; s++) {
      const x0 = (s / n) * w;
      const x1 = ((s + 1) / n) * w;
      const c = s % 2 === 0 ? a : b;
      k.quad2([x0, -h, 0], [x1, -h, 0], [x1, 0, 0], [x0, 0, 0], c);
    }
    return mb;
  };
  const flagPole = (k: Kit, x: number, y: number, z: number, h: number, a: RGB, b: RGB, yaw: number): void => {
    k.at(x, y, z, 0);
    k.prism(0, -0.5, 0, 0.12, 0.09, h + 0.5, 4, WHITE);
    k.octa(0, h + 0.15, 0, 0.18, 0.18, 0.18, RED);
    flags.push(small.add(flagGeo(a, b), 1, 0.16, 3 + rnd(), rnd() * 6), x, y + h - 0.1, z, yaw);
  };

  /** Lichterkette zwischen zwei Punkten, mit Durchhang. */
  const chain = (a: V3, b: V3, sag: number, step: number, cols: RGB[], chase: boolean): void => {
    const l = Math.hypot(b[0] - a[0], b[2] - a[2], b[1] - a[1]);
    const n = Math.max(2, Math.round(l / (step * (hi ? 1 : 1.35))));
    for (let k = 1; k < n; k++) {
      const f = k / n;
      const y = a[1] + (b[1] - a[1]) * f - sag * 4 * f * (1 - f);
      lights.bulb(a[0] + (b[0] - a[0]) * f, y, a[2] + (b[2] - a[2]) * f, 0.2, cols[k % cols.length], chase ? 1 + (k % 3) : 0);
    }
  };
  /** Mast für Lichterketten. */
  const mast = (x: number, z: number, h: number): V3 => {
    const y = ground(x, z);
    far.at(x, y, z, 0);
    far.prism(0, -0.4, 0, 0.16, 0.12, h + 0.4, 4, rgb(0x5a5a6a));
    far.octa(0, h + 0.1, 0, 0.2, 0.2, 0.2, RED);
    return [x, y + h, z];
  };

  /** Glühbirnen entlang einer Strecke a→b (lokal in Kit k). */
  const bulbLine = (k: Kit, a: V3, b: V3, step: number, cols: RGB[], grp0: number, size = 0.2): void => {
    const A = k.p(a[0], a[1], a[2]);
    const B = k.p(b[0], b[1], b[2]);
    const l = Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2]);
    const n = Math.max(1, Math.round(l / (step * (hi ? 1 : 1.4))));
    for (let j = 0; j <= n; j++) {
      const f = j / n;
      lights.bulb(A[0] + (B[0] - A[0]) * f, A[1] + (B[1] - A[1]) * f, A[2] + (B[2] - A[2]) * f, size, cols[j % cols.length], grp0 === 0 ? 0 : grp0 === 4 ? 4 + (j % 2) : 1 + (j % 3));
    }
  };

  /** Weicher Schein (additiv), zur Kamera ungefähr waagrecht ausgerichtet. */
  const halo = (x: number, y: number, z: number, r: number, c: RGB, u: V3 = [1, 0, 0], w: V3 = [0, 1, 0]): void => {
    glow.disc(x, y, z, u, w, r, c, [0, 0, 0], 0, 10);
  };

  /** Festplatz-Boden: festgetretener Sand, dem Gelände folgend. */
  const patch = (cx: number, cz: number, r: number, col: RGB): void => {
    const n = hi ? 12 : 9;
    const lift = 0.28;
    const ref: V3 = [cx, -100, cz];
    const pt = (k: number, f: number): V3 => {
      const a = (k / n) * Math.PI * 2 + cx;
      const rr = r * f * (f > 0.9 ? 0.92 + 0.16 * ((k * 7) % 3) / 2 : 1);
      const x = cx + Math.cos(a) * rr;
      const z = cz + Math.sin(a) * rr;
      return [x, ground(x, z) + lift, z];
    };
    const c0: V3 = [cx, ground(cx, cz) + lift, cz];
    for (let k = 0; k < n; k++) {
      far.to(c0, pt(k, 0.55), pt(k + 1, 0.55), col, ref);
      far.qo(pt(k, 0.55), pt(k, 1), pt(k + 1, 1), pt(k + 1, 0.55), k % 2 ? col : shade(col, 0.95), ref);
    }
  };
  const SAND = rgb(0xc9a476);
  patch(40, -60, 30, SAND);
  patch(-40, -165, 22, SAND);
  patch(140, -125, 20, SAND);
  patch(-60, -70, 15, SAND);
  patch(148, -45, 15, SAND);

  // --- Bude mit gestreifter Markise ----------------------------------------------------
  /** Bude: lokal Front nach +z, Breite w. kind: 0 Schießbude, 1 Dosenwerfen, 2 Zuckerwatte, 3 Lebkuchenherzen, 4 Lose, 5 Imbiss. */
  const booth = (k: Kit, w: number, kind: number, c: RGB): void => {
    const d = 3;
    const h = 2.9;
    const hw = w / 2;
    // Körper mit dunkler Öffnung, Theke; Kleinkram ohne Kontur (Kit "far" im selben Rahmen)
    const g = far;
    g.ox = k.ox;
    g.oy = k.oy;
    g.oz = k.oz;
    g.c = k.c;
    g.s = k.s;
    k.box(0, h / 2, -0.1, w, h + 0.2, d - 0.2, shade(c, 0.8), shade(c, 0.55));
    g.quad([-hw + 0.3, 1.0, d / 2 - 0.08], [hw - 0.3, 1.0, d / 2 - 0.08], [hw - 0.3, h - 0.1, d / 2 - 0.08], [-hw + 0.3, h - 0.1, d / 2 - 0.08], rgb(0x3a2a40));
    g.box(0, 0.55, d / 2 - 0.05, w + 0.1, 1.1, 0.5, WHITE, c);
    // Markise: breite Streifen, nach vorn geneigt, mit Zackenkante
    const n = hi ? 4 : 3;
    for (let s = 0; s < n; s++) {
      const x0 = -hw - 0.1 + (s / n) * (w + 0.2);
      const x1 = -hw - 0.1 + ((s + 1) / n) * (w + 0.2);
      const col = s % 2 === 0 ? c : WHITE;
      k.quad([x0, h + 0.1, d / 2 + 0.4], [x1, h + 0.1, d / 2 + 0.4], [x1, h + 0.9, -0.3], [x0, h + 0.9, -0.3], col);
      k.quad([x1, h + 0.1, d / 2 + 0.4], [x0, h + 0.1, d / 2 + 0.4], [x0, h - 0.35, d / 2 + 0.4], [x1, h - 0.35, d / 2 + 0.4], col);
      k.tri([x1, h - 0.35, d / 2 + 0.4], [x0, h - 0.35, d / 2 + 0.4], [(x0 + x1) / 2, h - 0.75, d / 2 + 0.4], col);
    }
    if (!hi) {
      bulbLine(k, [-hw, h + 0.92, -0.3], [hw, h + 0.92, -0.3], 4.4, [BULB], 1, 0.14);
      return;
    }
    // Schild auf dem Dach
    g.box(0, h + 1.35, -0.4, w * 0.62, 0.8, 0.2, WHITE);
    g.quad([-w * 0.25, h + 1.1, -0.29], [w * 0.25, h + 1.1, -0.29], [w * 0.25, h + 1.6, -0.29], [-w * 0.25, h + 1.6, -0.29], c);
    // Ware
    const z = d / 2 - 0.05;
    const wz = d / 2 - 0.02;
    if (kind === 0) {
      // Schießbude: Sterne und Scheiben
      for (let j = 0; j < 4; j++) g.quad([-hw + 0.7 + j * ((w - 1.4) / 3) - 0.18, 1.7 + (j % 2) * 0.5, wz], [-hw + 0.7 + j * ((w - 1.4) / 3), 1.52 + (j % 2) * 0.5, wz], [-hw + 0.7 + j * ((w - 1.4) / 3) + 0.18, 1.7 + (j % 2) * 0.5, wz], [-hw + 0.7 + j * ((w - 1.4) / 3), 1.88 + (j % 2) * 0.5, wz], j % 2 ? WHITE : RED);
      g.beam([-0.6, 1.15, z], [0.4, 1.2, z + 0.2], 0.08, WOOD_D);
    } else if (kind === 1) {
      // Dosenpyramide
      for (let r = 0; r < 2; r++) for (let j = 0; j < 2 - r; j++) g.box(-0.2 + j * 0.4 + r * 0.2, 1.25 + r * 0.32, z, 0.26, 0.3, 0.26, (j + r) % 2 ? METAL : RED);
    } else if (kind === 2) {
      // Zuckerwatte-Wolken
      g.octa(-0.5, 1.4, z, 0.3, 0.3, 0.3, rgb(0xff9cc8));
      g.octa(0.4, 1.4, z, 0.3, 0.3, 0.3, rgb(0xd8b0ff));
      g.octa(0, 2.1, wz, 0.55, 0.45, 0.2, rgb(0xff9cc8));
    } else if (kind === 3) {
      // Lebkuchenherzen
      for (let j = 0; j < 3; j++) {
        const x = -hw + 0.8 + j * ((w - 1.6) / 2);
        const y = 2.1 - (j % 2) * 0.35;
        const zz = wz;
        const brown = rgb(0x9a5a2a);
        g.quad([x - 0.32, y + 0.12, zz], [x, y - 0.34, zz], [x + 0.32, y + 0.12, zz], [x, y + 0.22, zz], brown);
        g.tri([x - 0.32, y + 0.12, zz], [x, y + 0.22, zz], [x - 0.16, y + 0.34, zz], brown);
        g.tri([x, y + 0.22, zz], [x + 0.32, y + 0.12, zz], [x + 0.16, y + 0.34, zz], brown);
      }
    } else if (kind === 4) {
      // Lose: Teddys im Regal
      for (let j = 0; j < 3; j++) g.octa(-hw + 0.9 + j * ((w - 1.8) / 2), 1.85, wz, 0.3, 0.35, 0.25, [PINK, TURQ, VIOLET][j]);
    } else {
      // Imbiss: Kessel
      g.prism(0.6, 1.1, z - 0.1, 0.3, 0.3, 0.4, 5, METAL);
      g.box(-0.5, 1.15, z, 0.9, 0.1, 0.35, DARK);
    }
    // Birnen an der Markisenkante
    bulbLine(k, [-hw, h + 0.92, -0.3], [hw, h + 0.92, -0.3], hi ? 1.5 : 4.4, [BULB], kind % 2 === 0 ? 1 : 4, 0.14);
  };

  // --- Rundzelt -------------------------------------------------------------------------
  const tent = (cx: number, cz: number, r: number, wallH: number, roofH: number, a: RGB, b: RGB, n: number, apexLights: boolean): V3 => {
    const y = ground(cx, cz) - 0.3;
    near.at(cx, y, cz, 0);
    near.prism(0, 0, 0, r, r, wallH, n, a, b, null);
    near.prism(0, wallH, 0, r + 1.2, 0, roofH, n, b, a);
    near.prism(0, wallH + roofH - 0.3, 0, 0.15, 0.12, 2.6, 4, WHITE);
    // Eingang
    near.box(0, 1.6, r - 0.1, 3, 3.2, 0.4, DARK);
    near.box(0, 3.4, r + 0.1, 3.6, 0.5, 0.5, a);
    // Zackenkante
    for (let k = 0; k < n; k++) {
      const a0 = (k / n) * Math.PI * 2;
      const a1 = ((k + 1) / n) * Math.PI * 2;
      const am = (a0 + a1) / 2;
      const R = r + 1.2;
      near.tri2([Math.cos(a0) * R, wallH, Math.sin(a0) * R], [Math.cos(a1) * R, wallH, Math.sin(a1) * R], [Math.cos(am) * R, wallH - 0.8, Math.sin(am) * R], k % 2 ? a : b);
    }
    flags.push(small.add(flagGeo(PINK, TURQ, 2, 1.1), 1, 0.18, 3.4, rnd() * 6), cx, y + wallH + roofH + 2.3, cz, rnd() * 6);
    // Birnen an der Traufe und die Nähte hinauf
    const R = r + 1.25;
    const ne = hi ? n * 3 : n * 2;
    for (let k = 0; k < ne; k++) {
      const a0 = (k / ne) * Math.PI * 2;
      lights.bulb(cx + Math.cos(a0) * R, y + wallH + 0.05, cz + Math.sin(a0) * R, 0.2, BULB, 1 + (k % 3));
    }
    if (apexLights) {
      for (let k = 0; k < n; k += 2) {
        const a0 = (k / n) * Math.PI * 2;
        for (let j = 1; j < 5; j++) {
          const f = j / 5;
          lights.bulb(cx + Math.cos(a0) * R * (1 - f), y + wallH + roofH * f + 0.1, cz + Math.sin(a0) * R * (1 - f), 0.18, BULB_COL[k % 5], 1 + ((j + k) % 3));
        }
      }
    }
    return [cx, y + wallH + roofH, cz];
  };

  // =====================================================================================
  // Festplatz: Tor, Tribüne, Fahnen, Kassen, Zuschauer
  // =====================================================================================
  {
    const gi = 26;
    const gy = t.py[gi];
    const yaw = yawAt(gi);
    const cx = t.px[gi];
    const cz = t.pz[gi];
    near.at(cx, gy, cz, yaw);
    const PX = 14.2;
    // Türme rot-weiß geringelt, mit Spitzhut
    for (const sgn of [-1, 1]) {
      for (let s = 0; s < 8; s++) near.box(sgn * PX, -1 + s * 2.6 + 1.3, 0, 2.6, 2.6, 2.6, s % 2 ? WHITE : RED);
      near.box(sgn * PX, 20.0, 0, 3.4, 0.6, 3.4, TURQ);
      near.prism(sgn * PX, 20.3, 0, 2.2, 0, 4.2, 4, VIOLET, PINK, undefined, Math.PI / 4);
    }
    // Schild über der Bahn (Unterkante 12 m)
    const BY0 = 12;
    const BY1 = 18.2;
    near.box(0, (BY0 + BY1) / 2, 0, PX * 2 - 2.6, BY1 - BY0, 0.8, RED_D);
    near.box(0, BY0 + 0.2, 0, PX * 2 - 2.6, 0.4, 1.2, TURQ);
    near.box(0, BY1 - 0.2, 0, PX * 2 - 2.6, 0.4, 1.2, TURQ);
    // Giebel mit Krone
    near.quad([-5, BY1, -0.4], [5, BY1, -0.4], [0, BY1 + 3.4, -0.4], [0, BY1 + 3.4, -0.4], PINK);
    near.box(0, BY1 + 1.4, 0, 9.4, 2.4, 0.6, PINK);
    near.prism(0, BY1 + 2.6, 0, 1.0, 0, 1.8, 4, VIOLET, undefined, undefined, Math.PI / 4);
    // Leuchtschrift: Vorderseite (gegen die Fahrtrichtung) und gespiegelt hinten
    const word = 'RUMMEL';
    const dot = 0.56;
    const lw = 5 * dot;
    const gap = 0.95;
    const total = word.length * lw + (word.length - 1) * gap;
    for (const side of [-1, 1]) {
      const zf = side * 0.48;
      // Schrift nur vorn (gegen die Fahrtrichtung); hinten bleibt der Rahmen
      for (let L = 0; L < (side < 0 ? word.length : 0); L++) {
        const rows = FONT[word[L]];
        const x0 = -total / 2 + L * (lw + gap);
        for (let r = 0; r < 7; r++)
          for (let c = 0; c < 5; c++) {
            if (rows[r][c] !== '1') continue;
            // lokales +x zeigt nach links: Vorderseite (side -1) von links nach rechts lesen
            const lx = side < 0 ? -(x0 + c * dot + dot / 2) : x0 + c * dot + dot / 2;
            const P = near.p(lx, BY0 + 1.5 + (6 - r) * dot, zf);
            lights.bulb(P[0], P[1], P[2], 0.3, rgb(0xfff4d8), 0);
          }
        if (side < 0) {
          const lx = -(x0 + lw / 2);
          const P = near.p(lx, BY0 + 1.5 + 3 * dot, zf - 0.1);
          const ux = near.c;
          const uz = -near.s;
          halo(P[0], P[1], P[2], 2.3, rgb(0x6a1a38), [ux, 0, uz]);
        }
      }
      // Rahmen aus Lauflichtern
      bulbLine(near, [-(PX - 1.3), BY0 + 0.6, zf * 1.3], [PX - 1.3, BY0 + 0.6, zf * 1.3], 1.0, [BULB, rgb(0xff7a9a)], 1, 0.2);
      bulbLine(near, [-(PX - 1.3), BY1 - 0.5, zf * 1.3], [PX - 1.3, BY1 - 0.5, zf * 1.3], 1.0, [BULB, rgb(0x7ff0e8)], 1, 0.2);
      for (const sgn of [-1, 1]) bulbLine(near, [sgn * (PX - 1.35), 0.5, zf * 3], [sgn * (PX - 1.35), 19.6, zf * 3], 1.25, [BULB], 1, 0.2);
    }
    // Fahnen auf den Türmen
    for (const sgn of [-1, 1]) {
      const P = near.p(sgn * PX, 24.2, 0);
      near.at(P[0], P[1], P[2], 0);
      near.prism(0, 0, 0, 0.1, 0.08, 3, 4, WHITE);
      flags.push(small.add(flagGeo(TURQ, WHITE, 3, 1.6), 1, 0.16, 3.2, rnd() * 6), P[0], P[1] + 2.8, P[2], yaw + Math.PI / 2);
      near.at(cx, gy, cz, yaw);
    }
  }

  // Tribüne links (außen) am Festplatz
  {
    const lat0 = 12.4;
    for (let i = 46; i < 118; i += 6) {
      const yaw = yawAt(i);
      const y = t.py[i];
      near.at(t.px[i], y, t.pz[i], yaw);
      // lokales +x = links
      far.ox = near.ox;
      far.oy = near.oy;
      far.oz = near.oz;
      far.c = near.c;
      far.s = near.s;
      for (let r = 0; r < 4; r++) far.box(lat0 + 0.8 + r * 1.5, (0.5 + r * 0.7) / 2 - 0.3, 0, 1.5, 0.5 + r * 0.7 + 0.6, 6.05, r % 2 ? rgb(0x8a8fa8) : rgb(0x9aa0b8), rgb(0xc8ccd8));
      near.box(lat0 + 6.6, 3.2, 0, 0.4, 7, 6.05, RED_D);
      // Dach: Pfosten vorn und hinten, gestreifte Plane
      if ((i - 46) % 12 === 0) {
        near.box(lat0 + 0.1, 3.4, -3, 0.25, 6.8, 0.25, WHITE);
        near.box(lat0 + 6.6, 3.8, -3, 0.25, 7.6, 0.25, WHITE);
      }
      const c = ((i - 46) / 6) % 2 ? RED : WHITE;
      near.quad2([lat0 - 0.6, 6.6, -3], [lat0 - 0.6, 6.6, 3], [lat0 + 7, 7.8, 3], [lat0 + 7, 7.8, -3], c);
      near.quad2([lat0 - 0.6, 6.6, 3], [lat0 - 0.6, 6.6, -3], [lat0 - 0.6, 5.9, -3], [lat0 - 0.6, 5.9, 3], ((i - 46) / 6) % 2 ? WHITE : RED);
      bulbLine(near, [lat0 - 0.65, 5.85, -3], [lat0 - 0.65, 5.85, 3], 1.0, [BULB], 1, 0.16);
      // Zuschauer auf den Stufen
      const per = hi ? 2 : 1;
      for (let r = 0; r < 4; r++)
        for (let j = 0; j < per; j++) {
          if (rnd() < 0.15) continue;
          const lz = -2.4 + (j + rnd() * 0.6) * (5 / per);
          const lx = lat0 + 0.8 + r * 1.5;
          const ly = 0.5 + r * 0.7 - 0.3;
          const P = near.p(lx, ly, lz);
          visitor(far, P[0], P[1], P[2], yaw + Math.PI / 2 + (rnd() - 0.5) * 0.6, rnd());
        }
    }
  }

  // Fahnenmasten, Kassen und Zuschauer am Start
  {
    const poles: [number, number][] = [];
    for (let i = 130; i <= 210; i += 20) poles.push([i, -12.6], [i, 12.6]);
    for (let i = 1350; i < t.total; i += 22) poles.push([i, -12.6], [i, 12.6]);
    poles.push([6, 12.6]);
    let n = 0;
    for (const [i, lat] of poles) {
      const x = LX(i, lat);
      const z = LZ(i, lat);
      const cc = BRIGHT[n % BRIGHT.length];
      flagPole(near, x, ground(x, z), z, 9, cc, WHITE, yawAt(i) + Math.PI);
      n++;
    }
    // Kassenhäuschen beidseits vor dem Tor
    for (const [i, lat] of [
      [14, 15.5],
      [8, -15.5],
    ] as [number, number][]) {
      const x = LX(i, lat);
      const z = LZ(i, lat);
      const y = ground(x, z);
      near.at(x, y, z, faceRoad(i, x, z));
      near.box(0, 1.4, 0, 3.2, 3.2, 2.8, WHITE);
      near.box(0, 1.8, 1.42, 2.2, 1.1, 0.05, rgb(0x3a3050));
      near.box(0, 1.0, 1.6, 2.6, 0.12, 0.5, RED);
      near.prism(0, 3.0, 0, 2.6, 0, 1.8, 4, RED, WHITE, undefined, Math.PI / 4);
      near.octa(0, 5.0, 0, 0.25, 0.25, 0.25, TURQ);
      bulbLine(near, [-1.6, 3.0, 1.45], [1.6, 3.0, 1.45], 0.5, [BULB, rgb(0xff7a9a)], 4, 0.14);
      // Schlange davor
      for (let j = 0; j < 4; j++) {
        const P = near.p(-1.5 + j * 1.1 + (rnd() - 0.5) * 0.3, 0, 3.5 + j * 0.9);
        visitor(far, P[0], ground(P[0], P[2]), P[2], faceRoad(i, x, z) + Math.PI + (rnd() - 0.5), rnd());
      }
    }
    // Zuschauer innen am Festplatz hinter der Bande
    const step = hi ? 3.6 : 7;
    for (let i = 1395; i < t.total + 40; i += step) {
      const ii = Math.floor(i) % t.total;
      if ((ii > 40 && ii < 1300) || (ii > 4 && ii < 34)) continue;
      for (let r = 0; r < 2; r++) {
        const lat = 12.2 + r * 1.3 + rnd() * 0.6;
        const x = LX(ii, lat);
        const z = LZ(ii, lat);
        if (!free(x, z, 0.3)) continue;
        visitor(far, x, ground(x, z), z, faceRoad(ii, x, z) + (rnd() - 0.5) * 0.8, rnd());
      }
    }
    // Lichterketten quer über den Festplatz (≥ 11 m über der Bahn)
    for (const i of [134, 172, 210, 1380, 1418]) {
      const a = mast(LX(i, -11.8), LZ(i, -11.8), 13.5);
      const b = mast(LX(i, 11.8), LZ(i, 11.8), 13.5);
      chain(a, b, 1.6, hi ? 1.3 : 2.4, [BULB, rgb(0xff7a9a), BULB, rgb(0x7ff0e8)], true);
    }
  }

  // Parkplätze draußen: hinter der Tribüne und südlich von Kamelbuckel und Steilkurve
  for (const [x0, z0, ln, cars] of [
    [-110, -284, 180, hi ? 40 : 12],
    [70, 212, 110, hi ? 24 : 8],
  ]) {
    let placed = 0;
    for (let k = 0; k < 400 && placed < cars; k++) {
      const row = Math.floor(rnd() * 4);
      const x = x0 + rnd() * ln;
      const z = z0 + (z0 < 0 ? -1 : 1) * row * 9 + (rnd() - 0.5) * 0.6;
      if (!free(x, z, 3)) continue;
      const y = ground(x, z);
      const c = BRIGHT[Math.floor(rnd() * BRIGHT.length)];
      far.at(x, y, z, Math.PI / 2 + (rnd() < 0.5 ? 0 : Math.PI));
      far.box(0, 0.55, 0, 1.8, 0.8, 4.2, c);
      far.box(0, 1.25, -0.2, 1.6, 0.6, 2.2, rgb(0x384058), shade(c, 0.9));
      placed++;
    }
  }

  // =====================================================================================
  // Riesenrad
  // =====================================================================================
  const WHEEL = { x: 40, z: -60, R: 31, H: 35.5, n: 16 };
  const wheelBasis = new THREE.Matrix4();
  const wheelHub = new THREE.Vector3();
  let wheelPart = -1;
  let wheelLights = -1;
  const gondolas: number[] = [];
  {
    const gy = ground(WHEEL.x, WHEEL.z);
    // Radebene: zeigt zur Kuppe des Lifthügels und schräg zum Start
    const nx = 1 / Math.hypot(1, 0.35);
    const nz = 0.35 * nx;
    // u × oben = n: rechtshändige Basis (sonst stünde das Rad gespiegelt)
    const ux = nz;
    const uz = -nx;
    wheelBasis.makeBasis(new THREE.Vector3(ux, 0, uz), new THREE.Vector3(0, 1, 0), new THREE.Vector3(nx, 0, nz));
    wheelHub.set(WHEEL.x, gy + WHEEL.H, WHEEL.z);
    // Böcke: A-Stützen zu beiden Seiten der Radebene
    near.at(WHEEL.x, gy, WHEEL.z, Math.atan2(nx, nz));
    // lokal: +z = Achse (n), +x = -u
    for (const sz0 of [-1, 1]) {
      const zz = sz0 * 3.4;
      for (const sx0 of [-1, 1]) near.beam([sx0 * 13, -0.5, zz * 2.2], [0, WHEEL.H, zz], 1.1, WHITE);
      near.beam([-9, 12, zz * 1.85], [9, 12, zz * 1.85], 0.6, RED);
      near.beam([-4.5, 24, zz * 1.4], [4.5, 24, zz * 1.4], 0.5, RED);
    }
    near.beam([0, WHEEL.H, -3.8], [0, WHEEL.H, 3.8], 1.2, DARK);
    // Bühne zum Einsteigen
    near.box(0, 0.2, 0, 10, 1.6, 6, rgb(0x8a8fa8), RED);
    near.box(0, 0.5, 6, 4, 0.6, 6, rgb(0x9aa0b8));
    near.box(-5.5, 1.6, 3.5, 2.6, 2.6, 2.4, WHITE);
    near.prism(-5.5, 2.9, 3.5, 2.0, 0, 1.4, 4, RED, undefined, undefined, Math.PI / 4);
    // Rad selbst (lokal: x,y in der Ebene, z Achse)
    const mb = new MeshBuilder();
    const k = new Kit(mb);
    const R = WHEEL.R;
    const NR = 24;
    for (const zz of [-1.7, 1.7]) {
      for (let s = 0; s < NR; s++) {
        const a0 = (s / NR) * Math.PI * 2;
        const a1 = ((s + 1) / NR) * Math.PI * 2;
        k.beam([Math.cos(a0) * R, Math.sin(a0) * R, zz], [Math.cos(a1) * R, Math.sin(a1) * R, zz], 0.7, s % 2 ? WHITE : RED);
        if (s % 2 === 0) k.beam([Math.cos(a0) * R * 0.62, Math.sin(a0) * R * 0.62, zz], [Math.cos(a1 + (a1 - a0)) * R * 0.62, Math.sin(a1 + (a1 - a0)) * R * 0.62, zz], 0.4, TURQ);
      }
      for (let s = 0; s < WHEEL.n; s++) {
        const a = (s / WHEEL.n) * Math.PI * 2;
        k.beam([Math.cos(a) * 1.4, Math.sin(a) * 1.4, zz * 0.6], [Math.cos(a) * R, Math.sin(a) * R, zz], 0.35, WHITE);
      }
    }
    for (let s = 0; s < WHEEL.n; s++) {
      const a = (s / WHEEL.n) * Math.PI * 2;
      k.beam([Math.cos(a) * R, Math.sin(a) * R, -1.8], [Math.cos(a) * R, Math.sin(a) * R, 1.8], 0.3, METAL);
    }
    k.prism(0, -2.2, 0, 2.2, 2.2, 0, 8, PINK);
    k.box(0, 0, 0, 3.2, 3.2, 2.6, PINK);
    k.box(0, 0, 0, 2.2, 2.2, 3.4, VIOLET);
    wheelPart = mov.add(mb);
    // Birnen auf Speichen und Kranz (drehen mit)
    wheelLights = lights.part(true);
    const per = hi ? 5 : 3;
    for (let s = 0; s < WHEEL.n; s++) {
      const a = (s / WHEEL.n) * Math.PI * 2;
      for (let j = 1; j <= per; j++) {
        const r = 2 + ((R - 2) * j) / per;
        for (const zz of [-1.95, 1.95]) lights.bulb(Math.cos(a) * r, Math.sin(a) * r, zz * (0.6 + 0.4 * (r / R)), 0.26, BULB_COL[s % 5], 1 + ((j + s) % 3));
      }
    }
    const nr = hi ? 32 : 20;
    for (let s = 0; s < nr; s++) {
      const a = (s / nr) * Math.PI * 2;
      for (const zz of [-2.1, 2.1]) lights.bulb(Math.cos(a) * (R + 0.45), Math.sin(a) * (R + 0.45), zz, 0.28, s % 2 ? BULB : rgb(0xff7a9a), 4 + (s % 2));
    }
    lights.use(0);
    // Schein der Nabe
    glow.disc(wheelHub.x + nx * 2.2, wheelHub.y, wheelHub.z + nz * 2.2, [ux, 0, uz], [0, 1, 0], 4.5, rgb(0x9a3a68), [0, 0, 0], 0, 12);
    glow.disc(wheelHub.x - nx * 2.2, wheelHub.y, wheelHub.z - nz * 2.2, [ux, 0, uz], [0, 1, 0], 4.5, rgb(0x9a3a68), [0, 0, 0], 0, 12);
    // Gondeln: hängen senkrecht unter dem Kranz (Drehpunkt oben)
    for (let s = 0; s < WHEEL.n; s++) {
      const g = new MeshBuilder();
      const gk = new Kit(g);
      const c = BRIGHT[s % BRIGHT.length];
      gk.beam([0, 0, 0], [0, -1.3, 0], 0.15, METAL);
      gk.prism(0, -2.2, 0, 1.7, 0, 1.0, 6, c, WHITE);
      gk.box(0, -3.3, 0, 2.0, 2.2, 1.9, WHITE);
      gk.box(0, -4.25, 0, 2.2, 0.6, 2.1, c);
      // Fahrgäste
      gk.octa(0.45, -3.3, 0, 0.17, 0.2, 0.17, SKIN[s % 4]);
      if (s % 2) gk.octa(-0.45, -3.3, 0, 0.17, 0.2, 0.17, SKIN[(s + 1) % 4]);
      gondolas.push(mov.add(g));
    }
  }

  // =====================================================================================
  // Festzelte und Lichterketten auf dem Platz
  // =====================================================================================
  {
    const apexA = tent(-40, -165, 13, 4.2, 9, RED, WHITE, 12, true);
    const apexB = tent(140, -125, 12, 4, 8.5, TURQ, WHITE, 12, true);
    tent(148, -45, 8.5, 3.2, 6, ORANGE, WHITE, 10, false);
    tent(-60, -70, 9, 3.4, 6.5, VIOLET, PINK, 10, false);
    // Lichterketten von den Zeltspitzen zu Masten ringsum
    for (const [ap, n0] of [
      [apexA, 0.3],
      [apexB, 1.1],
    ] as [V3, number][]) {
      for (let k = 0; k < 6; k++) {
        const a = n0 + (k / 6) * Math.PI * 2;
        const x = ap[0] + Math.cos(a) * 27;
        const z = ap[2] + Math.sin(a) * 27;
        if (!free(x, z, 1)) continue;
        const m = mast(x, z, 8);
        chain([ap[0], ap[1] - 0.6, ap[2]], m, 2.2, hi ? 1.8 : 3.2, [BULB, BULB_COL[k % 4]], true);
      }
    }
    // Ring aus Masten um das Riesenrad, verbunden
    const ring: V3[] = [];
    for (let k = 0; k < 8; k++) {
      const a = 0.2 + (k / 8) * Math.PI * 2;
      ring.push(mast(WHEEL.x + Math.cos(a) * 24, WHEEL.z + Math.sin(a) * 24, 8));
    }
    for (let k = 0; k < 8; k++) chain(ring[k], ring[(k + 1) % 8], 1.3, hi ? 1.8 : 3.2, [BULB, rgb(0xff7a9a)], true);
    // Budenreihen innen am Festplatz und im Bogen zum Bahnhof
    let bi = 0;
    for (const [i0, i1] of [
      [40, 128],
      [218, 345],
    ]) {
      let lastX = Infinity;
      let lastZ = Infinity;
      for (let i = i0; i < i1; i++) {
        const x = LX(i, 14.2);
        const z = LZ(i, 14.2);
        if (Math.hypot(x - lastX, z - lastZ) < 5.4) continue;
        if (!free(x, z, 2.6)) continue;
        lastX = x;
        lastZ = z;
        near.at(x, ground(x, z) - 0.1, z, faceRoad(i, x, z));
        booth(near, 4.6, bi % 6, BRIGHT[(bi * 5 + 1) % BRIGHT.length]);
        if (rnd() < (hi ? 0.55 : 0.25)) {
          const P = near.p((rnd() - 0.5) * 2.5, 0, 2.7);
          if (free(P[0], P[2], 0.2)) visitor(far, P[0], ground(P[0], P[2]), P[2], faceRoad(i, x, z) + Math.PI + (rnd() - 0.5) * 0.8, rnd());
        }
        bi++;
      }
    }
    // Besucher rund um das Rad
    for (let j = 0; j < (hi ? 14 : 6); j++) {
      const a = rnd() * Math.PI * 2;
      const r = 14 + rnd() * 14;
      const x = WHEEL.x + Math.cos(a) * r;
      const z = WHEEL.z + Math.sin(a) * r;
      visitor(far, x, ground(x, z), z, rnd() * 6.3, rnd());
    }
  }

  // =====================================================================================
  // Am Lifthügel: Zaun, Wohnwagen, Bäume (außen, Osten)
  // =====================================================================================
  {
    // Zaun
    for (let i = 396; i < 548; i += 8) {
      const x = LX(i, -15);
      const z = LZ(i, -15);
      const x2 = LX(i + 8, -15);
      const z2 = LZ(i + 8, -15);
      const y = ground(x, z);
      const y2 = ground(x2, z2);
      far.at(0, 0, 0, 0);
      far.beam([x, y - 0.3, z], [x, y + 1.3, z], 0.16, WHITE);
      far.beam([x, y + 1.1, z], [x2, y2 + 1.1, z2], 0.1, WHITE);
      far.beam([x, y + 0.55, z], [x2, y2 + 0.55, z2], 0.1, WHITE);
    }
    // Wohnwagen der Schausteller
    let n = 0;
    for (let i = 404; i < 560; i += 23) {
      const lat = -(21 + rnd() * 4);
      const x = LX(i, lat);
      const z = LZ(i, lat);
      if (!free(x, z, 4)) continue;
      const y = ground(x, z);
      const c = [WHITE, rgb(0xbfe8f0), rgb(0xf6d0d8)][n % 3];
      near.at(x, y, z, yawAt(i) + (rnd() - 0.5) * 0.4);
      near.box(0, 1.9, 0, 2.4, 2.4, 6.2, c, rgb(0xd8d8e0));
      near.box(1.22, 1.6, 0, 0.05, 0.35, 6.2, [TURQ, PINK, RED][n % 3]);
      near.box(-1.22, 1.6, 0, 0.05, 0.35, 6.2, [TURQ, PINK, RED][n % 3]);
      near.box(0, 0.45, 1.2, 2.6, 0.7, 0.7, DARK);
      near.box(0, 0.6, 3.6, 0.2, 0.2, 1.4, DARK);
      // Fenster (warmes Licht)
      for (const sgn of [-1, 1]) {
        const P = near.p(sgn * 1.24, 2.3, -1.2);
        lights.disc(P[0], P[1], P[2], [near.s, 0, near.c], [0, 1, 0], 0.55, rgb(0xffd890), rgb(0xffb860), 0, 6, 0.35);
      }
      // Wäscheleine mit Birnen zum nächsten
      bulbLine(near, [0, 3.3, -3], [0, 3.3, 3], 1, [BULB, rgb(0xffb070)], 4, 0.16);
      n++;
    }
  }

  // Bäume: Reihen außen um den Rummel (und ein paar innen)
  {
    const want = hi ? 80 : 24;
    let placed = 0;
    for (let k = 0; k < 2000 && placed < want; k++) {
      const i = Math.floor(rnd() * t.total);
      const out = rnd() < 0.88;
      const lat = out ? -(t.wh[i] + 26 + rnd() * 45) : t.wh[i] + 30 + rnd() * 40;
      const x = LX(i, lat) + (rnd() - 0.5) * 6;
      const z = LZ(i, lat) + (rnd() - 0.5) * 6;
      if (z < -270 && z > -330 && x > -120 && x < 80) continue; // Parkplatz
      if (z > 205 && z < 250 && x > 62 && x < 188) continue;
      if (!free(x, z, 3)) continue;
      // nicht in Zelte, Rad und Buden
      if (Math.hypot(x - WHEEL.x, z - WHEEL.z) < 30) continue;
      const y = ground(x, z);
      const s = 0.8 + rnd() * 0.7;
      far.at(x, y, z, rnd() * 6);
      far.prism(0, -0.3, 0, 0.35 * s, 0.25 * s, 2.6 * s, 3, WOOD_D, undefined, null);
      const green = mixRgb(rgb(0x3f7a4a), rgb(0x6a9a4a), rnd());
      if (rnd() < 0.5) far.octa(0, 4.4 * s, 0, 2.4 * s, 2.6 * s, 2.4 * s, green, shade(green, 0.7));
      else far.prism(0, 2.0 * s, 0, 2.6 * s, 0, 5.5 * s, 5, green, shade(green, 0.85));
      placed++;
    }
  }

  // =====================================================================================
  // Unter der Abfahrt: Kettenkarussell, Zirkuszelt, Teich mit Tretbooten
  // =====================================================================================
  const CH = { x: 174, z: 33, top: 12.5, r: 4.6, L: 5.6, n: 12 };
  let chainCrown = -1;
  let chainLights = -1;
  const chainSeats: number[] = [];
  let chainY = 0;
  {
    chainY = ground(CH.x, CH.z);
    near.at(CH.x, chainY, CH.z, 0);
    near.prism(0, -0.3, 0, 7.4, 7.4, 0.8, 12, rgb(0x8a8fa8), undefined, rgb(0xb8bccb));
    near.prism(0, 0.5, 0, 1.1, 0.8, CH.top - 0.5, 8, TURQ, WHITE);
    // Drehender Schirm
    const cb = new MeshBuilder();
    const ck = new Kit(cb);
    ck.prism(0, 0, 0, CH.r + 0.6, CH.r + 0.6, 0.7, 12, PINK, WHITE, null);
    ck.prism(0, 0.7, 0, CH.r + 0.6, 0, 2.6, 12, VIOLET, PINK);
    ck.prism(0, 3.1, 0, 0.12, 0.1, 1.6, 4, WHITE);
    chainCrown = mov.add(cb);
    chainLights = lights.part(true);
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * Math.PI * 2;
      lights.bulb(Math.cos(a) * (CH.r + 0.7), 0.35, Math.sin(a) * (CH.r + 0.7), 0.2, k % 2 ? BULB : rgb(0x7ff0e8), 4 + (k % 2));
      if (k % 2 === 0) for (let j = 1; j < 4; j++) lights.bulb(Math.cos(a) * (CH.r + 0.6) * (1 - j / 4), 0.7 + 2.6 * (j / 4), Math.sin(a) * (CH.r + 0.6) * (1 - j / 4), 0.17, BULB, 1 + ((j + k) % 3));
    }
    lights.use(0);
    for (let s = 0; s < CH.n; s++) {
      const g = new MeshBuilder();
      const gk = new Kit(g);
      gk.beam([0, 0, 0.25], [0, -CH.L, 0.25], 0.06, METAL);
      gk.beam([0, 0, -0.25], [0, -CH.L, -0.25], 0.06, METAL);
      gk.box(0, -CH.L - 0.1, 0, 0.7, 0.18, 0.7, BRIGHT[s % BRIGHT.length]);
      gk.box(-0.3, -CH.L + 0.3, 0, 0.12, 0.7, 0.7, BRIGHT[s % BRIGHT.length]);
      gk.prism(0.05, -CH.L, 0, 0.18, 0.15, 0.5, 4, CLOTH[(s + 2) % CLOTH.length], undefined, null);
      gk.octa(0.05, -CH.L + 0.7, 0, 0.16, 0.19, 0.16, SKIN[s % 4]);
      chainSeats.push(small.add(g));
    }
    // Zuschauer am Zaun
    for (let k = 0; k < (hi ? 10 : 5); k++) {
      const a = rnd() * Math.PI * 2;
      const x = CH.x + Math.cos(a) * 11.5;
      const z = CH.z + Math.sin(a) * 11.5;
      if (free(x, z, 0.5)) visitor(far, x, ground(x, z), z, Math.atan2(-Math.cos(a), -Math.sin(a)), rnd());
    }
    halo(CH.x, chainY + CH.top + 1.2, CH.z, 4, rgb(0x4a2a70));
    patch(CH.x, CH.z, 12, SAND);
  }

  // Zirkuszelt
  {
    const cx = 139;
    const cz = 104;
    const y = ground(cx, cz) - 0.3;
    patch(cx, cz, 23, SAND);
    near.at(cx, y, cz, 0);
    near.prism(0, 0, 0, 15, 15, 5, 16, RED, WHITE, null);
    near.prism(0, 5, 0, 16.5, 4, 7, 16, WHITE, RED, null);
    near.prism(0, 12, 0, 4, 0, 4.5, 8, RED, WHITE);
    near.prism(0, 16, 0, 0.18, 0.14, 3.4, 4, WHITE);
    // Eingang mit Vordach zur Bahn
    const ya = Math.atan2(178 - cx, 60 - cz);
    near.at(cx, y, cz, ya);
    near.box(0, 2, 15, 4.5, 4, 1.2, DARK);
    near.quad2([-3.4, 4.6, 14.2], [3.4, 4.6, 14.2], [3.4, 3.6, 17.5], [-3.4, 3.6, 17.5], TURQ);
    near.at(cx, y, cz, 0);
    flags.push(small.add(flagGeo(RED, WHITE, 2.6, 1.4), 1, 0.17, 3.1, 1), cx, y + 19.2, cz, 0.6);
    // Wimpelleinen von der Spitze zu Pflöcken
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + 0.2;
      const A: V3 = [cx, y + 16.2, cz];
      const B: V3 = [cx + Math.cos(a) * 25, ground(cx + Math.cos(a) * 25, cz + Math.sin(a) * 25) + 0.4, cz + Math.sin(a) * 25];
      near.at(0, 0, 0, 0);
      near.beam(B, [B[0], B[1] - 0.8, B[2]], 0.2, WOOD_D);
      const n = hi ? 12 : 7;
      for (let j = 1; j < n; j++) {
        const f = j / n;
        const px = A[0] + (B[0] - A[0]) * f;
        const pz = A[2] + (B[2] - A[2]) * f;
        const py = A[1] + (B[1] - A[1]) * f - 1.2 * Math.sin(Math.PI * f);
        // Dreieckswimpel quer zur Leine
        const tx = -Math.sin(a) * 0.45;
        const tz = Math.cos(a) * 0.45;
        const c = BRIGHT[(j + k) % BRIGHT.length];
        far.mb.tri([px - tx, py, pz - tz], [px + tx, py, pz + tz], [px, py - 0.9, pz], c);
        far.mb.tri([px - tx, py, pz - tz], [px, py - 0.9, pz], [px + tx, py, pz + tz], c);
        if (j % 3 === 0) lights.bulb(px, py + 0.1, pz, 0.17, BULB, 1 + (j % 3));
      }
    }
    for (let k = 0; k < (hi ? 24 : 12); k++) {
      const a = (k / (hi ? 24 : 12)) * Math.PI * 2;
      lights.bulb(cx + Math.cos(a) * 16.6, y + 5.05, cz + Math.sin(a) * 16.6, 0.22, k % 2 ? BULB : rgb(0xff7a9a), 4 + (k % 2));
    }
    for (let k = 0; k < (hi ? 8 : 4); k++) {
      const a = rnd() * Math.PI * 2;
      const x = cx + Math.cos(a) * 19;
      const z = cz + Math.sin(a) * 19;
      if (free(x, z, 0.5)) visitor(far, x, ground(x, z), z, rnd() * 6, rnd());
    }
  }

  // Teich mit Tretbooten (gemauertes Becken)
  const POND = { x: 98, z: 58, r: 13 };
  let pondY = 0;
  const boats: number[] = [];
  {
    let top = -Infinity;
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      top = Math.max(top, ground(POND.x + Math.cos(a) * POND.r, POND.z + Math.sin(a) * POND.r));
    }
    top = Math.max(top, ground(POND.x, POND.z));
    pondY = top + 0.35;
    near.at(POND.x, 0, POND.z, 0);
    near.prism(0, pondY - 3, 0, POND.r + 1, POND.r + 1, 3.4, 18, rgb(0xb8b0a8), rgb(0xa8a098), rgb(0xc8c0b8));
    near.prism(0, pondY - 0.9, 0, POND.r, POND.r, 0.9, 18, rgb(0x3f8fbf), undefined, rgb(0x4f9fd0));
    // Seerosen
    for (let k = 0; k < 6; k++) {
      const a = rnd() * 6.3;
      const r = rnd() * POND.r * 0.85;
      near.prism(Math.cos(a) * r, pondY + 0.02, Math.sin(a) * r, 0.7, 0.7, 0.05, 6, rgb(0x5aa85a), undefined, rgb(0x6ab86a));
    }
    // Lampen am Rand
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      const x = POND.x + Math.cos(a) * (POND.r + 2.2);
      const z = POND.z + Math.sin(a) * (POND.r + 2.2);
      const y = ground(x, z);
      near.at(x, y, z, 0);
      near.prism(0, -0.3, 0, 0.1, 0.08, 3.4, 4, DARK);
      lights.bulb(x, y + 3.35, z, 0.32, BULB, 0);
      halo(x, y + 3.35, z, 1.2, rgb(0x806040));
    }
    for (let b = 0; b < (hi ? 4 : 3); b++) {
      const g = new MeshBuilder();
      const gk = new Kit(g);
      const c = [WHITE, PINK, TURQ, VIOLET][b];
      gk.prism(0, -0.2, 0, 1.1, 1.3, 0.6, 6, c, undefined, shade(c, 0.85));
      gk.box(0, 0.6, -0.2, 1.2, 0.5, 0.25, c);
      // Schwanenhals vorn (eigener, schlichter Vogel)
      gk.beam([0, 0.3, 1.0], [0, 1.6, 1.25], 0.22, WHITE);
      gk.octa(0, 1.7, 1.45, 0.2, 0.18, 0.32, WHITE);
      gk.octa(0, 1.68, 1.8, 0.07, 0.06, 0.14, ORANGE);
      gk.octa(-0.3, 0.75, -0.1, 0.16, 0.19, 0.16, SKIN[b]);
      gk.octa(0.3, 0.75, -0.1, 0.16, 0.19, 0.16, SKIN[(b + 2) % 4]);
      boats.push(small.add(g));
    }
  }

  // =====================================================================================
  // Steilkurve: Karussell mit eigenen Tieren und Zuschauerhügel
  // =====================================================================================
  const CAR = { x: LX(790, 22), z: LZ(790, 22), r: 6.4, n: 8 };
  let carY = 0;
  let carPart = -1;
  let carLights = -1;
  const animals: number[] = [];
  {
    carY = ground(CAR.x, CAR.z);
    near.at(CAR.x, carY, CAR.z, 0);
    near.prism(0, -0.4, 0, CAR.r + 1.2, CAR.r + 1.2, 0.8, 12, VIOLET, undefined, rgb(0xb8a0e0));
    const cb = new MeshBuilder();
    const ck = new Kit(cb);
    ck.prism(0, 0.4, 0, CAR.r + 0.6, CAR.r + 0.6, 0.4, 16, RED, WHITE, rgb(0xd8c8a8));
    ck.prism(0, 0.8, 0, 1.6, 1.6, 4.4, 8, rgb(0xf0a0c0), WHITE, null);
    ck.prism(0, 5.2, 0, CAR.r + 0.8, CAR.r + 0.8, 0.9, 16, TURQ, WHITE, null);
    ck.prism(0, 6.1, 0, CAR.r + 0.8, 0.6, 2.8, 16, RED, WHITE);
    ck.prism(0, 8.9, 0, 0.6, 0, 1.4, 6, rgb(0xffb070));
    carPart = mov.add(cb);
    carLights = lights.part(true);
    for (let k = 0; k < 32; k++) {
      const a = (k / 32) * Math.PI * 2;
      lights.bulb(Math.cos(a) * (CAR.r + 0.9), 5.65, Math.sin(a) * (CAR.r + 0.9), 0.2, k % 2 ? BULB : rgb(0xffb070), 1 + (k % 3));
    }
    lights.use(0);
    // Tiere: Pferdchen, Gans, Fisch, Schwein – je zweimal
    for (let k = 0; k < CAR.n; k++) {
      const g = new MeshBuilder();
      const gk = new Kit(g);
      const kind = k % 4;
      const c = [WHITE, rgb(0xf0e8d8), rgb(0x7fd0e0), rgb(0xffb0c8)][kind];
      const acc = [RED, ORANGE, BLUE, PINK][kind];
      if (kind === 0) {
        gk.box(0, 0, 0, 0.55, 0.6, 1.5, c);
        gk.beam([0, 0.2, 0.6], [0, 0.95, 0.95], 0.35, c);
        gk.box(0, 1.0, 1.15, 0.32, 0.32, 0.6, c);
        gk.box(0, 0.75, 0.75, 0.1, 0.7, 0.35, acc);
        for (const lz of [-0.55, 0.55]) for (const lx of [-0.2, 0.2]) gk.beam([lx, -0.2, lz], [lx, -0.75, lz + (lz > 0 ? 0.25 : -0.25)], 0.13, c);
        gk.box(0, 0.38, 0, 0.6, 0.1, 0.5, acc);
      } else if (kind === 1) {
        gk.octa(0, 0, 0, 0.5, 0.45, 0.8, c);
        gk.beam([0, 0.2, 0.55], [0, 1.1, 0.8], 0.2, c);
        gk.octa(0, 1.15, 0.9, 0.18, 0.18, 0.25, c);
        gk.octa(0, 1.12, 1.2, 0.06, 0.06, 0.16, ORANGE);
        gk.tri2([0, 0.1, -0.7], [0, 0.6, -1.0], [0, 0.0, -1.0], c);
      } else if (kind === 2) {
        gk.octa(0, 0, 0, 0.35, 0.6, 0.9, c);
        gk.tri2([0, 0, -0.8], [0, 0.55, -1.35], [0, -0.55, -1.35], acc);
        gk.tri2([0, 0.5, 0.0], [0, 0.95, -0.3], [0, 0.45, -0.5], acc);
      } else {
        gk.box(0, 0, 0, 0.7, 0.65, 1.3, c);
        gk.box(0, 0.05, 0.75, 0.5, 0.45, 0.3, c);
        gk.box(0, 0, 0.92, 0.3, 0.22, 0.06, acc);
        for (const lz of [-0.45, 0.45]) for (const lx of [-0.22, 0.22]) gk.box(lx, -0.5, lz, 0.16, 0.45, 0.16, c);
        gk.tri2([-0.2, 0.32, 0.55], [-0.1, 0.32, 0.55], [-0.2, 0.55, 0.5], acc);
        gk.tri2([0.1, 0.32, 0.55], [0.2, 0.32, 0.55], [0.2, 0.55, 0.5], acc);
      }
      gk.beam([0, -1.6, 0], [0, 2.4, 0], 0.08, rgb(0xe8d8b0));
      animals.push(mov.add(g));
    }
    // Zuschauerhügel (ein grüner Buckel mit Stufenpfad), Blick hinauf zur Steilkurve
    const hx = LX(835, 21);
    const hz = LZ(835, 21);
    const hy = ground(hx, hz);
    near.at(hx, hy, hz, 0);
    near.prism(0, -0.5, 0, 8, 3.6, 3.3, 9, rgb(0x6f9a58), rgb(0x649050), rgb(0x7fa864));
    const yawUp = Math.atan2(t.px[835] - hx, t.pz[835] - hz);
    for (let k = 0; k < (hi ? 11 : 5); k++) {
      const a = rnd() * Math.PI * 2;
      const r = rnd() * 3;
      const x = hx + Math.cos(a) * r;
      const z = hz + Math.sin(a) * r;
      visitor(far, x, hy + 2.8, z, yawUp + (rnd() - 0.5) * 0.6, rnd() * 0.5);
    }
    for (let k = 0; k < (hi ? 6 : 3); k++) {
      const a = rnd() * Math.PI * 2;
      const x = CAR.x + Math.cos(a) * 9.5;
      const z = CAR.z + Math.sin(a) * 9.5;
      if (free(x, z, 0.5)) visitor(far, x, ground(x, z), z, Math.atan2(CAR.x - x, CAR.z - z), rnd());
    }
    halo(CAR.x, carY + 9.5, CAR.z, 5, rgb(0x704020));
    patch(CAR.x, CAR.z, 11.5, SAND);
  }

  // =====================================================================================
  // Nach der Bremsstrecke: Autoscooter-Halle, Losbuden
  // =====================================================================================
  const SC = { i: 1088, lat: -24 };
  const scooters: number[] = [];
  let scX = 0;
  let scZ = 0;
  let scY = 0;
  let scYaw = 0;
  {
    scX = LX(SC.i, SC.lat);
    scZ = LZ(SC.i, SC.lat);
    scY = ground(scX, scZ);
    scYaw = yawAt(SC.i);
    patch(scX, scZ, 16, SAND);
    near.at(scX, scY, scZ, scYaw);
    // lokal: +z Fahrtrichtung, +x links (weg von der Bahn? nein: links = Süden, von der Bahn weg)
    const W = 22;
    const D = 13;
    near.box(0, 0.05, 0, D + 1, 0.7, W + 1, rgb(0x3a3a4a), rgb(0x4a4a5e));
    near.box(0, 0.45, 0, D, 0.12, W, rgb(0x6a6f88));
    for (const lx of [-D / 2, D / 2]) for (const lz of [-W / 2, 0, W / 2]) near.box(lx, 3.1, lz, 0.4, 5.4, 0.4, METAL);
    near.box(0, 5.9, 0, D + 1.2, 0.5, W + 1.2, rgb(0x4a4a5e), rgb(0x6a4a8a));
    // Zierblende ringsum, gestreift
    for (let s = 0; s < 12; s++) {
      const z0 = -W / 2 - 0.6 + (s / 12) * (W + 1.2);
      const z1 = -W / 2 - 0.6 + ((s + 1) / 12) * (W + 1.2);
      const c = s % 2 ? PINK : WHITE;
      near.quad([-(D / 2 + 0.65), 6.2, z0], [-(D / 2 + 0.65), 6.2, z1], [-(D / 2 + 0.65), 7.4, z1], [-(D / 2 + 0.65), 7.4, z0], c);
      near.quad([D / 2 + 0.65, 6.2, z1], [D / 2 + 0.65, 6.2, z0], [D / 2 + 0.65, 7.4, z0], [D / 2 + 0.65, 7.4, z1], c);
    }
    near.box(0, 6.8, W / 2 + 0.65, D + 1.3, 1.2, 0.1, TURQ);
    near.box(0, 6.8, -W / 2 - 0.65, D + 1.3, 1.2, 0.1, TURQ);
    // Gitter unter dem Dach (Strom für die Scooter)
    near.box(0, 5.55, 0, D - 0.4, 0.06, W - 0.4, rgb(0x8a8fa8));
    bulbLine(near, [-(D / 2 + 0.7), 7.6, -W / 2], [-(D / 2 + 0.7), 7.6, W / 2], 1.1, [BULB, rgb(0xff7a9a), rgb(0x7ff0e8)], 1, 0.2);
    bulbLine(near, [D / 2 + 0.7, 7.6, -W / 2], [D / 2 + 0.7, 7.6, W / 2], 1.1, [BULB, rgb(0xff7a9a), rgb(0x7ff0e8)], 1, 0.2);
    bulbLine(near, [-(D / 2), 7.6, W / 2 + 0.7], [D / 2, 7.6, W / 2 + 0.7], 1.1, [BULB, rgb(0x7ff0e8)], 1, 0.2);
    bulbLine(near, [-(D / 2), 7.6, -W / 2 - 0.7], [D / 2, 7.6, -W / 2 - 0.7], 1.1, [BULB, rgb(0x7ff0e8)], 1, 0.2);
    const scooter = (k: Kit, c: RGB): void => {
      k.box(0, 0.75, 0, 1.4, 0.5, 2.0, c, shade(c, 0.85));
      k.prism(0, 0.5, 0, 1.3, 1.3, 0.25, 8, DARK, undefined, null);
      k.box(0, 1.2, -0.45, 1.2, 0.5, 0.5, shade(c, 0.8));
      k.beam([0, 1.0, -0.85], [0, 5.5, -0.85], 0.06, METAL);
      k.octa(0, 1.5, 0.1, 0.17, 0.2, 0.17, SKIN[Math.floor(rnd() * 4)]);
    };
    // stehende Scooter am Rand
    for (let k = 0; k < 4; k++) {
      near.at(scX, scY, scZ, scYaw);
      const P = near.p(-D / 2 + 1.4, 0, -W / 2 + 2 + k * 2.4);
      near.at(P[0], P[1], P[2], scYaw + Math.PI / 2);
      scooter(near, BRIGHT[(k + 3) % BRIGHT.length]);
    }
    for (let k = 0; k < (hi ? 5 : 3); k++) {
      const g = new MeshBuilder();
      scooter(new Kit(g), BRIGHT[k % BRIGHT.length]);
      scooters.push(small.add(g));
    }
    // Losbuden auf der anderen Seite (innen)
    let bi = 0;
    for (let i = 1052; i < 1132; i += 7) {
      const lat = 14.2;
      const x = LX(i, lat);
      const z = LZ(i, lat);
      if (!free(x, z, 2.3)) continue;
      near.at(x, ground(x, z) - 0.1, z, faceRoad(i, x, z));
      booth(near, 4.4, bi % 2 === 0 ? 4 : 5, BRIGHT[(bi + 2) % BRIGHT.length]);
      bi++;
    }
    // Besucher an der Halle
    for (let k = 0; k < (hi ? 10 : 5); k++) {
      near.at(scX, scY, scZ, scYaw);
      const P = near.p(-D / 2 - 1.6 - rnd() * 1.5, 0, -W / 2 + rnd() * W);
      if (free(P[0], P[2], 0.4)) visitor(far, P[0], ground(P[0], P[2]), P[2], scYaw + Math.PI / 2 + (rnd() - 0.5), rnd());
    }
  }

  // =====================================================================================
  // Geisterbahn: das schiefe Haus um die Röhre
  // =====================================================================================
  const eyes: number[] = []; // Lichter-Teil, Mitte x, y, z
  const bats: number[] = []; // Teil, Mitte x, y, z, Radius, Phase
  {
    let s0 = -1;
    let s1 = -1;
    for (let i = 0; i < t.total; i++) if (t.edge[i] & EDGE_TUNNEL) {
      if (s0 < 0) s0 = i;
      s1 = i;
    }
    if (s0 >= 0) {
      const HW = 17.5;
      const wallC = rgb(0x5a4a78);
      const wallD = rgb(0x4a3c66);
      const roofC = rgb(0x3a2f4a);
      // Seitenwände und Dach folgen der Röhre; der First schwankt (schief)
      const ridge = (i: number): number => 19 + Math.sin(i * 0.11) * 1.6 + ((i - s0) / Math.max(1, s1 - s0)) * 2;
      const step = 4;
      for (let i = s0 - 1; i < s1 + 1; i += step) {
        const j = Math.min(s1 + 1, i + step);
        for (const sgn of [-1, 1]) {
          const ax = LX(i, sgn * HW);
          const az = LZ(i, sgn * HW);
          const bx = LX(j, sgn * HW);
          const bz = LZ(j, sgn * HW);
          const ya = ground(ax, az) - 0.6;
          const yb = ground(bx, bz) - 0.6;
          const ha = 12.5 + Math.sin(i * 0.2 + sgn) * 0.8;
          const hb = 12.5 + Math.sin(j * 0.2 + sgn) * 0.8;
          const ref: V3 = [t.px[i], t.py[i] + 5, t.pz[i]];
          const c = Math.floor((i - s0) / step) % 2 ? wallC : wallD;
          near.qo([ax, ya, az], [bx, yb, bz], [bx, t.py[j] + hb, bz], [ax, t.py[i] + ha, az], c, ref);
          // Dachschräge zum First
          const rref: V3 = [t.px[i], t.py[i] + 2, t.pz[i]];
          near.qo([ax, t.py[i] + ha, az], [bx, t.py[j] + hb, bz], [LX(j, sgn * 2), t.py[j] + ridge(j), LZ(j, sgn * 2)], [LX(i, sgn * 2), t.py[i] + ridge(i), LZ(i, sgn * 2)], roofC, rref);
          // Fenster mit grünem Schein
          if ((i - s0) % 12 === 4) {
            const mx = LX(i + 2, sgn * (HW + 0.15));
            const mz = LZ(i + 2, sgn * (HW + 0.15));
            const u: V3 = [t.tx[i], 0, t.tz[i]];
            lights.disc(mx, t.py[i] + 8, mz, u, [0, 1, 0], 1.1, rgb(0x9affc0), rgb(0x40a070), 0, 4, 1.4);
          }
        }
        // Firststück
        near.qo([LX(i, -2), t.py[i] + ridge(i), LZ(i, -2)], [LX(j, -2), t.py[j] + ridge(j), LZ(j, -2)], [LX(j, 2), t.py[j] + ridge(j), LZ(j, 2)], [LX(i, 2), t.py[i] + ridge(i), LZ(i, 2)], roofC, [t.px[i], t.py[i], t.pz[i]]);
      }
      // Fassaden an Ein- und Ausfahrt mit Öffnung um den Tunnelmund
      const W = t.wh[s0] + 0.5 + 0.25;
      const H = TUNNEL_H;
      const IN: [number, number][] = [
        [-1, 0],
        [-1, 0.45 * H],
        [-0.74, 0.78 * H],
        [-0.38, 0.95 * H],
        [0, H],
        [0.38, 0.95 * H],
        [0.74, 0.78 * H],
        [1, 0.45 * H],
        [1, 0],
      ];
      const facade = (i: number, dir: number, big: boolean): void => {
        // dir = -1: Front gegen die Fahrtrichtung (Einfahrt), +1: Ausfahrt
        const yaw = yawAt(i);
        const off = dir * 0.6;
        const cx = t.px[i] + t.tx[i] * off;
        const cz = t.pz[i] + t.tz[i] * off;
        const y0 = t.py[i];
        near.at(cx, y0, cz, yaw);
        const top = big ? 26 : 21;
        // äußerer Umriss (lokal x = links): schief, mit Giebel
        const OUT: [number, number][] = [
          [-(HW + 1.5), -1.5],
          [-(HW + 1.5), 10],
          [-(HW - 2), 16 + (big ? 1 : 0)],
          [-9, top - 3.5],
          [-1.5, top],
          [7, top - 2],
          [HW - 2, 14.5],
          [HW + 1.2, 9],
          [HW + 1.2, -1.5],
        ];
        // gleiche Seite wie OUT (lokales x): Innen- und Außenumriss laufen gleichsinnig
        const lx = (k: number): number => IN[k][0] * W * 1.04;
        const ly = (k: number): number => IN[k][1] * 1.04;
        const fz = 0;
        const col = big ? rgb(0x6a5888) : wallC;
        for (let k = 0; k < IN.length - 1; k++) {
          const a: V3 = [lx(k), ly(k), fz];
          const b: V3 = [lx(k + 1), ly(k + 1), fz];
          const c: V3 = [OUT[k + 1][0], OUT[k + 1][1], fz];
          const d: V3 = [OUT[k][0], OUT[k][1], fz];
          // Front zeigt in Richtung dir
          const ref = near.p(0, 8, -dir * 3);
          near.qo(near.p(...a), near.p(...b), near.p(...c), near.p(...d), k % 2 ? col : shade(col, 0.92), ref);
          // Rückseite (ins Haus)
          const ref2 = near.p(0, 8, dir * 3);
          const bz = -dir * 0.8;
          near.qo(near.p(a[0], a[1], bz), near.p(b[0], b[1], bz), near.p(c[0], c[1], bz), near.p(d[0], d[1], bz), shade(col, 0.6), ref2);
        }
        // Lippen um den Mund und Zähne oben – alles außerhalb der Öffnung
        for (let k = 0; k < IN.length - 1; k++) {
          const a: V3 = [lx(k), ly(k), dir * 0.15];
          const b: V3 = [lx(k + 1), ly(k + 1), dir * 0.15];
          const ao: V3 = [lx(k) * (1 + 0.12), ly(k) * 1.1 + (k === 0 || k === IN.length - 1 ? 0 : 0.6), dir * 0.15];
          const bo: V3 = [lx(k + 1) * 1.12, ly(k + 1) * 1.1 + (k + 1 === IN.length - 1 ? 0 : 0.6), dir * 0.15];
          const ref = near.p(0, 4, -dir * 3);
          near.qo(near.p(...a), near.p(...b), near.p(...bo), near.p(...ao), big ? rgb(0xd04a6a) : rgb(0x9a3a5a), ref);
          if (big && k >= 1 && k <= 6) {
            // Zahn: Grundlinie am äußeren Lippenrand, Spitze genau an der Kante der Öffnung
            near.to(near.p(ao[0], ao[1], dir * 0.25), near.p(bo[0], bo[1], dir * 0.25), near.p((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, dir * 0.25), WHITE, near.p(0, 4, -dir * 3));
          }
        }
        if (!big) return;
        // Augen über dem Maul, blinzeln
        for (const sgn of [-1, 1]) {
          const P = near.p(sgn * 5, 13.2, dir * 0.3);
          const id = lights.part(true);
          const u: V3 = [near.c, 0, -near.s];
          const w: V3 = [0, 1, 0];
          lights.disc(0, 0, 0, u, w, 1.9, rgb(0xd8ff9a), rgb(0x8ae070), 0, 10, 1.3);
          lights.disc(t.tx[i] * dir * 0.08 - sgn * u[0] * 0.35, -0.15, t.tz[i] * dir * 0.08 - sgn * u[2] * 0.35, u, w, 0.6, rgb(0x1a1020), rgb(0x1a1020), 0, 6, 0.9);
          lights.use(0);
          eyes.push(id, P[0], P[1], P[2]);
          halo(P[0] - t.tx[i] * dir * 0.15, P[1], P[2] - t.tz[i] * dir * 0.15, 3.6, rgb(0x305a20), u, w);
          // Augenbrauen
          near.beam([sgn * 6.8, 15.3 + (sgn > 0 ? 0.3 : 0), dir * 0.3], [sgn * 3.2, 14.7, dir * 0.3], 0.5, DARK);
        }
        // Spitzdach-Türmchen mit Wetterhahn-Fledermaus
        near.at(cx, y0, cz, yaw);
        near.box(-12, top - 2, dir * -4, 4, 6, 4, wallD);
        near.prism(-12, top + 1, dir * -4, 3.4, 0, 5, 4, roofC, undefined, undefined, Math.PI / 4 + 0.15);
        // Schild-Rahmen aus grünem Licht
        bulbLine(near, [-(HW + 1.3), 10, dir * 0.3], [-(HW - 2), 16.9, dir * 0.3], 0.8, [rgb(0x9affc0), rgb(0xd0a0ff)], 4, 0.2);
        bulbLine(near, [-(HW - 2), 16.9, dir * 0.3], [-9, top - 3.5, dir * 0.3], 0.8, [rgb(0x9affc0), rgb(0xd0a0ff)], 4, 0.2);
        bulbLine(near, [-9, top - 3.5, dir * 0.3], [-1.5, top, dir * 0.3], 0.8, [rgb(0x9affc0), rgb(0xd0a0ff)], 4, 0.2);
        bulbLine(near, [-1.5, top, dir * 0.3], [7, top - 2, dir * 0.3], 0.8, [rgb(0x9affc0), rgb(0xd0a0ff)], 4, 0.2);
        bulbLine(near, [7, top - 2, dir * 0.3], [HW - 2, 14.5, dir * 0.3], 0.8, [rgb(0x9affc0), rgb(0xd0a0ff)], 4, 0.2);
        bulbLine(near, [HW - 2, 14.5, dir * 0.3], [HW + 1.1, 9, dir * 0.3], 0.8, [rgb(0x9affc0), rgb(0xd0a0ff)], 4, 0.2);
        // Kürbisse/Laternen am Fuß
        for (const sgn of [-1, 1]) {
          const P = near.p(sgn * (HW - 3), 0, dir * 2.5);
          const gy = ground(P[0], P[2]);
          near.at(P[0], gy, P[2], yaw);
          near.octa(0, 0.6, 0, 0.8, 0.6, 0.8, ORANGE, rgb(0xc05a20));
          near.box(0, 1.25, 0, 0.12, 0.3, 0.12, rgb(0x3a6a3a));
          lights.disc(P[0] + t.tx[i] * dir * 0.82, gy + 0.65, P[2] + t.tz[i] * dir * 0.82, [Math.cos(yaw), 0, -Math.sin(yaw)], [0, 1, 0], 0.35, rgb(0xffd080), rgb(0xff9040), 0, 3);
          near.at(cx, y0, cz, yaw);
        }
      };
      facade(s0, -1, true);
      facade(s1, 1, false);
      // Fledermäuse um das Dach
      const mid = Math.floor((s0 + s1) / 2);
      for (let b = 0; b < (hi ? 6 : 3); b++) {
        const g = new MeshBuilder();
        const gk = new Kit(g);
        const c = rgb(0x231a30);
        gk.octa(0, 0, 0, 0.3, 0.3, 0.5, c);
        gk.tri2([0.2, 0, 0.3], [1.6, 0.2, 0.0], [0.2, 0, -0.3], c);
        gk.tri2([1.6, 0.2, 0.0], [1.1, -0.1, -0.5], [0.2, 0, -0.3], c);
        gk.tri2([-0.2, 0, 0.3], [-1.6, 0.2, 0.0], [-0.2, 0, -0.3], c);
        gk.tri2([-1.6, 0.2, 0.0], [-1.1, -0.1, -0.5], [-0.2, 0, -0.3], c);
        gk.tri2([-0.15, 0.25, 0.35], [-0.05, 0.25, 0.35], [-0.15, 0.55, 0.3], c);
        gk.tri2([0.05, 0.25, 0.35], [0.15, 0.25, 0.35], [0.15, 0.55, 0.3], c);
        bats.push(small.add(g, 2, 0.5, 11 + b, b), t.px[mid] + (b % 2 ? 6 : -6), t.py[mid] + 22 + b * 0.8, t.pz[mid], 9 + b * 2.2, b * 1.7);
      }
    }
  }

  // =====================================================================================
  // Budengasse: Buden dicht an dicht, Hau-den-Lukas, Lichterketten über der Bahn
  // =====================================================================================
  const lukas: number[] = []; // Schlitten-Teil, Glocken-Lichtteil, x, y, z, Phase
  {
    let bi = 0;
    for (const sgn of [-1, 1]) {
      let lastX = Infinity;
      let lastZ = Infinity;
      for (let i = 1240; i < 1436; i++) {
        const lat = sgn * 14.2;
        const x = LX(i, lat);
        const z = LZ(i, lat);
        if (Math.hypot(x - lastX, z - lastZ) < 5.2) continue;
        if (!free(x, z, 2.6)) continue;
        lastX = x;
        lastZ = z;
        const y = ground(x, z) - 0.1;
        const kind = bi % 7;
        const c = BRIGHT[(bi * 3) % BRIGHT.length];
        near.at(x, y, z, faceRoad(i, x, z));
        if (kind === 6 && lukas.length < 12) {
          // Hau-den-Lukas: Mast mit Skala, Glocke oben, Amboss unten
          near.box(0, 0.3, 1, 2, 0.6, 1.4, rgb(0x6a6a7a));
          near.box(0, 4.6, 0, 0.7, 9.2, 0.5, WHITE);
          for (let s = 0; s < 6; s++) near.box(0, 1.3 + s * 1.4, 0.27, 0.72, 0.7, 0.05, [RED, ORANGE, PINK, VIOLET, TURQ, BLUE][s]);
          near.prism(0, 9.2, 0, 0.6, 0.2, 0.8, 8, rgb(0xe8c070));
          near.box(0, 0.9, 1.2, 0.8, 0.4, 0.8, DARK);
          const g = new MeshBuilder();
          new Kit(g).box(0, 0, 0, 0.9, 0.35, 0.4, RED);
          const sled = small.add(g);
          const bell = lights.part(false);
          const P = near.p(0, 9.5, 0);
          lights.bulb(P[0], P[1], P[2], 0.55, rgb(0xfff0c0), 0);
          lights.use(0);
          liveL.push(bell);
          const Q = near.p(0, 0, 0.5);
          lukas.push(sled, bell, Q[0], y, Q[2], rnd() * 9);
          // daneben ein Kraftprotz mit Hammer
          const R = near.p(1.4, 0, 1.6);
          far.at(R[0], y, R[2], faceRoad(i, x, z) + Math.PI);
          person(far, 0, 0, 0, 1.08);
          far.beam([0.3, 1.2, 0.2], [0.3, 2.4, -0.2], 0.08, WOOD);
          far.box(0.3, 2.45, -0.25, 0.6, 0.35, 0.35, DARK);
        } else booth(near, 4.6, kind % 6, c);
        // Besucher vor der Bude
        if (rnd() < (hi ? 0.6 : 0.3)) {
          const P = near.p((rnd() - 0.5) * 2.5, 0, 2.6 + rnd() * 0.4);
          if (free(P[0], P[2], 0.2)) visitor(far, P[0], ground(P[0], P[2]), P[2], faceRoad(i, x, z) + Math.PI + (rnd() - 0.5) * 0.8, rnd());
        }
        bi++;
      }
    }
    // Lichterketten über der Gasse (tiefster Punkt gut 11 m über der Fahrbahn)
    for (let i = 1246; i < 1436; i += 16) {
      const a = mast(LX(i, -11.8), LZ(i, -11.8), 13.3);
      const b = mast(LX(i, 11.8), LZ(i, 11.8), 13.3);
      chain(a, b, 1.4, hi ? 1.5 : 2.8, [BULB, rgb(0xff7a9a), BULB, rgb(0x7ff0e8), rgb(0xffb070)], true);
    }
  }

  // =====================================================================================
  // Ferne: Stadt mit Fenstern, Heißluftballon, Feuerwerk
  // =====================================================================================
  {
    const cx = world.center.x;
    const cz = world.center.z;
    const nB = hi ? 56 : 22;
    for (let b = 0; b < nB; b++) {
      // Stadt im Osten (am Lift links) und ein Stück im Nordosten
      const a = -1.2 + (b / nB) * 2.1 + (rnd() - 0.5) * 0.03;
      const d = 540 + rnd() * 80;
      const x = cx + Math.cos(a) * d;
      const z = cz + Math.sin(a) * d;
      const h = 14 + rnd() * rnd() * 50;
      const w = 14 + rnd() * 16;
      const dd = 10 + rnd() * 10;
      const yaw = Math.atan2(cx - x, cz - z);
      // im Dunst: zum Abendhimmel hin aufgehellt
      const c = mixRgb(mixRgb(rgb(0x5a4a7a), rgb(0x8a6a8a), rnd()), rgb(0xe8a28e), 0.3);
      far.at(x, 0, z, yaw);
      far.box(0, h / 2 - 2, 0, w, h + 4, dd, c, shade(c, 0.8));
      if (rnd() < 0.3) far.prism(0, h + 2, 0, w * 0.3, 0, 8, 4, shade(c, 0.85));
      // Fenster zur Rummelseite: erleuchtete Bänder je Stockwerk
      const rows = Math.floor(h / 7);
      for (let r = 0; r < rows; r++) {
        if (rnd() < (hi ? 0.4 : 0.65)) continue;
        const f0 = rnd() * 0.4;
        const f1 = 0.6 + rnd() * 0.4;
        const A = far.p(-w / 2 + w * f0, 4 + r * 7, dd / 2 + 0.3);
        const B = far.p(-w / 2 + w * f1, 4 + r * 7, dd / 2 + 0.3);
        const len = Math.hypot(B[0] - A[0], B[2] - A[2]) / 2;
        lights.disc((A[0] + B[0]) / 2, A[1], (A[2] + B[2]) / 2, [Math.cos(yaw), 0, -Math.sin(yaw)], [0, 1, 0], len, rnd() < 0.8 ? rgb(0xffd890) : rgb(0xbfe0ff), rgb(0xe8a060), 0, 4, 1.2);
      }
    }
  }
  // Heißluftballon
  let hotAir = -1;
  {
    const g = new MeshBuilder();
    const gk = new Kit(g);
    const cols = [RED, WHITE, TURQ, WHITE, PINK, WHITE, VIOLET, WHITE];
    gk.prism(0, 0, 0, 3, 7.5, 6, 8, cols[0], cols[1], null);
    gk.prism(0, 6, 0, 7.5, 7.5, 4, 8, cols[2], cols[3], null);
    gk.prism(0, 10, 0, 7.5, 0.5, 6.5, 8, cols[4], cols[5]);
    gk.box(0, -3.2, 0, 1.8, 1.4, 1.8, WOOD);
    for (const sx0 of [-0.8, 0.8]) for (const sz0 of [-0.8, 0.8]) gk.beam([sx0, -2.5, sz0], [sx0 * 3, 0.2, sz0 * 3], 0.06, DARK);
    hotAir = mov.add(g);
  }
  // Feuerwerk: Blüten am fernen Himmel, weich auf- und abgeblendet
  const blooms: number[] = []; // Glow-Teil
  const NBLOOM = 3;
  {
    for (let b = 0; b < NBLOOM; b++) {
      const id = glow.part(true);
      const col = [rgb(0xff6aa0), rgb(0x6af0e0), rgb(0xc89aff)][b];
      const n = 14;
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2;
        glow.disc(Math.cos(a) * 1, Math.sin(a) * 1, 0, [1, 0, 0], [0, 1, 0], 0.14, col, [0, 0, 0], 0, 6);
        glow.disc(Math.cos(a + 0.2) * 0.6, Math.sin(a + 0.2) * 0.6, 0, [1, 0, 0], [0, 1, 0], 0.1, mixRgb(col, [1, 1, 1], 0.5), [0, 0, 0], 0, 6);
      }
      glow.disc(0, 0, 0, [1, 0, 0], [0, 1, 0], 0.9, shade(col, 0.35), [0, 0, 0], 0, 10);
      glow.use(0);
      blooms.push(id);
      liveG.push(id);
    }
  }

  // =====================================================================================
  // Netze
  // =====================================================================================
  const addStatic = (b: MeshBuilder, outline: boolean): void => {
    if (b.empty) return;
    const g = b.build();
    const m = new THREE.Mesh(g, toon);
    group.add(m);
    disposables.push(g);
    if (outline) {
      addSmoothNormals(g);
      const o = new THREE.Mesh(g, outlineMaterial(0.05));
      o.name = 'outline';
      o.matrixAutoUpdate = false;
      m.add(o);
    }
  };
  addStatic(nearB, hi);
  addStatic(farB, false);

  const movGeo = mov.build();
  const movMesh = new THREE.Mesh(movGeo, toon);
  movMesh.frustumCulled = false;
  group.add(movMesh);
  disposables.push(movGeo);
  if (hi) {
    const o = new THREE.Mesh(movGeo, outlineMaterial(0.045));
    o.name = 'outline';
    o.frustumCulled = false;
    o.matrixAutoUpdate = false;
    movMesh.add(o);
  }

  const smallGeo = small.build();
  const smallMesh = new THREE.Mesh(smallGeo, toon);
  smallMesh.frustumCulled = false;
  group.add(smallMesh);
  disposables.push(smallGeo);

  const bulbGeo = lights.build();
  const bulbMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const bulbMesh = new THREE.Mesh(bulbGeo, bulbMat);
  bulbMesh.frustumCulled = false;
  group.add(bulbMesh);
  disposables.push(bulbGeo, bulbMat);

  const glowGeo = glow.build();
  const glowMat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: false,
    forceSinglePass: true,
  });
  const glowMesh = new THREE.Mesh(glowGeo, glowMat);
  glowMesh.frustumCulled = false;
  glowMesh.renderOrder = 4;
  group.add(glowMesh);
  disposables.push(glowGeo, glowMat);

  const liveLA = new Int32Array(Math.max(1, liveL.length));
  liveLA.set(liveL);
  const liveGA = new Int32Array(Math.max(1, liveG.length));
  liveGA.set(liveG);
  const nBalloon = balloons.length / 5;
  const nArm = arms.length / 6;
  const nFlag = flags.length / 5;
  const nLukas = lukas.length / 6;
  const nBat = bats.length / 6;
  const nEye = eyes.length / 4;
  /** Ein Ballon reißt sich ab und zu los: Index des Ballons je Zyklus. */
  const LOOSE_PERIOD = 26;
  const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
  const tmpA = new THREE.Matrix4();
  const tmpB = new THREE.Matrix4();
  const axisZ = new THREE.Vector3(0, 0, 1);

  const pose = (x: number, y: number, z: number, yaw: number, pitch = 0, roll = 0, s = 1): THREE.Matrix4 => {
    e.set(pitch, yaw, roll);
    q.setFromEuler(e);
    v.set(x, y, z);
    sc.setScalar(s);
    return m4.compose(v, q, sc);
  };

  const update = (time: number): void => {
    // --- Riesenrad: eine Umdrehung in 100 s ---
    const wa = (time / 100) * Math.PI * 2;
    tmpA.makeRotationAxis(axisZ, wa);
    m5.multiplyMatrices(wheelBasis, tmpA);
    m5.setPosition(wheelHub);
    mov.set(wheelPart, m5);
    lights.set(wheelLights, m5);
    for (let s = 0; s < gondolas.length; s++) {
      const a = wa + (s / WHEEL.n) * Math.PI * 2;
      // Kranzpunkt in der Radebene
      tmpB.makeRotationAxis(axisZ, Math.sin(time * 0.9 + s) * 0.04);
      m5.multiplyMatrices(wheelBasis, tmpB);
      v.set(Math.cos(a) * WHEEL.R, Math.sin(a) * WHEEL.R, 0).applyMatrix4(wheelBasis).add(wheelHub);
      m5.setPosition(v);
      mov.set(gondolas[s], m5);
    }
    // --- Kettenkarussell ---
    const cw = 0.95;
    const ca = time * cw;
    const wob = Math.sin(time * 0.5) * 0.05;
    pose(CH.x, chainY + CH.top, CH.z, ca, wob, 0);
    mov.set(chainCrown, m4);
    lights.set(chainLights, m4);
    for (let s = 0; s < chainSeats.length; s++) {
      const a = ca + (s / chainSeats.length) * Math.PI * 2;
      const x = CH.x + Math.cos(a) * CH.r;
      const z = CH.z - Math.sin(a) * CH.r;
      // Sitz hängt nach außen geschwungen (lokal +x zeigt nach außen)
      pose(x, chainY + CH.top + 0.1, z, a, 0, 0.62 + Math.sin(time * 1.3 + s) * 0.03);
      small.set(chainSeats[s], m4);
    }
    // --- Karussell ---
    const ka = time * 0.45;
    pose(CAR.x, carY, CAR.z, ka);
    mov.set(carPart, m4);
    lights.set(carLights, m4);
    for (let k = 0; k < animals.length; k++) {
      const a = ka + (k / animals.length) * Math.PI * 2;
      const x = CAR.x + Math.cos(a) * 4.8;
      const z = CAR.z - Math.sin(a) * 4.8;
      pose(x, carY + 2.4 + Math.sin(time * 2.2 + k * 1.7) * 0.35, z, a + Math.PI);
      mov.set(animals[k], m4);
    }
    // --- Tretboote ---
    for (let b = 0; b < boats.length; b++) {
      const ds = b % 2 ? -1 : 1;
      const a = time * 0.12 * ds + b * 1.7;
      const r = POND.r * (0.35 + 0.17 * b);
      const x = POND.x + Math.cos(a) * r;
      const z = POND.z + Math.sin(a) * r;
      const yaw = Math.atan2(-ds * Math.sin(a), ds * Math.cos(a));
      pose(x, pondY + 0.05 + Math.sin(time * 1.4 + b) * 0.05, z, yaw, 0, Math.sin(time * 1.1 + b) * 0.04);
      small.set(boats[b], m4);
    }
    // --- Autoscooter: Kreise in der Halle ---
    for (let k = 0; k < scooters.length; k++) {
      const a = time * (0.55 + k * 0.07) + k * 2.1;
      const rx = 3 + (k % 2) * 1.2;
      const rz = (6 + k * 0.7) * (k % 2 ? 1 : -1);
      const lx = Math.cos(a) * rx;
      const lz = Math.sin(a) * rz;
      const c = Math.cos(scYaw);
      const s = Math.sin(scYaw);
      const x = scX + lx * c + lz * s;
      const z = scZ - lx * s + lz * c;
      pose(x, scY, z, scYaw + Math.atan2(-Math.sin(a) * rx, Math.cos(a) * rz));
      small.set(scooters[k], m4);
    }
    // --- Fahnen (flattern über die Ecken) ---
    for (let f = 0; f < nFlag; f++) {
      const o = f * 5;
      pose(flags[o + 1], flags[o + 2], flags[o + 3], flags[o + 4] + Math.sin(time * 0.4 + f) * 0.2);
      small.set(flags[o], m4);
    }
    // --- Luftballons: wippen; einer reißt sich je Zyklus los und steigt ---
    const cyc = Math.floor(time / LOOSE_PERIOD);
    const ct = time - cyc * LOOSE_PERIOD;
    const loose = nBalloon > 0 ? (cyc * 7) % nBalloon : -1;
    for (let b = 0; b < nBalloon; b++) {
      const o = b * 5;
      const ph = balloons[o + 4];
      let x = balloons[o + 1];
      let y = balloons[o + 2] + Math.sin(time * 1.3 + ph) * 0.08;
      let z = balloons[o + 3];
      let pitch = Math.sin(time * 0.9 + ph) * 0.12;
      let s = 1;
      if (b === loose) {
        if (ct < 16) {
          // steigt in 16 s gut 70 m und treibt ab
          const k = ct;
          y += k * 4.5;
          x += k * 1.6;
          z += Math.sin(k * 0.6) * 2;
          pitch = Math.sin(k * 2) * 0.25;
          s = 1 - smooth((k - 13) / 3);
        } else s = smooth((ct - 22) / 2);
      }
      if (s <= 0.001) small.set(balloons[o], hidden);
      else small.set(balloons[o], pose(x, y, z, ph, pitch, Math.cos(time * 1.1 + ph) * 0.1, s));
    }
    // --- Winken ---
    for (let a = 0; a < nArm; a++) {
      const o = a * 6;
      const ph = arms[o + 5];
      const on = Math.sin(time * 0.35 + ph) > 0.2 ? 1 : 0.25;
      pose(arms[o + 1], arms[o + 2], arms[o + 3], arms[o + 4], 0, -2.4 - on * Math.sin(time * 7 + ph) * 0.45);
      small.set(arms[o], m4);
    }
    // --- Hau-den-Lukas: gelegentlich saust der Schlitten hoch ---
    for (let k = 0; k < nLukas; k++) {
      const o = k * 6;
      const T = 9;
      const lt = (time + lukas[o + 5]) % T;
      let h = 0;
      if (lt < 0.45) h = smooth(lt / 0.45) * (k % 2 ? 8.3 : 6.2);
      else if (lt < 2.2) h = (1 - smooth((lt - 0.45) / 1.75)) * (k % 2 ? 8.3 : 6.2);
      pose(lukas[o + 2], lukas[o + 3] + 1.0 + h, lukas[o + 4], 0);
      small.set(lukas[o], m4);
      // Glocke leuchtet nach dem Treffer weich auf
      lights.bright[lukas[o + 1]] = lt > 0.4 && lt < 2.4 ? 1.6 - 0.6 * smooth((lt - 0.4) / 2) : 0.55;
    }
    // --- Fledermäuse ---
    for (let b = 0; b < nBat; b++) {
      const o = b * 6;
      const a = time * 0.5 + bats[o + 5];
      const r = bats[o + 4];
      const x = bats[o + 1] + Math.cos(a) * r;
      const z = bats[o + 3] + Math.sin(a) * r * 1.6;
      pose(x, bats[o + 2] + Math.sin(time * 1.7 + b) * 1.2, z, Math.atan2(-Math.sin(a), Math.cos(a) * 1.6) + Math.PI, 0, 0.3);
      small.set(bats[o], m4);
    }
    // --- Augen blinzeln (weich, etwa alle 5 s) ---
    for (let k = 0; k < nEye; k++) {
      const o = k * 4;
      const bt = (time + (k >> 1) * 2.3) % 5.2;
      const lid = bt < 0.5 ? 1 - Math.sin((bt / 0.5) * Math.PI) * 0.92 : 1;
      m4.makeScale(1, lid, 1);
      m4.setPosition(eyes[o + 1], eyes[o + 2], eyes[o + 3]);
      lights.set(eyes[o], m4);
    }
    // --- Heißluftballon: zieht in 300 s am Horizont entlang ---
    {
      const f = (time / 300) % 1;
      const a = 2.1 + f * 1.6;
      const d = 330;
      const x = world.center.x + Math.cos(a) * d;
      const z = world.center.z + Math.sin(a) * d;
      pose(x, 80 + Math.sin(time * 0.05) * 6, z, f * 2, 0, 0, 1.5);
      mov.set(hotAir, m4);
    }
    // --- Feuerwerk: drei Blüten im Wechsel, je 6 s, weich auf und ab ---
    for (let b = 0; b < blooms.length; b++) {
      const T = 6.5;
      const tt = time + b * (T / blooms.length) * 1.0 + b * 0.37;
      const n = Math.floor(tt / T);
      const ft = (tt - n * T) / T;
      const h = Math.sin(n * 12.9898 + b * 78.233) * 43758.5453;
      const r1 = h - Math.floor(h);
      const a = 2.0 + r1 * 2.6 + b * 0.4;
      const d = 520 + r1 * 60;
      const x = world.center.x + Math.cos(a) * d;
      const z = world.center.z + Math.sin(a) * d;
      const y = 70 + r1 * 50 + ft * 6;
      const grow = 4 + smooth(ft * 2.2) * 6;
      const yaw = Math.atan2(world.center.x - x, world.center.z - z);
      pose(x, y, z, yaw, 0, 0, grow);
      glow.set(blooms[b], m4);
      const fade = smooth(ft / 0.2) * (1 - smooth((ft - 0.35) / 0.45));
      glow.bright[blooms[b]] = fade * 0.38;
    }
  };

  // Erste Lage, dann Farben
  update(0);
  mov.update(0);
  small.update(0);
  lights.repaintAll(0);
  glow.repaintAll(0);

  return {
    group,
    update(time: number): void {
      update(time);
      mov.update(time);
      small.update(time);
      lights.flush();
      glow.flush();
      // Lauflichter: 2,5 Schritte je Sekunde
      const step = Math.floor(time * 2.5);
      lights.recolor(step, liveLA, liveL.length);
      glow.recolor(step, liveGA, liveG.length);
    },
    dispose(): void {
      for (const d of disposables) d.dispose();
    },
  };
}
