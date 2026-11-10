// Dauergeräusche der Karts: Motor, Schubfauchen, Reifenquietschen, Rumpeln, Fahrtwind.
//
// Das eigene Kart bekommt den vollen Klang – einen kleinen Zweitakter aus drei
// Oszillatoren und Rauschen, der durch zwei bis drei gedachte Gänge dreht.
// Fremde Karts sind bewusst billig: ein Oszillator, ein Filter, Lautstärke
// nach Entfernung, Panorama nach Richtung.
//
// Alle Knoten laufen durch, solange ein Kart gemeldet wird; update() schiebt
// nur Zielwerte nach. Bleibt ein Kart aus, wird seine Stimme ausgeblendet und
// kurz darauf abgebaut.

import { clamp, type Mixer, type Wave } from './mixer';
import type { KartSound } from './types';

/** Pegel des eigenen Motors samt Nebengeräuschen. */
const LOCAL_LEVEL = 0.5;
/** Pegel eines fremden Motors direkt neben der Kamera. */
const REMOTE_LEVEL = 0.16;
/** Ab dieser Entfernung (Meter) ist ein fremdes Kart nicht mehr zu hören. */
const HEARING_RANGE = 60;
/** Mehr Stimmen als das gibt es nie, egal wie viele Karts gemeldet werden. */
const MAX_VOICES = 8;
/** So lange (Sekunden) darf ein Kart fehlen, bevor seine Stimme abgebaut wird. */
const LINGER = 0.6;

/** Klangfarbe je Startplatz: jedes Kart hat seinen eigenen Motor. */
interface SlotTone {
  /** Zündfrequenz im Leerlauf und bei Höchstdrehzahl (Hz). */
  idle: number;
  top: number;
  /** Frequenzverhältnis des dritten Oszillators – prägt den Charakter. */
  ratio: number;
  /** Wellenform der Unteroktave. */
  sub: Wave;
  /** Resonanz des "Auspuffs" (Hz). */
  formant: number;
  /** Wellenform, wenn das Kart als fremdes zu hören ist. */
  far: Wave;
}

const SLOT_TONES: SlotTone[] = [
  { idle: 52, top: 186, ratio: 2.01, sub: 'square', formant: 520, far: 'sawtooth' },
  { idle: 60, top: 208, ratio: 1.5, sub: 'pulse25', formant: 650, far: 'pulse25' },
  { idle: 46, top: 168, ratio: 2.02, sub: 'square', formant: 430, far: 'sawtooth' },
  { idle: 66, top: 228, ratio: 2.99, sub: 'pulse25', formant: 760, far: 'square' },
];

// Gedachtes Getriebe. Je Gang: Geschwindigkeitsbereich und Drehzahl an dessen
// Enden (0..1). Hoch- und Runterschalten liegen auseinander, damit der Motor an
// der Grenze nicht hin- und herspringt.
const GEAR_FROM = [0, 0.3, 0.62];
const GEAR_TO = [0.36, 0.7, 1];
const GEAR_RPM_LOW = [0.1, 0.48, 0.58];
const GEAR_RPM_HIGH = [0.92, 0.95, 1];
const SHIFT_UP = [0.36, 0.7];
const SHIFT_DOWN = [0.27, 0.58];

/** Zielwert für einen AudioParam; spart den Aufruf, wenn sich nichts Hörbares ändert. */
class Dial {
  private last = NaN;

  constructor(private readonly param: AudioParam) {}

  set(value: number, now: number, timeConstant: number): void {
    if (Math.abs(value - this.last) < 1e-4 + Math.abs(value) * 0.002) return;
    this.last = value;
    this.param.setTargetAtTime(value, now, timeConstant);
  }
}

/** Drehzahl, Last und Aussetzer eines Motors – reine Rechnung, ohne Klang. */
class Rev {
  /** Drehzahl 0..~1.3. */
  rpm = 0.1;
  /** 0 = rollt, 1 = unter Gas. */
  load = 0;
  /** 1 = läuft, kleiner = Zündaussetzer. */
  cut = 1;
  private gear = 0;
  private cutTimer = 0;

