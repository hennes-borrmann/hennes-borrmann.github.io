// 24 · Dächerjagd – eine Hafenstadt am Hang, am späten Nachmittag eines Festtags.
//
// Die Altstadt (Fachwerk, Ziegeldächer, Kirchturm, Kanäle) steht in render/life/daecher.ts und render/mechanics/altstadt.ts
// – passend zu den Stützpunkten hier. Die Runde hat vier Fahrarten:
//   1. Steile Gassen: Vom Marktplatz durch die Bastei-Kehre (eine echte Steilkurve, gut 30° nach innen geneigt) und die
//      Steile Gasse hinauf zum Domplatz; nach den Dächern die Treppengasse hinab (bis 40 % Gefälle) – oben an der Kante hebt
//      man ab, unten führt sie als Wassertreppe in den Kanal.
//   2. Über die Dächer: Über eine Festrampe aufs Kirchendach, durch die Glockenstube des Turms und hinaus in den
//      Gleitflug (Aufwind, Schubringe) – gelandet wird auf dem Dach des Kornspeichers. Dort geht es über die Dächer weiter,
//      mit einem Sprung über eine Gasse zwischen den Eckhäusern und über die Dachrampe hinunter in die Treppengasse.
//   3. Tauchen: durch den Kanal, unter den Brücken hindurch (auch unter der Brücke der Langen Gasse, über die man später
//      selbst fährt – die Strecke kreuzt sich dort), hinaus ins Hafenbecken und über den Slip auf den Kai.
//   4. Straßenbahn: Durch die Lange Gasse fährt nach Fahrplan die Straßenbahn auf ihrem Gleis rechts mit, hält an der
//      Haltestelle hinter der Kanalbrücke und biegt am Ende in die Kramergasse ab (mechanics.ts: VEH_STADTBAHN, eigene Linie
//      aus der Remise am Kai bis ins Torhaus der Kramergasse).
//
// Zwei echte Abkürzungen, jede mit Preis:
//   a) Dachsprung-Kette ('risk'): geradeaus über die Dächer statt des Umwegs über die Eckhäuser – drei Sprünge
//      hintereinander über drei Gassen, schmal und ohne Brüstung. Wer zu langsam oder schief abspringt, fällt in die Gasse
//      und wird mit Anlauf vor dem Sprung neu aufgesetzt.
//   b) Markthalle ('item'): mitten durch die Halle zwischen den Ständen statt außen um sie herum – auf Stroh und
//      Sägespänen kommt man ohne Schub nur langsam voran (langsamer als außen herum), mit einem Zisch deutlich schneller.

import type { TrackDef } from '../track';
import { arc } from './shape';

/** Maßstab der Stützpunkte (x, z); die Kulisse rechnet mit denselben Zahlen. */
export const DAECHER_SCALE = 1.18;

