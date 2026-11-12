// 16 · Riesenkinderzimmer – die Karts sind Spielzeug, das Zimmer ist die Welt.
//
// In der Bahn stehen Ringe (mechanics.ts: Sizer): Wer durch den blauen fährt, schrumpft, wer durch den orangen
// fährt, wächst – für zehn Sekunden (in der passenden Abkürzung steht die Uhr still).
//   winzig: etwas langsamer, wendiger – und passt durchs Mauseloch (Abkürzung hinter der Fußleiste);
//           wird aber von normalen Karts weggeschoben und von riesigen plattgefahren.
//   riesig: etwas schneller, träger – und bricht durch die Bauklotz-Burg (Abkürzung über den Schreibtisch).
// Wer keine der beiden Größen hat, für den ist die Abkürzung zu: Die Bande läuft dort einfach durch.

import type { TrackDef } from '../track';

export const ZIMMER: TrackDef = {
  id: 'zimmer',
  name: 'Riesenkinderzimmer',
  theme: 'zimmer',
  blurb: 'Spielteppich, unter dem Bett hindurch, um das Regal oder durchs Mauseloch, die Bücherrampe hinauf auf den Schreibtisch, um die Bauklotz-Burg oder mitten hindurch, Sprung hinunter auf den Teppich.',
  twist: 'Ringe lassen schrumpfen (blau) oder wachsen (orange): Nur winzig passt man durchs Mauseloch, nur riesig bricht man durch die Bauklotz-Burg.',
  grade: 2,
  scale: 1.9,
  // Spielteppich mit aufgedruckter Straße (Asphalt); der Schreibtisch ist aus Holz
  surface: 'asphalt',
  points: [
    // 0–2: Spielteppich mit aufgedruckter Straße, nach Osten (Start)
    [-70, -110, 2],
    [-10, -114, 2],
    [50, -108, 2],
    // 3–5: Bogen, unter dem Bett hindurch
    [96, -80, 2],
    [112, -36, 2],
    [108, 14, 2],
    // 6: vor dem Regal (bei 5.35 der Schrumpfring, bei 6.0 das Mauseloch)
    [84, 54, 2],
    // 7–8: außen um den Regalfuß
    [60, 96, 2],
    [0, 112, 3],
    // 9–10: die Bücherrampe hinauf (bei 9.4 mündet das Mauseloch ein)
    [-48, 84, 5.5],
    [-78, 46, 8.5],
    // 11: Schreibtisch (bei 10.45 der Wachsring, bei 11.0 die Bauklotz-Burg)
    [-92, 6, 10],
    // 12–14: außen um die Burg
    [-68, -14, 10],
    [-58, -30, 10],
    [-68, -46, 10],
    // 15: hinter der Burg, zur Tischkante (bei 15.35 der Sprung)
    [-96, -64, 10],
    // 16–17: Landung auf dem Teppich, Bogen zurück zum Start
    [-116, -92, 2.4],
    [-106, -112, 2],
  ],
  roadHalf: 6.4,
  shoulder: 2,
  startAt: 0,
  laps: 3,
  bank: 1.0,
  fallDepth: 6,
  landmarkAt: 4.6,
  surfaces: [[10.6, 15.5, 'wood']],
  // unter dem Bett
  tunnels: [[3.9, 5.0]],
  // Schreibtisch
  decks: [[10.6, 15.5]],
  // Sprung von der Tischkante
  ramps: [{ at: 15.35, length: 8, height: 1.0, gap: 8 }],
  // Ringe, je gut 80 m vor der Abkürzung, zu der sie passen – auf der Seite, auf der sie abgeht
  sizers: [
    // blau: schrumpfen (rechts) – fürs Mauseloch
    { at: 5.15, lat0: 1.0, lat1: 5.6 },
    // orange: wachsen (links) – für die Bauklotz-Burg
    { at: 10.0, lat0: -5.6, lat1: -1.0, grow: true },
  ],
  branches: [
    // a: das Mauseloch – schnurgerade hinter der Fußleiste entlang, wo die Hauptstrecke außen um den Regalfuß muss.
    //    Nur für winzige Karts: Für alle anderen läuft an der Mündung die Bande durch.
    {
      from: 6.0,
      to: 9.4,
      // erster und letzter Punkt: je 40 m hinter der Gabelung bzw. vor der Einmündung, 13 m neben der Hauptstrecke
      points: [
        [68.9, 70.4, 1.96],
        [31.8, 73.6, 3.1],
        [-5.2, 76.7, 4.3],
        [-42.3, 79.9, 5.41],
      ],
      roadHalf: 6.4,
      shoulder: 2,
      widths: [[1.25, 3.75, 4.4, 0.8]],
      tunnels: [[1.3, 3.7]],
      gates: [{ only: 'small' }],
      boxRows: [2.5],
    },
    // b: mitten durch die Bauklotz-Burg, wo die Hauptstrecke außen herum muss. Nur für riesige Karts.
    {
      from: 11.0,
      to: 15.0,
      points: [
        [-80.0, -13.6, 10.04],
        [-80.7, -30.2, 10.2],
        [-81.5, -46.9, 10.35],
      ],
      roadHalf: 6.4,
      shoulder: 2,
      decks: [[0, 4]],
      surface: 'wood',
      gates: [{ only: 'big' }],
    },
  ],
  pads: [
    { at: 2.4, lat: 0 },
    // (auf der Bücherrampe, rechtzeitig vor dem Wachsring – der steht links)
    { at: 9.15, lat: 0 },
    { at: 16.6, lat: 0 },
  ],
  boxRows: [1.5, 5.6, 8.0, 12.6],
};
