// Dächerjagd: wo die großen Dinge der Altstadt stehen und wie der Hang liegt – passend zu den Stützpunkten in
// game/tracks/daecher.ts.
//
// Die Stadt liegt an einem Hang über dem Hafen: unten (Süden, +z) Kai und Hafenbecken auf Meereshöhe, darüber die
// Unterstadt mit dem Kanal, in der Mitte der Marktplatz mit der Markthalle, oben (Norden, −z) der Domberg mit der Kirche.
// Die Form des Geländes folgt den Gassen: Wo die Strecke am Boden liegt, liegt dort der Boden; unter den Dächern liegt er
// ein Haus tiefer, unter dem Kirchendach auf dem Domplatz, unter dem Gleitflug am Hang. Weiter draußen steigt der Hang nach
// Norden zu den Hügeln an, im Süden liegt das Meer. Kanal und Hafenbecken schneiden sich unter den Meeresspiegel ein.
// Alles hier ist reine Darstellung (world.ts nimmt es als Gelände abseits der Fahrbahn) – die Physik kennt nur die Fahrbahn.

import { EDGE_DECK, EDGE_GLIDE, type Track } from '../../game/track';
import { SURFACE_INDEX } from '../../game/surface';
import { smooth } from '../build';

/** Kirchenglocken und Glockenspiel am Rathaus läuten alle LAEUTEN s Rennzeit, je DAUER s lang (Bild und Ton). */
export const LAEUTEN = 15;
export const DAUER = 6;

/** So hoch steht ein Haus unter den Dächern der Strecke (Traufe bis Boden, Meter): Der Boden liegt so tief unter dem Dachweg. */
export const HAUS_H = 11.5;
/** Höhe des Domplatzes (der Kirchhügel). */
export const DOMPLATZ_Y = 34;
/** So tief liegen Kanal- und Hafengrund unter dem Meeresspiegel (Gelände, nicht die Fahrbahn). */
export const KANAL_GRUND = -7.5;
/** Kaimauer: so weit neben der Mittellinie des Kanals steht sie (Meter über die halbe Breite der Fahrbahn hinaus). */
export const KAI_RAND = 0.6;
/** Höhe der Kaikante. */
export const KAI_Y = 2.4;

/** Ein Stück der Hauptstrecke: Stützpunkt-Einheiten → Abschnitte (genähert: zwischen den Stützpunkten gleichmäßig). */
export interface Spots {
  /** Nächster Abschnitt der Hauptstrecke zu Stützpunkt k. */
  point(k: number): number;
  /** Abschnitt bei Stützpunkt-Einheit u (12.5 = halb zwischen 12 und 13). */
  at(u: number): number;
}

const cache = new WeakMap<Track, Spots>();

export function spots(t: Track): Spots {
  let s = cache.get(t);
  if (s) return s;
  const sc = t.def.scale ?? 1;
  const pts = t.def.points;
  const near: number[] = pts.map((p) => {
    let best = 0;
    let bd = Infinity;
    for (let i = 0; i < t.n; i++) {
      const d = (t.px[i] - p[0] * sc) ** 2 + (t.pz[i] - p[1] * sc) ** 2;
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    return best;
  });
  s = {
    point: (k) => near[((k % pts.length) + pts.length) % pts.length],
    at: (u) => {
      const k = Math.floor(u);
      const f = u - k;
      const a = near[((k % pts.length) + pts.length) % pts.length];
      let b = near[(((k + 1) % pts.length) + pts.length) % pts.length];
      if (b < a) b += t.n;
      return Math.round(a + (b - a) * f) % t.n;
    },
  };
  cache.set(t, s);
  return s;
}

/** Abstand eines Punkts zur Strecke a–b im Grundriss. */
function segDist(x: number, z: number, ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax;
  const dz = bz - az;
  const l = dx * dx + dz * dz;
  const u = l > 0 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l)) : 0;
  return Math.hypot(x - ax - dx * u, z - az - dz * u);
}

/** Vorzeichenbehafteter Abstand zum geschlossenen Vieleck (innen negativ). */
export function polyDist(p: [number, number][], x: number, z: number): number {
  let best = Infinity;
  let inside = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    best = Math.min(best, segDist(x, z, p[j][0], p[j][1], p[i][0], p[i][1]));
    const zi = p[i][1];
    const zj = p[j][1];
    if (zi > z !== zj > z && x < ((p[j][0] - p[i][0]) * (z - zi)) / (zj - zi) + p[i][0]) inside = !inside;
  }
  return inside ? -best : best;
}

/**
 * Hafenbecken (Grundriss, Weltkoordinaten): vom Slip im Westen am Kai entlang nach Osten, nach Süden offen zum Meer.
 * Die Kaikante liegt im Norden; die Mündung des Kanals stößt bei x ≈ −30 auf sie.
 */
