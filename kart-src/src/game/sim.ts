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
  BELT_EDGE,
  BELT_RAMP,
  CRASH_SPEED,
  DRAFT_FULL,
  DRAFT_PULL_FROM,
  DRAFT_PULL_TICKS,
  FLAT_FACTOR,
  FLAT_TICKS,
  FLOOD_FROM,
  GLIDE_ACCEL,
  GLIDE_CEILING,
  GLIDE_DROP,
  GLIDE_EDGE,
  GLIDE_FALL,
  GLIDE_GRIP,
  GLIDE_RESPONSE,
  GLIDE_SINK,
  GLIDE_SPEED,
  GLIDE_YAW,
  PULSE_PRESS,
  PULSE_VENT,
  WATER_FROM,
  WAKE_HALF,
  WAKE_LENGTH,
  floodLevel,
  pulseCycle,
  tideLevel,
  vehicleAt,
  waterFactor,
  BUBBLE_LIFT,
  DIVE_ACCEL,
  DIVE_COAST,
  DIVE_GRAVITY,
  DIVE_GRIP,
  DIVE_SINK,
  DIVE_SPEED,
  DIVE_STEER,
  PULSE_BUBBLE,
  AVALANCHE_DRAG,
  AVALANCHE_PUSH,
  PULSE_AVALANCHE,
  PULSE_ROD,
  LOWG_STEER,
  portalOpen,
  WIND_AIR,
  WIND_EDGE,
  WIND_ENDS,
  gustStrength,
  ROOF_EDGE,
  ROOF_OVERHANG,
  ROOF_STEP,
  roofTop,
  type Vehicle,
  BIG_ACCEL,
  BIG_GRIP,
  BIG_VMAX,
  SIZE_TICKS,
  SIZE_WARN,
  SMALL_ACCEL,
  SMALL_GRIP,
  SMALL_VMAX,
  KICK_HALF,
  KICK_SPEED,
  LIFT_BOOST,
  KICK_TICKS,
  PULSE_KICK,
  RAIL_BOOST,
  RAIL_BRAKE,
  RAIL_CATCH,
  RAIL_CHAIN,
  RAIL_DRAG,
  RAIL_G,
  RAIL_GAS,
  RAIL_ROLL,
  RAIL_SHIFT,
  RAIL_STEER,
  RAIL_TRIM,
  RAIL_VGAS,
  RAIL_VMAX,
  RAIL_VMIN,
  DRUM_GRIP,
  DRUM_SAG,
} from './mechanics';
import {
  EDGE_DRUM,
  EDGE_FLOAT,
  EDGE_RAIL,
  EDGE_RIVER,
  EDGE_GAP,
  EDGE_GLIDE,
  EDGE_OPEN_L,
  EDGE_OPEN_R,
  NO_GROUND,
  TRACK,
  centerHeight,
  gridPosition,
  gateShut,
  groundAt,
  groundNow,
  heaveAt,
  newVehiclePose,
  proj,
  projectOnTrack,
  raftLane,
  railOf,
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
/** Das Kart gleitet über einer Flugstrecke (Flügel ausgeklappt). */
export const FLAG_GLIDE = 16;
/** Das Kart ist unter Wasser (Tauchstrecke). */
export const FLAG_DIVE = 32;

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
  /** Verbleibende Ticks geplättet (Stampfpresse): das Kart ist flach und langsam. */
  flat: number;
  /** Größe (Riesenkinderzimmer): > 0 = so viele Ticks noch riesig, < 0 = so viele Ticks noch winzig, 0 = normal. */
  size: number;
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
/** Von einer Stampfpresse geplättet. */
export const EV_FLAT = 1 << 23;
/** Fährt durch Wasser (Flut). */
export const EV_SPLASH = 1 << 24;
/** Von einem Blasenschlot angehoben. */
export const EV_BUBBLE = 1 << 25;
/** In einer Lawine (wird alle paar Ticks gemeldet, solange das Kart darin steckt). */
export const EV_SNOW = 1 << 26;
/** Von einer Sprungplatte hochgeschleudert. */
export const EV_LAUNCH = 1 << 27;
/** In einer Böe (wird alle paar Ticks gemeldet, solange sie das Kart schiebt). */
export const EV_WIND = 1 << 28;
/** Im Ladefeld eines Blitzableiters aufgeladen (Schub). */
export const EV_CHARGE = 1 << 29;
/** Durch ein Portal gefahren: das Kart steht jetzt an dessen Ausgang. */
export const EV_PORTAL = 1 << 30;
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
export const PAD_TICKS = 60;
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
    flat: 0,
    size: 0,
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
  dst.flat = src.flat;
  dst.size = src.size;
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

/** Stampfpresse: das Kart wird geplättet und fährt eine Weile flach und langsam. Rückgabe wie hitKart. */
export function flattenKart(s: KartState): number {
  if (s.shield > 0 || s.flat > 0 || s.respawn > 0 || s.tow > 0) return HIT_NONE;
  if (s.guard > 0) {
    s.guard = 0;
    s.shield = 50;
    return HIT_BLOCKED;
  }
  s.flat = FLAT_TICKS;
  s.shield = FLAT_TICKS + 40;
  s.driftDir = 0;
  s.driftCharge = 0;
  s.boost = 0;
  s.vx *= 0.4;
  s.vz *= 0.4;
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
const RPOSE = newVehiclePose();
const RPOSE2 = newVehiclePose();
/**
 * Ergebnis von roofUnder: das Fahrzeug, auf dessen Dach das Kart steht, und wie sich die Stelle des Dachs unter
 * dem Kart bewegt (m/s, Drehung in rad/s) – in der Kurve dreht sich der Wagen unter dem Kart mit.
 */
let roofVehicle: Vehicle | null = null;
let roofVx = 0;
let roofVz = 0;
let roofTurn = 0;

/**
 * Wagendächer (mechanics.ts: VehicleSpec.roofs): Höhe des Dachs unter (x, z), auf dem ein Kart in Höhe y steht
 * oder landen kann – sonst NO_GROUND. Ein Dach trägt nur, wer höchstens ROOF_STEP unter seiner Kante ist.
 */
function roofUnder(t: Track, x: number, y: number, z: number, seg: number, time: number): number {
  roofVehicle = null;
  let best = NO_GROUND;
  let bestCar = 0;
  const lap = t.n * t.step;
  const mine = t.prog[seg] * t.step;
  for (const v of t.vehicles) {
    if (!v.roofs) continue;
    let d = mine - vehicleAt(v, time, lap);
    if (d > lap / 2) d -= lap;
    else if (d < -lap / 2) d += lap;
    if (d > v.half + 8 || d < -((v.cars - 1) * v.pitch + v.half + 8)) continue;
    for (let car = 0; car < v.cars; car++) {
      const p = vehiclePose(t, v, car, time, RPOSE);
      const hx = Math.sin(p.heading);
      const hz = Math.cos(p.heading);
      const dx = x - p.x;
      const dz = z - p.z;
      const du = dx * hx + dz * hz;
      if (Math.abs(du) > v.half + ROOF_OVERHANG) continue;
      const dw = -dx * hz + dz * hx;
      if (Math.abs(dw) > v.halfWidth + ROOF_EDGE) continue;
      const top = p.y + roofTop(v, car, du) + p.slope * du;
      if (y < top - ROOF_STEP || top <= best) continue;
      best = top;
      roofVehicle = v;
      bestCar = car;
    }
  }
  if (roofVehicle !== null) {
    // Bewegung der Stelle unter dem Kart: Fahrt der Wagenmitte plus Drehung des Wagens um sie.
    const a = vehiclePose(t, roofVehicle, bestCar, time, RPOSE);
    const b = vehiclePose(t, roofVehicle, bestCar, time + 1, RPOSE2);
    let turn = b.heading - a.heading;
    if (turn > Math.PI) turn -= 2 * Math.PI;
    else if (turn < -Math.PI) turn += 2 * Math.PI;
    roofTurn = turn / DT;
    roofVx = (b.x - a.x) / DT + roofTurn * (z - a.z);
    roofVz = (b.z - a.z) / DT - roofTurn * (x - a.x);
  }
  return best;
}

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
      // Bei Wagen mit befahrbarem Dach zählt die Höhe des Dachs an dieser Stelle: Wer (fast) auf Dachhöhe ist,
      // fährt darauf – nur darunter ist der Wagen eine Wand.
      if (dy > (v.roofs ? roofTop(v, car, du) + p.slope * du - ROOF_STEP : v.height) || dy < -1.5) continue;
      const pu = v.half + KART_RADIUS - Math.abs(du);
      const pw = v.halfWidth + KART_RADIUS - Math.abs(dw);
      if (pu <= 0 || pw <= 0) continue;
      // Geschwindigkeit des Karts aus Sicht des Fahrzeugs
      let ku = s.vx * hx + s.vz * hz;
      let kw = -s.vx * hz + s.vz * hx;
      // An den vier Ecken ist das Kart ein Kreis gegen eine Ecke – nicht gegen ein vergrößertes Rechteck.
      const cu = Math.abs(du) - v.half;
      const cw = Math.abs(dw) - v.halfWidth;
      if (cu > 0 && cw > 0) {
        const d2 = cu * cu + cw * cw;
        if (d2 >= KART_RADIUS * KART_RADIUS) continue;
        ev |= TRAFFIC_MOVED;
        // Von der Ecke weg hinausschieben; was auf die Ecke zuläuft, prallt ab. Kein Dreher.
        const dist = Math.sqrt(d2) || 1e-6;
        const nu = ((du > 0 ? 1 : -1) * cu) / dist;
        const nw = ((dw > 0 ? 1 : -1) * cw) / dist;
        const push = KART_RADIUS - dist;
        s.x += (hx * nu - hz * nw) * push;
        s.z += (hz * nu + hx * nw) * push;
        const vn = (ku - v.speed) * nu + kw * nw;
        if (vn < 0) {
          ku -= nu * vn * 1.3;
          kw -= nw * vn * 1.3;
          if (vn < -5) {
            ev |= EV_WALL;
            s.driftDir = 0;
            s.driftCharge = 0;
          }
        }
        s.vx = hx * ku - hz * kw;
        s.vz = hz * ku + hx * kw;
        continue;
      }
      ev |= TRAFFIC_MOVED;
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
      if (y - p.y >= v.height + radius || y - p.y <= -1.5) continue;
      // Kreis gegen Quader: Abstand zum nächsten Punkt des Rechtecks
      const cu = Math.max(0, Math.abs(du) - v.half);
      const cw = Math.max(0, Math.abs(dw) - v.halfWidth);
      if (cu * cu + cw * cw < radius * radius) return true;
    }
  }
  return false;
}


