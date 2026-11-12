// 11 · Zeitriss-Ruine – ein Tempel im Dschungel, durch den ein Riss in der Zeit geht.
//
// Alle 18 Sekunden springt die Welt zwischen zwei Zeitaltern (mechanics.ts: Era):
//   Einst – der Tempel steht. Der Boden der Großen Halle ist heil, das Aquädukt trägt;
//           die Mauer der Schatzkammer ist geschlossen.
//   Jetzt – er ist zerfallen. In der Halle fehlen Platten (links und rechts im Wechsel),
//           das Aquädukt ist eingestürzt; dafür klafft in der Schatzkammer eine Bresche.
// Eine Runde dauert länger als ein Zeitalter und kürzer als zwei: jede Runde trifft man
// die Halle, die Schatzkammer und das Aquädukt in einem anderen Zustand an.

import type { TrackDef } from '../track';

export const RUINE: TrackDef = {
  id: 'ruine',
  name: 'Zeitriss-Ruine',
  theme: 'ruine',
  blurb: 'Tempelvorplatz, Prozessionsstraße, um die Schatzkammer oder durch die Bresche, Große Halle, um den Gartenhof oder über das Aquädukt.',
  twist: 'Alle 18 Sekunden reißt die Zeit: Einst trägt der Hallenboden und das Aquädukt kürzt ab. Jetzt hat die Halle Löcher – dafür steht die Bresche in der Schatzkammer offen.',
  grade: 3,
  scale: 1.4,
  surface: 'marble',
  eras: {
    period: 36,
    split: 18,
    names: ['Einst', 'Jetzt'],
    notes: ['Einst – der Tempel steht!', 'Jetzt – der Tempel zerfällt!'],
  },
  points: [
    // 0–2: Tempelvorplatz, nach Osten (Start)
    [-40, -164, 2],
    [10, -164, 2],
    [56, -158, 2.4],
    // 3–5: Prozessionsstraße, Bogen nach Norden
    [96, -142, 3],
    [126, -114, 4],
    [144, -78, 5],
    // 5.4: Gabelung a. 6–8 außen um die Schatzkammer
    [170, -40, 6],
    [184, 6, 7.2],
    [168, 52, 8.5],
    // 8.6: Einmündung a. 9: Aufgang. 10–13: die Große Halle, nach Westen
    [128, 84, 10],
    [80, 100, 11],
    [30, 104, 11],
    [-20, 102, 11],
    [-68, 92, 11],
    // 14–15: Abgang
    [-112, 70, 10],
    [-140, 34, 8.5],
    // 15.4: Gabelung b. 16–18 außen um den Gartenhof
    [-176, 2, 7],
    [-192, -44, 5.5],
    [-178, -90, 4],
    // 18.6: Einmündung b. 19–21 zurück zum Vorplatz
    [-154, -130, 2.8],
    [-124, -156, 2.2],
    [-86, -164, 2],
  ],
  roadHalf: 6.4,
  shoulder: 2,
  startAt: 0,
  laps: 3,
  bank: 1.2,
  fallDepth: 7,
  landmarkAt: 11.5,
  surfaces: [
    [15.6, 18.4, 'dirt'],
    [2.6, 5.2, 'cobble'],
  ],
  widths: [
    // Große Halle: breit, damit auch zwischen den Löchern Platz bleibt
    [9.9, 13.6, 8.6, 1.4],
  ],
  decks: [[9.8, 13.7]],
  cracks: [
    // Jetzt fehlen in der Halle Platten – abwechselnd rechts und links
    { from: 10.15, to: 10.5, lat0: 2.5, lat1: 10, era: 1 },
    { from: 10.85, to: 11.2, lat0: -10, lat1: -2.5, era: 1 },
    { from: 11.55, to: 11.9, lat0: 2.5, lat1: 10, era: 1 },
    { from: 12.25, to: 12.6, lat0: -10, lat1: -2.5, era: 1 },
    { from: 12.95, to: 13.3, lat0: 2.5, lat1: 10, era: 1 },
  ],
  // Abgang aus der Halle: zwei breite Stufenabsätze, über die man bei vollem Tempo hüpft
  bumps: [
    { at: 14.25, length: 11, height: 0.8 },
    { at: 14.75, length: 11, height: 0.8 },
  ],
  pads: [
    { at: 0.9, lat: 0 },
    { at: 7.0, lat: 0 },
    { at: 14.4, lat: 0 },
    { at: 17.0, lat: 0 },
    { at: 20.2, lat: 0 },
  ],
  boxRows: [1.9, 9.3, 13.9, 19.3],
  branches: [
    // a: durch die Schatzkammer – nur Jetzt, wenn ihre Mauer eingestürzt ist
    {
      from: 5.4,
      to: 8.6,
      // erster und letzter Punkt: je 40 m hinter der Gabelung bzw. vor der Einmündung, 13 m neben der Hauptstrecke
      points: [
        [161.9, -35.5, 5.93],
        [160.7, 6.3, 7.17],
        [159.4, 48, 8.4],
      ],
      roadHalf: 6.4,
      shoulder: 2,
      widths: [[1.2, 2.8, 5.2, 0.8]],
      // die Kammer beginnt und endet erst dort, wo die Abzweigung frei neben der Hauptstrecke liegt
      tunnels: [[1.27, 2.73]],
      gates: [{ era: 0 }],
      boxRows: [2.0],
    },
    // b: das Aquädukt quer über den Gartenhof – nur Einst, solange es steht
    {
      from: 15.4,
      to: 18.6,
      points: [
        [-168.1, -2.9, 6.82],
        [-168.9, -44.4, 5.41],
        [-169.7, -85.9, 3.99],
      ],
      roadHalf: 6.4,
      shoulder: 2,
      widths: [[0.95, 3.05, 4.4, 0.4]],
      decks: [[1.08, 2.92]],
      open: [[1.12, 2.88, 0]],
      gates: [{ era: 1 }],
      // Jetzt stürzt es ein – von vorn nach hinten, kurz nachdem das Tor zu ist: wer noch drauf ist, schafft es.
      cracks: [
        { from: 1.15, to: 1.49, lat0: -7, lat1: 7, era: 1, delay: 1.2 },
        { from: 1.49, to: 1.83, lat0: -7, lat1: 7, era: 1, delay: 2.0 },
        { from: 1.83, to: 2.17, lat0: -7, lat1: 7, era: 1, delay: 2.8 },
        { from: 2.17, to: 2.51, lat0: -7, lat1: 7, era: 1, delay: 3.6 },
        { from: 2.51, to: 2.85, lat0: -7, lat1: 7, era: 1, delay: 4.4 },
      ],
    },
  ],
};
