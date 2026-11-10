// Fahrphysik eines Karts.
//
// stepKart ist eine reine Funktion aus (Zustand, Eingabe, Umgebung) → neuer
// Zustand mit festem Zeitschritt. Der Host und die Vorhersage auf den
// Mitspieler-Bildschirmen rufen exakt denselben Code auf – deshalb steckt
// alles, was das Kart allein betrifft, hier drin: Beschleunigen, Lenken,
// Drift mit Mini-Turbo, Untergrund, Bande, Höhen, Sprünge, Abstürze,
// Boost-Felder und das Auslösen von Items. Was mehrere Fahrzeuge betrifft
// (Rempler, Treffer, Kisten), entscheidet nur der Host (hostGame.ts).
//
// Die Strecke ist für die Physik eine Fläche mit Höhe: gelenkt und beschleunigt
// wird in der Ebene, die Höhe folgt dem Boden – außer das Kart hebt ab.
//
// Alle Zeiten im Zustand sind ganze Simulationsschritte ("Ticks", 60 pro
// Sekunde): das rechnet auf jedem Gerät identisch.

import {
  CRASH_SPEED,
  DRAFT_FULL,
  DRAFT_PULL_FROM,
  DRAFT_PULL_TICKS,
  FLOOD_FROM,
  PULSE_VENT,
  WAKE_HALF,
  WAKE_LENGTH,
  floodLevel,
  pulseCycle,
  vehicleAt,
} from './mechanics';
import {
  EDGE_OPEN_L,
  EDGE_OPEN_R,
  NO_GROUND,
  TRACK,
  centerHeight,
  gridPosition,
  groundAt,
  newVehiclePose,
  proj,
  projectOnTrack,
  rightX,
  rightZ,
  samePath,
  segDelta,
  sideLimit,
  trackHeading,
  vehiclePose,
  walk,
  type Track,
} from './track';
import { SURFACES } from './surface';

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
/** "Brummkreisel": folgt der Strecke und sucht das Kart vor dir. */
export const ITEM_TOP = 4;
/** "Stoßfänger": fängt den nächsten Treffer ab. */
export const ITEM_GUARD = 5;
/** "Kurzschluss": bremst alle, die vor dir liegen, kurz aus. */
export const ITEM_EMP = 6;
/** "Nebelkerze": Rauchwolke hinter dem Kart, die die Sicht nimmt. */
export const ITEM_SMOKE = 7;
/** "Sprungfeder": Hüpfer aus dem Stand – über Hindernisse, Öl und Abkürzungen. */
export const ITEM_SPRING = 8;
/** "Abschleppdrache": zieht das Kart ein paar Sekunden von selbst die Strecke entlang – nur für die Hinteren. */
export const ITEM_KITE = 9;
export const ITEM_COUNT = 10;

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
  /**
   * Rennzeit dieses Schritts in Ticks seit "Los" (im Countdown negativ) – der
   * Takt für Verkehr, Geysire und alles andere aus mechanics.ts. Sie gehört zur
   * Eingabe: der Bildschirm eines Mitspielers schickt sie mit, und der Host
   * rechnet dessen Schritt mit genau dieser Zeit nach.
   */
  time: number;
}

export const FLAG_ITEM_HELD = 1;
export const FLAG_OFFROAD = 2;
export const FLAG_WALL = 4;
/** Das Kart ist in der Luft (Sprung, Absturz oder gerade am Kran). */
export const FLAG_AIR = 8;

export interface KartState {
  x: number;
  /** Höhe. */
  y: number;
  z: number;
  /** Blickrichtung in Radiant; 0 = +Z, vorwärts = (sin, cos). Rechts lenken verkleinert den Wert. */
  heading: number;
  vx: number;
  /** Steig- bzw. Fallgeschwindigkeit. */
  vy: number;
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
  /** Verbleibende Ticks Stoßfänger. */
  guard: number;
  /** Verbleibende Ticks Kurzschluss (gedrosselter Motor). */
  stall: number;
  /** Verbleibende Ticks, bis das Kart nach einem Absturz wieder aufgesetzt ist. */
  respawn: number;
  /** Verbleibende Ticks am Abschleppdrachen. */
  tow: number;
  /** Windschatten: Ladung 0..255; ab DRAFT_FULL gibt das Ausscheren Schub. */
  draft: number;
  item: number;
  /** Das Item, das nach der Auslosung erscheint. */
  nextItem: number;
  /** Verbleibende Ticks der Auslosung. */
  roulette: number;
  flags: number;
  /** Gewählte Figur (Index in CHARACTERS) – bestimmt die Fahrwerte. */
  char: number;
}

// --- Ereignisse eines Schritts (Rückgabewert von stepKart) -------------------

