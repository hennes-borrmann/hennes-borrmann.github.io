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
  THING_OIL,
  THING_SMOKE,
  THING_TIRE,
  THING_TOP,
  encodeSnapshot,
  type FxKind,
  type SnapshotKart,
  type SnapshotThing,
} from '../net/protocol';
import { AI_MEDIUM, botCmd, newBrain, rubberBand, type BotBrain, type BotContext } from './ai';
import { EntityInterp, lerpState } from './interp';
import {
  EV_BLOCK,
  EV_DRAFT,
  EV_FALL,
  EV_FLAT,
  EV_HIT,
  EV_ITEM_READY,
  EV_LAND,
  EV_PAD,
  EV_TURBO,
  EV_USE_BOOST,
  EV_USE_EMP,
  EV_USE_KITE,
  EV_USE_OIL,
  EV_USE_SMOKE,
  EV_USE_TIRE,
  EV_USE_TOP,
  EV_WALL,
  HIT_BLOCKED,
  HIT_NONE,
  ITEM_BOOST,
  ITEM_EMP,
  ITEM_GUARD,
  ITEM_NONE,
  ITEM_OIL,
  ITEM_SMOKE,
  ITEM_KITE,
  ITEM_SPRING,
  ITEM_TIRE,
  ITEM_TOP,
  CHARACTERS,
  KART_RADIUS,
  MAX_PLAYERS,
  NEUTRAL,
  V_MAX,
  copyState,
  gridState,
  hitKart,
  newState,
  stallKart,
  stepKart,
  trafficBlocks,
  type Cmd,
  type KartState,
  type StepEnv,
  BTN_ITEM,
} from './sim';
import {
  EDGE_OPEN_L,
  EDGE_OPEN_R,
  NO_GROUND,
  TRACK,
  centerHeight,
  groundAt,
  hazardLat,
  proj,
  projectOnTrack,
  rightX,
  rightZ,
  addProgress,
  progDelta,
  segDelta,
  sideLimit,
  walk,
  wrapSeg,
} from './track';
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
/** So weit darf die Rennzeit, die ein Mitspieler zu seiner Eingabe meldet, von der des Hosts abweichen (Ticks). */
const TIME_SLACK = 40;

/** Vom Rennstart bis "Los": Kamerafahrt über die Startaufstellung, dann 3 – 2 – 1. */
export const COUNTDOWN_TICKS = 345;
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
/** Brummkreisel: schneller als jedes Kart, damit er auch 100 m Vorsprung einholt. */
const TOP_SPEED = 46;
const TOP_RADIUS = 1.7;
const TOP_LIFE_TICKS = 10 * 60;
const SMOKE_RADIUS = 7.5;
const SMOKE_LIFE_TICKS = 9 * 60;
/** Erst ab diesem Rückstand (Meter auf das Kart davor) gibt es den Abschleppdrachen. */
const KITE_MIN_GAP = 45;
export const HAZARD_RADIUS = 1.5;
/** Höchstzahl gleichzeitiger Dinge je Art – hält die Snapshots klein. */
const MAX_PER_KIND = 6;

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
  queue: { seq: number; cmd: Cmd; time: number }[];
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

/** Alles, was außer Karts auf der Strecke unterwegs ist. */
interface Thing extends SnapshotThing {
  seg: number;
  owner: number;
  /** Ticks, in denen das Ding seinen Besitzer noch nicht trifft. */
  safe: number;
  life: number;
  bounces: number;
  /** Ticks ohne Boden unter sich (Rollreifen). */
  floating: number;
  /** Brummkreisel: Meter hinter der Startlinie, seitliche Lage, Ziel-Platz (-1 = keins). */
  pos: number;
  lat: number;
  target: number;
}

export interface HostGameOptions {
  laps?: number;
  /** Stärke der KI-Gegner (AI_EASY, AI_MEDIUM, AI_HARD). */
  aiLevel?: number;
}

