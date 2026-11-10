// Einmal-Geräusche. Jedes ist ein kleines Rezept aus wenigen Schichten:
// Töne mit Tonhöhenfahrt, gefiltertes Rauschen, kurze Notenfolgen. Nichts ist
// aufgenommen – alles entsteht im Augenblick des Abspielens.

import { clamp, mtof, type Mixer, type Wave } from './mixer';
import type { SfxName } from './types';

/** Höchstens so viele Geräusche gleichzeitig; weitere fallen weg. */
const MAX_VOICES = 16;

/** Mindestabstand zwischen zwei gleichen Geräuschen (Sekunden). */
const MIN_GAP: Partial<Record<SfxName, number>> = {
  'roulette-tick': 0.06,
  wall: 0.25,
  bump: 0.2,
  land: 0.15,
  'drift-start': 0.2,
  boost: 0.12,
  warn: 0.22,
};
const DEFAULT_GAP = 0.04;

/**
 * Abgleich der Lautstärken untereinander. Die Rezepte unten sind nach Klang
 * gebaut, nicht nach Pegel; diese Faktoren bringen sie auf gemessene Spitzen
 * von etwa 0,2 (Klick) bis 0,6 (Treffer) – laut genug neben Motor und Musik.
 */
const LEVEL: Record<SfxName, number> = {
  'ui-click': 3,
  'ui-back': 2.7,
  join: 1.1,
  ready: 1.3,
  count: 3,
  go: 3,
  boost: 4.6,
  turbo1: 3.8,
  turbo2: 4,
  turbo3: 4.4,
  'drift-start': 13,
  pickup: 1.8,
  'roulette-tick': 3.8,
  'item-ready': 1.3,
  'use-tire': 3,
  'use-oil': 3.2,
  'use-top': 2.8,
  'use-guard': 3.6,
  'use-emp': 3.4,
  'use-smoke': 2.2,
  'use-spring': 3.8,
  'use-kite': 4.5,
  warn: 2.2,
  hit: 3.8,
  'guard-block': 4.4,
  stall: 2.2,
  bump: 3.4,
  wall: 3.1,
  land: 3.4,
  fall: 3.8,
  respawn: 3,
  lap: 1.4,
  'final-lap': 1.45,
  finish: 1.35,
  win: 1.5,
  lose: 1.3,
};

interface ToneOpts {
  /** Beginn relativ zum Start des Geräuschs. */
  at?: number;
  /** Einschwingzeit. */
  attack?: number;
  /** Vibrato: Frequenz in Hz und Hub als Anteil der Tonhöhe. */
  vibHz?: number;
  vibDepth?: number;
  /** Tremolo (Lautstärke-Flattern) in Hz. */
  tremHz?: number;
  /** Tonhöhe erst halten, dann fahren: Anteil der Dauer bis zum Beginn der Fahrt. */
  hold?: number;
}

interface NoiseOpts {
  at?: number;
  attack?: number;
  type?: BiquadFilterType;
  q?: number;
  brown?: boolean;
}

/** Baut ein einzelnes Geräusch zusammen und räumt es nach dem Ausklingen wieder ab. */
class Voice {
  readonly out: GainNode;
  private readonly t0: number;
  private end = 0;
  private readonly sources: AudioScheduledSourceNode[] = [];

  constructor(
    private readonly mx: Mixer,
    gain: number,
    pan: number,
  ) {
    const ctx = mx.ctx;
    this.t0 = ctx.currentTime + 0.006;
    this.out = ctx.createGain();
    this.out.gain.value = gain;
    const p = pan !== 0 ? mx.panner(pan) : null;
    if (p) {
      this.out.connect(p);
      p.connect(mx.sfxIn);
    } else this.out.connect(mx.sfxIn);
  }

  private track(src: AudioScheduledSourceNode, start: number, stop: number): void {
    this.sources.push(src);
    this.mx.stats.started++;
    src.onended = () => {
      this.mx.stats.ended++;
      src.disconnect();
    };
    src.start(start);
    src.stop(stop);
    if (stop - this.t0 > this.end) this.end = stop - this.t0;
  }

