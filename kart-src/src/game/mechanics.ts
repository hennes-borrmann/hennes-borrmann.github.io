// Streckenmechanik: alles, was auf einer Strecke von selbst fährt oder im Takt
// etwas tut – Verkehr, Geysire, Lavabomben, steigende Lava.
//
// Jede Stellung ist eine reine Funktion der Rennzeit (Ticks seit "Los",
// während des Countdowns negativ). Nichts davon steht im Spielstand und nichts
// reist über das Netz: der Host und jeder Bildschirm rechnen dieselbe Formel.
// Die Rennzeit gehört zu jeder Eingabe (StepEnv.time in sim.ts) – deshalb
// stimmt die Vorhersage auf dem Bildschirm eines Mitspielers auch dann, wenn
// er einen Bus streift.
//
// Dieses Modul kennt keine Strecke und kein Kart (keine Importe): es
// beschreibt nur, was es gibt und wann es etwas tut. Wo ein Fahrzeug auf der
// Strecke steht, rechnet track.ts (vehiclePose); was mit einem Kart passiert,
// rechnet sim.ts.

// --- Verkehr -------------------------------------------------------------------

export const VEH_TAXI = 0;
export const VEH_VAN = 1;
export const VEH_BUS = 2;
export const VEH_TRAM = 3;

export interface VehicleSpec {
  /** Halbe Länge und halbe Breite eines Wagens, Höhe über der Fahrbahn (Meter). */
  half: number;
  halfWidth: number;
  height: number;
  /** Anzahl Wagen (Straßenbahn: mehrere, die der Kurve folgen) und ihr Abstand von Mitte zu Mitte. */
  cars: number;
  pitch: number;
}

export const VEHICLE_SPECS: VehicleSpec[] = [
  { half: 2.2, halfWidth: 0.95, height: 1.5, cars: 1, pitch: 0 },
  { half: 2.7, halfWidth: 1.05, height: 2.3, cars: 1, pitch: 0 },
  { half: 5.2, halfWidth: 1.25, height: 3.0, cars: 1, pitch: 0 },
  { half: 3.5, halfWidth: 1.2, height: 3.1, cars: 3, pitch: 7.5 },
];

/** Ein Fahrzeug im Verkehr: fährt mit festem Tempo auf fester Spur die Hauptstrecke entlang. */
export interface Vehicle extends VehicleSpec {
  id: number;
  kind: number;
  /** Spur: seitliche Lage der Fahrzeugmitte bei Nennbreite der Fahrbahn (Meter, rechts positiv). */
  lat: number;
  /** Tempo in m/s. */
  speed: number;
  /** Lage des vordersten Wagens bei Rennzeit 0: Meter hinter der Startlinie. */
  offset: number;
}

/** Beschreibung in der Streckendatei: Spuren mit je einem Tempo und ihren Fahrzeugen [Art, Meter]. */
export interface TrafficDef {
  lanes: { lat: number; speed: number; cars: [number, number][] }[];
}

/** Lage des vordersten Wagens zur Rennzeit time (Ticks, auch gebrochen): Meter hinter der Startlinie, 0 ≤ s < lap. */
export function vehicleAt(v: Vehicle, time: number, lap: number): number {
  const s = (v.offset + (v.speed * time) / 60) % lap;
  return s < 0 ? s + lap : s;
}

/** Windschatten: so weit hinter dem Heck und so weit seitlich der Fahrzeugmitte wirkt er (Meter). */
export const WAKE_LENGTH = 18;
export const WAKE_HALF = 1.7;
/**
 * Windschatten im Zustand eines Karts (KartState.draft): 0 … DRAFT_FULL lädt er
 * (zwei je Tick hinter einem Fahrzeug); wer geladen ausschert, bekommt Zug –
 * dann zählt der Wert von DRAFT_PULL_FROM + DRAFT_PULL_TICKS herunter.
 */
export const DRAFT_FULL = 80;
export const DRAFT_PULL_FROM = 100;
export const DRAFT_PULL_TICKS = 85;
/** Ab diesem Tempounterschied (m/s) ist ein Auffahrunfall ein Treffer, darunter nur ein Stoß. */
export const CRASH_SPEED = 7;

