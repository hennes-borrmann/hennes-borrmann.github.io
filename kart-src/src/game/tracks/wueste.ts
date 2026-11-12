// 15 · Wüstenexpress – die Strecke folgt einer Bahnlinie durch die Wüste, und der Express fährt mit.
//
// Die Runde ist ein großer Rechtsbogen; auf der rechten Spur – innen – liegt das Gleis. Darauf fahren vier Züge im Kreis – langsamer als ein Kart, aber sie halten
// nie an (mechanics.ts: VEH_TRAIN). Von der Seite ist ein Zug eine fahrende Wand. Von hinten aber endet er in
// einem Rampenwagen: Wer auf dem Gleis auffährt, rollt die Rampe hinauf, fährt über die Dächer der Flachwagen –
// und der Zug nimmt mit, was auf ihm steht –, über den Keilwagen auf die Lok und springt vorn von ihr ab.

import { VEH_TRAIN } from '../mechanics';
import type { TrackDef } from '../track';

export const WUESTE: TrackDef = {
  id: 'wueste',
  name: 'Wüstenexpress',
  theme: 'wueste',
  blurb: 'Bahnhof der Wüstenstadt, Canyon hinauf, Holzviadukt über die Schlucht, Hochebene, Tunnel durch den Tafelberg, zurück zum Bahnhof – immer am Gleis entlang.',
  twist: 'Rechts, auf der Innenspur, fährt der Zug mit. Von der Seite ist er eine Wand – von hinten kommt man über die Rampe aufs Dach: Der Zug nimmt einen mit, und vorn springt man von der Lok.',
  grade: 2,
  scale: 1.85,
  surface: 'dirt',
  // Vier Züge, gleichmäßig über die Runde verteilt (Lage der Lok bei „Los“ in Metern hinter der Startlinie).
  traffic: {
    lanes: [
      {
        // Das Gleis liegt unmittelbar an der rechten Bande (in den Kurven innen – der Zug besetzt die Ideallinie):
        // Zwischen Zug und Bande passt kein Kart (dort säße es fest).
        lat: 6.7,
        speed: 14,
        cars: [
          [VEH_TRAIN, 190],
          [VEH_TRAIN, 556],
          [VEH_TRAIN, 922],
          [VEH_TRAIN, 1288],
        ],
      },
    ],
  },
  points: [
    // 0–2: Bahnhof der Wüstenstadt, nach Osten (Start)
    [-90, -120, 6],
    [-30, -126, 6],
    [30, -122, 6],
    // 3–6: der Canyon hinauf, in weitem Rechtsbogen
    [84, -98, 6.5],
    [118, -52, 8],
    [124, 4, 10],
    [104, 56, 12],
    // 7–9: Holzviadukt über die Schlucht
    [62, 92, 12.5],
    [8, 104, 12],
    [-46, 96, 11],
    // 10–11: Hochebene, hinab
    [-92, 70, 9],
    [-118, 26, 7],
    // 12: Tunnel durch den Tafelberg
    [-112, -26, 6],
    // 13–14: zurück zum Bahnhof
    [-126, -74, 6],
    [-116, -108, 6],
  ],
  roadHalf: 7.0,
  shoulder: 1.6,
  startAt: 0,
  laps: 3,
  bank: 0.8,
  fallDepth: 6,
  landmarkAt: 8,
  surfaces: [
    [7.55, 9.45, 'wood'],
    [14.4, 1.6, 'cobble'],
  ],
  decks: [[7.6, 9.4]],
  tunnels: [[11.55, 12.45]],
  // (links vom Gleis)
  pads: [
    { at: 2.5, lat: -2.6, halfWidth: 2.6 },
    { at: 6.4, lat: -2.6, halfWidth: 2.6 },
    { at: 10.4, lat: -2.6, halfWidth: 2.6 },
    { at: 13.4, lat: -2.6, halfWidth: 2.6 },
  ],
  boxRows: [1.5, 4.5, 8.5, 11.2],
  // Kisten nur links und in der Mitte: Rechts fährt der Zug (ab 4,8 m neben der Mitte).
  boxLat: [-0.72, -0.36, 0, 0.36],
};
