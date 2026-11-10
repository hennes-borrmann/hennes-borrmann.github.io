// Rennen aus Sicht eines Bildschirms, der nicht Host ist.
//
// Eigenes Kart: Vorhersage. Jede Eingabe wird sofort lokal ausgeführt und
// nummeriert an den Host geschickt. Kommt ein Snapshot, setzen wir auf den
// Stand des Hosts zurück und spielen alle Eingaben erneut ab, die er noch
// nicht verarbeitet hat (Reconciliation). Weicht das Ergebnis von der
// bisherigen Vorhersage ab – etwa nach einem Rempler oder Treffer, den nur der
// Host kennt –, wird der Unterschied nicht als Sprung gezeigt, sondern über
// kurze Zeit ausgeblendet.
//
// Alles andere (fremde Karts, Kisten, Reifen, Ölflecken, Kreisel, Rauch, Rennstand) kommt vom
// Host und wird nur dargestellt; fremde Karts leicht in der Vergangenheit
// interpoliert (interp.ts).

import {
  CMD_REDUNDANCY,
  RACE_COUNTDOWN,
  RACE_RUNNING,
  encodeCmds,
  type FxKind,
  type Snapshot,
  type SnapshotKart,
  type SnapshotThing,
} from '../net/protocol';
import { EntityInterp, lerpState } from './interp';
import {
  DT,
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
  EV_WALL,
  TICK_RATE,
  copyState,
  newState,
  stepKart,
  type Cmd,
  type KartState,
  type StepEnv,
} from './sim';
import { TRACK } from './track';
import type { GameView, RaceView, RenderEntity, Standing } from './view';

/** Abspielverzögerung fremder Fahrzeuge (Sekunden). */
export const CLIENT_INTERP_DELAY = 0.085;
/** Über diese Zeit klingt ein Vorhersagefehler in der Darstellung ab. */
const ERROR_FADE = 0.1;
/** Größere Abweichungen werden nicht ausgeblendet, sondern sofort übernommen. */
const SNAP_DISTANCE = 6;
const MAX_PENDING = 180;

interface Pending {
  seq: number;
  cmd: Cmd;
  /** Durfte das Kart bei dieser Eingabe fahren? Muss beim erneuten Abspielen gleich bleiben. */
  canDrive: boolean;
  /** Rennzeit dieses Schritts (Ticks seit "Los") – der Host rechnet ihn mit derselben nach. */
  time: number;
}

interface Remote {
  interp: EntityInterp;
  info: SnapshotKart;
}

function wrapAngle(a: number): number {
  if (a > Math.PI) return a - 2 * Math.PI;
  if (a < -Math.PI) return a + 2 * Math.PI;
  return a;
}

export class ClientGame implements GameView {
  /** Hat der Host uns schon einen Stand geschickt? Vorher wird nichts gesendet. */
  ready = false;
  readonly stats = {
    snapshots: 0,
    /** Größe der letzten Korrektur in Metern. */
    lastCorrection: 0,
    /** Größte Korrektur seit dem letzten Abruf. */
    peakCorrection: 0,
    pending: 0,
    underruns: 0,
  };
  /** Sofort spürbare Ereignisse des eigenen Karts (aus der Vorhersage). */
  onFx: ((kind: FxKind) => void) | null = null;

  private seq = 0;
  private pending: Pending[] = [];
  private readonly predicted = newState();
  private readonly prev = newState();
  private readonly replay = newState();
  private readonly scratch = newState();
  private readonly env: StepEnv = { canDrive: false, speedFactor: 1, time: 0 };
  /**
   * Rennzeit des letzten eigenen Schritts. Sie zählt mit jedem Schritt um eins
   * weiter und wird nur sanft nachgeführt, wenn die Uhr des Hosts davonläuft –
   * so springt der Verkehr nicht.
   */
  private envTime = Number.NaN;
  private lastTickAt = 0;
  private readonly err = { x: 0, y: 0, z: 0, h: 0 };
  private readonly remotes = new Map<number, Remote>();
  private own: SnapshotKart | null = null;
  private lastSnapTick = -1;
  private hardSync = true;

  private raceId = -1;
  private phase = RACE_COUNTDOWN;
  private goTick = 0;
  private laps = 0;
  private boxes = 0;
  private thingList: SnapshotThing[] = [];
  private thingsAt = 0;
  /** Der Host fährt auf einer anderen Strecke als hier geladen (Index) – sonst -1. */
  wrongTrack = -1;
  /** Abbildung eigene Zeit → Host-Tick, bestimmt vom am wenigsten verspäteten Snapshot. */
  private clockOffset = Number.NaN;
  private couldDrive = false;

  /**
   * @param rttMs liefert die aktuelle Umlaufzeit zum Host – nötig, um den
   *              Countdown zeitgleich mit dem Host anzuzeigen.
   */
  constructor(
    readonly localSlot: number,
    private readonly rttMs: () => number,
  ) {}

