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
/** Ladung, ab der der Windschatten beim Ausscheren Schub gibt (Ticks × 2). */
export const DRAFT_FULL = 80;
/** Ab diesem Tempounterschied (m/s) ist ein Auffahrunfall ein Treffer, darunter nur ein Stoß. */
export const CRASH_SPEED = 7;

// --- Geysire und Lavabomben ------------------------------------------------------

export const PULSE_VENT = 0;
export const PULSE_BOMB = 1;

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
