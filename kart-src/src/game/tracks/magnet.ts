// 18 · Magnetwerk – eine stillgelegte Fabrik für Elektromagnete, nachts in Betrieb genommen.
//
// Herzstück ist die Magnettrommel (mechanics.ts: Drum): eine riesige, liegende Röhre, an deren Innenwand die Bahn sich
// einmal ganz herumschraubt – die rechte Wand hinauf, über die Decke, die linke Wand hinunter. Magnete halten die
// Karts; die Schwerkraft zieht trotzdem zum Hallenboden: An der Wand sackt man seitlich ab, an der Decke greifen die
// Reifen schlechter. Und die Magnetplatten an der Decke schalten im Takt ab – links und rechts im Wechsel: Wer auf einer
// abgeschalteten Platte steht, fällt hinunter (und wird vor der Trommel neu aufgesetzt).
// Danach über das Werksgelände: Verladerampe mit Sprung über den Gleisanschluss, Kühltürme, Umspannwerk, zurück zum Tor.

import type { TrackDef } from '../track';

// Deckenplatten: je ein Stück, links (lat −6,4 … 0,6) und rechts (−0,6 … 6,4) im Wechsel aus – 2 s von je 6 s, nie beide
// zugleich; die Mitte gehört zu beiden (wer stur in der Mitte fährt, fällt auch).
const plates = (from: number, to: number, phase: number): { from: number; to: number; lat0: number; lat1: number; at: number; until: number; every: number }[] => [
  { from, to, lat0: -6.4, lat1: 0.6, at: phase, until: phase + 2, every: 6 },
  { from, to, lat0: -0.6, lat1: 6.4, at: phase + 3, until: phase + 5, every: 6 },
];

export const MAGNET: TrackDef = {
  id: 'magnet',
  name: 'Magnetwerk',
  theme: 'magnet',
  blurb: 'Werkstor, Montagehalle, die Magnettrommel – die Wand hinauf, über die Decke, die andere Wand hinunter –, Verladerampe mit Sprung über den Gleisanschluss, Kühltürme, Umspannwerk.',
  twist: 'In der Magnettrommel fährt man an Wand und Decke: An der Wand sackt man ab, an der Decke rutscht man leichter – und die Deckenplatten schalten im Takt ab, links und rechts im Wechsel.',
  grade: 3,
  scale: 1.6,
  surface: 'metal',
  points: [
    // 0–2: Werkstor, nach Osten (Start)
    [-80, -110, 3],
    [-20, -112, 3],
    [40, -108, 3],
    // 3–4: Montagehalle, Rechtsbogen nach Süden
    [86, -88, 3],
    [108, -46, 3],
    // 5–9: die Magnettrommel – fast gerade nach Süden, leichter Linksbogen
    [112, 0, 3],
    [114, 46, 3],
    [110, 92, 3],
    [100, 136, 3],
    [82, 176, 3],
    // 10–11: Ausfahrt, Rechtsbogen nach Westen, Verladerampe
    [44, 202, 3],
    [-6, 206, 3],
    // 12: Sprung über den Gleisanschluss
    [-56, 196, 3],
    // 13–15: Kühltürme, nach Norden
    [-98, 166, 3.5],
    [-118, 118, 4],
    [-120, 66, 4],
    // 16–17: Umspannwerk, zurück zum Tor
    [-118, 10, 3.5],
    [-110, -60, 3],
  ],
  roadHalf: 6.4,
  shoulder: 2,
  startAt: 0,
  laps: 3,
  bank: 1.1,
  fallDepth: 7,
  landmarkAt: 7,
  // Trommel von 4,8 bis 9,4: Einfahrt unten, bei 5,7 an der rechten Wand, 6,6 bis 7,6 an der Decke, 8,5 links, 9,2 unten.
  drums: [
    {
      from: 4.8,
      to: 9.4,
      radius: 26,
      turns: [
        [4.9, 0],
        [5.7, 90],
        [6.5, 180],
        [7.7, 180],
        [8.5, 270],
        [9.25, 360],
      ],
    },
  ],
  // (die drei Plattenpaare um je eine halbe Sekunde versetzt: Die Lücke wandert mit der Fahrt)
  cracks: [...plates(6.55, 6.9, 0), ...plates(6.95, 7.3, 0.5), ...plates(7.35, 7.65, 1)],
  surfaces: [
    [4.8, 9.4, 'panel'],
    [16.2, 1.8, 'asphalt'],
  ],
  // Verladerampe und Sprung über den Gleisanschluss
  ramps: [{ at: 11.75, length: 8, height: 1.1, gap: 9 }],
  pads: [
    { at: 1.6, lat: 0 },
    { at: 4.5, lat: 0 },
    { at: 11.6, lat: 0 },
    { at: 15.2, lat: 0 },
  ],
  boxRows: [0.9, 4.2, 10.6, 14.4],
};