export const DAECHER: TrackDef = {
  id: 'daecher',
  name: 'Dächerjagd',
  theme: 'daecher',
  blurb: 'Durch die Gassen einer Hafenstadt am Festtag: die Steilkurve an der Bastei hinauf, durch den Kirchturm in den Gleitflug, über die Dächer, die Treppengasse hinab und tauchend durch den Kanal.',
  twist: 'Vier Fahrarten in einer Runde, dazu die Straßenbahn nach Fahrplan. Abkürzungen über eine Kette von Dachsprüngen (nur mit Tempo und geradem Absprung) und durch die Markthalle (nur mit Schub).',
  grade: 3,
  scale: DAECHER_SCALE,
  surface: 'cobble',
  sea: 0,
  points: [
    // 0–1: Marktplatz, Start nach Osten
    [96, 22, 10],
    [128, 22, 10.5],
    // 2–8: Bastei-Kehre, links herum um die Bastei der Stadtmauer
    ...arc(166, -8, 30, 90, -90, 7, 11.5, 17.5),
    // 9–11: Burggasse nach Westen, den Hang hinauf
    [128, -42, 20.5],
    [96, -50, 24],
    [72, -64, 26],
    // 12–13: Steile Gasse nach Norden
    [64, -88, 29.5],
    [60, -114, 33.5],
    // 14–15: Domplatz, nach Westen
    [48, -134, 34],
    [26, -142, 34],
    // 16–17: Festrampe aufs Kirchendach, den First entlang
    [4, -144, 39],
    [-18, -144, 44.6],
    // 18: Glockenstube im Turm – dahinter der Absprung
    [-40, -144, 46],
    // 19–22: Gleitflug in weitem Linksbogen über den Hang
    [-62, -143, 44.5],
    [-92, -132, 40],
    [-114, -110, 34],
    [-126, -82, 28.6],
    // 23: auf dem Dach des Kornspeichers gelandet
    [-128, -62, 27.8],
    // 24–30: Umweg über die Dächer der Eckhäuser nach Westen (die Dachsprung-Kette führt geradeaus)
    [-131, -42, 27.2],
    [-142, -26, 26.8],
    [-164, -16, 26.2],
    [-194, 6, 25.6],
    [-192, 38, 24.8],
    [-166, 54, 24],
    [-144, 52, 23.4],
    // 31–32: letztes Dach, über die Dachrampe hinunter an den Kopf der Treppengasse
    [-136, 67, 23],
    [-131, 80, 19],
    // 33–35: Treppengasse hinab, als Wassertreppe in den Kanal
    [-127, 94, 12.9],
    [-121, 106, 6.6],
    [-112, 116, 0.6],
    // 36–40: durch den Kanal (tauchend), unter den Brücken hindurch
    [-100, 126, -4],
    [-80, 134, -4.5],
    [-58, 142, -4.5],
    [-38, 154, -4.5],
    [-26, 172, -4.5],
    // 41–43: Hafenbecken, über den Slip hinauf auf den Kai
    [-32, 192, -4],
    [-50, 200, -2.5],
    [-70, 194, 0.5],
    // 44–48: Kai, nach Norden die Lange Gasse hinauf (mit der Straßenbahn), über die Kanalbrücke
    [-84, 178, 2.2],
    [-86, 156, 2.5],
    [-84, 126, 4.5],
    [-82, 96, 6.5],
    [-80, 70, 8.5],
    // 49–51: Kurve in den Marktplatz
    [-76, 48, 9.6],
    [-64, 30, 10],
    [-44, 22, 10],
    // 52–58: außen um die Markthalle (die Abkürzung führt mitten hindurch)
    [-24, 10, 10],
    [-18, -22, 10],
    [8, -36, 10],
    [34, -24, 10],
    [40, 2, 10],
    [54, 20, 10],
    [74, 24, 10],
  ],
  roadHalf: 6,
  shoulder: 1.2,
  startAt: 0,
  laps: 3,
  bank: 1.2,
  fallDepth: 7,
  landmarkAt: 17.5,
  widths: [
    // Festrampe, Kirchendach und Glockenstube: ein schmaler Laufsteg auf dem First.
    [15.8, 18.38, 5, 0.8],
    // Der Gleitflug: ein breiter Korridor über dem Hang.
    [18.38, 22.65, 14, 0.5],
    // Kanal und Hafenbecken: von Kaimauer zu Kaimauer.
    [35.6, 42.6, 7, 1.5],
  ],
  banks: [
    // Bastei-Kehre: gut 30° nach innen
    [2.4, 7.6, 0.6],
    // flach an Gabelung und Einmündung der Dachsprung-Kette und der Markthalle
    [23.3, 24.7, 0],
    [29.4, 32.2, 0],
    [50.4, 51.8, 0],
    [56.4, 57.9, 0],
  ],
  // Kirchendach und Glockenstube, die Dächer und die Dachrampe stehen frei (die Häuser darunter und die Kirche zeichnet
  // render/mechanics/altstadt.ts), ebenso die Brücke der Langen Gasse über den Kanal.
  decks: [
    [15.8, 18.4],
    [22.6, 32],
    [45.45, 46.2],
  ],
  surfaces: [
    [14, 15.8, 'marble'],
    [15.8, 18.4, 'wood'],
    [22.6, 31.25, 'tiles'],
    [31.25, 32, 'wood'],
    [42.4, 44.2, 'concrete'],
  ],
  glides: [[18.4, 22.6]],
  thermals: [{ at: 20.4, lat: 3, radius: 7 }],
  rings: [
    { at: 19.6, lat: -2, up: 2 },
    { at: 21.6, lat: 2, up: 1.5 },
  ],
  dives: [[35, 43.4]],
  ramps: [
    // Ein Dachsprung auch auf dem Umweg: über die Gasse zwischen zwei Eckhäusern.
    { at: 26.35, length: 4, height: 0.45, gap: 5 },
    // Kopf der Treppengasse: die oberste Stufe wirft ab.
    { at: 32.08, length: 3, height: 0.35 },
  ],
  // Die Straßenbahn: aus der Remise am Kai über die Weiche auf ihr Gleis rechts in der Langen Gasse, Halt hinter der
  // Kanalbrücke, am Ende rechts ab in die Kramergasse (dort steht die Fahrbahn rechts offen).
  tram: {
    from: 44.9,
    to: 48.6,
    lat: 2.4,
    stop: 46.75,
    speed: 8.5,
    accel: 1.4,
    dwell: 5,
    period: 17,
    phase: 3,
    enter: [
      [-50, 170],
      [-60, 170],
      [-70, 169.5],
      [-79, 166.5],
    ],
    leave: [
      [-71, 47],
      [-62, 45.5],
      [-52, 45.5],
      [-44, 46],
    ],
  },
  open: [
    [44.45, 44.95, 1],
    [48.5, 49.1, 1],
  ],
  pads: [
    { at: 17.9, lat: 0, halfWidth: 0 },
    { at: 47.3, lat: -2.6 },
  ],
  boxRows: [0.9, 9.6, 14.6, 23.2, 32.25, 45.3, 50.1],
  branches: [
    // a) Dachsprung-Kette: geradeaus über drei Gassen – schmal, ohne Brüstung, mit Tempo hinüber.
    {
      from: 23.9,
      to: 31.05,
      shortcut: 'risk',
      points: [
        [-132, -22, 26.8],
        [-133, 0, 26],
        [-134, 22, 25.2],
        [-136, 42, 24.4],
      ],
      roadHalf: 4.2,
      shoulder: 0.6,
      surface: 'tiles',
      decks: [[0, 5]],
      open: [[0.9, 4.1, 0]],
      ramps: [
        { at: 1.25, length: 5, height: 0.8, gap: 6 },
        { at: 2.15, length: 5, height: 0.8, gap: 6 },
        { at: 3.05, length: 5, height: 0.8, gap: 6 },
      ],
    },
    // b) Markthalle: mitten hindurch zwischen den Ständen – Stroh und Sägespäne bremsen, ein Zisch nicht.
    {
      from: 50.95,
      to: 57.3,
      shortcut: 'item',
      points: [
        [-22, 22, 10],
        [8, 24, 10],
        [34, 24, 10],
      ],
      roadHalf: 5,
      shoulder: 1,
      surfaces: [[1.05, 2.75, 'straw']],
    },
  ],
};
