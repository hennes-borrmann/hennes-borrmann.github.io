// Baumkronenpfad: wo die großen Dinge der Landschaft stehen – passend zu den Stützpunkten in game/tracks/baum.ts.
//
// Die Strecke ist um ein paar Riesen herum gebaut: Die Holzrampe schraubt sich um den Riesenstamm (A) hinauf, die
// Hängebrücken spannen sich zwischen den Kronen von A, B, C2 und C, der Ast ohne Geländer ist ein Arm der alten Eiche E,
// und mitten durch den hohlen Baumriesen D führt die zweite Abkürzung. Hinter D läuft ein Bach über die Felsstufe; dort
// stürzt der Wasserfall in den Waldteich, durch den die Strecke taucht. Alles hier ist reine Darstellung: Die Physik kennt
// nur die Fahrbahn.

import type { Track } from '../../game/track';

/** Ein Baum: Mitte, Halbmesser des Stamms (am Boden), Höhe des Kronenansatzes und der Spitze. */
export interface Giant {
  x: number;
  z: number;
  r: number;
  crown: number;
  top: number;
}

/** Riesenstamm: Mitte der Rampe (Halbmesser der Mittellinie 24 m), der Stamm selbst. */
export const TRUNK_A: Giant = { x: 0, z: 0, r: 13.5, crown: 50, top: 92 };
/** Halbmesser der Rampe um den Riesenstamm (Mittellinie). */
export const RAMP_R = 24;
/** Kronenbäume der Hängebrücken: B (am Ende der ersten Brücke), C2 (Spitze des Umwegs), C (Absprung zum Gleitflug). */
export const TREE_B: Giant = { x: 39, z: -66, r: 4.6, crown: 48, top: 74 };
export const TREE_C2: Giant = { x: 118.4, z: -130.2, r: 4.2, crown: 48.5, top: 72 };
export const TREE_C: Giant = { x: 183, z: -96, r: 4.4, crown: 49, top: 76 };
/** Die alte Eiche, deren Arm der Ast ohne Geländer ist (er führt nördlich an ihr vorbei). */
export const OAK_E: Giant = { x: 116, z: -58, r: 5.2, crown: 46, top: 70 };
/** Hohler Baumriese: Mitte, Außen- und Innenhalbmesser, Höhe des abgebrochenen Rands (Mittel). */
export const HOLLOW = { x: 118.9, z: 7, rOut: 15.5, rIn: 13, top: 36 };
/** Waldteich: Mitte der Tauchkurve, Wasserspiegel = track.sea. Der Wasserfall stürzt bei FALL über die Felsstufe. */
export const POND = { x: 66.8, z: 150 };
export const FALL = { x: 26.8, z: 112, top: 10.5 };

/**
 * Liegt (x, z) im Teich? Der Teich ist das Becken um die Tauchstrecke: alles, was nah an einem Abschnitt unter dem
 * Wasserspiegel liegt (die Ufer schneidet das Gelände, das dort über dem Spiegel liegt).
 */
export function pondTest(t: Track, margin = 16): (x: number, z: number) => boolean {
  const segs: number[] = [];
  for (let i = 0; i < t.n; i += 2) if (t.deep[i] && t.py[i] < t.sea + 0.5) segs.push(i);
  let x0 = Infinity;
  let x1 = -Infinity;
  let z0 = Infinity;
  let z1 = -Infinity;
  for (const i of segs) {
    x0 = Math.min(x0, t.px[i]);
    x1 = Math.max(x1, t.px[i]);
    z0 = Math.min(z0, t.pz[i]);
    z1 = Math.max(z1, t.pz[i]);
  }
  return (x, z) => {
    if (x < x0 - margin - 10 || x > x1 + margin + 10 || z < z0 - margin - 10 || z > z1 + margin + 10) return false;
    for (const i of segs) if ((x - t.px[i]) ** 2 + (z - t.pz[i]) ** 2 < (t.wh[i] + margin) ** 2) return true;
    return false;
  };
}
