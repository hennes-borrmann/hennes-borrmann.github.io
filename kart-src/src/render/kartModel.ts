// Die vier Karts samt Fahrerfiguren – vollständig prozedural, ohne fremde
// Modelle oder Bilder.
//
// Aufbau: Jedes Kart ist EIN Netz mit Vertexfarben, das an einem kleinen
// Skelett hängt (THREE.SkinnedMesh). Räder, Lenkrad, Kopf, Arme, Ohren, Schal
// und Schwanz sind Knochen – so bewegt sich alles einzeln und kostet trotzdem
// nur einen Zeichenaufruf fürs Netz und einen für die Tuschekontur. Dazu
// kommen je ein Aufruf für die Aufkleber (Augen, Startnummer) und – nur wenn
// sichtbar – für Flammen und Effekte (Schutzring, Blitze, Qualm).
//
// Koordinaten: y oben, das Kart schaut nach +z, die Räder stehen auf y = 0.
// „Links“ ist +x, „rechts“ −x.

import * as THREE from 'three';
import { INK, rgb, toonMaterial, withSkinnedOutline } from './toon';

export interface KartPose {
  /** Vorwärtstempo in m/s (negativ = rückwärts); 26 = Höchsttempo, bis 34 mit Schub. */
  speed: number;
  /** -1..1, rechts positiv (schon geglättet). */
  steer: number;
  /** -1 links, 0 kein Drift, 1 rechts. */
  driftDir: number;
  /** 0..3 Mini-Turbo-Stufe. */
  driftStage: number;
  /** Schub aktiv → Auspuffflammen. */
  boost: boolean;
  /** In der Luft. */
  air: boolean;
  /** 0 = normal, sonst 0..1 Fortschritt des Schleuderns nach einem Treffer. */
  spin: number;
  /** Item „Stoßfänger“ aktiv: Schutzring kreist ums Kart. */
  guard: boolean;
  /** Item „Kurzschluss“ erwischt: Blitze, Qualm, verdatterte Figur. */
  stall: boolean;
  offroad: boolean;
  /** Im Ziel: jubeln bzw. Kopf hängen lassen. */
  emote: 'none' | 'win' | 'lose';
}

/** 0 niedrig (ohne Konturen, weniger Segmente), 1 mittel, 2 hoch. */
export type KartDetail = 0 | 1 | 2;

/** Name der Figur je Platz, z. B. für die Lobby. */
export const DRIVER_NAMES: string[] = ['Kolben-Kalle', 'Vera Vergaser', 'Bremsen-Bert', 'Zünd-Zoe'];

// ───────────────────────────── Grundlagen ─────────────────────────────

type V3 = readonly [number, number, number];

const TAU = Math.PI * 2;
const HALF_PI = Math.PI / 2;

function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}

/** Nähert cur exponentiell an target an – unabhängig von der Bildrate. */
function damp(cur: number, target: number, lambda: number, dt: number): number {
  return cur + (target - cur) * (1 - Math.exp(-lambda * dt));
}

/** Pseudo-Zufall 0..1 aus einer Zahl (für Flackern ohne Math.random). */
function hash(n: number): number {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
}

// Knochen des Skeletts. Alle vier Karts benutzen dieselbe Liste; was eine
// Figur nicht braucht, bleibt einfach ungenutzt.
const B = {
  spin: 0, // Schleudern + Hüpfen
  drift: 1, // Schrägstellen im Drift
  chassis: 2, // Karosserie: Rollen, Nicken, Stauchen
  wFL: 3,
  wFR: 4,
  wRL: 5,
  wRR: 6,
  steer: 7, // Lenkrad
  torso: 8,
  head: 9,
  earL: 10,
  earR: 11,
  armLU: 12,
  armLF: 13,
  handL: 14,
  armRU: 15,
  armRF: 16,
  handR: 17,
  c0: 18, // Kette: Schal (Vera) bzw. Schwanz (Zoe)
  c1: 19,
  c2: 20,
  c3: 21,
  aux0: 22, // je Figur: Motor/Kiefer, Schnauzbart, Antennen
  aux1: 23,
  flameL: 24,
  flameR: 25,
  guard: 26,
  bolt0: 27,
  bolt1: 28,
  puff0: 29,
  puff1: 30,
} as const;
const BONE_COUNT = 31;

// Farben, die alle Karts teilen.
const DARK = 0x2d2a36; // Gummi, Rahmen
const STEEL = 0x5a6173;
const CHROME = 0xe3ebf4;
const WHITE = 0xfdf9f0;
const INK_CSS = '#16131c';

// ───────────────────────────── Netz-Bausteine ─────────────────────────────

function rawGeo(pos: number[], nor: number[], col: number[] | null, idx: number[]): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  if (col) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}

/** Ein Querschnitt für loft(): Punkte (x, y) gegen den Uhrzeigersinn, bei z. */
interface Ring {
  z: number;
  p: number[];
}

interface LoftOpts {
  /** Kantige Flächen statt weicher Rundung. */
  flat?: boolean;
  /** Farbe je Viereck (Band zwischen zwei Querschnitten, Segment im Ring). */
  color?: (band: number, k: number) => number;
  capA?: boolean;
  capB?: boolean;
  capColor?: number;
}

/**
 * Spannt eine Haut über mehrere Querschnitte (entlang z). Jedes Viereck hat
 * eigene Ecken, damit Farbgrenzen scharf bleiben; die Schattierung ist
 * trotzdem weich, weil die Normalen vom gemeinsamen Gitter stammen.
 */
function loft(rings: Ring[], o: LoftOpts = {}): THREE.BufferGeometry {
  const m = rings.length;
  const n = rings[0].p.length / 2;
  const P = new Float32Array(m * n * 3);
  for (let j = 0; j < m; j++) {
    for (let k = 0; k < n; k++) {
      const i = (j * n + k) * 3;
      P[i] = rings[j].p[k * 2];
      P[i + 1] = rings[j].p[k * 2 + 1];
      P[i + 2] = rings[j].z;
    }
  }
  const N = new Float32Array(m * n * 3);
  for (let j = 0; j < m; j++) {
    for (let k = 0; k < n; k++) {
      const a = (j * n + ((k + 1) % n)) * 3;
      const b = (j * n + ((k + n - 1) % n)) * 3;
      const c = (Math.min(j + 1, m - 1) * n + k) * 3;
      const d = (Math.max(j - 1, 0) * n + k) * 3;
      const ax = P[a] - P[b];
      const ay = P[a + 1] - P[b + 1];
      const az = P[a + 2] - P[b + 2];
      const zx = P[c] - P[d];
      const zy = P[c + 1] - P[d + 1];
      const zz = P[c + 2] - P[d + 2];
      let nx = ay * zz - az * zy;
      let ny = az * zx - ax * zz;
      let nz = ax * zy - ay * zx;
      const l = Math.hypot(nx, ny, nz);
      if (l < 1e-9) {
        // Zu einem Punkt geschrumpfter Ring (Spitze): Normale entlang der Achse.
        nx = 0;
        ny = 0;
        nz = j * 2 < m ? -1 : 1;
      } else {
        nx /= l;
        ny /= l;
        nz /= l;
      }
      const i = (j * n + k) * 3;
      N[i] = nx;
      N[i + 1] = ny;
      N[i + 2] = nz;
    }
  }
  const pos: number[] = [];
  const nor: number[] = [];
  const col: number[] | null = o.color ? [] : null;
  const idx: number[] = [];
  const corner = [0, 0, 0, 0];
  for (let j = 0; j < m - 1; j++) {
    for (let k = 0; k < n; k++) {
      const k1 = (k + 1) % n;
      corner[0] = j * n + k;
      corner[1] = j * n + k1;
      corner[2] = (j + 1) * n + k;
      corner[3] = (j + 1) * n + k1;
      let fx = 0;
      let fy = 0;
      let fz = 0;
      if (o.flat) {
        const a = corner[0] * 3;
        const b = corner[1] * 3;
        const c = corner[2] * 3;
        const d = corner[3] * 3;
        const ux = P[d] - P[a];
        const uy = P[d + 1] - P[a + 1];
        const uz = P[d + 2] - P[a + 2];
        const vx = P[c] - P[b];
        const vy = P[c + 1] - P[b + 1];
        const vz = P[c + 2] - P[b + 2];
        fx = uy * vz - uz * vy;
        fy = uz * vx - ux * vz;
        fz = ux * vy - uy * vx;
        const l = Math.hypot(fx, fy, fz) || 1;
        fx /= l;
        fy /= l;
        fz /= l;
      }
      const base = pos.length / 3;
      const rgbQ = col && o.color ? rgb(o.color(j, k)) : null;
      for (let q = 0; q < 4; q++) {
        const g = corner[q] * 3;
        pos.push(P[g], P[g + 1], P[g + 2]);
        if (o.flat) nor.push(fx, fy, fz);
        else nor.push(N[g], N[g + 1], N[g + 2]);
        if (col && rgbQ) col.push(rgbQ[0], rgbQ[1], rgbQ[2]);
      }
      idx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
    }
  }
  const cap = (j: number, dir: number): void => {
    let cx = 0;
    let cy = 0;
    for (let k = 0; k < n; k++) {
      cx += P[(j * n + k) * 3];
      cy += P[(j * n + k) * 3 + 1];
    }
    const base = pos.length / 3;
    const band = dir < 0 ? 0 : m - 2;
    const capRgb = col ? rgb(o.capColor ?? (o.color ? o.color(band, 0) : 0xffffff)) : null;
    pos.push(cx / n, cy / n, rings[j].z);
    nor.push(0, 0, dir);
    if (col && capRgb) col.push(capRgb[0], capRgb[1], capRgb[2]);
    for (let k = 0; k < n; k++) {
      const g = (j * n + k) * 3;
      pos.push(P[g], P[g + 1], P[g + 2]);
      nor.push(0, 0, dir);
      if (col && capRgb) col.push(capRgb[0], capRgb[1], capRgb[2]);
    }
    for (let k = 0; k < n; k++) {
      const k1 = (k + 1) % n;
      if (dir < 0) idx.push(base, base + 1 + k1, base + 1 + k);
      else idx.push(base, base + 1 + k, base + 1 + k1);
    }
  };
  if (o.capA !== false) cap(0, -1);
  if (o.capB !== false) cap(m - 1, 1);
  return rawGeo(pos, nor, col, idx);
}

/**
 * Querschnitt als Superellipse: e = 2 ist rund, größere Werte werden kastig.
 * Oben und unten dürfen verschieden hoch sein. stripe > 0 rückt die beiden
 * Ecken neben der Mitte oben auf ±stripe – für einen gleich breiten Streifen.
 */
function sring(z: number, cy: number, hw: number, ht: number, hb: number, e: number, segs: number, stripe = 0): Ring {
  const p: number[] = [];
  const q = 2 / e;
  for (let k = 0; k < segs; k++) {
    let a = (k / segs) * TAU;
    if (stripe > 0 && hw > stripe * 1.2) {
      const off = Math.asin(Math.pow(stripe / hw, 1 / q));
      if (k === segs / 4 - 1) a = HALF_PI - off;
      else if (k === segs / 4 + 1) a = HALF_PI + off;
    }
    const c = Math.cos(a);
    const s = Math.sin(a);
    p.push(Math.sign(c) * Math.pow(Math.abs(c), q) * hw, cy + Math.sign(s) * Math.pow(Math.abs(s), q) * (s >= 0 ? ht : hb));
  }
  return { z, p };
}

/** Profilpunkt für lathe(): Radius, Höhe, Farbe des Bandes ab hier, harte Kante. */
type LP = readonly [r: number, y: number, color?: number, hard?: boolean];

/**
 * Drehkörper um die y-Achse. Das Profil läuft außen von unten nach oben.
 * Jedes Band kann eine eigene Farbe haben; Radius 0 ergibt einen Fächer.
 */
function lathe(prof: LP[], segs: number, colorAt?: (band: number, j: number) => number | undefined): THREE.BufferGeometry {
  const m = prof.length;
  const bandN: number[] = [];
  for (let i = 0; i < m - 1; i++) {
    const dr = prof[i + 1][0] - prof[i][0];
    const dy = prof[i + 1][1] - prof[i][1];
    const l = Math.hypot(dr, dy) || 1;
    bandN.push(dy / l, -dr / l);
  }
  const pos: number[] = [];
  const nor: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  let color = 0xffffff;
  for (let i = 0; i < m - 1; i++) {
    color = prof[i][2] ?? color;
    // Normale am Anfang und am Ende des Bandes (über die Nachbarn gemittelt).
    let sr = bandN[i * 2];
    let sy = bandN[i * 2 + 1];
    if (i > 0 && !prof[i][3]) {
      sr += bandN[(i - 1) * 2];
      sy += bandN[(i - 1) * 2 + 1];
    } else if (i === 0 && prof[0][0] === 0 && !prof[0][3] && Math.abs(sy) > 1e-6) {
      sr = 0;
    }
    let l = Math.hypot(sr, sy) || 1;
    sr /= l;
    sy /= l;
    let er = bandN[i * 2];
    let ey = bandN[i * 2 + 1];
    if (i < m - 2 && !prof[i + 1][3]) {
      er += bandN[(i + 1) * 2];
      ey += bandN[(i + 1) * 2 + 1];
    } else if (i === m - 2 && prof[m - 1][0] === 0 && !prof[m - 1][3] && Math.abs(ey) > 1e-6) {
      er = 0;
    }
    l = Math.hypot(er, ey) || 1;
    er /= l;
    ey /= l;
    const r0 = prof[i][0];
    const y0 = prof[i][1];
    const r1 = prof[i + 1][0];
    const y1 = prof[i + 1][1];
    for (let j = 0; j < segs; j++) {
      const c0 = Math.cos((j / segs) * TAU);
      const s0 = Math.sin((j / segs) * TAU);
      const c1 = Math.cos(((j + 1) / segs) * TAU);
      const s1 = Math.sin(((j + 1) / segs) * TAU);
      const [cr, cg, cb] = rgb(colorAt?.(i, j) ?? color);
      const base = pos.length / 3;
      pos.push(r0 * c0, y0, r0 * s0, r1 * c0, y1, r1 * s0, r0 * c1, y0, r0 * s1, r1 * c1, y1, r1 * s1);
      nor.push(sr * c0, sy, sr * s0, er * c0, ey, er * s0, sr * c1, sy, sr * s1, er * c1, ey, er * s1);
      for (let q = 0; q < 4; q++) col.push(cr, cg, cb);
      if (r0 > 1e-9) idx.push(base, base + 1, base + 2);
      if (r1 > 1e-9) idx.push(base + 1, base + 3, base + 2);
    }
  }
  return rawGeo(pos, nor, col, idx);
}

