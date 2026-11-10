// Neigung des Handys → Lenkwert -1..1.
//
// Gemessen wird, wie schräg die lange Achse des Handys gegenüber dem Horizont
// steht. Das funktioniert in jeder Haltung gleich: aufrecht wie ein Lenkrad,
// flach wie ein Tablett oder irgendwo dazwischen. Die Richtung der Schwerkraft
// kommt aus den fusionierten Lagewinkeln (deviceorientation), nicht aus dem
// rohen Beschleunigungssensor – der würde bei jedem Ruckeln ausschlagen.

import { OneEuroFilter } from './oneEuro';
import { maxAngle, type ControllerSettings } from './settings';

const DEG = Math.PI / 180;

/**
 * Richtung "oben" in Gerätekoordinaten (X = rechte Kante, Y = Oberkante,
 * Z = aus dem Display heraus) aus den Winkeln beta/gamma in Grad.
 * Entspricht der dritten Zeile der W3C-Rotationsmatrix Rz(α)·Rx(β)·Ry(γ).
 */
export function upVector(betaDeg: number, gammaDeg: number): { x: number; y: number; z: number } {
  const b = betaDeg * DEG;
  const g = gammaDeg * DEG;
  return { x: -Math.cos(b) * Math.sin(g), y: Math.sin(b), z: Math.cos(b) * Math.cos(g) };
}

/** Totzone um die Mitte, danach wieder stetig von 0 bis 1. */
export function applyDeadzone(x: number, deadzone: number): number {
  const a = Math.abs(x);
  if (a <= deadzone) return 0;
  return Math.sign(x) * Math.min(1, (a - deadzone) / (1 - deadzone));
}

export class TiltSteering {
  /** Kommen Sensorwerte an? */
  active = false;
  events = 0;
  /** Schräglage der langen Achse in Grad, positiv = rechts tiefer (nach rechts lenken). */
  angle = 0;
  /** Geglätteter Winkel relativ zur kalibrierten Mitte, in Grad. */
  centered = 0;
  /** Fertiger Lenkwert -1..1. */
  value = 0;
  /** +1: Oberkante des Handys zeigt nach links, -1: nach rechts. */
  side: 1 | -1 = 1;
  onSideChange: (() => void) | null = null;
  /** Wird nach jedem verarbeiteten Sensorwert aufgerufen (löst das Senden aus). */
  onSample: ((nowMs: number) => void) | null = null;

  private zero = 0;
  private lastEventAt = 0;
  // Werte siehe tests/unit/tilt.test.ts: Verzögerung bei zügiger Lenkbewegung unter 10 ms.
  private readonly filter = new OneEuroFilter(6, 0.12, 4);
  private listening = false;
  private readonly handler = (e: DeviceOrientationEvent): void => this.onOrientation(e);

  constructor(private readonly settings: ControllerSettings) {
    // Startannahme aus der Bildschirmausrichtung; sobald die Schwerkraft eine
    // klare Aussage erlaubt, zählt die.
    if (typeof window !== 'undefined') {
      const a = window.screen?.orientation?.angle ?? (window as unknown as { orientation?: number }).orientation ?? 0;
      if (a === 270 || a === -90) this.side = -1;
    }
  }

  start(): void {
    if (this.listening) return;
    this.listening = true;
    window.addEventListener('deviceorientation', this.handler);
  }

  /** Aktuelle Haltung als Geradeausstellung übernehmen. */
  calibrate(): void {
    this.zero = this.angle;
    this.filter.reset();
    this.centered = 0;
    this.value = 0;
  }

  /** Seit mehr als einer halben Sekunde kein Sensorwert → gilt als ausgefallen. */
  checkAlive(now: number): void {
    if (this.active && now - this.lastEventAt > 500) {
      this.active = false;
      this.value = 0;
    }
  }

  /** Für Tests: einen Sensorwert direkt einspeisen. */
  feed(betaDeg: number, gammaDeg: number, tMs: number): void {
    const up = upVector(betaDeg, gammaDeg);
    // Welche Seite oben ist, erst bei deutlicher Lage umschalten – in flacher
    // Haltung würde das Vorzeichen sonst flattern.
    const before = this.side;
    if (up.x > 0.3) this.side = 1;
    else if (up.x < -0.3) this.side = -1;
    if (before !== this.side) {
      this.filter.reset();
      this.onSideChange?.();
    }
    this.angle = (Math.asin(Math.max(-1, Math.min(1, up.y))) / DEG) * this.side;
    this.centered = this.filter.filter(this.angle - this.zero, tMs / 1000);
    const raw = this.centered / maxAngle(this.settings.sensitivity);
    const v = applyDeadzone(Math.max(-1, Math.min(1, raw)), this.settings.deadzone);
    this.value = this.settings.invert ? -v : v;
    this.lastEventAt = tMs;
    this.active = true;
    this.events++;
  }

  private onOrientation(e: DeviceOrientationEvent): void {
    if (e.beta === null || e.gamma === null) return;
    const now = performance.now();
    this.feed(e.beta, e.gamma, now);
    this.onSample?.(now);
  }
}
