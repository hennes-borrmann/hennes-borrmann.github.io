// 1€-Filter (Casiez, Roussel, Vogel 2012): ein Tiefpass, dessen Grenzfrequenz
// mit der Bewegungsgeschwindigkeit steigt. Im Stillstand glättet er Rauschen
// weg, bei schnellen Bewegungen lässt er das Signal fast unverzögert durch –
// genau das, was eine Lenkung braucht.

function alpha(cutoffHz: number, dt: number): number {
  const tau = 1 / (2 * Math.PI * cutoffHz);
  return 1 / (1 + tau / dt);
}

export class OneEuroFilter {
  private x = 0;
  private dx = 0;
  private t = Number.NaN;

  /**
   * @param minCutoff Grenzfrequenz im Stillstand (Hz) – kleiner = ruhiger, träger
   * @param beta      wie stark die Grenzfrequenz mit dem Tempo wächst (Hz pro Einheit/s)
   * @param dCutoff   Glättung der Geschwindigkeitsschätzung (Hz)
   */
  constructor(
    private readonly minCutoff: number,
    private readonly beta: number,
    private readonly dCutoff: number,
  ) {}

  reset(): void {
    this.t = Number.NaN;
  }

  filter(value: number, tSec: number): number {
    if (Number.isNaN(this.t)) {
      this.t = tSec;
      this.x = value;
      this.dx = 0;
      return value;
    }
    const dt = tSec - this.t;
    if (dt <= 0) return this.x;
    this.t = tSec;
    // Nach einer Pause (Seite war im Hintergrund) nicht aus alten Werten herausgleiten.
    if (dt > 0.25) {
      this.x = value;
      this.dx = 0;
      return value;
    }
    const rawDx = (value - this.x) / dt;
    this.dx += alpha(this.dCutoff, dt) * (rawDx - this.dx);
    const cutoff = this.minCutoff + this.beta * Math.abs(this.dx);
    this.x += alpha(cutoff, dt) * (value - this.x);
    return this.x;
  }
}
