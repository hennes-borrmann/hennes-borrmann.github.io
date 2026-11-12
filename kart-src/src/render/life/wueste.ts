// Kulisse des Wüstenexpress: Canyonland in der Mittagshitze, durch das die Bahnlinie läuft.
//
// Rote Tafelberge und Felsnadeln mit waagrechten Gesteinsbändern, oben heller Kalk; im Canyon
// stehen die Wände nah an der Strecke, über das Viadukt hinweg öffnet sich eine Schlucht mit
// trockenem Flussbett, auf der Hochebene wird es weit. Dazu der Bahnhof der Wüstenstadt mit
// Bahnsteig, Wasserturm, Stellwerk und Uhr, gegenüber die Stadt aus Lehmhäusern, Markt und Tribüne;
// Telegrafenleitung und Signale am Gleis, Minenstollen, Felsbogen, Windrad, Ranch, Ballon.
//
// Gebaut wird nur mit dem, was überall läuft: Netze aus Flächen mit Eckenfarben (Toon-Material,
// Tuschekontur) und Netze, deren Ecken je Bild neu gesetzt werden (alles, was sich bewegt, hängt
// in einem „Gestell“: starre Teile, die je Bild verschoben und gedreht werden). Keine Texturen,
// keine eigenen Shader, keine Lichter.
//
// Alles steht auf dem Gelände, mindestens 3 m neben der Bande; über der Fahrbahn nur der Felsbogen
// (Unterkante über 14 m) und die Wimpelketten (über 10 m). Was sich bewegt, ist eine reine
// Funktion der Zeit.

import * as THREE from 'three';
import { EDGE_DECK, EDGE_TUNNEL, rightX, rightZ } from '../../game/track';
import { MeshBuilder, noise, seeded, shade, smooth, type RGB, type V3 } from '../build';
import type { Life } from '../life';
import { addSmoothNormals, outlineMaterial, rgb, toonMaterial } from '../toon';
import { TUNNEL_H, type World } from '../world';

// --- Farben -------------------------------------------------------------------------
const C = {
  // Gesteinsbänder (von dunkel nach hell) und Kalk obenauf
  rock: [rgb(0xa8432f), rgb(0xc4573a), rgb(0xd8774a), rgb(0xb84c34), rgb(0xe0956a)] as RGB[],
  ledge: rgb(0xe9a77a),
  cap: rgb(0xf1dcb4),
  capDark: rgb(0xe2c597),
  scree: rgb(0xd99c70),
  sand: rgb(0xf2d8a4),
  far: [rgb(0xc8735a), rgb(0xd88d6c), rgb(0xb8644e)] as RGB[],
  // Holz, Lehm, Stein
  wood: rgb(0x8a5a34),
  woodLight: rgb(0xb07a48),
  woodDark: rgb(0x5e3c22),
  adobe: rgb(0xe39c7c),
  adobeLight: rgb(0xf6efe2),
  adobeDark: rgb(0xb8694c),
  ochre: rgb(0xe2ad52),
  stone: rgb(0xbfae95),
  stoneDark: rgb(0x9c8a72),
  dark: rgb(0x2e2230),
  window: rgb(0x3b4a66),
  white: rgb(0xf6f1e6),
  red: rgb(0xd9483b),
  yellow: rgb(0xf2c23a),
  teal: rgb(0x2fa6a0),
  blue: rgb(0x3f6fc4),
  green: rgb(0x5f9a4a),
  greenDark: rgb(0x47803c),
  olive: rgb(0x8c9a52),
  bone: rgb(0xf3ead6),
  metal: rgb(0x6d7682),
  ink: rgb(0x2a2026),
  tumble: rgb(0xb39360),
  river: rgb(0x5fb3dc),
  riverbed: rgb(0xeadbb8),
  wire: rgb(0x3a2e2a),
};

/** Kleidung der Leute: Hemd, Hose, Hut. */
const CLOTHES: [number, number, number][] = [
  [0xd9483b, 0x3f4a6a, 0xe8d3a0],
  [0x2fa6a0, 0x6a4a34, 0x8a5a34],
  [0xf2c23a, 0x4a3a52, 0xd9b27a],
  [0x7a5ad1, 0x3f4a6a, 0xf3ead6],
  [0xf3ead6, 0x8a5a34, 0x5e3c22],
  [0x4f8fd8, 0x5a4636, 0xe8d3a0],
  [0xe07a3a, 0x2f3a4a, 0xc9a06a],
];
const SKIN = [0xe8b48c, 0xc48a62, 0x9c6a48, 0xf0c8a0];

/** Ein starres Teil des Gestells: Eckenbereich, Lage, Drehung, Größe, Flattern. */
interface Part {
  v0: number;
  v1: number;
  p: THREE.Vector3;
  q: THREE.Quaternion;
  s: number;
  /** > 0: Fahne – die Ecken schwingen entlang der lokalen x-Achse. */
  wave: number;
  phase: number;
}

/**
 * Gestell: viele kleine, starre Teile in einem Netz. Jedes Teil wird einmal in eigenen
 * Koordinaten gebaut; je Bild werden seine Ecken (samt Normalen und Konturnormalen) neu gesetzt.
 */
class Rig {
  private readonly pos: number[] = [];
  private readonly nor: number[] = [];
  private readonly onr: number[] = [];
  private readonly col: number[] = [];
  readonly parts: Part[] = [];
  private basePos!: Float32Array;
  private baseNor!: Float32Array;
  private baseOn!: Float32Array;
  private livePos!: THREE.BufferAttribute;
  private liveNor!: THREE.BufferAttribute;
  private liveOn!: THREE.BufferAttribute;
  private readonly m = new THREE.Matrix4();

  add(b: MeshBuilder, wave = 0, phase = 0): Part {
    const g = addSmoothNormals(b.build());
    const p = g.getAttribute('position');
    const n = g.getAttribute('normal');
    const o = g.getAttribute('onormal');
    const c = g.getAttribute('color');
    const v0 = this.pos.length / 3;
    for (let i = 0; i < p.count; i++) {
      this.pos.push(p.getX(i), p.getY(i), p.getZ(i));
      this.nor.push(n.getX(i), n.getY(i), n.getZ(i));
      this.onr.push(o.getX(i), o.getY(i), o.getZ(i));
      this.col.push(c.getX(i), c.getY(i), c.getZ(i));
    }
    g.dispose();
    const part: Part = { v0, v1: this.pos.length / 3, p: new THREE.Vector3(), q: new THREE.Quaternion(), s: 1, wave, phase };
    this.parts.push(part);
    return part;
  }

  get triangles(): number {
    return this.pos.length / 9;
  }

  build(): THREE.BufferGeometry {
    this.basePos = new Float32Array(this.pos);
    this.baseNor = new Float32Array(this.nor);
    this.baseOn = new Float32Array(this.onr);
    const geo = new THREE.BufferGeometry();
    this.livePos = new THREE.BufferAttribute(new Float32Array(this.pos), 3).setUsage(THREE.DynamicDrawUsage);
    this.liveNor = new THREE.BufferAttribute(new Float32Array(this.nor), 3).setUsage(THREE.DynamicDrawUsage);
    this.liveOn = new THREE.BufferAttribute(new Float32Array(this.onr), 3).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.livePos);
    geo.setAttribute('normal', this.liveNor);
    geo.setAttribute('onormal', this.liveOn);
    geo.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    return geo;
  }

  /** Setzt alle Ecken nach Lage und Drehung der Teile. */
  apply(time: number): void {
    const bp = this.basePos;
    const bn = this.baseNor;
    const bo = this.baseOn;
    const lp = this.livePos.array as Float32Array;
    const ln = this.liveNor.array as Float32Array;
    const lo = this.liveOn.array as Float32Array;
    const e = this.m.elements;
    for (let pi = 0; pi < this.parts.length; pi++) {
      const part = this.parts[pi];
      this.m.makeRotationFromQuaternion(part.q);
      const s = part.s;
      const px = part.p.x;
      const py = part.p.y;
      const pz = part.p.z;
      for (let v = part.v0; v < part.v1; v++) {
        const k = v * 3;
        const x = bp[k];
        const y = bp[k + 1];
        let z = bp[k + 2];
        if (part.wave > 0) z += Math.sin(time * 6.5 - x * 2.4 + part.phase) * part.wave * x;
        lp[k] = (e[0] * x + e[4] * y + e[8] * z) * s + px;
        lp[k + 1] = (e[1] * x + e[5] * y + e[9] * z) * s + py;
        lp[k + 2] = (e[2] * x + e[6] * y + e[10] * z) * s + pz;
        const nx = bn[k];
        const ny = bn[k + 1];
        const nz = bn[k + 2];
        ln[k] = e[0] * nx + e[4] * ny + e[8] * nz;
        ln[k + 1] = e[1] * nx + e[5] * ny + e[9] * nz;
        ln[k + 2] = e[2] * nx + e[6] * ny + e[10] * nz;
        const ox = bo[k];
        const oy = bo[k + 1];
        const oz = bo[k + 2];
        lo[k] = e[0] * ox + e[4] * oy + e[8] * oz;
        lo[k + 1] = e[1] * ox + e[5] * oy + e[9] * oz;
        lo[k + 2] = e[2] * ox + e[6] * oy + e[10] * oz;
      }
    }
    this.livePos.needsUpdate = true;
    this.liveNor.needsUpdate = true;
    this.liveOn.needsUpdate = true;
  }
}

// --- Flächen mit sicherer Ausrichtung ------------------------------------------------

/** Viereck, dessen sichtbare Seite in Richtung (ox, oy, oz) zeigt. */
function quadO(b: MeshBuilder, a: V3, c1: V3, c2: V3, d: V3, ox: number, oy: number, oz: number, col: RGB): void {
  const ux = c1[0] - a[0];
  const uy = c1[1] - a[1];
  const uz = c1[2] - a[2];
  const vx = c2[0] - a[0];
  const vy = c2[1] - a[1];
  const vz = c2[2] - a[2];
  const nx = uy * vz - uz * vy;
  const ny = uz * vx - ux * vz;
  const nz = ux * vy - uy * vx;
  if (nx * ox + ny * oy + nz * oz >= 0) b.quad(a, c1, c2, d, col);
  else b.quad(a, d, c2, c1, col);
}

function triO(b: MeshBuilder, a: V3, c1: V3, c2: V3, ox: number, oy: number, oz: number, col: RGB): void {
  const ux = c1[0] - a[0];
  const uy = c1[1] - a[1];
  const uz = c1[2] - a[2];
  const vx = c2[0] - a[0];
  const vy = c2[1] - a[1];
  const vz = c2[2] - a[2];
  const nx = uy * vz - uz * vy;
  const ny = uz * vx - ux * vz;
  const nz = ux * vy - uy * vx;
  if (nx * ox + ny * oy + nz * oz >= 0) b.tri(a, c1, c2, col);
  else b.tri(a, c2, c1, col);
}

/**
 * Dünne Fläche mit zwei Seiten (Dach, Tuch, Fahne): Vorderseite a→b→c(→d) gegen den Uhrzeigersinn,
 * die Rückseite 4 cm dahinter. Lägen beide Seiten aufeinander, zeichnete die Kontur (die Rückseiten
 * in Tusche) genau darüber – die Fläche käme schwarz heraus.
 */
const SHEET = 0.04;
function sheetRaw(b: MeshBuilder, pts: V3[], col: RGB, back: RGB): void {
  const [a, c1, c2] = pts;
  const ux = c1[0] - a[0];
  const uy = c1[1] - a[1];
  const uz = c1[2] - a[2];
  const vx = c2[0] - a[0];
  const vy = c2[1] - a[1];
  const vz = c2[2] - a[2];
  let nx = uy * vz - uz * vy;
  let ny = uz * vx - ux * vz;
  let nz = ux * vy - uy * vx;
  const l = Math.hypot(nx, ny, nz) || 1;
  nx = (nx / l) * SHEET;
  ny = (ny / l) * SHEET;
  nz = (nz / l) * SHEET;
  const o = (p: V3): V3 => [p[0] - nx, p[1] - ny, p[2] - nz];
  if (pts.length === 4) {
    b.quad(a, c1, c2, pts[3], col);
    b.quad(o(a), o(pts[3]), o(c2), o(c1), back);
  } else {
    b.tri(a, c1, c2, col);
    b.tri(o(a), o(c2), o(c1), back);
  }
}
/** Wie sheetRaw, die Vorderseite zeigt nach (ox, oy, oz). */
function sheetO(b: MeshBuilder, pts: V3[], ox: number, oy: number, oz: number, col: RGB, back: RGB): void {
  const [a, c1, c2] = pts;
  const nx = (c1[1] - a[1]) * (c2[2] - a[2]) - (c1[2] - a[2]) * (c2[1] - a[1]);
  const ny = (c1[2] - a[2]) * (c2[0] - a[0]) - (c1[0] - a[0]) * (c2[2] - a[2]);
  const nz = (c1[0] - a[0]) * (c2[1] - a[1]) - (c1[1] - a[1]) * (c2[0] - a[0]);
  sheetRaw(b, nx * ox + ny * oy + nz * oz >= 0 ? pts : [...pts].reverse(), col, back);
}

/** Balken mit quadratischem Querschnitt von a nach c (ohne Stirnflächen). */
function beam(b: MeshBuilder, a: V3, c: V3, w: number, col: RGB): void {
  let dx = c[0] - a[0];
  let dy = c[1] - a[1];
  let dz = c[2] - a[2];
  const l = Math.hypot(dx, dy, dz) || 1;
  dx /= l;
  dy /= l;
  dz /= l;
  // u ⟂ d (waagrecht, wenn möglich), v = d × u
  let ux = -dz;
  let uy = 0;
  let uz = dx;
  let ul = Math.hypot(ux, uz);
  if (ul < 0.1) {
    ux = 1;
    uz = 0;
    ul = 1;
  }
  ux /= ul;
  uz /= ul;
  const vx = dy * uz - dz * uy;
  const vy = dz * ux - dx * uz;
  const vz = dx * uy - dy * ux;
  const h = w / 2;
  for (let k = 0; k < 4; k++) {
    const a0 = (k / 4) * Math.PI * 2 + Math.PI / 4;
    const a1 = ((k + 1) / 4) * Math.PI * 2 + Math.PI / 4;
    const o0x = (ux * Math.cos(a0) + vx * Math.sin(a0)) * h * Math.SQRT2;
    const o0y = (uy * Math.cos(a0) + vy * Math.sin(a0)) * h * Math.SQRT2;
    const o0z = (uz * Math.cos(a0) + vz * Math.sin(a0)) * h * Math.SQRT2;
    const o1x = (ux * Math.cos(a1) + vx * Math.sin(a1)) * h * Math.SQRT2;
    const o1y = (uy * Math.cos(a1) + vy * Math.sin(a1)) * h * Math.SQRT2;
    const o1z = (uz * Math.cos(a1) + vz * Math.sin(a1)) * h * Math.SQRT2;
    quadO(
      b,
      [a[0] + o0x, a[1] + o0y, a[2] + o0z],
      [a[0] + o1x, a[1] + o1y, a[2] + o1z],
      [c[0] + o1x, c[1] + o1y, c[2] + o1z],
      [c[0] + o0x, c[1] + o0y, c[2] + o0z],
      o0x + o1x,
      o0y + o1y,
      o0z + o1z,
      col,
    );
  }
}