export const EV_USE_BOOST = 1 << 0;
export const EV_USE_TIRE = 1 << 1;
export const EV_USE_OIL = 1 << 2;
export const EV_TURBO = 1 << 3;
export const EV_WALL = 1 << 4;
export const EV_PAD = 1 << 5;
export const EV_DRIFT_START = 1 << 6;
export const EV_ITEM_READY = 1 << 7;
export const EV_USE_TOP = 1 << 8;
export const EV_USE_GUARD = 1 << 9;
export const EV_USE_EMP = 1 << 10;
export const EV_USE_SMOKE = 1 << 11;
export const EV_USE_SPRING = 1 << 12;
/** Nach einem Sprung hart gelandet. */
export const EV_LAND = 1 << 13;
/** Abgestürzt – das Kart wird zurückgesetzt. */
export const EV_FALL = 1 << 14;
/** Wieder auf der Strecke. */
export const EV_RESPAWNED = 1 << 15;
/** Vom Boden abgehoben. */
export const EV_TAKEOFF = 1 << 16;
export const EV_USE_KITE = 1 << 17;
/** Der Abschleppdrache hat losgelassen. */
export const EV_TOW_END = 1 << 18;
/** Aus dem Windschatten ausgeschert: Schub. */
export const EV_DRAFT = 1 << 19;
/** Von der Strecke selbst getroffen (Verkehr, Geysir, Lavabombe): das Kart schleudert. */
export const EV_HIT = 1 << 20;
/** … aber der Stoßfänger hat es abgefangen. */
export const EV_BLOCK = 1 << 21;
/** Fährt durch Lava. */
export const EV_BURN = 1 << 22;
export const EV_USE_ANY =
  EV_USE_BOOST | EV_USE_TIRE | EV_USE_OIL | EV_USE_TOP | EV_USE_GUARD | EV_USE_EMP | EV_USE_SMOKE | EV_USE_SPRING | EV_USE_KITE;

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

/** Fallbeschleunigung – kräftiger als in echt, damit Sprünge knackig bleiben. */
export const GRAVITY = 30;
/** Höchste Stufe, die ein Kart ohne Weiteres hinaufkommt; alles darüber ist eine Wand. */
const STEP_MAX = 0.9;
/** Ab dieser Höhe über dem Boden gilt das Kart als "in der Luft". */
const AIR_EPS = 0.15;
/** Lenkwirkung in der Luft. */
const AIR_STEER = 0.35;
/** Bergab schneller, bergauf langsamer: Anteil der Steigung, der auf die Höchstgeschwindigkeit wirkt. */
const SLOPE_EFFECT = 0.6;
const SPRING_SPEED = 10.5;
export const RESPAWN_TICKS = 55;
const RESPAWN_HEIGHT = 2.4;
export const GUARD_TICKS = 12 * 60;
export const STALL_TICKS = 150;
/** Abschleppdrache: Dauer, Tempo, Flughöhe über der Fahrbahn. */
export const TOW_TICKS = 240;
export const V_TOW = 40;
const TOW_LIFT = 1.0;
const TOW_ACCEL = 70;
const TOW_LOOK = 9;
/** Steilkurven: Querneigung über das gewöhnliche Maß hinaus gibt Halt – bis zu diesem Zuschlag. */
const BANK_FROM = 0.2;
const BANK_GRIP = 3;
const BANK_GRIP_MAX = 0.9;

/**
 * Faktor auf den Kurvenhalt in einer Steilkurve. dir = Richtung der Kurve
 * (1 rechts, −1 links); die Neigung hilft nur, wenn sie zur Kurve passt.
 */
export function bankGrip(t: Track, seg: number, dir: number): number {
  const help = -t.bank[seg] * dir - BANK_FROM;
  return help > 0 ? 1 + Math.min(BANK_GRIP_MAX, help * BANK_GRIP) : 1;
}
const STALL_FACTOR = 0.55;

export const NEUTRAL: Cmd = { steer: 0, buttons: 0 };

// --- Figuren -------------------------------------------------------------------
// Die vier Figuren fahren fast gleich – jede hat eine kleine Stärke und zahlt
// dafür an anderer Stelle. Die Faktoren sind so abgestimmt, dass die
// Rundenzeiten auf allen Strecken dicht beieinander liegen (siehe
// tests/unit/characters.test.ts).

export interface Character {
  name: string;
  /** Ein Satz für die Figurenwahl. */
  trait: string;
  /** Anzeige 1..5: Tempo, Beschleunigung, Kurvenlage. */
  bars: [number, number, number];
  /** Faktor auf die Höchstgeschwindigkeit (ohne Schub). */
  vmax: number;
  /** Faktor auf die Beschleunigung. */
  accel: number;
  /** Faktor auf den Halt in schnellen Kurven. */
  grip: number;
  /** Anteil der Höchstgeschwindigkeit neben der Fahrbahn. */
  offroad: number;
  /** Faktor auf die Ladung, die ein Mini-Turbo braucht (kleiner = lädt schneller). */
  charge: number;
  /** Gewicht bei Remplern: Schwere werden weniger weggeschoben. */
  mass: number;
}

