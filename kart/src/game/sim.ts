// Die Simulation eines Fahrzeugs – in Phase 1 ein einfacher Würfel.
//
// Wichtig für das Netzwerk: stepKart ist eine reine Funktion aus
// (Zustand, Eingabe) → neuer Zustand mit festem Zeitschritt. Der Host und die
// Vorhersage auf den Client-Bildschirmen rufen exakt denselben Code auf.
// Die echte Kart-Physik aus Phase 2 ersetzt nur den Inhalt dieser Datei.

export const TICK_RATE = 60;
export const DT = 1 / TICK_RATE;
export const MAX_PLAYERS = 4;

/** Halbe Kantenlänge der Testfläche in Metern. */
export const ARENA_HALF = 45;

export const BTN_GAS = 1;
export const BTN_BRAKE = 2;
export const BTN_DRIFT = 4;
export const BTN_ITEM = 8;

/** Eine Eingabe für genau einen Simulationsschritt. */
export interface Cmd {
  /** Lenkung als Ganzzahl -127..127, damit Host und Client denselben Wert rechnen. */
  steer: number;
  /** Bitmaske aus BTN_* */
  buttons: number;
}

export const FLAG_ITEM_HELD = 1;
export const FLAG_DRIFT = 2;

export interface KartState {
  x: number;
  z: number;
  y: number;
  vy: number;
  /** Blickrichtung in Radiant; 0 = +Z, vorwärts = (sin, cos). Rechts lenken verkleinert den Wert. */
  heading: number;
  /** Tempo entlang der Blickrichtung in m/s, negativ = rückwärts. */
  speed: number;
  flags: number;
}

const MAX_SPEED = 22;
const MAX_REVERSE = 8;
const ACCEL = 26;
const BRAKE = 44;
const REVERSE_ACCEL = 16;
const ROLL_DRAG = 9;
const TURN_RATE = 2.5;
const DRIFT_TURN = 1.45;
const JUMP_SPEED = 7.5;
const GRAVITY = 24;
const WALL = ARENA_HALF - 1.2;

export function newState(): KartState {
  return { x: 0, z: 0, y: 0, vy: 0, heading: 0, speed: 0, flags: 0 };
}

export function copyState(dst: KartState, src: KartState): KartState {
  dst.x = src.x;
  dst.z = src.z;
  dst.y = src.y;
  dst.vy = src.vy;
  dst.heading = src.heading;
  dst.speed = src.speed;
  dst.flags = src.flags;
  return dst;
}

/** Startaufstellung: nebeneinander, Blick zur Flächenmitte. */
export function spawnState(slot: number): KartState {
  const s = newState();
  s.x = (slot - (MAX_PLAYERS - 1) / 2) * 5;
  s.z = -18;
  return s;
}

export function stepKart(s: KartState, cmd: Cmd): void {
  const steer = Math.max(-1, Math.min(1, cmd.steer / 127));
  const gas = (cmd.buttons & BTN_GAS) !== 0;
  const brake = (cmd.buttons & BTN_BRAKE) !== 0;
  const drift = (cmd.buttons & BTN_DRIFT) !== 0;
  const item = (cmd.buttons & BTN_ITEM) !== 0;

  // Längsbewegung
  if (gas && !brake) {
    s.speed += ACCEL * DT;
  } else if (brake) {
    s.speed -= (s.speed > 0.2 ? BRAKE : REVERSE_ACCEL) * DT;
  } else {
    const drag = ROLL_DRAG * DT;
    if (s.speed > drag) s.speed -= drag;
    else if (s.speed < -drag) s.speed += drag;
    else s.speed = 0;
  }
  if (s.speed > MAX_SPEED) s.speed = MAX_SPEED;
  if (s.speed < -MAX_REVERSE) s.speed = -MAX_REVERSE;

  // Lenkung: im Stand keine Drehung, ab ca. 5 m/s volle Wirkung.
  const grip = Math.min(1, Math.abs(s.speed) / 5);
  const dir = s.speed >= 0 ? 1 : -1;
  const drifting = drift && Math.abs(s.speed) > 6;
  // Minus: mit Y nach oben liegt "rechts" in Richtung kleinerer Winkel.
  s.heading -= steer * TURN_RATE * (drifting ? DRIFT_TURN : 1) * grip * dir * DT;
  if (s.heading > Math.PI) s.heading -= 2 * Math.PI;
  else if (s.heading < -Math.PI) s.heading += 2 * Math.PI;

  s.x += Math.sin(s.heading) * s.speed * DT;
  s.z += Math.cos(s.heading) * s.speed * DT;

  // Item-Knopf: in Phase 1 ein Hüpfer, damit man den Knopf auf allen Bildschirmen sieht.
  const itemHeld = (s.flags & FLAG_ITEM_HELD) !== 0;
  if (item && !itemHeld && s.y === 0) s.vy = JUMP_SPEED;
  if (s.y > 0 || s.vy > 0) {
    s.vy -= GRAVITY * DT;
    s.y += s.vy * DT;
    if (s.y <= 0) {
      s.y = 0;
      s.vy = 0;
    }
  }

  // Bande: Position begrenzen und Tempo abbauen.
  let hit = false;
  if (s.x > WALL) {
    s.x = WALL;
    hit = true;
  } else if (s.x < -WALL) {
    s.x = -WALL;
    hit = true;
  }
  if (s.z > WALL) {
    s.z = WALL;
    hit = true;
  } else if (s.z < -WALL) {
    s.z = -WALL;
    hit = true;
  }
  if (hit) s.speed *= 0.86;

  s.flags = (item ? FLAG_ITEM_HELD : 0) | (drifting ? FLAG_DRIFT : 0);
}
