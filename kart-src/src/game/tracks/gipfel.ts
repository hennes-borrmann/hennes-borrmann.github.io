// 19 · Gipfelbahn – ein Sommertag in den Bergen, vom Dorf im Tal bis auf den Gletschergipfel und im Gleitflug zurück.
//
// Die Runde hat drei Teile mit eigenem Fahrgefühl:
//   1. Sommerrodelbahn: Vom Dorfplatz in die Talstation; auf zwei Schienen (mechanics.ts: Rail) zieht die Kette das
//      Kart steil den Berg hinauf, oben eine Senke und eine Kuppe, dann die Bremsstrecke an der Bergstation.
//   2. Serpentinen: Die Passstraße windet sich in zwei Haarnadelkurven mit kräftig geneigten Steilkurven den Hang
//      hinauf; Seilbahngondeln pendeln quer über die Straße. Durch einen Tunnel im Gletschereis (glatt) zum Gipfel.
//   3. Gleitflug und Abfahrt: Von der Schanze am Gipfel segelt man hoch über dem Tal (Aufwinde, Schubringe) auf den
//      unteren Hang, dann geht es steil in Kurven durch den Bergwald zurück ins Dorf.
//
// Zwei echte Abkürzungen, jede mit Preis:
//   a) Almwiese: quer durch die Innenseite der ersten Haarnadel, steil bergauf durch hohes Gras – ohne Zisch oder
//      Gleiter langsamer als die Straße, mit einem davon deutlich schneller.
//   b) Skisprungschanze: auf der Abfahrt geradeaus über die Schanze und die Klamm – wer zu langsam abspringt, fällt
//      in die Klamm und wird vor der Schanze neu aufgesetzt.

import type { TrackDef } from '../track';

// Die beiden Schienen der Sommerrodelbahn liegen 2 m links und rechts der Mitte.
const L = -2;
const R = 2;

