// 21 · Talsperre – eine große Bogenstaumauer in einer Gebirgsschlucht, am Abend.
//
// Oben (Norden) liegt der Stausee, unten (Süden) die Schlucht mit dem Fluss; die Mauer steht dazwischen, ihre Luftseite
// senkrecht. Die Form der Landschaft beschreibt render/life/talsperreLand.ts (Mauerbogen, Seeufer, Talboden, Fluss) –
// sie passt zu den Stützpunkten hier. Die Runde hat vier Fahrarten:
//   1. Straße: Start auf der Mauerkrone (See rechts, Abgrund links), am Westufer entlang, zuletzt in zwei Kehren mit
//      kräftig geneigten Steilkurven (31°) den Osthang der Schlucht hinauf zurück zur Krone.
//   2. Tauchen: Über eine Bootsrampe geht es in den Stausee. Die alte Dorfstraße, die beim Aufstauen versank, führt
//      unter Wasser quer durch den See (TrackDef.sea, dives) – am anderen Ufer wieder hinauf an die Luft.
//   3. Schwebeband mit Wandfahrt (wie in der Neonhochbahn, mechanics.ts: Band): Aus dem Stollen durch das östliche
//      Widerlager – er führt unter der Zufahrt zur Krone hindurch, die Strecke kreuzt sich dort selbst – geht es auf ein
//      Schwebeband, das quer über die Luftseite der Mauer führt und sich auf 45 m senkrecht an die Mauer dreht.
//      Gerechnet wird flach, gezeigt gedreht (twistWarp). Kein Looping, kein Hinunterfahren an der Wand.
//   4. Gleitflug: Vom Westhang der Schlucht über den Fluss hinweg auf das Ostufer.
// Gefahr: Im Krafthaus fahren zwei Turbinenläufer am Hallenkran im festen Takt quer über die Straße (hazards).
//
// Zwei echte Abkürzungen, jede mit Preis:
//   a) Überlaufrinne ('risk'): geradeaus über die Wehrkrone der Hochwasserentlastung statt außen um die Sammelrinne –
//      schmal, ohne Bande, und das Wasser, das aus dem See über die Krone strömt, drückt das Kart zur Kante (belts quer).
//      Wer nicht gegenlenkt, fällt in die Rinne.
//   b) Schleuse ('window'): geradeaus durch die Schleusenkammer statt außen um die Felsnase – das Schleusentor an der
//      Einfahrt geht nach Fahrplan auf und zu (alle 16 s für 7 s). Wer es offen trifft, ist deutlich schneller; wer
//      davor wartet, verliert. Die KI rechnet bei der Entscheidung aus, ob es bei ihrer Ankunft offen ist.

import type { TrackDef } from '../track';

