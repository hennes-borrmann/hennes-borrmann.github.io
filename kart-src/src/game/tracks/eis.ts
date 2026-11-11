// 7 · Eiszapfen-Pass – von der Passhütte im Tal über Serpentinen im Schnee
// hinauf, unter einem Lawinenstrich hindurch auf den Grat, dann durch die
// Eishöhle mit ihren fallenden Zapfen (oder außen herum über den zugefrorenen
// See) und in der Bobbahn aus blankem Eis wieder hinunter, noch einmal unter
// einer Lawine durch, mit einem Sprung über die Schlucht zurück ins Tal.
//
// Auf Eis dreht die Nase, aber das Kart rutscht weiter (surface.ts: turn und
// grip): man lenkt früh, fährt mit dem Heck voraus und bremst kaum.

import type { TrackDef } from '../track';

export const EIS: TrackDef = {
  id: 'eis',
  name: 'Eiszapfen-Pass',
  theme: 'eis',
  blurb: 'Serpentinen im Schnee, Grat ohne Geländer, Eishöhle oder zugefrorener See, Bobbahn ins Tal.',
  twist: 'Rutschen: auf Eis dreht die Nase, das Kart gleitet weiter. Lawinen gehen im Takt nieder – durchstarten oder warten.',
  grade: 3,
  surface: 'snow',
  scale: 1.12,
  points: [
    // 0–2: Start an der Passhütte nach Osten
    [-140, -160, 0],
    [-95, -160, 0],
    [-50, -160, 0.3],
    // 3–13: Serpentinen im Schnee hinauf
    [-8, -156, 1.5],
    [30, -140, 4],
    [58, -112, 7],
    [66, -76, 10],
    [48, -46, 12.5],
    [20, -30, 14.5],
    [-2, -4, 16.5],
    [10, 28, 18.5],
    [40, 46, 20.5],
    [78, 54, 22.5],
    [116, 68, 24.5],
    // 14–16: Grat ohne Geländer
    [146, 96, 26],
    [158, 132, 26.5],
    [156, 168, 26.2],
    // 15.7: Gabelung (auf dem geraden Stück vor der Kurve). 17–20 durch die Eishöhle
    [136, 190, 25.6],
    [98, 196, 25],
    [58, 190, 24.6],
    [20, 184, 24.2],
    // 20.5: Einmündung. 21–27 die Bobbahn hinunter
    [-18, 168, 23],
    [-44, 138, 20],
    [-40, 98, 16.5],
    [-58, 64, 13],
    [-92, 46, 10],
    [-128, 56, 7.2],
    [-158, 36, 4.8],
    // 28–32: Schlucht und Talboden zurück zur Hütte
    [-174, 2, 2.8],
    [-178, -36, 1.4],
    [-176, -74, 0.6],
    [-172, -112, 0.2],
    [-164, -144, 0],
  ],
  roadHalf: 6.4,
  shoulder: 2.6,
  startAt: 0,
  laps: 3,
  bank: 1.5,
  fallDepth: 5,
  surfaces: [
    [17.0, 20.3, 'ice'],
    [21.1, 27.3, 'ice'],
  ],
  // Bobbahn: eng, mit Wänden; Grat: schmal und offen
  widths: [
    [14.2, 15.5, 5.4, 0.6],
    [21.3, 27.2, 4.8, 0.8],
  ],
  open: [[14.4, 15.4, 0]],
  tunnels: [[17.3, 19.9]],
  avalanches: [
    { at: 11.5, lat: 6, period: 10, phase: 3 },
    { at: 25.5, lat: -6, period: 9, phase: 6.5 },
  ],
  icicles: [
    { at: 17.55, lat: -2.4, period: 3.4, phase: 0 },
    { at: 18.1, lat: 2.4, period: 3.4, phase: 1.1 },
    { at: 18.65, lat: -2.2, period: 3.4, phase: 2.2 },
    { at: 19.2, lat: 2.2, period: 3.4, phase: 0.6 },
    { at: 19.6, lat: 0, period: 3.4, phase: 1.7 },
  ],
  pads: [
    { at: 1.2, lat: 0 },
    { at: 13.2, lat: 0 },
    { at: 20.9, lat: 0 },
    { at: 30.2, lat: 0 },
  ],
  boxRows: [2.3, 8.5, 14.9, 23.6, 29.4],
  ramps: [{ at: 28.2, length: 9, height: 1.4, gap: 8 }],
  branches: [
    // a: außen herum über den zugefrorenen See – länger, aber breit und frei von Zapfen
    {
      from: 15.7,
      to: 20.5,
      points: [
        [162, 186, 26.2],
        [150, 214, 25.8],
        [112, 229, 25.4],
        [66, 229, 25],
        [26, 212, 24.6],
      ],
      roadHalf: 6.4,
      shoulder: 2.6,
      // Auf dem See öffnet sich die Bahn weit; an Gabelung und Einmündung ist sie so breit wie die Hauptstrecke.
      widths: [[1.3, 4.3, 10, 2]],
      surface: 'ice',
      boxRows: [2.9],
      // Schubbahn über den See: der Weg ist länger – wer auf dem blanken Eis die Linie hält, holt das fast auf.
      // (Streifen über die ganze Breite: auf dem Eis hält niemand die Mitte.)
      pads: [
        { at: 0.9, lat: 0, halfWidth: 0 },
        { at: 1.65, lat: 0, halfWidth: 0 },
        { at: 2.4, lat: 0, halfWidth: 0 },
        { at: 3.15, lat: 0, halfWidth: 0 },
        { at: 3.9, lat: 0, halfWidth: 0 },
        { at: 4.6, lat: 0, halfWidth: 0 },
      ],
    },
  ],
};