/**
 * Liegt die Stelle (Kartmitte in Höhe y + 0.6) in einem Schubring? slack weitet die Kugel –
 * für die Anzeige, die ein Kart erst einen Augenblick nach dem Durchflug zu sehen bekommt.
 */
export function ringAt(t: Track, x: number, y: number, z: number, slack = 0): boolean {
  for (const r of t.rings) {
    const dx = x - r.x;
    const dy = y + 0.6 - r.y;
    const dz = z - r.z;
    const reach = r.radius + slack;
    if (dx * dx + dy * dy + dz * dz < reach * reach) return true;
  }
  return false;
}

/** Fliegt oder schwebt das Kart durch einen Schubring? Dann Schub (wie ein Boost-Feld). */
function ringBoost(t: Track, s: KartState): number {
  if (!ringAt(t, s.x, s.y, s.z)) return 0;
  s.boost = PAD_TICKS;
  return EV_PAD;
}

/**
 * Wirksamer Aufwind für ein gleitendes Kart: Steiggeschwindigkeit der Säule, sonst 0.
 * Über der Flugdecke und neben dem Korridor trägt keine Säule mehr. Rechnung und Anzeige
 * fragen dieselbe Funktion – sonst meldete der Bildschirm "Aufwind", während das Kart sinkt.
 */
