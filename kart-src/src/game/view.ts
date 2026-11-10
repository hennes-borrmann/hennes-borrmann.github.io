// Gemeinsame Sicht auf das Spiel für Darstellung und Anzeige – egal ob Host oder Client.

import type { SnapshotThing } from '../net/protocol';
import type { KartState } from './sim';

/** Ein Kart, wie es in diesem Bild zu zeichnen ist. */
export interface RenderEntity extends KartState {
  slot: number;
  bot: boolean;
  lap: number;
  place: number;
  finished: boolean;
}

export interface Standing {
  slot: number;
  bot: boolean;
  place: number;
  lap: number;
  finished: boolean;
  finishTicks: number;
}

export interface RaceView {
  raceId: number;
  /** RACE_COUNTDOWN, RACE_RUNNING oder RACE_RESULTS */
  phase: number;
  laps: number;
  /** Sekunden bis "Los" (negativ = seit so vielen Sekunden läuft das Rennen). */
  untilGo: number;
  /** Bit i gesetzt = Kiste i liegt bereit. */
  boxes: number;
  /** Geschätzter Host-Tick von jetzt – Takt für alles, was auf allen Bildschirmen gleich laufen soll. */
  hostTick: number;
  /**
   * Rennzeit von jetzt in Ticks seit "Los" (gebrochen, im Countdown negativ),
   * so wie das eigene Kart sie gerade erlebt: der Takt, in dem Verkehr, Geysire
   * und Lava zu zeichnen sind (mechanics.ts).
   */
  time: number;
}

export interface GameView {
  readonly localSlot: number;
  /**
   * Füllt out mit den Karts, wie sie in diesem Bild zu zeichnen sind.
   * @param alpha  Anteil des laufenden Simulationsschritts (0..1)
   * @param nowSec aktuelle Zeit in Sekunden
   * @param dtSec  Zeit seit dem letzten Bild
   */
  entities(alpha: number, nowSec: number, dtSec: number, out: RenderEntity[]): void;
  race(nowSec: number): RaceView;
  standings(): Standing[];
  /** Rollreifen, Ölflecken, Brummkreisel, Rauchwolken – wie sie in diesem Bild zu zeichnen sind. */
  things(nowSec: number): SnapshotThing[];
}
