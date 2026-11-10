// Das maßgebliche Rennen auf dem Bildschirm des Lobby-Erstellers.
//
// Der Host rechnet alle Karts. Eingaben fremder Spieler kommen als nummerierte
// Befehle an und werden genau in dieser Reihenfolge ausgeführt – ein
// Simulationsschritt pro Befehl. Dadurch stimmt der Stand des Hosts nach
// Befehl N mit dem überein, was der Client für Befehl N vorhergesagt hat.
//
// Zusätzlich entscheidet nur der Host über alles, was mehrere Fahrzeuge
// betrifft: Rennablauf, Platzierung, Rempler, Kisten, Rollreifen und Ölflecken.

import {
  RACE_COUNTDOWN,
  RACE_RESULTS,
  RACE_RUNNING,
  encodeSnapshot,
  type FxKind,
  type SnapshotKart,
  type SnapshotOil,
  type SnapshotTire,
} from '../net/protocol';
import { botCmd, newBrain, rubberBand, type BotBrain } from './ai';
import { EntityInterp, lerpState } from './interp';
import {
  EV_ITEM_READY,
  EV_PAD,
  EV_TURBO,
  EV_USE_BOOST,
  EV_USE_OIL,
  EV_USE_TIRE,
  EV_WALL,
  ITEM_BOOST,
  ITEM_NONE,
  ITEM_OIL,
  ITEM_TIRE,
  KART_RADIUS,
  MAX_PLAYERS,
  NEUTRAL,
  V_MAX,
  copyState,
  gridState,
  hitKart,
  newState,
  stepKart,
  type Cmd,
  type KartState,
  type StepEnv,
} from './sim';
import { TRACK, proj, projectOnTrack, rightX, rightZ, segDelta } from './track';
import type { GameView, RaceView, RenderEntity, Standing } from './view';

/** Abspielverzögerung fremder Fahrzeuge auf dem Host-Bildschirm (Sekunden). */
const HOST_INTERP_DELAY = 0.05;
/** Nach so vielen Ticks ohne Eingabe rollt ein Fahrzeug ohne Befehle aus. */
const STARVE_TICKS = 12;
/** Ist ein Mitspieler so lange getrennt, fährt die KI für ihn weiter. */
const TAKEOVER_TICKS = 90;
/** Höchstens so viele Befehle eines Spielers pro Host-Tick nachholen. */
const MAX_CMDS_PER_TICK = 3;
const QUEUE_LIMIT = 30;
const QUEUE_TRIM_TO = 8;

/** Vom Rennstart bis "Los": kurze Pause, dann 3 – 2 – 1. */
export const COUNTDOWN_TICKS = 210;
/** So lange nach dem letzten Menschen im Ziel erscheint die Ergebnisliste. */
const RESULTS_DELAY_TICKS = 150;
/** Spätestens so lange nach dem ersten Zieleinlauf ist Schluss. */
const FINISH_TIMEOUT_TICKS = 40 * 60;

const BOX_RADIUS = 2.0;
const BOX_RESPAWN_TICKS = 180;
const ROULETTE_TICKS = 70;
const TIRE_SPEED = 40;
const TIRE_RADIUS = 0.8;
const TIRE_LIFE_TICKS = 6 * 60;
const TIRE_BOUNCES = 4;
const OIL_RADIUS = 1.6;
const OIL_LIFE_TICKS = 50 * 60;
const MAX_TIRES = 8;
const MAX_OILS = 12;

interface HostKart {
  slot: number;
  local: boolean;
  bot: boolean;
  /** Verbindung des Mitspielers steht (bei Host und KI immer true). */
  online: boolean;
  brain: BotBrain | null;
  state: KartState;
  prev: KartState;
  ptick: number;
  ack: number;
  lastSeq: number;
  queue: { seq: number; cmd: Cmd }[];
  starved: number;
  interp: EntityInterp;
  cmdsIn: number;
  cmdsDropped: number;
  /** Gefahrene Abschnitte seit der Startlinie (am Start leicht negativ). */
  progress: number;
  lap: number;
  place: number;
  finished: boolean;
  finishTicks: number;
  bumpCooldown: number;
}

interface Tire extends SnapshotTire {
  seg: number;
  owner: number;
  /** Ticks, in denen der Reifen seinen Werfer noch nicht trifft. */
  safe: number;
  life: number;
  bounces: number;
}

