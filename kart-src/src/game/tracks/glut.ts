// 3 · Glutkessel – eine Acht um einen Vulkan: unten durch das Tal, in einer
// überhöhten Kurve den Krater hinauf, über einen schmalen Grat, Sprung über den
// Lavastrom und auf einer Felsbrücke über die eigene Strecke zurück.

import type { TrackDef } from '../track';

export const GLUT: TrackDef = {
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