/** Quader wie MeshBuilder.box, aber ohne Boden (steht immer auf etwas – spart ein Sechstel). */
function box5(b: MeshBuilder, cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, color: RGB, rotY = 0, top?: RGB): void {
  const c = Math.cos(rotY);
  const s = Math.sin(rotY);
  const hx = sx / 2;
  const hy = sy / 2;
  const hz = sz / 2;
  const p = (x: number, y: number, z: number): V3 => [cx + x * c + z * s, cy + y, cz - x * s + z * c];
  const v = [p(-hx, -hy, -hz), p(hx, -hy, -hz), p(hx, hy, -hz), p(-hx, hy, -hz), p(-hx, -hy, hz), p(hx, -hy, hz), p(hx, hy, hz), p(-hx, hy, hz)];
  b.quad(v[4], v[5], v[6], v[7], color);
  b.quad(v[1], v[0], v[3], v[2], color);
  b.quad(v[5], v[1], v[2], v[6], color);
  b.quad(v[0], v[4], v[7], v[3], color);
  b.quad(v[7], v[6], v[2], v[3], top ?? color);
}

/** Senkrechtes Prisma (Kegelstumpf) mit Deckel, ohne Boden. */
function prism(b: MeshBuilder, x: number, z: number, y0: number, y1: number, r0: number, r1: number, n: number, col: RGB, top?: RGB, rot = 0): void {
  for (let k = 0; k < n; k++) {
    const a0 = rot + (k / n) * Math.PI * 2;
    const a1 = rot + ((k + 1) / n) * Math.PI * 2;
    const am = (a0 + a1) / 2;
    quadO(
      b,
      [x + Math.cos(a0) * r0, y0, z + Math.sin(a0) * r0],
      [x + Math.cos(a1) * r0, y0, z + Math.sin(a1) * r0],
      [x + Math.cos(a1) * r1, y1, z + Math.sin(a1) * r1],
      [x + Math.cos(a0) * r1, y1, z + Math.sin(a0) * r1],
      Math.cos(am),
      0.2,
      Math.sin(am),
      k % 2 === 0 ? col : shade(col, 0.93),
    );
    if (r1 > 0.01) triO(b, [x, y1, z], [x + Math.cos(a0) * r1, y1, z + Math.sin(a0) * r1], [x + Math.cos(a1) * r1, y1, z + Math.sin(a1) * r1], 0, 1, 0, top ?? col);
  }
}

/** Lage an der Strecke: Ursprung, Richtungen (rechts, vorwärts), Drehung für box(), Fahrbahnhöhe. */
interface Frame {
  x: number;
  z: number;
  rx: number;
  rz: number;
  fx: number;
  fz: number;
  rot: number;
  ry: number;
}

