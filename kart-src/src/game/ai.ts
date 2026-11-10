// KI-Fahrer. Sie bekommen dieselbe Physik wie Menschen und steuern über
// dieselben Eingaben (Lenkung, vier Tasten) – sie haben also keine Sonderrechte
// außer einem milden Tempo-Ausgleich ("Gummiband"), den der Host berechnet.
//
// Fahrweise: ein Zielpunkt ein Stück voraus auf der Strecke, in Kurven zur
// Innenseite versetzt. Vor engen Kurven wird gebremst, in engen Kurven
// gedriftet und danach der Mini-Turbo mitgenommen.

import {
  BTN_BRAKE,
  BTN_DRIFT,
  BTN_GAS,
  BTN_ITEM,
  ITEM_BOOST,
  ITEM_NONE,
  ITEM_OIL,
  ITEM_TIRE,
  forwardSpeed,
  type Cmd,
  type KartState,
} from './sim';
import { TRACK, proj, projectOnTrack, rightX, rightZ, segDelta, wrapSeg } from './track';

export const BOT_NAMES = ['Kolben-Kalle', 'Vera Vergaser', 'Bremsen-Bert', 'Zünd-Zoe'];

export interface BotBrain {
  /** Grundtempo als Anteil der Höchstgeschwindigkeit – nicht jeder Gegner ist gleich schnell. */
  skill: number;
  /**
   * Ab welcher Krümmung (1/m) dieser Fahrer driftet. Kleine Werte = driftet in
   * fast jeder Kurve, große = nur in der Kehre oder gar nicht.
   */
  driftFrom: number;
  /** Bevorzugte Spur: seitlicher Versatz zur Mittellinie in Metern. */
  line: number;
  /** Ticks, die das Kart praktisch steht. */
  stuck: number;
  /** Verbleibende Ticks Rückwärtsfahrt zum Freikommen. */
  reverse: number;
  /** Ticks, die das aktuelle Item schon gehalten wird. */
  holding: number;
  /** Nach so vielen Ticks wird ein Item spätestens benutzt. */
  patience: number;
  drifting: number;
  itemPressed: boolean;
  /** Einfacher Zufallsgenerator, damit jeder Bot sich anders, aber wiederholbar verhält. */
  rand: number;
}

export function newBrain(slot: number): BotBrain {
  return {
    skill: [0.95, 0.91, 0.93, 0.89][slot % 4],
    driftFrom: [1 / 30, 1 / 19, 1 / 22, 1][slot % 4],
    line: [-1.6, 1.4, 0.2, -0.6][slot % 4],
    stuck: 0,
    reverse: 0,
    holding: 0,
    patience: 240,
    drifting: 0,
    itemPressed: false,
    rand: 12345 + slot * 7919,
  };
}

function random(b: BotBrain): number {
  b.rand = (b.rand * 16807) % 2147483647;
  return b.rand / 2147483647;
}

function wrapAngle(a: number): number {
  if (a > Math.PI) return a - 2 * Math.PI;
  if (a < -Math.PI) return a + 2 * Math.PI;
  return a;
}

// Dieselben Grenzwerte wie in sim.ts (dort nicht exportiert, weil nur die KI sie zum Planen braucht).
const R_MIN = 4.5;
const A_LAT = 31;
const DRIFT_WIDE = 0.55;
const DRIFT_TIGHT = 1.55;

/** Mittlere Krümmung über die nächsten Meter (positiv = Rechtskurve). */
function curvatureAhead(seg: number, fromM: number, toM: number): number {
  const t = TRACK;
  let sum = 0;
  let count = 0;
  for (let d = fromM; d <= toM; d += 2) {
    sum += t.curv[wrapSeg(t, seg + Math.round(d / t.step))];
    count++;
  }
  return sum / count;
}

function maxCurvatureAhead(seg: number, toM: number): number {
  const t = TRACK;
  let max = 0;
  for (let d = 0; d <= toM; d += 2) {
    max = Math.max(max, Math.abs(t.curv[wrapSeg(t, seg + Math.round(d / t.step))]));
  }
  return max;
}

/**
 * Eingabe eines KI-Fahrers für diesen Schritt.
 * @param others Zustände der anderen Karts (für den Einsatz von Items)
 * @param racing false während Countdown und nach dem Ziel
 */
