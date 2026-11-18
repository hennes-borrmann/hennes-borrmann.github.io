// 20 · Neonhochbahn – eine Zukunftsstadt bei Nacht, die ganze Runde hoch über den Straßen.
//
// Hauptbühne ist das Schwebeband (mechanics.ts: Band): Auf ihm schweben die Karts mit eingeklappten Rädern über einem
// Magnetband. Es steigt vom Boulevard steil an, legt sich als Steilkurve um den ersten Turm und dreht sich dann an die
// Fassade des Nachbarturms – ein Stück lang fährt man senkrecht an der Wand (gerechnet wird flach, das Bild dreht sich:
// twistWarp in track.ts). Über das Band wandern zwei Magnetlinien; wer auf einer bleibt, wird schneller. Wer ein anderes
// schwebendes Kart berührt, stößt sich ab – und beide bekommen Schub; ebenso an den Prallpollern am Rand.
//
// Danach hoch über den Boulevard hinweg (die Strecke kreuzt sich selbst), über die Dachstraße am Atriumturm, im
// Gleitflug zwischen den Dächern hinunter, die Parkhausspirale hinab in die untere Ebene und am Bahnhof der U-Bahn vorbei
// zurück zum Start.
//
// Zwei echte Abkürzungen, jede mit Preis:
//   a) Atrium ('risk'): geradeaus mitten durch den Atriumturm – ein schmaler Steg ohne Geländer über dem Lichthof.
//   b) Zugdach ('train'): geradeaus durch die U-Bahn-Station – aber dort ist ein Gleisgraben, und über ihn trägt nur das
//      Dach des Zugs, der gerade im Bahnhof hält. Das Tor an der Einfahrt ist nur offen, solange einer steht.

import type { TrackDef } from '../track';

