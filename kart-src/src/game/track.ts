// Die Strecken: je eine geschlossene Mittellinie mit Höhenprofil.
//
// Aus wenigen Stützpunkten wird eine glatte Kurve und daraus eine Liste gleich
// langer Abschnitte von rund einem Meter (waagerecht gemessen). Alles Weitere –
// Bande, Untergrund, Rundenzählung, KI – rechnet nur mit "welcher Abschnitt",
// "wie weit seitlich daneben" und "wie hoch ist der Boden dort".
//
// Positionen von Rampen, Lücken, Boost-Feldern usw. stehen in den Strecken-
// Beschreibungen nicht in Metern, sondern in "Stützpunkt-Einheiten": 12.5 heißt
// "auf halbem Weg zwischen Stützpunkt 12 und 13". So verschiebt sich nichts,
// wenn eine Kurve nachträglich etwas anders gelegt wird.

import { TRACK_DEFS } from './tracks';

export type ThemeId = 'werkshof' | 'klippe' | 'glut' | 'nacht';

export interface TrackDef {
  id: string;
  name: string;
  theme: ThemeId;
  /** Ein Satz für die Streckenwahl. */
  blurb: string;
  /** Schwierigkeit 1 (leicht) bis 3 (anspruchsvoll) – nur zur Anzeige. */
  grade: number;
  /** Stützpunkte der Mittellinie [x, z, höhe] in Metern, in Fahrtrichtung. */
  points: number[][];
  /** Faktor auf x und z aller Stützpunkte. */
  scale?: number;
  /** true = gleichmäßige Catmull-Rom-Kurve (alte Strecke), sonst zentripetal (ohne Überschwinger). */
  uniform?: boolean;
  /** Halbe Breite der Fahrbahn. */
  roadHalf: number;
  /** Breite des Seitenstreifens zwischen Fahrbahn und Bande. */
  shoulder: number;
  /** Startlinie liegt an diesem Stützpunkt. */
  startAt: number;
  laps: number;
  /** Kurvenüberhöhung: Querneigung = Krümmung × bank (0 = flach). */
  bank?: number;
  /** So tief unter der Fahrbahn gilt ein Kart als abgestürzt. */
  fallDepth?: number;
  /** Boost-Felder; halfWidth 0 = über die ganze Fahrbahn. */
  pads: { at: number; lat: number; halfWidth?: number }[];
  /** Reihen von Item-Kisten. */
  boxRows: number[];
  /**
   * Sprungschanzen: steigen über length Meter auf height an und enden abrupt.
   * gap = Länge der Lücke in der Fahrbahn direkt hinter der Kante (Meter).
   */
  ramps?: { at: number; length: number; height: number; gap?: number }[];
  /** Kuppen: runder Buckel über length Meter – bei vollem Tempo hebt das Kart kurz ab. */
  bumps?: { at: number; length: number; height: number }[];
  /** Abschnitte ohne Bande: [von, bis, seite] mit seite -1 links, 1 rechts, 0 beide. */
  open?: [number, number, number][];
  /** Brücken und Stege: [von, bis]. Hier steht die Fahrbahn frei über dem Gelände. */
  decks?: [number, number][];
  /** Abweichende Breiten: [von, bis, halbe Fahrbahnbreite, Seitenstreifen]. */
  widths?: [number, number, number, number][];
  /** Hindernisse, die quer über die Fahrbahn pendeln: Ausschlag in Metern, Periode in Sekunden. */
  hazards?: { at: number; amp: number; period: number; phase: number }[];
}

export interface BoostPad {
  seg: number;
  length: number;
  lat: number;
  halfWidth: number;
}

export interface Hazard {
  seg: number;
  amp: number;
  /** Periode in Ticks. */
  period: number;
  phase: number;
}

export const EDGE_OPEN_L = 1;
export const EDGE_OPEN_R = 2;
export const EDGE_GAP = 4;
export const EDGE_DECK = 8;
/** Auf einer Sprungschanze (nur für die Darstellung). */
export const EDGE_RAMP = 16;

/** "Hier ist kein Boden" – das Kart fällt. */
export const NO_GROUND = -1e6;