/** Schlauch entlang eines Pfades, Radius fest oder je Stelle (t = 0..1). */
function sweep(
  path: readonly V3[],
  radius: number | ((t: number) => number),
  radSegs: number,
  smooth = 0,
): THREE.BufferGeometry {
  let pts = path.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
  if (smooth > 0) pts = new THREE.CatmullRomCurve3(pts, false, 'centripetal').getPoints(smooth);
  const m = pts.length;
  const pos: number[] = [];
  const nor: number[] = [];
  const idx: number[] = [];
  const T = new THREE.Vector3();
  const Nv = new THREE.Vector3(0, 1, 0);
  const Bv = new THREE.Vector3();
  const firstT = new THREE.Vector3();
  const lastT = new THREE.Vector3();
  for (let i = 0; i < m; i++) {
    T.subVectors(pts[Math.min(i + 1, m - 1)], pts[Math.max(i - 1, 0)]).normalize();
    if (i === 0) {
      if (Math.abs(T.y) > 0.9) Nv.set(1, 0, 0);
      firstT.copy(T);
    }
    if (i === m - 1) lastT.copy(T);
    Nv.addScaledVector(T, -Nv.dot(T)).normalize();
    Bv.crossVectors(T, Nv);
    const r = typeof radius === 'number' ? radius : radius(i / (m - 1));
    for (let k = 0; k < radSegs; k++) {
      const a = (k / radSegs) * TAU;
      const dx = Math.cos(a) * Nv.x + Math.sin(a) * Bv.x;
      const dy = Math.cos(a) * Nv.y + Math.sin(a) * Bv.y;
      const dz = Math.cos(a) * Nv.z + Math.sin(a) * Bv.z;
      pos.push(pts[i].x + dx * r, pts[i].y + dy * r, pts[i].z + dz * r);
      nor.push(dx, dy, dz);
    }
  }
  for (let i = 0; i < m - 1; i++) {
    for (let k = 0; k < radSegs; k++) {
      const k1 = (k + 1) % radSegs;
      const a = i * radSegs + k;
      const b = i * radSegs + k1;
      const c = (i + 1) * radSegs + k;
      const d = (i + 1) * radSegs + k1;
      idx.push(a, b, c, b, d, c);
    }
  }
  // Deckel an beiden Enden.
  for (let e = 0; e < 2; e++) {
    const i = e === 0 ? 0 : m - 1;
    const t = e === 0 ? firstT : lastT;
    const s = e === 0 ? -1 : 1;
    const base = pos.length / 3;
    pos.push(pts[i].x, pts[i].y, pts[i].z);
    nor.push(t.x * s, t.y * s, t.z * s);
    for (let k = 0; k < radSegs; k++) {
      const g = (i * radSegs + k) * 3;
      pos.push(pos[g], pos[g + 1], pos[g + 2]);
      nor.push(t.x * s, t.y * s, t.z * s);
    }
    for (let k = 0; k < radSegs; k++) {
      const k1 = (k + 1) % radSegs;
      if (e === 0) idx.push(base, base + 1 + k1, base + 1 + k);
      else idx.push(base, base + 1 + k, base + 1 + k1);
    }
  }
  return rawGeo(pos, nor, null, idx);
}

/** Flaches Vieleck (x, y) mit Dicke entlang z – für Flossen, Blitze, Zacken. */
function prism(poly: readonly number[], depth: number): THREE.BufferGeometry {
  let pts: THREE.Vector2[] = [];
  for (let i = 0; i < poly.length; i += 2) pts.push(new THREE.Vector2(poly[i], poly[i + 1]));
  if (THREE.ShapeUtils.isClockWise(pts)) pts = pts.reverse();
  const tris = THREE.ShapeUtils.triangulateShape(pts, []);
  const n = pts.length;
  const h = depth / 2;
  const pos: number[] = [];
  const nor: number[] = [];
  const idx: number[] = [];
  for (const p of pts) {
    pos.push(p.x, p.y, h);
    nor.push(0, 0, 1);
  }
  for (const p of pts) {
    pos.push(p.x, p.y, -h);
    nor.push(0, 0, -1);
  }
  for (const t of tris) {
    const a = pts[t[0]];
    const b = pts[t[1]];
    const c = pts[t[2]];
    const ccw = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x) > 0;
    if (ccw) idx.push(t[0], t[1], t[2], n + t[0], n + t[2], n + t[1]);
    else idx.push(t[0], t[2], t[1], n + t[0], n + t[1], n + t[2]);
  }
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    const du = b.x - a.x;
    const dv = b.y - a.y;
    const l = Math.hypot(du, dv) || 1;
    const base = pos.length / 3;
    pos.push(a.x, a.y, h, a.x, a.y, -h, b.x, b.y, -h, b.x, b.y, h);
    for (let q = 0; q < 4; q++) nor.push(dv / l, -du / l, 0);
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  return rawGeo(pos, nor, null, idx);
}

function sphere(rx: number, ry: number, rz: number, ws: number, hs: number): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(1, ws, hs);
  g.scale(rx, ry, rz);
  return g;
}

function box(w: number, h: number, d: number): THREE.BufferGeometry {
  return new THREE.BoxGeometry(w, h, d);
}

/** Zylinder entlang y. */
function cyl(rTop: number, rBot: number, h: number, segs: number): THREE.BufferGeometry {
  return new THREE.CylinderGeometry(rTop, rBot, h, segs, 1);
}

/** Kegel mit dem Boden im Ursprung, Spitze nach +y. */
function cone(r: number, h: number, segs: number): THREE.BufferGeometry {
  const g = new THREE.ConeGeometry(r, h, segs, 1);
  g.translate(0, h / 2, 0);
  return g;
}

/** Kapsel vom Ursprung nach +y (für Arme). */
function limb(r: number, len: number, segs: number, capSegs: number): THREE.BufferGeometry {
  const g = new THREE.CapsuleGeometry(r, len, capSegs, segs, 1);
  g.translate(0, len / 2, 0);
  return g;
}

/** Kissenförmiger Quader mit weichen Kanten (entlang z gespannt). */
function pillow(w: number, h: number, d: number, r: number, segs: number, e = 4): THREE.BufferGeometry {
  const hw = w / 2;
  const hh = h / 2;
  const hd = d / 2;
  return loft([
    sring(-hd, 0, hw - r, hh - r, hh - r, e, segs),
    sring(-hd + r, 0, hw, hh, hh, e, segs),
    sring(hd - r, 0, hw, hh, hh, e, segs),
    sring(hd, 0, hw - r, hh - r, hh - r, e, segs),
  ]);
}

const TIRE = 0x3a3745;
const TIRE_2 = 0x4b4857;

/** Rad: Achse entlang x, Außenseite bei +x. Die Lauffläche ist zweifarbig, damit man die Drehung sieht. */
function wheel(r: number, w: number, segs: number, wall: number, rim: number, rim2: number, hub: number): THREE.BufferGeometry {
  const h = w / 2;
  const prof: LP[] = [
    [0, -h, TIRE],
    [r, -h + w * 0.14, TIRE],
    [r, h - w * 0.26, TIRE],
    [r * 0.83, h, wall],
    [r * 0.62, h - 0.012, rim, true],
    [r * 0.25, h - Math.min(0.075, w * 0.3), hub, true],
    [0, h - Math.min(0.03, w * 0.12)],
  ];
  const g = lathe(prof, segs, (band, j) => (j % 2 === 1 ? (band === 4 ? rim2 : band === 1 ? TIRE_2 : undefined) : undefined));
  g.rotateZ(-HALF_PI);
  return g;
}

/** Vereinfachte Hülle des Rads für die Kontur (ohne Felge). */
function wheelHull(r: number, w: number, segs: number): THREE.BufferGeometry {
  const h = w / 2;
  const g = lathe([[0, -h], [r, -h + w * 0.14], [r, h - w * 0.26], [r * 0.83, h], [0, h]], segs);
  g.rotateZ(-HALF_PI);
  return g;
}

// ───────────────────────────── Zusammenbau ─────────────────────────────

/** Weiche Bindung: liefert zu einem Ort (Ruhelage) zwei Knochen mit Gewichten. */
type SkinFn = (x: number, y: number, z: number, out: number[]) => void;

interface Put {
  bone: number;
  color?: number;
  pos?: V3;
  /** Drehung als Euler-Winkel … */
  rot?: V3;
  order?: THREE.EulerOrder;
  /** … oder: die +y-Achse des Teils zeigt in diese Richtung. */
  aim?: V3;
  scale?: V3 | number;
  /** Dicke der Kontur relativ (1 = normal, 0 = keine). */
  outline?: number;
  /** Vereinfachte Form nur für die Kontur (gleiche Lage wie das Teil selbst). */
  hull?: THREE.BufferGeometry;
  /** Zusätzlich an x gespiegelt, gebunden an diesen Knochen. */
  mirror?: number;
  skin?: SkinFn;
}

/** Grunddicke aller Konturen relativ zur Vorgabe aus toon.ts. */
const LINE = 0.8;

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const Y_AXIS = new THREE.Vector3(0, 1, 0);

/**
 * Sammelt Einzelteile zu einem Netz. Jedes Teil wird im Ruhe-Koordinatensystem
 * seines Knochens angegeben, bekommt Farbe und Knochen in die Ecken geschrieben
 * und – wenn gewünscht – einen Eintrag im Kontur-Netz.
 */
class Builder {
  private readonly pos: number[] = [];
  private readonly nor: number[] = [];
  private readonly col: number[] = [];
  private readonly uv: number[] = [];
  private readonly si: number[] = [];
  private readonly sw: number[] = [];
  private readonly idx: number[] = [];
  private readonly oPos: number[] = [];
  private readonly oNor: number[] = [];
  private readonly oSi: number[] = [];
  private readonly oSw: number[] = [];
  private readonly oIdx: number[] = [];
  private readonly tmp = [0, 0, 0, 0];

  constructor(
    private readonly rest: THREE.Matrix4[],
    readonly detail: KartDetail,
    private readonly outlines: boolean,
    private readonly withUv = false,
  ) {}

  /** Segmentzahl passend zur Detailstufe. */
  s(n: number, min = 4): number {
    const f = this.detail === 2 ? 1 : this.detail === 1 ? 0.8 : 0.6;
    return Math.max(min, Math.round(n * f));
  }

  /** Wie s(), aber durch vier teilbar (für symmetrische Querschnitte). */
  s4(n: number): number {
    return Math.max(8, Math.round(this.s(n) / 4) * 4);
  }

  get vertexCount(): number {
    return this.pos.length / 3;
  }

  /** Fügt ein Teil hinzu (die Geometrie wird dabei verbraucht). */
  put(geo: THREE.BufferGeometry, o: Put): void {
    if (o.aim) {
      _p.set(o.aim[0], o.aim[1], o.aim[2]).normalize();
      _q.setFromUnitVectors(Y_AXIS, _p);
    } else if (o.rot) {
      _q.setFromEuler(_e.set(o.rot[0], o.rot[1], o.rot[2], o.order ?? 'XYZ'));
    } else {
      _q.identity();
    }
    if (o.pos) _p.set(o.pos[0], o.pos[1], o.pos[2]);
    else _p.set(0, 0, 0);
    if (typeof o.scale === 'number') _s.setScalar(o.scale);
    else if (o.scale) _s.set(o.scale[0], o.scale[1], o.scale[2]);
    else _s.set(1, 1, 1);
    _m.compose(_p, _q, _s).premultiply(this.rest[o.bone]);
    geo.applyMatrix4(_m);
    if (!geo.getAttribute('normal')) geo.computeVertexNormals();
    const hull = o.hull ?? geo;
    if (o.hull) {
      o.hull.applyMatrix4(_m);
      if (!o.hull.getAttribute('normal')) o.hull.computeVertexNormals();
    }
    const thick = this.outlines ? (o.outline ?? 1) * LINE : 0;
    this.appendMain(geo, o, o.bone, false);
    if (thick > 0) this.appendHull(hull, o, o.bone, false, thick);
    if (o.mirror !== undefined) {
      this.appendMain(geo, o, o.mirror, true);
      if (thick > 0) this.appendHull(hull, o, o.mirror, true, thick);
    }
    geo.dispose();
    o.hull?.dispose();
  }

  private appendMain(geo: THREE.BufferGeometry, o: Put, bone: number, mirrored: boolean): void {
    const p = geo.getAttribute('position');
    const n = geo.getAttribute('normal');
    const c = geo.getAttribute('color');
    const u = geo.getAttribute('uv');
    const index = geo.getIndex();
    const base = this.pos.length / 3;
    const sx = mirrored ? -1 : 1;
    const [cr, cg, cb] = rgb(o.color ?? 0xffffff);
    const tmp = this.tmp;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i) * sx;
      const y = p.getY(i);
      const z = p.getZ(i);
      this.pos.push(x, y, z);
      this.nor.push(n.getX(i) * sx, n.getY(i), n.getZ(i));
      if (c) this.col.push(c.getX(i), c.getY(i), c.getZ(i));
      else this.col.push(cr, cg, cb);
      if (this.withUv) this.uv.push(u ? u.getX(i) : 0, u ? u.getY(i) : 0);
      if (o.skin) {
        o.skin(x, y, z, tmp);
        this.si.push(tmp[0], tmp[2], 0, 0);
        this.sw.push(tmp[1], tmp[3], 0, 0);
      } else {
        this.si.push(bone, 0, 0, 0);
        this.sw.push(1, 0, 0, 0);
      }
    }
    const count = index ? index.count : p.count;
    for (let i = 0; i < count; i += 3) {
      const a = base + (index ? index.getX(i) : i);
      const b = base + (index ? index.getX(i + 1) : i + 1);
      const d = base + (index ? index.getX(i + 2) : i + 2);
      if (mirrored) this.idx.push(a, d, b);
      else this.idx.push(a, b, d);
    }
  }

  /**
   * Kontur: Ecken am selben Ort bekommen dieselbe (gemittelte) Richtung, sonst
   * reißt die Hülle an harten Kanten auf. An Kanten wird sie etwas verlängert,
   * damit die Linie dort nicht dünner ausfällt als auf Flächen.
   */
  private appendHull(geo: THREE.BufferGeometry, o: Put, bone: number, mirrored: boolean, thick: number): void {
    const p = geo.getAttribute('position');
    const n = geo.getAttribute('normal');
    const index = geo.getIndex();
    const sx = mirrored ? -1 : 1;
    const groups = new Map<string, number[]>();
    const keys: string[] = [];
    for (let i = 0; i < p.count; i++) {
      const key = `${Math.round(p.getX(i) * 4000)},${Math.round(p.getY(i) * 4000)},${Math.round(p.getZ(i) * 4000)}`;
      keys.push(key);
      const nx = n.getX(i);
      const ny = n.getY(i);
      const nz = n.getZ(i);
      const g = groups.get(key);
      if (!g) {
        groups.set(key, [nx, ny, nz]);
        continue;
      }
      let known = false;
      for (let k = 0; k < g.length; k += 3) {
        if (g[k] * nx + g[k + 1] * ny + g[k + 2] * nz > 0.995) {
          known = true;
          break;
        }
      }
      if (!known) g.push(nx, ny, nz);
    }
    const dirs = new Map<string, [number, number, number]>();
    for (const [key, g] of groups) {
      let ax = 0;
      let ay = 0;
      let az = 0;
      for (let k = 0; k < g.length; k += 3) {
        ax += g[k];
        ay += g[k + 1];
        az += g[k + 2];
      }
      const l = Math.hypot(ax, ay, az) || 1;
      ax /= l;
      ay /= l;
      az /= l;
      let minDot = 1;
      for (let k = 0; k < g.length; k += 3) minDot = Math.min(minDot, ax * g[k] + ay * g[k + 1] + az * g[k + 2]);
      const f = thick / clamp(minDot, 0.6, 1);
      dirs.set(key, [ax * f, ay * f, az * f]);
    }
    const base = this.oPos.length / 3;
    const tmp = this.tmp;
    for (let i = 0; i < p.count; i++) {
      const d = dirs.get(keys[i])!;
      const x = p.getX(i) * sx;
      const y = p.getY(i);
      const z = p.getZ(i);
      this.oPos.push(x, y, z);
      this.oNor.push(d[0] * sx, d[1], d[2]);
      if (o.skin) {
        o.skin(x, y, z, tmp);
        this.oSi.push(tmp[0], tmp[2], 0, 0);
        this.oSw.push(tmp[1], tmp[3], 0, 0);
      } else {
        this.oSi.push(bone, 0, 0, 0);
        this.oSw.push(1, 0, 0, 0);
      }
    }
    const count = index ? index.count : p.count;
    for (let i = 0; i < count; i += 3) {
      const a = base + (index ? index.getX(i) : i);
      const b = base + (index ? index.getX(i + 1) : i + 1);
      const d = base + (index ? index.getX(i + 2) : i + 2);
      if (mirrored) this.oIdx.push(a, d, b);
      else this.oIdx.push(a, b, d);
    }
  }

  finish(): { main: THREE.BufferGeometry; outline: THREE.BufferGeometry | null } {
    const main = new THREE.BufferGeometry();
    main.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    main.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    main.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    if (this.withUv) main.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    main.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(this.si, 4));
    main.setAttribute('skinWeight', new THREE.Float32BufferAttribute(this.sw, 4));
    main.setIndex(this.idx);
    main.boundingSphere = BOUNDS.clone();
    let outline: THREE.BufferGeometry | null = null;
    if (this.oIdx.length > 0) {
      outline = new THREE.BufferGeometry();
      outline.setAttribute('position', new THREE.Float32BufferAttribute(this.oPos, 3));
      outline.setAttribute('onormal', new THREE.Float32BufferAttribute(this.oNor, 3));
      outline.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(this.oSi, 4));
      outline.setAttribute('skinWeight', new THREE.Float32BufferAttribute(this.oSw, 4));
      outline.setIndex(this.oIdx);
      outline.boundingSphere = BOUNDS.clone();
    }
    return { main, outline };
  }
}