interface Oil extends SnapshotOil {
  owner: number;
  safe: number;
  life: number;
}

export interface HostGameOptions {
  laps?: number;
}

export class HostGame implements GameView {
  tick = 0;
  raceId = 0;
  phase = RACE_COUNTDOWN;
  goTick = 0;
  readonly laps: number;
  /** Rückmeldung an einen menschlichen Spieler (Vibration usw.). */
  onFx: ((slot: number, kind: FxKind) => void) | null = null;

  private readonly karts = new Map<number, HostKart>();
  private readonly scratch = newState();
  private readonly env: StepEnv = { canDrive: false, speedFactor: 1 };
  private readonly boxTimers: Uint16Array;
  private tireList: Tire[] = [];
  private oilList: Oil[] = [];
  private nextId = 1;
  private firstFinishTick = -1;
  private resultsAtTick = -1;
  private lastTickAt = performance.now();
  private rand = (Date.now() % 2147483646) + 1;

  constructor(
    readonly localSlot: number,
    options: HostGameOptions = {},
  ) {
    this.laps = options.laps ?? TRACK.laps;
    this.boxTimers = new Uint16Array(TRACK.boxes.length);
  }

  /**
   * Gleicht die Karts mit der Spielerliste ab: Menschen auf ihren Plätzen,
   * auf den freien Plätzen KI-Gegner (falls gewünscht).
   */
  setRoster(humans: number[], bots: boolean): void {
    const wanted = new Map<number, boolean>();
    for (let slot = 0; slot < MAX_PLAYERS; slot++) {
      if (humans.includes(slot)) wanted.set(slot, false);
      else if (bots) wanted.set(slot, true);
    }
    for (const [slot, isBot] of wanted) {
      const existing = this.karts.get(slot);
      if (existing && existing.bot === isBot) continue;
      if (existing && isBot) {
        // Ein Mensch hat das Rennen verlassen: die KI fährt sein Kart von dort weiter.
        existing.bot = true;
        existing.local = false;
        existing.online = true;
        existing.brain = newBrain(slot);
        existing.queue = [];
        continue;
      }
      this.karts.set(slot, this.createKart(slot, isBot));
    }
    for (const slot of [...this.karts.keys()]) if (!wanted.has(slot)) this.karts.delete(slot);
    this.rank();
  }

  /** Alles auf Anfang: Startaufstellung, Ampel läuft. */
  newRace(): void {
    this.raceId = (this.raceId + 1) & 0xff;
    this.phase = RACE_COUNTDOWN;
    this.goTick = this.tick + COUNTDOWN_TICKS;
    this.firstFinishTick = -1;
    this.resultsAtTick = -1;
    this.tireList = [];
    this.oilList = [];
    this.boxTimers.fill(0);
    for (const k of this.karts.values()) {
      copyState(k.state, gridState(k.slot));
      copyState(k.prev, k.state);
      k.progress = segDelta(TRACK, 0, k.state.seg);
      k.lap = 1;
      k.finished = false;
      k.finishTicks = 0;
      k.queue = [];
      k.starved = 0;
      k.bumpCooldown = 0;
      k.interp.reset();
      if (k.brain) k.brain = newBrain(k.slot);
    }
    this.rank();
  }

  /** Ein Spieler hat sich neu verbunden: seine Befehlszählung beginnt von vorn. */
  resetInput(slot: number): void {
    const k = this.karts.get(slot);
    if (!k) return;
    k.queue = [];
    k.lastSeq = 0;
    k.ack = 0;
  }

  setOnline(slot: number, online: boolean): void {
    const k = this.karts.get(slot);
    if (k && !k.local && !k.bot) k.online = online;
  }

  receiveCmds(slot: number, newestSeq: number, cmds: Cmd[]): void {
    const k = this.karts.get(slot);
    if (!k || k.local || k.bot) return;
    const first = newestSeq - cmds.length + 1;
    for (let i = 0; i < cmds.length; i++) {
      const seq = first + i;
      if (seq > k.lastSeq) {
        k.queue.push({ seq, cmd: cmds[i] });
        k.lastSeq = seq;
        k.cmdsIn++;
      }
    }
  }

