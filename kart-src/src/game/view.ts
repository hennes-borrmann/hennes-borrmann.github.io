// Gemeinsame Sicht auf das Spiel für die Darstellung – egal ob Host oder Client.

export interface RenderEntity {
  slot: number;
  x: number;
  y: number;
  z: number;
  heading: number;
  speed: number;
  flags: number;
}

export interface GameView {
  readonly localSlot: number;
  /**
   * Füllt out mit den Fahrzeugen, wie sie in diesem Bild zu zeichnen sind.
   * @param alpha  Anteil des laufenden Simulationsschritts (0..1)
   * @param nowSec aktuelle Zeit in Sekunden
   * @param dtSec  Zeit seit dem letzten Bild
   */
  entities(alpha: number, nowSec: number, dtSec: number, out: RenderEntity[]): void;
}