/** Großzügige Hülle fürs Sichtbarkeits-Culling (Kart samt Schal, Ring, Flammen). */
const BOUNDS = new THREE.Sphere(new THREE.Vector3(0, 0.7, 0), 2.6);

// ───────────────────────────── Maße je Kart ─────────────────────────────

interface WheelSpec {
  x: number;
  z: number;
  r: number;
  w: number;
}

interface Spec {
  color: number;
  wf: WheelSpec;
  wr: WheelSpec;
  /** Hüfte: Drehpunkt des Oberkörpers. */
  hip: V3;
  /** Hüfte → Hals. */
  torsoLen: number;
  /** Linke Schulter relativ zur Hüfte. */
  shoulder: V3;
  armR: number;
  upper: number;
  fore: number;
  hand: number;
  /** Lenkrad: Mitte, Neigung, Radius. */
  steer: V3;
  steerTilt: number;
  steerR: number;
  /** Linke Auspuffmündung und Steigung der Flamme. */
  exhaust: V3;
  exhaustUp: number;
  /** Linker Ohransatz im Kopf, Neigung nach außen. */
  ear: V3;
  earTilt: number;
  /** Kette (Schal/Schwanz): Elternknochen, erstes Gelenk, Schritt zum nächsten. */
  chainParent: number;
  chain: V3;
  chainStep: V3;
  /** Zwei freie Knochen: Elternknochen und Lage (links; der zweite gespiegelt). */
  auxParent: number;
  aux: V3;
  auxMirror: boolean;
  aux1Parent: number;
  aux1: V3;
  /** Wo es bei „Kurzschluss“ qualmt. */
  smoke: V3;
}

const SPECS: Spec[] = [
  // 0 – Kolben-Kalle: Hot-Rod, hinten riesige Räder, vorn kleine
  {
    color: 0xff5a4e,
    wf: { x: 0.585, z: 0.7, r: 0.25, w: 0.22 },
    wr: { x: 0.575, z: -0.56, r: 0.37, w: 0.36 },
    hip: [0, 0.47, -0.3],
    torsoLen: 0.37,
    shoulder: [0.26, 0.26, 0.02],
    armR: 0.07,
    upper: 0.25,
    fore: 0.25,
    hand: 0.072,
    steer: [0, 0.67, 0.13],
    steerTilt: 0.62,
    steerR: 0.15,
    exhaust: [0.25, 0.335, -1.06],
    exhaustUp: 0.3,
    ear: [0.285, 0.455, -0.03],
    earTilt: 0.5,
    chainParent: B.chassis,
    chain: [0, 0.5, -0.9],
    chainStep: [0, 0, -0.1],
    auxParent: B.chassis, // Motorblock (zittert)
    aux: [0, 0.4, 0.58],
    auxMirror: false,
    aux1Parent: B.head, // Unterkiefer
    aux1: [0, 0.15, 0.08],
    smoke: [0, 0.85, 0.6],
  },
  // 1 – Vera Vergaser: schlanker Renner
  {
    color: 0x1fc8b6,
    wf: { x: 0.625, z: 0.68, r: 0.29, w: 0.18 },
    wr: { x: 0.63, z: -0.58, r: 0.32, w: 0.21 },
    hip: [0, 0.44, -0.2],
    torsoLen: 0.35,
    shoulder: [0.19, 0.25, 0.02],
    armR: 0.05,
    upper: 0.23,
    fore: 0.23,
    hand: 0.06,
    steer: [0, 0.63, 0.2],
    steerTilt: 0.6,
    steerR: 0.14,
    exhaust: [0.33, 0.34, -1.0],
    exhaustUp: 0.06,
    ear: [0.15, 0.49, -0.02],
    earTilt: 0.28,
    chainParent: B.torso, // Schal
    chain: [0.13, 0.36, -0.13],
    chainStep: [0, 0, -0.21],
    auxParent: B.chassis,
    aux: [0, 0.5, 0],
    auxMirror: false,
    aux1Parent: B.chassis,
    aux1: [0, 0.5, 0],
    smoke: [0, 0.8, -0.75],
  },
  // 2 – Bremsen-Bert: Badewanne auf Rädern
  {
    color: 0xffd23f,
    wf: { x: 0.6, z: 0.6, r: 0.27, w: 0.27 },
    wr: { x: 0.6, z: -0.62, r: 0.29, w: 0.29 },
    hip: [0, 0.5, -0.2],
    torsoLen: 0.34,
    shoulder: [0.29, 0.23, 0.02],
    armR: 0.075,
    upper: 0.24,
    fore: 0.23,
    hand: 0.078,
    steer: [0, 0.74, 0.22],
    steerTilt: 0.6,
    steerR: 0.15,
    exhaust: [0.2, 0.2, -1.03],
    exhaustUp: 0.1,
    ear: [0.3, 0.3, 0],
    earTilt: 0,
    chainParent: B.chassis,
    chain: [0, 0.5, -0.9],
    chainStep: [0, 0, -0.1],
    auxParent: B.head, // Schnauzbart links/rechts
    aux: [0.1, 0.19, 0.27],
    auxMirror: true,
    aux1Parent: B.head,
    aux1: [-0.1, 0.19, 0.27],
    smoke: [0, 0.75, -0.85],
  },
  // 3 – Zünd-Zoe: kantiger Keil mit Zündkerzen
  {
    color: 0x9b87ff,
    wf: { x: 0.6, z: 0.7, r: 0.26, w: 0.22 },
    wr: { x: 0.6, z: -0.58, r: 0.31, w: 0.28 },
    hip: [0, 0.45, -0.18],
    torsoLen: 0.34,
    shoulder: [0.18, 0.25, 0.02],
    armR: 0.046,
    upper: 0.21,
    fore: 0.21,
    hand: 0.058,
    steer: [0, 0.63, 0.2],
    steerTilt: 0.6,
    steerR: 0.135,
    exhaust: [0.22, 0.38, -1.04],
    exhaustUp: 0.1,
    ear: [0.165, 0.5, -0.02],
    earTilt: 0.34,
    chainParent: B.chassis, // Schwanz
    chain: [0.0, 0.62, -0.6],
    chainStep: [0, 0.24, -0.06],
    auxParent: B.chassis, // Zündkerzen-Antennen
    aux: [0.33, 0.63, -0.86],
    auxMirror: true,
    aux1Parent: B.chassis,
    aux1: [-0.33, 0.63, -0.86],
    smoke: [0, 0.8, -0.8],
  },
];

/** Alles, was die Baufunktionen einer Figur brauchen. */
interface Ctx {
  b: Builder;
  /** Aufkleber (Augen, Startnummer) – eigenes Netz mit Textur. */
  d: Builder;
  sp: Spec;
  slot: number;
  /** Erste Ecke der Augen im Aufkleber-Netz (setzt addEyes). */
  eyeStart: number;
}

// ───────────────────────────── Aufkleber: Augen und Startnummer ─────────────────────────────

const EYE = { OPEN: 0, BLINK: 1, DIZZY: 2, STUN: 3, HAPPY: 4, SAD: 5, FIERCE: 6, WOW: 7 } as const;
const ATLAS_COLS = 4;
const ATLAS_ROWS = 3;
const CELL = 192;

interface EyeStyle {
  iris: string;
  irisRim: string;
  /** Halbachsen des Augapfels als Anteil der Zelle. */
  rx: number;
  ry: number;
  /** Wie weit das Oberlid im Normalzustand herabhängt (0..1). */
  lid: number;
  /** > 0: zur Nase hin tiefer (grimmig); < 0: außen tiefer (sanft). */
  lidSlope: number;
  /** Breite der Pupille (1 = rund, kleiner = Schlitz). */
  pupil: number;
  irisR: number;
  lashes: number;
}

const EYE_STYLES: EyeStyle[] = [
  { iris: '#8a4f22', irisRim: '#4a2812', rx: 0.4, ry: 0.4, lid: 0.16, lidSlope: 0.3, pupil: 1, irisR: 0.25, lashes: 0 },
  { iris: '#35c46c', irisRim: '#12733a', rx: 0.43, ry: 0.37, lid: 0.12, lidSlope: 0.1, pupil: 0.9, irisR: 0.25, lashes: 2 },
  { iris: '#4a86d8', irisRim: '#1f4a8c', rx: 0.38, ry: 0.36, lid: 0.4, lidSlope: -0.14, pupil: 1, irisR: 0.24, lashes: 0 },
  { iris: '#c3f23c', irisRim: '#5d9a10', rx: 0.41, ry: 0.45, lid: 0.04, lidSlope: 0.06, pupil: 0.62, irisR: 0.3, lashes: 3 },
];

function drawOpenEye(
  g: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  S: number,
  st: EyeStyle,
  lid: number,
  slope: number,
  irisScale: number,
  lookY: number,
  sparkle: boolean,
): void {
  const rx = st.rx * S;
  const ry = st.ry * S;
  const lw = S * 0.05;
  const yl = cy - ry + 2 * ry * lid;
  const k = slope * rx * 0.55;
  const dx = rx * 1.5;
  g.save();
  // Alles unterhalb der Lidlinie ist Auge.
  g.beginPath();
  g.moveTo(cx - dx, yl + k);
  g.lineTo(cx + dx, yl - k);
  g.lineTo(cx + dx, cy + ry * 2);
  g.lineTo(cx - dx, cy + ry * 2);
  g.closePath();
  g.clip();
  g.beginPath();
  g.ellipse(cx, cy, rx, ry, 0, 0, TAU);
  g.fillStyle = '#ffffff';
  g.fill();
  g.save();
  g.clip();
  // Iris, leicht zur Nase hin versetzt (die Zelle zeigt das linke Auge; die
  // Nase liegt links).
  const ix = cx - rx * 0.1;
  const iy = cy + ry * 0.08 + lookY * ry;
  const ir = st.irisR * S * irisScale;
  if (irisScale > 0.3) {
    g.beginPath();
    g.arc(ix, iy, ir, 0, TAU);
    g.fillStyle = st.iris;
    g.fill();
    g.lineWidth = lw * 0.7;
    g.strokeStyle = st.irisRim;
    g.stroke();
    // dunklerer oberer Rand der Iris
    g.beginPath();
    g.arc(ix, iy - ir * 0.55, ir, 0, TAU);
    g.fillStyle = 'rgba(0,0,0,0.18)';
    g.fill();
  }
  g.beginPath();
  const pr = irisScale > 0.3 ? ir * 0.62 : S * 0.045;
  g.ellipse(ix, iy, pr * (irisScale > 0.3 ? st.pupil : 1), pr, 0, 0, TAU);
  g.fillStyle = INK_CSS;
  g.fill();
  if (irisScale > 0.3) {
    // Glanzpunkte
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.arc(ix + ir * 0.38, iy - ir * 0.42, ir * (sparkle ? 0.4 : 0.32), 0, TAU);
    g.fill();
    g.beginPath();
    g.arc(ix - ir * 0.4, iy + ir * 0.42, ir * (sparkle ? 0.22 : 0.15), 0, TAU);
    g.fill();
  }
  // Schatten des Oberlids
  g.fillStyle = 'rgba(70,60,110,0.22)';
  g.beginPath();
  g.moveTo(cx - dx, yl + k);
  g.lineTo(cx + dx, yl - k);
  g.lineTo(cx + dx, yl - k + ry * 0.28);
  g.lineTo(cx - dx, yl + k + ry * 0.28);
  g.closePath();
  g.fill();
  g.restore();
  g.beginPath();
  g.ellipse(cx, cy, rx, ry, 0, 0, TAU);
  g.lineWidth = lw;
  g.strokeStyle = INK_CSS;
  g.stroke();
  g.restore();
  // Oberlid als kräftiger Tuschestrich
  g.save();
  g.beginPath();
  g.ellipse(cx, cy, rx + lw * 0.5, ry + lw * 0.5, 0, 0, TAU);
  g.clip();
  g.strokeStyle = INK_CSS;
  g.lineWidth = lw * 1.9;
  g.beginPath();
  if (lid > 0.06) {
    g.moveTo(cx - dx, yl + k);
    g.lineTo(cx + dx, yl - k);
  } else {
    g.ellipse(cx, cy, rx, ry, 0, Math.PI * 1.08, Math.PI * 1.92);
  }
  g.stroke();
  g.restore();
  // Wimpern am äußeren Augenwinkel
  if (st.lashes > 0) {
    g.strokeStyle = INK_CSS;
    g.lineWidth = lw * 1.1;
    g.lineCap = 'round';
    for (let i = 0; i < st.lashes; i++) {
      const a = -0.25 - i * 0.33;
      const ex = cx + Math.cos(a) * rx;
      const ey = Math.max(cy + Math.sin(a) * ry, yl - k * (ex - cx) / dx);
      g.beginPath();
      g.moveTo(ex - S * 0.01, ey);
      g.lineTo(ex + S * 0.085, ey - S * (0.035 + i * 0.022));
      g.stroke();
    }
  }
}