export class HostGame implements GameView {
  tick = 0;
  raceId = 0;
  phase = RACE_COUNTDOWN;
  goTick = 0;
  readonly laps: number;
  readonly aiLevel: number;
  /** Rückmeldung an einen menschlichen Spieler (Vibration usw.). */
  onFx: ((slot: number, kind: FxKind) => void) | null = null;

  private readonly karts = new Map<number, HostKart>();
  private readonly scratch = newState();
  private readonly env: StepEnv = { canDrive: false, speedFactor: 1, time: 0 };
  private readonly boxTimers: Uint16Array;
  private thingList: Thing[] = [];
  /** Gewählte Figur je Platz; fehlt ein Eintrag (KI), gilt die Standardfigur des Platzes. */
  private chars: number[] = [];
  private readonly botCtx: BotContext = { tick: 0, time: 0, place: 1, smoke: false };
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
    this.aiLevel = options.aiLevel ?? AI_MEDIUM;
    this.boxTimers = new Uint16Array(TRACK.boxes.length);
  }

  /**
   * Gleicht die Karts mit der Spielerliste ab: Menschen auf ihren Plätzen,
   * auf den freien Plätzen KI-Gegner (falls gewünscht).
   */
  setRoster(humans: number[], bots: boolean, chars: number[] = []): void {
    this.chars = chars;
    const wanted = new Map<number, boolean>();
    for (let slot = 0; slot < MAX_PLAYERS; slot++) {
      if (humans.includes(slot)) wanted.set(slot, false);
      else if (bots) wanted.set(slot, true);
    }
    for (const [slot, isBot] of wanted) {
      const existing = this.karts.get(slot);
      if (existing && !isBot) existing.state.char = this.charOf(slot, false);
      if (existing && existing.bot === isBot) continue;
      if (existing && isBot) {
        // Ein Mensch hat das Rennen verlassen: die KI fährt sein Kart von dort weiter.
        existing.bot = true;
        existing.local = false;
        existing.online = true;
        existing.brain = newBrain(slot, this.aiLevel);
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
    this.thingList = [];
    this.boxTimers.fill(0);
    for (const k of this.karts.values()) {
      copyState(k.state, gridState(k.slot, this.charOf(k.slot, k.bot)));
      copyState(k.prev, k.state);
      k.progress = progDelta(TRACK, 0, k.state.seg);
      k.lap = 1;
      k.finished = false;
      k.finishTicks = 0;
      k.queue = [];
      k.starved = 0;
      k.bumpCooldown = 0;
      k.interp.reset();
      if (k.brain) k.brain = newBrain(k.slot, this.aiLevel);
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

  /**
   * @param times  Rennzeit (Ticks seit "Los") je Eingabe, so wie der Mitspieler sie gerechnet hat;
   *               ohne Angabe gilt die Rennzeit des Hosts
   * @param raceId Nummer des Rennens, für das die Eingaben gedacht sind – Pakete aus
   *               einem anderen Rennen (verspätet nach einem Neustart) werden verworfen
   */
  receiveCmds(slot: number, newestSeq: number, cmds: Cmd[], times?: number[], raceId?: number): void {
    const k = this.karts.get(slot);
    if (!k || k.local || k.bot) return;
    if (raceId !== undefined && raceId !== this.raceId) return;
    const first = newestSeq - cmds.length + 1;
    const now = this.tick - this.goTick;
    for (let i = 0; i < cmds.length; i++) {
      const seq = first + i;
      if (seq > k.lastSeq) {
        k.queue.push({ seq, cmd: cmds[i], time: times?.[i] ?? now });
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
    const raceTime = this.tick - this.goTick;

    // Bezugspunkt für den Tempo-Ausgleich der KI: der beste Mensch, der noch fährt.
    let humanBest = Number.NEGATIVE_INFINITY;
    for (const k of this.karts.values()) if (!k.bot && !k.finished) humanBest = Math.max(humanBest, k.progress);

    const others: KartState[] = [];
    for (const k of this.karts.values()) {
      if (k.bumpCooldown > 0) k.bumpCooldown--;
      const canDrive = running && !k.finished;
      this.env.canDrive = canDrive;
      this.env.speedFactor = 1;
      this.env.time = raceTime;

      if (k.local) {
        copyState(k.prev, k.state);
        this.advance(k, localCmd);
        continue;
      }

      if (k.bot || (!k.online && k.starved > TAKEOVER_TICKS)) {
        // KI-Gegner – oder ein getrennter Mitspieler, für den die KI einspringt.
        if (!k.brain) k.brain = newBrain(k.slot, this.aiLevel);
        others.length = 0;
        for (const o of this.karts.values()) if (o !== k && !o.finished) others.push(o.state);
        const band =
          k.bot && humanBest > Number.NEGATIVE_INFINITY ? rubberBand((k.progress - humanBest) * TRACK.step, this.aiLevel) : 1;
        this.botCtx.tick = this.tick;
        this.botCtx.time = raceTime;
        this.botCtx.place = k.place;
        this.botCtx.smoke = this.inSmoke(k.state);
        this.env.speedFactor = k.brain.skill * band * (this.botCtx.smoke ? 0.85 : 1);
        copyState(k.prev, k.state);
        const cmd = botCmd(k.state, k.brain, others, canDrive, this.botCtx);
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
        // Nach einem Hänger (hier oder beim Mitspieler) staut sich mehr, als sich aufholen lässt: das Älteste fällt weg.
        // Ein Item-Druck dauert oft nur einen Schritt – der darf dabei nicht verloren gehen.
        const drop = k.queue.length - QUEUE_TRIM_TO;
        let item = false;
        for (let i = 0; i < drop; i++) if ((k.queue[i].cmd.buttons & BTN_ITEM) !== 0) item = true;
        k.queue.splice(0, drop);
        k.cmdsDropped += drop;
        const head = k.queue[0];
        if (item && (head.cmd.buttons & BTN_ITEM) === 0) head.cmd = { steer: head.cmd.steer, buttons: head.cmd.buttons | BTN_ITEM };
      }
      const n = Math.min(k.queue.length, MAX_CMDS_PER_TICK);
      if (n > 0) {
        for (let i = 0; i < n; i++) {
          const entry = k.queue.shift()!;
          this.env.canDrive = canDrive && !k.finished;
          // Der Mitspieler hat diesen Schritt mit seiner Rennzeit vorhergesagt – der Host rechnet ihn mit derselben nach.
          this.env.time = Math.max(raceTime - TIME_SLACK, Math.min(raceTime + TIME_SLACK, entry.time));
          this.advance(k, entry.cmd);
          k.ack = entry.seq;
        }
        k.starved = 0;
      } else {
        k.starved++;
        this.env.time = raceTime;
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
      track: TRACK.index,
      karts,
      things: this.thingList,
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
      hostTick: this.tick + frac,
      time: this.tick - this.goTick + frac,
    };
  }

  standings(): Standing[] {
    const list: Standing[] = [];
    for (const k of this.karts.values()) {
      list.push({ slot: k.slot, bot: k.bot, place: k.place, lap: k.lap, finished: k.finished, finishTicks: k.finishTicks });
    }
    return list.sort((a, b) => a.place - b.place);
  }

  things(): SnapshotThing[] {
    return this.thingList;
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
    if (k) this.applyHit(k);
  }

  /**
   * Nur für Tests: ein Kart an eine Stelle der Strecke setzen – Meter hinter
   * der Startlinie bzw., mit branch ≥ 0, Meter hinter der Gabelung dieser Abzweigung.
   */
  /**
   * Nur für Tests: beendet das laufende Rennen sofort. order nennt die Plätze (slots) in der
   * Reihenfolge des Zieleinlaufs; wer fehlt, folgt im aktuellen Stand des Rennens.
   */
  debugFinish(order: number[] = []): void {
    if (this.phase !== RACE_RUNNING) return;
    this.rank();
    const rest = [...this.karts.values()]
      .sort((a, b) => a.place - b.place)
      .map((k) => k.slot)
      .filter((slot) => !order.includes(slot));
    let n = 0;
    for (const slot of [...order, ...rest]) {
      const k = this.karts.get(slot);
      if (!k) continue;
      k.finished = true;
      k.finishTicks = Math.max(1, this.tick - this.goTick) + n++;
    }
    if (this.firstFinishTick < 0) this.firstFinishTick = this.tick;
    this.resultsAtTick = this.tick;
    this.rank();
  }

  debugPlace(slot: number, meters: number, lat = 0, branch = -1, up = 0): void {
    const k = this.karts.get(slot);
    if (!k) return;
    const t = TRACK;
    const br = t.branches[branch];
    const seg = br ? br.first + Math.max(0, Math.min(br.count - 1, Math.round(meters / t.step) - 1)) : wrapSeg(t, Math.round(meters / t.step));
    const before = k.state.seg;
    k.state.seg = seg;
    k.state.x = t.px[seg] + rightX(t, seg) * lat;
    k.state.z = t.pz[seg] + rightZ(t, seg) * lat;
    // up: so viele Meter über der Fahrbahn loslassen (das Kart fällt oder sinkt dann von dort)
    k.state.y = t.py[seg] + lat * t.bank[seg] + up;
    k.state.heading = Math.atan2(t.tx[seg], t.tz[seg]);
    k.state.vx = k.state.vy = k.state.vz = 0;
    k.progress = addProgress(t, k.progress, before, seg);
    copyState(k.prev, k.state);
  }

  // -----------------------------------------------------------------------

  /** Figur eines Platzes: Menschen fahren ihre Wahl, KI-Gegner die Figur ihres Platzes. */
  private charOf(slot: number, bot: boolean): number {
    const c = bot ? undefined : this.chars[slot];
    return c === undefined || c < 0 ? slot % CHARACTERS.length : c % CHARACTERS.length;
  }

  private createKart(slot: number, bot: boolean): HostKart {
    const state = gridState(slot, this.charOf(slot, bot));
    return {
      slot,
      local: slot === this.localSlot && !bot,
      bot,
      online: true,
      brain: bot ? newBrain(slot, this.aiLevel) : null,
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
      progress: progDelta(TRACK, 0, state.seg),
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
    k.progress = addProgress(TRACK, k.progress, before, k.state.seg);

    if (ev & EV_USE_TIRE) this.spawnTire(k);
    if (ev & EV_USE_OIL) this.spawnDrop(k, THING_OIL);
    if (ev & EV_USE_SMOKE) this.spawnDrop(k, THING_SMOKE);
    if (ev & EV_USE_TOP) this.spawnTop(k);
    if (ev & EV_USE_EMP) this.shortCircuit(k);
    if (ev & EV_USE_KITE) this.fx(k, 'boost');
    if (ev & (EV_USE_BOOST | EV_TURBO | EV_PAD | EV_DRAFT)) this.fx(k, 'boost');
    // Treffer durch die Strecke selbst (Verkehr, Geysir, Lavabombe) sagt der Bildschirm eines
    // Mitspielers selbst vorher und meldet sie dort – von hier aus nur für das eigene Kart.
    if (k.local && ev & (EV_HIT | EV_FLAT)) this.fx(k, 'hit');
    if (k.local && ev & EV_BLOCK) this.fx(k, 'block');
    if (ev & EV_ITEM_READY) this.fx(k, 'item');
    if (ev & EV_WALL) this.fx(k, 'wall');
    if (ev & EV_LAND) this.fx(k, 'land');
    if (ev & EV_FALL) this.fx(k, 'fall');

    if (!k.finished && this.phase === RACE_RUNNING && k.progress >= this.laps * TRACK.n) {
      k.finished = true;
      k.finishTicks = this.tick - this.goTick;
      if (this.firstFinishTick < 0) this.firstFinishTick = this.tick;
      this.fx(k, 'finish');
    }
    const lap = Math.max(1, Math.min(this.laps, Math.floor(k.progress / TRACK.n) + 1));
    if (lap > k.lap && !k.finished) this.fx(k, lap === this.laps ? 'finallap' : 'lap');
    // Die Runde zählt nie zurück, auch wenn jemand rückwärts über die Linie rollt.
    if (lap > k.lap) k.lap = lap;
  }

  private random(): number {
    this.rand = (this.rand * 16807) % 2147483647;
    return this.rand / 2147483647;
  }

  /** Wer vorn liegt, bekommt eher Abwehr; wer hinten liegt, eher Schub und Angriff. */
  private pickItem(place: number, count: number, behind = 0): number {
    let table: number[];
    // Reihenfolge: Zisch, Rollreifen, Ölfleck, Brummkreisel, Stoßfänger, Kurzschluss, Nebelkerze, Sprungfeder, Abschleppdrache
    if (count <= 1) table = [40, 14, 8, 0, 10, 0, 6, 22, 0];
    else if (place === 1) table = [14, 8, 26, 0, 24, 0, 20, 8, 0];
    else if (place === count) table = [22, 14, 0, 24, 6, 14, 0, 10, 0];
    else table = [18, 20, 10, 16, 10, 6, 10, 10, 0];
    // Der Abschleppdrache ist die Aufholhilfe für Abgehängte: nur auf dem letzten Platz
    // (bei vier Fahrern auch dem vorletzten), und nur mit deutlichem Rückstand.
    if (count > 1 && behind > KITE_MIN_GAP) {
      if (place === count) table[8] = 22;
      else if (count >= 4 && place === count - 1) table[8] = 8;
    }
    const items = [ITEM_BOOST, ITEM_TIRE, ITEM_OIL, ITEM_TOP, ITEM_GUARD, ITEM_EMP, ITEM_SMOKE, ITEM_SPRING, ITEM_KITE];
    let total = 0;
    for (const w of table) total += w;
    let r = this.random() * total;
    for (let i = 0; i < table.length; i++) {
      r -= table[i];
      if (r < 0) return items[i];
    }
    return ITEM_BOOST;
  }

  /** Rückstand auf das Kart davor in Metern (0 für den Führenden). */
  private gapAhead(k: HostKart): number {
    let gap = Infinity;
    for (const o of this.karts.values()) {
      if (o !== k && o.progress > k.progress) gap = Math.min(gap, (o.progress - k.progress) * TRACK.step);
    }
    return gap === Infinity ? 0 : gap;
  }

  private addThing(kind: number, k: HostKart, x: number, y: number, z: number, life: number): Thing {
    // Zu viele derselben Art: das älteste verschwindet.
    let same = 0;
    for (const t of this.thingList) if (t.kind === kind) same++;
    if (same >= MAX_PER_KIND) {
      const i = this.thingList.findIndex((t) => t.kind === kind);
      this.thingList.splice(i, 1);
    }
    const thing: Thing = {
      id: this.newId(),
      kind,
      ttl: life / 60,
      x,
      y,
      z,
      vx: 0,
      vz: 0,
      seg: k.state.seg,
      owner: k.slot,
      safe: 0,
      life,
      bounces: 0,
      floating: 0,
      pos: 0,
      lat: 0,
      target: -1,
    };
    this.thingList.push(thing);
    return thing;
  }

  private spawnTire(k: HostKart): void {
    const fx = Math.sin(k.state.heading);
    const fz = Math.cos(k.state.heading);
    const tire = this.addThing(THING_TIRE, k, k.state.x + fx * 2.4, k.state.y + TIRE_RADIUS, k.state.z + fz * 2.4, TIRE_LIFE_TICKS);
    tire.vx = fx * TIRE_SPEED;
    tire.vz = fz * TIRE_SPEED;
    tire.safe = 20;
  }

  /** Ölfleck oder Rauchwolke: bleibt hinter dem Kart liegen. */
  private spawnDrop(k: HostKart, kind: number): void {
    const t = TRACK;
    const back = kind === THING_OIL ? 2.8 : 4;
    const x = k.state.x - Math.sin(k.state.heading) * back;
    const z = k.state.z - Math.cos(k.state.heading) * back;
    projectOnTrack(t, x, z, k.state.seg);
    const g = groundAt(t, proj.seg, proj.along, proj.lat);
    // Öl braucht Boden; Rauch hängt auch in der Luft.
    if (g === NO_GROUND && kind === THING_OIL) return;
    const drop = this.addThing(kind, k, x, g === NO_GROUND ? k.state.y : g, z, kind === THING_OIL ? OIL_LIFE_TICKS : SMOKE_LIFE_TICKS);
    drop.seg = proj.seg;
    drop.safe = 45;
  }

  /** Brummkreisel: saust die Strecke entlang und steuert auf das Kart vor dem Werfer zu. */
  private spawnTop(k: HostKart): void {
    const t = TRACK;
    projectOnTrack(t, k.state.x, k.state.z, k.state.seg);
    const top = this.addThing(THING_TOP, k, k.state.x, k.state.y + 0.6, k.state.z, TOP_LIFE_TICKS);
    // pos zählt die Meter seit dem Punkt des Abschnitts seg.
    top.seg = walk(t, proj.seg, 3);
    top.pos = 0;
    top.lat = proj.lat;
    top.safe = 30;
    for (const o of this.karts.values()) if (o.place === k.place - 1 && !o.finished) top.target = o.slot;
  }

  /** Kurzschluss: trifft alle, die vor dem Auslöser liegen (als Führender: alle anderen). */
  private shortCircuit(k: HostKart): void {
    for (const o of this.karts.values()) {
      if (o === k || o.finished) continue;
      if (k.place > 1 && o.place > k.place) continue;
      const r = stallKart(o.state);
      if (r === HIT_BLOCKED) this.fx(o, 'block');
      else if (r !== HIT_NONE) this.fx(o, 'stall');
    }
  }

  private applyHit(k: HostKart): void {
    const r = hitKart(k.state);
    if (r === HIT_BLOCKED) this.fx(k, 'block');
    else if (r !== HIT_NONE) this.fx(k, 'hit');
  }

  private inSmoke(s: KartState): boolean {
    for (const t of this.thingList) {
      if (t.kind === THING_SMOKE && Math.abs(t.y - s.y) < 4 && Math.hypot(t.x - s.x, t.z - s.z) < SMOKE_RADIUS) return true;
    }
    return false;
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
        if (k.finished || s.item !== ITEM_NONE || s.roulette > 0 || s.respawn > 0) continue;
        for (let i = 0; i < t.boxes.length; i++) {
          if (this.boxTimers[i] > 0) continue;
          const b = t.boxes[i];
          if (Math.abs(segDelta(t, b.seg, s.seg)) > 6 || Math.abs(s.y - b.y) > 2.5) continue;
          if (Math.hypot(s.x - b.x, s.z - b.z) < BOX_RADIUS) {
            this.boxTimers[i] = BOX_RESPAWN_TICKS;
            s.nextItem = this.pickItem(k.place, count, this.gapAhead(k));
            s.roulette = ROULETTE_TICKS;
            this.fx(k, 'pickup');
            break;
          }
        }
      }
      // Pendelnde Hindernisse
      for (const h of t.hazards) {
        const lat = hazardLat(h, this.tick);
        const hx = t.px[h.seg] + rightX(t, h.seg) * lat;
        const hz = t.pz[h.seg] + rightZ(t, h.seg) * lat;
        const hy = t.py[h.seg] + lat * t.bank[h.seg];
        for (const k of this.karts.values()) {
          if (k.finished || Math.abs(k.state.y - hy) > 1.6) continue;
          if (Math.hypot(k.state.x - hx, k.state.z - hz) < HAZARD_RADIUS + KART_RADIUS) this.applyHit(k);
        }
      }
    }

    for (let i = this.thingList.length - 1; i >= 0; i--) {
      const th = this.thingList[i];
      if (th.safe > 0) th.safe--;
      let gone = --th.life <= 0;
      th.ttl = th.life / 60;
      let radius = 0;
      let reach = 1.5;

      if (th.kind === THING_TIRE) {
        // Rollreifen: geradeaus, an der Bande abprallen
        th.x += th.vx * dt;
        th.z += th.vz * dt;
        projectOnTrack(t, th.x, th.z, th.seg);
        th.seg = proj.seg;
        const side = proj.lat > 0 ? 1 : -1;
        const limit = sideLimit(t, th.seg, side) - TIRE_RADIUS;
        if (Math.abs(proj.lat) > limit) {
          if ((t.edge[th.seg] & (side > 0 ? EDGE_OPEN_R : EDGE_OPEN_L)) === 0) {
            const nx = rightX(t, th.seg) * side;
            const nz = rightZ(t, th.seg) * side;
            const over = Math.abs(proj.lat) - limit;
            th.x -= nx * over;
            th.z -= nz * over;
            proj.lat = side * limit;
            const vn = th.vx * nx + th.vz * nz;
            if (vn > 0) {
              th.vx -= 2 * vn * nx;
              th.vz -= 2 * vn * nz;
              th.bounces++;
            }
          }
        }
        const g = groundAt(t, th.seg, proj.along, proj.lat);
        if (g === NO_GROUND) {
          // Über eine Kante oder Lücke hinaus: kurz weiterfliegen, dann ist er weg.
          th.y -= 0.12;
          if (++th.floating > 14) gone = true;
        } else {
          th.floating = 0;
          th.y = g + TIRE_RADIUS;
        }
        if (th.bounces > TIRE_BOUNCES) gone = true;
        // Am Verkehr zerschellt er.
        if (t.vehicles.length > 0 && trafficBlocks(t, th.x, th.y, th.z, TIRE_RADIUS, th.seg, this.tick - this.goTick)) gone = true;
        radius = KART_RADIUS + TIRE_RADIUS;
      } else if (th.kind === THING_OIL) {
        radius = OIL_RADIUS;
        reach = 0.6;
      } else if (th.kind === THING_TOP) {
        // Brummkreisel: der Strecke folgen, seitlich auf das Ziel zuhalten
        const target = th.target >= 0 ? this.karts.get(th.target) : undefined;
        // An einer Gabelung nimmt er den Weg, auf dem sein Ziel fährt.
        const onBranch = target ? t.branchOf[target.state.seg] : -1;
        th.pos += TOP_SPEED * dt;
        while (th.pos >= t.step) {
          th.pos -= t.step;
          th.seg = walk(t, th.seg, 1, onBranch >= 0 ? 1 << onBranch : 0);
        }
        let wantLat = 0;
        let rate = 4;
        if (target && !target.finished) {
          const d = segDelta(t, th.seg, target.state.seg) * t.step;
          if (d < -8) {
            // Vorbei: noch ein Stück geradeaus, dann aus.
            th.target = -1;
            th.life = Math.min(th.life, 40);
          } else if (d < 50) {
            projectOnTrack(t, target.state.x, target.state.z, target.state.seg);
            wantLat = proj.lat;
            rate = 11;
          }
        }
        const maxLat = t.wh[th.seg] - 1;
        const dl = Math.max(-rate * dt, Math.min(rate * dt, wantLat - th.lat));
        th.lat = Math.max(-maxLat, Math.min(maxLat, th.lat + dl));
        const along = th.pos;
        th.x = t.px[th.seg] + t.tx[th.seg] * along + rightX(t, th.seg) * th.lat;
        th.z = t.pz[th.seg] + t.tz[th.seg] * along + rightZ(t, th.seg) * th.lat;
        th.y = centerHeight(t, th.seg, along) + th.lat * t.bank[th.seg] + 0.6;
        th.vx = t.tx[th.seg] * TOP_SPEED;
        th.vz = t.tz[th.seg] * TOP_SPEED;
        radius = TOP_RADIUS;
        reach = 2;
      }

      if (!gone && radius > 0) {
        for (const k of this.karts.values()) {
          if (k.finished || (k.slot === th.owner && th.safe > 0)) continue;
          // Der Brummkreisel verschont seinen Werfer ganz.
          if (th.kind === THING_TOP && k.slot === th.owner) continue;
          const dy = k.state.y - (th.kind === THING_OIL ? th.y : th.y - 0.6);
          if (dy > reach || dy < -reach) continue;
          if (Math.hypot(k.state.x - th.x, k.state.z - th.z) < radius) {
            if (k.state.respawn > 0) continue;
            this.applyHit(k);
            gone = true;
            break;
          }
        }
      }
      if (gone) this.thingList.splice(i, 1);
    }
  }

  /** Ein gezogenes Kart schiebt ein anderes quer aus seiner Bahn – ohne Dreher, aber mit Schwung. */
  private sweepAside(tow: HostKart, other: HostKart): void {
    const a = tow.state;
    const b = other.state;
    if (Math.abs(a.y - b.y) > 2.6 || Math.hypot(b.x - a.x, b.z - a.z) > KART_RADIUS * 2 + 0.5) return;
    // Seite, auf der das andere Kart relativ zur Flugrichtung liegt
    const rx = -Math.cos(a.heading);
    const rz = Math.sin(a.heading);
    const side = (b.x - a.x) * rx + (b.z - a.z) * rz >= 0 ? 1 : -1;
    b.x += rx * side * 0.5;
    b.z += rz * side * 0.5;
    b.vx += rx * side * 9;
    b.vz += rz * side * 9;
    if (other.bumpCooldown === 0) {
      other.bumpCooldown = 30;
      this.fx(other, 'bump');
    }
  }

  /** Rempler: Karts schieben sich auseinander und tauschen Tempo entlang der Stoßrichtung. */
  private collideKarts(): void {
    const list = [...this.karts.values()];
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        if (a.finished || b.finished || a.state.respawn > 0 || b.state.respawn > 0) continue;
        // Wer am Drachen hängt, fegt die anderen beiseite und wird selbst nicht aufgehalten.
        if (a.state.tow > 0 || b.state.tow > 0) {
          if (a.state.tow > 0 !== b.state.tow > 0) this.sweepAside(a.state.tow > 0 ? a : b, a.state.tow > 0 ? b : a);
          continue;
        }
        // Auf der Brücke und darunter begegnet man sich nicht.
        if (Math.abs(a.state.y - b.state.y) > 1.6) continue;
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
          // Schwere Figuren werden weniger weggeschoben als leichte.
          const ma = (CHARACTERS[a.state.char] ?? CHARACTERS[0]).mass;
          const mb = (CHARACTERS[b.state.char] ?? CHARACTERS[0]).mass;
          const impulse = (-(1 + 0.45) * rel) / (1 / ma + 1 / mb);
          a.state.vx -= (impulse / ma) * nx;
          a.state.vz -= (impulse / ma) * nz;
          b.state.vx += (impulse / mb) * nx;
          b.state.vz += (impulse / mb) * nz;
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
