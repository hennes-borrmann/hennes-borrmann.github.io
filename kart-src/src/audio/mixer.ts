// Mischpult: Busse, Master-Kette und die Bausteine, die sich alle Klangquellen
// teilen (Rauschpuffer, Pulswellen, Panorama mit Rückfall).
//
//   Musik ──► musicIn ─► duck ─► musicVol ─► Tiefpass (Wasser) ──────────┐
//   Effekte ► sfxIn ───┐                                                 ├─► master ─► Kompressor ─► trim ─► Begrenzer ─► Ausgang
//   Motoren ► engineIn ┴─► sfxVol ─► Tiefpass ─► Tiefpass (Wasser) ──────┘
//                ▲
//   Unterwasser-Bett (nur abgetaucht)
//
// Der Kompressor hält das Gemisch zusammen, wenn Motor, Schub, Musik und
// mehrere Effekte gleichzeitig laufen. Er ist aber kein harter Begrenzer –
// kurze Spitzen rutschen durch. Deshalb sitzt dahinter eine Kennlinie, die bis
// LIMIT_KNEE unverändert durchlässt und darüber weich abflacht: der Ausgang
// kann rechnerisch nie über etwa 0.88 hinaus.
//
// Unter Wasser (setUnderwater) schließen sich die Wasser-Tiefpässe; sie sitzen
// hinter den Lautstärkereglern und vor dem Summenkompressor, damit der die
// dumpfe Mischung verarbeitet und Stummschaltung (master) weiter alles trifft.
// An der Luft sind sie so weit nach oben verstimmt, dass ihre Eckfrequenz über
// der Nyquist-Frequenz liegt: dann rechnen alle Browser (Blink, Gecko und
// WebKit teilen sich diesen Biquad-Code) das Filter als reine Durchleitung
// b0 = 1, Rest 0 – das Signal bleibt Abtastwert für Abtastwert unverändert.

export type Wave = 'sine' | 'square' | 'sawtooth' | 'triangle' | 'pulse25' | 'pulse12';

export const clamp = (x: number, lo: number, hi: number): number => (x < lo ? lo : x > hi ? hi : x);

/** MIDI-Notennummer → Frequenz in Hz (69 = a' = 440 Hz). */
export const mtof = (midi: number): number => 440 * Math.pow(2, (midi - 69) / 12);

/** Länge der Rauschschleifen. Lang genug, dass man die Wiederholung nicht hört. */
const NOISE_SECONDS = 2;

/** Bis hierhin lässt der Begrenzer das Signal unverändert durch. */
const LIMIT_KNEE = 0.7;
/** Breite des weichen Bereichs darüber. Bei Eingang 1.0 (und allem darüber) kommt damit etwa 0.88 heraus. */
const LIMIT_SOFT = 0.26;

/** Unter Wasser: Eckfrequenz für Geräusche und Motoren (zwei Biquads = Butterworth 4. Ordnung, 24 dB/Oktave). */
const UW_SFX_HZ = 850;
/** Güten (dB) der beiden Biquads: zusammen ein Butterworth-Tiefpass 4. Ordnung (Q 0,541 und 1,307). */
const UW_SFX_Q = [-5.33, 2.32];
/** Unter Wasser: Eckfrequenz der Musik – offener (12 dB/Oktave), damit sie erkennbar bleibt. */
const UW_MUSIC_HZ = 1400;
/** Güte (dB) des Musik-Tiefpasses: −3 dB ≈ Butterworth 2. Ordnung, keine Überhöhung. */
const UW_MUSIC_Q = -3.01;
/** So weit (Cent) liegt die offene Eckfrequenz über der Nyquist-Frequenz – Sicherheitsabstand. */
const UW_OPEN_MARGIN = 600;
/**
 * Zeitkonstante des Gleitens (Sekunden). Die Verstimmung läuft in Cent, also
 * gleichmäßig in Oktaven: nach 0,25 s ist der Weg zu 95 % geschafft. Beim
 * Öffnen überschreitet die Eckfrequenz nach etwa 0,2 s die Nyquist-Frequenz –
 * ab da ist das Filter wieder exakt durchlässig.
 */
const UW_GLIDE = 0.083;
/** Pegel des leisen, tiefen Unterwasser-Rauschens (vor dem Effekt-Regler). */
const UW_BED_LEVEL = 0.05;