export interface Track {
  def: TrackDef;
  index: number;
  /** Anzahl Abschnitte; Abschnitt 0 beginnt an der Startlinie. */
  n: number;
  /** Länge eines Abschnitts in Metern (knapp 1), waagerecht gemessen. */
  step: number;
  length: number;
  px: Float64Array;
  pz: Float64Array;
  /** Höhe der Fahrbahnmitte. */
  py: Float64Array;
  /** Fahrtrichtung (Einheitsvektor, waagerecht). */
  tx: Float64Array;
  tz: Float64Array;
  /** Krümmung in 1/m, positiv = Rechtskurve. */
  curv: Float64Array;
  /** Querneigung: Höhenänderung pro Meter nach rechts. */
  bank: Float64Array;
  /** Halbe Fahrbahnbreite je Abschnitt. */
  rh: Float64Array;
  /** Abstand der Bande (bzw. der Kante) von der Mittellinie je Abschnitt. */
  wh: Float64Array;
  /** EDGE_*-Bits je Abschnitt. */
  edge: Uint8Array;
  /** Abschnitt, an dem ein hier abgestürztes Kart wieder aufgesetzt wird. */
  respawn: Int32Array;
  fallDepth: number;
  pads: BoostPad[];
  boxes: { x: number; y: number; z: number; seg: number }[];
  hazards: Hazard[];
  laps: number;
}

export const PAD_LENGTH = 7;
export const PAD_HALF_WIDTH = 2;
const BOX_LATERALS = [-0.65, -0.22, 0.22, 0.65];
/** So weit vor einer Lücke wird ein abgestürztes Kart aufgesetzt – genug Anlauf für den Sprung. */
const RESPAWN_RUNUP = 26;

