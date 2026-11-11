// 6 · Tiefseeriff – vom Steg mit einem Sprung ins Wasser und unter der
// Oberfläche weiter: durch den Korallengarten, um den Graben herum (oder mit
// einem weiten Schwebesprung darüber), durch den Seegraswald mit seinen
// Querströmungen, außen um das Wrack (oder mitten hindurch) und über die
// Rampe am Riffhang wieder hinauf an die Luft.
//
// Unter Wasser trägt das Wasser (siehe mechanics.ts, "Tauchen"): das Kart
// sinkt nur langsam, jeder Buckel wird zum weiten Sprung. Strömungen nehmen
// es mit, Blasenschlote heben es zu den Schubringen hinauf.

import type { TrackDef } from '../track';

export const RIFF: TrackDef = {
  id: 'riff',
  name: 'Tiefseeriff',
  theme: 'riff',
  blurb: 'Vom Steg ins Wasser: Korallengarten, Graben, Seegraswald und ein Wrack – und am Ende wieder hinauf.',
  twist: 'Tauchen: unter Wasser springt das Kart weit und sinkt langsam. Strömungen tragen oder bremsen, Blasenschlote heben.',
  grade: 2,
  surface: 'rock',
  sea: 0,
  scale: 1.2,
  points: [
    // 0–3: Steg (Start) nach Osten
    [-120, -150, 1.6],
    [-75, -150, 1.6],
    [-30, -150, 1.6],
    [12, -148, 1.5],
    // 4–5: Sprung vom Stegende, hinunter in die Lagune
    [52, -138, -1.6],
    [90, -118, -4.6],
    // 6–11: Korallengarten, S-Kurven nach Norden
    [120, -90, -6.5],
    [138, -55, -7.5],
    [134, -18, -7.5],
    [142, 18, -8],
    [160, 50, -8.5],
    [168, 90, -9],
    // 11.3: Gabelung Graben. 12–16 außen um den Graben herum
    [164, 130, -9.5],
    [146, 166, -10],
    [112, 190, -10.5],
    [68, 198, -11],
    [26, 188, -11.5],
    // 17.3: Einmündung. 17–20 Seegraswald nach Südwesten
    [-10, 166, -12],
    [-44, 142, -12.5],
    [-84, 130, -12.5],
    [-124, 118, -12.5],
    // 19.8: Gabelung Wrack. 20–23 außen um das Wrack
    [-166, 104, -12.2],
    [-192, 70, -11.8],
    [-196, 30, -10.5],
    // 24.55: Einmündung. 24–26 den Riffhang hinauf, bei 26 durch die Oberfläche
    [-180, -6, -7.5],
    [-172, -44, -4],
    [-176, -82, -0.4],
    // 27–28: Insel mit Leuchtfeuer, zurück auf den Steg
    [-172, -118, 1.6],
    [-150, -144, 1.6],
  ],
  roadHalf: 6.4,
  shoulder: 2.4,
  startAt: 0,
  laps: 3,
  bank: 1.3,
  fallDepth: 5,
  decks: [
    [0, 3.5],
    [26.9, 28.99],
  ],
  surfaces: [
    [0, 3.5, 'wood'],
    [26.9, 28.99, 'wood'],
    [3.9, 6.2, 'sand'],
    [24.2, 26.9, 'sand'],
  ],
  dives: [[3.5, 26.9]],
  // Sprung vom Stegende ins Wasser
  ramps: [{ at: 3.2, length: 9, height: 1.3 }],
  // Korallenbuckel: unter Wasser trägt jeder ein gutes Stück
  bumps: [
    { at: 7.3, length: 14, height: 1.3 },
    { at: 9.5, length: 14, height: 1.3 },
    { at: 22.1, length: 14, height: 1.2 },
  ],
  currents: [
    // Korallengarten: rechts zieht es mit, links kommt es entgegen
    { from: 6.2, to: 8.2, lat0: 0.8, lat1: 6.4, along: 5 },
    { from: 6.2, to: 8.2, lat0: -6.4, lat1: -0.8, along: -4 },
    // Seegraswald: Querströmungen, abwechselnd nach rechts und links
    { from: 17.5, to: 18.05, lat0: -6.4, lat1: 6.4, across: 3.4 },
    { from: 18.4, to: 18.9, lat0: -6.4, lat1: 6.4, across: -3.4 },
    { from: 19.2, to: 19.6, lat0: -6.4, lat1: 6.4, across: 3.4 },
  ],
  // Blasenschlote: reihum aktiv; darüber hängen Schubringe
  bubbles: [
    { at: 10.4, lat: -4, period: 5, phase: 0 },
    { at: 10.4, lat: 4, period: 5, phase: 2.5 },
    { at: 24.9, lat: 0, period: 4.4, phase: 1 },
  ],
  rings: [
    // (nebeneinander, ohne sich zu überdecken; die Mitte der Bahn bleibt für alle frei, die nicht hinauf wollen)
    { at: 10.76, lat: -4, up: 4.1 },
    { at: 10.76, lat: 4, up: 4.1 },
    { at: 25.26, lat: 0, up: 4.1 },
  ],
  pads: [
    { at: 1.3, lat: 0 },
    { at: 12.5, lat: 0 },
    { at: 17.1, lat: 0 },
    // am Wrack außen vorbei: der längere Weg hat dafür Schub
    { at: 20.7, lat: 0 },
    { at: 23.4, lat: 0 },
    { at: 27.6, lat: 0 },
  ],
  boxRows: [2.2, 8.7, 15.2, 21.6, 25.3],
  hazards: [{ at: 14.4, amp: 4, period: 5.2, phase: 0.6 }],
  branches: [
    // a: über den Graben – kürzer, aber nur mit dem Schwebesprung von der Kante (an der Luft wäre er nicht zu schaffen)
    {
      from: 11.3,
      to: 17.3,
      points: [
        [150, 128, -9.6],
        [122, 150, -10.2],
        [88, 162, -10.8],
        [52, 166, -11.2],
        [18, 158, -11.7],
      ],
      roadHalf: 5.6,
      dives: [[0, 5.99]],
      ramps: [{ at: 2.0, length: 9, height: 1.8, gap: 20 }],
      boxRows: [4.2],
    },
    // b: mitten durch das Wrack – kürzer und eng
    {
      from: 19.8,
      to: 24.55,
      points: [
        [-140, 100, -12.5],
        [-156, 72, -12.2],
        [-163, 40, -11.4],
        [-164, 8, -9.4],
      ],
      roadHalf: 4.8,
      shoulder: 1.2,
      surface: 'metal',
      dives: [[0, 4.99]],
      tunnels: [[0.9, 3.3]],
      boxRows: [2.1],
    },
  ],
};