  step(dt: number, k: KartSound): void {
    const speed = clamp(k.speed, 0, 1.5);

    if (this.gear < 2 && speed > SHIFT_UP[this.gear]) this.gear++;
    else if (this.gear > 0 && speed < SHIFT_DOWN[this.gear - 1]) this.gear--;
    const g = this.gear;
    const along = clamp((speed - GEAR_FROM[g]) / (GEAR_TO[g] - GEAR_FROM[g]), 0, 1);
    let target = GEAR_RPM_LOW[g] + (GEAR_RPM_HIGH[g] - GEAR_RPM_LOW[g]) * along;

    // Über der normalen Höchstgeschwindigkeit (Schub) dreht der Motor über.
    if (speed > 1) target += (speed - 1) * 0.45;
    // Gas im Stand lässt den Motor frei hochdrehen (Countdown!); beim Rollen fällt die Drehzahl etwas ab.
    if (k.throttle) target = Math.max(target, 0.5 * (1 - speed / 0.2));
    else target -= 0.06;
    if (k.boost) target += 0.07;
    // In der Luft fehlt der Widerstand der Räder.
    if (k.air) target += k.throttle ? 0.24 : 0.05;
    target = clamp(target, 0.05, 1.35);

    // Hoch geht es gemächlich, runter (Gangwechsel) schnell – das ist der hörbare Schaltsprung.
    const tc = target > this.rpm ? (k.air ? 0.07 : 0.15) : 0.06;
    this.rpm += (target - this.rpm) * (1 - Math.exp(-dt / tc));

    const wantLoad = k.throttle || k.boost ? 1 : 0;
    this.load += (wantLoad - this.load) * (1 - Math.exp(-dt / (wantLoad > this.load ? 0.05 : 0.12)));

    if (k.stall) {
      // Kurzschluss: in unregelmäßigen Abständen setzt die Zündung aus.
      this.cutTimer -= dt;
      if (this.cutTimer <= 0) {
        this.cut = Math.random() < 0.55 ? 0.08 : 1;
        this.cutTimer = 0.04 + Math.random() * 0.09;
      }
    } else {
      this.cut = 1;
      this.cutTimer = 0;
    }
  }
}

abstract class Voice {
  readonly rev = new Rev();
  /** Sekunden, seit das Kart zuletzt gemeldet wurde. */
  missing = 0;
  protected readonly nodes: AudioNode[] = [];
  protected readonly sources: AudioScheduledSourceNode[] = [];
  private disposed = false;

  constructor(
    protected readonly mx: Mixer,
    readonly local: boolean,
  ) {}

  abstract update(dt: number, k: KartSound, now: number): void;
  /** Ausblenden (Kart nicht mehr gemeldet). */
  abstract fade(now: number): void;

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    const now = this.mx.ctx.currentTime;
    for (const src of this.sources) {
      try {
        src.stop(now);
      } catch {
        // schon beendet
      }
      this.mx.stats.ended++;
    }
    for (const node of this.nodes) {
      try {
        node.disconnect();
      } catch {
        // schon getrennt
      }
    }
  }

  protected gain(value: number): GainNode {
    const g = this.mx.ctx.createGain();
    g.gain.value = value;
    this.nodes.push(g);
    return g;
  }

  protected filter(type: BiquadFilterType, freq: number, q: number): BiquadFilterNode {
    const f = this.mx.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    this.nodes.push(f);
    return f;
  }

  protected osc(wave: Wave, freq: number): OscillatorNode {
    const o = this.mx.ctx.createOscillator();
    this.mx.setWave(o, wave);
    o.frequency.value = freq;
    this.started(o);
    o.start(this.mx.ctx.currentTime);
    return o;
  }

  protected noise(brown: boolean): AudioBufferSourceNode {
    const src = this.mx.noise(brown);
    this.started(src);
    src.start(this.mx.ctx.currentTime, this.mx.noiseOffset());
    return src;
  }

  private started(src: AudioScheduledSourceNode): void {
    this.nodes.push(src);
    this.sources.push(src);
    this.mx.stats.started++;
  }
}

