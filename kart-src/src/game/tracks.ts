// Die Strecken des Spiels als reine Beschreibungen (siehe TrackDef in track.ts).
// Alle Angaben "at/von/bis" sind Stützpunkt-Einheiten: 12.5 = halb zwischen
// Stützpunkt 12 und 13.

import type { TrackDef } from './track';

/** Gleichmäßig verteilte Punkte auf einem Kreisbogen (Winkel in Grad, 0° = +x, 90° = +z). */
function arc(cx: number, cz: number, r: number, from: number, to: number, count: number, y0: number, y1: number): number[][] {
  const out: number[][] = [];
  for (let i = 0; i < count; i++) {
    const k = count === 1 ? 0 : i / (count - 1);
    const a = ((from + (to - from) * k) * Math.PI) / 180;
    out.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r, y0 + (y1 - y0) * k]);
  }
  return out;
}

// ---------------------------------------------------------------------------
// 1 · Werkshof – Einsteigerstrecke. Breite Fahrbahn, überall Bande, sanfte
// Höhen, eine kleine Laderampe zum Springen.

const WERKSHOF: TrackDef = {
  id: 'werkshof',
  name: 'Werkshof',
  theme: 'werkshof',
  blurb: 'Breit, übersichtlich, mit Laderampe – zum Warmfahren.',
  grade: 1,
  uniform: true,
  points: [
    // Startgerade nach Norden
    [-100, -50, 0],
    [-100, -20, 0],
    [-100, 10, 0],
    [-100, 30, 0],
    // Kurve 1: schnelle, weite Kurve hinauf auf die Laderampe
    [-93, 56, 0.5],
    [-70, 71, 2],
    [-42, 73, 3],
    [-18, 72, 3],
    // Kurve 2: hinunter zur Kehre
    [-4, 69, 2.5],
    [6, 60, 1.5],
    [10, 46, 0.5],
    // Kurve 3: Kehre in die Gegenrichtung (Radius 18 m, Punkte gleichmäßig auf dem Bogen)
    [10, 34, 0],
    [13.4, 23.4, 0],
    [22.4, 16.9, 0],
    [33.6, 16.9, 0],
    [42.6, 23.4, 0],
    [46, 34, 0],
    [46, 46, 0],
    // Kurve 4: auf die Gegengerade
    [49, 58, 0],
    [58, 68, 0.5],
    [72, 72, 1.5],
    [90, 72, 3],
    // Kurve 5: lange Kurve am Ostende, über den Verladehügel
    [104, 62, 4],
    [112, 42, 4.5],
    [108, 20, 4],
    [102, 0, 3],
    [100, -22, 2],
    // Kurve 6: auf die Rückfahrt
    [94, -40, 1.2],
    [76, -49, 0.6],
    [52, -49, 0.2],
    // Schikane
    [32, -40, 0],
    [10, -32, 0],
    [-10, -40, 0],
    [-34, -52, 0],
    // Kurve 7: zurück auf die Startgerade
    [-58, -66, 0],
    [-78, -72, 0],
    [-94, -65, 0],
  ],
  roadHalf: 6.5,
  shoulder: 3,
  startAt: 0,
  laps: 3,
  pads: [
    { at: 1.33, lat: 0 },
    { at: 24.15, lat: -2.5 },
    { at: 33, lat: 2.5 },
  ],
  boxRows: [6.1, 20.1, 29.6],
  ramps: [{ at: 28.3, length: 8, height: 1.0 }],
  hazards: [{ at: 31.6, amp: 4.2, period: 5.5, phase: 0 }],
};

// ---------------------------------------------------------------------------
// 2 · Möwenklippe – vom Strand über einen Holzsteg ohne Geländer, in Serpentinen
// die Klippe hinauf, oben über Kuppen und dann steil hinunter mit Sprung über
// eine Bucht.