  /** Ein Simulationsschritt des Hosts. */
  step(localCmd: Cmd): void {
    this.tick++;
    this.lastTickAt = performance.now();
    const now = this.lastTickAt / 1000;

    if (this.phase === RACE_COUNTDOWN && this.tick >= this.goTick) {
      this.phase = RACE_RUNNING;
      for (const k of this.karts.values()) this.fx(k, 'go');
    }
    const running = this.phase === RACE_RUNNING;

    // Bezugspunkt für den Tempo-Ausgleich der KI: der beste Mensch, der noch fährt.
    let humanBest = Number.NEGATIVE_INFINITY;
    for (const k of this.karts.values()) if (!k.bot && !k.finished) humanBest = Math.max(humanBest, k.progress);

    const others: KartState[] = [];
    for (const k of this.karts.values()) {
      if (k.bumpCooldown > 0) k.bumpCooldown--;
      const canDrive = running && !k.finished;
      this.env.canDrive = canDrive;
      this.env.speedFactor = 1;

      if (k.local) {
        copyState(k.prev, k.state);
        this.advance(k, localCmd);
        continue;
      }

      if (k.bot || (!k.online && k.starved > TAKEOVER_TICKS)) {
        // KI-Gegner – oder ein getrennter Mitspieler, für den die KI einspringt.
        if (!k.brain) k.brain = newBrain(k.slot);
        others.length = 0;
        for (const o of this.karts.values()) if (o !== k && !o.finished) others.push(o.state);
        const band = k.bot && humanBest > Number.NEGATIVE_INFINITY ? rubberBand((k.progress - humanBest) * TRACK.step) : 1;
        this.env.speedFactor = k.brain.skill * band;
        copyState(k.prev, k.state);
        const cmd = botCmd(k.state, k.brain, others, canDrive);
        this.env.canDrive = canDrive;
        this.advance(k, cmd);
        if (!k.bot) {
          k.starved++;
          if (k.queue.length > 0) k.queue = [];
          k.interp.push(k.ptick, k.state, now);
        }
        continue;
      }

      // Mitspieler: seine Befehle der Reihe nach ausführen.
      if (k.queue.length > QUEUE_LIMIT) {
        const drop = k.queue.length - QUEUE_TRIM_TO;
        k.queue.splice(0, drop);
        k.cmdsDropped += drop;
      }
      const n = Math.min(k.queue.length, MAX_CMDS_PER_TICK);
      if (n > 0) {
        for (let i = 0; i < n; i++) {
          const entry = k.queue.shift()!;
          this.env.canDrive = canDrive && !k.finished;
          this.advance(k, entry.cmd);
          k.ack = entry.seq;
        }
        k.starved = 0;
      } else {
        k.starved++;
        if (k.starved > STARVE_TICKS) this.advance(k, NEUTRAL);
      }
      k.interp.push(k.ptick, k.state, now);
    }

    this.stepItems();
    this.collideKarts();
    this.rank();
    this.checkRaceEnd();
  }

  snapshot(): ArrayBuffer {
    const karts: SnapshotKart[] = [];
    for (const k of this.karts.values()) {
      karts.push({
        slot: k.slot,
        bot: k.bot,
        ptick: k.ptick,
        ack: k.ack,
        state: k.state,
        lap: k.lap,
        place: k.place,
        finished: k.finished,
        finishTicks: k.finishTicks,
      });
    }
    return encodeSnapshot({
      tick: this.tick,
      raceId: this.raceId,
      phase: this.phase,
      goTick: this.goTick,
      laps: this.laps,
      boxes: this.boxMask(),
      karts,
      tires: this.tireList,
      oils: this.oilList,
    });
  }

  // --- GameView ----------------------------------------------------------

  entities(alpha: number, nowSec: number, dtSec: number, out: RenderEntity[]): void {
    out.length = 0;
    for (const k of this.karts.values()) {
      let s: KartState;
      if (k.local || k.bot) {
        s = lerpState(this.scratch, k.prev, k.state, alpha);
      } else {
        if (!k.interp.sample(nowSec, dtSec, this.scratch)) continue;
        s = this.scratch;
      }
      out.push({ ...s, slot: k.slot, bot: k.bot, lap: k.lap, place: k.place, finished: k.finished });
    }
  }

