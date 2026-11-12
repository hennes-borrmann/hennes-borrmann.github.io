// 12 · Gewitterkamm – nachts im Gewitter über einen Gebirgskamm.
//
// Es ist finster: Man sieht, was die eigenen Scheinwerfer zeigen, die Leitpfosten am Rand – und für
// Augenblicke alles, wenn es blitzt (mechanics.ts: stormLight). Blitze schlagen im Takt auf der Bahn
// ein (PULSE_BOLT): die Stelle knistert anderthalb Sekunden vorher. Blitzableiter (PULSE_ROD) stehen
// neben der Bahn: fährt der Blitz hinein, liegt quer über die Fahrbahn knapp eine Sekunde lang ein
// Ladefeld – wer es erwischt, bekommt Schub. Über den Gipfelgrat geht es kürzer, aber mitten durchs
// Gewitter; die Lawinengalerie darunter ist länger, hell und sicher.

import type { TrackDef } from '../track';

export const KAMM: TrackDef = {
  id: 'kamm',
  name: 'Gewitterkamm',
  theme: 'gewitter',
  blurb: 'Von der Berghütte in Kehren die Ostflanke hinauf, über den Gipfelgrat oder durch die Lawinengalerie darunter, Abfahrt durch den Bergwald, Sprung über die Klamm, Stollen.',
  twist: 'Nacht im Gewitter: Man sieht nur, was Scheinwerfer und Blitze zeigen. Wo es knistert, schlägt gleich der Blitz ein – im Ladefeld eines Blitzableiters aber lädt er das Kart auf.',
  grade: 3,
  scale: 1.42,
  surface: 'asphalt',
  dark: {
    flashes: [
      { period: 7.3, phase: 2.1, power: 0.55 },
      { period: 11.9, phase: 6.4, power: 0.8 },
    ],
  },
  points: [
    // 0–2: Hochplateau an der Berghütte, nach Osten (Start)
    [-70, -150, 4],
    [-20, -152, 4],
    [30, -148, 4.5],
    // 3–11: die Ostflanke hinauf, in Kehren
    [78, -136, 6],
    [112, -108, 9],
    [118, -70, 12.5],
    [92, -44, 16],
    [58, -52, 19],
    [44, -24, 22],
    [66, 2, 25.5],
    [100, 22, 29],
    [112, 56, 32],
    // 12–17: der Gipfelgrat, nach Westen
    [92, 88, 34],
    [52, 100, 35],
    [8, 98, 36],
    [-36, 104, 36],
    [-80, 98, 35],
    [-118, 80, 33],
    // 18–23: Abfahrt über die Westflanke, durch den Bergwald
    [-140, 48, 29],
    [-134, 10, 24],
    [-150, -26, 19],
    [-176, -58, 14],
    [-172, -98, 9],
    [-146, -128, 6],
    // 24: zurück aufs Plateau
    [-110, -144, 4.5],
  ],
  roadHalf: 6.4,
  shoulder: 2,
  startAt: 0,
  laps: 3,
  bank: 1.3,
  fallDepth: 8,
  landmarkAt: 14,
  surfaces: [
    [2.8, 17.6, 'rock'],
    [17.8, 21.3, 'dirt'],
  ],
  tunnels: [[22.35, 23.3]],
  ramps: [{ at: 21.5, length: 10, height: 1.4, gap: 8 }],
  bolts: [
    // Kehren
    { at: 6.5, lat: 2.5, period: 6.5, phase: 1.0 },
    { at: 9.4, lat: -2.5, period: 7.5, phase: 4.0 },
    // Gipfelgrat: hier schlägt es am dichtesten ein
    { at: 12.9, lat: -3, period: 6, phase: 0.5 },
    { at: 13.6, lat: 3, period: 6, phase: 2.5 },
    { at: 14.5, lat: -2.5, period: 6, phase: 4.5 },
    { at: 15.3, lat: 3, period: 5, phase: 1.5 },
    { at: 16.0, lat: -1, period: 5, phase: 3.5 },
    // Abfahrt
    { at: 19.3, lat: 2.5, period: 7, phase: 3.0 },
    { at: 20.6, lat: -2.5, period: 7, phase: 5.5 },
  ],
  rods: [
    { at: 1.2, lat: 10.2, period: 8, phase: 2 },
    { at: 10.6, lat: -10.2, period: 7, phase: 1 },
    { at: 14.05, lat: 10.2, period: 6, phase: 0 },
    { at: 16.6, lat: -10.2, period: 6.5, phase: 3 },
    { at: 18.6, lat: 10.2, period: 7.5, phase: 0.8 },
    { at: 23.8, lat: -10.2, period: 8, phase: 5 },
  ],
  pads: [
    { at: 5.0, lat: 0 },
    { at: 17.6, lat: 0 },
  ],
  boxRows: [2.4, 8.2, 12.2, 17.2, 20.0, 24.3],
  branches: [
    // a: die Lawinengalerie unter dem Grat – länger, aber überdacht, beleuchtet und ohne Blitze
    {
      from: 12.4,
      to: 16.6,
      // erster und letzter Punkt: je 40 m hinter der Gabelung bzw. vor der Einmündung, 13 m neben der Hauptstrecke;
      // dazwischen läuft die Galerie 26–30 m unterhalb des Grats am Nordhang entlang, zweieinhalb Meter tiefer.
      points: [
        [50.8, 109.3, 35.2],
        [20.9, 116.8, 33.15],
        [-10.3, 122.1, 33.66],
        [-52.3, 121.6, 33.42],
        [-80.2, 107.5, 35.16],
      ],
      roadHalf: 6.4,
      shoulder: 2,
      widths: [[1.35, 4.6, 5.4, 1.0]],
      // die Galerie beginnt und endet erst dort, wo die Abzweigung frei neben der Hauptstrecke liegt
      tunnels: [[1.45, 4.5]],
      surface: 'asphalt',
      boxRows: [3.0],
    },
  ],
};
