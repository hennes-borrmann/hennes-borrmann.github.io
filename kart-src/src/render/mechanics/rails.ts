// Achterbahn-Rummel: Darstellung der Holzachterbahn – zwei Schienen (je zwei Stahlprofile auf Schwellen), das weiße
// Holzgerüst darunter, die laufende Kette des Lifthügels, die Schubmagnete samt Signalmasten, die Bremsstrecke und der
// Bahnhof.
//
// Lesbarkeit geht vor Zierde: Zwischen den Profilen jeder Schiene liegt ein Farbstreifen – links Rot, rechts Türkis –,
// dieselben Farben tragen die Ringe der Signallampen. Ein Schubmagnet ist eine dunkle Platte mit Pfeil-Winkeln:
//   ruht         – dunkle, matte Platte, die Winkel nur als Umriss;
//   kündigt an   – die Winkel füllen sich ruhig von hinten nach vorn (letzte warn Ticks);
//   zieht        – Winkel sattgelb und laufend, heller Rand, additiver Schein darüber.
// Der Signalmast vor jedem Paar zeigt denselben Stand (linke/rechte Lampe) und darunter je fünf Lichter, die beim
// Ankündigen volllaufen und beim Ziehen ablaufen. Helligkeit ändert sich nur weich (Rampen von mindestens 5 Ticks).
//
// Alles, was sich bewegt oder leuchtet, ist eine reine Funktion der Rennzeit (Ticks): Zeitsprünge vor und zurück
// ergeben dasselbe Bild wie ein frischer Aufbau.
//
// Zeichentechnik: nur, was der Werkshof schon benutzt – Netze mit Eckenfarben (Toon bzw. einfache Flächen), Konturen
// für die kleinen Bauteile, Netze, deren Ecken/Farben je Bild neu gesetzt werden. Keine eigenen Shader, keine Texturen,
// keine Lichtquellen.
//
// Für die Physik ist alles Luft außer dem Deck: Über der Fahrbahn liegen innerhalb von ±4,4 m nur Profile (≤ 0,16 m),
// Schwellen, Platten, Kette und Bremsschwerter (≤ 0,14 m); Masten, Geländer und Kettenräder stehen außerhalb, das Dach
// des Bahnhofs liegt höher als 10 m über der Bahn.

import * as THREE from 'three';
import { PULSE_KICK, pulseCycle, type Pulse, type Rail } from '../../game/mechanics';
import { rightX, rightZ, segDelta, type Track } from '../../game/track';
import type { RenderEntity } from '../../game/view';
import { MeshBuilder, smooth, type RGB, type V3 } from '../build';
import type { FxSink } from '../fxApi';
import type { MechanicView } from '../mechanics';
import { rgb, toonMaterial, withOutline } from '../toon';

// --- Farben ---------------------------------------------------------------------

const C_STEEL = rgb(0xdfe4ec);
const C_STEEL_SIDE = rgb(0x7d8597);
const C_LEFT = rgb(0xe2483a); // linke Schiene: Rot
const C_RIGHT = rgb(0x1fc8c0); // rechte Schiene: Türkis
const C_TIE = rgb(0x5b3a24);
const C_TIE_SIDE = rgb(0x3b2618);
const C_WALK = rgb(0x8c7a66);
const C_WOOD = rgb(0xf2efe6); // weiß gestrichenes Holz
const C_WOOD_2 = rgb(0xe2dccd);
const C_WOOD_3 = rgb(0xcfc7b4);
const C_PLATE = rgb(0x24212b);
const C_PLATE_SIDE = rgb(0x17151c);
const C_TROUGH = rgb(0x2b2a31);
const C_RED = rgb(0xd8382c);
const C_WHITE = rgb(0xf6f0dc);
const C_MAST = rgb(0x3a3646);
const C_BOARD = rgb(0x1e1b24);
const C_PLATFORM = rgb(0xd9b27a);
const C_PLATFORM_SIDE = rgb(0x9c7448);
const C_ROOF_A = rgb(0xe2483a);
const C_ROOF_B = rgb(0xf6f0dc);
const C_GATE = rgb(0x8a5cc8);
const C_HOUSE = rgb(0x6c5a8e);

/** Leuchtgelb der Magnete und Lampen (linear). */
const Y = rgb(0xffd23a);
const Y_DIM = rgb(0x5c4a1a);
const RIM_DARK = rgb(0x3a3640);
const RIM_HOT = rgb(0xfff3c4);
const LAMP_DARK = rgb(0x2a2420);
const CHAIN_LINK = rgb(0xb9b4ab);
const CHAIN_DOG = rgb(0xff8a2a);
const SPOKE = rgb(0x2a2730);

// --- Maße -------------------------------------------------------------------------

/** Profile: halbe Spurweite, halbe Breite, Unter- und Oberkante über dem Deck. */
const GAUGE = 0.55;
const PROF_W = 0.06;
const PROF_LO = 0.02;
const PROF_HI = 0.16;
/** Schwellen: halbe Länge quer, Dicke längs, Höhe. */
const TIE_HALF = 2.95;
const TIE_D = 0.3;
const TIE_H = 0.05;
/** Farbstreifen in der Mitte jeder Schiene. */
const STRIPE_HALF = 0.3;
const STRIPE_Y = 0.06;
/** Platte eines Magneten: halbe Breite, Oberkante; Winkel darauf. */
const PLATE_HALF = 0.44;
const PLATE_Y = 0.07;
const CHEV_N = 4;
/** Kette: halbe Breite, Teilung, Oberkante der Glieder und der Mitnehmer. */
const CHAIN_HALF = 0.09;
const CHAIN_PITCH = 1.2;
const CHAIN_Y = 0.085;
const DOG_Y = 0.1;
/** Gerüst: Pfosten oben (Abstand von der Mitte), Anlauf je Meter Höhe, Stockwerkshöhe. */
const POST_LAT = 3.7;
const BATTER = 0.09;
const STOREY = 5;
const DECK_D = 1.1;

/** So wechseln die Zustände der Magnete weich (Ticks). */
const RISE = 6;
const FADE_PRE = 10;
const FADE_POST = 5;

// --- Lage auf der Strecke ---------------------------------------------------------------

/** Punkt auf der Strecke: Abschnitt (gebrochen, f zwischen Mitte und nächster Mitte), Seite, Höhe über dem Deck. */
function makeAt(t: Track) {
  return (sf: number, lat: number, up: number, out: V3 = [0, 0, 0]): V3 => {
    const s0 = Math.floor(sf);
    const f = sf - s0;
    const s1 = f > 0 ? t.next[s0] : s0;
    const g = 1 - f;
    const rx = rightX(t, s0) * g + rightX(t, s1) * f;
    const rz = rightZ(t, s0) * g + rightZ(t, s1) * f;
    out[0] = t.px[s0] * g + t.px[s1] * f + rx * lat;
    out[1] = t.py[s0] * g + t.py[s1] * f + lat * (t.bank[s0] * g + t.bank[s1] * f) + up;
    out[2] = t.pz[s0] * g + t.pz[s1] * f + rz * lat;
    return out;
  };
}

