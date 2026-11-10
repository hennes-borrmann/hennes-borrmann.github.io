// Fester Simulationstakt, unabhängig von der Bildrate.
//
// requestAnimationFrame pausiert in Hintergrund-Tabs, und normale Timer werden
// dort auf 1 Hz gedrosselt. Für den Host wäre das fatal – alle anderen würden
// einfrieren. Deshalb gibt ein Web Worker den Takt vor; dessen Timer drosselt
// der Browser nicht. (Auf iPad/iPhone hält das System eine Seite im
// Hintergrund trotzdem komplett an. Der Host muss dort im Vordergrund bleiben.)

export class FixedTicker {
  private acc = 0;
  private last = 0;
  private worker: Worker | null = null;
  private fallbackTimer = 0;
  private running = false;

  constructor(
    private readonly step: () => void,
    private readonly stepMs: number,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.acc = 0;
    this.last = performance.now();
    try {
      const src = 'setInterval(function(){postMessage(0)},8)';
      const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
      this.worker = new Worker(url);
      this.worker.onmessage = () => this.advance();
      URL.revokeObjectURL(url);
    } catch {
      this.worker = null;
      this.fallbackTimer = window.setInterval(() => this.advance(), 8);
    }
  }

  stop(): void {
    this.running = false;
    this.worker?.terminate();
    this.worker = null;
    window.clearInterval(this.fallbackTimer);
  }

  /** Führt fällige Schritte aus und liefert den Anteil des angefangenen Schritts (0..1). */
  advance(): number {
    if (!this.running) return 0;
    const now = performance.now();
    // Nach einer langen Pause nicht alles nachholen.
    this.acc += Math.min(now - this.last, 250);
    this.last = now;
    while (this.acc >= this.stepMs) {
      this.step();
      this.acc -= this.stepMs;
    }
    return this.acc / this.stepMs;
  }
}