// --- Geysire und Lavabomben ------------------------------------------------------

export const PULSE_VENT = 0;
export const PULSE_BOMB = 1;
/** Stampfpresse: schlägt im Takt herunter und plättet, was darunter steht. */
export const PULSE_PRESS = 2;
/** Blasenschlot (unter Wasser): hebt im Takt an, was über ihm ist – ein Sprungbrett, kein Treffer. */
export const PULSE_BUBBLE = 3;
/**
 * Ablauf einer Presse, gemeinsam für Physik und Bild: in den letzten PRESS_STRIKE Ticks
 * vor Zyklus 0 fällt der Stempel und schlägt bei 0 auf – genau dann beginnt die Gefahr
 * (on Ticks lang). Er hebt sich schon PRESS_LEAD Ticks vor deren Ende wieder, so dass er
 * bei ihrem Ende über Karthöhe steht; nach PRESS_RISE Ticks ist er ganz oben.
 */
export const PRESS_STRIKE = 3;
export const PRESS_LEAD = 10;
export const PRESS_RISE = 40;

/**
 * Eine Stelle, an der im Takt etwas passiert. Der Zyklus beginnt mit dem
 * Ausbruch bzw. Einschlag (on Ticks lang gefährlich), dann ist Ruhe, und die
 * letzten warn Ticks vor dem nächsten Ausbruch kündigt er sich an.
 */
export interface Pulse {
  kind: number;
  seg: number;
  lat: number;
  x: number;
  y: number;
  z: number;
  radius: number;
  /** Alles in Ticks. */
  period: number;
  phase: number;
  on: number;
  warn: number;
}

/** Stand im Zyklus: 0 ≤ c < period. c < on = gefährlich, c ≥ period − warn = Vorwarnung. */
export function pulseCycle(p: Pulse, time: number): number {
  const c = (time + p.phase) % p.period;
  return c < 0 ? c + p.period : c;
}

export function pulseActive(p: Pulse, time: number): boolean {
  return pulseCycle(p, time) < p.on;
}

/**
 * Wie weit der Stempel einer Presse offen steht: 0 = liegt auf der Fahrbahn, 1 = ganz oben
 * (das Ansenken während der Vorwarnung ist Zierde und hier nicht enthalten).
 */
export function pressOpen(p: Pulse, time: number): number {
  const c = pulseCycle(p, time);
  if (c >= p.period - PRESS_STRIKE) {
    const k = (c - (p.period - PRESS_STRIKE)) / PRESS_STRIKE;
    return 1 - k * k;
  }
  const up = p.on - PRESS_LEAD;
  if (c < up) return 0;
  const k = (c - up) / PRESS_RISE;
  return k >= 1 ? 1 : 1 - (1 - k) * (1 - k);
}

/** 0 = Ruhe … 1 = bricht gleich aus. */
export function pulseWarning(p: Pulse, time: number): number {
  const c = pulseCycle(p, time);
  return c >= p.period - p.warn ? (c - (p.period - p.warn)) / p.warn : 0;
}

// --- Steigende Lava ----------------------------------------------------------------

/** Ein Stück Fahrbahn, das im Takt überflutet wird: steigt, steht, fällt, ist frei. */
export interface Flood {
  /** Erster Abschnitt und Anzahl (zusammenhängend auf einem Weg). */
  first: number;
  count: number;
  /** Abzweigung, auf der das Stück liegt (−1 = Hauptstrecke). */
  branch: number;
  /** Alles in Ticks. */
  period: number;
  phase: number;
  rise: number;
  hold: number;
  fall: number;
  /** Ticks, die ein Kart mit vollem Tempo von der Gabelung bis hierher braucht (für Ampel und KI). */
  lead: number;
}

/** Pegel 0 (frei) … 1 (voll) zur Rennzeit time. */
export function floodLevel(f: Flood, time: number): number {
  let c = (time + f.phase) % f.period;
  if (c < 0) c += f.period;
  if (c < f.rise) return c / f.rise;
  c -= f.rise;
  if (c < f.hold) return 1;
  c -= f.hold;
  if (c < f.fall) return 1 - c / f.fall;
  return 0;
}

