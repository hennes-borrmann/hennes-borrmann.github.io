// Verkehr der Nachtschicht: Taxis, Lieferwagen, Busse und die Straßenbahn.
//
// Jede Fahrzeugart ist EIN InstancedMesh (plus eine instanzierte Tuschekontur),
// dazu kommen für alle zusammen ein Mesh mit Schattenflecken, eines mit
// Lichthöfen (Rücklichter, Taxischild, Lichtkegel der Scheinwerfer auf der
// Fahrbahn) und das Gleis der Straßenbahn: höchstens elf Zeichenaufrufe.
//
// Damit das mit einem einzigen Material geht, trägt jede Ecke drei Kennzeichen
// (Attribut "vflag"):
//   x – Leuchten 0 … 1: so viel der Farbe wird ungeschattet ausgegeben
//       (Scheinwerfer, Rücklichter, von innen beleuchtete Fenster);
//   y – Lackkanal: 0 = feste Farbe, 1 = Lack, 2 = Zierfarbe des Wagens –
//       beide kommen je Instanz (iPaint, iTrim), fest an v.id gebunden;
//   z – Wagenmaske der Straßenbahn: Bit 1/2/3 = vorderer/mittlerer/hinterer
//       Wagen, 0 = immer. So hat der vordere Wagen eine Fahrerkabine vorn, der
//       hintere hinten, und nur der mittlere den Stromabnehmer – mit einer
//       Geometrie. Unpassende Ecken fallen im Vertex-Shader auf einen Punkt.
//
// Die Maße kommen aus der Physik (VEHICLE_SPECS): Länge 2·half, Breite
// 2·halfWidth, Höhe height, Unterkante auf der Fahrbahn. Nur Spiegel,
// Taxischild, Stromabnehmer und die Faltenbälge zwischen den Bahnwagen ragen
// ein paar Zentimeter darüber hinaus.

import * as THREE from 'three';
import { VEH_BUS, VEH_TAXI, VEH_TRAM, VEH_VAN, VEHICLE_SPECS, type Vehicle } from '../../game/mechanics';
import { newVehiclePose, rightX, rightZ, vehiclePose, type Track } from '../../game/track';
import type { FxSink } from '../fxApi';
import type { MechanicView } from '../mechanics';
import { THEMES } from '../themes';
import { addSmoothNormals, INK, rgb, toonMaterial } from '../toon';

type V3 = [number, number, number];
type RGB = [number, number, number];

// --- Bausteine -------------------------------------------------------------------

/** Farbe einer Fläche samt Leuchten und Lackkanal. */
interface Farbe {
  c: RGB;
  g: number;
  p: number;
}

const fest = (hex: number): Farbe => ({ c: rgb(hex), g: 0, p: 0 });
const licht = (hex: number, g = 1): Farbe => ({ c: rgb(hex), g, p: 0 });
/** Lack des Wagens (Instanzfarbe), f dunkelt ab. */
const lack = (f = 1): Farbe => ({ c: [f, f, f], g: 0, p: 1 });
/** Zierfarbe des Wagens (Instanzfarbe). */
const zier = (f = 1): Farbe => ({ c: [f, f, f], g: 0, p: 2 });

const REIFEN = fest(0x211e2b);
const NABE = fest(0xa3a8bf);
const RADKASTEN = fest(0x14111b);
const DUNKEL = fest(0x2a2838);
const STOSS = fest(0x34323f);
const DACH = fest(0xd2d5e2);
const DACH_KANTE = fest(0xb8bccd);
const LEUTE = fest(0x2c2340);
const SCHEINWERFER = licht(0xfff4cf);
const RUECKLICHT = licht(0xff1626);
const BLINKER = licht(0xffa21f);
const KENNZEICHEN = licht(0xe8e4cc, 0.6);
const INNEN = licht(0xffd27a);
const INNEN_HELL = licht(0xffe6ad);
const GLAS = licht(0x56609e, 0.55);
const GLAS_DUNKEL = licht(0x2b3154, 0.35);
const KABINE = licht(0x3a4680, 0.6);
const SCHILD = licht(0xffe680);

// Atlas für Beschriftungen (u0, v0, u1, v1); der Rest ist weiß.
const UV0: [number, number] = [0.02, 0.02];
const UV_TAXI: [number, number, number, number] = [0.01, 0.82, 0.49, 0.99];
const UV_N7: [number, number, number, number] = [0.51, 0.82, 0.99, 0.99];
const UV_LINIE4: [number, number, number, number] = [0.01, 0.635, 0.49, 0.805];
const UV_KARO: [number, number, number, number] = [0, 0.5625, 1, 0.625];

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const lerp3 = (a: V3, b: V3, k: number): V3 => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

/** Profilpunkt (Seitenansicht z, y) samt Farbe der Kante zum nächsten Punkt (null = keine Fläche). */
interface Pt {
  z: number;
  y: number;
  f: Farbe | null;
}

/**
 * Sammelt Flächen mit Farbe, Kennzeichen und Texturkoordinaten. Solange
 * "huelle" gesetzt ist, wandert jede Fläche zusätzlich in die Kontur-Hülle –
 * so bekommen nur die großen Körper eine Tuschelinie, nicht jedes Lämpchen.
 */
class Bau {
  readonly pos: number[] = [];
  readonly col: number[] = [];
  readonly flg: number[] = [];
  readonly uv: number[] = [];
  mask = 0;
  huelle = false;
  hull: Bau | null = null;

  get triangles(): number {
    return this.pos.length / 9;
  }

  tri(a: V3, b: V3, c: V3, f: Farbe, ua = UV0, ub = UV0, uc = UV0): void {
    this.pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    for (let i = 0; i < 3; i++) {
      this.col.push(f.c[0], f.c[1], f.c[2]);
      this.flg.push(f.g, f.p, this.mask);
    }
    this.uv.push(ua[0], ua[1], ub[0], ub[1], uc[0], uc[1]);
    if (this.huelle && this.hull) {
      this.hull.mask = this.mask;
      this.hull.tri(a, b, c, f);
    }
  }

  /** Dreieck, dessen Vorderseite zur Richtung n zeigt. */
  triN(a: V3, b: V3, c: V3, f: Farbe, n: V3): void {
    if (dot(cross(sub(b, a), sub(c, a)), n) < 0) this.tri(a, c, b, f);
    else this.tri(a, b, c, f);
  }

  /** Viereck a→b→c→d, Vorderseite zur Richtung n; uv: a = (u0,v0), b = (u1,v0), c = (u1,v1), d = (u0,v1). */
  quadN(a: V3, b: V3, c: V3, d: V3, f: Farbe, n: V3, uv?: readonly [number, number, number, number]): void {
    const A: [number, number] = uv ? [uv[0], uv[1]] : UV0;
    const B: [number, number] = uv ? [uv[2], uv[1]] : UV0;
    const C: [number, number] = uv ? [uv[2], uv[3]] : UV0;
    const D: [number, number] = uv ? [uv[0], uv[3]] : UV0;
    if (dot(cross(sub(c, a), sub(d, b)), n) < 0) {
      this.tri(a, c, b, f, A, C, B);
      this.tri(a, d, c, f, A, D, C);
    } else {
      this.tri(a, b, c, f, A, B, C);
      this.tri(a, c, d, f, A, C, D);
    }
  }

  /** Fläche quer zur Fahrtrichtung bei z (zeigt nach vorn, wenn z > 0); x0 → x1 ist die Leserichtung der Beschriftung. */
  rectZ(z: number, x0: number, x1: number, y0: number, y1: number, f: Farbe, uv?: readonly [number, number, number, number]): void {
    this.quadN([x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z], f, [0, 0, Math.sign(z)], uv);
  }