export function thermalLift(t: Track, seg: number, lat: number, x: number, y: number, z: number): number {
  if (y > t.py[seg] + GLIDE_CEILING || Math.abs(lat) > t.wh[seg]) return 0;
  let lift = 0;
  for (const th of t.thermals) {
    const dx = x - th.x;
    const dz = z - th.z;
    if (dx * dx + dz * dz < th.radius * th.radius && Math.abs(y - th.y) < GLIDE_FALL + GLIDE_CEILING) lift = th.lift;
  }
  return lift;
}

/**
 * Seitlicher Schub des Winds an dieser Stelle zur Rennzeit time, in m/s (nach rechts positiv).
 * Dieselbe Rechnung für die Physik, die KI und die Anzeige.
 */
export function windPush(t: Track, seg: number, along: number, lat: number, time: number): number {
  let blow = 0;
  for (const w of t.winds) {
    if (seg < w.first || seg >= w.first + w.count) continue;
    const k = gustStrength(w, time);
    if (k <= 0) continue;
    const u = (seg - w.first) * t.step + along;
    const ends = Math.min(u + t.step * 0.5, w.count * t.step - u - t.step * 0.5) / WIND_ENDS;
    if (ends <= 0) continue;
    let open = 1;
    for (const l of w.lee) {
      if (seg < l.first || seg > l.last) continue;
      const across = Math.min(lat - l.lat0, l.lat1 - lat) / WIND_EDGE;
      const lengthwise = Math.min((seg - l.first) * t.step + along + t.step * 0.5, (l.last - seg) * t.step - along + t.step * 0.5) / WIND_ENDS;
      if (across > 0 && lengthwise > 0) open = Math.min(open, 1 - Math.min(1, across) * Math.min(1, lengthwise));
    }
    blow += w.push * k * Math.min(1, ends) * open;
  }
  return blow;
}