/**
 * Der DynamicsCompressor hebt sein Ergebnis von sich aus an (je tiefer die
 * Schwelle, desto mehr). Dieser Wert nimmt die Anhebung wieder heraus, damit
 * leise Signale unverändert bleiben. Gemessen in Chromium für die Werte unten;
 * Safari und Firefox benutzen dieselbe Kompressor-Rechnung.
 */
const COMP_TRIM = 0.62;

/** Regler 0..1 → Verstärkung. Quadratisch, damit sich der Regler gleichmäßig anfühlt. */
const taper = (v: number): number => {
  const c = clamp(v, 0, 1);
  return c * c;
};

function limiterCurve(): Float32Array<ArrayBuffer> {
  // Ungerade Länge: die Mitte der Tabelle ist genau 0, Stille bleibt Stille.
  const n = 4097;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    const a = Math.abs(x);
    // Oberhalb des Knies geht es mit Steigung 1 weiter und wird dann immer flacher.
    const y = a <= LIMIT_KNEE ? a : LIMIT_KNEE + LIMIT_SOFT * (1 - Math.exp(-(a - LIMIT_KNEE) / LIMIT_SOFT));
    curve[i] = x < 0 ? -y : y;
  }
  return curve;
}

export class Mixer {
  /** Eingang für die Musik-Decks. */
  readonly musicIn: GainNode;
  /** Eingang für Einmal-Effekte. */
  readonly sfxIn: GainNode;
  /** Eingang für Dauergeräusche (Motoren); hängt am Effekt-Regler. */
  readonly engineIn: GainNode;
  /** Letzter Knoten vor dem Ausgang – zum Messen in Tests. */
  readonly output: AudioNode;
  /** Weißes Rauschen, als Schleife abspielbar. */
  readonly white: AudioBuffer;
  /** Tiefes ("braunes") Rauschen für Rumpeln, nahtlos als Schleife. */
  readonly brown: AudioBuffer;
  /** Zähler für gestartete und beendete Quellen – zum Aufspüren von Lecks. */
  readonly stats = { started: 0, ended: 0 };

  private readonly duckGain: GainNode;
  private readonly musicVol: GainNode;
  private readonly sfxVol: GainNode;
  private readonly master: GainNode;
  /** Wasser-Tiefpässe (Geräusche/Motoren bzw. Musik) samt ihrer offenen Verstimmung in Cent. */
  private readonly uwSfx: BiquadFilterNode[];
  private readonly uwMusic: BiquadFilterNode;
  private readonly uwOpenSfx: number;
  private readonly uwOpenMusic: number;
  /** Zuletzt gesetztes Ziel 0..1 (damit gleiche Aufrufe nichts neu planen). */
  private uwTarget = 0;
  /** Leises Rauschbett unter Wasser; nur solange abgetaucht (bzw. bis es ausgeklungen ist). */
  private uwBed: { src: AudioBufferSourceNode; lfo: OscillatorNode; gain: GainNode; nodes: AudioNode[] } | null = null;
  /** Ausgang des Effekt-/Motor-Zweigs hinter dem Wasserfilter – zum Messen in Tests. */
  readonly sfxBus: AudioNode;
  /** Ausgang des Musikzweigs hinter dem Wasserfilter – zum Messen in Tests. */
  readonly musicBus: AudioNode;
  private readonly pulses = new Map<number, PeriodicWave>();
  private readonly canPan: boolean;
  /** Zeitpunkt (performance.now) der letzten Bitte ums Fortsetzen. */
  private resumeAsked = -1e9;