export function botCmd(s: KartState, b: BotBrain, others: KartState[], racing: boolean): Cmd {
  const t = TRACK;
  if (!racing) {
    b.stuck = 0;
    b.reverse = 0;
    b.drifting = 0;
    return { steer: 0, buttons: 0 };
  }
  const vf = forwardSpeed(s);
  const v = Math.abs(vf);

  // --- Zielpunkt voraus, in Kurven zur Innenseite versetzt ---
  const look = Math.max(8, Math.min(24, 6 + v * 0.6));
  const target = wrapSeg(t, s.seg + Math.round(look / t.step));
  const bend = curvatureAhead(s.seg, 0, 34);
  const inside = Math.max(-4.2, Math.min(4.2, bend * 110));
  const lat = Math.max(-5, Math.min(5, b.line * 0.6 + inside));
  const txp = t.px[target] + rightX(t, target) * lat;
  const tzp = t.pz[target] + rightZ(t, target) * lat;
  const err = wrapAngle(Math.atan2(txp - s.x, tzp - s.z) - s.heading);
  // Rechts lenken verkleinert die Blickrichtung → Vorzeichen umdrehen.
  const wantYaw = -err * 4.2;

  // --- Festgefahren? Kurz zurücksetzen. ---
  if (b.reverse > 0) {
    b.reverse--;
    return { steer: Math.round(Math.max(-1, Math.min(1, err * 2)) * 127), buttons: BTN_BRAKE };
  }
  if (v < 1.5 && s.spin === 0) {
    if (++b.stuck > 80) {
      b.stuck = 0;
      b.reverse = 45;
    }
  } else b.stuck = 0;

  // --- Tempo: so schnell, wie die engste Stelle voraus es zulässt ---
  const brakeDist = (v * v) / 70 + 8;
  const tight = maxCurvatureAhead(s.seg, brakeDist);
  // Wer driftet, kommt enger herum als mit normaler Lenkung und darf schneller hinein.
  const cornering = tight > b.driftFrom ? A_LAT * DRIFT_TIGHT * 0.86 : A_LAT * 0.92;
  const limit = tight > 1e-4 ? Math.sqrt(cornering / tight) : 99;
  let buttons = 0;
  if (v < limit + 0.5) buttons |= BTN_GAS;
  else if (v > limit + 5) buttons |= BTN_BRAKE;

  // --- Drift: in engen, längeren Kurven ---
  const yawMax = v < 0.3 ? 0 : Math.min(v / R_MIN, A_LAT / v);
  const near = curvatureAhead(s.seg, 0, 14);
  let steer: number;
  if (s.driftDir !== 0) {
    b.drifting++;
    const stillTurning = near * s.driftDir > 1 / 55;
    // Mindestens bis Stufe 1 halten, sofern die Kurve nicht schon vorbei ist.
    if (stillTurning || (b.drifting < 40 && near * s.driftDir > 1 / 120)) buttons |= BTN_DRIFT;
    const k = yawMax > 0 ? (wantYaw * s.driftDir) / yawMax : 0;
    const into = ((k - DRIFT_WIDE) / (DRIFT_TIGHT - DRIFT_WIDE)) * 2 - 1;
    steer = Math.max(-1, Math.min(1, into)) * s.driftDir;
  } else {
    b.drifting = 0;
    steer = yawMax > 0 ? Math.max(-1, Math.min(1, wantYaw / yawMax)) : 0;
    const dir = near > 0 ? 1 : -1;
    const turnAhead = Math.abs(curvatureAhead(s.seg, 0, 30)) * 30;
    if (Math.abs(near) > b.driftFrom && turnAhead > 0.55 && vf > 14 && Math.sign(steer) === dir && Math.abs(err) < 0.6) {
      buttons |= BTN_DRIFT;
      steer = dir * Math.max(0.3, Math.abs(steer));
    }
  }

  // --- Items ---
  let press = false;
  if (s.item === ITEM_NONE) {
    b.holding = 0;
  } else {
    if (b.holding++ === 0) b.patience = 150 + Math.floor(random(b) * 330);
    const aligned = Math.abs(err) < 0.2;
    projectOnTrack(t, s.x, s.z, s.seg);
    const myLat = proj.lat;
    if (s.item === ITEM_BOOST) {
      // Auf geraden Stücken zünden, nicht vor einer Kurve.
      press = s.boost === 0 && v > 12 && maxCurvatureAhead(s.seg, 45) < 1 / 70 && b.holding > 30;
    } else {
      for (const o of others) {
        const d = segDelta(t, s.seg, o.seg) * t.step;
        projectOnTrack(t, o.x, o.z, o.seg);
        if (s.item === ITEM_TIRE && aligned && d > 4 && d < 34 && Math.abs(proj.lat - myLat) < 3.5) press = true;
        if (s.item === ITEM_OIL && d < -2 && d > -14) press = true;
      }
      if (b.holding > b.patience && (s.item === ITEM_OIL || aligned)) press = true;
    }
  }
  // Die Taste braucht eine Flanke: nie zwei Schritte hintereinander drücken.
  if (press && !b.itemPressed) buttons |= BTN_ITEM;
  b.itemPressed = (buttons & BTN_ITEM) !== 0;

  return { steer: Math.round(steer * 127), buttons };
}

/**
 * Milder Tempo-Ausgleich: liegt ein KI-Fahrer weit vor den Menschen, wird er
 * etwas langsamer, liegt er weit zurück, etwas schneller. Der Faktor wirkt nur
 * auf die Höchstgeschwindigkeit und bleibt in engen Grenzen.
 * @param aheadMeters Vorsprung auf den besten Menschen (negativ = Rückstand)
 */
export function rubberBand(aheadMeters: number): number {
  const k = Math.max(-1, Math.min(1, aheadMeters / 80));
  return k > 0 ? 1 - k * 0.14 : 1 - k * 0.06;
}
