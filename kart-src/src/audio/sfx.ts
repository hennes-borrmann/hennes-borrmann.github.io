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
/** Bröckeln: Eckfrequenzen (Hz) und Abstände (s) der Knackser im Stein, als feste Muster (je Fassung versetzt gelesen). */
const CRUMBLE_GRIT_HZ = [2300, 1500, 3100, 1800, 2700, 1250, 3500, 2000, 1650, 2900, 1400, 2500, 3300];
const CRUMBLE_GRIT_GAP = [0.15, 0.1, 0.19, 0.12, 0.08, 0.16, 0.11];
/** Bröckeln: herabfallende Brocken je Fassung, paarweise [Beginn (s), Eckfrequenz (Hz)]. */
const CRUMBLE_CHUNKS = [
  [0.62, 430, 1.18, 360, 1.62, 480, 1.98, 400],
  [0.55, 470, 1.08, 400, 1.55, 380, 1.93, 450],
  [0.7, 390, 1.25, 450, 1.7, 420, 2.02, 360],
];
/** Bruch: polternde Schollen je Fassung, paarweise [Beginn (s), Eckfrequenz (Hz)] – immer tiefer, sie fallen weg. */
const CRACK_RUBBLE = [
  [0.07, 900, 0.13, 760, 0.2, 820, 0.28, 640, 0.36, 560, 0.45, 470, 0.53, 400],
  [0.06, 820, 0.14, 880, 0.21, 700, 0.27, 620, 0.37, 580, 0.44, 430, 0.55, 380],
  [0.08, 950, 0.12, 720, 0.19, 780, 0.29, 600, 0.35, 520, 0.46, 450, 0.52, 420],
];
/** Einsturz: Splittern des Holzes, Eckfrequenzen (Hz) und Abstände (s) der Splitter. */
const SPLINTER_HZ = [2400, 1700, 3100, 1300, 2700, 1900, 3400, 1500];
const SPLINTER_GAP = [0.028, 0.041, 0.022, 0.035, 0.05, 0.026];
/** Einsturz: fallende Bohlen, je drei Werte [Beginn (s), Holzton (Hz), Doppelschlag 0/1]. */
const COLLAPSE_PLANKS = [
  0.72, 830, 1, 0.83, 660, 0, 0.92, 980, 1, 1.02, 580, 0, 1.1, 750, 1, 1.21, 530, 0, 1.3, 900, 0,
  1.4, 640, 1, 1.52, 480, 0, 1.63, 720, 0, 1.76, 560, 1, 1.9, 450, 0, 2.02, 610, 0,
];
/** Leerlaufen: Gluckser der abfließenden Lava, paarweise [Beginn (s), Tonhöhe (Hz)], nach unten abziehend. */
const DRAIN_GLUG = [0.06, 330, 0.17, 290, 0.3, 310, 0.41, 250, 0.55, 230, 0.66, 260, 0.8, 190, 0.93, 170, 1.06, 180, 1.18, 140, 1.3, 120];
/** Donner: je Fassung das Poltern nach dem Knall, paarweise [Beginn (s), Eckfrequenz (Hz)] –
 *  erst dicht und heller, dann weiter auseinander und dunkler (der Schall der fernen Teile
 *  des Blitzkanals kommt später und dumpfer an). */
const THUNDER_ROLL = [
  [0.07, 900, 0.17, 640, 0.29, 760, 0.42, 480, 0.58, 560, 0.77, 380, 0.99, 330, 1.22, 260],
  [0.06, 820, 0.19, 700, 0.27, 520, 0.45, 620, 0.6, 420, 0.82, 450, 0.97, 300, 1.2, 280],
  [0.08, 960, 0.15, 580, 0.33, 680, 0.41, 500, 0.64, 470, 0.76, 350, 1.05, 360, 1.27, 240],
];
/** Blitzableiter: je Fassung das Britzeln, paarweise [Beginn (s), Mitte (Hz)] – immer seltener und tiefer. */
const ROD_SPARKS = [
  [0.04, 5200, 0.07, 4600, 0.12, 4900, 0.16, 4100, 0.22, 4300, 0.29, 3600, 0.37, 3800, 0.46, 3100, 0.57, 2900, 0.7, 2400, 0.84, 2100],
  [0.035, 4900, 0.08, 5300, 0.11, 4300, 0.17, 4500, 0.24, 3900, 0.3, 4000, 0.39, 3300, 0.48, 3400, 0.6, 2700, 0.72, 2600, 0.86, 1900],
  [0.045, 5400, 0.075, 4400, 0.13, 4700, 0.18, 3900, 0.21, 4200, 0.31, 3500, 0.36, 3600, 0.5, 2900, 0.55, 3000, 0.74, 2300, 0.83, 2200],
];
/** Ladefeld: je Fassung das Knistern, paarweise [Beginn (s), Mitte (Hz)] – immer dichter und höher. */
const CHARGE_SPARKS = [
  [0.03, 1800, 0.1, 2300, 0.16, 2000, 0.21, 2900, 0.25, 2600, 0.29, 3400, 0.32, 3100, 0.35, 3900],
  [0.05, 2100, 0.11, 1900, 0.17, 2600, 0.22, 2400, 0.26, 3200, 0.3, 2900, 0.33, 3700, 0.36, 3500],
  [0.04, 1700, 0.09, 2500, 0.15, 2200, 0.2, 2700, 0.24, 3000, 0.28, 2800, 0.31, 3600, 0.345, 4000],
];
/** Floß: je Fassung der Ton des hohlen Stamms (Hz), dann paarweise [Beginn (s), Tonhöhe als Faktor] der drei Holzschläge. */
const RAFT_PATTERN = [
  [205, 0, 1, 0.075, 0.87, 0.165, 1.13],
  [182, 0, 1, 0.065, 1.1, 0.15, 0.9],
  [232, 0, 1, 0.085, 0.84, 0.18, 1.06],
];