export const NEON: TrackDef = {
  id: 'neon',
  name: 'Neonhochbahn',
  theme: 'neon',
  blurb: 'Boulevard, auf dem Schwebeband steil hinauf, Steilkurve um den Turm, an der Fassade entlang, über die eigene Strecke hinweg, Gleitflug zwischen den Dächern, Parkhausspirale hinab und am U-Bahnhof vorbei.',
  twist: 'Auf dem Schwebeband schwebt man: Magnetlinien ziehen, Berührungen stoßen ab und geben Schub – und das Band dreht sich senkrecht an die Fassade. Abkürzungen mitten durchs Atrium (ohne Geländer) und über das Dach der U-Bahn (nur wenn sie hält).',
  grade: 3,
  scale: 0.95,
  surface: 'neon',
  points: [
    // 0–2: Boulevard nach Osten (Start)
    [-130, 0, 4],
    [-90, 0, 4],
    [-50, 0, 4.5],
    // 3–5: das Schwebeband steigt steil an
    [0, 0, 8],
    [55, 0, 15],
    [110, -2, 21],
    // 6–9: Steilkurve links herum um den ersten Turm
    [146, -14, 24.5],
    [160, -42, 27],
    [146, -70, 29.5],
    [116, -80, 31.5],
    // 10–12: an der Fassade des Nachbarturms entlang nach Westen
    [66, -82, 34],
    [16, -82, 36.5],
    [-34, -82, 39],
    // 13–15: Linksbogen nach Süden, hoch über den Boulevard hinweg
    [-68, -72, 41],
    [-82, -44, 42],
    [-86, -6, 43],
    // 16–20: Dachstraße am Atriumturm: weiter Schwenk nach Westen und zurück
    [-88, 30, 43.5],
    [-122, 58, 44.5],
    [-164, 94, 45.3],
    [-160, 140, 45.8],
    [-116, 170, 46],
    // 21: Absprungkante
    [-92, 196, 46],
    // 22–23: Gleitflug zwischen den Dächern hinunter
    [-74, 228, 41.5],
    [-56, 262, 35.5],
    // 24–33: Parkhausspirale hinab (rechts herum, eineinviertel Runden); Landung auf ihrem Dach
    [-46.5, 312.0, 31.0],
    [-55.6, 331.5, 28.3],
    [-76.4, 337.1, 25.7],
    [-94.1, 324.8, 23.0],
    [-96.0, 303.3, 20.3],
    [-80.7, 288.0, 17.7],
    [-59.2, 289.9, 15.0],
    [-46.9, 307.6, 12.3],
    [-52.5, 328.4, 9.7],
    [-72.0, 337.5, 7.0],
    // 34–36: untere Ebene nach Westen (unter der Einfahrt der Spirale hindurch), Bogen nach Norden
    [-116, 342, 5],
    [-154, 346, 4],
    [-192, 326, 4],
    // 37–41: am U-Bahnhof vorbei (außen herum, weit nach Westen)
    [-200, 292, 4],
    [-216, 264, 4],
    [-270, 230, 4],
    [-290, 172, 4],
    [-254, 126, 4],
    // 42–45: zurück auf den Boulevard
    [-208, 96, 4],
    [-200, 58, 4],
    [-182, 18, 4],
    [-156, 2, 4],
  ],
  roadHalf: 6.6,
  shoulder: 1.6,
  startAt: 0,
  laps: 3,
  bank: 1.2,
  fallDepth: 7,
  landmarkAt: 11,
  // Das ganze Netz steht auf Stützen hoch über den Straßen der Stadt.
  decks: [[0, 0]],
  // Schwebeband: vom Fuß der Steigung bis zum Ende der Fassade. An die Fassade gedreht (rechts, 90°): je 50 m Übergang, 50 m an der Wand.
  bands: [
    {
      from: 2.7,
      to: 12.7,
      radius: 10,
      twists: [
        [9.3, 0],
        [10.3, 90],
        [11.3, 90],
        [12.4, 0],
      ],
    },
  ],
  widths: [
    [2.7, 12.7, 5.6, 0.9],
    // Landung auf dem Parkhaus und die Spirale: breiter
    [23.3, 33.2, 7.6, 1.6],
  ],
  banks: [
    // Steilkurve um den ersten Turm: gut 31° nach innen
    [6.0, 9.1, -0.6],
    // An der Fassade liegt das Band eben (die Verdrehung macht das Bild)
    [9.2, 12.7, 0],
    // Parkhausspirale: leicht geneigt
    [24.6, 32.6, 0.18],
  ],
  bumpers: [
    { at: 4.2, lat: -5.3 },
    { at: 4.6, lat: 5.3 },
    { at: 5.4, lat: -5.3 },
    { at: 8.9, lat: 5.3 },
  ],
  surfaces: [[2.7, 12.7, 'band']],
  glides: [[21.15, 23.55]],
  thermals: [{ at: 22.4, lat: -4, radius: 7 }],
  rings: [
    { at: 21.9, lat: -3, up: 2 },
    { at: 23.0, lat: 2, up: 3 },
  ],
  tunnels: [[33.4, 34.4]],
  hazards: [
    { at: 15.5, amp: 4.4, period: 4.8, phase: 0 },
    { at: 35.5, amp: 4.6, period: 5.4, phase: 1.3 },
  ],
  pads: [
    { at: 1.4, lat: 0 },
    { at: 20.95, lat: 0, halfWidth: 0 },
    { at: 35.0, lat: 0 },
  ],
  boxRows: [1.0, 14.5, 24.3, 42.5],
  // U-Bahn: alle 17 s ein Zug, er hält 9 s im Bahnhof.
  metro: { branch: 1, speed: 17, accel: 3.4, dwell: 9, period: 17, phase: 4 },
  branches: [
    // a) Atrium: geradeaus durch den Lichthof des Atriumturms – schmal, ohne Geländer.
    {
      from: 15.6,
      to: 20.9,
      shortcut: 'risk',
      points: [
        [-90, 62, 44.2],
        [-94, 104, 45],
        [-96, 148, 45.6],
      ],
      roadHalf: 3.2,
      shoulder: 0.4,
      surface: 'panel',
      open: [[1, 3, 0]],
      decks: [[1, 3]],
    },
    // b) Zugdach: geradeaus durch die U-Bahn-Station, über den Gleisgraben auf dem Dach des haltenden Zugs.
    {
      from: 36.6,
      to: 42.5,
      shortcut: 'train',
      points: [
        [-200, 252, 4],
        [-200, 226, 4],
        [-200, 194, 4],
        [-200, 162, 4],
        [-200, 136, 4],
      ],
      roadHalf: 3.6,
      shoulder: 0.6,
      surface: 'panel',
      trench: [1.95, 4.02],
      tunnels: [[1.5, 4.5]],
      decks: [[1, 5.2]],
    },
  ],
};