  /** Ton von f0 nach f1 (Hz) über dur Sekunden, der dabei ausklingt. */
  tone(wave: Wave, f0: number, f1: number, dur: number, vol: number, o: ToneOpts = {}): this {
    const ctx = this.mx.ctx;
    const t = this.t0 + (o.at ?? 0);
    const osc = ctx.createOscillator();
    this.mx.setWave(osc, wave);
    const holdUntil = t + dur * (o.hold ?? 0);
    osc.frequency.setValueAtTime(Math.max(20, f0), t);
    if (o.hold) osc.frequency.setValueAtTime(Math.max(20, f0), holdUntil);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain();
    const attack = Math.min(o.attack ?? 0.004, dur * 0.5);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(this.out);
    if (o.vibHz) {
      const lfo = ctx.createOscillator();
      lfo.frequency.value = o.vibHz;
      const depth = ctx.createGain();
      depth.gain.value = f0 * (o.vibDepth ?? 0.03);
      lfo.connect(depth);
      depth.connect(osc.frequency);
      this.track(lfo, t, t + dur + 0.02);
    }
    if (o.tremHz) {
      const lfo = ctx.createOscillator();
      lfo.type = 'square';
      lfo.frequency.value = o.tremHz;
      const depth = ctx.createGain();
      depth.gain.value = vol * 0.5;
      lfo.connect(depth);
      depth.connect(g.gain);
      this.track(lfo, t, t + dur + 0.02);
    }
    this.track(osc, t, t + dur + 0.02);
    return this;
  }

  /** Rauschen durch ein Filter, dessen Eckfrequenz von f0 nach f1 fährt. */
  noise(f0: number, f1: number, dur: number, vol: number, o: NoiseOpts = {}): this {
    const ctx = this.mx.ctx;
    const t = this.t0 + (o.at ?? 0);
    const src = this.mx.noise(o.brown ?? false);
    const filter = ctx.createBiquadFilter();
    filter.type = o.type ?? 'bandpass';
    filter.Q.value = o.q ?? 1;
    filter.frequency.setValueAtTime(Math.max(30, f0), t);
    filter.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    const g = ctx.createGain();
    const attack = Math.min(o.attack ?? 0.003, dur * 0.5);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.out);
    this.sources.push(src);
    this.mx.stats.started++;
    src.onended = () => {
      this.mx.stats.ended++;
      src.disconnect();
    };
    src.start(t, this.mx.noiseOffset());
    src.stop(t + dur + 0.02);
    if (t + dur - this.t0 > this.end) this.end = t + dur - this.t0;
    return this;
  }

  /** Notenfolge: [MIDI-Note, Beginn, Dauer] – für Jingles. */
  notes(wave: Wave, list: [number, number, number][], vol: number, vib = 0): this {
    for (const [midi, at, dur] of list) {
      const f = mtof(midi);
      this.tone(wave, f, f * 0.995, dur, vol, { at, attack: 0.008, vibHz: vib ? 5.5 : 0, vibDepth: vib });
    }
    return this;
  }

  /** Gesamtdauer in Sekunden. */
  get length(): number {
    return this.end + 0.05;
  }
}

export class SfxPlayer {
  private readonly last = new Map<SfxName, number>();
  private readonly busyUntil: number[] = [];
  private tick = 0;

  constructor(private readonly mx: Mixer) {}

  /** Anzahl noch klingender Geräusche (für Tests). */
  get active(): number {
    const now = this.mx.ctx.currentTime;
    return this.busyUntil.filter((t) => t > now).length;
  }

  play(name: SfxName, pan = 0, gain = 1): void {
    if (!this.mx.canPlay()) return;
    const now = this.mx.ctx.currentTime;
    const gap = MIN_GAP[name] ?? DEFAULT_GAP;
    if (now - (this.last.get(name) ?? -1) < gap) return;
    // Abgelaufene Stimmen austragen; ist alles belegt, entfällt das neue Geräusch.
    for (let i = this.busyUntil.length - 1; i >= 0; i--) if (this.busyUntil[i] <= now) this.busyUntil.splice(i, 1);
    if (this.busyUntil.length >= MAX_VOICES) return;
    this.last.set(name, now);
    const v = new Voice(this.mx, clamp(gain, 0, 1) * LEVEL[name], clamp(pan, -1, 1));
    this.build(name, v);
    const until = now + v.length;
    this.busyUntil.push(until);
    // Ausgang nach dem Ausklingen vom Mischpult trennen.
    const out = v.out;
    window.setTimeout(() => out.disconnect(), (v.length + 0.2) * 1000);
  }