export function stepKart(s: KartState, cmd: Cmd, env: StepEnv): number {
  const t = TRACK;
  let ev = 0;

  // --- Zeitgeber ---
  if (s.boost > 0) s.boost--;
  if (s.shield > 0) s.shield--;
  if (s.guard > 0) s.guard--;
  if (s.stall > 0) s.stall--;
  if (s.flat > 0) s.flat--;
  // Größe läuft ab – außer in der Abkürzung, die nur diese Größe einlässt (im Mauseloch bleibt man winzig).
  if (s.size !== 0) {
    const k = s.seg < t.total ? t.branchOf[s.seg] : -1;
    if (k < 0 || t.branchOnly[k] !== (s.size > 0 ? 1 : -1)) s.size += s.size > 0 ? -1 : 1;
  }
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
    const hover = centerHeight(t, s.seg, proj.along) + tlat * t.bank[s.seg] + heaveAt(t, s.seg, proj.along, env.time) + TOW_LIFT;
    s.y += (hover - s.y) * Math.min(1, 7 * DT);
    s.vy = 0;
    // Ende: abgelaufen oder mit der Bremse gekappt – aber nie über einem Abgrund.
    const cut = (cmd.buttons & BTN_BRAKE) !== 0 && s.tow < TOW_TICKS - 30;
    if (s.tow === 0 || cut) {
      // Auch kurz vor einer Lücke lässt der Drache nicht los: ohne Anlauf (und ohne Sprungplatte) fiele das Kart hinein.
      let gapSoon = false;
      for (let k = 1, g = s.seg; k <= 26 && !gapSoon; k++) {
        g = t.next[g];
        if (t.edge[g] & EDGE_GAP) gapSoon = true;
      }
      // … und nicht auf schwankenden Pontons: dort käme das Kart mit vollem Zug auf schmalem, nassem Stahl an.
      // … und nicht in der Magnettrommel: Dort könnte er es über einer Deckenplatte absetzen, die gerade abgeschaltet ist.
      if (gapSoon || (t.edge[s.seg] & (EDGE_FLOAT | EDGE_DRUM)) !== 0 || groundAt(t, s.seg, proj.along, tlat) === NO_GROUND) s.tow = Math.max(s.tow, 4);
      else {
        s.tow = 0;
        s.boost = Math.max(s.boost, 45);
        ev |= EV_TOW_END;
      }
    }
    s.flags = FLAG_AIR | (itemBtn ? FLAG_ITEM_HELD : 0);
    return ev;
  }

  // --- Schiene (Achterbahn-Rummel): das Kart sitzt auf einer Schiene und rollt wie ein Achterbahnwagen ---
  // Bergab schießt es los, bergauf verliert es Schwung, den Lifthügel zieht die Kette hinauf. Lenken wechselt die
  // Schiene; herunterfallen kann man nicht. Wer (von einer Sprungfeder) hoch über der Schiene fliegt, landet erst.
  if (t.rails.length > 0 && (t.edge[s.seg] & EDGE_RAIL) !== 0) {
    projectOnTrack(t, s.x, s.z, s.seg);
    const seg = proj.seg;
    const rail = railOf(t, seg);
    if (rail && s.y <= centerHeight(t, seg, proj.along) + proj.lat * t.bank[seg] + RAIL_CATCH && Math.abs(proj.lat) <= t.wh[seg] + 1) {
      const canSteer = env.canDrive && !spinning;
      const steer = canSteer ? Math.max(-1, Math.min(1, cmd.steer / 127)) : 0;
      // Welche Schiene: die nächste – mit Lenkeinschlag die Nachbarschiene in Lenkrichtung.
      let lane = 0;
      for (let i = 1; i < rail.lanes.length; i++) if (Math.abs(rail.lanes[i] - proj.lat) < Math.abs(rail.lanes[lane] - proj.lat)) lane = i;
      if (steer > RAIL_STEER) lane = Math.min(rail.lanes.length - 1, lane + 1);
      else if (steer < -RAIL_STEER) lane = Math.max(0, lane - 1);
      const shift = Math.max(-RAIL_SHIFT * DT, Math.min(RAIL_SHIFT * DT, rail.lanes[lane] - proj.lat));
      const lat = proj.lat + shift;
      // Tempo entlang der Schiene.
      let v = s.vx * t.tx[seg] + s.vz * t.tz[seg];
      const slope = (t.py[t.next[seg]] - t.py[seg]) / t.step;
      let a = -RAIL_G * slope - RAIL_ROLL - RAIL_DRAG * v * v;
      if (canSteer && (cmd.buttons & BTN_GAS) !== 0 && s.stall === 0 && v < RAIL_VGAS) a += RAIL_GAS;
      if (canSteer && (cmd.buttons & BTN_BRAKE) !== 0) a -= RAIL_BRAKE;
      if (s.boost > 0) a += RAIL_BOOST;
      if (spinning) a -= 5;
      v += a * DT;
      for (const l of rail.lifts) {
        // Mit Schub läuft die Kette schneller: Auf dem Lifthügel zahlt sich der Takt der Schubmagnete aus.
        const pull = s.boost > 0 ? l[2] * LIFT_BOOST : l[2];
        if (seg >= l[0] && seg <= l[1] && v < pull) v = Math.min(pull, Math.max(v, 0) + RAIL_CHAIN * DT);
      }
      for (const b of rail.brakes) if (seg >= b[0] && seg <= b[1] && v > b[2]) v = Math.max(b[2], v - RAIL_TRIM * DT);
      // Schubmagnet: zieht er gerade und liegt er auf dieser Schiene, schiebt er an.
      if (env.canDrive) {
        for (const p of t.pulses) {
          if (p.kind !== PULSE_KICK || Math.abs(lat - p.lat) > KICK_HALF || pulseCycle(p, env.time) >= p.on) continue;
          if (Math.abs((s.x - p.x) * t.tx[p.seg] + (s.z - p.z) * t.tz[p.seg]) > p.radius || Math.abs(segDelta(t, p.seg, seg)) > p.radius + 2) continue;
          if (s.boost < KICK_TICKS - 8) {
            // Der Ruck kommt einmal – beim Auffahren auf den Magneten; solange man über ihm ist, hält er den Schub.
            if (s.boost < 6) {
              v += KICK_SPEED;
              ev |= EV_PAD;
            }
            s.boost = KICK_TICKS;
          }
        }
      }
      v = Math.max(env.canDrive ? RAIL_VMIN : 0, Math.min(RAIL_VMAX, v));
      if (!env.canDrive) v = 0;
      s.x += t.tx[seg] * v * DT;
      s.z += t.tz[seg] * v * DT;
      projectOnTrack(t, s.x, s.z, seg);
      const seg1 = proj.seg;
      // Seitlich genau auf die Spur (in Kurven wandert sie sonst).
      s.x += rightX(t, seg1) * (lat - proj.lat);
      s.z += rightZ(t, seg1) * (lat - proj.lat);
      s.seg = seg1;
      s.y = centerHeight(t, seg1, proj.along) + lat * t.bank[seg1];
      s.vy = 0;
      s.vx = t.tx[seg1] * v;
      s.vz = t.tz[seg1] * v;
      // Die Nase folgt der Schiene – beim Wechsel schwenkt sie ein wenig mit.
      s.heading = wrapAngle(trackHeading(t, seg1) - Math.atan2(shift / DT, Math.max(9, v)) * 0.8);
      s.driftDir = 0;
      s.driftCharge = 0;
      s.draft = 0;
      // Items gehen auch auf der Schiene (der Schub wirkt über s.boost, der Drache zieht im nächsten Schritt).
      if (itemBtn && (s.flags & FLAG_ITEM_HELD) === 0 && canSteer && s.item !== ITEM_NONE) ev |= useItem(s, false, true);
      s.flags = itemBtn ? FLAG_ITEM_HELD : 0;
      return ev;
    }
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
  const along0 = proj.along;
  // (Auf Pontons zählt der Seegang mit – und zwar der vom vorigen Tick: so steckt in der Höhenänderung
  // auch die Bewegung des Pontons selbst, und das Kart hebt ab, wenn er unter ihm wegsackt.)
  let g0 = groundNow(t, seg0, along0, lat0, env.time - 1);
  // Wagendach unter dem Kart (Wüstenexpress): Es ist der Boden – und nimmt mit, was auf ihm steht.
  let carryX = 0;
  let carryZ = 0;
  let carryTurn = 0;
  if (t.roofed) {
    const r0 = roofUnder(t, x0, y0, z0, seg0, env.time - 1);
    if (r0 !== NO_GROUND && roofVehicle !== null && (r0 > g0 || g0 === NO_GROUND)) {
      g0 = r0;
      carryX = roofVx;
      carryZ = roofVz;
      carryTurn = roofTurn;
    }
  }

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
  // Tauchen: unter dem Meeresspiegel einer Tauchstrecke trägt das Wasser (siehe mechanics.ts).
  const diving = t.deep[seg0] !== 0 && y0 < t.sea;
  // Magnettrommel: An Wand und Decke halten die Reifen schlechter (an der Decke DRUM_GRIP, am Boden voll).
  const drumGrip = (t.edge[seg0] & EDGE_DRUM) !== 0 ? 1 - ((1 - DRUM_GRIP) * (1 - Math.cos(t.roll[seg0]))) / 2 : 1;
  const hold = drumGrip * A_LAT * ch.grip * (s.size > 0 ? BIG_GRIP : s.size < 0 ? SMALL_GRIP : 1) * (ground.turn ?? ground.grip) * (diving ? DIVE_GRIP : 1) * (wasAir || turnDir === 0 ? 1 : bankGrip(t, seg0, turnDir));
  // Gleitflug: über einer Flugstrecke trägt die Luft (siehe mechanics.ts).
  const gliding = wasAir && (t.edge[seg0] & EDGE_GLIDE) !== 0;
  const yawMax = gliding ? GLIDE_YAW : (v < 0.3 ? 0 : Math.min(v / R_MIN, hold / v)) * (wasAir ? (diving ? DIVE_STEER : t.gravity < 1 ? LOWG_STEER : AIR_STEER) : 1);
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
    const grip = (s.driftDir !== 0 ? GRIP_DRIFT : spinning ? 2.5 : GRIP) * ground.grip * ground.grip * (diving ? DIVE_GRIP : 1) * drumGrip;
    vl *= Math.exp(-grip * DT);
    vf = (vf < 0 ? -1 : 1) * Math.sqrt(Math.max(0, speed * speed - vl * vl));

    // --- Beschleunigen und Bremsen ---
    const boosting = s.boost > 0;
    let vmax = V_MAX * env.speedFactor * ch.vmax * ground.speed * (s.size > 0 ? BIG_VMAX : s.size < 0 ? SMALL_VMAX : 1);
    if (boosting) vmax = V_BOOST * env.speedFactor;
    else if (wasOffroad) vmax *= ch.offroad;
    if (s.stall > 0) vmax *= STALL_FACTOR;
    if (s.flat > 0) vmax *= FLAT_FACTOR;
    if (diving) vmax *= DIVE_SPEED;
    // Flut: wo die Fahrbahn unter Wasser steht, bremst es – je tiefer, desto mehr.
    if (t.tide && t.tidal[seg0]) {
      const depth = tideLevel(t.tide, env.time) - y0;
      if (depth > WATER_FROM) {
        vmax *= waterFactor(depth);
        if (vf > vmax + 2) vf -= 24 * DT;
        if (((env.time % 10) + 10) % 10 === 0 && v > 4) ev |= EV_SPLASH;
      }
    }
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
      if (vf < vmax) vf = Math.min(vmax, vf + ACCEL * ch.accel * (s.size > 0 ? BIG_ACCEL : s.size < 0 ? SMALL_ACCEL : 1) * ground.accel * (diving ? DIVE_ACCEL : 1) * (1 - (0.75 * Math.max(0, vf)) / vmax) * DT);
      else vf = Math.max(vmax, vf - (wasOffroad ? 34 : 10) * DT);
    } else if (brake) {
      if (vf > 0.4) vf = Math.max(0, vf - BRAKE * ground.brake * DT);
      else vf = Math.max(-V_REVERSE, vf - 16 * DT);
    } else {
      // Auf glattem Grund (Eis) rollt das Kart länger aus.
      const d = ((wasOffroad ? COAST + 12 : COAST) * Math.min(1, ground.brake * 2) + (diving ? DIVE_COAST : 0)) * DT;
      vf = vf > d ? vf - d : vf < -d ? vf + d : 0;
    }
  }

  if (gliding) {
    // Die Flugrichtung folgt der Nase weich; das Tempo pendelt sich auf Reisetempo ein (mit Schub darüber).
    const speed = Math.hypot(vf, vl);
    vl *= Math.exp(-GLIDE_GRIP * DT);
    vf = (vf < 0 ? -1 : 1) * Math.sqrt(Math.max(0, speed * speed - vl * vl));
    const cruise = (s.boost > 0 ? V_BOOST : GLIDE_SPEED * ch.vmax) * env.speedFactor * (s.stall > 0 ? STALL_FACTOR : 1);
    if (env.canDrive && !spinning) vf += Math.max(-GLIDE_ACCEL * DT, Math.min(GLIDE_ACCEL * DT, cruise - vf));
  }
  s.vx = fx * vf + rx * vl;
  s.vz = fz * vf + rz * vl;
  s.x += s.vx * DT;
  s.z += s.vz * DT;
  // Förderband: der Boden nimmt das Kart mit. Zu den Rändern hin läuft die Wirkung aus (siehe BELT_EDGE).
  if ((!wasAir || diving) && t.belts.length > 0) {
    let carry = 0;
    let push = 0;
    for (const b of t.belts) {
      if (seg0 < b.first || seg0 >= b.first + b.count) continue;
      // Ein Band wirkt nur am Boden, eine Strömung auch im Schweben – aber nur unter Wasser.
      if (b.swim ? !diving : wasAir) continue;
      const side = Math.min(lat0 - b.lat0, b.lat1 - lat0) / BELT_EDGE;
      if (side <= 0) continue;
      // Lage längs des Bands in Metern ab seinem Anfang
      const u = (seg0 - b.first) * t.step + along0;
      const ends = Math.min(u + t.step * 0.5, b.count * t.step - u - t.step * 0.5) / BELT_RAMP;
      if (ends <= 0) continue;
      const k = Math.min(1, side) * Math.min(1, ends);
      carry += b.along * k;
      push += b.across * k;
    }
    if (carry !== 0 || push !== 0) {
      s.x += (t.tx[seg0] * carry + rightX(t, seg0) * push) * DT;
      s.z += (t.tz[seg0] * carry + rightZ(t, seg0) * push) * DT;
    }
  }

  // Wagendach: der Zug nimmt mit, was auf ihm steht – wie ein Laufband, nur dass es selbst über die Strecke fährt.
  if (!wasAir && (carryX !== 0 || carryZ !== 0)) {
    s.x += carryX * DT;
    s.z += carryZ * DT;
    // In der Kurve dreht sich der Wagen – und mit ihm, was auf ihm steht (Nase und Fahrt).
    if (carryTurn !== 0) {
      const a = carryTurn * DT;
      const cos = Math.cos(a);
      const sin = Math.sin(a);
      const vx = s.vx;
      s.vx = vx * cos + s.vz * sin;
      s.vz = -vx * sin + s.vz * cos;
      s.heading = wrapAngle(s.heading + a);
    }
  }

  // Fluss: das Floß nimmt mit, was auf ihm steht – flussab, mit dem Tempo seiner Bahn.
  if (!wasAir && (t.edge[seg0] & EDGE_RIVER) !== 0) {
    const lane = raftLane(t, seg0, along0, lat0, env.time);
    if (lane) {
      s.x += t.tx[seg0] * lane.speed * DT;
      s.z += t.tz[seg0] * lane.speed * DT;
    }
  }

  // Magnettrommel: Die Schwerkraft zieht weiter zum Hallenboden – an der Wand sackt das Kart seitlich ab (an der rechten
  // Wand nach links, an der linken nach rechts), an der Decke zieht sie es nur von der Bahn weg (das halten die Magnete).
  if (t.drums.length > 0 && (t.edge[seg0] & EDGE_DRUM) !== 0) {
    const sag = -DRUM_SAG * Math.sin(t.roll[seg0]);
    s.x += rightX(t, seg0) * sag * DT;
    s.z += rightZ(t, seg0) * sag * DT;
  }

  // Böe: schiebt quer, am Boden wie in der Luft. Im Windschatten und an den Enden ihres Bereichs läuft sie aus.
  if (t.winds.length > 0 && env.canDrive) {
    const blow = windPush(t, seg0, along0, lat0, env.time);
    if (blow !== 0) {
      const f = wasAir ? WIND_AIR : 1;
      s.x += rightX(t, seg0) * blow * f * DT;
      s.z += rightZ(t, seg0) * blow * f * DT;
      if (Math.abs(blow) > 1.5 && ((env.time % 20) + 20) % 20 === 0) ev |= EV_WIND;
    }
  }

  // --- Strecke: Abschnitt, Bande ---
  projectOnTrack(t, s.x, s.z, s.seg);
  s.seg = proj.seg;
  let lat = proj.lat;
  let along = proj.along;
  let flags = itemBtn ? FLAG_ITEM_HELD : 0;
  // Wer schon unter die Fahrbahn gefallen ist, stößt nirgends mehr an.
  const sunk = y0 < centerHeight(t, s.seg, along) + lat * t.bank[s.seg] + heaveAt(t, s.seg, along, env.time) - STEP_MAX;
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

  // --- Tor: eine gesperrte Abzweigung ---
  // An der Mündung liegen Abzweigung und Hauptstrecke noch ineinander: dort läuft, solange das Tor zu ist, die
  // Bande der Hauptstrecke einfach durch. (Wer tiefer drin ist, wenn es schließt, kommt noch hinaus.)
  if (t.gates.length > 0 && gateShut(t, s.seg, env.time, s.size)) {
    const tw = t.twin[s.seg];
    if (tw >= 0) {
      const nx = rightX(t, tw);
      const nz = rightZ(t, tw);
      const l = (s.x - t.px[tw]) * nx + (s.z - t.pz[tw]) * nz;
      const over = Math.abs(l) - (t.wh[tw] - KART_RADIUS);
      if (over > 0) {
        const sgn = l > 0 ? 1 : -1;
        s.x -= nx * sgn * over;
        s.z -= nz * sgn * over;
        const vn = (s.vx * nx + s.vz * nz) * sgn;
        if (vn > 0) {
          s.vx -= nx * sgn * vn * 1.3;
          s.vz -= nz * sgn * vn * 1.3;
          const loss = Math.min(0.55, 0.008 + vn * 0.03);
          s.vx *= 1 - loss;
          s.vz *= 1 - loss;
          if (vn > 5) {
            ev |= EV_WALL;
            s.driftDir = 0;
            s.driftCharge = 0;
          }
        }
        flags |= FLAG_WALL;
        projectOnTrack(t, s.x, s.z, tw);
        s.seg = proj.seg;
        lat = proj.lat;
        along = proj.along;
      }
    } else if (!gateShut(t, seg0, env.time, s.size)) {
      s.x = x0;
      s.z = z0;
      s.seg = seg0;
      lat = lat0;
      along = along0;
      if (Math.hypot(s.vx, s.vz) > 5) ev |= EV_WALL;
      s.vx *= -0.3;
      s.vz *= -0.3;
    }
  }

  // --- Aus der Größen-Abkürzung heraus: die Größe hält nur noch kurz (sie kündigt ihr Ende gleich an) ---
  if (s.size !== 0 && seg0 !== s.seg && seg0 < t.total) {
    const k0 = t.branchOf[seg0];
    if (k0 >= 0 && t.branchOnly[k0] !== 0 && t.branchOf[s.seg] !== k0 && Math.abs(s.size) > SIZE_WARN) s.size = s.size > 0 ? SIZE_WARN : -SIZE_WARN;
  }

  // --- Größenring: wer hindurchfährt, schrumpft bzw. wächst ---
  if (t.sizers.length > 0 && s.respawn === 0 && seg0 !== s.seg) {
    for (const z of t.sizers) {
      if (!samePath(t, z.seg, seg0) || !samePath(t, z.seg, s.seg)) continue;
      const before = segDelta(t, seg0, z.seg);
      const after = segDelta(t, s.seg, z.seg);
      if (before < 0 || before > 6 || after >= 0 || after < -6) continue;
      if (lat < z.lat0 || lat > z.lat1) continue;
      s.size = z.grow ? SIZE_TICKS : -SIZE_TICKS;
      break;
    }
  }

  // --- Portal: wer durch einen offenen Rahmen fährt, kommt an dessen Ausgang heraus ---
  // (Gleiche seitliche Lage, gleiches Tempo, Richtung und Höhe über dem Boden wie vorher – nur an anderer Stelle.)
  if (t.portals.length > 0 && s.respawn === 0) {
    for (const p of t.portals) {
      // Durchfahrt: eben noch vor dem Ende des Portal-Abschnitts, jetzt dahinter – auf demselben Weg, in Fahrtrichtung.
      if (seg0 === s.seg || !samePath(t, p.seg, seg0) || !samePath(t, p.seg, s.seg)) continue;
      const before = segDelta(t, seg0, p.seg);
      const after = segDelta(t, s.seg, p.seg);
      if (before < 0 || before > 6 || after >= 0 || after < -6) continue;
      if (lat < p.lat0 || lat > p.lat1 || !portalOpen(p, env.time)) continue;
      const dest = walk(t, p.to, -after - 1);
      const g0 = groundAt(t, s.seg, along, lat);
      const turn = trackHeading(t, dest) - trackHeading(t, s.seg);
      const cos = Math.cos(turn);
      const sin = Math.sin(turn);
      const vx = s.vx;
      // Am Ausgang darf die Fahrbahn schmaler sein: innerhalb der Bande bleiben.
      const room = Math.max(0, t.wh[dest] - KART_RADIUS - 0.2);
      const l = Math.max(-room, Math.min(room, lat));
      s.x = t.px[dest] + t.tx[dest] * along + rightX(t, dest) * l;
      s.z = t.pz[dest] + t.tz[dest] * along + rightZ(t, dest) * l;
      const g1 = groundAt(t, dest, along, l);
      s.y = g1 === NO_GROUND ? t.py[dest] : g1 + (g0 === NO_GROUND ? 0 : Math.max(0, s.y - g0));
      s.vx = vx * cos + s.vz * sin;
      s.vz = -vx * sin + s.vz * cos;
      s.heading = wrapAngle(s.heading + turn);
      s.seg = dest;
      lat = l;
      ev |= EV_PORTAL;
      break;
    }
  }

  // --- Verkehr: fahrende Wände, in die man besser nicht hineinrauscht ---
  // (Wer im Ziel ausgerollt ist oder noch an der Ampel steht, wird in Ruhe gelassen.)
  if (t.vehicles.length > 0 && env.canDrive) {
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
  let g = sunk ? NO_GROUND : groundNow(t, s.seg, along, lat, env.time);
  if (t.roofed && !sunk) {
    const r = roofUnder(t, s.x, y0, s.z, s.seg, env.time);
    if (r !== NO_GROUND && (r > g || g === NO_GROUND)) g = r;
  }
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
  if (gliding && g === NO_GROUND) {
    // Statt zu fallen, sinkt das Kart langsam – und steigt in einem Aufwind.
    // (Über der Decke und neben dem Korridor trägt kein Aufwind: thermalLift gibt dort 0.)
    const up = thermalLift(t, s.seg, lat, s.x, s.y, s.z);
    let want = up > 0 ? up : -GLIDE_SINK;
    // Neben dem Korridor trägt die Luft nicht mehr.
    const out = Math.abs(lat) - t.wh[s.seg];
    if (out > 0) want = -GLIDE_SINK - Math.min(1, out / GLIDE_EDGE) * GLIDE_DROP;
    s.vy += (want - s.vy) * Math.min(1, GLIDE_RESPONSE * DT);
    flags |= FLAG_GLIDE;
    // Schubringe
    if (s.boost < PAD_TICKS - 8) ev |= ringBoost(t, s);
  } else if (diving) {
    // Unter Wasser sinkt das Kart nur langsam: jeder Buckel wird zum weiten Schwebesprung.
    s.vy = Math.max(-DIVE_SINK, s.vy - GRAVITY * DIVE_GRAVITY * DT);
    flags |= FLAG_DIVE;
    // Schubringe hängen auch unter Wasser – erreichbar im Sprung oder über einem Blasenschlot.
    if (wasAir && s.boost < PAD_TICKS - 8) ev |= ringBoost(t, s);
  } else {
    // Geringe Schwerkraft (Mond): langsamer Fall, hohe Sprünge; in der Luft hängen dort Schubringe.
    s.vy -= GRAVITY * t.gravity * DT;
    if (wasAir && t.gravity < 1 && s.boost < PAD_TICKS - 8) ev |= ringBoost(t, s);
  }
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
  if (s.y < t.py[s.seg] - (t.edge[s.seg] & EDGE_GLIDE ? GLIDE_FALL : t.fallDepth)) {
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

  // --- Geysire, Lavabomben, Stampfpressen ---
  for (const p of t.pulses) {
    if (!env.canDrive) break;
    const dy = s.y - p.y;
    if (dy < -1.5 || dy > (p.kind === PULSE_BUBBLE ? 5 : 2.5)) continue;
    const dx = s.x - p.x;
    const dz = s.z - p.z;
    if (p.kind === PULSE_ROD) {
      // Blitzableiter: Solange er geladen ist, steht quer über die Fahrbahn ein Ladefeld – wer hindurchfährt, bekommt Schub.
      // (Der Mast steht bei p.lat neben der Bahn; das Feld reicht über deren ganze Breite.)
      if (Math.abs(dx * t.tx[p.seg] + dz * t.tz[p.seg]) > p.radius || pulseCycle(p, env.time) >= p.on) continue;
      if (Math.abs(dx * rightX(t, p.seg) + dz * rightZ(t, p.seg) + p.lat) > t.wh[p.seg] + 0.5) continue;
      if (s.boost < PAD_TICKS - 8 && s.respawn === 0) {
        s.boost = PAD_TICKS;
        ev |= EV_CHARGE;
      }
      continue;
    }
    if (p.kind === PULSE_AVALANCHE) {
      // Die Lawine läuft als Streifen quer über die ganze Bahn: sie schiebt talwärts und bremst.
      if (Math.abs(dx * t.tx[p.seg] + dz * t.tz[p.seg]) > p.radius || pulseCycle(p, env.time) >= p.on) continue;
      const down = p.lat > 0 ? -1 : 1;
      s.x += rightX(t, p.seg) * down * AVALANCHE_PUSH * DT;
      s.z += rightZ(t, p.seg) * down * AVALANCHE_PUSH * DT;
      s.vx *= AVALANCHE_DRAG;
      s.vz *= AVALANCHE_DRAG;
      s.driftDir = 0;
      s.driftCharge = 0;
      if (((env.time % 12) + 12) % 12 === 0) ev |= EV_SNOW;
      continue;
    }
    if (p.kind === PULSE_PRESS) {
      // Die Platte ist quadratisch, wie gezeichnet – auch unter ihren Ecken wird man geplättet.
      const half = p.radius + KART_RADIUS * 0.5;
      if (Math.abs(dx * t.tx[p.seg] + dz * t.tz[p.seg]) > half || Math.abs(dx * rightX(t, p.seg) + dz * rightZ(t, p.seg)) > half) continue;
    } else {
      const reach = p.radius + KART_RADIUS * 0.6;
      if (dx * dx + dz * dz > reach * reach) continue;
    }
    if (pulseCycle(p, env.time) >= p.on) continue;
    if (p.kind === PULSE_BUBBLE) {
      // Der Blasenschlot hebt an: kein Treffer, sondern ein Sprungbrett (solange man in der Säule ist).
      if (s.vy < BUBBLE_LIFT) {
        if ((flags & FLAG_AIR) === 0) {
          // vom Boden lösen (nur einmal – in der Säule hebt dann allein die Geschwindigkeit)
          ev |= EV_BUBBLE;
          s.y += AIR_EPS + 0.05;
          flags |= FLAG_AIR;
        }
        s.vy = BUBBLE_LIFT;
      }
      continue;
    }
    if (p.kind === PULSE_PRESS) {
      // Die Presse plättet: kein Dreher, aber das Kart ist eine Weile flach und langsam.
      const r = flattenKart(s);
      if (r === HIT_BLOCKED) ev |= EV_BLOCK;
      else if (r === HIT_SPIN) ev |= EV_FLAT;
      continue;
    }
    const r = hitKart(s);
    if (r === HIT_BLOCKED) ev |= EV_BLOCK;
    else if (r === HIT_SPIN) {
      ev |= EV_HIT;
      // Der Geysir wirft das Kart hoch, Bombe und Eiszapfen nur ein Stück.
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

  // --- Sprungplatten ---
  // Auch wer knapp über der Platte schwebt (nach einem Hüpfer, bei geringer Schwerkraft dauert das), wird erfasst –
  // sonst flöge er ohne Schwung in die Lücke dahinter.
  if ((!air || (g > NO_GROUND / 2 && s.y - g < 1.6 && s.vy < 4)) && vf > 4 && t.launchers.length > 0) {
    for (const l of t.launchers) {
      if (!samePath(t, l.seg, s.seg)) continue;
      const d = segDelta(t, l.seg, s.seg);
      if (d >= 0 && d <= l.length && Math.abs(lat - l.lat) < l.halfWidth + 0.5) {
        s.vy = l.power;
        s.y += AIR_EPS + 0.05;
        flags |= FLAG_AIR;
        ev |= EV_LAUNCH | EV_TAKEOFF;
        break;
      }
    }
  }

  // --- Item auslösen (bei Tastendruck, nicht beim Halten) ---
  if (itemBtn && (s.flags & FLAG_ITEM_HELD) === 0 && drive && s.item !== ITEM_NONE) {
    const used = useItem(s, air);
    ev |= used;
    if (used & EV_USE_SPRING) flags |= FLAG_AIR;
  }

  s.flags = flags;
  return ev;
}

/**
 * Löst das gehaltene Item aus (Aufrufer prüft Tastenflanke und ob gefahren werden darf). Gibt die Ereignisse zurück;
 * die Sprungfeder setzt dabei das Kart in die Luft (EV_TAKEOFF – der Aufrufer setzt FLAG_AIR).
 * noSpring: Auf den Schienen der Achterbahn bleibt die Feder aufgehoben (sie würde das Kart vom Deck ohne Bande werfen).
 */
function useItem(s: KartState, air: boolean, noSpring = false): number {
  let ev = 0;
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
      if (air || noSpring) used = false;
      else {
        s.vy = SPRING_SPEED;
        s.y += AIR_EPS + 0.05;
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
  return ev;
}