/** Ab diesem Pegel bremst die Lava. */
export const FLOOD_FROM = 0.3;
/** Höchster Pegel über dem tiefsten Punkt der Fahrbahn (Meter) – für die Darstellung. */
export const FLOOD_DEPTH = 0.55;

/** Höchster Pegel im Zeitraum [from, to] (Ticks) – "steht Lava, während ich hindurchfahre?". */
export function floodPeak(f: Flood, from: number, to: number): number {
  let peak = 0;
  for (let t = from; t <= to; t += 15) peak = Math.max(peak, floodLevel(f, t));
  return Math.max(peak, floodLevel(f, to));
}

// --- Förderbänder ----------------------------------------------------------------

/**
 * Ein Stück Fahrbahn, das sich bewegt: wer darauf fährt, wird mitgenommen –
 * längs (schneller oder langsamer) oder quer (zur Seite geschoben). Bänder
 * laufen immer; sie hängen nicht von der Rennzeit ab.
 */
export interface Belt {
  /** Erster Abschnitt und Anzahl (zusammenhängend auf einem Weg). */
  first: number;
  count: number;
  /** Seitlicher Bereich von … bis (Meter, rechts positiv). */
  lat0: number;
  lat1: number;
  /** Tempo des Bands in m/s: längs (vorwärts positiv) und quer (nach rechts positiv). */
  along: number;
  across: number;
  /** Strömung unter Wasser statt Förderband: nimmt das Kart auch mit, wenn es schwebt. */
  swim?: boolean;
}
/**
 * Zum Rand eines Bands hin läuft seine Wirkung aus: seitlich über BELT_EDGE Meter, an
 * Anfang und Ende über BELT_RAMP Meter. An der Naht zweier gegenläufiger Bänder springt
 * das Tempo deshalb nicht – sonst genügte dort ein Tausendstelmillimeter Unterschied
 * zwischen Host und Mitspieler für 20 cm Abweichung.
 */
export const BELT_EDGE = 0.5;
export const BELT_RAMP = 2;

// --- Ebbe und Flut -----------------------------------------------------------------

/**
 * Der Wasserspiegel steigt und fällt im Takt. Wo die Fahrbahn tiefer liegt als
 * das Wasser, bremst es – je tiefer, desto mehr. Dazu schwappt eine Welle.
 */
export interface Tide {
  /** Wasserhöhe bei Ebbe und bei Flut (Meter, dieselbe Höhe wie die Fahrbahn). */
  low: number;
  high: number;
  /** Alles in Ticks. */
  period: number;
  phase: number;
  /** Welle: Ausschlag in Metern und Periode in Ticks. */
  wave: number;
  wavePeriod: number;
}

/** Anteil der Periode, in dem das Wasser steigt bzw. fällt (dazwischen steht es). */
const TIDE_TURN = 0.16;

/** Stand der Gezeit ohne Welle: 0 = Ebbe … 1 = Flut. Der Zyklus beginnt mit Ebbe. */
export function tidePhase(t: Tide, time: number): number {
  let c = ((time + t.phase) % t.period) / t.period;
  if (c < 0) c += 1;
  const stay = 0.5 - TIDE_TURN;
  const ease = (k: number): number => k * k * (3 - 2 * k);
  if (c < stay) return 0;
  if (c < 0.5) return ease((c - stay) / TIDE_TURN);
  if (c < 0.5 + stay) return 1;
  return 1 - ease((c - 0.5 - stay) / TIDE_TURN);
}

/** Höhe des Wasserspiegels zur Rennzeit time (mit Welle). */
export function tideLevel(t: Tide, time: number): number {
  return t.low + (t.high - t.low) * tidePhase(t, time) + t.wave * Math.sin((time / t.wavePeriod) * 2 * Math.PI);
}

/** Ab dieser Wassertiefe (Meter) bremst es; WATER_DRAG je Meter Tiefe, höchstens WATER_MAX. */
export const WATER_FROM = 0.06;
export const WATER_DRAG = 1;
export const WATER_MAX = 0.55;