  /**
   * @param live true bei einem echten AudioContext; false beim Offline-Rendern,
   *             wo die Zeit nur beim Rendern läuft und nichts fortgesetzt wird.
   */
  constructor(
    readonly ctx: BaseAudioContext,
    readonly live: boolean,
    music: number,
    sfx: number,
    muted: boolean,
  ) {
    this.canPan = typeof ctx.createStereoPanner === 'function';

    this.musicIn = ctx.createGain();
    this.duckGain = ctx.createGain();
    this.musicVol = ctx.createGain();
    this.sfxIn = ctx.createGain();
    this.engineIn = ctx.createGain();
    this.sfxVol = ctx.createGain();
    this.master = ctx.createGain();
    this.musicVol.gain.value = taper(music);
    this.sfxVol.gain.value = taper(sfx);
    this.master.gain.value = muted ? 0 : 1;

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -15;
    comp.knee.value = 12;
    comp.ratio.value = 8;
    comp.attack.value = 0.003;
    comp.release.value = 0.2;

    const trim = ctx.createGain();
    trim.gain.value = COMP_TRIM;

    const limiter = ctx.createWaveShaper();
    limiter.curve = limiterCurve();

    // Wasserfilter: Eckfrequenz fest, geöffnet wird über die Verstimmung (detune).
    const nyquist = ctx.sampleRate / 2;
    this.uwOpenSfx = 1200 * Math.log2(nyquist / UW_SFX_HZ) + UW_OPEN_MARGIN;
    this.uwOpenMusic = 1200 * Math.log2(nyquist / UW_MUSIC_HZ) + UW_OPEN_MARGIN;
    const lowpass = (hz: number, q: number, open: number): BiquadFilterNode => {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = hz;
      f.Q.value = q;
      f.detune.value = open;
      return f;
    };
    this.uwSfx = UW_SFX_Q.map((q) => lowpass(UW_SFX_HZ, q, this.uwOpenSfx));
    this.uwMusic = lowpass(UW_MUSIC_HZ, UW_MUSIC_Q, this.uwOpenMusic);

    this.musicIn.connect(this.duckGain);
    this.duckGain.connect(this.musicVol);
    this.musicVol.connect(this.uwMusic);
    this.uwMusic.connect(this.master);
    this.sfxIn.connect(this.sfxVol);
    this.engineIn.connect(this.sfxVol);
    this.sfxVol.connect(this.uwSfx[0]);
    this.uwSfx[0].connect(this.uwSfx[1]);
    this.uwSfx[1].connect(this.master);
    this.sfxBus = this.uwSfx[1];
    this.musicBus = this.uwMusic;
    this.master.connect(comp);
    comp.connect(trim);
    trim.connect(limiter);
    limiter.connect(ctx.destination);
    this.output = limiter;

    this.white = this.makeNoise(false);
    this.brown = this.makeNoise(true);
  }

  /** Dürfen jetzt Klänge geplant werden? Bei angehaltenem Kontext würden sie sich sonst stauen. */
  canPlay(): boolean {
    if (!this.live) return true;
    if (this.ctx.state === 'running') return true;
    // Direkt nach unlock() ist der Kontext noch einen Augenblick "suspended";
    // der Klick, der ihn weckt, soll trotzdem schon zu hören sein.
    return performance.now() - this.resumeAsked < 600;
  }

  /** Vermerkt, dass gerade um Fortsetzen gebeten wurde (siehe canPlay). */
  noteResume(): void {
    this.resumeAsked = performance.now();
  }

  setVolumes(music: number, sfx: number): void {
    const t = this.ctx.currentTime;
    this.musicVol.gain.setTargetAtTime(taper(music), t, 0.03);
    this.sfxVol.gain.setTargetAtTime(taper(sfx), t, 0.03);
  }

  setMuted(muted: boolean): void {
    this.master.gain.setTargetAtTime(muted ? 0 : 1, this.ctx.currentTime, 0.02);
  }

  /** Musik für `seconds` um `amount` (0..1) absenken, danach weich zurück. */
  duck(amount: number, seconds: number): void {
    const t = this.ctx.currentTime;
    const g = this.duckGain.gain;
    g.cancelScheduledValues(t);
    g.setTargetAtTime(1 - clamp(amount, 0, 1), t, 0.03);
    g.setTargetAtTime(1, t + Math.max(0, seconds), 0.15);
  }

  /**
   * Unter Wasser: k = 1 → dumpf (Tiefpässe zu, leises Rauschbett), k = 0 → offen
   * wie an der Luft. Zwischenwerte schließen anteilig (in Oktaven). Gleitet weich
   * in etwa 0,25 s; ein gleicher Wert erneut tut nichts.
   */
  setUnderwater(k: number): void {
    const kk = clamp(Number.isFinite(k) ? k : 0, 0, 1);
    if (kk === this.uwTarget) return;
    this.uwTarget = kk;
    const t = this.ctx.currentTime;
    for (const f of this.uwSfx) {
      f.detune.cancelScheduledValues(t);
      f.detune.setTargetAtTime(this.uwOpenSfx * (1 - kk), t, UW_GLIDE);
    }
    this.uwMusic.detune.cancelScheduledValues(t);
    this.uwMusic.detune.setTargetAtTime(this.uwOpenMusic * (1 - kk), t, UW_GLIDE);
    if (kk > 0) this.startBed(kk, t);
    else this.stopBed(t);
  }

