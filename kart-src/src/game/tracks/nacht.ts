// 4 · Nachtschicht – Hochstraße durch die Stadt bei Nacht, mit rechten Winkeln
// an allen vier Ecken. An der Ostseite trennen sich die Wege: die Hochstraße
// zieht einen sicheren Bogen um den Häuserblock, die Dachlinie springt schmal
// und ohne Bande von Dach zu Dach. Nach der Schikane im Norden taucht die
// Unterführung ab, läuft unter der Hochstraße hindurch in die Betonröhre und
// steigt an der Westseite wieder herauf. Zum Schluss schraubt sich die
// Parkhaus-Spirale mit Steilkurve einmal über sich selbst hinweg.

import { VEH_BUS, VEH_TAXI, VEH_TRAM, VEH_VAN } from '../mechanics';
import type { TrackDef } from '../track';
import { arc, convoy } from './shape';

export const NACHT: TrackDef = {
  id: 'nacht',
  name: 'Nachtschicht',
  theme: 'nacht',
  blurb: 'Hochstraße bei Nacht: Dachsprung oder Bogen, Unterführung durch die Röhre, Parkhaus-Spirale.',
  twist: 'Stadtverkehr fährt mit: nicht auffahren – dicht dahinter lädt der Windschatten.',
  // Verkehr auf der ganzen Hochstraße, drei Spuren. Links das Gleis der
  // Straßenbahn (mit Taxis dazwischen) und die Mitte fahren gleich schnell und
  // sind gegeneinander versetzt besetzt; rechts rollen langsamer die Busse und
  // Lieferwagen. Nebeneinander fahren also höchstens zwei Fahrzeuge – eine
  // ganze Spur bleibt immer frei. Abzweigungen (Dächer, Röhre) sind
  // verkehrsfrei. Die Lücke im Muster liegt während des Countdowns über der
  // Startaufstellung.
  traffic: {
    lanes: [
      { lat: -4.2, speed: 15, cars: convoy(150, 1300, 104, [VEH_TRAM, VEH_TAXI, VEH_TAXI]) },
      { lat: 0, speed: 15, cars: convoy(202, 1340, 104, [VEH_TAXI, VEH_VAN, VEH_TAXI]) },
      { lat: 4.2, speed: 11, cars: convoy(120, 1340, 76, [VEH_BUS, VEH_VAN, VEH_BUS, VEH_TAXI]) },
    ],
  },
  grade: 2,
  // Neon-Asphalt auf der Hochstraße, Stahl in der Parkhaus-Spirale und auf den
  // Dächern, Kopfsteinpflaster unten in der Unterführung
  surface: 'neon',
  surfaces: [[36, 51.99, 'metal']],
  points: [
    // 0–4: Startgerade nach Osten, leicht bergab
    [-140, -128, 13.5],
    [-100, -128, 12.8],
    [-60, -128, 12],
    [-20, -128, 11],
    [20, -128, 10.2],
    // 5–7: Südost-Ecke
    ...arc(42, -108, 20, 270, 360, 3, 10, 10),
    // 8–10: Ostseite nach Norden, mit Schanze
    [62, -75, 10.5],
    [62, -50, 11.3],
    [62, -30, 12],
    // 10: Gabelung – 11–15 der Bogen um den Häuserblock …
    [74, 8, 12],
    [98, 44, 12.3],
    [108, 80, 12.5],
    [106, 112, 12.6],
    [74, 155, 12.6],
    // 16: Einmündung der Dachlinie, 17–19 Nordost-Ecke
    [62, 195, 12.6],
    ...arc(42, 230, 20, 0, 90, 3, 12.8, 13),
    // 20–23: Schikane nach Westen
    [22, 250, 12.8],
    [2, 245, 12.4],
    [-18, 251.5, 12],
    [-40, 248, 11.6],
    // 24: Gabelung – 25–26 oben über die Unterführung hinweg …
    [-80, 250, 11.5],
    [-120, 250, 11.6],
    [-165, 250, 11.8],
    // 27–29: Nordwest-Ecke
    ...arc(-198, 230, 20, 90, 180, 3, 11.5, 11),
    // 30–35: Westseite nach Süden, Senke und Kuppe; 34 Einmündung der Unterführung
    [-218, 180, 9.5],
    [-218, 130, 7],
    [-218, 80, 9],
    [-218, 30, 8.5],
    [-218, -18, 8],
    [-218, -60, 6],
    // 36–51: Parkhaus-Spirale, eineinviertel Umdrehungen bergauf
    ...arc(-192, -102, 26, 180, 630, 16, 4, 14),
  ],
  roadHalf: 6.4,
  shoulder: 1.4,
  startAt: 0,
  laps: 3,
  bank: 2.4,
  fallDepth: 7,
  banks: [[38, 49, -0.3]],
  pads: [
    { at: 1.5, lat: 0 },
    { at: 7.6, lat: 0, halfWidth: 0 },
    { at: 32.5, lat: 0 },
  ],
  boxRows: [2.5, 12.6, 22.7, 30.6, 44],
  // Keine Schanze und keine Pendel auf der Hochstraße: dort fährt der Verkehr.
  bumps: [
    { at: 3.5, length: 14, height: 0.9 },
    { at: 8.7, length: 14, height: 0.8 },
    { at: 32, length: 16, height: 1.0 },
  ],
  decks: [[0, 51.99]],
  branches: [
    // a: Unterführung – über die Rampe hinab, unter der Hochstraße hindurch,
    // durch die Betonröhre und an der Westseite wieder hinauf
    {
      from: 23.6,
      to: 34.2,
      points: [
        [-112, 263, 9.8],
        [-146, 280, 7],
        [-161.6, 273.6, 4.8],
        [-168, 258, 2.8],
        [-168, 215, 0.6],
        [-168, 160, 0.5],
        [-168, 115, 0.5],
        [-172, 80, 2.5],
        [-190, 50, 5],
        [-206, 22, 7],
      ],
      decks: [[0, 3.6], [8.4, 11]],
      tunnels: [[5.1, 7.4]],
      surfaces: [[4.5, 8.6, 'cobble']],
      boxRows: [6],
      pads: [{ at: 5.5, lat: 0 }],
    },
    // b: Über die Dächer – schmal, ohne Bande, mit Sprung über die Häuserlücke
    {
      from: 9.6,
      to: 16.4,
      points: [
        [50, 8, 12.6],
        [44, 50, 13.6],
        [44, 112, 12.8],
        [50, 170, 12.6],
      ],
      surface: 'metal',
      roadHalf: 4.6,
      shoulder: 1,
      decks: [[0, 5]],
      open: [[1, 4.2, 0]],
      ramps: [{ at: 1.95, length: 9, height: 1.3, gap: 12 }],
      pads: [{ at: 1.2, lat: 0, halfWidth: 0 }],
      boxRows: [3.4],
    },
  ],
};
