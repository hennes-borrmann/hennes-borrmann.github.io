// 17 · Achterbahn-Rummel – ein Jahrmarkt am frühen Abend, und die halbe Runde ist eine Holzachterbahn.
//
// Vom Festplatz geht es in den Bahnhof der Achterbahn: Dort beginnen die Schienen (mechanics.ts: Rail). Das Kart
// sitzt auf einer von zwei Schienen und rollt wie ein Achterbahnwagen – die Kette zieht den Lifthügel hinauf, dann
// die große Abfahrt, ein Kamelbuckel, die Steilkurve, noch ein Hügel, die Bremsstrecke. Lenken wechselt die Schiene;
// herunterfallen kann man nicht. Auf dem Lifthügel und hinter der Steilkurve liegen Schubmagnete, die abwechselnd
// links und rechts anziehen: Wer im Takt die Schiene wechselt, ist deutlich schneller oben. Keine Loopings.
// Danach zurück über den Rummel: durch die Geisterbahn (Tunnel), über die Budengasse zum Festplatz.

import type { TrackDef } from '../track';

// Die beiden Schienen liegen 2 m links und rechts der Mitte.
const L = -2;
const R = 2;
// Schubmagnete ziehen gut eine Sekunde von dreien: erst links, dann rechts – nie beide zugleich.
const kick = (at: number, phase: number): { at: number; lat: number; period: number; phase: number }[] => [
  { at, lat: L, period: 3, phase },
  { at, lat: R, period: 3, phase: phase + 1.5 },
];

export const RUMMEL: TrackDef = {
  id: 'rummel',
  name: 'Achterbahn-Rummel',
  theme: 'rummel',
  blurb: 'Festplatz, Bahnhof der Holzachterbahn, Lifthügel, große Abfahrt, Kamelbuckel, Steilkurve, Bremsstrecke, durch die Geisterbahn und über die Budengasse zurück.',
  twist: 'Auf den Schienen rollt das Kart wie ein Achterbahnwagen: Lenken wechselt die Schiene. Schubmagnete ziehen abwechselnd links und rechts – wer im Takt wechselt, ist schneller oben.',
  grade: 2,
  scale: 2.05,
  surface: 'asphalt',
  points: [
    // 0–2: Festplatz, nach Osten (Start)
    [-60, -120, 4],
    [-10, -122, 4],
    [40, -118, 4],
    // 3–4: Rechtsbogen in den Bahnhof der Achterbahn (ab 3,7 Schienen)
    [84, -100, 4],
    [104, -60, 4],
    // 5–6: der Lifthügel, nach Süden
    [106, -28, 20],
    [104, 4, 34],
    // 7: die große Abfahrt
    [98, 34, 6],
    // 8–9: Kamelbuckel
    [84, 62, 20],
    [60, 82, 6],
    // 10–11: Steilkurve nach rechts, zurück nach Norden
    [28, 92, 12],
    [0, 78, 6],
    // 12–13: der zweite Hügel und die Bremsstrecke (bei 13,6 enden die Schienen)
    [-16, 48, 12],
    [-24, 18, 5],
    // 14–16: über den Rummel nach Westen, durch die Geisterbahn
    [-40, -8, 4],
    [-74, -16, 4],
    [-104, -38, 4],
    // 17–18: die Budengasse, zurück zum Festplatz
    [-112, -78, 4],
    [-94, -110, 4],
  ],
  roadHalf: 6.4,
  shoulder: 2,
  startAt: 0,
  laps: 3,
  bank: 1.1,
  fallDepth: 6,
  landmarkAt: 6,
  surfaces: [
    [3.7, 13.6, 'wood'],
    [16.6, 2.4, 'cobble'],
  ],
  // Auf den Schienen ist die Bahn schmal: zwei Schienen und ein Laufsteg je Seite.
  widths: [[3.7, 13.6, 3.6, 0.8]],
  rails: [
    {
      from: 3.7,
      to: 13.6,
      lanes: [L, R],
      // Die Kette zieht mit 12 m/s; die Bremsstrecke lässt höchstens 27 m/s durch.
      lifts: [[4.25, 6.0, 12]],
      brakes: [[13.0, 13.6, 27]],
    },
  ],
  // Auf dem Lifthügel ziehen alle linken Magnete zugleich, dann alle rechten: Wer mit Schub von einem zum nächsten
  // kommt (knapp 30 m in anderthalb Sekunden), findet den nächsten auf der anderen Schiene – also wechseln, im Takt.
  kicks: [...kick(4.5, 0), ...kick(4.95, 0), ...kick(5.4, 0), ...kick(5.85, 0), ...kick(11.35, 0.7), ...kick(12.1, 0.7)],
  // Steilkurve: gut 20° nach innen geneigt
  banks: [[9.5, 11.3, -0.36]],
  // Geisterbahn
  tunnels: [[15.2, 16.4]],
  pads: [
    { at: 1.6, lat: 0 },
    { at: 14.3, lat: 0 },
    { at: 17.5, lat: 0 },
  ],
  boxRows: [0.9, 3.0, 14.8, 16.9],
};