/** Lebt die Rampe von a nach b (0…1, weich)? */
function ramp(x: number, a: number, b: number): number {
  return smooth((x - a) / (b - a));
}

/**
 * Wie stark ein Magnet gerade zieht (0…1) im Stand c seines Zyklus: beim Einschalten weich auf voll, kurz vor dem Ende
 * gedimmt auf gut die Hälfte, nach dem Ende in FADE_POST Ticks aus. Außerhalb von c < on höchstens die Ausklingrampe.
 */
export function kickHeat(p: Pulse, c: number): number {
  if (c < p.on) return (0.6 + 0.4 * smooth(c / RISE)) * (1 - 0.45 * ramp(c, p.on - FADE_PRE, p.on));
  if (c < p.on + FADE_POST) return 0.55 * (1 - ramp(c, p.on, p.on + FADE_POST));
  return 0;
}

/** Fortschritt der Ankündigung 0…1 (0 außerhalb der letzten warn Ticks). */
function warnOf(p: Pulse, c: number): number {
  return c >= p.period - p.warn ? (c - (p.period - p.warn)) / p.warn : 0;
}

// --- Flächen, deren Ecken und Farben je Bild neu gesetzt werden -----------------------

class DynQuads {
  /** Während des Aufbaus wachsen die Felder; finish() legt sie in genauer Größe fest. */
  pos: Float32Array = new Float32Array(18 * 64);
  col: Float32Array = new Float32Array(18 * 64);
  private n = 0;
  readonly geo = new THREE.BufferGeometry();
  posAttr!: THREE.BufferAttribute;
  colAttr!: THREE.BufferAttribute;

  /** Neues Viereck (Platz für 6 Ecken); gibt seine Nummer zurück. */
  add(): number {
    if ((this.n + 1) * 18 > this.pos.length) {
      const grow = (a: Float32Array): Float32Array => {
        const b = new Float32Array(a.length * 2);
        b.set(a);
        return b;
      };
      this.pos = grow(this.pos);
      this.col = grow(this.col);
    }
    return this.n++;
  }

  get count(): number {
    return this.n;
  }

  /** Erste Ecke von Viereck q. */
  vertex(q: number): number {
    return q * 6;
  }

  set(q: number, a: V3, b: V3, c: V3, d: V3): void {
    const o = q * 18;
    const p = this.pos;
    p[o] = a[0]; p[o + 1] = a[1]; p[o + 2] = a[2];
    p[o + 3] = b[0]; p[o + 4] = b[1]; p[o + 5] = b[2];
    p[o + 6] = c[0]; p[o + 7] = c[1]; p[o + 8] = c[2];
    p[o + 9] = a[0]; p[o + 10] = a[1]; p[o + 11] = a[2];
    p[o + 12] = c[0]; p[o + 13] = c[1]; p[o + 14] = c[2];
    p[o + 15] = d[0]; p[o + 16] = d[1]; p[o + 17] = d[2];
  }

  color(q: number, r: number, g: number, b: number): void {
    const o = q * 18;
    const c = this.col;
    for (let k = 0; k < 18; k += 3) {
      c[o + k] = r;
      c[o + k + 1] = g;
      c[o + k + 2] = b;
    }
  }

  finish(): void {
    this.pos = this.pos.slice(0, this.n * 18);
    this.col = this.col.slice(0, this.n * 18);
    this.posAttr = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.colAttr = new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage);
    this.geo.setAttribute('position', this.posAttr);
    this.geo.setAttribute('color', this.colAttr);
  }
}

function mix(a: RGB, b: RGB, k: number, out: RGB): RGB {
  out[0] = a[0] + (b[0] - a[0]) * k;
  out[1] = a[1] + (b[1] - a[1]) * k;
  out[2] = a[2] + (b[2] - a[2]) * k;
  return out;
}

// --- Magnete ------------------------------------------------------------------------

interface Kick {
  p: Pulse;
  /** Vorberechnete Lage längs der Platte: alle 0,25 m Mitte (x, y, z) und Rechtsvektor (x, z). */
  frames: Float64Array;
  /** Erstes Viereck der Winkel (je Winkel: außen links, außen rechts, innen links, innen rechts), des Rands (4), des Scheins (1). */
  chev: number;
  rim: number;
  glow: number;
  /** Tempo der laufenden Winkel (m/s, so gewählt, dass sie nach on Ticks wieder am Ausgangsort stehen). */
  speed: number;
}

interface Lamp {
  p: Pulse;
  /** Viereck der Lampe (3 Vierecke), der fünf Lichter, des Hofs im Schein. */
  lamp: number;
  dots: number;
  halo: number;
  side: RGB;
}

const PLATE_LEN = 6;
const FRAME_STEP = 0.25;
const CHEV_SPACING = PLATE_LEN / CHEV_N;

// --- Aufbau -------------------------------------------------------------------------

