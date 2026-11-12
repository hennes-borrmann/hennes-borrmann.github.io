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

/** Blasenschlot: Tonhöhen (Hz) und Abstände (s) der kleinen Blasen, als feste Muster. */
const BUBBLE_HZ = [520, 760, 410, 980, 610, 350, 870, 690, 1250, 470, 560, 1080, 640];
const BUBBLE_GAP = [0.085, 0.06, 0.1, 0.07, 0.05, 0.09, 0.065];

/** Lawine: polternde Brocken je Fassung, paarweise [Beginn (s), Eckfrequenz (Hz)]. */
const AVALANCHE_CHUNKS = [
  [0.38, 520, 0.66, 430, 0.83, 600, 1.08, 470, 1.24, 380, 1.47, 560, 1.66, 440, 1.9, 500],
  [0.31, 470, 0.58, 580, 0.9, 410, 1.02, 520, 1.31, 450, 1.45, 610, 1.72, 400, 1.86, 540],
  [0.45, 600, 0.7, 450, 0.95, 520, 1.16, 400, 1.36, 580, 1.55, 470, 1.78, 530, 1.95, 420],
];
/** Lawinenschnee: je Fassung zwei Wummer-Zeitpunkte, dann paarweise [Beginn, Frequenz] der Knister. */
const SNOW_PATTERN = [
  [0.02, 0.17, 0.05, 1900, 0.13, 1400, 0.24, 2500],
  [0.07, 0.21, 0.02, 1600, 0.16, 2600, 0.27, 1300],
  [0.04, 0.19, 0.09, 2200, 0.2, 1500, 0.28, 2000],
];
/** Eiszapfen: Splitter je Fassung, paarweise [Beginn (s), Tonhöhe (Hz)], abwärts springend. */
const ICICLE_SHARDS = [
  [0.03, 5900, 0.07, 4700, 0.1, 5300, 0.16, 3900, 0.24, 3100],
  [0.025, 5400, 0.06, 6000, 0.11, 4300, 0.18, 3600, 0.25, 2900],
  [0.035, 6100, 0.08, 4900, 0.12, 4100, 0.17, 4500, 0.26, 3300],
];
/** Meteorit: nachrieselndes Geröll je Fassung, paarweise [Beginn (s), Eckfrequenz (Hz)]. */
const METEOR_GRAVEL = [
  [0.48, 1300, 0.6, 900, 0.74, 1150, 0.92, 800, 1.1, 1000],
  [0.46, 1100, 0.63, 1400, 0.78, 850, 0.95, 1050, 1.15, 780],
  [0.5, 950, 0.62, 1250, 0.8, 1000, 0.97, 1200, 1.12, 850],
];
/** Böe: je Fassung die zwei Pfeiftöne (Hz) in der Takelage, dann paarweise [Beginn (s), Eckfrequenz (Hz)] der klappernden Leinen. */
const GUST_PATTERN = [
  [1180, 1630, 0.5, 2300, 0.58, 1900, 0.71, 2500, 0.86, 2100],
  [1040, 1490, 0.47, 2000, 0.6, 2600, 0.69, 1800, 0.9, 2300],
  [1310, 1770, 0.53, 2400, 0.62, 2000, 0.77, 2200, 0.84, 2700],
];
/** Bauklotz-Mauer: fallende Klötze je Fassung, paarweise [Beginn (s), Tonhöhe (Hz)]. */
const SMASH_BLOCKS = [
  [0.06, 1320, 0.1, 980, 0.13, 1760, 0.19, 1180, 0.23, 1500, 0.3, 880, 0.35, 1400, 0.44, 1050, 0.52, 1620, 0.6, 940, 0.64, 1240],
  [0.05, 1180, 0.09, 1640, 0.14, 900, 0.18, 1420, 0.25, 1080, 0.29, 1840, 0.37, 1260, 0.43, 960, 0.53, 1520, 0.59, 1120, 0.66, 1360],
  [0.07, 1480, 0.1, 1060, 0.15, 1880, 0.2, 940, 0.24, 1300, 0.32, 1700, 0.36, 1000, 0.46, 1380, 0.51, 860, 0.61, 1560, 0.67, 1160],
];

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
  draft: 1.8,
  geyser: 2.8,
  bomb: 3.4,
  honk: 2.4,
  pass: 2.3,
  burn: 1.1,
  press: 2.6,
  splash: 1.8,
  wings: 3,
  ring: 2.2,
  lift: 1.8,
  wind: 0.8,
  dive: 2.2,
  surface: 3,
  bubbles: 2.6,
  blubb: 1.2,
  // Eis und Mond (Runde 89), gemessen als Momentanlautheit (lautestes 400-ms-Fenster,
  // vor dem Mischpult): Lawine ≈ −12 LUFS (Geysir −11), Eiszapfen ≈ −16 (klein, aber
  // hell), Sprungplatte ≈ −13 (Sprungfeder −13, Schub −15), Meteorit ≈ −11 (Bombe −11);
  // die Schnee-Folge ≈ −22 LUFS (Wasser-Folge −27: der Schnee ist dumpf und liegt unter
  // der zugleich laufenden Lawine, er muss sich gegen sie behaupten).
  avalanche: 2.7,
  snow: 2.6,
  icicle: 4,
  launch: 1.9,
  meteor: 2.3,
  // Sturmhafen (Runde 10), gemessen wie oben: die Böe ≈ −10 LUFS (etwas über Geysir und
  // Lawine, damit das Warnsignal aus der Nähe sicher über Motor und Musik kommt); die Folge
  // der Sturm-Aufrufe ≈ −34 LUFS wie der Fahrtwind im Gleitflug – ein Bett, kein Hauptdarsteller.
  gust: 4.5,
  storm: 0.85,
  // Dschungel-Fluss (vorläufig)
  raft: 1.2,
  rapids: 0.8,
  falls: 1.4,
  // Spiegelkabinett (vorläufig)
  portal: 1.4,
  mirror: 1.4,
  shimmer: 1.0,
  // Wüstenexpress (vorläufig)
  whistle: 1.4,
  trainpass: 0.8,
  board: 1.2,
  rattle: 0.8,
  // Riesenkinderzimmer (Runde 17), gemessen wie oben: Schrumpfen ≈ −15,8 und Wachsen ≈ −16,2 LUFS
  // (Schubring −17,3: im Spiel-Mix mit Motor und Zimmer-Stück trägt der Ring mit seinem hellen
  // Glanz bei 1,5–4 kHz mehr; so liegen alle drei dort gleichauf, lautestes 100-ms-Fenster
  // −18,5 bis −18,9 LUFS); Wieder-normal ≈ −24,3 (oft und nebensächlich, im Mix gut 4 dB unter
  // den beiden); Bauklotz-Mauer ≈ −13,1 bis −13,6 (Presse −13,2).
  shrink: 2,
  grow: 1.6,
  sizeend: 2.2,
  smash: 2.8,
  // Gewitterkamm (vorläufig)
  thunder: 2.2,
  rod: 1.6,
  rumble: 1.2,
  charge: 1.4,
  // Zeitriss-Ruine (vorläufig)
  riftwarn: 1.6,
  rift: 1.8,
  // Vulkaninsel (vorläufig)
  crumble: 1.2,
  crack: 1.6,
  collapse: 1.8,
  drain: 1.6,
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
  /** Pegel nach dem Einschwingen halten: Anteil der Dauer, erst danach klingt der Ton aus. */
  sustain?: number;
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
    if (o.sustain) g.gain.setValueAtTime(vol, t + Math.max(attack, dur * o.sustain));
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
  private passTick = 0;
  private burnTick = 0;
  private splashTick = 0;
  private windTick = 0;
  private surfaceTick = 0;
  private bubbleTick = 0;
  private avalancheTick = 0;
  private snowTick = 0;
  private icicleTick = 0;
  private meteorTick = 0;
  private gustTick = 0;
  private smashTick = 0;

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
      // --- Streckenmechanik ---
      case 'draft':
        // Weicher Sog: breites Rauschen, das langsam einschwingt und nach oben zieht,
        // darüber ein Hauch Luft und ein leiser, steigender Grundton – kein Sägezahn wie beim Schub.
        v.noise(600, 2400, 0.4, 0.22, { q: 0.9, attack: 0.09 })
          .noise(3000, 6500, 0.3, 0.06, { type: 'highpass', attack: 0.1, at: 0.05 })
          .tone('triangle', 200, 380, 0.36, 0.06, { attack: 0.1 });
        break;
      case 'geyser':
        // Scharfes Zischen am Anfang, dann ein breites Fauchen, das nach unten sinkt;
        // darunter Grollen aus braunem Rauschen und ein tiefer Sinus.
        v.noise(6500, 4200, 0.3, 0.26, { type: 'highpass', attack: 0.005 })
          .noise(3000, 650, 1.35, 0.34, { q: 0.6, attack: 0.12, at: 0.06 })
          .noise(240, 90, 1.4, 0.4, { type: 'lowpass', brown: true, attack: 0.1 })
          .tone('sine', 64, 40, 0.9, 0.28, { attack: 0.06 });
        break;
      case 'bomb':
        // Satter Schlag (tiefer Sinus, braunes Rauschen, kurzer Aufprall-Knack),
        // danach Zischen mit einzelnen Knistern.
        v.tone('sine', 125, 36, 0.38, 0.55)
          .noise(520, 110, 0.32, 0.5, { type: 'lowpass', brown: true })
          .noise(1400, 450, 0.06, 0.22, { q: 1 })
          .tone('triangle', 240, 80, 0.07, 0.18)
          .noise(5200, 3200, 0.5, 0.11, { type: 'highpass', attack: 0.05, at: 0.12 })
          .noise(3600, 3000, 0.025, 0.12, { q: 4, at: 0.2 })
          .noise(4400, 3800, 0.02, 0.1, { q: 4, at: 0.31 })
          .noise(3200, 2700, 0.025, 0.09, { q: 4, at: 0.43 });
        break;
      // Wüstenexpress (vorläufig: wie die Hupe)
      case 'whistle':
      case 'honk':
        // „Möp-möp": zwei kurze Stöße aus großer Terz (F + A), leicht absackend,
        // mit einer weichen Dreieckstimme darunter, damit es rund statt schrill klingt.
        v.tone('pulse25', 349, 338, 0.11, 0.17, { attack: 0.008 })
          .tone('pulse25', 440, 426, 0.11, 0.13, { attack: 0.008 })
          .tone('triangle', 175, 170, 0.11, 0.2, { attack: 0.008 })
          .tone('pulse25', 349, 330, 0.2, 0.17, { attack: 0.008, at: 0.15, vibHz: 7, vibDepth: 0.01 })
          .tone('pulse25', 440, 416, 0.2, 0.13, { attack: 0.008, at: 0.15, vibHz: 7, vibDepth: 0.01 })
          .tone('triangle', 175, 166, 0.2, 0.2, { attack: 0.008, at: 0.15 });
        break;
      // Wüstenexpress (vorläufig: wie der Fahrtwind beim Überholen)
      case 'trainpass':
      case 'pass': {
        // Fahrtwind-„Wusch": Rauschen schwillt an und fällt wieder (zwei überlappende Fahrten).
        // Die Mitte wechselt leicht, damit es nicht bei jedem Vorbeiziehen gleich klingt.
        const f = [1700, 1950, 1550][this.passTick++ % 3];
        v.noise(650, f, 0.14, 0.2, { q: 1.1, attack: 0.07 }).noise(f, 550, 0.14, 0.18, { q: 1.1, attack: 0.03, at: 0.1 });
        break;
      }
      case 'burn': {
        // Dauerbrutzeln: Zischen mit langem Ein- und Ausschwingen, damit die etwa alle
        // 0,33 s folgenden Aufrufe ineinanderlaufen, dazu wechselnde Knister-Muster
        // (drei Fassungen), damit kein gleichmäßiges Rattern entsteht.
        const k = this.burnTick++ % 3;
        const crackle = [
          [0.05, 3400, 0.17, 4600, 0.29, 2900],
          [0.1, 4200, 0.22, 3100, 0.36, 3800],
          [0.03, 2800, 0.14, 3900, 0.26, 4800],
        ][k];
        // Zwei Zischschichten um eine halbe Aufrufspanne versetzt: so liegt alle ~0,17 s
        // ein neuer Gipfel an, und die Hüllkurve schwankt nur noch wenig.
        v.noise(5200, 3800, 0.7, 0.16, { type: 'highpass', attack: 0.2 })
          .noise(4600, 3600, 0.7, 0.14, { type: 'highpass', attack: 0.2, at: 0.17 })
          .noise(2600, 2000, 0.7, 0.05, { q: 2, attack: 0.25 });
        for (let i = 0; i < crackle.length; i += 2) {
          const fc = crackle[i + 1];
          v.noise(fc, fc * 0.85, 0.02, 0.07, { q: 5, at: crackle[i] });
        }
        break;
      }
      // --- Tauchen ---
      // Beim Ein- und Auftauchen gleitet zugleich der Unterwasser-Filter des Mischpults
      // (setUnderwater, etwa 0,25 s; abgetaucht 24 dB/Oktave ab 850 Hz). 'dive' beginnt
      // also noch hell und wird während des Klingens dumpf, 'surface' umgekehrt; 'blubb'
      // und meist auch 'bubbles' hört man ganz durch das Filter. Deshalb liegt bei allen
      // vieren der Körper unter ~1,5 kHz, die Höhen sind nur Beiwerk.
      case 'dive':
        // Aufschlag: breites Rauschen, das schnell zugeht, ein tiefer Bauchschlag und
        // braunes Rauschen als Wassermasse; dann „schluckt" das Wasser das Kart (enges,
        // fallendes Band), vier aufsteigende Blasen gurgeln nach, und ein leises, tiefes
        // Grollen klingt in die Stille aus. Die Blasen fahren nach oben (Blasen wachsen
        // beim Aufsteigen nicht – aber so klingen sie im Comic), eine kleiner als die andere.
        v.noise(3200, 650, 0.17, 0.42, { type: 'lowpass', q: 0.8, attack: 0.003 })
          .tone('sine', 120, 42, 0.3, 0.45)
          .noise(700, 150, 0.45, 0.42, { type: 'lowpass', brown: true, attack: 0.008 })
          .noise(950, 330, 0.13, 0.2, { q: 2.2, attack: 0.01, at: 0.05 })
          .tone('sine', 380, 720, 0.06, 0.17, { at: 0.14, attack: 0.006 })
          .tone('sine', 300, 590, 0.07, 0.15, { at: 0.21, attack: 0.006 })
          .tone('sine', 470, 840, 0.05, 0.11, { at: 0.29, attack: 0.005 })
          .tone('sine', 340, 650, 0.08, 0.09, { at: 0.36, attack: 0.006 })
          .noise(260, 110, 0.75, 0.2, { type: 'lowpass', brown: true, attack: 0.12 });
        break;
      case 'surface': {
        // Durchbruch nach oben: ein kurzes, dumpfes Schwappen (noch durch das sich öffnende
        // Filter), dann rauscht das abfließende Wasser auf und zieht nach oben; ein hauchiges
        // „Haah" (hohes Rauschen und ein Formant um 1,2 kHz) als „Luft!"; zuletzt perlen
        // Tropfen ab – kurze Sinus-Zirper, die nach oben springen, reihum in drei Fassungen.
        const k = this.surfaceTick++ % 3;
        const drops = [
          [0.19, 1700, 0.26, 2300, 0.31, 1450, 0.38, 2050, 0.45, 1800],
          [0.2, 2100, 0.24, 1550, 0.33, 1900, 0.4, 2400, 0.46, 1650],
          [0.18, 1600, 0.27, 2000, 0.32, 2500, 0.37, 1500, 0.44, 1950],
        ][k];
        v.noise(1600, 520, 0.15, 0.3, { type: 'lowpass', q: 0.9, attack: 0.004 })
          .tone('sine', 95, 150, 0.12, 0.22, { attack: 0.01 })
          .noise(520, 2900, 0.34, 0.3, { q: 0.75, attack: 0.07, at: 0.02 })
          .noise(1100, 1450, 0.2, 0.09, { q: 3, attack: 0.04, at: 0.1 })
          .noise(2800, 5200, 0.18, 0.07, { type: 'highpass', attack: 0.04, at: 0.1 });
        for (let i = 0; i < drops.length; i += 2) {
          const f = drops[i + 1];
          v.tone('sine', f, f * 1.8, 0.035, 0.09 - i * 0.004, { at: drops[i], attack: 0.003 });
        }
        break;
      }
      case 'bubbles': {
        // Der Schlot beginnt zu blasen: Brodeln aus braunem Rauschen und ein breites Band
        // um 0,7–1,1 kHz schwellen langsam an; darüber steigen immer dichter und lauter
        // kleine Blasen auf – Sinus-Zirper (Blasenresonanz 0,35–1,25 kHz, je kleiner desto
        // höher), die nach oben springen. Abstände, Tonhöhen und Pegel folgen festen Mustern,
        // die je Ausbruch versetzt beginnen: jeder Ausbruch blubbert etwas anders.
        const k = this.bubbleTick++ % 5;
        v.noise(380, 620, 0.9, 0.22, { type: 'lowpass', brown: true, attack: 0.5 })
          .noise(700, 1100, 0.85, 0.08, { q: 1.2, attack: 0.45 })
          .tone('sine', 85, 70, 0.8, 0.06, { attack: 0.4 });
        let t = 0.04;
        for (let i = 0; i < 17; i++) {
          const f = BUBBLE_HZ[(i * 3 + k * 2) % BUBBLE_HZ.length];
          const grow = Math.min(1, t / 0.7);
          const fade = t > 0.74 ? Math.max(0.3, 1 - (t - 0.74) / 0.12) : 1;
          const len = 0.035 + 0.04 * (420 / f);
          v.tone('sine', f, f * 1.55, Math.min(0.08, len), (0.045 + 0.1 * grow) * fade, { at: t, attack: 0.004 });
          t += BUBBLE_GAP[(i + k) % BUBBLE_GAP.length] * (1 - 0.45 * grow);
          if (t > 0.84) break;
        }
        break;
      }
      case 'blubb':
        // Vom Schlot gehoben: ein komisches, rundes „Blubb". Erst flattert ein tiefer Ansatz
        // („Bl…", Tremolo 32 Hz statt Vibrato wie bei der Sprungfeder), dann steigt ein
        // runder Grundton von 200 auf 640 Hz – mit leisem Dreieck eine Oktave höher als
        // Bauch, ohne Vibrato und ohne Rauschfahrt wie beim Aufwind; darunter hebt braunes
        // Rauschen mit. Am Ende ploppt die Blase (kurzer Zirper) und zwei Bläschen perlen nach.
        // Der Grundton hält seinen Pegel über gut die Hälfte (sustain), sonst hörte man vom
        // Aufstieg nur den tiefen Anfang.
        v.tone('sine', 165, 235, 0.09, 0.3, { attack: 0.006, tremHz: 32 })
          .tone('sine', 200, 640, 0.32, 0.36, { at: 0.06, attack: 0.025, sustain: 0.6 })
          .tone('triangle', 400, 1280, 0.3, 0.06, { at: 0.06, attack: 0.03, sustain: 0.5 })
          .noise(250, 700, 0.3, 0.15, { type: 'lowpass', brown: true, attack: 0.08 })
          .tone('sine', 700, 1150, 0.05, 0.16, { at: 0.3, attack: 0.004 })
          .tone('sine', 900, 1350, 0.03, 0.07, { at: 0.345, attack: 0.003 })
          .tone('sine', 1100, 1600, 0.03, 0.05, { at: 0.375, attack: 0.003 });
        break;
      // --- Eis und Mond ---
      // Vulkaninsel (vorläufig: bröckeln und einstürzen wie die Lawine)
      case 'crumble':
      case 'collapse':
      case 'avalanche': {
        // Lawine (läuft 140 Ticks ≈ 2,3 s): ein tiefes Grollen schwillt an und hält, darüber
        // rauscht der Schnee (breites Band, das langsam nach unten sinkt, und ein Hauch
        // Pulverschnee), dazwischen poltern Brocken – kurze, dumpfe Schläge mit einem
        // leisen Klacken von Eis, die mit der Lawine lauter werden. Eine Rauschschicht
        // schwillt an und fällt sofort wieder (die Hüllkurve kennt kein Halten), darum
        // drei Sätze um je 0,58 s versetzt, jeder etwas lauter und dunkler als der vorige;
        // der letzte klingt länger aus. Unter 150 Hz grollen braunes Rauschen und ein
        // Sinus um 50 Hz, der mit 6,5 Hz schlingert (mit Halten, sustain); weil kleine
        // Lautsprecher dort kaum etwas wiedergeben, trägt eine zweite, hellere Schicht
        // (bis ~440 Hz) den Körper. Gemessen: nach 0,7 s auf vollem Pegel, hält bis 2,0 s
        // (±2 dB), −20 dB bei 2,2 s, verklungen nach 3 s. Die Brocken-Muster wechseln reihum.
        const k = this.avalancheTick++ % 3;
        for (let i = 0; i < 3; i++) {
          const at = i * 0.58;
          const last = i === 2;
          const swell = 0.85 + 0.15 * i;
          v.noise(170 - 15 * i, 110, last ? 2.2 : 1.5, 0.3 * swell, { type: 'lowpass', brown: true, attack: 0.65, at })
            .noise(440 - 30 * i, 250, last ? 2.2 : 1.5, 0.4 * swell, { type: 'lowpass', brown: true, attack: 0.65, at: at + 0.1 })
            .noise(1300 - 100 * i, 600, last ? 2.0 : 1.4, 0.22 * swell, { q: 0.55, attack: 0.6, at: at + 0.2 });
        }
        v.tone('sine', 54, 38, 2.9, 0.14, { attack: 0.8, sustain: 0.65, vibHz: 6.5, vibDepth: 0.08 })
          .noise(4200, 2600, 2.0, 0.035, { type: 'highpass', attack: 0.7, at: 0.3 });
        const chunks = AVALANCHE_CHUNKS[k];
        for (let i = 0; i < chunks.length; i += 2) {
          const at = chunks[i];
          const f = chunks[i + 1];
          const grow = Math.min(1, 0.45 + at / 1.6);
          v.noise(f, f * 0.5, 0.11, 0.3 * grow, { type: 'lowpass', q: 1.6, brown: true, at, attack: 0.006 }).noise(f * 3.2, f * 2.4, 0.04, 0.05 * grow, { q: 2, at, attack: 0.004 });
        }
        break;
      }
      case 'snow': {
        // Im Lawinenschnee, etwa alle 0,3 s aufgerufen (je nach Bildrate 0,26–0,36 s): drei
        // Paare dumpfer Schichten (braunes Rauschen um 200 Hz und ein breites Band um 600 Hz
        // als gedämpftes Rauschen durch die Schneemasse), um je 0,12 s versetzt, die 0,32 s
        // ein- und lang ausschwingen – so liegt etwa alle 0,12 s ein neuer Gipfel an und die
        // Folge verschmilzt zu einem Dröhnen (wie 'wind'; mit nur zwei Schichten im halben
        // Aufruftakt schwankte es beim langsamen Takt um 4,5 dB). Das
        // Wummern sind zwei weiche, tiefe Stöße je Aufruf, das Prasseln drei leise, kurze
        // Knister um 1,3–2,6 kHz (dumpfer als das Zischen von 'burn'); beide aus reihum
        // wechselnden Fassungen, damit kein gleichmäßiges Rattern im Aufruftakt entsteht.
        // Gemessen (gemittelt über 8–16 Durchläufe, ohne das Zufallsflattern des Rauschens):
        // Welligkeit 1,9 dB bei 0,36 s, 2,6 dB bei 0,30 s, 2,4 dB bei 0,26 s Abstand (2,8 dB
        // mit ±0,05 s Zittern), keine systematischen 5-ms-Spitzen über 3 dB. Nach dem
        // letzten Aufruf hält es noch gut 0,5 s und fällt dann in 0,3 s um 20 dB.
        const k = this.snowTick++ % 3;
        const p = SNOW_PATTERN[k];
        for (let i = 0; i < 3; i++) {
          const at = i * 0.12;
          v.noise(240 - 10 * i, 165, 1.0, 0.16, { type: 'lowpass', brown: true, attack: 0.32, at })
            .noise(680 - 40 * i, 460, 1.0, 0.055, { q: 0.7, attack: 0.32, at: at + 0.06 });
        }
        v.noise(160, 80, 0.3, 0.08, { type: 'lowpass', brown: true, attack: 0.07, at: p[0] })
          .noise(150, 75, 0.3, 0.07, { type: 'lowpass', brown: true, attack: 0.07, at: p[1] });
        for (let i = 2; i < p.length; i += 2) v.noise(p[i + 1], p[i + 1] * 0.8, 0.025, 0.09, { q: 3, at: p[i], attack: 0.002 });
        break;
      }
      case 'icicle': {
        // Eiszapfen: ein scharfes Knacken (breites, hohes Rauschen von 1,5 ms Anstieg und ein
        // harter Klick), darunter ein kleiner, dumpfer Aufschlag; der Zapfen selbst klingt
        // kurz glasig nach (Sinus mit dem unharmonischen Teilton ×2,76 eines freien Stabs),
        // dann klirren fünf Splitter – kurze, hohe Dreieckstöne (2,8–6 kHz), die abwärts
        // springen und leiser werden – und ein feines, hohes Rieseln. Knapp 0,4 s. Im Tunnel
        // fallen fünf Zapfen kurz nacheinander, darum reihum drei Fassungen (Klang des
        // Zapfens, Splitter-Muster), sonst klänge es wie eine Schallplatte mit Sprung.
        const k = this.icicleTick++ % 3;
        const f = [2150, 1870, 2440][k];
        const sh = ICICLE_SHARDS[k];
        v.noise(7000, 3500, 0.03, 0.3, { type: 'highpass', attack: 0.0015 })
          .noise(2600, 1400, 0.05, 0.28, { q: 1.4, attack: 0.0015 })
          .tone('triangle', 1650, 1150, 0.03, 0.2)
          .tone('sine', 220, 85, 0.08, 0.12)
          .tone('sine', f, f * 0.995, 0.34, 0.11, { at: 0.004, attack: 0.002 })
          .tone('sine', f * 2.76, f * 2.75, 0.18, 0.05, { at: 0.004, attack: 0.002 })
          .noise(8000, 6000, 0.32, 0.05, { type: 'highpass', attack: 0.01, at: 0.02 });
        for (let i = 0; i < sh.length; i += 2) {
          const fs = sh[i + 1];
          v.tone('triangle', fs, fs * 0.97, 0.05 + 0.012 * (i / 2), 0.15 - 0.016 * i, { at: sh[i], attack: 0.002 });
        }
        break;
      }
      case 'launch':
        // Sprungplatte auf dem Mond: ein satter Federschlag – tiefer Sinus und braunes
        // Rauschen als Bauch, das Klacken der Platte und ein kurzes, tiefes Nachschwingen
        // der Feder (Dreieck um 190 Hz, 30 Hz Schlingern) –, gleichzeitig entweicht Druckluft
        // (hohes Rauschen, das schnell einsetzt und sinkt: „Pssch"). Dann steigt ein runder
        // Ton in gut einer Sekunde zwei Oktaven hinauf, langsam schwebend (5 Hz Vibrato) und
        // mit einer leiseren, leicht verstimmten Quinte darüber – schwerelos. Abgrenzung:
        // 'use-spring' ist ein kurzes „Boing" mit 21-Hz-Vibrato (0,4 s), 'boost' ein nach oben
        // fahrendes Rauschband mit Sägezahn (0,4 s), 'blubb' ein flatterndes, rundes Blubb
        // (0,45 s); hier tragen der tiefe Schlag, das Zischen und der lange, langsame Aufstieg.
        v.tone('sine', 130, 44, 0.24, 0.5)
          .noise(700, 130, 0.16, 0.42, { type: 'lowpass', brown: true })
          .noise(1900, 1200, 0.03, 0.22, { q: 1.2 })
          .tone('triangle', 196, 178, 0.22, 0.14, { at: 0.01, vibHz: 30, vibDepth: 0.05 })
          .noise(5200, 2600, 0.55, 0.35, { type: 'highpass', attack: 0.03, at: 0.015 })
          .noise(2600, 1500, 0.3, 0.1, { q: 1.5, attack: 0.02, at: 0.02 })
          .tone('sine', 250, 1000, 1.05, 0.12, { at: 0.08, attack: 0.18, sustain: 0.55, vibHz: 5, vibDepth: 0.02 })
          .tone('sine', 377, 1508, 1.0, 0.04, { at: 0.12, attack: 0.25, sustain: 0.5, vibHz: 5.4, vibDepth: 0.02 })
          .tone('triangle', 500, 2000, 0.9, 0.025, { at: 0.16, attack: 0.3, sustain: 0.4 });
        break;
      // Vulkaninsel (vorläufig: brechen und leerlaufen wie der Einschlag)
      case 'crack':
      case 'drain':
      // Gewitterkamm (vorläufig)
      case 'thunder':
      case 'rod':
      case 'rumble':
      // Zeitriss-Ruine (vorläufig)
      case 'riftwarn':
      case 'rift':
      case 'meteor': {
        // Meteorit: ein kurzes, fallendes Heulen (Sinus mit schnellem Flattern und ein
        // enges Rauschband, das mit hinabfährt – im Comic pfeift es auch ohne Luft), dann
        // ab 0,3 s der große, dumpfe Einschlag: tiefer Sinus, braunes Rauschen, ein Knall
        // im Mittenband und ein tiefes Rechteck als Wucht; danach rieselt Geröll nach –
        // kurze, dumpfe Brocken in weiten Abständen (bei geringer Schwerkraft fällt es
        // langsam) über einem leisen Grollen. Im Meteoritenfeld schlagen sechs kurz
        // nacheinander ein, darum reihum drei Fassungen (Tonhöhe des Heulens, Geröll).
        const k = this.meteorTick++ % 3;
        const f = [1500, 1300, 1700][k];
        const g = METEOR_GRAVEL[k];
        v.tone('sine', f, f * 0.28, 0.32, 0.12, { attack: 0.06, sustain: 0.7, vibHz: 13, vibDepth: 0.025 })
          .noise(f * 2, f * 0.5, 0.32, 0.12, { q: 2.2, attack: 0.08 })
          .tone('sine', 110, 30, 0.6, 0.6, { at: 0.3 })
          .noise(850, 100, 0.5, 0.55, { type: 'lowpass', brown: true, at: 0.3 })
          .noise(1600, 500, 0.07, 0.3, { q: 1, at: 0.3 })
          .tone('square', 62, 38, 0.16, 0.12, { at: 0.3 })
          .noise(5000, 3000, 0.25, 0.06, { type: 'highpass', attack: 0.01, at: 0.31 })
          .noise(320, 140, 0.9, 0.22, { type: 'lowpass', brown: true, attack: 0.1, at: 0.4 });
        for (let i = 0; i < g.length; i += 2) {
          const fg = g[i + 1];
          v.noise(fg, fg * 0.6, 0.05, 0.16 - 0.02 * i, { q: 1.5, at: g[i], attack: 0.003 });
        }
        break;
      }
      // --- Fliegen ---
      case 'wings':
        // Ausklappen: zwei schnelle Stoff-Schnapper (enges Rauschen, der zweite tiefer),
        // dazwischen ein trockenes Klacken des Gestänges; dann rauscht die Luft kurz in
        // die Flügel und ein leises „Hui" steigt nach oben.
        v.noise(2600, 1500, 0.04, 0.3, { q: 2.5, attack: 0.002 })
          .tone('triangle', 1250, 980, 0.035, 0.12, { at: 0.03 })
          .tone('sine', 170, 95, 0.06, 0.12, { at: 0.03 })
          .noise(1900, 1100, 0.05, 0.24, { q: 2.5, attack: 0.002, at: 0.065 })
          .noise(500, 2300, 0.34, 0.16, { q: 0.8, attack: 0.07, at: 0.05 })
          .tone('sine', 380, 880, 0.3, 0.05, { attack: 0.1, at: 0.09, vibHz: 6, vibDepth: 0.02 });
        break;
      // Gewitterkamm (vorläufig: wie der Schubring)
      case 'charge':
      // Spiegelkabinett (vorläufig: wie der Schubring)
      case 'portal':
      case 'shimmer':
      case 'ring':
        // Durch den Ring: ein steigender Gleitton zieht in einen hellen Glanz-Zweiklang
        // (G6 + D7, leicht schwebend) – Glocke statt Notenfolge wie beim Einsammeln;
        // darunter breites, nach oben fahrendes Rauschen als Schub, aber ohne den
        // tiefen Schlag und den Sägezahn des Boost-Felds.
        v.tone('triangle', 520, 1568, 0.17, 0.16, { attack: 0.09 })
          .tone('sine', 1568, 1562, 0.42, 0.2, { at: 0.11, attack: 0.008, vibHz: 7, vibDepth: 0.004 })
          .tone('sine', 2349, 2340, 0.36, 0.11, { at: 0.12, attack: 0.008, vibHz: 7.6, vibDepth: 0.004 })
          .tone('triangle', 784, 782, 0.3, 0.08, { at: 0.11, attack: 0.01 })
          .noise(800, 5000, 0.45, 0.34, { q: 1, attack: 0.05 })
          .noise(6000, 9000, 0.25, 0.05, { type: 'highpass', attack: 0.02, at: 0.11 });
        break;
      case 'lift':
        // Aufwind: weiches, breites Rauschen, das langsam anschwillt und dabei nach oben
        // zieht, darüber ein Hauch Luft; ein leiser Sinus steigt mit und schwebt sacht.
        v.noise(380, 1700, 0.95, 0.2, { q: 0.7, attack: 0.38 })
          .noise(2200, 4500, 0.85, 0.05, { type: 'highpass', attack: 0.34, at: 0.06 })
          .tone('sine', 230, 460, 0.9, 0.03, { attack: 0.4, vibHz: 4, vibDepth: 0.015 });
        break;
      case 'wind': {
        // Fahrtwind im Gleitflug, etwa alle 0,42 s aufgerufen (je nach Bildrate 0,36–0,5 s):
        // drei breite Rauschschichten, um je 0,15 s versetzt, die langsam (0,45 s) ein- und
        // lang ausschwingen. So liegt alle ~0,15 s ein neuer Gipfel an, die Folge verschmilzt
        // (gemessen, ohne das Zufallsflattern des Rauschens: die Hüllkurve schwankt um gut
        // 1 dB, bei 0,5 s Takt knapp 2 dB); nach dem letzten Aufruf klingt es in rund einer
        // Sekunde aus. Der Versatz 0,15 statt 0,14 verteilt die Gipfel auch beim langsamen
        // Takt gleichmäßig.
        // Lebendig machen es die reihum wechselnden Fassungen: die Mitten der Schichten fahren
        // mal hinauf, mal hinunter (eng gehalten, sonst wandert mit der Bandbreite der Pegel),
        // dazu ein leises Pfeifen an den Flügeln mit wechselnder Tonhöhe und tiefes, braunes
        // Rauschen als Körper (ebenfalls zweifach versetzt, sonst pumpt es im Aufruftakt).
        const k = this.windTick++ % 3;
        const [a, b, c, w] = [
          [760, 900, 820, 1350],
          [880, 780, 940, 1600],
          [800, 950, 760, 1200],
        ][k];
        v.noise(a, b, 1.35, 0.1, { q: 0.6, attack: 0.45 })
          .noise(b, c, 1.35, 0.1, { q: 0.6, attack: 0.45, at: 0.15 })
          .noise(c, a, 1.35, 0.1, { q: 0.6, attack: 0.45, at: 0.3 })
          .noise(260, 200, 1.35, 0.05, { type: 'lowpass', brown: true, attack: 0.45, at: 0.075 })
          .noise(240, 200, 1.35, 0.05, { type: 'lowpass', brown: true, attack: 0.45, at: 0.3 })
          .noise(w, w * 1.15, 0.9, 0.02, { q: 7, attack: 0.35, at: 0.1 });
        break;
      }
      // --- Sturmhafen ---
      case 'gust': {
        // Eine Böe setzt ein (ortsfest, einmal je Böe, ~1,2 s) – das Warnsignal der Strecke.
        // Ein Fauchen schwillt in gut einer halben Sekunde an (so lange, wie die Böe in der
        // Physik zum vollen Schub braucht: WIND_RISE = 26 Ticks), hält kurz und verweht: drei
        // breite Rauschbänder, gestaffelt einsetzend, die ersten beiden fahren hinauf (260 →
        // 1500 und 500 → 2300 Hz: der Wind „kommt heran"), das dritte schon wieder hinab;
        // darüber Gischt (Hochpass), darunter Druck aus braunem Rauschen. In der Takelage und
        // an den Kränen pfeift es: zwei enge Rauschbänder (Güte 12–14, also immer noch Rauschen
        // und kein Sinus), die nur eine Viertel- bzw. Achteloktave gleiten und nicht wiederkehren
        // – darum keine Sirene. Auf dem Höhepunkt schlagen lose Leinen an (vier kurze Klapse).
        // Abgrenzung: 'wind' ist ein gleichmäßiges Bett um 0,8–0,95 kHz ohne Anschwellen,
        // 'lift' ein weiches, dünnes Aufrauschen mit Sinus; die Böe ist breiter, lauter, hat
        // Pfeifen und Klappern und fällt nach dem Gipfel wieder. Drei Fassungen reihum
        // (Pfeiftöne, Klapse). Gemessen (vor dem Mischpult): −9,6 bis −10,3 LUFS (Geysir −11,3,
        // Lawine −11,5), Spitze 1,3–1,6, voll nach ≈ 0,5 s, ab 0,8 s fallend, Dauer 1,2 s;
        // im Spiel-Mix aus 0 m (Faktor 0,55) hebt sie gegen Motor und Musik die Oktaven
        // 1/2/4 kHz um 1,9/4/8 dB an – mehr als der Geysir (−0,3/1,5/6,9 dB).
        const k = this.gustTick++ % 3;
        const g = GUST_PATTERN[k];
        v.noise(260, 1500, 1.0, 0.3, { q: 0.7, attack: 0.45 })
          .noise(500, 2300, 1.0, 0.3, { q: 0.8, attack: 0.36, at: 0.2 })
          .noise(2400, 900, 0.95, 0.25, { q: 0.75, attack: 0.3, at: 0.4 })
          .noise(4200, 6500, 0.8, 0.07, { type: 'highpass', attack: 0.32, at: 0.25 })
          .noise(160, 380, 1.15, 0.3, { type: 'lowpass', brown: true, attack: 0.5, at: 0.05 })
          .noise(g[0] * 0.86, g[0] * 1.07, 0.95, 0.5, { q: 12, attack: 0.45, at: 0.15 })
          .noise(g[1] * 1.05, g[1] * 0.93, 0.7, 0.35, { q: 14, attack: 0.25, at: 0.45 });
        for (let i = 2; i < g.length; i += 2) v.noise(g[i + 1], g[i + 1] * 0.7, 0.035, 0.3, { q: 3, at: g[i], attack: 0.002 });
        break;
      }
      // Dschungel-Fluss (vorläufig: wie der Sturm)
      case 'rapids':
      case 'falls':
      case 'storm': {
        // Das eigene Kart steckt in der Böe; etwa alle 0,3 s aufgerufen (raceScene: gustWait,
        // je nach Bildrate 0,30–0,33 s). Jeder Aufruf ist ~0,55 s lang und weich: fünf Schichten
        // braunes Rauschen (Druck, 230–340 Hz) um je 0,065 s versetzt, mit 0,16 s Anstieg – so
        // liegt auch über die Aufrufe hinweg etwa alle 0,065 s ein neuer Gipfel an, und zwischen
        // 0,30 und 0,33 s Abstand entsteht keine Lücke (mit drei Schichten zu 0,1 s fiel die
        // Folge bei 0,33 s periodisch um 5 dB ein). Darüber drei breite Bänder um 0,9–1,35 kHz
        // und ein Hochpass-Zischen, deren Mitten bei jedem Aufruf zufällig etwas anders liegen:
        // das Rauschen „wandert", ohne im Aufruftakt zu pumpen. Das Knattern (Plane, Jacke) sind
        // kurze, breite Klapse (0,7–1,4 kHz) in unregelmäßigen Abständen von 42–72 ms, drei bis
        // sechs je Aufruf, und bei etwa jedem dritten Aufruf keine – so flattert es in Schüben
        // und nicht im 0,3-s-Raster. Abgrenzung: 'wind' (Fliegen) ist glatt und mittig ohne
        // Knattern und tiefen Druck; 'snow' dumpf mit Wummern.
        // Gemessen, 14 Aufrufe (systematische Welligkeit über 8 Durchläufe gemittelt, 50 ms):
        // 2,3 dB bei 0,30 s, 2,7 dB bei 0,333 s, 2,8 dB bei 0,31 s ± 15 ms Zittern (der tiefste
        // gemittelte Wert liegt höchstens 2 dB unter dem Mittel); 40 Aufrufe: Anfang und Ende
        // gleich laut, nichts schaukelt sich auf. Pegel der Folge −33,9 bis −34,8 LUFS, wie
        // 'wind' im Gleitflug (−33,7). Das Knattern hebt die Folge um
        // ≈ 1 dB und bringt Spitzen von ≈ 16 dB über dem Rauschen.
        const r = Math.random;
        const lo = 230 + 90 * r();
        const mid = 900 + 450 * r();
        for (let i = 0; i < 5; i++) v.noise(lo + 20 * i, lo * 0.8, 0.3, 0.09, { type: 'lowpass', brown: true, attack: 0.16, at: i * 0.065 });
        for (let i = 0; i < 3; i++) v.noise(mid * (0.85 + 0.3 * r()), mid * (0.85 + 0.3 * r()), 0.36, 0.06, { q: 0.6, attack: 0.18, at: 0.02 + i * 0.11 });
        v.noise(2800 + 1200 * r(), 3600 + 1200 * r(), 0.55, 0.03, { type: 'highpass', attack: 0.27 });
        if (r() < 0.7) {
          let t = 0.1 + 0.08 * r();
          const n = 3 + Math.floor(r() * 4);
          for (let i = 0; i < n && t < 0.42; i++) {
            const f = 700 + 700 * r();
            v.noise(f, f * 0.7, 0.035, 0.4 * (0.7 + 0.3 * r()), { q: 1.3, at: t, attack: 0.002 });
            t += 0.042 + 0.03 * r();
          }
        }
        break;
      }
      // --- Riesenkinderzimmer ---
      // Schrumpfen und Wachsen sind ein Paar aus denselben drei Bausteinen in entgegengesetzter
      // Richtung: ein Gleitton aus Sägezahn, Dreieck und Sinus (wie ein Tonband, das schneller bzw.
      // langsamer läuft – mit leichtem Leiern, 9 Hz), ein „Zip“ (schmaler Puls mit 70-Hz-Rattern
      // und ein enges Rauschband, die gemeinsam fahren) und ein Schlusston. Beim Schrumpfen fällt
      // zuerst der dicke Sägezahn weg und der Sinus läuft am höchsten hinauf: der Ton wird dünn;
      // beim Wachsen kommt der Sägezahn erst nach und nach dazu: der Ton wird breit. Abgrenzung:
      // 'ring' zieht in einen hellen Glockenzweiklang mit Schubrauschen, 'fall' fällt lange
      // und leise, 'use-spring' ist ein Boing mit 21-Hz-Vibrato.
      case 'shrink':
        // Hinauf in 0,34 s (240 → 1500 Hz, der Sinus bis 2,9 kHz), das Zip saust mit hinauf
        // (1,8 → 7,5 kHz), dann ein winziges, hohes „Pling“ (E7 mit leiser Oktave), 0,45 s.
        // Gemessen: Frequenzschwerpunkt je 60 ms 330 → 460 → 640 → 880 → 1570 → 2650 Hz
        // (+8,4 Oktaven/s), nichts unter 200 Hz.
        v.tone('sawtooth', 240, 820, 0.22, 0.12, { attack: 0.012, vibHz: 9, vibDepth: 0.015 })
          .tone('triangle', 240, 1500, 0.34, 0.16, { attack: 0.012, sustain: 0.6, vibHz: 9, vibDepth: 0.015 })
          .tone('sine', 480, 2900, 0.32, 0.07, { at: 0.04, attack: 0.03, sustain: 0.6 })
          .tone('pulse12', 900, 3600, 0.16, 0.05, { at: 0.03, attack: 0.01, tremHz: 70 })
          .noise(1800, 7500, 0.16, 0.1, { q: 3, at: 0.03, attack: 0.01 })
          .tone('sine', 2637, 2630, 0.16, 0.2, { at: 0.29, attack: 0.002 })
          .tone('triangle', 5274, 5260, 0.08, 0.04, { at: 0.29, attack: 0.002 });
        break;
      case 'grow':
        // Hinab in 0,4 s (Sinus 1500 → 240, Dreieck 900 → 160, Sägezahn 620 → 115 Hz, die
        // tiefen Schichten setzen später und weicher ein), das Zip saust hinab (7,5 → 1,8 kHz),
        // dann ab 0,31 s ein sattes, rundes „Bwomm“: Sinus 150 → 80 Hz mit weichem Anstieg,
        // Dreieck eine Oktave darüber, ein Hauch braunes Rauschen. 0,56 s. Gemessen:
        // Schwerpunkt 1370 → 990 → 690 → 580 → 680 → 330 → 285 Hz (−5,4 Oktaven/s),
        // die Hüllkurve steigt (Drittel −21 / −17 / −15 dB), gut die Hälfte unter 200 Hz.
        v.tone('sine', 1500, 240, 0.36, 0.08, { attack: 0.012, sustain: 0.4 })
          .tone('triangle', 900, 160, 0.38, 0.14, { at: 0.04, attack: 0.1, sustain: 0.55, vibHz: 9, vibDepth: 0.015 })
          .tone('sawtooth', 620, 115, 0.34, 0.12, { at: 0.06, attack: 0.12, sustain: 0.7, vibHz: 9, vibDepth: 0.015 })
          .tone('pulse12', 3600, 900, 0.16, 0.05, { at: 0.03, attack: 0.01, tremHz: 70 })
          .noise(7500, 1800, 0.16, 0.1, { q: 3, at: 0.03, attack: 0.01 })
          .tone('sine', 150, 80, 0.28, 0.45, { at: 0.31, attack: 0.025 })
          .tone('triangle', 300, 165, 0.2, 0.1, { at: 0.31, attack: 0.025 })
          .noise(320, 110, 0.16, 0.15, { type: 'lowpass', brown: true, at: 0.31, attack: 0.02 });
        break;
      case 'sizeend':
        // Wieder normal groß – passiert oft, darum weich und kurz (0,24 s), ohne Gleitfahrt und
        // ohne Zip der beiden anderen: ein „Plopp“ (Sinus, der in 50 ms eine Oktave
        // hinaufschnippt, mit dumpfem Lippenknall aus Rauschen), dann federt der Ton um
        // 650 Hz kurz nach (16-Hz-Vibrato, 5 %) und verklingt. Mitte 500–1500 Hz statt tiefer:
        // dort lässt ihm das Zimmer-Stück mit dem Motor Platz (im Mix +1 dB bei 1 kHz);
        // weiter unten verschwand es ganz.
        v.tone('sine', 380, 760, 0.05, 0.3, { attack: 0.003 })
          .noise(1200, 400, 0.03, 0.12, { type: 'lowpass', attack: 0.002 })
          .tone('sine', 700, 600, 0.22, 0.14, { at: 0.04, attack: 0.01, vibHz: 16, vibDepth: 0.05 })
          .tone('triangle', 1400, 1200, 0.08, 0.04, { at: 0.04, attack: 0.01 });
        break;
      case 'smash': {
        // Ein riesiges Kart bricht durch die Bauklotz-Mauer (0,75 s): ein dumpfer, hohler Stoß
        // (tiefer Sinus, braunes Rauschen, ein kurzes Dreieck um 200 Hz als Holzkasten), dann
        // fallen elf Klötze – jeder ein trockener Klick (enges Rauschen) über einem kurzen
        // Sinus mit dem schiefen Teilton ×2,71 eines Holzstabs, 0,9–1,9 kHz, also hell und hohl
        // statt Stein (kein breites Rauschen, kein Splittern). Die Abstände werden größer
        // (30–60 ms am Anfang, 80–100 ms am Ende) und die Klötze leiser: sie fallen
        // auseinander und rollen aus. Drei Fassungen reihum (SMASH_BLOCKS). Gemessen
        // (Einsätze über 700 Hz): 1 Stoß + 11 Klötze in allen drei Fassungen, Pegel von −8
        // auf −14 dB fallend; im Spiel-Mix +5,6 dB bei 1 kHz, Ausgangsspitze 0,52 (Presse 0,50).
        const p = SMASH_BLOCKS[this.smashTick++ % SMASH_BLOCKS.length];
        v.tone('sine', 120, 48, 0.22, 0.5)
          .noise(520, 120, 0.18, 0.4, { type: 'lowpass', brown: true })
          .tone('triangle', 230, 170, 0.09, 0.16, { attack: 0.002 })
          .noise(1400, 700, 0.04, 0.18, { q: 1.2, attack: 0.002 });
        for (let i = 0; i < p.length; i += 2) {
          const at = p[i];
          const f = p[i + 1];
          const s = 1 - 0.55 * Math.min(1, at / 0.75);
          v.noise(f * 2.2, f * 1.8, 0.014, 0.3 * s, { q: 2, at, attack: 0.0008 })
            .tone('sine', f, f * 0.985, 0.07, 0.28 * s, { at, attack: 0.001 })
            .tone('sine', f * 2.71, f * 2.69, 0.03, 0.07 * s, { at, attack: 0.001 });
        }
        break;
      }
      // --- Maschinen und Wasser ---
      case 'press':
        // Stampfpresse: ganz kurz zischt die Hydraulik, dann (ab 0,06 s) der Schlag –
        // tiefer Sinus und braunes Rauschen als Bauch, ein harter Aufprall-Knack, darüber
        // zwei unharmonische Dreiecks-Teiltöne als Metallklang und ein kurzes Nachklirren.
        v.noise(6000, 3800, 0.08, 0.13, { type: 'highpass', attack: 0.015 })
          .tone('sine', 105, 36, 0.44, 0.55, { at: 0.06 })
          .noise(650, 110, 0.32, 0.45, { type: 'lowpass', brown: true, at: 0.06 })
          .tone('square', 72, 44, 0.12, 0.1, { at: 0.06 })
          .noise(2000, 600, 0.05, 0.26, { q: 1, at: 0.06 })
          .tone('triangle', 287, 281, 0.32, 0.1, { at: 0.06 })
          .tone('triangle', 761, 748, 0.24, 0.07, { at: 0.065 })
          .tone('sine', 1532, 1510, 0.16, 0.04, { at: 0.065 })
          .noise(3300, 2800, 0.03, 0.08, { q: 5, at: 0.19 })
          .noise(4100, 3500, 0.025, 0.05, { q: 5, at: 0.28 });
        break;
      case 'splash': {
        // Wasser: zwei breite, weich ein- und ausschwingende Rauschschichten, um eine
        // halbe Aufrufspanne versetzt, damit die ~0,28 s folgenden Aufrufe zu einem
        // durchgehenden Rauschen verschmelzen. Dazu je Aufruf ein Platscher und ein
        // Tröpfchen aus wechselnden Fassungen (reihum, wie bei 'burn').
        const k = this.splashTick++ % 3;
        const [pAt, pF, dAt, dF] = [
          [0.04, 1500, 0.16, 900],
          [0.12, 1150, 0.22, 1250],
          [0.07, 1800, 0.25, 1050],
        ][k];
        v.noise(1500, 900, 0.7, 0.12, { q: 0.7, attack: 0.2 })
          .noise(1300, 800, 0.7, 0.11, { q: 0.7, attack: 0.2, at: 0.14 })
          .noise(420, 260, 0.6, 0.13, { type: 'lowpass', brown: true, attack: 0.22, at: 0.07 })
          .noise(pF, pF * 0.45, 0.1, 0.1, { q: 1.3, attack: 0.008, at: pAt })
          .tone('sine', dF, dF * 1.7, 0.045, 0.05, { at: dAt });
        break;
      }
      // Spiegelkabinett (vorläufig: wie der Kurzschluss)
      case 'mirror':
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
      // Dschungel-Fluss (vorläufig: wie die Landung)
      // Wüstenexpress (vorläufig: wie das Floß)
      case 'board':
      case 'rattle':
      case 'raft':
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
