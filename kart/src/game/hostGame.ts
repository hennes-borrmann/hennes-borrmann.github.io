// Die maßgebliche Simulation auf dem Bildschirm des Lobby-Erstellers.
//
// Der Host rechnet alle Fahrzeuge. Eingaben fremder Spieler kommen als
// nummerierte Befehle an und werden genau in dieser Reihenfolge ausgeführt –
// ein Simulationsschritt pro Befehl. Dadurch stimmt der Stand des Hosts nach
// Befehl N exakt mit dem überein, was der Client für Befehl N vorhergesagt hat.

import { encodeSnapshot, type SnapshotPlayer } from '../net/protocol';
import { EntityInterp, lerpState } from './interp';
import { copyState, newState, spawnState, stepKart, type Cmd, type KartState } from './sim';
import type { GameView, RenderEntity } from './view';

/** Abspielverzögerung fremder Fahrzeuge auf dem Host-Bildschirm (Sekunden). */
const HOST_INTERP_DELAY = 0.05;
/** Nach so vielen Ticks ohne Eingabe rollt ein Fahrzeug ohne Befehle aus. */
const STARVE_TICKS = 12;
/** Höchstens so viele Befehle eines Spielers pro Host-Tick nachholen. */
const MAX_CMDS_PER_TICK = 3;
const QUEUE_LIMIT = 30;
const QUEUE_TRIM_TO = 8;

const NEUTRAL: Cmd = { steer: 0, buttons: 0 };

interface HostPlayer {
  slot: number;
  local: boolean;
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
}

export class HostGame implements GameView {
  tick = 0;
  private readonly players = new Map<number, HostPlayer>();
  private readonly scratch = newState();

  constructor(readonly localSlot: number) {}

  /** Gleicht die Fahrzeuge mit der Spielerliste ab. Bestehende behalten ihren Stand. */
  syncPlayers(slots: number[]): void {
    for (const slot of slots) {
      if (this.players.has(slot)) continue;
      const state = spawnState(slot);
      this.players.set(slot, {
        slot,
        local: slot === this.localSlot,
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
      });
    }
    for (const slot of [...this.players.keys()]) {
      if (!slots.includes(slot)) this.players.delete(slot);
    }
  }

  /** Ein Spieler hat sich neu verbunden: seine Befehlszählung beginnt von vorn. */
  resetInput(slot: number): void {
    const p = this.players.get(slot);
    if (!p) return;
    p.queue = [];
    p.lastSeq = 0;
    p.ack = 0;
  }

  receiveCmds(slot: number, newestSeq: number, cmds: Cmd[]): void {
    const p = this.players.get(slot);
    if (!p || p.local) return;
    const first = newestSeq - cmds.length + 1;
    for (let i = 0; i < cmds.length; i++) {
      const seq = first + i;
      if (seq > p.lastSeq) {
        p.queue.push({ seq, cmd: cmds[i] });
        p.lastSeq = seq;
        p.cmdsIn++;
      }
    }
  }

  step(localCmd: Cmd): void {
    this.tick++;
    const now = performance.now() / 1000;
    for (const p of this.players.values()) {
      if (p.local) {
        copyState(p.prev, p.state);
        stepKart(p.state, localCmd);
        p.ptick++;
        continue;
      }
      if (p.queue.length > QUEUE_LIMIT) {
        const drop = p.queue.length - QUEUE_TRIM_TO;
        p.queue.splice(0, drop);
        p.cmdsDropped += drop;
      }
      const n = Math.min(p.queue.length, MAX_CMDS_PER_TICK);
      if (n > 0) {
        for (let i = 0; i < n; i++) {
          const entry = p.queue.shift()!;
          stepKart(p.state, entry.cmd);
          p.ack = entry.seq;
          p.ptick++;
        }
        p.starved = 0;
      } else {
        p.starved++;
        if (p.starved > STARVE_TICKS) {
          stepKart(p.state, NEUTRAL);
          p.ptick++;
        }
      }
      p.interp.push(p.ptick, p.state, now);
    }
  }

  snapshot(): ArrayBuffer {
    const players: SnapshotPlayer[] = [];
    for (const p of this.players.values()) {
      players.push({ slot: p.slot, ptick: p.ptick, ack: p.ack, state: p.state });
    }
    return encodeSnapshot({ tick: this.tick, players });
  }

  entities(alpha: number, nowSec: number, dtSec: number, out: RenderEntity[]): void {
    out.length = 0;
    for (const p of this.players.values()) {
      let s: KartState;
      if (p.local) {
        s = lerpState(this.scratch, p.prev, p.state, alpha);
      } else {
        if (!p.interp.sample(nowSec, dtSec, this.scratch)) continue;
        s = this.scratch;
      }
      out.push({ slot: p.slot, x: s.x, y: s.y, z: s.z, heading: s.heading, speed: s.speed, flags: s.flags });
    }
  }

  /** Für das Debug-Overlay: empfangene Befehle je Spieler seit dem letzten Abruf. */
  drainCmdCounts(): Map<number, { received: number; dropped: number; queued: number }> {
    const out = new Map<number, { received: number; dropped: number; queued: number }>();
    for (const p of this.players.values()) {
      if (p.local) continue;
      out.set(p.slot, { received: p.cmdsIn, dropped: p.cmdsDropped, queued: p.queue.length });
      p.cmdsIn = 0;
      p.cmdsDropped = 0;
    }
    return out;
  }

  /** Maßgeblicher Zustand eines Spielers (für Tests und Diagnose). */
  authoritative(slot: number): KartState | null {
    return this.players.get(slot)?.state ?? null;
  }
}
