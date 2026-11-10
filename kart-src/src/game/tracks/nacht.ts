// 4 · Nachtschicht – Hochstraße durch die Stadt bei Nacht: rechte Winkel, ein
// Sprung von Dach zu Dach und die Parkhaus-Spirale, die sich einmal über sich
// selbst hinwegschraubt.

import type { TrackDef } from '../track';
import { arc } from './shape';

export const NACHT: TrackDef = {
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
