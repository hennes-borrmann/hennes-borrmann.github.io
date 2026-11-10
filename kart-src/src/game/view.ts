// Gemeinsame Sicht auf das Spiel für Darstellung und Anzeige – egal ob Host oder Client.

import type { SnapshotOil, SnapshotTire } from '../net/protocol';
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
  tires(nowSec: number): SnapshotTire[];
  oils(): SnapshotOil[];
}
