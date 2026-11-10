// 5 · Wolkenwerft – eine Werft für Luftschiffe hoch über den Wolken. Die
// Fahrbahn liegt auf Hellingen, Gerüsten und Pontons; dazwischen ist Luft.
// Dreimal hebt das Kart ab und gleitet: von der Wendelrampe hinüber zum
// Ballonhafen, als Abkürzung vom Katapult quer über die Bucht zum Hangar (wer
// lieber fährt, nimmt den Laufsteg außen herum) und zum Schluss vom Dach des
// Hangars in einem weiten Bogen zurück zur Helling. Aufwinde heben, Ringe
// geben Schub. Die Höhen über den Flugstrecken sind die Ideallinie des Flugs:
// rund neun Meter Sinken auf hundert Meter.

import type { TrackDef } from '../track';

export const WOLKEN: TrackDef = {
  id: 'wolken',
  name: 'Wolkenwerft',
  theme: 'klippe',
  blurb: 'Luftschiffwerft über den Wolken: Wendelrampe, Ballonhafen, Hangar – und dazwischen nur Luft.',
  twist: 'Fliegen: über den Lücken gleitet das Kart. Aufwinde heben, Ringe geben Schub.',
  grade: 2,
  surface: 'wood',
  scale: 1.2,
  points: [
    // 0–3: Helling (Start) nach Osten, leicht bergab
    [-100, -150, 33],
    [-50, -150, 32],
    [0, -150, 31.5],
    [40, -145, 32.5],
    // 4–7: Wendelrampe, links herum hinauf
    [80, -125, 35],
    [105, -90, 38.5],
    [110, -50, 42],
    [105, -15, 44.5],
    // 8: Absprung – 9–11 Flug nach Norden zum Ballonhafen
    [100, 10, 46],
    [96, 60, 41.5],
    [92, 110, 36.5],
    [88, 160, 31.5],
    // 12: Fangrampe – wer tief ankommt, landet hier unten und fährt hinauf. 13–16: Ballonhafen, weite Linkskurve
    [85, 190, 27.5],
    [76, 222, 31],
    [52, 248, 32],
    [18, 260, 33],
    [-20, 260, 34],
    // 17: Gabelung – 18–21 der Laufsteg außen herum …
    [-60, 252, 35],
    [-102, 236, 35.5],
    [-142, 210, 36],
    [-166, 174, 36.5],
    [-176, 134, 37],
    // 22: Einmündung, 23–25 durch den Hangar hinauf aufs Dach
    [-172, 94, 37.5],
    [-162, 55, 40],
    [-168, 16, 43.5],
    [-180, -18, 46.5],
    // 26: Absprung vom Hangardach – 27–28 Flug im Bogen zurück zur Helling
    [-180, -48, 47.5],
    [-176, -95, 43],
    [-158, -134, 39],
    // 29: Landung auf der Helling
    [-130, -150, 33.5],
  ],
  roadHalf: 6.6,
  shoulder: 1.6,
  startAt: 0,
  laps: 3,
  bank: 1.6,
  fallDepth: 9,
  decks: [[0, 29.99]],
  glides: [
    [8.05, 11.75],
    [26.05, 28.7],
  ],
  // Über den Flugstrecken ist der Korridor breit.
  widths: [
    [8.05, 11.75, 15, 0.5],
    [26.05, 28.7, 15, 0.5],
  ],
  banks: [[4.2, 6.8, 0.3]],
  thermals: [
    { at: 9.3, lat: -7, radius: 8 },
    { at: 10.6, lat: 6, radius: 8 },
    { at: 27.0, lat: -8, radius: 8 },
  ],
  rings: [
    { at: 9.9, lat: -6, up: 4 },
    { at: 11.1, lat: 5, up: 4 },
    { at: 27.7, lat: -6, up: 3 },
    { at: 10.2, lat: 0, up: 0 },
  ],
  surfaces: [
    [12, 16.5, 'metal'],
    [22.5, 25.9, 'metal'],
  ],
  pads: [
    { at: 1.2, lat: 0 },
    { at: 7.5, lat: 0, halfWidth: 0 },
    { at: 15.5, lat: 0 },
    { at: 25.6, lat: 0, halfWidth: 0 },
  ],
  boxRows: [2.6, 13.4, 20, 23.4],
  bumps: [{ at: 19.2, length: 16, height: 1.1 }],
  tunnels: [[23.1, 24.9]],
  branches: [
    // a: Katapult und Flug quer über die Bucht – kürzer, aber wer den Aufwind verpasst, landet tief auf der Fangrampe
    {
      from: 17.2,
      to: 22.3,
      points: [
        [-94, 225, 37.2],
        [-113, 200, 41.5],
        [-126, 177, 38.5],
        [-141, 151, 35.5],
        [-158, 122, 31.5],
      ],
      roadHalf: 6,
      shoulder: 1.2,
      surface: 'metal',
      glides: [[2.05, 4.4]],
      widths: [[2.05, 4.4, 13, 0.5]],
      thermals: [{ at: 3.0, lat: 5, radius: 8 }],
      rings: [{ at: 3.7, lat: 4, up: 3.5 }],
      pads: [{ at: 1.2, lat: 0, halfWidth: 0 }],
    },
  ],
};