/**
 * Faktor auf die Höchstgeschwindigkeit bei dieser Wassertiefe. Setzt an der Wasserlinie
 * stetig ein (kein Sprung): eine Welle oder eine um einen Tick andere Rennzeit ändert
 * das Tempo dort nur unmerklich.
 */
export function waterFactor(depth: number): number {
  return depth <= WATER_FROM ? 1 : 1 - Math.min(WATER_MAX, (depth - WATER_FROM) * WATER_DRAG);
}

/** Geplättet (Stampfpresse): so lange fährt das Kart flach und langsam (Ticks). */
export const FLAT_TICKS = 130;
export const FLAT_FACTOR = 0.55;

// --- Fliegen -----------------------------------------------------------------------
// Über einer Flugstrecke (Lücke mit EDGE_GLIDE) trägt die Luft: das Kart sinkt
// nur langsam, lenkt weich und hält sein Tempo. Aufwinde heben es, Ringe geben
// Schub. Die gedachte Ideallinie ist die Höhe der Abschnitte (track.py).

/** Sinkgeschwindigkeit im Gleitflug (m/s) und wie schnell sich die Steig-/Sinkrate einstellt (1/s). */
export const GLIDE_SINK = 2.6;
export const GLIDE_RESPONSE = 2.4;
/** Reisetempo im Gleitflug (m/s) und wie zügig es erreicht wird (m/s²). */
export const GLIDE_SPEED = 29;
export const GLIDE_ACCEL = 12;
/** Drehrate bei vollem Lenkeinschlag (rad/s) und wie schnell die Flugrichtung der Nase folgt (1/s). */
export const GLIDE_YAW = 1.15;
export const GLIDE_GRIP = 2.6;
/** So weit über der Ideallinie ist Schluss mit Steigen, so weit darunter ist das Kart abgestürzt (Meter). */
export const GLIDE_CEILING = 13;
export const GLIDE_FALL = 15;
/**
 * Neben dem Flugkorridor trägt die Luft nicht: GLIDE_EDGE Meter außerhalb sinkt das Kart
 * um GLIDE_DROP m/s schneller (dazwischen anteilig) – wer abdriftet, fällt bald und wird zurückgesetzt.
 */
export const GLIDE_EDGE = 6;
export const GLIDE_DROP = 10;

/** Aufwind: eine Säule aufsteigender Luft. Wer hindurchfliegt, steigt. */
export interface Thermal {
  seg: number;
  lat: number;
  x: number;
  z: number;
  /** Höhe der Ideallinie an dieser Stelle. */
  y: number;
  radius: number;
  /** Steiggeschwindigkeit in der Säule (m/s). */
  lift: number;
}

/** Schubring in der Luft: wer hindurchfliegt, bekommt Schub. */
export interface Ring {
  seg: number;
  lat: number;
  x: number;
  /** Höhe der Ringmitte. */
  y: number;
  z: number;
  radius: number;
}

// --- Tauchen -----------------------------------------------------------------------
// Unter Wasser (Abschnitte mit track.deep, Kart unter dem Meeresspiegel track.sea) trägt
// das Wasser: das Kart sinkt nur langsam und springt deshalb weit, es rollt schneller
// aus und rutscht in Kurven mehr. Strömungen (Belt.swim) nehmen es mit, auch im
// Schweben. Blasenschlote (PULSE_BUBBLE) heben es im Takt an – oben hängen Schubringe.

/** Anteil der Schwerkraft unter Wasser und die höchste Sinkgeschwindigkeit (m/s). */
export const DIVE_GRAVITY = 0.3;
export const DIVE_SINK = 6.5;
/** Faktoren unter Wasser: Höchsttempo, Antritt, Seitenhalt. */
export const DIVE_SPEED = 0.94;
export const DIVE_ACCEL = 0.88;
export const DIVE_GRIP = 0.86;
/** So viel zusätzliche Verzögerung beim Ausrollen (m/s²) – Wasser bremst. */
export const DIVE_COAST = 7;
/** Im Schweben lenkt es sich unter Wasser besser als in der Luft (Anteil der Lenkung am Boden). */
export const DIVE_STEER = 0.75;
/** Ein Blasenschlot hebt mit dieser Geschwindigkeit (m/s). */
export const BUBBLE_LIFT = 6.5;
