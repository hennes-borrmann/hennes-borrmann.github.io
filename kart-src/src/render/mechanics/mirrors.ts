// Spiegelkabinett: Darstellung der Portale (game/mechanics.ts: Portal).
//
// In der Fahrbahn stehen goldene Prunkrahmen. Was darin steht, sagt die Physik – und nur sie:
//   - Spiegel vorwärts (Abkürzung): Türkis, große Doppelwinkel, die ruhig nach oben wandern, glatter Schimmer.
//   - Spiegel zurück (Falle): Pink, Doppelwinkel, die nach unten wandern, schräge Warnstreifen am Rand.
//   - leer: keine Fläche, man sieht hindurch; nur der feine helle Glanz an der Innenkante des Rahmens.
// Farbe UND Form/Bewegung tragen die Sorte (auch für Farbenblinde eindeutig).
// Wechsel kündigen sich PORTAL_WARN Ticks vorher an: ein Spiegel, der gleich verschwindet, zieht sich
// zur Mitte zusammen und pulsiert ruhig (1,5 Mal je Sekunde, weich); einer, der gleich erscheint, baut
// sich in blassen Lamellen von unten her auf. Im Giebel jedes Rahmens mit Zeitplan zählt eine
// Lampenreihe (10 Lampen, von außen nach innen erlöschend) die Zeit bis zum nächsten Wechsel herunter,
// in der Farbe der Sorte, die gerade gilt (bei leerem Rahmen: der kommenden, blass).
// Vor jedem Rahmen liegt auf seiner Spur ein Teppich aus Pfeilwinkeln (Farbe und Richtung der Sorte, die
// gerade gilt), am Ausgang steht ein schlichterer Rahmen mit zartem Schleier und nach außen laufenden
// Ringen, und etwa 70 m vor jeder Stelle eine Tafel mit dem augenblicklichen Stand.
//
// Wo genau: Die Physik zählt die Durchfahrt an der Grenze zwischen Abschnitt seg und dem nächsten
// (einen halben Abschnitt hinter der Mitte von seg); heraus kommt man unmittelbar hinter der Grenze vor
// dem Abschnitt to. Genau dort stehen die Rahmen, seitlich genau auf lat0 und lat1, die Unterkante auf
// der Fahrbahn (Höhe + Querneigung).
//
// Reine Funktion der Rennzeit: Alles, was man sieht, wird in update allein aus time berechnet (im
// Countdown aus Zeit 0). Nur die Glitzerfunken (Zierde, nur mit detail) zählen mit dt.
//
// Zeichentechnik (harte Vorgabe, siehe machines.ts): nur Flächen mit Eckenfarben (MeshBasicMaterial),
// ein Toon-Körper mit Kontur und Netze, deren Ecken und Farben je Bild neu gesetzt werden. Kein eigener
// Shader, keine Textur, kein Render-Target, kein Licht. Fünf Zeichenaufrufe mit detail, vier ohne.

import * as THREE from 'three';
import { PORTAL_WARN, portalLeft, portalOpen, portalUntil, type Portal } from '../../game/mechanics';
import { EDGE_OPEN_L, EDGE_OPEN_R, rightX, rightZ, type Track } from '../../game/track';
import { MeshBuilder, smooth, type RGB, type V3 } from '../build';
import type { FxSink } from '../fxApi';
import type { MechanicView } from '../mechanics';
import { rgb, toonMaterial, withOutline } from '../toon';
import { boxT, face, type Xform } from './machineKit';

// --- Farben (linear) -------------------------------------------------------------------------
// Türkis und Pink gehören auf dieser Strecke allein den Spiegeln und ihren Markierungen.

const C_FWD = rgb(0x4fe3ff);
const C_FWD_D = rgb(0x0a8fbf);
const C_FWD_HI = rgb(0xbff8ff);
const C_BACK = rgb(0xff5fc4);
const C_BACK_D = rgb(0xc8127a);
const C_BACK_HI = rgb(0xffb8e6);
const C_INK = rgb(0x1e1a2a);
const C_OFF = rgb(0x2e2838);
const C_WHITE = rgb(0xfff8ec);
const C_NEUTRAL = rgb(0xf4f4f2);
const C_WARN = rgb(0xffc62e);
const C_GOLD = rgb(0xd9a93c);
const C_GOLD_D = rgb(0x9c6c1e);
const C_GOLD_HI = rgb(0xffe08a);
const C_GLINT = rgb(0xfffbef);
const C_NAVY = rgb(0x2c2a63);
const C_ROADICON = rgb(0xcfc8b8);
const HEX_FWD = 0x4fe3ff;
const HEX_BACK = 0xff5fc4;

// --- Maße ------------------------------------------------------------------------------------

/** Lichte Höhe des Rahmens. */
const H = 4.6;
/** Breite der Pfosten (≤ 0,3 m: für die Physik sind sie Luft und sollen nicht massiv wirken). */
const POST = 0.24;
/** Breite des farbigen Rands der Spiegelfläche (an den Seiten und oben; unten etwas schmaler). */
const RIM = 0.34;
const RIM_B = 0.22;
/** Lampen der Uhr. */
const LAMPS = 10;
/** Höhenlage im Aufbau über der Öffnung: Balken, Fries (mit der Uhr), Gesims, Giebel. */
const BEAM = 0.35;
const FRIEZE = 0.85;
const CORNICE = 0.16;
const GABLE = 1.0;
/** Länge des Teppichs vor dem Rahmen (m) und Abstand der Tafel vor der Stelle. */
const CARPET = 45;
const BOARD_AT = 70;
/** Tafel: Mitte so weit neben der Mittellinie (Fahrbahnkante 6,4 m – also gut 3 m daneben). */
const BOARD_LAT = 10.6;
/** Pulsieren der Ankündigung: Schläge je Sekunde (weich, Sinus; Grenze für Fotosensibilität 3). */
const PULSE_HZ = 1.5;

// --- Ebene eines Rahmens -----------------------------------------------------------------------

/** Ebene quer zur Strecke: Fußpunkt auf der Mittellinie, nach rechts, nach vorn, Querneigung. */
interface Plane {
  bx: number;
  by: number;
  bz: number;
  rx: number;
  rz: number;
  fx: number;
  fz: number;
  bank: number;
}

/** Grenze am Ende von seg (end) bzw. an seinem Anfang (!end) – dort zählt bzw. setzt die Physik. */
function planeAt(t: Track, seg: number, end: boolean): Plane {
  const o = end ? t.next[seg] : t.prev[seg];
  const h = (t.step / 2) * (end ? 1 : -1);
  return {
    bx: t.px[seg] + t.tx[seg] * h,
    by: (t.py[seg] + t.py[o]) / 2,
    bz: t.pz[seg] + t.tz[seg] * h,
    rx: rightX(t, seg),
    rz: rightZ(t, seg),
    fx: t.tx[seg],
    fz: t.tz[seg],
    bank: (t.bank[seg] + t.bank[o]) / 2,
  };
}

