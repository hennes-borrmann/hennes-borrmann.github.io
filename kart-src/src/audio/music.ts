// Musik: Schrittsequenzer mit Vorausplanung.
//
// Ein "Deck" ist ein fester kleiner Synthesizer für ein Stück: zwei
// Oszillatoren für die Melodie, einer für den Bass, vier für Akkorde und
// Arpeggien, dazu Schlagzeug aus Sinus und Rauschen. Die Knoten laufen durch;
// gespielt wird nur über geplante Verläufe von Tonhöhe, Filter und Lautstärke.
// So entstehen beim Spielen keine neuen Knoten – nichts, was der Browser
// ständig anlegen und wieder wegräumen müsste, während nebenher 60 Bilder pro
// Sekunde gerendert werden.
//
// Der Sequenzer plant immer nur ein kurzes Stück voraus (HORIZON) und richtet
// sich dabei nach der Uhr des AudioContext. Ob das Bild ruckelt, ist ihm egal.

import { clamp, mtof, type Mixer, type Wave } from './mixer';
import { compileSong, SONGS, type Song } from './songs';
import type { MusicId } from './types';

/** So weit plant der Sequenzer voraus (Sekunden). */
const HORIZON = 0.12;
/** Tempo in der letzten Runde. */
const FINAL_LAP_TEMPO = 1.12;
/** Die letzte Runde rückt die Tonart einen Ganzton nach oben. */
const FINAL_LAP_SHIFT = 2;
/** Gesamtpegel der Musik vor dem Lautstärkeregler. */
const MUSIC_LEVEL = 1;
/** Das Echo liegt drei Sechzehntel hinter dem Ton (punktierte Achtel). */
const ECHO_STEPS = 3;

class Deck {
  /** Ausgang des Decks; hierüber wird ein- und ausgeblendet. */
  private readonly out: GainNode;
  private readonly nodes: AudioNode[] = [];
  private readonly sources: AudioScheduledSourceNode[] = [];

  private readonly leadA: OscillatorNode;
  private readonly leadB: OscillatorNode | null;
  private readonly leadEnv: GainNode;
  private readonly vibDepth: GainNode;
  private readonly bassOsc: OscillatorNode;
  private readonly bassLp: BiquadFilterNode;
  private readonly bassEnv: GainNode;
  private readonly compOsc: OscillatorNode[] = [];
  private readonly compEnv: GainNode[] = [];
  private readonly kickOsc: OscillatorNode;
  private readonly kickEnv: GainNode;
  private readonly snareOsc: OscillatorNode;
  private readonly snareBody: GainNode;
  private readonly snareNoise: GainNode;
  private readonly hatEnv: GainNode;
  private readonly percEnv: GainNode;
  private readonly percOsc: OscillatorNode | null = null;
  private readonly echo: DelayNode;

  private step = 0;
  private nextTime: number;
  /** Aktueller Tempofaktor; läuft dem Ziel in kleinen Schritten nach. */
  private tempo = 1;
  /** Aktuelle Transposition in Halbtönen; wechselt nur am Taktanfang. */
  private shift = 0;
  private arp = 0;
  private echoTime: number;
  private disposed = false;

  /** Wird ausgeblendet und danach abgebaut. */
  dying = false;
  /** Ab diesem Zeitpunkt darf ein ausgeblendetes Deck abgebaut werden. */
  endAt = Infinity;