  /** Nach einem Verbindungsabbruch: nächsten Snapshot ohne Abgleich übernehmen. */
  resync(): void {
    this.hardSync = true;
    this.lastSnapTick = -1;
    this.pending = [];
    this.clockOffset = Number.NaN;
    // Bis der Host wieder einen Stand geschickt hat, gibt es keinen Zeitbezug:
    // nichts vorhersagen und nichts senden (sonst gingen Eingaben mit falscher Rennzeit hinaus).
    this.ready = false;
    this.envTime = Number.NaN;
  }

  /** Geschätzter Host-Tick zum Zeitpunkt, an dem der Snapshot von "jetzt" beim Host losging. */
  private hostTick(nowSec: number): number {
    return Number.isNaN(this.clockOffset) ? 0 : (nowSec + this.clockOffset) * TICK_RATE;
  }

  private rttTicks(): number {
    const rtt = this.rttMs();
    return rtt > 0 ? Math.min(rtt, 500) * 0.06 : 0;
  }

  /**
   * Darf das eigene Kart fahren? Maßgeblich ist, was beim Host gilt, wenn die
   * Eingabe von jetzt dort ankommt – also eine Umlaufzeit nach dem Stand, den
   * wir vom Host kennen.
   */
  localCanDrive(nowSec: number): boolean {
    if (!this.own || this.own.finished) return false;
    if (this.phase === RACE_RUNNING) return true;
    if (this.phase === RACE_COUNTDOWN) return this.hostTick(nowSec) + this.rttTicks() >= this.goTick;
    return false;
  }

  /** Ein Simulationsschritt mit der aktuellen Eingabe. Liefert das Paket für den Host. */
  tick(cmd: Cmd, nowSec: number): ArrayBuffer | null {
    if (!this.ready) return null;
    const canDrive = this.localCanDrive(nowSec);
    if (canDrive && !this.couldDrive && this.phase === RACE_COUNTDOWN) this.onFx?.('go');
    this.couldDrive = canDrive;

    // Rennzeit, zu der diese Eingabe beim Host ankommt: sein bekannter Stand plus eine Umlaufzeit.
    const target = Math.round(this.hostTick(nowSec) + this.rttTicks()) - this.goTick;
    const next = this.envTime + 1;
    const off = target - next;
    this.envTime = Number.isNaN(next) || Math.abs(off) > 6 ? target : off >= 2 ? next + 1 : off <= -2 ? next - 1 : next;
    this.lastTickAt = nowSec;

    this.seq++;
    this.pending.push({ seq: this.seq, cmd: { steer: cmd.steer, buttons: cmd.buttons }, canDrive, time: this.envTime });
    if (this.pending.length > MAX_PENDING) this.pending.shift();
    copyState(this.prev, this.predicted);
    this.env.canDrive = canDrive;
    this.env.time = this.envTime;
    const ev = stepKart(this.predicted, cmd, this.env);
    if (ev & (EV_USE_BOOST | EV_TURBO | EV_PAD | EV_DRAFT)) this.onFx?.('boost');
    if (ev & (EV_HIT | EV_FLAT)) this.onFx?.('hit');
    if (ev & EV_BLOCK) this.onFx?.('block');
    if (ev & EV_WALL) this.onFx?.('wall');
    if (ev & EV_ITEM_READY) this.onFx?.('item');
    if (ev & EV_LAND) this.onFx?.('land');
    if (ev & EV_FALL) this.onFx?.('fall');

    this.stats.pending = this.pending.length;
    const recent = this.pending.slice(-CMD_REDUNDANCY);
    return encodeCmds(
      this.seq,
      recent.map((p) => p.cmd),
      recent.map((p) => p.time),
      this.raceId,
    );
  }

  onSnapshot(snap: Snapshot, nowSec: number): void {
    // Der Kanal ist ungeordnet: ältere Snapshots einfach ignorieren.
    if (snap.tick <= this.lastSnapTick) return;
    if (snap.track !== TRACK.index) {
      // Erst die richtige Strecke laden (macht die App), dann weiter.
      this.wrongTrack = snap.track;
      return;
    }
    this.wrongTrack = -1;
    this.lastSnapTick = snap.tick;
    this.stats.snapshots++;

    const offset = snap.tick * DT - nowSec;
    if (Number.isNaN(this.clockOffset) || offset > this.clockOffset || offset < this.clockOffset - 0.5) this.clockOffset = offset;

    if (snap.raceId !== this.raceId) {
      // Neues Rennen: alles steht wieder am Start – nichts ausblenden, hart übernehmen.
      this.raceId = snap.raceId;
      this.hardSync = true;
      this.couldDrive = false;
      this.envTime = Number.NaN;
      for (const r of this.remotes.values()) r.interp.reset();
    }
    this.phase = snap.phase;
    this.goTick = snap.goTick;
    this.laps = snap.laps;
    this.boxes = snap.boxes;
    this.thingList = snap.things;
    this.thingsAt = nowSec;

    const seen = new Set<number>();
    for (const k of snap.karts) {
      seen.add(k.slot);
      if (k.slot === this.localSlot) {
        this.own = k;
        this.reconcile(k.state, k.ack);
        continue;
      }
      let r = this.remotes.get(k.slot);
      if (!r) this.remotes.set(k.slot, (r = { interp: new EntityInterp(CLIENT_INTERP_DELAY), info: k }));
      r.info = k;
      r.interp.push(k.ptick, k.state, nowSec);
    }
    for (const slot of [...this.remotes.keys()]) if (!seen.has(slot)) this.remotes.delete(slot);
  }