export const TALSPERRE: TrackDef = {
  id: 'talsperre',
  name: 'Talsperre',
  theme: 'talsperre',
  blurb: 'Über die Mauerkrone, am Ufer entlang, auf der versunkenen Talstraße durch den Stausee, durch den Stollen, auf dem Schwebeband quer über die Staumauer, im Gleitflug über die Schlucht, an der Schleuse vorbei, durchs Krafthaus und in Kehren hinauf.',
  twist: 'Vier Fahrarten in einer Runde: auf der Straße, unter Wasser, an der senkrechten Mauer, im Gleitflug. Abkürzungen über die Überlaufrinne (schmal, das Wasser drückt zur Kante) und durch die Schleuse (nur wenn das Tor offen ist).',
  grade: 3,
  surface: 'asphalt',
  sea: 57.5,
  points: [
    // 0–3: Mauerkrone nach Westen (Start)
    [36, 1.9, 62],
    [0, 0, 62],
    [-40, 2.4, 62],
    [-76, 8.6, 62],
    // 4–5: Rechtsbogen am westlichen Widerlager, nach Norden ans Ufer
    [-104, 5, 62],
    [-120, -14, 61.5],
    // 6–10: Uferstraße außen um die Überlaufrinne
    [-128, -36, 61],
    [-156, -54, 61],
    [-178, -86, 61],
    [-164, -122, 60.5],
    [-130, -138, 60],
    // 11: Bootsrampe hinunter in den See
    [-92, -141, 59.2],
    // 12–17: die versunkene Talstraße durch den Stausee
    [-56, -141, 51.5],
    [-14, -130, 45.5],
    [30, -112, 43],
    [62, -88, 43.5],
    [82, -62, 48.5],
    [94, -40, 55],
    // 18: wieder an der Luft, am Ostufer
    [102, -26, 58.6],
    // 19–21: Stollen durch das östliche Widerlager, unter der Zufahrt hindurch, im Bogen nach Westen
    [110, -8, 55],
    [114, 14, 50],
    [104, 30, 46.2],
    // 22–27: Schwebeband quer über die Luftseite der Mauer
    [86, 32.1, 43.5],
    [56, 25.2, 43],
    [20, 21.0, 42.5],
    [-18, 20.8, 42.5],
    [-52, 24.5, 42],
    [-80, 30.6, 41.5],
    // 28–29: Linksbogen an der Westwand der Schlucht
    [-100, 46, 41],
    [-108, 70, 40.5],
    // 30–33: Gleitflug über die Schlucht
    [-98, 94, 38.5],
    [-66, 120, 34.5],
    [-26, 142, 30],
    [12, 158, 26.5],
    // 34–39: Landung am Ostufer, durch das Krafthaus, Kehre nach Norden
    [40, 172, 24],
    [68, 184, 22.5],
    [98, 182.5, 21.5],
    [109.5, 177.5, 21],
    [114, 167, 21],
    [110, 157.5, 21],
    // 40–45: Talstraße am Fluss entlang, außen um die Felsnase (die Schleuse schneidet sie ab)
    [100, 153.5, 21],
    [82, 149, 20.5],
    [60, 136, 20.5],
    [56, 114, 21],
    [74, 102, 20.5],
    [96, 94, 20],
    // 46: am Fuß der Ostwand
    [104, 70, 20],
    // 47–49: erste Kehre (rechts herum)
    [112, 56, 21],
    [128, 52, 22.5],
    [140, 64, 25],
    // 50–51: am Osthang hinauf nach Süden
    [147, 92, 31],
    [152, 120, 37],
    // 52–53: zweite Kehre (links herum)
    [164, 138, 40.5],
    [182, 134, 43],
    // 54–58: am oberen Hang nach Norden, über den Stollen hinweg zur Mauerkrone
    [186, 104, 49.5],
    [180, 72, 55],
    [166, 42, 59.5],
    [140, 22, 61.5],
    [110, 13, 62],
  ],
  roadHalf: 6.4,
  shoulder: 1.6,
  startAt: 0,
  laps: 3,
  bank: 1.2,
  fallDepth: 8,
  landmarkAt: 1,
  // Mauerkrone und Schwebeband stehen frei (die Mauer und ihre Halter tragen sie).
  decks: [
    [57.1, 3.75],
    [21.5, 27.6],
  ],
  tunnels: [[18.5, 21.5]],
  dives: [[11.25, 18.3]],
  bands: [
    {
      from: 21.5,
      to: 27.6,
      radius: 10,
      twists: [
        [22.7, 0],
        [23.9, 90],
        [25.1, 90],
        [26.3, 0],
      ],
    },
  ],
  widths: [
    // Mauerkrone: so breit, wie die Mauer oben ist; Schwebeband wie in der Neonhochbahn
    [57.1, 3.75, 5.6, 1.1],
    [21.5, 27.6, 5.6, 0.9],
  ],
  banks: [
    [19.4, 21.4, -0.3],
    [22.0, 27.2, 0],
    // flach an Gabelung und Einmündung der Schleuse (dort liegen beide Fahrbahnen ineinander)
    [36.0, 39.8, 0],
    [44.5, 46.2, 0],
    [46.7, 49.3, -0.6],
    [51.4, 53.4, 0.6],
  ],
  surfaces: [
    [57.1, 3.75, 'concrete'],
    [11.3, 18.3, 'cobble'],
    [18.5, 21.5, 'concrete'],
    [21.5, 27.6, 'band'],
    [34.2, 35.6, 'panel'],
  ],
  glides: [[29.7, 33.3]],
  thermals: [{ at: 31.2, lat: 3, radius: 7 }],
  rings: [
    { at: 30.6, lat: -2, up: 2 },
    { at: 32.2, lat: 2, up: 2 },
  ],
  hazards: [
    { at: 34.6, amp: 4.4, period: 4.6, phase: 0 },
    { at: 35.2, amp: 4.4, period: 4.6, phase: -1.1 },
  ],
  pads: [
    { at: 1.5, lat: 0 },
    { at: 29.4, lat: 0, halfWidth: 0 },
    { at: 50.5, lat: 0 },
  ],
  boxRows: [0.6, 13.5, 35.0, 54.5],
  branches: [
    // a) Überlaufrinne: geradeaus über die Wehrkrone – schmal, ohne Bande, das Wasser drückt zur Kante.
    {
      from: 5.5,
      to: 11.25,
      shortcut: 'risk',
      points: [
        [-130, -52, 58.6],
        [-129, -80, 58.1],
        [-124, -104, 58.4],
        [-112, -125, 59],
      ],
      roadHalf: 3.2,
      shoulder: 0.4,
      surface: 'concrete',
      open: [[1, 3.4, 0]],
      decks: [[0.6, 3.6]],
      belts: [{ from: 1, to: 3.3, lat0: -3.6, lat1: 3.6, across: -2.6 }],
    },
    // b) Schleuse: geradeaus durch die Schleusenkammer – nur, solange das Tor offen ist.
    {
      from: 38.0,
      to: 45.6,
      shortcut: 'window',
      points: [
        [112, 140, 18.4],
        [108, 116, 18.3],
      ],
      roadHalf: 4.6,
      shoulder: 0.6,
      surface: 'concrete',
      decks: [[0.8, 2.5]],
      gates: [{ every: 16, closes: 0, opens: 9 }],
    },
  ],
};
