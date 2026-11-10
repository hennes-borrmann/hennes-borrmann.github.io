// Kleine Schnittstelle, über die Bausteine der Szene (Items, Hindernisse)
// Teilchen auslösen können, ohne das Teilchensystem selbst zu kennen.

export interface FxSink {
  /**
   * Leuchtender Funke (additiv, ohne Rand): für Funken, Glut, Blitze.
   * @param life  Lebensdauer in Sekunden
   * @param size  Durchmesser in Metern
   * @param color Farbe als 0xRRGGBB
   * @param gravity Fallbeschleunigung in m/s² (Standard 9)
   */
  spark(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, size: number, color: number, gravity?: number): void;
  /**
   * Deckendes Comic-Bällchen mit dunklem Rand: für Staub, Rauch, Spritzer.
   * @param grow Wachstum des Durchmessers in m/s (Standard 0)
   * @param gravity Fallbeschleunigung in m/s² (Standard 0; negativ = steigt)
   */
  puff(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, size: number, color: number, grow?: number, gravity?: number): void;
}
