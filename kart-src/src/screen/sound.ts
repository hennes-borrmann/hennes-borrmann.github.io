// Bindeglied zwischen Spiel und Ton: entscheidet, wann welche Musik läuft und
// welches Ereignis welches Geräusch auslöst. Der Klang selbst entsteht in
// audio/ – hier steht nur das "Wann".

import type { FxKind } from '../net/protocol';
import type { KartAudio, SceneEvent } from '../render/raceScene';

export type MusicName = 'menu' | 'werkshof' | 'klippe' | 'glut' | 'nacht' | 'results';

/** Was diese Datei vom Ton-Modul braucht (deckungsgleich mit audio/GameAudio). */
export interface AudioEngine {
  unlock(): void;
  readonly running: boolean;
  setVolumes(music: number, sfx: number): void;
  getVolumes(): { music: number; sfx: number };
  setMuted(muted: boolean): void;
  isMuted(): boolean;
  playMusic(id: MusicName): void;
  stopMusic(fadeSec?: number): void;
  setFinalLap(on: boolean): void;
  duck(amount: number, seconds: number): void;
  sfx(name: string, opts?: { pan?: number; gain?: number }): void;
  update(dtSec: number, karts: KartAudio[]): void;
  suspend(): void;
  resume(): void;
  readonly debug?: { started: number; ended: number; state: string } | null;
}

/** Geräusche fremder Karts, die man hören soll – der Rest wäre nur Lärm. */
const HEARD_FROM_OTHERS = new Set<SceneEvent['kind']>([
  'hit',
  'bump',
  'boost',
  'turbo2',
  'turbo3',
  'fall',
  'land',
  'guard-block',
  'stall',
  'use-tire',
  'use-oil',
  'use-top',
  'use-emp',
  'use-smoke',
  'use-spring',
  'use-kite',
  // Was die Strecke selbst von sich gibt
  'geyser',
  'bomb',
  'honk',
  'pass',
  'press',
]);

export class Sound {
  private readonly none: KartAudio[] = [];
  private lastCount: string | null = null;
  private rouletteAt = 0;
  private warnAt = 0;
  private wantMusic: MusicName | null = null;

  constructor(
    private readonly engine: AudioEngine | null,
    startMuted: boolean,
  ) {
    if (startMuted) engine?.setMuted(true);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) engine?.suspend();
      else engine?.resume();
    });
  }

  /** In einer Nutzergeste aufrufen – vorher darf der Browser keinen Ton abspielen. */
  unlock(): void {
    this.engine?.unlock();
  }

  music(id: MusicName | null): void {
    if (id === this.wantMusic) return;
    this.wantMusic = id;
    if (id) this.engine?.playMusic(id);
    else this.engine?.stopMusic(0.6);
    this.engine?.setFinalLap(false);
  }

  ui(kind: 'click' | 'back' | 'join' | 'ready'): void {
    this.engine?.sfx(kind === 'click' ? 'ui-click' : kind === 'back' ? 'ui-back' : kind);
  }

  /** Was die 3D-Szene meldet (Treffer, Schub, Landung …). */
  sceneEvent(e: SceneEvent): void {
    if (!this.engine) return;
    if (e.local) this.engine.sfx(e.kind);
    else if (HEARD_FROM_OTHERS.has(e.kind)) this.engine.sfx(e.kind, { pan: e.pan, gain: e.gain * 0.55 });
  }

  /** Was nur der Host weiß und per Nachricht kommt: Rundenwechsel. */
  fx(kind: FxKind): void {
    if (!this.engine) return;
    if (kind === 'lap') this.engine.sfx('lap');
    else if (kind === 'finallap') {
      this.engine.duck(0.6, 1.4);
      this.engine.sfx('final-lap');
      this.engine.setFinalLap(true);
    }
  }

  /** Ampel: bei jedem Wechsel der Anzeige ein Ton. */
  countdown(text: string | null): void {
    if (text === this.lastCount) return;
    this.lastCount = text;
    if (!text || !this.engine) return;
    this.engine.duck(0.5, 0.5);
    this.engine.sfx(text === 'Los!' ? 'go' : 'count');
  }

  /** Solange die Auslosung läuft, tickt es. */
  roulette(rolling: boolean, nowMs: number): void {
    if (!rolling || nowMs - this.rouletteAt < 85) return;
    this.rouletteAt = nowMs;
    this.engine?.sfx('roulette-tick');
  }

  /** Ein Brummkreisel sucht das eigene Kart: Warnton, je näher desto schneller. */
  warn(threat: number, nowMs: number): void {
    if (threat <= 0 || nowMs - this.warnAt < 620 - threat * 380) return;
    this.warnAt = nowMs;
    this.engine?.sfx('warn');
  }

  results(place: number, of: number): void {
    this.engine?.setFinalLap(false);
    this.engine?.sfx(place === 1 || (of >= 4 && place === 2) ? 'win' : 'lose');
  }

  /** Pro Bild: Motoren und Fahrgeräusche. */
  update(dt: number, karts: KartAudio[] | null): void {
    this.engine?.update(dt, karts ?? this.none);
  }

  volumes(): { music: number; sfx: number } {
    return this.engine?.getVolumes() ?? { music: 0.5, sfx: 0.8 };
  }

  setVolumes(music: number, sfx: number): void {
    this.engine?.setVolumes(music, sfx);
  }

  get muted(): boolean {
    return this.engine?.isMuted() ?? false;
  }

  setMuted(muted: boolean): void {
    this.engine?.setMuted(muted);
  }

  /** Für Tests: läuft der Ton, und wie viele Klangquellen wurden gestartet? */
  debug(): { started: number; ended: number; state: string; music: string | null } | null {
    const d = this.engine?.debug;
    return d ? { ...d, music: this.wantMusic } : null;
  }

  get available(): boolean {
    return this.engine !== null;
  }

  get running(): boolean {
    return this.engine?.running ?? false;
  }
}