export function buildRails(track: Track, detail: boolean): MechanicView {
  const t = track;
  const at = makeAt(t);
  const group = new THREE.Group();
  group.name = 'Achterbahn';

  const body = new MeshBuilder(); // Deckaufbau, Gerüst, Bremsen, Bahnsteige (Toon, ohne Kontur)
  const prof = new MeshBuilder(); // die Stahlprofile (eigenes Netz, im Test geprüft)
  const parts = new MeshBuilder(); // Masten, Kettenräder, Bahnhofsdach, Gatter (Toon mit Kontur)

  const a: V3 = [0, 0, 0];
  const b: V3 = [0, 0, 0];
  const c: V3 = [0, 0, 0];
  const d: V3 = [0, 0, 0];
  const P = (sf: number, lat: number, up: number): V3 => at(sf, lat, up, [0, 0, 0]);

  /** Band längs der Strecke von Abschnitt s0 bis s1 zwischen lat0 und lat1 auf Höhe up. */
  const strip = (mb: MeshBuilder, s0: number, s1: number, lat0: number, lat1: number, up: number, col: RGB): void => {
    mb.quad(P(s0, lat0, up), P(s0, lat1, up), P(s1, lat1, up), P(s1, lat0, up), col);
  };
  /** Senkrechte Wand längs der Strecke bei lat von up0 bis up1. */
  const wall = (mb: MeshBuilder, s0: number, s1: number, lat: number, up0: number, up1: number, col: RGB): void => {
    mb.quad(P(s0, lat, up0), P(s1, lat, up0), P(s1, lat, up1), P(s0, lat, up1), col);
  };
  /** Balken mit rechteckigem Querschnitt von p nach q (vier Seiten, ohne Stirn); side = Richtung der Breite. */
  const beam = (mb: MeshBuilder, p: V3, q: V3, w: number, h: number, sx: number, sy: number, sz: number, col: RGB, col2: RGB = col): void => {
    // Achse
    let ax = q[0] - p[0];
    let ay = q[1] - p[1];
    let az = q[2] - p[2];
    const al = Math.hypot(ax, ay, az) || 1;
    ax /= al; ay /= al; az /= al;
    // Breite: side ohne Anteil längs der Achse
    const dot = sx * ax + sy * ay + sz * az;
    let ux = sx - dot * ax;
    let uy = sy - dot * ay;
    let uz = sz - dot * az;
    const ul = Math.hypot(ux, uy, uz) || 1;
    ux = (ux / ul) * w * 0.5; uy = (uy / ul) * w * 0.5; uz = (uz / ul) * w * 0.5;
    // Höhe: senkrecht zu Achse und Breite
    let vx = ay * uz - az * uy;
    let vy = az * ux - ax * uz;
    let vz = ax * uy - ay * ux;
    const vl = Math.hypot(vx, vy, vz) || 1;
    vx = (vx / vl) * h * 0.5; vy = (vy / vl) * h * 0.5; vz = (vz / vl) * h * 0.5;
    const corner = (o: V3, su: number, sv: number): V3 => [o[0] + ux * su + vx * sv, o[1] + uy * su + vy * sv, o[2] + uz * su + vz * sv];
    const p00 = corner(p, -1, -1), p10 = corner(p, 1, -1), p11 = corner(p, 1, 1), p01 = corner(p, -1, 1);
    const q00 = corner(q, -1, -1), q10 = corner(q, 1, -1), q11 = corner(q, 1, 1), q01 = corner(q, -1, 1);
    mb.quad(p00, p10, q10, q00, col2);
    mb.quad(p10, p11, q11, q10, col);
    mb.quad(p11, p01, q01, q11, col2);
    mb.quad(p01, p00, q00, q01, col);
  };
  /** Flache Strebe (ein Viereck, beidseitig sichtbar) von p nach q, Breite w in Richtung n × Achse. */
  const brace = (mb: MeshBuilder, p: V3, q: V3, w: number, nx: number, ny: number, nz: number, col: RGB): void => {
    const ax = q[0] - p[0];
    const ay = q[1] - p[1];
    const az = q[2] - p[2];
    let ux = ay * nz - az * ny;
    let uy = az * nx - ax * nz;
    let uz = ax * ny - ay * nx;
    const ul = Math.hypot(ux, uy, uz) || 1;
    ux = (ux / ul) * w * 0.5; uy = (uy / ul) * w * 0.5; uz = (uz / ul) * w * 0.5;
    mb.quad([p[0] - ux, p[1] - uy, p[2] - uz], [p[0] + ux, p[1] + uy, p[2] + uz], [q[0] + ux, q[1] + uy, q[2] + uz], [q[0] - ux, q[1] - uy, q[2] - uz], col);
  };

  // Alles, was auf andere Fahrbahn fallen würde, bleibt weg (dort, wo die Strecke unter der Bahn hindurchführt).
  const blocked = (x: number, z: number, topY: number, own: number): boolean => {
    for (let k = 0; k < t.total; k += 2) {
      if (Math.abs(segDelta(t, own, k)) < 24) continue;
      if (t.py[k] < topY - 2 && Math.hypot(t.px[k] - x, t.pz[k] - z) < t.wh[k] + 1.5) return true;
    }
    return false;
  };

  const kicks: Kick[] = [];
  const lamps: Lamp[] = [];
  const dyn = new DynQuads();
  const glow = new DynQuads();
  const chainQ = new DynQuads();
  const chains: { s0: number; len: number; lat: number; speed: number; first: number; links: number }[] = [];
  const wheels: { s: number; lat: number; up: number; r: number; speed: number; q: number }[] = [];
  const brakeSegs: { s0: number; s1: number; lanes: number[] }[] = [];

  for (const r of t.rails) buildRail(r);

  function buildRail(r: Rail): void {
    const first = r.first;
    const last = r.first + r.count - 1;

    // --- Stützpunkte längs: so weit auseinander, wie es die Krümmung erlaubt (≤ 2 cm Abweichung, höchstens 6 m) ---
    const dev = (i: number, j: number): number => {
      let worst = 0;
      for (const lat of [-2.6, 2.6]) {
        const A = P(i, lat, 0);
        const B = P(j, lat, 0);
        const ex = B[0] - A[0], ey = B[1] - A[1], ez = B[2] - A[2];
        const el = ex * ex + ey * ey + ez * ez;
        for (let m = i + 1; m < j; m++) {
          const M = P(m, lat, 0);
          const k = ((M[0] - A[0]) * ex + (M[1] - A[1]) * ey + (M[2] - A[2]) * ez) / el;
          worst = Math.max(worst, Math.hypot(A[0] + ex * k - M[0], A[1] + ey * k - M[1], A[2] + ez * k - M[2]));
        }
      }
      return worst;
    };
    const breaks: number[] = [first];
    for (let i = first; i < last; ) {
      let j = i + 1;
      for (let k = i + 2; k <= Math.min(i + (detail ? 6 : 9), last); k++) {
        if (dev(i, k) > (detail ? 0.02 : 0.04)) break;
        j = k;
      }
      breaks.push(j);
      i = j;
    }

    const lanes = r.lanes;
    for (let n = 0; n + 1 < breaks.length; n++) {
      const s0 = breaks[n];
      const s1 = breaks[n + 1];
      for (const lane of lanes) {
        const side = lane < 0 ? C_LEFT : C_RIGHT;
        // zwei Stahlprofile: Seite, Lauffläche, Seite
        for (const g of [-GAUGE, GAUGE]) {
          const cl = lane + g;
          wall(prof, s0, s1, cl - PROF_W, PROF_LO, PROF_HI, C_STEEL_SIDE);
          strip(prof, s0, s1, cl - PROF_W, cl + PROF_W, PROF_HI, C_STEEL);
          wall(prof, s0, s1, cl + PROF_W, PROF_LO, PROF_HI, C_STEEL_SIDE);
        }
        // Farbstreifen in der Mitte der Schiene: links Rot, rechts Türkis
        strip(body, s0, s1, lane - STRIPE_HALF, lane + STRIPE_HALF, STRIPE_Y, side);
      }
      // Laufstege: in der Mitte und außen (Gitterrost)
      strip(body, s0, s1, -0.6, 0.6, STRIPE_Y, C_WALK);
      if (detail) {
        strip(body, s0, s1, -3.85, -3.25, 0.04, C_WALK);
        strip(body, s0, s1, 3.25, 3.85, 0.04, C_WALK);
      }
    }

    // --- Schwellen: quer über beide Schienen, Oberseite und Stirn gegen die Fahrtrichtung ---
    const tieStep = detail ? 1.25 : 2.5;
    for (let u = 0.4; first + u < last; u += tieStep) {
      const s0 = first + u - TIE_D / 2 / t.step;
      const s1 = first + u + TIE_D / 2 / t.step;
      strip(body, s0, s1, -TIE_HALF, TIE_HALF, TIE_H, C_TIE);
      body.quad(P(s0, TIE_HALF, 0), P(s0, -TIE_HALF, 0), P(s0, -TIE_HALF, TIE_H), P(s0, TIE_HALF, TIE_H), C_TIE_SIDE);
    }

    // --- Gerüst: weiße Holzböcke vom Gelände bis unter das Deck ---
    const bentStep = detail ? 4 : 8;
    let prevBent: { s: number; levels: number[]; lat: (y: number) => number } | null = null;
    for (let s = first + 2; s <= last - 1; s += bentStep) {
      // Die Pfeiler der Welt (jeder 14. Abschnitt, Mitte bei 7) übernehmen dort die Rolle des Bocks.
      const m = (((s - 7) % 14) + 14) % 14;
      if (m <= 1 || m >= 13) {
        prevBent = null;
        continue;
      }
      const bank = t.bank[s];
      const capTop = (lat: number): number => t.py[s] + lat * bank - DECK_D;
      const capBot = Math.min(capTop(-POST_LAT), capTop(POST_LAT)) - 0.4;
      const foot = Math.min(1, t.py[s] - 3) - 1.2;
      if (capBot - foot < 1) {
        prevBent = null;
        continue;
      }
      const lat = (y: number): number => POST_LAT + BATTER * (capBot - y);
      const rx = rightX(t, s);
      const rz = rightZ(t, s);
      const tx = t.tx[s];
      const tz = t.tz[s];
      const pt = (l: number, y: number): V3 => [t.px[s] + rx * l, y, t.pz[s] + rz * l];
      if (blocked(t.px[s] + rx * lat(foot), t.pz[s] + rz * lat(foot), capBot, s) || blocked(t.px[s] - rx * lat(foot), t.pz[s] - rz * lat(foot), capBot, s)) {
        prevBent = null;
        continue;
      }
      // Kappe unter dem Deck (folgt der Querneigung)
      beam(body, [t.px[s] - rx * 4.2, capTop(-4.2) - 0.2, t.pz[s] - rz * 4.2], [t.px[s] + rx * 4.2, capTop(4.2) - 0.2, t.pz[s] + rz * 4.2], 0.4, 0.4, tx, 0, tz, C_WOOD, C_WOOD_2);
      // Pfosten mit Anlauf
      for (const sg of [-1, 1]) {
        beam(body, pt(sg * lat(foot), foot), pt(sg * POST_LAT, capTop(sg * POST_LAT) - 0.3), 0.36, 0.36, tx, 0, tz, C_WOOD, C_WOOD_2);
      }
      // Stockwerke: Riegel, Kreuzstreben, Längsverband zum vorigen Bock
      const levels: number[] = [];
      for (let y = capBot; y > foot + 1.5; y -= STOREY) levels.push(y);
      levels.push(Math.max(foot + 0.8, levels[levels.length - 1] - STOREY));
      for (let k = 0; k < levels.length; k++) {
        const y = levels[k];
        if (k > 0) brace(body, pt(-lat(y), y), pt(lat(y), y), 0.3, tx, 0, tz, C_WOOD_2);
        if (detail && k + 1 < levels.length) {
          const y1 = levels[k + 1];
          brace(body, pt(-lat(y), y), pt(lat(y1), y1), 0.22, tx, 0, tz, C_WOOD_3);
          brace(body, pt(lat(y), y), pt(-lat(y1), y1), 0.22, tx, 0, tz, C_WOOD_3);
        }
      }
      if (prevBent && s - prevBent.s <= bentStep + 0.5) {
        const pb = prevBent;
        const ps = pb.s;
        const prx = rightX(t, ps);
        const prz = rightZ(t, ps);
        const pp = (l: number, y: number): V3 => [t.px[ps] + prx * l, y, t.pz[ps] + prz * l];
        const nk = Math.min(levels.length, pb.levels.length);
        for (let k = 0; k < nk; k++) {
          for (const sg of [-1, 1]) {
            const yA = pb.levels[k];
            const yB = levels[k];
            // Längsriegel in der Seitenebene
            const A = pp(sg * pb.lat(yA), yA);
            const B = pt(sg * lat(yB), yB);
            brace(body, A, B, 0.28, rx * sg, 0, rz * sg, C_WOOD_2);
            // Diagonale zum nächsten Stockwerk darunter (abwechselnd)
            if (detail && k + 1 < nk) {
              const flip = ((s / bentStep) | 0) % 2 === 0;
              const yA2 = pb.levels[k + 1];
              const yB2 = levels[k + 1];
              const A2 = flip ? pp(sg * pb.lat(yA), yA) : pp(sg * pb.lat(yA2), yA2);
              const B2 = flip ? pt(sg * lat(yB2), yB2) : pt(sg * lat(yB), yB);
              brace(body, A2, B2, 0.2, rx * sg, 0, rz * sg, C_WOOD_3);
            }
          }
        }
      }
      prevBent = { s, levels, lat };
    }

    // --- Kette des Lifthügels, Kettenräder, Geländer ---
    for (const [l0, l1, speed] of r.lifts) {
      const len = l1 - l0;
      for (const lane of lanes) {
        // Kettenkanal
        for (let s = l0; s < l1; s += 4) strip(body, s, Math.min(s + 4, l1), lane - CHAIN_HALF - 0.04, lane + CHAIN_HALF + 0.04, 0.065, C_TROUGH);
        const links = Math.floor(len / CHAIN_PITCH);
        const firstQ = chainQ.count;
        for (let k = 0; k < links * 2; k++) chainQ.add();
        chains.push({ s0: l0, len: links * CHAIN_PITCH, lat: lane, speed, first: firstQ, links });
      }
      // Kettenräder unten und oben, außen am Deck, mit Antriebshaus
      for (const s of [l0, l1]) {
        for (const sg of [-1, 1]) {
          const lat = sg * 4.85;
          const up = -0.25;
          const ctr = P(s, lat, up);
          const tx = t.tx[s];
          const tz = t.tz[s];
          const ring = 12;
          for (let k = 0; k < ring; k++) {
            const a0 = (k / ring) * Math.PI * 2;
            const a1 = ((k + 1) / ring) * Math.PI * 2;
            const R = 1.0;
            const pA: V3 = [ctr[0] + tx * Math.cos(a0) * R, ctr[1] + Math.sin(a0) * R, ctr[2] + tz * Math.cos(a0) * R];
            const pB: V3 = [ctr[0] + tx * Math.cos(a1) * R, ctr[1] + Math.sin(a1) * R, ctr[2] + tz * Math.cos(a1) * R];
            beam(parts, pA, pB, 0.16, 0.14, rightX(t, s), 0, rightZ(t, s), k % 2 === 0 ? C_RED : C_MAST);
          }
          parts.box(ctr[0] + rightX(t, s) * sg * 0.15, ctr[1], ctr[2] + rightZ(t, s) * sg * 0.15, 0.3, 0.3, 0.3, C_MAST, Math.atan2(tx, tz));
          if (s === l0) {
            // Antriebshaus unter dem Rad
            const h = P(s - 2.5, sg * 6.2, -2.4);
            parts.box(h[0], h[1], h[2], 2.2, 2.2, 3.2, C_HOUSE, Math.atan2(tx, tz), C_RED);
          }
          const q = dyn.add();
          dyn.add();
          dyn.add();
          wheels.push({ s, lat, up, r: 0.9, speed, q });
        }
      }
      // Geländer außen am Lifthügel: Pfosten, Handlauf, Knieleiste (außerhalb der Bahnkante)
      for (const sg of detail ? [-1, 1] : []) {
        const lat = sg * 4.62;
        for (let s = l0; s < l1; s += 3) {
          const s1 = Math.min(s + 3, l1);
          const pa = P(s, lat, -0.3);
          const pb = P(s, lat, 0.88);
          beam(body, pa, pb, 0.09, 0.09, t.tx[s], 0, t.tz[s], C_WOOD);
          beam(body, P(s, lat, 0.85), P(s1, lat, 0.85), 0.08, 0.06, rightX(t, s), 0, rightZ(t, s), C_WOOD, C_WOOD_2);
          wall(body, s, s1, lat, 0.4, 0.48, C_WOOD_2);
        }
      }
    }

    // --- Bremsstrecke: Bremsschwerter (rot-weiß) und Reibklötze ---
    for (const [b0, b1] of r.brakes) {
      brakeSegs.push({ s0: b0, s1: b1, lanes });
      for (const lane of lanes) {
        for (let s = b0; s < b1; s += 2) {
          const s1 = Math.min(s + 2, b1);
          const col = ((s - b0) / 2) % 2 === 0 ? C_RED : C_WHITE;
          wall(body, s, s1, lane - 0.04, 0.04, 0.13, col);
          strip(body, s, s1, lane - 0.04, lane + 0.04, 0.13, C_WHITE);
          wall(body, s, s1, lane + 0.04, 0.04, 0.13, col);
        }
        for (let s = b0 + 1; detail && s < b1 - 1; s += 4) {
          for (const g of [-0.3, 0.3]) {
            const p = P(s, lane + g, 0.075);
            body.box(p[0], p[1], p[2], 0.14, 0.09, 0.9, C_RED, Math.atan2(t.tx[s], t.tz[s]), C_WHITE);
          }
        }
      }
    }

    // --- Bahnhof: die ersten 44 m. Bahnsteige neben dem Deck, Dach ab 10 m über der Bahn, Gatter ---
    const st1 = Math.min(last, first + 44);
    for (const sg of [-1, 1]) {
      const i0 = 4.45;
      const i1 = 7.8;
      for (let s = first; s < st1; s += 2) {
        const s1 = Math.min(s + 2, st1);
        const l0 = sg * i0;
        const l1 = sg * i1;
        const top = -0.12;
        const foot = Math.min(1, t.py[s] - 3) - 1.2 - t.py[s];
        if (sg < 0) strip(body, s, s1, l1, l0, top, C_PLATFORM);
        else strip(body, s, s1, l0, l1, top, C_PLATFORM);
        // Kante zum Deck rot-weiß, Außenwand bis ins Gelände
        strip(body, s, s1, sg < 0 ? -i0 - 0.3 : i0, sg < 0 ? -i0 : i0 + 0.3, top + 0.005, ((s - first) / 2) % 2 === 0 ? C_RED : C_WHITE);
        wall(body, s, s1, l1, foot, top, C_PLATFORM_SIDE);
        wall(body, s, s1, l0, -DECK_D, top, C_PLATFORM_SIDE);
      }
      // Gatter: kleine Tore am Bahnsteig, mit Lücken
      for (let s = first + 3; detail && s < st1 - 2; s += 4) {
        const lat = sg * 5.0;
        const p0 = P(s, lat, -0.12);
        const p1 = P(s + 1.6, lat, -0.12);
        const rx = rightX(t, s), rz = rightZ(t, s);
        beam(parts, p0, [p0[0], p0[1] + 0.95, p0[2]], 0.1, 0.1, t.tx[s], 0, t.tz[s], C_WHITE);
        beam(parts, p1, [p1[0], p1[1] + 0.95, p1[2]], 0.1, 0.1, t.tx[s], 0, t.tz[s], C_WHITE);
        beam(parts, [p0[0], p0[1] + 0.85, p0[2]], [p1[0], p1[1] + 0.85, p1[2]], 0.08, 0.1, rx, 0, rz, C_GATE);
        beam(parts, [p0[0], p0[1] + 0.4, p0[2]], [p1[0], p1[1] + 0.4, p1[2]], 0.08, 0.1, rx, 0, rz, C_GATE);
      }
      // Dachstützen
      for (let s = first + 2; s <= st1; s += 8) {
        const lat = sg * 7.4;
        const roofY = roofAt(s);
        const p0 = P(s, lat, -0.12);
        beam(parts, p0, [p0[0], roofY, p0[2]], 0.3, 0.3, t.tx[s], 0, t.tz[s], C_WHITE, C_WOOD_2);
      }
    }
    // Dach: Satteldach in Modulen, rot-weiß gestreift, Unterkante mindestens 10,3 m über der Bahn
    function roofAt(s: number): number {
      let top = -Infinity;
      for (let k = Math.max(first, s - 5); k <= Math.min(st1, s + 5); k++) top = Math.max(top, t.py[k] + Math.abs(t.bank[k]) * 8.4);
      return top + 10.3;
    }
    for (let s = first; s < st1; s += 4) {
      const s1 = Math.min(s + 4, st1);
      const y = roofAt(s + 2);
      const col = ((s - first) / 4) % 2 === 0 ? C_ROOF_A : C_ROOF_B;
      const e = (sf: number, lat: number, yy: number): V3 => {
        const q = P(sf, lat, 0);
        return [q[0], yy, q[2]];
      };
      parts.quad(e(s, -8.6, y), e(s1, -8.6, y), e(s1, 0, y + 1.6), e(s, 0, y + 1.6), col);
      parts.quad(e(s, 0, y + 1.6), e(s1, 0, y + 1.6), e(s1, 8.6, y), e(s, 8.6, y), col);
    }
  }

  // --- Schubmagnete: Platten (statisch), Winkel, Rand und Schein (je Bild) ---
  const pairs = new Map<number, Pulse[]>();
  for (const p of t.pulses) {
    if (p.kind !== PULSE_KICK) continue;
    const list = pairs.get(p.seg) ?? [];
    list.push(p);
    pairs.set(p.seg, list);

    // Rahmen längs der Platte vorberechnen
    const n = Math.round(PLATE_LEN / FRAME_STEP) + 1;
    const frames = new Float64Array(n * 5);
    for (let k = 0; k < n; k++) {
      const u = -PLATE_LEN / 2 + k * FRAME_STEP;
      const sf = p.seg + u / t.step;
      at(sf, p.lat, 0, a);
      const s0 = Math.floor(sf);
      frames[k * 5] = a[0];
      frames[k * 5 + 1] = a[1];
      frames[k * 5 + 2] = a[2];
      frames[k * 5 + 3] = rightX(t, s0);
      frames[k * 5 + 4] = rightZ(t, s0);
    }
    // Grundplatte (dunkel, matt)
    for (let u = -PLATE_LEN / 2; u < PLATE_LEN / 2 - 1e-6; u += 1) {
      const s0 = p.seg + u / t.step;
      const s1 = p.seg + (u + 1) / t.step;
      strip(body, s0, s1, p.lat - PLATE_HALF, p.lat + PLATE_HALF, PLATE_Y, C_PLATE);
      wall(body, s0, s1, p.lat - PLATE_HALF, 0.02, PLATE_Y, C_PLATE_SIDE);
      wall(body, s0, s1, p.lat + PLATE_HALF, 0.02, PLATE_Y, C_PLATE_SIDE);
    }
    const chev = dyn.count;
    for (let k = 0; k < CHEV_N * 4; k++) dyn.add();
    const rim = dyn.count;
    for (let k = 0; k < 4; k++) dyn.add();
    const gl = glow.add();
    const cycles = Math.max(1, Math.round(((p.on / 60) * 6) / CHEV_SPACING));
    kicks.push({ p, frames, chev, rim, glow: gl, speed: (cycles * CHEV_SPACING) / (p.on / 60) });
  }

  /** Punkt auf einer Platte: u längs (−3…3), w quer, h über dem Deck. */
  const onPlate = (k: Kick, u: number, w: number, h: number, out: V3): V3 => {
    const f = Math.max(0, Math.min(k.frames.length / 5 - 1.0001, (u + PLATE_LEN / 2) / FRAME_STEP));
    const i = Math.floor(f);
    const g = f - i;
    const F = k.frames;
    const o0 = i * 5;
    const o1 = o0 + 5;
    const rx = F[o0 + 3] * (1 - g) + F[o1 + 3] * g;
    const rz = F[o0 + 4] * (1 - g) + F[o1 + 4] * g;
    const bank = t.bank[k.p.seg];
    out[0] = F[o0] * (1 - g) + F[o1] * g + rx * w;
    out[1] = F[o0 + 1] * (1 - g) + F[o1 + 1] * g + w * bank + h;
    out[2] = F[o0 + 2] * (1 - g) + F[o1 + 2] * g + rz * w;
    return out;
  };
  // Ränder liegen fest
  for (const k of kicks) {
    const L = PLATE_LEN / 2 - 0.02;
    const W = PLATE_HALF - 0.02;
    const e = 0.08;
    const h = PLATE_Y + 0.004;
    dyn.set(k.rim, onPlate(k, -L, -W, h, a), onPlate(k, -L, -W + e, h, b), onPlate(k, L, -W + e, h, c), onPlate(k, L, -W, h, d));
    dyn.set(k.rim + 1, onPlate(k, -L, W - e, h, a), onPlate(k, -L, W, h, b), onPlate(k, L, W, h, c), onPlate(k, L, W - e, h, d));
    dyn.set(k.rim + 2, onPlate(k, -L, -W, h, a), onPlate(k, -L, W, h, b), onPlate(k, -L + e, W, h, c), onPlate(k, -L + e, -W, h, d));
    dyn.set(k.rim + 3, onPlate(k, L - e, -W, h, a), onPlate(k, L - e, W, h, b), onPlate(k, L, W, h, c), onPlate(k, L, -W, h, d));
    const gh = PLATE_Y + 0.05;
    glow.set(k.glow, onPlate(k, -3, -0.62, gh, a), onPlate(k, -3, 0.62, gh, b), onPlate(k, 3, 0.62, gh, c), onPlate(k, 3, -0.62, gh, d));
  }

  // --- Signalmasten: je Paar einer, links außen, ein Stück vor den Platten ---
  for (const [seg, list] of pairs) {
    list.sort((p, q) => p.lat - q.lat);
    const s = Math.max(0, seg - 7);
    const lat = -5.55;
    const base = P(s, lat, -1.0);
    const top = P(s, lat, 3.0);
    const tx = t.tx[s];
    const tz = t.tz[s];
    const rx = rightX(t, s);
    const rz = rightZ(t, s);
    beam(parts, base, top, 0.22, 0.22, tx, 0, tz, C_MAST);
    // Konsole zum Deck
    beam(parts, P(s, lat, -0.9), P(s, -4.5, -0.6), 0.14, 0.14, tx, 0, tz, C_MAST);
    // Lampenbrett, quer zur Fahrt, zeigt den Ankommenden entgegen
    const bc = P(s, lat, 3.0);
    parts.box(bc[0], bc[1], bc[2], 1.85, 1.35, 0.22, C_BOARD, Math.atan2(-rz, rx));
    // Vorderseite: −Fahrtrichtung
    const fx = -tx * 0.125;
    const fz = -tz * 0.125;
    for (let k = 0; k < list.length; k++) {
      const p = list[k];
      const off = list.length > 1 ? (k === 0 ? -0.45 : 0.45) : 0;
      const ctr: V3 = [bc[0] + rx * off + fx, bc[1] + 0.2, bc[2] + rz * off + fz];
      const side = p.lat < 0 ? C_LEFT : C_RIGHT;
      // farbiger Ring hinter der Lampe
      parts.box(ctr[0] - tx * 0.01, ctr[1], ctr[2] - tz * 0.01, 0.78, 0.78, 0.04, side, Math.atan2(-rz, rx));
      const pf = (dx: number, dy: number, dz: number): V3 => [ctr[0] + rx * dx - tx * dz, ctr[1] + dy, ctr[2] + rz * dx - tz * dz];
      const lamp = dyn.add();
      dyn.add();
      dyn.add();
      const R = 0.3;
      const r2 = R * 0.42;
      const z = 0.03;
      // Achteck aus drei Vierecken (Rechte-Hand-Seite: von vorn gesehen gegen den Uhrzeigersinn)
      dyn.set(lamp, pf(-R, -r2, z), pf(R, -r2, z), pf(R, r2, z), pf(-R, r2, z));
      dyn.set(lamp + 1, pf(-r2, R, z), pf(-R, r2, z), pf(R, r2, z), pf(r2, R, z));
      dyn.set(lamp + 2, pf(-R, -r2, z), pf(-r2, -R, z), pf(r2, -R, z), pf(R, -r2, z));
      // fünf Lichter darunter
      const dots = dyn.count;
      for (let j = 0; j < 5; j++) {
        const q = dyn.add();
        const x0 = -0.36 + j * 0.155;
        dyn.set(q, pf(x0, -0.52, z), pf(x0 + 0.11, -0.52, z), pf(x0 + 0.11, -0.4, z), pf(x0, -0.4, z));
      }
      // Hof um die Lampe: Achteck wie die Lampe, etwas größer
      const halo = glow.add();
      glow.add();
      glow.add();
      const H = 0.5;
      const h2 = H * 0.42;
      const gz = 0.06;
      glow.set(halo, pf(-H, -h2, gz), pf(H, -h2, gz), pf(H, h2, gz), pf(-H, h2, gz));
      glow.set(halo + 1, pf(-h2, H, gz), pf(-H, h2, gz), pf(H, h2, gz), pf(h2, H, gz));
      glow.set(halo + 2, pf(-H, -h2, gz), pf(-h2, -H, gz), pf(h2, -H, gz), pf(H, -h2, gz));
      lamps.push({ p, lamp, dots, halo, side });
    }
  }

  // --- Netze ---
  const meshes: THREE.Mesh[] = [];
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];
  const add = (mesh: THREE.Mesh, role: string): THREE.Mesh => {
    mesh.userData.rolle = role;
    group.add(mesh);
    meshes.push(mesh);
    geos.push(mesh.geometry);
    mats.push(mesh.material as THREE.Material);
    return mesh;
  };
  add(new THREE.Mesh(body.build(), toonMaterial({ vertexColors: true, side: THREE.DoubleSide })), 'aufbau');
  add(new THREE.Mesh(prof.build(), toonMaterial({ vertexColors: true, side: THREE.DoubleSide })), 'profile');
  const partsMesh = add(new THREE.Mesh(parts.build(), toonMaterial({ vertexColors: true })), 'teile');
  if (detail) withOutline(partsMesh, 0.04);

  dyn.finish();
  glow.finish();
  chainQ.finish();
  const dynMesh = add(new THREE.Mesh(dyn.geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })), 'magnete');
  const chainMesh = add(new THREE.Mesh(chainQ.geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 })), 'kette');
  const glowMesh = add(
    new THREE.Mesh(glow.geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })),
    'schein',
  );
  glowMesh.renderOrder = 2;
  // Die Ecken dieser Netze wandern je Bild: keine Sichtbarkeitsprüfung über eine feste Hüllkugel.
  dynMesh.frustumCulled = false;
  chainMesh.frustumCulled = false;
  glowMesh.frustumCulled = false;
  // Für den Test: wo liegt was (Vierecksnummern → Ecken)
  dynMesh.userData.platten = kicks.map((k) => ({ seg: k.p.seg, lat: k.p.lat, radius: k.p.radius, pulse: k.p, winkel: [dyn.vertex(k.chev), CHEV_N * 4 * 6], kern: k.chev, rand: [dyn.vertex(k.rim), 24] }));
  dynMesh.userData.lampen = lamps.map((l) => ({ pulse: l.p, lampe: [dyn.vertex(l.lamp), 18] }));
  glowMesh.userData.platten = kicks.map((k) => ({ pulse: k.p, schein: [glow.vertex(k.glow), 6] }));
  chainMesh.userData.ketten = chains.map((ch) => ({ s0: ch.s0, len: ch.len, lat: ch.lat, speed: ch.speed, ecken: [chainQ.vertex(ch.first), ch.links * 12] }));

  // --- je Bild ---
  const tmp: RGB = [0, 0, 0];
  const tmp2: RGB = [0, 0, 0];
  const v1: V3 = [0, 0, 0];
  const v2: V3 = [0, 0, 0];
  const v3: V3 = [0, 0, 0];
  const v4: V3 = [0, 0, 0];

  const chainAt = (ch: { s0: number; lat: number }, u: number, w: number, h: number, out: V3): V3 => at(ch.s0 + u / t.step, ch.lat + w, h, out);

  const sparkWait = new Float64Array(64);

  function update(time: number): void {
    const sec = time / 60;
    // Magnete
    for (const k of kicks) {
      const p = k.p;
      const cyc = pulseCycle(p, time);
      const heat = kickHeat(p, cyc);
      const w = warnOf(p, cyc);
      const moving = cyc < p.on ? cyc : 0;
      const shift = ((((moving / 60) * k.speed) % CHEV_SPACING) + CHEV_SPACING) % CHEV_SPACING;
      const hp = PLATE_LEN / 2;
      for (let j = 0; j < CHEV_N; j++) {
        // Winkel j (0 = hinten), Spitze nach vorn
        const u0 = -hp + ((j * CHEV_SPACING + shift + 0.15) % PLATE_LEN);
        const fill = cyc < p.on ? 1 : smooth(w * CHEV_N - j);
        const outerK = Math.max(heat, 0.4 * fill);
        const innerK = heat > 0 ? Math.max(heat, 0.5 * fill) : 0.5 * fill;
        mix(Y_DIM, Y, outerK, tmp);
        mix(C_PLATE, Y, innerK, tmp2);
        const q = k.chev + j * 4;
        // außen (Umriss) und innen (Füllung, etwas schmaler, minimal höher)
        for (let layer = 0; layer < 2; layer++) {
          const arm = layer === 0 ? 0.36 : 0.2;
          const inset = layer === 0 ? 0 : 0.08;
          const W = PLATE_HALF - 0.1 - inset;
          const h = PLATE_Y + 0.006 + layer * 0.003;
          const back = u0 + inset;
          const tip = u0 + 0.62 - inset * 0.5;
          const cl = (u: number): number => Math.min(hp - 0.04, Math.max(-hp + 0.04, u));
          // linker Arm: von hinten außen zur Spitze in der Mitte
          dyn.set(q + layer * 2, onPlate(k, cl(back), -W, h, v1), onPlate(k, cl(back + arm), -W, h, v2), onPlate(k, cl(tip + arm), 0, h, v3), onPlate(k, cl(tip), 0, h, v4));
          dyn.set(q + layer * 2 + 1, onPlate(k, cl(tip), 0, h, v1), onPlate(k, cl(tip + arm), 0, h, v2), onPlate(k, cl(back + arm), W, h, v3), onPlate(k, cl(back), W, h, v4));
          const col = layer === 0 ? tmp : tmp2;
          dyn.color(q + layer * 2, col[0], col[1], col[2]);
          dyn.color(q + layer * 2 + 1, col[0], col[1], col[2]);
        }
      }
      mix(RIM_DARK, RIM_HOT, heat, tmp);
      for (let r = 0; r < 4; r++) dyn.color(k.rim + r, tmp[0], tmp[1], tmp[2]);
      const g = heat * 0.5;
      glow.color(k.glow, Y[0] * g, Y[1] * g, Y[2] * g);
    }
    // Lampen am Signalmast
    for (const l of lamps) {
      const p = l.p;
      const cyc = pulseCycle(p, time);
      const heat = kickHeat(p, cyc);
      const w = warnOf(p, cyc);
      const k = Math.max(heat, 0.35 * smooth(w * 1.4));
      mix(LAMP_DARK, Y, k, tmp);
      for (let r = 0; r < 3; r++) dyn.color(l.lamp + r, tmp[0], tmp[1], tmp[2]);
      // fünf Lichter: laufen beim Ankündigen voll (halbe Helligkeit), beim Ziehen ab (voll)
      const fade = 6;
      for (let j = 0; j < 5; j++) {
        let lit = 0;
        if (cyc < p.on) lit = smooth((((p.on - cyc) / p.on) * 5 - j) * (p.on / 5 / fade));
        else if (w > 0) lit = 0.5 * smooth((w * 5 - j) * (p.warn / 5 / fade));
        mix(LAMP_DARK, l.side, lit, tmp2);
        const bright = lit > 0.5 ? (lit - 0.5) * 0.8 : 0;
        dyn.color(l.dots + j, Math.min(1, tmp2[0] + bright), Math.min(1, tmp2[1] + bright), Math.min(1, tmp2[2] + bright));
      }
      const g = heat * 0.6;
      for (let r = 0; r < 3; r++) glow.color(l.halo + r, Y[0] * g, Y[1] * g, Y[2] * g);
    }
    // Kettenräder: Speichen drehen sich mit dem Tempo der Kette
    for (const wh of wheels) {
      const ang = (sec * wh.speed) / wh.r;
      const ctr = at(wh.s, wh.lat, wh.up, v1);
      const tx = t.tx[wh.s];
      const tz = t.tz[wh.s];
      const rx = rightX(t, wh.s) * Math.sign(wh.lat) * 0.1;
      const rz = rightZ(t, wh.s) * Math.sign(wh.lat) * 0.1;
      for (let k = 0; k < 3; k++) {
        const a0 = -ang + (k * Math.PI) / 3;
        const ca = Math.cos(a0) * wh.r;
        const sa = Math.sin(a0) * wh.r;
        const cb = Math.cos(a0 + Math.PI / 2) * 0.07;
        const sb = Math.sin(a0 + Math.PI / 2) * 0.07;
        v2[0] = ctr[0] + rx + tx * (-ca - cb); v2[1] = ctr[1] - sa - sb; v2[2] = ctr[2] + rz + tz * (-ca - cb);
        v3[0] = ctr[0] + rx + tx * (ca - cb); v3[1] = ctr[1] + sa - sb; v3[2] = ctr[2] + rz + tz * (ca - cb);
        v4[0] = ctr[0] + rx + tx * (ca + cb); v4[1] = ctr[1] + sa + sb; v4[2] = ctr[2] + rz + tz * (ca + cb);
        const v5: V3 = a;
        v5[0] = ctr[0] + rx + tx * (-ca + cb); v5[1] = ctr[1] - sa + sb; v5[2] = ctr[2] + rz + tz * (-ca + cb);
        dyn.set(wh.q + k, v2, v3, v4, v5);
        dyn.color(wh.q + k, SPOKE[0], SPOKE[1], SPOKE[2]);
      }
    }
    // Kette: Glieder laufen bergauf; jedes dritte ist ein Mitnehmer (höher, orange)
    for (const ch of chains) {
      const run = ((((sec * ch.speed) % ch.len) + ch.len) % ch.len);
      for (let j = 0; j < ch.links; j++) {
        let u = j * CHAIN_PITCH + run;
        if (u >= ch.len) u -= ch.len;
        const u1 = Math.min(ch.len, u + CHAIN_PITCH * 0.62);
        const dog = j % 3 === 0;
        const h = dog ? DOG_Y : CHAIN_Y;
        const W = dog ? CHAIN_HALF : CHAIN_HALF * 0.75;
        const q = ch.first + j * 2;
        chainQ.set(q, chainAt(ch, u, -W, h, v1), chainAt(ch, u, W, h, v2), chainAt(ch, u1, W, h, v3), chainAt(ch, u1, -W, h, v4));
        // Stirn gegen die Fahrtrichtung (sieht man von hinten unten)
        chainQ.set(q + 1, chainAt(ch, u, -W, 0.066, v1), chainAt(ch, u, W, 0.066, v2), chainAt(ch, u, W, h, v3), chainAt(ch, u, -W, h, v4));
        const col = dog ? CHAIN_DOG : CHAIN_LINK;
        chainQ.color(q, col[0], col[1], col[2]);
        chainQ.color(q + 1, col[0] * 0.55, col[1] * 0.55, col[2] * 0.55);
      }
    }
    dyn.posAttr.needsUpdate = true;
    dyn.colAttr.needsUpdate = true;
    glow.colAttr.needsUpdate = true;
    chainQ.posAttr.needsUpdate = true;
    chainQ.colAttr.needsUpdate = true;
  }
  update(0);

  return {
    group,
    update(time: number): void {
      update(time);
    },
    observe(karts: readonly RenderEntity[], dt: number, fx: FxSink): void {
      // Funken an den Bremsschwertern, wenn ein Kart schnell in die Bremsstrecke rollt (nur Zierde)
      if (!detail) return;
      for (const e of karts) {
        const slot = e.slot & 63;
        let on = false;
        for (const br of brakeSegs) if (e.seg >= br.s0 && e.seg <= br.s1) on = true;
        const v = Math.hypot(e.vx, e.vy, e.vz);
        if (!on || v < 18) {
          sparkWait[slot] = 0;
          continue;
        }
        sparkWait[slot] -= dt;
        if (sparkWait[slot] > 0) continue;
        sparkWait[slot] = 0.06;
        const tx = t.tx[e.seg];
        const tz = t.tz[e.seg];
        for (let k = 0; k < 2; k++) {
          const sg = k === 0 ? -1 : 1;
          const sx = rightX(t, e.seg) * sg * 0.35;
          const sz = rightZ(t, e.seg) * sg * 0.35;
          fx.spark(e.x + sx, e.y + 0.1, e.z + sz, -tx * 3 + sx * 6, 2.2 + k, -tz * 3 + sz * 6, 0.35, 0.16, 0xffc04a, 9);
        }
      }
    },
    dispose(): void {
      for (const g of geos) g.dispose();
      for (const m of mats) m.dispose();
    },
  };
}
