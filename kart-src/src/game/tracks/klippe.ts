// 2 · Möwenklippe – vom sandigen Strand über den schmalen Holzsteg ohne
// Geländer hinaus aufs Meer und zurück, dann auf dem Waldweg in Serpentinen
// die Klippe hinauf – oder unten durch die Grotte im Fels, deren Zufahrt unter
// der Serpentinenbrücke hindurchführt. Oben über die Wiese mit Kuppen am
// Leuchtturm vorbei, steil hinunter mit Sprung, durch die Steilkurve an den
// Strand und um die Bucht herum – oder auf dem Steg mit Schanze quer darüber.

import type { TrackDef } from '../track';
import { arc } from './shape';

export const KLIPPE: TrackDef = {
  id: 'klippe',
  name: 'Möwenklippe',
  theme: 'klippe',
  blurb: 'Holzsteg ohne Geländer, Serpentinen oder Grotte, Steilkurve und Sprung über die Bucht.',
  grade: 2,
  surface: 'dirt',
  // Der Leuchtturm steht oben auf der Hochfläche.
  landmarkAt: 34,
  points: [
    // 0–2: Strandpromenade nach Osten
    [100, -100, 0],
    [130, -100, 0],
    [155, -103, 0.2],
    // 3–4: hinaus auf den Steg
    [175, -115, 0.8],
    [182, -133, 1.2],
    // 5–9: Wende am Stegkopf
    ...arc(201, -153, 19, 180, 360, 5, 1.2, 1.2),
    // 10–12: zurück an Land
    [220, -131, 1.2],
    [221, -112, 1.0],
    [222, -86, 0.6],
    // 11.7: Gabelung Grotte. 13–23 Serpentinen auf dem Waldweg, außen am Hang;
    // 21–22 auf der Brücke über der Zufahrt zur Grotte
    [236, -46, 1.2],
    [258, -26, 2.4],
    [285, -16, 3.8],
    [306, -4, 5],
    [312, 15, 6.2],
    [302, 33, 7.4],
    [282, 40, 8.4],
    [255, 42, 9.6],
    [228, 44, 10.8],
    [200, 46, 12],
    [175, 56, 13.2],
    [163, 80, 14.4],
    [160, 110, 15.2],
    [160, 140, 15.8],
    // 26–29 oben auf die Hochfläche, 30 Einmündung der Grotte
    [150, 168, 16],
    [128, 184, 16.2],
    [95, 190, 16.4],
    [60, 188, 16],
    // 31–37 Hochfläche über die Wiese mit Kuppen, am Leuchtturm vorbei
    [25, 192, 17],
    [-10, 196, 16],
    [-45, 192, 17],
    [-80, 186, 16],
    [-106, 172, 16],
    [-128, 150, 15.8],
    // 37–42 die steile Abfahrt mit Sprung
    [-146, 125, 15.6],
    [-150, 95, 13.6],
    [-151, 65, 9.8],
    [-151, 35, 5.8],
    [-151, 5, 2.6],
    [-150, -35, 0.6],
    // 43–46 Steilkurve an den Strand
    ...arc(-125, -75, 25, 180, 270, 4, 0.2, 0),
    // 47: Gabelung Bucht – die Uferstraße 48–52 führt sicher um die Bucht herum
    [-98, -101, 0],
    [-60, -90, 0],
    [-38, -62, 0.4],
    [-6, -48, 0.8],
    [26, -62, 0.4],
    [50, -89, 0],
    // 53: zurück auf der Promenade, Einmündung kurz vor dem Ziel
    [75, -100, 0],
  ],
  roadHalf: 6.2,
  shoulder: 2.6,
  startAt: 0,
  laps: 3,
  bank: 1.4,
  fallDepth: 4.2,
  pads: [
    { at: 0.5, lat: 0 },
    { at: 13.6, lat: 0 },
    { at: 24.6, lat: 0 },
    { at: 34.2, lat: 0 },
    { at: 46.6, lat: 0 },
  ],
  boxRows: [2, 20, 32.2, 41.2, 52.7],
  bumps: [
    { at: 31, length: 15, height: 1.3 },
    { at: 33, length: 15, height: 1.3 },
  ],
  ramps: [{ at: 39.5, length: 9, height: 1.3, gap: 8 }],
  banks: [[42.5, 46.3, -0.36]],
  // Steg: schmaler, links und rechts offen; an der Wende steht außen ein Geländer.
  // Untergrund: Sand am Strand und in der Bucht, Holz auf Steg und Brücke,
  // Waldweg durch die Kiefern hinauf, Wiese auf der Hochfläche am Leuchtturm.
  surfaces: [
    [0, 2.9, 'sand'],
    [2.9, 11.3, 'wood'],
    [21, 22.2, 'wood'],
    [29.5, 37.5, 'grass'],
    [46.5, 54, 'sand'],
  ],
  widths: [[2.9, 11.3, 4.6, 0.8]],
  open: [
    [3.4, 5, 0],
    [5, 9, 1],
    [9, 10.9, 0],
  ],
  decks: [
    [2.9, 11.3],
    [21, 22.2],
  ],
  hazards: [
    { at: 32.6, amp: 3.6, period: 4.6, phase: 1.2 },
    { at: 50, amp: 4, period: 5, phase: 0 },
  ],
  branches: [
    // a: Grotte – unter der Serpentinenbrücke hindurch, dann steil und eng
    // durch die Höhle im Fels hinauf; kürzer, aber nur 10 m breit.
    {
      from: 11.7,
      to: 30,
      points: [
        [209, -52, 0.8],
        [205, -12, 1.8],
        [210, 22, 2.6],
        [214, 52, 3],
        [216, 85, 5.5],
        [222, 118, 9.5],
        [210, 150, 13.4],
        [188, 178, 15.4],
        [150, 215, 16],
        [100, 202, 16.3],
      ],
      roadHalf: 5,
      surfaces: [[4.3, 7.5, 'rock']],
      tunnels: [[4.55, 7.2]],
      boxRows: [2.5, 6.5],
      pads: [{ at: 4.9, lat: 0 }],
    },
    // b: über die Bucht – schmaler Holzsteg ohne Bande mit Schanze über eine
    // Lücke. Wer den Sprung verpatzt, landet im Wasser.
    {
      from: 47,
      to: 53.4,
      points: [
        [-58, -113, 1.4],
        [-26, -132, 1.6],
        [14, -134, 0.6],
        [50, -113, 1.2],
      ],
      roadHalf: 4.6,
      surface: 'sand',
      surfaces: [[0.8, 4.3, 'wood']],
      shoulder: 1.2,
      decks: [[0.8, 4.3]],
      open: [[1.1, 4.0, 0]],
      ramps: [{ at: 1.7, length: 10, height: 1.7, gap: 9 }],
      boxRows: [3.3],
    },
  ],
};