const KLIPPE: TrackDef = {
  id: 'klippe',
  name: 'Möwenklippe',
  theme: 'klippe',
  blurb: 'Holzsteg ohne Geländer, Serpentinen, Sprung über die Bucht.',
  grade: 2,
  points: [
    // 0–4: Strandpromenade nach Osten
    [-90, -80, 0],
    [-55, -80, 0],
    [-20, -80, 0],
    [15, -80, 0],
    [45, -82, 0],
    // 5–7: hinaus auf den Steg
    [66, -91, 0.5],
    [77, -110, 1.2],
    [78, -132, 1.2],
    // 8–12: Wende am Stegkopf
    ...arc(95, -134, 17, 210, 330, 5, 1.2, 1.2),
    // 13–16: zurück an Land
    [112, -132, 1.2],
    [112, -110, 1.2],
    [114, -90, 1.6],
    [120, -70, 3],
    // 17–22: Serpentine die Klippe hinauf
    [130, -48, 6],
    [133, -24, 9],
    [125, -2, 11.5],
    [113, 17, 13.5],
    [109, 38, 15],
    [101, 56, 16],
    // 23–29: Hochfläche nach Westen
    [83, 66, 16.5],
    [58, 68, 16],
    [30, 62, 17],
    [4, 58, 15.6],
    [-22, 64, 16.6],
    [-48, 72, 15.8],
    [-74, 72, 16],
    // 30–32: am Leuchtturm vorbei
    [-98, 64, 16],
    [-112, 46, 15.4],
    [-116, 24, 13.6],
    // 33–37: steil hinunter, Sprung über die Bucht, zurück zum Strand
    [-114, 2, 10.2],
    [-110, -18, 6.4],
    [-108, -40, 2.6],
    [-106, -58, 0.8],
    [-101, -72, 0.2],
  ],
  roadHalf: 6.2,
  shoulder: 2.6,
  startAt: 0,
  laps: 3,
  bank: 1.4,
  fallDepth: 4.2,
  pads: [
    { at: 2.2, lat: 0 },
    { at: 16.4, lat: 0 },
    { at: 33.1, lat: 0, halfWidth: 0 },
  ],
  boxRows: [3.6, 14.3, 24.4, 31.6],
  bumps: [
    { at: 25.2, length: 15, height: 1.3 },
    { at: 27.3, length: 15, height: 1.3 },
  ],
  ramps: [{ at: 33.75, length: 9, height: 1.3, gap: 9 }],
  // Steg: schmaler, links und rechts offen; an der Wende steht außen ein Geländer.
  widths: [[5.6, 15.2, 5.2, 0.9]],
  open: [
    [5.9, 7.6, 0],
    [7.6, 13.2, -1],
    [13.2, 14.9, 0],
  ],
  decks: [[5.5, 15.4]],
  hazards: [{ at: 28.6, amp: 3.6, period: 4.6, phase: 1.2 }],
};

// ---------------------------------------------------------------------------
// 3 · Glutkessel – eine Acht um einen Vulkan: unten durch das Tal, in einer
// überhöhten Kurve den Krater hinauf, über einen schmalen Grat, Sprung über den
// Lavastrom und auf einer Felsbrücke über die eigene Strecke zurück.

