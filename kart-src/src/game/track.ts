// Die Strecke: eine geschlossene Mittellinie mit fester Breite.
//
// Aus wenigen Stützpunkten wird eine glatte Kurve (Catmull-Rom) und daraus
// eine Liste gleich langer Abschnitte von rund einem Meter. Alles Weitere –
// Bande, Untergrund, Rundenzählung, KI – rechnet nur mit "welcher Abschnitt"
// und "wie weit seitlich daneben". Dadurch lässt sich später leicht eine
// zweite Strecke ergänzen: es braucht nur eine weitere TrackDef.

export interface TrackDef {
  name: string;
  /** Stützpunkte der Mittellinie [x, z] in Metern, in Fahrtrichtung. */
  points: [number, number][];
  /** Halbe Breite der Fahrbahn. */
  roadHalf: number;
  /** Abstand der Bande von der Mittellinie (dazwischen liegt der Grünstreifen). */
  wallHalf: number;
  /** Position der Startlinie als Index in points (zwischen diesem und dem nächsten Punkt). */
  startAt: number;
  /** Boost-Felder: Meter hinter der Startlinie, seitlicher Versatz (rechts positiv). */
  pads: { at: number; lat: number }[];
  /** Reihen von Item-Kisten: Meter hinter der Startlinie. */
  boxRows: number[];
  laps: number;
}

export interface BoostPad {
  seg: number;
  length: number;
  lat: number;
  halfWidth: number;
}

export interface Track {
  def: TrackDef;
  /** Anzahl Abschnitte; Abschnitt 0 beginnt an der Startlinie. */
  n: number;
  /** Länge eines Abschnitts in Metern (knapp 1). */
  step: number;
  length: number;
  px: Float64Array;
  pz: Float64Array;
  /** Fahrtrichtung (Einheitsvektor). */
  tx: Float64Array;
  tz: Float64Array;
  /** Krümmung in 1/m, positiv = Rechtskurve. */
  curv: Float64Array;
  roadHalf: number;
  wallHalf: number;
  pads: BoostPad[];
  boxes: { x: number; z: number; seg: number }[];
  laps: number;
}

export const PAD_LENGTH = 7;
export const PAD_HALF_WIDTH = 2;
const BOX_LATERALS = [-4.2, -1.4, 1.4, 4.2];

function catmull(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

export function buildTrack(def: TrackDef): Track {
  const pts = def.points;
  const m = pts.length;
  // 1. Fein abtasten, beginnend an der Startlinie.
  const fine: [number, number][] = [];
  const SUB = 48;
  for (let k = 0; k < m; k++) {
    const i = (def.startAt + k) % m;
    const p0 = pts[(i - 1 + m) % m];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % m];
    const p3 = pts[(i + 2) % m];
    for (let s = 0; s < SUB; s++) {
      const t = s / SUB;
      fine.push([catmull(p0[0], p1[0], p2[0], p3[0], t), catmull(p0[1], p1[1], p2[1], p3[1], t)]);
    }
  }
  // 2. Bogenlänge aufsummieren.
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
  let j = 0;
  for (let i = 0; i < n; i++) {
    const d = i * step;
    while (cum[j + 1] < d) j++;
    const a = fine[j];
    const b = fine[(j + 1) % fine.length];
    const f = (d - cum[j]) / (cum[j + 1] - cum[j]);
    px[i] = a[0] + (b[0] - a[0]) * f;
    pz[i] = a[1] + (b[1] - a[1]) * f;
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

  const track: Track = {
    def,
    n,
    step,
    length,
    px,
    pz,
    tx,
    tz,
    curv,
    roadHalf: def.roadHalf,
    wallHalf: def.wallHalf,
    pads: [],
    boxes: [],
    laps: def.laps,
  };
  for (const p of def.pads) {
    track.pads.push({ seg: Math.round(p.at / step) % n, length: Math.round(PAD_LENGTH / step), lat: p.lat, halfWidth: PAD_HALF_WIDTH });
  }
  for (const at of def.boxRows) {
    const seg = Math.round(at / step) % n;
    for (const lat of BOX_LATERALS) {
      track.boxes.push({ x: px[seg] + rightX(track, seg) * lat, z: pz[seg] + rightZ(track, seg) * lat, seg });
    }
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
 * Streckenstück, das zufällig in der Nähe verläuft.
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

/** Startaufstellung: zwei versetzte Reihen hinter der Linie. */
export function gridPosition(t: Track, slot: number): { x: number; z: number; heading: number; seg: number } {
  const back = 5 + slot * 4.5;
  const seg = wrapSeg(t, Math.round(-back / t.step));
  const lat = slot % 2 === 0 ? -2.6 : 2.6;
  return {
    x: t.px[seg] + rightX(t, seg) * lat,
    z: t.pz[seg] + rightZ(t, seg) * lat,
    heading: trackHeading(t, seg),
    seg,
  };
}

// ---------------------------------------------------------------------------
// Strecke 1: "Werkshof". Lange Startgerade, schnelle Rechtskurve, Schikane,
// enge Kehre und eine geschwungene Rückfahrt.

export const WERKSHOF: TrackDef = {
  name: 'Werkshof',
  points: [
    // Startgerade nach Norden
    [-100, -50],
    [-100, -20],
    [-100, 10],
    [-100, 30],
    // Kurve 1: schnelle, weite Kurve
    [-93, 56],
    [-70, 71],
    [-42, 73],
    [-18, 72],
    // Kurve 2: hinunter zur Kehre
    [-4, 69],
    [6, 60],
    [10, 46],
    // Kurve 3: Kehre in die Gegenrichtung (Radius 18 m, Punkte gleichmäßig auf dem Bogen)
    [10, 34],
    [13.4, 23.4],
    [22.4, 16.9],
    [33.6, 16.9],
    [42.6, 23.4],
    [46, 34],
    [46, 46],
    // Kurve 4: auf die Gegengerade
    [49, 58],
    [58, 68],
    [72, 72],
    [90, 72],
    // Kurve 5: lange Kurve am Ostende
    [104, 62],
    [112, 42],
    [108, 20],
    [102, 0],
    [100, -22],
    // Kurve 6: auf die Rückfahrt
    [94, -40],
    [76, -49],
    [52, -49],
    // Schikane
    [32, -40],
    [10, -32],
    [-10, -40],
    [-34, -52],
    // Kurve 7: zurück auf die Startgerade
    [-58, -66],
    [-78, -72],
    [-94, -65],
  ],
  roadHalf: 6.5,
  wallHalf: 9.5,
  startAt: 0,
  pads: [
    { at: 40, lat: 0 },
    { at: 432, lat: -2.5 },
    { at: 628, lat: 2.5 },
  ],
  boxRows: [165, 352, 545],
  laps: 3,
};

export const TRACK: Track = buildTrack(WERKSHOF);
