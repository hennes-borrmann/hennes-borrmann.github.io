// Die vier Karts samt Fahrerfiguren – vollständig prozedural, ohne fremde
// Modelle oder Bilder.
//
// Aufbau: Jedes Kart ist EIN Netz mit Vertexfarben, das an einem kleinen
// Skelett hängt (THREE.SkinnedMesh). Räder, Lenkrad, Kopf, Arme, Ohren, Schal
// und Schwanz sind Knochen – so bewegt sich alles einzeln und kostet trotzdem
// nur einen Zeichenaufruf fürs Netz und einen für die Tuschekontur. Dazu
// kommt ein Aufruf für die Aufkleber (Augen, Ziffer der Startnummer) und – nur
// solange sichtbar – je einer für die Flammen sowie zwei für die Effekte
// (Schutzring, Blitze, Qualm samt Kontur). Macht 3 Aufrufe im Normalfall,
// höchstens 6. Items kommen nur bei Bedarf dazu: der Gegenstand in der Hand
// (2 Aufrufe samt Kontur) und im Drachenzug Drache (2) und Leine (1).
//
// Die Kontur ist eine umgestülpte Hülle (siehe toon.ts). Ihr Netz enthält nur
// die Teile, die eine Linie bekommen sollen; die Dicke steckt je Ecke in der
// Länge von "onormal" – so bleiben kleine Teile fein und nichts verklumpt.
//
// Koordinaten: y oben, das Kart schaut nach +z, die Räder stehen auf y = 0.
// „Links“ ist +x, „rechts“ −x.

import * as THREE from 'three';
import { INK, outlineMaterial, rgb, toonMaterial, withSkinnedOutline } from './toon';

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
  /** Item in der Hand: 0 = keins, sonst 1..9 (Nummern wie in game/sim.ts). */
  held: number;
  /** Der Abschleppdrache zieht gerade. */
  tow: boolean;
  /** Gleitflug über einer Flugstrecke: die Flügel sind ausgeklappt. */
  glide: boolean;
  /** Unter Wasser (Tauchstrecke). */
  dive: boolean;
  /** Im luftleeren Raum (Mondbasis): Raumhelm und Steuerdüsen. */
  space: boolean;
}

/** 0 niedrig (ohne Konturen, weniger Segmente), 1 mittel, 2 hoch. */
export type KartDetail = 0 | 1 | 2;

/** Name der Figur (Index = character), z. B. für die Lobby. */
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
  wingL: 31, // Gleitflügel: Gelenk an der Karosserie …
  wingR: 32,
  tipL: 33, // … und Außenteil (federt im Flug)
  tipR: 34,
  wtail: 35, // Leitwerk bzw. Propeller am Heck
  dHead: 36, // Tauchausrüstung am Kopf (Maske, Brille, Kuppel)
  dBody: 37, // … an der Karosserie (Schraubenhalter, Flossen, Außenborder)
  dPropL: 38, // Schiffsschrauben (dreht sich unter Wasser)
  dPropR: 39,
  bub0: 40, // drei aufsteigende Blasen
  bub1: 41,
  bub2: 42,
  jetL: 43, // Blasenstrahl statt Auspuffflamme
  jetR: 44,
} as const;
const BONE_COUNT = 45;

// Farben, die alle Karts teilen.
const DARK = 0x2d2a36; // Gummi, Rahmen
const STEEL = 0x5a6173;
const CHROME = 0xe3ebf4;
const WHITE = 0xfdf9f0;
const LEMON = 0xfff48a;
const INK_CSS = '#16131c';

// ───────────────────────────── Lackfarben ─────────────────────────────
//
// Die Figur wählt jeder frei, die Lackfarbe hängt am Spielerplatz. Alles, was
// am Kart „Lack“ ist – Karosserie, Helm, Kappe, Felgen, Streifen –, kommt aus
// einer Palette, die aus der Lackfarbe abgeleitet wird. Fell, Gesichter,
// Reifen und Chrom bleiben bei der Figur.

/** Lackfarbe je Platz – dieselben Werte wie PLAYER_COLORS in util/players.ts. */
const PAINT_BASE = [0xff5a4e, 0x1fc8b6, 0xffd23f, 0x9b87ff];

interface Paint {
  /** Lack. */
  base: number;
  /** Dunklere Variante: Unterkante, Kappenrand, Flosse, Schirm, Felgenring. */
  dark: number;
  /** Hellere Variante: Fasen und Glanzkanten. */
  light: number;
  /** Sehr dunkler Ton der Teamfarbe: Anzug, Polster. */
  deep: number;
  /** Noch dunkler: Sitzmulde, Lenkradkranz. */
  deeper: number;
  /** Zweite Akzentfarbe (Blitze, Zündkerzenkappen) – kontrastiert zum Lack. */
  accent: number;
  /** Zierlinie auf zu hellem Lack (statt Weiß/Creme). */
  ink: number;
}

function hexToHsl(hex: number): [number, number, number] {
  const r = ((hex >> 16) & 255) / 255;
  const g = ((hex >> 8) & 255) / 255;
  const b = (hex & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h / 6, s, l];
}

function hslToHex(h: number, s: number, l: number): number {
  h = ((h % 1) + 1) % 1;
  s = clamp(s, 0, 1);
  l = clamp(l, 0, 1);
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const ch = (t: number): number => {
    t = ((t % 1) + 1) % 1;
    const v = t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p;
    return Math.round(v * 255);
  };
  return (ch(h + 1 / 3) << 16) | (ch(h) << 8) | ch(h - 1 / 3);
}

/** Relative Helligkeit (wie bei WCAG), 0..1. */
function luminance(hex: number): number {
  const lin = (c: number): number => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin((hex >> 16) & 255) + 0.7152 * lin((hex >> 8) & 255) + 0.0722 * lin(hex & 255);
}

/** Kontrastverhältnis zweier Farben (1 = gleich hell, 21 = Schwarz auf Weiß). */
function contrast(a: number, b: number): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Unterhalb davon verschwimmt eine Zierlinie auf dem Lack (Weiß auf Gelb ≈ 1,45). */
const MIN_TRIM_CONTRAST = 1.7;

// Handabgestimmte Töne der angestammten Kombinationen – damit Figur i im Lack
// von Platz i genau so aussieht wie bisher. Alles Übrige wird abgeleitet.
const TUNED: Record<number, Partial<Paint>> = {
  0xff5a4e: { dark: 0xc93b35 },
  0x1fc8b6: { dark: 0x13968a },
  0xffd23f: { dark: 0xe0a41c },
  0x9b87ff: { dark: 0x6a55d4, light: 0xb3a4ff, deep: 0x3b2f66, deeper: 0x2a2440, accent: LEMON },
};

function makePaint(base: number): Paint {
  const [h, s, l] = hexToHsl(base);
  // Gelb wird abgedunkelt schnell oliv – die dunklen Töne dort Richtung Braun drehen.
  const hd = h > 0.08 && h < 0.21 ? h - 0.045 : h;
  const derived: Paint = {
    base,
    dark: hslToHex(h, s * 0.72, l * 0.74),
    light: hslToHex(h, s * 0.95, l + (1 - l) * 0.45),
    deep: hslToHex(hd, Math.min(s, 0.42), 0.28),
    deeper: hslToHex(hd, Math.min(s, 0.3), 0.2),
    // Zitronengelb, solange es sich vom Lack abhebt; sonst die Gegenfarbe.
    accent: contrast(LEMON, base) >= 1.6 ? LEMON : hslToHex(h + 0.5, 0.68, 0.46),
    ink: hslToHex(hd, 0.22, 0.17),
  };
  return { ...derived, ...TUNED[base] };
}

const PAINTS: Paint[] = PAINT_BASE.map(makePaint);

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
function sweep(path: readonly V3[], radius: number | ((t: number) => number), radSegs: number, smooth = 0): THREE.BufferGeometry {
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
  const g = lathe(
    [
      [0, -h],
      [r, -h + w * 0.14],
      [r, h - w * 0.26],
      [r * 0.83, h],
      [0, h],
    ],
    segs,
  );
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
  /** Konturdicke je Ecke (0..1), ausgewertet an der unverschobenen Geometrie. */
  taper?: (x: number, y: number, z: number) => number;
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
    const f = this.detail === 2 ? 1 : this.detail === 1 ? 0.8 : 0.55;
    return Math.max(min, Math.round(n * f));
  }

  /** Wie s(), aber durch vier teilbar (für symmetrische Querschnitte). */
  s4(n: number): number {
    return Math.max(8, Math.round(this.s(n) / 4) * 4);
  }

  get vertexCount(): number {
    return this.pos.length / 3;
  }

  /** Feinheiten (kleine Zierteile) gibt es erst ab Detailstufe 1. */
  get fine(): boolean {
    return this.detail > 0;
  }

  /** Polster: weich gerundet, auf der niedrigsten Stufe ein schlichter Quader. */
  soft(w: number, h: number, d: number, r: number, segs: number): THREE.BufferGeometry {
    return this.fine ? pillow(w, h, d, r, segs) : box(w, h, d);
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
    const hull = o.hull ?? geo;
    let weights: number[] | null = null;
    if (o.taper) {
      const hp = hull.getAttribute('position');
      weights = [];
      for (let i = 0; i < hp.count; i++) weights.push(o.taper(hp.getX(i), hp.getY(i), hp.getZ(i)));
    }
    geo.applyMatrix4(_m);
    if (!geo.getAttribute('normal')) geo.computeVertexNormals();
    if (o.hull) {
      o.hull.applyMatrix4(_m);
      if (!o.hull.getAttribute('normal')) o.hull.computeVertexNormals();
    }
    const thick = this.outlines ? (o.outline ?? 1) * LINE : 0;
    this.appendMain(geo, o, o.bone, false);
    if (thick > 0) this.appendHull(hull, o, o.bone, false, thick, weights);
    if (o.mirror !== undefined) {
      this.appendMain(geo, o, o.mirror, true);
      if (thick > 0) this.appendHull(hull, o, o.mirror, true, thick, weights);
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
  private appendHull(
    geo: THREE.BufferGeometry,
    o: Put,
    bone: number,
    mirrored: boolean,
    thick: number,
    weights: number[] | null,
  ): void {
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
      const w = weights ? weights[i] : 1;
      this.oPos.push(x, y, z);
      this.oNor.push(d[0] * sx * w, d[1] * w, d[2] * w);
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

/** Drehpunkt des Drifts: ein Stück vor der Mitte, damit das Heck ausbricht. */
const DRIFT_PIVOT = 0.3;

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
  /** Zwei freie Knochen je Figur (Motor/Kiefer, Schnauzbart, Antennen): Elternknochen und Lage. */
  auxParent: number;
  aux: V3;
  aux1Parent: number;
  aux1: V3;
  /** Wo es bei „Kurzschluss“ qualmt. */
  smoke: V3;
  /** Gleitflügel: linkes Gelenk, Abstand zum Außenteil, V-Stellung (rad), Leitwerk. */
  wing: V3;
  wingTip: number;
  wingUp: number;
  wingTail: V3;
  /** Tauchen: Drehpunkt der Kopf-Ausrüstung (im Kopf), Gelenk an der Karosserie, linke Schraube, Blasenquelle (im Kopf). */
  diveHead: V3;
  diveBody: V3;
  diveProp: V3;
  diveBub: V3;
}

const SPECS: Spec[] = [
  // 0 – Kolben-Kalle: Hot-Rod, hinten riesige Räder, vorn kleine
  {
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
    aux1Parent: B.head, // Unterkiefer
    aux1: [0, 0.15, 0.08],
    smoke: [0, 0.85, 0.6],
    wing: [0.33, 0.47, 0.05],
    wingTip: 0.62,
    wingUp: 0.02,
    wingTail: [0, 0.62, -0.9],
    diveHead: [0, 0.345, 0.29],
    diveBody: [0, 0.27, -1.0],
    diveProp: [0, 0.27, -1.13],
    diveBub: [0.34, 0.77, 0.07],
  },
  // 1 – Vera Vergaser: schlanker Renner
  {
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
    aux1Parent: B.chassis,
    aux1: [0, 0.5, 0],
    smoke: [0, 0.8, -0.75],
    wing: [0.24, 0.47, -0.05],
    wingTip: 0.78,
    wingUp: 0.1,
    wingTail: [0, 0.6, -0.86],
    diveHead: [0, 0.28, 0],
    diveBody: [0, 0.34, -1.0],
    diveProp: [0.33, 0.34, -1.04],
    diveBub: [0, 0.16, 0.44],
  },
  // 2 – Bremsen-Bert: Badewanne auf Rädern
  {
    wf: { x: 0.6, z: 0.6, r: 0.27, w: 0.27 },
    wr: { x: 0.6, z: -0.62, r: 0.29, w: 0.29 },
    hip: [0, 0.52, -0.22],
    torsoLen: 0.33,
    shoulder: [0.29, 0.22, 0.02],
    armR: 0.075,
    upper: 0.27,
    fore: 0.27,
    hand: 0.078,
    steer: [0, 0.69, 0.3],
    steerTilt: 0.72,
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
    aux1Parent: B.head,
    aux1: [-0.1, 0.19, 0.27],
    smoke: [0, 0.75, -0.85],
    wing: [0.44, 0.45, -0.02],
    wingTip: 0.5,
    wingUp: 0.12,
    wingTail: [0, 0.62, -1.0],
    diveHead: [0, 0.375, 0.3],
    diveBody: [-0.34, 0.62, -0.86],
    diveProp: [-0.34, 0.17, -1.1],
    diveBub: [0, 0.07, 0.44],
  },
  // 3 – Zünd-Zoe: kantiger Keil mit Zündkerzen
  {
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
    aux: [0.3, 0.648, -0.86],
    aux1Parent: B.chassis,
    aux1: [-0.3, 0.648, -0.86],
    smoke: [0, 0.8, -0.8],
    wing: [0.38, 0.36, -0.05],
    wingTip: 0.72,
    wingUp: 0.06,
    wingTail: [0, 0.5, -0.5],
    diveHead: [0, 0.36, 0],
    diveBody: [0, 0.4, -0.9],
    diveProp: [0.22, 0.38, -1.1],
    diveBub: [0, 0.8, -0.2],
  },
];

/** Alles, was die Baufunktionen einer Figur brauchen. */
interface Ctx {
  b: Builder;
  /** Aufkleber (Augen, Startnummer) – eigenes Netz mit Textur. */
  d: Builder;
  sp: Spec;
  /** Lackfarben des Platzes. */
  p: Paint;
  /** Angestammte Kombination (Figur i im Lack von Platz i): handabgestimmt, keine Kontrastregel. */
  native: boolean;
  /** Erste Ecke der Augen im Aufkleber-Netz (setzt addEyes). */
  eyeStart: number;
}

/**
 * Helle Zierlinie (Weiß/Creme) der Figur – oder, wenn sie sich vom Lack nicht
 * abhebt (Gelb), ein dunkler Strich in der Teamfarbe.
 */
function trim(c: Ctx, light: number): number {
  return c.native || contrast(light, c.p.base) >= MIN_TRIM_CONTRAST ? light : c.p.ink;
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
      const ey = Math.max(cy + Math.sin(a) * ry, yl - (k * (ex - cx)) / dx);
      g.beginPath();
      g.moveTo(ex - S * 0.01, ey);
      g.lineTo(ex + S * 0.07, ey - S * (0.035 + i * 0.022));
      g.stroke();
    }
  }
}

