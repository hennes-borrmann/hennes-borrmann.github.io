// 23 · Baumkronenpfad – ein Laubwald mit riesigen Bäumen, am goldenen Herbstnachmittag.
//
// Die Riesen, an denen die Strecke hängt, und der Waldteich stehen in render/life/baumLand.ts (passend zu den Stützpunkten
// hier). Die Runde hat vier Fahrarten:
//   1. Holzrampe und Waldweg: Vom Teich über den Waldweg zum Riesenstamm; um ihn schraubt sich eine Holzrampe in
//      eindreiviertel Windungen 40 m hinauf – eine echte Steilkurve, nach innen bis 40° geneigt (kein Kopfüber). Oben führen
//      Stege um die Kronen; hinter dem hohlen Baumriesen ein Bohlensteg zur Felsstufe.
//   2. Hängebrücken (Pontons-Mechanik als schwingende Saite, mechanics.ts: Pontoon.arch/sway): an beiden Enden fest,
//      dazwischen heben sie sich und pendeln quer, jede in ihrem eigenen Takt; wer auf ihnen fährt, pendelt mit. Die erste
//      spannt sich hoch über den eigenen Waldweg – die Strecke kreuzt sich dort selbst.
//   3. Gleitflug: von der Krone C in einem weiten Rechtsbogen hinunter (Aufwind, Schubringe).
//   4. Tauchen: neben dem Wasserfall die Felsstufe hinab in den Waldteich und auf seinem Grund hindurch (TrackDef.sea, dives).
// Gefahr: Auf dem Waldweg zurück fallen im Takt Tannenzapfen von den Ästen (PULSE_ICICLE) – mit Vorwarnung: Der Zapfen
// wackelt, sein Schatten wächst bis zur Größe der Gefahr.
//
// Zwei echte Abkürzungen, beide mit Risiko:
//   a) Ast ohne Geländer: geradeaus über den Arm der alten Eiche statt über die beiden Hängebrücken um die Krone C2 –
//      schmal, ohne Bande, in gut 40 m Höhe. Wer abrutscht, fällt.
//   b) Hohler Baumriese: geradeaus durch das Astloch in den hohlen Stamm statt in großer Kehre außen herum; drinnen fehlt
//      hinter einer Kante der Boden (eine Öffnung, ramps mit gap) – mit Tempo fliegt man hinüber und landet gut zehn
//      Meter tiefer auf der Rutsche, die zum Wurzeltor hinausführt; wer zu langsam über die Kante rollt, fällt in den
//      Wurzelkeller und wird mit Anlauf davor neu aufgesetzt.

import type { TrackDef } from '../track';

