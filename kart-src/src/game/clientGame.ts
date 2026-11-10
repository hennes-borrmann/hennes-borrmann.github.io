// Spiel aus Sicht eines Bildschirms, der nicht Host ist.
//
// Eigenes Fahrzeug: Vorhersage. Jede Eingabe wird sofort lokal ausgeführt und
// nummeriert an den Host geschickt. Kommt ein Snapshot, setzen wir auf den
// Stand des Hosts zurück und spielen alle Eingaben erneut ab, die er noch
// nicht verarbeitet hat (Reconciliation). Weicht das Ergebnis von der
// bisherigen Vorhersage ab, wird der Unterschied nicht als Sprung gezeigt,
// sondern über kurze Zeit ausgeblendet.
//
// Fremde Fahrzeuge: Interpolation leicht in der Vergangenheit (interp.ts).

import { CMD_REDUNDANCY, encodeCmds, type Snapshot } from '../net/protocol';
import { EntityInterp, lerpState } from './interp';
import { copyState, newState, stepKart, type Cmd, type KartState } from './sim';
import type { GameView, RenderEntity } from './view';

/** Abspielverzögerung fremder Fahrzeuge (Sekunden). */
export const CLIENT_INTERP_DELAY = 0.085;
/** Über diese Zeit klingt ein Vorhersagefehler in der Darstellung ab. */
const ERROR_FADE = 0.1;
/** Größere Abweichungen werden nicht ausgeblendet, sondern sofort übernommen. */
const SNAP_DISTANCE = 5;
const MAX_PENDING = 180;

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

  private seq = 0;
  private pending: { seq: number; cmd: Cmd }[] = [];
  private readonly predicted = newState();
  private readonly prev = newState();
  private readonly replay = newState();
  private readonly scratch = newState();
  private readonly err = { x: 0, z: 0, y: 0, h: 0 };
  private readonly remotes = new Map<number, EntityInterp>();
  private lastSnapTick = -1;
  private hardSync = true;

  constructor(readonly localSlot: number) {}

  /** Nach einem Verbindungsabbruch: nächsten Snapshot ohne Abgleich übernehmen. */
  resync(): void {
    this.hardSync = true;
    this.lastSnapTick = -1;
    this.pending = [];
  }

  /** Ein Simulationsschritt mit der aktuellen Eingabe. Liefert das Paket für den Host. */
  tick(cmd: Cmd): ArrayBuffer | null {
    if (!this.ready) return null;
    this.seq++;
    this.pending.push({ seq: this.seq, cmd: { steer: cmd.steer, buttons: cmd.buttons } });
    if (this.pending.length > MAX_PENDING) this.pending.shift();
    copyState(this.prev, this.predicted);
    stepKart(this.predicted, cmd);
    this.stats.pending = this.pending.length;
    const recent = this.pending.slice(-CMD_REDUNDANCY).map((p) => p.cmd);
    return encodeCmds(this.seq, recent);
  }

  onSnapshot(snap: Snapshot, nowSec: number): void {
    // Der Kanal ist ungeordnet: ältere Snapshots einfach ignorieren.
    if (snap.tick <= this.lastSnapTick) return;
    this.lastSnapTick = snap.tick;
    this.stats.snapshots++;

    const seen = new Set<number>();
    for (const p of snap.players) {
      seen.add(p.slot);
      if (p.slot === this.localSlot) {
        this.reconcile(p.state, p.ack);
        continue;
      }
      let interp = this.remotes.get(p.slot);
      if (!interp) this.remotes.set(p.slot, (interp = new EntityInterp(CLIENT_INTERP_DELAY)));
      interp.push(p.ptick, p.state, nowSec);
    }
    for (const slot of [...this.remotes.keys()]) if (!seen.has(slot)) this.remotes.delete(slot);
  }

  entities(alpha: number, nowSec: number, dtSec: number, out: RenderEntity[]): void {
    out.length = 0;
    if (this.ready) {
      const fade = Math.exp(-dtSec / ERROR_FADE);
      this.err.x *= fade;
      this.err.z *= fade;
      this.err.y *= fade;
      this.err.h *= fade;
      const s = lerpState(this.scratch, this.prev, this.predicted, alpha);
      out.push({
        slot: this.localSlot,
        x: s.x + this.err.x,
        y: Math.max(0, s.y + this.err.y),
        z: s.z + this.err.z,
        heading: s.heading + this.err.h,
        speed: s.speed,
        flags: s.flags,
      });
    }
    let underruns = 0;
    for (const [slot, interp] of this.remotes) {
      if (!interp.sample(nowSec, dtSec, this.scratch)) continue;
      underruns += interp.underruns;
      const s = this.scratch;
      out.push({ slot, x: s.x, y: s.y, z: s.z, heading: s.heading, speed: s.speed, flags: s.flags });
    }
    this.stats.underruns = underruns;
  }

  /** Vorhergesagter eigener Zustand (für Tests und Diagnose). */
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
      this.err.x = this.err.z = this.err.y = this.err.h = 0;
      return;
    }
    while (this.pending.length > 0 && this.pending[0].seq <= ack) this.pending.shift();

    const r = copyState(this.replay, auth);
    for (const p of this.pending) stepKart(r, p.cmd);

    const dx = this.predicted.x - r.x;
    const dz = this.predicted.z - r.z;
    const dy = this.predicted.y - r.y;
    const dh = wrapAngle(this.predicted.heading - r.heading);
    const dist = Math.hypot(dx, dz, dy);
    this.stats.lastCorrection = dist;
    if (dist > this.stats.peakCorrection) this.stats.peakCorrection = dist;

    // Die Darstellung bleibt, wo sie war (alter Stand = neuer Stand + Fehler),
    // und der Fehler klingt danach ab.
    this.err.x += dx;
    this.err.z += dz;
    this.err.y += dy;
    this.err.h += dh;
    this.prev.x -= dx;
    this.prev.z -= dz;
    this.prev.y -= dy;
    this.prev.heading -= dh;
    copyState(this.predicted, r);

    if (Math.hypot(this.err.x, this.err.z, this.err.y) > SNAP_DISTANCE) {
      this.err.x = this.err.z = this.err.y = this.err.h = 0;
      copyState(this.prev, this.predicted);
    }
  }
}