function drawEye(g: CanvasRenderingContext2D, x0: number, y0: number, st: EyeStyle, state: number): void {
  const S = CELL;
  // Mit Wimpern rückt das Auge etwas zur Nase, damit sie in der Zelle Platz haben.
  const cx = x0 + S / 2 - (st.lashes > 0 ? S * 0.035 : 0);
  const cy = y0 + S / 2;
  const rx = st.rx * S;
  const ry = st.ry * S;
  const lw = S * 0.05;
  // Nichts darf in die Nachbarzelle ragen (dort gäbe es sonst Flecken neben dem Auge).
  g.save();
  g.beginPath();
  g.rect(x0 + 3, y0 + 3, S - 6, S - 6);
  g.clip();
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.strokeStyle = INK_CSS;
  switch (state) {
    case EYE.BLINK:
      g.lineWidth = lw * 2;
      g.beginPath();
      g.ellipse(cx, cy - ry * 0.2, rx * 0.9, ry * 0.5, 0, Math.PI * 0.1, Math.PI * 0.9);
      g.stroke();
      // Wimpern am geschlossenen Auge
      g.lineWidth = lw * 1.1;
      for (let i = 0; i < st.lashes; i++) {
        const a = Math.PI * (0.14 + i * 0.1);
        const ex = cx + Math.cos(a) * rx * 0.9;
        const ey = cy - ry * 0.2 + Math.sin(a) * ry * 0.5;
        g.beginPath();
        g.moveTo(ex, ey);
        g.lineTo(ex + S * 0.05, ey + S * 0.055);
        g.stroke();
      }
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
  g.restore();
}

/** Zeichnet alle Augenzustände einer Figur und die Startnummer ihres Platzes in ein Bild. */
function makeAtlas(character: number, slot: number): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = CELL * ATLAS_COLS;
  canvas.height = CELL * ATLAS_ROWS;
  const g = canvas.getContext('2d');
  if (!g) return null;
  const st = EYE_STYLES[character];
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
 * flat: ohne eigene Kontur (für Schilder, die bündig auf einer Fläche liegen).
 */
function addNumber(c: Ctx, pos: V3, rot: V3, r: number, turn: number, flat = false): void {
  c.b.put(cyl(r, r, 0.016, c.b.s(12, 8)), { bone: B.chassis, color: WHITE, pos, rot, outline: flat ? 0 : 0.55 });
  const a = r * 0.86;
  const co = Math.cos(turn);
  const si = Math.sin(turn);
  const h = 0.0135;
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
  b.put(wheel(sp.wf.r, sp.wf.w, segs, look.wall, look.rim, look.rim2, look.hub), {
    bone: B.wFL,
    mirror: B.wFR,
    hull: wheelHull(sp.wf.r, sp.wf.w, segs),
  });
  b.put(wheel(sp.wr.r, sp.wr.w, segs, look.wall, look.rim, look.rim2, look.hub), {
    bone: B.wRL,
    mirror: B.wRR,
    hull: wheelHull(sp.wr.r, sp.wr.w, segs),
  });
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
  if (!b.fine) return;
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
  // Die runden Enden bekommen keine Kontur – sonst zeichnen sich an den Gelenken Ringe ab.
  const shaft =
    (len: number) =>
    (_x: number, y: number): number =>
      y < -1e-4 || y > len + 1e-4 ? 0 : 1;
  b.put(limb(sp.armR, sp.upper, segs, b.detail === 0 ? 1 : 2), {
    bone: B.armLU,
    color: look.sleeve,
    mirror: B.armRU,
    outline: 0.8,
    taper: shaft(sp.upper),
  });
  b.put(limb(sp.armR * 0.88, sp.fore, segs, 1), {
    bone: B.armLF,
    color: look.cuff,
    mirror: B.armRF,
    outline: 0.8,
    taper: shaft(sp.fore),
  });
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
  /** Glanzlicht: Richtung (Winkel um die Hochachse, 0 = vorn, positiv = links). */
  gloss?: number;
}

/**
 * Helmschale: Kugelkappe bis zum Winkel cut (vom Scheitel), um tilt nach
 * hinten gekippt, mit Wulst an der Kante und optionalem Mittelstreifen.
 */
function addHelmet(b: Builder, c: V3, r: V3, cut: number, tilt: number, color: number, o: HelmetOpts = {}): void {
  const ws = b.s(o.ws ?? 14, 8);
  const hs = b.s(5, 3);
  const rot: V3 = [tilt, 0, 0];
  b.put(new THREE.SphereGeometry(1, ws, hs, 0, TAU, 0, cut), { bone: B.head, color, pos: c, rot, scale: r });
  if (o.rim !== undefined && b.fine) {
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
  if (o.gloss !== undefined && b.fine) {
    // Comic-Glanzlicht: kleiner heller Fleck schräg oben auf der Schale
    const spot = new THREE.SphereGeometry(1.016, 3, 2, HALF_PI + o.gloss - 0.3, 0.6, 0.42, 0.26);
    b.put(spot, { bone: B.head, color: 0xffffff, pos: c, rot, scale: r, outline: 0 });
  }
}

/** Spitzes Ohr (Fuchs, Katze): flacher Kegel mit hellem Innenohr und dunkler Spitze. */
function addPointedEars(b: Builder, r: number, h: number, fur: number, inner: number, tip: number | null): void {
  const segs = b.s(6, 5);
  b.put(cone(r, h, segs), { bone: B.earL, color: fur, scale: [1, 1, 0.5], mirror: B.earR, outline: 0.9 });
  if (b.fine)
    b.put(cone(r * 0.62, h * 0.66, 4), {
      bone: B.earL,
      color: inner,
      pos: [0, h * 0.04, r * 0.24],
      scale: [1, 1, 0.3],
      mirror: B.earR,
      outline: 0,
    });
  if (tip !== null) {
    const th = h * 0.4;
    b.put(cone((r * th) / h + 0.006, th + 0.006, segs), {
      bone: B.earL,
      color: tip,
      pos: [0, h - th, 0],
      scale: [1, 1, 0.56],
      mirror: B.earR,
      outline: 0,
    });
  }
}

/** Auspuffmündung: dunkles Loch am Rohrende. */
function addPipeHole(c: Ctx, r: number): void {
  const e = c.sp.exhaust;
  if (!c.b.fine) return;
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
  b.put(sphere(r, r, r * 0.95, b.s(8, 6), b.s(5, 4)), { bone: B.chassis, color: CHROME, pos, mirror: B.chassis, outline: 0.75 });
  if (b.fine)
    b.put(sphere(r * 0.76, r * 0.76, r * 0.36, b.s(8, 6), 3), {
      bone: B.chassis,
      color: 0xfff3b0,
      pos: [pos[0], pos[1], pos[2] + r * 0.72],
      mirror: B.chassis,
      outline: 0,
    });
}

// ───────────────────────────── 0: Kolben-Kalle ─────────────────────────────

function buildKalle(c: Ctx): void {
  const { b, sp } = c;
  const RED = c.p.base;
  const RED_D = c.p.dark;
  const CREAM = trim(c, 0xffefd2);
  const LEATHER = 0x6a4230;
  const CH = B.chassis;

  // — Karosserie: gedrungene Wanne mit steilem Heckblech —
  const S = b.s4(16);
  const rr = (z: number, hw: number, ht: number, hb: number, cy = 0.4): Ring => sring(z, cy, hw, ht, hb, 3.2, S, 0.07);
  b.put(
    loft(
      [
        rr(-1.0, 0.31, 0.165, 0.175, 0.415),
        rr(-0.92, 0.365, 0.205, 0.215, 0.41),
        rr(-0.66, 0.385, 0.22, 0.24),
        rr(-0.3, 0.39, 0.22, 0.25),
        rr(0.08, 0.37, 0.21, 0.25),
        rr(0.3, 0.32, 0.18, 0.23),
      ],
      {
        color: (_j, k) => (k === S / 4 - 1 || k === S / 4 ? CREAM : RED),
        capColor: RED_D,
      },
    ),
    { bone: CH },
  );
  // Sitzmulde und Lehne
  b.put(sphere(0.27, 0.035, 0.25, b.s(10, 8), 3), { bone: CH, color: 0x3a2a26, pos: [0, 0.612, -0.27], outline: 0 });
  b.put(b.soft(0.5, 0.4, 0.12, 0.045, 8), { bone: CH, color: LEATHER, pos: [0, 0.77, -0.6], rot: [-0.2, 0, 0] });
  // Kühlermaske mit Chromstreben
  const gs = b.s4(12);
  b.put(
    loft([
      sring(0.84, 0.42, 0.17, 0.2, 0.21, 3, gs),
      sring(0.93, 0.42, 0.2, 0.235, 0.23, 3, gs),
      sring(0.975, 0.42, 0.185, 0.22, 0.215, 3, gs),
    ]),
    { bone: CH, color: RED },
  );
  b.put(loft([sring(0.97, 0.42, 0.14, 0.17, 0.165, 3, gs), sring(0.99, 0.42, 0.125, 0.155, 0.15, 3, gs)], { capA: false }), {
    bone: CH,
    color: 0x3b3f4d,
    outline: 0,
  });
  if (b.fine)
    for (let i = -1; i <= 1; i++)
      b.put(box(0.022, 0.3, 0.012), { bone: CH, color: CHROME, pos: [i * 0.065, 0.42, 0.992], outline: 0 });
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
  const sc = (z: number, hw: number, h: number): Ring => ({
    z,
    p: [hw, 0, hw, h * 0.7, hw * 0.7, h, -hw * 0.7, h, -hw, h * 0.7, -hw, 0],
  });
  b.put(
    loft([sc(-0.16, 0.06, 0.04), sc(-0.02, 0.095, 0.1), sc(0.15, 0.105, 0.12)], {
      flat: true,
      color: (_j, k) => (k === 2 ? CREAM : RED),
      capColor: 0x241f26,
    }),
    {
      bone: EN,
      pos: [0, 0.255, 0],
    },
  );
  if (b.fine)
    for (let i = -1; i <= 1; i++)
      b.put(box(0.016, 0.085, 0.012), { bone: EN, color: CHROME, pos: [i * 0.05, 0.31, 0.152], outline: 0 });
  // Krümmer: drei Stummel je Seite
  for (let i = 0; i < 3; i++) {
    b.put(box(0.055, 0.24, 0.055), {
      bone: EN,
      color: CHROME,
      pos: [0.24, 0.02, -0.17 + i * 0.13],
      aim: [0.75, -0.4, -0.55],
      mirror: EN,
      outline: 0.6,
    });
  }

  // — Auspuff: zwei dicke Rohre aus dem Heckblech —
  b.put(
    sweep(
      [
        [0.25, 0.3, -0.8],
        [0.25, 0.315, -0.96],
        [sp.exhaust[0], sp.exhaust[1], sp.exhaust[2]],
      ],
      (t) => 0.058 + 0.03 * t * t,
      b.s(8, 6),
    ),
    {
      bone: CH,
      color: CHROME,
      mirror: CH,
    },
  );
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
  b.put(sphere(R[0], R[1], R[2], b.s(14, 8), b.s(9, 6)), { bone: H, color: FUR, pos: C });
  // Schnauze und Nase
  b.put(sphere(0.165, 0.11, 0.13, b.s(8, 6), b.s(6, 4)), { bone: H, color: TAN, pos: [0, 0.225, 0.26], outline: 0.7 });
  b.put(sphere(0.068, 0.048, 0.045, 6, 4), { bone: H, color: 0x2b1d20, pos: [0, 0.285, 0.38], outline: 0 });
  // dunkler Mundraum hinter dem Kiefer
  if (b.fine) b.put(sphere(0.14, 0.03, 0.11, 6, 3), { bone: H, color: 0x3a1418, pos: [0, 0.165, 0.25], outline: 0 });
  // kräftiger Unterkiefer mit zwei Hauern (klappt beim Jubeln auf)
  const J = B.aux1;
  const js = b.s4(8);
  b.put(
    loft(
      [
        sring(-0.02, -0.035, 0.15, 0.05, 0.06, 3, js),
        sring(0.1, -0.03, 0.185, 0.055, 0.075, 3.4, js),
        sring(0.25, -0.02, 0.17, 0.05, 0.07, 3.4, js),
        sring(0.325, -0.015, 0.11, 0.035, 0.05, 3, js),
      ],
      { capA: false },
    ),
    {
      bone: J,
      color: FUR_D,
      outline: 0.8,
    },
  );
  b.put(cone(0.03, 0.075, 4), { bone: J, color: WHITE, pos: [0.095, 0.015, 0.265], mirror: J, outline: 0.4 });
  // runde Ohren
  b.put(sphere(0.115, 0.115, 0.055, b.s(8, 6), b.s(5, 4)), {
    bone: B.earL,
    color: FUR,
    pos: [0, 0.07, 0],
    mirror: B.earR,
    outline: 0.9,
  });
  if (b.fine)
    b.put(sphere(0.068, 0.068, 0.03, 6, 3), { bone: B.earL, color: TAN, pos: [0, 0.07, 0.04], mirror: B.earR, outline: 0 });
  // Augenbrauen: dicke Tuschebalken, innen tiefer → grimmig, aber gutmütig
  b.put(box(0.15, 0.042, 0.035), {
    bone: H,
    color: INK,
    pos: [0.135, 0.463, 0.24],
    rot: [-0.35, 0.42, 0.33],
    mirror: H,
    outline: 0,
  });
  // Halbschale mit Streifen und Kinnriemen
  addHelmet(b, C, [0.352, 0.312, 0.322], 1.02, -0.3, RED, { stripe: CREAM, stripeHalf: 0.17, rim: 0x2b2530 });
  if (b.fine)
    b.put(box(0.03, 0.2, 0.012), {
      bone: H,
      color: 0x2b2530,
      pos: [0.305, 0.25, 0.085],
      rot: [0.25, 0, -0.16],
      mirror: H,
      outline: 0,
    });
  addEyes(c, { c: C, r: R, phi: 0.41, psi: 0.14, dphi: 0.27, dpsi: 0.3, tilt: 0 });
}

// ───────────────────────────── 1: Vera Vergaser ─────────────────────────────

function buildVera(c: Ctx): void {
  const { b, sp } = c;
  const TURQ = c.p.base;
  const TURQ_D = c.p.dark;
  // Zierweiß am Kart (Bug, Streifen, Flossenkappe, Felgen)
  const TRIM = trim(c, WHITE);
  const CH = B.chassis;

  // — Karosserie: Zigarre mit spitzer Nase und Kopfstütze —
  const S = b.s4(16);
  const rr = (z: number, cy: number, hw: number, ht: number, hb: number): Ring => sring(z, cy, hw, ht, hb, 2.3, S, 0.055);
  const rings = [
    rr(-1.03, 0.47, 0.055, 0.05, 0.05),
    rr(-0.9, 0.46, 0.14, 0.13, 0.11),
    rr(-0.63, 0.44, 0.255, 0.27, 0.19),
    rr(-0.45, 0.42, 0.29, 0.24, 0.21),
    rr(-0.3, 0.41, 0.3, 0.19, 0.21),
    rr(0.1, 0.4, 0.29, 0.19, 0.2),
    rr(0.45, 0.385, 0.225, 0.155, 0.16),
    rr(0.78, 0.365, 0.135, 0.1, 0.1),
    rr(0.97, 0.355, 0.06, 0.05, 0.05),
    rr(1.05, 0.352, 0.024, 0.02, 0.02),
  ];
  b.put(loft(rings, { color: (j, k) => (j >= 7 || k === S / 4 - 1 || k === S / 4 ? TRIM : TURQ) }), { bone: CH });
  b.put(sphere(0.215, 0.03, 0.2, b.s(10, 8), 3), { bone: CH, color: 0x2e2630, pos: [0, 0.598, -0.2], outline: 0 });
  b.put(b.soft(0.34, 0.2, 0.08, 0.03, 8), { bone: CH, color: 0x6a4230, pos: [0, 0.71, -0.46], rot: [-0.25, 0, 0], outline: 0.8 });
  // kleine Windschutzscheibe
  const glass: number[] = [];
  for (let i = 0; i <= 5; i++) glass.push(Math.cos((i / 5) * Math.PI) * 0.19, Math.sin((i / 5) * Math.PI) * 0.13);
  if (b.fine) b.put(prism(glass, 0.02), { bone: CH, color: 0xc6efff, pos: [0, 0.585, 0.13], rot: [-0.5, 0, 0], outline: 0.6 });
  // Heckflosse mit heller Kappe
  b.put(prism([-0.46, 0.6, -1.02, 0.5, -1.04, 0.97, -0.83, 0.97], 0.05), { bone: CH, color: TURQ_D, rot: [0, -HALF_PI, 0] });
  b.put(prism([-0.83, 0.97, -1.04, 0.97, -1.045, 1.07, -0.885, 1.07], 0.05), { bone: CH, color: TRIM, rot: [0, -HALF_PI, 0] });
  addNumber(c, [0.024, 0.8, -0.88], [0, 0, -HALF_PI], 0.115, HALF_PI, true);
  addNumber(c, [-0.024, 0.8, -0.88], [0, 0, HALF_PI], 0.115, -HALF_PI, true);
  if (b.fine) addNumber(c, [0, 0.527, 0.5], [0.13, 0, 0], 0.105, 0);
  // … und eine aufs Heck neben die Flosse: die sieht man aus der Verfolgerkamera
  addNumber(c, [-0.135, 0.612, -0.74], [-0.42, 0, 0.6], 0.088, Math.PI);
  // Achsen und seitliche Auspuffrohre mit Trichter
  addAxle(c, sp.wf, 0.028);
  addAxle(c, sp.wr, 0.028);
  b.put(
    sweep(
      [
        [0.2, 0.33, 0.34],
        [0.32, 0.335, -0.2],
        [sp.exhaust[0], sp.exhaust[1], sp.exhaust[2]],
      ],
      (t) => 0.034 + 0.034 * Math.max(0, (t - 0.65) / 0.35),
      b.s(6, 5),
      3,
    ),
    {
      bone: CH,
      color: CHROME,
      mirror: CH,
      outline: 0.8,
    },
  );
  addPipeHole(c, 0.052);

  addWheels(c, { wall: TIRE, rim: TRIM, rim2: TURQ, hub: TURQ_D });
  addSteering(c, 0x4a332a, CHROME);
  addDriverBody(c, { rx: 0.2, rz: 0.15, suit: [0x8a5632], sleeve: 0x8a5632, cuff: 0x8a5632, glove: 0xf4dfb4 });

  // — Schal: Wulst um den Hals, ein breites Ende weht nach hinten —
  const SCARF = 0xfff6e4;
  const wrap = new THREE.TorusGeometry(0.115, 0.052, 4, b.s(9, 8));
  wrap.rotateX(HALF_PI);
  b.put(wrap, { bone: B.torso, color: SCARF, pos: [0, sp.torsoLen - 0.005, 0.01], scale: [1.1, 1, 1] });
  const len = 0.84;
  const strip: Ring[] = [];
  const sn8 = b.fine ? 8 : 4;
  for (let i = sn8; i >= 0; i--) {
    const w = 0.06 + 0.03 * Math.sin((i / sn8) * Math.PI) + (i === sn8 ? 0.012 : 0);
    strip.push({ z: (-i / sn8) * len, p: [w, -0.016, w, 0.016, -w, 0.016, -w, -0.016] });
  }
  const zBase = sp.hip[2] + sp.chain[2];
  b.put(loft(strip, { flat: true, color: (j) => (j === 0 || (b.fine && j === 2) ? TURQ : SCARF) }), {
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
  b.put(sphere(R[0], R[1], R[2], b.s(14, 8), b.s(9, 6)), { bone: H, color: ORANGE, pos: C });
  // helle Maske: Wangen und Kinn
  b.put(sphere(0.255, 0.15, 0.235, b.s(9, 8), b.s(5, 4)), { bone: H, color: CREAM, pos: [0, 0.165, 0.045], outline: 0.8 });
  b.put(cone(0.085, 0.21, b.s(6, 5)), {
    bone: H,
    color: CREAM,
    pos: [0.2, 0.15, 0.03],
    aim: [1, -0.3, -0.2],
    scale: [1, 1, 0.55],
    mirror: H,
    outline: 0.8,
  });
  // spitze Schnauze: oben fuchsrot, unten hell
  const SS = b.s4(8);
  const sn = (z: number, hw: number, ht: number, hb: number, cy: number): Ring => sring(z, cy, hw, ht, hb, 2, SS);
  b.put(
    loft(
      [
        sn(0.14, 0.13, 0.095, 0.085, 0.215),
        sn(0.3, 0.095, 0.07, 0.06, 0.205),
        sn(0.42, 0.055, 0.042, 0.04, 0.2),
        sn(0.47, 0.03, 0.024, 0.024, 0.2),
      ],
      { color: (_j, k) => (k < SS / 2 ? ORANGE : CREAM), capA: false },
    ),
    {
      bone: H,
      outline: 0.7,
    },
  );
  b.put(sphere(0.042, 0.036, 0.036, 6, 4), { bone: H, color: 0x2b1d20, pos: [0, 0.213, 0.475], outline: 0 });
  addPointedEars(b, 0.105, 0.3, ORANGE, CREAM, TIP);
  // feine Brauen
  b.put(box(0.1, 0.02, 0.026), {
    bone: H,
    color: INK,
    pos: [0.125, 0.425, 0.228],
    rot: [-0.4, 0.45, -0.22],
    mirror: H,
    outline: 0,
  });
  // Fliegerkappe mit Ohrenklappen
  const CAP_R: V3 = [0.306, 0.281, 0.296];
  addHelmet(b, C, CAP_R, 1.15, -0.38, TURQ, { rim: TURQ_D, gloss: 2.4 });
  b.put(sphere(0.055, 0.13, 0.1, 6, 4), { bone: H, color: TURQ, pos: [0.272, 0.21, -0.03], mirror: H, outline: 0.8 });
  // Fliegerbrille auf der Stirn, Riemen um die Kappe. Sie hängt an einem eigenen
  // Knochen (Drehpunkt Kopfmitte): unter Wasser rutscht sie über die Augen.
  const G = B.dHead;
  const gy = sp.diveHead[1];
  const strap = new THREE.TorusGeometry(0.247, 0.016, 3, b.s(12, 8));
  if (b.fine)
    b.put(strap, { bone: G, color: 0x4a332a, pos: [0, 0.4265 - gy, -0.0525], rot: [-1.876, 0, 0], scale: [1.075, 1, 1], outline: 0 });
  const gx = 0.082;
  const gPos: V3 = [gx, 0.508 - gy, 0.174];
  const gRot: V3 = [0.66, 0.38, 0];
  b.put(cyl(0.066, 0.074, 0.05, b.s(8, 5)), {
    bone: G,
    color: CREAM,
    pos: gPos,
    rot: gRot,
    order: 'YXZ',
    mirror: G,
    outline: 0.55,
  });
  b.put(cyl(0.048, 0.048, 0.058, b.s(8, 5)), {
    bone: G,
    color: 0x2b4a73,
    pos: gPos,
    rot: gRot,
    order: 'YXZ',
    mirror: G,
    outline: 0,
  });
  if (b.fine)
    b.put(sphere(0.018, 0.006, 0.012, 4, 2), {
      bone: G,
      color: WHITE,
      pos: [gx + 0.018, 0.546 - gy, 0.19],
      rot: gRot,
      order: 'YXZ',
      mirror: G,
      outline: 0,
    });
  addEyes(c, { c: C, r: R, phi: 0.43, psi: 0.17, dphi: 0.26, dpsi: 0.27, tilt: 0.2 });
}

// ───────────────────────────── 2: Bremsen-Bert ─────────────────────────────

function buildBert(c: Ctx): void {
  const { b, sp } = c;
  const YEL = c.p.base;
  const YEL_D = c.p.dark;
  const CREAM = 0xfff6e2;
  // heller Wannenrand und Helmstreifen
  const RIM = trim(c, CREAM);
  const STRIPE = trim(c, WHITE);
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
    { color: (j) => (j === 0 ? YEL_D : j < 3 ? YEL : j < 6 ? RIM : INSIDE), capColor: INSIDE },
  );
  b.put(tub, { bone: CH, rot: [-HALF_PI, 0, 0] });
  // Rückenlehne
  b.put(b.soft(0.56, 0.3, 0.1, 0.04, 8), { bone: CH, color: 0x7a5a48, pos: [0, 0.66, -0.56], rot: [-0.22, 0, 0], outline: 0.8 });

  // — dicke Stoßstangen vorn und hinten —
  for (const dir of [1, -1]) {
    const pts: V3[] = [];
    const half = dir > 0 ? 0.925 : 0.9;
    for (let i = -2; i <= 2; i++) {
      const a = (i / 2) * 0.95;
      const cx = Math.sign(Math.sin(a)) * Math.pow(Math.abs(Math.sin(a)), 2 / E) * 0.58;
      const cz = Math.pow(Math.cos(a), 2 / E) * (half + 0.08);
      pts.push([cx, 0.3, zc + dir * cz]);
    }
    if (dir < 0) pts.reverse();
    b.put(sweep(pts, 0.062, b.s(6, 5), 4), { bone: CH, color: CHROME });
    b.put(box(0.09, 0.19, 0.08), { bone: CH, color: DARK, pos: [0.2, 0.3, zc + dir * (half + 0.085)], mirror: CH, outline: 0.7 });
  }
  // Scheinwerfer auf dem Wannenrand, Rücklichter
  addLamp(c, [0.25, 0.7, 0.74], 0.09);
  if (b.fine)
    b.put(sphere(0.05, 0.05, 0.035, 6, 3), { bone: CH, color: 0xff7a3c, pos: [0.3, 0.57, -0.84], mirror: CH, outline: 0.6 });
  // Auspuffstummel
  b.put(cyl(0.055, 0.048, 0.2, 6), {
    bone: CH,
    color: CHROME,
    pos: [sp.exhaust[0], sp.exhaust[1], sp.exhaust[2] + 0.1],
    rot: [HALF_PI - sp.exhaustUp, 0, 0],
    mirror: CH,
    outline: 0.8,
  });
  addPipeHole(c, 0.046);
  addAxle(c, sp.wf, 0.035);
  addAxle(c, sp.wr, 0.035);
  addNumber(c, [0, 0.455, -0.927], [-(HALF_PI - 0.06), 0, 0], 0.12, Math.PI);
  addNumber(c, [0, 0.455, 0.912], [HALF_PI - 0.06, 0, 0], 0.12, 0);

  addWheels(c, { wall: CREAM, rim: YEL, rim2: YEL_D, hub: CHROME });
  addSteering(c, 0x4a332a, CHROME);
  // gestreifter Badeanzug
  const NAVY = 0x2e4372;
  addDriverBody(c, {
    rx: 0.31,
    rz: 0.24,
    suit: [NAVY, NAVY, WHITE, NAVY, WHITE, NAVY, WHITE],
    sleeve: 0x8fa3c2,
    cuff: 0x8fa3c2,
    glove: 0x7389ab,
  });

  // — Kopf: Walross mit Schnauzbart, Stoßzähnen und Schirmhelm —
  const H = B.head;
  const SKIN = 0x8fa3c2;
  const SKIN_D = 0x7389ab;
  const C: V3 = [0, 0.29, 0];
  const R: V3 = [0.35, 0.3, 0.31];
  b.put(sphere(R[0], R[1], R[2], b.s(14, 8), b.s(9, 6)), { bone: H, color: SKIN, pos: C });
  // Speckrolle im Nacken
  b.put(sphere(0.28, 0.085, 0.15, b.s(8, 6), 4), { bone: H, color: SKIN_D, pos: [0, 0.07, -0.19], outline: 0.8 });
  // Stoßzähne (hängen am Kopf), Schnauzbart-Polster (eigene Knochen: sie flattern)
  b.put(
    sweep(
      [
        [0.09, 0.14, 0.3],
        [0.1, 0.01, 0.355],
        [0.115, -0.13, 0.375],
      ],
      (t) => 0.046 - 0.03 * t,
      b.s(6, 5),
    ),
    { bone: H, color: 0xfffbe6, mirror: H, outline: 0.7 },
  );
  b.put(sphere(0.16, 0.12, 0.12, b.s(7, 6), b.s(5, 4)), {
    bone: B.aux0,
    color: CREAM,
    pos: [0.035, -0.035, 0.035],
    rot: [0, 0.25, -0.3],
    mirror: B.aux1,
    outline: 0.8,
  });
  b.put(sphere(0.075, 0.05, 0.045, 6, 4), { bone: H, color: 0x2b1d20, pos: [0, 0.262, 0.385], outline: 0 });
  // buschige Brauen
  b.put(sphere(0.075, 0.03, 0.035, 6, 3), {
    bone: H,
    color: CREAM,
    pos: [0.135, 0.468, 0.243],
    rot: [-0.3, 0.4, -0.3],
    mirror: H,
    outline: 0.45,
  });
  // Helm mit Schirm
  const HR: V3 = [0.372, 0.322, 0.332];
  addHelmet(b, C, HR, 0.92, -0.25, YEL, { stripe: STRIPE, stripeHalf: 0.16, rim: YEL_D });
  b.put(sphere(0.215, 0.034, 0.17, b.s(8, 6), 4), {
    bone: H,
    color: YEL_D,
    pos: [0, 0.5, 0.295],
    rot: [0.3, 0, 0],
    outline: 0.8,
  });
  addEyes(c, { c: C, r: R, phi: 0.33, psi: 0.27, dphi: 0.22, dpsi: 0.23, tilt: -0.05 });
}

// ───────────────────────────── 3: Zünd-Zoe ─────────────────────────────

/** Blitz-Zickzack als Vieleck (Höhe etwa 1, Spitze unten). */
const BOLT: readonly number[] = [-0.04, 0.5, 0.24, 0.5, 0.07, 0.08, 0.26, 0.08, -0.16, -0.5, -0.03, -0.04, -0.22, -0.04];

function buildZoe(c: Ctx): void {
  const { b, sp } = c;
  const VIO = c.p.base;
  const VIO_D = c.p.dark;
  const VIO_L = c.p.light;
  const DEEP = c.p.deep;
  const DEEPER = c.p.deeper;
  const ACC = c.p.accent;
  const CH = B.chassis;

  // — Karosserie: kantiger Keil, bewusst mit harten Flächen —
  const wr = (z: number, hw: number, yt: number, yb: number, ch: number, sw: number): Ring => ({
    z,
    p: [
      hw,
      yb + ch,
      hw,
      yt - ch,
      hw - ch,
      yt,
      sw,
      yt,
      -sw,
      yt,
      -hw + ch,
      yt,
      -hw,
      yt - ch,
      -hw,
      yb + ch,
      -hw + ch,
      yb,
      hw - ch,
      yb,
    ],
  });
  b.put(
    loft(
      [
        wr(-1.03, 0.39, 0.6, 0.27, 0.05, 0.1),
        wr(-0.95, 0.43, 0.66, 0.2, 0.06, 0.1),
        wr(-0.45, 0.43, 0.63, 0.16, 0.07, 0.1),
        wr(-0.05, 0.41, 0.57, 0.15, 0.07, 0.1),
        wr(0.55, 0.34, 0.41, 0.15, 0.06, 0.09),
        wr(0.95, 0.24, 0.275, 0.16, 0.04, 0.07),
        wr(1.05, 0.18, 0.225, 0.17, 0.02, 0.05),
      ],
      {
        flat: true,
        color: (_j, k) => (k === 3 ? VIO_D : k === 1 || k === 5 ? VIO_L : VIO),
        capColor: VIO_D,
      },
    ),
    { bone: CH },
  );
  // Frontlippe, Seitenkästen, Sitzmulde, Kopfstütze
  b.put(box(0.6, 0.035, 0.22), { bone: CH, color: DARK, pos: [0, 0.145, 0.97], outline: 0.7 });
  b.put(box(0.1, 0.16, 0.5), { bone: CH, color: VIO_D, pos: [0.43, 0.3, -0.02], rot: [0, 0.06, 0], mirror: CH, outline: 0.8 });
  b.put(sphere(0.24, 0.03, 0.22, b.s(10, 8), 3), { bone: CH, color: DEEPER, pos: [0, 0.604, -0.2], outline: 0 });
  b.put(box(0.36, 0.24, 0.09), { bone: CH, color: DEEP, pos: [0, 0.74, -0.46], rot: [-0.2, 0, 0], outline: 0.8 });
  // Blitz auf der Haube
  b.put(prism(BOLT, 0.016), {
    bone: CH,
    color: ACC,
    pos: [0, 0.502, 0.24],
    rot: [-(HALF_PI - 0.262), 0, 0],
    scale: [0.5, 0.62, 1],
    outline: 0,
  });
  // eckige Auspuffblenden
  b.put(box(0.17, 0.12, 0.1), {
    bone: CH,
    color: CHROME,
    pos: [sp.exhaust[0], sp.exhaust[1], sp.exhaust[2] + 0.045],
    mirror: CH,
    outline: 0.7,
  });
  if (b.fine)
    b.put(box(0.12, 0.075, 0.02), {
      bone: CH,
      color: 0x1c1920,
      pos: [sp.exhaust[0], sp.exhaust[1], sp.exhaust[2] - 0.008],
      mirror: CH,
      outline: 0,
    });
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
  b.put(sphere(0.04, 0.04, 0.04, 6, 4), { bone: B.aux0, color: ACC, pos: [0, 0.475, 0], mirror: B.aux1, outline: 0.55 });

  addWheels(c, { wall: TIRE, rim: VIO_D, rim2: ACC, hub: WHITE });
  addSteering(c, DEEPER, ACC);
  addDriverBody(c, { rx: 0.19, rz: 0.145, suit: [DEEP], sleeve: DEEP, cuff: DEEP, glove: WHITE });

  // — Schwanz: Blitz-Zickzack, schräg gestellt – von hinten und von der Seite zu erkennen —
  const FUR = 0xfaf6ff;
  const tail: number[] = [
    0.0, 0.0, 0.1, 0.0, 0.16, 0.23, 0.035, 0.25, 0.15, 0.5, 0.007, 0.51, 0.11, 0.84, -0.108, 0.46, 0.027, 0.445, -0.1, 0.2, 0.032,
    0.195,
  ];
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
  b.put(sphere(R[0], R[1], R[2], b.s(14, 8), b.s(9, 6)), { bone: H, color: FUR, pos: C });
  // Wangenfell
  b.put(cone(0.075, 0.16, b.s(6, 5)), {
    bone: H,
    color: FUR,
    pos: [0.24, 0.17, 0.05],
    aim: [1, -0.22, -0.1],
    scale: [1, 1, 0.55],
    mirror: H,
    outline: 0.8,
  });
  // Schnäuzchen, Nase, Mund
  b.put(sphere(0.062, 0.05, 0.05, 6, 4), { bone: H, color: WHITE, pos: [0.047, 0.165, 0.262], mirror: H, outline: 0.5 });
  b.put(sphere(0.028, 0.02, 0.02, 5, 3), { bone: H, color: PINK, pos: [0, 0.2, 0.305], outline: 0 });
  if (b.fine) b.put(sphere(0.035, 0.022, 0.02, 5, 3), { bone: H, color: 0x7a3550, pos: [0, 0.133, 0.262], outline: 0 });
  // Schnurrhaare als Tuschestriche
  if (b.fine) {
    for (const dy of [0.025, -0.02]) {
      b.put(box(0.17, 0.009, 0.009), {
        bone: H,
        color: INK,
        pos: [0.19, 0.165 + dy, 0.245],
        rot: [0, 0.5, dy * 9],
        mirror: H,
        outline: 0,
      });
    }
  }
  addPointedEars(b, 0.1, 0.24, FUR, PINK, null);
  // Helm mit Blitz am Hinterkopf
  const HR: V3 = [0.333, 0.292, 0.302];
  addHelmet(b, C, HR, 1.12, -0.32, VIO, { rim: VIO_D, gloss: 2.4 });
  b.put(prism(BOLT, 0.014), {
    bone: H,
    color: ACC,
    pos: [0, 0.37, -0.287],
    rot: [0.3, Math.PI, 0],
    scale: [0.4, 0.3, 1],
    outline: 0,
  });
  addEyes(c, { c: C, r: R, phi: 0.4, psi: 0.1, dphi: 0.3, dpsi: 0.36, tilt: 0.06 });
}

const BUILDERS = [buildKalle, buildVera, buildBert, buildZoe];

// ───────────────────────────── Gleitflügel ─────────────────────────────
//
// Über Flugstrecken klappt jedes Kart Flügel aus. Sie stecken im selben Netz
// wie das Kart (kein zusätzlicher Zeichenaufruf) und hängen an eigenen
// Knochen: Gelenk links/rechts an der Karosserie, daran das federnde
// Außenteil, dazu ein Knochen fürs Leitwerk. Eingeklappt sind diese Knochen
// auf null geschrumpft – dann ist nichts zu sehen.
//
// Flügel-Koordinaten (Knochen wingL): +x nach außen, +z nach vorn, y oben.
// Der rechte Flügel ist gespiegelt.

/** Flügelgrundriss: Punkte (x, z) in der Ebene y = 0, Dicke entlang y. */
function plan(pts: readonly number[], depth: number): THREE.BufferGeometry {
  const poly: number[] = [];
  for (let i = 0; i < pts.length; i += 2) poly.push(pts[i], -pts[i + 1]);
  const g = prism(poly, depth);
  g.rotateX(-HALF_PI);
  return g;
}

/** Kalle: Doppeldecker-Stummel mit Chromstreben, hinten ein Höhenruder auf zwei Stelzen. */
function wingsKalle(c: Ctx): void {
  const b = c.b;
  const RED = c.p.base;
  const RED_D = c.p.dark;
  const CREAM = trim(c, 0xffefd2);
  const W = B.wingL;
  const T = B.tipL;
  const UP = 0.28;
  // runde Flügelenden
  const end = [0, -0.16, 0.36, -0.16, 0.43, -0.06, 0.41, 0.13, 0.32, 0.22, 0, 0.22];
  b.put(box(0.62, 0.045, 0.38), { bone: W, color: RED_D, pos: [0.31, 0, 0.03], mirror: B.wingR, outline: 0.7 });
  b.put(box(0.4, 0.045, 0.38), { bone: W, color: RED, pos: [0.42, UP, 0.03], mirror: B.wingR, outline: 0.7 });
  b.put(plan(end, 0.045), { bone: T, color: RED_D, mirror: B.tipR, outline: 0.7 });
  b.put(plan(end, 0.045), { bone: T, color: RED, pos: [0, UP, 0], mirror: B.tipR, outline: 0.7 });
  if (b.fine) b.put(box(0.07, 0.05, 0.385), { bone: T, color: CREAM, pos: [0.12, UP, 0.03], mirror: B.tipR, outline: 0 });
  const strut = (bone: number, mirror: number, x: number): void =>
    b.put(box(0.034, UP, 0.034), { bone, color: CHROME, pos: [x, UP / 2, 0.03], mirror, outline: 0.55 });
  strut(W, B.wingR, 0.25);
  strut(T, B.tipR, 0.27);
  // Höhenruder hinter der Lehne
  const TL = B.wtail;
  b.put(box(0.034, 0.22, 0.034), { bone: TL, color: CHROME, pos: [0.2, 0.11, 0], mirror: TL, outline: 0.55 });
  b.put(box(0.78, 0.045, 0.2), { bone: TL, color: RED_D, pos: [0, 0.23, -0.02], outline: 0.7 });
}

/** Vera: schlanke, nach außen spitz zulaufende Tragflächen mit hellen Enden, Höhenflosse an der Heckflosse. */
function wingsVera(c: Ctx): void {
  const b = c.b;
  const TURQ = c.p.base;
  const TURQ_D = c.p.dark;
  const TRIM = trim(c, WHITE);
  b.put(plan([0, -0.18, 0.78, -0.18, 0.78, 0.08, 0, 0.32], 0.035), { bone: B.wingL, color: TURQ, mirror: B.wingR, outline: 0.7 });
  b.put(plan([0, -0.18, 0.26, -0.17, 0.33, -0.11, 0.33, -0.04, 0, 0.08], 0.035), {
    bone: B.tipL,
    color: TRIM,
    mirror: B.tipR,
    outline: 0.7,
  });
  // Zierstreifen an der Vorderkante
  if (b.fine)
    b.put(plan([0.1, 0.27, 0.78, 0.065, 0.78, 0.025, 0.1, 0.235], 0.04), { bone: B.wingL, color: TURQ_D, mirror: B.wingR, outline: 0 });
  b.put(plan([0, -0.1, 0.38, -0.16, 0.4, -0.09, 0, 0.13], 0.03), { bone: B.wtail, color: TURQ_D, mirror: B.wtail, outline: 0.6 });
  if (b.fine)
    b.put(plan([0.3, -0.15, 0.38, -0.16, 0.4, -0.09, 0.3, -0.06], 0.034), { bone: B.wtail, color: TRIM, mirror: B.wtail, outline: 0 });
}

/** Bert: breite Flossen wie Walross-Flossen, hinten ein Schubpropeller aus Holz. */
function wingsBert(c: Ctx): void {
  const b = c.b;
  const YEL = c.p.base;
  const YEL_D = c.p.dark;
  const RIM = trim(c, 0xfff6e2);
  b.put(plan([0, -0.1, 0.5, -0.2, 0.5, 0.18, 0, 0.1], 0.05), { bone: B.wingL, color: YEL, mirror: B.wingR, outline: 0.75 });
  const paddle = [0, -0.2, 0.2, -0.27, 0.38, -0.24, 0.48, -0.12, 0.5, 0.0, 0.46, 0.13, 0.32, 0.24, 0.14, 0.24, 0, 0.18];
  b.put(plan(paddle, 0.05), { bone: B.tipL, color: YEL, mirror: B.tipR, outline: 0.75 });
  // Zehenstriche
  if (b.fine)
    for (const z of [-0.09, 0.07])
      b.put(box(0.22, 0.056, 0.026), { bone: B.tipL, color: YEL_D, pos: [0.3, 0, z], rot: [0, z * 1.6, 0], mirror: B.tipR, outline: 0 });
  // Propeller: Welle, Nabe, drei verdrehte Holzblätter mit hellen Spitzen
  const P = B.wtail;
  b.put(cyl(0.03, 0.03, 0.16, 5), { bone: P, color: DARK, pos: [0, 0, -0.06], rot: [HALF_PI, 0, 0], outline: 0.55 });
  b.put(cone(0.07, 0.13, b.s(8, 6)), { bone: P, color: CHROME, pos: [0, 0, -0.14], rot: [-HALF_PI, 0, 0], outline: 0.6 });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU;
    const s = Math.sin(a);
    const co = Math.cos(a);
    b.put(box(0.085, 0.27, 0.02), { bone: P, color: 0xc98a4b, pos: [s * 0.165, co * 0.165, -0.15], rot: [0, 0.5, -a], order: 'ZYX', outline: 0.6 });
    if (b.fine)
      b.put(box(0.087, 0.06, 0.024), { bone: P, color: RIM, pos: [s * 0.27, co * 0.27, -0.15], rot: [0, 0.5, -a], order: 'ZYX', outline: 0 });
  }
}

/** Zoe: kantiges Delta mit Blitz-Zacken an der Hinterkante und hochgestellten Winglets. */
function wingsZoe(c: Ctx): void {
  const b = c.b;
  const VIO = c.p.base;
  const VIO_D = c.p.dark;
  const ACC = c.p.accent;
  // prettier-ignore
  const inner = [0, -0.22, 0.12, -0.22, 0.2, -0.13, 0.3, -0.22, 0.42, -0.22, 0.5, -0.13, 0.6, -0.22, 0.72, -0.22, 0.72, 0.057, 0, 0.38];
  b.put(plan(inner, 0.04), { bone: B.wingL, color: VIO, mirror: B.wingR, outline: 0.7 });
  b.put(plan([0, -0.22, 0.26, -0.22, 0.26, -0.06, 0, 0.057], 0.04), { bone: B.tipL, color: VIO_D, mirror: B.tipR, outline: 0.7 });
  // Winglet: senkrechte Platte, leicht nach außen gekippt
  b.put(prism([-0.24, 0, -0.02, 0, -0.15, 0.24, -0.26, 0.26], 0.03), {
    bone: B.tipL,
    color: ACC,
    pos: [0.26, 0, 0],
    rot: [0, -HALF_PI, -0.25],
    order: 'ZYX',
    mirror: B.tipR,
    outline: 0.65,
  });
  // heller Keil an der Vorderkante
  if (b.fine) b.put(plan([0.06, 0.34, 0.6, 0.11, 0.6, 0.06, 0.06, 0.29], 0.046), { bone: B.wingL, color: c.p.light, mirror: B.wingR, outline: 0 });
}

const WING_BUILDERS = [wingsKalle, wingsVera, wingsBert, wingsZoe];

// ───────────────────────────── Tauchausrüstung ─────────────────────────────
//
// Unter Wasser legt jede Figur ihre Ausrüstung an – nach dem Muster der
// Gleitflügel: alles steckt im Netz des Karts und hängt an eigenen Knochen,
// die außerhalb des Wassers auf null geschrumpft sind. Kopf-Ausrüstung am
// Knochen dHead (Koordinaten relativ zu seinem Drehpunkt spec.diveHead im
// Kopf), Karosserie-Teile an dBody, Schrauben an dPropL/R. Dazu kommen drei
// aufsteigende Blasen und je Auspuff ein Blasenstrahl (bei Schub statt der
// Flammen).

const BUBBLE = 0xe8fbff;

/**
 * Riemen um den Hinterkopf: Bogen auf dem (etwas aufgeblähten) Kopf-Ellipsoid
 * in Höhe y, von Winkel phi0 (0 = vorn) links über hinten nach rechts. Die
 * Lage ist relativ zur Kopfmitte; o verschiebt sie in den Raum von dHead.
 */
function headBand(b: Builder, R: V3, y: number, phi0: number, color: number, o: V3, r = 0.016): void {
  const pts: V3[] = [];
  const n = 4;
  const k = 1.05;
  const f = Math.sqrt(Math.max(1 - (y / (R[1] * k)) ** 2, 0.05));
  for (let i = 0; i <= n; i++) {
    const a = phi0 + ((TAU - 2 * phi0) * i) / n;
    pts.push([R[0] * k * f * Math.sin(a) + o[0], y + o[1], R[2] * k * f * Math.cos(a) + o[2]]);
  }
  b.put(sweep(pts, r, 3), { bone: B.dHead, color, outline: 0 });
}

/** Schiffsschraube am Knochen dPropL (gespiegelt an dPropR): Nabe nach hinten, zwei gekreuzte, angestellte Blätter. */
function propeller(b: Builder, r: number, blade: number, color: number, twin: boolean): void {
  const mirror = twin ? B.dPropR : undefined;
  b.put(cone(r * 0.3, r * 0.55, b.s(6, 5)), { bone: B.dPropL, color: CHROME, rot: [-HALF_PI, 0, 0], mirror, outline: 0 });
  for (const a of [0, HALF_PI])
    b.put(box(blade, r * 2, 0.016), { bone: B.dPropL, color, pos: [0, 0, -0.02], rot: [0, 0.55, a], order: 'ZYX', mirror, outline: 0.5 });
}

/** Kalle: Taucherbrille (Gummirahmen um beide Augen, sitzt auf der Schnauze), Schnorchel, Heckschraube. */
function diveKalle(c: Ctx): void {
  const b = c.b;
  const G = B.dHead;
  const R: V3 = [0.33, 0.29, 0.3];
  // Alles relativ zur Kopfmitte angegeben; dHead sitzt vorn auf dem Gesicht,
  // damit die Ausrüstung beim Auf- und Abploppen nicht im Kopf verschwindet.
  const h = c.sp.diveHead;
  const o: V3 = [-h[0], 0.3 - h[1], -h[2]];
  const at = (x: number, y: number, z: number): V3 => [x + o[0], y + o[1], z + o[2]];
  // Rahmen: Ring auf dem Kopf-Ellipsoid rund um beide Augen
  const loop: V3[] = [];
  for (let k = 0; k <= 8; k++) {
    const a = (k / 8) * TAU;
    const x = 0.235 * Math.cos(a);
    const y = 0.045 + 0.085 * Math.sin(a);
    const q = 1 - (x / (R[0] * 1.07)) ** 2 - (y / (R[1] * 1.07)) ** 2;
    loop.push(at(x, y, R[2] * 1.07 * Math.sqrt(Math.max(q, 0.05))));
  }
  b.put(sweep(loop, 0.027, 3), { bone: G, color: DARK, outline: 0 });
  // Glanzstrich auf dem Glas
  b.put(box(0.065, 0.014, 0.008), { bone: G, color: WHITE, pos: at(0.205, 0.1, 0.25), rot: [-0.3, 0.6, 0.55], outline: 0 });
  headBand(b, R, 0.045, 0.79, DARK, o);
  // Schnorchel: Mundstück in der Schnauze, steigt links vor dem Ohr auf
  b.put(
    sweep(
      [
        at(0.12, -0.09, 0.33),
        at(0.29, -0.07, 0.2),
        at(0.36, 0.15, 0.12),
        at(0.34, 0.47, 0.07),
      ],
      0.03,
      4,
    ),
    { bone: G, color: c.p.accent, outline: 0.7 },
  );
  // Heckschraube auf kurzer Welle unter der Startnummer
  b.put(box(0.04, 0.04, 0.14), { bone: B.dBody, color: DARK, pos: [0, 0, -0.07], outline: 0 });
  propeller(b, 0.16, 0.07, trim(c, 0xffefd2), false);
}

/** Vera: die Fliegerbrille rutscht über die Augen (siehe buildVera), Schrauben in den Auspufftrichtern, Flossen obenauf. */
function diveVera(c: Ctx): void {
  const b = c.b;
  b.put(prism([0.24, 0.03, -0.03, 0.03, -0.06, 0.17, 0.04, 0.17], 0.03), {
    bone: B.dBody,
    color: c.p.dark,
    pos: [0.33, 0, 0],
    rot: [0, -HALF_PI, 0],
    mirror: B.dBody,
    outline: 0.6,
  });
  propeller(b, 0.105, 0.05, trim(c, WHITE), true);
}

/** Bert: nur eine Schwimmbrille – und ein Außenborder an der Wanne. */
function diveBert(c: Ctx): void {
  const b = c.b;
  const G = B.dHead;
  const NAVY = 0x2e4372;
  const R: V3 = [0.35, 0.3, 0.31];
  // relativ zur Kopfmitte, dHead sitzt vorn zwischen den Augen (siehe Kalle)
  const h = c.sp.diveHead;
  const o: V3 = [-h[0], 0.29 - h[1], -h[2]];
  const at = (x: number, y: number, z: number): V3 => [x + o[0], y + o[1], z + o[2]];
  // Brillengläser: Ringe um die Augen, Steg über der Nase, Riemen nach hinten
  const lens = new THREE.TorusGeometry(0.07, 0.019, 3, b.s(7, 6));
  lens.rotateX(-HALF_PI);
  b.put(lens, { bone: G, color: NAVY, pos: at(0.116, 0.085, 0.3), aim: [0.28, 0.28, 0.92], mirror: G, outline: 0 });
  b.put(box(0.06, 0.022, 0.022), { bone: G, color: NAVY, pos: at(0, 0.095, 0.322), outline: 0 });
  headBand(b, R, 0.085, 0.62, NAVY, o);
  // Außenborder: Klemme am Wannenrand, Motorhaube, Schaft, Schraube
  const D = B.dBody;
  b.put(box(0.18, 0.17, 0.26), { bone: D, color: c.p.dark, pos: [0, 0.11, -0.17], outline: 0.75 });
  b.put(box(0.06, 0.46, 0.08), { bone: D, color: DARK, pos: [0, -0.21, -0.17], outline: 0.6 });
  propeller(b, 0.12, 0.06, trim(c, 0xfff6e2), false);
}

/** Zoe: Glaskuppel über Kopf und Ohren – Katzen und Wasser … –, oben ein Ventil. */
function diveZoe(c: Ctx): void {
  const b = c.b;
  const G = B.dHead;
  const r = 0.47;
  const hole = 1.0;
  // Kuppel: Kugel mit runder Öffnung vorn (das Gesicht schaut heraus)
  const ws = b.s(10, 6);
  // Beginn bei −90°: eine Kante der Facetten läuft genau über den Scheitel (dort sitzt die Naht).
  const dome = new THREE.SphereGeometry(r, ws, b.s(4, 3), -HALF_PI, TAU, hole, Math.PI - hole);
  dome.rotateX(HALF_PI);
  b.put(dome, { bone: G, color: 0xc4ecff });
  const rim = new THREE.TorusGeometry(r * Math.sin(hole), 0.032, 3, ws);
  b.put(rim, { bone: G, color: c.p.dark, pos: [0, 0, r * Math.cos(hole)], outline: 0 });
  // Naht vom Rand über den Scheitel nach hinten – gibt der Kuppel von hinten Halt
  const seam = new THREE.TorusGeometry(r + 0.006, 0.022, 3, b.s(6, 4), Math.PI - 0.25);
  seam.rotateY(-HALF_PI);
  seam.rotateX(-hole);
  b.put(seam, { bone: G, color: c.p.dark, outline: 0 });
  // Glanzstriche vorn links und hinten rechts (auf Höhe der Facetten, nicht der Ecken)
  const gr = r * Math.cos(Math.PI / ws) + 0.006;
  const glints = [
    [0.62, 0.66, 0.36],
    [-0.45, 0.7, -0.55],
  ] as const;
  if (b.fine)
    for (const d of glints) {
      const l = Math.hypot(d[0], d[1], d[2]);
      b.put(box(0.17, 0.008, 0.035), { bone: G, color: WHITE, pos: [(d[0] / l) * gr, (d[1] / l) * gr, (d[2] / l) * gr], aim: d, outline: 0 });
    }
  const vd: V3 = [0, 0.906, -0.423];
  b.put(cyl(0.028, 0.04, 0.07, 5), { bone: G, color: c.p.accent, pos: [0, vd[1] * (r + 0.025), vd[2] * (r + 0.025)], aim: vd, outline: 0 });
}

const DIVE_BUILDERS = [diveKalle, diveVera, diveBert, diveZoe];

/** Drei Blasen, die aus Schnorchel, Mund oder Ventil aufsteigen. */
function diveBubbles(b: Builder): void {
  for (let i = 0; i < 3; i++) b.put(sphere(0.045, 0.045, 0.045, 6, 3), { bone: B.bub0 + i, color: BUBBLE, outline: 0 });
}

/**
 * Blasenstrahl bei Schub unter Wasser: steckt im Netz der Flammen (leuchtend,
 * nur bei Bedarf sichtbar) – kostet also weder Dreiecke im Normalfall noch
 * einen eigenen Zeichenaufruf. Entlang +z der Knochen jetL/R, wie die Flammen.
 */
function buildJets(b: Builder): void {
  for (const bone of [B.jetL, B.jetR]) {
    b.put(sphere(0.065, 0.065, 0.065, 6, 3), { bone, color: 0x8fd6ea, pos: [0, 0, 0.08] });
    b.put(sphere(0.05, 0.05, 0.05, 6, 3), { bone, color: 0x76c4dc, pos: [0.03, 0.02, 0.2] });
    b.put(sphere(0.038, 0.038, 0.038, 5, 3), { bone, color: 0x5fb0cc, pos: [-0.02, 0.035, 0.31] });
  }
}

// ───────────────────────────── Effekte ─────────────────────────────

/** Schutzring, Blitze und Qualm – ein Netz, sichtbar nur bei Bedarf. */
function buildFx(b: Builder, color: number): void {
  // Stoßfänger: verchromter Ring mit drei Gummipuffern in Spielerfarbe
  const ring = new THREE.TorusGeometry(1.2, 0.058, 4, b.s(22, 12));
  ring.rotateX(HALF_PI);
  b.put(ring, { bone: B.guard, color: CHROME });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU;
    const pos: V3 = [Math.sin(a) * 1.2, 0, Math.cos(a) * 1.2];
    b.put(sphere(0.24, 0.115, 0.1, 6, 4), { bone: B.guard, color, pos, rot: [0, a, 0], hull: box(0.36, 0.17, 0.14) });
    if (b.fine)
      b.put(box(0.26, 0.045, 0.02), {
        bone: B.guard,
        color: WHITE,
        pos: [Math.sin(a) * 1.292, 0, Math.cos(a) * 1.292],
        rot: [0, a, 0],
        outline: 0,
      });
  }
  // Kurzschluss: zwei Blitze …
  b.put(prism(BOLT, 0.035), { bone: B.bolt0, color: 0xfff06a, scale: 0.5, outline: 0.6 });
  b.put(prism(BOLT, 0.035), { bone: B.bolt1, color: 0xfff06a, scale: 0.42, outline: 0.6 });
  // … und zwei Qualmwölkchen
  for (const bone of [B.puff0, B.puff1]) {
    const dark = bone === B.puff1;
    b.put(sphere(0.15, 0.13, 0.14, 6, 4), { bone, color: dark ? 0x8f8898 : 0xb5afbf, outline: 0.6 });
    b.put(sphere(0.115, 0.1, 0.11, 6, 4), { bone, color: dark ? 0x9e97a8 : 0xc6c1ce, pos: [0.13, 0.05, 0.02], outline: 0.6 });
    if (b.fine)
      b.put(sphere(0.1, 0.09, 0.1, 5, 3), { bone, color: dark ? 0x8f8898 : 0xb5afbf, pos: [-0.12, 0.06, -0.03], outline: 0.6 });
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

// ───────────────────────────── Items ─────────────────────────────
//
// Gegenstände in der Hand und der Abschleppdrache. Sie hängen nicht im
// Netz der Figur: jeder Gegenstand ist ein eigenes kleines Netz (+ Kontur),
// dessen Geometrie sich alle Karts teilen. Gebaut wird mit demselben Builder
// wie die Karts, nur mit einem einzigen (ruhenden) Knochen.
//
// Gegenstand: Ursprung = Griff (dort sitzt die Faust), +y oben, +z vorn,
// −x außen – gehalten wird immer rechts.

// Item-Nummern wie in game/sim.ts (3 Ölfleck und 7 Nebelkerze brauchen hier keinen Namen)
const I_BOOST = 1;
const I_TIRE = 2;
const I_TOP = 4;
const I_GUARD = 5;
const I_EMP = 6;
const I_SPRING = 8;
const I_KITE = 9;
const I_COUNT = 10;

// Farben des Brummkreisels auf der Strecke (things.ts) – auch sonst die Item-Farben.
const I_RED = 0xff5a4e;
const I_YEL = 0xffd23f;
const I_TURQ = 0x1fc8b6;
const I_INK = 0x2d2a36;

interface ItemGeo {
  main: THREE.BufferGeometry;
  line: THREE.BufferGeometry | null;
}

const ONE_BONE = [new THREE.Matrix4()];

function finishItem(b: Builder): ItemGeo {
  const { main, outline } = b.finish();
  // Kein Skelett: Knochen-Attribute weg, echte Hülle fürs Culling.
  main.deleteAttribute('skinIndex');
  main.deleteAttribute('skinWeight');
  main.computeBoundingSphere();
  if (outline) {
    outline.deleteAttribute('skinIndex');
    outline.deleteAttribute('skinWeight');
    outline.computeBoundingSphere();
  }
  return { main, line: outline };
}

/** Zisch: Sprudelflasche mit Blitz auf dem Etikett und Korken. */
function buildBottle(b: Builder): void {
  const GLASS = 0x3fd08c;
  b.put(
    lathe(
      [
        [0, -0.07, GLASS],
        [0.1, -0.07],
        [0.124, -0.04],
        [0.126, 0.0, I_RED, true],
        [0.126, 0.15, GLASS, true],
        [0.118, 0.19],
        [0.078, 0.255],
        [0.047, 0.3],
        [0.045, 0.335],
        [0, 0.335],
      ],
      14,
    ),
    { bone: 0 },
  );
  b.put(
    lathe(
      [
        [0, 0.32, 0xc98a4b],
        [0.042, 0.32],
        [0.058, 0.37],
        [0.056, 0.415],
        [0, 0.42],
      ],
      10,
    ),
    { bone: 0 },
  );
  for (const s of [1, -1])
    b.put(prism(BOLT, 0.02), {
      bone: 0,
      color: I_YEL,
      pos: [0, 0.075, s * 0.128],
      rot: [0, s > 0 ? 0 : Math.PI, 0],
      scale: [0.2, 0.17, 1],
      outline: 0.45,
    });
  // Glanzlicht
  b.put(box(0.022, 0.1, 0.01), { bone: 0, color: 0xdffbea, pos: [0.055, 0.21, -0.1], rot: [-0.45, 0, -0.5], outline: 0 });
}

/** Rollreifen: Gummi mit Profilstollen, gelbe Nabe; Achse entlang z (Ring zeigt zur Kamera). */
function buildTire(b: Builder): void {
  const C: V3 = [-0.07, 0.21, 0];
  b.put(new THREE.TorusGeometry(0.165, 0.08, 8, 18), { bone: 0, color: 0x3a3745, pos: C });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    b.put(box(0.06, 0.05, 0.15), {
      bone: 0,
      color: 0x2a2733,
      pos: [C[0] + Math.sin(a) * 0.236, C[1] + Math.cos(a) * 0.236, 0],
      rot: [0, 0, -a],
      outline: 0.55,
    });
  }
  b.put(cyl(0.095, 0.095, 0.11, 12), { bone: 0, color: I_YEL, pos: C, rot: [HALF_PI, 0, 0], outline: 0.6 });
  b.put(cyl(0.035, 0.035, 0.13, 8), { bone: 0, color: WHITE, pos: C, rot: [HALF_PI, 0, 0], outline: 0.4 });
}

/** Ölfleck: Ölkanne mit langer Tülle, der Tropfen hängt schon dran. Griff innen, Tülle nach außen. */
function buildOilCan(b: Builder): void {
  const X = -0.2;
  b.put(
    lathe(
      [
        [0, -0.06, 0xe8473d],
        [0.13, -0.06],
        [0.136, -0.035],
        [0.136, 0.0, I_YEL, true],
        [0.136, 0.045, 0xe8473d, true],
        [0.136, 0.1],
        [0.124, 0.122, 0xc9d2de, true],
        [0.05, 0.2],
        [0.036, 0.222],
        [0, 0.224],
      ],
      14,
    ),
    { bone: 0, pos: [X, 0, 0] },
  );
  b.put(
    sweep(
      [
        [X, 0.19, 0],
        [X - 0.05, 0.25, 0],
        [X - 0.14, 0.3, 0],
        [X - 0.24, 0.33, 0],
      ],
      (t) => 0.026 - 0.013 * t,
      6,
      8,
    ),
    { bone: 0, color: 0xb7c2d2, outline: 0.7 },
  );
  b.put(sphere(0.032, 0.045, 0.032, 8, 6), { bone: 0, color: 0x2c2440, pos: [X - 0.255, 0.285, 0], outline: 0.7 });
  b.put(sphere(0.01, 0.014, 0.01, 5, 4), { bone: 0, color: 0xcfc6ee, pos: [X - 0.265, 0.295, -0.026], outline: 0 });
  // Henkel: Halbring auf der Innenseite
  b.put(new THREE.TorusGeometry(0.072, 0.02, 5, 10, Math.PI), {
    bone: 0,
    color: I_INK,
    pos: [X + 0.128, 0.03, 0],
    rot: [0, 0, -HALF_PI],
    outline: 0.7,
  });
}

/** Brummkreisel: wie auf der Strecke, nur klein; steht auf seiner Spitze in der Hand. */
function buildTop(b: Builder): void {
  const k = 0.27;
  const prof: LP[] = [
    [0, 0, I_RED],
    [0.5 * k, 0.45 * k],
    [0.78 * k, 0.72 * k, I_YEL],
    [0.8 * k, 0.86 * k],
    [0.6 * k, 1.02 * k, I_TURQ],
    [0.14 * k, 1.1 * k],
    [0.11 * k, 1.5 * k],
    [0.2 * k, 1.56 * k],
    [0, 1.62 * k],
  ];
  // Streifen auf dem roten Bauch – damit man das Drehen sieht.
  b.put(
    lathe(prof, 16, (band, j) => (band < 2 && j % 4 === 1 ? WHITE : band === 2 && j % 4 === 3 ? I_RED : undefined)),
    { bone: 0, pos: [0, 0.03, 0] },
  );
}

/** Stoßfänger: Wappenschild mit Chromrand und Gummi-Stoßleiste quer darüber. */
function buildShield(b: Builder): void {
  const SHIELD = [0, 1, 0.85, 0.74, 0.85, 0.05, 0.72, -0.38, 0.42, -0.74, 0, -1, -0.42, -0.74, -0.72, -0.38, -0.85, 0.05, -0.85, 0.74];
  const C: V3 = [0, 0.23, 0];
  b.put(prism(SHIELD, 0.06), { bone: 0, color: 0xdfe6f2, pos: C, scale: [0.21, 0.21, 1] });
  b.put(prism(SHIELD, 0.085), { bone: 0, color: 0x4aa6ff, pos: C, scale: [0.16, 0.16, 1], outline: 0.4 });
  b.put(prism(BOLT, 0.1), { bone: 0, color: WHITE, pos: [0, C[1] - 0.06, 0], scale: [0.16, 0.13, 1], outline: 0 });
  b.put(b.soft(0.44, 0.07, 0.12, 0.025, 10), { bone: 0, color: I_INK, pos: [0, C[1] + 0.05, 0], outline: 0.75 });
}

/** Kurzschluss: Stecker mit zwei Stiften und abgerissenem Kabel. */
function buildPlug(b: Builder): void {
  const BODY = 0x9b87ff;
  b.put(b.soft(0.25, 0.21, 0.17, 0.045, 12), { bone: 0, color: BODY, pos: [0, 0.15, 0] });
  b.put(cyl(0.06, 0.08, 0.08, 10), { bone: 0, color: 0x6b5bd6, pos: [0, 0.02, 0], outline: 0.7 });
  b.put(box(0.036, 0.13, 0.016), { bone: 0, color: CHROME, pos: [0.058, 0.31, 0], outline: 0.6, mirror: 0 });
  for (const s of [1, -1])
    b.put(prism(BOLT, 0.012), {
      bone: 0,
      color: I_YEL,
      pos: [0, 0.15, s * 0.088],
      rot: [0, s > 0 ? 0 : Math.PI, 0],
      scale: [0.16, 0.14, 1],
      outline: 0.4,
    });
  b.put(
    sweep(
      [
        [0, 0.0, 0],
        [0, -0.06, -0.01],
        [-0.04, -0.11, -0.03],
        [-0.1, -0.13, -0.06],
      ],
      0.022,
      6,
      10,
    ),
    { bone: 0, color: I_INK, outline: 0.7 },
  );
  // Kupferlitzen am Kabelende
  b.put(cone(0.024, 0.06, 5), { bone: 0, color: 0xe08a3c, pos: [-0.1, -0.13, -0.06], aim: [-0.8, -0.3, -0.5], outline: 0.5 });
}

/** Nebelkerze: Dose mit Streifen, Lunte und Funken. */
function buildSmokeCan(b: Builder): void {
  const GREY = 0xe4e0ec;
  b.put(
    lathe(
      [
        [0, -0.05, GREY],
        [0.1, -0.05],
        [0.106, -0.03],
        [0.106, 0.05, 0xff8a3c, true],
        [0.106, 0.12, GREY, true],
        [0.106, 0.21],
        [0.096, 0.232, 0x8f8898, true],
        [0.058, 0.25],
        [0, 0.252],
      ],
      14,
    ),
    { bone: 0 },
  );
  // Wölkchen auf dem Etikett, vorn und hinten
  for (const s of [1, -1])
    for (let i = 0; i < 3; i++)
      b.put(sphere(0.032 + (i === 1 ? 0.012 : 0), 0.026 + (i === 1 ? 0.01 : 0), 0.012, 6, 4), {
        bone: 0,
        color: WHITE,
        pos: [(i - 1) * 0.04, 0.085 + (i === 1 ? 0.008 : 0), s * 0.104],
        outline: 0.3,
      });
  b.put(
    sweep(
      [
        [0, 0.24, 0],
        [0.018, 0.29, 0],
        [-0.02, 0.34, 0.01],
        [-0.006, 0.39, 0],
      ],
      0.012,
      5,
      10,
    ),
    { bone: 0, color: 0x6b4a2e, outline: 0.5 },
  );
  // Funke: Stern aus zwei gekreuzten Scheiben
  const star: number[] = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU;
    const r = i % 2 === 0 ? 1 : 0.42;
    star.push(Math.sin(a) * r, Math.cos(a) * r);
  }
  for (const ry of [0, HALF_PI])
    b.put(prism(star, 0.02), { bone: 0, color: 0xffe04a, pos: [-0.006, 0.405, 0], rot: [0, ry, 0], scale: [0.075, 0.075, 1], outline: 0.45 });
  b.put(sphere(0.026, 0.026, 0.026, 6, 4), { bone: 0, color: 0xff8a1c, pos: [-0.006, 0.405, 0], outline: 0 });
}

/** Sprungfeder: gelbe Spirale zwischen zwei roten Tellern. */
function buildSpring(b: Builder): void {
  const path: V3[] = [];
  const N = 64;
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * 4.5 * TAU;
    path.push([Math.cos(a) * 0.1, 0.03 + (i / N) * 0.31, Math.sin(a) * 0.1]);
  }
  b.put(sweep(path, 0.022, 6), { bone: 0, color: I_YEL, outline: 0.7 });
  b.put(cyl(0.135, 0.135, 0.04, 14), { bone: 0, color: I_RED, pos: [0, 0.01, 0] });
  b.put(cyl(0.135, 0.135, 0.04, 14), { bone: 0, color: I_RED, pos: [0, 0.36, 0] });
}