export const BAUM: TrackDef = {
  id: 'baum',
  name: 'Baumkronenpfad',
  theme: 'baum',
  blurb: 'Vom Waldteich die Holzrampe in Steilkurven um den Riesenstamm hinauf, über schwankende Hängebrücken von Krone zu Krone, im Gleitflug hinunter, am hohlen Baumriesen vorbei, den Wasserfall hinab und durch den Teich.',
  twist: 'Hängebrücken schwingen und pendeln im Takt, oben fliegt man, unten taucht man. Abkürzungen über einen Ast ohne Geländer und mitten durch den hohlen Baumriesen – mit Tempo hinein, sonst fällt man in den Wurzelkeller.',
  grade: 3,
  surface: 'dirt',
  sea: 0,
  points: [
    // 0–4: Waldweg nach Westen (Start), unter der ersten Hängebrücke hindurch zum Riesenstamm
    [95, -24, 1.8],
    [71.3, -24, 1.9],
    [47.5, -24, 1.9],
    [23.8, -24, 1.9],
    [0, -24, 2],
    // 5–25: die Holzrampe um den Riesenstamm (Mitte 0/0, Halbmesser 24 m), links herum eindreiviertel Windungen hinauf
    [-12, -20.8, 3.9],
    [-20.8, -12, 5.8],
    [-24, 0, 7.7],
    [-20.8, 12, 9.6],
    [-12, 20.8, 11.5],
    [0, 24, 13.4],
    [12, 20.8, 15.3],
    [20.8, 12, 17.2],
    [24, 0, 19.1],
    [20.8, -12, 21],
    [12, -20.8, 23],
    [0, -24, 24.9],
    [-12, -20.8, 26.8],
    [-20.8, -12, 28.7],
    [-24, 0, 30.6],
    [-20.8, 12, 32.5],
    [-12, 20.8, 34.4],
    [0, 24, 36.3],
    [12, 20.8, 38.2],
    [20.8, 12, 40.1],
    [24, 0, 42],
    // 26–29: Ausstieg nach Norden und die erste Hängebrücke, hoch über dem Waldweg
    [24, -8, 42],
    [24, -27.3, 40.8],
    [24, -46.7, 40.8],
    [24, -66, 42],
    // 30–34: Steg um die Krone der Buche (B), nach Osten
    [26, -73.5, 42],
    [31.5, -79, 42],
    [39, -81, 42],
    [54, -81, 42.5],
    [69, -81, 43],
    // 35–46: Umweg über die zweite und dritte Hängebrücke um die Krone C2 (der Ast ohne Geländer schneidet ihn ab)
    [77.4, -83.4, 43],
    [83.3, -89.7, 43],
    [95.1, -112.9, 42],
    [106.9, -136.1, 43],
    [111.7, -141.3, 43],
    [118.4, -143.2, 43],
    [125.2, -141.3, 43],
    [130, -136.1, 43],
    [141.8, -112.9, 42],
    [153.6, -89.7, 43],
    [159.5, -83.4, 43],
    [167.9, -81, 43],
    // 47: Absprung an der Krone C
    [187.9, -81, 43],
    // 48–54: Gleitflug in weitem Rechtsbogen hinunter
    [202.9, -81, 41.5],
    [224.9, -75.1, 39.8],
    [241, -59, 38],
    [246.9, -37, 36.3],
    [241, -15, 34.5],
    [224.9, 1.1, 32.8],
    [202.9, 7, 31],
    // 55–57: Landesteg, geradeaus auf den hohlen Baumriesen zu
    [192.9, 7, 29],
    [176.9, 7, 28.7],
    [160.9, 7, 28.4],
    // 58–71: große Kehre außen um den hohlen Baumriesen (die zweite Abkürzung führt mitten hindurch)
    [154.9, 8.6, 28.4],
    [150.5, 13, 28.3],
    [148.9, 19, 28.3],
    [148.9, 31, 26.6],
    [144.9, 46, 25.3],
    [133.9, 57, 24.1],
    [118.9, 61, 22.8],
    [103.9, 57, 21.5],
    [92.9, 46, 20.3],
    [88.9, 31, 19],
    [88.9, 19, 17.3],
    [87.3, 13, 17.2],
    [82.9, 8.6, 17.1],
    [76.9, 7, 17],
    // 72–79: Bohlensteg nach Süden zur Felsstufe
    [67.9, 7, 16.6],
    [58.9, 7, 16.3],
    [48.9, 9.7, 15.5],
    [41.6, 17, 14.8],
    [38.9, 27, 14],
    [38.9, 62, 12.5],
    [32.9, 84.5, 12.5],
    [26.8, 107, 10.5],
    // 80–82: neben dem Wasserfall die Felsstufe hinab zum Teich
    [26.8, 115.7, 7],
    [26.8, 124.3, 3.5],
    [26.8, 133, 0],
    // 83–87: durch den Waldteich (unter Wasser), dann ans Ufer
    [32.2, 153, -1.8],
    [46.8, 167.6, -3.7],
    [66.8, 173, -5.5],
    [86.8, 173, -5.3],
    [106.8, 173, -5],
    // 88–100: Waldweg zurück: am Ufer, nach Norden unter den Tannen (Zapfen), unter dem Landesteg hindurch, nach Westen
    [129.8, 173, 1.5],
    [159.8, 165, 1.8],
    [181.8, 143, 2.2],
    [189.8, 113, 2.5],
    [189.8, 86.3, 2.5],
    [189.8, 59.5, 2.5],
    [189.8, 32.8, 2.5],
    [189.8, 6, 2.5],
    [185.8, -9, 2.3],
    [174.8, -20, 2.2],
    [159.8, -24, 2],
    [139.8, -24, 2],
    [119.8, -24, 2],
  ],
  roadHalf: 5.6,
  shoulder: 1.0,
  startAt: 0,
  laps: 3,
  bank: 1.0,
  fallDepth: 8,
  landmarkAt: 16,
  // Rampe, Stege, Brücken und der Bohlensteg zur Felsstufe stehen frei (Stämme, Kragarme und Holzböcke tragen sie:
  // render/mechanics/canopy.ts).
  decks: [[4.5, 82.3]],
  // Stege und Rampe 5,6 m (Grundmaß), der Waldweg breiter, die Hängebrücken schmaler, über dem Tal ein breiter Flugkorridor.
  widths: [
    [82.4, 4.6, 6.4, 1.6],
    [26, 29, 4.6, 0.6],
    [36, 38, 4.6, 0.6],
    [42, 44, 4.6, 0.6],
    [47.35, 54.7, 14, 0.5],
  ],
  banks: [
    // die Rampe um den Riesenstamm: 40° nach innen (unten, wo sie vom Waldboden abhebt, noch flach)
    [7, 23.6, 0.84],
    // Hängebrücken liegen flach; die Stege um die Kronen leicht geneigt
    [26, 29.2, 0],
    [29.6, 32.2, -0.3],
    // (flach an Gabelung und Einmündung: dort liegen beide Fahrbahnen ineinander)
    [33.4, 35.2, 0],
    [36, 38.2, 0],
    [38.6, 41.6, -0.3],
    [42, 44.2, 0],
    [45.6, 47.2, 0],
    [55.6, 60.6, 0],
    // die große Kehre um den hohlen Baumriesen: gut 30° nach innen
    [61.6, 66.8, -0.62],
    [68.4, 73.6, 0],
  ],
  surfaces: [
    [4.5, 82, 'wood'],
    [82.3, 87.6, 'gravel'],
    [87.6, 88.8, 'sand'],
  ],
  // Hängebrücken: heben sich in der Mitte um amp und pendeln quer um sway (Meter), jede in ihrem eigenen Takt.
  pontoons: [
    { from: 26, to: 29, amp: 0.45, period: 3.2, phase: 0, arch: true, sway: 0.7, swayPeriod: 5.6 },
    { from: 36, to: 38, amp: 0.4, period: 2.9, phase: 1.1, arch: true, sway: 0.6, swayPeriod: 5.0 },
    { from: 42, to: 44, amp: 0.4, period: 3.1, phase: 2.3, arch: true, sway: 0.6, swayPeriod: 5.3 },
  ],
  glides: [[47.35, 54.7]],
  thermals: [{ at: 51.5, lat: -4, radius: 7 }],
  rings: [
    { at: 49.6, lat: 3, up: 2 },
    { at: 53.2, lat: -2, up: 2 },
  ],
  dives: [[82.1, 87.8]],
  // Tannenzapfen über dem Waldweg zurück: fallen im Takt (mit Vorwarnung), versetzt, nie alle zugleich.
  icicles: [
    { at: 92.5, lat: -2.6, period: 4.2, phase: 0 },
    { at: 93.2, lat: 2.6, period: 4.2, phase: 2.1 },
    { at: 94.0, lat: -0.8, period: 3.8, phase: 1.0 },
  ],
  pads: [
    { at: 0.8, lat: 0 },
    { at: 46.7, lat: 0, halfWidth: 0 },
    { at: 74.2, lat: 0 },
    { at: 91.5, lat: 0 },
  ],
  boxRows: [1.6, 25.5, 33.2, 56, 76.5, 96],
  branches: [
    // a) Ast ohne Geländer: der Arm der alten Eiche, geradeaus statt über die Brücken um C2 – schmal, ohne Bande, hoch.
    {
      from: 33.3,
      to: 46.5,
      shortcut: 'risk',
      points: [
        [92, -81.2, 43.1],
        [108, -81.9, 43.4],
        [126, -82.1, 43.5],
        [144, -81.7, 43.3],
        [160, -81.1, 43],
      ],
      roadHalf: 2.8,
      shoulder: 0.4,
      surface: 'bark',
      open: [[1, 5.6, 0]],
      decks: [[0, 7]],
    },
    // b) Hohler Baumriese: durch das Astloch hinein, hinter der Kante fehlt der Boden – mit Tempo hinüber und auf die
    //    Rutsche gut zehn Meter tiefer, zu langsam in den Wurzelkeller.
    {
      from: 56.4,
      to: 72,
      shortcut: 'risk',
      points: [
        [146, 7, 28.6],
        [135.5, 7, 28.6],
        [129.5, 7, 28.6],
        [121.5, 7, 26.6],
        [115, 7, 22.8],
        [109, 7, 19.2],
        [104, 7, 17.6],
        [92, 7, 16.9],
      ],
      roadHalf: 4.2,
      shoulder: 0.6,
      surface: 'wood',
      decks: [[0, 10]],
      // die Kante (eine flache Lippe) und dahinter acht Meter ohne Boden
      ramps: [{ at: 2.5, length: 3, height: 0.5, gap: 8 }],
    },
  ],
};