  /** Fläche an der Flanke bei x (zeigt nach außen). */
  rectX(x: number, z0: number, z1: number, y0: number, y1: number, f: Farbe, uv?: readonly [number, number, number, number]): void {
    this.quadN([x, y0, z0], [x, y0, z1], [x, y1, z1], [x, y1, z0], f, [Math.sign(x), 0, 0], uv);
  }

  /** Quader um (cx, cy, cz); ohne Boden, sofern nicht verlangt. */
  box(cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, f: Farbe, top: Farbe = f, bottom = false): void {
    const x0 = cx - sx / 2;
    const x1 = cx + sx / 2;
    const y0 = cy - sy / 2;
    const y1 = cy + sy / 2;
    const z0 = cz - sz / 2;
    const z1 = cz + sz / 2;
    this.quadN([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], f, [0, 0, 1]);
    this.quadN([x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], f, [0, 0, -1]);
    this.quadN([x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0], f, [1, 0, 0]);
    this.quadN([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], f, [-1, 0, 0]);
    this.quadN([x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], top, [0, 1, 0]);
    if (bottom) this.quadN([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], f, [0, -1, 0]);
  }

  /** Vierkantstab von a nach b (ohne Stirnflächen). */
  beam(a: V3, b: V3, w: number, f: Farbe): void {
    const d = sub(b, a);
    const len = Math.hypot(d[0], d[1], d[2]);
    const dn: V3 = [d[0] / len, d[1] / len, d[2] / len];
    let u = cross(dn, [0, 1, 0]);
    if (Math.hypot(u[0], u[1], u[2]) < 1e-3) u = cross(dn, [1, 0, 0]);
    const ul = Math.hypot(u[0], u[1], u[2]);
    u = [(u[0] / ul) * w * 0.5, (u[1] / ul) * w * 0.5, (u[2] / ul) * w * 0.5];
    let v = cross(dn, u);
    const vl = Math.hypot(v[0], v[1], v[2]);
    v = [(v[0] / vl) * w * 0.5, (v[1] / vl) * w * 0.5, (v[2] / vl) * w * 0.5];
    const off = (p: V3, su: number, sv: number): V3 => [p[0] + u[0] * su + v[0] * sv, p[1] + u[1] * su + v[1] * sv, p[2] + u[2] * su + v[2] * sv];
    const corners: [number, number][] = [
      [1, 1],
      [-1, 1],
      [-1, -1],
      [1, -1],
    ];
    for (let k = 0; k < 4; k++) {
      const [su0, sv0] = corners[k];
      const [su1, sv1] = corners[(k + 1) % 4];
      const n: V3 = [u[0] * (su0 + su1) + v[0] * (sv0 + sv1), u[1] * (su0 + su1) + v[1] * (sv0 + sv1), u[2] * (su0 + su1) + v[2] * (sv0 + sv1)];
      this.quadN(off(a, su0, sv0), off(a, su1, sv1), off(b, su1, sv1), off(b, su0, sv0), f, n);
    }
  }