  /**
   * Unterwasser-Bett: tiefes braunes Rauschen (Tiefpass 220 Hz), dessen Pegel
   * langsam (0,23 Hz) schwankt wie ferne Brandung – kaum hörbar, aber es füllt
   * die Stille, wenn das Filter die Höhen genommen hat. Es läuft durch den
   * Effekt-Regler und das Wasserfilter.
   */
  private startBed(k: number, t: number): void {
    let bed = this.uwBed;
    if (!bed) {
      const ctx = this.ctx;
      const src = this.noise(true);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 220;
      lp.Q.value = -3;
      const swell = ctx.createGain();
      swell.gain.value = 0.7;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.23;
      const depth = ctx.createGain();
      depth.gain.value = 0.3;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      src.connect(lp);
      lp.connect(swell);
      lfo.connect(depth);
      depth.connect(swell.gain);
      swell.connect(gain);
      gain.connect(this.sfxIn);
      src.start(t, this.noiseOffset());
      lfo.start(t);
      this.stats.started += 2;
      bed = { src, lfo, gain, nodes: [src, lp, swell, lfo, depth, gain] };
      this.uwBed = bed;
    }
    bed.gain.gain.cancelScheduledValues(t);
    bed.gain.gain.setTargetAtTime(UW_BED_LEVEL * k, t, 0.25);
  }

  private stopBed(t: number): void {
    const bed = this.uwBed;
    if (!bed) return;
    this.uwBed = null;
    bed.gain.gain.cancelScheduledValues(t);
    bed.gain.gain.setTargetAtTime(0, t, 0.08);
    // Nach gut zehn Zeitkonstanten ist es bei −90 dB: dann anhalten und abbauen.
    const end = t + 0.9;
    bed.src.stop(end);
    bed.lfo.stop(end);
    bed.src.onended = () => {
      this.stats.ended += 2;
      for (const n of bed.nodes) n.disconnect();
    };
  }

  /** Panorama-Knoten oder null, wenn der Browser keinen StereoPanner kennt. */
  panner(pan: number): StereoPannerNode | null {
    if (!this.canPan) return null;
    const p = this.ctx.createStereoPanner();
    p.pan.value = clamp(pan, -1, 1);
    return p;
  }

  /** Wellenform setzen; die Pulswellen gibt es nur als PeriodicWave. */
  setWave(osc: OscillatorNode, wave: Wave): void {
    if (wave === 'pulse25') osc.setPeriodicWave(this.pulse(0.25));
    else if (wave === 'pulse12') osc.setPeriodicWave(this.pulse(0.125));
    else osc.type = wave;
  }

  /** Rauschquelle als Schleife. Der Aufrufer startet sie (am besten mit zufälligem Versatz). */
  noise(brown = false): AudioBufferSourceNode {
    const src = this.ctx.createBufferSource();
    src.buffer = brown ? this.brown : this.white;
    src.loop = true;
    return src;
  }

  /** Zufälliger Startversatz in die Rauschschleife. */
  noiseOffset(): number {
    return Math.random() * (NOISE_SECONDS - 0.05);
  }

  /** Pulswelle mit Tastverhältnis `duty`, oben sanft abgerundet (wärmer als ein hartes Rechteck). */
  private pulse(duty: number): PeriodicWave {
    let wave = this.pulses.get(duty);
    if (wave) return wave;
    const n = 40;
    const real = new Float32Array(n + 1);
    const imag = new Float32Array(n + 1);
    for (let k = 1; k <= n; k++) {
      const x = (Math.PI * k) / (n + 1);
      const sigma = Math.sin(x) / x; // Lanczos-Glättung gegen das Überschwingen an den Kanten
      real[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty) * sigma;
    }
    wave = this.ctx.createPeriodicWave(real, imag);
    this.pulses.set(duty, wave);
    return wave;
  }

  private makeNoise(brown: boolean): AudioBuffer {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * NOISE_SECONDS);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    if (brown) {
      // Leckender Integrator. Zwei Durchläufe über dasselbe Rauschen: nach dem
      // ersten ist der Einschwingvorgang vorbei, der zweite passt am Ende
      // nahtlos an seinen Anfang – die Schleife knackt nicht.
      const white = data.slice();
      let y = 0;
      let peak = 0;
      for (let pass = 0; pass < 2; pass++) {
        for (let i = 0; i < len; i++) {
          y = 0.985 * y + 0.12 * white[i];
          data[i] = y;
          if (pass === 1 && Math.abs(y) > peak) peak = Math.abs(y);
        }
      }
      const norm = peak > 0 ? 0.95 / peak : 1;
      for (let i = 0; i < len; i++) data[i] *= norm;
    }
    return buf;
  }
}