/** Das eigene Kart: voller Klang. */
class LocalVoice extends Voice {
  private readonly tone: SlotTone;
  private readonly freqA: Dial;
  private readonly freqB: Dial;
  private readonly freqC: Dial;
  private readonly freqPulse: Dial;
  private readonly pulseDepth: Dial;
  private readonly cutoff: Dial;
  private readonly motor: Dial;
  private readonly raspFreq: Dial;
  private readonly rasp: Dial;
  private readonly hiss: Dial;
  private readonly hissFreq: Dial;
  private readonly wind: Dial;
  private readonly windFreq: Dial;
  private readonly squeal: Dial;
  private readonly squealFreqA: Dial;
  private readonly squealFreqB: Dial;
  private readonly rumble: Dial;
  /** Langsam wandernder Zufallswert (−1..1) – hält Quietschen und Fauchen lebendig. */
  private wander = 0;
  private rumbleTimer = 0;
  private rumbleLevel = 1;

  constructor(mx: Mixer, slot: number) {
    super(mx, true);
    const tone = SLOT_TONES[((slot % SLOT_TONES.length) + SLOT_TONES.length) % SLOT_TONES.length];
    this.tone = tone;

    const sum = this.gain(LOCAL_LEVEL);
    sum.connect(mx.engineIn);

    // Motor: Sägezahn auf der Zündfrequenz, eine Unteroktave für den Bauch und
    // ein dritter Oszillator knapp neben einem Oberton – die Schwebung
    // dazwischen macht das Schnarren. Dazu etwas Rauschen fürs Mechanische.
    const oscA = this.osc('sawtooth', tone.idle);
    const oscB = this.osc(tone.sub, tone.idle / 2);
    const oscC = this.osc('sawtooth', tone.idle * tone.ratio);
    const mix = this.gain(0.34);
    const subLevel = this.gain(0.8);
    const topLevel = this.gain(0.4);
    oscA.connect(mix);
    oscB.connect(subLevel);
    subLevel.connect(mix);
    oscC.connect(topLevel);
    topLevel.connect(mix);

    const white = this.noise(false);
    const raspBp = this.filter('bandpass', 900, 1.4);
    const raspGain = this.gain(0);
    white.connect(raspBp);
    raspBp.connect(raspGain);
    raspGain.connect(mix);

    // Feste Resonanz wie ein Auspuff: die Obertöne wandern beim Hochdrehen
    // hindurch. Danach ein Tiefpass, der mit Drehzahl und Last aufgeht.
    const formant = this.filter('peaking', tone.formant, 1.6);
    formant.gain.value = 8;
    const lowpass = this.filter('lowpass', 400, 0.9);
    mix.connect(formant);
    formant.connect(lowpass);

    // Das "Pöttern": die Lautstärke schwankt mit der halben Zündfrequenz,
    // im Leerlauf deutlich, bei hoher Drehzahl kaum noch.
    const pulse = this.gain(1);
    const pulseOsc = this.osc('sine', tone.idle / 2);
    const pulseAmount = this.gain(0);
    pulseOsc.connect(pulseAmount);
    pulseAmount.connect(pulse.gain);
    const motor = this.gain(0);
    lowpass.connect(pulse);
    pulse.connect(motor);
    motor.connect(sum);

    // Schub: breites Fauchen.
    const hissBp = this.filter('bandpass', 1600, 0.7);
    const hiss = this.gain(0);
    white.connect(hissBp);
    hissBp.connect(hiss);
    hiss.connect(sum);

    // Fahrtwind.
    const windLp = this.filter('lowpass', 400, 0.5);
    const wind = this.gain(0);
    white.connect(windLp);
    windLp.connect(wind);
    wind.connect(sum);

    // Reifenquietschen: zwei schmale Resonanzen im Rauschen.
    const squealA = this.filter('bandpass', 1000, 16);
    const squealB = this.filter('bandpass', 1520, 10);
    const squealBLevel = this.gain(0.45);
    const squeal = this.gain(0);
    white.connect(squealA);
    white.connect(squealB);
    squealA.connect(squeal);
    squealB.connect(squealBLevel);
    squealBLevel.connect(squeal);
    squeal.connect(sum);

    // Offroad: dumpfes Rumpeln aus tiefem Rauschen.
    const brown = this.noise(true);
    const rumbleLp = this.filter('lowpass', 170, 1.5);
    const rumble = this.gain(0);
    brown.connect(rumbleLp);
    rumbleLp.connect(rumble);
    rumble.connect(sum);

    this.freqA = new Dial(oscA.frequency);
    this.freqB = new Dial(oscB.frequency);
    this.freqC = new Dial(oscC.frequency);
    this.freqPulse = new Dial(pulseOsc.frequency);
    this.pulseDepth = new Dial(pulseAmount.gain);
    this.cutoff = new Dial(lowpass.frequency);
    this.motor = new Dial(motor.gain);
    this.raspFreq = new Dial(raspBp.frequency);
    this.rasp = new Dial(raspGain.gain);
    this.hiss = new Dial(hiss.gain);
    this.hissFreq = new Dial(hissBp.frequency);
    this.wind = new Dial(wind.gain);
    this.windFreq = new Dial(windLp.frequency);
    this.squeal = new Dial(squeal.gain);
    this.squealFreqA = new Dial(squealA.frequency);
    this.squealFreqB = new Dial(squealB.frequency);
    this.rumble = new Dial(rumble.gain);
  }

