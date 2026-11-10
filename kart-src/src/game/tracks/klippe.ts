// 2 · Möwenklippe – vom Strand über einen Holzsteg ohne Geländer, in Serpentinen
// die Klippe hinauf, oben über Kuppen und dann steil hinunter mit Sprung über
// eine Bucht.

import type { TrackDef } from '../track';
import { arc } from './shape';

export const KLIPPE: TrackDef = {
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
