// 8 · Mondbasis – Start unter der Kuppel, durch die Schleuse hinaus auf den
// Kraterrand, über den großen Krater (mit der Sprungplatte mitten hinüber oder
// außen herum), durch das Meteoritenfeld, um das Solarfeld (oder durch die
// Lavaröhre darunter) und mit dem Massenbeschleuniger in hohem Bogen über die
// Schlucht zurück zur Basis.
//
// Hier gilt nur gut ein Drittel der Schwerkraft (Track.gravity): jeder Buckel
// trägt weit und hoch, Sprungplatten schleudern über Krater. In der Luft
// lenken Steuerdüsen etwas mit; über den großen Sprüngen hängen Schubringe.

import type { TrackDef } from '../track';

export const MOND: TrackDef = {
  id: 'mond',
  name: 'Mondbasis',
  theme: 'glut',
  blurb: 'Kuppel, Schleuse, Kraterrand, Meteoritenfeld, Solarfeld oder Lavaröhre – und der Massenbeschleuniger.',
  twist: 'Geringe Schwerkraft: jeder Buckel wird zum weiten Sprung, Sprungplatten schleudern über Krater. Meteoriten schlagen ein.',
  grade: 3,
  surface: 'regolith',
  gravity: 0.38,
  scale: 1.38,
  points: [
    // 0–2: Start unter der Kuppel nach Osten
    [-130, -150, 0],
    [-85, -150, 0],
    [-40, -150, 0],
    // 3: Schleuse
    [5, -146, 0.5],
    // 4–8: hinauf auf den Kraterrand
    [45, -128, 2],
    [78, -98, 4.5],
    [96, -60, 6.5],
    [100, -20, 7.5],
    [108, 20, 7],
    // 7.9: Gabelung großer Krater (geradeaus). 9–12 außen herum
    [136, 48, 6.5],
    [152, 86, 6],
    [144, 126, 6.5],
    [118, 154, 7],
    // 13.5: Einmündung. 13–16 Meteoritenfeld nach Westen
    [82, 172, 7.5],
    [40, 176, 7],
    [-2, 164, 6.5],
    [-42, 146, 6],
    // 16.2: Gabelung Solarfeld. 17–19 außen um das Solarfeld
    [-90, 134, 6],
    [-124, 104, 6.5],
    [-138, 64, 7],
    // 19.8: Einmündung. 20–21 Massenbeschleuniger nach Süden
    [-152, 26, 7.5],
    [-162, -14, 8.5],
    // 22–25: Landung jenseits der Schlucht, zurück zur Kuppel
    [-166, -56, 4],
    [-168, -92, 1.5],
    [-164, -126, 0.3],
    [-152, -146, 0],
  ],
  roadHalf: 6.6,
  shoulder: 2.6,
  startAt: 0,
  laps: 3,
  bank: 1.3,
  fallDepth: 6,
  surfaces: [
    [0, 3.7, 'panel'],
    [19.9, 21.2, 'panel'],
    [23.3, 25.99, 'panel'],
  ],
  tunnels: [[2.5, 3.5]],
  bumps: [
    { at: 5.5, length: 14, height: 1.1 },
    { at: 6.6, length: 14, height: 1.2 },
    { at: 15.6, length: 14, height: 1.1 },
  ],
  meteors: [
    { at: 13.75, lat: -3.6, period: 4.6, phase: 0 },
    { at: 13.95, lat: 2.6, period: 4.6, phase: 1.6 },
    { at: 14.15, lat: -1.2, period: 4.6, phase: 3.1 },
    { at: 14.4, lat: 3.8, period: 4.6, phase: 0.8 },
    { at: 14.7, lat: -3.2, period: 4.6, phase: 2.4 },
    { at: 15.0, lat: 0.8, period: 4.6, phase: 3.9 },
  ],
  // Massenbeschleuniger: Sprungplatte über die ganze Breite, dahinter die Schlucht
  // (Platte und Rampe beginnen an derselben Stelle: die Platte liegt auf der Rampe, dahinter beginnt die Lücke.)
  launchers: [{ at: 20.85, power: 10.5 }],
  ramps: [{ at: 20.85, length: 8, height: 0.5, gap: 36 }],
  rings: [
    { at: 21.45, lat: 0, up: 5.2 },
    { at: 21.75, lat: 0, up: 5.2 },
  ],
  pads: [
    { at: 1.2, lat: 0 },
    { at: 12.3, lat: 0 },
    { at: 20.3, lat: 0, halfWidth: 0 },
    { at: 24.2, lat: 0 },
  ],
  boxRows: [2.2, 7.2, 11.6, 15.9, 22.8],
  branches: [
    // a: mitten über den großen Krater – nur mit der Sprungplatte
    {
      from: 7.9,
      to: 13.5,
      points: [
        [112, 54, 7.3],
        [110, 88, 7.4],
        [107, 118, 7.3],
        [101, 144, 7.3],
        [90, 161, 7.4],
      ],
      roadHalf: 5.6,
      launchers: [{ at: 1.55, power: 9.5 }],
      ramps: [{ at: 1.55, length: 7, height: 0.4, gap: 30 }],
      rings: [{ at: 2.05, lat: 0, up: 4.2 }],
      pads: [{ at: 1.0, lat: 0, halfWidth: 0 }],
    },
    // b: durch die Lavaröhre unter dem Solarfeld – kürzer und eng
    {
      from: 16.2,
      to: 19.8,
      points: [
        [-74, 118, 5.6],
        [-96, 90, 5.4],
        [-116, 62, 6],
      ],
      roadHalf: 4.8,
      shoulder: 1.2,
      tunnels: [[0.7, 2.8]],
      boxRows: [1.8],
    },
  ],
};