  update(dt: number, k: KartSound, now: number): void {
    const rev = this.rev;
    rev.step(dt, k);
    const { rpm, load, cut } = rev;
    const tone = this.tone;
    const speed = clamp(k.speed, 0, 1.5);
    const rolling = k.air ? 0 : 1;

    this.wander += (Math.random() - 0.5) * dt * 14;
    this.wander *= Math.exp(-dt * 3);
    this.wander = clamp(this.wander, -1, 1);

    // Bei einem Zündaussetzer sackt auch die Tonhöhe kurz ab.
    const freq = (tone.idle + (tone.top - tone.idle) * rpm) * (cut < 1 ? 0.8 : 1);
    this.freqA.set(freq, now, 0.02);
    this.freqB.set(freq * 0.5, now, 0.02);
    this.freqC.set(freq * tone.ratio, now, 0.02);
    this.freqPulse.set(freq * 0.5, now, 0.02);
    this.pulseDepth.set((0.42 - 0.3 * Math.min(1, rpm)) * (1.25 - 0.25 * load), now, 0.05);
    this.cutoff.set(260 + (700 + 2400 * load) * Math.pow(rpm, 1.2), now, 0.04);
    this.motor.set((0.5 + 0.5 * load) * (0.72 + 0.28 * Math.min(1, rpm)) * cut, now, cut < 1 ? 0.006 : 0.02);
    this.raspFreq.set(600 + 1700 * rpm, now, 0.05);
    this.rasp.set((0.1 + 0.5 * rpm) * (0.4 + 0.6 * load), now, 0.05);

    this.hiss.set(k.boost ? 0.3 + 0.05 * this.wander : 0, now, k.boost ? 0.04 : 0.14);
    this.hissFreq.set(1500 + 700 * Math.min(1.4, speed) + 250 * this.wander, now, 0.05);

    this.wind.set(0.16 * speed * speed * (k.air ? 1.5 : 1), now, 0.1);
    this.windFreq.set(300 + 1000 * speed, now, 0.1);

    const drifting = k.drift > 0 && rolling > 0;
    const squealHz = 900 * Math.pow(2, clamp(k.drift, 0, 3) * 0.37) * (1 + 0.035 * this.wander);
    this.squeal.set(drifting ? 1.1 * Math.min(1, speed / 0.45) : 0, now, drifting ? 0.03 : 0.07);
    this.squealFreqA.set(squealHz, now, 0.04);
    this.squealFreqB.set(squealHz * 1.52, now, 0.04);

    // Rumpeln: alle paar Hundertstel ein neuer Zufallspegel, das ergibt die Schläge.
    this.rumbleTimer -= dt;
    if (this.rumbleTimer <= 0) {
      this.rumbleLevel = 0.45 + 0.55 * Math.random();
      this.rumbleTimer = 0.04 + Math.random() * 0.05;
    }
    const offroad = k.offroad && rolling > 0;
    this.rumble.set(offroad ? 1.5 * Math.min(1, speed / 0.4) * this.rumbleLevel : 0, now, offroad ? 0.02 : 0.08);
  }

  fade(now: number): void {
    for (const dial of [this.motor, this.rasp, this.hiss, this.wind, this.squeal, this.rumble]) dial.set(0, now, 0.05);
  }
}