  race(): RaceView {
    const frac = Math.min(1, (performance.now() - this.lastTickAt) / (1000 / 60));
    return {
      raceId: this.raceId,
      phase: this.phase,
      laps: this.laps,
      untilGo: (this.goTick - this.tick - frac) / 60,
      boxes: this.boxMask(),
    };
  }

  standings(): Standing[] {
    const list: Standing[] = [];
    for (const k of this.karts.values()) {
      list.push({ slot: k.slot, bot: k.bot, place: k.place, lap: k.lap, finished: k.finished, finishTicks: k.finishTicks });
    }
    return list.sort((a, b) => a.place - b.place);
  }

  tires(): SnapshotTire[] {
    return this.tireList;
  }

  oils(): SnapshotOil[] {
    return this.oilList;
  }

  // --- Diagnose und Tests --------------------------------------------------

  /** Empfangene Befehle je Spieler seit dem letzten Abruf. */
  drainCmdCounts(): Map<number, { received: number; dropped: number; queued: number }> {
    const out = new Map<number, { received: number; dropped: number; queued: number }>();
    for (const k of this.karts.values()) {
      if (k.local || k.bot) continue;
      out.set(k.slot, { received: k.cmdsIn, dropped: k.cmdsDropped, queued: k.queue.length });
      k.cmdsIn = 0;
      k.cmdsDropped = 0;
    }
    return out;
  }

  /** Maßgeblicher Zustand eines Karts. */
  authoritative(slot: number): KartState | null {
    return this.karts.get(slot)?.state ?? null;
  }

  /** Darf das eigene Kart gerade fahren? (für den Autopiloten im Test) */
  localCanDrive(): boolean {
    const k = this.karts.get(this.localSlot);
    return this.phase === RACE_RUNNING && !!k && !k.finished;
  }

  /** Nur für Tests: einem Kart direkt ein Item geben. */
  giveItem(slot: number, item: number): void {
    const k = this.karts.get(slot);
    if (!k) return;
    k.state.item = item;
    k.state.nextItem = ITEM_NONE;
    k.state.roulette = 0;
  }

  /** Nur für Tests: ein Kart so treffen, als wäre es in einen Ölfleck gefahren. */
  debugHit(slot: number): void {
    const k = this.karts.get(slot);
    if (k && hitKart(k.state)) this.fx(k, 'hit');
  }

  // -----------------------------------------------------------------------

  private createKart(slot: number, bot: boolean): HostKart {
    const state = gridState(slot);
    return {
      slot,
      local: slot === this.localSlot && !bot,
      bot,
      online: true,
      brain: bot ? newBrain(slot) : null,
      state,
      prev: copyState(newState(), state),
      ptick: 0,
      ack: 0,
      lastSeq: 0,
      queue: [],
      starved: 0,
      interp: new EntityInterp(HOST_INTERP_DELAY),
      cmdsIn: 0,
      cmdsDropped: 0,
      progress: segDelta(TRACK, 0, state.seg),
      lap: 1,
      place: 1,
      finished: false,
      finishTicks: 0,
      bumpCooldown: 0,
    };
  }

  private fx(k: HostKart, kind: FxKind): void {
    if (!k.bot) this.onFx?.(k.slot, kind);
  }

  /** Einen Schritt für ein Kart rechnen und dessen Folgen behandeln. */
  private advance(k: HostKart, cmd: Cmd): void {
    const before = k.state.seg;
    const ev = stepKart(k.state, cmd, this.env);
    k.ptick++;
    k.progress += segDelta(TRACK, before, k.state.seg);

    if (ev & EV_USE_TIRE) this.spawnTire(k);
    if (ev & EV_USE_OIL) this.spawnOil(k);
    if (ev & (EV_USE_BOOST | EV_TURBO | EV_PAD)) this.fx(k, 'boost');
    if (ev & EV_ITEM_READY) this.fx(k, 'item');
    if (ev & EV_WALL) this.fx(k, 'wall');

    if (!k.finished && this.phase === RACE_RUNNING && k.progress >= this.laps * TRACK.n) {
      k.finished = true;
      k.finishTicks = this.tick - this.goTick;
      if (this.firstFinishTick < 0) this.firstFinishTick = this.tick;
      this.fx(k, 'finish');
    }
    k.lap = Math.max(1, Math.min(this.laps, Math.floor(k.progress / TRACK.n) + 1));
  }