/** Lokale Koordinaten der Ebene: x = seitlich (lat), y = Höhe über der Fahrbahn an dieser Stelle, z = voraus. */
function xform(pl: Plane): Xform {
  return (x, y, z) => [pl.bx + pl.rx * x + pl.fx * z, pl.by + pl.bank * x + y, pl.bz + pl.rz * x + pl.fz * z];
}

/** Stützpunkte entlang eines Stücks Strecke (je Abschnitt), um Punkte (Weg, lat) auf die Fahrbahn zu legen. */
interface Strip {
  n: number;
  step: number;
  x: Float64Array;
  y: Float64Array;
  z: Float64Array;
  rx: Float64Array;
  rz: Float64Array;
  bank: Float64Array;
}

function strip(t: Track, first: number, count: number): Strip {
  const s: Strip = {
    n: count,
    step: t.step,
    x: new Float64Array(count),
    y: new Float64Array(count),
    z: new Float64Array(count),
    rx: new Float64Array(count),
    rz: new Float64Array(count),
    bank: new Float64Array(count),
  };
  let seg = first;
  for (let i = 0; i < count; i++) {
    s.x[i] = t.px[seg];
    s.y[i] = t.py[seg];
    s.z[i] = t.pz[seg];
    s.rx[i] = rightX(t, seg);
    s.rz[i] = rightZ(t, seg);
    s.bank[i] = t.bank[seg];
    seg = t.next[seg];
  }
  return s;
}

/** Abschnitt k Schritte vor (k > 0) bzw. hinter seg. */
function walk(t: Track, seg: number, k: number): number {
  let s = seg;
  for (let i = 0; i < Math.abs(k); i++) s = k > 0 ? t.next[s] : t.prev[s];
  return s;
}

// --- Netze mit je Bild neu gesetzten Ecken -------------------------------------------------------

/** Ein fester Bereich von Ecken im gemeinsamen Netz; was ein Bild nicht braucht, fällt in einen Punkt zusammen. */
interface Slot {
  first: number;
  count: number;
}

class Dyn {
  pos!: Float32Array;
  col!: Float32Array;
  readonly geo = new THREE.BufferGeometry();
  private pa!: THREE.BufferAttribute;
  private ca!: THREE.BufferAttribute;
  private size = 0;
  private i = 0;
  private end = 0;
  /** Mehr Ecken geschrieben, als der Bereich fasst (darf nie passieren; prüft der Test). */
  overflow = false;
  constructor(readonly alpha: boolean) {}

  alloc(tris: number): Slot {
    const s = { first: this.size, count: tris * 3 };
    this.size += tris * 3;
    return s;
  }

  finish(): void {
    const k = this.alpha ? 4 : 3;
    this.pos = new Float32Array(this.size * 3);
    this.col = new Float32Array(this.size * k);
    this.pa = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.ca = new THREE.BufferAttribute(this.col, k).setUsage(THREE.DynamicDrawUsage);
    this.geo.setAttribute('position', this.pa);
    this.geo.setAttribute('color', this.ca);
  }

  get triangles(): number {
    return this.size / 3;
  }

  begin(s: Slot): void {
    this.i = s.first;
    this.end = s.first + s.count;
  }

  /** Rest des Bereichs: unsichtbare Dreiecke in einem Punkt. */
  close(x: number, y: number, z: number): void {
    while (this.i < this.end) this.v(x, y, z, 0, 0, 0, 0);
  }

  flush(): void {
    this.pa.needsUpdate = true;
    this.ca.needsUpdate = true;
  }

  v(x: number, y: number, z: number, r: number, g: number, b: number, a: number): void {
    if (this.i >= this.end) {
      this.overflow = true;
      return;
    }
    const i = this.i++;
    this.pos[i * 3] = x;
    this.pos[i * 3 + 1] = y;
    this.pos[i * 3 + 2] = z;
    if (this.alpha) {
      this.col[i * 4] = r;
      this.col[i * 4 + 1] = g;
      this.col[i * 4 + 2] = b;
      this.col[i * 4 + 3] = a;
    } else {
      this.col[i * 3] = r;
      this.col[i * 3 + 1] = g;
      this.col[i * 3 + 2] = b;
    }
  }

  /** Ecke in der Ebene pl (lokale Koordinaten wie xform). */
  vl(pl: Plane, x: number, y: number, z: number, c: RGB, a: number): void {
    this.v(pl.bx + pl.rx * x + pl.fx * z, pl.by + pl.bank * x + y, pl.bz + pl.rz * x + pl.fz * z, c[0], c[1], c[2], a);
  }

  /** Viereck in der Ebene pl bei der Tiefe z (Ecken der Reihe nach), einfarbig. */
  quad(pl: Plane, z: number, x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, c: RGB, a: number): void {
    this.vl(pl, x0, y0, z, c, a);
    this.vl(pl, x1, y1, z, c, a);
    this.vl(pl, x2, y2, z, c, a);
    this.vl(pl, x0, y0, z, c, a);
    this.vl(pl, x2, y2, z, c, a);
    this.vl(pl, x3, y3, z, c, a);
  }

  rect(pl: Plane, z: number, xa: number, ya: number, xb: number, yb: number, c: RGB, a: number): void {
    this.quad(pl, z, xa, ya, xb, ya, xb, yb, xa, yb, c, a);
  }

  /** Rechteck mit Farbe/Deckkraft unten (c0, a0) und oben (c1, a1). */
  rectG(pl: Plane, z: number, xa: number, ya: number, xb: number, yb: number, c0: RGB, a0: number, c1: RGB, a1: number): void {
    this.vl(pl, xa, ya, z, c0, a0);
    this.vl(pl, xb, ya, z, c0, a0);
    this.vl(pl, xb, yb, z, c1, a1);
    this.vl(pl, xa, ya, z, c0, a0);
    this.vl(pl, xb, yb, z, c1, a1);
    this.vl(pl, xa, yb, z, c1, a1);
  }

  /** Ecke auf der Fahrbahn eines Stücks: Weg w (Meter ab dem ersten Stützpunkt), seitlich lat, lift darüber. */
  vs(s: Strip, w: number, lat: number, lift: number, c: RGB, a: number): void {
    const f = Math.max(0, Math.min(s.n - 1.0001, w / s.step));
    const i = Math.floor(f);
    const k = f - i;
    const j = i + 1;
    const rx = s.rx[i] + (s.rx[j] - s.rx[i]) * k;
    const rz = s.rz[i] + (s.rz[j] - s.rz[i]) * k;
    const bank = s.bank[i] + (s.bank[j] - s.bank[i]) * k;
    this.v(s.x[i] + (s.x[j] - s.x[i]) * k + rx * lat, s.y[i] + (s.y[j] - s.y[i]) * k + bank * lat + lift, s.z[i] + (s.z[j] - s.z[i]) * k + rz * lat, c[0], c[1], c[2], a);
  }

