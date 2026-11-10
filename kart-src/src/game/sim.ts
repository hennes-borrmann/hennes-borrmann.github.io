// Fahrphysik eines Karts.
//
// stepKart ist eine reine Funktion aus (Zustand, Eingabe, Umgebung) → neuer
// Zustand mit festem Zeitschritt. Der Host und die Vorhersage auf den
// Mitspieler-Bildschirmen rufen exakt denselben Code auf – deshalb steckt
// alles, was das Kart allein betrifft, hier drin: Beschleunigen, Lenken,
// Drift mit Mini-Turbo, Untergrund, Bande, Boost-Felder und das Auslösen von
// Items. Was mehrere Fahrzeuge betrifft (Rempler, Treffer, Kisten), entscheidet
// nur der Host (world.ts).
//
// Alle Zeiten im Zustand sind ganze Simulationsschritte ("Ticks", 60 pro
// Sekunde): das rechnet auf jedem Gerät identisch und passt in ein Byte.

import { TRACK, proj, projectOnTrack, rightX, rightZ, segDelta, trackHeading, gridPosition } from './track';

export const TICK_RATE = 60;
export const DT = 1 / TICK_RATE;
export const MAX_PLAYERS = 4;

export const BTN_GAS = 1;
export const BTN_BRAKE = 2;
export const BTN_DRIFT = 4;
export const BTN_ITEM = 8;

export const ITEM_NONE = 0;
/** "Zisch": kurzer, kräftiger Schub. */
export const ITEM_BOOST = 1;
/** "Rollreifen": rollt geradeaus, prallt an der Bande ab, wirft Getroffene aus der Bahn. */
export const ITEM_TIRE = 2;
/** "Ölfleck": bleibt hinter dem Kart liegen. */
export const ITEM_OIL = 3;

/** Eine Eingabe für genau einen Simulationsschritt. */
export interface Cmd {
  /** Lenkung als Ganzzahl -127..127 (rechts positiv), damit Host und Client denselben Wert rechnen. */
  steer: number;
  /** Bitmaske aus BTN_* */
  buttons: number;
}

/** Was von außen auf das Kart wirkt, aber nicht zu seinem Zustand gehört. */
export interface StepEnv {
  /** false während des Countdowns und nach der Zieldurchfahrt. */
  canDrive: boolean;
  /** Faktor auf die Höchstgeschwindigkeit (nur für KI-Gegner ungleich 1). */
  speedFactor: number;
}

export const FLAG_ITEM_HELD = 1;
export const FLAG_OFFROAD = 2;
export const FLAG_WALL = 4;

export interface KartState {
  x: number;
  z: number;
  /** Blickrichtung in Radiant; 0 = +Z, vorwärts = (sin, cos). Rechts lenken verkleinert den Wert. */
  heading: number;
  vx: number;
  vz: number;
  /** Streckenabschnitt, in dem sich das Kart befindet. */
  seg: number;
  /** Verbleibende Ticks Schub. */
  boost: number;
  /** Driftrichtung: -1 links, 0 kein Drift, 1 rechts. */
  driftDir: number;
  /** Aufgeladener Mini-Turbo, 0..255. */
  driftCharge: number;
  /** Verbleibende Ticks Schleudern nach einem Treffer. */
  spin: number;
  /** Verbleibende Ticks, in denen kein weiterer Treffer wirkt. */
  shield: number;
  item: number;
  /** Das Item, das nach der Auslosung erscheint. */
  nextItem: number;
  /** Verbleibende Ticks der Auslosung. */
  roulette: number;
  flags: number;
}

// --- Ereignisse eines Schritts (Rückgabewert von stepKart) -------------------

export const EV_USE_BOOST = 1;
export const EV_USE_TIRE = 2;
export const EV_USE_OIL = 4;
export const EV_TURBO = 8;
export const EV_WALL = 16;
export const EV_PAD = 32;
export const EV_DRIFT_START = 64;
export const EV_ITEM_READY = 128;

// --- Abstimmung --------------------------------------------------------------
// Diese Werte bestimmen das Fahrgefühl. Geschwindigkeiten in m/s.