  // --- GameView ----------------------------------------------------------

  entities(alpha: number, nowSec: number, dtSec: number, out: RenderEntity[]): void {
    out.length = 0;
    if (this.ready && this.own) {
      const fade = Math.exp(-dtSec / ERROR_FADE);
      this.err.x *= fade;
      this.err.y *= fade;
      this.err.z *= fade;
      this.err.h *= fade;
      const s = lerpState(this.scratch, this.prev, this.predicted, alpha);
      out.push({
        ...s,
        x: s.x + this.err.x,
        y: s.y + this.err.y,
        z: s.z + this.err.z,
        heading: s.heading + this.err.h,
        slot: this.localSlot,
        bot: false,
        lap: this.own.lap,
        place: this.own.place,
        finished: this.own.finished,
      });
    }
    let underruns = 0;
    for (const [slot, r] of this.remotes) {
      if (!r.interp.sample(nowSec, dtSec, this.scratch)) continue;
      underruns += r.interp.underruns;
      out.push({ ...this.scratch, slot, bot: r.info.bot, lap: r.info.lap, place: r.info.place, finished: r.info.finished });
    }
    this.stats.underruns = underruns;
  }

  race(nowSec: number): RaceView {
    // Für die Anzeige: Host-Zeit von jetzt = bekannter Stand + halbe Umlaufzeit.
    const tick = this.hostTick(nowSec) + this.rttTicks() / 2;
    return {
      raceId: this.raceId,
      phase: this.phase,
      laps: this.laps,
      untilGo: Number.isNaN(this.clockOffset) ? 99 : (this.goTick - tick) / TICK_RATE,
      boxes: this.boxes,
      hostTick: tick,
      // Der Verkehr wird im Takt des eigenen (vorhergesagten) Karts gezeichnet.
      time: Number.isNaN(this.envTime) ? tick - this.goTick : this.envTime + Math.min(1, Math.max(0, (nowSec - this.lastTickAt) * TICK_RATE)),
    };
  }

  standings(): Standing[] {
    const list: Standing[] = [];
    const add = (k: SnapshotKart): void => {
      list.push({ slot: k.slot, bot: k.bot, place: k.place, lap: k.lap, finished: k.finished, finishTicks: k.finishTicks });
    };
    if (this.own) add(this.own);
    for (const r of this.remotes.values()) add(r.info);
    return list.sort((a, b) => a.place - b.place);
  }

  /** Bewegte Dinge zwischen zwei Snapshots mit ihrer Geschwindigkeit weiterrechnen. */
  things(nowSec: number): SnapshotThing[] {
    const age = Math.min(0.12, Math.max(0, nowSec - this.thingsAt));
    return this.thingList.map((t) => (t.vx === 0 && t.vz === 0 ? t : { ...t, x: t.x + t.vx * age, z: t.z + t.vz * age }));
  }

  /** Vorhergesagter eigener Zustand. */
  predictedState(): KartState {
    return this.predicted;
  }

  private reconcile(auth: KartState, ack: number): void {
    if (this.hardSync) {
      this.hardSync = false;
      this.ready = true;
      copyState(this.predicted, auth);
      copyState(this.prev, auth);
      this.pending = [];
      this.err.x = this.err.y = this.err.z = this.err.h = 0;
      return;
    }
    while (this.pending.length > 0 && this.pending[0].seq <= ack) this.pending.shift();

    const r = copyState(this.replay, auth);
    for (const p of this.pending) {
      this.env.canDrive = p.canDrive;
      this.env.time = p.time;
      stepKart(r, p.cmd, this.env);
    }

    const dx = this.predicted.x - r.x;
    const dy = this.predicted.y - r.y;
    const dz = this.predicted.z - r.z;
    const dh = wrapAngle(this.predicted.heading - r.heading);
    const dist = Math.hypot(dx, dz);
    this.stats.lastCorrection = dist;
    if (dist > this.stats.peakCorrection) this.stats.peakCorrection = dist;

    // Die Darstellung bleibt, wo sie war (alter Stand = neuer Stand + Fehler),
    // und der Fehler klingt danach ab.
    this.err.x += dx;
    this.err.y += dy;
    this.err.z += dz;
    this.err.h += dh;
    this.prev.x -= dx;
    this.prev.y -= dy;
    this.prev.z -= dz;
    this.prev.heading -= dh;
    copyState(this.predicted, r);

    if (Math.hypot(this.err.x, this.err.z) > SNAP_DISTANCE) {
      this.err.x = this.err.y = this.err.z = this.err.h = 0;
      copyState(this.prev, this.predicted);
    }
  }
}