export const HAFEN: [number, number][] = [
  [-96, 244],
  [-84, 226],
  [-74, 218],
  [-54, 212],
  [-36, 211],
  [20, 211],
  [120, 213],
  [260, 222],
  [420, 240],
  [420, 700],
  [-420, 700],
  [-420, 300],
  [-200, 262],
  [-130, 252],
];

/** Das Wasser einer Strecke: Kanal (entlang der Tauchstrecke) und Hafenbecken. */
export interface Wasser {
  /** Abschnitte der Hauptstrecke, die im Kanal liegen (Mitte des Kanals), mit dem Halbmesser bis zur Kaimauer. */
  kanal: number[];
  /** Halbmesser des Kanals bis zur Kaimauer. */
  breite: number;
  /** Liegt (x, z) im Wasser (Kanal oder Hafen), mit Rand margin nach außen? */
  im(x: number, z: number, margin?: number): boolean;
  /** Abstand zur Kaimauer des Kanals (innen negativ); Infinity weit weg. */
  kanalRand(x: number, z: number): number;
}

const wasserCache = new WeakMap<Track, Wasser>();

export function wasser(t: Track): Wasser {
  let w = wasserCache.get(t);
  if (w) return w;
  const kanal: number[] = [];
  let breite = 0;
  for (let i = 0; i < t.n; i++) {
    if (!t.deep[i] || t.py[i] > t.sea - 1.5) continue;
    // nur der Kanal (nördlich der Kaikante) – das Hafenbecken hat sein Vieleck
    if (polyDist(HAFEN, t.px[i], t.pz[i]) < 2) continue;
    kanal.push(i);
    breite = Math.max(breite, t.wh[i] + KAI_RAND);
  }
  // Kopf des Kanals: Die Wassertreppe führt hinein – dahinter (westlich) liegt noch ein Stück Fleet.
  const kanalRand = (x: number, z: number): number => {
    let best = Infinity;
    for (const i of kanal) {
      const d = Math.hypot(x - t.px[i], z - t.pz[i]);
      if (d < best) best = d;
    }
    return best - breite;
  };
  w = {
    kanal,
    breite,
    im: (x, z, margin = 0) => polyDist(HAFEN, x, z) < margin || kanalRand(x, z) < margin,
    kanalRand,
  };
  wasserCache.set(t, w);
  return w;
}

/**
 * Höhe der Landschaft abseits der Fahrbahn (world.ts: World.land). Nah an den Gassen der Boden der Gassen; unter den
 * Dächern ein Haus tiefer; unter der Kirche der Domplatz; unter dem Gleitflug der Hang. Weiter weg steigt der Hang nach
 * Norden zu den Hügeln, im Süden fällt er zum Meeresgrund.
 */
export function landHeight(t: Track): (x: number, z: number) => number {
  const sx: number[] = [];
  const sz: number[] = [];
  const sy: number[] = [];
  const roofs = SURFACE_INDEX.tiles;
  // Gleitflug: vom Fuß des Turms bis zum Boden unter dem Landedach gleichmäßig den Hang hinunter.
  let g0 = -1;
  let g1 = -1;
  for (let i = 0; i < t.n; i++) {
    if ((t.edge[i] & EDGE_GLIDE) === 0) continue;
    if (g0 < 0) g0 = i;
    g1 = i;
  }
  for (let i = 0; i < t.total; i += 3) {
    if (t.deep[i] && t.py[i] < t.sea + 0.3) continue;
    let y = t.py[i];
    const e = t.edge[i];
    if (e & EDGE_GLIDE) {
      const k = (i - g0) / Math.max(1, g1 - g0);
      y = DOMPLATZ_Y + (t.py[g1] - HAUS_H - DOMPLATZ_Y) * k;
    } else if (e & EDGE_DECK) {
      if (t.surf[i] === roofs || t.surf[i] === SURFACE_INDEX.wood) y = Math.min(t.py[i] - HAUS_H, t.py[i]);
      // Festrampe und Kirchendach: Die Rampe beginnt auf dem Domplatz; die Kirche steht eine Terrasse tiefer am Hang.
      if (t.py[i] > DOMPLATZ_Y - 1 && t.surf[i] === SURFACE_INDEX.wood) y = DOMPLATZ_Y - Math.max(0, Math.min(6, t.py[i] - 37));
    }
    sx.push(t.px[i]);
    sz.push(t.pz[i]);
    sy.push(y);
  }
  const hafen = HAFEN;
  return (x, z) => {
    let sum = 0;
    let wsum = 0;
    let near = Infinity;
    for (let k = 0; k < sx.length; k++) {
      const d2 = (x - sx[k]) ** 2 + (z - sz[k]) ** 2;
      near = Math.min(near, d2);
      const w = 1 / (d2 + 40) ** 1.6;
      sum += w * sy[k];
      wsum += w;
    }
    const idw = sum / wsum;
    // Ferne Form: nach Norden zu den Hügeln hinauf, nach Süden zum Meer hinunter.
    const far = 6 + Math.max(0, 40 - z) * 0.2 + Math.max(0, -z - 200) * 0.25;
    const k = smooth((Math.sqrt(near) - 50) / 120);
    let h = idw + (far - idw) * k;
    // Hafen und Meer: Kaikante, dahinter der Meeresgrund.
    const dh = polyDist(hafen, x, z);
    if (dh < 0) h = Math.min(h, KANAL_GRUND - Math.min(6, -dh * 0.05));
    return h;
  };
}