/** Abschleppdrache, zusammengefaltet: schmale Raute mit Augen, Schwanz aufgerollt. */
function buildKiteFolded(b: Builder): void {
  const RHOMB = [0, 0.46, 0.13, 0.22, 0, 0.04, -0.13, 0.22];
  b.put(prism(RHOMB, 0.035), { bone: 0, color: I_YEL, pos: [0, -0.022, 0], scale: [1.18, 1.1, 1] });
  b.put(prism(RHOMB, 0.05), { bone: 0, color: I_RED, outline: 0.5 });
  for (const s of [1, -1]) {
    b.put(sphere(0.032, 0.036, 0.012, 6, 4), { bone: 0, color: WHITE, pos: [0.046, 0.26, s * 0.026], mirror: 0, outline: 0.5 });
    b.put(sphere(0.014, 0.02, 0.008, 5, 3), { bone: 0, color: I_INK, pos: [0.04, 0.255, s * 0.035], mirror: 0, outline: 0 });
  }
  b.put(cone(0.022, 0.08, 6), { bone: 0, color: I_TURQ, pos: [0.04, 0.39, 0], aim: [0.5, 1, 0], mirror: 0, outline: 0.5 });
  b.put(cyl(0.011, 0.011, 0.5, 5), { bone: 0, color: 0x6b4a2e, pos: [0, 0.23, 0.032], outline: 0.4 });
  b.put(
    sweep(
      [
        [0, 0.04, 0],
        [-0.04, 0.0, 0],
        [-0.08, -0.05, 0],
        [-0.07, -0.11, 0],
      ],
      0.01,
      5,
      8,
    ),
    { bone: 0, color: I_INK, outline: 0.4 },
  );
  b.put(prism([0, 0, -0.06, 0.035, -0.06, -0.035], 0.02), { bone: 0, color: I_YEL, pos: [-0.07, -0.11, 0], mirror: 0, outline: 0.5 });
}

