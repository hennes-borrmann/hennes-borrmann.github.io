// 9 · Sturmhafen – vom Kai durch die Containergasse hinaus auf die Mole, um den
// Leuchtturm herum und über die Pontonbrücke der Hafeneinfahrt zum Kranplatz,
// mit einem Sprung über die offene Ladeluke zurück durch die Lagerhalle.
// Wer sich traut, kürzt vor der Mole ab: quer durchs Becken über die Pontonkette –
// schmal, ohne Geländer, und der Wind steht drauf.
//
// Zwei Dinge sind hier anders als überall sonst (mechanics.ts): Böen schieben das
// Kart im Takt quer – man hält gegen oder sucht den Windschatten der Container –,
// und die Pontons heben und senken sich mit dem Seegang.

import type { TrackDef } from '../track';

export const HAFEN: TrackDef = {
  id: 'hafen',
  name: 'Sturmhafen',
  theme: 'hafen',
  blurb: 'Kai, Containergasse, Mole mit Leuchtturm oder Pontonkette quer durchs Becken, Kranplatz mit Sprung über die Ladeluke.',
  twist: 'Sturm: Böen schieben quer – Windsäcke kündigen sie an, hinter Containern ist Windschatten. Die Pontons schwanken, auf dem Kamm hebt das Kart ab.',
  grade: 2,
  scale: 1.13,
  points: [
    // 0–5: Kai nach Osten
    [-150, -140, 0],
    [-100, -140, 0],
    [-50, -140, 0],
    [0, -140, 0],
    [50, -140, 0],
    [100, -136, 0],
    // 6–10: Kurve nach Norden, Containergasse mit S
    [140, -116, 0],
    [158, -80, 0],
    [150, -42, 0],
    [162, -6, 0],
    [158, 32, 0.3],
    // 10.6: Gabelung. 11–17 die Mole hinaus, um den Leuchtturm und zurück nach Westen
    [172, 66, 1.0],
    [198, 88, 1.6],
    [222, 108, 1.8],
    [224, 134, 1.8],
    [204, 154, 1.8],
    [176, 164, 1.6],
    [140, 168, 1.2],
    // 18.4: Einmündung. 18–23 Kaimauer und Pontonbrücke über die Hafeneinfahrt
    [100, 170, 0.8],
    [60, 168, 0.5],
    [20, 166, 0.3],
    [-20, 166, 0.3],
    [-60, 166, 0.3],
    [-100, 164, 0.3],
    // 24–29: Kurve nach Süden, Kranplatz mit pendelnden Containern, Sprung über die Ladeluke
    [-138, 150, 0.5],
    [-160, 118, 0.8],
    [-166, 80, 1.0],
    [-160, 42, 1.0],
    [-170, 4, 1.0],
    [-166, -34, 1.0],
    // 30–32: Lagerhalle und zurück auf den Kai
    [-172, -72, 0.6],
    [-178, -104, 0.2],
    [-172, -130, 0],
  ],
  roadHalf: 6.4,
  shoulder: 1.6,
  startAt: 0,
  laps: 3,
  bank: 0.8,
  fallDepth: 4,
  landmarkAt: 14,
  widths: [
    // Containergasse: eng zwischen den Stapeln
    [6.4, 10.2, 5.4, 0.8],
    // Pontonbrücke: Stahlroste mit Geländer
    [20.0, 23.9, 5.6, 0.5],
  ],
  surfaces: [
    [20.1, 23.8, 'metal'],
    [25.4, 28.4, 'metal'],
  ],
  decks: [
    [11.3, 18.7],
    [19.8, 24.0],
  ],
  tunnels: [[30.5, 32.2]],
  winds: [
    // Containergasse: der Wind pfeift durch die Lücken zwischen den Stapeln (links stehen sie)
    {
      from: 6.5,
      to: 10.3,
      push: 5,
      period: 7,
      phase: 0,
      lee: [
        [6.7, 7.5, -7, 0.4],
        [8.1, 8.9, -7, 0.4],
        [9.4, 10.0, -7, 0.4],
      ],
    },
    // Mole: hinaus drückt er nach rechts, auf dem Rückweg von vorn links nach rechts – also zur See
    { from: 11.2, to: 13.2, push: 5.5, period: 6.5, phase: 2.5 },
    { from: 15.4, to: 18.2, push: 5.5, period: 6.5, phase: 2.5 },
    // Pontonbrücke: mit Geländer, aber der Wind drückt in die Bande
    { from: 20.2, to: 23.8, push: -4, period: 8, phase: 4.5 },
  ],
  pontoons: [
    { from: 20.3, to: 21.4, amp: 0.7, period: 3.4, phase: 0 },
    { from: 21.4, to: 22.5, amp: 0.7, period: 3.4, phase: 1.4 },
    { from: 22.5, to: 23.7, amp: 0.7, period: 3.4, phase: 2.6 },
  ],
  hazards: [
    { at: 26.4, amp: 4.4, period: 4.2, phase: 0 },
    { at: 27.7, amp: 4.4, period: 4.2, phase: 2.2 },
  ],
  ramps: [{ at: 29.1, length: 10, height: 1.5, gap: 9 }],
  pads: [
    { at: 1.5, lat: 0 },
    { at: 12.0, lat: 0 },
    { at: 16.5, lat: 0 },
    { at: 24.7, lat: 0 },
    { at: 30.9, lat: 0 },
  ],
  boxRows: [3.0, 9.25, 15.1, 19.4, 28.3],
  branches: [
    // a: die Pontonkette quer durchs Becken – kürzer, aber schmal, ohne Geländer, im Zickzack und mitten im Wind
    {
      from: 10.6,
      to: 18.4,
      points: [
        [168, 90, 0.6],
        [138, 104, 0.3],
        [146, 136, 0.3],
        [120, 157, 0.5],
      ],
      // An Gabelung und Einmündung so breit wie die Hauptstrecke, dazwischen schmale Stahlroste.
      roadHalf: 6.4,
      shoulder: 1.6,
      // Die Kette endet auf einem festen Steg, bevor die Abzweigung in die Mole einläuft (ab 4.0 liegen beide
      // Fahrbahnen ineinander): Ein schwankendes Deck neben der festen Nachbarfahrbahn gäbe eine Stufe.
      widths: [[0.9, 4.02, 4.8, 0.4]],
      surfaces: [[0.8, 4.0, 'metal']],
      decks: [[0.6, 4.7]],
      open: [[0.95, 3.92, 0]],
      pontoons: [
        { from: 1.0, to: 2.0, amp: 0.85, period: 3.2, phase: 0 },
        { from: 2.0, to: 3.1, amp: 0.9, period: 3.6, phase: 1.5 },
        // der dritte ist kürzer: dahinter folgt fester Steg
        { from: 3.1, to: 3.75, amp: 0.85, period: 3.0, phase: 2.3 },
      ],
      winds: [{ from: 0.9, to: 3.92, push: -3.6, period: 5.5, phase: 1, gust: 2.2 }],
      boxRows: [2.5],
    },
  ],
};