function drawEye(g: CanvasRenderingContext2D, x0: number, y0: number, st: EyeStyle, state: number): void {
  const S = CELL;
  const cx = x0 + S / 2;
  const cy = y0 + S / 2;
  const rx = st.rx * S;
  const ry = st.ry * S;
  const lw = S * 0.05;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.strokeStyle = INK_CSS;
  switch (state) {
    case EYE.BLINK:
      g.lineWidth = lw * 2;
      g.beginPath();
      g.ellipse(cx, cy - ry * 0.2, rx * 0.9, ry * 0.5, 0, Math.PI * 0.1, Math.PI * 0.9);
      g.stroke();
      break;
    case EYE.HAPPY:
      g.lineWidth = lw * 2.2;
      g.beginPath();
      g.ellipse(cx, cy + ry * 0.4, rx * 0.88, ry * 0.8, 0, Math.PI * 1.1, Math.PI * 1.9);
      g.stroke();
      break;
    case EYE.DIZZY: {
      g.beginPath();
      g.ellipse(cx, cy, rx, ry, 0, 0, TAU);
      g.fillStyle = '#ffffff';
      g.fill();
      g.lineWidth = lw;
      g.stroke();
      g.lineWidth = lw * 1.25;
      g.beginPath();
      const turns = 2.4;
      for (let i = 0; i <= 80; i++) {
        const f = i / 80;
        const a = f * turns * TAU;
        const r = f * 0.74;
        const px = cx + Math.cos(a) * r * rx;
        const py = cy + Math.sin(a) * r * ry;
        if (i === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.stroke();
      break;
    }
    case EYE.STUN:
      drawOpenEye(g, cx, cy, S, st, 0, 0, 0.2, 0, false);
      break;
    case EYE.SAD:
      drawOpenEye(g, cx, cy, S, st, 0.44, -0.42, 0.95, 0.22, false);
      break;
    case EYE.FIERCE:
      drawOpenEye(g, cx, cy, S, st, Math.max(st.lid, 0.26) + 0.1, 0.42, 0.95, 0, false);
      break;
    case EYE.WOW:
      drawOpenEye(g, cx, cy, S, st, 0, 0, 1.12, -0.04, true);
      break;
    default:
      drawOpenEye(g, cx, cy, S, st, st.lid, st.lidSlope, 1, 0, false);
  }
}

/** Zeichnet alle Augenzustände einer Figur und ihre Startnummer in ein Bild. */
function makeAtlas(slot: number): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = CELL * ATLAS_COLS;
  canvas.height = CELL * ATLAS_ROWS;
  const g = canvas.getContext('2d');
  if (!g) return null;
  const st = EYE_STYLES[slot];
  for (let s = 0; s < 8; s++) drawEye(g, (s % ATLAS_COLS) * CELL, Math.floor(s / ATLAS_COLS) * CELL, st, s);
  // Startnummer: kräftige, schräge Ziffer
  g.save();
  g.translate(CELL / 2, CELL * 2.5);
  g.transform(1, 0, -0.14, 1, 0, 0);
  g.font = `900 ${Math.round(CELL * 0.74)}px "Arial Black", "Helvetica Neue", Impact, system-ui, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = INK_CSS;
  g.fillText(String(slot + 1), CELL * 0.03, CELL * 0.04);
  g.restore();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/**
 * Gewölbter Flicken auf dem Schädel für ein Auge. uv läuft 0..1 über die
 * Zelle; u = 0 liegt an der Nase (das rechte Auge wird dafür gespiegelt).
 */
function eyePatch(
  c: V3,
  r: V3,
  phi0: number,
  psi0: number,
  dphi: number,
  dpsi: number,
  tilt: number,
  n: number,
  flipU: boolean,
): THREE.BufferGeometry {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const ct = Math.cos(tilt);
  const st = Math.sin(tilt);
  const lift = 1.02;
  for (let iy = 0; iy <= n; iy++) {
    for (let ix = 0; ix <= n; ix++) {
      const u = ix / n;
      const v = iy / n;
      const du = (u - 0.5) * 2 * dphi;
      const dv = (v - 0.5) * 2 * dpsi;
      const phi = phi0 + du * ct - dv * st;
      const psi = psi0 + du * st + dv * ct;
      pos.push(
        c[0] + r[0] * lift * Math.sin(phi) * Math.cos(psi),
        c[1] + r[1] * lift * Math.sin(psi),
        c[2] + r[2] * lift * Math.cos(phi) * Math.cos(psi),
      );
      uv.push(flipU ? 1 - u : u, v);
    }
  }
  for (let iy = 0; iy < n; iy++) {
    for (let ix = 0; ix < n; ix++) {
      const a = iy * (n + 1) + ix;
      idx.push(a, a + 1, a + n + 1, a + 1, a + n + 2, a + n + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

interface EyePlace {
  c: V3;
  r: V3;
  phi: number;
  psi: number;
  dphi: number;
  dpsi: number;
  tilt: number;
}

/** Beide Augen; merkt sich, wo sie im Aufkleber-Netz liegen (für setEyes). */
function addEyes(c: Ctx, e: EyePlace): void {
  const n = c.d.detail === 0 ? 2 : 4;
  c.eyeStart = c.d.vertexCount;
  c.d.put(eyePatch(e.c, e.r, e.phi, e.psi, e.dphi, e.dpsi, e.tilt, n, false), { bone: B.head });
  c.d.put(eyePatch(e.c, e.r, -e.phi, e.psi, e.dphi, e.dpsi, -e.tilt, n, true), { bone: B.head });
}

/**
 * Startnummernschild: helle Scheibe im Netz, Ziffer als Aufkleber darüber.
 * Die Scheibe schaut entlang ihrer +y-Achse; turn dreht die Ziffer in der
 * Scheibenebene (0: Oberkante der Ziffer nach −z, π: nach +z, ±π/2: seitlich).
 */
function addNumber(c: Ctx, pos: V3, rot: V3, r: number, turn: number): void {
  c.b.put(cyl(r, r, 0.024, c.b.s(12, 8)), { bone: B.chassis, color: WHITE, pos, rot, outline: 0.55 });
  const a = r * 0.86;
  const co = Math.cos(turn);
  const si = Math.sin(turn);
  const h = 0.019;
  const u0 = 0;
  const u1 = 1 / ATLAS_COLS;
  const v0 = 0;
  const v1 = 1 / ATLAS_ROWS;
  const g = new THREE.BufferGeometry();
  const corner = (x: number, z: number): number[] => [x * co + z * si, h, -x * si + z * co];
  g.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([...corner(-a, a), ...corner(a, a), ...corner(a, -a), ...corner(-a, -a)], 3),
  );
  g.setAttribute('uv', new THREE.Float32BufferAttribute([u0, v0, u1, v0, u1, v1, u0, v1], 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  g.computeVertexNormals();
  c.d.put(g, { bone: B.chassis, pos, rot });
}

// ───────────────────────────── gemeinsame Teile ─────────────────────────────

interface WheelLook {
  wall: number;
  rim: number;
  rim2: number;
  hub: number;
}

function addWheels(c: Ctx, look: WheelLook): void {
  const { b, sp } = c;
  const segs = b.s(12, 8);
  b.put(wheel(sp.wf.r, sp.wf.w, segs, look.wall, look.rim, look.rim2, look.hub), { bone: B.wFL, mirror: B.wFR, hull: wheelHull(sp.wf.r, sp.wf.w, segs) });
  b.put(wheel(sp.wr.r, sp.wr.w, segs, look.wall, look.rim, look.rim2, look.hub), { bone: B.wRL, mirror: B.wRR, hull: wheelHull(sp.wr.r, sp.wr.w, segs) });
}

/** Achse zwischen zwei Rädern (sichtbar, wo die Karosserie schmal ist). */
function addAxle(c: Ctx, w: WheelSpec, r: number): void {
  c.b.put(cyl(r, r, w.x * 2, 5), { bone: B.chassis, color: DARK, pos: [0, w.r, w.z], rot: [0, 0, HALF_PI], outline: 0.6 });
}

function addSteering(c: Ctx, rimColor: number, spoke: number): void {
  const { b, sp } = c;
  const R = sp.steerR;
  b.put(new THREE.TorusGeometry(R, 0.02, 4, b.s(10, 8)), { bone: B.steer, color: rimColor, outline: 0.6 });
  b.put(box(R * 2, 0.03, 0.014), { bone: B.steer, color: spoke, outline: 0 });
  b.put(box(0.03, R, 0.014), { bone: B.steer, color: spoke, pos: [0, R / 2, 0], outline: 0 });
  // Lenksäule nach vorn-unten ins Armaturenbrett
  b.put(cyl(0.016, 0.016, 0.34, 4), { bone: B.steer, color: DARK, pos: [0, 0, -0.17], rot: [HALF_PI, 0, 0], outline: 0 });
}

interface BodyLook {
  /** Rumpf: Halbbreite x, Halbtiefe z. */
  rx: number;
  rz: number;
  /** Farben des Rumpfs von unten nach oben (ein Eintrag = einfarbig). */
  suit: number[];
  sleeve: number;
  cuff: number;
  glove: number;
}

function addDriverBody(c: Ctx, look: BodyLook): void {
  const { b, sp } = c;
  const h = sp.torsoLen;
  const rx = look.rx;
  // Rumpf als Fass mit runden Schultern; unten steckt er in der Karosserie.
  const rows: [number, number][] = [
    [0, -0.14],
    [rx * 0.85, -0.12],
    [rx, 0.0],
    [rx, h * 0.3],
    [rx * 0.98, h * 0.55],
    [rx * 0.88, h * 0.78],
    [rx * 0.6, h * 0.95],
    [0, h + 0.02],
  ];
  const stripes = look.suit;
  const prof: LP[] = rows.map((row, i) => [row[0], row[1], stripes[Math.min(i, stripes.length - 1)]] as const);
  const torso = lathe(prof, b.s(10, 8));
  torso.scale(1, 1, look.rz / rx);
  b.put(torso, { bone: B.torso });
  // Arme: Oberarm, Unterarm, Hand – jeweils eigener Knochen.
  const segs = b.s(6, 5);
  b.put(limb(sp.armR, sp.upper, segs, b.detail === 0 ? 1 : 2), { bone: B.armLU, color: look.sleeve, mirror: B.armRU, outline: 0.8 });
  b.put(limb(sp.armR * 0.92, sp.fore, segs, 1), { bone: B.armLF, color: look.cuff, mirror: B.armRF, outline: 0.8 });
  b.put(sphere(sp.hand, sp.hand * 0.9, sp.hand, 6, b.s(5, 4)), {
    bone: B.handL,
    color: look.glove,
    pos: [0, sp.hand * 0.3, 0],
    mirror: B.handR,
    outline: 0.8,
  });
}

interface HelmetOpts {
  stripe?: number;
  stripeHalf?: number;
  rim?: number;
  ws?: number;
}

/**
 * Helmschale: Kugelkappe bis zum Winkel cut (vom Scheitel), um tilt nach
 * hinten gekippt, mit Wulst an der Kante und optionalem Mittelstreifen.
 */
function addHelmet(b: Builder, c: V3, r: V3, cut: number, tilt: number, color: number, o: HelmetOpts = {}): void {
  const ws = b.s(o.ws ?? 12, 8);
  const hs = b.s(5, 3);
  const rot: V3 = [tilt, 0, 0];
  b.put(new THREE.SphereGeometry(1, ws, hs, 0, TAU, 0, cut), { bone: B.head, color, pos: c, rot, scale: r });
  if (o.rim !== undefined) {
    const ring = new THREE.TorusGeometry(Math.sin(cut), 0.055, 3, ws);
    ring.rotateX(HALF_PI);
    ring.translate(0, Math.cos(cut), 0);
    b.put(ring, { bone: B.head, color: o.rim, pos: c, rot, scale: r, outline: 0 });
  }
  if (o.stripe !== undefined) {
    const half = o.stripeHalf ?? 0.2;
    const band = new THREE.SphereGeometry(1.014, b.s(8, 5), 1, Math.PI - cut, cut * 2, HALF_PI - half, half * 2);
    band.rotateZ(HALF_PI);
    b.put(band, { bone: B.head, color: o.stripe, pos: c, rot, scale: r, outline: 0 });
  }
}

/** Spitzes Ohr (Fuchs, Katze): flacher Kegel mit hellem Innenohr und dunkler Spitze. */
function addPointedEars(b: Builder, r: number, h: number, fur: number, inner: number, tip: number | null): void {
  const segs = b.s(6, 5);
  b.put(cone(r, h, segs), { bone: B.earL, color: fur, scale: [1, 1, 0.5], mirror: B.earR, outline: 0.9 });
  b.put(cone(r * 0.62, h * 0.66, 4), { bone: B.earL, color: inner, pos: [0, h * 0.04, r * 0.24], scale: [1, 1, 0.3], mirror: B.earR, outline: 0 });
  if (tip !== null) {
    const th = h * 0.4;
    b.put(cone((r * th) / h + 0.006, th + 0.006, segs), { bone: B.earL, color: tip, pos: [0, h - th, 0], scale: [1, 1, 0.56], mirror: B.earR, outline: 0 });
  }
}

/** Auspuffmündung: dunkles Loch am Rohrende. */
function addPipeHole(c: Ctx, r: number): void {
  const e = c.sp.exhaust;
  c.b.put(sphere(r, r, r * 0.35, 6, 3), {
    bone: B.chassis,
    color: 0x1c1920,
    pos: [e[0], e[1], e[2] + 0.004],
    rot: [-c.sp.exhaustUp, 0, 0],
    mirror: B.chassis,
    outline: 0,
  });
}

/** Scheinwerfer: Chromtopf mit hellem Glas nach vorn. */
function addLamp(c: Ctx, pos: V3, r: number): void {
  const b = c.b;
  b.put(sphere(r, r, r * 0.95, 6, b.s(5, 4)), { bone: B.chassis, color: CHROME, pos, mirror: B.chassis, outline: 0.75 });
  b.put(sphere(r * 0.76, r * 0.76, r * 0.36, 6, 3), { bone: B.chassis, color: 0xfff3b0, pos: [pos[0], pos[1], pos[2] + r * 0.72], mirror: B.chassis, outline: 0 });
}

// ───────────────────────────── 0: Kolben-Kalle ─────────────────────────────

function buildKalle(c: Ctx): void {
  const { b, sp } = c;
  const RED = sp.color;
  const RED_D = 0xc93b35;
  const CREAM = 0xffefd2;
  const LEATHER = 0x6a4230;
  const CH = B.chassis;

  // — Karosserie: gedrungene Wanne mit steilem Heckblech —
  const S = b.s4(16);
  const rr = (z: number, hw: number, ht: number, hb: number, cy = 0.4): Ring => sring(z, cy, hw, ht, hb, 3.2, S, 0.07);
  b.put(
    loft([rr(-1.0, 0.31, 0.165, 0.175, 0.415), rr(-0.92, 0.365, 0.205, 0.215, 0.41), rr(-0.66, 0.385, 0.22, 0.24), rr(-0.3, 0.39, 0.22, 0.25), rr(0.08, 0.37, 0.21, 0.25), rr(0.3, 0.32, 0.18, 0.23)], {
      color: (_j, k) => (k === S / 4 - 1 || k === S / 4 ? CREAM : RED),
      capColor: RED_D,
    }),
    { bone: CH },
  );
  // Sitzmulde und Lehne
  b.put(sphere(0.27, 0.035, 0.25, b.s(10, 8), 3), { bone: CH, color: 0x3a2a26, pos: [0, 0.612, -0.27], outline: 0 });
  b.put(pillow(0.5, 0.4, 0.12, 0.045, b.s4(8)), { bone: CH, color: LEATHER, pos: [0, 0.77, -0.6], rot: [-0.2, 0, 0] });
  // Kühlermaske mit Chromstreben
  const gs = b.s4(12);
  b.put(loft([sring(0.84, 0.42, 0.17, 0.2, 0.21, 3, gs), sring(0.93, 0.42, 0.2, 0.235, 0.23, 3, gs), sring(0.975, 0.42, 0.185, 0.22, 0.215, 3, gs)]), { bone: CH, color: RED });
  b.put(loft([sring(0.97, 0.42, 0.14, 0.17, 0.165, 3, gs), sring(0.99, 0.42, 0.125, 0.155, 0.15, 3, gs)], { capA: false }), { bone: CH, color: 0x3b3f4d, outline: 0 });
  if (b.detail > 0) for (let i = -1; i <= 1; i++) b.put(box(0.022, 0.3, 0.012), { bone: CH, color: CHROME, pos: [i * 0.065, 0.42, 0.992], outline: 0 });
  addLamp(c, [0.295, 0.5, 0.9], 0.08);
  // Rahmen und Vorderachse
  b.put(box(0.06, 0.07, 0.72), { bone: CH, color: DARK, pos: [0.19, 0.25, 0.62], mirror: CH, outline: 0.6 });
  addAxle(c, sp.wf, 0.03);

  // — freiliegender Motor (eigener Knochen: er zittert) —
  const EN = B.aux0;
  b.put(box(0.3, 0.22, 0.44), { bone: EN, color: STEEL });
  b.put(box(0.11, 0.08, 0.4), { bone: EN, color: CHROME, pos: [0.125, 0.13, 0], rot: [0, 0, -0.6], mirror: EN, outline: 0.7 });
  b.put(box(0.2, 0.12, 0.3), { bone: EN, color: CHROME, pos: [0, 0.2, 0], outline: 0.7 });
  // Lufthutze: Keil mit dunklem Schlund nach vorn
  const sc = (z: number, hw: number, h: number): Ring => ({ z, p: [hw, 0, hw, h * 0.7, hw * 0.7, h, -hw * 0.7, h, -hw, h * 0.7, -hw, 0] });
  b.put(loft([sc(-0.17, 0.07, 0.05), sc(-0.02, 0.115, 0.14), sc(0.16, 0.13, 0.17)], { flat: true, color: (_j, k) => (k === 2 ? CREAM : RED), capColor: 0x241f26 }), {
    bone: EN,
    pos: [0, 0.255, 0],
  });
  // Krümmer: drei Stummel je Seite
  for (let i = 0; i < 3; i++) {
    b.put(box(0.055, 0.24, 0.055), { bone: EN, color: CHROME, pos: [0.24, 0.02, -0.17 + i * 0.13], aim: [0.75, -0.4, -0.55], mirror: EN, outline: 0.6 });
  }

  // — Auspuff: zwei dicke Rohre aus dem Heckblech —
  b.put(sweep([[0.25, 0.3, -0.8], [0.25, 0.315, -0.96], [sp.exhaust[0], sp.exhaust[1], sp.exhaust[2]]], (t) => 0.058 + 0.03 * t * t, b.s(8, 6)), {
    bone: CH,
    color: CHROME,
    mirror: CH,
  });
  addPipeHole(c, 0.07);
  addNumber(c, [0, 0.455, -1.01], [-(HALF_PI - 0.1), 0, 0], 0.115, Math.PI);

  addWheels(c, { wall: TIRE, rim: CHROME, rim2: 0xb7c2d2, hub: RED });
  addSteering(c, 0x2b2530, CHROME);
  addDriverBody(c, { rx: 0.275, rz: 0.2, suit: [0x33456e], sleeve: 0x33456e, cuff: 0x9b6238, glove: 0x74472a });

  // — Kopf: Bär mit offener Halbschale —
  const H = B.head;
  const FUR = 0x9b6238;
  const FUR_D = 0x74472a;
  const TAN = 0xf3cf9c;
  const C: V3 = [0, 0.3, 0];
  const R: V3 = [0.33, 0.29, 0.3];
  b.put(sphere(R[0], R[1], R[2], b.s(12, 8), b.s(8, 6)), { bone: H, color: FUR, pos: C });
  // Schnauze und Nase
  b.put(sphere(0.165, 0.11, 0.13, b.s(8, 6), b.s(6, 4)), { bone: H, color: TAN, pos: [0, 0.225, 0.26], outline: 0.7 });
  b.put(sphere(0.068, 0.048, 0.045, 6, 4), { bone: H, color: 0x2b1d20, pos: [0, 0.285, 0.38], outline: 0 });
  // dunkler Mundraum hinter dem Kiefer
  b.put(sphere(0.14, 0.03, 0.11, 6, 3), { bone: H, color: 0x3a1418, pos: [0, 0.165, 0.25], outline: 0 });
  // kräftiger Unterkiefer mit zwei Hauern (klappt beim Jubeln auf)
  const J = B.aux1;
  const js = b.s4(8);
  b.put(loft([sring(-0.02, -0.035, 0.15, 0.05, 0.06, 3, js), sring(0.1, -0.03, 0.185, 0.055, 0.075, 3.4, js), sring(0.25, -0.02, 0.17, 0.05, 0.07, 3.4, js), sring(0.325, -0.015, 0.11, 0.035, 0.05, 3, js)], { capA: false }), {
    bone: J,
    color: FUR_D,
    outline: 0.8,
  });
  b.put(cone(0.03, 0.075, 4), { bone: J, color: WHITE, pos: [0.095, 0.015, 0.265], mirror: J, outline: 0.4 });
  // runde Ohren
  b.put(sphere(0.115, 0.115, 0.055, b.s(8, 6), b.s(5, 4)), { bone: B.earL, color: FUR, pos: [0, 0.07, 0], mirror: B.earR, outline: 0.9 });
  b.put(sphere(0.068, 0.068, 0.03, 6, 3), { bone: B.earL, color: TAN, pos: [0, 0.07, 0.04], mirror: B.earR, outline: 0 });
  // Augenbrauen: dicke Tuschebalken, innen tiefer → grimmig, aber gutmütig
  b.put(box(0.15, 0.042, 0.035), { bone: H, color: INK, pos: [0.135, 0.463, 0.24], rot: [-0.35, 0.42, 0.33], mirror: H, outline: 0 });
  // Halbschale mit Streifen und Kinnriemen
  addHelmet(b, C, [0.352, 0.312, 0.322], 1.02, -0.3, RED, { stripe: CREAM, stripeHalf: 0.17, rim: 0x2b2530 });
  if (b.detail > 0) b.put(box(0.03, 0.2, 0.012), { bone: H, color: 0x2b2530, pos: [0.305, 0.25, 0.085], rot: [0.25, 0, -0.16], mirror: H, outline: 0 });
  addEyes(c, { c: C, r: R, phi: 0.41, psi: 0.14, dphi: 0.27, dpsi: 0.3, tilt: 0 });
}

// ───────────────────────────── 1: Vera Vergaser ─────────────────────────────

function buildVera(c: Ctx): void {
  const { b, sp } = c;
  const TURQ = sp.color;
  const TURQ_D = 0x13968a;
  const CH = B.chassis;

  // — Karosserie: Zigarre mit spitzer Nase und Kopfstütze —
  const S = b.s4(16);
  const rr = (z: number, cy: number, hw: number, ht: number, hb: number): Ring => sring(z, cy, hw, ht, hb, 2.3, S, 0.055);
  const rings = [
    rr(-1.04, 0.47, 0.03, 0.03, 0.03),
    rr(-0.9, 0.46, 0.14, 0.13, 0.11),
    rr(-0.63, 0.44, 0.255, 0.27, 0.19),
    rr(-0.45, 0.42, 0.29, 0.24, 0.21),
    rr(-0.3, 0.41, 0.3, 0.19, 0.21),
    rr(0.1, 0.4, 0.29, 0.19, 0.2),
    rr(0.45, 0.385, 0.225, 0.155, 0.16),
    rr(0.78, 0.365, 0.135, 0.1, 0.1),
    rr(0.97, 0.355, 0.055, 0.045, 0.045),
    rr(1.06, 0.35, 0.012, 0.01, 0.01),
  ];
  b.put(loft(rings, { color: (j, k) => (j >= 7 || k === S / 4 - 1 || k === S / 4 ? WHITE : TURQ), capA: false, capB: false }), { bone: CH });
  b.put(sphere(0.215, 0.03, 0.2, b.s(10, 8), 3), { bone: CH, color: 0x2e2630, pos: [0, 0.598, -0.2], outline: 0 });
  b.put(pillow(0.34, 0.2, 0.08, 0.03, 8), { bone: CH, color: 0x6a4230, pos: [0, 0.71, -0.46], rot: [-0.25, 0, 0], outline: 0.8 });
  // kleine Windschutzscheibe
  const glass: number[] = [];
  for (let i = 0; i <= 5; i++) glass.push(Math.cos((i / 5) * Math.PI) * 0.19, Math.sin((i / 5) * Math.PI) * 0.13);
  b.put(prism(glass, 0.02), { bone: CH, color: 0xc6efff, pos: [0, 0.585, 0.13], rot: [-0.5, 0, 0], outline: 0.6 });
  // Heckflosse mit heller Kappe
  b.put(prism([-0.46, 0.6, -1.02, 0.5, -1.04, 0.97, -0.83, 0.97], 0.05), { bone: CH, color: TURQ_D, rot: [0, -HALF_PI, 0] });
  b.put(prism([-0.83, 0.97, -1.04, 0.97, -1.045, 1.07, -0.885, 1.07], 0.05), { bone: CH, color: WHITE, rot: [0, -HALF_PI, 0] });
  addNumber(c, [0.026, 0.8, -0.88], [0, 0, -HALF_PI], 0.115, HALF_PI);
  addNumber(c, [-0.026, 0.8, -0.88], [0, 0, HALF_PI], 0.115, -HALF_PI);
  addNumber(c, [0, 0.535, 0.5], [0.13, 0, 0], 0.105, 0);
  // Achsen und seitliche Auspuffrohre mit Trichter
  addAxle(c, sp.wf, 0.028);
  addAxle(c, sp.wr, 0.028);
  b.put(sweep([[0.275, 0.33, 0.28], [0.32, 0.335, -0.2], [sp.exhaust[0], sp.exhaust[1], sp.exhaust[2]]], (t) => 0.034 + 0.034 * Math.max(0, (t - 0.7) / 0.3), b.s(6, 5), 5), {
    bone: CH,
    color: CHROME,
    mirror: CH,
    outline: 0.8,
  });
  addPipeHole(c, 0.052);

  addWheels(c, { wall: TIRE, rim: WHITE, rim2: TURQ, hub: TURQ_D });
  addSteering(c, 0x4a332a, CHROME);
  addDriverBody(c, { rx: 0.2, rz: 0.15, suit: [0x8a5632], sleeve: 0x8a5632, cuff: 0x8a5632, glove: 0xf4dfb4 });

  // — Schal: Wulst um den Hals, ein breites Ende weht nach hinten —
  const SCARF = 0xfff6e4;
  const wrap = new THREE.TorusGeometry(0.115, 0.052, 5, b.s(10, 8));
  wrap.rotateX(HALF_PI);
  b.put(wrap, { bone: B.torso, color: SCARF, pos: [0, sp.torsoLen - 0.005, 0.01], scale: [1.1, 1, 1] });
  const len = 0.84;
  const strip: Ring[] = [];
  for (let i = 8; i >= 0; i--) {
    const w = 0.06 + 0.03 * Math.sin((i / 8) * Math.PI) + (i === 8 ? 0.012 : 0);
    strip.push({ z: (-i / 8) * len, p: [w, -0.016, w, 0.016, -w, 0.016, -w, -0.016] });
  }
  const zBase = sp.hip[2] + sp.chain[2];
  b.put(loft(strip, { flat: true, color: (j) => (j === 0 || j === 2 ? TURQ : SCARF) }), {
    bone: B.c0,
    outline: 0.8,
    skin: (_x, _y, z, out) => {
      // Vier Gelenke im Abstand von 0,21 m; an den Gelenken weich überblenden.
      const f = clamp(((zBase - z) / len) * 4, 0, 3.999);
      const i = Math.floor(f);
      const fr = f - i;
      const j = fr < 0.5 ? Math.max(i - 1, 0) : Math.min(i + 1, 3);
      const wj = i === j ? 0 : fr < 0.5 ? 0.5 - fr : fr - 0.5;
      out[0] = B.c0 + i;
      out[1] = 1 - wj;
      out[2] = B.c0 + j;
      out[3] = wj;
    },
  });

  // — Kopf: Füchsin mit Fliegerkappe —
  const H = B.head;
  const ORANGE = 0xf5822a;
  const CREAM = 0xfff3e0;
  const TIP = 0x3b2824;
  const C: V3 = [0, 0.28, 0];
  const R: V3 = [0.29, 0.265, 0.28];
  b.put(sphere(R[0], R[1], R[2], b.s(12, 8), b.s(8, 6)), { bone: H, color: ORANGE, pos: C });
  // helle Maske: Wangen und Kinn
  b.put(sphere(0.255, 0.15, 0.235, b.s(10, 8), b.s(6, 4)), { bone: H, color: CREAM, pos: [0, 0.165, 0.045], outline: 0.8 });
  b.put(cone(0.085, 0.21, b.s(6, 5)), { bone: H, color: CREAM, pos: [0.2, 0.15, 0.03], aim: [1, -0.3, -0.2], scale: [1, 1, 0.55], mirror: H, outline: 0.8 });
  // spitze Schnauze: oben fuchsrot, unten hell
  const SS = b.s4(8);
  const sn = (z: number, hw: number, ht: number, hb: number, cy: number): Ring => sring(z, cy, hw, ht, hb, 2, SS);
  b.put(loft([sn(0.14, 0.13, 0.095, 0.085, 0.215), sn(0.3, 0.095, 0.07, 0.06, 0.205), sn(0.42, 0.055, 0.042, 0.04, 0.2), sn(0.47, 0.03, 0.024, 0.024, 0.2)], { color: (_j, k) => (k < SS / 2 ? ORANGE : CREAM), capA: false }), {
    bone: H,
    outline: 0.7,
  });
  b.put(sphere(0.042, 0.036, 0.036, 6, 4), { bone: H, color: 0x2b1d20, pos: [0, 0.213, 0.475], outline: 0 });
  addPointedEars(b, 0.105, 0.3, ORANGE, CREAM, TIP);
  // feine Brauen
  b.put(box(0.1, 0.02, 0.026), { bone: H, color: INK, pos: [0.125, 0.425, 0.228], rot: [-0.4, 0.45, -0.22], mirror: H, outline: 0 });
  // Fliegerkappe mit Ohrenklappen
  const CAP_R: V3 = [0.306, 0.281, 0.296];
  addHelmet(b, C, CAP_R, 1.15, -0.38, TURQ, { rim: TURQ_D });
  b.put(sphere(0.055, 0.13, 0.1, 6, b.s(5, 4)), { bone: H, color: TURQ, pos: [0.272, 0.21, -0.03], mirror: H, outline: 0.8 });
  // Fliegerbrille auf der Stirn, Riemen um die Kappe
  const strap = new THREE.TorusGeometry(0.247, 0.016, 3, b.s(12, 8));
  b.put(strap, { bone: H, color: 0x4a332a, pos: [0, 0.4265, -0.0525], rot: [-1.876, 0, 0], scale: [1.075, 1, 1], outline: 0 });
  const gx = 0.082;
  const gPos: V3 = [gx, 0.508, 0.174];
  const gRot: V3 = [0.66, 0.38, 0];
  b.put(cyl(0.066, 0.074, 0.05, b.s(8, 6)), { bone: H, color: CREAM, pos: gPos, rot: gRot, order: 'YXZ', mirror: H, outline: 0.55 });
  b.put(cyl(0.048, 0.048, 0.058, b.s(8, 6)), { bone: H, color: 0x2b4a73, pos: gPos, rot: gRot, order: 'YXZ', mirror: H, outline: 0 });
  if (b.detail > 0) b.put(sphere(0.018, 0.006, 0.012, 4, 2), { bone: H, color: WHITE, pos: [gx + 0.018, 0.546, 0.19], rot: gRot, order: 'YXZ', mirror: H, outline: 0 });
  addEyes(c, { c: C, r: R, phi: 0.43, psi: 0.17, dphi: 0.26, dpsi: 0.27, tilt: 0.2 });
}

// ───────────────────────────── 2: Bremsen-Bert ─────────────────────────────

function buildBert(c: Ctx): void {
  const { b, sp } = c;
  const YEL = sp.color;
  const YEL_D = 0xe0a41c;
  const CREAM = 0xfff6e2;
  const INSIDE = 0x5a4a52;
  const CH = B.chassis;
  const E = 2.7;

  // — Wanne: stehend gespannt (Ringe von unten außen über den Rand nach innen) —
  const S = b.s4(20);
  const zc = -0.02;
  // Im Loft ist „oben“ (ht) das Heck und „unten“ (hb) der Bug.
  const tr = (y: number, hw: number, back: number, front: number): Ring => sring(y, -zc, hw, back, front, E, S);
  const tub = loft(
    [
      tr(0.16, 0.36, 0.68, 0.7),
      tr(0.23, 0.455, 0.83, 0.85),
      tr(0.38, 0.5, 0.9, 0.925),
      tr(0.53, 0.49, 0.9, 0.92),
      tr(0.585, 0.515, 0.93, 0.95),
      tr(0.635, 0.49, 0.905, 0.925),
      tr(0.6, 0.45, 0.865, 0.885),
      tr(0.5, 0.425, 0.84, 0.86),
    ],
    { color: (j) => (j === 0 ? YEL_D : j < 3 ? YEL : j < 6 ? CREAM : INSIDE), capColor: INSIDE },
  );
  b.put(tub, { bone: CH, rot: [-HALF_PI, 0, 0] });
  // Rückenlehne
  b.put(pillow(0.56, 0.3, 0.1, 0.04, 8), { bone: CH, color: 0x7a5a48, pos: [0, 0.66, -0.56], rot: [-0.22, 0, 0], outline: 0.8 });

  // — dicke Stoßstangen vorn und hinten —
  for (const dir of [1, -1]) {
    const pts: V3[] = [];
    const half = dir > 0 ? 0.925 : 0.9;
    for (let i = -3; i <= 3; i++) {
      const a = (i / 3) * 0.95;
      const cx = Math.sign(Math.sin(a)) * Math.pow(Math.abs(Math.sin(a)), 2 / E) * 0.58;
      const cz = Math.pow(Math.cos(a), 2 / E) * (half + 0.08);
      pts.push([cx, 0.3, zc + dir * cz]);
    }
    if (dir < 0) pts.reverse();
    b.put(sweep(pts, 0.062, b.s(6, 5)), { bone: CH, color: CHROME });
    b.put(box(0.09, 0.19, 0.08), { bone: CH, color: DARK, pos: [0.2, 0.3, zc + dir * (half + 0.085)], mirror: CH, outline: 0.7 });
  }
  // Scheinwerfer auf dem Wannenrand, Rücklichter
  addLamp(c, [0.25, 0.7, 0.74], 0.09);
  b.put(sphere(0.05, 0.05, 0.035, 6, 3), { bone: CH, color: 0xff7a3c, pos: [0.3, 0.57, -0.84], mirror: CH, outline: 0.6 });
  // Auspuffstummel
  b.put(cyl(0.055, 0.048, 0.2, b.s(8, 6)), { bone: CH, color: CHROME, pos: [sp.exhaust[0], sp.exhaust[1], sp.exhaust[2] + 0.1], rot: [HALF_PI - sp.exhaustUp, 0, 0], mirror: CH, outline: 0.8 });
  addPipeHole(c, 0.046);
  addAxle(c, sp.wf, 0.035);
  addAxle(c, sp.wr, 0.035);
  addNumber(c, [0, 0.43, -0.925], [-(HALF_PI - 0.1), 0, 0], 0.125, Math.PI);
  addNumber(c, [0, 0.43, 0.91], [HALF_PI - 0.1, 0, 0], 0.125, 0);

  addWheels(c, { wall: CREAM, rim: YEL, rim2: YEL_D, hub: CHROME });
  addSteering(c, 0x4a332a, CHROME);
  // gestreifter Badeanzug
  const NAVY = 0x2e4372;
  addDriverBody(c, { rx: 0.31, rz: 0.24, suit: [NAVY, NAVY, WHITE, NAVY, WHITE, NAVY, WHITE], sleeve: 0x8fa3c2, cuff: 0x8fa3c2, glove: 0x7389ab });

  // — Kopf: Walross mit Schnauzbart, Stoßzähnen und Schirmhelm —
  const H = B.head;
  const SKIN = 0x8fa3c2;
  const SKIN_D = 0x7389ab;
  const C: V3 = [0, 0.29, 0];
  const R: V3 = [0.35, 0.3, 0.31];
  b.put(sphere(R[0], R[1], R[2], b.s(12, 8), b.s(8, 6)), { bone: H, color: SKIN, pos: C });
  // Speckrolle im Nacken
  b.put(sphere(0.28, 0.085, 0.15, b.s(8, 6), 4), { bone: H, color: SKIN_D, pos: [0, 0.07, -0.19], outline: 0.8 });
  // Stoßzähne (hängen am Kopf), Schnauzbart-Polster (eigene Knochen: sie flattern)
  b.put(sweep([[0.09, 0.14, 0.3], [0.1, 0.01, 0.355], [0.115, -0.13, 0.375]], (t) => 0.046 - 0.03 * t, b.s(6, 5)), { bone: H, color: 0xfffbe6, mirror: H, outline: 0.7 });
  b.put(sphere(0.16, 0.12, 0.12, b.s(8, 6), b.s(6, 4)), { bone: B.aux0, color: CREAM, pos: [0.035, -0.035, 0.035], rot: [0, 0.25, -0.3], mirror: B.aux1, outline: 0.8 });
  b.put(sphere(0.075, 0.05, 0.045, 6, 4), { bone: H, color: 0x2b1d20, pos: [0, 0.262, 0.385], outline: 0 });
  // buschige Brauen
  b.put(sphere(0.075, 0.03, 0.035, 6, 3), { bone: H, color: CREAM, pos: [0.135, 0.468, 0.243], rot: [-0.3, 0.4, -0.3], mirror: H, outline: 0.45 });
  // Helm mit Schirm
  const HR: V3 = [0.372, 0.322, 0.332];
  addHelmet(b, C, HR, 0.92, -0.25, YEL, { stripe: WHITE, stripeHalf: 0.16, rim: YEL_D });
  b.put(sphere(0.215, 0.034, 0.17, b.s(8, 6), 4), { bone: H, color: YEL_D, pos: [0, 0.5, 0.295], rot: [0.3, 0, 0], outline: 0.8 });
  addEyes(c, { c: C, r: R, phi: 0.33, psi: 0.27, dphi: 0.22, dpsi: 0.23, tilt: -0.05 });
}

// ───────────────────────────── 3: Zünd-Zoe ─────────────────────────────

/** Blitz-Zickzack als Vieleck (Höhe etwa 1, Spitze unten). */
const BOLT: readonly number[] = [-0.04, 0.5, 0.24, 0.5, 0.07, 0.08, 0.26, 0.08, -0.16, -0.5, -0.03, -0.04, -0.22, -0.04];

function buildZoe(c: Ctx): void {
  const { b, sp } = c;
  const VIO = sp.color;
  const VIO_D = 0x6a55d4;
  const LEMON = 0xfff48a;
  const CH = B.chassis;

  // — Karosserie: kantiger Keil, bewusst mit harten Flächen —
  const wr = (z: number, hw: number, yt: number, yb: number, ch: number, sw: number): Ring => ({
    z,
    p: [hw, yb + ch, hw, yt - ch, hw - ch, yt, sw, yt, -sw, yt, -hw + ch, yt, -hw, yt - ch, -hw, yb + ch, -hw + ch, yb, hw - ch, yb],
  });
  b.put(
    loft([wr(-1.03, 0.39, 0.6, 0.27, 0.05, 0.1), wr(-0.95, 0.43, 0.66, 0.2, 0.06, 0.1), wr(-0.45, 0.43, 0.63, 0.16, 0.07, 0.1), wr(-0.05, 0.41, 0.57, 0.15, 0.07, 0.1), wr(0.55, 0.34, 0.41, 0.15, 0.06, 0.09), wr(0.95, 0.24, 0.275, 0.16, 0.04, 0.07), wr(1.05, 0.18, 0.225, 0.17, 0.02, 0.05)], {
      flat: true,
      color: (_j, k) => (k === 3 ? VIO_D : k === 1 || k === 5 ? 0xb3a4ff : VIO),
      capColor: VIO_D,
    }),
    { bone: CH },
  );
  // Frontlippe, Seitenkästen, Sitzmulde, Kopfstütze
  b.put(box(0.6, 0.035, 0.22), { bone: CH, color: DARK, pos: [0, 0.145, 0.97], outline: 0.7 });
  b.put(box(0.1, 0.16, 0.5), { bone: CH, color: VIO_D, pos: [0.43, 0.3, -0.02], rot: [0, 0.06, 0], mirror: CH, outline: 0.8 });
  b.put(sphere(0.24, 0.03, 0.22, b.s(10, 8), 3), { bone: CH, color: 0x2a2440, pos: [0, 0.604, -0.2], outline: 0 });
  b.put(box(0.36, 0.24, 0.09), { bone: CH, color: 0x3b2f66, pos: [0, 0.74, -0.46], rot: [-0.2, 0, 0], outline: 0.8 });
  // Blitz auf der Haube
  b.put(prism(BOLT, 0.016), { bone: CH, color: LEMON, pos: [0, 0.502, 0.24], rot: [-(HALF_PI - 0.262), 0, 0], scale: [0.5, 0.62, 1], outline: 0 });
  // eckige Auspuffblenden
  b.put(box(0.17, 0.12, 0.1), { bone: CH, color: CHROME, pos: [sp.exhaust[0], sp.exhaust[1], sp.exhaust[2] + 0.045], mirror: CH, outline: 0.7 });
  b.put(box(0.12, 0.075, 0.02), { bone: CH, color: 0x1c1920, pos: [sp.exhaust[0], sp.exhaust[1], sp.exhaust[2] - 0.008], mirror: CH, outline: 0 });
  addAxle(c, sp.wf, 0.03);
  addNumber(c, [0, 0.666, -0.875], [-0.05, 0, 0], 0.125, Math.PI);
  addNumber(c, [0, 0.3, 0.985], [0.86, 0, 0], 0.085, 0);

  // — Zündkerzen als Antennen (eigene Knochen: sie federn) —
  const plug: LP[] = [
    [0, 0, STEEL],
    [0.068, 0, STEEL, true],
    [0.068, 0.07, WHITE, true],
    [0.042, 0.08, WHITE],
    [0.056, 0.14, WHITE],
    [0.042, 0.17, WHITE],
    [0.034, 0.35, STEEL, true],
    [0.02, 0.36, STEEL],
    [0.02, 0.44, STEEL],
    [0, 0.45],
  ];
  b.put(lathe(plug, 6), { bone: B.aux0, mirror: B.aux1, outline: 0.7 });
  b.put(sphere(0.04, 0.04, 0.04, 6, 4), { bone: B.aux0, color: LEMON, pos: [0, 0.475, 0], mirror: B.aux1, outline: 0.55 });

  addWheels(c, { wall: TIRE, rim: VIO_D, rim2: LEMON, hub: WHITE });
  addSteering(c, 0x2a2440, LEMON);
  addDriverBody(c, { rx: 0.19, rz: 0.145, suit: [0x3b2f66], sleeve: 0x3b2f66, cuff: 0x3b2f66, glove: WHITE });

  // — Schwanz: Blitz-Zickzack, schräg gestellt – von hinten und von der Seite zu erkennen —
  const FUR = 0xfaf6ff;
  const tail: number[] = [0.0, 0.0, 0.1, 0.0, 0.23, 0.23, 0.11, 0.25, 0.3, 0.5, 0.16, 0.51, 0.36, 0.84, 0.03, 0.46, 0.16, 0.445, -0.04, 0.2, 0.09, 0.195];
  const y0 = sp.chain[1];
  b.put(prism(tail, 0.07), {
    bone: B.c0,
    color: FUR,
    pos: [-0.05, -0.04, 0],
    rot: [-0.18, 0.75, 0],
    order: 'YXZ',
    skin: (_x, y, _z, out) => {
      const f = clamp((y - y0) / 0.24, 0, 2.999);
      const i = Math.floor(f);
      const fr = f - i;
      const j = fr < 0.5 ? Math.max(i - 1, 0) : Math.min(i + 1, 2);
      const wj = i === j ? 0 : fr < 0.5 ? 0.5 - fr : fr - 0.5;
      out[0] = B.c0 + i;
      out[1] = 1 - wj;
      out[2] = B.c0 + j;
      out[3] = wj;
    },
  });

  // — Kopf: Katze, die Ohren ragen durch den Helm —
  const H = B.head;
  const PINK = 0xff9ec4;
  const C: V3 = [0, 0.28, 0];
  const R: V3 = [0.31, 0.27, 0.28];
  b.put(sphere(R[0], R[1], R[2], b.s(12, 8), b.s(8, 6)), { bone: H, color: FUR, pos: C });
  // Wangenfell
  b.put(cone(0.075, 0.16, b.s(6, 5)), { bone: H, color: FUR, pos: [0.24, 0.17, 0.05], aim: [1, -0.22, -0.1], scale: [1, 1, 0.55], mirror: H, outline: 0.8 });
  // Schnäuzchen, Nase, Mund
  b.put(sphere(0.062, 0.05, 0.05, 6, 4), { bone: H, color: WHITE, pos: [0.047, 0.165, 0.262], mirror: H, outline: 0.5 });
  b.put(sphere(0.028, 0.02, 0.02, 5, 3), { bone: H, color: PINK, pos: [0, 0.2, 0.305], outline: 0 });
  b.put(sphere(0.035, 0.022, 0.02, 5, 3), { bone: H, color: 0x7a3550, pos: [0, 0.133, 0.262], outline: 0 });
  // Schnurrhaare als Tuschestriche
  if (b.detail > 0) {
    for (const dy of [0.025, -0.02]) {
      b.put(box(0.17, 0.009, 0.009), { bone: H, color: INK, pos: [0.19, 0.165 + dy, 0.245], rot: [0, 0.5, dy * 9], mirror: H, outline: 0 });
    }
  }
  addPointedEars(b, 0.1, 0.24, FUR, PINK, null);
  // Helm mit Blitz am Hinterkopf
  const HR: V3 = [0.333, 0.292, 0.302];
  addHelmet(b, C, HR, 1.12, -0.32, VIO, { rim: VIO_D });
  b.put(prism(BOLT, 0.014), { bone: H, color: LEMON, pos: [0, 0.37, -0.287], rot: [0.3, Math.PI, 0], scale: [0.4, 0.3, 1], outline: 0 });
  addEyes(c, { c: C, r: R, phi: 0.4, psi: 0.1, dphi: 0.3, dpsi: 0.36, tilt: 0.06 });
}

const BUILDERS = [buildKalle, buildVera, buildBert, buildZoe];

// ───────────────────────────── Effekte ─────────────────────────────

/** Schutzring, Blitze und Qualm – ein Netz, sichtbar nur bei Bedarf. */
function buildFx(b: Builder, color: number): void {
  // Stoßfänger: verchromter Ring mit drei Gummipuffern in Spielerfarbe
  const ring = new THREE.TorusGeometry(1.2, 0.055, b.s(6, 5), b.s(28, 16));
  ring.rotateX(HALF_PI);
  b.put(ring, { bone: B.guard, color: CHROME });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU;
    const pos: V3 = [Math.sin(a) * 1.2, 0, Math.cos(a) * 1.2];
    b.put(pillow(0.42, 0.2, 0.16, 0.05, 8), { bone: B.guard, color, pos, rot: [0, a, 0] });
    b.put(box(0.3, 0.05, 0.02), { bone: B.guard, color: WHITE, pos: [Math.sin(a) * 1.285, 0, Math.cos(a) * 1.285], rot: [0, a, 0], outline: 0 });
  }
  // Kurzschluss: zwei Blitze …
  b.put(prism(BOLT, 0.035), { bone: B.bolt0, color: 0xfff06a, scale: 0.5, outline: 0.6 });
  b.put(prism(BOLT, 0.035), { bone: B.bolt1, color: 0xfff06a, scale: 0.42, outline: 0.6 });
  // … und zwei Qualmwölkchen
  for (const bone of [B.puff0, B.puff1]) {
    const dark = bone === B.puff1;
    b.put(sphere(0.15, 0.13, 0.14, b.s(7, 5), b.s(5, 4)), { bone, color: dark ? 0x8f8898 : 0xb5afbf, outline: 0.6 });
    b.put(sphere(0.11, 0.1, 0.11, b.s(7, 5), b.s(5, 4)), { bone, color: dark ? 0x9e97a8 : 0xc6c1ce, pos: [0.13, 0.05, 0.02], outline: 0.6 });
    b.put(sphere(0.1, 0.09, 0.1, b.s(7, 5), b.s(5, 4)), { bone, color: dark ? 0x8f8898 : 0xb5afbf, pos: [-0.12, 0.06, -0.03], outline: 0.6 });
  }
}

/** Auspuffflammen: zwei Tropfen entlang +z ihres Knochens, außen orange, innen hell. */
function buildFlames(b: Builder): void {
  const outer: LP[] = [
    [0, 0, 0xff8a1c],
    [0.1, 0.1, 0xff6a14],
    [0.085, 0.3, 0xf2380c],
    [0.04, 0.55, 0xb81c08],
    [0, 0.78],
  ];
  const inner: LP[] = [
    [0, 0.01, 0xfff0b0],
    [0.055, 0.1, 0xffd060],
    [0.04, 0.26, 0xff9a28],
    [0, 0.44],
  ];
  for (const bone of [B.flameL, B.flameR]) {
    const o = lathe(outer, b.s(8, 6));
    o.rotateX(HALF_PI);
    b.put(o, { bone });
    const i = lathe(inner, b.s(6, 5));
    i.rotateX(HALF_PI);
    b.put(i, { bone });
  }
}

// ───────────────────────────── KartVisual ─────────────────────────────

// Zwischenspeicher für update() – dort wird nichts neu angelegt.
const _sh = new THREE.Vector3();
const _hd = new THREE.Vector3();
const _el = new THREE.Vector3();
const _u = new THREE.Vector3();
const _w = new THREE.Vector3();
const _t = new THREE.Vector3();

export class KartVisual {
  /** Wurzel: Position/Ausrichtung setzt das Spiel. */
  readonly root = new THREE.Group();
  /** Punkte im Koordinatensystem von root für Effekte (Funken, Flammen, Staub). */
  readonly anchors = {
    wheelRearL: new THREE.Vector3(),
    wheelRearR: new THREE.Vector3(),
    wheelFrontL: new THREE.Vector3(),
    wheelFrontR: new THREE.Vector3(),
    exhaustL: new THREE.Vector3(),
    exhaustR: new THREE.Vector3(),
    head: new THREE.Vector3(),
  };

  private readonly slot: number;
  private readonly spec: Spec;
  private detail: KartDetail;
  private readonly bones: THREE.Bone[] = [];
  private readonly rest: THREE.Matrix4[] = [];
  private readonly restPos = new Float32Array(BONE_COUNT * 3);
  private readonly restRot = new Float32Array(BONE_COUNT * 3);
  private readonly skeleton: THREE.Skeleton;
  private readonly toon: THREE.MeshToonMaterial;
  private readonly flameMat: THREE.MeshBasicMaterial;
  private readonly decalMat: THREE.MeshBasicMaterial;
  private readonly atlas: THREE.CanvasTexture | null;
  private readonly body: THREE.SkinnedMesh;
  private readonly fx: THREE.SkinnedMesh;
  private readonly flames: THREE.SkinnedMesh;
  private readonly decals: THREE.SkinnedMesh;
  private bodyOutline: THREE.SkinnedMesh | null = null;
  private fxOutline: THREE.SkinnedMesh | null = null;
  private readonly geos: THREE.BufferGeometry[] = [];
  /** uv der Augen innerhalb ihrer Zelle (0..1) und ihre erste Ecke im Aufkleber-Netz. */
  private eyeUv = new Float32Array(0);
  private eyeStart = 0;
  private eyeState = -1;

  // Bewegungszustand
  private time = 0;
  private seed: number;
  private lastSpeed = 0;
  private accel = 0;
  private wheelF = 0;
  private wheelR = 0;
  private driftS = 0;
  private roll = 0;
  private rollV = 0;
  private pitch = 0;
  private pitchV = 0;
  private lean = 0;
  private headX = 0;
  private headXV = 0;
  private headZ = 0;
  private headZV = 0;
  private headY = 0;
  private boostS = 0;
  private airS = 0;
  private winS = 0;
  private loseS = 0;
  private stallS = 0;
  private spinS = 0;
  private offS = 0;
  private armsUp = 0;
  private flameS = 0;
  private sq = 0;
  private sqV = 0;
  private guardS = 0;
  private guardV = 0;
  private blinkT = 2;
  // Nachschwingen von Zubehör: straff (Ohren, Antennen) und weich (Schal, Schwanz)
  private swayX = 0;
  private swayXV = 0;
  private swayZ = 0;
  private swayZV = 0;
  private flopX = 0;
  private flopXV = 0;
  private flopZ = 0;
  private flopZV = 0;

  constructor(slot: number, detail: KartDetail = 2) {
    this.slot = ((Math.floor(slot) % 4) + 4) % 4;
    this.spec = SPECS[this.slot];
    this.detail = detail;
    this.seed = (this.slot + 1) * 7919;
    this.root.name = `kart-${this.slot}`;

    this.makeBones();
    this.skeleton = new THREE.Skeleton(this.bones);

    this.toon = toonMaterial({ vertexColors: true });
    this.flameMat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    });
    this.atlas = makeAtlas(this.slot);
    this.decalMat = new THREE.MeshBasicMaterial({ map: this.atlas, alphaTest: 0.5 });

    const empty = new THREE.BufferGeometry();
    const bind = new THREE.Matrix4();
    const mesh = (mat: THREE.Material, name: string): THREE.SkinnedMesh => {
      const m = new THREE.SkinnedMesh(empty, mat);
      m.name = name;
      m.matrixAutoUpdate = false;
      m.boundingSphere = BOUNDS.clone();
      m.bind(this.skeleton, bind);
      this.root.add(m);
      return m;
    };
    this.body = mesh(this.toon, 'kart');
    this.decals = mesh(this.decalMat, 'decals');
    this.fx = mesh(this.toon, 'fx');
    this.flames = mesh(this.flameMat, 'flames');
    this.fx.visible = false;
    this.flames.visible = false;
    this.flames.renderOrder = 2;
    empty.dispose();

    this.rebuild();
    this.placeAnchors(0, 0, 0);
  }

  /** Stauchen und Strecken auslösen: amount > 0 staucht (Landung, Treffer), < 0 streckt (Schubbeginn). */
  squash(amount: number): void {
    if (amount !== amount) return;
    this.sq = clamp(amount, -1, 1);
    this.sqV = 0;
  }

  setDetail(detail: KartDetail): void {
    if (detail === this.detail) return;
    this.detail = detail;
    this.rebuild();
  }

  dispose(): void {
    for (const g of this.geos) g.dispose();
    this.geos.length = 0;
    this.toon.dispose();
    this.flameMat.dispose();
    this.decalMat.dispose();
    this.atlas?.dispose();
    this.skeleton.dispose();
    this.root.removeFromParent();
    // Die Kontur-Materialien gehören toon.ts (dort geteilt) und bleiben bestehen.
  }

  // ── Aufbau ──

  private makeBones(): void {
    const sp = this.spec;
    for (let i = 0; i < BONE_COUNT; i++) this.bones.push(new THREE.Bone());
    const set = (i: number, parent: number, pos: V3, rot?: V3): void => {
      const bone = this.bones[i];
      bone.position.set(pos[0], pos[1], pos[2]);
      if (rot) bone.rotation.set(rot[0], rot[1], rot[2]);
      if (parent < 0) this.root.add(bone);
      else this.bones[parent].add(bone);
    };
    const sx = sp.shoulder[0];
    const sy = sp.hip[1] + sp.shoulder[1];
    const sz = sp.hip[2] + sp.shoulder[2];
    set(B.spin, -1, [0, 0, 0]);
    set(B.drift, B.spin, [0, 0, 0]);
    set(B.chassis, B.drift, [0, 0, 0]);
    set(B.wFL, B.drift, [sp.wf.x, sp.wf.r, sp.wf.z]);
    set(B.wFR, B.drift, [-sp.wf.x, sp.wf.r, sp.wf.z]);
    set(B.wRL, B.drift, [sp.wr.x, sp.wr.r, sp.wr.z]);
    set(B.wRR, B.drift, [-sp.wr.x, sp.wr.r, sp.wr.z]);
    set(B.steer, B.chassis, sp.steer, [Math.PI + sp.steerTilt, 0, 0]);
    set(B.torso, B.chassis, sp.hip);
    set(B.head, B.torso, [0, sp.torsoLen, 0.015]);
    set(B.earL, B.head, sp.ear, [0, 0, -sp.earTilt]);
    set(B.earR, B.head, [-sp.ear[0], sp.ear[1], sp.ear[2]], [0, 0, sp.earTilt]);
    // Arme hängen an der Karosserie und werden pro Bild zwischen Schulter und Hand gespannt.
    set(B.armLU, B.chassis, [sx, sy, sz]);
    set(B.armLF, B.chassis, [sx, sy + sp.upper, sz]);
    set(B.handL, B.chassis, [sx, sy + sp.upper + sp.fore, sz]);
    set(B.armRU, B.chassis, [-sx, sy, sz]);
    set(B.armRF, B.chassis, [-sx, sy + sp.upper, sz]);
    set(B.handR, B.chassis, [-sx, sy + sp.upper + sp.fore, sz]);
    set(B.c0, sp.chainParent, sp.chain);
    set(B.c1, B.c0, sp.chainStep);
    set(B.c2, B.c1, sp.chainStep);
    set(B.c3, B.c2, sp.chainStep);
    set(B.aux0, sp.auxParent, sp.aux);
    set(B.aux1, sp.aux1Parent, sp.aux1);
    const ex = sp.exhaust;
    set(B.flameL, B.chassis, ex, [Math.PI + sp.exhaustUp, 0, 0]);
    set(B.flameR, B.chassis, [-ex[0], ex[1], ex[2]], [Math.PI + sp.exhaustUp, 0, 0]);
    set(B.guard, B.spin, [0, 0.42, 0]);
    set(B.bolt0, B.spin, [0.6, 0.8, 0]);
    set(B.bolt1, B.spin, [-0.6, 0.8, 0]);
    set(B.puff0, B.spin, sp.smoke);
    set(B.puff1, B.spin, sp.smoke);
    this.bones[B.wFL].rotation.order = 'YXZ';
    this.bones[B.wFR].rotation.order = 'YXZ';

    this.root.updateMatrixWorld(true);
    for (let i = 0; i < BONE_COUNT; i++) {
      const bone = this.bones[i];
      this.rest.push(bone.matrixWorld.clone());
      this.restPos[i * 3] = bone.position.x;
      this.restPos[i * 3 + 1] = bone.position.y;
      this.restPos[i * 3 + 2] = bone.position.z;
      this.restRot[i * 3] = bone.rotation.x;
      this.restRot[i * 3 + 1] = bone.rotation.y;
      this.restRot[i * 3 + 2] = bone.rotation.z;
    }
  }

  /** Baut alle Netze für die aktuelle Detailstufe neu. */
  private rebuild(): void {
    for (const g of this.geos) g.dispose();
    this.geos.length = 0;
    const lines = this.detail > 0;
    const main = new Builder(this.rest, this.detail, lines);
    const decal = new Builder(this.rest, this.detail, false, true);
    const ctx: Ctx = { b: main, d: decal, sp: this.spec, slot: this.slot, eyeStart: 0 };
    BUILDERS[this.slot](ctx);
    const fx = new Builder(this.rest, this.detail, lines);
    buildFx(fx, this.spec.color);
    const fl = new Builder(this.rest, this.detail, false);
    buildFlames(fl);

    const mainGeo = main.finish();
    const fxGeo = fx.finish();
    const decalGeo = decal.finish().main;
    const flameGeo = fl.finish().main;
    this.geos.push(mainGeo.main, fxGeo.main, decalGeo, flameGeo);
    this.body.geometry = mainGeo.main;
    this.fx.geometry = fxGeo.main;
    this.decals.geometry = decalGeo;
    this.flames.geometry = flameGeo;
    this.decals.visible = this.atlas !== null;

    this.bodyOutline = this.swapOutline(this.body, this.bodyOutline, mainGeo.outline);
    this.fxOutline = this.swapOutline(this.fx, this.fxOutline, fxGeo.outline);

    // uv der Augen innerhalb ihrer Zelle merken (setEyes rechnet daraus die Zelle im Bild aus).
    const n = this.detail === 0 ? 2 : 4;
    const eyeVerts = (n + 1) * (n + 1) * 2;
    const uv = decalGeo.getAttribute('uv');
    this.eyeStart = ctx.eyeStart;
    this.eyeUv = new Float32Array(eyeVerts * 2);
    for (let i = 0; i < eyeVerts; i++) {
      this.eyeUv[i * 2] = uv.getX(this.eyeStart + i);
      this.eyeUv[i * 2 + 1] = uv.getY(this.eyeStart + i);
    }
    const state = this.eyeState < 0 ? EYE.OPEN : this.eyeState;
    this.eyeState = -1;
    this.setEyes(state);
  }

  private swapOutline(mesh: THREE.SkinnedMesh, old: THREE.SkinnedMesh | null, geo: THREE.BufferGeometry | null): THREE.SkinnedMesh | null {
    if (!geo) {
      // Ohne Kontur ganz aus dem Baum nehmen, damit sie niemand versehentlich einblendet.
      if (old) mesh.remove(old);
      return null;
    }
    this.geos.push(geo);
    if (old) {
      old.geometry = geo;
      if (old.parent !== mesh) mesh.add(old);
      return old;
    }
    const outline = withSkinnedOutline(mesh, geo);
    outline.boundingSphere = BOUNDS.clone();
    return outline;
  }

  private setEyes(state: number): void {
    if (state === this.eyeState) return;
    this.eyeState = state;
    const attr = this.decals.geometry.getAttribute('uv') as THREE.BufferAttribute | undefined;
    if (!attr) return;
    const arr = attr.array as Float32Array;
    const col = state % ATLAS_COLS;
    const row = Math.floor(state / ATLAS_COLS);
    const src = this.eyeUv;
    const o = this.eyeStart * 2;
    for (let i = 0; i < src.length; i += 2) {
      arr[o + i] = (col + src[i]) / ATLAS_COLS;
      arr[o + i + 1] = 1 - (row + 1 - src[i + 1]) / ATLAS_ROWS;
    }
    attr.needsUpdate = true;
  }

  // ── Bewegung ──

  /** Pro Bild: Räder drehen/einschlagen, Karosserie neigt sich, Figur lebt. */
  update(dtSec: number, pose: KartPose): void {
    const dt = dtSec > 0 ? Math.min(dtSec, 0.05) : 0;
    const sp = this.spec;
    const bn = this.bones;
    const rp = this.restPos;
    const rr = this.restRot;
    this.time += dt;
    const t = this.time;

    // — Eingaben (NaN abfangen) —
    const speed = pose.speed === pose.speed ? pose.speed : 0;
    const steer = clamp(pose.steer === pose.steer ? pose.steer : 0, -1, 1);
    const drift = pose.driftDir > 0 ? 1 : pose.driftDir < 0 ? -1 : 0;
    const stage = clamp(pose.driftStage === pose.driftStage ? pose.driftStage : 0, 0, 3);
    const spin = clamp(pose.spin === pose.spin ? pose.spin : 0, 0, 1);
    const v = Math.min(Math.abs(speed) / 26, 1.35);
    const v1 = Math.min(v, 1);
    const wind = v1 * v1 * (3 - 2 * v1);

    // — geglättete Größen —
    if (dt > 0) this.accel = damp(this.accel, clamp((speed - this.lastSpeed) / dt, -45, 45), 7, dt);
    this.lastSpeed = speed;
    const acc = this.accel;
    this.boostS = damp(this.boostS, pose.boost ? 1 : 0, 9, dt);
    this.airS = damp(this.airS, pose.air ? 1 : 0, 10, dt);
    this.winS = damp(this.winS, pose.emote === 'win' ? 1 : 0, 8, dt);
    this.loseS = damp(this.loseS, pose.emote === 'lose' ? 1 : 0, 5, dt);
    this.stallS = damp(this.stallS, pose.stall ? 1 : 0, 10, dt);
    this.spinS = damp(this.spinS, spin > 0 ? 1 : 0, 12, dt);
    this.offS = damp(this.offS, pose.offroad ? 1 : 0, 8, dt);
    this.driftS = damp(this.driftS, drift, 9, dt);
    const { boostS, airS, winS, loseS, stallS, spinS, offS, driftS } = this;
    const idle = (1 - 0.7 * v1) * (1 - stallS);

    // Nachschwingen: seitlich (Kurve) und längs (Beschleunigung)
    const latT = -(steer * v1 + driftS * 0.5);
    const lonT = clamp(-acc * 0.02, -0.5, 0.5);
    this.swayXV += ((latT - this.swayX) * 150 - this.swayXV * 9) * dt;
    this.swayX += this.swayXV * dt;
    this.swayZV += ((lonT - this.swayZ) * 150 - this.swayZV * 9) * dt;
    this.swayZ += this.swayZV * dt;
    this.flopXV += ((latT - this.flopX) * 46 - this.flopXV * 4.5) * dt;
    this.flopX += this.flopXV * dt;
    this.flopZV += ((lonT - this.flopZ) * 46 - this.flopZV * 4.5) * dt;
    this.flopZ += this.flopZV * dt;
    const { swayX, swayZ, flopX, flopZ } = this;

    // — Räder —
    this.wheelF += (speed * dt) / sp.wf.r;
    this.wheelR += (speed * dt) / sp.wr.r;
    if (Math.abs(this.wheelF) > 6000) this.wheelF %= TAU;
    if (Math.abs(this.wheelR) > 6000) this.wheelR %= TAU;
    const yawF = -steer * 0.5 + driftS * 0.26;
    const bulge = 1 + Math.max(this.sq, 0) * 0.3;
    const hang = airS * 0.035;
    const rough = offS * v1;
    for (let i = 0; i < 4; i++) {
      const w = bn[B.wFL + i];
      const front = i < 2;
      w.rotation.set(front ? this.wheelF : this.wheelR, front ? yawF : 0, rough * 0.06 * Math.sin(t * 43 + i * 1.9));
      w.position.y = rp[(B.wFL + i) * 3 + 1] - hang + rough * 0.018 * Math.abs(Math.sin(t * 31 + i * 2.3));
      w.scale.x = bulge;
    }

    // — Schleudern, Hüpfen, Drift —
    const e = 1 - spin;
    const spinYaw = spin > 0 ? TAU * 2 * (1 - e * e * e) : 0;
    const hopPhase = t * 8.5;
    const hop = winS * Math.max(0, Math.sin(hopPhase));
    bn[B.spin].rotation.y = spinYaw;
    const driftYaw = -driftS * (0.31 + 0.04 * stage);
    const pivot = 0.3;
    const dr = bn[B.drift];
    dr.rotation.y = driftYaw;
    dr.position.set(-pivot * Math.sin(driftYaw), 0, pivot - pivot * Math.cos(driftYaw));

    // — Karosserie: rollen, nicken, zittern, stauchen —
    const rollT = -steer * v1 * 0.075 - driftS * 0.11 + (spin > 0 ? Math.sin(spinYaw) * 0.1 : 0);
    const pitchT = clamp(-acc * 0.0035, -0.08, 0.09) - boostS * 0.07 + airS * 0.05 + stallS * 0.03;
    this.rollV += ((rollT - this.roll) * 140 - this.rollV * 13) * dt;
    this.roll += this.rollV * dt;
    this.pitchV += ((pitchT - this.pitch) * 140 - this.pitchV * 13) * dt;
    this.pitch += this.pitchV * dt;
    this.sqV += (-this.sq * 190 - this.sqV * 8.5) * dt;
    this.sq += this.sqV * dt;
    const sq = clamp(this.sq + winS * 0.1 * Math.cos(hopPhase), -1, 1);
    const sy = sq > 0 ? 1 - 0.36 * sq : 1 - 0.28 * sq;
    const sxz = 1 / Math.sqrt(sy);
    const cough = stallS * Math.pow(Math.max(0, Math.sin(t * 13)), 8);
    const ch = bn[B.chassis];
    ch.scale.set(sxz, sy, sxz);
    ch.position.y =
      Math.sin(t * 61) * 0.0035 * idle + cough * 0.012 + hop * 0.07 + airS * 0.03 + rough * 0.02 * Math.sin(t * 33) * Math.sin(t * 21 + 1);
    ch.rotation.set(
      this.pitch + rough * 0.02 * Math.sin(t * 27),
      0,
      this.roll + Math.sin(t * 47 + 2) * 0.006 * idle + cough * 0.03 * Math.sin(t * 90) + rough * 0.025 * Math.sin(t * 19 + 2),
    );

    // — Oberkörper —
    this.lean = damp(this.lean, steer * 0.2 * (0.3 + 0.7 * v1) + driftS * 0.22, 8, dt);
    const lean = this.lean;
    const torso = bn[B.torso];
    torso.rotation.set(-boostS * 0.16 + clamp(-acc * 0.004, -0.1, 0.12) + loseS * 0.26 - winS * 0.08 - airS * 0.06, 0, lean);
    torso.position.y = rp[B.torso * 3 + 1] + hop * 0.04;
    torso.updateMatrix();

    // — Kopf: federt nach, schaut in die Kurve —
    const hxT =
      -boostS * 0.3 + loseS * 0.55 - winS * 0.2 - airS * 0.14 + clamp(-acc * 0.006, -0.12, 0.15) + stallS * 0.08 + Math.sin(t * 2.1) * 0.02;
    const hzT = lean * 0.7 + stallS * 0.1 * Math.sin(t * 7) + spinS * 0.22 * Math.sin(t * 14);
    this.headXV += ((hxT - this.headX) * 110 - this.headXV * 9) * dt;
    this.headX += this.headXV * dt;
    this.headZV += ((hzT - this.headZ) * 110 - this.headZV * 9) * dt;
    this.headZ += this.headZV * dt;
    const hyT = (-steer * 0.32 - driftS * 0.3) * (1 - spinS) + stallS * 0.28 * Math.sin(t * 9.5) + loseS * 0.1 * Math.sin(t * 1.3);
    this.headY = damp(this.headY, hyT, 10, dt);
    bn[B.head].rotation.set(this.headX, this.headY, this.headZ);

    // — Ohren —
    const twitch = Math.pow(Math.max(0, Math.sin(t * 1.7 + this.slot * 2)), 24);
    const earBack = -0.32 * wind + swayZ * 0.5 - airS * 0.15;
    const earOut = sp.earTilt + loseS * 0.55 + stallS * 0.3 - winS * 0.1;
    bn[B.earL].rotation.set(earBack, 0, -earOut + swayX * 0.25 - twitch * 0.22);
    bn[B.earR].rotation.set(earBack, 0, earOut + swayX * 0.25);

    // — Figur-eigenes Zubehör —
    switch (this.slot) {
      case 0: {
        // Motor zittert, Kiefer klappt auf
        const en = bn[B.aux0];
        const shake = 0.35 + idle * 0.65 + boostS * 0.8;
        en.position.y = rp[B.aux0 * 3 + 1] + Math.sin(t * 58) * 0.006 * shake + cough * 0.02;
        en.rotation.z = Math.sin(t * 58 + 1) * 0.022 * shake + cough * 0.06 * Math.sin(t * 80);
        const open = Math.max(winS * (0.55 + 0.45 * Math.sin(t * 17)), stallS * 0.75, airS * 0.6, spinS * 0.7);
        bn[B.aux1].rotation.x = open * 0.42;
        break;
      }
      case 1: {
        // Schal: hängt im Stand, weht bei Tempo waagrecht und flattert
        for (let i = 0; i < 4; i++) {
          const wave = Math.sin(t * (8 + 10 * wind) - i * 1.15);
          const hangX = (i === 0 ? -0.5 : -0.2) * (1 - wind);
          const rx = (i === 0 ? 0.14 + airS * 0.2 : 0) + hangX + wave * (0.05 + 0.26 * wind) * (i === 0 ? 0.5 : 1) + flopZ * 0.12;
          const ry = (i === 0 ? -0.2 : 0) + flopX * (i === 0 ? 0.3 : 0.12) + Math.sin(t * (6 + 7 * wind) - i * 0.9 + 1.7) * 0.16 * wind;
          bn[B.c0 + i].rotation.set(rx, ry, wave * 0.35 * wind);
        }
        break;
      }
      case 2: {
        // Schnauzbart flattert im Fahrtwind
        for (let i = 0; i < 2; i++) {
          const m = bn[B.aux0 + i];
          const side = i === 0 ? 1 : -1;
          const flutter = Math.sin(t * 21 + i * 2.1) * 0.07 * wind;
          m.rotation.set(flutter - loseS * 0.12, side * (-0.32 * wind + swayZ * 0.5) + flutter, side * (-loseS * 0.3 + winS * 0.2) + swayX * 0.2);
        }
        break;
      }
      default: {
        // Schwanz: schwingt gemächlich, peitscht in Kurven; Antennen federn
        for (let i = 0; i < 3; i++) {
          const swish = Math.sin(t * 2.6 - i * 0.8) * 0.13 * (1 - 0.5 * wind) + Math.sin(t * 15 - i) * 0.05 * wind;
          bn[B.c0 + i].rotation.set(
            (i === 0 ? -0.22 : -0.1) * wind + flopZ * 0.2 + loseS * (i === 0 ? -0.3 : -0.16) + spinS * 0.15 * Math.sin(t * 20 + i),
            0,
            swish + flopX * 0.14 + stallS * 0.2 * Math.sin(t * 30 + i * 2),
          );
        }
        for (let i = 0; i < 2; i++) {
          const side = i === 0 ? 1 : -1;
          bn[B.aux0 + i].rotation.set(-0.2 - 0.3 * wind + swayZ * 0.9 + stallS * 0.1 * Math.sin(t * 40 + i), 0, -side * 0.3 + swayX * 0.6);
        }
      }
    }

    // — Lenkrad und Arme —
    const st = bn[B.steer];
    const wheelAngle = -steer * 1.15 + driftS * 0.35;
    st.rotation.set(rr[B.steer * 3], 0, wheelAngle);
    st.updateMatrix();
    const upT = pose.air || pose.emote === 'win' ? 1 : pose.stall ? 0.5 : 0;
    this.armsUp = damp(this.armsUp, upT, 10, dt);
    this.solveArm(1, t);
    this.solveArm(-1, t);

    // — Flammen —
    this.flameS = damp(this.flameS, pose.boost ? 1 : 0, pose.boost ? 18 : 11, dt);
    const fs = this.flameS;
    this.flames.visible = fs > 0.03;
    for (let i = 0; i < 2; i++) {
      const flick = 0.85 + 0.22 * Math.sin(t * 71 + i * 2) + 0.12 * Math.sin(t * 173 + i);
      const wide = fs * (0.92 + 0.16 * Math.sin(t * 53 + i * 1.3));
      bn[B.flameL + i].scale.set(wide, wide, fs * flick * (1 + 0.25 * v));
    }

    // — Schutzring: ploppt auf, kreist —
    this.guardV += (((pose.guard ? 1 : 0) - this.guardS) * 260 - this.guardV * 15) * dt;
    this.guardS = Math.max(0, this.guardS + this.guardV * dt);
    const gs = this.guardS > 0.004 ? this.guardS : 0;
    const gd = bn[B.guard];
    gd.scale.setScalar(gs);
    gd.rotation.set(Math.sin(t * 2.1) * 0.1, t * 3.4, Math.cos(t * 1.7) * 0.1);
    gd.position.y = rp[B.guard * 3 + 1] + Math.sin(t * 3) * 0.03;

    // — Kurzschluss: Blitze zucken, Qualm steigt —
    for (let i = 0; i < 2; i++) {
      const ft = t * 11 + i * 0.5;
      const tick = Math.floor(ft);
      const r1 = hash(tick + i * 37.1);
      const r2 = hash(tick * 1.7 + i * 11.3 + 5);
      const r3 = hash(tick * 2.3 + i * 3.7 + 9);
      const on = ft - tick < 0.62 ? 1 : 0;
      const a = r1 * TAU;
      const rad = 0.5 + 0.4 * r2;
      const bo = bn[B.bolt0 + i];
      bo.position.set(Math.cos(a) * rad, 0.45 + 0.75 * r3, Math.sin(a) * rad);
      bo.rotation.set(0, HALF_PI - a, (r2 - 0.5) * 1.6);
      bo.scale.setScalar(stallS > 0.02 ? stallS * on * (0.8 + 0.6 * r3) : 0);
      const p = t * 0.85 + i * 0.5;
      const life = p - Math.floor(p);
      const pf = bn[B.puff0 + i];
      pf.position.set(sp.smoke[0] + (i === 0 ? 0.14 : -0.14) * life + Math.sin(t * 3 + i) * 0.03, sp.smoke[1] + life * 0.8, sp.smoke[2] - life * 0.3);
      pf.rotation.y = life * 2 + i;
      const grow = (0.45 + 0.8 * life) * Math.min(1, (1 - life) * 5) * Math.min(1, life * 8);
      pf.scale.setScalar(stallS > 0.02 ? stallS * grow : 0);
    }
    this.fx.visible = gs > 0 || stallS > 0.02;

    // — Augen —
    let eye: number = EYE.OPEN;
    if (spin > 0) eye = EYE.DIZZY;
    else if (pose.stall) eye = EYE.STUN;
    else if (pose.emote === 'win') eye = EYE.HAPPY;
    else if (pose.emote === 'lose') eye = EYE.SAD;
    else if (pose.boost) eye = EYE.FIERCE;
    else if (pose.air) eye = EYE.WOW;
    else {
      this.blinkT -= dt;
      if (this.blinkT < 0.11) eye = EYE.BLINK;
      if (this.blinkT < 0) {
        this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
        this.blinkT = 2 + (this.seed / 4294967296) * 3.2;
      }
    }
    this.setEyes(eye);

    this.placeAnchors(spinYaw, driftYaw, pivot);
  }

  /**
   * Spannt einen Arm zwischen Schulter und Ziel (Hand am Lenkrad oder oben):
   * Ellbogen aus den beiden Armlängen, Knochen passend gedreht und gestreckt.
   */
  private solveArm(side: number, t: number): void {
    const sp = this.spec;
    const bn = this.bones;
    const torso = bn[B.torso];
    const upper = bn[side > 0 ? B.armLU : B.armRU];
    const fore = bn[side > 0 ? B.armLF : B.armRF];
    const hand = bn[side > 0 ? B.handL : B.handR];
    // Schulter im Raum der Karosserie
    _sh.set(side * sp.shoulder[0], sp.shoulder[1], sp.shoulder[2]).applyMatrix4(torso.matrix);
    // Ziel: Griff am Lenkrad …
    _hd.set(side * sp.steerR * 0.82, -sp.steerR * 0.5, 0.03).applyMatrix4(bn[B.steer].matrix);
    // … oder hochgerissen (Luft, Jubel) – beim Jubeln winkend
    const up = this.armsUp;
    if (up > 0.001) {
      const wave = this.winS * Math.sin(t * 11 + side);
      _t.set(side * (sp.shoulder[0] + 0.16 + 0.07 * wave), sp.shoulder[1] + 0.36 + 0.03 * this.winS * Math.cos(t * 11), sp.shoulder[2] + 0.1).applyMatrix4(torso.matrix);
      _hd.lerp(_t, up);
    }
    _u.subVectors(_hd, _sh);
    let d = _u.length();
    if (d < 1e-4) {
      _u.set(0, 0, 1);
      d = 1e-4;
    } else {
      _u.multiplyScalar(1 / d);
    }
    const reach = (sp.upper + sp.fore) * 0.995;
    const k = d > reach ? d / reach : 1; // zu weit weg: Arm wird gestreckt
    const l1 = sp.upper * k;
    const l2 = sp.fore * k;
    const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(l1 * l1 - a * a, 0));
    // Ellbogen knickt nach außen-unten
    _w.set(side * 0.8, -0.55, -0.25);
    _w.addScaledVector(_u, -_w.dot(_u));
    if (_w.lengthSq() < 1e-8) _w.set(side, 0, 0);
    _w.normalize();
    _el.copy(_sh).addScaledVector(_u, a).addScaledVector(_w, h);

    upper.position.copy(_sh);
    _t.subVectors(_el, _sh);
    let len = _t.length();
    if (len < 1e-5) {
      _t.set(0, 1, 0);
      len = 1e-5;
    } else {
      _t.multiplyScalar(1 / len);
    }
    upper.quaternion.setFromUnitVectors(Y_AXIS, _t);
    upper.scale.set(1, len / sp.upper, 1);

    fore.position.copy(_el);
    _t.subVectors(_hd, _el);
    len = _t.length();
    if (len < 1e-5) {
      _t.set(0, 1, 0);
      len = 1e-5;
    } else {
      _t.multiplyScalar(1 / len);
    }
    fore.quaternion.setFromUnitVectors(Y_AXIS, _t);
    fore.scale.set(1, len / sp.fore, 1);
    hand.position.copy(_hd);
    hand.quaternion.copy(fore.quaternion);
  }

  /** Effekt-Punkte nachführen: sie drehen sich mit Drift und Schleudern mit. */
  private placeAnchors(spinYaw: number, driftYaw: number, pivot: number): void {
    const sp = this.spec;
    const a = this.anchors;
    const cd = Math.cos(driftYaw);
    const sd = Math.sin(driftYaw);
    const cs = Math.cos(spinYaw);
    const ss = Math.sin(spinYaw);
    const put = (out: THREE.Vector3, x: number, y: number, z: number): void => {
      const dz = z - pivot;
      const x1 = x * cd + dz * sd;
      const z1 = -x * sd + dz * cd + pivot;
      out.set(x1 * cs + z1 * ss, y, -x1 * ss + z1 * cs);
    };
    put(a.wheelRearL, sp.wr.x, 0, sp.wr.z);
    put(a.wheelRearR, -sp.wr.x, 0, sp.wr.z);
    put(a.wheelFrontL, sp.wf.x, 0, sp.wf.z);
    put(a.wheelFrontR, -sp.wf.x, 0, sp.wf.z);
    put(a.exhaustL, sp.exhaust[0], sp.exhaust[1], sp.exhaust[2]);
    put(a.exhaustR, -sp.exhaust[0], sp.exhaust[1], sp.exhaust[2]);
    put(a.head, 0, sp.hip[1] + sp.torsoLen + 0.3, sp.hip[2]);
  }
}