export const CHARACTERS: Character[] = [
  {
    name: 'Kolben-Kalle',
    trait: 'Schnell auf der Geraden, braucht etwas länger auf Touren.',
    bars: [5, 2, 3],
    vmax: 1.003,
    accel: 0.88,
    grip: 0.985,
    offroad: OFFROAD_FACTOR,
    charge: 1,
    mass: 1.15,
  },
  {
    name: 'Vera Vergaser',
    trait: 'Kommt am schnellsten wieder in Fahrt – nach Kurven, Treffern und Stürzen.',
    bars: [3, 5, 3],
    vmax: 0.998,
    accel: 1.14,
    grip: 1,
    offroad: OFFROAD_FACTOR,
    charge: 1,
    mass: 0.9,
  },
  {
    name: 'Bremsen-Bert',
    trait: 'Ausgeglichen und unerschütterlich: verliert wenig im Grünen und bei Remplern.',
    bars: [3, 3, 3],
    vmax: 0.999,
    accel: 1,
    grip: 1,
    offroad: 0.7,
    charge: 1,
    mass: 1.4,
  },
  {
    name: 'Zünd-Zoe',
    trait: 'Klebt in Kurven, und der Drift lädt schneller.',
    bars: [2, 3, 5],
    vmax: 0.996,
    accel: 1,
    grip: 1.05,
    offroad: OFFROAD_FACTOR,
    charge: 0.92,
    mass: 0.95,
  },
];

export function newState(): KartState {
  return {
    x: 0,
    y: 0,
    z: 0,
    heading: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    seg: 0,
    boost: 0,
    driftDir: 0,
    driftCharge: 0,
    spin: 0,
    shield: 0,
    guard: 0,
    stall: 0,
    respawn: 0,
    tow: 0,
    draft: 0,
    item: ITEM_NONE,
    nextItem: ITEM_NONE,
    roulette: 0,
    flags: 0,
    char: 0,
  };
}

export function copyState(dst: KartState, src: KartState): KartState {
  dst.x = src.x;
  dst.y = src.y;
  dst.z = src.z;
  dst.heading = src.heading;
  dst.vx = src.vx;
  dst.vy = src.vy;
  dst.vz = src.vz;
  dst.seg = src.seg;
  dst.boost = src.boost;
  dst.driftDir = src.driftDir;
  dst.driftCharge = src.driftCharge;
  dst.spin = src.spin;
  dst.shield = src.shield;
  dst.guard = src.guard;
  dst.stall = src.stall;
  dst.respawn = src.respawn;
  dst.tow = src.tow;
  dst.draft = src.draft;
  dst.item = src.item;
  dst.nextItem = src.nextItem;
  dst.roulette = src.roulette;
  dst.flags = src.flags;
  dst.char = src.char;
  return dst;
}

/** Zustand am Startplatz. */
export function gridState(slot: number, char = slot): KartState {
  const g = gridPosition(TRACK, slot);
  const s = newState();
  s.char = ((char % CHARACTERS.length) + CHARACTERS.length) % CHARACTERS.length;
  s.x = g.x;
  s.y = g.y;
  s.z = g.z;
  s.heading = g.heading;
  s.seg = g.seg;
  return s;
}

/** Stufe des Mini-Turbos für eine Ladung: 0 (noch nichts) bis 3. */
export function turboStage(charge: number, char = 0): number {
  const k = (CHARACTERS[char] ?? CHARACTERS[0]).charge;
  if (charge >= TURBO_AT[2] * k) return 3;
  if (charge >= TURBO_AT[1] * k) return 2;
  if (charge >= TURBO_AT[0] * k) return 1;
  return 0;
}

/** Vorwärtsgeschwindigkeit (negativ = rückwärts). */
export function forwardSpeed(s: KartState): number {
  return s.vx * Math.sin(s.heading) + s.vz * Math.cos(s.heading);
}

export const HIT_NONE = 0;
export const HIT_SPIN = 1;
export const HIT_BLOCKED = 2;

/**
 * Treffer durch Rollreifen, Ölfleck, Brummkreisel oder Hindernis.
 * HIT_NONE = gerade unverwundbar, HIT_BLOCKED = der Stoßfänger hat ihn abgefangen.
 */
export function hitKart(s: KartState): number {
  // Am Drachen hängend fliegt das Kart über alles hinweg.
  if (s.shield > 0 || s.spin > 0 || s.respawn > 0 || s.tow > 0) return HIT_NONE;
  if (s.guard > 0) {
    s.guard = 0;
    s.shield = 50;
    return HIT_BLOCKED;
  }
  s.spin = SPIN_TICKS;
  s.shield = SPIN_TICKS + SHIELD_TICKS;
  s.driftDir = 0;
  s.driftCharge = 0;
  s.boost = 0;
  s.vx *= 0.45;
  s.vz *= 0.45;
  return HIT_SPIN;
}

/** Kurzschluss: der Motor läuft kurz nur gedrosselt. Rückgabe wie hitKart. */
export function stallKart(s: KartState): number {
  if (s.respawn > 0 || s.stall > 0 || s.tow > 0) return HIT_NONE;
  if (s.guard > 0) {
    s.guard = 0;
    s.shield = 50;
    return HIT_BLOCKED;
  }
  s.stall = STALL_TICKS;
  s.boost = 0;
  s.driftDir = 0;
  s.driftCharge = 0;
  return HIT_SPIN;
}

function wrapAngle(a: number): number {
  if (a > Math.PI) return a - 2 * Math.PI;
  if (a < -Math.PI) return a + 2 * Math.PI;
  return a;
}

/** Anteil, um den volle Lava die Höchstgeschwindigkeit drückt. */
const LAVA_DRAG = 0.5;
/** Tempozuschlag nach dem Ausscheren aus dem Windschatten. */
const DRAFT_PULL = 1.2;
/** Nur wer das Heck mit der Kartmitte innerhalb der Fahrzeugbreite (plus so viel) trifft, fährt wirklich auf. */
const CRASH_INSET = 0.3;
const VENT_LAUNCH = 10.5;
/** Internes Bit aus stepTraffic: das Kart wurde verschoben. */
const TRAFFIC_MOVED = 1 << 30;

