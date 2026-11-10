// Glatte Darstellung fremder Fahrzeuge.
//
// Zustände kommen stoßweise und mit schwankender Verzögerung an. Statt den
// jeweils neuesten Stand zu zeigen (ruckelt), spielen wir jedes Fahrzeug ein
// kleines Stück in der Vergangenheit ab und interpolieren zwischen zwei
// bekannten Ständen.
//
// Die Zeitachse ist die des Fahrzeugs selbst (ptick = Anzahl seiner
// Simulationsschritte). So bleibt die Bewegung auch dann gleichmäßig, wenn der
// Host die Eingaben eines Spielers mal zwei auf einmal und mal gar keine
// verarbeitet.

import { DT, FLAG_AIR, copyState, newState, type KartState } from './sim';

interface Sample {
  t: number;
  s: KartState;
}

const MAX_EXTRAPOLATE = 0.1;

export function lerpAngle(a: number, b: number, k: number): number {
  let d = b - a;
  if (d > Math.PI) d -= 2 * Math.PI;
  else if (d < -Math.PI) d += 2 * Math.PI;
  return a + d * k;
}

export function lerpState(out: KartState, a: KartState, b: KartState, k: number): KartState {
  // Alles, was keine Position oder Geschwindigkeit ist, kommt vom näheren Stand.
  copyState(out, k < 0.5 ? a : b);
  // Ein Sprung über viele Meter ist kein Fahren, sondern ein Versetzen (Zurücksetzen nach Absturz).
  if (Math.abs(b.x - a.x) + Math.abs(b.z - a.z) > 8) return copyState(out, b);
  out.x = a.x + (b.x - a.x) * k;
  out.y = a.y + (b.y - a.y) * k;
  out.z = a.z + (b.z - a.z) * k;
  out.heading = lerpAngle(a.heading, b.heading, k);
  out.vx = a.vx + (b.vx - a.vx) * k;
  out.vy = a.vy + (b.vy - a.vy) * k;
  out.vz = a.vz + (b.vz - a.vz) * k;
  return out;
}

export class EntityInterp {
  /** Bilder, in denen wir über den neuesten bekannten Stand hinaus mussten. */
  underruns = 0;

  private samples: Sample[] = [];
  /** Abbildung Echtzeit → Fahrzeugzeit, bestimmt vom am wenigsten verspäteten Paket. */
  private offset = 0;
  private clock = Number.NaN;

  /** @param delay Abspielverzögerung in Sekunden. */
  constructor(private readonly delay: number) {}

  reset(): void {
    this.samples = [];
    this.clock = Number.NaN;
  }

  push(ptick: number, state: KartState, nowSec: number): void {
    const t = ptick * DT;
    const last = this.samples[this.samples.length - 1];
    if (last) {
      if (t <= last.t) {
        // Zähler läuft rückwärts: Gegenseite hat neu gestartet → von vorn.
        if (t < last.t - 1) this.reset();
        else return;
      }
    }
    const cand = t - nowSec;
    if (this.samples.length === 0 || cand > this.offset || cand < this.offset - 0.25) this.offset = cand;
    this.samples.push({ t, s: copyState(newState(), state) });
    // Altes verwerfen, aber immer genug zum Interpolieren behalten.
    const keepFrom = (Number.isNaN(this.clock) ? t : this.clock) - 0.5;
    while (this.samples.length > 2 && this.samples[1].t < keepFrom) this.samples.shift();
  }

  /** Schreibt den darzustellenden Zustand nach out. false, solange noch nichts bekannt ist. */
  sample(nowSec: number, dtSec: number, out: KartState): boolean {
    const n = this.samples.length;
    if (n === 0) return false;

    // Uhren zweier Geräte laufen nie exakt gleich schnell; langsam nachgeben.
    this.offset -= dtSec * 0.002;
    const target = nowSec + this.offset - this.delay;
    if (Number.isNaN(this.clock) || Math.abs(target - this.clock) > 0.3) {
      this.clock = target;
    } else {
      const rate = 1 + Math.max(-0.1, Math.min(0.1, (target - this.clock) * 3));
      this.clock += dtSec * rate;
    }

    const newest = this.samples[n - 1];
    if (this.clock >= newest.t) {
      // Kurz weiterrechnen, danach stehen bleiben.
      const ext = Math.min(this.clock - newest.t, MAX_EXTRAPOLATE);
      copyState(out, newest.s);
      out.x += out.vx * ext;
      out.z += out.vz * ext;
      // Nur im Flug auch die Höhe weiterrechnen – am Boden würde das Kart sonst einsinken.
      if (out.flags & FLAG_AIR && out.respawn === 0) out.y += out.vy * ext;
      if (this.clock - newest.t > DT) this.underruns++;
      return true;
    }
    if (this.clock <= this.samples[0].t) {
      copyState(out, this.samples[0].s);
      return true;
    }
    for (let i = n - 2; i >= 0; i--) {
      const a = this.samples[i];
      if (a.t <= this.clock) {
        const b = this.samples[i + 1];
        lerpState(out, a.s, b.s, (this.clock - a.t) / (b.t - a.t));
        return true;
      }
    }
    copyState(out, newest.s);
    return true;
  }
}
