// 10 · Vulkaninsel im Ausbruch – vom Fischerdorf die Küste entlang, die Flanke
// hinauf auf den Kraterrand, über die Serpentinen (oder durch die Lavaröhre)
// wieder hinunter und über das Lavafeld zurück ins Dorf.
//
// Anders als überall sonst bleibt die Strecke nicht, wie sie ist (mechanics.ts:
// Bruchstellen und Tore). Am Kraterrand und auf der Basaltbrücke brechen nach
// festem Plan Platten weg – erst wenige, in der letzten Runde bleibt ein Slalom.
// Die alte Hängebrücke an der Küste kürzt ab, stürzt aber nach 84 Sekunden ein;
// dafür läuft nach 50 Sekunden die Lavaröhre leer und gibt einen neuen Weg frei.

import type { TrackDef } from '../track';

export const VULKAN: TrackDef = {
  id: 'vulkan',
  name: 'Vulkaninsel',
  theme: 'vulkan',
  blurb: 'Küstenstraße oder Hängebrücke, hinauf auf den Kraterrand, Serpentinen oder Lavaröhre, Sprung über die Glutspalte.',
  twist: 'Die Insel zerbricht: am Kraterrand brechen Platten weg, die Hängebrücke stürzt nach 84 Sekunden ein – dafür läuft die Lavaröhre nach 50 Sekunden leer.',
  grade: 3,
  scale: 1.18,
  surface: 'rock',
  points: [
    // 0–3: Fischerdorf an der Südküste, nach Osten
    [-120, -170, 0.5],
    [-75, -172, 0.5],
    [-30, -170, 0.6],
    [15, -164, 0.8],
    // 4–6: Küstenstraße nach Nordosten
    [58, -148, 1.5],
    [96, -122, 2.5],
    [126, -88, 4],
    // 6.4: Gabelung b. 7–9 um die Schlucht herum
    [170, -52, 6],
    [188, -10, 8.5],
    [172, 34, 11],
    // 9.7: Einmündung b. 10–14 die Flanke hinauf
    [128, 70, 14],
    [94, 92, 17.5],
    [56, 96, 21],
    [30, 72, 24.5],
    [22, 40, 27.5],
    // 15–19: Kraterrand, breit – und brüchig
    [36, 10, 29.5],
    [30, -24, 30],
    [2, -44, 30],
    [-32, -40, 30],
    [-54, -14, 29.5],
    // 19.5: Gabelung a. 20–24 Serpentinen die Westflanke hinunter
    [-62, 20, 27],
    [-84, 50, 23.5],
    [-116, 62, 19.5],
    [-146, 44, 15.5],
    [-160, 10, 11.5],
    // 24.6: Einmündung a. 25–29 Lavafeld mit Glutspalte und Basaltbrücke, zurück ins Dorf
    [-152, -28, 8],
    [-166, -62, 5],
    [-186, -96, 3],
    [-190, -134, 1.5],
    [-170, -162, 0.8],
  ],
  roadHalf: 6.4,
  shoulder: 2,
  startAt: 0,
  laps: 3,
  bank: 1.3,
  fallDepth: 6,
  landmarkAt: 17,
  surfaces: [
    [29.4, 3.2, 'cobble'],
    [3.2, 9.8, 'asphalt'],
    [20.0, 24.4, 'gravel'],
  ],
  widths: [
    // Kraterrand: breit genug, dass auch nach dem Bruch eine Spur bleibt
    [15.0, 19.3, 8.6, 1.4],
    // Basaltbrücke
    [27.0, 28.4, 7.2, 0.8],
  ],
  decks: [[27.0, 28.4]],
  cracks: [
    // Kraterrand: abwechselnd außen und innen, in jeder Runde mehr
    { from: 15.2, to: 15.5, lat0: 3, lat1: 10, at: 38 },
    { from: 15.75, to: 16.05, lat0: -10, lat1: -3, at: 46 },
    { from: 16.3, to: 16.6, lat0: 3, lat1: 10, at: 58 },
    { from: 16.85, to: 17.15, lat0: -10, lat1: -3, at: 68 },
    { from: 17.4, to: 17.7, lat0: 3, lat1: 10, at: 78 },
    { from: 17.95, to: 18.25, lat0: -10, lat1: -3, at: 90 },
    { from: 18.5, to: 18.8, lat0: 3, lat1: 10, at: 102 },
    // zweite Welle: die Lücken dazwischen werden enger
    { from: 15.5, to: 15.7, lat0: 5.5, lat1: 10, at: 112 },
    { from: 16.6, to: 16.8, lat0: 5.5, lat1: 10, at: 122 },
    { from: 17.7, to: 17.9, lat0: 5.5, lat1: 10, at: 132 },
    // Basaltbrücke über den Lavastrom
    { from: 27.15, to: 27.45, lat0: 2.6, lat1: 8, at: 62 },
    { from: 27.6, to: 27.9, lat0: -8, lat1: -2.6, at: 96 },
    { from: 28.0, to: 28.3, lat0: 2.6, lat1: 8, at: 128 },
  ],
  bumps: [
    { at: 25.4, length: 12, height: 0.9 },
    { at: 26.9, length: 10, height: 0.7 },
  ],
  ramps: [{ at: 26.1, length: 9, height: 1.3, gap: 8 }],
  pads: [
    { at: 1.4, lat: 0 },
    // der lange Weg um die Schlucht bekommt Schub – die Brücke ist kürzer, aber schmal und ohne Geländer
    { at: 8.2, lat: 0 },
    { at: 11.0, lat: 0 },
    { at: 21.6, lat: 0 },
    { at: 23.5, lat: 0 },
    { at: 28.8, lat: 0 },
  ],
  boxRows: [2.5, 10.1, 14.4, 22.6, 25.0],
  branches: [
    // a: die Lavaröhre durch die Westflanke – kürzer und ohne Kurven, aber erst offen, wenn die Lava abgelaufen ist
    {
      from: 19.5,
      to: 24.6,
      // erster Punkt: 40 m hinter der Gabelung, 14 m neben der Hauptstrecke
      points: [
        [-79.9, 27.9, 25.4],
        [-102, 42, 21.5],
        [-128, 36, 16.8],
        // letzter Punkt: 44 m vor der Einmündung, 13 m neben der Hauptstrecke – so läuft die Röhre flach ein
        [-146.7, 19.9, 12.7],
      ],
      roadHalf: 6.4,
      shoulder: 2,
      widths: [[1.2, 3.95, 5.2, 0.8]],
      surfaces: [[1.3, 3.95, 'gravel']],
      // die Röhre beginnt und endet erst dort, wo die Abzweigung frei neben der Hauptstrecke liegt
      tunnels: [[1.35, 3.9]],
      gates: [{ opens: 50, noteOpen: 'Die Lavaröhre ist frei!' }],
      boxRows: [2.6],
    },
    // b: die alte Hängebrücke quer über die Schlucht – schmal, ohne Geländer, und nach 84 Sekunden stürzt sie ein
    {
      from: 6.4,
      to: 9.7,
      // erster und letzter Punkt: je 40 m hinter der Gabelung bzw. vor der Einmündung, 13 m neben der Hauptstrecke
      points: [
        [161, -45.7, 5.78],
        [160.4, -7.1, 8.45],
        [159.8, 31.6, 11.12],
      ],
      roadHalf: 6.4,
      shoulder: 2,
      widths: [[0.85, 3.15, 4.2, 0.4]],
      surfaces: [[1.0, 3.0, 'wood']],
      decks: [[1.05, 2.95]],
      open: [[1.1, 2.9, 0]],
      gates: [{ closes: 84, noteShut: 'Die Hängebrücke stürzt ein!' }],
      // Sie bricht von vorn nach hinten weg: wer beim Einsturz noch drauf ist, muss schneller sein als der Bruch.
      cracks: [
        { from: 1.1, to: 1.46, lat0: -7, lat1: 7, at: 84.5 },
        { from: 1.46, to: 1.82, lat0: -7, lat1: 7, at: 85.4 },
        { from: 1.82, to: 2.18, lat0: -7, lat1: 7, at: 86.3 },
        { from: 2.18, to: 2.54, lat0: -7, lat1: 7, at: 87.2 },
        { from: 2.54, to: 2.9, lat0: -7, lat1: 7, at: 88.1 },
      ],
    },
  ],
};