let itemGeos: ItemGeo[] | null = null;

/** Alle Gegenstände – einmal gebaut, von allen Karts geteilt. Index = Item. */
function getItemGeos(): ItemGeo[] {
  if (itemGeos) return itemGeos;
  const fns = [buildBottle, buildTire, buildOilCan, buildTop, buildShield, buildPlug, buildSmokeCan, buildSpring, buildKiteFolded];
  const out: ItemGeo[] = [];
  for (let i = 0; i < I_COUNT; i++) {
    const b = new Builder(ONE_BONE, 2, true);
    if (i > 0) fns[i - 1](b);
    else b.put(box(0.001, 0.001, 0.001), { bone: 0, outline: 0 });
    out.push(finishItem(b));
  }
  itemGeos = out;
  return out;
}

// Der fliegende Drache: eigenes kleines Skelett – Knochen 0 der Drache,
// 1..6 der Schwanz (Kette von der unteren Spitze abwärts).
const KITE_BONES = 7;
const KITE_TIP = 1.0;
const KITE_STEP = 0.3;
/** Wo die Leine angeknotet ist (Knochen 0, Vorderseite). */
const KITE_BRIDLE: V3 = [0, -0.14, -0.045];
const KITE_REST: THREE.Matrix4[] = [];
for (let i = 0; i < KITE_BONES; i++)
  KITE_REST.push(new THREE.Matrix4().makeTranslation(0, i === 0 ? 0 : -KITE_TIP - (i - 1) * KITE_STEP, 0));
