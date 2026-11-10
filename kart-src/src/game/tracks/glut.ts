// 3 · Glutkessel – eine Acht um einen Vulkan. Gleich nach dem Start im Tal die
// Wahl: sicher im Bogen oder geradeaus mit Sprung über den Lavastrom. Dann
// schräg unter der Felsbrücke hindurch zum Fuß des Kraters. Dort teilt sich der
// Weg erneut: außen hinauf über den schmalen Grat ohne Bande – oder durch die
// Lavahöhle in der Flanke, die unter dem Grat hindurchführt. Oben am
// Kraterrand ein Sprung über die Glutrinne, über die Felsbrücke zurück und in
// der Steilkurve der Abfahrt hinunter ins Tal.

import type { TrackDef } from '../track';

export const GLUT: TrackDef = {
  id: 'glut',
  name: 'Glutkessel',
  theme: 'glut',
  blurb: 'Lavasprung oder Bogen, Grat oder Höhle, Felsbrücke über die eigene Spur.',
  twist: 'Der Vulkan spielt mit: Geysire brechen aus, Lavabomben schlagen ein, und durch die Höhle schießt im Takt ein Lavaschwall – die Ampel an der Gabelung warnt.',
  grade: 3,
  points: [
    // 0–1: Start im Tal nach Norden
    [-170, -55, 0],
    [-170, -20, 0],
    // 2–4: sicherer Bogen um den Lavastrom (Abzweigung b springt geradeaus)
    [-186, 15, 0],
    [-208, 52, 0.2],
    [-186, 89, 0.4],
    // 5–9: Einmündung, dann weite Rechtskurve im Norden des Tals
    [-170, 122, 0.6],
    [-160, 147, 0.8],
    [-135, 166, 1.0],
    [-101, 166, 1.3],
    [-74, 145, 1.5],
    // 10–14: schräg durchs Tal, unter der Felsbrücke hindurch
    [-54, 112, 1.6],
    [-36, 72, 1.7],
    [-18, 34, 1.8],
    [0, -2, 2],
    [28, -40, 2.3],
    // 15: Fuß des Kraters – Gabelung: außen über den Grat (16–23) …
    [64, -72, 3],
    [102, -102, 5],
    [148, -118, 8],
    [195, -112, 11.5],
    [232, -86, 12.8],
    // 20–22: der Grat, schmal und ohne Bande
    [254, -42, 14],
    [258, 8, 15.5],
    [242, 56, 17],
    [205, 92, 18],
    // 24: Einmündung am Kraterrand, Sprung über die Glutrinne
    [150, 102, 18.5],
    [100, 96, 19],
    // 26–28: Felsbrücke über die eigene Strecke
    [62, 62, 19.2],
    [30, 30, 19.3],
    [0, 0, 19.2],
    // 29–34: Abfahrt mit Steilkurve zurück ins Tal
    [-32, -32, 17],
    [-64, -64, 13],
    [-95, -95, 8.5],
    [-128, -112, 5],
    [-158, -100, 2.2],
    [-170, -78, 0.5],
  ],
  roadHalf: 6.2,
  shoulder: 2.4,
  startAt: 0,
  laps: 3,
  bank: 3,
  fallDepth: 6,
  // Felsplatten mit glühenden Rissen; im Tal und in der Kehre rutschige Asche,
  // nur Start und Ziel asphaltiert.
  surface: 'rock',
  surfaces: [
    [0, 0.9, 'asphalt'],
    [0.9, 14.5, 'gravel'],
    [30.2, 34, 'gravel'],
    [34, 35, 'asphalt'],
  ],
  banks: [[30.5, 33.6, 0.36]],
  pads: [
    { at: 0.4, lat: 0 },
    { at: 10.5, lat: 0 },
    { at: 16.3, lat: 0 },
    { at: 24.6, lat: 0 },
    { at: 30.2, lat: 0 },
  ],
  boxRows: [6.6, 14.2, 22.6, 26.6, 32.6],
  ramps: [{ at: 25.3, length: 9, height: 1.2, gap: 8 }],
  bumps: [
    { at: 10.9, length: 14, height: 1.0 },
    { at: 29.6, length: 14, height: 1.1 },
  ],
  widths: [[19.0, 22.4, 5.0, 1.0]],
  open: [[19.2, 22.2, 0]],
  decks: [
    [17.3, 22.6],
    [25.0, 29.4],
  ],
  // Geysire: je drei quer über die Bahn, reihum – eine Spur ist immer frei.
  vents: [
    { at: 11.5, lat: -3.9, period: 5.4, phase: 0 },
    { at: 11.62, lat: 0, period: 5.4, phase: 1.8 },
    { at: 11.74, lat: 3.9, period: 5.4, phase: 3.6 },
    { at: 13.3, lat: 3.6, period: 4.8, phase: 0.6 },
    { at: 13.42, lat: -3.6, period: 4.8, phase: 3.0 },
    { at: 27.2, lat: -3.4, period: 5, phase: 1.2 },
    { at: 27.34, lat: 3.4, period: 5, phase: 3.7 },
  ],
  // Lavabomben am Fuß des Kraters und auf der Abfahrt: der Schatten zeigt, wo sie landen.
  bombs: [
    { at: 8.3, lat: -2.8, period: 9, phase: 0 },
    { at: 8.7, lat: 3, period: 9, phase: 4.5 },
    { at: 14.3, lat: 2.6, period: 8, phase: 2 },
    { at: 14.6, lat: -3, period: 8, phase: 6 },
    { at: 29.9, lat: -2.6, period: 7.5, phase: 1 },
    { at: 30.25, lat: 2.8, period: 7.5, phase: 4.6 },
    { at: 31.6, lat: 0, period: 10, phase: 3 },
  ],
  branches: [
    // a: Lavahöhle – unter dem Grat hindurch und durch die Flanke des Vulkans hinauf
    {
      from: 15,
      to: 24.5,
      points: [
        [86, -107, 3],
        [120, -140, 3.3],
        [162, -152, 3.8],
        [198, -135, 4.2],
        [210, -95, 5],
        [198, -58, 6.5],
        [172, -35, 8],
        [170, 0, 9.5],
        [190, 30, 12],
        [188, 58, 15],
        [162, 86, 17.5],
      ],
      roadHalf: 7,
      // erst Asche am Kraterfuß, ab dem Höhleneingang Fels
      surfaces: [[0, 5.8, 'gravel']],
      shoulder: 2.4,
      tunnels: [[6.2, 9.6]],
      boxRows: [7.6],
      // Die Höhle ist der schnellere Weg (zwei Schubfelder) – solange kein Lavaschwall durchläuft.
      pads: [
        { at: 5.9, lat: 0 },
        { at: 10.2, lat: 0 },
      ],
      floods: [{ from: 6.9, to: 8.9, period: 26, phase: 6 }],
    },
    // b: geradeaus über den Lavastrom – schmal, ohne Bande, mit großem Sprung
    {
      from: 0.9,
      to: 5.1,
      points: [
        [-169, 12, 1.2],
        [-169, 48, 3],
        [-169, 84, 1.5],
      ],
      roadHalf: 4.5,
      // Gitterrost über dem Lavastrom: schnell, aber glatt
      surface: 'metal',
      shoulder: 1,
      ramps: [{ at: 1.55, length: 10, height: 2.0, gap: 9 }],
      decks: [[1.0, 3.0]],
      open: [[1.0, 3.0, 0]],
      boxRows: [0.6],
    },
  ],
};