export function buildWuesteLife(world: World): Life {
  const t = world.track;
  const n = t.n;
  const detail = world.detail;
  const hi = detail > 0;
  const group = new THREE.Group();
  const disposables: { dispose(): void }[] = [];
  const rnd = seeded(9100 + t.index * 31);
  // Sammelstellen für Teile, die beim Bauen gefunden und erst im Gestell bewegt werden.
  const clock = { x: 0, y: 0, z: 0, ax: 1, az: 0, rot: 0 };
  const tower = { x: 0, y: 0, z: 0, rot: 0 };
  const chains: { a: V3; b: V3 }[] = [];
  const flagPoles: V3[] = [];
  const pf = (p: V3): { x: number; y: number; z: number } => ({ x: p[0], y: p[1], z: p[2] });

  const seg = (m: number): number => ((Math.round(m) % n) + n) % n;
  const frame = (m: number, lat = 0): Frame => {
    const i = seg(m);
    const rx = rightX(t, i);
    const rz = rightZ(t, i);
    return { x: t.px[i] + rx * lat, z: t.pz[i] + rz * lat, rx, rz, fx: t.tx[i], fz: t.tz[i], rot: Math.atan2(t.tx[i], t.tz[i]), ry: t.py[i] };
  };
  /** Weltpunkt aus Lage im Rahmen: seitlich l (nach rechts), Höhe y (absolut), vorwärts w. */
  const fp = (fr: Frame, l: number, y: number, w: number): V3 => [fr.x + fr.rx * l + fr.fx * w, y, fr.z + fr.rz * l + fr.fz * w];
  /** Quader im Rahmen: Mitte (l, y, w), Kanten quer sl, hoch sy, längs sw. */
  const fbox = (b: MeshBuilder, fr: Frame, l: number, y: number, w: number, sl: number, sy: number, sw: number, col: RGB, top?: RGB, yaw = 0): void => {
    const p = fp(fr, l, y, w);
    // Ohne Boden nur, was auf dem Boden steht – von unten gesehen zeichnete die Kontur sonst die Innenseite.
    if (y - sy / 2 <= fr.ry + 1.2) box5(b, p[0], p[1], p[2], sl, sy, sw, col, fr.rot + yaw, top);
    else b.box(p[0], p[1], p[2], sl, sy, sw, col, fr.rot + yaw, top);
  };
  const ground = (x: number, z: number): number => world.heightAt(x, z);
  const xz = (p: V3): [number, number] => [p[0], p[2]];
  /** Tiefster Geländepunkt unter einer Grundfläche (Halbmesser r). */
  const groundMin = (x: number, z: number, r: number): number => {
    let y = ground(x, z);
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      y = Math.min(y, ground(x + Math.cos(a) * r, z + Math.sin(a) * r));
    }
    return y;
  };
  /** Nächster Abschnitt der Strecke zu einem Punkt (grob, jeder zweite). */
  const nearestSeg = (x: number, z: number): number => {
    let best = 0;
    let bd = Infinity;
    for (let k = 0; k < n; k += 2) {
      const d = (x - t.px[k]) ** 2 + (z - t.pz[k]) ** 2;
      if (d < bd) {
        bd = d;
        best = k;
      }
    }
    return best;
  };
  const inRange = (m: number, a: number, b: number): boolean => {
    const s = seg(m);
    return a <= b ? s >= a && s <= b : s >= a || s <= b;
  };

  /** Belegte Kreise (Bauten, Felsen): Streugut hält Abstand. */
  const occupied: number[] = [];
  const occupy = (x: number, z: number, r: number): void => {
    occupied.push(x, z, r);
  };
  const free = (x: number, z: number, r: number): boolean => {
    for (let k = 0; k < occupied.length; k += 3) if (Math.hypot(x - occupied[k], z - occupied[k + 1]) < r + occupied[k + 2]) return false;
    return true;
  };

  // Abschnitte der Runde
  const DECK0 = 815;
  const DECK1 = 997;
  const TUN0 = 1206;
  const TUN1 = 1292;
  const CAN0 = 330;
  const CAN1 = 760;

  const rock = new MeshBuilder(); // Fels nah: mit Kontur
  const farRock = new MeshBuilder(); // Fels fern: ohne Kontur
  const props = new MeshBuilder(); // Bauten, Pflanzen, Masten: mit Kontur
  const flat = new MeshBuilder(); // Drähte, Flussbett: unbeleuchtet, beidseitig
  const rig = new Rig(); // bewegte Teile, mit Kontur
  const haze = new Rig(); // Staubteufel und Dunst: durchscheinend

  // =====================================================================================
  // Fels
  // =====================================================================================

  /**
   * Tafelberg bzw. Felsnadel: übereinander gestapelte, kantige Schichten, jede ein wenig
   * schmaler, mit Simsen dazwischen; oben Kalk, unten eine Geröllhalde.
   */
  const mesa = (b: MeshBuilder, x: number, z: number, r: number, h: number, opts: { sides?: number; layers?: number; stretch?: number; yaw?: number; hoodoo?: boolean; palette?: RGB[]; scree?: boolean }): void => {
    const N = opts.sides ?? 7;
    const L = opts.layers ?? 4;
    const pal = opts.palette ?? C.rock;
    const stretch = opts.stretch ?? 1;
    const yaw = opts.yaw ?? 0;
    const cy = Math.cos(yaw);
    const sy = Math.sin(yaw);
    const y0 = groundMin(x, z, r * 0.9) - 1.2;
    const ang: number[] = [];
    const rad: number[] = [];
    for (let k = 0; k < N; k++) {
      ang.push(((k + (rnd() - 0.5) * 0.5) / N) * Math.PI * 2);
      rad.push(0.82 + rnd() * 0.36);
    }
    const pt = (k: number, s: number, y: number): V3 => {
      const lx = Math.cos(ang[k]) * r * rad[k] * s * stretch;
      const lz = Math.sin(ang[k]) * r * rad[k] * s;
      return [x + lx * cy - lz * sy, y, z + lx * sy + lz * cy];
    };
    const outward = (k: number): [number, number] => {
      const am = (ang[k] + ang[(k + 1) % N] + (k === N - 1 ? Math.PI * 2 : 0)) / 2;
      const lx = Math.cos(am) * stretch;
      const lz = Math.sin(am);
      return [lx * cy - lz * sy, lx * sy + lz * cy];
    };
    // Schichtgrenzen und Breiten
    const ys: number[] = [y0];
    const sc: number[] = [];
    let acc = 0;
    const parts: number[] = [];
    for (let j = 0; j < L; j++) {
      const p = j === L - 1 ? 0.55 + rnd() * 0.3 : 0.8 + rnd() * 0.6;
      parts.push(p);
      acc += p;
    }
    const top = y0 + 1.2 + h;
    for (let j = 0; j < L; j++) ys.push(ys[j] + ((top - y0) * parts[j]) / acc);
    for (let j = 0; j < L; j++) {
      if (opts.hoodoo) sc.push(j === L - 1 ? 0.95 : 0.78 - j * 0.1 + (j % 2) * 0.12);
      else sc.push(1 - j * (0.06 + rnd() * 0.05));
    }
    const off = Math.floor(rnd() * pal.length);
    // Geröllhalde
    if (opts.scree !== false) {
      const yS = ys[0] + 1.2 + (ys[1] - ys[0]) * 0.35;
      for (let k = 0; k < N; k++) {
        const k1 = (k + 1) % N;
        const [ox, oz] = outward(k);
        quadO(b, pt(k, 1.32, y0 + 0.4), pt(k1, 1.32, y0 + 0.4), pt(k1, sc[0] * 1.01, yS), pt(k, sc[0] * 1.01, yS), ox, 0.6, oz, shade(C.scree, 0.94 + rnd() * 0.1));
      }
    }
    for (let j = 0; j < L; j++) {
      const capLayer = j === L - 1;
      const band = capLayer ? C.capDark : pal[(j + off) % pal.length];
      for (let k = 0; k < N; k++) {
        const k1 = (k + 1) % N;
        const [ox, oz] = outward(k);
        quadO(b, pt(k, sc[j], ys[j]), pt(k1, sc[j], ys[j]), pt(k1, sc[j], ys[j + 1]), pt(k, sc[j], ys[j + 1]), ox, 0, oz, shade(band, 0.9 + rnd() * 0.16));
        // Sims zur nächsten Schicht (bei Felsnadeln auch überhängend)
        if (!capLayer) {
          const up = sc[j + 1] < sc[j] ? 1 : -1;
          quadO(b, pt(k, sc[j], ys[j + 1]), pt(k1, sc[j], ys[j + 1]), pt(k1, sc[j + 1], ys[j + 1]), pt(k, sc[j + 1], ys[j + 1]), 0, up, 0, up > 0 ? C.ledge : shade(band, 0.7));
        }
      }
    }
    // Deckel aus Kalk
    const yT = ys[L];
    const sT = sc[L - 1];
    for (let k = 0; k < N; k++) {
      const k1 = (k + 1) % N;
      triO(b, [x, yT, z], pt(k, sT, yT), pt(k1, sT, yT), 0, 1, 0, shade(C.cap, 0.95 + rnd() * 0.08));
    }
    occupy(x, z, r * 1.3 * Math.max(1, stretch));
  };

  /**
   * Band aus Fels entlang der Strecke: ein Profil quer zur Fahrtrichtung, alle step Meter.
   * Ein Profilpunkt ist [Abstand jenseits der Bande, Höhe über der Fahrbahn (NaN = Gelände), Farbe der Fläche dahinter].
   */
  type Prof = [number, number, RGB][];
  const ribbon = (b: MeshBuilder, m0: number, m1: number, step: number, side: number, profile: (m: number) => Prof, blend: (m: number) => number): void => {
    let prev: V3[] | null = null;
    let prevCols: RGB[] | null = null;
    let prevFr: Frame | null = null;
    for (let m = m0; m <= m1 + 0.01; m += step) {
      const i = seg(m);
      const fr = frame(m);
      const prof = profile(m);
      const k = blend(m);
      const pts: V3[] = [];
      const cols: RGB[] = [];
      for (const [o, h, c] of prof) {
        const lat = side * (t.wh[i] + o);
        const x = fr.x + fr.rx * lat;
        const z = fr.z + fr.rz * lat;
        const g = ground(x, z) - 1.5;
        // An den Enden liegt das Band flach im Gelände: kein offener Querschnitt, in den man hineinsähe.
        const y = Number.isNaN(h) ? g : g + (fr.ry + h - g) * k;
        pts.push([x, y, z]);
        cols.push(c);
      }
      if (prev && prevCols && prevFr) {
        for (let k = 0; k < pts.length - 1; k++) {
          // Sichtbare Seite: zur Strecke hin bzw. nach oben (Normale des Profilstücks)
          const dO = Math.hypot(pts[k + 1][0] - pts[k][0], pts[k + 1][2] - pts[k][2]) * (prof[k + 1][0] >= prof[k][0] ? 1 : -1);
          const dH = pts[k + 1][1] - pts[k][1];
          const nO = -dH;
          const nH = dO;
          const ox = side * fr.rx * nO;
          const oz = side * fr.rz * nO;
          const c = shade(prevCols[k], 0.92 + noise(m * 0.21, k * 3.3) * 0.16);
          quadO(b, prev[k], pts[k], pts[k + 1], prev[k + 1], ox, nH, oz, c);
        }
      }
      prev = pts;
      prevCols = cols;
      prevFr = fr;
    }
  };

  // --- Canyon: nahe, hohe Wände beidseits ------------------------------------------------
  const ARCH = 612; // Felsbogen über der Strecke
  const MINE = 468; // Minenstollen links am Hang
  const canyonH = (m: number, side: number): number => {
    const ramp = smooth((m - CAN0) / 45) * smooth((CAN1 - m) / 45);
    const nn = noise(m * 0.035 + (side > 0 ? 11 : 0), side * 2.7);
    let h = (13 + nn * 13) * ramp;
    // Am Felsbogen tragen die Wände ihn: dort hoch.
    const arch = 1 - smooth(Math.abs(m - ARCH) / 22);
    h = Math.max(h, 27 * arch);
    return Math.max(0.5, h);
  };
  const canyonProfile = (side: number) => (m: number): Prof => {
    const H = canyonH(m, side);
    const arch = 1 - smooth(Math.abs(m - ARCH) / 18);
    const mine = side < 0 ? 1 - smooth(Math.abs(m - MINE) / 16) : 0;
    // Fuß der Wand: links ab 4,5 m, rechts ab 6,5 m (dort stehen die Telegrafenmasten), am Bogen ab 7 m.
    let o0 = (side < 0 ? 4.5 : 6.5) + noise(m * 0.09, side * 5) * 2.2;
    o0 = Math.max(o0, 7 * arch + o0 * (1 - arch));
    const back = 8 * mine; // am Stollen weicht die Wand zurück
    const lift = 5.5 * mine; // … und lässt einen Sims stehen
    const top = H + (noise(m * 0.05, side * 9) - 0.5) * 3;
    const r = C.rock;
    return [
      [o0, NaN, r[1]],
      [o0 + 0.3, H * 0.3 * (1 - mine) + lift, mine > 0.3 ? C.scree : C.ledge],
      [o0 + 1.3 + back, H * 0.32 * (1 - mine) + (lift + 0.3) * mine, r[3]],
      [o0 + 1.7 + back, Math.max(H * 0.6, lift + 3), C.ledge],
      [o0 + 2.8 + back, Math.max(H * 0.62, lift + 3.3), r[2]],
      [o0 + 3.2 + back, Math.max(H * 0.88, lift + 6), C.capDark],
      [o0 + 4.2 + back, Math.max(top, lift + 7), C.cap],
      [o0 + 7 + back, Math.max(top + 0.3, lift + 7.2), r[4]],
      [o0 + 17 + back, Math.max(top + 1, lift + 7.5), r[0]],
      [o0 + 19.5 + back, Math.max(top * 0.5, lift + 3), C.ledge],
      [o0 + 20.2 + back, Math.max(top * 0.47, lift + 2.6), r[1]],
      [o0 + 24 + back, NaN, r[1]],
    ];
  };
  const canyonBlend = (m: number): number => smooth((m - CAN0 + 25) / 40) * smooth((CAN1 + 25 - m) / 40);
  ribbon(rock, CAN0 - 25, CAN1 + 25, detail === 0 ? 8 : 6, -1, canyonProfile(-1), canyonBlend);
  ribbon(rock, CAN0 - 25, CAN1 + 25, detail === 0 ? 8 : 6, 1, canyonProfile(1), canyonBlend);
  for (let m = CAN0; m <= CAN1; m += 12) {
    for (const s of [-1, 1]) {
      const fr = frame(m, s * (t.wh[seg(m)] + 14));
      occupy(fr.x, fr.z, 11);
    }
  }

  // --- Felsbogen über dem Canyon --------------------------------------------------------
  {
    const fr = frame(ARCH);
    const wh = t.wh[seg(ARCH)];
    const L = wh + 9; // Pfeiler (die Canyonwände) beginnen 7 m und mehr jenseits der Bande
    const K = detail === 0 ? 8 : 12;
    const depth = 6.5;
    const under = (l: number): number => fr.ry + 15 + 6.5 * Math.cos((l / L) * Math.PI * 0.5);
    const over = (l: number): number => under(l) + 4.2 + 3 * Math.abs(l / L) ** 2;
    const yawK = (l: number): number => Math.sin((l / L) * 2.1) * 1.2; // leicht geschwungen
    let prev: V3[] | null = null;
    for (let k = 0; k <= K; k++) {
      const l = -L - 3 + ((2 * L + 6) * k) / K;
      const dw = yawK(l);
      const yu = under(Math.max(-L, Math.min(L, l)));
      const yo = over(Math.max(-L, Math.min(L, l)));
      const ring: V3[] = [fp(fr, l, yu, dw - depth / 2), fp(fr, l, yu, dw + depth / 2), fp(fr, l, yo, dw + depth / 2 - 0.8), fp(fr, l, yo, dw - depth / 2 + 0.8)];
      if (prev) {
        const band = k % 3 === 0 ? C.rock[2] : k % 3 === 1 ? C.rock[1] : C.rock[3];
        quadO(rock, prev[0], ring[0], ring[1], prev[1], 0, -1, 0, shade(band, 0.75));
        quadO(rock, prev[1], ring[1], ring[2], prev[2], fr.fx, 0, fr.fz, band);
        quadO(rock, prev[3], ring[3], ring[0], prev[0], -fr.fx, 0, -fr.fz, shade(band, 0.92));
        quadO(rock, prev[2], ring[2], ring[3], prev[3], 0, 1, 0, C.cap);
      }
      prev = ring;
    }
  }

  // --- Schlucht unter dem Viadukt: Felswände an beiden Enden, Flussbett -----------------------
  const gorgeWall = (mEdge: number, dir: number): void => {
    // dir = +1: Wand am Anfang des Viadukts, die Schlucht liegt in Fahrtrichtung davor; -1: am Ende.
    // Zwei Flügel links und rechts; die Mitte unter dem Steg bleibt frei (dort stehen Pfeiler und Widerlager).
    const fr = frame(mEdge);
    const ry = fr.ry;
    const wh = t.wh[seg(mEdge)];
    const step = detail === 0 ? 9 : 6;
    const ds = [9, 5.5, 4.2, 3.6, 2.2, 1.6, 0, -3, -20, -27];
    const cols: RGB[] = [C.scree, C.ledge, C.rock[1], C.ledge, C.rock[2], C.rock[0], C.cap, C.rock[4], C.rock[3]];
    for (const sgn of [-1, 1]) {
      const lIn = wh + 3;
      const NL = Math.ceil((96 - lIn) / step);
      let prev: V3[] | null = null;
      for (let q = 0; q <= NL; q++) {
        const al = lIn + ((96 - lIn) * q) / NL;
        const l = sgn * al;
        const rim = (smooth((al - lIn) / 10) * (7 + noise(l * 0.06, dir * 4) * 9) - 1.2) * (1 - smooth((al - 70) / 26) * 0.7);
        const jag = (noise(l * 0.11, mEdge * 0.01) - 0.5) * 7 * smooth((al - lIn) / 16) + (al - lIn) * 0.08;
        const face = (d: number, y: number): V3 => fp(fr, l, y, dir * (jag + d));
        const yT = ry + rim;
        const fl = face(9, 0);
        const yF = Math.min(ground(fl[0], fl[2]) - 1.2, yT - 4);
        const span = yT - yF;
        const fade = 1 - smooth((al - 78) / 18); // außen läuft der Flügel im Gelände aus
        const pts: V3[] = [
          face(9, yF),
          face(5.5, yF + span * 0.22),
          face(4.2, yF + span * 0.24),
          face(3.6, yF + span * 0.55),
          face(2.2, yF + span * 0.57),
          face(1.6, yF + span * 0.86),
          face(0, yT),
          face(-3, yT + 0.2),
          face(-20, yT - 0.6),
          face(-27, NaN),
        ];
        for (const p of pts) {
          const g = ground(p[0], p[2]) - 1.5;
          if (Number.isNaN(p[1])) p[1] = g;
          else p[1] = g + (p[1] - g) * fade;
        }
        if (prev) {
          for (let k = 0; k < pts.length - 1; k++) {
            const dh = pts[k + 1][1] - pts[k][1];
            const dd = ds[k + 1] - ds[k];
            // Sichtbare Seite: Normale des Profilstücks in der Ebene (vorwärts·dir, hoch)
            quadO(rock, prev[k], pts[k], pts[k + 1], prev[k + 1], fr.fx * dir * dh, -dd, fr.fz * dir * dh, shade(cols[k], 0.92 + noise(l * 0.3, k) * 0.14));
          }
        } else {
          // Stirnseite zur Strecke hin: vom Profil bis ins Gelände
          for (let k = 0; k < pts.length - 1; k++) {
            const g0 = pts[k];
            const g1 = pts[k + 1];
            const b0: V3 = [g0[0], Math.min(g0[1], ground(g0[0], g0[2]) - 1.5), g0[2]];
            const b1: V3 = [g1[0], Math.min(g1[1], ground(g1[0], g1[2]) - 1.5), g1[2]];
            quadO(rock, b0, g0, g1, b1, -sgn * fr.rx, 0, -sgn * fr.rz, shade(C.rock[1], 0.85));
          }
        }
        prev = pts;
      }
    }
  };
  gorgeWall(DECK0 + 11, 1);
  gorgeWall(DECK1 - 11, -1);

  // Ausgetrocknetes Flussbett mit Rinnsal: windet sich unter dem Viadukt hindurch.
  {
    const mid = frame(902);
    const along = { x: -mid.rx, z: -mid.rz }; // quer zur Strecke: vom Innenraum nach außen
    let prevL: V3 | null = null;
    let prevR: V3 | null = null;
    let prevl: V3 | null = null;
    let prevr: V3 | null = null;
    for (let s = -150; s <= 330; s += 6) {
      const wig = Math.sin(s * 0.025) * 16 + Math.sin(s * 0.061 + 1) * 6;
      const cx = mid.x + along.x * s + mid.fx * wig;
      const cz = mid.z + along.z * s + mid.fz * wig;
      const w = 7 + Math.sin(s * 0.04) * 2;
      // Wo es der Strecke nahe kommt (Innenraum), versickert es.
      const fade = smooth((s + 150) / 50);
      const L: V3 = [cx - mid.fx * w * fade, 0, cz - mid.fz * w * fade];
      const R: V3 = [cx + mid.fx * w * fade, 0, cz + mid.fz * w * fade];
      L[1] = ground(L[0], L[2]) + 0.12;
      R[1] = ground(R[0], R[2]) + 0.12;
      const wl = 1.1 * fade;
      const l: V3 = [cx - mid.fx * wl, 0, cz - mid.fz * wl];
      const r: V3 = [cx + mid.fx * wl, 0, cz + mid.fz * wl];
      l[1] = ground(l[0], l[2]) + 0.22;
      r[1] = ground(r[0], r[2]) + 0.22;
      if (prevL && prevR && prevl && prevr) {
        quadO(flat, prevL, L, R, prevR, 0, 1, 0, C.riverbed);
        if (s > -100) quadO(flat, prevl, l, r, prevr, 0, 1, 0, C.river);
      }
      prevL = L;
      prevR = R;
      prevl = l;
      prevr = r;
      if (s % 18 === 0) occupy(cx, cz, w + 4);
    }
  }

  // --- Tafelberg über dem Tunnel ----------------------------------------------------------
  {
    const prof: [number, number, RGB][] = [
      [-42, NaN, C.scree],
      [-35, 7, C.rock[1]],
      [-33.5, 7.4, C.ledge],
      [-30, 15, C.rock[3]],
      [-28.5, 15.4, C.ledge],
      [-25, 23, C.rock[0]],
      [-21, 27, C.capDark],
      [-15, 27.6, C.cap],
      [15, 27.8, C.cap],
      [21, 27.2, C.capDark],
      [25, 23, C.rock[2]],
      [28.5, 15.4, C.ledge],
      [30, 15, C.rock[1]],
      [33.5, 7.4, C.ledge],
      [35, 7, C.rock[3]],
      [42, NaN, C.scree],
    ];
    const step = detail === 0 ? 6 : 4;
    const rows: V3[][] = [];
    const ms: number[] = [];
    for (let m = TUN0; m <= TUN1 + 0.01; m += step) ms.push(Math.min(m, TUN1));
    if (ms[ms.length - 1] !== TUN1) ms.push(TUN1);
    for (const m of ms) {
      const fr = frame(m);
      const row: V3[] = [];
      for (const [l, h] of prof) {
        const wob = Math.abs(l) <= 15 ? 1 : 1 + (noise(m * 0.07, l * 0.3) - 0.5) * 0.12;
        const ll = l * wob;
        const p = fp(fr, ll, 0, 0);
        p[1] = Number.isNaN(h) ? ground(p[0], p[2]) - 1.5 : fr.ry + h + (Math.abs(l) < 22 ? (noise(m * 0.1, l) - 0.5) * 1.2 : 0);
        row.push(p);
      }
      rows.push(row);
    }
    for (let r = 1; r < rows.length; r++) {
      const fr = frame(ms[r]);
      for (let k = 0; k < prof.length - 1; k++) {
        const dh = rows[r][k + 1][1] - rows[r][k][1];
        const dl = prof[k + 1][0] - prof[k][0];
        quadO(rock, rows[r - 1][k], rows[r][k], rows[r][k + 1], rows[r - 1][k + 1], -fr.rx * dh, dl, -fr.rz * dh, shade(prof[k][2], 0.92 + noise(r * 0.7, k) * 0.14));
      }
    }
    // Stirnseiten: über und neben dem Portal bis zum Gelände – in waagrechten Gesteinsbändern
    const bands = [-8, 3, 7.2, 11, 15.2, 19, 23.2, 40];
    const bandCol = [C.rock[0], C.rock[1], C.ledge, C.rock[3], C.ledge, C.rock[2], C.capDark];
    for (const [m, dir, row] of [
      [TUN0, -1, rows[0]],
      [TUN1, 1, rows[rows.length - 1]],
    ] as [number, number, V3[]][]) {
      const fr = frame(m);
      for (let k = 0; k < prof.length - 1; k++) {
        const l0 = prof[k][0];
        const l1 = prof[k + 1][0];
        const inner = Math.abs(l0) <= 15 && Math.abs(l1) <= 15;
        const floor0 = inner ? fr.ry + 12.5 : ground(row[k][0], row[k][2]) - 1.5;
        const floor1 = inner ? fr.ry + 12.5 : ground(row[k + 1][0], row[k + 1][2]) - 1.5;
        const top0 = row[k][1];
        const top1 = row[k + 1][1];
        for (let j = 0; j < bands.length - 1; j++) {
          const clamp = (y: number, lo: number, hi2: number): number => Math.max(lo, Math.min(hi2, y));
          const ya0 = clamp(fr.ry + bands[j], floor0, top0);
          const yb0 = clamp(fr.ry + bands[j + 1], floor0, top0);
          const ya1 = clamp(fr.ry + bands[j], floor1, top1);
          const yb1 = clamp(fr.ry + bands[j + 1], floor1, top1);
          if (yb0 - ya0 < 0.05 && yb1 - ya1 < 0.05) continue;
          quadO(
            rock,
            [row[k][0], ya0, row[k][2]],
            [row[k][0], yb0, row[k][2]],
            [row[k + 1][0], yb1, row[k + 1][2]],
            [row[k + 1][0], ya1, row[k + 1][2]],
            fr.fx * dir,
            0,
            fr.fz * dir,
            shade(bandCol[j], 0.88 + ((k * 7) % 5) * 0.025),
          );
        }
      }
    }
    for (let m = TUN0; m <= TUN1; m += 10) {
      const fr = frame(m);
      occupy(fr.x, fr.z, 44);
    }
  }

  // --- Tafelberge, Felsnadeln: nah und fern ---------------------------------------------------
  /** Wie weit Fels von der Bande mindestens abbleibt – je nach Abschnitt der Strecke. */
  const minClear = (s: number): number => {
    if (inRange(s, 1380, 200)) return 60; // Bahnhof und Stadt
    if (inRange(s, DECK1 - 10, TUN0 - 10)) return 55; // Hochebene: weite Sicht
    if (inRange(s, DECK0 - 20, DECK1 + 10)) return 40; // Schlucht
    return 18;
  };
  {
    const nearWant = detail === 0 ? 12 : 20;
    const farWant = detail === 0 ? 12 : 20;
    let near = 0;
    let far = 0;
    for (let k = 0; k < 900 && (near < nearWant || far < farWant); k++) {
      const a = rnd() * Math.PI * 2;
      const isFar = near >= nearWant || (far < farWant && rnd() < 0.4);
      const d = isFar ? world.radius * (1.6 + rnd() * 1.6) : world.radius * (0.1 + rnd() * 1.25);
      const x = world.center.x + Math.cos(a) * d;
      const z = world.center.z + Math.sin(a) * d;
      const pin = !isFar && rnd() < 0.3;
      const r = isFar ? 26 + rnd() * 40 : pin ? 3 + rnd() * 3.5 : 9 + rnd() * 16;
      const stretch = pin ? 1 : 1 + rnd() * 0.9;
      const h = isFar ? 30 + rnd() * 55 : pin ? 14 + rnd() * 18 : 12 + rnd() * 20 + r * 0.5;
      const c = world.clearance(x, z);
      const s = nearestSeg(x, z);
      if (c < r * 1.35 * stretch + minClear(s)) continue;
      if (!free(x, z, r * 1.2 * stretch + 4)) continue;
      if (isFar) {
        mesa(farRock, x, z, r, h, { sides: 7, layers: 3, stretch, yaw: rnd() * Math.PI, palette: C.far, scree: false });
        far++;
      } else {
        mesa(rock, x, z, r, h, { sides: pin ? 6 : 7, layers: pin ? 5 : 4, stretch, yaw: rnd() * Math.PI, hoodoo: pin });
        near++;
      }
    }
  }

  // =====================================================================================
  // Bahnhof der Wüstenstadt (rechts) und Stadt (links)
  // =====================================================================================
  const people: { fr: Frame; l: number; y: number; w: number; yaw: number; wave: boolean; staff: boolean }[] = [];
  const flags: { x: number; y: number; z: number; col: RGB; size: number }[] = [];

  /** Mensch: Beine, Rumpf, Kopf, Hut; ein Arm bleibt unten, der andere winkt (bewegtes Teil). */
  const person = (fr: Frame, l: number, y: number, w: number, yaw: number, wave: boolean, staff: boolean): void => {
    people.push({ fr, l, y, w, yaw, wave, staff });
  };

  {
    const WH = t.wh[0];
    // --- Bahnsteig rechts (hinter der Bande) ---
    const P0 = -24;
    const P1 = 58;
    const pl0 = WH + 3.2;
    const pl1 = WH + 8.6;
    const platY = (fr: Frame): number => fr.ry + 0.9;
    for (let m = P0; m < P1; m += 6) {
      const fr = frame(m + 3);
      fbox(props, fr, (pl0 + pl1) / 2, fr.ry + 0.35, 0, pl1 - pl0, 1.2, 6.05, C.stone, C.adobeLight);
      // Bahnsteigkante
      fbox(props, fr, pl0 + 0.25, fr.ry + 0.98, 0, 0.5, 0.12, 6.05, C.yellow);
      occupy(fr.x + fr.rx * (pl0 + pl1) * 0.5, fr.z + fr.rz * (pl0 + pl1) * 0.5, 5);
    }
    // Dach auf Pfosten
    for (let m = P0 + 3; m < P1; m += 9) {
      const fr = frame(m);
      for (const l of [pl0 + 1.2, pl1 - 1.2]) fbox(props, fr, l, platY(fr) + 2.1, 0, 0.32, 4.2, 0.32, C.woodDark);
      fbox(props, fr, (pl0 + pl1) / 2, platY(fr) + 4.05, 0, pl1 - pl0 - 1.6, 0.25, 0.4, C.wood);
    }
    for (let m = P0 + 3; m < P1 - 6; m += 9) {
      const fr = frame(m + 4.5);
      const y = platY(fr) + 4.35;
      // Pultdach, zur Bahn hin abfallend; Traufe mit Zackenblende
      const a = fp(fr, pl0 + 0.2, y - 0.25, -4.6);
      const b2 = fp(fr, pl0 + 0.2, y - 0.25, 4.6);
      const c2 = fp(fr, pl1 + 0.6, y + 0.55, 4.6);
      const d = fp(fr, pl1 + 0.6, y + 0.55, -4.6);
      sheetO(props, [a, b2, c2, d], 0, 1, 0, C.red, C.woodLight);
      for (let k = 0; k < 6; k++) {
        const w0 = -4.6 + k * 1.533;
        const w1 = w0 + 1.533;
        triO(props, fp(fr, pl0 + 0.2, y - 0.25, w0), fp(fr, pl0 + 0.2, y - 0.25, w1), fp(fr, pl0 + 0.2, y - 0.85, (w0 + w1) / 2), -fr.rx, 0, -fr.rz, k % 2 === 0 ? C.white : C.red);
      }
    }

    // --- Empfangsgebäude ---
    {
      const fr = frame(12);
      const y0 = fr.ry - 0.5;
      const l0 = WH + 10;
      fbox(props, fr, l0 + 5, y0 + 3.2, 0, 10, 6.4, 26, C.adobeLight, C.adobeDark);
      fbox(props, fr, l0 + 5, y0 + 6.6, 0, 10.6, 0.5, 26.6, C.adobe, C.adobeDark);
      fbox(props, fr, l0 + 5, y0 + 0.5, 0, 10.2, 1.0, 26.2, C.adobeDark);
      // Mittelbau mit Uhr
      fbox(props, fr, l0 + 4, y0 + 5.2, 0, 7, 10.4, 8, C.ochre, C.adobeDark);
      fbox(props, fr, l0 + 4, y0 + 10.6, 0, 7.6, 0.5, 8.6, C.woodDark);
      // Glockengiebel
      fbox(props, fr, l0 + 4, y0 + 11.6, 0, 2.2, 1.6, 3.6, C.adobeLight, C.red);
      // Türen und Fenster zur Bahn
      for (const w of [-9, -4.5, 4.5, 9]) {
        fbox(props, fr, l0 - 0.05, y0 + 2.6, w, 0.2, 2.2, 1.6, C.window);
        fbox(props, fr, l0 - 0.1, y0 + 3.8, w, 0.3, 0.25, 2.1, C.woodDark);
      }
      fbox(props, fr, l0 + 0.45, y0 + 2.2, 0, 0.2, 3.4, 2.4, C.woodDark);
      // Holzvordach
      fbox(props, fr, l0 - 0.6, y0 + 4.5, 0, 1.6, 0.18, 24, C.woodLight);
      // Uhr am Mittelbau (Zifferblatt; die Zeiger bewegen sich)
      const c = fp(fr, l0 + 0.45, y0 + 8.2, 0);
      const cgeo = new THREE.CylinderGeometry(1.25, 1.25, 0.3, 14);
      const m4 = new THREE.Matrix4().makeRotationZ(Math.PI / 2).premultiply(new THREE.Matrix4().makeRotationY(fr.rot)).setPosition(c[0], c[1], c[2]);
      props.add(cgeo, C.white, m4);
      const cgeo2 = new THREE.CylinderGeometry(1.5, 1.5, 0.22, 14);
      const c2 = fp(fr, l0 + 0.55, y0 + 8.2, 0);
      props.add(cgeo2, C.woodDark, new THREE.Matrix4().makeRotationZ(Math.PI / 2).premultiply(new THREE.Matrix4().makeRotationY(fr.rot)).setPosition(c2[0], c2[1], c2[2]));
      cgeo.dispose();
      cgeo2.dispose();
      clock.x = c[0] - fr.rx * 0.2;
      clock.y = c[1];
      clock.z = c[2] - fr.rz * 0.2;
      clock.ax = -fr.rx;
      clock.az = -fr.rz;
      clock.rot = fr.rot;
      flags.push({ ...pf(fp(fr, l0 + 4, y0 + 15.1, 0)), col: C.red, size: 1.4 });
      fbox(props, fr, l0 + 4, y0 + 13.6, 0, 0.14, 3.2, 0.14, C.woodDark);
      occupy(fr.x + fr.rx * (l0 + 5), fr.z + fr.rz * (l0 + 5), 15);
    }

    // --- Wasserturm mit Schwenkarm ---
    {
      const fr = frame(76);
      const l = WH + 9.5;
      const c = fp(fr, l, 0, 0);
      const gy = groundMin(c[0], c[2], 3) - 0.3;
      const ty = fr.ry + 8;
      for (const [dx, dz] of [
        [-1.7, -1.7],
        [1.7, -1.7],
        [1.7, 1.7],
        [-1.7, 1.7],
      ]) {
        beam(props, fp(fr, l + dx * 1.25, gy, dz * 1.25), fp(fr, l + dx * 0.85, ty, dz * 0.85), 0.34, C.woodDark);
      }
      for (const yy of [gy + 2.8, gy + 5.6]) {
        const k = (yy - gy) / (ty - gy);
        const s = 1.25 - 0.4 * k;
        beam(props, fp(fr, l - 1.7 * s, yy, -1.7 * s), fp(fr, l + 1.7 * s, yy, 1.7 * s), 0.18, C.wood);
        beam(props, fp(fr, l + 1.7 * s, yy, -1.7 * s), fp(fr, l - 1.7 * s, yy, 1.7 * s), 0.18, C.wood);
      }
      prism(props, c[0], c[2], ty, ty + 4.6, 2.5, 2.5, 10, C.woodLight, C.woodLight, fr.rot);
      for (const yy of [ty + 0.9, ty + 3.3]) prism(props, c[0], c[2], yy, yy + 0.3, 2.58, 2.58, 10, C.metal, C.metal, fr.rot);
      prism(props, c[0], c[2], ty + 4.6, ty + 6.4, 2.8, 0.1, 10, C.red, C.red, fr.rot);
      tower.x = c[0] - fr.rx * 2.5;
      tower.y = ty + 1.2;
      tower.z = c[2] - fr.rz * 2.5;
      tower.rot = fr.rot;
      occupy(c[0], c[2], 4);
    }

    // --- Stellwerk ---
    {
      const fr = frame(132);
      const l = WH + 7.5;
      const y0 = fr.ry - 0.4;
      fbox(props, fr, l, y0 + 2.2, 0, 5, 4.4, 6, C.adobeDark, C.adobe);
      fbox(props, fr, l, y0 + 5.6, 0, 5.4, 2.4, 6.4, C.woodLight);
      // Fensterband rundum
      fbox(props, fr, l, y0 + 5.8, 0, 5.5, 1.3, 6.5, C.window);
      const sc = fp(fr, l, 0, 0);
      prism(props, sc[0], sc[2], y0 + 6.8, y0 + 8.6, 4.8, 0.2, 4, C.red, C.red, fr.rot + Math.PI / 4);
      fbox(props, fr, l - 2.9, y0 + 2.6, 2.2, 0.8, 0.2, 2.4, C.woodDark);
      occupy(fr.x + fr.rx * l, fr.z + fr.rz * l, 5);
    }

    // --- Kisten und Gepäckkarren auf dem Bahnsteig ---
    for (const [m, l, k] of [
      [44, pl1 - 1.4, 3],
      [50, pl1 - 1.2, 2],
      [-12, pl1 - 1.4, 2],
    ] as [number, number, number][]) {
      const fr = frame(m);
      for (let j = 0; j < k; j++) {
        const s = 0.9 + (j % 2) * 0.25;
        fbox(props, fr, l - (j % 2) * 1.1, platY(fr) + s / 2 + (j > 1 ? 1 : 0), (j % 2) * 0.4 + (j > 1 ? 0.3 : 0), s, s, s, j % 2 === 0 ? C.woodLight : C.wood, C.woodLight, j * 0.3);
      }
    }
    for (const [m, l] of [
      [-6, pl0 + 3.2],
      [30, pl0 + 3.4],
    ] as [number, number][]) {
      const fr = frame(m);
      const y = platY(fr);
      fbox(props, fr, l, y + 0.7, 0, 1.3, 0.15, 2.4, C.woodLight);
      for (const [dl, dw] of [
        [-0.6, -0.8],
        [0.6, -0.8],
        [-0.6, 0.8],
        [0.6, 0.8],
      ])
        fbox(props, fr, l + dl, y + 0.32, dw, 0.12, 0.64, 0.64, C.dark);
      fbox(props, fr, l, y + 1.05, -1.25, 1.1, 0.7, 0.1, C.metal);
      // Koffer
      fbox(props, fr, l - 0.2, y + 1.0, 0.3, 0.7, 0.5, 0.9, C.teal);
      fbox(props, fr, l + 0.3, y + 1.2, -0.3, 0.6, 0.45, 0.7, C.red);
    }
    // Reisende und Bahnpersonal auf dem Bahnsteig, zur Strecke gewandt
    const plPeople: [number, number, boolean, boolean][] = [
      [-18, pl0 + 2.2, true, false],
      [-10, pl0 + 2.6, false, false],
      [-2, pl0 + 2.0, true, true],
      [6, pl0 + 3.0, true, false],
      [10, pl0 + 2.2, false, false],
      [20, pl0 + 2.4, true, false],
      [26, pl0 + 1.9, true, true],
      [38, pl0 + 2.6, true, false],
      [46, pl0 + 2.0, false, false],
    ];
    for (const [m, l, wave, staff] of plPeople) {
      if (detail === 0 && !wave) continue;
      const fr = frame(m);
      person(fr, l, platY(fr), 0, Math.PI / 2 + (rnd() - 0.5) * 0.6, wave, staff);
    }

    // --- Stadt links: Tribüne, Markt, Lehmhäuser ---
    {
      // Tribüne gegenüber dem Bahnhof
      const fr = frame(4);
      const l0 = -(WH + 4.5);
      const gy = fr.ry - 0.3;
      for (let r = 0; r < 4; r++) {
        const l = l0 - 0.7 - r * 1.3;
        fbox(props, fr, l, gy + 0.45 + r * 0.6, 0, 1.4, 0.9 + r * 1.2, 22, r % 2 === 0 ? C.white : C.blue, C.woodLight);
      }
      fbox(props, fr, l0 - 5.9, gy + 3.2, 0, 0.6, 6.4, 22, C.woodDark);
      for (const w of [-10.5, -3.5, 3.5, 10.5]) fbox(props, fr, l0 - 5.6, gy + 4.6, w, 0.3, 9.2, 0.3, C.woodDark);
      for (const w of [-10.5, 10.5]) fbox(props, fr, l0 - 0.3, gy + 4.6, w, 0.3, 9.2, 0.3, C.woodDark);
      // Dach: gestreiftes Tuch
      for (let k = 0; k < 8; k++) {
        const w0 = -11.4 + k * 2.85;
        const a = fp(fr, l0, gy + 8.6, w0);
        const b2 = fp(fr, l0, gy + 8.6, w0 + 2.85);
        const c2 = fp(fr, l0 - 6.2, gy + 9.6, w0 + 2.85);
        const d = fp(fr, l0 - 6.2, gy + 9.6, w0);
        sheetO(props, [a, b2, c2, d], 0, 1, 0, k % 2 === 0 ? C.red : C.white, k % 2 === 0 ? shade(C.red, 0.8) : shade(C.white, 0.85));
      }
      for (const w of [-9, 0, 9]) {
        fbox(props, fr, l0 - 3.1, gy + 11.2, w, 0.12, 3.2, 0.12, C.woodDark);
        flags.push({ ...pf(fp(fr, l0 - 3.1, gy + 12.5, w)), col: w === 0 ? C.yellow : C.teal, size: 1.1 });
      }
      occupy(fr.x + fr.rx * (l0 - 3), fr.z + fr.rz * (l0 - 3), 13);
      // Zuschauer
      const nRow = detail === 0 ? 3 : 5;
      for (let r = 0; r < 3; r++) {
        for (let k = 0; k < nRow; k++) {
          const w = -9 + (18 * (k + 0.5 + (r % 2) * 0.4)) / nRow;
          person(fr, l0 - 0.9 - r * 1.3, gy + 0.9 + r * 1.2, w, -Math.PI / 2 + (rnd() - 0.5) * 0.4, (k + r) % 2 === 0, false);
        }
      }
    }
    // Lehmhäuser mit Markisen
    const houses: [number, number][] = [
      [36, 0],
      [50, 6],
      [118, 2],
      [134, 8],
      [150, 0],
      [1412, 4],
      [1430, 0],
      [1446, 10],
      [26, 22],
      [112, 26],
      [1420, 24],
      [70, 32],
    ];
    const awn = [C.red, C.teal, C.yellow, C.blue];
    houses.forEach(([m, back], hI) => {
      if (detail === 0 && hI % 2 === 1) return;
      const fr = frame(m);
      const w = 7 + (hI % 3) * 1.8;
      const d = 6 + (hI % 2) * 2;
      const h = 3.6 + (hI % 3) * 1.6;
      const l = -(WH + 9 + back + d / 2);
      const c = fp(fr, l, 0, 0);
      const gy = groundMin(c[0], c[2], 4) - 0.3;
      const wall = hI % 3 === 0 ? C.adobe : hI % 3 === 1 ? C.adobeLight : C.ochre;
      fbox(props, fr, l, gy + h / 2, 0, d, h, w, wall, C.adobeDark);
      fbox(props, fr, l, gy + h + 0.25, 0, d + 0.3, 0.5, w + 0.3, hI % 3 === 1 ? C.adobe : C.adobeLight, C.adobeDark);
      // Rückseite: Fenster; auf dem Dach Wasserfass oder Aufbau
      fbox(props, fr, l - d / 2 - 0.03, gy + 2.0, w * 0.15, 0.1, 1.0, 1.2, C.window);
      if (hI % 2 === 0) prism(props, ...xz(fp(fr, l - d * 0.2, 0, -w * 0.25)), gy + h + 0.5, gy + h + 1.9, 0.6, 0.6, 6, C.wood, C.woodDark);
      else fbox(props, fr, l + d * 0.15, gy + h + 1.0, w * 0.2, 2.2, 1.0, 2.6, wall, C.adobeDark);
      // Balkenköpfe
      for (let k = -1; k <= 1; k++) fbox(props, fr, l + d / 2 + 0.3, gy + h - 0.6, k * (w / 3), 0.7, 0.22, 0.22, C.woodDark);
      // Tür und Fenster zur Straße
      fbox(props, fr, l + d / 2 + 0.03, gy + 1.1, -w * 0.2, 0.1, 2.2, 1.2, C.woodDark);
      fbox(props, fr, l + d / 2 + 0.03, gy + 2.0, w * 0.22, 0.1, 1.0, 1.2, C.window);
      // Markise: schräg vorgebaut, gestreift
      if (back < 15) {
        const col = awn[hI % awn.length];
        const yA = gy + 2.9;
        for (let k = 0; k < 4; k++) {
          const w0 = -w * 0.4 + (k * w * 0.8) / 4;
          const w1 = w0 + (w * 0.8) / 4;
          const a = fp(fr, l + d / 2, yA, w0);
          const b2 = fp(fr, l + d / 2, yA, w1);
          const c2 = fp(fr, l + d / 2 + 2.2, yA - 0.9, w1);
          const dd = fp(fr, l + d / 2 + 2.2, yA - 0.9, w0);
          const cc = k % 2 === 0 ? col : C.white;
          sheetO(props, [a, b2, c2, dd], fr.rx * -0.4, 1, fr.rz * -0.4, cc, shade(cc, 0.75));
        }
      }
      occupy(c[0], c[2], Math.max(w, d) * 0.6 + 2);
    });
    // Marktplatz mit Ständen und Brunnen
    {
      const fr = frame(86);
      const lc = -(WH + 16);
      const c = fp(fr, lc, 0, 0);
      const gy = groundMin(c[0], c[2], 8) - 0.2;
      prism(props, c[0], c[2], gy, gy + 0.9, 1.6, 1.6, 8, C.stone, C.river, 0);
      for (const [dl, dw] of [
        [-1.1, 0],
        [1.1, 0],
      ])
        fbox(props, fr, lc + dl, gy + 1.6, dw, 0.18, 1.6, 0.18, C.woodDark);
      fbox(props, fr, lc, gy + 2.5, 0, 2.6, 0.2, 0.3, C.woodDark);
      const stalls: [number, number, RGB][] = [
        [lc + 4.5, -7, C.red],
        [lc + 4.5, 7, C.yellow],
        [lc - 5, -6, C.teal],
        [lc - 5, 6, C.blue],
      ];
      stalls.forEach(([l, w, col], k) => {
        if (detail === 0 && k > 1) return;
        fbox(props, fr, l, gy + 0.5, w, 1.4, 1.0, 3.2, C.woodLight, C.woodLight);
        // Waren
        fbox(props, fr, l, gy + 1.15, w - 0.8, 0.9, 0.3, 0.9, C.green);
        fbox(props, fr, l, gy + 1.15, w + 0.7, 0.9, 0.3, 1.0, C.yellow);
        for (const dw of [-1.5, 1.5]) for (const dl of [-0.8, 0.8]) fbox(props, fr, l + dl, gy + 1.3, w + dw, 0.14, 2.6, 0.14, C.woodDark);
        for (let s = 0; s < 3; s++) {
          const w0 = w - 1.8 + s * 1.2;
          const a = fp(fr, l - 1.1, gy + 2.7, w0);
          const b2 = fp(fr, l - 1.1, gy + 2.7, w0 + 1.2);
          const c2 = fp(fr, l + 1.3, gy + 2.3, w0 + 1.2);
          const d = fp(fr, l + 1.3, gy + 2.3, w0);
          sheetO(props, [a, b2, c2, d], 0, 1, 0, s % 2 === 0 ? col : C.white, shade(s % 2 === 0 ? col : C.white, 0.75));
        }
      });
      person(fr, lc + 2.6, gy, -7, Math.PI / 2, true, false);
      person(fr, lc - 3, gy, 5.5, -Math.PI / 2 + 0.4, false, false);
      if (hi) person(fr, lc + 1, gy, 2, Math.PI * 0.5, true, false);
      occupy(c[0], c[2], 13);
    }
    // Wimpelketten quer über die Straße (über 10 m) – Pfosten jenseits der Bande
    for (const m of [32, 96, 1444]) {
      const fr = frame(m);
      const lp = WH + 3.6;
      for (const s of [-1, 1]) {
        const p = fp(fr, s * lp, 0, 0);
        const gy = ground(p[0], p[2]) - 0.5;
        beam(props, [p[0], gy, p[2]], [p[0], fr.ry + 14.2, p[2]], 0.3, C.woodDark);
        prism(props, p[0], p[2], fr.ry + 14.2, fr.ry + 14.6, 0.32, 0.05, 5, C.yellow);
      }
      chains.push({ a: fp(fr, -lp, fr.ry + 13.8, 0), b: fp(fr, lp, fr.ry + 13.8, 0) });
    }
  }

  // =====================================================================================
  // An der Bahnlinie: Telegrafenleitung, Signale
  // =====================================================================================
  {
    const signals = [172, 300, 776, 1016, 1188, 1310, 1398];
    const isSignal = (m: number): boolean => signals.some((s) => Math.abs(seg(m) - s) < 8);
    let prevTops: V3[] | null = null;
    const span = detail === 0 ? 44 : 34;
    const LAT = 5.0;
    /** Mitte der Leitung zwischen zwei Masten: In Innenkurven schneidet sie die Kurve ab. */
    const chordOk = (m0: number, m1: number): boolean => {
      const a = frame(m0, t.wh[seg(m0)] + LAT - 0.75);
      const b2 = frame(m1, t.wh[seg(m1)] + LAT - 0.75);
      return world.clearance((a.x + b2.x) / 2, (a.z + b2.z) / 2) >= 3.3;
    };
    let m = 176;
    while (m < 1400) {
      const i = seg(m);
      const blocked = (t.edge[i] & (EDGE_DECK | EDGE_TUNNEL)) !== 0 || inRange(m, DECK0 - 12, DECK1 + 8) || inRange(m, TUN0 - 10, TUN1 + 8) || isSignal(m);
      if (blocked) {
        prevTops = null;
        m += 6;
        continue;
      }
      const fr = frame(m, t.wh[i] + LAT);
      const gy = ground(fr.x, fr.z) - 0.4;
      const top = gy + 7.2;
      beam(props, [fr.x, gy, fr.z], [fr.x, top, fr.z], 0.28, C.woodDark);
      fbox(props, fr, 0, top - 0.5, 0, 1.8, 0.16, 0.16, C.wood);
      const tops: V3[] = [fp(fr, -0.75, top - 0.35, 0), fp(fr, 0, top + 0.05, 0), fp(fr, 0.75, top - 0.35, 0)];
      if (prevTops) {
        for (let k = 0; k < 3; k++) {
          const a = prevTops[k];
          const b2 = tops[k];
          const mid: V3 = [(a[0] + b2[0]) / 2, (a[1] + b2[1]) / 2 - 0.55, (a[2] + b2[2]) / 2];
          for (const [p0, p1] of [
            [a, mid],
            [mid, b2],
          ] as [V3, V3][]) {
            flat.quad(p0, p1, [p1[0], p1[1] - 0.07, p1[2]], [p0[0], p0[1] - 0.07, p0[2]], C.wire);
          }
        }
      }
      prevTops = tops;
      // Nächster Mast: so weit wie möglich, aber die Leitung bleibt 3 m hinter der Bande.
      let step = span;
      while (step > 12 && !chordOk(m, m + step)) step -= 4;
      m += step;
    }
    // Signalmasten: Mast, Flügel (rot-weiß), Laterne
    for (const m of signals) {
      const i = seg(m);
      const fr = frame(m, t.wh[i] + 5.2);
      const gy = ground(fr.x, fr.z) - 0.4;
      beam(props, [fr.x, gy, fr.z], [fr.x, gy + 8.5, fr.z], 0.32, C.metal);
      prism(props, fr.x, fr.z, gy + 8.5, gy + 8.9, 0.3, 0.05, 6, C.dark);
      fbox(props, fr, -0.2, gy + 7.7, 0.25, 0.25, 0.42, 0.42, C.dark);
      // Flügel zeigt zur Strecke hin, endet weit vor der Bande
      fbox(props, fr, -0.9, gy + 7.2, 0.2, 1.4, 0.32, 0.1, C.red);
      fbox(props, fr, -1.35, gy + 7.2, 0.24, 0.35, 0.34, 0.1, C.white);
      // Leiter
      beam(props, fp(fr, 0.32, gy, 0), fp(fr, 0.32, gy + 7, 0), 0.08, C.dark);
    }
  }

  // =====================================================================================
  // Canyon: Minenstollen mit Lore, Pflanzen
  // =====================================================================================
  {
    const fr = frame(MINE);
    const wh = t.wh[seg(MINE)];
    const o0 = 4.5 + noise(MINE * 0.09, -5) * 2.2;
    // Sims in 5,5 m Höhe, Stollen in der zurückgesetzten Wand
    const ly = fr.ry + 5.8;
    const lw = -(wh + o0 + 9.6);
    // Stollenmund: dunkle Öffnung mit Holzrahmen
    fbox(props, fr, lw + 0.2, ly + 1.4, 0, 0.3, 2.8, 2.6, C.dark);
    fbox(props, fr, lw + 0.5, ly + 1.45, -1.45, 0.4, 2.9, 0.35, C.woodLight);
    fbox(props, fr, lw + 0.5, ly + 1.45, 1.45, 0.4, 2.9, 0.35, C.woodLight);
    fbox(props, fr, lw + 0.5, ly + 3.0, 0, 0.5, 0.4, 3.6, C.wood);
    // Schienen auf dem Sims und die Lore (klein, hoch oben – kein Waggon)
    for (const dw of [-0.45, 0.45]) beam(props, fp(fr, lw + 2, ly + 0.08, dw), fp(fr, lw + 6.5, ly + 0.08, dw * 1), 0.1, C.metal);
    for (let k = 0; k < 4; k++) fbox(props, fr, lw + 2.3 + k * 1.2, ly + 0.02, 0, 0.25, 0.08, 1.3, C.woodDark);
    const lc = lw + 4.6;
    const lore = new THREE.CylinderGeometry(0.85, 0.6, 0.9, 4, 1, false, Math.PI / 4);
    const lp = fp(fr, lc, ly + 0.85, 0);
    props.add(lore, C.metal, new THREE.Matrix4().makeRotationY(fr.rot).setPosition(lp[0], lp[1], lp[2]));
    lore.dispose();
    fbox(props, fr, lc, ly + 1.35, 0, 1.0, 0.3, 0.9, C.dark);
    for (const dw of [-0.4, 0.4]) fbox(props, fr, lc, ly + 0.3, dw, 0.9, 0.36, 0.12, C.dark);
    // Abraumhalde unter dem Sims
    {
      const a = fp(fr, lw + 3, ly - 0.2, -5);
      const b2 = fp(fr, lw + 3, ly - 0.2, 5);
      const c2 = fp(fr, -(wh + o0 + 0.5), fr.ry + 0.6, 7);
      const d = fp(fr, -(wh + o0 + 0.5), fr.ry + 0.6, -7);
      quadO(props, a, b2, c2, d, fr.rx, 1, fr.rz, rgb(0xcbb79a));
    }
    // Hinweistafel neben dem Stollen
    fbox(props, fr, lw + 1.0, ly + 1.3, -3.2, 0.1, 0.8, 1.4, C.woodLight);
    fbox(props, fr, lw + 1.05, ly + 0.6, -3.2, 0.12, 1.4, 0.12, C.woodDark);
  }

  /** Säulenkaktus mit Armen. */
  const cactus = (x: number, y: number, z: number, s: number, yaw: number): void => {
    const h = 4.2 * s;
    prism(props, x, z, y - 0.3, y + h, 0.42 * s, 0.36 * s, 5, C.green, C.greenDark);
    const arms = 1 + Math.floor(rnd() * 2);
    for (let k = 0; k < arms; k++) {
      const a = yaw + k * Math.PI;
      const ay = y + h * (0.38 + rnd() * 0.2);
      const ox = Math.cos(a);
      const oz = Math.sin(a);
      beam(props, [x + ox * 0.2 * s, ay, z + oz * 0.2 * s], [x + ox * 1.1 * s, ay, z + oz * 1.1 * s], 0.5 * s, C.greenDark);
      prism(props, x + ox * 1.1 * s, z + oz * 1.1 * s, ay - 0.25 * s, ay + h * 0.35, 0.28 * s, 0.24 * s, 4, C.green, C.greenDark);
    }
  };
  /** Palmlilie: kurzer Stamm, Schopf aus spitzen Blättern. */
  const yucca = (x: number, y: number, z: number, s: number): void => {
    prism(props, x, z, y - 0.2, y + 1.3 * s, 0.18 * s, 0.14 * s, 4, C.woodDark);
    const top = y + 1.3 * s;
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + rnd();
      const tip: V3 = [x + Math.cos(a) * 1.0 * s, top + 0.9 * s, z + Math.sin(a) * 1.0 * s];
      const l: V3 = [x + Math.cos(a + 1.4) * 0.16 * s, top, z + Math.sin(a + 1.4) * 0.16 * s];
      const r: V3 = [x + Math.cos(a - 1.4) * 0.16 * s, top, z + Math.sin(a - 1.4) * 0.16 * s];
      sheetO(props, [l, r, tip], Math.cos(a), 0.5, Math.sin(a), C.olive, shade(C.olive, 0.8));
    }
  };
  /** Vertrockneter Baum: kahler Stamm mit Ästen. */
  const deadTree = (x: number, y: number, z: number, s: number): void => {
    const top: V3 = [x + (rnd() - 0.5) * 0.6, y + 3.2 * s, z + (rnd() - 0.5) * 0.6];
    beam(props, [x, y - 0.3, z], top, 0.36 * s, rgb(0x7d6a58));
    for (let k = 0; k < 3; k++) {
      const a = rnd() * Math.PI * 2;
      const from: V3 = [x + (top[0] - x) * (0.5 + k * 0.2), y + 3.2 * s * (0.5 + k * 0.2), z + (top[2] - z) * (0.5 + k * 0.2)];
      beam(props, from, [from[0] + Math.cos(a) * 1.6 * s, from[1] + 1.2 * s, from[2] + Math.sin(a) * 1.6 * s], 0.18 * s, rgb(0x8f7c68));
    }
  };
  /** Findling. */
  const boulder = (x: number, y: number, z: number, s: number): void => {
    const g = new THREE.DodecahedronGeometry(s, 0);
    props.add(g, rnd() < 0.5 ? C.rock[1] : C.rock[2], new THREE.Matrix4().makeRotationY(rnd() * 6).setPosition(x, y + s * 0.3, z));
    g.dispose();
  };

  // Pflanzen und Findlinge entlang der Strecke
  {
    const want = detail === 0 ? 20 : 38;
    let placed = 0;
    for (let k = 0; k < 900 && placed < want; k++) {
      const m = Math.floor(rnd() * n);
      if (inRange(m, 1400, 160) || inRange(m, TUN0 - 6, TUN1 + 6) || inRange(m, DECK0 - 4, DECK1 + 4)) continue;
      const side = rnd() < 0.5 ? -1 : 1;
      const canyon = inRange(m, CAN0 + 20, CAN1 - 20);
      const o = canyon ? 4.0 + rnd() * 0.4 : 4.5 + rnd() * rnd() * 45;
      if (canyon && side > 0) continue;
      const fr = frame(m, side * (t.wh[seg(m)] + o));
      const c = world.clearance(fr.x, fr.z);
      // Art und Größe zuerst: geprüft wird, wie weit die Pflanze ausgreift (Äste, Arme), nicht nur ihr Fuß.
      const r = rnd();
      const kind = canyon ? 1 : r < 0.42 ? 0 : r < 0.62 ? 1 : r < 0.78 ? 2 : 3;
      const sc = kind === 0 ? 0.8 + rnd() * 0.6 : kind === 1 ? (canyon ? 0.8 + rnd() * 0.3 : 0.9 + rnd() * 0.5) : kind === 2 ? 0.9 + rnd() * 0.4 : 0.8 + rnd() * 1.4;
      const reach = kind === 0 ? 1.45 * sc : kind === 1 ? 1.05 * sc : kind === 2 ? 2.4 * sc : 1.1 * sc;
      if (c < 3.1 + reach || !free(fr.x, fr.z, 1.5)) continue;
      const y = ground(fr.x, fr.z);
      if (kind === 0) cactus(fr.x, y, fr.z, sc, rnd() * 6);
      else if (kind === 1) yucca(fr.x, y, fr.z, sc);
      else if (kind === 2) deadTree(fr.x, y, fr.z, sc);
      else boulder(fr.x, y, fr.z, sc);
      occupy(fr.x, fr.z, 1.5);
      placed++;
    }
    // Kakteen oben auf den Canyonwänden: Umrisse vor dem Himmel
    for (let m = CAN0 + 50; m < CAN1 - 40; m += detail === 0 ? 70 : 36) {
      const side = (m / 36) % 2 < 1 ? -1 : 1;
      const prof = canyonProfile(side)(m);
      const o = prof[6][0] + 2 + rnd() * 6;
      const fr = frame(m, side * (t.wh[seg(m)] + o));
      cactus(fr.x, fr.ry + prof[6][1] + 0.4, fr.z, 1 + rnd() * 0.4, rnd() * 6);
    }
  }

  // =====================================================================================
  // Viadukt: Kreuzstreben zwischen den Pfeilern der Welt, hölzerne Widerlager
  // =====================================================================================
  {
    const pillars: { m: number; p: [V3, V3] }[] = [];
    for (let i = DECK0; i <= DECK1; i++) {
      if (i % 14 !== 7 || (t.edge[i] & EDGE_DECK) === 0) continue;
      const lat = t.wh[i] + 1.0;
      const top = (l: number): V3 => [t.px[i] + rightX(t, i) * l, t.py[i] + l * t.bank[i] - 1.8, t.pz[i] + rightZ(t, i) * l];
      pillars.push({ m: i, p: [top(-lat), top(lat)] });
    }
    const wood = C.woodLight;
    const tier = 6.5;
    const footOf = (p: V3): number => ground(p[0], p[2]) - 1.5;
    for (let k = 0; k < pillars.length; k++) {
      const A = pillars[k];
      for (let s = 0; s < 2; s++) {
        const pa = A.p[s];
        const fa = footOf(pa);
        // Quer unter dem Deck: X zwischen linkem und rechtem Pfeiler (oberste Lage)
        if (s === 0) {
          const pb = A.p[1];
          const y0 = Math.max(fa, footOf(pb)) + 1;
          const yTop = pa[1] - 0.4;
          const levels = Math.max(1, Math.min(detail === 0 ? 1 : 3, Math.floor((yTop - y0) / tier)));
          for (let v = 0; v < levels; v++) {
            const yA = yTop - v * tier;
            const yB = Math.max(y0, yA - tier);
            beam(props, [pa[0], yA, pa[2]], [pb[0], yB, pb[2]], 0.32, wood);
            beam(props, [pa[0], yB, pa[2]], [pb[0], yA, pb[2]], 0.32, wood);
          }
        }
        if (k + 1 >= pillars.length) continue;
        // Längs: X und Zangen zwischen diesem und dem nächsten Pfeiler auf derselben Seite
        const pb = pillars[k + 1].p[s];
        const fb = footOf(pb);
        const y0 = Math.max(fa, fb) + 0.8;
        const yTop = Math.min(pa[1], pb[1]) - 0.4;
        const levels = Math.max(1, Math.min(detail === 0 ? 2 : 4, Math.round((yTop - y0) / tier)));
        const h = (yTop - y0) / levels;
        for (let v = 0; v < levels; v++) {
          const yA = yTop - v * h;
          const yB = yA - h;
          beam(props, [pa[0], yA, pa[2]], [pb[0], yB, pb[2]], 0.3, wood);
          beam(props, [pa[0], yB, pa[2]], [pb[0], yA, pb[2]], 0.3, wood);
          beam(props, [pa[0], yB, pa[2]], [pb[0], yB, pb[2]], 0.26, C.wood);
        }
      }
    }
    // Widerlager an beiden Enden: Holzkästen aus liegenden Balken unter dem Ende des Stegs (vor dem ersten Pfeiler)
    for (const [m0, dir] of [
      [DECK0, 1],
      [DECK1, -1],
    ] as [number, number][]) {
      const fr = frame(m0);
      const wh = t.wh[seg(m0)];
      const top = fr.ry - 1.2;
      const front = 2.6 * dir;
      const pF = fp(fr, 0, 0, front);
      const pS = fp(fr, wh, 0, front);
      const bot = Math.min(ground(pF[0], pF[2]), ground(pS[0], pS[2])) - 0.8;
      const nLog = Math.max(2, Math.min(8, Math.ceil((top - bot) / 0.7)));
      for (let k = 0; k < nLog; k++) {
        const y = top - k * 0.7;
        fbox(props, fr, 0, y - 0.35, front, 2 * wh + 0.6, 0.66, 0.66, k % 2 === 0 ? C.woodLight : C.wood);
        for (const s of [-1, 1]) fbox(props, fr, s * (wh + 0.05), y - 0.35, front - dir * 3, 0.66, 0.66, 6.4, k % 2 === 0 ? C.wood : C.woodLight);
      }
    }
  }

  // =====================================================================================
  // Tunnelportale: Bruchstein mit Holzrahmen
  // =====================================================================================
  {
    const H = TUNNEL_H;
    for (const [m, dir] of [
      [TUN0, -1],
      [TUN1, 1],
    ] as [number, number][]) {
      const i = seg(m);
      const fr0 = frame(m);
      const fr: Frame = { ...fr0, x: fr0.x + fr0.fx * dir * 0.3, z: fr0.z + fr0.fz * dir * 0.3 };
      const W = t.wh[i] + 0.75;
      const bank = t.bank[i];
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
      const B = 15.5;
      const top = fr.ry + 13.2;
      const gL = ground(fp(fr, -B, 0, 0)[0], fp(fr, -B, 0, 0)[2]) - 1.5;
      const gR = ground(fp(fr, B, 0, 0)[0], fp(fr, B, 0, 0)[2]) - 1.5;
      const OUT: [number, number][] = [
        [-B, gL - fr.ry],
        [-B, 5],
        [-B, 13.2],
        [-5, 13.2],
        [0, 13.2],
        [5, 13.2],
        [B, 13.2],
        [B, 5],
        [B, gR - fr.ry],
      ];
      for (let k = 0; k < IN.length - 1; k++) {
        const pi = (j: number): V3 => fp(fr, IN[j][0] * W, fr.ry + IN[j][0] * W * bank + IN[j][1], 0);
        const po = (j: number): V3 => fp(fr, OUT[j][0], fr.ry + OUT[j][1], 0);
        quadO(props, pi(k), pi(k + 1), po(k + 1), po(k), fr.fx * dir, 0, fr.fz * dir, k % 2 === 0 ? C.stone : shade(C.stone, 0.92));
      }
      // Bruchsteinpfeiler (mindestens 3 m neben der Fahrbahnkante) und Brüstung
      for (const s of [-1, 1]) {
        const l = s * (t.rh[i] + 3 + 2.6);
        const p = fp(fr, l, 0, dir * 0.9);
        const gy = ground(p[0], p[2]) - 1;
        fbox(props, fr, l, (gy + top + 1) / 2, dir * 0.9, 4.6, top + 1 - gy, 1.8, C.stoneDark, C.stone);
        fbox(props, fr, l, top + 1.3, dir * 0.9, 5.2, 0.6, 2.2, C.stone);
      }
      fbox(props, fr, 0, top + 0.4, dir * 0.4, 2 * B, 1.0, 1.0, C.stoneDark, C.stone);
      // Holzrahmen ums Mundloch
      for (const s of [-1, 1]) fbox(props, fr, s * (W + 0.6), fr.ry + 3.9, dir * 0.25, 0.9, 7.8, 0.5, C.wood);
      fbox(props, fr, 0, fr.ry + 8.2, dir * 0.25, 2 * W + 2.4, 0.9, 0.55, C.woodLight);
      // Schlusssteine im Bogen
      fbox(props, fr, 0, fr.ry + 9.5, dir * 0.3, 1.6, 1.4, 0.6, C.stoneDark);
    }
  }

  // =====================================================================================
  // Hochebene: Windrad mit Pumpe, Ranch mit Koppel, Viehschädel, Steinmännchen
  // =====================================================================================
  const windmill = { x: 0, y: 0, z: 0, rot: 0, rodY: 0, ux: 1, uz: 0 };
  {
    // Windrad
    const fr = frame(1066);
    const l = -(t.wh[seg(1066)] + 26);
    const c = fp(fr, l, 0, 0);
    const gy = groundMin(c[0], c[2], 3) - 0.4;
    const H = 13;
    for (const [dx, dz] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ])
      beam(props, [c[0] + dx * 2.2, gy, c[2] + dz * 2.2], [c[0] + dx * 0.35, gy + H, c[2] + dz * 0.35], 0.24, C.metal);
    for (let k = 1; k <= 3; k++) {
      const y = gy + (k * H) / 4;
      const s = 2.2 - (1.85 * k) / 4;
      for (const [a, b2] of [
        [
          [-1, -1],
          [1, -1],
        ],
        [
          [1, -1],
          [1, 1],
        ],
        [
          [1, 1],
          [-1, 1],
        ],
        [
          [-1, 1],
          [-1, -1],
        ],
      ])
        beam(props, [c[0] + a[0] * s, y, c[2] + a[1] * s], [c[0] + b2[0] * s, y, c[2] + b2[1] * s], 0.14, C.metal);
    }
    fbox(props, fr, l, gy + H + 0.3, 0, 1.2, 0.6, 1.2, C.dark);
    windmill.x = c[0];
    windmill.y = gy + H + 0.6;
    windmill.z = c[2];
    windmill.rodY = gy;
    // Der Wind kommt von der Strecke her: Das Rad zeigt ihr seine Fläche, die Fahnen wehen von ihr weg.
    windmill.ux = fr.rx;
    windmill.uz = fr.rz;
    // Wassertank und Tränke
    const tc = fp(fr, l + 6, 0, 3);
    const tg = groundMin(tc[0], tc[2], 3) - 0.3;
    prism(props, tc[0], tc[2], tg, tg + 2.2, 3, 3, 10, C.woodLight, C.river);
    for (let k = 0; k < 2; k++) prism(props, tc[0], tc[2], tg + 0.5 + k * 1.1, tg + 0.75 + k * 1.1, 3.08, 3.08, 10, C.metal, C.river);
    fbox(props, fr, l + 2.5, tg + 0.4, 6, 1.0, 0.8, 4.5, C.wood, C.river);
    occupy(c[0], c[2], 5);
    occupy(tc[0], tc[2], 4);
  }
  {
    // Ranch: Haus mit Veranda, Scheune, Koppel
    const fr = frame(1124);
    const wh = t.wh[seg(1124)];
    const hl = -(wh + 48);
    const hc = fp(fr, hl, 0, 0);
    const gy = groundMin(hc[0], hc[2], 6) - 0.3;
    fbox(props, fr, hl, gy + 1.8, 0, 7, 3.6, 10, C.woodLight);
    // Satteldach
    {
      const a = fp(fr, hl - 4, gy + 3.6, -5.6);
      const b2 = fp(fr, hl - 4, gy + 3.6, 5.6);
      const r1 = fp(fr, hl, gy + 6, 5.6);
      const r0 = fp(fr, hl, gy + 6, -5.6);
      const c2 = fp(fr, hl + 4, gy + 3.6, 5.6);
      const d = fp(fr, hl + 4, gy + 3.6, -5.6);
      quadO(props, a, b2, r1, r0, -fr.rx, 1, -fr.rz, C.red);
      quadO(props, d, c2, r1, r0, fr.rx, 1, fr.rz, shade(C.red, 0.9));
      triO(props, fp(fr, hl - 3.5, gy + 3.6, -5), fp(fr, hl + 3.5, gy + 3.6, -5), fp(fr, hl, gy + 5.8, -5), -fr.fx, 0, -fr.fz, C.woodLight);
      triO(props, fp(fr, hl - 3.5, gy + 3.6, 5), fp(fr, hl + 3.5, gy + 3.6, 5), fp(fr, hl, gy + 5.8, 5), fr.fx, 0, fr.fz, C.woodLight);
    }
    fbox(props, fr, hl + 4.6, gy + 2.6, 0, 2.2, 0.15, 10, C.wood);
    for (const w of [-4.6, 0, 4.6]) fbox(props, fr, hl + 5.5, gy + 1.3, w, 0.18, 2.6, 0.18, C.woodDark);
    fbox(props, fr, hl + 3.55, gy + 1.2, -2, 0.1, 2.2, 1.2, C.woodDark);
    fbox(props, fr, hl + 3.55, gy + 2.0, 2.4, 0.1, 1.0, 1.4, C.window);
    const ch = fp(fr, hl - 1.5, 0, 3);
    prism(props, ch[0], ch[2], gy + 4.5, gy + 7.2, 0.45, 0.45, 4, C.adobeDark, C.dark);
    occupy(hc[0], hc[2], 9);
    // Scheune
    const bl = hl + 2;
    const bc = fp(fr, bl, 0, -18);
    const bgy = groundMin(bc[0], bc[2], 5) - 0.3;
    fbox(props, fr, bl, bgy + 2.8, -18, 8, 5.6, 9, C.red, C.red);
    fbox(props, fr, bl, bgy + 6.0, -18, 8.6, 0.9, 9.6, C.woodDark);
    fbox(props, fr, bl + 4.05, bgy + 2.0, -18, 0.1, 4, 4, C.white);
    fbox(props, fr, bl + 4.1, bgy + 2.0, -18, 0.1, 3.6, 3.6, shade(C.red, 0.7));
    occupy(bc[0], bc[2], 7);
    // Koppel zwischen Ranch und Strecke
    const kl = -(wh + 24);
    const kw = 10;
    const posts: V3[] = [];
    const R = 9;
    const NP = detail === 0 ? 8 : 12;
    const kc = fp(fr, kl, 0, kw);
    for (let k = 0; k < NP; k++) {
      const a = (k / NP) * Math.PI * 2;
      const x = kc[0] + Math.cos(a) * R;
      const z = kc[2] + Math.sin(a) * R * 1.3;
      const y = ground(x, z) - 0.3;
      beam(props, [x, y, z], [x, y + 1.6, z], 0.2, C.woodDark);
      posts.push([x, y, z]);
    }
    for (let k = 0; k < NP; k++) {
      const a = posts[k];
      const b2 = posts[(k + 1) % NP];
      for (const hh of [0.7, 1.35]) beam(props, [a[0], a[1] + hh, a[2]], [b2[0], b2[1] + hh, b2[2]], 0.12, C.woodLight);
    }
    occupy(kc[0], kc[2], 13);
    if (hi) {
      // Ein paar Rinder in der Koppel (Rumpf, Kopf, Beine)
      for (let k = 0; k < 3; k++) {
        const a = k * 2.1 + 0.4;
        const x = kc[0] + Math.cos(a) * 4;
        const z = kc[2] + Math.sin(a) * 5;
        const y = ground(x, z);
        const yaw = a + 1.2;
        const col = k === 1 ? C.white : rgb(0x8a5a3a);
        props.box(x, y + 1.15, z, 0.9, 0.9, 2, col, yaw);
        props.box(x + Math.sin(yaw) * 1.2, y + 1.45, z + Math.cos(yaw) * 1.2, 0.6, 0.6, 0.7, col, yaw);
        for (const [dx, dz] of [
          [-0.3, -0.7],
          [0.3, -0.7],
          [-0.3, 0.7],
          [0.3, 0.7],
        ])
          props.box(x + dx * Math.cos(yaw) + dz * Math.sin(yaw), y + 0.4, z - dx * Math.sin(yaw) + dz * Math.cos(yaw), 0.2, 0.8, 0.2, C.dark, yaw);
      }
    }
    flagPoles.push(fp(fr, hl + 6.5, gy, -4));
  }
  // Viehschädel auf Pfählen und Steinmännchen neben der Strecke
  for (const [m, side] of [
    [1024, 1],
    [1152, -1],
    [404, -1],
  ] as [number, number][]) {
    const fr = frame(m, side * (t.wh[seg(m)] + 4));
    const gy = ground(fr.x, fr.z) - 0.3;
    beam(props, [fr.x, gy, fr.z], [fr.x, gy + 1.8, fr.z], 0.2, C.woodDark);
    fbox(props, fr, 0, gy + 1.95, 0, 0.5, 0.5, 0.7, C.bone);
    fbox(props, fr, -side * 0.15, gy + 1.8, 0, 0.35, 0.35, 0.45, C.bone);
    for (const s of [-1, 1]) beam(props, fp(fr, 0, gy + 2.1, s * 0.3), fp(fr, -side * 0.4, gy + 2.6, s * 0.9), 0.12, C.bone);
    fbox(props, fr, -side * 0.26, gy + 2.0, -0.17, 0.05, 0.14, 0.14, C.dark);
    fbox(props, fr, -side * 0.26, gy + 2.0, 0.17, 0.05, 0.14, 0.14, C.dark);
  }
  for (const [m, side] of [
    [1044, 1],
    [1178, -1],
    [1088, 1],
    [260, -1],
  ] as [number, number][]) {
    const fr = frame(m, side * (t.wh[seg(m)] + 5));
    let y = ground(fr.x, fr.z) - 0.1;
    for (let k = 0; k < 4; k++) {
      const s = 0.9 - k * 0.17;
      props.box(fr.x + (rnd() - 0.5) * 0.15, y + s * 0.3, fr.z + (rnd() - 0.5) * 0.15, s, s * 0.6, s * 0.85, k % 2 === 0 ? C.stone : C.stoneDark, rnd() * 3);
      y += s * 0.6;
    }
  }

  // =====================================================================================
  // Bewegtes: Gestell
  // =====================================================================================
  // (Die Objekte clock, tower, chains, flagPoles werden oben gefüllt – deshalb hier deklariert
  // und per Funktions-Hoisting erreichbar.)

  // Fahnen
  for (const p of flagPoles) {
    beam(props, p, [p[0], p[1] + 7, p[2]], 0.16, C.woodDark);
    flags.push({ x: p[0], y: p[1] + 6.9, z: p[2], col: C.yellow, size: 1.3 });
  }
  // Richtung, in die die Fahnen wehen (lokale x-Achse nach Drehung um WIND): mit dem Wind, vom Windrad aus von der Strecke weg.
  const WIND = Math.atan2(windmill.uz, -windmill.ux);
  const qWind = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), WIND);
  for (const f of flags) {
    const b = new MeshBuilder();
    const L = 2.2 * f.size;
    const Hh = 1.3 * f.size;
    const K = 4;
    for (let k = 0; k < K; k++) {
      const x0 = (k / K) * L;
      const x1 = ((k + 1) / K) * L;
      const col = k % 2 === 0 ? f.col : shade(f.col, 0.92);
      sheetRaw(b, [[x0, -Hh, 0.02], [x1, -Hh, 0.02], [x1, 0, 0.02], [x0, 0, 0.02]], col, shade(col, 0.85));
    }
    const part = rig.add(b, 0.11, rnd() * 6);
    part.p.set(f.x, f.y, f.z);
    part.q.copy(qWind);
  }

  // Wimpelketten
  const chainParts: { part: Part; axis: THREE.Vector3; ph: number }[] = [];
  for (const ch of chains) {
    const b = new MeshBuilder();
    const dx = ch.b[0] - ch.a[0];
    const dz = ch.b[2] - ch.a[2];
    const len = Math.hypot(dx, dz);
    const ux = dx / len;
    const uz = dz / len;
    const K = 14;
    const sag = 1.4;
    const at = (s: number): V3 => [ux * s * len, -sag * 4 * s * (1 - s), uz * s * len];
    for (let k = 0; k < K; k++) {
      const a = at(k / K);
      const c2 = at((k + 1) / K);
      sheetRaw(b, [a, c2, [c2[0], c2[1] - 0.08, c2[2]], [a[0], a[1] - 0.08, a[2]]], C.ink, C.ink);
      // Wimpel: Dreieck, hängt 0,9 m
      const m0 = at((k + 0.15) / K);
      const m1 = at((k + 0.85) / K);
      const tip: V3 = [(m0[0] + m1[0]) / 2, (m0[1] + m1[1]) / 2 - 0.9, (m0[2] + m1[2]) / 2];
      const col = [C.red, C.yellow, C.teal, C.white, C.blue][k % 5];
      sheetRaw(b, [m0, m1, tip], col, shade(col, 0.85));
    }
    const part = rig.add(b);
    part.p.set(ch.a[0], ch.a[1], ch.a[2]);
    chainParts.push({ part, axis: new THREE.Vector3(ux, 0, uz), ph: rnd() * 6 });
  }

  // Uhrzeiger
  const clockParts: Part[] = [];
  const clockAxis = new THREE.Vector3(clock.ax, 0, clock.az);
  const qClockBase = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), clock.rot);
  for (const [len, w, front] of [
    [1.0, 0.1, 0.06],
    [0.62, 0.15, 0.16],
  ]) {
    const b = new MeshBuilder();
    b.box(0, len / 2 - 0.1, 0, 0.06, len, w, C.ink);
    const part = rig.add(b);
    // Stundenzeiger vor dem Minutenzeiger, beide vor dem Zifferblatt
    part.p.set(clock.x + clock.ax * front, clock.y, clock.z + clock.az * front);
    clockParts.push(part);
  }

  // Schwenkarm des Wasserturms
  let towerPart: Part;
  {
    const b = new MeshBuilder();
    beam(b, [0, 0, 0], [0, -0.6, 3.4], 0.4, C.metal);
    beam(b, [0, -0.6, 3.4], [0, -1.7, 3.8], 0.34, C.metal);
    towerPart = rig.add(b);
    towerPart.p.set(tower.x, tower.y, tower.z);
  }

  // Windrad: Rad (dreht), Fahne, Pumpenstange
  let rotorPart: Part;
  let rodPart: Part;
  const qRotorBase = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(windmill.ux, windmill.uz));
  {
    const b = new MeshBuilder();
    const NB = 12;
    for (let k = 0; k < NB; k++) {
      const a = (k / NB) * Math.PI * 2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const r0 = 0.6;
      const r1 = 2.9;
      const w0 = 0.2;
      const w1 = 0.45;
      const p = (r: number, w: number, z: number): V3 => [ca * r - sa * w, sa * r + ca * w, z];
      const col = k % 3 === 0 ? C.red : C.white;
      sheetRaw(b, [p(r0, -w0, 0.05), p(r1, -w1, 0.18), p(r1, w1, -0.05), p(r0, w0, 0.05)], col, shade(col, 0.8));
    }
    prism(b, 0, 0, -0.3, 0.35, 0.45, 0.3, 6, C.dark);
    // Nabe als kleiner Quader quer zur Drehachse wirkt flach – gedreht wird um die lokale z-Achse.
    rotorPart = rig.add(b);
    rotorPart.p.set(windmill.x, windmill.y, windmill.z);
    const tail = new MeshBuilder();
    beam(tail, [0, 0, 0], [0, 0, -3.2], 0.16, C.metal);
    sheetRaw(tail, [[0.02, -0.7, -3.0], [0.02, -0.7, -4.6], [0.02, 0.9, -4.6], [0.02, 0.6, -3.0]], C.red, shade(C.red, 0.8));
    const tailPart = rig.add(tail);
    tailPart.p.set(windmill.x, windmill.y, windmill.z);
    tailPart.q.copy(qRotorBase);
    const rod = new MeshBuilder();
    rod.box(0, 0, 0, 0.12, 12.5, 0.12, C.metal);
    rodPart = rig.add(rod);
    rodPart.p.set(windmill.x, windmill.rodY + 6.4, windmill.z);
  }

  // Leute: Körper fest, ein Arm winkt
  const armParts: { part: Part; q0: THREE.Quaternion; axis: THREE.Vector3; ph: number; wave: boolean }[] = [];
  people.forEach((pp, k) => {
    const p = fp(pp.fr, pp.l, pp.y, pp.w);
    const yaw = pp.fr.rot + pp.yaw;
    const cl = CLOTHES[k % CLOTHES.length];
    const shirt = rgb(pp.staff ? 0x2f4a7a : cl[0]);
    const pants = rgb(pp.staff ? 0x2a3550 : cl[1]);
    const hat = rgb(pp.staff ? 0x2a3550 : cl[2]);
    const skin = rgb(SKIN[k % SKIN.length]);
    const s = 0.95 + ((k * 37) % 10) * 0.02;
    const cy = Math.cos(yaw);
    const sy = Math.sin(yaw);
    // lokal: x = zur Seite (Schulter), z = Blickrichtung
    const L = (x: number, z: number): [number, number] => [p[0] + x * cy + z * sy, p[2] - x * sy + z * cy];
    const [bx, bz] = L(0, 0);
    box5(props, bx, p[1] + 0.45 * s, bz, 0.5 * s, 0.9 * s, 0.32 * s, pants, yaw);
    box5(props, bx, p[1] + 1.25 * s, bz, 0.62 * s, 0.75 * s, 0.38 * s, shirt, yaw);
    box5(props, bx, p[1] + 1.86 * s, bz, 0.42 * s, 0.44 * s, 0.4 * s, skin, yaw);
    if (pp.staff) box5(props, bx, p[1] + 2.13 * s, bz, 0.46 * s, 0.16 * s, 0.5 * s, hat, yaw, rgb(0xd9483b));
    else {
      box5(props, bx, p[1] + 2.1 * s, bz, 0.78 * s, 0.07 * s, 0.78 * s, hat, yaw);
      box5(props, bx, p[1] + 2.22 * s, bz, 0.42 * s, 0.22 * s, 0.42 * s, hat, yaw);
    }
    // Ruhender Arm
    const [ax, az] = L(-0.4 * s, 0);
    box5(props, ax, p[1] + 1.25 * s, az, 0.17 * s, 0.7 * s, 0.17 * s, shirt, yaw);
    // Bewegter Arm (hängt vom Schultergelenk nach unten)
    const b = new MeshBuilder();
    b.box(0, -0.33 * s, 0, 0.17 * s, 0.68 * s, 0.17 * s, shirt);
    b.box(0, -0.72 * s, 0, 0.15 * s, 0.14 * s, 0.15 * s, skin);
    const part = rig.add(b);
    const [sx, sz] = L(0.4 * s, 0);
    part.p.set(sx, p[1] + 1.58 * s, sz);
    const q0 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    // Drehachse: Blickrichtung (Arm hebt sich seitlich)
    armParts.push({ part, q0, axis: new THREE.Vector3(0, 0, 1), ph: k * 1.37, wave: pp.wave });
  });

  // Geier: kreisen hoch über dem Canyon
  const vultures: { part: Part; cx: number; cz: number; y: number; r: number; w: number; ph: number }[] = [];
  {
    const c = frame(560, 28);
    const NV = detail === 0 ? 4 : 7;
    for (let k = 0; k < NV; k++) {
      const b = new MeshBuilder();
      const dark = rgb(0x2a2228);
      // Rumpf
      b.box(0, 0, 0, 0.5, 0.35, 1.5, dark);
      b.box(0, 0.05, 0.85, 0.22, 0.22, 0.35, rgb(0xd9a08a));
      // Schwingen: leichtes V, gefingerte Spitzen
      for (const s of [-1, 1]) {
        const root0: V3 = [s * 0.2, 0, 0.35];
        const root1: V3 = [s * 0.2, 0, -0.35];
        const tip0: V3 = [s * 3.0, 0.55, 0.15];
        const tip1: V3 = [s * 3.2, 0.6, -0.35];
        sheetO(b, [root0, root1, tip1, tip0], 0, 1, 0, dark, shade(dark, 1.3));
      }
      sheetO(b, [[-0.25, 0, -0.6], [0.25, 0, -0.6], [0, 0, -1.4]], 0, 1, 0, dark, dark);
      const part = rig.add(b);
      vultures.push({ part, cx: c.x + (rnd() - 0.5) * 16, cz: c.z + (rnd() - 0.5) * 16, y: c.ry + 40 + rnd() * 18, r: 16 + rnd() * 18, w: 0.22 + rnd() * 0.12, ph: rnd() * 6.28 });
    }
  }

  // Steppenläufer: rollen neben der Strecke (hinter der Bande) entlang, wachsen ein und verschwinden wieder
  const tumbles: { part: Part; path: Float32Array; len: number; speed: number; ph: number }[] = [];
  {
    const paths: [number, number, number][] = [
      [1020, -1, 7],
      [1110, 1, 9],
      [212, -1, 12],
      [1318, -1, 8],
      [250, 1, 18],
      [1060, 1, 30],
    ];
    paths.forEach(([m0, side, o], k) => {
      if (detail === 0 && k > 3) return;
      const N = 36;
      const path = new Float32Array(N * 3);
      for (let j = 0; j < N; j++) {
        const fr = frame(m0 + j * 2, side * (t.wh[seg(m0 + j * 2)] + o + Math.sin(j * 0.4) * 1.2));
        path[j * 3] = fr.x;
        path[j * 3 + 1] = ground(fr.x, fr.z);
        path[j * 3 + 2] = fr.z;
      }
      const b = new MeshBuilder();
      const g1 = new THREE.IcosahedronGeometry(0.75, 0);
      const g2 = new THREE.IcosahedronGeometry(0.6, 0);
      b.add(g1, C.tumble);
      b.add(g2, shade(C.tumble, 0.8), new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0.6, 0.9, 0.3)));
      g1.dispose();
      g2.dispose();
      const part = rig.add(b);
      tumbles.push({ part, path, len: N - 1, speed: 3.5 + rnd() * 2.5, ph: rnd() * 40 });
    });
  }

  // Heißluftballon über dem Innenraum
  let balloonPart: Part;
  const balloon = { cx: world.center.x - 40, cz: world.center.z + 10, y: 72 };
  {
    const b = new MeshBuilder();
    const NS = 12;
    const rings: [number, number][] = [
      [0.0, -6.5],
      [2.6, -5.2],
      [5.4, -2.4],
      [6.6, 1.0],
      [6.2, 4.0],
      [4.4, 6.6],
      [1.6, 8.0],
      [0, 8.3],
    ];
    const cols = [C.red, C.yellow, C.white, C.teal];
    for (let j = 0; j < rings.length - 1; j++) {
      for (let k = 0; k < NS; k++) {
        const a0 = (k / NS) * Math.PI * 2;
        const a1 = ((k + 1) / NS) * Math.PI * 2;
        const [r0, y0] = rings[j];
        const [r1, y1] = rings[j + 1];
        const P = (r: number, y: number, a: number): V3 => [Math.cos(a) * r, y, Math.sin(a) * r];
        const am = (a0 + a1) / 2;
        quadO(b, P(r0, y0, a0), P(r0, y0, a1), P(r1, y1, a1), P(r1, y1, a0), Math.cos(am), 0, Math.sin(am), cols[k % 4]);
      }
    }
    b.box(0, -9.6, 0, 1.6, 1.2, 1.6, C.woodLight);
    for (const [dx, dz] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ])
      beam(b, [dx * 0.75, -9.0, dz * 0.75], [dx * 0.4, -6.5, dz * 0.4], 0.06, C.ink);
    balloonPart = rig.add(b);
  }

  // --- Durchscheinend: Staubteufel und Dunstbänder am Horizont ---
  const devils: { part: Part; cx: number; cz: number; gy: number; rx: number; rz: number; ph: number }[] = [];
  {
    const cands: [number, number, number][] = [
      [1090, -1, 120],
      [1150, -1, 210],
      [960, 1, 160],
      [400, -1, 150],
    ];
    cands.forEach(([m, side, o], k) => {
      if (detail === 0 && k > 1) return;
      const fr = frame(m, side * (t.wh[seg(m)] + o));
      const b = new MeshBuilder();
      const NS = 8;
      const rings: [number, number][] = [
        [0.8, 0],
        [1.6, 5],
        [3.0, 11],
        [5.0, 18],
        [7.0, 24],
      ];
      for (let j = 0; j < rings.length - 1; j++) {
        for (let q = 0; q < NS; q++) {
          const tw0 = j * 0.5;
          const tw1 = (j + 1) * 0.5;
          const a0 = (q / NS) * Math.PI * 2;
          const a1 = ((q + 1) / NS) * Math.PI * 2;
          const P = (r: number, y: number, a: number): V3 => [Math.cos(a) * r, y, Math.sin(a) * r];
          b.quad(P(rings[j][0], rings[j][1], a0 + tw0), P(rings[j][0], rings[j][1], a1 + tw0), P(rings[j + 1][0], rings[j + 1][1], a1 + tw1), P(rings[j + 1][0], rings[j + 1][1], a0 + tw1), q % 2 === 0 ? rgb(0xe9c995) : rgb(0xdcb57e));
        }
      }
      const part = haze.add(b);
      devils.push({ part, cx: fr.x, cz: fr.z, gy: ground(fr.x, fr.z) - 0.5, rx: 30 + rnd() * 20, rz: 25 + rnd() * 20, ph: rnd() * 6 });
    });
    // Dunstbänder: ruhig, hell, tief am Horizont
    const b = new MeshBuilder();
    const R0 = 820;
    for (let k = 0; k < 9; k++) {
      const a0 = (k / 9) * Math.PI * 2 + rnd() * 0.2;
      const a1 = a0 + 0.45 + rnd() * 0.25;
      const SEG = 6;
      for (let s = 0; s < SEG; s++) {
        const b0 = a0 + ((a1 - a0) * s) / SEG;
        const b1 = a0 + ((a1 - a0) * (s + 1)) / SEG;
        const R = R0 + (k % 3) * 60;
        const y0 = -2;
        const y1 = 9 + (k % 2) * 6;
        const P = (a: number, y: number): V3 => [world.center.x + Math.cos(a) * R, y, world.center.z + Math.sin(a) * R];
        b.quad(P(b0, y0), P(b1, y0), P(b1, y1), P(b0, y1), rgb(0xfff4e0));
      }
    }
    haze.add(b);
  }

  // =====================================================================================
  // Netze
  // =====================================================================================
  const toonV = toonMaterial({ vertexColors: true });
  disposables.push(toonV);
  const addStatic = (b: MeshBuilder, outline: number): THREE.BufferGeometry | null => {
    if (b.empty) return null;
    const geo = b.build();
    const mesh = new THREE.Mesh(geo, toonV);
    group.add(mesh);
    disposables.push(geo);
    if (outline > 0 && hi) {
      addSmoothNormals(geo);
      const ol = new THREE.Mesh(geo, outlineMaterial(outline));
      ol.name = 'outline';
      group.add(ol);
    }
    return geo;
  };
  addStatic(rock, 0.11);
  addStatic(props, 0.05);
  addStatic(farRock, 0);
  if (!flat.empty) {
    const geo = flat.build();
    const mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
    group.add(new THREE.Mesh(geo, mat));
    disposables.push(geo, mat);
  }
  const rigGeo = rig.build();
  const rigMesh = new THREE.Mesh(rigGeo, toonV);
  rigMesh.frustumCulled = false;
  group.add(rigMesh);
  disposables.push(rigGeo);
  if (hi) {
    const ol = new THREE.Mesh(rigGeo, outlineMaterial(0.04));
    ol.name = 'outline';
    ol.frustumCulled = false;
    group.add(ol);
  }
  const hazeGeo = haze.build();
  const hazeMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.42, depthWrite: false, side: THREE.DoubleSide });
  // Durchscheinend und beidseitig zeichnete three.js sonst in zwei Durchgängen (ein Zeichenaufruf mehr).
  hazeMat.forceSinglePass = true;
  const hazeMesh = new THREE.Mesh(hazeGeo, hazeMat);
  hazeMesh.frustumCulled = false;
  hazeMesh.renderOrder = 2;
  group.add(hazeMesh);
  disposables.push(hazeGeo, hazeMat);

  // =====================================================================================
  // Je Bild
  // =====================================================================================
  const qa = new THREE.Quaternion();
  const qb = new THREE.Quaternion();
  const yAxis = new THREE.Vector3(0, 1, 0);
  const zAxis = new THREE.Vector3(0, 0, 1);
  const tmp = new THREE.Vector3();

  return {
    group,
    update(time: number): void {
      // Fahnen: nur das Flattern (im Gestell)
      // Wimpelketten schaukeln um die Sehne
      for (let k = 0; k < chainParts.length; k++) {
        const c = chainParts[k];
        c.part.q.setFromAxisAngle(c.axis, Math.sin(time * 1.6 + c.ph) * 0.14);
      }
      // Uhr: Minutenzeiger schleicht sichtbar, Stundenzeiger langsam
      {
        const minute = time * 0.105;
        clockParts[0].q.setFromAxisAngle(clockAxis, -minute).multiply(qClockBase);
        clockParts[1].q.setFromAxisAngle(clockAxis, -minute / 12 - 1.2).multiply(qClockBase);
      }
      // Schwenkarm: liegt parallel zum Gleis und schwenkt ab und zu ein Stück heraus (nie über die Bande)
      {
        const k = Math.max(0, Math.sin(time * 0.21)) ** 2;
        towerPart.q.setFromAxisAngle(yAxis, tower.rot + k * -0.5);
      }
      // Windrad
      {
        const a = time * 2.4;
        qa.setFromAxisAngle(zAxis, a);
        rotorPart.q.copy(qRotorBase).multiply(qa);
        // Rad sitzt vor dem Kopf
        tmp.set(0, 0, 0.9).applyQuaternion(qRotorBase);
        rotorPart.p.set(windmill.x + tmp.x, windmill.y, windmill.z + tmp.z);
        rodPart.p.y = windmill.rodY + 6.4 + Math.sin(a) * 0.35;
      }
      // Leute winken
      for (let k = 0; k < armParts.length; k++) {
        const a = armParts[k];
        const ang = a.wave ? 2.6 + Math.sin(time * 7 + a.ph) * 0.45 : 0.12 + Math.sin(time * 1.3 + a.ph) * 0.05;
        qa.setFromAxisAngle(a.axis, ang);
        a.part.q.copy(a.q0).multiply(qa);
      }
      // Geier kreisen und neigen sich in die Kurve
      for (let k = 0; k < vultures.length; k++) {
        const v = vultures[k];
        const a = time * v.w + v.ph;
        v.part.p.set(v.cx + Math.cos(a) * v.r, v.y + Math.sin(a * 2.3) * 1.5, v.cz + Math.sin(a) * v.r);
        // Flugrichtung: Tangente des Kreises
        qa.setFromAxisAngle(yAxis, -a);
        qb.setFromAxisAngle(zAxis, 0.32 + Math.sin(time * 0.7 + v.ph) * 0.08);
        v.part.q.copy(qa).multiply(qb);
      }
      // Steppenläufer
      for (let k = 0; k < tumbles.length; k++) {
        const tw = tumbles[k];
        const total = tw.len * 2;
        const span = total + 18; // Pause zwischen zwei Durchläufen
        const d = (time * tw.speed + tw.ph * tw.speed) % span;
        if (d > total) {
          tw.part.s = 0;
          continue;
        }
        const f = d / 2;
        const j = Math.min(tw.len - 1, Math.floor(f));
        const u = f - j;
        const P = tw.path;
        const x = P[j * 3] + (P[j * 3 + 3] - P[j * 3]) * u;
        const y = P[j * 3 + 1] + (P[j * 3 + 4] - P[j * 3 + 1]) * u;
        const z = P[j * 3 + 2] + (P[j * 3 + 5] - P[j * 3 + 2]) * u;
        const dx = P[j * 3 + 3] - P[j * 3];
        const dz = P[j * 3 + 5] - P[j * 3 + 2];
        const grow = Math.min(1, d / 6, (total - d) / 6);
        tw.part.s = Math.max(0.001, grow);
        tw.part.p.set(x, y + 0.7 * grow + Math.abs(Math.sin(d * 0.8)) * 0.6, z);
        tmp.set(dz, 0, -dx).normalize();
        tw.part.q.setFromAxisAngle(tmp, d / 0.7);
      }
      // Ballon zieht langsam seine Runde
      {
        const a = time * 0.025;
        balloonPart.p.set(balloon.cx + Math.cos(a) * 70, balloon.y + Math.sin(time * 0.15) * 3, balloon.cz + Math.sin(a) * 55);
        balloonPart.q.setFromAxisAngle(yAxis, time * 0.05);
      }
      rig.apply(time);
      // Staubteufel wandern und drehen sich
      for (let k = 0; k < devils.length; k++) {
        const d = devils[k];
        const a = time * 0.05 + d.ph;
        d.part.p.set(d.cx + Math.cos(a) * d.rx, d.gy, d.cz + Math.sin(a * 1.3) * d.rz);
        d.part.q.setFromAxisAngle(yAxis, time * 2.2 + d.ph);
        d.part.s = 0.85 + Math.sin(time * 0.4 + d.ph) * 0.15;
      }
      haze.apply(time);
    },
    dispose(): void {
      for (const d of disposables) d.dispose();
    },
  };
}