export const GIPFEL: TrackDef = {
  id: 'gipfel',
  name: 'Gipfelbahn',
  theme: 'gipfel',
  blurb: 'Dorfplatz, mit der Sommerrodelbahn steil hinauf, Serpentinen mit Steilkurven unter der Seilbahn, Tunnel im Gletscher, Gleitflug vom Gipfel übers Tal und die steile Abfahrt durch den Bergwald.',
  twist: 'Drei Fahrarten in einer Runde: auf Schienen hinauf, in Steilkurven über die Passstraße, im Gleitflug hinunter. Abkürzungen über die Almwiese (nur mit Schub) und über die Skisprungschanze (nur mit Tempo).',
  grade: 3,
  scale: 1.45,
  surface: 'asphalt',
  points: [
    // 0–2: Dorfstraße, nach Osten (Start)
    [-100, 110, 2],
    [-60, 112, 2],
    [-20, 110, 2.5],
    // 3–4: Linksbogen nach Norden in die Talstation (ab 3,85 Schienen)
    [14, 98, 3],
    [28, 74, 4],
    // 5–6: die Kette zieht steil hinauf
    [32, 46, 18],
    [34, 18, 33],
    // 7–8: Senke und Kuppe auf den Schienen, Bremsstrecke an der Bergstation
    [36, -6, 26],
    [42, -28, 33],
    // 9–12: Passstraße, erste Haarnadel (links herum, weit – innen liegt die Almwiese)
    [56, -44, 37],
    [92, -46, 41],
    [122, -72, 46],
    [96, -104, 50],
    // 13–16: Hangquerung nach Westen unter der Seilbahn, zweite Haarnadel (rechts herum)
    [50, -104, 55],
    [20, -114, 59],
    [16, -134, 63],
    [46, -142, 67],
    // 17–19: Gletscher – durch den Eistunnel zum Gipfel, Schanze
    [84, -144, 72],
    [110, -158, 78],
    [120, -182, 83],
    // 20–23: Gleitflug in weitem Linksbogen übers Tal
    [100, -194, 81],
    [62, -200, 77],
    [22, -188, 72],
    [-12, -164, 66],
    // 24: Fangrampe auf dem unteren Hang
    [-34, -134, 61.5],
    // 25–32: Abfahrt durch den Bergwald, in weiten Schwüngen rechts und links hinunter
    [-46, -102, 60.5],
    [-14, -78, 52],
    [-26, -44, 43],
    [-62, -26, 36],
    [-104, -6, 27],
    [-120, 14, 20],
    [-108, 46, 12],
    [-122, 76, 6],
    // 33: zurück ins Dorf
    [-116, 102, 2],
  ],
  roadHalf: 6.4,
  shoulder: 2,
  startAt: 0,
  laps: 3,
  bank: 1.3,
  fallDepth: 9,
  landmarkAt: 19,
  // Sommerrodelbahn: schmal, zwei Schienen und ein Laufsteg je Seite
  widths: [
    [3.85, 8.4, 3.6, 0.8],
    // Über dem Tal ist der Flugkorridor breit.
    [19.55, 23.5, 15, 0.5],
  ],
  rails: [
    {
      from: 3.85,
      to: 8.4,
      lanes: [L, R],
      // Die Kette zieht mit 16 m/s; die Bremsstrecke lässt höchstens 24 m/s durch.
      lifts: [[4.05, 6.05, 16]],
      brakes: [[7.95, 8.4, 24]],
    },
  ],
  glides: [[19.55, 23.5]],
  thermals: [
    { at: 21.0, lat: -6, radius: 8 },
    { at: 22.6, lat: 7, radius: 8 },
  ],
  rings: [
    { at: 20.6, lat: 5, up: 3 },
    { at: 21.8, lat: -4, up: 4 },
    { at: 22.95, lat: 1, up: 0 },
  ],
  // Steilkurven: die erste Haarnadel links herum, die zweite rechts herum – gut 33° nach innen geneigt
  banks: [
    [10.0, 12.1, 0.65],
    [13.8, 15.9, -0.65],
    // flach an der Gabelung zur Skisprungschanze (dort liegen beide Fahrbahnen ineinander)
    [24.15, 25.8, 0],
    // … an der Einmündung der Almwiese
    [12.2, 12.95, 0],
    // … und an ihrer Einmündung
    [29.0, 29.95, 0],
  ],
  tunnels: [[17.35, 18.75]],
  surfaces: [
    [3.85, 8.4, 'metal'],
    [17.3, 18.8, 'ice'],
    [18.8, 19.55, 'snow'],
    [24, 33, 'dirt'],
  ],
  // Seilbahngondeln pendeln quer über die Hangquerung und über die Abfahrt
  hazards: [
    { at: 13.5, amp: 4.6, period: 5.2, phase: 0 },
    { at: 28.4, amp: 4.6, period: 4.6, phase: 1.7 },
  ],
  pads: [
    { at: 1.6, lat: 0 },
    { at: 19.25, lat: 0, halfWidth: 0 },
    { at: 24.6, lat: 0 },
  ],
  boxRows: [0.8, 9.2, 16.6, 25.3],
  branches: [
    // a) Almwiese: durch die Innenseite der ersten Haarnadel steil bergauf – hohes Gras bremst, Schub nicht.
    {
      from: 9.3,
      to: 12.7,
      shortcut: 'item',
      points: [
        // (Enden auf der Höhe der Passstraße daneben – der Anstieg liegt in der Mitte)
        [80, -51, 39.6],
        [88, -62, 42],
        [86, -75, 45.5],
        [82, -88, 49],
        [77, -99, 52],
      ],
      roadHalf: 5,
      shoulder: 1.5,
      surface: 'meadow',
    },
    // b) Skisprungschanze: geradeaus über die Klamm statt der Schwünge hinunter – nur mit Tempo.
    {
      from: 24.5,
      to: 29.5,
      shortcut: 'risk',
      points: [
        // Anlauf, dann flach zum Schanzentisch – dahinter die Klamm und ein steiler Aufsprunghang
        [-68, -92, 59.5],
        [-74, -60, 54],
        [-92, -36, 31],
      ],
      roadHalf: 5,
      shoulder: 1.2,
      surface: 'snow',
      ramps: [{ at: 1.8, length: 8, height: 1.6, gap: 12 }],
    },
  ],
};