  /** Viereck auf der Fahrbahn: Ecken (Weg, lat) der Reihe nach. */
  quadS(s: Strip, lift: number, w0: number, l0: number, w1: number, l1: number, w2: number, l2: number, w3: number, l3: number, c: RGB, a: number): void {
    this.vs(s, w0, l0, lift, c, a);
    this.vs(s, w1, l1, lift, c, a);
    this.vs(s, w2, l2, lift, c, a);
    this.vs(s, w0, l0, lift, c, a);
    this.vs(s, w2, l2, lift, c, a);
    this.vs(s, w3, l3, lift, c, a);
  }
}

// Zwischenspeicher für gemischte Farben (kein Müll je Bild).
const TMP_A: RGB = [0, 0, 0];
const TMP_B: RGB = [0, 0, 0];
const TMP_C: RGB = [0, 0, 0];

function mixInto(out: RGB, a: RGB, b: RGB, k: number): RGB {
  out[0] = a[0] + (b[0] - a[0]) * k;
  out[1] = a[1] + (b[1] - a[1]) * k;
  out[2] = a[2] + (b[2] - a[2]) * k;
  return out;
}

const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);
const frac = (x: number): number => x - Math.floor(x);

// --- Was der Test findet -----------------------------------------------------------------------

/** Kennzeichnung einer Spiegelfläche im Netz der Spiegel (userData.panes). */
export interface PaneInfo {
  /** false: Eingangsrahmen (Ebene am Ende von seg); true: Ausgangsrahmen (Ebene vor to). */
  exit: boolean;
  seg: number;
  to: number;
  lat0: number;
  lat1: number;
  /** Ecken der Fläche (des Spiegels bzw. Schleiers). */
  first: number;
  count: number;
  /** Ecken des blassen Vorboten (nur Eingang; zählt nicht als Spiegel). */
  heraldFirst: number;
  heraldCount: number;
  /** Sorte, die gerade sichtbar ist (−1 = keine); am Ausgang die Sorte, die hier herauskommt. */
  kind: number;
}

/** Kennzeichnung eines Teppichs im Netz der Teppiche (userData.carpets). */
export interface CarpetInfo {
  seg: number;
  lat0: number;
  lat1: number;
  first: number;
  count: number;
  /** Sorte, die der Teppich gerade zeigt (−1 = neutral). */
  kind: number;
}

// --- Rahmen -----------------------------------------------------------------------------------

interface Entrance {
  pl: Plane;
  lat0: number;
  lat1: number;
  seg: number;
  portals: Portal[];
  /** Zeitplan: Periode und alle Wechsel darin (Ticks); period 0 = immer offen. */
  period: number;
  bounds: number[];
  mirror: Slot;
  herald: Slot;
  lamps: Slot | null;
  carpet: Slot;
  carpetStrip: Strip;
  info: PaneInfo;
  carpetInfo: CarpetInfo;
  // Zustand des Bilds (je Bild neu aus der Zeit):
  open: Portal | null;
  left: number;
  len: number;
  coming: Portal | null;
  until: number;
}

interface Exit {
  pl: Plane;
  portal: Portal;
  slot: Slot;
  info: PaneInfo;
}

interface Board {
  pl: Plane;
  lat: number;
  frames: Entrance[];
  slot: Slot;
}