/** Lavapegel (0..1) auf dem Abschnitt seg zur Rennzeit time. */
export function lavaAt(t: Track, seg: number, time: number): number {
  let level = 0;
  for (const f of t.floods) {
    if (seg < f.first || seg >= f.first + f.count) continue;
    // An den Enden des Stücks läuft die Lava flach aus.
    const edge = Math.min(seg - f.first, f.first + f.count - 1 - seg);
    level = Math.max(level, floodLevel(f, time) * Math.min(1, (edge + 1) / 6));
  }
  return level;
}

const VPOSE = newVehiclePose();

/**
 * Verkehr: Zusammenstöße und Windschatten. Fahrzeuge sind fahrende Wände –
 * seitlich streift man an ihnen entlang wie an einer Bande; wer mit viel
 * Überschuss auffährt (oder überrollt wird), schleudert.
 */
function stepTraffic(t: Track, s: KartState, time: number): number {
  let ev = 0;
  const lap = t.n * t.step;
  const mine = t.prog[s.seg] * t.step;
  let inWake = false;
  for (const v of t.vehicles) {
    // Grob: nur Fahrzeuge in der Nähe (gemessen am Fortschritt auf der Hauptstrecke).
    let d = mine - vehicleAt(v, time, lap);
    if (d > lap / 2) d -= lap;
    else if (d < -lap / 2) d += lap;
    const train = (v.cars - 1) * v.pitch;
    if (d > v.half + 8 || d < -(train + v.half + WAKE_LENGTH + 8)) continue;
    for (let car = 0; car < v.cars; car++) {
      const p = vehiclePose(t, v, car, time, VPOSE);
      const hx = Math.sin(p.heading);
      const hz = Math.cos(p.heading);
      const dx = s.x - p.x;
      const dz = s.z - p.z;
      const du = dx * hx + dz * hz;
      const dw = -dx * hz + dz * hx;
      const dy = s.y - p.y;
      // Windschatten hinter dem letzten Wagen
      if (
        car === v.cars - 1 &&
        du < -v.half - 0.8 &&
        du > -v.half - WAKE_LENGTH &&
        Math.abs(dw) < WAKE_HALF &&
        dy > -1.2 &&
        dy < 1.2
      ) {
        inWake = true;
      }
      // Darüber hinweg (Sprungfeder, Schanze) oder auf einer anderen Ebene: kein Kontakt.
      if (dy > v.height || dy < -1.5) continue;
      const pu = v.half + KART_RADIUS - Math.abs(du);
      const pw = v.halfWidth + KART_RADIUS - Math.abs(dw);
      if (pu <= 0 || pw <= 0) continue;
      ev |= TRAFFIC_MOVED;
      // Geschwindigkeit des Karts aus Sicht des Fahrzeugs
      let ku = s.vx * hx + s.vz * hz;
      let kw = -s.vx * hz + s.vz * hx;
      if (pw < pu || Math.abs(dw) > v.halfWidth + CRASH_INSET) {
        // Seitlich – oder nur die Ecke erwischt: hinausschieben und
        // entlangstreifen wie an einer Bande. Das kostet Tempo, aber keinen Dreher.
        const side = dw > 0 ? 1 : -1;
        s.x += -hz * side * pw;
        s.z += hx * side * pw;
        const vn = -kw * side;
        if (vn > 0) kw += side * vn * 1.3;
        // Wer die Ecke von hinten erwischt, verliert einen Teil seines Überschusses.
        const corner = pw >= pu ? 0.35 : 0;
        const loss = Math.max(corner, vn > 0 ? Math.min(0.3, 0.008 + vn * 0.02) : 0);
        if (loss > 0 && ku > v.speed) ku -= (ku - v.speed) * loss;
        if (vn > 5 || (corner > 0 && Math.abs(ku - v.speed) > 4)) {
          ev |= EV_WALL;
          s.driftDir = 0;
          s.driftCharge = 0;
        }
      } else {
        // Von hinten aufgefahren – oder das Fahrzeug schiebt das Kart vor sich her.
        const end = du > 0 ? 1 : -1;
        s.x += hx * end * pu;
        s.z += hz * end * pu;
        const closing = -(ku - v.speed) * end;
        if (closing > 0) {
          if (closing > CRASH_SPEED) {
            const r = hitKart(s);
            if (r === HIT_BLOCKED) ev |= EV_BLOCK;
            else if (r === HIT_SPIN) ev |= EV_HIT;
            kw = (-s.vx * hz + s.vz * hx) * 0.5;
          }
          ku = v.speed + end * 2;
        }
      }
      s.vx = hx * ku - hz * kw;
      s.vz = hz * ku + hx * kw;
    }
  }
  // Windschatten lädt, solange man dicht hinter einem Fahrzeug bleibt; wer danach ausschert, bekommt Zug.
  if (s.draft >= DRAFT_PULL_FROM) {
    s.draft = s.spin > 0 || s.draft - 1 < DRAFT_PULL_FROM ? 0 : s.draft - 1;
  } else if (inWake && s.spin === 0 && (s.flags & FLAG_AIR) === 0 && s.vx * s.vx + s.vz * s.vz > 10 * 10) {
    s.draft = Math.min(DRAFT_FULL, s.draft + 2);
  } else if (s.draft >= DRAFT_FULL && s.spin === 0) {
    s.draft = DRAFT_PULL_FROM + DRAFT_PULL_TICKS;
    ev |= EV_DRAFT;
  } else if (s.draft > 0) s.draft = Math.max(0, s.draft - 4);
  return ev;
}