  private build(name: SfxName, v: Voice): void {
    switch (name) {
      // --- Oberfläche ---
      case 'ui-click':
        v.tone('pulse25', 940, 700, 0.05, 0.22).noise(4000, 2500, 0.02, 0.1, { type: 'highpass' });
        break;
      case 'ui-back':
        v.tone('triangle', 520, 300, 0.09, 0.3).noise(1500, 600, 0.03, 0.08);
        break;
      case 'join':
        v.notes('triangle', [[72, 0, 0.12], [79, 0.09, 0.2]], 0.3).notes('pulse12', [[84, 0.09, 0.16]], 0.08);
        break;
      case 'ready':
        v.notes('triangle', [[76, 0, 0.1], [83, 0.08, 0.24]], 0.3).notes('pulse12', [[88, 0.08, 0.18]], 0.07);
        break;

      // --- Ampel ---
      case 'count':
        v.tone('pulse25', 440, 438, 0.2, 0.3, { attack: 0.005 }).tone('sine', 220, 219, 0.24, 0.3).noise(3000, 1500, 0.03, 0.12, { type: 'highpass' });
        break;
      case 'go':
        v.tone('pulse25', 880, 878, 0.6, 0.28, { attack: 0.005, vibHz: 6, vibDepth: 0.006 })
          .tone('pulse12', 1320, 1318, 0.5, 0.12, { attack: 0.01 })
          .tone('sine', 440, 438, 0.6, 0.3)
          .noise(1200, 6000, 0.35, 0.16, { type: 'bandpass', q: 0.7 });
        break;

      // --- Schub ---
      case 'boost':
        v.noise(500, 3800, 0.45, 0.32, { q: 1.2, attack: 0.03 }).tone('sawtooth', 160, 620, 0.4, 0.14, { attack: 0.03 }).tone('sine', 90, 55, 0.18, 0.35);
        break;
      case 'turbo1':
        v.tone('sawtooth', 300, 900, 0.22, 0.16, { attack: 0.01 }).noise(900, 3500, 0.22, 0.22, { q: 1.5 }).tone('sine', 100, 60, 0.12, 0.3);
        break;
      case 'turbo2':
        v.tone('sawtooth', 340, 1300, 0.3, 0.17, { attack: 0.01 })
          .tone('pulse25', 680, 1560, 0.26, 0.08)
          .noise(900, 4500, 0.3, 0.25, { q: 1.5 })
          .tone('sine', 110, 60, 0.14, 0.32);
        break;
      case 'turbo3':
        v.tone('sawtooth', 380, 1900, 0.42, 0.18, { attack: 0.01 })
          .tone('pulse25', 760, 2280, 0.36, 0.09)
          .noise(900, 6000, 0.42, 0.27, { q: 1.4 })
          .tone('sine', 120, 55, 0.18, 0.34)
          .notes('pulse12', [[96, 0.3, 0.07], [100, 0.36, 0.07], [103, 0.42, 0.12]], 0.09);
        break;
      case 'drift-start':
        v.noise(1700, 2300, 0.1, 0.2, { q: 9, attack: 0.01 }).noise(2600, 1900, 0.07, 0.1, { q: 12, at: 0.03 });
        break;

      // --- Kiste und Auslosung ---
      case 'pickup':
        v.notes('triangle', [[83, 0, 0.09], [88, 0.06, 0.2]], 0.32).noise(5000, 3000, 0.03, 0.14, { type: 'highpass' }).tone('sine', 300, 120, 0.08, 0.2);
        break;
      case 'roulette-tick': {
        const f = [1180, 1400, 990][this.tick++ % 3];
        v.tone('pulse25', f, f * 0.96, 0.03, 0.14);
        break;
      }
      case 'item-ready':
        v.notes('pulse25', [[79, 0, 0.07], [83, 0.06, 0.07], [88, 0.12, 0.22]], 0.2).notes('triangle', [[76, 0.12, 0.24]], 0.2);
        break;

      // --- Items ---
      case 'use-tire':
        v.tone('sine', 170, 55, 0.14, 0.45).noise(700, 1100, 0.16, 0.16, { q: 6, attack: 0.02 }).noise(250, 120, 0.1, 0.25, { type: 'lowpass', brown: true });
        break;
      case 'use-oil':
        v.noise(1400, 180, 0.28, 0.3, { type: 'lowpass', q: 2 })
          .tone('sine', 320, 70, 0.2, 0.3)
          .tone('sine', 520, 880, 0.05, 0.14, { at: 0.12 })
          .tone('sine', 420, 760, 0.05, 0.1, { at: 0.2 });
        break;
      case 'use-top':
        v.tone('sawtooth', 170, 560, 0.55, 0.16, { attack: 0.03, tremHz: 31 }).tone('triangle', 340, 1120, 0.55, 0.1, { attack: 0.03, tremHz: 31 }).noise(2500, 5000, 0.5, 0.06, { q: 3, attack: 0.05 });
        break;
      case 'use-guard':
        v.tone('triangle', 1240, 1232, 0.45, 0.18)
          .tone('triangle', 1866, 1850, 0.4, 0.12)
          .tone('sine', 620, 616, 0.3, 0.14)
          .noise(6000, 4000, 0.08, 0.12, { type: 'highpass' });
        break;
      case 'use-emp':
        v.tone('sawtooth', 1900, 110, 0.22, 0.2)
          .noise(3000, 5000, 0.04, 0.22, { q: 2 })
          .noise(3500, 2500, 0.04, 0.2, { q: 2, at: 0.09 })
          .noise(2500, 4500, 0.05, 0.18, { q: 2, at: 0.17 })
          .tone('square', 55, 50, 0.3, 0.16, { tremHz: 50 });
        break;
      case 'use-smoke':
        v.noise(4200, 900, 0.65, 0.26, { type: 'highpass', attack: 0.04 }).tone('sine', 130, 60, 0.16, 0.3).noise(400, 200, 0.2, 0.2, { type: 'lowpass', brown: true });
        break;
      case 'use-spring':
        v.tone('sine', 190, 760, 0.42, 0.34, { hold: 0, vibHz: 21, vibDepth: 0.16 }).tone('triangle', 380, 1500, 0.3, 0.1, { vibHz: 21, vibDepth: 0.16 }).noise(800, 2400, 0.06, 0.12, { q: 2 });
        break;

      case 'use-kite':
        v.noise(700, 3200, 0.5, 0.26, { q: 1.4, attack: 0.05 })
          .tone('triangle', 420, 1260, 0.5, 0.14, { attack: 0.04, vibHz: 17, vibDepth: 0.05 })
          .noise(1800, 1200, 0.07, 0.16, { q: 4, at: 0.1 })
          .noise(1800, 1200, 0.07, 0.14, { q: 4, at: 0.22 })
          .tone('sine', 110, 70, 0.2, 0.3);
        break;
      case 'warn':
        v.tone('pulse25', 1320, 1318, 0.07, 0.2).tone('pulse25', 1760, 1756, 0.09, 0.2, { at: 0.09 });
        break;

      // --- Treffer und Stöße ---
      case 'hit':
        v.noise(2600, 260, 0.4, 0.42, { type: 'lowpass', q: 1.2 })
          .tone('sine', 230, 46, 0.34, 0.45)
          .tone('square', 183, 90, 0.2, 0.12)
          .noise(5000, 2000, 0.05, 0.2, { type: 'highpass' });
        break;
      case 'guard-block':
        v.tone('triangle', 430, 170, 0.07, 0.4)
          .tone('triangle', 1510, 1490, 0.3, 0.16, { at: 0.01 })
          .tone('triangle', 2260, 2230, 0.24, 0.1, { at: 0.01 })
          .noise(3000, 1500, 0.04, 0.2, { q: 1 });
        break;
      case 'stall':
        v.tone('sawtooth', 120, 100, 0.07, 0.24)
          .tone('sawtooth', 105, 88, 0.07, 0.22, { at: 0.11 })
          .tone('sawtooth', 92, 76, 0.07, 0.2, { at: 0.24 })
          .tone('sawtooth', 80, 60, 0.12, 0.18, { at: 0.4 })
          .noise(900, 300, 0.5, 0.1, { type: 'lowpass', brown: true });
        break;
      case 'bump':
        v.tone('sine', 160, 62, 0.11, 0.45).noise(1800, 700, 0.05, 0.22, { q: 1 }).tone('triangle', 520, 260, 0.05, 0.12);
        break;
      case 'wall':
        v.noise(700, 320, 0.11, 0.3, { q: 1.2 }).tone('sine', 118, 58, 0.1, 0.38);
        break;
      case 'land':
        v.noise(320, 120, 0.16, 0.5, { type: 'lowpass', brown: true }).tone('sine', 96, 46, 0.14, 0.42).noise(2200, 900, 0.05, 0.1, { q: 1 });
        break;
      case 'fall':
        v.tone('sine', 1250, 180, 0.75, 0.26, { vibHz: 9, vibDepth: 0.02 }).tone('triangle', 1880, 270, 0.75, 0.08).noise(2000, 400, 0.3, 0.18, { type: 'lowpass', at: 0.6 });
        break;
      case 'respawn':
        v.tone('triangle', 390, 940, 0.3, 0.22, { attack: 0.03 }).notes('pulse12', [[84, 0.18, 0.06], [88, 0.24, 0.06], [91, 0.3, 0.14]], 0.1);
        break;

      // --- Rennverlauf ---
      case 'lap':
        v.notes('triangle', [[79, 0, 0.14], [84, 0.12, 0.3]], 0.28).notes('pulse12', [[91, 0.12, 0.2]], 0.06);
        break;
      case 'final-lap':
        v.notes('pulse25', [[79, 0, 0.1], [79, 0.12, 0.1], [83, 0.24, 0.1], [86, 0.36, 0.45]], 0.2, 0.004)
          .notes('triangle', [[67, 0, 0.1], [67, 0.12, 0.1], [71, 0.24, 0.1], [74, 0.36, 0.45]], 0.22)
          .noise(5000, 8000, 0.3, 0.07, { type: 'highpass', at: 0.36 });
        break;
      case 'finish':
        v.notes('pulse25', [[72, 0, 0.12], [76, 0.1, 0.12], [79, 0.2, 0.12], [84, 0.3, 0.9]], 0.2, 0.005)
          .notes('triangle', [[60, 0, 0.3], [64, 0.3, 0.9], [67, 0.3, 0.9]], 0.2)
          .noise(3000, 9000, 0.9, 0.12, { type: 'highpass', at: 0.3, attack: 0.01 })
          .tone('sine', 130, 65, 0.3, 0.3, { at: 0.3 });
        break;
      case 'win':
        v.notes(
          'pulse25',
          [
            [72, 0, 0.14],
            [76, 0.15, 0.14],
            [79, 0.3, 0.14],
            [84, 0.45, 0.3],
            [79, 0.8, 0.14],
            [84, 0.95, 0.9],
          ],
          0.2,
          0.005,
        )
          .notes('triangle', [[48, 0, 0.42], [55, 0.45, 0.32], [48, 0.8, 0.14], [60, 0.95, 0.9]], 0.26)
          .notes('pulse12', [[88, 0.95, 0.9], [91, 0.95, 0.9]], 0.06)
          .noise(4000, 9000, 0.6, 0.1, { type: 'highpass', at: 0.95, attack: 0.01 });
        break;
      case 'lose':
        v.notes(
          'triangle',
          [
            [67, 0, 0.24],
            [65, 0.26, 0.24],
            [63, 0.52, 0.24],
            [60, 0.78, 0.8],
          ],
          0.26,
          0.006,
        ).notes('sine', [[43, 0, 0.5], [41, 0.52, 0.26], [36, 0.78, 0.8]], 0.28);
        break;
    }
  }
}