/** Lokpfeife: je Fassung die zwei Töne (Hz) des Zweiklangs – kleine Terz, leicht verstimmt. */
const WHISTLE_HZ = [
  [605, 720],
  [572, 683],
  [640, 762],
];
/** Aufspringen: je Fassung Blech-Grundton (Hz), drei polternde Schläge (s) und der helle Akzent (s). */
const BOARD_PATTERN = [
  [410, 0.12, 0.2, 0.29, 0.36],
  [380, 0.11, 0.21, 0.28, 0.37],
  [445, 0.13, 0.2, 0.3, 0.35],
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
  // Zeitriss-Ruine (Runde 12). Beide kommen mit Faktor 1 (überall gleich laut). Vor dem
  // Mischpult: Gong ≈ −15,7 LUFS (Spitze 0,6), Riss ≈ −14,1 (Sprungplatte −13). Im Spiel-Mix
  // (Motor und Werkshof-Musik, Regler 0,5/0,8) als Beitrag gemessen, lautestes 400- bzw.
  // 100-ms-Fenster: Gong −21,6/−19,9 LUFS – deutlich zu hören (+1,1 LU, wie die Sprungplatte),
  // aber im kurzen Fenster unter dem Treffer (−22,6/−16,8: kurz und hart); Riss −19,6/−17,3
  // wie die Sprungplatte (−20,2/−17,3). Beide 3 s nacheinander: Ausgangsspitze 0,45.
  riftwarn: 1.4,
  rift: 1.2,
  // Vulkaninsel (Runde 11), gemessen wie oben: der Bruch ≈ −11,6 LUFS wie Meteorit und Bombe;
  // das Bröckeln beginnt gut 10 dB leiser und schwillt bis ≈ −14 LUFS an (knapp darunter);
  // Einsturz ≈ −10,3 und Leerlaufen ≈ −10,7 LUFS – kräftig, denn man hört beide fast immer
  // aus großer Entfernung (Reichweite 600 m).
  crumble: 2.7,
  crack: 4.6,
  collapse: 5.4,
  drain: 2.4,
  // Gewitterkamm (Runde 13), gemessen wie oben und im Spiel-Mix (Motor + Gewitter-Stück, Regler 0,5/0,8,
  // Beitrag des Geräuschs als Momentanlautheit): der Donner aus 0 m (Faktor 0,55) −20,6 LUFS, etwas über dem
  // Meteoriten (−22,4) – das lauteste Ereignis der Strecke; der Blitzableiter aus 0 m −25,8 (5 LU darunter, aber
  // mit +7 dB bei 8 kHz klar); das Grollen −32,7 bei Faktor 0,41 (die Sturm-Folge des Hafens −37; das Grollen
  // liegt fast ganz unter 200 Hz, wo Motor und Musik es verdecken, darum etwas darüber); das Aufladen wie der
  // Schub (100-ms-Lautheit −18,2 gegen −18,8 beim Boost-Feld).
  thunder: 3,
  rod: 3.4,
  // Dschungel-Fluss (Runde 14), gemessen wie oben: das Floß ≈ −20 LUFS (Landung −18; im
  // Spiel-Mix trägt es aber 2,7 dB mehr bei als sie, weil es in den Mitten liegt – und es klingt
  // bei jedem Wechsel der Bahn); die Folge der Fluss-Aufrufe ≈ −34 LUFS wie die Sturm-Folge (ein
  // Bett); die Folge des Wasserfalls ≈ −12,5 LUFS wie die Lawine (−12) – aus der Nähe mächtig.
  raft: 2.2,
  rapids: 1.1,
  falls: 7,
  // Spiegelkabinett (Runde 15), gemessen wie oben: Portal ≈ −17,1 LUFS, Falle ≈ −17,2 (Schubring
  // −17,3) – am eigenen Kart heben beide im Spiel-Mix die Oktaven 2/4/8 kHz um gut 5/3–4/6–8 dB über
  // Motor und Musik (Schubring 5,3/0,9/7). Das Schimmern ≈ −24 LUFS, im Spiel aus 0 m (Faktor
  // 0,55) ≈ −29, zwei zugleich ≈ −26 – ein Hinweis, 9 LU unter einem Portal.
  portal: 2.1,
  mirror: 2.8,
  shimmer: 3.2,
  // Wüstenexpress (Runde 16), gemessen wie oben: die Pfeife ≈ −19,5 LUFS (Hupe −20,7: aus der
  // Nähe so deutlich wie die Hupe, aber länger und weicher), das Aufspringen ≈ −20,5 (zwischen
  // Landung −18 und Floß −27); die Folgen ≈ −35 LUFS (Rollen am Zug bei Faktor 0,5 wie die
  // Stromschnellen, Rattern auf dem Dach wie der Sturm) – Betten, keine Hauptdarsteller.
  whistle: 1.06,
  trainpass: 0.9,
  board: 1.6,
  rattle: 1.18,
  // Riesenkinderzimmer (Runde 17), gemessen wie oben: Schrumpfen ≈ −15,8 und Wachsen ≈ −16,2 LUFS
  // (Schubring −17,3: im Spiel-Mix mit Motor und Zimmer-Stück trägt der Ring mit seinem hellen
  // Glanz bei 1,5–4 kHz mehr; so liegen alle drei dort gleichauf, lautestes 100-ms-Fenster
  // −18,5 bis −18,9 LUFS); Wieder-normal ≈ −24,3 (oft und nebensächlich, im Mix gut 4 dB unter
  // den beiden); Bauklotz-Mauer ≈ −13,1 bis −13,6 (Presse −13,2).
  shrink: 2,
  grow: 1.6,
  sizeend: 2.2,
  smash: 2.8,
  rumble: 1.2,
  charge: 2,
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

// --- Spiegelkabinett: Bausteine für 'portal', 'mirror' und 'shimmer' ---

/** Aufglitzern: Tonvorrat (Hz) – E-lydisch wie das Rennstück, E7 bis Dis8. */
const SCHIMMER_HZ = [2637, 2960, 3322, 3729, 3951, 4435, 4978];

/**
 * Der Sog beim Durchtauchen eines Spiegels (0–0,2 s): zwei enge Rauschbänder, eines von
 * unten (600 Hz), eines von oben (4 kHz), schwellen an und laufen bei 1,5 kHz zusammen –
 * das Rauschen „zieht sich zusammen" –, darüber ein Hauch Glanz. Weil die Hüllkurve nach dem
 * langen Anschwellen sofort fällt, klingt es wie rückwärts gespielt: ein Einatmen, kein Stoß.
 */
function glasSog(v: Voice): void {
  v.noise(600, 1500, 0.2, 0.16, { q: 2.6, attack: 0.16 })
    .noise(4000, 1500, 0.2, 0.13, { q: 2.6, attack: 0.16 })
    .noise(7000, 9000, 0.18, 0.015, { type: 'highpass', attack: 0.14 });
}

/**
 * Ein gläserner Ton von f0 nach f1 (Hz): Sinus mit den unharmonischen Teiltönen eines
 * Glases (×2,32 und ×4,25, leiser und kürzer). `hold` = Anteil der Dauer, bevor die Fahrt
 * beginnt. Mit `drift` klingt eine zweite Stimme mit, die vom selben Ton ausgeht, aber bei
 * f1 · (1 + drift) ankommt: die Schwebung beginnt bei null und wird immer schneller.
 */
function glasTon(v: Voice, f0: number, f1: number, at: number, dur: number, vol: number, hold: number, drift = 0): void {
  const a = drift ? vol * 0.6 : vol;
  v.tone('sine', f0, f1, dur, a, { at, attack: 0.004, hold })
    .tone('sine', f0 * 2.32, f1 * 2.32, dur * 0.55, a * 0.3, { at, attack: 0.003, hold })
    .tone('sine', f0 * 4.25, f1 * 4.25, dur * 0.3, a * 0.12, { at, attack: 0.002, hold });
  if (drift) v.tone('sine', f0, f1 * (1 + drift), dur, a * 0.75, { at, attack: 0.004, hold });
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
  private whistleTick = 0;
  private boardTick = 0;
  private raftTick = 0;
  private crumbleTick = 0;
  private crackTick = 0;

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
      // --- Zeitriss-Ruine ---
      // Beide kommen überall gleich laut (Mitte, Faktor 1), alle 18 s – das Paar eines Sprungs
      // liegt 3 s auseinander, zusammen also gut 4 s Ton je Sprung, neunmal in einem Rennen.
      case 'riftwarn': {
        // Drei Sekunden vor dem Sprung der Zeit (endet knapp davor). Ein tiefer Gong auf A2
        // (110 Hz, der Grundton des Rennstücks), mit einem weichen Schlegel angeschlagen: kurzer,
        // dumpfer Anschlag (tiefpassgefiltertes Rauschen, ein Sinus-Stoß) statt eines Knalls.
        // Die Teiltöne: Grundton, Oktave und Duodezime fast harmonisch – darum ein klarer Ton –,
        // dazu drei unharmonische (×2,76, ×4,17, ×5,4), die schnell vergehen und den Anschlag
        // metallisch machen. Grundton und Oktave haben je einen um ~1 Hz verstimmten Zwilling:
        // Sie schweben (Schwebung ~1 Hz), wie ein großer Gong. Weil eine Exponentialrampe bis
        // −80 dB über die ganze Dauer zu früh leise wird, klingt jeder dieser Teiltöne in zwei
        // Schichten: eine kurze, laute vom Anschlag und eine, die in 0,35 s aufblüht (große Gongs
        // „blühen" nach dem Schlag), bis 1,5 s hält und dann bis 2,95 s verklingt.
        // Darüber zieht ein Uhrwerk auf: leise, abwechselnd hohe und tiefere Klicks (Rauschen um
        // 6 bzw. 4,3 kHz, 12 ms), deren Abstand von 0,3 s je Klick um 10 % schrumpft (bis
        // 65 ms) und die dabei lauter werden – die Spannung steigt, je näher der Sprung ist.
        // Und ein dünner Glaston steigt in 2,4 s eine Oktave (A5 → A6) und schwillt dabei an,
        // mit einem leicht verstimmten Oberton, der schimmert.
        // Abgrenzung: 'ring' ist ein kurzer heller Zweiklang mit Schubrauschen (0,45 s), 'gust'
        // ein Fauchen, 'count' ein kurzer Piepton; einen tiefen, langen Gong gibt es sonst nicht.
        // Gemessen (vor dem Mischpult): hörbar bis 2,65 s, stärkste Linie 108 Hz (FFT-Raster
        // 21,5 Hz) über die ganze Dauer, Tonalität 16,4 dB (Glocke 'ring' 17, Lawine 12);
        // Hüllkurve −12 dB beim Schlag, dann schwebend zwischen −22 (0,45 s) und −16 (Blüte,
        // 0,7–1,0 s), −21 bei 1,6 s, ab 2 s −27 (Glaston und Ausklang). Die
        // Klicks (Hochband > 5 kHz) kommen nach 0,36 · 0,63 · 0,87 · 1,09 … 2,63 s: 18 Stück,
        // Abstände 0,27 → 0,065 s, und werden um ≈ 5 dB lauter.
        const f = 110;
        v.noise(900, 180, 0.07, 0.12, { type: 'lowpass', q: 0.8, attack: 0.002 })
          .tone('sine', 72, 52, 0.22, 0.2, { attack: 0.004 })
          // Grundton: Anschlag, Blüte, schwebender Zwilling
          .tone('sine', f, f * 0.985, 1.5, 0.26, { attack: 0.006 })
          .tone('sine', f * 0.997, f * 0.99, 2.95, 0.08, { attack: 0.25, sustain: 0.5 })
          .tone('sine', f + 0.9, (f + 0.9) * 0.99, 2.95, 0.06, { attack: 0.35, sustain: 0.5 })
          // Oktave
          .tone('sine', f * 2, f * 1.98, 1.1, 0.14, { attack: 0.005 })
          .tone('sine', f * 2, f * 1.985, 2.8, 0.045, { attack: 0.25, sustain: 0.45 })
          .tone('sine', f * 2 + 1.3, (f * 2 + 1.3) * 0.985, 2.8, 0.035, { attack: 0.35, sustain: 0.45 })
          // Duodezime (blüht etwas später auf)
          .tone('sine', f * 3, f * 2.98, 2.2, 0.06, { attack: 0.2, sustain: 0.3 })
          // unharmonische Teiltöne des Anschlags
          .tone('sine', f * 2.76, f * 2.74, 1.1, 0.05, { attack: 0.004 })
          .tone('sine', f * 4.17, f * 4.13, 0.75, 0.035, { attack: 0.004 })
          .tone('sine', f * 5.4, f * 5.35, 0.5, 0.025, { attack: 0.004 })
          // Glaston
          .tone('sine', 880, 1760, 2.45, 0.045, { at: 0.25, attack: 1.4, sustain: 0.9, vibHz: 5.5, vibDepth: 0.003 })
          .tone('sine', 1765, 3530, 2.4, 0.012, { at: 0.3, attack: 1.5, sustain: 0.85 });
        let t = 0.3;
        let gap = 0.3;
        for (let i = 0; t < 2.62; i++) {
          const fc = i % 2 === 0 ? 6000 : 4300;
          const vol = 0.045 + 0.05 * Math.min(1, t / 2.4);
          v.noise(fc, fc * 0.85, 0.012, vol, { q: 2.2, at: t, attack: 0.001 });
          gap = Math.max(0.065, gap * 0.9);
          t += gap;
        }
        break;
      }
      case 'rift':
        // Der Sprung: Die Zeit reißt auf wie Glas, das auseinandergezogen wird. Ein breites
        // Rauschband fährt in 0,16 s von 350 Hz bis 9 kHz hinauf (der Riss), mit einem leisen
        // Dreieck, das mitzieht, und endet in einem feinen, hellen Knistern (Hochpass). Dann
        // schimmert es: vier hohe Sinustöne (A6, Cis7, E7, A7 – ein A-Dur-Klang, passend zum
        // Rennstück), je mit einem leicht verstimmten Zwilling, gleiten in 0,95 s eine Oktave
        // hinab und verklingen, darüber ein dünnes Rauschen, das ebenso hinabsinkt (der Nachhall).
        // Darunter ein weicher Tiefton-Stoß (Sinus 110 → 55 Hz und braunes Rauschen, beide mit
        // 30–50 ms Anstieg, also ein Schub und kein Schlag). Abgrenzung: 'meteor', 'bomb' und
        // 'crack' beginnen mit einem harten Schlag und poltern dann tief; 'ring' gleitet hinauf
        // in einen Glanz, 'icicle' klirrt kurz in Splittern abwärts. Hier steigt erst alles in
        // die Höhe und sinkt dann als langer, klingender Schimmer ab – die Welt klappt um.
        // Der Schimmer hält ein Drittel seiner Dauer (sustain), sonst wäre er nach 0,4 s fort.
        // Gemessen (vor dem Mischpult): lautestes 50-ms-Fenster bei 0,2 s (−13 dB), −16 bis
        // 0,45 s, −25 bei 0,55 s, hörbar bis 0,92 s; zwei Drittel der Leistung zwischen 1,5 und
        // 4 kHz, ein Fünftel unter 150 Hz (der Stoß).
        v.noise(350, 9000, 0.16, 0.42, { q: 1.1, attack: 0.025 })
          .tone('triangle', 300, 2400, 0.15, 0.07, { attack: 0.03 })
          .noise(9000, 6000, 0.06, 0.14, { type: 'highpass', at: 0.13, attack: 0.002 })
          .tone('sine', 1760, 880, 1.0, 0.13, { at: 0.14, attack: 0.02, sustain: 0.3, vibHz: 7, vibDepth: 0.005 })
          .tone('sine', 1771, 886, 0.9, 0.08, { at: 0.14, attack: 0.03 })
          .tone('sine', 2217, 1109, 0.85, 0.1, { at: 0.145, attack: 0.02, sustain: 0.3, vibHz: 7.4, vibDepth: 0.005 })
          .tone('sine', 2637, 1319, 0.8, 0.09, { at: 0.15, attack: 0.02, sustain: 0.3, vibHz: 6.6, vibDepth: 0.005 })
          .tone('sine', 2652, 1326, 0.75, 0.06, { at: 0.15, attack: 0.03 })
          .tone('sine', 3520, 1760, 0.7, 0.05, { at: 0.155, attack: 0.02 })
          .noise(7000, 2200, 0.95, 0.1, { q: 0.9, attack: 0.05, at: 0.14 })
          .tone('sine', 110, 55, 0.45, 0.32, { at: 0.1, attack: 0.03 })
          .noise(260, 90, 0.4, 0.18, { type: 'lowpass', brown: true, attack: 0.05, at: 0.1 });
        break;
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
      // --- Wüstenexpress ---
      case 'whistle': {
        // Die Lok pfeift (ortsfest an der Lok, je Zug alle 11 s, bis ~220 m zu hören; ~1,1 s).
        // Eine Dampfpfeife als Zweiklang in kleiner Terz, die zwei Töne gegeneinander leicht
        // verstimmt (Verhältnis 1,19 statt 1,189) und mit eigenem, langsamem Vibrato (5,3 und
        // 6,1 Hz, ±0,4 %), damit sie schweben. Die Tonhöhen liegen absichtlich etwa einen
        // Viertelton neben den Tönen von A-mixolydisch (dem Rennstück der Strecke) – wie eine
        // echte Pfeife, die nicht nach der Musik gestimmt ist; so verdeckt die Musik sie nicht.
        // Ablauf: Anblasen (0–0,15 s) – ein Hauch breites Rauschen, enge Rauschbänder gleiten von
        // einer kleinen Terz darunter in den Ton; dann steht der Ton (Sinus und leises Dreieck mit
        // Halten, darum herum enges Rauschen mit Güte 7, gestaffelt in drei Schichten zu 0,3 s,
        // weil eine Rauschschicht kein Halten kennt), und viel Luft: ein breites Band um 2,3 kHz
        // und feines Zischen über 5 kHz. Ab 0,7 s fällt die Tonhöhe um gut drei Halbtöne, ab 0,85 s
        // reißt der Ton ab, und der Dampf zischt kurz nach. Drei Fassungen reihum (Tonhöhen),
        // denn die vier Züge pfeifen nacheinander. Abgrenzung: 'honk' sind zwei kurze, kantige
        // Stöße aus Pulswellen (große Terz F/A, 0,36 s) ohne Rauschen; die Pfeife ist lang,
        // rund, hauchig, eine Oktave höher und gleitet am Ende hinab.
        // Gemessen (vor dem Mischpult): −19,4 bis −19,6 LUFS (Hupe −20,7), Spitze 0,36–0,4,
        // nach 0,15 s voll, ±1 dB bis 0,85 s, Dauer 1,1 s; Anteil über 2 kHz 12–13 % (Luft),
        // Tonalität 16–17 dB (Hupe 14,5, Böe 6). Im Spiel-Mix (Motor und Rennstück) aus 0 m
        // (Faktor 0,55) liegen die beiden Töne in ±1 %-Bändern 21/24 dB über Motor und Musik
        // (Hupe 18/24 dB); fern (Faktor 0,2 · 0,55 = 0,11) noch 8/10 dB darüber – ein leiser,
        // aber erkennbarer Ton.
        const k = this.whistleTick++ % 3;
        const [f1, f2] = WHISTLE_HZ[k];
        // Anblasen: ein Hauch breites Rauschen, die engen Bänder gleiten in den Ton hinein.
        v.noise(900, 2600, 0.16, 0.22, { q: 0.8, attack: 0.025 })
          .noise(f1 * 0.86, f1, 0.14, 0.3, { q: 10, attack: 0.05 })
          .noise(f2 * 0.86, f2, 0.14, 0.24, { q: 10, attack: 0.05 });
        // Die zwei Pfeifentöne: Sinus und leises Dreieck, halten und fallen am Ende.
        for (const [f, g, vib] of [[f1, 1, 5.3], [f2, 0.8, 6.1]] as const) {
          v.tone('sine', f, f * 0.79, 1.0, 0.07 * g, { at: 0.05, attack: 0.08, hold: 0.66, sustain: 0.8, vibHz: vib, vibDepth: 0.004 })
            .tone('triangle', f, f * 0.79, 1.0, 0.035 * g, { at: 0.05, attack: 0.1, hold: 0.66, sustain: 0.78, vibHz: vib, vibDepth: 0.004 });
          for (let i = 0; i < 3; i++) {
            const last = i === 2;
            v.noise(f, last ? f * 0.8 : f * 0.995, last ? 0.42 : 0.55, 0.32 * g, { q: 7, attack: last ? 0.08 : 0.2, at: 0.06 + i * 0.3 });
          }
        }
        // Luft im Ton: breites Band um 2,3 kHz und feines Zischen, ebenfalls gestaffelt.
        for (let i = 0; i < 3; i++) {
          v.noise(2100, 2500, 0.55, 0.3, { q: 0.9, attack: 0.2, at: 0.05 + i * 0.3 })
            .noise(5200, 6200, 0.5, 0.05, { type: 'highpass', attack: 0.2, at: 0.08 + i * 0.3 });
        }
        // Abreißen: der Dampf zischt kurz nach.
        v.noise(3600, 1700, 0.2, 0.1, { q: 0.9, attack: 0.02, at: 0.92 });
        break;
      }
      case 'trainpass': {
        // Ein Zug rollt dicht am eigenen Kart vorbei (ortsfest am nächsten Wagen, etwa alle
        // 0,45 s erneut: raceScene alle 27 Ticks). Jeder Aufruf ist ein Stück Rollen von ~0,8 s:
        // fünf Schichten braunes Rauschen (Tiefpass 170–290 Hz) um je 0,09 s versetzt und drei
        // breite Bänder um 0,45–0,9 kHz (das Dröhnen von Eisen auf Eisen) um je 0,15 s versetzt –
        // fünfmal 0,09 und dreimal 0,15 ergeben genau den Aufrufabstand, so liegen auch über die
        // Aufrufe hinweg die Gipfel gleichmäßig, und die Folge verschmilzt. Tonhöhen der Schichten
        // je Aufruf zufällig: das Rollen wandert, ohne zu pumpen. Darin der Schienenstoß „ta-tack“:
        // ein Doppelschlag (Achsabstand 0,10–0,15 s, der zweite lauter) an zufälliger Stelle des
        // Aufrufs – kurzer, tiefer Stoß, ein enges Klirrband (1,5–2,4 kHz) und zwei unharmonische
        // Dreieckstöne als Stahlklang. Der Stoß ist bewusst leicht im Vergleich zum Rollen (sonst
        // hört man das 0,45-s-Raster als Löcher dazwischen); bei jedem vierten Aufruf etwa singt
        // kurz ein Spurkranz (enges Rauschen um 3–3,8 kHz).
        // Gemessen, 10 Aufrufe zu 0,45 s mit Faktor 0,5 (dicht neben dem Zug: 0,55 · (1 − 4/42)),
        // gemittelt über 12 Durchläufe: Welligkeit 3,1 dB, tiefster Wert 1,3 dB unter dem Median,
        // keine periodischen Einbrüche über 3 dB (mit ±17 ms Zittern ebenso: 1,4 dB); 40 Aufrufe:
        // Anfang und Ende gleich laut (±0,1 dB), nichts schaukelt sich auf. Pegel −35,3 LUFS
        // (Stromschnellen −35,5); 65–70 % der Leistung unter 150 Hz, Schwerpunkt ≈ 0,2 kHz.
        const r = Math.random;
        const lo = 170 + 60 * r();
        for (let i = 0; i < 5; i++) v.noise(lo + 15 * i, lo * 0.75, 0.62, 0.2, { type: 'lowpass', brown: true, attack: 0.2, at: i * 0.09 });
        const mid = 520 + 260 * r();
        for (let i = 0; i < 3; i++) v.noise(mid * (0.85 + 0.3 * r()), mid * (0.85 + 0.3 * r()), 0.5, 0.13, { q: 1, attack: 0.18, at: 0.03 + i * 0.15 });
        const t0 = 0.03 + 0.24 * r();
        const gap = 0.1 + 0.05 * r();
        for (let j = 0; j < 2; j++) {
          const at = t0 + j * gap;
          const s = (j === 0 ? 0.75 : 1) * (0.85 + 0.15 * r());
          const fm = 1500 + 900 * r();
          v.tone('sine', 105, 48, 0.08, 0.2 * s, { at })
            .noise(600, 150, 0.07, 0.18 * s, { type: 'lowpass', brown: true, at })
            .noise(fm, fm * 0.8, 0.035, 0.22 * s, { q: 2.5, at, attack: 0.002 })
            .tone('triangle', 1180 + 120 * j, 1170 + 120 * j, 0.07, 0.06 * s, { at, attack: 0.002 })
            .tone('triangle', 2730 + 200 * j, 2710 + 200 * j, 0.05, 0.03 * s, { at, attack: 0.002 });
        }
        if (r() < 0.25) {
          const fs = 3000 + 800 * r();
          v.noise(fs, fs * 1.04, 0.4, 0.04, { q: 25, attack: 0.15, at: 0.05 });
        }
        break;
      }
      case 'rattle': {
        // Das eigene Kart fährt über die Wagendächer (etwa alle 0,3 s erneut). Man ist jetzt AUF
        // dem Zug: heller, näher, hohler als 'trainpass'. Der Körper sind zwei Resonanzen des
        // hohlen Wagenkastens (enge Rauschbänder, Güte 3, um 380–460 Hz und 0,9–1,1 kHz, je Aufruf
        // zufällig gestimmt), viermal um 0,075 s versetzt (= 0,3 s); darunter nur leise das Rollen
        // des Zugs (braunes Rauschen um 200 Hz). Das Rattern sind fünf bis acht kurze Klopfer der
        // Räder auf Bohlen und Blech in unregelmäßigen Abständen (35–65 ms), jeder ein kurzes
        // Rauschband (0,6–1,3 kHz) mit einem hölzernen Dreieckston eine Oktave tiefer, etwa jeder
        // dritte mit einem blechernen Klirren (2,3–3,2 kHz und ein unharmonischer Teilton ×1,47);
        // ab und zu ein dumpfer Stoß von unten. Die Klopfer reichen bis knapp in den nächsten
        // Aufruf, damit am Ende jedes Aufrufs kein Loch entsteht (vorher −4,7 dB).
        // Gemessen, 14 Aufrufe zu 0,3 s (gemittelt über 12 Durchläufe): Welligkeit 3,2 dB,
        // tiefster Wert 1,5 dB unter dem Median (mit ±17 ms Zittern ebenso); 40 Aufrufe: kein
        // Aufschaukeln (±0,1 dB). Pegel −34,1 LUFS (Sturm −33,9); Schwerpunkt 0,7–0,8 kHz
        // (Rollen am Zug 0,2 kHz), unter 150 Hz nur 17–24 % (Rollen 65–70 %).
        const r = Math.random;
        const h1 = 380 + 80 * r();
        const h2 = 900 + 200 * r();
        for (let i = 0; i < 4; i++) {
          v.noise(h1, h1 * 0.95, 0.42, 0.12, { q: 3, attack: 0.14, at: i * 0.075 })
            .noise(h2, h2 * 1.05, 0.42, 0.08, { q: 3, attack: 0.14, at: i * 0.075 + 0.03 });
        }
        for (let i = 0; i < 3; i++) v.noise(210, 160, 0.45, 0.035, { type: 'lowpass', brown: true, attack: 0.15, at: i * 0.1 });
        let t = 0.005 + 0.04 * r();
        const n = 5 + Math.floor(r() * 4);
        for (let i = 0; i < n && t < 0.33; i++) {
          const f = 600 + 700 * r();
          const s = 0.6 + 0.4 * r();
          v.noise(f, f * 0.8, 0.03, 0.3 * s, { q: 3.5, at: t, attack: 0.002 }).tone('triangle', f * 0.5, f * 0.48, 0.04, 0.08 * s, { at: t, attack: 0.002 });
          if (r() < 0.3) {
            const m = 2300 + 900 * r();
            v.tone('triangle', m, m * 0.99, 0.05, 0.04, { at: t, attack: 0.001 }).tone('sine', m * 1.47, m * 1.46, 0.04, 0.02, { at: t, attack: 0.001 });
          }
          t += 0.035 + 0.03 * r();
        }
        if (r() < 0.4) v.tone('sine', 130, 70, 0.07, 0.08, { at: 0.1 + 0.15 * r() });
        break;
      }
      case 'board': {
        // Ein Kart rollt über die Rampe aufs Wagendach (am Kart; das eigene laut, fremde leiser),
        // ~0,5 s. Erst das Scheppern beim Auffahren: ein breiter Klirrschlag, Zischen und drei
        // unharmonische Teiltöne eines Blechs (×1, ×2,32, ×4,25 über 380–445 Hz), die gut
        // 0,2 s nachklingen, mit einem tiefen Stoß. Dann poltern die Räder über die Blechkante:
        // drei dumpfe, leiser werdende Schläge (tiefer Sinus, braunes Rauschen, ein kurzes
        // Klappern). Zuletzt ein kurzer heller Akzent – zwei Dreieckstöne, eine Quarte aufwärts
        // (E6 → A6), mit leisem Glanz: „geschafft, ich bin oben“. Drei Fassungen reihum
        // (Blechton, Zeitpunkte). Abgrenzung: 'land'/'raft' sind ein einzelner dumpfer Schlag
        // (0,15 s), 'press' ein schwerer Schlag mit Zischen davor.
        // Gemessen (vor dem Mischpult): −20,3 bis −20,9 LUFS (Landung −18,1, Floß −27,1),
        // Spitze 0,9–1,2 (Landung 1,3); im Spiel-Mix trägt es −25,8 LUFS bei (Landung −27,4,
        // Floß −32,9).
        const k = this.boardTick++ % 3;
        const p = BOARD_PATTERN[k];
        const f = p[0];
        v.noise(2600, 1200, 0.07, 0.5, { q: 1.2, attack: 0.002 })
          .noise(5200, 3400, 0.05, 0.15, { type: 'highpass', attack: 0.002 })
          .tone('triangle', f, f * 0.985, 0.3, 0.22, { attack: 0.002 })
          .tone('triangle', f * 2.32, f * 2.3, 0.22, 0.14, { attack: 0.002 })
          .tone('sine', f * 4.25, f * 4.2, 0.16, 0.07, { attack: 0.002 })
          .tone('sine', 140, 60, 0.12, 0.3);
        for (let i = 1; i < 4; i++) {
          const at = p[i];
          const s = 1 - 0.15 * (i - 1);
          v.tone('sine', 115, 50, 0.09, 0.32 * s, { at })
            .noise(450, 140, 0.08, 0.3 * s, { type: 'lowpass', brown: true, at })
            .noise(1600, 1200, 0.025, 0.12 * s, { q: 3, at, attack: 0.002 });
        }
        const a = p[4];
        v.tone('triangle', 1319, 1316, 0.06, 0.1, { at: a, attack: 0.003 })
          .tone('triangle', 1760, 1755, 0.16, 0.11, { at: a + 0.055, attack: 0.003 })
          .tone('sine', 1760 * 2.76, 1760 * 2.75, 0.08, 0.025, { at: a + 0.055, attack: 0.002 });
        break;
      }
      // --- Spiegelkabinett ---
      case 'portal':
        // Durch einen Spiegel, der vorwärts führt (am Kart, ~0,6 s): erst der Sog (glasSog) –
        // man taucht ins Glas, ohne dass es bricht –, dann geht ein gläserner Zweiklang aufwärts
        // auf: E6, dann Cis7 (große Sexte), jeder mit einem kleinen Schleifer von unten in den
        // Ton und den Teiltönen eines Glases; der untere klingt eher aus als der obere, zuletzt
        // ein Hauch Glanz ganz oben – so wandert der Klang nach oben, freundlich und offen.
        // Abgrenzung: 'ring' ist ein Gleitton in einen Quint-Zweiklang (G6 + D7) mit Vibrato und
        // breitem Schubrauschen, 'pickup' zwei Dreieckstöne im Quartsprung, 'boost' Rauschen mit
        // Sägezahn und tiefem Schlag; hier: Sinus mit unharmonischen Glas-Teiltönen, ohne
        // Vibrato, große Sexte, und das Rauschen zieht sich zusammen, statt aufzufahren.
        glasSog(v);
        glasTon(v, 1318.5 * 0.985, 1318.5, 0.16, 0.34, 0.22, 0.12);
        glasTon(v, 2217.5 * 0.985, 2217.5, 0.23, 0.42, 0.2, 0.12);
        v.noise(6500, 9500, 0.32, 0.03, { type: 'highpass', attack: 0.12, at: 0.26 });
        break;
      case 'mirror':
        // Durch einen Spiegel, der zurückwirft (am Kart, ~0,7 s): derselbe Sog, dann kippt es –
        // der Zweiklang ist gespiegelt (erst der obere Ton, dann der untere), und beide rutschen
        // nach kurzem Halten um eine kleine Terz abwärts (Cis7 → Ais6, E6 → Cis6). Dabei läuft
        // je eine zweite Stimme los, die immer weiter danebenliegt: Die Schwebung wird schneller
        // (am Ende ≈ 10–14 Hz), der Klang „verstimmt sich". Zum Schluss ein weicher, dumpfer
        // Plopp (Sinus 200 → 70 Hz mit etwas braunem Rauschen, kein harter Anschlag) – eindeutig
        // „falsch", aber nicht schrill. Abgrenzung: 'stall' stottert mit Sägezähnen im Bass,
        // 'fall' heult in einem großen Bogen abwärts; hier gläsern, kurz, mit Schwebung.
        glasSog(v);
        glasTon(v, 2217.5, 1864.7, 0.16, 0.4, 0.13, 0.3, 0.007);
        glasTon(v, 1318.5, 1108.7, 0.23, 0.42, 0.14, 0.3, 0.012);
        v.tone('sine', 200, 70, 0.13, 0.3, { at: 0.56, attack: 0.012 }).noise(520, 160, 0.1, 0.16, { type: 'lowpass', brown: true, at: 0.56, attack: 0.01 });
        break;
      case 'shimmer': {
        // In einem Rahmen erscheint oder verschwindet ein Spiegel (ortsfest, ~0,5 s): ein
        // leises, kristallenes Aufglitzern – fünf bis sieben sehr kurze, hohe Glastöne aus dem
        // E-lydischen Vorrat des Rennstücks (2,6–5 kHz), in zufälligen Abständen von 45–85 ms,
        // erst lauter werdend, dann verklingend, über einem Hauch hohen Rauschens. Der Zufall
        // (Tonhöhe, Abstand, Länge) ist Absicht: An den Zwillingsspiegeln melden sich zwei
        // Rahmen 9 m nebeneinander im selben Augenblick; ihre Töne fallen nie zusammen, also
        // verdoppeln sie sich nicht und schaukeln sich nicht auf, es glitzert nur dichter.
        // Abgrenzung: 'icicle' knackt hart und klirrt abwärts, 'warn' ist ein Zweiklang im festen Takt.
        const r = Math.random;
        v.noise(7500, 10000, 0.46, 0.012, { type: 'highpass', attack: 0.2 });
        let t = 0.005 + 0.03 * r();
        for (let i = 0; i < 7 && t < 0.36; i++) {
          const f = SCHIMMER_HZ[Math.floor(r() * SCHIMMER_HZ.length)];
          const swell = i < 2 ? 0.6 + 0.2 * i : 1 - 0.1 * (i - 2);
          v.tone('sine', f, f * 1.003, 0.045 + 0.04 * r(), (0.07 + 0.025 * r()) * swell, { at: t, attack: 0.003 })
            .tone('sine', f * 2.32, f * 2.32, 0.03, 0.012 * swell, { at: t, attack: 0.002 });
          t += 0.045 + 0.04 * r();
        }
        break;
      }
      // --- Dschungel-Fluss ---
      case 'raft': {
        // Das Kart rollt auf ein (anderes) Floß: ein hohles, hölzernes „Tock-rumpel" (~0,32 s).
        // Drei Holzschläge – Vorderräder, Hinterräder, ein leiseres Nachrumpeln, 65–85 ms
        // auseinander –, jeder aus dem Ton des hohlen Stamms (Sinus, der in 0,12 s um gut
        // eine Quarte nach unten sackt, 160–260 Hz), einem leisen, unharmonischen Holz-Oberton
        // (Dreieck ×2,4), einem kurzen, breiten Anschlag („Tock", Band um 1,8 → 0,9 kHz) und
        // braunem Rauschen als Bauch. Darunter der Resonanzkörper des ganzen Floßes (Sinus
        // 88 → 56 Hz) und ab 80 ms ein kleiner Wasserschwapp (breites Band 1,1 → 0,4 kHz und
        // tiefes Rauschen, weich einsetzend). Weil es bei jedem Wechsel der Bahn klingt, reihum
        // drei Fassungen mit anderem Stammton (182/205/232 Hz), anderen Abständen und anderer
        // Tonfolge der Schläge (tief-hoch, hoch-tief …). Abgrenzung: 'land' ist ein einzelner,
        // tiefer Plumps (98 % unter 200 Hz), 'bump' ein kurzer Stoß; hier tragen die Schläge
        // um 150–300 Hz (70 % zwischen 150 und 500 Hz). Gemessen (vor dem Mischpult): −20,0 bis
        // −20,2 LUFS (Landung −18,1; 'land' liegt aber fast ganz unter 100 Hz, wo die
        // Lautheitsbewertung wenig zählt), Spitze 0,85–1,0, Dauer 0,31–0,32 s; im Spiel-Mix
        // trägt es −26,4 LUFS bei (Landung −29,1) – oft gespielt, darum nicht lauter.
        const k = this.raftTick++ % 3;
        const p = RAFT_PATTERN[k];
        const f = p[0];
        for (let i = 1; i < p.length; i += 2) {
          const at = p[i];
          const fh = f * p[i + 1];
          const a = [1, 0.8, 0.5][(i - 1) >> 1];
          v.tone('sine', fh * 1.3, fh, 0.12, 0.32 * a, { at, attack: 0.0015 })
            .tone('triangle', fh * 2.45, fh * 2.35, 0.06, 0.1 * a, { at, attack: 0.001 })
            .noise(1800, 900, 0.03, 0.36 * a, { q: 1.8, at, attack: 0.001 })
            .noise(320, 130, 0.09, 0.3 * a, { type: 'lowpass', brown: true, at, attack: 0.003 });
        }
        v.tone('sine', 88, 56, 0.22, 0.18, { attack: 0.004 })
          .noise(1100, 420, 0.26, 0.1, { q: 0.9, attack: 0.05, at: 0.08 })
          .noise(480, 220, 0.25, 0.1, { type: 'lowpass', brown: true, attack: 0.05, at: 0.1 });
        break;
      }
      case 'rapids': {
        // Das eigene Kart fährt auf dem Fluss: Bugwelle und Strömung am Floß, etwa alle 0,35 s
        // aufgerufen (raceScene: riverWait, je nach Bildrate 0,35–0,37 s). Ein Bett, kein
        // Hauptdarsteller – gebaut wie 'storm': fünf Schichten braunes Rauschen (Wassermasse,
        // Tiefpass 300–520 Hz) um je 0,075 s versetzt, mit 0,17 s Anstieg, so dass auch über die
        // Aufrufe hinweg alle 0,075 s ein neuer Gipfel anliegt; darüber drei breite Bänder um
        // 0,6–1,6 kHz (das Rauschen der Strömung) im Abstand von 0,125 s und ein leises
        // Hochpass-Zischen (Gischt). Alle Mitten liegen bei jedem Aufruf zufällig etwas anders:
        // das Wasser „wandert", ohne im Takt zu pumpen. Lebendig machen es zufällig verteilte
        // Ereignisse ohne festes Raster: null bis drei Blasen (Sinus-Zirper, die nach oben
        // springen, 280–900 Hz, je kleiner desto kürzer) als Gluckern und null bis zwei kurze
        // Rauschtropfen (1,2–2,8 kHz) als Plätschern. Abgrenzung: 'splash' (Furt, Riff) ist
        // heller (Bänder um 0,9–1,5 kHz) mit festem Platscher je Aufruf; 'storm' ist Wind mit
        // Knattern, 'falls' das tiefe Tosen.
        // Gemessen, 12 Aufrufe (systematische Welligkeit über 8–12 Durchläufe gemittelt, 50 ms):
        // 2,1–3,0 dB bei 0,35 s, 2,3 dB bei 0,367 s, 2,5 dB bei 0,358 s ± 12 ms Zittern; tiefster
        // Einbruch gegen die Nachbarn höchstens 1,9 dB; letztes gegen erstes Drittel ±0,3 dB
        // (nichts schaukelt sich auf). Pegel der Folge −33,8 bis −34,4 LUFS ('storm' −34,3 bis
        // −34,7); im Spiel-Mix trägt sie −36,4 LUFS bei ('storm' −37,2). Gluckern und
        // Plätschern heben die 500-Hz-Oktave um 4 dB und die Folge um knapp 1 LU. Nach dem
        // letzten Aufruf hält es noch ~0,35 s und fällt dann in 0,2 s um 40 dB.
        const r = Math.random;
        const lo = 300 + 120 * r();
        const mid = 750 + 450 * r();
        for (let i = 0; i < 5; i++) v.noise(lo + 25 * i, lo * 0.75, 0.37, 0.07, { type: 'lowpass', brown: true, attack: 0.17, at: i * 0.075 });
        for (let i = 0; i < 3; i++) v.noise(mid * (0.8 + 0.4 * r()), mid * (0.8 + 0.4 * r()), 0.42, 0.05, { q: 0.55, attack: 0.2, at: 0.02 + i * 0.125 });
        v.noise(3500 + 1500 * r(), 4500 + 1500 * r(), 0.6, 0.02, { type: 'highpass', attack: 0.28 });
        // Gluckern: Blasen, zufällig verteilt
        const nb = Math.floor(r() * 3.2);
        for (let i = 0; i < nb; i++) {
          const fb = 280 + 620 * r();
          v.tone('sine', fb, fb * 1.6, 0.03 + 0.03 * (400 / fb), 0.05 + 0.03 * r(), { at: 0.02 + 0.32 * r(), attack: 0.004 });
        }
        // Plätschern: kurze Rauschtropfen
        const ns = Math.floor(r() * 2.6);
        for (let i = 0; i < ns; i++) {
          const fs = 1200 + 1600 * r();
          v.noise(fs, fs * 0.6, 0.05, 0.08 + 0.05 * r(), { q: 1.4, at: 0.02 + 0.32 * r(), attack: 0.004 });
        }
        break;
      }
      case 'falls': {
        // Das Tosen des Wasserfalls, ortsfest an der Kante (raceScene: alle 30 Ticks = 0,5 s,
        // Reichweite 170 m, aus der Ferne leiser). Die Aufrufe verschmelzen zu einem
        // gleichmäßigen, breitbandigen, tiefen Donnern: fünf Schichten braunes Rauschen unter
        // 150–210 Hz (die fallende Wassermasse) um je 0,1 s versetzt, mit 0,24 s Anstieg; weil
        // kleine Lautsprecher dort wenig wiedergeben, tragen drei hellere Schichten (Tiefpass
        // 420–580 Hz) im Abstand von 0,167 s den Körper; darüber drei breite Bänder um
        // 0,7–1,6 kHz (das Rauschen) und ein Hochpass-Zischen (Gischt). Mitten zufällig je Aufruf.
        // Kein Ton, kein Knall: aus der Nähe mächtig, aus der Ferne (geringer Pegel) bleibt
        // gegen Motor und Musik nur das hohe Rauschen übrig.
        // Gemessen, 12 Aufrufe (gemittelt über 8–12 Durchläufe, 50 ms): Welligkeit 2,6–2,8 dB bei
        // 0,5 s (3,3 dB bei ±17 ms Zittern), tiefster Einbruch gegen die Nachbarn 1,7–1,8 dB,
        // letztes gegen erstes Drittel ±0,15 dB. Pegel der Folge −12,4 bis −12,7 LUFS (Lawine
        // −11,9 bis −12,3), 70 % der Leistung unter 150 Hz. Im Spiel-Mix aus 0 m (Faktor 0,55)
        // trägt sie in 100 ms −20,6 LUFS bei (Lawine −20,5) und hebt die Oktaven 125 Hz /
        // 4 kHz / 8 kHz um 2 / 3,8 / 13 dB; bei Faktor 0,2 nur noch −27,1 LUFS (8 kHz +6,5 dB,
        // sonst ≤ 1 dB), bei 0,11 −31,7 LUFS (8 kHz +3,3 dB) – nur noch ein Rauschen. Nach dem
        // letzten Aufruf hält es ~0,6 s und fällt dann in 0,2 s um 30 dB.
        const r = Math.random;
        for (let i = 0; i < 5; i++) v.noise(150 + 60 * r(), 110, 0.55, 0.16, { type: 'lowpass', brown: true, attack: 0.24, at: i * 0.1 });
        for (let i = 0; i < 3; i++) v.noise(420 + 160 * r(), 300, 0.6, 0.13, { type: 'lowpass', brown: true, attack: 0.26, at: 0.05 + i * 0.167 });
        for (let i = 0; i < 3; i++) {
          const fm = 700 + 900 * r();
          v.noise(fm, fm * (0.8 + 0.4 * r()), 0.6, 0.06, { q: 0.5, attack: 0.26, at: 0.03 + i * 0.167 });
        }
        v.noise(2600 + 1000 * r(), 4500 + 1000 * r(), 0.75, 0.025, { type: 'highpass', attack: 0.35 });
        break;
      }
      // --- Gewitterkamm ---
      case 'thunder': {
        // Blitzeinschlag auf der Bahn (ortsfest, Reichweite 420 m, alle paar Sekunden irgendwo), ~1,5 s. Erst der
        // Knall: fünf sehr kurze, breite Stöße (Hochpass ab 5–6 kHz und ein breites Band um 1,5–4 kHz) binnen 0,1 s
        // – das trockene Peitschen des Kanals; dann ohne Pause das Krachen (breites Band, das von 2,4 kHz auf
        // 300 Hz fällt) und das Rollen: braunes Rauschen in Bändern um 160 und 120 Hz (nicht nur tief gefiltert –
        // dessen Energie läge sonst unter 60 Hz, wo Motor, Bassdrum und kleine Lautsprecher sie verschlucken), ein
        // schlingernder Sinus um 60 Hz und acht polternde Brocken, die erst dicht und heller, dann seltener und
        // dunkler folgen (drei Fassungen, zufällig gewählt). Abgrenzung: 'meteor' heult erst und schlägt dann
        // dumpf ein, 'bomb' ist ein satter Schlag mit Zischen danach – beide beginnen tief, der Donner hell.
        // Gemessen (vor dem Mischpult, drei Fassungen): Gipfel bei 0,1 s, −20 dB nach 0,95–1,0 s, −40 dB nach
        // 1,35–1,45 s, Dauer 1,5 s; 76–79 % der Energie unter 150 Hz (83–85 % unter 200 Hz), in den ersten 60 ms
        // 23–27 % über 2 kHz (danach 2–3 %); −7,5 bis −8,4 LUFS, Spitze 2,9–3,2 (im Spiel ×0,55, Ausgang ≤ 0,53).
        // Aus der Ferne (Faktor 0,25) liegt er im Spiel-Mix 10 LU unter Motor und Musik (Beitrag −29 LUFS):
        // tiefer zu hören wäre er nur, wenn er auch aus der Nähe weit lauter wäre – der Kompressor des Mischpults
        // drückt bei großen Tiefen zudem alles andere hinunter.
        const roll = THUNDER_ROLL[Math.floor(Math.random() * 3)];
        // Knall: drei sehr kurze, breite Stöße im Hochband binnen 40 ms – das Peitschen des Kanals.
        v.noise(5000, 2500, 0.04, 0.8, { type: 'highpass', attack: 0.001 })
          .noise(4000, 1500, 0.07, 0.8, { q: 0.5, attack: 0.001 })
          .noise(5500, 2500, 0.025, 0.6, { type: 'highpass', attack: 0.001, at: 0.02 })
          .noise(6000, 2500, 0.03, 0.5, { type: 'highpass', attack: 0.001, at: 0.045 })
          .noise(5000, 2000, 0.03, 0.35, { type: 'highpass', attack: 0.001, at: 0.075 })
          // Druckstoß und Krachen: ein tiefer Sinus und ein breites Band, das von 2,4 kHz hinabfällt.
          .tone('sine', 90, 38, 0.6, 0.4, { attack: 0.01, at: 0.03 })
          .noise(2400, 300, 0.7, 0.5, { q: 0.5, attack: 0.015, at: 0.03 })
          // Rollen: drei lange Schichten braunes Rauschen, gestaffelt, immer tiefer; ein schlingernder Sinus.
          .noise(700, 120, 1.1, 0.5, { type: 'lowpass', brown: true, attack: 0.05, at: 0.04 })
          .noise(160, 80, 1.3, 0.9, { q: 0.7, brown: true, attack: 0.06, at: 0.03 })
          .noise(120, 65, 1.4, 0.7, { q: 0.8, brown: true, attack: 0.2, at: 0.25 })
          .tone('sine', 62, 34, 1.4, 0.14, { attack: 0.2, sustain: 0.4, vibHz: 5.5, vibDepth: 0.1, at: 0.2 });
        for (let i = 0; i < roll.length; i += 2) {
          const f = roll[i + 1];
          v.noise(f * 1.4, f * 0.6, 0.28, 0.38 - 0.02 * i, { type: 'lowpass', q: 1.2, brown: true, at: roll[i], attack: 0.02 });
        }
        break;
      }
      case 'rod': {
        // Blitz in den Ableiter (ortsfest, Reichweite 420 m), ~0,9 s – so lang, wie das Ladefeld steht (54 Ticks).
        // Ein dünner Knall (Hochpass ab 8 kHz, kurzes Band um 2–3 kHz) mit kleinem Körper statt des Rollens; der
        // Mast klingt nach (drei unharmonische Teiltöne, 590/1180/3245 Hz, wie ein angeschlagenes Stahlrohr); die
        // Hochspannung surrt (Sägezahn 260 → 130 Hz mit 47-Hz-Flattern, hält gut die Hälfte und sinkt dann) unter
        // einem fallenden Zischen, und es britzelt: elf winzige Funken (12 ms, 5,4 → 1,9 kHz), immer seltener und
        // tiefer. Gemessen: Gipfel beim Knall, −20 dB nach 0,7 s, verklungen nach 0,9 s; Schwerpunkt 0,9–1 kHz
        // (Donner 0,6–0,7 kHz, aber dort fast nur Tiefen), 9–10 % über 2 kHz durchgehend; −16,2 LUFS.
        const sp = ROD_SPARKS[Math.floor(Math.random() * 3)];
        // Dünner Knall, kleiner Körper.
        v.noise(8000, 4500, 0.02, 0.45, { type: 'highpass', attack: 0.001 })
          .noise(3000, 2000, 0.03, 0.25, { q: 1.5, attack: 0.001 })
          .tone('sine', 160, 70, 0.12, 0.25)
          // Der Mast klingt nach: unharmonische Teiltöne eines Stahlrohrs.
          .tone('triangle', 1180, 1170, 0.7, 0.08, { at: 0.005, attack: 0.002 })
          .tone('sine', 3245, 3230, 0.35, 0.03, { at: 0.005, attack: 0.002 })
          .tone('sine', 590, 586, 0.9, 0.05, { at: 0.005, attack: 0.002 })
          // Hochspannung: ein surrender Sägezahn, der absinkt, darüber ein fallendes Zischen.
          .tone('sawtooth', 260, 130, 0.92, 0.06, { at: 0.03, attack: 0.03, sustain: 0.6, vibHz: 47, vibDepth: 0.06 })
          .noise(4200, 1600, 0.9, 0.08, { q: 2, attack: 0.02, at: 0.03 });
        for (let i = 0; i < sp.length; i += 2) {
          const f = sp[i + 1];
          v.noise(f, f * 0.8, 0.012, 0.3 - 0.01 * i, { q: 3, at: sp[i], attack: 0.001 });
        }
        break;
      }
      case 'rumble': {
        // Fernes Grollen nach dem Wetterleuchten (überall gleich laut, etwa alle 5 s), ~2,2 s, ohne Knall: vier
        // Paare braunes Rauschen (Bänder um 85–140 und 190–300 Hz), um je 0,38 s (± 0,06 s zufällig) versetzt und
        // mit 0,6 s Anstieg, das zweite Paar am lautesten – so schwillt es an und ab; darunter ein Sinus um 45 Hz,
        // der mit 3,2 Hz schlingert. Gemessen: Gipfel nach 1 s, die Drittel −23 / −19 / −28 dB, −20 dB nach 2 s;
        // 92–93 % der Energie unter 200 Hz, nichts über 2 kHz; −21,5 bis −21,9 LUFS vor dem Faktor (0,34–0,41).
        const r = Math.random;
        const swell = [0.7, 1, 0.85, 0.6];
        for (let i = 0; i < 4; i++) {
          const at = i * 0.38 + 0.06 * r();
          v.noise(140 - 10 * i, 85, 1.4, 0.5 * swell[i], { q: 0.8, brown: true, attack: 0.6, at })
            .noise(300 - 20 * i, 190, 1.3, 0.3 * swell[i], { q: 0.7, brown: true, attack: 0.55, at: at + 0.08 });
        }
        v.tone('sine', 48, 38, 2.4, 0.12, { attack: 0.7, sustain: 0.5, vibHz: 3.2, vibDepth: 0.12 });
        break;
      }
      case 'charge': {
        // Im Ladefeld aufgeladen (eigenes Kart), ~0,56 s: „Bzzzing". Ein Schub wie 'boost' und 'ring' (ein breites
        // Rauschband fährt von 0,7 auf 4,8 kHz), aber es schwillt an statt zu fallen, und es surrt: Sägezahn und
        // Rechteck steigen zwei Oktaven (180 → 720 Hz) mit 61-Hz-Flattern; dazu knistern acht Funken, immer dichter
        // und höher (1,7 → 4 kHz); am Ende das „-ing": ein heller Sinus gleitet eine Oktave hinauf (1,3 → 2,6 kHz) –
        // ein Gleiten, kein stehender Glockenklang wie beim Ring, kein tiefer Schlag wie beim Boost-Feld.
        // Gemessen: steigt über die Dauer um 5 dB (Drittel −21,7 / −18,1 / −16,4), Gipfel bei 0,4 s; −16,2 LUFS
        // (Boost −14,9 – dessen Energie liegt aber unter 150 Hz, im Spiel-Mix gleich laut, s. LEVEL).
        const sp = CHARGE_SPARKS[Math.floor(Math.random() * 3)];
        v.noise(700, 4800, 0.5, 0.3, { q: 1.1, attack: 0.3 })
          .tone('sawtooth', 180, 720, 0.42, 0.08, { attack: 0.03, sustain: 0.75, vibHz: 61, vibDepth: 0.05 })
          .tone('square', 90, 360, 0.42, 0.04, { attack: 0.03, sustain: 0.75, vibHz: 61, vibDepth: 0.05 })
          .tone('sine', 1320, 2640, 0.22, 0.13, { at: 0.32, attack: 0.01, sustain: 0.5 })
          .tone('triangle', 660, 1320, 0.22, 0.06, { at: 0.32, attack: 0.01, sustain: 0.4 })
          .noise(6000, 9000, 0.2, 0.05, { type: 'highpass', attack: 0.02, at: 0.34 });
        for (let i = 0; i < sp.length; i += 2) {
          const f = sp[i + 1];
          v.noise(f, f * 1.2, 0.015, 0.2 + 0.01 * i, { q: 3, at: sp[i], attack: 0.001 });
        }
        break;
      }
      // --- Vulkaninsel ---
      // Alle vier sind ortsfest (raceScene.emitAt: Pegel 1 − Entfernung/Reichweite, dazu
      // sound.ts × 0,55). Bröckeln und Bruch hört man nur in der Nähe (90 bzw. 140 m), den
      // Einsturz der Brücke und die freie Lavaröhre auf der ganzen Insel (600 m) – meist also
      // leise aus der Ferne; deshalb tragen bei diesen beiden die Mitten (0,3–3 kHz) den Klang.
      case 'crumble': {
        // Eine Platte beginnt zu bröckeln, 2,5 s vor dem Bruch – die Warnung, die man lernen
        // soll. Darum steigt alles über die ganze Dauer: Ein tiefes Grollen (braunes Rauschen
        // um 150 Hz und eine hellere Schicht bis ~480 Hz für kleine Lautsprecher) schwillt in
        // sieben überlappenden Wellen an, je 0,27 s versetzt und jede um den Faktor 1,37 lauter
        // (eine Rauschschicht kennt kein Halten); darunter ein Sinus um 50 Hz, der langsam
        // einschwingt und hält. Im Stein knirscht es: ein enges Band um 1,1–1,7 kHz in fünf
        // Wellen, darüber einzelne trockene Knackser (12–24 ms, 1,25–3,5 kHz), anfangs selten
        // und leise, dann immer dichter (Abstand bis auf gut ein Drittel), lauter und ab der
        // Mitte oft doppelt; manche mit einem dumpfen Klopfen darunter. Vier Brocken fallen
        // herab (dumpfer Schlag, kurzes Klacken), jeder etwas lauter. Es endet nach ~2,3 s,
        // kurz bevor die Platte bricht ('crack'). Abgrenzung zur Lawine: kein Schneerauschen,
        // kein breites Band – hier tragen die einzelnen Knackser und das Grollen.
        // Fassungen reihum (Knackser-Muster, Brocken), denn auf dem Kraterrand und der
        // Hängebrücke bröckelt es mehrmals kurz nacheinander. Gemessen (vor dem Mischpult):
        // Dauer 2,3 s, das letzte Drittel 11–12 dB über dem ersten, lautester Punkt bei 2,0 s,
        // −13,5 bis −14,2 LUFS (Bruch −11,6): es schwillt bis knapp unter den Bruch an.
        const k = this.crumbleTick++ % 3;
        for (let i = 0; i < 7; i++) {
          const at = i * 0.27;
          const g = Math.pow(1.37, i);
          v.noise(150, 110, 0.6, 0.025 * g, { type: 'lowpass', brown: true, attack: 0.3, at })
            .noise(480 - 20 * i, 300, 0.6, 0.06 * g, { type: 'lowpass', brown: true, attack: 0.3, at: at + 0.13 });
        }
        for (let i = 0; i < 5; i++) {
          v.noise(1100 + 80 * i, 1700, 0.6, 0.08 * Math.pow(1.45, i), { q: 1.3, attack: 0.3, at: 0.1 + i * 0.4 });
        }
        v.tone('sine', 48, 56, 2.25, 0.05, { attack: 1.12, sustain: 0.88, vibHz: 5, vibDepth: 0.06 });
        let t = 0.05;
        for (let i = 0; t < 2.2; i++) {
          const grow = t / 2.2;
          const f = CRUMBLE_GRIT_HZ[(i * 5 + k * 4) % CRUMBLE_GRIT_HZ.length];
          const vol = 0.2 + 1.2 * grow * grow;
          v.noise(f, f * 0.7, 0.012 + 0.006 * ((i + k) % 3), vol, { q: 2.2, at: t, attack: 0.0015 });
          if (i % 4 === 1) v.noise(f * 0.32, f * 0.22, 0.03, vol * 0.8, { type: 'lowpass', q: 1.2, brown: true, at: t, attack: 0.002 });
          if (grow > 0.45 && i % 3 === 0) v.noise(f * 1.3, f, 0.01, vol * 0.6, { q: 3, at: t + 0.013, attack: 0.001 });
          t += CRUMBLE_GRIT_GAP[(i + k) % CRUMBLE_GRIT_GAP.length] * (1 - 0.62 * grow);
        }
        const ch = CRUMBLE_CHUNKS[k];
        for (let i = 0; i < ch.length; i += 2) {
          const at = ch[i];
          const f = ch[i + 1];
          const grow = 0.5 + at / 4;
          v.noise(f, f * 0.5, 0.12, 0.3 * grow, { type: 'lowpass', q: 1.5, brown: true, at, attack: 0.004 })
            .tone('sine', f * 0.42, f * 0.25, 0.08, 0.2 * grow, { at })
            .noise(f * 4, f * 3, 0.025, 0.08 * grow, { q: 2.5, at, attack: 0.002 });
        }
        break;
      }
      case 'crack': {
        // Die Platte bricht und stürzt in die Lava (~1,4 s). Erst der Bruch: hart, trocken,
        // breitbandig und kurz – ein Knall aus hohem und mittlerem Rauschen (1 ms Anstieg),
        // ein harter Klick und gut 30 ms später ein zweiter Riss; nur ein kleiner tiefer
        // Schlag, denn hier schlägt nichts ein, es gibt etwas nach. Sofort danach poltern die
        // Schollen: sieben dumpfe Brocken mit Klacken, die immer tiefer und leiser werden,
        // und ein breites Band, das von 1,8 kHz auf 260 Hz hinabsinkt – sie fallen weg.
        // Nach 0,6–0,72 s (je Fassung) kommt aus der Tiefe das Platschen: gedämpftes braunes
        // Rauschen und ein weicher tiefer Sinus (gedämpft: 6 m tiefer, im Glutgraben), ein
        // zäher Gluckser der Lava, eine zweite, kleinere Scholle; dann zischt es (Hochpass und
        // ein Band um 2 kHz), dazwischen knistert es dreimal.
        // Abgrenzung: 'meteor' heult erst und schlägt dann von oben dumpf ein; 'bomb' beginnt
        // mit einem satten tiefen Schlag. Hier steht der helle, trockene Bruch am Anfang, das
        // Tiefe kommt erst spät und gedämpft – etwas fällt nach unten weg. Gemessen: 1,35–1,5 s,
        // −11,5 bis −11,7 LUFS (Meteorit −11,2, Bombe −11,0), Schwerpunkt 2,3–2,5 kHz
        // (Meteorit 0,25, Bombe 0,3 kHz).
        const k = this.crackTick++ % 3;
        const rb = CRACK_RUBBLE[k];
        const p = [0.6, 0.66, 0.72][k];
        v.noise(9000, 4000, 0.025, 0.5, { type: 'highpass', attack: 0.001 })
          .noise(3200, 1400, 0.05, 0.6, { q: 0.8, attack: 0.001 })
          .tone('triangle', 1100, 380, 0.03, 0.25)
          .noise(2600, 1100, 0.04, 0.35, { q: 1, at: 0.032, attack: 0.001 })
          .noise(6000, 3000, 0.02, 0.2, { type: 'highpass', at: 0.034, attack: 0.001 })
          .tone('sine', 120, 55, 0.22, 0.25, { at: 0.01 })
          .noise(420, 150, 0.2, 0.25, { type: 'lowpass', brown: true, at: 0.01 })
          .noise(1800, 260, 0.75, 0.18, { q: 0.7, attack: 0.06, at: 0.05 });
        for (let i = 0; i < rb.length; i += 2) {
          const f = rb[i + 1];
          const vol = 0.5 - 0.04 * i;
          v.noise(f, f * 0.55, 0.12, vol, { type: 'lowpass', q: 1.4, brown: true, at: rb[i], attack: 0.003 })
            .noise(f * 2.6, f * 2, 0.03, vol * 0.35, { q: 2.5, at: rb[i], attack: 0.002 });
        }
        v.noise(600, 140, 0.45, 0.26, { type: 'lowpass', brown: true, attack: 0.012, at: p })
          .tone('sine', 85, 38, 0.35, 0.14, { at: p, attack: 0.01 })
          .tone('sine', 170, 270, 0.09, 0.12, { at: p + 0.05, attack: 0.008 })
          .noise(450, 130, 0.3, 0.15, { type: 'lowpass', brown: true, attack: 0.01, at: p + 0.16 })
          .tone('sine', 75, 40, 0.25, 0.1, { at: p + 0.16, attack: 0.01 })
          .noise(5200, 2800, 0.85, 0.2, { type: 'highpass', attack: 0.07, at: p + 0.03 })
          .noise(2400, 1500, 0.6, 0.06, { q: 1.2, attack: 0.1, at: p + 0.06 });
        for (const d of [0.2, 0.33, 0.5]) v.noise(3800, 3200, 0.02, 0.08, { q: 4, at: p + d, attack: 0.002 });
        break;
      }
      case 'collapse': {
        // Die Hängebrücke stürzt ein (~2,2 s, einmal je Rennen). Holz, nicht Stein: Zuerst
        // ächzt sie (ein leiser, knarrender Sägezahn mit 26-Hz-Flattern und ein enges
        // Reibeband), dann reißen drei Seile – peitschende Schnalzer: ein Knall aus breitem
        // Rauschen und ein Dreieckston, der in 90 ms von 1,7 kHz auf gut 200 Hz stürzt, jeder
        // folgende etwas tiefer. Dazwischen splittert das Holz: ein schweres Brechen des
        // Tragbalkens (bei 0,45 s, mit dumpfem Ruck) und dichte, kurze Splitter (1,3–3,4 kHz,
        // alle 22–50 ms) bis knapp 1 s, dazu drei reißende Fasern. Dann die Kaskade: dreizehn
        // Bohlen fallen klappernd in die Schlucht – hohle Holztöne (Dreieck 450–980 Hz mit
        // einem unharmonischen Teilton ×2,3 und einem Klacken), manche doppelt, wenn eine
        // Bohle auf die andere schlägt; sie werden leiser und dumpfer, ab 1,3 s wirft die
        // Schlucht ein Echo zurück (0,14 s später, ein Drittel so laut), und bei ~1,55 s schlägt
        // das Deck dumpf unten auf. Darunter rumpelt die Holzmasse (braunes Rauschen um 500 Hz).
        // Abgrenzung: Stein ('crack', 'crumble') knackt trocken und hoch; Holz klingt hohl,
        // mit Tonhöhe, und klappert. Gemessen: 2,27 s, ≈ −10,3 LUFS, knapp 60 % der Energie zwischen
        // 0,5 und 1,5 kHz; im Spiel-Mix bei Faktor 0,3 heben die Seile und das Splittern
        // die Oktaven 1/2/4/8 kHz um 1,6/1,1/4,3/10,8 dB über Motor und Musik (die Böe bei
        // gleichem Faktor 1,1/1,9/6,1/17).
        v.tone('sawtooth', 150, 118, 0.3, 0.05, { attack: 0.05, tremHz: 26 }).noise(900, 700, 0.3, 0.06, { q: 6, attack: 0.05 });
        for (let i = 0; i < 3; i++) {
          const s0 = [0.16, 0.34, 0.55][i];
          const d = 1 - 0.12 * i;
          v.noise(4500, 1800, 0.035, 0.45, { q: 1.2, attack: 0.001, at: s0 })
            .tone('triangle', 1700 * d, 220 * d, 0.09, 0.22, { at: s0 })
            .noise(1200 * d, 500 * d, 0.06, 0.2, { q: 2, at: s0 + 0.005 });
        }
        v.noise(2500, 900, 0.07, 0.4, { q: 0.9, at: 0.45, attack: 0.002 })
          .tone('sine', 160, 70, 0.2, 0.25, { at: 0.45 })
          .noise(500, 180, 0.9, 0.18, { type: 'lowpass', brown: true, attack: 0.15, at: 0.4 });
        let t = 0.3;
        for (let i = 0; t < 0.95; i++) {
          const f = SPLINTER_HZ[i % SPLINTER_HZ.length];
          v.noise(f, f * 0.75, 0.015 + 0.005 * (i % 3), 0.2 - 0.12 * (t - 0.3), { q: 3, at: t, attack: 0.001 });
          t += SPLINTER_GAP[i % SPLINTER_GAP.length];
        }
        for (const [at, f] of [[0.38, 520], [0.6, 440], [0.8, 380]]) v.tone('triangle', f, f * 0.65, 0.05, 0.12, { at });
        for (let i = 0; i < COLLAPSE_PLANKS.length; i += 3) {
          const at = COLLAPSE_PLANKS[i];
          const f = COLLAPSE_PLANKS[i + 1];
          const far = (at - 0.72) / 1.3; // 0 … 1: die Bohlen fallen tiefer in die Schlucht
          const vol = 0.4 - 0.22 * far;
          const click = 1 - 0.5 * far;
          v.tone('triangle', f, f * 0.94, 0.07, vol, { at, attack: 0.002 })
            .tone('sine', f * 2.3, f * 2.25, 0.04, vol * 0.4, { at, attack: 0.002 })
            .noise(f * 3 * click + 400, f * 2.3 * click + 300, 0.025, vol * 0.9, { q: 2.5, at, attack: 0.001 });
          if (COLLAPSE_PLANKS[i + 2]) v.tone('triangle', f * 1.15, f * 1.08, 0.05, vol * 0.6, { at: at + 0.035, attack: 0.002 });
          if (at > 1.3) v.tone('triangle', f * 0.98, f * 0.93, 0.07, vol * 0.33, { at: at + 0.14, attack: 0.004 });
        }
        v.noise(350, 120, 0.5, 0.2, { type: 'lowpass', brown: true, attack: 0.01, at: 1.55 }).tone('sine', 70, 40, 0.3, 0.16, { at: 1.55 });
        break;
      }
      case 'drain': {
        // Die Lavaröhre läuft leer und ist frei (~2 s) – die einzige gute Nachricht der vier.
        // Erst gurgelt und schlürft es nach unten weg: ein enges Saugband von 900 auf 220 Hz,
        // braunes Rauschen von 520 auf 120 Hz und ein Sinus, der von 190 auf 50 Hz abzieht;
        // dazu elf zähe Gluckser (kurze Dreieck-Blasen mit einem engen Rauschband als
        // „Schlund" um 0,4–1,5 kHz, jede steigt in sich um eine Quinte, die Folge aber
        // sinkt von 330 auf 120 Hz und wird leiser) und bei 1,3 s ein letzter,
        // großer Schluck. Ab 0,45 s zischt abkühlendes Gestein (Hochpass, langsam
        // einschwingend), fünfmal knistert es. Zum Schluss, bei ~1,5 s, der einladende
        // Akzent: Luft strömt in die leere Röhre (ein Band, das nach oben fährt), ein hohler
        // Röhrenton steigt eine Quarte, und darüber gleitet ein heller Ton eine Quarte hinauf
        // (A5 → E6) und klingt mit leiser Quinte darüber aus – ein einzelner aufsteigender
        // Glanz, keine Notenfolge. Abgrenzung: 'ring' gleitet aus der Tiefe in einen
        // G-D-Zweiklang mit Schubrauschen; hier ist es kürzer, tiefer angesetzt und folgt
        // auf das Gurgeln. Gemessen: 1,96 s, −10,7 LUFS; im Spiel-Mix bei Faktor 0,3 hebt das
        // Zischen die 8-kHz-Oktave um 13,6 dB und der Akzent die 1-kHz-Oktave um 4,5 dB; das
        // tiefe Gurgeln selbst geht dort unter dem Motor fast unter.
        for (let i = 0; i < 4; i++) {
          const at = i * 0.35;
          v.noise(520 - 110 * i, 400 - 85 * i, 0.7, 0.3 - 0.04 * i, { type: 'lowpass', brown: true, attack: 0.3, at });
          if (i < 3) v.noise(1400 - 300 * i, 950 - 300 * i, 0.8, 0.3, { q: 2.5, attack: 0.35, at: at * 1.3 });
        }
        v.tone('sine', 190, 50, 1.4, 0.18, { attack: 0.2, sustain: 0.75 });
        for (let i = 0; i < DRAIN_GLUG.length; i += 2) {
          const f = DRAIN_GLUG[i + 1];
          const vol = 0.26 - 0.012 * i;
          v.tone('triangle', f, f * 1.45, 0.07, vol, { at: DRAIN_GLUG[i], attack: 0.005 })
            .noise(f * 2.2, f * 1.6, 0.05, vol * 0.4, { q: 3, at: DRAIN_GLUG[i], attack: 0.004 })
            .noise(f * 3.6, f * 4.6, 0.06, vol * 0.7, { q: 4, at: DRAIN_GLUG[i] + 0.01, attack: 0.006 });
        }
        v.noise(700, 150, 0.25, 0.25, { q: 1.5, attack: 0.01, at: 1.3 })
          .tone('sine', 260, 80, 0.2, 0.2, { at: 1.3, attack: 0.008 })
          .noise(5500, 3500, 1.2, 0.16, { type: 'highpass', attack: 0.35, at: 0.45 });
        for (const [at, f] of [[0.7, 3600], [0.86, 4600], [1.05, 3100], [1.2, 4200], [1.4, 3400]]) v.noise(f, f * 0.85, 0.018, 0.07, { q: 4, at, attack: 0.002 });
        const a = 1.52;
        v.noise(500, 3200, 0.4, 0.16, { q: 1, attack: 0.18, at: a - 0.1 })
          .tone('sine', 196, 262, 0.35, 0.12, { at: a, attack: 0.03 })
          .tone('sine', 880, 1319, 0.06, 0.12, { at: a, attack: 0.004 })
          .tone('sine', 1319, 1316, 0.45, 0.22, { at: a + 0.05, attack: 0.005, sustain: 0.2, vibHz: 5, vibDepth: 0.003 })
          .tone('triangle', 1976, 1972, 0.3, 0.06, { at: a + 0.06, attack: 0.006 });
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