const GLUT: TrackDef = {
  id: 'glut',
  name: 'Glutkessel',
  theme: 'glut',
  blurb: 'Schmaler Grat, Sprung über Lava, Brücke über die eigene Spur.',
  grade: 3,
  scale: 1.2,
  points: [
    // 0–3: Start im Tal nach Norden
    [-92, -24, 0],
    [-92, 4, 0],
    [-90, 30, 0],
    [-80, 50, 0],
    // 4–8: Rechtskurve und schräg unter der Felsbrücke hindurch
    [-60, 60, 0.3],
    [-38, 54, 0.8],
    [-18, 36, 1.2],
    [0, 16, 1.2],
    [18, -4, 1.6],
    // 9–11: Anstieg um den Krater
    [40, -20, 3],
    [66, -28, 5.5],
    [92, -22, 8.5],
    // 12–14: der Grat
    [108, -2, 11.5],
    [110, 24, 14],
    [100, 46, 16.5],
    // 15–16: Kraterrand, Sprung über den Lavastrom
    [78, 58, 18],
    [52, 56, 18.8],
    // 17–19: Felsbrücke über die eigene Strecke
    [26, 40, 19],
    [0, 16, 18.5],
    [-24, -8, 16.5],
    // 20–23: Abfahrt mit Kehre zurück ins Tal
    [-44, -32, 13],
    [-60, -52, 9.5],
    [-78, -60, 6],
    [-91, -50, 2.5],
  ],
  roadHalf: 6.2,
  shoulder: 2.4,
  startAt: 0,
  laps: 3,
  bank: 3,
  fallDepth: 6,
  pads: [
    { at: 1.2, lat: 0 },
    { at: 9.4, lat: 0 },
    { at: 14.75, lat: 0, halfWidth: 0 },
    { at: 19.5, lat: 0 },
  ],
  boxRows: [3.5, 10.6, 16.9, 21.2],
  ramps: [{ at: 15.22, length: 9, height: 1.2, gap: 10 }],
  widths: [[12.0, 13.9, 5.0, 1.0]],
  open: [[12.2, 13.7, 0]],
  decks: [
    [12.1, 13.8],
    [16.7, 19.3],
  ],
  hazards: [{ at: 5.6, amp: 4, period: 4.2, phase: 0.6 }],
};

// ---------------------------------------------------------------------------
// 4 · Nachtschicht – Hochstraße durch die Stadt bei Nacht: rechte Winkel, ein
// Sprung von Dach zu Dach und die Parkhaus-Spirale, die sich einmal über sich
// selbst hinwegschraubt.

const NACHT: TrackDef = {
  id: 'nacht',
  name: 'Nachtschicht',
  theme: 'nacht',
  blurb: 'Hochstraße bei Nacht, Dachsprung und die Parkhaus-Spirale.',
  grade: 2,
  scale: 1.15,
  points: [
    // 0–3: Startgerade nach Osten
    [-62, -70, 10],
    [-30, -70, 10],
    [4, -70, 10],
    [36, -70, 10],
    // 4–6: Südost-Ecke
    [49, -67.6, 10],
    [55.6, -61, 10],
    [58, -52, 10.2],
    // 7–10: nach Norden, Dachsprung
    [58, -30, 11],
    [58, -8, 12.2],
    [58, 16, 10],
    [58, 30, 9.6],
    // 11–13: Nordost-Ecke
    [55.6, 39, 9.4],
    [49, 45.6, 9.2],
    [40, 48, 9],
    // 14–17: Schikane nach Westen
    [22, 48, 8.2],
    [2, 43, 7.4],
    [-18, 49.5, 6.6],
    [-40, 46.3, 5.6],
    // 18–33: Parkhaus-Spirale, eineinviertel Umdrehungen bergauf
    ...arc(-60, 26, 20, 90, 540, 16, 5, 13.1),
    // 34–36: Westseite nach Süden
    [-80, 4, 12.6],
    [-80, -20, 11.6],
    [-80, -42, 10.6],
    // 37–38: Südwest-Ecke
    [-77.6, -61, 10.2],
    [-71, -67.6, 10],
  ],
  roadHalf: 6.4,
  shoulder: 1.4,
  startAt: 0,
  laps: 3,
  bank: 2.4,
  fallDepth: 7,
  pads: [
    { at: 1.6, lat: 0 },
    { at: 7.05, lat: 0, halfWidth: 0 },
    { at: 34.3, lat: 0 },
  ],
  boxRows: [2.5, 13.7, 24, 35.2],
  ramps: [{ at: 7.5, length: 9, height: 1.3, gap: 11 }],
  decks: [[0, 38.99]],
  hazards: [{ at: 14.9, amp: 3.8, period: 5, phase: 2 }],
};

export const TRACK_DEFS: TrackDef[] = [WERKSHOF, KLIPPE, GLUT, NACHT];