  private random(): number {
    this.rand = (this.rand * 16807) % 2147483647;
    return this.rand / 2147483647;
  }

  /** Wer vorn liegt, bekommt eher Abwehr; wer hinten liegt, eher Schub und Angriff. */
  private pickItem(place: number, count: number): number {
    const r = this.random();
    if (count > 1 && place === 1) return r < 0.5 ? ITEM_OIL : r < 0.78 ? ITEM_BOOST : ITEM_TIRE;
    if (count > 2 && place === count) return r < 0.5 ? ITEM_BOOST : r < 0.9 ? ITEM_TIRE : ITEM_OIL;
    return r < 0.4 ? ITEM_TIRE : r < 0.75 ? ITEM_BOOST : ITEM_OIL;
  }

  private spawnTire(k: HostKart): void {
    if (this.tireList.length >= MAX_TIRES) this.tireList.shift();
    const fx = Math.sin(k.state.heading);
    const fz = Math.cos(k.state.heading);
    this.tireList.push({
      id: this.newId(),
      x: k.state.x + fx * 2.4,
      z: k.state.z + fz * 2.4,
      vx: fx * TIRE_SPEED,
      vz: fz * TIRE_SPEED,
      seg: k.state.seg,
      owner: k.slot,
      safe: 20,
      life: TIRE_LIFE_TICKS,
      bounces: 0,
    });
  }

  private spawnOil(k: HostKart): void {
    if (this.oilList.length >= MAX_OILS) this.oilList.shift();
    const fx = Math.sin(k.state.heading);
    const fz = Math.cos(k.state.heading);
    this.oilList.push({
      id: this.newId(),
      x: k.state.x - fx * 2.8,
      z: k.state.z - fz * 2.8,
      owner: k.slot,
      safe: 45,
      life: OIL_LIFE_TICKS,
    });
  }

  private newId(): number {
    this.nextId = (this.nextId % 250) + 1;
    return this.nextId;
  }

  private boxMask(): number {
    let mask = 0;
    for (let i = 0; i < this.boxTimers.length; i++) if (this.boxTimers[i] === 0) mask |= 1 << i;
    return mask >>> 0;
  }

  private stepItems(): void {
    const t = TRACK;
    const dt = 1 / 60;
    const racing = this.phase === RACE_RUNNING;

    // Kisten: nachwachsen und einsammeln
    for (let i = 0; i < this.boxTimers.length; i++) if (this.boxTimers[i] > 0) this.boxTimers[i]--;
    if (racing) {
      const count = this.karts.size;
      for (const k of this.karts.values()) {
        const s = k.state;
        if (k.finished || s.item !== ITEM_NONE || s.roulette > 0) continue;
        for (let i = 0; i < t.boxes.length; i++) {
          if (this.boxTimers[i] > 0) continue;
          const b = t.boxes[i];
          if (Math.abs(segDelta(t, b.seg, s.seg)) > 6) continue;
          if (Math.hypot(s.x - b.x, s.z - b.z) < BOX_RADIUS) {
            this.boxTimers[i] = BOX_RESPAWN_TICKS;
            s.nextItem = this.pickItem(k.place, count);
            s.roulette = ROULETTE_TICKS;
            this.fx(k, 'pickup');
            break;
          }
        }
      }
    }

    // Rollreifen: geradeaus, an der Bande abprallen, Karts treffen
    for (let i = this.tireList.length - 1; i >= 0; i--) {
      const tire = this.tireList[i];
      tire.x += tire.vx * dt;
      tire.z += tire.vz * dt;
      if (tire.safe > 0) tire.safe--;
      projectOnTrack(t, tire.x, tire.z, tire.seg);
      tire.seg = proj.seg;
      const limit = t.wallHalf - TIRE_RADIUS;
      if (Math.abs(proj.lat) > limit) {
        const side = proj.lat > 0 ? 1 : -1;
        const nx = rightX(t, tire.seg) * side;
        const nz = rightZ(t, tire.seg) * side;
        const over = Math.abs(proj.lat) - limit;
        tire.x -= nx * over;
        tire.z -= nz * over;
        const vn = tire.vx * nx + tire.vz * nz;
        if (vn > 0) {
          tire.vx -= 2 * vn * nx;
          tire.vz -= 2 * vn * nz;
          tire.bounces++;
        }
      }
      let gone = --tire.life <= 0 || tire.bounces > TIRE_BOUNCES;
      if (!gone) {
        for (const k of this.karts.values()) {
          if (k.finished || (k.slot === tire.owner && tire.safe > 0)) continue;
          if (Math.hypot(k.state.x - tire.x, k.state.z - tire.z) < KART_RADIUS + TIRE_RADIUS) {
            if (hitKart(k.state)) this.fx(k, 'hit');
            gone = true;
            break;
          }
        }
      }
      if (gone) this.tireList.splice(i, 1);
    }

    // Ölflecken
    for (let i = this.oilList.length - 1; i >= 0; i--) {
      const oil = this.oilList[i];
      if (oil.safe > 0) oil.safe--;
      let gone = --oil.life <= 0;
      if (!gone) {
        for (const k of this.karts.values()) {
          if (k.finished || (k.slot === oil.owner && oil.safe > 0)) continue;
          if (Math.hypot(k.state.x - oil.x, k.state.z - oil.z) < OIL_RADIUS) {
            if (hitKart(k.state)) this.fx(k, 'hit');
            gone = true;
            break;
          }
        }
      }
      if (gone) this.oilList.splice(i, 1);
    }
  }