/** Steht an dieser Stelle gerade ein Fahrzeug? (für Rollreifen und Co.) */
export function trafficBlocks(t: Track, x: number, y: number, z: number, radius: number, seg: number, time: number): boolean {
  const lap = t.n * t.step;
  const mine = t.prog[seg] * t.step;
  for (const v of t.vehicles) {
    let d = mine - vehicleAt(v, time, lap);
    if (d > lap / 2) d -= lap;
    else if (d < -lap / 2) d += lap;
    if (d > v.half + 8 || d < -((v.cars - 1) * v.pitch + v.half + 8)) continue;
    for (let car = 0; car < v.cars; car++) {
      const p = vehiclePose(t, v, car, time, VPOSE);
      const hx = Math.sin(p.heading);
      const hz = Math.cos(p.heading);
      const du = (x - p.x) * hx + (z - p.z) * hz;
      const dw = -(x - p.x) * hz + (z - p.z) * hx;
      if (Math.abs(du) < v.half + radius && Math.abs(dw) < v.halfWidth + radius && y - p.y < v.height + radius && y - p.y > -1.5) return true;
    }
  }
  return false;
}

export function stepKart(s: KartState, cmd: Cmd, env: StepEnv): number {
  const t = TRACK;
  let ev = 0;

  // --- Zeitgeber ---
  if (s.boost > 0) s.boost--;
  if (s.shield > 0) s.shield--;
  if (s.guard > 0) s.guard--;
  if (s.stall > 0) s.stall--;
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
  const itemBtn = (cmd.buttons & BTN_ITEM) !== 0;

  // --- Nach einem Absturz: das Kart wird über der Strecke abgesetzt ---
  if (s.respawn > 0) {
    s.respawn--;
    s.vx = 0;
    s.vy = 0;
    s.vz = 0;
    s.y = t.py[s.seg] + (s.respawn / RESPAWN_TICKS) * RESPAWN_HEIGHT;
    s.flags = (itemBtn ? FLAG_ITEM_HELD : 0) | (s.respawn > 0 ? FLAG_AIR : 0);
    if (s.respawn === 0) ev |= EV_RESPAWNED;
    return ev;
  }

  // --- Abschleppdrache: das Kart hängt am Drachen und wird die Strecke entlanggezogen ---
  if (s.tow > 0 && !env.canDrive) s.tow = 0;
  if (s.tow > 0) {
    s.tow--;
    s.driftDir = 0;
    s.driftCharge = 0;
    s.spin = 0;
    // Gelenkt wird von selbst; die eigene Lenkung verschiebt nur die Spur.
    const nudge = Math.max(-1, Math.min(1, cmd.steer / 127));
    projectOnTrack(t, s.x, s.z, s.seg);
    const ahead = walk(t, proj.seg, Math.round(TOW_LOOK / t.step));
    const room = Math.max(0.5, t.rh[ahead] - 1.5);
    const lane = Math.max(-room, Math.min(room, proj.lat * 0.9 + nudge * 3.5));
    const want = Math.atan2(t.px[ahead] + rightX(t, ahead) * lane - s.x, t.pz[ahead] + rightZ(t, ahead) * lane - s.z);
    s.heading = wrapAngle(s.heading + wrapAngle(want - s.heading) * Math.min(1, 9 * DT));
    const hx = Math.sin(s.heading);
    const hz = Math.cos(s.heading);
    const v = Math.min(V_TOW, Math.max(8, s.vx * hx + s.vz * hz) + TOW_ACCEL * DT);
    s.vx = hx * v;
    s.vz = hz * v;
    s.x += s.vx * DT;
    s.z += s.vz * DT;
    projectOnTrack(t, s.x, s.z, s.seg);
    s.seg = proj.seg;
    let tlat = proj.lat;
    const tside = tlat > 0 ? 1 : -1;
    const tlimit = sideLimit(t, s.seg, tside) - KART_RADIUS;
    if (Math.abs(tlat) > tlimit) {
      const side = tside;
      s.x -= rightX(t, s.seg) * side * (Math.abs(tlat) - tlimit);
      s.z -= rightZ(t, s.seg) * side * (Math.abs(tlat) - tlimit);
      tlat = side * tlimit;
    }
    // Schwebt eine Armlänge über der Fahrbahn – auch über Lücken hinweg.
    const hover = centerHeight(t, s.seg, proj.along) + tlat * t.bank[s.seg] + TOW_LIFT;
    s.y += (hover - s.y) * Math.min(1, 7 * DT);
    s.vy = 0;
    // Ende: abgelaufen oder mit der Bremse gekappt – aber nie über einem Abgrund.
    const cut = (cmd.buttons & BTN_BRAKE) !== 0 && s.tow < TOW_TICKS - 30;
    if (s.tow === 0 || cut) {
      if (groundAt(t, s.seg, proj.along, tlat) === NO_GROUND) s.tow = Math.max(s.tow, 4);
      else {
        s.tow = 0;
        s.boost = Math.max(s.boost, 45);
        ev |= EV_TOW_END;
      }
    }
    s.flags = FLAG_AIR | (itemBtn ? FLAG_ITEM_HELD : 0);
    return ev;
  }

  const wasAir = (s.flags & FLAG_AIR) !== 0;
  const drive = env.canDrive && !spinning;
  const steer = drive ? Math.max(-1, Math.min(1, cmd.steer / 127)) : 0;
  const gas = drive && (cmd.buttons & BTN_GAS) !== 0;
  const brake = drive && (cmd.buttons & BTN_BRAKE) !== 0;
  const driftBtn = drive && (cmd.buttons & BTN_DRIFT) !== 0;
  const wasOffroad = (s.flags & FLAG_OFFROAD) !== 0;
  const ch = CHARACTERS[s.char] ?? CHARACTERS[0];

  // Boden an der alten Stelle: Bezug für Steigung und für Stufen.
  const x0 = s.x;
  const z0 = s.z;
  const y0 = s.y;
  projectOnTrack(t, x0, z0, s.seg);
  const seg0 = proj.seg;
  const lat0 = proj.lat;
  const g0 = groundAt(t, seg0, proj.along, lat0);

  let fx = Math.sin(s.heading);
  let fz = Math.cos(s.heading);
  let vf = s.vx * fx + s.vz * fz;

  // --- Drift beginnen oder beenden ---
  if (s.driftDir !== 0) {
    if (!driftBtn || vf < DRIFT_MIN_SPEED * 0.6) {
      // Nur wer die Taste loslässt, bekommt den Mini-Turbo. Wer zu langsam wird, verliert ihn.
      const stage = turboStage(s.driftCharge, s.char);
      if (drive && !driftBtn && stage > 0) {
        s.boost = Math.max(s.boost, TURBO_TICKS[stage - 1]);
        ev |= EV_TURBO;
      }
      s.driftDir = 0;
      s.driftCharge = 0;
    }
  } else if (driftBtn && !wasAir && vf > DRIFT_MIN_SPEED && Math.abs(steer) > 0.2) {
    s.driftDir = steer > 0 ? 1 : -1;
    s.driftCharge = 0;
    ev |= EV_DRIFT_START;
  }

  // --- Lenken ---
  // Langsam: fester kleinster Wendekreis. Schnell: begrenzt durch die Haftung.
  const v = Math.abs(vf);
  // Untergrund: Sand, Schotter und Co. halten weniger, Fels und Stadtasphalt mehr.
  const ground = SURFACES[t.surf[seg0]] ?? SURFACES[0];
  const turnDir = s.driftDir !== 0 ? s.driftDir : steer > 0 ? 1 : steer < 0 ? -1 : 0;
  const hold = A_LAT * ch.grip * ground.grip * (wasAir || turnDir === 0 ? 1 : bankGrip(t, seg0, turnDir));
  const yawMax = (v < 0.3 ? 0 : Math.min(v / R_MIN, hold / v)) * (wasAir ? AIR_STEER : 1);
  let yaw: number;
  if (s.driftDir !== 0) {
    // Im Drift dreht das Kart immer in Driftrichtung; die Lenkung wählt nur
    // zwischen weitem und engem Bogen. Eng hineinlenken lädt schneller.
    const into = steer * s.driftDir;
    yaw = s.driftDir * yawMax * (DRIFT_WIDE + ((DRIFT_TIGHT - DRIFT_WIDE) * (into + 1)) / 2);
    if (!wasAir) {
      // Auf losem Grund lädt der Mini-Turbo schneller: in einem Teil der Ticks zählt er doppelt.
      // (Welche Ticks, hängt nur vom Stand der Ladung ab – so rechnet jedes Gerät gleich.)
      const extra = ground.charge > 0 && (s.driftCharge * 7) % 20 < ground.charge * 20 ? 1 : 0;
      s.driftCharge = Math.min(255, s.driftCharge + (into > 0.35 ? 2 : 1) + extra);
    }
  } else {
    yaw = steer * yawMax * (vf < 0 ? -1 : 1);
  }
  s.heading = wrapAngle(s.heading - yaw * DT);
  fx = Math.sin(s.heading);
  fz = Math.cos(s.heading);
  const rx = -fz;
  const rz = fx;

  vf = s.vx * fx + s.vz * fz;
  let vl = s.vx * rx + s.vz * rz;
  if (!wasAir) {
    // --- Haftung: die Fahrtrichtung folgt der Blickrichtung ---
    // Der seitliche Anteil wird nicht weggebremst, sondern in Fahrtrichtung
    // umgelenkt. So kostet Kurvenfahren kein Tempo ("griffig"), und im Drift
    // (geringe Haftung) rutscht das Heck sichtbar nach außen.
    const speed = Math.hypot(vf, vl);
    // Auf losem Grund rutscht das Kart länger quer, bevor es wieder spurt.
    const grip = (s.driftDir !== 0 ? GRIP_DRIFT : spinning ? 2.5 : GRIP) * ground.grip * ground.grip;
    vl *= Math.exp(-grip * DT);
    vf = (vf < 0 ? -1 : 1) * Math.sqrt(Math.max(0, speed * speed - vl * vl));

    // --- Beschleunigen und Bremsen ---
    const boosting = s.boost > 0;
    let vmax = V_MAX * env.speedFactor * ch.vmax * ground.speed;
    if (boosting) vmax = V_BOOST * env.speedFactor;
    else if (wasOffroad) vmax *= ch.offroad;
    if (s.stall > 0) vmax *= STALL_FACTOR;
    // Aus dem Windschatten ausgeschert: kurz mehr Tempo – aber nur auf dem Gas, die Bremse bleibt die Bremse.
    if (s.draft >= DRAFT_PULL_FROM && !boosting) vmax *= DRAFT_PULL;
    // Lava auf der Fahrbahn: zäh wie Teer.
    if (t.floods.length > 0) {
      const lava = lavaAt(t, seg0, env.time);
      if (lava > FLOOD_FROM) {
        vmax *= 1 - LAVA_DRAG * lava;
        if (vf > vmax + 2) vf -= 30 * DT;
        if (((env.time % 24) + 24) % 24 === 0) ev |= EV_BURN;
      }
    }
    // Steigung in Fahrtrichtung: s.vy ist am Boden die Geschwindigkeit, mit der das Kart dem Hang folgt.
    const slope = Math.max(-0.3, Math.min(0.3, s.vy / Math.max(6, v)));
    vmax *= 1 - slope * SLOPE_EFFECT * (vf < 0 ? -1 : 1);

    if (!env.canDrive) {
      // Countdown oder Ziel: zügig zum Stehen kommen.
      const d = BRAKE * 0.5 * DT;
      vf = vf > d ? vf - d : vf < -d ? vf + d : 0;
      vl *= 0.9;
    } else if (spinning) {
      const d = 16 * DT;
      vf = vf > d ? vf - d : vf < -d ? vf + d : 0;
    } else if (boosting && !brake) {
      // Schub wirkt auch ohne Gas – aber die Bremse geht vor (sonst schiebt ein Mini-Turbo ins Heck des Busses).
      if (vf < vmax) vf = Math.min(vmax, vf + BOOST_ACCEL * DT);
      else vf = Math.max(vmax, vf - 10 * DT);
    } else if (gas && !brake) {
      if (vf < vmax) vf = Math.min(vmax, vf + ACCEL * ch.accel * ground.accel * (1 - (0.75 * Math.max(0, vf)) / vmax) * DT);
      else vf = Math.max(vmax, vf - (wasOffroad ? 34 : 10) * DT);
    } else if (brake) {
      if (vf > 0.4) vf = Math.max(0, vf - BRAKE * ground.brake * DT);
      else vf = Math.max(-V_REVERSE, vf - 16 * DT);
    } else {
      const d = (wasOffroad ? COAST + 12 : COAST) * DT;
      vf = vf > d ? vf - d : vf < -d ? vf + d : 0;
    }
  }

  s.vx = fx * vf + rx * vl;
  s.vz = fz * vf + rz * vl;
  s.x += s.vx * DT;
  s.z += s.vz * DT;

  // --- Strecke: Abschnitt, Bande ---
  projectOnTrack(t, s.x, s.z, s.seg);
  s.seg = proj.seg;
  let lat = proj.lat;
  let along = proj.along;
  let flags = itemBtn ? FLAG_ITEM_HELD : 0;
  // Wer schon unter die Fahrbahn gefallen ist, stößt nirgends mehr an.
  const sunk = y0 < centerHeight(t, s.seg, along) + lat * t.bank[s.seg] - STEP_MAX;
  const side = lat > 0 ? 1 : -1;
  const limit = sideLimit(t, s.seg, side) - KART_RADIUS;
  if (!sunk && Math.abs(lat) > limit) {
    const open = (t.edge[s.seg] & (side > 0 ? EDGE_OPEN_R : EDGE_OPEN_L)) !== 0;
    if (!open) {
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
        const turn = wrapAngle(trackHeading(t, s.seg) - s.heading);
        if (Math.abs(turn) < Math.PI / 2) s.heading = wrapAngle(s.heading + turn * 0.08);
      }
    }
  }

  // --- Verkehr: fahrende Wände, in die man besser nicht hineinrauscht ---
  if (t.vehicles.length > 0) {
    const tev = stepTraffic(t, s, env.time);
    if (tev !== 0) {
      ev |= tev & ~TRAFFIC_MOVED;
      if (tev & TRAFFIC_MOVED) {
        // Das Kart wurde verschoben: Lage auf der Strecke neu bestimmen.
        projectOnTrack(t, s.x, s.z, s.seg);
        s.seg = proj.seg;
        lat = proj.lat;
        along = proj.along;
      }
    }
  } else s.draft = 0;

  // --- Boden: Stufen, Schwerkraft, Abheben und Landen ---
  let g = sunk ? NO_GROUND : groundAt(t, s.seg, along, lat);
  if (g > y0 + STEP_MAX) {
    if (g0 > y0 + STEP_MAX) {
      // Schon an der alten Stelle unter der Fahrbahn: weiter fallen.
      g = NO_GROUND;
    } else {
      // Eine Kante höher als eine Stufe (Rückseite einer Schanze, Wand einer
      // Lücke): zurück an die alte Stelle und abprallen.
      s.x = x0;
      s.z = z0;
      s.seg = seg0;
      lat = lat0;
      along = 0;
      if (Math.hypot(s.vx, s.vz) > 5) ev |= EV_WALL;
      s.vx *= -0.25;
      s.vz *= -0.25;
      g = g0;
    }
  }
  s.vy -= GRAVITY * DT;
  s.y += s.vy * DT;
  if (s.y <= g) {
    if (wasAir && s.vy < -5) ev |= EV_LAND;
    s.y = g;
    // Am Boden ist die Steiggeschwindigkeit die des Hangs. Endet der Hang
    // (Kuppe, Schanze), nimmt das Kart sie mit und hebt ab.
    s.vy = g0 > NO_GROUND / 2 ? Math.max(-14, Math.min(14, (g - g0) / DT)) : 0;
  }
  // Abheben erst ab einer Handbreit über dem Boden; wer einmal fliegt, fliegt bis zur Berührung.
  const air = s.y > g + AIR_EPS || (wasAir && s.y > g);
  if (air) {
    flags |= FLAG_AIR;
    if (!wasAir) ev |= EV_TAKEOFF;
  }

  // --- Absturz ---
  if (s.y < t.py[s.seg] - t.fallDepth) {
    const r = t.respawn[s.seg];
    s.seg = r;
    s.x = t.px[r];
    s.z = t.pz[r];
    s.y = t.py[r] + RESPAWN_HEIGHT;
    s.heading = trackHeading(t, r);
    s.vx = 0;
    s.vy = 0;
    s.vz = 0;
    s.respawn = RESPAWN_TICKS;
    s.boost = 0;
    s.driftDir = 0;
    s.driftCharge = 0;
    s.spin = 0;
    s.stall = 0;
    s.shield = RESPAWN_TICKS + 70;
    s.flags = FLAG_AIR | (itemBtn ? FLAG_ITEM_HELD : 0);
    return ev | EV_FALL;
  }

  if (!air && Math.abs(lat) > t.rh[s.seg] + 0.3) flags |= FLAG_OFFROAD;

  // --- Geysire und Lavabomben ---
  for (const p of t.pulses) {
    const dy = s.y - p.y;
    if (dy < -1.5 || dy > 2.5) continue;
    const dx = s.x - p.x;
    const dz = s.z - p.z;
    const reach = p.radius + KART_RADIUS * 0.6;
    if (dx * dx + dz * dz > reach * reach) continue;
    if (pulseCycle(p, env.time) >= p.on) continue;
    const r = hitKart(s);
    if (r === HIT_BLOCKED) ev |= EV_BLOCK;
    else if (r === HIT_SPIN) {
      ev |= EV_HIT;
      // Der Geysir wirft das Kart hoch, die Bombe nur ein Stück.
      s.vy = p.kind === PULSE_VENT ? VENT_LAUNCH : 4.5;
      s.y += AIR_EPS + 0.05;
      flags |= FLAG_AIR;
    }
  }

  // --- Boost-Felder ---
  if (!air && vf > 6 && s.boost < PAD_TICKS - 8) {
    for (const pad of t.pads) {
      if (!samePath(t, pad.seg, s.seg)) continue;
      const d = segDelta(t, pad.seg, s.seg);
      if (d >= 0 && d <= pad.length && Math.abs(lat - pad.lat) < pad.halfWidth + 0.5) {
        s.boost = PAD_TICKS;
        ev |= EV_PAD;
      }
    }
  }

  // --- Item auslösen (bei Tastendruck, nicht beim Halten) ---
  if (itemBtn && (s.flags & FLAG_ITEM_HELD) === 0 && drive && s.item !== ITEM_NONE) {
    let used = true;
    switch (s.item) {
      case ITEM_BOOST:
        s.boost = Math.max(s.boost, ITEM_BOOST_TICKS);
        ev |= EV_USE_BOOST;
        break;
      case ITEM_TIRE:
        ev |= EV_USE_TIRE;
        break;
      case ITEM_OIL:
        ev |= EV_USE_OIL;
        break;
      case ITEM_TOP:
        ev |= EV_USE_TOP;
        break;
      case ITEM_GUARD:
        s.guard = GUARD_TICKS;
        ev |= EV_USE_GUARD;
        break;
      case ITEM_EMP:
        ev |= EV_USE_EMP;
        break;
      case ITEM_SMOKE:
        ev |= EV_USE_SMOKE;
        break;
      case ITEM_SPRING:
        // Aus der Luft heraus geht kein zweiter Sprung – das Item bleibt.
        if (air) used = false;
        else {
          s.vy = SPRING_SPEED;
          s.y += AIR_EPS + 0.05;
          flags |= FLAG_AIR;
          ev |= EV_USE_SPRING | EV_TAKEOFF;
        }
        break;
      case ITEM_KITE:
        s.tow = TOW_TICKS;
        s.boost = 0;
        s.stall = 0;
        ev |= EV_USE_KITE;
        break;
      default:
        used = false;
    }
    if (used) s.item = ITEM_NONE;
  }

  s.flags = flags;
  return ev;
}