export function buildMirrors(track: Track, detail: boolean): MechanicView {
  const t = track;
  const group = new THREE.Group();
  const disposables: { dispose(): void }[] = [];
  const stat = new MeshBuilder();
  const flat = new Dyn(false);
  const glass = new Dyn(true);
  const floor = new Dyn(true);

  // --- Rahmen je Stelle sammeln (mehrere Portale teilen sich einen Rahmen) ---
  const entrances: Entrance[] = [];
  const exits: Exit[] = [];
  const panes: PaneInfo[] = [];
  const carpets: CarpetInfo[] = [];
  const nChev = detail ? 3 : 2;
  const nCarpet = detail ? 12 : 9;
  for (const p of t.portals) {
    let e = entrances.find((f) => f.seg === p.seg && f.lat0 === p.lat0 && f.lat1 === p.lat1);
    if (!e) {
      const pl = planeAt(t, p.seg, true);
      const info: PaneInfo = { exit: false, seg: p.seg, to: -1, lat0: p.lat0, lat1: p.lat1, first: 0, count: 0, heraldFirst: 0, heraldCount: 0, kind: -1 };
      const carpetInfo: CarpetInfo = { seg: p.seg, lat0: p.lat0, lat1: p.lat1, first: 0, count: 0, kind: -1 };
      // Spiegel: Rand (Streifen bis 4 × 16 Vierecke), Fläche (Raster 3 × 6), Winkel (nChev Doppelwinkel, je mit Schatten)
      const mirror = glass.alloc(4 * 16 * 2 + 3 * 6 * 2 + nChev * 2 * 2 * 2 * 2 * 2);
      const herald = glass.alloc(6 * 2);
      const carpet = floor.alloc(nCarpet * 2 * 2 + 8 * 2);
      e = {
        pl,
        lat0: p.lat0,
        lat1: p.lat1,
        seg: p.seg,
        portals: [],
        period: 0,
        bounds: [],
        mirror,
        herald,
        lamps: null,
        carpet,
        carpetStrip: strip(t, walk(t, p.seg, -CARPET - 1), CARPET + 3),
        info,
        carpetInfo,
        open: null,
        left: 0,
        len: 1,
        coming: null,
        until: Infinity,
      };
      info.first = mirror.first;
      info.count = mirror.count;
      info.heraldFirst = herald.first;
      info.heraldCount = herald.count;
      carpetInfo.first = carpet.first;
      carpetInfo.count = carpet.count;
      entrances.push(e);
      panes.push(info);
      carpets.push(carpetInfo);
    }
    e.portals.push(p);
    if (p.plan) {
      e.period = p.plan.period;
      for (const b of p.plan.spans) {
        const m = e.period > 0 ? ((b % e.period) + e.period) % e.period : b;
        if (Number.isFinite(m) && !e.bounds.includes(m)) e.bounds.push(m);
      }
    }
    // Ausgang: Schleier mit Ringen (Fläche + 3 Ringe aus je 4 Vierecken)
    const slot = glass.alloc(2 + 3 * 4 * 2);
    const info: PaneInfo = { exit: true, seg: p.seg, to: p.to, lat0: p.lat0, lat1: p.lat1, first: slot.first, count: slot.count, heraldFirst: 0, heraldCount: 0, kind: p.kind };
    exits.push({ pl: planeAt(t, p.to, false), portal: p, slot, info });
    panes.push(info);
  }
  for (const e of entrances) {
    e.bounds.sort((a, b) => a - b);
    if (e.bounds.length > 0) e.lamps = flat.alloc(LAMPS * 2 * 2);
  }

  // --- Tafeln: je Stelle (gleicher Abschnitt) eine, an den Zwillingen beidseits ---
  const boards: Board[] = [];
  const sites = new Map<number, Entrance[]>();
  for (const e of entrances) {
    const list = sites.get(e.seg);
    if (list) list.push(e);
    else sites.set(e.seg, [e]);
  }
  for (const [seg, frames] of sites) {
    const left = frames.some((f) => f.lat1 <= 0);
    const right = frames.some((f) => f.lat0 >= 0);
    const bseg = walk(t, seg, -BOARD_AT);
    const pl = planeAt(t, bseg, true);
    // Pro Tafel: Straße, Rahmen-Piktogramme (4 Balken) und Doppelwinkel je Rahmen
    for (const side of [left ? -1 : 0, right ? 1 : 0]) {
      if (side === 0) continue;
      boards.push({ pl, lat: side * BOARD_LAT, frames, slot: flat.alloc(2 + frames.length * (4 * 2 + 2 * 2 * 2)) });
    }
  }

  // Randspiegel (immer offen): festes Zeichen im Fries statt der Uhr
  const fixedSigns: { e: Entrance; slot: Slot }[] = [];
  for (const e of entrances) if (!e.lamps) fixedSigns.push({ e, slot: flat.alloc(2 * (2 + 2 * 2 * 2)) });

  // Wo am Randspiegel das Geländer fehlt: schraffierte Kante auf dem Randstreifen
  const hatches: { s: Strip; side: number; seg: number; slot: Slot; len: number }[] = [];
  for (const e of entrances) {
    if (e.bounds.length > 0) continue;
    for (const [bit, side] of [
      [EDGE_OPEN_L, -1],
      [EDGE_OPEN_R, 1],
    ] as const) {
      if (!(t.edge[e.seg] & bit)) continue;
      let a = e.seg;
      let b = e.seg;
      for (let i = 0; i < 200 && t.edge[t.prev[a]] & bit; i++) a = t.prev[a];
      for (let i = 0; i < 200 && t.edge[t.next[b]] & bit; i++) b = t.next[b];
      const n = Math.max(2, ((b - a + t.total) % t.total) + 1);
      const len = (n - 1) * t.step;
      hatches.push({ s: strip(t, a, n), side, seg: e.seg, slot: floor.alloc(Math.ceil(len / 1.2) * 2 + 2), len });
    }
  }

  flat.finish();
  glass.finish();
  floor.finish();

  // --- Stehende Körper: Rahmen, Ausgangsrahmen, Tafeln (ein Toon-Netz) ---
  const goldBox = (T: Xform, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, col: RGB, top?: RGB): void =>
    boxT(stat, T, x0, x1, y0, y1, z0, z1, col, { top, noBottom: y0 <= 0.001 });

  /** Dreiecksgiebel als Prisma: Grundlinie x0 … x1 bei y0, Spitze bei (Mitte, y1), Tiefe z0 … z1. */
  const gable = (T: Xform, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, col: RGB): void => {
    const xm = (x0 + x1) / 2;
    const A = (z: number): V3 => T(x0, y0, z);
    const B = (z: number): V3 => T(x1, y0, z);
    const C = (z: number): V3 => T(xm, y1, z);
    const fwd = T(0, 0, 1);
    const org = T(0, 0, 0);
    const f: V3 = [fwd[0] - org[0], fwd[1] - org[1], fwd[2] - org[2]];
    const back: V3 = [-f[0], -f[1], -f[2]];
    face(stat, A(z0), B(z0), C(z0), C(z0), back, col);
    face(stat, A(z1), B(z1), C(z1), C(z1), f, col);
    const up = T(0, 1, 0);
    const u: V3 = [up[0] - org[0], up[1] - org[1], up[2] - org[2]];
    const r = T(1, 0, 0);
    const rr: V3 = [r[0] - org[0], r[1] - org[1], r[2] - org[2]];
    face(stat, A(z0), A(z1), C(z1), C(z0), [u[0] - rr[0], u[1] - rr[1], u[2] - rr[2]], col);
    face(stat, B(z1), B(z0), C(z0), C(z1), [u[0] + rr[0], u[1] + rr[1], u[2] + rr[2]], col);
  };

  /** Doppelpyramide (Raute) als Zierknauf um (x, y) – Halbmesser r, Höhe h. */
  const knob = (T: Xform, x: number, y: number, r: number, h: number, col: RGB): void => {
    const org = T(x, y, 0);
    const top = T(x, y + h, 0);
    const bot = T(x, y - h, 0);
    const ring: V3[] = [T(x - r, y, 0), T(x, y, r), T(x + r, y, 0), T(x, y, -r)];
    for (let k = 0; k < 4; k++) {
      const a = ring[k];
      const b = ring[(k + 1) % 4];
      const mid: V3 = [(a[0] + b[0]) / 2 - org[0], 0, (a[2] + b[2]) / 2 - org[2]];
      face(stat, a, b, top, top, [mid[0], 0.5, mid[2]], col);
      face(stat, b, a, bot, bot, [mid[0], -0.5, mid[2]], col);
    }
  };

  /** Prunkrahmen über der Öffnung lat0 … lat1. rich: Eingang (mit Fries für die Uhr, Giebel, Krone). */
  const frame = (pl: Plane, lat0: number, lat1: number, rich: boolean): void => {
    const T = xform(pl);
    const hp = POST / 2;
    const xm = (lat0 + lat1) / 2;
    // Pfosten: schlank, ohne Sockel, genau auf lat0 und lat1
    for (const x of [lat0, lat1]) {
      goldBox(T, x - hp, x + hp, 0, H, -0.15, 0.15, C_GOLD);
      if (detail) {
        // Ringe und Kapitell (nicht breiter als 0,3 m)
        for (const y of rich ? [1.25, 2.5, 3.75] : [2.3]) goldBox(T, x - 0.15, x + 0.15, y - 0.06, y + 0.06, -0.17, 0.17, C_GOLD_D);
        goldBox(T, x - 0.15, x + 0.15, H - 0.3, H, -0.18, 0.18, C_GOLD_HI);
      }
      // Glanz an der Innenkante – das Einzige, was ein leerer Rahmen in der Öffnung zeigt
      const inner = x === lat0 ? x + hp : x - hp - 0.04;
      goldBox(T, inner, inner + 0.04, 0.05, H - 0.05, -0.05, 0.05, C_GLINT);
    }
    goldBox(T, lat0 + hp, lat1 - hp, H - 0.05, H - 0.01, -0.05, 0.05, C_GLINT);
    // Balken
    goldBox(T, lat0 - 0.2, lat1 + 0.2, H, H + BEAM, -0.2, 0.2, C_GOLD, C_GOLD_HI);
    if (rich) {
      // Fries (Hintergrund der Uhr), Gesims, Giebel
      const y0 = H + BEAM;
      goldBox(T, lat0 - 0.06, lat1 + 0.06, y0, y0 + FRIEZE, -0.14, 0.14, C_GOLD_D);
      goldBox(T, lat0 - 0.32, lat1 + 0.32, y0 + FRIEZE, y0 + FRIEZE + CORNICE, -0.24, 0.24, C_GOLD, C_GOLD_HI);
      const g0 = y0 + FRIEZE + CORNICE;
      gable(T, lat0 - 0.22, lat1 + 0.22, g0, g0 + GABLE, -0.13, 0.13, C_GOLD);
      if (detail) {
        // Relief im Giebel, Krone mit drei Zacken und Knauf, Schleifen (Voluten) an den Ecken
        gable(T, xm - (lat1 - lat0) * 0.3, xm + (lat1 - lat0) * 0.3, g0 + 0.12, g0 + GABLE * 0.7, -0.17, 0.17, C_GOLD_HI);
        const top = g0 + GABLE;
        goldBox(T, xm - 0.32, xm + 0.32, top - 0.1, top + 0.14, -0.14, 0.14, C_GOLD_D);
        for (const dx of [-0.24, 0, 0.24]) gable(T, xm + dx - 0.1, xm + dx + 0.1, top + 0.14, top + (dx === 0 ? 0.62 : 0.42), -0.06, 0.06, C_GOLD_HI);
        knob(T, xm, top + 0.82, 0.13, 0.18, C_GOLD_HI);
        for (const x of [lat0 - 0.2, lat1 + 0.2]) {
          knob(T, x, g0 + 0.2, 0.14, 0.2, C_GOLD_HI);
          // Volute: zwei schräg gestellte Wülste unter dem Gesims
          const s = x < xm ? 1 : -1;
          goldBox(T, x - 0.04 + s * 0.04, x + 0.04 + s * 0.04, y0 + 0.05, y0 + FRIEZE - 0.05, -0.2, 0.2, C_GOLD);
          knob(T, x + s * 0.05, y0 + 0.12, 0.12, 0.14, C_GOLD_HI);
        }
      }
    } else {
      // Ausgang: schlichter – flacher Bogen über dem Balken und ein Knauf
      const y0 = H + BEAM;
      gable(T, lat0 - 0.1, lat1 + 0.1, y0, y0 + 0.45, -0.1, 0.1, C_GOLD);
      if (detail) knob(T, xm, y0 + 0.62, 0.12, 0.16, C_GOLD_HI);
    }
  };

  for (const e of entrances) frame(e.pl, e.lat0, e.lat1, true);
  for (const x of exits) frame(x.pl, x.portal.lat0, x.portal.lat1, false);
  for (const b of boards) {
    const T = xform(b.pl);
    const L = b.lat;
    // Masten bis unter das Gelände (die Galerie steht frei, darunter liegt der Park)
    const foot = -b.pl.by - 1;
    for (const dx of [-1.55, 1.55]) goldBox(T, L + dx - 0.09, L + dx + 0.09, foot, 2.3, -0.09, 0.09, C_GOLD_D);
    goldBox(T, L - 2.15, L + 2.15, 2.25, 4.55, 0.0, 0.16, C_GOLD, C_GOLD_HI);
    goldBox(T, L - 2.0, L + 2.0, 2.38, 4.42, -0.06, 0.0, C_NAVY);
    if (detail) knob(T, L, 4.75, 0.14, 0.2, C_GOLD_HI);
  }

  const toon = toonMaterial({ vertexColors: true });
  disposables.push(toon);
  const statTris = stat.triangles;
  const statGeo = stat.build();
  disposables.push(statGeo);
  const statMesh = new THREE.Mesh(statGeo, toon);
  statMesh.name = 'spiegel-rahmen';
  if (detail) withOutline(statMesh, 0.035);
  group.add(statMesh);

  // --- Bewegte Netze ---
  // Ohne Dunst (fog: false): Türkis und Pink sollen auch aus 80 m kräftig bleiben.
  const flatMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: false });
  const glassMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false });
  // Etwas stärker nach vorn gezogen als die Fahrbahnfarbe (world.ts: −2/−4): keine Z-Kämpfe mit Linien.
  const floorMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6 });
  disposables.push(flatMat, glassMat, floorMat, flat.geo, glass.geo, floor.geo);
  const flatMesh = new THREE.Mesh(flat.geo, flatMat);
  const glassMesh = new THREE.Mesh(glass.geo, glassMat);
  const floorMesh = new THREE.Mesh(floor.geo, floorMat);
  flatMesh.name = 'spiegel-lampen';
  glassMesh.name = 'spiegel-flaechen';
  floorMesh.name = 'spiegel-teppiche';
  for (const m of [flatMesh, glassMesh, floorMesh]) m.frustumCulled = false;
  floorMesh.renderOrder = 1;
  glassMesh.renderOrder = 2;
  glassMesh.userData.role = 'spiegel';
  glassMesh.userData.panes = panes;
  floorMesh.userData.role = 'teppich';
  floorMesh.userData.carpets = carpets;
  group.add(flatMesh, glassMesh, floorMesh);
  group.userData.triangles = statTris * (detail ? 2 : 1) + flat.triangles + glass.triangles + floor.triangles;
  group.userData.drawCalls = detail ? 5 : 4;
  group.userData.overflow = () => flat.overflow || glass.overflow || floor.overflow;

  // --- Stehendes in den bewegten Netzen (einmal geschrieben) ---
  for (const { e, slot } of fixedSigns) {
    flat.begin(slot);
    const xm = (e.lat0 + e.lat1) / 2;
    const y0 = H + BEAM + 0.1;
    for (const z of [-0.16, 0.16]) {
      flat.rect(e.pl, z, xm - 0.75, y0, xm + 0.75, y0 + FRIEZE - 0.2, C_INK, 1);
      chevrons(flat, e.pl, z * 1.07, xm, y0 + 0.05, 0.9, 0.16, 0.1, 0.14, 1, C_FWD, 1);
    }
    flat.close(e.pl.bx, e.pl.by, e.pl.bz);
  }
  for (const h of hatches) {
    floor.begin(h.slot);
    // Schräge Streifen gelb/tusche auf dem Randstreifen zwischen Fahrbahnkante und Abbruch
    const l0 = h.side * (t.rh[h.seg] + 0.15);
    const l1 = h.side * (t.wh[h.seg] - 0.1);
    const lo = Math.min(l0, l1);
    const hi = Math.max(l0, l1);
    const n = Math.floor(h.len / 1.2);
    for (let k = 0; k < n; k++) {
      const w = k * 1.2;
      floor.quadS(h.s, 0.045, w, lo, w + 0.6, lo, w + 0.6 + (hi - lo) * 0.5, hi, w + (hi - lo) * 0.5, hi, k % 2 === 0 ? C_WARN : C_INK, 0.95);
    }
    floor.close(h.s.x[0], h.s.y[0], h.s.z[0]);
  }

  // --- Zustand je Rahmen aus der Rennzeit ---
  function phase(e: Entrance, time: number): void {
    e.open = null;
    e.coming = null;
    e.until = Infinity;
    for (const p of e.portals) {
      if (portalOpen(p, time)) e.open = p;
      else {
        const u = portalUntil(p, time);
        if (u < e.until) {
          e.until = u;
          e.coming = p;
        }
      }
    }
    if (e.period <= 0 || e.bounds.length === 0) {
      e.left = Infinity;
      e.len = Infinity;
      return;
    }
    // Wie der Plan selbst: vor dem Start steht er still auf dem Stand von Zeit 0.
    const c = time <= 0 ? 0 : time % e.period;
    let next = Infinity;
    let prev = -Infinity;
    for (const b of e.bounds) {
      if (b > c && b < next) next = b;
      if (b <= c && b > prev) prev = b;
    }
    if (next === Infinity) next = e.bounds[0] + e.period;
    if (prev === -Infinity) prev = e.bounds[e.bounds.length - 1] - e.period;
    e.left = next - c;
    e.len = next - prev;
  }

  // --- Zeichnen je Bild ---

  function drawMirror(e: Entrance, time: number): void {
    const pl = e.pl;
    glass.begin(e.mirror);
    const sec = Math.max(0, time) / 60;
    const p = e.open;
    e.info.kind = p ? p.kind : -1;
    if (p) {
      const fwd = p.kind === 0;
      const main = fwd ? C_FWD : C_BACK;
      const deep = fwd ? C_FWD_D : C_BACK_D;
      const hi = fwd ? C_FWD_HI : C_BACK_HI;
      const left = portalLeft(p, time);
      // Ankündigung des Verschwindens: zieht sich zur Mitte zusammen, pulsiert ruhig
      const k = left < PORTAL_WARN ? smooth(1 - left / PORTAL_WARN) : 0;
      const pulse = k > 0 ? 1 - 0.28 * k * (0.5 - 0.5 * Math.cos(sec * Math.PI * 2 * PULSE_HZ)) : 1;
      const x0 = e.lat0;
      const x1 = e.lat1;
      // Rand: vorwärts glatt und hell, zurück mit schrägen Warnstreifen
      const ra = 0.9 * pulse;
      if (fwd) {
        glass.rect(pl, 0, x0, 0, x0 + RIM, H, main, ra);
        glass.rect(pl, 0, x1 - RIM, 0, x1, H, main, ra);
        glass.rect(pl, 0, x0 + RIM, H - RIM, x1 - RIM, H, main, ra);
        glass.rect(pl, 0, x0 + RIM, 0, x1 - RIM, RIM_B, main, ra);
      } else {
        stripes(pl, x0, 0, x0 + RIM, H, ra, true);
        stripes(pl, x1 - RIM, 0, x1, H, ra, true);
        stripes(pl, x0 + RIM, H - RIM, x1 - RIM, H, ra, false);
        stripes(pl, x0 + RIM, 0, x1 - RIM, RIM_B, ra, false);
      }
      // Fläche: Raster 3 × 6, unten tiefer, oben heller; vorwärts mit wanderndem Schimmer
      const ix0 = x0 + RIM;
      const ix1 = x1 - RIM;
      const iy0 = RIM_B;
      const iy1 = H - RIM;
      const cx = (ix0 + ix1) / 2;
      const cy = (iy0 + iy1) / 2;
      const s = 1 - 0.82 * k;
      const hw = ((ix1 - ix0) / 2) * s;
      const hh = ((iy1 - iy0) / 2) * s;
      const COLS = 3;
      const ROWS = 6;
      const fade = pulse * (1 - 0.25 * k);
      for (let r = 0; r < ROWS; r++) {
        const ya = cy - hh + (2 * hh * r) / ROWS;
        const yb = cy - hh + (2 * hh * (r + 1)) / ROWS;
        for (let q = 0; q < COLS; q++) {
          const xa = cx - hw + (2 * hw * q) / COLS;
          const xb = cx - hw + (2 * hw * (q + 1)) / COLS;
          sheetV(pl, xa, ya, cy, hh, sec, fwd, deep, main, hi, fade);
          sheetV(pl, xb, ya, cy, hh, sec, fwd, deep, main, hi, fade);
          sheetV(pl, xb, yb, cy, hh, sec, fwd, deep, main, hi, fade);
          sheetV(pl, xa, ya, cy, hh, sec, fwd, deep, main, hi, fade);
          sheetV(pl, xb, yb, cy, hh, sec, fwd, deep, main, hi, fade);
          sheetV(pl, xa, yb, cy, hh, sec, fwd, deep, main, hi, fade);
        }
      }
      // Doppelwinkel: vorwärts nach oben weisend und steigend, zurück nach unten weisend und sinkend
      const cw = Math.min(ix1 - ix0 - 0.3, 3.0);
      const ch = cw * 0.4;
      const th = 0.36;
      const gap = 0.72;
      const dh = ch + gap + th;
      const per = 2.7;
      const cycle = per * nChev;
      for (let g = 0; g < nChev; g++) {
        const u = frac((sec * 1.25 + g * per) / cycle) * cycle;
        const yb = fwd ? u - dh : H - u;
        for (let j = 0; j < 2; j++) {
          const y = yb + j * (ch + gap) * 1;
          const lo = y;
          const top = y + ch + th;
          const a = smooth((lo - iy0 - 0.15) / 0.5) * smooth((iy1 - 0.15 - top) / 0.5) * fade * (1 - 0.6 * k);
          if (a < 0.01) continue;
          // in die schrumpfende Fläche abgebildet
          const yy = cy + (y - cy) * s;
          // Tuscheschatten (leicht versetzt) und heller Winkel darüber: hebt sich auch vor hellem Himmel ab
          chevrons(glass, pl, -0.015, cx + 0.07 * s, yy - 0.09 * s, cw * s, ch * s, th * s, 0, 1, C_INK, Math.min(1, a) * 0.7, fwd ? 1 : -1);
          chevrons(glass, pl, -0.03, cx, yy, cw * s, ch * s, th * s, 0, 1, hi, Math.min(1, a * 1.05), fwd ? 1 : -1);
        }
      }
    }
    glass.close(pl.bx, pl.by, pl.bz);

    // Vorbote: der nächste Spiegel baut sich in blassen Lamellen von unten auf
    glass.begin(e.herald);
    const c = e.coming;
    if (c && e.until <= PORTAL_WARN && e.until > 0) {
      const k = 1 - e.until / PORTAL_WARN;
      const pale = mixInto(TMP_A, c.kind === 0 ? C_FWD : C_BACK, C_WHITE, 0.35);
      const n = 6;
      for (let j = 0; j < n; j++) {
        const a = clamp01(k * n - j) * 0.26;
        if (a <= 0) continue;
        const ya = 0.1 + (j * (H - 0.2)) / n + 0.06;
        const yb = 0.1 + ((j + 1) * (H - 0.2)) / n - 0.06;
        glass.rect(pl, 0.03, e.lat0 + POST / 2, ya, e.lat1 - POST / 2, yb, pale, a);
      }
    }
    glass.close(pl.bx, pl.by, pl.bz);
  }

  /** Eine Ecke der Spiegelfläche: Farbe nach Höhe, vorwärts mit schräg wanderndem Schimmer. */
  function sheetV(pl: Plane, x: number, y: number, cy: number, hh: number, sec: number, fwd: boolean, deep: RGB, main: RGB, hi: RGB, fade: number): void {
    const v = hh > 1e-6 ? clamp01((y - (cy - hh)) / (2 * hh)) : 0.5;
    const col = mixInto(TMP_B, deep, main, 0.05 + 0.5 * v);
    let a = 0.74 + 0.1 * v;
    if (fwd) {
      // Schimmer: weiches Band, das schräg nach oben zieht (eine Welle alle 2,6 s an jeder Stelle)
      const w = 0.5 + 0.5 * Math.cos(((y + 0.45 * x - sec * 1.4) / 3.6) * Math.PI * 2);
      const sh = w * w * w * w;
      mixInto(col, col, hi, 0.55 * sh);
      a += 0.12 * sh;
    }
    glass.vl(pl, x, y, 0, col, a * fade);
  }

  /** Rand mit schrägen Warnstreifen (pink/tusche), senkrecht (vert) oder waagrecht. */
  function stripes(pl: Plane, xa: number, ya: number, xb: number, yb: number, a: number, vert: boolean): void {
    const W = 0.42;
    const len = vert ? yb - ya : xb - xa;
    const wid = vert ? xb - xa : yb - ya;
    const n = Math.min(16, Math.ceil((len + wid) / W));
    for (let k = 0; k < n; k++) {
      // Parallelogramm unter 45°, an den Enden auf das Rechteck beschnitten
      const s0 = -wid + k * W;
      const s1 = s0 + W;
      const c = k % 2 === 0 ? C_BACK : C_INK;
      const aa = k % 2 === 0 ? a : a * 0.85;
      const c0 = Math.max(0, Math.min(len, s0));
      const c1 = Math.max(0, Math.min(len, s1));
      const d0 = Math.max(0, Math.min(len, s0 + wid));
      const d1 = Math.max(0, Math.min(len, s1 + wid));
      if (vert) glass.quad(pl, 0, xa, ya + c0, xa, ya + c1, xb, ya + d1, xb, ya + d0, c, aa);
      else glass.quad(pl, 0, xa + c0, ya, xa + c1, ya, xa + d1, yb, xa + d0, yb, c, aa);
    }
  }

  function drawExit(x: Exit, time: number): void {
    const pl = x.pl;
    const p = x.portal;
    glass.begin(x.slot);
    const sec = Math.max(0, time) / 60;
    // Stärke: kräftiger, solange der Eingang offen ist (weich über ein Drittel Sekunde)
    let str: number;
    if (portalOpen(p, time)) str = clamp01(portalLeft(p, time) / 20);
    else str = clamp01(1 - portalUntil(p, time) / 20);
    const main = p.kind === 0 ? C_FWD : C_BACK;
    const hi = p.kind === 0 ? C_FWD_HI : C_BACK_HI;
    const x0 = p.lat0 + 0.12;
    const x1 = p.lat1 - 0.12;
    const a = 0.1 + 0.14 * str;
    glass.rectG(pl, 0, x0, 0.05, x1, H - 0.05, main, a, main, a * 0.55);
    // Ringe laufen von der Mitte nach außen
    const cx = (x0 + x1) / 2;
    const cy = H / 2;
    const hw0 = (x1 - x0) / 2;
    const hh0 = H / 2 - 0.05;
    for (let i = 0; i < 3; i++) {
      const u = frac(sec * 0.45 + i / 3);
      const sc = 0.12 + 0.88 * u;
      const ra = (1 - u) * smooth(u / 0.15) * (0.3 + 0.45 * str);
      const hw = hw0 * sc;
      const hh = hh0 * sc;
      const b = 0.08 + 0.1 * sc;
      const col = mixInto(TMP_C, main, hi, 0.5);
      glass.rect(pl, -0.01, cx - hw, cy - hh, cx + hw, cy - hh + b, col, ra);
      glass.rect(pl, -0.01, cx - hw, cy + hh - b, cx + hw, cy + hh, col, ra);
      glass.rect(pl, -0.01, cx - hw, cy - hh + b, cx - hw + b, cy + hh - b, col, ra);
      glass.rect(pl, -0.01, cx + hw - b, cy - hh + b, cx + hw, cy + hh - b, col, ra);
    }
    glass.close(pl.bx, pl.by, pl.bz);
  }

  function drawCarpet(e: Entrance, time: number): void {
    const s = e.carpetStrip;
    floor.begin(e.carpet);
    const sec = Math.max(0, time) / 60;
    const p = e.open;
    const kind = p ? p.kind : -1;
    e.carpetInfo.kind = kind;
    // Weg: Stützpunkt 0 liegt CARPET + 1 Abschnitte vor seg; die Rahmenebene bei (CARPET + 1.5) Abschnitten
    const wEnd = (CARPET + 1.5) * s.step - 0.15;
    const wStart = wEnd - CARPET;
    const lo = e.lat0 + 0.3;
    const hi = e.lat1 - 0.3;
    const cl = (lo + hi) / 2;
    const D = Math.min(2.6, (hi - lo) * 0.6);
    const T = 0.95;
    let col: RGB = C_NEUTRAL;
    let alpha = 0.16;
    let dir = 0;
    let range = CARPET;
    if (kind === 0) {
      col = C_FWD;
      alpha = 0.92;
      dir = 1;
    } else if (kind === 1) {
      col = C_BACK;
      alpha = 0.92;
      dir = -1;
      range = CARPET - 6;
    }
    if (p) {
      const left = portalLeft(p, time);
      if (left < PORTAL_WARN) alpha *= 1 - 0.4 * smooth(1 - left / PORTAL_WARN);
    }
    const sp = range / nCarpet;
    const speed = 4.5;
    for (let i = 0; i < nCarpet; i++) {
      const w0 = frac((i * sp + dir * sec * speed) / range) * range;
      const a = alpha * smooth(w0 / 2.5) * smooth((range - (w0 + D + T)) / 2.5);
      if (a < 0.01) continue;
      const w = wStart + w0;
      if (dir >= 0) {
        // Spitze vorn (auf den Rahmen zu)
        floor.quadS(s, 0.05, w, lo, w + D, cl, w + D + T, cl, w + T, lo, col, a);
        floor.quadS(s, 0.05, w + D, cl, w, hi, w + T, hi, w + D + T, cl, col, a);
      } else {
        // Spitze hinten (weist dem Fahrer entgegen)
        floor.quadS(s, 0.05, w + D, lo, w, cl, w + T, cl, w + D + T, lo, col, a);
        floor.quadS(s, 0.05, w, cl, w + D, hi, w + D + T, hi, w + T, cl, col, a);
      }
    }
    if (kind === 1) {
      // Durchgestrichenes Feld direkt vor dem Rahmen
      const f0 = wEnd - 5.2;
      const f1 = wEnd - 0.3;
      const b = 0.3;
      floor.quadS(s, 0.05, f0, lo, f0 + b, lo, f0 + b, hi, f0, hi, col, alpha);
      floor.quadS(s, 0.05, f1 - b, lo, f1, lo, f1, hi, f1 - b, hi, col, alpha);
      floor.quadS(s, 0.05, f0 + b, lo, f1 - b, lo, f1 - b, lo + b, f0 + b, lo + b, col, alpha);
      floor.quadS(s, 0.05, f0 + b, hi - b, f1 - b, hi - b, f1 - b, hi, f0 + b, hi, col, alpha);
      const g = 0.45;
      floor.quadS(s, 0.05, f0 + b, lo + b, f0 + b + g, lo + b, f1 - b, hi - b, f1 - b - g, hi - b, col, alpha);
      floor.quadS(s, 0.05, f1 - b - g, lo + b, f1 - b, lo + b, f0 + b + g, hi - b, f0 + b, hi - b, col, alpha);
    }
    floor.close(s.x[0], s.y[0], s.z[0]);
  }

  function drawLamps(e: Entrance): void {
    if (!e.lamps) return;
    flat.begin(e.lamps);
    const pl = e.pl;
    // Anteil der verbleibenden Zeit: 1 = gerade gewechselt, 0 = jetzt
    const f = e.len > 0 && Number.isFinite(e.len) ? clamp01(e.left / e.len) : 1;
    let on: RGB;
    if (e.open) on = e.open.kind === 0 ? C_FWD : C_BACK;
    else on = mixInto(TMP_C, e.coming && e.coming.kind === 1 ? C_BACK : C_FWD, C_WHITE, 0.55);
    const x0 = e.lat0 + 0.22;
    const x1 = e.lat1 - 0.22;
    const w = (x1 - x0) / LAMPS;
    const y0 = H + BEAM + 0.16;
    const y1 = H + BEAM + FRIEZE - 0.16;
    for (let i = 0; i < LAMPS; i++) {
      // Von außen nach innen erlöschend: die mittleren Lampen leuchten am längsten
      const rank = Math.abs(i - (LAMPS - 1) / 2) - 0.5;
      const v = clamp01(f * (LAMPS / 2) - rank);
      const col = mixInto(TMP_A, C_OFF, on, v);
      const xa = x0 + i * w + 0.05;
      const xb = x0 + (i + 1) * w - 0.05;
      flat.rect(pl, -0.16, xa, y0, xb, y1, col, 1);
      flat.rect(pl, 0.16, xa, y0, xb, y1, col, 1);
    }
    flat.close(pl.bx, pl.by, pl.bz);
  }

  function drawBoard(b: Board): void {
    flat.begin(b.slot);
    const pl = b.pl;
    const q = 3.5 / 12.8;
    const L = b.lat;
    const z = -0.09;
    flat.rect(pl, z, L - 1.85, 2.55, L + 1.85, 2.72, C_ROADICON, 1);
    for (const e of b.frames) {
      const xa = L + e.lat0 * q;
      const xb = L + e.lat1 * q;
      const ya = 2.72;
      const yb = 2.72 + H * q * 1.25;
      const bw = 0.1;
      flat.rect(pl, z, xa - bw / 2, ya, xa + bw / 2, yb, C_GOLD_HI, 1);
      flat.rect(pl, z, xb - bw / 2, ya, xb + bw / 2, yb, C_GOLD_HI, 1);
      flat.rect(pl, z, xa - bw / 2, yb - bw, xb + bw / 2, yb, C_GOLD_HI, 1);
      flat.rect(pl, z, xa - bw / 2, yb + 0.06, xb + bw / 2, yb + 0.12, C_GOLD_HI, 1);
      if (e.open) {
        const fwd = e.open.kind === 0;
        const cw = (xb - xa) * 0.62;
        chevrons(flat, pl, z - 0.01, (xa + xb) / 2, ya + 0.25, cw, cw * 0.4, 0.15, 0.17, 1, fwd ? C_FWD : C_BACK, 1, fwd ? 1 : -1);
      }
    }
    flat.close(pl.bx, pl.by, pl.bz);
  }

  // Funken (nur Zierde, nur mit detail)
  let sparkAcc = 0;

  return {
    group,
    update(time: number, _seconds: number, dt: number, cam: THREE.Vector3, fx: FxSink) {
      for (const e of entrances) {
        phase(e, time);
        drawMirror(e, time);
        drawCarpet(e, time);
        drawLamps(e);
      }
      for (const x of exits) drawExit(x, time);
      for (const b of boards) drawBoard(b);
      flat.flush();
      glass.flush();
      floor.flush();
      if (detail && dt > 0) {
        sparkAcc += Math.min(dt, 0.1) * 7;
        while (sparkAcc >= 1) {
          sparkAcc -= 1;
          for (const e of entrances) {
            if (!e.open) continue;
            const dx = e.pl.bx - cam.x;
            const dz = e.pl.bz - cam.z;
            if (dx * dx + dz * dz > 90 * 90) continue;
            const lat = e.lat0 + Math.random() * (e.lat1 - e.lat0);
            const y = 0.3 + Math.random() * (H - 0.6);
            const pl = e.pl;
            fx.spark(pl.bx + pl.rx * lat, pl.by + pl.bank * lat + y, pl.bz + pl.rz * lat, 0, 0.7, 0, 1.1, 0.22, e.open.kind === 0 ? HEX_FWD : HEX_BACK, -0.4);
          }
        }
      }
    },
    dispose() {
      for (const d of disposables) d.dispose();
    },
  };
}

