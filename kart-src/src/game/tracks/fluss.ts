// 13 · Dschungel-Fluss – vom Stelzendorf durch den Regenwald, auf Flößen den Fluss hinab, mit einem
// Sprung über den Wasserfall, durch die Furt und den Hang wieder hinauf.
//
// Auf dem Fluss (mechanics.ts: River) ist die Fahrbahn Wasser: Boden gibt es nur auf den Flößen, die in drei
// Bahnen flussab treiben – und die nehmen mit, was auf ihnen steht. In der Mitte treibt eine lückenlose Kette
// gemächlich; außen ist die Strömung doppelt so schnell, aber zwischen den Flößen klafft Wasser.

import type { TrackDef } from '../track';

export const FLUSS: TrackDef = {
  id: 'fluss',
  name: 'Dschungel-Fluss',
  theme: 'dschungel',
  blurb: 'Stelzendorf, Regenwaldpfad, auf Flößen den Fluss hinab, Sprung über den Wasserfall, durch die Furt mit Querströmung und Treibholz, den Hang wieder hinauf.',
  twist: 'Auf dem Fluss fährt man über treibende Flöße: Die Kette in der Mitte ist sicher und langsam, außen reißt die Strömung mit – aber zwischen den Flößen ist Wasser.',
  grade: 3,
  scale: 1.4,
  surface: 'dirt',
  points: [
    // 0–2: Stelzendorf am Hochufer, nach Osten (Start)
    [-40, -150, 12],
    [10, -152, 12],
    [58, -144, 12],
    // 3–7: Regenwaldpfad, S-Kurven hinunter zum Fluss
    [100, -120, 12.3],
    [122, -80, 12.4],
    [112, -40, 12.2],
    [84, -12, 12],
    [74, 24, 11.8],
    // 8–11: der Fluss (ab 7.7 Flöße), in weitem Bogen nach Norden und Westen
    [92, 60, 11.5],
    [118, 94, 11.1],
    [124, 132, 10.7],
    [100, 162, 10.3],
    // 11.3: die Kante des Wasserfalls – Sprung. 12: Landung im Becken
    [66, 174, 1.2],
    // 13–14: die Furt, nach Südwesten
    [24, 162, 0.9],
    [-14, 138, 0.9],
    // 15–21: den Hang wieder hinauf
    [-50, 114, 2],
    [-88, 98, 4],
    [-120, 70, 6],
    [-130, 30, 8],
    [-114, -8, 9.6],
    [-126, -48, 10.8],
    [-114, -90, 11.5],
    // 22: zurück ins Dorf
    [-86, -128, 12],
  ],
  roadHalf: 6.4,
  shoulder: 2,
  startAt: 0,
  laps: 3,
  bank: 1.2,
  fallDepth: 6,
  landmarkAt: 11.6,
  surfaces: [
    [22.4, 2.4, 'wood'],
    [12.3, 14.6, 'sand'],
  ],
  rivers: [
    {
      from: 7.7,
      to: 11.15,
      lanes: [
        // Mitte: eine durchgehende Kette, gemächlich
        { lat0: -2.6, lat1: 2.6, length: 30, gap: 0, speed: 4 },
        // links und rechts: schnelle Strömung, lange Flöße mit Lücken – gegeneinander versetzt
        { lat0: -8.4, lat1: -2.6, length: 56, gap: 14, speed: 9, phase: 0 },
        { lat0: 2.6, lat1: 8.4, length: 56, gap: 14, speed: 9, phase: 35 },
      ],
    },
  ],
  // die Kante des Wasserfalls
  ramps: [{ at: 11.24, length: 8, height: 1.0, gap: 9 }],
  // die Furt: das Wasser zieht quer, Baumstämme treiben über die Bahn
  belts: [{ from: 12.9, to: 14.2, lat0: -8.4, lat1: 8.4, across: 3.2 }],
  hazards: [
    { at: 13.3, amp: 4.6, period: 4.4, phase: 0 },
    { at: 14.0, amp: 4.6, period: 4.4, phase: 2.2 },
  ],
  pads: [
    { at: 1.6, lat: 0 },
    { at: 6.4, lat: 0 },
    // Anlauf für den Sprung: gleich hinter dem letzten Floß
    { at: 11.17, lat: 0 },
    { at: 15.6, lat: 0 },
    { at: 19.4, lat: 0 },
  ],
  boxRows: [2.6, 7.4, 12.6, 16.6, 20.6],
};