  /** Seitenprofil (z, y) quer über die Breite ±hw gezogen; Flanken in Farbe side. */
  extrudeX(pts: Pt[], hw: number, side: Farbe): void {
    const contour = pts.map((p) => new THREE.Vector2(p.z, p.y));
    const faces = THREE.ShapeUtils.triangulateShape(contour, []);
    for (const s of [1, -1]) {
      for (const [i, j, k] of faces) {
        this.triN([s * hw, pts[i].y, pts[i].z], [s * hw, pts[j].y, pts[j].z], [s * hw, pts[k].y, pts[k].z], side, [s, 0, 0]);
      }
    }
    let area = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      area += a.z * b.y - b.z * a.y;
    }
    const sg = area > 0 ? 1 : -1;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      if (!a.f) continue;
      const n: V3 = [0, -(b.z - a.z) * sg, (b.y - a.y) * sg];
      this.quadN([hw, a.y, a.z], [hw, b.y, b.z], [-hw, b.y, b.z], [-hw, a.y, a.z], a.f, n);
    }
  }

  /** Mantel zwischen zwei Querschnitten gleicher Punktzahl (geschlossen); styles[i] gilt für die Kante i → i+1. */
  loft(ra: V3[], rb: V3[], styles: (Farbe | null)[]): void {
    let cx = 0;
    let cy = 0;
    for (const p of ra) {
      cx += p[0];
      cy += p[1];
    }
    cx /= ra.length;
    cy /= ra.length;
    for (let i = 0; i < ra.length; i++) {
      const f = styles[i];
      if (!f) continue;
      const j = (i + 1) % ra.length;
      const m = lerp3(lerp3(ra[i], ra[j], 0.5), lerp3(rb[i], rb[j], 0.5), 0.5);
      this.quadN(ra[i], ra[j], rb[j], rb[i], f, [m[0] - cx, m[1] - cy, 0]);
    }
  }

  /** Stirnfläche über einem Linienzug, in (x, y) zerlegt; zeigt zur Richtung n. */
  cap(pts: V3[], f: Farbe, n: V3): void {
    const faces = THREE.ShapeUtils.triangulateShape(
      pts.map((p) => new THREE.Vector2(p[0], p[1])),
      [],
    );
    for (const [i, j, k] of faces) this.triN(pts[i], pts[j], pts[k], f, n);
  }

  /** Rad als Sechskant mit flacher Unterseite; xo = Außenseite (Betrag), s = Seite. */
  wheel(s: number, xo: number, z: number, r: number, w: number, hub: Farbe = NABE): void {
    const cy = r * Math.sin(Math.PI / 3);
    const O: V3[] = [];
    const I: V3[] = [];
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      O.push([s * xo, cy + Math.sin(a) * r, z + Math.cos(a) * r]);
      I.push([s * (xo - w), cy + Math.sin(a) * r, z + Math.cos(a) * r]);
    }
    for (let k = 0; k < 6; k++) {
      const j = (k + 1) % 6;
      const am = ((k + 0.5) / 6) * Math.PI * 2;
      this.quadN(O[k], O[j], I[j], I[k], REIFEN, [0, Math.sin(am), Math.cos(am)]);
    }
    for (let k = 1; k < 5; k++) this.triN(O[0], O[k], O[k + 1], REIFEN, [s, 0, 0]);
    const h = r * 0.42;
    this.rectX(s * (xo + 0.004), z - h, z + h, cy - h, cy + h, hub);
  }

  /** Dunkler Radkasten (Halbrund) auf der Flanke hinter einem Rad. */
  arch(s: number, x: number, z: number, r: number): void {
    const cy = r * Math.sin(Math.PI / 3);
    const R = r * 1.2;
    const c: V3 = [s * x, cy - r * 0.35, z];
    for (let k = 0; k < 4; k++) {
      const a0 = (k / 4) * Math.PI;
      const a1 = ((k + 1) / 4) * Math.PI;
      this.triN(c, [s * x, cy + Math.sin(a0) * R, z + Math.cos(a0) * R], [s * x, cy + Math.sin(a1) * R, z + Math.cos(a1) * R], RADKASTEN, [s, 0, 0]);
    }
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('vflag', new THREE.Float32BufferAttribute(this.flg, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.computeVertexNormals();
    return g;
  }

  /** Nur Lage und Maske – für die Kontur. */
  buildHull(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('vflag', new THREE.Float32BufferAttribute(this.flg, 3));
    g.computeVertexNormals();
    addSmoothNormals(g);
    g.deleteAttribute('normal');
    return g;
  }
}

/** Fenster: Viereck um den Anteil k zur Mitte eingerückt und um 8 mm nach außen versetzt. */
function inset(b: Bau, q: V3[], k: number, f: Farbe, n: V3): void {
  const m: V3 = [(q[0][0] + q[1][0] + q[2][0] + q[3][0]) / 4, (q[0][1] + q[1][1] + q[2][1] + q[3][1]) / 4, (q[0][2] + q[1][2] + q[2][2] + q[3][2]) / 4];
  const nl = Math.hypot(n[0], n[1], n[2]);
  const o: V3 = [(n[0] / nl) * 0.008, (n[1] / nl) * 0.008, (n[2] / nl) * 0.008];
  const p = q.map((v) => {
    const w = lerp3(v, m, k);
    return [w[0] + o[0], w[1] + o[1], w[2] + o[2]] as V3;
  });
  b.quadN(p[0], p[1], p[2], p[3], f, n);
}

// --- Modelle ---------------------------------------------------------------------

/** Taxi: gelbe Limousine mit Karoband und leuchtendem Dachschild. */
function buildTaxi(b: Bau): void {
  const HW = 0.95;
  b.huelle = true;
  b.extrudeX(
    [
      { z: -2.12, y: 0.24, f: null },
      { z: 2.12, y: 0.24, f: STOSS },
      { z: 2.2, y: 0.44, f: lack(0.92) },
      { z: 2.2, y: 0.66, f: lack() },
      { z: 2.06, y: 0.82, f: lack() },
      { z: 0.9, y: 0.9, f: lack() },
      { z: -1.3, y: 0.92, f: lack() },
      { z: -2.08, y: 0.88, f: lack() },
      { z: -2.2, y: 0.74, f: lack(0.92) },
      { z: -2.2, y: 0.44, f: STOSS },
    ],
    HW,
    lack(),
  );
  // Fahrgastzelle: Pyramidenstumpf
  const yb = 0.9;
  const yt = 1.42;
  const xb = 0.9;
  const xt = 0.72;
  const zbf = 0.9;
  const zbr = -1.3;
  const ztf = 0.15;
  const ztr = -0.88;
  const bfl: V3 = [xb, yb, zbf];
  const bfr: V3 = [-xb, yb, zbf];
  const brl: V3 = [xb, yb, zbr];
  const brr: V3 = [-xb, yb, zbr];
  const tfl: V3 = [xt, yt, ztf];
  const tfr: V3 = [-xt, yt, ztf];
  const trl: V3 = [xt, yt, ztr];
  const trr: V3 = [-xt, yt, ztr];
  const nFront: V3 = [0, zbf - ztf, yt - yb];
  const nRear: V3 = [0, ztr - zbr, -(yt - yb)];
  const nL: V3 = [yt - yb, xb - xt, 0];
  const nR: V3 = [-(yt - yb), xb - xt, 0];
  b.quadN(bfl, bfr, tfr, tfl, lack(), nFront);
  b.quadN(brl, brr, trr, trl, lack(), nRear);
  b.quadN(bfl, brl, trl, tfl, lack(), nL);
  b.quadN(bfr, brr, trr, tfr, lack(), nR);
  b.quadN(tfl, tfr, trr, trl, lack(), [0, 1, 0]);
  // Dachschild (leuchtet, mit Kontur)
  b.box(0, 1.55, -0.36, 0.64, 0.26, 0.3, SCHILD);
  b.huelle = false;
  b.rectZ(-0.36 + 0.156, -0.3, 0.3, 1.44, 1.66, licht(0xffffff), UV_TAXI);
  b.rectZ(-0.36 - 0.156, 0.3, -0.3, 1.44, 1.66, licht(0xffffff), UV_TAXI);
  // Scheiben
  inset(b, [bfl, bfr, tfr, tfl], 0.12, GLAS, nFront);
  inset(b, [brl, brr, trr, trl], 0.14, GLAS, nRear);
  for (const s of [1, -1]) {
    const bf = s > 0 ? bfl : bfr;
    const br = s > 0 ? brl : brr;
    const tf = s > 0 ? tfl : tfr;
    const tr = s > 0 ? trl : trr;
    const n = s > 0 ? nL : nR;
    const nl = Math.hypot(n[0], n[1], n[2]);
    const at = (t: number, h: number): V3 => {
      const q = lerp3(lerp3(bf, br, t), lerp3(tf, tr, t), h);
      return [q[0] + (n[0] / nl) * 0.008, q[1] + (n[1] / nl) * 0.008, q[2]];
    };
    b.quadN(at(0.1, 0.14), at(0.47, 0.14), at(0.47, 0.86), at(0.13, 0.86), GLAS, n);
    b.quadN(at(0.53, 0.14), at(0.88, 0.14), at(0.84, 0.86), at(0.53, 0.86), GLAS, n);
    // Flanke: Karoband, Türfugen, Schweller, Radkästen, Räder, Spiegel
    const x = s * (HW + 0.006);
    b.rectX(x, s > 0 ? -2.05 : 2.05, s > 0 ? 2.05 : -2.05, 0.6, 0.73, zier(), UV_KARO);
    b.rectX(x, 0.02, 0.06, 0.36, 0.88, DUNKEL);
    b.rectX(x, -1.2, -1.16, 0.36, 0.88, DUNKEL);
    b.rectX(x, -2.0, 2.0, 0.24, 0.34, DUNKEL);
    for (const z of [1.38, -1.4]) {
      b.arch(s, HW + 0.003, z, 0.33);
      b.wheel(s, HW + 0.015, z, 0.33, 0.24);
    }
    b.box(s * 0.99, 1.0, 0.72, 0.12, 0.1, 0.16, lack());
    // Rücklicht um die Ecke
    b.rectX(x, -2.2, -2.0, 0.5, 0.7, RUECKLICHT);
  }
  // Heck: breite Rücklichter, Kennzeichen; vorn Scheinwerfer
  for (const s of [1, -1]) {
    b.rectZ(-2.206, s * 0.92, s * 0.5, 0.5, 0.7, RUECKLICHT);
    b.rectZ(2.206, s * 0.48, s * 0.86, 0.5, 0.62, SCHEINWERFER);
    b.rectZ(2.206, s * 0.88, s * 0.94, 0.5, 0.62, BLINKER);
  }
  b.rectZ(-2.206, 0.22, -0.22, 0.47, 0.6, KENNZEICHEN);
  b.rectZ(2.206, -0.36, 0.36, 0.48, 0.6, DUNKEL);
}

/** Lieferwagen: hoher, heller Kasten mit Firmenstreifen und senkrechten Rücklichtern. */
function buildVan(b: Bau): void {
  const HW = 1.05;
  b.huelle = true;
  b.extrudeX(
    [
      { z: -2.64, y: 0.34, f: null },
      { z: 2.62, y: 0.34, f: STOSS },
      { z: 2.7, y: 0.5, f: DUNKEL },
      { z: 2.7, y: 0.82, f: lack(0.94) },
      { z: 2.62, y: 1.08, f: lack() },
      { z: 2.2, y: 1.2, f: KABINE },
      { z: 1.42, y: 2.06, f: lack() },
      { z: 1.2, y: 2.25, f: lack() },
      { z: -2.62, y: 2.25, f: lack(0.96) },
      { z: -2.7, y: 2.17, f: lack(0.9) },
      { z: -2.7, y: 0.6, f: STOSS },
    ],
    HW,
    lack(),
  );
  b.huelle = false;
  for (const s of [1, -1]) {
    const x = s * (HW + 0.006);
    const zz = (a: number, c: number): [number, number] => (s > 0 ? [a, c] : [c, a]);
    // Seitenscheibe der Kabine (vordere Kante folgt der Frontscheibe)
    b.quadN([x, 1.3, 0.62], [x, 1.3, 2.0], [x, 1.95, 1.47], [x, 1.95, 0.62], GLAS, [s, 0, 0]);
    // Firmenstreifen (Zierfarbe) und schmale Linie darüber
    b.rectX(x, ...zz(-2.7, 2.6), 0.95, 1.2, zier());
    b.rectX(x, ...zz(-2.7, 0.4), 1.27, 1.33, zier());
    // Schiebetür und Kabinentür
    b.rectX(x, 0.42, 0.46, 0.4, 2.12, DUNKEL);
    if (s < 0) b.rectX(x, -1.02, -0.98, 0.4, 2.12, DUNKEL);
    b.rectX(x, -2.6, 2.6, 0.34, 0.44, DUNKEL);
    for (const z of [1.85, -1.75]) {
      b.arch(s, HW + 0.003, z, 0.36);
      b.wheel(s, HW + 0.015, z, 0.36, 0.26);
    }
    // Spiegel
    b.box(s * 1.1, 1.55, 1.85, 0.12, 0.3, 0.14, DUNKEL);
    // Heck: Rücklicht-Säulen, Blinker, Umgriff zur Flanke
    b.rectZ(-2.706, s * 1.03, s * 0.82, 0.68, 1.28, RUECKLICHT);
    b.rectZ(-2.706, s * 1.03, s * 0.82, 1.3, 1.45, BLINKER);
    b.rectX(x, -2.7, -2.55, 0.68, 1.28, RUECKLICHT);
    // Positionsleuchten oben am Heck
    b.rectZ(-2.706, s * 0.78, s * 0.56, 2.06, 2.14, RUECKLICHT);
    // Hecktürfenster
    b.rectZ(-2.706, s * 0.86, s * 0.12, 1.55, 2.0, GLAS_DUNKEL);
    // Scheinwerfer
    b.rectZ(2.706, s * 0.6, s * 0.98, 0.6, 0.8, SCHEINWERFER);
  }
  // Streifen auch über die Hecktüren, Türspalt, Kennzeichen
  b.rectZ(-2.708, 0.8, -0.8, 0.95, 1.2, zier());
  b.rectZ(-2.71, 0.02, -0.02, 0.62, 2.14, DUNKEL);
  b.rectZ(-2.71, 0.26, -0.26, 0.4, 0.54, KENNZEICHEN);
}

/** Stadtbus: lang und hoch, Fensterband von innen beleuchtet, Zielanzeige "N7". */
function buildBus(b: Bau): void {
  const HW = 1.25;
  b.huelle = true;
  b.extrudeX(
    [
      { z: -5.15, y: 0.32, f: null },
      { z: 5.15, y: 0.32, f: STOSS },
      { z: 5.2, y: 0.5, f: lack(0.95) },
      { z: 5.2, y: 0.95, f: INNEN_HELL },
      { z: 5.16, y: 2.48, f: DUNKEL },
      { z: 5.14, y: 2.8, f: DACH_KANTE },
      { z: 4.9, y: 2.95, f: DACH },
      { z: -4.95, y: 2.95, f: DACH_KANTE },
      { z: -5.2, y: 2.75, f: lack(0.95) },
      { z: -5.2, y: 0.5, f: STOSS },
    ],
    HW,
    lack(),
  );
  // Klimaanlage auf dem Dach
  b.box(0, 3.02, -1.6, 1.5, 0.16, 2.2, DACH_KANTE, DACH);
  b.huelle = false;
  // Zielanzeige vorn und hinten
  b.rectZ(5.172, -0.95, 0.95, 2.52, 2.77, licht(0xffffff), UV_N7);
  b.rectZ(-5.206, 0.42, -0.42, 2.5, 2.68, licht(0xffffff), UV_N7);
  for (const s of [1, -1]) {
    const x = s * (HW + 0.006);
    const xo = s * (HW + 0.012);
    // Fensterband: dunkler Grund, darauf beleuchtete Scheiben
    b.rectX(x, s > 0 ? -4.85 : 5.0, s > 0 ? 5.0 : -4.85, 1.08, 2.52, DUNKEL);
    const fenster: [number, number, Farbe, number][] =
      s > 0
        ? [
            [4.1, 5.0, GLAS, 1.15],
            [3.0, 4.0, INNEN, 1.15],
            [1.8, 2.9, INNEN, 1.15],
            [0.6, 1.7, INNEN, 1.15],
            [-0.6, 0.5, INNEN, 1.15],
            [-1.8, -0.7, INNEN, 1.15],
            [-3.0, -1.9, INNEN, 1.15],
            [-4.75, -3.1, INNEN, 1.15],
          ]
        : [
            [3.85, 4.9, INNEN_HELL, 0.42],
            [2.65, 3.75, INNEN, 1.15],
            [1.45, 2.55, INNEN, 1.15],
            [-0.4, 1.0, INNEN_HELL, 0.42],
            [-1.7, -0.5, INNEN, 1.15],
            [-2.95, -1.8, INNEN, 1.15],
            [-4.75, -3.05, INNEN, 1.15],
          ];
    for (const [z0, z1, f, y0] of fenster) {
      if (y0 < 1) b.rectX(x, s > 0 ? z0 - 0.05 : z1 + 0.05, s > 0 ? z1 + 0.05 : z0 - 0.05, 0.4, 1.1, DUNKEL);
      b.rectX(xo, s > 0 ? z0 : z1, s > 0 ? z1 : z0, y0, 2.45, f);
      // Türen: Mittelfuge
      if (y0 < 1) b.rectX(xo + s * 0.003, (z0 + z1) / 2 - 0.025, (z0 + z1) / 2 + 0.025, 0.42, 2.45, DUNKEL);
    }
    // Fahrgäste als Schattenrisse
    for (const z of s > 0 ? [3.4, 0.0, -2.5] : [2.0, -1.1, -3.9]) {
      const xp = s * (HW + 0.016);
      b.rectX(xp, z - 0.27, z + 0.27, 1.15, 1.62, LEUTE);
      b.rectX(xp, z - 0.14, z + 0.14, 1.66, 1.94, LEUTE);
    }
    // Zierstreifen, Radkästen, Räder
    b.rectX(x, s > 0 ? -5.1 : 5.1, s > 0 ? 5.1 : -5.1, 0.78, 0.96, zier());
    for (const z of [3.5, -2.7]) {
      b.arch(s, HW + 0.003, z, 0.5);
      b.wheel(s, HW + 0.014, z, 0.5, 0.32);
    }
    // Spiegel ("Hasenohren")
    b.beam([s * 1.15, 2.62, 5.1], [s * 1.38, 2.42, 5.28], 0.06, DUNKEL);
    b.box(s * 1.38, 2.18, 5.28, 0.08, 0.42, 0.16, DUNKEL);
    // Heck: Rücklichter mit Blinker darüber, Umgriff; vorn Scheinwerfer
    b.rectZ(-5.206, s * 1.2, s * 0.9, 0.58, 1.08, RUECKLICHT);
    b.rectZ(-5.206, s * 1.2, s * 0.9, 1.12, 1.3, BLINKER);
    b.rectX(x, -5.2, -5.02, 0.58, 1.08, RUECKLICHT);
    b.rectZ(5.206, s * 0.72, s * 1.14, 0.6, 0.82, SCHEINWERFER);
  }
  // Heck: beleuchtete Heckscheibe, Motorklappe mit Lüftungsschlitzen, Kennzeichen
  b.rectZ(-5.206, 1.0, -1.0, 1.82, 2.44, INNEN);
  b.rectZ(-5.206, 0.7, -0.7, 1.15, 1.25, DUNKEL);
  b.rectZ(-5.206, 0.7, -0.7, 1.36, 1.46, DUNKEL);
  b.rectZ(-5.206, 0.26, -0.26, 0.6, 0.76, KENNZEICHEN);
}

/** Querschnitt der Straßenbahn (rechte Hälfte von unten nach oben) und Farbe der Kante zum nächsten Punkt. */
const TRAM_HALF: [number, number][] = [
  [1.12, 0.16],
  [1.2, 0.5],
  [1.2, 1.04],
  [1.18, 2.4],
  [1.13, 2.58],
  [0.98, 2.84],
  [0.62, 2.9],
];
const TRAM_EDGE: Farbe[] = [DUNKEL, lack(), INNEN, lack(), zier(), DACH];
/** Spitze der Fahrerkabine: z und Verjüngung je Querschnittspunkt. */
const TRAM_NOSE_Z = [3.4, 3.5, 3.5, 3.22, 3.13, 3.0, 2.97];
const TRAM_NOSE_X = [0.9, 0.95, 0.94, 0.88, 0.84, 0.8, 0.75];

/** Straßenbahnwagen: vorn Kabine (Wagen 1), hinten Kabine (Wagen 3), dazwischen Faltenbälge; Stromabnehmer auf Wagen 2. */
function buildTram(b: Bau): void {
  const MID = 2.9;
  const HALF = 3.5;
  // Ring: rechte Hälfte hoch, linke wieder herunter
  const ring = (z: number, nose: boolean): V3[] => {
    const out: V3[] = [];
    for (let i = 0; i < TRAM_HALF.length; i++) {
      const [x, y] = TRAM_HALF[i];
      out.push([x * (nose ? TRAM_NOSE_X[i] : 1), y, nose ? Math.sign(z) * TRAM_NOSE_Z[i] : z]);
    }
    for (let i = TRAM_HALF.length - 1; i >= 0; i--) {
      const [x, y] = TRAM_HALF[i];
      out.push([-x * (nose ? TRAM_NOSE_X[i] : 1), y, nose ? Math.sign(z) * TRAM_NOSE_Z[i] : z]);
    }
    return out;
  };
  const styles: (Farbe | null)[] = [...TRAM_EDGE, DACH, ...[...TRAM_EDGE].reverse(), null];

  b.huelle = true;
  b.mask = 0;
  b.loft(ring(-MID, false), ring(MID, false), styles);
  // Dachaufbau (alle Wagen)
  b.box(0, 3.0, -2.0, 1.0, 0.22, 1.2, DACH_KANTE, DACH);
  for (const s of [1, -1]) {
    // Kabine (vorn am ersten, hinten am letzten Wagen)
    b.mask = s > 0 ? 2 : 8;
    const nose = ring(s * HALF, true);
    b.loft(ring(s * MID, false), nose, styles);
    const n = TRAM_HALF.length;
    // untere Stirn: Punkte 0..2 rechts und links
    b.cap([nose[0], nose[1], nose[2], nose[2 * n - 3], nose[2 * n - 2], nose[2 * n - 1]], lack(), [0, 0, s]);
    // Frontscheibe
    const top: V3[] = [];
    for (let i = 2; i <= 2 * n - 3; i++) top.push(nose[i]);
    b.cap(top, KABINE, [0, 0.5, s]);
    // Gerades Wagenende mit Stirnwand (Übergang zum Nachbarwagen)
    b.mask = s > 0 ? 12 : 6;
    const end = ring(s * HALF, false);
    b.loft(ring(s * MID, false), end, styles);
    b.cap(end, STOSS, [0, 0, s]);
  }
  b.huelle = false;
  for (const s of [1, -1]) {
    // Faltenbalg
    b.mask = s > 0 ? 12 : 6;
    b.box(0, 1.55, s * (HALF + 0.07), 2.0, 2.3, 0.14, fest(0x1c1a24));
    // Lichter und Linienanzeige an den Kabinen
    b.mask = s > 0 ? 2 : 8;
    for (const k of [1, -1]) b.rectZ(s * (HALF + 0.006), k * 0.5, k * 0.88, 0.62, 0.82, s > 0 ? SCHEINWERFER : RUECKLICHT);
    b.rectZ(s * 3.285, -s * 0.62, s * 0.62, 2.12, 2.34, licht(0xffffff), UV_LINIE4);
    b.rectZ(s * (HALF + 0.006), -0.22, 0.22, 0.32, 0.44, s > 0 ? DUNKEL : KENNZEICHEN);
  }
  b.mask = 0;
  // Fensterpfosten, Türen, Fahrgäste
  for (const s of [1, -1]) {
    const x = s * 1.212;
    for (const z of [-2.75, -1.68, -0.68, 0.68, 1.68, 2.75]) b.rectX(x, z - 0.07, z + 0.07, 1.04, 2.4, DUNKEL);
    // Fensterrahmen oben und unten, Zierlinie unter dem Fensterband
    b.rectX(x, -2.9, 2.9, 2.3, 2.4, DUNKEL);
    b.rectX(x, -2.9, 2.9, 1.04, 1.1, DUNKEL);
    b.rectX(x, -2.9, 2.9, 0.86, 0.94, zier());
    if (s < 0) {
      // Doppeltür in der Mitte der rechten Flanke
      b.rectX(x - 0.004, 0.62, -0.62, 0.3, 1.04, INNEN_HELL);
      b.rectX(x - 0.008, 0.025, -0.025, 0.3, 2.4, DUNKEL);
    }
    for (const z of s > 0 ? [-1.45, 1.5] : [-1.5, 1.45]) {
      b.rectX(x + s * 0.004, s > 0 ? z - 0.26 : z + 0.26, s > 0 ? z + 0.26 : z - 0.26, 1.06, 1.42, LEUTE);
      b.rectX(x + s * 0.004, s > 0 ? z - 0.13 : z + 0.13, s > 0 ? z + 0.13 : z - 0.13, 1.46, 1.72, LEUTE);
    }
  }
  // Stromabnehmer (nur mittlerer Wagen)
  b.mask = 4;
  b.box(0, 2.95, 0, 0.9, 0.1, 1.0, fest(0x4a4858));
  const PANTO = fest(0x9aa0bc);
  b.beam([0, 3.0, -0.45], [0, 3.7, 0.5], 0.07, PANTO);
  b.beam([0, 3.7, 0.5], [0, 4.4, -0.15], 0.06, PANTO);
  b.beam([-0.7, 4.42, -0.15], [0.7, 4.42, -0.15], 0.07, PANTO);
  b.beam([0.7, 4.42, -0.15], [0.94, 4.3, -0.15], 0.05, PANTO);
  b.beam([-0.7, 4.42, -0.15], [-0.94, 4.3, -0.15], 0.05, PANTO);
  b.mask = 0;
}

/** Oberleitungskontakt des Stromabnehmers (Wagenkoordinaten). */
const PANTO_TOP = new THREE.Vector3(0, 4.47, -0.15);

// --- Farbvarianten (Lack, Zierfarbe) ----------------------------------------------

const VARIANTS: [number, number][][] = [];
VARIANTS[VEH_TAXI] = [
  [0xffc928, 0xffffff],
  [0xffb01f, 0x2ad1c4],
  [0xffe23a, 0xff4f8b],
];
VARIANTS[VEH_VAN] = [
  [0xeef0f5, 0xff7a2f],
  [0xcfe0ee, 0x2a7ff4],
  [0xece5d2, 0x1fb59a],
];
VARIANTS[VEH_BUS] = [
  [0x22b3a4, 0xf4f1ea],
  [0xe2465f, 0x1d2240],
  [0x3f7fe0, 0xff9b3a],
];
VARIANTS[VEH_TRAM] = [
  [0xe8503a, 0xf3e9d2],
  [0x8a4ad8, 0xf3e9d2],
  [0x1fa6c8, 0xf4f4ee],
];

/** Fester Wert 0 … 1 aus zwei Zahlen. */
function hash(a: number, b: number): number {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

// --- Texturen ----------------------------------------------------------------------

/** Beschriftungen und Karomuster in einer Textur; alles übrige ist weiß. */
function makeAtlas(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 256, 256);
  const font = (px: number): string => `900 ${px}px "Arial Narrow", "Helvetica Neue", Arial, sans-serif`;
  const label = (x: number, y: number, w: number, h: number, bg: string, fg: string, text: string, px: number): void => {
    g.fillStyle = bg;
    g.fillRect(x, y, w, h);
    g.fillStyle = fg;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = font(px);
    g.fillText(text, x + w / 2, y + h / 2 + 2, w * 0.9);
  };
  // TAXI: dunkle Schrift auf hellgelb; Zielanzeigen: Bernstein auf schwarz
  label(0, 0, 128, 48, '#fff2a8', '#1a1420', 'TAXI', 38);
  label(128, 0, 128, 48, '#120e18', '#ffa630', 'N7', 40);
  label(0, 48, 128, 48, '#120e18', '#ffa630', '4  HAFEN', 30);
  // Karoband: zwei Reihen
  for (let i = 0; i < 64; i++) {
    for (let r = 0; r < 2; r++) {
      g.fillStyle = (i + r) % 2 === 0 ? '#16131c' : '#ffffff';
      g.fillRect(i * 4, 96 + r * 8, 4, 8);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Weicher Fleck (für Lichthöfe: weiß mit Alpha; für Schatten: dunkel mit Alpha). */
function blobTexture(size: number, shape: (u: number, v: number) => number, rgbv: RGB): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = ((x + 0.5) / size) * 2 - 1;
      const v = ((y + 0.5) / size) * 2 - 1;
      const a = Math.max(0, Math.min(1, shape(u, v)));
      const i = (y * size + x) * 4;
      data[i] = rgbv[0];
      data[i + 1] = rgbv[1];
      data[i + 2] = rgbv[2];
      data[i + 3] = Math.round(a * 255);
    }
  }
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
}

// --- Materialien -------------------------------------------------------------------

/** Toon-Material mit Leuchten je Ecke, Lack je Instanz und Wagenmaske. */
function bodyMaterial(atlas: THREE.Texture): THREE.MeshToonMaterial {
  const m = toonMaterial({ vertexColors: true });
  m.map = atlas;
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
attribute vec3 vflag;
attribute vec3 iPaint;
attribute vec3 iTrim;
attribute float iPart;
varying float vGlow;`,
      )
      .replace(
        '#include <color_vertex>',
        `#include <color_vertex>
  vGlow = vflag.x;
  if (vflag.y > 1.5) vColor.rgb *= iTrim;
  else if (vflag.y > 0.5) vColor.rgb *= iPaint;
  // Lack leuchtet ein wenig von selbst: nachts bleiben die Comicfarben satt.
  if (vflag.y > 0.5) vGlow = max(vGlow, 0.16);`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
  {
    int msk = int(vflag.z + 0.5);
    if (msk != 0 && (msk & (1 << int(iPart + 0.5))) == 0) transformed = vec3(0.0);
  }`,
      );
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vGlow;')
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
  totalEmissiveRadiance += diffuseColor.rgb * vGlow;
  diffuseColor.rgb *= 1.0 - vGlow;`,
      );
  };
  m.customProgramCacheKey = () => 'verkehr-karosserie';
  return m;
}

// Kontur wie in toon.ts, dazu Wagenmaske. Unpassende Ecken landen außerhalb
// des Bildraums, das ganze Dreieck fällt weg (auf einen Punkt zusammenziehen
// ginge hier nicht: die Kontur bläht jede Ecke anders auf).
const OUTLINE_VERT = /* glsl */ `
#include <common>
#include <fog_pars_vertex>
attribute vec3 onormal;
attribute vec3 vflag;
attribute float iPart;
uniform float thickness;
void main() {
  int msk = int(vflag.z + 0.5);
  if (msk != 0 && (msk & (1 << int(iPart + 0.5))) == 0) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }
  vec3 transformed = position;
  #ifdef USE_INSTANCING
    mat4 m = modelMatrix * instanceMatrix;
  #else
    mat4 m = modelMatrix;
  #endif
  vec4 world = m * vec4(transformed, 1.0);
  vec3 wn = mat3(m) * onormal;
  float wl = length(wn);
  wn = wl > 1e-6 ? wn / wl : vec3(0.0);
  float d = distance(cameraPosition, world.xyz);
  world.xyz += wn * thickness * clamp(d * 0.055, 0.75, 3.5);
  vec4 mvPosition = viewMatrix * world;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const OUTLINE_FRAG = /* glsl */ `
#include <common>
#include <fog_pars_fragment>
uniform vec3 ink;
void main() {
  gl_FragColor = vec4(ink, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

function outlineMat(thickness: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { thickness: { value: thickness }, ink: { value: new THREE.Color(INK) } }]),
    vertexShader: OUTLINE_VERT,
    fragmentShader: OUTLINE_FRAG,
    side: THREE.BackSide,
    fog: true,
  });
}

// --- Aufbau ------------------------------------------------------------------------

interface Wagen {
  v: Vehicle;
  car: number;
  part: number;
  paint: THREE.Color;
  trim: THREE.Color;
}

interface Art {
  kind: number;
  body: THREE.InstancedMesh;
  outline: THREE.InstancedMesh | null;
  iPaint: THREE.InstancedBufferAttribute;
  iTrim: THREE.InstancedBufferAttribute;
  iPart: THREE.InstancedBufferAttribute;
  cars: Wagen[];
  /** Welcher Wagen gerade in welchem Platz der Instanzen steht (−1 = keiner). */
  slot: Int32Array;
  shadowM: THREE.Matrix4;
  poolM: THREE.Matrix4;
  /** Rücklichter (Wagenkoordinaten) und Größe ihrer Lichthöfe. */
  tails: THREE.Vector3[];
  tailSize: number;
}

/** Zeichenaufrufe und Dreiecke (ohne Kontur) – für Messungen. */
export interface TrafficStats {
  calls: number;
  triangles: Record<string, number>;
}

export function buildTraffic(track: Track, detail: boolean): MechanicView & { stats: TrafficStats } {
  const group = new THREE.Group();
  group.name = 'verkehr';
  const disposables: { dispose(): void }[] = [];
  const theme = THEMES[track.def.theme];
  const cullDist = theme.fogFar + 15;
  const cull2 = cullDist * cullDist;
  const fadeFrom = theme.fogNear * 0.6;
  const fadeTo = theme.fogFar * 0.9;

  const atlas = makeAtlas();
  const bodyMat = bodyMaterial(atlas);
  const olMat = detail ? outlineMat(0.05) : null;
  disposables.push(atlas, bodyMat);
  if (olMat) disposables.push(olMat);

  const stats: TrafficStats = { calls: 0, triangles: {} };
  const builders: ((b: Bau) => void)[] = [];
  builders[VEH_TAXI] = buildTaxi;
  builders[VEH_VAN] = buildVan;
  builders[VEH_BUS] = buildBus;
  builders[VEH_TRAM] = buildTram;
  const names = ['taxi', 'lieferwagen', 'bus', 'strassenbahn'];

  const arten: Art[] = [];
  let totalCars = 0;
  for (const kind of [VEH_TAXI, VEH_VAN, VEH_BUS, VEH_TRAM]) {
    const list = track.vehicles.filter((v) => v.kind === kind);
    if (list.length === 0) continue;
    const spec = VEHICLE_SPECS[kind];
    const cars: Wagen[] = [];
    for (const v of list) {
      const vars = VARIANTS[kind];
      const [pc, tc] = vars[(Math.imul(v.id + 7, 0x9e3779b1) >>> 0) % vars.length];
      for (let car = 0; car < v.cars; car++) {
        cars.push({ v, car, part: kind === VEH_TRAM ? car + 1 : 0, paint: new THREE.Color(pc), trim: new THREE.Color(tc) });
      }
    }
    // Straßenbahn mit nur einem Wagen: vorn und hinten Kabine wäre nötig – hier
    // nicht vorgesehen; die Strecke hat immer drei.
    if (kind === VEH_TRAM) for (const c of cars) if (c.v.cars === 1) c.part = 1;
    const n = cars.length;
    totalCars += n;

    const b = new Bau();
    const hb = new Bau();
    b.hull = hb;
    builders[kind](b);
    const geo = b.build();
    stats.triangles[names[kind]] = b.triangles;
    const iPaint = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
    const iTrim = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
    const iPart = new THREE.InstancedBufferAttribute(new Float32Array(n), 1);
    for (const a of [iPaint, iTrim, iPart]) a.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('iPaint', iPaint);
    geo.setAttribute('iTrim', iTrim);
    geo.setAttribute('iPart', iPart);
    const body = new THREE.InstancedMesh(geo, bodyMat, n);
    body.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    body.frustumCulled = false;
    body.count = 0;
    group.add(body);
    disposables.push(geo, body);

    let outline: THREE.InstancedMesh | null = null;
    if (olMat) {
      const hgeo = hb.buildHull();
      hgeo.setAttribute('iPart', iPart);
      outline = new THREE.InstancedMesh(hgeo, olMat, n);
      outline.instanceMatrix = body.instanceMatrix;
      outline.frustumCulled = false;
      outline.name = 'outline';
      outline.count = 0;
      group.add(outline);
      disposables.push(hgeo, outline);
    }

    const shadowM = new THREE.Matrix4().compose(
      new THREE.Vector3(0, 0.04, 0),
      new THREE.Quaternion(),
      new THREE.Vector3(spec.halfWidth * 2 + 0.55, 1, spec.half * 2 + (kind === VEH_TRAM ? 0.9 : 0.8)),
    );
    const poolM = new THREE.Matrix4().compose(
      new THREE.Vector3(0, 0.06, spec.half + 4.6),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2),
      new THREE.Vector3(spec.halfWidth * 2 + 1.0, 10, 1),
    );
    const tailY = kind === VEH_TAXI ? 0.6 : kind === VEH_VAN ? 1.0 : kind === VEH_BUS ? 0.83 : 0.72;
    const tailX = kind === VEH_TAXI ? 0.71 : kind === VEH_VAN ? 0.92 : kind === VEH_BUS ? 1.05 : 0.69;
    arten.push({
      kind,
      body,
      outline,
      iPaint,
      iTrim,
      iPart,
      cars,
      slot: new Int32Array(n).fill(-1),
      shadowM,
      poolM,
      tails: [new THREE.Vector3(tailX, tailY, -spec.half - 0.05), new THREE.Vector3(-tailX, tailY, -spec.half - 0.05)],
      tailSize: kind === VEH_BUS ? 1.25 : kind === VEH_TAXI ? 0.95 : 1.1,
    });
  }

  // Schattenflecken (alle Wagen)
  const shadowTex = blobTexture(
    48,
    (u, v) => {
      const q = Math.pow(Math.pow(Math.abs(u), 4) + Math.pow(Math.abs(v), 4), 0.25);
      return 1 - Math.max(0, Math.min(1, (q - 0.55) / 0.45));
    },
    [10, 8, 24],
  );
  const shadowGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    opacity: 0.62,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const shadows = new THREE.InstancedMesh(shadowGeo, shadowMat, Math.max(1, totalCars));
  shadows.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  shadows.frustumCulled = false;
  shadows.count = 0;
  shadows.renderOrder = -1;
  group.add(shadows);
  disposables.push(shadowTex, shadowGeo, shadowMat, shadows);

  // Lichthöfe: Rücklichter, Taxischild, Scheinwerferkegel auf der Fahrbahn (nur detail)
  let halos: THREE.InstancedMesh | null = null;
  if (detail) {
    const haloTex = blobTexture(
      32,
      (u, v) => {
        const r = Math.hypot(u, v);
        return Math.pow(Math.max(0, 1 - r), 2.2);
      },
      [255, 255, 255],
    );
    const haloGeo = new THREE.PlaneGeometry(1, 1);
    const haloMat = new THREE.MeshBasicMaterial({
      map: haloTex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
      toneMapped: false,
    });
    const cap = Math.max(1, totalCars * 4);
    halos = new THREE.InstancedMesh(haloGeo, haloMat, cap);
    halos.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const black = new THREE.Color(0, 0, 0);
    for (let i = 0; i < cap; i++) halos.setColorAt(i, black);
    halos.instanceColor!.setUsage(THREE.DynamicDrawUsage);
    halos.frustumCulled = false;
    halos.count = 0;
    group.add(halos);
    disposables.push(haloTex, haloGeo, haloMat, halos);
  }

  // Gleis der Straßenbahn: zwei helle Schienen über die ganze Hauptstrecke
  const tram = track.vehicles.find((v) => v.kind === VEH_TRAM);
  if (tram) {
    const GAUGE = 0.7175;
    const RAIL = 0.045;
    const LIFT = 0.028;
    const GROOVE = 0.05;
    const pos: number[] = [];
    const cols: number[] = [];
    const n = track.n;
    let lift = LIFT;
    const pt = (i: number, lat: number): V3 => [
      track.px[i] + rightX(track, i) * lat,
      track.py[i] + lat * track.bank[i] + lift,
      track.pz[i] + rightZ(track, i) * lat,
    ];
    const BETT = rgb(0x24263c);
    const HELL = rgb(0xc4cae6);
    const RILLE = rgb(0x0e0c16);
    /** Streifen von lat0 bis lat1 zwischen Abschnitt i und j, Oberseite nach oben. */
    const strip = (i: number, j: number, ci: number, cj: number, l0: number, l1: number, c: RGB): void => {
      const a = pt(i, ci + l0);
      const b2 = pt(i, ci + l1);
      const cc = pt(j, cj + l1);
      const d = pt(j, cj + l0);
      const n1 = cross(sub(d, a), sub(cc, a));
      if (n1[1] >= 0) pos.push(...a, ...d, ...cc, ...a, ...cc, ...b2);
      else pos.push(...a, ...cc, ...d, ...a, ...b2, ...cc);
      for (let k = 0; k < 6; k++) cols.push(c[0], c[1], c[2]);
    };
    /** Darf das Gleis von i aus `len` Abschnitte in einem Stück überspannen? Nur wo die Fahrbahn gerade und eben ist. */
    const straight = (i: number, len: number): boolean => {
      if (i + len >= n) return false;
      const slope = (track.py[i + len] - track.py[i]) / len;
      for (let k = 0; k <= len; k++) {
        if (Math.abs(track.curv[i + k]) > 0.003 || Math.abs(track.bank[i + k] - track.bank[i]) > 0.004) return false;
        if (Math.abs(track.py[i + k] - (track.py[i] + slope * k)) > 0.012) return false;
      }
      return true;
    };
    for (let i = 0; i < n; ) {
      // Auf geraden, ebenen Stücken reicht ein Streifen über mehrere Abschnitte – das spart zwei Drittel der Flächen.
      const len = straight(i, 4) ? 4 : straight(i, 2) ? 2 : 1;
      const j = (i + len) % n;
      const ci = (tram.lat * track.rh[i]) / track.def.roadHalf;
      const cj = (tram.lat * track.rh[j]) / track.def.roadHalf;
      // Gleisbett: etwas dunkler als der Asphalt, knapp darunter
      lift = LIFT - 0.014;
      strip(i, j, ci, cj, -GAUGE - 0.12, GAUGE + 0.12, BETT);
      lift = LIFT;
      for (const o of [-GAUGE, GAUGE]) {
        // Schienenkopf hell, daneben (nur bei voller Qualität) zur Gleismitte hin die dunkle Rille
        strip(i, j, ci, cj, o - RAIL, o + RAIL, HELL);
        if (detail) {
          const g0 = o < 0 ? o + RAIL : o - RAIL - GROOVE;
          strip(i, j, ci, cj, g0, g0 + GROOVE, RILLE);
        }
      }
      i += len;
    }
    const railGeo = new THREE.BufferGeometry();
    railGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    railGeo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    railGeo.computeBoundingSphere();
    const railMat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -2,
    });
    const rails = new THREE.Mesh(railGeo, railMat);
    rails.name = 'gleis';
    group.add(rails);
    disposables.push(railGeo, railMat);
    stats.triangles.gleis = pos.length / 9;
  }
  stats.calls = arten.length * (olMat ? 2 : 1) + 1 + (halos ? 1 : 0) + (tram ? 1 : 0);

  // --- pro Bild ---
  const pose = newVehiclePose();
  const euler = new THREE.Euler(0, 0, 0, 'YXZ');
  const quat = new THREE.Quaternion();
  const posV = new THREE.Vector3();
  const ONE = new THREE.Vector3(1, 1, 1);
  const UP = new THREE.Vector3(0, 1, 0);
  const m4 = new THREE.Matrix4();
  const mh = new THREE.Matrix4();
  const lv = new THREE.Vector3();
  const sv = new THREE.Vector3();
  const col = new THREE.Color();
  const TAIL = new THREE.Color(0xff2430);
  const HEAD = new THREE.Color(0xffe2a6);
  const SIGN = new THREE.Color(0xffd040);
  const SIGN_POS = new THREE.Vector3(0, 1.56, -0.36);
  /** Letzter Funkentakt je Fahrzeug (nur Zierde). */
  const sparkTick = new Map<number, number>();

  const halo = (pos: THREE.Vector3, cam: THREE.Vector3, size: number, c: THREE.Color, k: number, idx: number): void => {
    // Ein Stück zur Kamera hin, damit der Hof nicht im Blech steckt
    sv.subVectors(cam, pos).normalize().multiplyScalar(0.3).add(pos);
    mh.lookAt(cam, sv, UP);
    mh.scale(lv.set(size, size, size));
    mh.setPosition(sv);
    halos!.setMatrixAt(idx, mh);
    halos!.setColorAt(idx, col.copy(c).multiplyScalar(k));
  };

  return {
    group,
    stats,
    update(time, seconds, _dt, cam, fx: FxSink) {
      let ns = 0;
      let nh = 0;
      for (const art of arten) {
        let k = 0;
        let dirty = false;
        for (let e = 0; e < art.cars.length; e++) {
          const c = art.cars[e];
          const p = vehiclePose(track, c.v, c.car, time, pose);
          const dx = p.x - cam.x;
          const dy = p.y - cam.y;
          const dz = p.z - cam.z;
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 > cull2) continue;
          posV.set(p.x, p.y, p.z);
          euler.set(-Math.atan(p.slope), p.heading, -Math.atan(p.bank));
          quat.setFromEuler(euler);
          m4.compose(posV, quat, ONE);
          art.body.setMatrixAt(k, m4);
          if (art.slot[k] !== e) {
            art.slot[k] = e;
            art.iPaint.setXYZ(k, c.paint.r, c.paint.g, c.paint.b);
            art.iTrim.setXYZ(k, c.trim.r, c.trim.g, c.trim.b);
            art.iPart.setX(k, c.part);
            dirty = true;
          }
          k++;
          mh.multiplyMatrices(m4, art.shadowM);
          shadows.setMatrixAt(ns++, mh);

          if (!halos) continue;
          const d = Math.sqrt(d2);
          const fade = 1 - Math.max(0, Math.min(1, (d - fadeFrom) / (fadeTo - fadeFrom)));
          if (fade <= 0.01) continue;
          const isTram = art.kind === VEH_TRAM;
          // Rücklichter: am Heck (bei der Bahn nur am letzten Wagen)
          if (!isTram || c.car === c.v.cars - 1) {
            for (const t of art.tails) halo(lv.copy(t).applyMatrix4(m4), cam, art.tailSize, TAIL, 0.85 * fade, nh++);
          }
          // Lichtkegel der Scheinwerfer auf der Fahrbahn (bei der Bahn nur vorn)
          if (!isTram || c.car === 0) {
            mh.multiplyMatrices(m4, art.poolM);
            halos.setMatrixAt(nh, mh);
            halos.setColorAt(nh++, col.copy(HEAD).multiplyScalar(0.2 * fade));
          }
          if (art.kind === VEH_TAXI) halo(lv.copy(SIGN_POS).applyMatrix4(m4), cam, 1.3, SIGN, 0.4 * fade, nh++);
          // Funke am Stromabnehmer: gelegentlich, im Takt der Uhr, fest gewürfelt
          if (isTram && c.car === 1 && d < 160) {
            const tick = Math.floor(seconds * 3 + c.v.id * 0.37);
            if (sparkTick.get(c.v.id) !== tick) {
              sparkTick.set(c.v.id, tick);
              if (hash(tick, c.v.id) > 0.82) {
                lv.copy(PANTO_TOP).applyMatrix4(m4);
                for (let s = 0; s < 5; s++) {
                  const a = hash(tick + s, c.v.id + 3) * Math.PI * 2;
                  const sp = 1.5 + hash(tick, s + 11) * 2.5;
                  fx.spark(lv.x, lv.y, lv.z, Math.cos(a) * sp, 1.5 + sp * 0.6, Math.sin(a) * sp, 0.35 + hash(s, tick) * 0.3, 0.22, s === 0 ? 0xffffff : 0x8fd8ff);
                }
              }
            }
          }
        }
        art.body.count = k;
        art.body.visible = k > 0;
        art.body.instanceMatrix.needsUpdate = true;
        if (dirty) {
          art.iPaint.needsUpdate = true;
          art.iTrim.needsUpdate = true;
          art.iPart.needsUpdate = true;
        }
        if (art.outline) {
          art.outline.count = k;
          art.outline.visible = k > 0;
        }
      }
      shadows.count = ns;
      shadows.visible = ns > 0;
      shadows.instanceMatrix.needsUpdate = true;
      if (halos) {
        halos.count = nh;
        halos.visible = nh > 0;
        halos.instanceMatrix.needsUpdate = true;
        halos.instanceColor!.needsUpdate = true;
      }
    },
    dispose() {
      for (const d of disposables) d.dispose();
    },
  };
}