/**
 * Doppelwinkel („»“ hochkant): zwei Winkel übereinander, Mitte cx, Unterkante y, Breite cw, Höhe ch, Dicke th,
 * Abstand gap (0 = nur einer); dir 1 = Spitze oben, −1 = Spitze unten. Je Winkel zwei Vierecke.
 */
function chevrons(d: Dyn, pl: Plane, z: number, cx: number, y: number, cw: number, ch: number, th: number, gap: number, count: number, c: RGB, a: number, dir = 1): void {
  const n = gap > 0 ? 2 : count;
  for (let j = 0; j < n; j++) {
    const yb = y + j * (ch + gap);
    const hw = cw / 2;
    if (dir > 0) {
      // Arme von unten außen zur Spitze oben
      d.quad(pl, z, cx - hw, yb, cx, yb + ch, cx, yb + ch + th, cx - hw, yb + th, c, a);
      d.quad(pl, z, cx, yb + ch, cx + hw, yb, cx + hw, yb + th, cx, yb + ch + th, c, a);
    } else {
      // Spitze unten
      d.quad(pl, z, cx - hw, yb + ch, cx, yb, cx, yb + th, cx - hw, yb + ch + th, c, a);
      d.quad(pl, z, cx, yb, cx + hw, yb + ch, cx + hw, yb + ch + th, cx, yb + th, c, a);
    }
  }
}