/** Großzügige Hülle (im Raum von root) für Start, Flug und Abflug. */
/** Größe des fliegenden Drachens: aus der Fahrkamera muss er auch bei vollem Tempo auffallen. */
const KITE_SCALE = 2.1;
const KITE_BOUNDS = new THREE.Sphere(new THREE.Vector3(0, 4, 6), 13);

let kiteGeo: { main: THREE.BufferGeometry; outline: THREE.BufferGeometry | null } | null = null;

/**
 * Großer Comic-Drachen, Gesicht nach −z (zum Kart hin): Raute mit gelbem
 * Rand, Drachenaugen, Hörner, Zacken, Barteln und Maul; dahinter das Kreuz.
 */
function getKiteGeo(): { main: THREE.BufferGeometry; outline: THREE.BufferGeometry | null } {
  if (kiteGeo) return kiteGeo;
  const b = new Builder(KITE_REST, 2, true);
  const DIAMOND = [0, 0.6, 0.64, 0, 0, -KITE_TIP, -0.64, 0];
  const F = -0.03; // Vorderseite
  b.put(prism(DIAMOND, 0.03), { bone: 0, color: I_YEL, pos: [0, -0.02, 0.008], scale: [1.09, 1.06, 1] });
  b.put(prism(DIAMOND, 0.05), { bone: 0, color: I_RED, outline: 0.6 });
  // heller Bauch unten
  b.put(prism([0, -0.3, 0.3, -0.53, 0, -0.9, -0.3, -0.53], 0.054), { bone: 0, color: 0xff8a6a, outline: 0 });
  // Augen: weiß, gelbe Iris, Schlitzpupille, böse Brauen
  b.put(sphere(0.17, 0.15, 0.05, 12, 8), { bone: 0, color: WHITE, pos: [0.22, 0.06, F], mirror: 0, outline: 0.9 });
  b.put(sphere(0.105, 0.105, 0.03, 10, 6), { bone: 0, color: I_YEL, pos: [0.2, 0.04, F - 0.035], mirror: 0, outline: 0 });
  b.put(sphere(0.026, 0.085, 0.02, 6, 6), { bone: 0, color: I_INK, pos: [0.2, 0.04, F - 0.058], mirror: 0, outline: 0 });
  b.put(sphere(0.022, 0.022, 0.01, 5, 4), { bone: 0, color: WHITE, pos: [0.24, 0.09, F - 0.07], mirror: 0, outline: 0 });
  b.put(box(0.3, 0.065, 0.04), { bone: 0, color: I_INK, pos: [0.21, 0.25, F - 0.02], rot: [0, 0, 0.38], mirror: 0, outline: 0.5 });
  // Nüstern
  b.put(sphere(0.035, 0.025, 0.02, 6, 4), { bone: 0, color: 0x8a2028, pos: [0.075, -0.2, F - 0.02], mirror: 0, outline: 0 });
  // Maul mit Zähnen
  b.put(prism([-0.3, -0.33, 0.3, -0.33, 0.2, -0.47, 0, -0.53, -0.2, -0.47], 0.02), {
    bone: 0,
    color: 0x6b1f2a,
    pos: [0, 0, F - 0.005],
    outline: 0.5,
  });
  b.put(prism([-0.045, 0, 0.045, 0, 0, -0.1], 0.02), { bone: 0, color: WHITE, pos: [0.14, -0.335, F - 0.016], mirror: 0, outline: 0.35 });
  b.put(prism([-0.03, 0, 0.03, 0, 0, -0.06], 0.02), { bone: 0, color: WHITE, pos: [0.04, -0.335, F - 0.016], mirror: 0, outline: 0.35 });
  // Hörner auf den oberen Kanten, Zacken an den unteren, eine Spitze oben
  b.put(cone(0.075, 0.3, 8), { bone: 0, color: I_TURQ, pos: [0.22, 0.38, 0], aim: [0.55, 1, 0], mirror: 0 });
  b.put(cone(0.06, 0.2, 4), { bone: 0, color: I_TURQ, pos: [0, 0.58, 0], scale: [1, 1, 0.45] });
  const ex = 0.64;
  const ey = KITE_TIP;
  const nl = Math.hypot(ey, ex);
  for (let i = 1; i <= 3; i++) {
    const t = i / 4;
    b.put(cone(0.075, 0.17, 4), {
      bone: 0,
      color: I_TURQ,
      pos: [ex * (1 - t), -ey * t, 0],
      aim: [ey / nl, -ex / nl, 0],
      scale: [1, 1, 0.45],
      mirror: 0,
    });
  }
  // Barteln aus den Mundwinkeln
  b.put(
    sweep(
      [
        [0.29, -0.36, F],
        [0.44, -0.42, F],
        [0.52, -0.56, F],
        [0.45, -0.68, F],
      ],
      (t) => 0.022 - 0.01 * t,
      5,
      10,
    ),
    { bone: 0, color: I_YEL, mirror: 0, outline: 0.6 },
  );
  // Kreuz hinten
  b.put(cyl(0.02, 0.02, 1.58, 5), { bone: 0, color: 0x6b4a2e, pos: [0, -0.2, 0.045], outline: 0.5 });
  b.put(cyl(0.02, 0.02, 1.26, 5), { bone: 0, color: 0x6b4a2e, pos: [0, 0, 0.045], rot: [0, 0, HALF_PI], outline: 0.5 });
  // Schwanz: Schnur je Knochen, an jedem Gelenk eine Schleife
  for (let i = 1; i < KITE_BONES; i++) {
    b.put(cyl(0.012, 0.012, KITE_STEP, 4), { bone: i, color: I_INK, pos: [0, -KITE_STEP / 2, 0], outline: 0.35 });
    const k = 1 - (i - 1) * 0.07;
    const color = i % 2 === 0 ? I_YEL : I_TURQ;
    const at = i === KITE_BONES - 1 ? -KITE_STEP : 0;
    if (i > 1 || at !== 0) {
      b.put(prism([0, 0, 0.15, 0.08, 0.15, -0.08], 0.025), { bone: i, color, pos: [0, at, 0], scale: k, mirror: i, outline: 0.6 });
      b.put(sphere(0.035, 0.035, 0.025, 6, 4), { bone: i, color, pos: [0, at, 0], scale: k, outline: 0.5 });
    }
    if (i === KITE_BONES - 1)
      b.put(prism([0, 0, 0.15, 0.08, 0.15, -0.08], 0.025), { bone: i, color: I_YEL, scale: k, mirror: i, outline: 0.6 });
  }
  kiteGeo = b.finish();
  return kiteGeo;
}

let leashGeo: THREE.BufferGeometry | null = null;
let leashMat: THREE.MeshBasicMaterial | null = null;

/** Gesten beim Einsetzen. Schlüsselbilder je Zeile: Anteil der Dauer, dann
 *  rechte Hand relativ zur Schulter (raus in Metern; hoch, vor in Metern für
 *  einen Arm von 0,5 m), Oberkörper (vorbeugen, eindrehen = rechte Schulter vor,
 *  nach rechts kippen) und Kopf (nicken). */
interface Gesture {
  dur: number;
  keys: readonly number[];
  /** Loslassen (Anteil der Dauer); −1: bleibt in der Hand und verpufft. */
  release: number;
  /** Flug nach dem Loslassen: raus, hoch, vor in m/s, Schwerkraft, Dauer. */
  fly?: readonly [number, number, number, number, number];
  /** Verpuffen in der Hand: von, bis (Anteil). */
  vanish?: readonly [number, number];
}

const KEY = 8;
/** Grundhaltung: Item neben dem Kopf (raus in Metern, hoch/vor für einen Arm von 0,5 m). */
const HOLD: V3 = [0.3, 0.3, 0.06];
/** Grundhaltung im Drachenzug: Hand an der Leine, vorn oben. */
const LEASH: V3 = [0.2, 0.16, 0.34];