export const V_MAX = 26;
export const V_BOOST = 34;
const V_REVERSE = 8;
/** Beschleunigung aus dem Stand; nimmt zur Höchstgeschwindigkeit hin ab. */
const ACCEL = 30;
const BOOST_ACCEL = 60;
const BRAKE = 46;
const COAST = 7;
const OFFROAD_FACTOR = 0.55;
/** Kleinster Wendekreis bei langsamer Fahrt (Meter). */
const R_MIN = 4.5;
/** Querbeschleunigung, die die Reifen bei schneller Fahrt halten (m/s²). */
const A_LAT = 31;
/** Wie schnell die Fahrtrichtung der Blickrichtung folgt (1/s). Hoch = griffig. */
const GRIP = 14;
const GRIP_DRIFT = 3.6;
const DRIFT_MIN_SPEED = 11;
/** Lenkbereich im Drift als Vielfaches der normalen Höchst-Drehrate: weit … eng. */
const DRIFT_WIDE = 0.55;
const DRIFT_TIGHT = 1.55;
/** Ladung, ab der Stufe 1, 2 und 3 des Mini-Turbos erreicht ist. */
export const TURBO_AT = [50, 115, 190];
const TURBO_TICKS = [30, 57, 90];
const PAD_TICKS = 60;
const ITEM_BOOST_TICKS = 100;
export const SPIN_TICKS = 75;
const SHIELD_TICKS = 130;
export const KART_RADIUS = 1.0;

export const NEUTRAL: Cmd = { steer: 0, buttons: 0 };

export function newState(): KartState {
  return {
    x: 0,
    z: 0,
    heading: 0,
    vx: 0,
    vz: 0,
    seg: 0,
    boost: 0,
    driftDir: 0,
    driftCharge: 0,
    spin: 0,
    shield: 0,
    item: ITEM_NONE,
    nextItem: ITEM_NONE,
    roulette: 0,
    flags: 0,
  };
}

export function copyState(dst: KartState, src: KartState): KartState {
  dst.x = src.x;
  dst.z = src.z;
  dst.heading = src.heading;
  dst.vx = src.vx;
  dst.vz = src.vz;
  dst.seg = src.seg;
  dst.boost = src.boost;
  dst.driftDir = src.driftDir;
  dst.driftCharge = src.driftCharge;
  dst.spin = src.spin;
  dst.shield = src.shield;
  dst.item = src.item;
  dst.nextItem = src.nextItem;
  dst.roulette = src.roulette;
  dst.flags = src.flags;
  return dst;
}

/** Zustand am Startplatz. */
export function gridState(slot: number): KartState {
  const g = gridPosition(TRACK, slot);
  const s = newState();
  s.x = g.x;
  s.z = g.z;
  s.heading = g.heading;
  s.seg = g.seg;
  return s;
}

/** Stufe des Mini-Turbos für eine Ladung: 0 (noch nichts) bis 3. */
export function turboStage(charge: number): number {
  if (charge >= TURBO_AT[2]) return 3;
  if (charge >= TURBO_AT[1]) return 2;
  if (charge >= TURBO_AT[0]) return 1;
  return 0;
}

/** Vorwärtsgeschwindigkeit (negativ = rückwärts). */
export function forwardSpeed(s: KartState): number {
  return s.vx * Math.sin(s.heading) + s.vz * Math.cos(s.heading);
}

/** Treffer durch Rollreifen oder Ölfleck. Liefert false, wenn das Kart gerade geschützt ist. */
export function hitKart(s: KartState): boolean {
  if (s.shield > 0 || s.spin > 0) return false;
  s.spin = SPIN_TICKS;
  s.shield = SPIN_TICKS + SHIELD_TICKS;
  s.driftDir = 0;
  s.driftCharge = 0;
  s.boost = 0;
  s.vx *= 0.45;
  s.vz *= 0.45;
  return true;
}

function wrapAngle(a: number): number {
  if (a > Math.PI) return a - 2 * Math.PI;
  if (a < -Math.PI) return a + 2 * Math.PI;
  return a;
}

