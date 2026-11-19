// Talsperre: die Form der Landschaft – Stausee, Staumauer, Schlucht, Fluss, Berge.
//
// Anders als auf den anderen Naturstrecken liegt das Gelände hier nicht als Insel um die Strecke: Es ist eine
// Gebirgsschlucht, gesperrt von einer Staumauer. Oben (im Norden, −z) liegt der Stausee, dessen Spiegel die Strecke als
// Meeresspiegel kennt (TrackDef.sea); unten (im Süden, +z) die Schlucht mit Talboden und Fluss. Die Grundform hier ist
// das, was world.ts statt einer ebenen Fläche als Gelände abseits der Fahrbahn nimmt (World.heightAt); an die Fahrbahn
// heran gleicht world.ts sie wie überall an (Böschungen, Einschnitte, Stege, Tunnel).
//
// Alles in Metern, in den Koordinaten der Strecke (tracks/talsperre.ts, Maßstab 1). Grundriss: x nach Osten, z nach
// Süden. Die Mauer ist ein flacher Bogen um den Punkt (0, DAM_CZ), nach Norden gewölbt; ihre Luftseite (Süden) steht
// senkrecht – an ihr entlang führt das Schwebeband (tracks/talsperre.ts, bands).

import { noise, smooth } from '../build';

/** Mitte des Mauerbogens (Grundriss) und Halbmesser der Kronenmitte, der Luftseite und der Wasserseite oben. */
export const DAM_CZ = 340;
export const DAM_R = 340;
export const DAM_AIR = 333;
export const DAM_WATER = 347;
/** So viel dicker wird die Mauer bis zum Fuß – nur auf der Wasserseite (die Luftseite steht senkrecht). */
export const DAM_FOOT = 16;
/** Kronenhöhe und Höhe des Mauerfußes (Talboden an der Mauer). */
export const DAM_TOP = 62;
export const DAM_TOE = 13;
/** Die Mauer reicht von Widerlager zu Widerlager (x im Grundriss). */
export const DAM_X0 = -97;
export const DAM_X1 = 102;

/** z der Mauer bei x für den Halbmesser r (Bogen um (0, DAM_CZ)). */
export function damZ(x: number, r: number): number {
  return DAM_CZ - Math.sqrt(Math.max(0, r * r - x * x));
}

/** Abstand eines Punkts von der Bogenmitte (für "liegt auf der Wasser- oder der Luftseite"). */
export function damRadius(x: number, z: number): number {
  return Math.hypot(x, z - DAM_CZ);
}

/** Uferlinie des Stausees (gegen den Uhrzeigersinn ist egal), ohne die Mauer: die liegt zwischen dem ersten und letzten Punkt. */
export const LAKE: [number, number][] = [
  [-97, 6],
  [-112, -10],
  [-121, -32],
  [-124, -70],
  [-121, -104],
  [-110, -128],
  [-84, -150],
  [-46, -168],
  [-10, -196],
  [10, -252],
  [44, -282],
  [86, -270],
  [70, -228],
  [64, -186],
  [92, -150],
  [112, -110],
  [116, -66],
  [104, -40],
  [100, -22],
  [102, 4],
];

/** Talboden der Schlucht unterhalb der Mauer (Grundriss), am Mauerfuß beginnend. */
export const FLOOR: [number, number][] = [
  // am Mauerfuß entlang (2 m vor der Luftseite), von West nach Ost
  [-90, 22],
  [-60, 14.5],
  [-30, 10.4],
  [0, 9],
  [30, 10.4],
  [60, 14.5],
  [88, 21],
  // Ostrand des Talbodens nach Süden
  [96, 44],
  [122, 62],
  [126, 110],
  [128, 160],
  [128, 215],
  [118, 270],
  [70, 320],
  [20, 345],
  [-40, 352],
  [-90, 330],
  [-104, 280],
  [-96, 220],
  [-88, 160],
  [-84, 110],
  [-86, 60],
];

/** Mittellinie des Flusses: vom Tosbecken am Mauerfuß nach Süden. */
export const RIVER: [number, number][] = [
  [8, 22],
  [6, 50],
  [-6, 90],
  [-28, 132],
  [-40, 180],
  [-34, 230],
  [-44, 280],
  [-34, 320],
  [-10, 350],
];
/** Höhe des Flussspiegels und halbe Breite des Flusses. */
export const RIVER_Y = 14.2;
export const RIVER_HALF = 9;

/** Abstand eines Punkts zur Strecke a–b. */
function segDist(x: number, z: number, ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax;
  const dz = bz - az;
  const l = dx * dx + dz * dz;
  const u = l > 0 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l)) : 0;
  return Math.hypot(x - ax - dx * u, z - az - dz * u);
}