const G_THROW: Gesture = {
  dur: 0.5,
  // prettier-ignore
  keys: [
    0, ...HOLD, 0, 0, 0, 0,
    0.3, 0.28, 0.32, -0.26, -0.12, -0.5, 0.06, -0.15,
    0.44, 0.1, 0.2, 0.34, 0.2, 0.4, -0.02, 0.15,
    0.62, 0.04, 0.04, 0.4, 0.24, 0.45, 0, 0.18,
    1, 0.14, 0.1, 0.24, 0, 0, 0, 0,
  ],
  release: 0.44,
  fly: [-1.6, 1.6, 9, 0, 0.15],
};
const G_BACK: Gesture = {
  dur: 0.55,
  // prettier-ignore
  keys: [
    0, ...HOLD, 0, 0, 0, 0,
    0.22, 0.12, 0.18, 0.3, 0.16, 0.3, 0, 0.12,
    0.46, 0.2, 0.44, -0.16, -0.16, -0.4, 0.06, -0.22,
    0.66, 0.26, 0.3, -0.3, -0.1, -0.45, 0.06, -0.1,
    1, 0.16, 0.1, 0.06, 0, 0, 0, 0,
  ],
  release: 0.46,
  fly: [0.6, 2.4, -5.5, 14, 0.2],
};
const GESTURES: (Gesture | null)[] = [
  null,
  // Zisch: Flasche hochreißen, Korken knallt, dann ducken in den Schub
  {
    dur: 0.6,
    // prettier-ignore
    keys: [
      0, ...HOLD, 0, 0, 0, 0,
      0.18, 0.2, 0.5, 0.06, -0.14, 0, -0.06, -0.3,
      0.36, 0.2, 0.48, 0.06, -0.1, 0, -0.04, -0.25,
      0.6, 0.1, 0.12, 0.26, 0.32, 0, 0, 0.3,
      1, 0.12, 0.06, 0.22, 0, 0, 0, 0,
    ],
    release: -1,
    vanish: [0.3, 0.42],
  },
  G_THROW, // Rollreifen
  G_BACK, // Ölfleck
  G_THROW, // Brummkreisel
  // Stoßfänger: in die Knie, dann nach oben stoßen
  {
    dur: 0.5,
    // prettier-ignore
    keys: [
      0, ...HOLD, 0, 0, 0, 0,
      0.2, 0.28, 0.1, 0.1, 0.06, 0, 0.1, 0.06,
      0.38, 0.2, 0.54, 0.06, -0.16, 0, -0.06, -0.28,
      0.6, 0.2, 0.46, 0.05, -0.08, 0, 0, -0.14,
      1, 0.16, 0.1, 0.1, 0, 0, 0, 0,
    ],
    release: 0.38,
    fly: [0, 6, 0.5, 0, 0.15],
  },
  // Kurzschluss: Stecker in den Himmel recken
  {
    dur: 0.6,
    // prettier-ignore
    keys: [
      0, ...HOLD, 0, 0, 0, 0,
      0.18, 0.18, 0.56, 0.1, -0.2, 0, -0.08, -0.36,
      0.7, 0.18, 0.56, 0.1, -0.2, 0, -0.08, -0.36,
      1, 0.16, 0.1, 0.1, 0, 0, 0, 0,
    ],
    release: -1,
    vanish: [0.7, 0.86],
  },
  G_BACK, // Nebelkerze
  // Sprungfeder: hoch und kräftig nach unten drücken
  {
    dur: 0.5,
    // prettier-ignore
    keys: [
      0, ...HOLD, 0, 0, 0, 0,
      0.18, 0.2, 0.46, 0.06, -0.1, 0, -0.06, -0.16,
      0.42, 0.34, -0.08, 0.04, 0.24, 0, 0.24, 0.24,
      0.62, 0.32, -0.04, 0.04, 0.18, 0, 0.18, 0.18,
      1, 0.18, 0.08, 0.08, 0, 0, 0, 0,
    ],
    release: -1,
    vanish: [0.46, 0.58],
  },
  // Abschleppdrache: ausholen, nach vorn-oben werfen, dann an die Leine
  {
    dur: 0.5,
    // prettier-ignore
    keys: [
      0, ...HOLD, 0, 0, 0, 0,
      0.16, 0.22, 0.16, -0.18, -0.08, -0.3, 0, -0.05,
      0.3, 0.12, 0.5, 0.26, 0.14, 0.25, -0.04, -0.28,
      0.55, 0.18, 0.3, 0.32, -0.12, 0.1, 0, -0.2,
      1, ...LEASH, -0.2, 0, 0, -0.14,
    ],
    release: 0.3,
    fly: [-0.5, 5, 6, 0, 0.15],
  },
];

function smooth01(x: number): number {
  const c = clamp(x, 0, 1);
  return c * c * (3 - 2 * c);
}

/** Schießt etwas über 1 hinaus und federt zurück. */
function easeOutBack(x: number): number {
  const c = clamp(x, 0, 1) - 1;
  return 1 + 2.70158 * c * c * c + 1.70158 * c * c;
}

// ───────────────────────────── KartVisual ─────────────────────────────