/**
 * Wo das Gelände tiefer liegen muss als die Landschaft (world.ts: landCut): im Kanal und im Hafenbecken, und noch ein
 * Rasterfeld (cell) über die Kaimauer hinaus – so liegen die schrägen Dreiecke zwischen Grund und Kai hinter der Mauer, unter
 * der Kaikante (die zeichnet mechanics/altstadt.ts, so breit, dass sie sie deckt: kaiBreite).
 */
export function landCut(t: Track, cell: number): (x: number, z: number) => number {
  const w = wasser(t);
  return (x, z) => {
    if (polyDist(HAFEN, x, z) < cell + 0.5) return KANAL_GRUND;
    return w.kanalRand(x, z) < cell + 0.5 ? KANAL_GRUND : Infinity;
  };
}

/** Breite der Kaikante bei dieser Rastergröße: über den abgesenkten Streifen und das nächste Rasterfeld hinweg. */
export function kaiBreite(cell: number): number {
  return 2 * cell + 2;
}

// --- Wahrzeichen (aus den Stützpunkten der Strecke abgeleitet) ------------------------------------------------

/** Bastei: der runde Mauerturm im Innern der Bastei-Kehre (Stützpunkte 2–8 um die Mitte (166, −8) mit 30 m Halbmesser). */
export function BASTEI(t: Track): { x: number; z: number; r: number; y: number } {
  const sc = t.def.scale ?? 1;
  const x = 166 * sc;
  const z = -8 * sc;
  const s = spots(t);
  const i = s.at(5);
  const r = Math.hypot(t.px[i] - x, t.pz[i] - z) - t.wh[i] - 3.5;
  return { x, z, r, y: t.py[s.at(2)] - 1 };
}

/** Kirchturm: Mitte der Glockenstube (die Fahrbahn führt hindurch), Boden am Turmfuß und Höhe der Fahrbahn darin. */
export function TURM(t: Track): { x: number; z: number; y: number; road: number; seg: number } {
  const s = spots(t);
  const i = s.at(18.12);
  return { x: t.px[i], z: t.pz[i], y: DOMPLATZ_Y - 6, road: t.py[i], seg: i };
}

/** Rathaus am Markt: nördlich des Bogens um die Markthalle, die Front zum Platz (Mitte der Front, Blickrichtung, Boden). */
export function RATHAUS(t: Track): { x: number; z: number; rot: number; y: number } {
  const s = spots(t);
  const i = s.at(54);
  const rx = -t.tz[i];
  const rz = t.tx[i];
  const L = t.wh[i] + 5.5;
  return { x: t.px[i] - rx * L, z: t.pz[i] - rz * L, rot: Math.atan2(rx, rz), y: t.py[i] };
}

/** Marktplatz: die Fläche zwischen dem Bogen der Hauptstrecke um die Markthalle und der Abkürzung durch sie (Vieleck). */
export function MARKT(t: Track): [number, number][] {
  const b = t.branches[1];
  const out: [number, number][] = [];
  if (!b) return out;
  const span = (b.to - b.from + t.n) % t.n;
  for (let k = 0; k < span; k += 4) {
    const i = (b.from + k) % t.n;
    out.push([t.px[i], t.pz[i]]);
  }
  for (let g = b.first + b.count - 1; g >= b.first; g -= 4) out.push([t.px[g], t.pz[g]]);
  return out;
}

/**
 * Weg der Straßenbahn abseits der Fahrbahn (aus der Remise heraus, in die Seitengasse hinein): Punkte (x, z) alle 2 m, und
 * wo Remise und Torhaus stehen (Mitte, Blickrichtung zur Linie hin). Dort stellt die Kulisse keine Häuser hin.
 */
export function tramWeg(t: Track): { pts: [number, number][]; remise: { x: number; z: number; rot: number } | null; torhaus: { x: number; z: number; rot: number } | null } {
  const v = t.vehicles.find((x) => x.line);
  if (!v || !v.line) return { pts: [], remise: null, torhaus: null };
  const l = v.line;
  const pts: [number, number][] = [];
  for (let i = 0; i < l.n; i += 2) if (Math.abs(l.lat[i] - v.lat) > 0.6) pts.push([l.x[i], l.z[i]]);
  const head = (i: number, j: number): number => Math.atan2(l.x[j] - l.x[i], l.z[j] - l.z[i]);
  return {
    pts,
    remise: { x: l.x[0], z: l.z[0], rot: head(0, 4) },
    torhaus: { x: l.x[l.n - 1], z: l.z[l.n - 1], rot: head(l.n - 5, l.n - 1) },
  };
}