/** Ein fremdes Kart: ein Oszillator, ein Filter. */
class RemoteVoice extends Voice {
  private readonly tone: SlotTone;
  private readonly freq: Dial;
  private readonly cutoff: Dial;
  private readonly level: Dial;
  private readonly pan: Dial | null;

  constructor(mx: Mixer, slot: number) {
    super(mx, false);
    const tone = SLOT_TONES[((slot % SLOT_TONES.length) + SLOT_TONES.length) % SLOT_TONES.length];
    this.tone = tone;
    const osc = this.osc(tone.far, tone.idle);
    const lowpass = this.filter('lowpass', 300, 2);
    const level = this.gain(0);
    osc.connect(lowpass);
    lowpass.connect(level);
    const panner = mx.panner(0);
    if (panner) {
      this.nodes.push(panner);
      level.connect(panner);
      panner.connect(mx.engineIn);
    } else {
      level.connect(mx.engineIn);
    }
    this.freq = new Dial(osc.frequency);
    this.cutoff = new Dial(lowpass.frequency);
    this.level = new Dial(level.gain);
    this.pan = panner ? new Dial(panner.pan) : null;
  }

  update(dt: number, k: KartSound, now: number): void {
    const rev = this.rev;
    rev.step(dt, k);
    const { rpm, load, cut } = rev;
    const tone = this.tone;
    const near = clamp(1 - k.distance / HEARING_RANGE, 0, 1);
    this.freq.set((tone.idle + (tone.top - tone.idle) * rpm) * (cut < 1 ? 0.8 : 1), now, 0.03);
    // Mit der Entfernung wird der Klang auch dumpfer.
    this.cutoff.set(240 + (500 + 1300 * load) * rpm * (0.4 + 0.6 * near), now, 0.05);
    this.level.set(REMOTE_LEVEL * near * near * (0.55 + 0.45 * load) * (0.7 + 0.3 * Math.min(1, rpm)) * cut, now, 0.04);
    this.pan?.set(clamp(k.pan, -1, 1) * 0.85, now, 0.05);
  }

  fade(now: number): void {
    this.level.set(0, now, 0.05);
  }
}

export class EngineBank {
  private readonly voices = new Map<number, Voice>();
  private readonly seen = new Set<number>();

  constructor(private readonly mx: Mixer) {}

  /** Pro Bild: Zustände übernehmen. Nicht gemeldete Karts verstummen. */
  update(dtSec: number, karts: readonly KartSound[]): void {
    const dt = clamp(Number.isFinite(dtSec) ? dtSec : 0, 0, 0.1);
    const now = this.mx.ctx.currentTime;
    const seen = this.seen;
    seen.clear();

    for (const k of karts) {
      if (seen.has(k.slot)) continue;
      let voice = this.voices.get(k.slot);
      if (voice && voice.local !== k.local) {
        voice.dispose();
        this.voices.delete(k.slot);
        voice = undefined;
      }
      if (!voice) {
        // Weit entfernte fremde Karts bekommen gar nicht erst eine Stimme.
        if (!k.local && (k.distance >= HEARING_RANGE || this.voices.size >= MAX_VOICES)) continue;
        voice = k.local ? new LocalVoice(this.mx, k.slot) : new RemoteVoice(this.mx, k.slot);
        this.voices.set(k.slot, voice);
      }
      seen.add(k.slot);
      voice.missing = 0;
      voice.update(dt, k, now);
    }

    for (const [slot, voice] of this.voices) {
      if (seen.has(slot)) continue;
      if (voice.missing === 0) voice.fade(now);
      voice.missing += Math.max(dt, 0.001);
      if (voice.missing > LINGER) {
        voice.dispose();
        this.voices.delete(slot);
      }
    }
  }

  /** Alles sofort ausblenden und abbauen (update() bleibt aus, z. B. Tab im Hintergrund). */
  release(): void {
    if (this.voices.size === 0) return;
    const now = this.mx.ctx.currentTime;
    for (const voice of this.voices.values()) {
      voice.fade(now);
      voice.dispose();
    }
    this.voices.clear();
  }

  /** Anzahl aktiver Stimmen (für Tests). */
  get voiceCount(): number {
    return this.voices.size;
  }
}
