// KI-Fahrer. Sie bekommen dieselbe Physik wie Menschen und steuern über
// dieselben Eingaben (Lenkung, vier Tasten) – sie haben also keine Sonderrechte
// außer einem milden Tempo-Ausgleich ("Gummiband"), den der Host berechnet.
//
// An Gabelungen entscheidet jeder Fahrer rechtzeitig vorher per Zufall, welchen
// Weg er nimmt; alles Vorausschauen folgt dann diesem Weg.
//
// Fahrweise: ein Zielpunkt ein Stück voraus auf der Strecke, in Kurven zur
// Innenseite versetzt. Vor engen Kurven wird gebremst, in engen Kurven
// gedriftet und danach der Mini-Turbo mitgenommen. Vor Sprüngen, auf Stegen
// ohne Geländer und vor pendelnden Hindernissen fahren sie vorsichtiger.

import {
  BTN_BRAKE,
  BTN_DRIFT,
  BTN_GAS,
  BTN_ITEM,
  CHARACTERS,
  FLAG_AIR,
  FLAG_GLIDE,
  ITEM_BOOST,
  ITEM_EMP,
  ITEM_GUARD,
  ITEM_KITE,
  ITEM_NONE,
  ITEM_OIL,
  ITEM_SMOKE,
  ITEM_SPRING,
  ITEM_TIRE,
  ITEM_TOP,
  bankGrip,
  forwardSpeed,
  type Cmd,
  type KartState,
  windPush,
} from './sim';
import { PULSE_AVALANCHE, PULSE_BUBBLE, FLOOD_FROM, floodPeak, gustStrength, gustWarning, planActive, pulseCycle, tideLevel, tidePhase, vehicleAt } from './mechanics';
import { SURFACES } from './surface';
import {
  EDGE_GAP,
  EDGE_GLIDE,
  EDGE_OPEN_L,
  EDGE_OPEN_R,
  TRACK,
  hazardLat,
  pathAhead,
  proj,
  projectOnTrack,
  rightX,
  rightZ,
  segDelta,
  walk,
} from './track';

export const BOT_NAMES = ['Kolben-Kalle', 'Vera Vergaser', 'Bremsen-Bert', 'Zünd-Zoe'];

/** Stärke der KI-Gegner. */
export const AI_EASY = 0;
export const AI_MEDIUM = 1;
export const AI_HARD = 2;
export const AI_LEVEL_NAMES = ['Leicht', 'Mittel', 'Schwer'];