/** Abstand zum Linienzug (offen). */
export function lineDist(p: [number, number][], x: number, z: number): number {
  let best = Infinity;
  for (let i = 0; i + 1 < p.length; i++) best = Math.min(best, segDist(x, z, p[i][0], p[i][1], p[i + 1][0], p[i + 1][1]));
  return best;
}

/** Vorzeichenbehafteter Abstand zum geschlossenen Vieleck: innen negativ. */
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

/** Liegt der Punkt im Stausee (Grundriss, Wasserseite der Mauer)? */
export function inLake(x: number, z: number, margin = 0): boolean {
  if (polyDist(LAKE, x, z) > margin) return false;
  // Südlich der Wasserseite der Mauer ist kein See mehr.
  return !(x > DAM_X0 - 4 && x < DAM_X1 + 4 && damRadius(x, z) < DAM_WATER - margin);
}

/** Höhe des Flussbetts bzw. des Talbodens an dieser Stelle der Schlucht. */
function floorHeight(x: number, z: number): number {
  const r = lineDist(RIVER, x, z);
  // Am Fluss das Bett (unter dem Spiegel), daneben die Ufer, zu den Wänden hin leicht ansteigend.
  const bank = 17.2 + 2.6 * smooth((r - RIVER_HALF - 4) / 60) + (noise(x * 0.04, z * 0.04) - 0.5) * 1.2;
  const bed = RIVER_Y - 2.2;
  return r < RIVER_HALF ? bed : bed + (bank - bed) * smooth((r - RIVER_HALF) / 7);
}

/** Berge ringsum: steigen nach außen an, mit Graten und Kuppen. */
function mountains(x: number, z: number): number {
  const d = Math.hypot(x - 20, (z + 20) * 0.9);
  const ridge = noise(x * 0.008 + 3.1, z * 0.008 - 1.7);
  const bumps = noise(x * 0.025, z * 0.025) - 0.5;
  return 82 + 70 * smooth((d - 180) / 320) + ridge * 46 + bumps * 14;
}

/**
 * Höhe der Landschaft abseits der Fahrbahn. Seebecken, Schlucht und Berge werden ineinandergeschnitten: Es gilt die
 * niedrigste der drei Formen – der See und die Schlucht graben sich in die Berge.
 */
export function landHeight(x: number, z: number, sea: number): number {
  let h = mountains(x, z);
  // Seebecken: innen der Seegrund, nach außen steigen die Ufer an.
  const dl = polyDist(LAKE, x, z);
  const lakeShape = dl < 0 ? sea - 2.5 - Math.min(18, -dl * 0.42) : sea + 1.2 + dl * 0.75 + Math.max(0, dl - 20) * 0.5;
  // (Die Mauer trennt See und Schlucht: südlich ihrer Wasserseite gilt der See nicht.)
  const lakeSide = !(x > DAM_X0 - 2 && x < DAM_X1 + 2 && damRadius(x, z) < DAM_WATER + DAM_FOOT * 0.5);
  if (lakeSide) h = Math.min(h, lakeShape);
  // Schlucht: innen der Talboden, außen steile Felswände.
  const df = polyDist(FLOOR, x, z);
  const floorShape = df < 0 ? floorHeight(x, z) : floorHeight(x, z) + df * 2.3 + Math.max(0, df - 28) * 0.4;
  h = Math.min(h, floorShape);
  return h;
}

/**
 * Sammelrinne der Hochwasserentlastung (Überlaufrinne): Westlich der Wehrkrone fängt sie das Wasser auf, das aus dem
 * See über das Wehr fällt, und führt es nach Süden in den Entlastungsstollen (dessen Einlauf liegt kurz vor der
 * Uferstraße, unter der er hindurchführt). Mittellinie (Norden → Süden), halbe Breite
 * des Wasserlaufs, Höhe der Rinnensohle; die Betonwanne um sie herum zeichnet mechanics/dam.ts.
 */
export const CHANNEL: [number, number][] = [
  [-131, -108],
  [-136, -92],
  [-138.5, -76],
  [-139.5, -63],
];
export const CHANNEL_HALF = 4;
export const CHANNEL_FLOOR = 50.5;
/** So weit neben der Rinne trägt die Betonwanne (Meter) – bis dorthin liegt das Gelände unter ihr. */
export const CHANNEL_SLAB = 3;

/** Wo das Gelände tiefer liegen muss als die Landschaft (Rinne unter ihrer Betonwanne): Höchsthöhe, sonst unendlich. */
export function landCut(x: number, z: number): number {
  const d = lineDist(CHANNEL, x, z);
  if (d < CHANNEL_HALF + CHANNEL_SLAB) return CHANNEL_FLOOR - 3;
  return Infinity;
}