  constructor(
    private readonly mx: Mixer,
    private readonly song: Song,
    startAt: number,
    fadeIn: number,
  ) {
    const ctx = mx.ctx;
    const def = song.def;
    const level = MUSIC_LEVEL * def.level;

    this.out = this.gain(0);
    this.out.gain.setValueAtTime(0, startAt);
    this.out.gain.linearRampToValueAtTime(level, startAt + Math.max(0.005, fadeIn));
    this.out.connect(mx.musicIn);

    // Echo: eine Verzögerung mit gedämpfter Rückkopplung.
    this.echoTime = (ECHO_STEPS * 15) / def.bpm;
    this.echo = ctx.createDelay(1);
    this.echo.delayTime.value = this.echoTime;
    const echoLp = this.filter('lowpass', 2200, 0.5);
    const echoBack = this.gain(0.3);
    const echoOut = this.gain(0.8);
    this.nodes.push(this.echo);
    this.echo.connect(echoLp);
    echoLp.connect(echoBack);
    echoBack.connect(this.echo);
    echoLp.connect(echoOut);
    echoOut.connect(this.out);

    // Melodie: zwei leicht verstimmte Oszillatoren, Tiefpass, Vibrato über einen langsamen Oszillator.
    this.leadEnv = this.gain(0);
    const leadLp = this.filter('lowpass', def.lead.cutoff, 0.8);
    const leadOut = this.gain(def.lead.gain);
    this.vibDepth = this.gain(0);
    const vib = this.osc('sine', 5.4);
    vib.connect(this.vibDepth);
    this.leadA = this.osc(def.lead.wave, 440);
    this.leadA.connect(this.leadEnv);
    this.vibDepth.connect(this.leadA.detune);
    if (def.lead.detune > 0) {
      this.leadB = this.osc(def.lead.wave, 440);
      this.leadB.detune.value = def.lead.detune;
      const half = this.gain(0.7);
      this.leadB.connect(half);
      half.connect(this.leadEnv);
      this.vibDepth.connect(this.leadB.detune);
    } else {
      this.leadB = null;
    }
    this.leadEnv.connect(leadLp);
    leadLp.connect(leadOut);
    leadOut.connect(this.out);
    this.send(leadOut, def.lead.send);

    // Bass: ein Oszillator, dessen Filter bei jedem Anschlag kurz aufgeht.
    this.bassOsc = this.osc(def.bass.wave, 110);
    this.bassLp = this.filter('lowpass', def.bass.cutoff, def.bass.q);
    this.bassEnv = this.gain(0);
    const bassOut = this.gain(def.bass.gain);
    this.bassOsc.connect(this.bassLp);
    this.bassLp.connect(this.bassEnv);
    this.bassEnv.connect(bassOut);
    bassOut.connect(this.out);

    // Begleitung: vier Stimmen für Akkordschläge und Arpeggien.
    const compLp = this.filter('lowpass', def.comp.cutoff, 0.7);
    const compOut = this.gain(def.comp.gain);
    for (let i = 0; i < 4; i++) {
      const osc = this.osc(def.comp.wave, 220);
      const env = this.gain(0);
      osc.connect(env);
      env.connect(compLp);
      this.compOsc.push(osc);
      this.compEnv.push(env);
    }
    compLp.connect(compOut);
    const compPan = mx.panner(def.comp.pan);
    if (compPan) {
      this.nodes.push(compPan);
      compOut.connect(compPan);
      compPan.connect(this.out);
    } else {
      compOut.connect(this.out);
    }
    this.send(compOut, def.comp.send);

    // Schlagzeug: Sinus mit fallender Tonhöhe (Kick), Dreieck plus Rauschen (Snare),
    // hochpassgefiltertes Rauschen (Hi-Hat) und ein viertes Instrument je nach Stück.
    const noise = mx.noise();
    this.sources.push(noise);
    this.nodes.push(noise);
    mx.stats.started++;
    noise.start(ctx.currentTime, mx.noiseOffset());

    this.kickOsc = this.osc('sine', 50);
    this.kickEnv = this.gain(0);
    this.kickOsc.connect(this.kickEnv);
    this.kickEnv.connect(this.out);

    this.snareOsc = this.osc('triangle', 180);
    this.snareBody = this.gain(0);
    this.snareOsc.connect(this.snareBody);
    this.snareBody.connect(this.out);
    const snareBp = this.filter('bandpass', 2100, 0.6);
    this.snareNoise = this.gain(0);
    noise.connect(snareBp);
    snareBp.connect(this.snareNoise);
    this.snareNoise.connect(this.out);

    const hatHp = this.filter('highpass', 7200, 0.8);
    this.hatEnv = this.gain(0);
    noise.connect(hatHp);
    hatHp.connect(this.hatEnv);
    this.hatEnv.connect(this.out);

    this.percEnv = this.gain(0);
    this.percEnv.connect(this.out);
    switch (def.drums.perc) {
      case 'shaker': {
        const bp = this.filter('bandpass', 5200, 1.4);
        noise.connect(bp);
        bp.connect(this.percEnv);
        break;
      }
      case 'clap': {
        const bp = this.filter('bandpass', 1350, 1.3);
        noise.connect(bp);
        bp.connect(this.percEnv);
        break;
      }
      case 'clank': {
        // Zwei Rechtecke in schiefem Verhältnis klingen nach geschlagenem Blech.
        const bp = this.filter('bandpass', 1900, 1.2);
        const a = this.osc('square', 587);
        const b = this.osc('square', 845);
        a.connect(bp);
        b.connect(bp);
        bp.connect(this.percEnv);
        break;
      }
      case 'tom': {
        this.percOsc = this.osc('sine', 150);
        this.percOsc.connect(this.percEnv);
        break;
      }
    }

    this.nextTime = startAt;
  }