export function stepKart(s: KartState, cmd: Cmd, env: StepEnv): number {
  const t = TRACK;
  let ev = 0;

  // --- Zeitgeber ---
  if (s.boost > 0) s.boost--;
  if (s.shield > 0) s.shield--;
  const spinning = s.spin > 0;
  if (spinning) s.spin--;
  if (s.roulette > 0) {
    s.roulette--;
    if (s.roulette === 0) {
      s.item = s.nextItem;
      s.nextItem = ITEM_NONE;
      ev |= EV_ITEM_READY;
    }
  }

  const drive = env.canDrive && !spinning;
  const steer = drive ? Math.max(-1, Math.min(1, cmd.steer / 127)) : 0;
  const gas = drive && (cmd.buttons & BTN_GAS) !== 0;
  const brake = drive && (cmd.buttons & BTN_BRAKE) !== 0;
  const driftBtn = drive && (cmd.buttons & BTN_DRIFT) !== 0;
  const itemBtn = (cmd.buttons & BTN_ITEM) !== 0;
  const wasOffroad = (s.flags & FLAG_OFFROAD) !== 0;

  let fx = Math.sin(s.heading);
  let fz = Math.cos(s.heading);
  let vf = s.vx * fx + s.vz * fz;

  // --- Drift beginnen oder beenden ---
  if (s.driftDir !== 0) {
    if (!driftBtn || vf < DRIFT_MIN_SPEED * 0.6) {
      // Nur wer die Taste loslässt, bekommt den Mini-Turbo. Wer zu langsam wird, verliert ihn.
      const stage = turboStage(s.driftCharge);
      if (drive && !driftBtn && stage > 0) {
        s.boost = Math.max(s.boost, TURBO_TICKS[stage - 1]);
        ev |= EV_TURBO;
      }
      s.driftDir = 0;
      s.driftCharge = 0;
    }
  } else if (driftBtn && vf > DRIFT_MIN_SPEED && Math.abs(steer) > 0.2) {
    s.driftDir = steer > 0 ? 1 : -1;
    s.driftCharge = 0;
    ev |= EV_DRIFT_START;
  }

  // --- Lenken ---
  // Langsam: fester kleinster Wendekreis. Schnell: begrenzt durch die Haftung.
  const v = Math.abs(vf);
  const yawMax = v < 0.3 ? 0 : Math.min(v / R_MIN, A_LAT / v);
  let yaw: number;
  if (s.driftDir !== 0) {
    // Im Drift dreht das Kart immer in Driftrichtung; die Lenkung wählt nur
    // zwischen weitem und engem Bogen. Eng hineinlenken lädt schneller.
    const into = steer * s.driftDir;
    yaw = s.driftDir * yawMax * (DRIFT_WIDE + ((DRIFT_TIGHT - DRIFT_WIDE) * (into + 1)) / 2);
    s.driftCharge = Math.min(255, s.driftCharge + (into > 0.35 ? 2 : 1));
  } else {
    yaw = steer * yawMax * (vf < 0 ? -1 : 1);
  }
  s.heading = wrapAngle(s.heading - yaw * DT);
  fx = Math.sin(s.heading);
  fz = Math.cos(s.heading);
  const rx = -fz;
  const rz = fx;

  // --- Haftung: die Fahrtrichtung folgt der Blickrichtung ---
  // Der seitliche Anteil wird nicht weggebremst, sondern in Fahrtrichtung
  // umgelenkt. So kostet Kurvenfahren kein Tempo ("griffig"), und im Drift
  // (geringe Haftung) rutscht das Heck sichtbar nach außen.
  vf = s.vx * fx + s.vz * fz;
  let vl = s.vx * rx + s.vz * rz;
  const speed = Math.hypot(vf, vl);
  const grip = s.driftDir !== 0 ? GRIP_DRIFT : spinning ? 2.5 : GRIP;
  vl *= Math.exp(-grip * DT);
  vf = (vf < 0 ? -1 : 1) * Math.sqrt(Math.max(0, speed * speed - vl * vl));

  // --- Beschleunigen und Bremsen ---
  const boosting = s.boost > 0;
  let vmax = V_MAX * env.speedFactor;
  if (boosting) vmax = V_BOOST * env.speedFactor;
  else if (wasOffroad) vmax *= OFFROAD_FACTOR;

  if (!env.canDrive) {
    // Countdown oder Ziel: zügig zum Stehen kommen.
    const d = BRAKE * 0.5 * DT;
    vf = vf > d ? vf - d : vf < -d ? vf + d : 0;
    vl *= 0.9;
  } else if (spinning) {
    const d = 16 * DT;
    vf = vf > d ? vf - d : vf < -d ? vf + d : 0;
  } else if (boosting) {
    // Schub wirkt auch ohne Gas.
    if (vf < vmax) vf = Math.min(vmax, vf + BOOST_ACCEL * DT);
  } else if (gas && !brake) {
    if (vf < vmax) vf = Math.min(vmax, vf + ACCEL * (1 - (0.75 * Math.max(0, vf)) / vmax) * DT);
    else vf = Math.max(vmax, vf - (wasOffroad ? 34 : 10) * DT);
  } else if (brake) {
    if (vf > 0.4) vf = Math.max(0, vf - BRAKE * DT);
    else vf = Math.max(-V_REVERSE, vf - 16 * DT);
  } else {
    const d = (wasOffroad ? COAST + 12 : COAST) * DT;
    vf = vf > d ? vf - d : vf < -d ? vf + d : 0;
  }

  s.vx = fx * vf + rx * vl;
  s.vz = fz * vf + rz * vl;
  s.x += s.vx * DT;
  s.z += s.vz * DT;

  // --- Strecke: Abschnitt, Bande, Untergrund ---
  projectOnTrack(t, s.x, s.z, s.seg);
  s.seg = proj.seg;
  let lat = proj.lat;
  let flags = itemBtn ? FLAG_ITEM_HELD : 0;
  const limit = t.wallHalf - KART_RADIUS;
  if (Math.abs(lat) > limit) {
    const side = lat > 0 ? 1 : -1;
    const nx = rightX(t, s.seg) * side;
    const nz = rightZ(t, s.seg) * side;
    const over = Math.abs(lat) - limit;
    s.x -= nx * over;
    s.z -= nz * over;
    lat = side * limit;
    flags |= FLAG_WALL;
    const vn = s.vx * nx + s.vz * nz;
    if (vn > 0) {
      // Den Anteil in die Bande hinein umkehren (leichtes Abprallen), den Rest
      // entlangrutschen lassen. Streifen kostet wenig, ein Frontalaufprall viel.
      s.vx -= nx * vn * 1.3;
      s.vz -= nz * vn * 1.3;
      const loss = Math.min(0.55, 0.008 + vn * 0.03);
      s.vx *= 1 - loss;
      s.vz *= 1 - loss;
      if (vn > 5) {
        ev |= EV_WALL;
        s.driftDir = 0;
        s.driftCharge = 0;
      }
      // Hilfe: das Kart dreht sich an der Bande von selbst ein Stück in
      // Fahrtrichtung der Strecke, damit man nicht frontal hängen bleibt.
      const along = wrapAngle(trackHeading(t, s.seg) - s.heading);
      if (Math.abs(along) < Math.PI / 2) s.heading = wrapAngle(s.heading + along * 0.08);
    }
  }
  if (Math.abs(lat) > t.roadHalf + 0.3) flags |= FLAG_OFFROAD;

  // --- Boost-Felder ---
  if (vf > 6 && s.boost < PAD_TICKS - 8) {
    for (const pad of t.pads) {
      const d = segDelta(t, pad.seg, s.seg);
      if (d >= 0 && d <= pad.length && Math.abs(lat - pad.lat) < pad.halfWidth + 0.5) {
        s.boost = PAD_TICKS;
        ev |= EV_PAD;
      }
    }
  }

  // --- Item auslösen (bei Tastendruck, nicht beim Halten) ---
  if (itemBtn && (s.flags & FLAG_ITEM_HELD) === 0 && drive && s.item !== ITEM_NONE) {
    if (s.item === ITEM_BOOST) {
      s.boost = Math.max(s.boost, ITEM_BOOST_TICKS);
      ev |= EV_USE_BOOST;
    } else if (s.item === ITEM_TIRE) ev |= EV_USE_TIRE;
    else ev |= EV_USE_OIL;
    s.item = ITEM_NONE;
  }

  s.flags = flags;
  return ev;
}