function catmull(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

/** Zentripetale Catmull-Rom-Kurve: bleibt auch bei ungleichen Punktabständen ohne Schlenker. */
function centripetal(p0: number[], p1: number[], p2: number[], p3: number[], t: number, out: number[]): void {
  const k01 = Math.sqrt(Math.hypot(p1[0] - p0[0], p1[1] - p0[1])) || 1e-3;
  const k12 = Math.sqrt(Math.hypot(p2[0] - p1[0], p2[1] - p1[1])) || 1e-3;
  const k23 = Math.sqrt(Math.hypot(p3[0] - p2[0], p3[1] - p2[1])) || 1e-3;
  const t0 = 0;
  const t1 = k01;
  const t2 = t1 + k12;
  const t3 = t2 + k23;
  const u = t1 + (t2 - t1) * t;
  for (let c = 0; c < 3; c++) {
    const a1 = ((t1 - u) / (t1 - t0)) * p0[c] + ((u - t0) / (t1 - t0)) * p1[c];
    const a2 = ((t2 - u) / (t2 - t1)) * p1[c] + ((u - t1) / (t2 - t1)) * p2[c];
    const a3 = ((t3 - u) / (t3 - t2)) * p2[c] + ((u - t2) / (t3 - t2)) * p3[c];
    const b1 = ((t2 - u) / (t2 - t0)) * a1 + ((u - t0) / (t2 - t0)) * a2;
    const b2 = ((t3 - u) / (t3 - t1)) * a2 + ((u - t1) / (t3 - t1)) * a3;
    out[c] = ((t2 - u) / (t2 - t1)) * b1 + ((u - t1) / (t2 - t1)) * b2;
  }
}

export function buildTrack(def: TrackDef, index = 0): Track {
  const scale = def.scale ?? 1;
  const pts = def.points.map((p) => [p[0] * scale, p[1] * scale, p[2] ?? 0]);
  const m = pts.length;

  // 1. Fein abtasten, beginnend an der Startlinie.
  const fine: number[][] = [];
  const SUB = 48;
  const tmp = [0, 0, 0];
  for (let k = 0; k < m; k++) {
    const i = (def.startAt + k) % m;
    const p0 = pts[(i - 1 + m) % m];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % m];
    const p3 = pts[(i + 2) % m];
    for (let s = 0; s < SUB; s++) {
      const t = s / SUB;
      if (def.uniform) {
        fine.push([catmull(p0[0], p1[0], p2[0], p3[0], t), catmull(p0[1], p1[1], p2[1], p3[1], t), catmull(p0[2], p1[2], p2[2], p3[2], t)]);
      } else {
        centripetal(p0, p1, p2, p3, t, tmp);
        fine.push([tmp[0], tmp[1], tmp[2]]);
      }
    }
  }
  // 2. Bogenlänge (waagerecht) aufsummieren.
  const cum = new Float64Array(fine.length + 1);
  for (let i = 0; i < fine.length; i++) {
    const a = fine[i];
    const b = fine[(i + 1) % fine.length];
    cum[i + 1] = cum[i] + Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  const length = cum[fine.length];
  const n = Math.round(length);
  const step = length / n;

  // 3. In gleich lange Abschnitte umrechnen.
  const px = new Float64Array(n);
  const pz = new Float64Array(n);
  const py = new Float64Array(n);
  let j = 0;
  for (let i = 0; i < n; i++) {
    const d = i * step;
    while (cum[j + 1] < d) j++;
    const a = fine[j];
    const b = fine[(j + 1) % fine.length];
    const f = (d - cum[j]) / (cum[j + 1] - cum[j]);
    px[i] = a[0] + (b[0] - a[0]) * f;
    pz[i] = a[1] + (b[1] - a[1]) * f;
    py[i] = a[2] + (b[2] - a[2]) * f;
  }
  const tx = new Float64Array(n);
  const tz = new Float64Array(n);
  const curv = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const a = (i - 1 + n) % n;
    const b = (i + 1) % n;
    const dx = px[b] - px[a];
    const dz = pz[b] - pz[a];
    const l = Math.hypot(dx, dz);
    tx[i] = dx / l;
    tz[i] = dz / l;
  }
  for (let i = 0; i < n; i++) {
    const a = (i - 1 + n) % n;
    const b = (i + 1) % n;
    // Drehung der Tangente pro Meter; Kreuzprodukt > 0 heißt Richtung +Winkel = links.
    const cross = tz[a] * tx[b] - tx[a] * tz[b];
    curv[i] = -Math.asin(Math.max(-1, Math.min(1, cross))) / (2 * step);
  }

  /** Stützpunkt-Einheiten → Meter hinter der Startlinie. */
  const meters = (u: number): number => {
    const k = (((u - def.startAt) % m) + m) % m;
    const f = k * SUB;
    const i0 = Math.min(fine.length - 1, Math.floor(f));
    return cum[i0] + (cum[i0 + 1] - cum[i0]) * (f - i0);
  };
  const segOf = (u: number): number => Math.round(meters(u) / step) % n;
  const wrap = (i: number): number => ((i % n) + n) % n;
  /** Ruft fn für alle Abschnitte von Meter a über len Meter auf (u = Anteil 0..1). */
  const span = (a: number, len: number, fn: (seg: number, u: number) => void): void => {
    const first = Math.ceil(a / step);
    const count = Math.max(1, Math.round(len / step));
    for (let k = 0; k < count; k++) fn(wrap(first + k), (k + 0.5) / count);
  };
  const spanU = (from: number, to: number, fn: (seg: number, u: number) => void): void => {
    const a = meters(from);
    let len = meters(to) - a;
    if (len <= 0) len += length;
    span(a, len, fn);
  };

  // 4. Breiten
  const rh = new Float64Array(n).fill(def.roadHalf);
  const wh = new Float64Array(n).fill(def.roadHalf + def.shoulder);
  for (const [from, to, road, shoulder] of def.widths ?? []) {
    const a = meters(from);
    let len = meters(to) - a;
    if (len <= 0) len += length;
    const blend = Math.min(10, len / 3);
    span(a, len, (seg, u) => {
      const d = Math.min(u, 1 - u) * len;
      const k = Math.min(1, d / blend);
      const s = k * k * (3 - 2 * k);
      rh[seg] = def.roadHalf + (road - def.roadHalf) * s;
      wh[seg] = def.roadHalf + def.shoulder + (road + shoulder - def.roadHalf - def.shoulder) * s;
    });
  }

  // 5. Kanten, Lücken, Brücken, Schanzen
  const edge = new Uint8Array(n);
  for (const [from, to, side] of def.open ?? []) {
    spanU(from, to, (seg) => {
      if (side <= 0) edge[seg] |= EDGE_OPEN_L;
      if (side >= 0) edge[seg] |= EDGE_OPEN_R;
    });
  }
  for (const [from, to] of def.decks ?? []) spanU(from, to, (seg) => (edge[seg] |= EDGE_DECK));
  const respawn = new Int32Array(n);
  for (let i = 0; i < n; i++) respawn[i] = i;
  for (const r of def.ramps ?? []) {
    const a = meters(r.at);
    const first = Math.ceil(a / step);
    const count = Math.max(1, Math.round(r.length / step));
    for (let k = 0; k < count; k++) {
      const u = (k + 1) / count;
      py[wrap(first + k)] += r.height * u * u;
      edge[wrap(first + k)] |= EDGE_RAMP;
    }
    if (!r.gap) continue;
    // Lücke direkt hinter der Kante. Davor und dahinter gibt es ein Stück keine
    // Bande, und wer dort seitlich herunterfällt, bekommt denselben Anlauf.
    const gapFirst = first + count;
    const gapCount = Math.max(1, Math.round(r.gap / step));
    const back = wrap(Math.round((a - RESPAWN_RUNUP) / step));
    for (let k = -2; k < gapCount + 6; k++) {
      const seg = wrap(gapFirst + k);
      edge[seg] |= EDGE_OPEN_L | EDGE_OPEN_R | EDGE_DECK;
      if (k >= 0 && k < gapCount) edge[seg] |= EDGE_GAP;
      if (k < gapCount) respawn[seg] = back;
    }
  }
  for (const b of def.bumps ?? []) {
    span(meters(b.at), b.length, (seg, u) => {
      const s = Math.sin(Math.PI * u);
      py[seg] += b.height * s * s;
    });
  }

  // 6. Kurvenüberhöhung, geglättet
  const bank = new Float64Array(n);
  const bankK = def.bank ?? 0;
  if (bankK > 0) {
    const raw = new Float64Array(n);
    for (let i = 0; i < n; i++) raw[i] = Math.max(-0.2, Math.min(0.2, -curv[i] * bankK));
    const W = 7;
    for (let i = 0; i < n; i++) {
      let sum = 0;
      for (let k = -W; k <= W; k++) sum += raw[wrap(i + k)];
      bank[i] = sum / (2 * W + 1);
    }
  }

  const track: Track = {
    def,
    index,
    n,
    step,
    length,
    px,
    pz,
    py,
    tx,
    tz,
    curv,
    bank,
    rh,
    wh,
    edge,
    respawn,
    fallDepth: def.fallDepth ?? 5,
    pads: [],
    boxes: [],
    hazards: [],
    laps: def.laps,
  };
  for (const p of def.pads) {
    const seg = segOf(p.at);
    const half = p.halfWidth === 0 ? rh[seg] - 0.4 : (p.halfWidth ?? PAD_HALF_WIDTH);
    track.pads.push({ seg, length: Math.round(PAD_LENGTH / step), lat: p.lat, halfWidth: half });
  }
  for (const at of def.boxRows) {
    const seg = segOf(at);
    for (const f of BOX_LATERALS) {
      const lat = f * rh[seg];
      track.boxes.push({
        x: px[seg] + rightX(track, seg) * lat,
        y: py[seg] + lat * bank[seg],
        z: pz[seg] + rightZ(track, seg) * lat,
        seg,
      });
    }
  }
  for (const h of def.hazards ?? []) {
    track.hazards.push({ seg: segOf(h.at), amp: h.amp, period: Math.round(h.period * 60), phase: h.phase });
  }
  return track;
}

