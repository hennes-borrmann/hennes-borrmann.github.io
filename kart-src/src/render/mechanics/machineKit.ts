// Werkzeug für die Maschinen im Werkshof (machines.ts): Flächen, die sich
// selbst richtig herum drehen, Warnstreifen (gelb-schwarz, schräg) und Quader
// in beliebigen Rahmen – etwa im Rahmen eines Streckenabschnitts (seitlich,
// Höhe, voraus), der gespiegelt ist und sonst die Flächen umdrehen würde.

import { MeshBuilder, type RGB, type V3 } from '../build';

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (a: V3): number => Math.hypot(a[0], a[1], a[2]);
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Zeigt a→b→c (gegen den Uhrzeigersinn gesehen) in Richtung out? */
function facesOut(a: V3, b: V3, c: V3, out: V3): boolean {
  return dot(cross(sub(b, a), sub(c, a)), out) >= 0;
}

/** Viereck (Parallelogramm-Ecken a, b, c, d der Reihe nach), sichtbar von der Seite out. */
export function face(mb: MeshBuilder, a: V3, b: V3, c: V3, d: V3, out: V3, col: RGB): void {
  if (facesOut(a, b, c, out)) mb.quad(a, b, c, d, col);
  else mb.quad(a, d, c, b, col);
}

/**
 * Viereck mit schrägen Warnstreifen der Breite w (gemessen entlang a→b),
 * abwechselnd colA und colB. a, b, c, d: Parallelogramm der Reihe nach.
 */
export function stripedFace(mb: MeshBuilder, a: V3, b: V3, c: V3, d: V3, out: V3, colA: RGB, colB: RGB, w: number): void {
  if (!facesOut(a, b, c, out)) [b, d] = [d, b];
  const U = sub(b, a);
  const V = sub(d, a);
  const W = len(U);
  const H = len(V);
  if (W < 1e-6 || H < 1e-6) return;
  // Streifen: s = u·W + v·H (u, v ∈ 0…1) in Bändern der Breite w·√2 – dann
  // stehen die Streifen unter 45° und sind quer gemessen w breit.
  const band = w * Math.SQRT2;
  const total = W + H;
  const n = Math.ceil(total / band);
  const at = (u: number, v: number): V3 => [a[0] + U[0] * u + V[0] * v, a[1] + U[1] * u + V[1] * v, a[2] + U[2] * u + V[2] * v];
  for (let k = 0; k < n; k++) {
    const lo = k * band;
    const hi = Math.min(total, (k + 1) * band);
    let poly: [number, number][] = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ];
    poly = clip(poly, (p) => p[0] * W + p[1] * H - lo);
    poly = clip(poly, (p) => hi - (p[0] * W + p[1] * H));
    if (poly.length < 3) continue;
    const col = k % 2 === 0 ? colA : colB;
    const p0 = at(poly[0][0], poly[0][1]);
    for (let i = 1; i + 1 < poly.length; i++) mb.tri(p0, at(poly[i][0], poly[i][1]), at(poly[i + 1][0], poly[i + 1][1]), col);
  }
}

/** Sutherland-Hodgman: behält den Teil des Vielecks mit f ≥ 0. */
function clip(poly: [number, number][], f: (p: [number, number]) => number): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    const fp = f(p);
    const fq = f(q);
    if (fp >= 0) out.push(p);
    if ((fp >= 0) !== (fq >= 0)) {
      const k = fp / (fp - fq);
      out.push([p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k]);
    }
  }
  return out;
}

/** Abbildung lokaler Koordinaten (x, y, z) in die Welt. */
export type Xform = (x: number, y: number, z: number) => V3;

export interface BoxOpts {
  /** Farbe der Oberseite (sonst col). */
  top?: RGB;
  /** Warnstreifen an den vier Seiten: zweite Farbe und Breite. */
  stripes?: [RGB, number];
  /** Unterseite weglassen (steht ohnehin auf etwas). */
  noBottom?: boolean;
}

/** Quader x0…x1 × y0…y1 × z0…z1 im Rahmen T. */
export function boxT(mb: MeshBuilder, T: Xform, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, col: RGB, o: BoxOpts = {}): void {
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const cz = (z0 + z1) / 2;
  const C = T(cx, cy, cz);
  const dir = (x: number, y: number, z: number): V3 => sub(T(cx + x, cy + y, cz + z), C);
  const P = (x: number, y: number, z: number): V3 => T(x, y, z);
  const side = (a: V3, b: V3, c: V3, d: V3, out: V3): void => {
    if (o.stripes) stripedFace(mb, a, b, c, d, out, col, o.stripes[0], o.stripes[1]);
    else face(mb, a, b, c, d, out, col);
  };
  side(P(x0, y0, z0), P(x1, y0, z0), P(x1, y1, z0), P(x0, y1, z0), dir(0, 0, -1));
  side(P(x1, y0, z1), P(x0, y0, z1), P(x0, y1, z1), P(x1, y1, z1), dir(0, 0, 1));
  side(P(x0, y0, z1), P(x0, y0, z0), P(x0, y1, z0), P(x0, y1, z1), dir(-1, 0, 0));
  side(P(x1, y0, z0), P(x1, y0, z1), P(x1, y1, z1), P(x1, y1, z0), dir(1, 0, 0));
  face(mb, P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, z1), P(x0, y1, z1), dir(0, 1, 0), o.top ?? col);
  if (!o.noBottom) face(mb, P(x0, y0, z0), P(x1, y0, z0), P(x1, y0, z1), P(x0, y0, z1), dir(0, -1, 0), col);
}

/**
 * Zylinder (sides Ecken) um die senkrechte Achse durch (x, z), von y0 bis y1,
 * im Rahmen T; Deckel unten und/oder oben in der Farbe cap.
 */
export function cylT(mb: MeshBuilder, T: Xform, x: number, z: number, r: number, y0: number, y1: number, col: RGB, cap?: RGB, sides = 8, caps: 'both' | 'bottom' | 'top' = 'both'): void {
  const ring = (y: number): V3[] => {
    const out: V3[] = [];
    for (let k = 0; k < sides; k++) {
      const a = ((k + 0.5) / sides) * Math.PI * 2;
      out.push(T(x + Math.cos(a) * r, y, z + Math.sin(a) * r));
    }
    return out;
  };
  const lo = ring(y0);
  const hi = ring(y1);
  const C = T(x, (y0 + y1) / 2, z);
  for (let k = 0; k < sides; k++) {
    const n = (k + 1) % sides;
    const mid: V3 = [(lo[k][0] + lo[n][0]) / 2, 0, (lo[k][2] + lo[n][2]) / 2];
    face(mb, lo[k], lo[n], hi[n], hi[k], [mid[0] - C[0], 0, mid[2] - C[2]], col);
  }
  if (cap) {
    const top = T(x, y1, z);
    const bot = T(x, y0, z);
    const up = sub(top, bot);
    for (let k = 0; k < sides; k++) {
      const n = (k + 1) % sides;
      if (caps !== 'bottom') {
        if (facesOut(top, hi[k], hi[n], up)) mb.tri(top, hi[k], hi[n], cap);
        else mb.tri(top, hi[n], hi[k], cap);
      }
      if (caps !== 'top') {
        const down: V3 = [-up[0], -up[1], -up[2]];
        if (facesOut(bot, lo[k], lo[n], down)) mb.tri(bot, lo[k], lo[n], cap);
        else mb.tri(bot, lo[n], lo[k], cap);
      }
    }
  }
}
