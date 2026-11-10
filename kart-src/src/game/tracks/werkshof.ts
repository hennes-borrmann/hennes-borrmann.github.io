// 1 · Werkshof – Einsteigerstrecke. Breite Fahrbahn, überall Bande, sanfte
// Höhen. Nach der Nordgeraden teilt sich die Strecke: oben über die
// Verladebrücke oder unten durch die Lagerhalle – beide Wege kreuzen sich.
// Danach die Steilkurve am Ostende, die Laderampe zum Springen und im Süden die
// Wahl zwischen Schikane und Sprung über die Containergrube.

import type { TrackDef } from '../track';

export const WERKSHOF: TrackDef = {
  id: 'werkshof',
  name: 'Werkshof',
  theme: 'werkshof',
  blurb: 'Breit und übersichtlich: Verladebrücke oder Lagerhalle, Steilkurve, Containersprung.',
  grade: 1,
  points: [
    // 0–3: Startgerade nach Norden
    [-160, -40, 0],
    [-160, -5, 0],
    [-160, 30, 0],
    [-158, 62, 0.3],
    // 4–7: weite Kurve auf die Nordgerade, leicht bergauf
    [-146, 92, 1],
    [-120, 110, 2],
    [-86, 115, 2.6],
    [-52, 114, 3],
    // 8: Gabelung – oben über die Verladebrücke (9–14) …
    [-20, 114, 3],
    [15, 128, 4.5],
    [50, 138, 6.5],
    [88, 132, 7.5],
    [120, 112, 7.5],
    [150, 102, 6],
    [180, 104, 4.2],
    // 15: Einmündung, dann 16–20 die Steilkurve am Ostende
    [210, 108, 3.2],
    [236, 104, 3],
    [252, 80, 3],
    [250, 52, 3],
    [232, 34, 3],
    [205, 30, 3],
    // 21–25: Gegengerade nach Westen, bergab, mit Laderampe
    [165, 30, 2.5],
    [125, 34, 1.5],
    [85, 30, 0.5],
    [45, 26, 0],
    [5, 30, 0],
    // 26–29: Linkskurve nach Süden, am Fasslager vorbei
    [-30, 18, 0],
    [-44, -10, 0],
    [-36, -44, 0],
    [-10, -70, 0],
    // 30–34: Kehre im Südosten
    [30, -84, 0],
    [70, -90, 0],
    [98, -108, 0],
    [96, -136, 0],
    [70, -152, 0],
    // 35: Gabelung – Schikane um die Containergrube (36–37) …
    [30, -156, 0],
    [-6, -130, 0],
    [-52, -128, 0],
    // 38: Einmündung, 39–41 zurück auf die Startgerade
    [-92, -140, 0],
    [-126, -122, 0],
    [-150, -98, 0],
    [-160, -68, 0],
  ],
  roadHalf: 6.5,
  shoulder: 3,
  startAt: 0,
  laps: 3,
  bank: 1.2,
  // Linkskurve: Innenseite (links) liegt tiefer, also steigt die Fahrbahn nach rechts an.
  banks: [[15.7, 19.7, 0.36]],
  decks: [[9.6, 13.4]],
  pads: [
    { at: 1.4, lat: 0 },
    { at: 10.6, lat: 0 },
    { at: 22.1, lat: -2.5 },
    { at: 39.2, lat: 0 },
  ],
  boxRows: [6.3, 20.6, 29.4],
  ramps: [{ at: 24.2, length: 8, height: 1.0 }],
  bumps: [{ at: 2.2, length: 14, height: 0.9 }],
  hazards: [{ at: 27.6, amp: 4.2, period: 5.5, phase: 0 }],
  branches: [
    // a: unten durch die Lagerhalle, unter der Verladebrücke hindurch
    {
      from: 7.6,
      to: 15,
      points: [
        [18, 101, 2],
        [50, 90, 0.6],
        [88, 96, 0.5],
        [118, 116, 1],
        [146, 124, 2],
        [174, 117, 3],
      ],
      tunnels: [[1.3, 2.8]],
      boxRows: [2.4],
      pads: [{ at: 5.2, lat: 0 }],
    },
    // b: geradeaus über die Containergrube – kürzer, aber nur mit Anlauf
    {
      from: 34.55,
      to: 38.35,
      points: [
        [8, -157, 0],
        [-28, -155, 0],
        [-64, -148, 0],
      ],
      roadHalf: 5,
      shoulder: 1.4,
      ramps: [{ at: 1.3, length: 9, height: 1.2, gap: 8 }],
      boxRows: [0.8],
    },
  ],
};