/** Vektor nach rechts (quer zur Fahrtrichtung) im Abschnitt seg. */
export function rightX(t: Track, seg: number): number {
  return -t.tz[seg];
}
export function rightZ(t: Track, seg: number): number {
  return t.tx[seg];
}

/** Blickrichtung (Radiant) entlang der Strecke im Abschnitt seg. */
export function trackHeading(t: Track, seg: number): number {
  return Math.atan2(t.tx[seg], t.tz[seg]);
}

export function wrapSeg(t: Track, seg: number): number {
  const n = t.n;
  return ((seg % n) + n) % n;
}

/** Kürzeste Differenz zweier Abschnitte in Fahrtrichtung, im Bereich -n/2..n/2. */
export function segDelta(t: Track, from: number, to: number): number {
  let d = to - from;
  const half = t.n / 2;
  if (d > half) d -= t.n;
  else if (d < -half) d += t.n;
  return d;
}

/** Ergebnis von projectOnTrack – wird wiederverwendet, um nichts anzulegen. */
export const proj = { seg: 0, lat: 0, along: 0 };

const SEARCH = 12;

/**
 * Ordnet einen Punkt der Strecke zu: nächster Abschnitt in der Nähe von hint
 * und seitlicher Abstand von der Mittellinie (rechts positiv). Gesucht wird
 * nur um hint herum – so springt die Zuordnung nie auf ein anderes
 * Streckenstück, das zufällig in der Nähe (oder darüber) verläuft.
 */