// Zwischenspeicher für update() – dort wird nichts neu angelegt.
const _sh = new THREE.Vector3();
const _hd = new THREE.Vector3();
const _el = new THREE.Vector3();
const _u = new THREE.Vector3();
const _w = new THREE.Vector3();
const _t = new THREE.Vector3();
const _iv = new THREE.Vector3();
const _iw = new THREE.Vector3();
const _iq = new THREE.Quaternion();
const _ie = new THREE.Euler();
const _ik = new Float32Array(KEY);
const _dv = new THREE.Vector3();

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

  /** Figur und Kartform (0..3, siehe DRIVER_NAMES). */
  readonly character: number;
  /** Spielerplatz (0..3): Lackfarbe und Startnummer (slot + 1). */
  readonly slot: number;
  private readonly spec: Spec;
  private readonly paint: Paint;
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
  /** Das Netz der Flammen zeigt an Land die Flammen, unter Wasser den Blasenstrahl. */
  private flameGeo: THREE.BufferGeometry | null = null;
  private jetGeo: THREE.BufferGeometry | null = null;
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
  // Zwischenwerte für die Ankerpunkte
  private aCd = 1;
  private aSd = 0;
  private aCs = 1;
  private aSs = 0;
  // Werte des laufenden Bildes, die sich die Teilschritte von update() teilen
  private fDt = 0;
  private fSteer = 0;
  private fStage = 0;
  private fSpin = 0;
  private fV = 0;
  private fV1 = 0;
  private fWind = 0;
  private fSpinYaw = 0;
  private fDriftYaw = 0;
  private fHop = 0;
  private fIdle = 1;
  private fCough = 0;
  private fHeld = 0;
  private fTow = false;
  private fGlide = false;
  // Gleitflug: Ausklappen (0 eingeklappt … 1 offen, linear in der Zeit), Haltung, Schräglage, Räder
  private wingU = 0;
  private glideS = 0;
  private bank = 0;
  private wheelV = 0;
  private propA = 0;
  // Tauchen: Ausrüstung (0 … 1, linear in der Zeit), Schwimmhaltung, Blasenstrahl, Schrauben
  private fDive = false;
  private diveU = 0;
  private diveS = 0;
  private swimS = 0;
  private jetS = 0;
  private dPropA = 0;

  // Item in der Hand: eigenes Netz am Karosserie-Knochen, Geometrie wird getauscht
  private readonly prop: THREE.Mesh;
  private readonly propLine: THREE.Mesh;
  /** Welcher Gegenstand gerade im Netz steckt (0 = keiner). */
  private propItem = 0;
  /** Aufploppen mit Überschwinger. */
  private propS = 0;
  private propV = 0;
  private propSpin = 0;
  /** Rechte Hand: 0 am Lenkrad … 1 beim Item. */
  private holdW = 0;
  /** Gewicht der Leinen-Haltung im Drachenzug. */
  private towW = 0;
  // Ziel der rechten Hand (relativ zur Schulter, geglättet) und Zusätze für Oberkörper/Kopf
  private hOut = HOLD[0];
  private hUp = HOLD[1];
  private hFwd = HOLD[2];
  private gTx = 0;
  private gTy = 0;
  private gTz = 0;
  private gHx = 0;
  /** Ziel und tatsächliche Lage der rechten Hand im Raum der Karosserie. */
  private readonly handT = new THREE.Vector3();
  private readonly handP = new THREE.Vector3();
  // Laufende Geste
  private gItem = 0;
  private gT = -1;
  /** Gegenstand ist losgelassen oder verpufft. */
  private gDone = false;
  /** Flugzeit nach dem Loslassen (−1 = nicht im Flug). */
  private gFly = -1;
  private readonly flyP = new THREE.Vector3();
  private readonly flyV = new THREE.Vector3();
  private flyG = 0;
  private flyDur = 0;

  // Abschleppdrache: eigenes Netz mit kleinem Skelett (Drache + Schwanz) und Leine
  private readonly kite: THREE.SkinnedMesh;
  private readonly kiteOutline: THREE.SkinnedMesh | null;
  private readonly kiteBones: THREE.Bone[] = [];
  private readonly kiteSkeleton: THREE.Skeleton;
  private readonly leash: THREE.Mesh;
  /** Zeit seit dem Aufsteigen (−1 = nicht in der Luft). */
  private kiteT = -1;
  /** Zeit seit dem Ende des Zugs (−1 = kein Abflug). */
  private kiteEnd = -1;
  /** Start- bzw. Abflugpunkt im Raum von root. */
  private readonly kiteFrom = new THREE.Vector3();

  /**
   * character wählt Figur und Kart, slot den Platz: Lackfarbe und Startnummer.
   * Ohne slot fährt die Figur in ihrer angestammten Farbe.
   */
  constructor(character: number, detail: KartDetail = 2, slot: number = character) {
    const wrap = (n: number): number => (Number.isFinite(n) ? ((Math.floor(n) % 4) + 4) % 4 : 0);
    this.character = wrap(character);
    this.slot = wrap(slot);
    this.spec = SPECS[this.character];
    this.paint = PAINTS[this.slot];
    this.detail = detail;
    // Zufallsfolge (Blinzeln) je Platz – zwei gleiche Figuren blinzeln nicht im Gleichtakt.
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
    this.atlas = makeAtlas(this.character, this.slot);
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

    // Item in der Hand: hängt an der Karosserie, macht so Drift und Schleudern mit.
    const items = getItemGeos();
    this.prop = new THREE.Mesh(items[0].main, this.toon);
    this.prop.name = 'item';
    this.prop.visible = false;
    this.propLine = new THREE.Mesh(items[0].line ?? items[0].main, outlineMaterial());
    this.propLine.name = 'outline';
    this.propLine.matrixAutoUpdate = false;
    this.prop.add(this.propLine);
    this.bones[B.chassis].add(this.prop);

    // Abschleppdrache samt Schwanz-Kette
    const kg = getKiteGeo();
    for (let i = 0; i < KITE_BONES; i++) {
      const bone = new THREE.Bone();
      if (i === 0) this.root.add(bone);
      else {
        bone.position.set(0, i === 1 ? -KITE_TIP : -KITE_STEP, 0);
        this.kiteBones[i - 1].add(bone);
      }
      this.kiteBones.push(bone);
    }
    this.kiteSkeleton = new THREE.Skeleton(
      this.kiteBones,
      KITE_REST.map((m) => m.clone().invert()),
    );
    this.kite = new THREE.SkinnedMesh(kg.main, this.toon);
    this.kite.name = 'kite';
    this.kite.matrixAutoUpdate = false;
    this.kite.boundingSphere = KITE_BOUNDS.clone();
    this.kite.bind(this.kiteSkeleton, bind);
    this.kite.visible = false;
    this.root.add(this.kite);
    this.kiteOutline = kg.outline ? withSkinnedOutline(this.kite, kg.outline) : null;
    if (this.kiteOutline) this.kiteOutline.boundingSphere = KITE_BOUNDS.clone();
    if (!leashGeo) {
      leashGeo = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true);
      leashGeo.translate(0, 0.5, 0);
      leashMat = new THREE.MeshBasicMaterial({ color: INK });
    }
    this.leash = new THREE.Mesh(leashGeo, leashMat!);
    this.leash.name = 'leash';
    this.leash.visible = false;
    this.leash.frustumCulled = false;
    this.root.add(this.leash);

    this.rebuild();
    this.placeAnchors();
  }

  /** Stauchen und Strecken auslösen: amount > 0 staucht (Landung, Treffer), < 0 streckt (Schubbeginn). */
  squash(amount: number): void {
    if (amount !== amount) return;
    this.sq = clamp(amount, -1, 1);
    this.sqV = 0;
  }

  /**
   * Das Item wurde in diesem Moment eingesetzt: passende Bewegung abspielen.
   * Das Spiel ruft das auf, wenn die Hand laut pose.held schon leer ist –
   * welcher Gegenstand fliegt, kommt deshalb von hier.
   */
  useItem(item: number): void {
    if (!(item >= 1 && item < I_COUNT)) return;
    this.gItem = Math.floor(item);
    this.gT = 0;
    this.gDone = false;
    // Ein noch fliegender Gegenstand der vorigen Geste ist damit weg.
    if (this.gFly >= 0) {
      this.gFly = -1;
      this.propS = 0;
    }
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
    this.kiteSkeleton.dispose();
    this.root.removeFromParent();
    // Die Kontur-Materialien gehören toon.ts (dort geteilt) und bleiben bestehen,
    // ebenso die Netze der Items, des Drachens und der Leine (alle Karts teilen sie).
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
    const wg = sp.wing;
    set(B.wingL, B.chassis, wg);
    set(B.wingR, B.chassis, [-wg[0], wg[1], wg[2]]);
    set(B.tipL, B.wingL, [sp.wingTip, 0, 0]);
    set(B.tipR, B.wingR, [-sp.wingTip, 0, 0]);
    set(B.wtail, B.chassis, sp.wingTail);
    set(B.dHead, B.head, sp.diveHead);
    const db = sp.diveBody;
    const dp = sp.diveProp;
    set(B.dBody, B.chassis, db);
    set(B.dPropL, B.dBody, [dp[0] - db[0], dp[1] - db[1], dp[2] - db[2]]);
    set(B.dPropR, B.dBody, [-dp[0] - db[0], dp[1] - db[1], dp[2] - db[2]]);
    for (let i = 0; i < 3; i++) set(B.bub0 + i, B.chassis, [0, 1.2, -0.3]);
    set(B.jetL, B.chassis, ex, [Math.PI + sp.exhaustUp, 0, 0]);
    set(B.jetR, B.chassis, [-ex[0], ex[1], ex[2]], [Math.PI + sp.exhaustUp, 0, 0]);
    this.bones[B.wFL].rotation.order = 'YXZ';
    this.bones[B.wFR].rotation.order = 'YXZ';
    // Flügel: erst um die eigene Längsachse verwinden, dann V-Stellung, dann nach hinten anklappen.
    this.bones[B.wingL].rotation.order = 'YZX';
    this.bones[B.wingR].rotation.order = 'YZX';

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
    // Eingeklappt: Flügel und Leitwerk auf null geschrumpft (erst nach der Ruhelage, sonst stimmt die Bindung nicht).
    this.bones[B.wingL].scale.setScalar(0);
    this.bones[B.wingR].scale.setScalar(0);
    this.bones[B.wtail].scale.setScalar(0);
    // Ebenso die Tauchausrüstung (Veras Brille ist immer da und klappt nur herunter).
    this.hideDive();
  }

  private hideDive(): void {
    const bn = this.bones;
    if (this.character === 1) bn[B.dHead].rotation.x = 0;
    else bn[B.dHead].scale.setScalar(0);
    bn[B.dBody].scale.setScalar(0);
    for (let i = 0; i < 3; i++) bn[B.bub0 + i].scale.setScalar(0);
    bn[B.jetL].scale.setScalar(0);
    bn[B.jetR].scale.setScalar(0);
  }

  /** Baut alle Netze für die aktuelle Detailstufe neu. */
  private rebuild(): void {
    for (const g of this.geos) g.dispose();
    this.geos.length = 0;
    const lines = this.detail > 0;
    const main = new Builder(this.rest, this.detail, lines);
    const decal = new Builder(this.rest, this.detail, false, true);
    const ctx: Ctx = {
      b: main,
      d: decal,
      sp: this.spec,
      p: this.paint,
      native: this.character === this.slot,
      eyeStart: 0,
    };
    BUILDERS[this.character](ctx);
    WING_BUILDERS[this.character](ctx);
    DIVE_BUILDERS[this.character](ctx);
    diveBubbles(main);
    const fx = new Builder(this.rest, this.detail, lines);
    buildFx(fx, this.paint.base);
    const fl = new Builder(this.rest, this.detail, false);
    buildFlames(fl);
    const jt = new Builder(this.rest, this.detail, false);
    buildJets(jt);

    const mainGeo = main.finish();
    const fxGeo = fx.finish();
    const decalGeo = decal.finish().main;
    const flameGeo = fl.finish().main;
    this.flameGeo = flameGeo;
    this.jetGeo = jt.finish().main;
    this.geos.push(mainGeo.main, fxGeo.main, decalGeo, flameGeo, this.jetGeo);
    this.body.geometry = mainGeo.main;
    this.fx.geometry = fxGeo.main;
    this.decals.geometry = decalGeo;
    this.flames.geometry = flameGeo;
    this.decals.visible = this.atlas !== null;
    this.propLine.visible = lines;
    if (this.kiteOutline) this.kiteOutline.visible = lines;

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

  private swapOutline(
    mesh: THREE.SkinnedMesh,
    old: THREE.SkinnedMesh | null,
    geo: THREE.BufferGeometry | null,
  ): THREE.SkinnedMesh | null {
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
    this.fDt = dt;
    this.time += dt;

    // — Eingaben (NaN abfangen) —
    const speed = pose.speed === pose.speed ? pose.speed : 0;
    const steer = clamp(pose.steer === pose.steer ? pose.steer : 0, -1, 1);
    const drift = pose.driftDir > 0 ? 1 : pose.driftDir < 0 ? -1 : 0;
    const spin = clamp(pose.spin === pose.spin ? pose.spin : 0, 0, 1);
    const v = Math.min(Math.abs(speed) / 26, 1.35);
    const v1 = Math.min(v, 1);
    this.fSteer = steer;
    this.fStage = clamp(pose.driftStage === pose.driftStage ? pose.driftStage : 0, 0, 3);
    this.fSpin = spin;
    this.fV = v;
    this.fV1 = v1;
    this.fWind = v1 * v1 * (3 - 2 * v1);
    // Ältere Aufrufer kennen held/tow nicht (undefined → 0/false, NaN → 0).
    const held = pose.held;
    this.fHeld = held >= 1 && held < I_COUNT ? Math.floor(held) : 0;
    this.fTow = pose.tow === true;
    // Ältere Aufrufer kennen glide nicht (undefined → false).
    const glide = pose.glide === true;
    this.fGlide = glide;
    const dive = pose.dive === true;
    this.fDive = dive;

    // — geglättete Größen —
    if (dt > 0) this.accel = damp(this.accel, clamp((speed - this.lastSpeed) / dt, -45, 45), 7, dt);
    this.lastSpeed = speed;
    this.boostS = damp(this.boostS, pose.boost ? 1 : 0, 9, dt);
    this.airS = damp(this.airS, pose.air ? 1 : 0, 10, dt);
    this.winS = damp(this.winS, pose.emote === 'win' ? 1 : 0, 8, dt);
    this.loseS = damp(this.loseS, pose.emote === 'lose' ? 1 : 0, 5, dt);
    this.stallS = damp(this.stallS, pose.stall ? 1 : 0, 10, dt);
    this.spinS = damp(this.spinS, spin > 0 ? 1 : 0, 12, dt);
    this.offS = damp(this.offS, pose.offroad ? 1 : 0, 8, dt);
    this.driftS = damp(this.driftS, drift, 9, dt);
    // Im Gleitflug bleiben die Hände am Lenkrad – gesteuert wird ja weiter.
    // Unter Wasser schwebt die Figur mit Schwimmzügen statt hochgerissener Arme.
    this.armsUp = damp(this.armsUp, (pose.air && !glide && !dive) || pose.emote === 'win' ? 1 : pose.stall ? 0.5 : 0, 10, dt);
    this.wingU = glide ? Math.min(1, this.wingU + dt / 0.25) : Math.max(0, this.wingU - dt / 0.2);
    this.glideS = damp(this.glideS, glide ? 1 : 0, 6, dt);
    // In die Kurve legen: etwa 0,35 rad bei vollem Einschlag
    this.bank = damp(this.bank, glide ? steer * 0.35 : 0, 5, dt);
    // Räder laufen in der Luft langsam aus und drehen bei der Landung sofort wieder mit.
    // Unter Wasser drehen sie gemächlicher.
    this.wheelV = glide ? damp(this.wheelV, 0, 0.8, dt) : dive ? speed * 0.55 : speed;
    // Unter Wasser keine Flammen – dort bläst der Schub einen Blasenstrahl.
    const flame = pose.boost && !dive;
    this.flameS = damp(this.flameS, flame ? 1 : 0, flame ? 18 : 11, dt);
    this.diveU = dive ? Math.min(1, this.diveU + dt / 0.25) : Math.max(0, this.diveU - dt / 0.2);
    this.diveS = damp(this.diveS, dive ? 1 : 0, 4, dt);
    this.swimS = damp(this.swimS, dive && pose.air ? 1 : 0, 6, dt);
    this.jetS = damp(this.jetS, dive && pose.boost ? 1 : 0, pose.boost ? 14 : 9, dt);
    this.lean = damp(this.lean, steer * 0.2 * (0.3 + 0.7 * v1) + this.driftS * 0.22, 8, dt);

    // Nachschwingen: seitlich (Kurve) und längs (Beschleunigung)
    const latT = -(steer * v1 + this.driftS * 0.5);
    const lonT = clamp(-this.accel * 0.02, -0.5, 0.5);
    this.swayXV += ((latT - this.swayX) * 150 - this.swayXV * 9) * dt;
    this.swayX += this.swayXV * dt;
    this.swayZV += ((lonT - this.swayZ) * 150 - this.swayZV * 9) * dt;
    this.swayZ += this.swayZV * dt;
    this.flopXV += ((latT - this.flopX) * 46 - this.flopXV * 4.5) * dt;
    this.flopX += this.flopXV * dt;
    this.flopZV += ((lonT - this.flopZ) * 46 - this.flopZV * 4.5) * dt;
    this.flopZ += this.flopZV * dt;

    // Die Teilschritte lesen ihre Werte aus den Feldern – so wandern keine
    // Fließkommazahlen als Argumente durch die Aufrufe.
    this.moveWheels();
    this.moveBody();
    this.planItem();
    this.moveDriver();
    this.moveExtras();
    this.moveEffects(pose.guard);
    this.moveWings();
    this.moveDive();
    this.moveItem();
    this.pickEyes(pose);
    this.placeAnchors();
  }

  /** Räder: drehen passend zum Tempo, vorn einschlagen, im Gelände rütteln. */
  private moveWheels(): void {
    const sp = this.spec;
    const bn = this.bones;
    const rp = this.restPos;
    const t = this.time;
    const dt = this.fDt;
    this.wheelF += (this.wheelV * dt) / sp.wf.r;
    this.wheelR += (this.wheelV * dt) / sp.wr.r;
    if (Math.abs(this.wheelF) > 6000) this.wheelF %= TAU;
    if (Math.abs(this.wheelR) > 6000) this.wheelR %= TAU;
    const yawF = -this.fSteer * 0.5 + this.driftS * 0.26;
    const bulge = 1 + Math.max(this.sq, 0) * 0.3;
    const hang = this.airS * 0.035;
    const rough = this.offS * this.fV1;
    for (let i = 0; i < 4; i++) {
      const w = bn[B.wFL + i];
      const front = i < 2;
      w.rotation.set(front ? this.wheelF : this.wheelR, front ? yawF : 0, rough * 0.06 * Math.sin(t * 43 + i * 1.9));
      w.position.y = rp[(B.wFL + i) * 3 + 1] - hang + rough * 0.018 * Math.abs(Math.sin(t * 31 + i * 2.3));
      w.scale.x = bulge;
    }
  }

  /** Karosserie: schleudern, im Drift schräg stellen, rollen, nicken, zittern, stauchen. */
  private moveBody(): void {
    const bn = this.bones;
    const t = this.time;
    const dt = this.fDt;
    const { boostS, airS, winS, stallS, driftS } = this;
    const v1 = this.fV1;
    const spin = this.fSpin;

    // Schleudern: zwei volle Umdrehungen, weich auslaufend
    const e = 1 - spin;
    const spinYaw = spin > 0 ? TAU * 2 * (1 - e * e * e) : 0;
    this.fSpinYaw = spinYaw;
    // Gleitflug: das ganze Kart legt sich in die Kurve, gedreht um einen Punkt
    // auf halber Höhe (nicht um die Radaufstandsfläche).
    const sb = bn[B.spin];
    const bank = this.bank;
    sb.rotation.set(0, spinYaw, bank);
    if (bank !== 0) {
      const h = 0.5 * Math.sin(bank);
      sb.position.set(h * Math.cos(spinYaw), 0.5 - 0.5 * Math.cos(bank), -h * Math.sin(spinYaw));
    } else sb.position.set(0, 0, 0);
    // Drift: Drehung um einen Punkt vorn, damit das Heck ausbricht
    const driftYaw = -driftS * (0.31 + 0.04 * this.fStage);
    this.fDriftYaw = driftYaw;
    const dr = bn[B.drift];
    dr.rotation.y = driftYaw;
    dr.position.set(-DRIFT_PIVOT * Math.sin(driftYaw), 0, DRIFT_PIVOT - DRIFT_PIVOT * Math.cos(driftYaw));

    const hopPhase = t * 8.5;
    const hop = winS * Math.max(0, Math.sin(hopPhase));
    const idle = (1 - 0.7 * v1) * (1 - stallS);
    const rough = this.offS * v1;
    const cough = stallS * Math.pow(Math.max(0, Math.sin(t * 13)), 8);
    this.fHop = hop;
    this.fIdle = idle;
    this.fCough = cough;

    const rollT = -this.fSteer * v1 * 0.075 * (1 - this.glideS) - driftS * 0.11 + (spin > 0 ? Math.sin(spinYaw) * 0.1 : 0);
    const pitchT = clamp(-this.accel * 0.0035, -0.08, 0.09) - boostS * 0.07 + airS * 0.05 + stallS * 0.03;
    this.rollV += ((rollT - this.roll) * 140 - this.rollV * 13) * dt;
    this.roll += this.rollV * dt;
    this.pitchV += ((pitchT - this.pitch) * 140 - this.pitchV * 13) * dt;
    this.pitch += this.pitchV * dt;
    this.sqV += (-this.sq * 190 - this.sqV * 8.5) * dt;
    this.sq += this.sqV * dt;
    // Stauchen: Höhe runter, Breite und Länge rauf (Volumen bleibt etwa gleich)
    const sq = clamp(this.sq + winS * 0.1 * Math.cos(hopPhase), -1, 1);
    const sy = sq > 0 ? 1 - 0.36 * sq : 1 - 0.28 * sq;
    const sxz = 1 / Math.sqrt(sy);
    const ch = bn[B.chassis];
    ch.scale.set(sxz, sy, sxz);
    // Unter Wasser wiegt sich das Kart sanft, als trüge es das Wasser.
    const dv = this.diveS;
    const sway = this.slot * 1.3;
    ch.position.y =
      dv * 0.025 * Math.sin(t * 1.7 + sway) +
      Math.sin(t * 61) * 0.0035 * idle +
      cough * 0.012 +
      hop * 0.07 +
      airS * 0.03 +
      rough * 0.02 * Math.sin(t * 33) * Math.sin(t * 21 + 1);
    ch.rotation.set(
      this.pitch + rough * 0.02 * Math.sin(t * 27) + dv * 0.035 * Math.sin(t * 1.25 + sway),
      0,
      this.roll + dv * 0.045 * Math.sin(t * 0.95 + sway + 1) + Math.sin(t * 47 + 2) * 0.006 * idle + cough * 0.03 * Math.sin(t * 90) + rough * 0.025 * Math.sin(t * 19 + 2),
    );
  }

  /** Fahrer: Oberkörper und Kopf lehnen sich in die Kurve, Ohren, Lenkrad, Arme. */
  private moveDriver(): void {
    const sp = this.spec;
    const bn = this.bones;
    const rp = this.restPos;
    const t = this.time;
    const dt = this.fDt;
    const { boostS, airS, winS, loseS, stallS, spinS, driftS, lean } = this;
    const acc = this.accel;
    const steer = this.fSteer;

    const torso = bn[B.torso];
    torso.rotation.set(
      -boostS * 0.16 + clamp(-acc * 0.004, -0.1, 0.12) + loseS * 0.26 - winS * 0.08 - airS * 0.06 + this.glideS * 0.2 + this.swimS * 0.24 + this.gTx,
      this.gTy,
      lean + this.gTz,
    );
    torso.position.y = rp[B.torso * 3 + 1] + this.fHop * 0.04;
    torso.updateMatrix();

    // Kopf: federt nach, schaut in die Kurve, wird bei Schub nach hinten gedrückt
    const hxT =
      -boostS * 0.3 +
      loseS * 0.55 -
      winS * 0.2 -
      airS * 0.14 +
      clamp(-acc * 0.006, -0.12, 0.15) +
      stallS * 0.08 -
      this.glideS * 0.1 -
      this.swimS * 0.2 +
      Math.sin(t * 2.1) * 0.02 +
      this.gHx;
    const hzT = lean * 0.7 + stallS * 0.1 * Math.sin(t * 7) + spinS * 0.22 * Math.sin(t * 14);
    this.headXV += ((hxT - this.headX) * 110 - this.headXV * 9) * dt;
    this.headX += this.headXV * dt;
    this.headZV += ((hzT - this.headZ) * 110 - this.headZV * 9) * dt;
    this.headZ += this.headZV * dt;
    const hyT =
      (-steer * 0.32 - driftS * 0.3) * (1 - spinS) + stallS * 0.28 * Math.sin(t * 9.5) + loseS * 0.1 * Math.sin(t * 1.3);
    this.headY = damp(this.headY, hyT, 10, dt);
    bn[B.head].rotation.set(this.headX, this.headY, this.headZ);

    // Ohren: legen sich im Fahrtwind an, zucken ab und zu, hängen bei Niederlage
    const twitch = Math.pow(Math.max(0, Math.sin(t * 1.7 + this.slot * 2)), 24);
    const earBack = -0.32 * this.fWind + this.swayZ * 0.5 - airS * 0.15 - this.swimS * 0.25;
    const earOut = sp.earTilt + loseS * 0.55 + stallS * 0.3 - winS * 0.1;
    bn[B.earL].rotation.set(earBack, 0, -earOut + this.swayX * 0.25 - twitch * 0.22);
    bn[B.earR].rotation.set(earBack, 0, earOut + this.swayX * 0.25);

    // Lenkrad dreht mit, die Hände bleiben dran
    const st = bn[B.steer];
    st.rotation.set(this.restRot[B.steer * 3], 0, -steer * 1.15 + driftS * 0.35);
    st.updateMatrix();
    // Rechte Hand: Item halten, Geste, Leine – Ziel relativ zur Schulter, mitgedreht mit dem Oberkörper.
    // Seitlich nicht mit der Armlänge skaliert: auch zierliche Figuren halten den Gegenstand neben den Kopf.
    const reach = (sp.upper + sp.fore) / 0.5;
    this.handT
      .set(-(sp.shoulder[0] + this.hOut), sp.shoulder[1] + this.hUp * reach, sp.shoulder[2] + this.hFwd * reach)
      .applyMatrix4(torso.matrix);
    this.solveArm(1);
    this.solveArm(-1);
    this.handP.copy(bn[B.handR].position);
  }

  /** Figur-eigenes Zubehör: Motor und Kiefer, Schal, Schnauzbart, Schwanz und Antennen. */
  private moveExtras(): void {
    const bn = this.bones;
    const t = this.time;
    const { airS, winS, loseS, stallS, spinS, swayX, swayZ, flopX, flopZ } = this;
    const wind = this.fWind;
    switch (this.character) {
      case 0: {
        // Motor zittert, Kiefer klappt auf
        const en = bn[B.aux0];
        const cough = this.fCough;
        const shake = 0.35 + this.fIdle * 0.65 + this.boostS * 0.8;
        en.position.y = this.restPos[B.aux0 * 3 + 1] + Math.sin(t * 58) * 0.006 * shake + cough * 0.02;
        en.rotation.z = Math.sin(t * 58 + 1) * 0.022 * shake + cough * 0.06 * Math.sin(t * 80);
        const open = Math.max(winS * (0.55 + 0.45 * Math.sin(t * 17)), stallS * 0.75, airS * 0.6, spinS * 0.7);
        bn[B.aux1].rotation.x = open * 0.42;
        break;
      }
      case 1: {
        // Schal: liegt im Stand auf dem Heck, weht bei Tempo waagrecht und flattert
        for (let i = 0; i < 4; i++) {
          const wave = Math.sin(t * (8 + 10 * wind) - i * 1.15);
          const hangX = (i === 0 ? -0.5 : -0.2) * (1 - wind);
          const rx = (i === 0 ? 0.14 + airS * 0.2 : 0) + hangX + wave * (0.05 + 0.26 * wind) * (i === 0 ? 0.5 : 1) + flopZ * 0.12;
          const ry =
            (i === 0 ? -0.2 : 0) + flopX * (i === 0 ? 0.3 : 0.12) + Math.sin(t * (6 + 7 * wind) - i * 0.9 + 1.7) * 0.16 * wind;
          bn[B.c0 + i].rotation.set(rx, ry, wave * 0.35 * wind);
        }
        break;
      }
      case 2: {
        // Schnauzbart flattert im Fahrtwind
        for (let i = 0; i < 2; i++) {
          const side = i === 0 ? 1 : -1;
          const flutter = Math.sin(t * 21 + i * 2.1) * 0.07 * wind;
          bn[B.aux0 + i].rotation.set(
            flutter - loseS * 0.12,
            side * (0.32 * wind - swayZ * 0.5) + flutter,
            side * (-loseS * 0.3 + winS * 0.2) + swayX * 0.2,
          );
        }
        break;
      }
      default: {
        // Schwanz: schwingt gemächlich, peitscht in Kurven; Antennen federn
        for (let i = 0; i < 3; i++) {
          const swish = Math.sin(t * 2.6 - i * 0.8) * 0.13 * (1 - 0.5 * wind) + Math.sin(t * 15 - i) * 0.05 * wind;
          bn[B.c0 + i].rotation.set(
            (i === 0 ? -0.22 : -0.1) * wind +
              flopZ * 0.2 +
              loseS * (i === 0 ? -0.3 : -0.16) +
              spinS * 0.15 * Math.sin(t * 20 + i),
            0,
            swish + flopX * 0.14 + stallS * 0.2 * Math.sin(t * 30 + i * 2),
          );
        }
        for (let i = 0; i < 2; i++) {
          const side = i === 0 ? 1 : -1;
          bn[B.aux0 + i].rotation.set(
            -0.2 - 0.3 * wind + swayZ * 0.9 + stallS * 0.1 * Math.sin(t * 40 + i),
            0,
            -side * 0.3 + swayX * 0.6,
          );
        }
      }
    }
  }

  /** Flammen, Schutzring, Blitze und Qualm. */
  private moveEffects(guard: boolean): void {
    const sp = this.spec;
    const bn = this.bones;
    const t = this.time;
    const dt = this.fDt;
    const stallS = this.stallS;

    // Flammen: pulsieren, werden mit dem Tempo länger
    const fs = this.flameS;
    const wet = this.fDive;
    const fg = wet ? this.jetGeo : this.flameGeo;
    if (fg && this.flames.geometry !== fg) this.flames.geometry = fg;
    this.flames.visible = wet ? this.jetS > 0.02 : fs > 0.03;
    for (let i = 0; i < 2; i++) {
      const flick = 0.85 + 0.22 * Math.sin(t * 71 + i * 2) + 0.12 * Math.sin(t * 173 + i);
      const wide = fs * (0.92 + 0.16 * Math.sin(t * 53 + i * 1.3));
      bn[B.flameL + i].scale.set(wide, wide, fs * flick * (1 + 0.25 * this.fV));
    }

    // Schutzring: ploppt federnd auf, kreist ums Kart. Ausgeblendet wird er
    // zügig und ohne Nachfedern – so blinkt er sauber, wenn das Spiel ihn kurz
    // vor Ablauf im Takt ein- und ausschaltet.
    if (guard) {
      this.guardV += ((1 - this.guardS) * 260 - this.guardV * 15) * dt;
      this.guardS += this.guardV * dt;
    } else {
      this.guardS = damp(this.guardS, 0, 30, dt);
      this.guardV = 0;
    }
    const gs = this.guardS > 0.004 ? this.guardS : 0;
    const gd = bn[B.guard];
    gd.scale.setScalar(gs);
    gd.rotation.set(Math.sin(t * 2.1) * 0.1, t * 3.4, Math.cos(t * 1.7) * 0.1);
    gd.position.y = this.restPos[B.guard * 3 + 1] + Math.sin(t * 3) * 0.03;

    // Kurzschluss: Blitze zucken an wechselnden Stellen, Qualm steigt auf
    for (let i = 0; i < 2; i++) {
      const ft = t * 11 + i * 0.5;
      const tick = Math.floor(ft);
      const r1 = hash(tick + i * 37.1);
      const r2 = hash(tick * 1.7 + i * 11.3 + 5);
      const r3 = hash(tick * 2.3 + i * 3.7 + 9);
      const on = ft - tick < 0.62 ? 1 : 0;
      const a = r1 * TAU;
      const rad = 0.7 + 0.35 * r2;
      const bo = bn[B.bolt0 + i];
      bo.position.set(Math.cos(a) * rad, 0.5 + 0.7 * r3, Math.sin(a) * rad);
      bo.rotation.set(0, HALF_PI - a, (r2 - 0.5) * 1.6);
      bo.scale.setScalar(stallS > 0.02 ? stallS * on * (0.75 + 0.4 * r3) : 0);
      const p = t * 0.85 + i * 0.5;
      const life = p - Math.floor(p);
      const pf = bn[B.puff0 + i];
      pf.position.set(
        sp.smoke[0] + (i === 0 ? 0.14 : -0.14) * life + Math.sin(t * 3 + i) * 0.03,
        sp.smoke[1] + life * 0.8,
        sp.smoke[2] - life * 0.3,
      );
      pf.rotation.y = life * 2 + i;
      const grow = (0.45 + 0.8 * life) * Math.min(1, (1 - life) * 5) * Math.min(1, life * 8);
      pf.scale.setScalar(stallS > 0.02 ? stallS * grow : 0);
    }
    this.fx.visible = gs > 0 || stallS > 0.02;
  }

  /**
   * Item, erster Teil (vor dem Fahrer): Geste weiterzählen, Ziel der rechten
   * Hand und die Zusätze für Oberkörper und Kopf bestimmen.
   */
  private planItem(): void {
    const dt = this.fDt;
    const t = this.time;
    let g: Gesture | null = null;
    let p = 0;
    if (this.gT >= 0) {
      g = GESTURES[this.gItem];
      if (g) {
        const p0 = this.gT / g.dur;
        this.gT += dt;
        p = this.gT / g.dur;
        if (!this.gDone && g.release >= 0 && p0 < g.release && p >= g.release) this.release(g);
        if (!this.gDone && g.vanish && p >= g.vanish[1]) {
          this.gDone = true;
          this.propS = 0;
          this.propV = 0;
        }
        if (p >= 1) g = null;
      }
      if (!g) this.gT = -1;
    }

    // Grundhaltung: Item neben dem Kopf – im Drachenzug die Hand an der Leine.
    const towing = this.kiteT >= 0;
    const tw = (this.towW = damp(this.towW, towing ? 1 : 0, 6, dt));
    // Die Leine ruckt: Hand nach vorn, die Figur stemmt sich dagegen.
    const tug = tw * (Math.sin(t * 13) * 0.012 + Math.sin(t * 7.7) * 0.01);
    let out = HOLD[0] + (LEASH[0] - HOLD[0]) * tw;
    let up = HOLD[1] + (LEASH[1] - HOLD[1]) * tw + Math.sin(t * 5.2) * 0.012;
    let fwd = HOLD[2] + (LEASH[2] - HOLD[2]) * tw + tug;
    let tx = -0.2 * tw - tug * 2;
    let ty = 0;
    let tz = 0;
    let hx = -0.14 * tw;
    let rate = 14;
    let want = (this.fHeld > 0 && !this.fTow) || towing ? 1 : 0;
    if (g) {
      const keys = g.keys;
      const n = keys.length / KEY;
      let i = 0;
      while (i < n - 2 && keys[(i + 1) * KEY] <= p) i++;
      const a = i * KEY;
      const b = a + KEY;
      const f = smooth01((p - keys[a]) / Math.max(keys[b] - keys[a], 1e-6));
      for (let k = 1; k < KEY; k++) _ik[k] = keys[a + k] + (keys[b + k] - keys[a + k]) * f;
      out = _ik[1];
      up = _ik[2];
      fwd = _ik[3];
      tx = _ik[4];
      ty = _ik[5];
      tz = _ik[6];
      hx = _ik[7];
      if (this.gItem === I_EMP && p > 0.18 && p < 0.7) {
        // Der Stecker zittert vor Spannung
        out += Math.sin(t * 71) * 0.015;
        up += Math.sin(t * 53) * 0.015;
      }
      rate = 30;
      want = 1;
    }
    this.hOut = damp(this.hOut, out, rate, dt);
    this.hUp = damp(this.hUp, up, rate, dt);
    this.hFwd = damp(this.hFwd, fwd, rate, dt);
    this.gTx = damp(this.gTx, tx, rate * 0.6, dt);
    this.gTy = damp(this.gTy, ty, rate * 0.6, dt);
    this.gTz = damp(this.gTz, tz, rate * 0.6, dt);
    this.gHx = damp(this.gHx, hx, rate * 0.6, dt);
    this.holdW = damp(this.holdW, want, g ? 30 : 9, dt);
  }

  /** Der Gegenstand verlässt die Hand: Flug starten – beim Drachen steigt stattdessen der große auf. */
  private release(g: Gesture): void {
    this.gDone = true;
    if (this.propItem === 0 || this.propS < 0.02) return;
    if (this.gItem === I_KITE && this.fTow) {
      this.kiteFrom.copy(this.prop.position);
      this.toRoot(this.kiteFrom);
      this.kiteT = 0;
      this.kiteEnd = -1;
      this.propS = 0;
      this.propV = 0;
      return;
    }
    const f = g.fly;
    if (!f) return;
    this.flyP.copy(this.prop.position);
    this.flyV.set(-f[0], f[1], f[2]);
    this.flyG = f[3];
    this.flyDur = f[4];
    this.gFly = 0;
  }

  /** Punkt aus dem Raum der Karosserie in den von root (Drift und Schleudern eingerechnet). */
  private toRoot(v: THREE.Vector3): void {
    const bn = this.bones;
    bn[B.chassis].updateMatrix();
    bn[B.drift].updateMatrix();
    bn[B.spin].updateMatrix();
    v.applyMatrix4(bn[B.chassis].matrix).applyMatrix4(bn[B.drift].matrix).applyMatrix4(bn[B.spin].matrix);
  }

  /** Item, zweiter Teil (nach dem Fahrer): Gegenstand an die Hand oder in den Flug, Drache und Leine. */
  private moveItem(): void {
    const sp = this.spec;
    const bn = this.bones;
    const t = this.time;
    const dt = this.fDt;
    const prop = this.prop;
    const g = this.gT >= 0 ? GESTURES[this.gItem] : null;
    const p = g ? this.gT / g.dur : 0;

    // — Gegenstand: welcher, wie groß —
    if (this.gFly >= 0) {
      this.gFly += dt;
      if (this.gFly >= this.flyDur) {
        this.gFly = -1;
        this.propS = 0;
        this.propV = 0;
      }
    }
    if (this.gFly < 0) {
      let want = this.fTow || this.kiteT >= 0 ? 0 : this.fHeld;
      if (g && !this.gDone) want = this.gItem;
      if (want !== this.propItem) {
        if (this.propItem !== 0 && this.propS > 0.02) {
          // erst schnell verschwinden, dann tauschen
          this.propS = damp(this.propS, 0, 28, dt);
          this.propV = 0;
        } else {
          this.propItem = want;
          this.propS = 0;
          this.propV = 0;
          if (want > 0) {
            const ig = getItemGeos()[want];
            prop.geometry = ig.main;
            this.propLine.geometry = ig.line ?? ig.main;
          }
        }
      } else if (want > 0) {
        // Aufploppen mit Überschwinger
        this.propV += ((1 - this.propS) * 320 - this.propV * 14) * dt;
        this.propS += this.propV * dt;
      }
    }
    const item = this.propItem;
    const spinRate = item === I_TOP ? (this.gFly >= 0 ? 48 : g ? 26 : 13) : 0;
    this.propSpin = (this.propSpin + spinRate * dt) % TAU;

    // — Gegenstand: Lage —
    let mul = 1;
    let sy = 1;
    let rx = (this.hFwd - HOLD[2]) * 1.3;
    let rz = 0.18 + Math.sin(t * 4.3) * 0.06;
    if (this.gFly >= 0) {
      const tf = this.gFly;
      prop.position.copy(this.flyP).addScaledVector(this.flyV, tf);
      prop.position.y -= 0.5 * this.flyG * tf * tf;
      const u = tf / this.flyDur;
      mul = u < 0.6 ? 1 : 1 - smooth01((u - 0.6) / 0.4);
      if (item === I_GUARD) mul *= 1 + u * 0.7;
      if (item === I_TIRE) rx += tf * 30;
      else if (item !== I_TOP) rx += this.flyV.z < 0 ? -tf * 16 : tf * 10;
    } else {
      // Griff knapp über der Faust (die Hand sitzt am Ende des Unterarms)
      _iv.set(0, 1, 0).applyQuaternion(bn[B.handR].quaternion);
      prop.position.copy(this.handP).addScaledVector(_iv, sp.hand * 0.6);
      if (g && g.vanish) {
        const a = g.vanish[0];
        const u = clamp((p - a) / (g.vanish[1] - a), 0, 1);
        if (this.gItem === I_BOOST) {
          // Druck baut sich auf (Flasche zittert und bläht sich), dann knallt der Korken
          rz += Math.sin(t * 80) * 0.14 * smooth01((p - 0.14) / 0.16) * (1 - u);
          mul = u < 0.4 ? 1 + 0.35 * smooth01(u / 0.4) : 1.35 * (1 - smooth01((u - 0.4) / 0.6));
        } else if (this.gItem === I_SPRING) {
          // zusammendrücken, beim Loslassen schnalzt sie nach oben weg
          sy = 1 - 0.5 * smooth01((p - 0.28) / 0.14) + 1.1 * smooth01(u / 0.6);
          mul = 1 - smooth01(u);
        } else {
          mul = (1 - smooth01(u)) * (u > 0 ? 0.8 + 0.2 * Math.sin(t * 90) : 1);
        }
      }
    }
    _iq.setFromEuler(_ie.set(rx, this.propSpin, rz, 'XZY'));
    prop.quaternion.multiplyQuaternions(bn[B.torso].quaternion, _iq);
    const s = Math.max(this.propS, 0) * mul;
    prop.scale.set(s, s * sy, s);
    prop.visible = item > 0 && s > 0.01;

    // — Abschleppdrache —
    const kb = this.kiteBones;
    const k0 = kb[0];
    if (this.fTow) {
      if (this.kiteT < 0) {
        // Steigt aus der Wurfbewegung auf; ohne Geste direkt aus der Hand.
        const waiting = g !== null && this.gItem === I_KITE && !this.gDone;
        if (!waiting) {
          this.kiteFrom.copy(this.handP);
          this.toRoot(this.kiteFrom);
          this.kiteT = 0;
          this.kiteEnd = -1;
        }
      } else this.kiteT += dt;
    } else if (this.kiteT >= 0) {
      // Zug vorbei: Leine weg, der Drache flattert davon
      this.kiteFrom.copy(k0.position);
      this.kiteT = -1;
      this.kiteEnd = 0;
    } else if (this.kiteEnd >= 0) {
      this.kiteEnd += dt;
      if (this.kiteEnd > 0.4) this.kiteEnd = -1;
    }
    const flying = this.kiteT >= 0 || this.kiteEnd >= 0;
    this.kite.visible = flying;
    this.leash.visible = this.kiteT >= 0;
    if (!flying) return;

    // Flugbahn: schwankt lebendig hin und her, legt sich dabei in die Kurve
    const ph = t * 1.25 + this.slot;
    const fx = 1.25 * Math.sin(ph) + 0.3 * Math.sin(t * 3.3 + 1);
    const fy = 4.7 + 0.3 * Math.sin(t * 1.9) + 0.1 * Math.sin(t * 5.3);
    const fz = 8.4 + 0.35 * Math.sin(t * 1.1);
    let roll = -0.32 * Math.cos(ph) + 0.08 * Math.sin(t * 4.1);
    let pitch = -0.08 + 0.06 * Math.sin(t * 2.3);
    let ks = 1;
    if (this.kiteT >= 0) {
      const l = this.kiteT / 0.32;
      if (l < 1) {
        const e = easeOutBack(l);
        _iv.set(fx, fy, fz);
        k0.position.lerpVectors(this.kiteFrom, _iv, e);
        ks = 0.16 + 0.84 * e;
        roll += (1 - l) * (1 - l) * 4.5;
      } else k0.position.set(fx, fy, fz);
    } else {
      const u = this.kiteEnd;
      k0.position.set(
        this.kiteFrom.x + Math.sin(u * 14) * 0.35,
        this.kiteFrom.y + u * 6 + u * u * 6,
        this.kiteFrom.z + u * 2.5,
      );
      ks = 1 - smooth01(u / 0.4);
      roll += Math.sin(u * 28) * 0.6;
      pitch -= u * 2;
    }
    k0.rotation.set(pitch, 0.12 * Math.sin(ph), roll);
    k0.scale.setScalar(Math.max(ks * KITE_SCALE, 0.001));
    // Schwanz: weht zum Kart hin und schlägt Wellen
    for (let i = 1; i < KITE_BONES; i++) {
      kb[i].rotation.set(
        i === 1 ? 0.75 + 0.12 * Math.sin(t * 6) : 0.1 + 0.24 * Math.sin(t * 7.5 - i * 0.9),
        0,
        0.3 * Math.sin(t * 5.2 - i * 0.8) + (i === 1 ? -roll * 0.6 : 0),
      );
    }
    if (this.kiteT < 0) return;

    // Leine: straff von der Faust zum Knoten am Drachen
    _iv.set(0, 1, 0).applyQuaternion(bn[B.handR].quaternion).multiplyScalar(sp.hand * 0.3).add(this.handP);
    this.toRoot(_iv);
    k0.updateMatrix();
    _iw.set(KITE_BRIDLE[0], KITE_BRIDLE[1], KITE_BRIDLE[2]).applyMatrix4(k0.matrix).sub(_iv);
    const len = _iw.length();
    if (len > 1e-4) {
      this.leash.position.copy(_iv);
      this.leash.quaternion.setFromUnitVectors(Y_AXIS, _iw.multiplyScalar(1 / len));
      this.leash.scale.set(0.028, len, 0.028);
    } else this.leash.visible = false;
  }

  /** Gleitflügel: ausklappen mit Überschwinger, einklappen ohne; im Flug federn die Enden. */
  private moveWings(): void {
    const bn = this.bones;
    const u = this.wingU;
    const tl = bn[B.wtail];
    if (u <= 0) {
      if (bn[B.wingL].scale.x !== 0) {
        bn[B.wingL].scale.setScalar(0);
        bn[B.wingR].scale.setScalar(0);
        tl.scale.setScalar(0);
      }
      return;
    }
    const sp = this.spec;
    const t = this.time;
    const open = this.fGlide;
    // Ausklappen schießt etwas über, Einklappen läuft weich
    const deploy = open ? easeOutBack(u) : smooth01(u);
    const size = open ? smooth01(u / 0.4) : smooth01(u / 0.5);
    const tail = open ? Math.max(easeOutBack((u - 0.2) / 0.8), 0) : smooth01(u / 0.6);
    const g = this.glideS;
    const sweep = 1.45 * (1 - deploy);
    // Tragen: die Flügel biegen sich leicht nach oben und wippen; ausgeklappt drückt der Fahrtwind
    const lift = sp.wingUp * deploy + g * (0.03 + 0.025 * Math.sin(t * 3.1 + this.slot));
    const twist = g * 0.03 * Math.sin(t * 2.3 + 1);
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? 1 : -1;
      const w = bn[B.wingL + i];
      w.rotation.set(twist, side * sweep, side * lift);
      w.scale.setScalar(Math.max(size, 0.001));
      // Außenteil: flattert im Wind, die kurvenäußere Seite biegt sich stärker
      const flutter = Math.sin(t * 13 + i * 1.7) * 0.035 + Math.sin(t * 7.3 + i) * 0.025;
      const tip = bn[B.tipL + i];
      tip.rotation.set(g * Math.sin(t * 9.5 + i * 2) * 0.05, 0, side * (g * (0.05 + flutter - side * this.bank * 0.12) + (deploy - 1) * 0.6));
    }
    tl.scale.setScalar(Math.max(tail, 0.001));
    tl.rotation.set(g * Math.sin(t * 4.1) * 0.03, 0, 0);
    if (this.character === 2) {
      // Bert: Propeller dreht im Flug, mit Schub schneller
      this.propA = (this.propA + this.fDt * g * (22 + 18 * this.boostS)) % TAU;
      tl.rotation.z = this.propA;
    }
  }

  /** Tauchausrüstung: ploppt auf bzw. klappt herunter, Schrauben drehen, Blasen steigen, bei Schub ein Blasenstrahl. */
  private moveDive(): void {
    const bn = this.bones;
    const u = this.diveU;
    if (u <= 0) {
      if (bn[B.dBody].scale.x !== 0) this.hideDive();
      return;
    }
    const sp = this.spec;
    const rp = this.restPos;
    const t = this.time;
    const open = this.fDive;
    // Anlegen schießt etwas über, Ablegen läuft weich
    const pop = open ? easeOutBack(u) : smooth01(u);
    const size = open ? smooth01(u / 0.5) : smooth01(u / 0.6);
    const hd = bn[B.dHead];
    if (this.character === 1) hd.rotation.x = 0.78 * pop;
    else if (this.character === 3) {
      // Glaskuppel: wabert ein wenig
      const w = 0.018 * this.diveS * Math.sin(t * 2.3);
      hd.scale.set(Math.max(pop * (1 + w), 0.001), Math.max(pop * (1 - w), 0.001), Math.max(pop, 0.001));
    } else hd.scale.setScalar(Math.max(pop, 0.001));
    const body = bn[B.dBody];
    body.scale.setScalar(Math.max(pop, 0.001));
    // Bert: der Außenborder klappt aus der Waagrechten herunter
    if (this.character === 2) body.rotation.x = 1.4 * (1 - pop);

    // Schrauben: schneller mit Tempo und Schub
    this.dPropA = (this.dPropA + this.fDt * this.diveS * (6 + 24 * this.fV1 + 26 * this.boostS)) % TAU;
    bn[B.dPropL].rotation.z = this.dPropA;
    bn[B.dPropR].rotation.z = -this.dPropA;

    // Blasen: Quelle im Kopf (Schnorchel, Mund, Ventil) in den Raum der Karosserie
    const head = bn[B.head];
    head.updateMatrix();
    const q = sp.diveBub;
    _dv.set(q[0], q[1], q[2]).applyMatrix4(head.matrix).applyMatrix4(bn[B.torso].matrix);
    const rate = 1.1 + 0.7 * this.fV1;
    const drift = 0.12 + 0.6 * this.fV1;
    for (let i = 0; i < 3; i++) {
      const p = t * rate + i / 3;
      const life = p - Math.floor(p);
      const bb = bn[B.bub0 + i];
      bb.position.set(_dv.x + Math.sin(t * 4 + i * 2.1) * 0.04 * life, _dv.y + life * 0.8, _dv.z - life * drift);
      const g = (0.55 + 0.75 * life) * Math.min(1, (1 - life) * 5) * Math.min(1, life * 8) * size;
      bb.scale.setScalar(g);
    }

    // Blasenstrahl aus dem Auspuff (läuft entlang der Flammenrichtung nach hinten)
    const js = this.jetS * size;
    const up = sp.exhaustUp;
    for (let i = 0; i < 2; i++) {
      const jt = bn[B.jetL + i];
      if (js < 0.02) {
        jt.scale.setScalar(0);
        continue;
      }
      const k = t * 6.5 + i * 0.5;
      const run = (k - Math.floor(k)) * 0.13;
      const j = (B.jetL + i) * 3;
      jt.position.set(rp[j], rp[j + 1] + Math.sin(up) * run, rp[j + 2] - Math.cos(up) * run);
      jt.rotation.set(this.restRot[j], 0, Math.sin(t * 9 + i * 2) * 0.6);
      const s = js * (0.85 + 0.25 * Math.sin(t * 37 + i * 2));
      jt.scale.set(s, s, s * (1 + 0.5 * this.fV));
    }
  }

  /** Augen: Kringel beim Schleudern, verdattert bei Kurzschluss, sonst je nach Lage – und ab und zu blinzeln. */
  private pickEyes(pose: KartPose): void {
    let eye: number = EYE.OPEN;
    if (this.fSpin > 0) eye = EYE.DIZZY;
    else if (pose.stall) eye = EYE.STUN;
    else if (pose.emote === 'win') eye = EYE.HAPPY;
    else if (pose.emote === 'lose') eye = EYE.SAD;
    else if (pose.boost) eye = EYE.FIERCE;
    else if (pose.air) eye = EYE.WOW;
    else {
      this.blinkT -= this.fDt;
      if (this.blinkT < 0.11) eye = EYE.BLINK;
      if (this.blinkT < 0) {
        this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
        this.blinkT = 2 + (this.seed / 4294967296) * 3.2;
      }
    }
    this.setEyes(eye);
  }

  /**
   * Spannt einen Arm zwischen Schulter und Ziel (Hand am Lenkrad oder oben):
   * Ellbogen aus den beiden Armlängen, Knochen passend gedreht und gestreckt.
   */
  private solveArm(side: number): void {
    const sp = this.spec;
    const t = this.time;
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
      _t.set(
        side * (sp.shoulder[0] + 0.16 + 0.07 * wave),
        sp.shoulder[1] + 0.36 + 0.03 * this.winS * Math.cos(t * 11),
        sp.shoulder[2] + 0.1,
      ).applyMatrix4(torso.matrix);
      _hd.lerp(_t, up);
    }
    // … oder Brustschwimmen: nach vorn strecken, weit ausholen, zurück
    const sw = this.swimS;
    if (sw > 0.001) {
      const r = (sp.upper + sp.fore) / 0.5;
      const out = Math.max(0, Math.sin(t * 4.4));
      _t.set(
        side * (sp.shoulder[0] + (0.05 + 0.2 * out) * r),
        sp.shoulder[1] + (0.12 - 0.07 * out) * r,
        sp.shoulder[2] + (0.38 - 0.18 * out) * r,
      ).applyMatrix4(torso.matrix);
      _hd.lerp(_t, sw);
    }
    // … oder (nur rechts) beim Item. Hochgerissene Arme haben Vorrang, außer während einer Geste.
    if (side < 0 && this.holdW > 0.001) _hd.lerp(this.handT, this.holdW * (this.gT >= 0 ? 1 : 1 - up));
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
  private placeAnchors(): void {
    const sp = this.spec;
    const a = this.anchors;
    this.aCd = Math.cos(this.fDriftYaw);
    this.aSd = Math.sin(this.fDriftYaw);
    this.aCs = Math.cos(this.fSpinYaw);
    this.aSs = Math.sin(this.fSpinYaw);
    this.anchor(a.wheelRearL, sp.wr.x, 0, sp.wr.z);
    this.anchor(a.wheelRearR, -sp.wr.x, 0, sp.wr.z);
    this.anchor(a.wheelFrontL, sp.wf.x, 0, sp.wf.z);
    this.anchor(a.wheelFrontR, -sp.wf.x, 0, sp.wf.z);
    this.anchor(a.exhaustL, sp.exhaust[0], sp.exhaust[1], sp.exhaust[2]);
    this.anchor(a.exhaustR, -sp.exhaust[0], sp.exhaust[1], sp.exhaust[2]);
    this.anchor(a.head, 0, sp.hip[1] + sp.torsoLen + 0.3, sp.hip[2]);
  }

  /** Ein Punkt der Ruhelage → root: erst Drift (um den Drehpunkt vorn), dann Schleudern. */
  private anchor(out: THREE.Vector3, x: number, y: number, z: number): void {
    const dz = z - DRIFT_PIVOT;
    const x1 = x * this.aCd + dz * this.aSd;
    const z1 = -x * this.aSd + dz * this.aCd + DRIFT_PIVOT;
    out.set(x1 * this.aCs + z1 * this.aSs, y, -x1 * this.aSs + z1 * this.aCs);
  }
}
