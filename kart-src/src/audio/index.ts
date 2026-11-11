// Der Ton des Spiels: Motoren, Geräusche und Musik, alles zur Laufzeit erzeugt.
//
// Browser lassen Ton erst nach einer Nutzergeste zu. Deshalb entsteht der
// AudioContext erst in unlock(); bis dahin tun alle Methoden nichts, merken
// sich aber, welche Musik laufen soll.

import { EngineBank } from './engine';
import { Mixer } from './mixer';
import { MusicPlayer } from './music';
import { SfxPlayer } from './sfx';
import type { KartSound, MusicId, SfxName } from './types';

export type { KartSound, MusicId, SfxName } from './types';

const STORE_KEY = 'kart.audio';

interface Stored {
  music: number;
  sfx: number;
  muted: boolean;
}

function load(): Stored {
  const fallback: Stored = { music: 0.5, sfx: 0.8, muted: false };
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null') as Partial<Stored> | null;
    if (!raw) return fallback;
    return {
      music: typeof raw.music === 'number' ? Math.max(0, Math.min(1, raw.music)) : fallback.music,
      sfx: typeof raw.sfx === 'number' ? Math.max(0, Math.min(1, raw.sfx)) : fallback.sfx,
      muted: raw.muted === true,
    };
  } catch {
    return fallback;
  }
}

export class GameAudio {
  private ctx: AudioContext | null = null;
  private mx: Mixer | null = null;
  private engines: EngineBank | null = null;
  private music: MusicPlayer | null = null;
  private sfxPlayer: SfxPlayer | null = null;
  private readonly state: Stored = load();
  private wantMusic: MusicId | null = null;
  private finalLap = false;
  /** Unter Wasser 0..1 (siehe setUnderwater); gilt auch, wenn der Kontext erst später entsteht. */
  private underwater = 0;
  private timer = 0;
  private paused = false;
  private failed = false;

  /** In einer Nutzergeste aufrufen (Klick/Tipp). Mehrfach aufrufbar. */
  unlock(): void {
    if (this.failed) return;
    if (!this.ctx) {
      try {
        const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) throw new Error('kein AudioContext');
        this.ctx = new Ctor({ latencyHint: 'interactive' });
        this.mx = new Mixer(this.ctx, true, this.state.music, this.state.sfx, this.state.muted);
        this.engines = new EngineBank(this.mx);
        this.music = new MusicPlayer(this.mx);
        this.sfxPlayer = new SfxPlayer(this.mx);
        this.music.setFinalLap(this.finalLap);
        if (this.underwater > 0) this.mx.setUnderwater(this.underwater);
        // Der Sequenzer plant unabhängig von der Bildrate voraus.
        this.timer = window.setInterval(() => {
          if (!this.paused) this.music?.pump();
        }, 25);
      } catch (err) {
        console.warn('[audio] Ton nicht verfügbar:', err);
        this.failed = true;
        return;
      }
    }
    if (this.ctx.state !== 'running' && !this.paused) {
      this.mx?.noteResume();
      void this.ctx.resume().catch(() => undefined);
    }
    if (this.wantMusic) this.music?.play(this.wantMusic);
  }

  /** true, sobald Ton wirklich läuft. */
  get running(): boolean {
    return this.ctx?.state === 'running';
  }

  setVolumes(music: number, sfx: number): void {
    this.state.music = Math.max(0, Math.min(1, music));
    this.state.sfx = Math.max(0, Math.min(1, sfx));
    this.mx?.setVolumes(this.state.music, this.state.sfx);
    this.save();
  }

  getVolumes(): { music: number; sfx: number } {
    return { music: this.state.music, sfx: this.state.sfx };
  }

  setMuted(muted: boolean): void {
    this.state.muted = muted;
    this.mx?.setMuted(muted);
    this.save();
  }

  isMuted(): boolean {
    return this.state.muted;
  }

  /** Musik wechseln (überblendet weich); dieselbe ID erneut = nichts tun. */
  playMusic(id: MusicId): void {
    // Musikwechsel heißt: neues Rennen, Ergebnis oder Menü – dort ist man nie abgetaucht.
    // Sicherheitshalber öffnen, falls das Auftauchen nicht gemeldet wurde.
    this.setUnderwater(0);
    this.wantMusic = id;
    if (this.mx?.canPlay()) this.music?.play(id);
  }

  stopMusic(fadeSec = 0.7): void {
    this.setUnderwater(0);
    this.wantMusic = null;
    this.music?.play(null, fadeSec);
  }

  /** Letzte Runde: die Rennmusik zieht an. */
  setFinalLap(on: boolean): void {
    this.finalLap = on;
    this.music?.setFinalLap(on);
  }

  /**
   * Unter Wasser: 1 = Motoren, Geräusche und Musik klingen dumpf (Tiefpass, leises
   * Rauschbett), 0 = wie an der Luft. Gleitet in etwa 0,25 s. Wird es nie
   * aufgerufen, bleibt der Klang Abtastwert für Abtastwert wie bisher.
   */
  setUnderwater(k: number): void {
    const kk = Number.isFinite(k) ? Math.max(0, Math.min(1, k)) : 0;
    if (kk === this.underwater) return;
    this.underwater = kk;
    this.mx?.setUnderwater(kk);
  }

  /** Musik kurz wegducken, z. B. unter einem Jingle. */
  duck(amount: number, seconds: number): void {
    this.mx?.duck(amount, seconds);
  }

  sfx(name: SfxName, opts: { pan?: number; gain?: number } = {}): void {
    if (this.paused) return;
    this.sfxPlayer?.play(name, opts.pan ?? 0, opts.gain ?? 1);
  }

  /** Pro Bild: Motoren und Fahrgeräusche; hält nebenbei die Musik am Laufen. */
  update(dtSec: number, karts: KartSound[]): void {
    if (!this.mx || this.paused) return;
    if (!this.mx.canPlay()) return;
    // War der Kontext beim Wunsch noch nicht bereit, setzt die Musik jetzt ein.
    if (this.wantMusic) this.music?.play(this.wantMusic);
    this.engines?.update(dtSec, karts);
    this.music?.pump();
  }

  /** Tab im Hintergrund: alles anhalten. */
  suspend(): void {
    if (!this.ctx || this.paused) return;
    this.paused = true;
    this.engines?.release();
    void this.ctx.suspend().catch(() => undefined);
  }

  resume(): void {
    if (!this.ctx || !this.paused) return;
    this.paused = false;
    this.mx?.noteResume();
    void this.ctx.resume().catch(() => undefined);
  }

  /** Für Tests: Zähler gestarteter und beendeter Klangquellen. */
  get debug(): { started: number; ended: number; state: string } | null {
    return this.mx ? { ...this.mx.stats, state: this.ctx?.state ?? 'none' } : null;
  }

  dispose(): void {
    window.clearInterval(this.timer);
    this.engines?.release();
    void this.ctx?.close().catch(() => undefined);
  }

  private save(): void {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(this.state));
    } catch {
      /* ohne Speicher gilt die Einstellung nur für diese Sitzung */
    }
  }
}