export function projectOnTrack(t: Track, x: number, z: number, hint: number): typeof proj {
  let best = hint;
  let bestD = Infinity;
  for (let k = -SEARCH; k <= SEARCH; k++) {
    const i = wrapSeg(t, hint + k);
    const dx = x - t.px[i];
    const dz = z - t.pz[i];
    const d = dx * dx + dz * dz;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  const dx = x - t.px[best];
  const dz = z - t.pz[best];
  proj.seg = best;
  proj.lat = dx * -t.tz[best] + dz * t.tx[best];
  proj.along = dx * t.tx[best] + dz * t.tz[best];
  return proj;
}

/** Höhe der Fahrbahnmitte an einer Stelle zwischen zwei Abschnitten. */
export function centerHeight(t: Track, seg: number, along: number): number {
  const j = along >= 0 ? (seg + 1) % t.n : (seg - 1 + t.n) % t.n;
  const f = Math.min(1, Math.abs(along) / t.step);
  return t.py[seg] + (t.py[j] - t.py[seg]) * f;
}

/**
 * Höhe des Bodens an einer projizierten Stelle – oder NO_GROUND, wenn dort
 * eine Lücke ist bzw. das Kart über eine Kante ohne Bande hinaus ist.
 */
export function groundAt(t: Track, seg: number, along: number, lat: number): number {
  const e = t.edge[seg];
  if (e !== 0) {
    if (e & EDGE_GAP) return NO_GROUND;
    if (lat < -t.wh[seg] && e & EDGE_OPEN_L) return NO_GROUND;
    if (lat > t.wh[seg] && e & EDGE_OPEN_R) return NO_GROUND;
  }
  return centerHeight(t, seg, along) + lat * t.bank[seg];
}

/** Seitliche Lage eines pendelnden Hindernisses zum Host-Tick tick. */
export function hazardLat(h: Hazard, tick: number): number {
  return h.amp * Math.sin((tick / h.period) * 2 * Math.PI + h.phase);
}

/** Startaufstellung: zwei versetzte Reihen hinter der Linie. */
export function gridPosition(t: Track, slot: number): { x: number; y: number; z: number; heading: number; seg: number } {
  const back = 5 + slot * 4.5;
  const seg = wrapSeg(t, Math.round(-back / t.step));
  const lat = (slot % 2 === 0 ? -0.4 : 0.4) * t.rh[seg];
  return {
    x: t.px[seg] + rightX(t, seg) * lat,
    y: t.py[seg] + lat * t.bank[seg],
    z: t.pz[seg] + rightZ(t, seg) * lat,
    heading: trackHeading(t, seg),
    seg,
  };
}

// ---------------------------------------------------------------------------
// Alle Strecken; gebaut wird erst, wenn eine gebraucht wird.

const built: (Track | undefined)[] = [];

export const TRACK_COUNT = TRACK_DEFS.length;

export function getTrack(index: number): Track {
  const i = Math.max(0, Math.min(TRACK_DEFS.length - 1, index | 0));
  return (built[i] ??= buildTrack(TRACK_DEFS[i], i));
}

/** Die Strecke, auf der gerade gefahren wird. */
export let TRACK: Track = getTrack(0);

/** Wechselt die aktive Strecke (für Simulation, KI und Darstellung zugleich). */
export function setTrack(index: number): Track {
  TRACK = getTrack(index);
  return TRACK;
}
