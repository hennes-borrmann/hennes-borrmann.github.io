// Startrampe: die Form des Startplatzes – geteilt von world.ts (Gelände), mechanics/rampe.ts (Bauten der Mechanik) und
// life/rampe.ts (Kulisse).
//
// Der Platz liegt eben auf Höhe PLATZ.y; nach Osten fällt er über einen Dünengürtel und den Strand ins Meer. Der Gleitflug
// landet auf einem Dünenhügel im Nordwesten. Ins Gelände geschnitten sind (Einschnitte – dort zeichnet world.ts kein
// Gelände, die Wände und Böden zeichnet mechanics/rampe.ts):
//   – die Startrampe: ein Betonsockel um die Rakete (darunter läuft der Flammengraben im Tunnel);
//   – der Flammengraben, wo er außerhalb des Sockels unter dem Platz liegt;
//   – der Kriechweg des Raupentransporters: ein Graben, so tief wie die Plattform hoch ist, von der Abkürzung bis zum Tor
//     der Montagehalle;
//   – die Rampen der Hauptstraße hinunter auf seine Sohle.
// Rings um jeden Einschnitt liegt ein Betonvorfeld (APRON Meter breit): Dort ist das Gelände eben, und das Vorfeld deckt
// den gezackten Rand des groben Geländerasters ab.

import { CRAWLER_HALF } from '../../game/mechanics';
import { EDGE_DECK, EDGE_TUNNEL, type Track } from '../../game/track';
import { KRIECHWEG, PLATZ, RAKETE } from '../../game/tracks/rampe';
import { smooth } from '../build';

/** Halbe Kantenlänge des Startsockels (Meter). */
export const SOCKEL = 30;
/** Breite des Betonvorfelds rings um die Einschnitte (Meter). */
export const APRON = 15;
/** Halbe lichte Weite des Kriechweg-Grabens (Meter, quer). */
export const KRIECH_HALB = 9.35;
/** Wo der Kriechweg-Graben im Westen am Tor der Montagehalle endet (x). */
export const HALLE_X = -372;
/** Die Küste: x der Wasserlinie (abhängig von z). */
export function kuesteX(z: number): number {
  return 186 + 12 * Math.sin(z / 95) + 6 * Math.sin(z / 37 + 1.3);
}
/** Dünenhügel, auf dem der Gleitflug landet: Mitte, Halbmesser, Höhe. */
export const HUEGEL = { x: -168, z: -96, r: 78, h: 11.5 };

/** Ein Einschnitt längs eines Wegs: die Abschnitte und die halbe Breite bis zur Stützmauer. */
export interface Schnitt {
  segs: number[];
  half: number;
}

export interface RampeLand {
  /** Einschnitte längs der Fahrbahn: Flammengraben und die Rampen hinab zum Kriechweg. */
  schnitte: Schnitt[];
  /** Kriechweg-Graben: Rechteck von x0 (Ost) bis x1 (West) um z, Sohle floor. */
  kriech: { x0: number; x1: number; z: number; half: number; floor: number };
  /** Liegt (x, z) in einem Einschnitt (oder im Sockel)? Dann die Höhe des Bodens dort, sonst NaN. */
  cut(x: number, z: number): number;
  /** Abstand zum nächsten Einschnitt bzw. Sockel (Meter; ≤ 0 = darin). */
  near(x: number, z: number): number;
  /** Grundform des Geländes ohne Fahrbahn: Platz, Dünen, Strand, Hügel. */
  base(x: number, z: number): number;
}

const cache = new WeakMap<Track, RampeLand>();

export function rampeLand(t: Track): RampeLand {
  const hit = cache.get(t);
  if (hit) return hit;
  const g = PLATZ.y;
  // Einschnitte längs der Wege: wo die Fahrbahn deutlich unter dem Platz liegt (und nicht im Tunnel unter dem Sockel).
  const schnitte: Schnitt[] = [];
  const lists: number[][] = [[], []];
  for (let i = 0; i < t.total; i++) {
    if ((t.edge[i] & (EDGE_DECK | EDGE_TUNNEL)) !== 0) continue;
    if (t.py[i] > g - 0.5) continue;
    lists[t.branchOf[i] === 0 ? 0 : 1].push(i);
  }
  for (const segs of lists) if (segs.length > 0) schnitte.push({ segs, half: 0 });
  for (const s of schnitte) s.half = Math.max(...s.segs.map((i) => t.wh[i])) + 0.75;
  const c = t.crawler;
  const kriech = c
    ? { x0: c.x0 + CRAWLER_HALF + 1, x1: HALLE_X, z: c.z0, half: KRIECH_HALB, floor: c.floor }
    : { x0: 0, x1: 0, z: KRIECHWEG.z, half: 0, floor: KRIECHWEG.floor };

  /** Abstand zu einem Einschnitt längs eines Wegs (nächster Abschnitt, quer gemessen) und die Höhe dort. */
  const schnittAt = (x: number, z: number): { d: number; y: number } => {
    let best = Infinity;
    let y = g;
    for (const s of schnitte) {
      for (const i of s.segs) {
        const dx = x - t.px[i];
        const dz = z - t.pz[i];
        const along = dx * t.tx[i] + dz * t.tz[i];
        if (Math.abs(along) > t.step * 0.75) continue;
        const d = Math.abs(dx * -t.tz[i] + dz * t.tx[i]) - s.half;
        if (d < best) {
          best = d;
          y = t.py[i];
        }
      }
    }
    return { d: best, y };
  };
  const sockelD = (x: number, z: number): number => Math.max(Math.abs(x - RAKETE.x), Math.abs(z - RAKETE.z)) - SOCKEL;
  const kriechD = (x: number, z: number): number => {
    if (!c) return Infinity;
    const dx = Math.max(kriech.x1 - x, x - kriech.x0, 0);
    const dz = Math.abs(z - kriech.z) - kriech.half;
    return dx > 0 ? Math.hypot(dx, Math.max(0, dz)) : dz;
  };

  const land: RampeLand = {
    schnitte,
    kriech,
    cut(x, z) {
      if (sockelD(x, z) <= 0) return g;
      if (kriechD(x, z) <= 0) return kriech.floor;
      const s = schnittAt(x, z);
      return s.d <= 0 ? s.y : Number.NaN;
    },
    near(x, z) {
      // (Grob vorweg: weit weg von allem lohnt das Suchen längs der Wege nicht.)
      let d = Math.min(sockelD(x, z), kriechD(x, z));
      if (d < 0) return d;
      const s = schnittAt(x, z);
      return Math.min(d, s.d);
    },
    base(x, z) {
      const xc = kuesteX(z);
      // Platz eben, zur Küste hin ein Dünengürtel (wellig), dann der Strand bis unter die Wasserlinie.
      const dune = smooth((x - (xc - 75)) / 30) * (1 - smooth((x - (xc - 22)) / 14));
      const wave = 0.5 + 0.5 * Math.sin(z / 13 + Math.sin(x / 21) * 1.6);
      let y = g - 0.6 + dune * (2.2 + 2.4 * wave);
      const beach = smooth((x - (xc - 24)) / 40);
      y += (-4.5 - y) * beach;
      if (x > xc + 16) y = Math.min(y, -4.5 - (x - xc - 16) * 0.12);
      // Dünenhügel der Landung
      const dh = Math.hypot(x - HUEGEL.x, z - HUEGEL.z) / HUEGEL.r;
      if (dh < 1) y += HUEGEL.h * (1 - smooth(dh)) * (0.92 + 0.08 * Math.sin(x / 9 + z / 13));
      return y;
    },
  };
  cache.set(t, land);
  return land;
}