  /** Plant alle Schritte bis `now + HORIZON`. */
  schedule(now: number, finalLap: boolean): void {
    if (this.disposed) return;
    // Nach einem Aussetzer (Timer gedrosselt, Kontext angehalten) nicht alles
    // Versäumte auf einmal nachholen, sondern einfach weiterspielen.
    if (this.nextTime < now - 0.03) this.nextTime = now + 0.02;
    const def = this.song.def;
    const fast = finalLap && def.race;
    const target = fast ? FINAL_LAP_TEMPO : 1;
    while (this.nextTime < now + HORIZON) {
      const i = this.step;
      // Die Tonart springt nur am Taktanfang, das Tempo zieht über einige Schritte nach.
      if (i % 16 === 0) this.shift = fast ? FINAL_LAP_SHIFT : 0;
      this.tempo += clamp(target - this.tempo, -0.015, 0.015);
      const dur = 15 / (def.bpm * this.tempo);
      const t = this.nextTime + (i % 2 === 1 ? def.swing * dur : 0);
      this.playStep(i, t, dur, fast);
      this.nextTime += dur;
      this.step = (i + 1) % this.song.steps;
    }
  }

  /** Blendet aus; danach räumt der Player das Deck ab. */
  fadeOut(now: number, seconds: number): void {
    const sec = Math.max(0.02, seconds);
    this.dying = true;
    this.endAt = now + sec + 0.1;
    this.out.gain.cancelScheduledValues(now);
    this.out.gain.setTargetAtTime(0, now, sec / 5);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    const now = this.mx.ctx.currentTime;
    for (const src of this.sources) {
      try {
        src.stop(now);
      } catch {
        // lief nie oder ist schon beendet
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

  // --- Aufbau ---------------------------------------------------------------

  private gain(value: number): GainNode {
    const g = this.mx.ctx.createGain();
    g.gain.value = value;
    this.nodes.push(g);
    return g;
  }

  private filter(type: BiquadFilterType, freq: number, q: number): BiquadFilterNode {
    const f = this.mx.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    this.nodes.push(f);
    return f;
  }

  private osc(wave: Wave, freq: number): OscillatorNode {
    const o = this.mx.ctx.createOscillator();
    this.mx.setWave(o, wave);
    o.frequency.value = freq;
    this.nodes.push(o);
    this.sources.push(o);
    this.mx.stats.started++;
    o.start(this.mx.ctx.currentTime);
    return o;
  }

  private send(from: AudioNode, amount: number): void {
    if (amount <= 0) return;
    const g = this.gain(amount);
    from.connect(g);
    g.connect(this.echo);
  }

  // --- Spielen --------------------------------------------------------------

  private playStep(i: number, t: number, dur: number, fast: boolean): void {
    const song = this.song;
    const drums = song.def.drums;

    const lead = song.lead[i];
    if (lead) this.leadNote(mtof(lead.midi + this.shift), t, lead.steps * dur);
    const bass = song.bass[i];
    if (bass) this.bassNote(mtof(bass.midi + this.shift), t, bass.steps * dur);
    const comp = song.comp[i];
    if (comp) {
      const gate = song.def.comp.gate;
      if (comp.midis.length === 1) {
        // Arpeggio: die Stimmen reihum benutzen, damit die Töne ineinander ausklingen.
        this.compNote(this.arp, mtof(comp.midis[0] + this.shift), t, comp.steps * dur, comp.vel, gate);
        this.arp = (this.arp + 1) % this.compOsc.length;
      } else {
        const n = Math.min(comp.midis.length, this.compOsc.length);
        for (let v = 0; v < n; v++) {
          this.compNote(v, mtof(comp.midis[v] + this.shift), t, comp.steps * dur, comp.vel * 0.8, gate);
        }
      }
    }

    if (song.kick[i] > 0) this.kick(t, song.kick[i] * drums.kick);
    if (song.snare[i] > 0) this.snare(t, song.snare[i] * drums.snare, song.snare[i] < 0.6);
    const hat = song.hat[i];
    if (hat !== 0) this.hat(t, Math.abs(hat) * drums.hat, hat < 0);
    // Letzte Runde: die Lücken der Hi-Hat mit leisen Sechzehnteln füllen.
    else if (fast) this.hat(t, 0.4 * drums.hat, false);
    if (song.perc[i] > 0) this.perc(t, song.perc[i] * drums.percGain, i % 16);

    // Das Echo folgt dem Tempo.
    const echoTime = ECHO_STEPS * dur;
    if (Math.abs(echoTime - this.echoTime) > 1e-4) {
      this.echoTime = echoTime;
      this.echo.delayTime.setTargetAtTime(echoTime, t, 0.1);
    }
  }

  private leadNote(freq: number, t: number, len: number): void {
    const def = this.song.def.lead;
    this.leadA.frequency.setValueAtTime(freq, t);
    this.leadB?.frequency.setValueAtTime(freq, t);
    const off = Math.max(t + 0.05, t + len * def.gate);
    const g = this.leadEnv.gain;
    g.setTargetAtTime(1, t, 0.006);
    g.setTargetAtTime(0.7, t + 0.035, 0.12);
    g.setTargetAtTime(0, off, 0.035);
    // Vibrato erst nach kurzem Anlauf und nur bei Tönen, die lang genug dafür sind.
    const v = this.vibDepth.gain;
    v.setValueAtTime(0, t);
    if (def.vibrato > 0 && len > 0.3) v.setTargetAtTime(def.vibrato, t + 0.16, 0.1);
  }

  private bassNote(freq: number, t: number, len: number): void {
    const def = this.song.def.bass;
    this.bassOsc.frequency.setValueAtTime(freq, t);
    const cutoff = this.bassLp.frequency;
    cutoff.setValueAtTime(def.cutoff + def.pluck, t);
    cutoff.setTargetAtTime(def.cutoff, t, 0.06);
    const off = Math.max(t + 0.04, t + len * def.gate);
    const g = this.bassEnv.gain;
    g.setTargetAtTime(1, t, 0.004);
    g.setTargetAtTime(0.75, t + 0.03, 0.15);
    g.setTargetAtTime(0, off, 0.025);
  }

  private compNote(voice: number, freq: number, t: number, len: number, vel: number, gate: number): void {
    this.compOsc[voice].frequency.setValueAtTime(freq, t);
    const off = Math.max(t + 0.03, t + len * gate);
    const g = this.compEnv[voice].gain;
    g.setTargetAtTime(vel, t, 0.004);
    g.setTargetAtTime(vel * 0.55, t + 0.025, 0.08);
    g.setTargetAtTime(0, off, 0.04);
  }

  private kick(t: number, vel: number): void {
    const f = this.kickOsc.frequency;
    f.setValueAtTime(160, t);
    f.exponentialRampToValueAtTime(47, t + 0.07);
    const g = this.kickEnv.gain;
    g.setTargetAtTime(vel, t, 0.0012);
    g.setTargetAtTime(0, t + 0.03, 0.05);
  }

  private snare(t: number, vel: number, ghost: boolean): void {
    const n = this.snareNoise.gain;
    n.setTargetAtTime(vel, t, 0.001);
    n.setTargetAtTime(0, t + 0.008, ghost ? 0.018 : 0.045);
    const f = this.snareOsc.frequency;
    f.setValueAtTime(245, t);
    f.exponentialRampToValueAtTime(175, t + 0.045);
    const b = this.snareBody.gain;
    b.setTargetAtTime(vel * 0.7, t, 0.001);
    b.setTargetAtTime(0, t + 0.01, 0.028);
  }

  private hat(t: number, vel: number, open: boolean): void {
    const g = this.hatEnv.gain;
    g.setTargetAtTime(vel, t, 0.0008);
    g.setTargetAtTime(0, t + 0.004, open ? 0.065 : 0.013);
  }

  private perc(t: number, vel: number, posInBar: number): void {
    const g = this.percEnv.gain;
    switch (this.song.def.drums.perc) {
      case 'shaker':
        g.setTargetAtTime(vel, t, 0.006);
        g.setTargetAtTime(0, t + 0.02, 0.018);
        break;
      case 'clap':
        // Drei dicht aufeinander folgende Rauschstöße, dann Ausklang.
        for (let k = 0; k < 3; k++) {
          g.setTargetAtTime(vel, t + k * 0.011, 0.0008);
          g.setTargetAtTime(vel * 0.15, t + k * 0.011 + 0.004, 0.003);
        }
        g.setTargetAtTime(vel * 0.9, t + 0.033, 0.0008);
        g.setTargetAtTime(0, t + 0.037, 0.05);
        break;
      case 'clank':
        g.setTargetAtTime(vel, t, 0.0008);
        g.setTargetAtTime(0, t + 0.004, 0.03);
        break;
      case 'tom': {
        // Im Wirbel fällt die Tonhöhe von Schlag zu Schlag.
        const top = 230 - posInBar * 6;
        if (this.percOsc) {
          this.percOsc.frequency.setValueAtTime(top, t);
          this.percOsc.frequency.exponentialRampToValueAtTime(top * 0.6, t + 0.08);
        }
        g.setTargetAtTime(vel, t, 0.0015);
        g.setTargetAtTime(0, t + 0.02, 0.05);
        break;
      }
    }
  }
}

export class MusicPlayer {
  private readonly decks: Deck[] = [];
  private readonly songs = new Map<MusicId, Song | null>();
  private current: Deck | null = null;
  private id: MusicId | null = null;
  private finalLap = false;

  constructor(private readonly mx: Mixer) {}

  /** Wechselt das Stück (null = Stille). Dasselbe Stück noch einmal: nichts passiert. */
  play(id: MusicId | null, fadeSec = 0.7): void {
    if (id === this.id) return;
    const now = this.mx.ctx.currentTime;
    const crossfade = this.current !== null;
    if (this.current) this.current.fadeOut(now, fadeSec);
    this.current = null;
    this.id = id;
    if (id === null) return;
    const song = this.song(id);
    if (!song) return;
    // Beim Überblenden setzt das neue Stück kurz nach dem Ausblenden ein;
    // sonst beginnt es sofort und ohne Einblenden auf der Eins.
    this.current = crossfade ? new Deck(this.mx, song, now + 0.25, 0.3) : new Deck(this.mx, song, now + 0.06, 0.01);
    this.decks.push(this.current);
    this.pump();
  }

  setFinalLap(on: boolean): void {
    this.finalLap = on;
  }

  /** Plant die nächsten Schritte und räumt ausgeblendete Decks ab. Oft aufrufen (Timer und pro Bild). */
  pump(): void {
    const now = this.mx.ctx.currentTime;
    for (let i = this.decks.length - 1; i >= 0; i--) {
      const deck = this.decks[i];
      if (deck.dying && now >= deck.endAt) {
        deck.dispose();
        this.decks.splice(i, 1);
      } else {
        deck.schedule(now, this.finalLap);
      }
    }
  }

  /** Anzahl laufender Decks (für Tests). */
  get deckCount(): number {
    return this.decks.length;
  }

  private song(id: MusicId): Song | null {
    let song = this.songs.get(id);
    if (song === undefined) {
      try {
        song = compileSong(SONGS[id], id);
      } catch (err) {
        // Ein Schreibfehler in den Noten darf das Spiel nicht anhalten.
        console.warn('[audio] Musik nicht lesbar:', err);
        song = null;
      }
      this.songs.set(id, song);
    }
    return song;
  }
}