export interface BotBrain {
  level: number;
  /** Grundtempo als Anteil der Höchstgeschwindigkeit – nicht jeder Gegner ist gleich schnell. */
  skill: number;
  /**
   * Ab welcher Krümmung (1/m) dieser Fahrer driftet. Kleine Werte = driftet in
   * fast jeder Kurve, große = nur in der Kehre oder gar nicht.
   */
  driftFrom: number;
  /** Bevorzugte Spur: seitlicher Versatz zur Mittellinie in Metern. */
  line: number;
  /** Gewählter Weg: Bit k gesetzt = Abzweigung k nehmen. */
  route: number;
  /** true = route bleibt, wie sie ist (für Tests); sonst wird vor jeder Gabelung neu gewürfelt. */
  routeLock: boolean;
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

/** Was die KI außer den Kart-Zuständen über das Rennen wissen muss. */
export interface BotContext {
  /** Host-Tick (für pendelnde Hindernisse). */
  tick: number;
  /** Rennzeit in Ticks seit "Los" (für Verkehr, Geysire, Lava – siehe mechanics.ts). */
  time: number;
  /** Aktueller Platz dieses Fahrers. */
  place: number;
  /** Fährt gerade durch eine Rauchwolke. */
  smoke: boolean;
}

const SKILL = [0.95, 0.91, 0.93, 0.89];
const SKILL_SHIFT = [-0.09, 0, 0.055];
const DRIFT_FROM = [
  [1, 1, 1, 1],
  [1 / 30, 1 / 19, 1 / 22, 1],
  [1 / 36, 1 / 26, 1 / 30, 1 / 22],
];
const PATIENCE_FACTOR = [1.6, 1, 0.7];

export function newBrain(slot: number, level = AI_MEDIUM): BotBrain {
  const l = Math.max(0, Math.min(2, level | 0));
  return {
    level: l,
    skill: SKILL[slot % 4] + SKILL_SHIFT[l],
    driftFrom: DRIFT_FROM[l][slot % 4],
    line: [-1.6, 1.4, 0.2, -0.6][slot % 4],
    route: 0,
    routeLock: false,
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
const KART_HALF = 1.0;
const R_MIN = 4.5;
const BASE_A_LAT = 31;
const DRIFT_WIDE = 0.55;
const DRIFT_TIGHT = 1.55;

/** Die nächsten Abschnitte auf dem gewählten Weg (ab dem eigenen); botCmd füllt sie zu Beginn. */
const PATH = new Int32Array(84);
/** So weit vor einer Gabelung fällt die Entscheidung (Abschnitte). */
const DECIDE_AT = 64;

/** Abschnitt d Meter voraus auf dem gewählten Weg. */
function aheadSeg(d: number): number {
  return PATH[Math.min(PATH.length - 1, Math.round(d / TRACK.step))];
}

/** Mittlere Krümmung über die nächsten Meter (positiv = Rechtskurve). */
function curvatureAhead(fromM: number, toM: number): number {
  const t = TRACK;
  let sum = 0;
  let count = 0;
  for (let d = fromM; d <= toM; d += 2) {
    sum += t.curv[aheadSeg(d)];
    count++;
  }
  return sum / count;
}

/** Engste Stelle voraus. Steilkurven zählen so viel weiter, wie ihre Neigung an Halt bringt. */
function maxCurvatureAhead(toM: number): number {
  const t = TRACK;
  let max = 0;
  for (let d = 0; d <= toM; d += 2) {
    const i = aheadSeg(d);
    const c = t.curv[i];
    // … und loser Untergrund entsprechend enger.
    max = Math.max(max, Math.abs(c) / (bankGrip(t, i, c > 0 ? 1 : -1) * (SURFACES[t.surf[i]] ?? SURFACES[0]).grip));
  }
  return max;
}

// --- Ausweichen: gesperrte Streifen quer zur Fahrbahn ---------------------------
// Verkehr, Geysire und Lavabomben sperren je einen Streifen [von, bis] (seitliche
// Lage in Metern). Die KI sucht den freien Streifen, der ihrer Wunschlinie und
// ihrer jetzigen Lage am nächsten liegt.

const BLOCK_LO = new Float64Array(24);
const BLOCK_HI = new Float64Array(24);
/** 1 = gleich da (unbedingt meiden), kleiner = noch ein Stück weg (nur ungern). */
const BLOCK_W = new Float64Array(24);
let blocks = 0;

function block(lo: number, hi: number, weight: number): void {
  if (blocks >= BLOCK_LO.length) return;
  BLOCK_LO[blocks] = lo;
  BLOCK_HI[blocks] = hi;
  BLOCK_W[blocks] = weight;
  blocks++;
}

/**
 * Beste Lage innerhalb ±max: nie in einem Streifen, der gleich da ist; möglichst
 * nicht in einem, der noch kommt; sonst nah an der Wunschlinie want und an der
 * jetzigen Lage here. NaN = alles dicht.
 */
function freeLat(want: number, here: number, max: number): number {
  let best = Number.NaN;
  let bestCost = Infinity;
  // Kandidaten: die Wunschlage, die jetzige Lage und die Ränder aller Streifen.
  for (let c = -2; c < blocks * 2; c++) {
    let cand = c === -2 ? want : c === -1 ? here : c % 2 === 0 ? BLOCK_LO[c >> 1] - 0.05 : BLOCK_HI[c >> 1] + 0.05;
    cand = Math.max(-max, Math.min(max, cand));
    let cost = Math.abs(cand - want) * 0.5 + Math.abs(cand - here);
    for (let k = 0; k < blocks; k++) {
      if (cand > BLOCK_LO[k] && cand < BLOCK_HI[k]) cost += BLOCK_W[k] >= 1 ? Infinity : 9 * BLOCK_W[k];
    }
    if (cost < bestCost) {
      bestCost = cost;
      best = cand;
    }
  }
  return best;
}

/**
 * Seitliche Lage der Hauptstrecke aus Sicht des Abschnitts seg: 0 auf der
 * Hauptstrecke selbst; an Gabelung und Einmündung der Versatz zur Nachbarin;
 * NaN, wo die Abzweigung ihre eigenen Wege geht.
 */
function mainOffset(seg: number): number {
  const t = TRACK;
  if (t.branchOf[seg] < 0) return 0;
  const m = t.twin[seg];
  if (m < 0) return Number.NaN;
  return (t.px[m] - t.px[seg]) * rightX(t, seg) + (t.pz[m] - t.pz[seg]) * rightZ(t, seg);
}

/** Bits aller Kanten-Eigenschaften der nächsten Meter (Lücke, fehlende Bande). */
function edgesAhead(toM: number): number {
  const t = TRACK;
  let bits = 0;
  for (let d = 0; d <= toM; d += 3) bits |= t.edge[aheadSeg(d)];
  return bits;
}

/**
 * Eingabe eines KI-Fahrers für diesen Schritt.
 * @param others Zustände der anderen Karts (für den Einsatz von Items)
 * @param racing false während Countdown und nach dem Ziel
 */
/** Nur zur Fehlersuche in Tests: was die KI im letzten Schritt über den Verkehr dachte. */
/** So nah am Innenrand (Meter) löst die KI einen Drift, der sie weiter hineinzöge. */
const DRIFT_INNER_MARGIN = 1.6;

export const AI_TRACE = { here: 0, lat: 0, want: 0, jam: false, blocks: '' };

export function botCmd(s: KartState, b: BotBrain, others: KartState[], racing: boolean, ctx: BotContext): Cmd {
  const t = TRACK;
  if (!racing || s.respawn > 0) {
    b.stuck = 0;
    b.reverse = 0;
    b.drifting = 0;
    return { steer: 0, buttons: 0 };
  }
  // Am Abschleppdrachen: nichts tun – vor allem nicht bremsen, das würde die Schnur kappen.
  if (s.tow > 0) {
    b.stuck = 0;
    b.drifting = 0;
    b.itemPressed = false;
    return { steer: 0, buttons: 0 };
  }
  const vf = forwardSpeed(s);
  const v = Math.abs(vf);
  const air = (s.flags & FLAG_AIR) !== 0;

  // --- Welcher Weg? Rechtzeitig vor jeder Gabelung wird gewürfelt. ---
  const on = t.branchOf[s.seg];
  for (let k = 0; k < t.branches.length; k++) {
    if (b.routeLock) break;
    // Wer schon mitten auf einer Abzweigung fährt (etwa nach einem Rempler), bleibt dabei.
    if (on === k && t.twin[s.seg] < 0) b.route |= 1 << k;
    else if (on < 0) {
      const d = segDelta(t, s.seg, t.branches[k].from);
      if (d > DECIDE_AT && d <= DECIDE_AT + 2) {
        let take = random(b) < 0.5;
        // Liegt auf der Abzweigung ein Stück, durch das im Takt Lava läuft? Wer aufpasst,
        // nimmt sie genau dann, wenn sie bei der Durchfahrt frei ist (die Ampel zeigt es an).
        if (b.level > 0) {
          for (const f of t.floods) {
            if (f.branch !== k) continue;
            const arrive = ctx.time + f.lead + (DECIDE_AT * t.step * 60) / 25;
            take = floodPeak(f, arrive - 30, arrive + (f.count * t.step * 60) / 22) <= FLOOD_FROM;
          }
          // Steht die Hauptstrecke hinter der Gabelung bei Flut unter Wasser, lohnt die Abzweigung – bei Ebbe nicht.
          if (t.tide && t.tidal[walk(t, t.branches[k].from, 40)]) {
            const arrive = ctx.time + ((DECIDE_AT + 70) * t.step * 60) / 25;
            const wet = tidePhase(t.tide, arrive);
            if (wet > 0.6) take = true;
            else if (wet < 0.15) take = false;
          }
        }
        // Ein Tor auf einem der beiden Wege: Ist es bei der Ankunft zu, bleibt nur der andere.
        // (Das sieht jeder – auch die leichte KI fährt nicht vor eine Wand.)
        for (const g of t.gates) {
          // (Ein Tor sperrt nur die Mündung, und was dahinter einstürzt, tut es mit Verzögerung: wer knapp vor dem
          // Schließen einfährt, kommt durch. Die halbe Sekunde Abstand gilt der Unsicherheit der eigenen Schätzung.)
          const arrive = ctx.time + ((DECIDE_AT + 12) * t.step * 60) / Math.max(v, 12);
          if (!planActive(g.plan, arrive) && !planActive(g.plan, arrive + 30)) {
            // Offen – und das ist es nicht immer: Wer aufpasst, nimmt den Weg meistens, solange es ihn gibt.
            if (t.branchOf[g.first] === k && b.level > 0 && !take) take = random(b) < 0.6;
            continue;
          }
          if (t.branchOf[g.first] === k) take = false;
          else if (t.branchOf[g.first] < 0 && segDelta(t, t.branches[k].from, g.first) >= 0 && segDelta(t, g.first, t.branches[k].to) > 0) take = true;
        }
        b.route = take ? b.route | (1 << k) : b.route & ~(1 << k);
      }
    }
  }
  // Tor zu und so bald nicht offen (etwa: die Brücke ist inzwischen eingestürzt): umplanen, solange die
  // Hauptstrecke noch daneben liegt – wer nach einem Treffer später ankommt als gedacht, bliebe sonst davor stehen.
  if (!b.routeLock) {
    for (const g of t.gates) {
      const k = t.branchOf[g.first];
      if (k < 0 || ((b.route >> k) & 1) === 0) continue;
      let d = 0;
      if (on === k) {
        if (t.twin[s.seg] < 0) continue;
      } else if (on < 0) {
        d = segDelta(t, s.seg, t.branches[k].from);
        if (d > DECIDE_AT || d < -g.count) continue;
        d = Math.max(0, d);
      } else continue;
      const arrive = ctx.time + (d * t.step * 60) / Math.max(v, 12);
      if (planActive(g.plan, arrive) && planActive(g.plan, arrive + 90)) b.route &= ~(1 << k);
    }
  }
  pathAhead(t, s.seg, b.route, PATH);
  // Jede Figur hält in Kurven etwas anders – die KI plant mit den Werten ihrer eigenen.
  const A_LAT = BASE_A_LAT * (CHARACTERS[s.char] ?? CHARACTERS[0]).grip;

  // --- Was liegt voraus? ---
  const near = curvatureAhead(0, 14);
  const edges = edgesAhead(46);
  const gapAhead = (edges & EDGE_GAP) !== 0;
  const openAhead = (edgesAhead(24) & (EDGE_OPEN_L | EDGE_OPEN_R)) !== 0;

  // --- Zielpunkt voraus, in Kurven zur Innenseite versetzt ---
  const look = Math.max(8, Math.min(24, 6 + v * 0.6));
  const target = aheadSeg(look);
  const bend = curvatureAhead(0, 34);
  // Ohne Bande hält die KI Abstand zur Kante; vor einer Lücke fährt sie gerade auf die Mitte zu.
  const maxLat = Math.max(0.5, t.rh[target] - (openAhead ? 3.2 : 2.2));
  let lat = gapAhead ? 0 : (b.line * 0.6 * t.rh[target]) / 6.5 + bend * 110;
  // Flugstrecke voraus oder schon in der Luft: wer aufpasst, hält auf den nächsten Aufwind oder Ring zu.
  const flying = (s.flags & FLAG_GLIDE) !== 0;
  if (b.level > 0 && (flying || (edges & EDGE_GLIDE) !== 0)) {
    let best = PATH.length;
    for (const list of [t.thermals, t.rings]) {
      for (const th of list) {
        for (let k = 3; k < best; k++) {
          if (PATH[k] === th.seg) {
            best = k;
            lat = th.lat;
            break;
          }
        }
      }
    }
  }
  for (const h of t.hazards) {
    // Nur Hindernisse auf dem eigenen Weg zählen.
    let d = -1;
    for (let k = 2; k < 44; k++) {
      if (PATH[k] === h.seg) {
        d = k * t.step;
        break;
      }
    }
    if (d < 0) continue;
    // Wo ist das Hindernis, wenn ich dort ankomme? Auf der anderen Seite vorbei.
    const hl = hazardLat(h, ctx.tick + (d / Math.max(v, 8)) * 60);
    lat = hl > 0 ? Math.min(lat, hl - 4.6) : Math.max(lat, hl + 4.6);
  }
  // Böen: wer aufpasst, zieht schon zur Windseite, während sie sich ankündigt (im Windschatten ist das nicht nötig).
  if (b.level > 0) {
    for (const w of t.winds) {
      if (target < w.first || target >= w.first + w.count) continue;
      const k = Math.max(gustStrength(w, ctx.time + 12), gustWarning(w, ctx.time) * 0.7);
      if (k <= 0) continue;
      let sheltered = false;
      for (const l of w.lee) if (target >= l.first && target <= l.last && lat > l.lat0 && lat < l.lat1) sheltered = true;
      if (!sheltered) lat -= Math.sign(w.push) * Math.min(2.5, Math.abs(w.push) * 0.4) * k;
    }
  }
  lat = Math.max(-maxLat, Math.min(maxLat, lat));

  // --- Verkehr, Geysire, Lavabomben: gesperrte Streifen voraus ---
  let jam = false;
  /** Bis zu diesem Tempo wird im Stau gebremst. Vor einer Lawine sinkt es bis zum Stillstand – auf Eis rollte das Kart sonst hinein. */
  let haltSpeed = 13;
  /** Ein Fahrzeug ist gleich neben mir: jetzt nicht driften. */
  let close = false;
  if ((t.vehicles.length > 0 || t.pulses.length > 0 || t.belts.length > 0 || t.tide || t.holes.length > 0 || t.gates.length > 0) && !air) {
    blocks = 0;
    projectOnTrack(t, s.x, s.z, s.seg);
    const here = proj.lat;
    // Der Verkehr fährt auf der Hauptstrecke. Wo meine Abzweigung noch (oder schon wieder) in ihr
    // liegt, rechne ich seine Spuren in meine Sicht um: so weit liegt die Hauptstrecke seitlich neben mir.
    const offHere = mainOffset(s.seg);
    const offTarget = mainOffset(target);
    const range = Math.min((PATH.length - 2) * t.step, 16 + v * 1.7);
    /** Bei Flut: die höhere, flachere Seite der Fahrbahn (−1 links, 1 rechts, 0 = keine Flut hier). */
    let shallow = 0;
    // Im Verkehr nutzt die KI die Fahrbahn bis an den Rand.
    const room = t.vehicles.length > 0 && !openAhead ? Math.max(maxLat, t.rh[target] - 0.9) : maxLat;
    if (t.vehicles.length > 0) {
      const lap = t.n * t.step;
      const mine = t.prog[s.seg] * t.step + proj.along;
      for (const veh of t.vehicles) {
        // Abstand zur Fahrzeugmitte des vordersten Wagens, entlang der Hauptstrecke
        let d = vehicleAt(veh, ctx.time, lap) - mine;
        if (d > lap / 2) d -= lap;
        else if (d < -lap / 2) d += lap;
        const rear = d - (veh.cars - 1) * veh.pitch - veh.half;
        const front = d + veh.half;
        if (front < -1.5 || rear > range) continue;
        // Nur, wenn mein Weg dort auf der Hauptstrecke liegt (nicht auf den Dächern oder in der Röhre).
        const there = aheadSeg(Math.max(0, rear));
        if (t.branchOf[there] >= 0 && t.twin[there] < 0) continue;
        if (Number.isNaN(offTarget) || Number.isNaN(offHere)) continue;
        // Wer langsamer ist als das Fahrzeug und dahinter, holt es nicht ein.
        if (rear > 6 && vf < veh.speed + 1) continue;
        const vl = (veh.lat * t.rh[target]) / t.def.roadHalf;
        // Wie bald bin ich dort? Was in zwei Sekunden neben mir ist, zählt voll.
        const eta = rear <= 0 ? 0 : rear / Math.max(2, vf - veh.speed);
        // In der Kurve schwenkt das Heck eines langen Fahrzeugs aus; im Drift fährt man selbst ungenauer.
        const margin = KART_HALF + 0.6 + veh.half * veh.half * Math.abs(t.curv[there]) * 0.5 + (s.driftDir !== 0 ? 0.4 : 0);
        if (eta < 1.2) close = true;
        block(vl - offTarget - veh.halfWidth - margin, vl - offTarget + veh.halfWidth + margin, eta < 2 ? 1 : Math.max(0.15, 1 - (eta - 2) / 3));
        // Direkt davor und zu schnell: vom Gas.
        if (rear > 0 && rear < 5 + (vf - veh.speed) * 0.7 && Math.abs(here - (vl - offHere)) < veh.halfWidth + margin - 0.3) jam = true;
      }
    }
    let bubbleAt = 60;
    for (const p of t.pulses) {
      let d = -1;
      for (let k = 1; k < PATH.length && k * t.step <= range; k++) {
        if (PATH[k] === p.seg) {
          d = k * t.step;
          break;
        }
      }
      if (d < 0) continue;
      // Ist die Stelle gefährlich, wenn ich dort ankomme (mit etwas Spielraum davor und danach)?
      const eta = (d / Math.max(v, 8)) * 60;
      const c0 = pulseCycle(p, ctx.time + eta - 14);
      const c1 = pulseCycle(p, ctx.time + eta + 14);
      if (p.kind === PULSE_AVALANCHE) {
        // Eine Lawine sperrt die ganze Bahn: wer bei der Ankunft hineingeriete, nimmt vorher Tempo heraus
        // (wer schon drinsteckt, fährt weiter).
        const inSnow = d < p.radius;
        const c = pulseCycle(p, ctx.time + ((d - p.radius) / Math.max(v, 8)) * 60);
        const out = pulseCycle(p, ctx.time + ((d + p.radius) / Math.max(v, 8)) * 60);
        if (!inSnow && (c < p.on + 6 || out < p.on || out < c)) {
          jam = true;
          // So schnell, dass es vor dem Schnee noch zum Stehen reicht (gerechnet mit dem schwachen Bremsen auf Eis).
          haltSpeed = Math.min(haltSpeed, Math.sqrt(Math.max(0, 4.4 * (d - p.radius - 2.5))));
        }
        continue;
      }
      if (p.kind === PULSE_BUBBLE) {
        // Ein Blasenschlot ist kein Hindernis, sondern ein Sprungbrett: wer aufpasst, hält auf den nächsten zu,
        // der bei der Ankunft sicher bläst (darüber hängt ein Schubring).
        if (b.level > 0 && d < bubbleAt && c0 < p.on && c1 < p.on && c1 > c0) {
          bubbleAt = d;
          lat = p.lat;
        }
        continue;
      }
      if (c0 < p.on || c1 < p.on || c1 < c0) block(p.lat - p.radius - KART_HALF - 0.5, p.lat + p.radius + KART_HALF + 0.5, 1);
    }
    // Bruchstellen: was bei meiner Ankunft weggebrochen ist (oder gerade bricht), ist gesperrt.
    for (const h of t.holes) {
      let d = -1;
      for (let k = 0; k < PATH.length && k * t.step <= range + 12; k++) {
        if (PATH[k] >= h.first && PATH[k] < h.first + h.count) {
          d = k * t.step;
          break;
        }
      }
      if (d < 0) continue;
      const eta = (d / Math.max(v, 8)) * 60;
      if (planActive(h.plan, ctx.time + eta + 45) || planActive(h.plan, ctx.time + eta)) block(h.lat0 - KART_HALF - 0.7, h.lat1 + KART_HALF + 0.7, 1);
    }
    // Tor voraus und noch zu: vom Gas, bis es offen ist.
    for (const g of t.gates) {
      for (let k = 1; k < PATH.length && k * t.step <= range; k++) {
        if (PATH[k] !== g.first) continue;
        if (planActive(g.plan, ctx.time + ((k * t.step) / Math.max(v, 8)) * 60)) {
          jam = true;
          haltSpeed = Math.min(haltSpeed, Math.sqrt(Math.max(0, 20 * (k * t.step - 6))));
        }
        break;
      }
    }
    AI_TRACE.here = here;
    AI_TRACE.want = lat;
    AI_TRACE.blocks = '';
    for (let k = 0; k < blocks; k++) AI_TRACE.blocks += `[${BLOCK_LO[k].toFixed(1)},${BLOCK_HI[k].toFixed(1)} w${BLOCK_W[k].toFixed(1)}]`;
    // Förderbänder: auf das schnellste Band zuhalten, rückwärts laufende meiden.
    for (const belt of t.belts) {
      if (target < belt.first || target >= belt.first + belt.count) continue;
      if (belt.along > 1) lat = Math.max(belt.lat0 + 0.9, Math.min(belt.lat1 - 0.9, lat));
      else if (belt.along < -1) block(belt.lat0 - 0.4, belt.lat1 + 0.4, 0.5);
    }
    // Flut: wo das Wasser bei meiner Ankunft tiefer als eine Handbreit steht, lieber nicht fahren.
    if (t.tide && t.tidal[target]) {
      const level = tideLevel(t.tide, ctx.time + (look / Math.max(v, 8)) * 60) + 0.05;
      const tilt = t.bank[target];
      const dry = t.py[target] + 0.12;
      if (Math.abs(tilt) > 0.012) {
        // Die Wasserlinie quer zur Fahrbahn: auf der tiefen Seite steht es, auf der hohen ist es trocken.
        // Steht es auf der Wunschlinie mehr als knöcheltief, wird ausgewichen – sonst nur, wenn es wenig kostet.
        const line = (level - dry) / tilt;
        const weight = level - (t.py[target] + lat * tilt) > 0.15 ? 1 : 0.5;
        if (tilt > 0) block(-99, line + 0.9, weight);
        else block(line - 0.9, 99, weight);
        shallow = tilt > 0 ? 1 : -1;
      }
    }
    if (blocks > 0) {
      const free = freeLat(lat, here, room);
      // Alles dicht? Im Verkehr heißt das bremsen; steht nur überall Wasser, dann dort durch, wo es am flachsten ist.
      if (!Number.isNaN(free)) lat = free;
      else if (t.vehicles.length > 0) jam = true;
      else if (shallow !== 0) lat = shallow * room;
    }
  }
  AI_TRACE.lat = lat;
  AI_TRACE.jam = jam;
  const txp = t.px[target] + rightX(t, target) * lat;
  const tzp = t.pz[target] + rightZ(t, target) * lat;
  let err = wrapAngle(Math.atan2(txp - s.x, tzp - s.z) - s.heading);
  // In der Böe schräg gegen den Wind stellen, so dass die Fahrt unterm Strich geradeaus geht.
  if (t.winds.length > 0) {
    projectOnTrack(t, s.x, s.z, s.seg);
    const blow = windPush(t, proj.seg, proj.along, proj.lat, ctx.time);
    if (blow !== 0) err += Math.atan2(blow * (air ? 1.4 : 1), Math.max(v, 10)) * (b.level > 0 ? 1 : 0.7);
  }
  // Rechts lenken verkleinert die Blickrichtung → Vorzeichen umdrehen.
  const wantYaw = -err * 4.2;

  // --- Festgefahren? Kurz zurücksetzen. ---
  if (b.reverse > 0) {
    b.reverse--;
    return { steer: Math.round(Math.max(-1, Math.min(1, err * 2)) * 127), buttons: BTN_BRAKE };
  }
  if (v < 1.5 && s.spin === 0 && !air) {
    if (++b.stuck > 80) {
      b.stuck = 0;
      b.reverse = 45;
    }
  } else b.stuck = 0;

  // --- Tempo: so schnell, wie die engste Stelle voraus es zulässt ---
  const brakeDist = (v * v) / 70 + 8;
  const tight = maxCurvatureAhead(brakeDist);
  const mayDrift = !openAhead && !gapAhead && !close;
  // Wer driftet, kommt enger herum als mit normaler Lenkung und darf schneller hinein.
  const cornering = tight > b.driftFrom && mayDrift ? A_LAT * DRIFT_TIGHT * 0.86 : A_LAT * (openAhead ? 0.8 : 0.92);
  const limit = tight > 1e-4 ? Math.sqrt(cornering / tight) : 99;
  let buttons = 0;
  // Vor einem Sprung zählt nur Anlauf.
  if (gapAhead || v < limit + 0.5) buttons |= BTN_GAS;
  else if (v > limit + 5) buttons |= BTN_BRAKE;
  // Kein Durchkommen im Verkehr: bremsen, bis sich eine Lücke auftut.
  if (jam && !gapAhead) buttons = (buttons & ~BTN_GAS) | (v > haltSpeed ? BTN_BRAKE : 0);

  // --- Lenken und Driften ---
  const here0 = SURFACES[t.surf[s.seg]] ?? SURFACES[0];
  const yawMax = v < 0.3 ? 0 : Math.min(v / R_MIN, (A_LAT * (here0.turn ?? here0.grip)) / v);
  let steer: number;
  if (flying) {
    // Im Gleitflug lenkt es sich weich, aber wirksam.
    steer = Math.max(-1, Math.min(1, -err * 2.6));
  } else if (air) {
    // In der Luft nur sanft ausrichten.
    steer = Math.max(-0.5, Math.min(0.5, -err * 2));
  } else if (s.driftDir !== 0) {
    b.drifting++;
    const stillTurning = near * s.driftDir > 1 / 55;
    // Mindestens bis Stufe 1 halten, sofern die Kurve nicht schon vorbei ist.
    if (mayDrift && (stillTurning || (b.drifting < 40 && near * s.driftDir > 1 / 120))) buttons |= BTN_DRIFT;
    const k = yawMax > 0 ? (wantYaw * s.driftDir) / yawMax : 0;
    // Ein Drift dreht immer weiter nach innen. Will die Ziellinie weiter hinaus, als selbst der weiteste Driftbogen
    // erlaubt, und ist der Innenrand schon nah, hilft nur loslassen – sonst zieht es das Kart in den Seitenstreifen
    // (so geschehen in der Steilkurve hinter der Werkshof-Brücke; Ursache gefunden in Codex' Bericht C-006).
    const inner = ((s.x - t.px[s.seg]) * rightX(t, s.seg) + (s.z - t.pz[s.seg]) * rightZ(t, s.seg)) * s.driftDir;
    // (Auf schmaler Bahn – Bobbahn, Steg – ist der Spielraum kleiner: dort erst dichter am Rand.)
    if (k < DRIFT_WIDE && inner > t.rh[s.seg] - DRIFT_INNER_MARGIN * Math.min(1, (t.rh[s.seg] - 3) / 3.5)) buttons &= ~BTN_DRIFT;
    // Hinter einem Fahrzeug eingeklemmt: Drift halten – loslassen würde den Mini-Turbo zünden.
    if (jam) buttons |= BTN_DRIFT;
    const into = ((k - DRIFT_WIDE) / (DRIFT_TIGHT - DRIFT_WIDE)) * 2 - 1;
    steer = Math.max(-1, Math.min(1, into)) * s.driftDir;
  } else {
    b.drifting = 0;
    steer = yawMax > 0 ? Math.max(-1, Math.min(1, wantYaw / yawMax)) : 0;
    const dir = near > 0 ? 1 : -1;
    const turnAhead = Math.abs(curvatureAhead(0, 30)) * 30;
    if (
      mayDrift &&
      Math.abs(near) > b.driftFrom &&
      turnAhead > 0.55 &&
      vf > 14 &&
      Math.sign(steer) === dir &&
      Math.abs(err) < 0.6
    ) {
      buttons |= BTN_DRIFT;
      steer = dir * Math.max(0.3, Math.abs(steer));
    }
  }
  // In einer Rauchwolke sieht auch die KI schlecht: sie eiert.
  if (ctx.smoke && !air) steer = Math.max(-1, Math.min(1, steer + Math.sin(ctx.tick * 0.23 + b.line) * 0.45));

  // --- Items ---
  let press = false;
  if (s.item === ITEM_NONE) {
    b.holding = 0;
  } else {
    if (b.holding++ === 0) b.patience = Math.round((150 + Math.floor(random(b) * 330)) * PATIENCE_FACTOR[b.level]);
    const aligned = Math.abs(err) < 0.2;
    const straight = maxCurvatureAhead(45) < 1 / 70;
    const late = b.holding > b.patience;
    projectOnTrack(t, s.x, s.z, s.seg);
    const myLat = proj.lat;
    let ahead = Infinity;
    let behind = Infinity;
    let inLine = false;
    for (const o of others) {
      const d = segDelta(t, s.seg, o.seg) * t.step;
      if (d > 0) ahead = Math.min(ahead, d);
      else behind = Math.min(behind, -d);
      if (d > 4 && d < 34 && Math.abs(o.y - s.y) < 2) {
        projectOnTrack(t, o.x, o.z, o.seg);
        if (Math.abs(proj.lat - myLat) < 3.5) inLine = true;
      }
    }
    switch (s.item) {
      case ITEM_BOOST:
        // Auf geraden Stücken zünden, nicht vor einer Kurve.
        press = s.boost === 0 && v > 12 && straight && b.holding > 30 && !openAhead;
        break;
      case ITEM_TIRE:
        press = (aligned && inLine) || (late && aligned);
        break;
      case ITEM_OIL:
      case ITEM_SMOKE:
        press = (behind > 2 && behind < 16) || late;
        break;
      case ITEM_TOP:
        press = b.holding > 40 && ((ahead > 6 && ahead < 110) || late);
        break;
      case ITEM_GUARD:
        press = b.holding > 50;
        break;
      case ITEM_EMP:
        press = b.holding > 50 && (ctx.place > 1 || late);
        break;
      case ITEM_KITE:
        // Der Drache lenkt selbst – sofort nutzen.
        press = b.holding > 25 && !air;
        break;
      case ITEM_SPRING:
        // Nur wo nichts passieren kann: gerade, mit Bande, kein Sprung voraus.
        press = late && straight && !air && (edgesAhead(70) & (EDGE_GAP | EDGE_OPEN_L | EDGE_OPEN_R)) === 0;
        break;
    }
  }
  // Die Taste braucht eine Flanke: nie zwei Schritte hintereinander drücken.
  if (press && !b.itemPressed) buttons |= BTN_ITEM;
  b.itemPressed = (buttons & BTN_ITEM) !== 0;

  return { steer: Math.round(steer * 127), buttons };
}

const BAND_AHEAD = [0.2, 0.14, 0.07];
const BAND_BEHIND = [0.03, 0.06, 0.1];

/**
 * Milder Tempo-Ausgleich: liegt ein KI-Fahrer weit vor den Menschen, wird er
 * etwas langsamer, liegt er weit zurück, etwas schneller. Der Faktor wirkt nur
 * auf die Höchstgeschwindigkeit und bleibt in engen Grenzen.
 * @param aheadMeters Vorsprung auf den besten Menschen (negativ = Rückstand)
 */
export function rubberBand(aheadMeters: number, level = AI_MEDIUM): number {
  const l = Math.max(0, Math.min(2, level | 0));
  const k = Math.max(-1, Math.min(1, aheadMeters / 80));
  return k > 0 ? 1 - k * BAND_AHEAD[l] : 1 - k * BAND_BEHIND[l];
}