  /** Rempler: Karts schieben sich auseinander und tauschen Tempo entlang der Stoßrichtung. */
  private collideKarts(): void {
    const list = [...this.karts.values()];
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        if (a.finished || b.finished) continue;
        const dx = b.state.x - a.state.x;
        const dz = b.state.z - a.state.z;
        const d = Math.hypot(dx, dz);
        const min = KART_RADIUS * 2;
        if (d >= min || d < 1e-6) continue;
        const nx = dx / d;
        const nz = dz / d;
        const push = (min - d) / 2;
        a.state.x -= nx * push;
        a.state.z -= nz * push;
        b.state.x += nx * push;
        b.state.z += nz * push;
        const rel = (b.state.vx - a.state.vx) * nx + (b.state.vz - a.state.vz) * nz;
        if (rel < 0) {
          const impulse = (-(1 + 0.45) * rel) / 2;
          a.state.vx -= impulse * nx;
          a.state.vz -= impulse * nz;
          b.state.vx += impulse * nx;
          b.state.vz += impulse * nz;
          if (rel < -2.5) {
            for (const k of [a, b]) {
              if (k.bumpCooldown === 0) {
                k.bumpCooldown = 25;
                this.fx(k, 'bump');
              }
            }
          }
        }
      }
    }
  }

  private rank(): void {
    const list = [...this.karts.values()].sort((a, b) => {
      if (a.finished !== b.finished) return a.finished ? -1 : 1;
      if (a.finished) return a.finishTicks - b.finishTicks;
      return b.progress - a.progress || a.slot - b.slot;
    });
    list.forEach((k, i) => (k.place = i + 1));
  }

  private checkRaceEnd(): void {
    if (this.phase !== RACE_RUNNING) return;
    if (this.resultsAtTick < 0) {
      let humans = 0;
      let humansDone = 0;
      for (const k of this.karts.values()) {
        if (k.bot) continue;
        humans++;
        if (k.finished) humansDone++;
      }
      const allDone = [...this.karts.values()].every((k) => k.finished);
      if (allDone) this.resultsAtTick = this.tick + 60;
      else if (humans > 0 && humansDone === humans) this.resultsAtTick = this.tick + RESULTS_DELAY_TICKS;
      else if (this.firstFinishTick >= 0 && this.tick - this.firstFinishTick > FINISH_TIMEOUT_TICKS) this.resultsAtTick = this.tick;
    }
    if (this.resultsAtTick >= 0 && this.tick >= this.resultsAtTick) {
      // KI-Fahrer, die noch unterwegs sind, bekommen eine hochgerechnete Zeit –
      // niemand muss warten, bis der letzte Gegner im Ziel ist.
      for (const k of this.karts.values()) {
        if (k.finished || !k.bot) continue;
        const remaining = Math.max(0, this.laps * TRACK.n - k.progress) * TRACK.step;
        k.finished = true;
        k.finishTicks = this.tick - this.goTick + Math.round((remaining / (V_MAX * 0.92)) * 60);
      }
      this.rank();
      this.phase = RACE_RESULTS;
    }
  }
}
