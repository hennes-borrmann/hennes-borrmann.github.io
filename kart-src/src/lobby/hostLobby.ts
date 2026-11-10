// Die Lobby auf dem Bildschirm des Erstellers. Er ist die einzige Quelle der
// Wahrheit: Plätze, Namen, Bereit-Status und Spielphase.
//
// Jeder Spieler weist sich mit einem geheimen Token aus. Fällt seine
// Verbindung aus, bleibt sein Platz reserviert; meldet sich dasselbe Token
// wieder, bekommt er genau diesen Platz zurück.

import { BUILD_ID } from '../build';
import type { Link } from '../net/link';
import {
  PROTOCOL_VERSION,
  type HostToScreen,
  type LobbyPlayer,
  type LobbyState,
  type Phase,
  type RejectReason,
  type ScreenToHost,
} from '../net/protocol';
import { MAX_PLAYERS } from '../game/sim';

/** In der Lobby wird ein getrennter Spieler nach dieser Zeit entfernt. */
const LOBBY_GRACE_MS = 45_000;
const HELLO_TIMEOUT_MS = 8000;
export const MAX_NAME_LENGTH = 14;

interface Seat {
  slot: number;
  token: string;
  name: string;
  isHost: boolean;
  link: Link | null;
  ready: boolean;
  controller: boolean;
  ctrlRtt: number;
  offlineSince: number | null;
}

export interface HostLobbySave {
  code: string;
  seats: { slot: number; token: string; name: string; isHost: boolean }[];
}

export function cleanName(raw: unknown, fallback: string): string {
  const name = String(raw ?? '')
    .replace(/[\u0000-\u001f<>]/g, '')
    .trim()
    .slice(0, MAX_NAME_LENGTH);
  return name || fallback;
}

export class HostLobby {
  phase: Phase = 'lobby';
  readonly localSlot: number;

  /** Irgendetwas an der Lobby hat sich geändert (für die Anzeige). */
  onChange: (() => void) | null = null;
  /** Ein Platz wurde vergeben oder freigegeben. */
  onSeatsChanged: (() => void) | null = null;
  /** Ein Spieler hat sich (neu) verbunden. */
  onPlayerLink: ((slot: number) => void) | null = null;
  onFast: ((slot: number, view: DataView) => void) | null = null;

  private readonly seats: (Seat | null)[] = new Array(MAX_PLAYERS).fill(null);
  private readonly timer: number;
  private closed = false;

  constructor(
    readonly code: string,
    localToken: string,
    localName: string,
    saved?: HostLobbySave,
  ) {
    if (saved && saved.code === code) {
      // Nach einem Neuladen des Host-Bildschirms: Plätze wiederherstellen,
      // damit die anderen beim automatischen Wiederverbinden ihren Platz finden.
      for (const s of saved.seats) {
        if (s.slot < 0 || s.slot >= MAX_PLAYERS) continue;
        this.seats[s.slot] = {
          slot: s.slot,
          token: s.token,
          name: s.name,
          isHost: s.isHost,
          link: null,
          ready: false,
          controller: false,
          ctrlRtt: -1,
          offlineSince: s.isHost ? null : Date.now(),
        };
      }
    }
    let own = this.seats.find((s) => s?.isHost) ?? null;
    if (!own) {
      own = this.newSeat(0, localToken, localName, true);
      this.seats[0] = own;
    }
    own.name = cleanName(localName, 'Host');
    this.localSlot = own.slot;
    this.timer = window.setInterval(() => this.housekeeping(), 1000);
  }

  /** Eine eingehende Bildschirm-Verbindung annehmen. Der Platz wird erst nach 'hello' vergeben. */
  accept(link: Link): void {
    if (this.closed) {
      link.close();
      return;
    }
    const timeout = window.setTimeout(() => link.close(), HELLO_TIMEOUT_MS);
    link.onMessage = (raw) => {
      const msg = raw as ScreenToHost;
      if (msg.t !== 'hello') return;
      window.clearTimeout(timeout);
      this.handleHello(link, msg);
    };
    link.onClose = () => window.clearTimeout(timeout);
  }

  state(): LobbyState {
    const players: LobbyPlayer[] = [];
    for (const s of this.seats) {
      if (!s) continue;
      players.push({
        slot: s.slot,
        name: s.name,
        isHost: s.isHost,
        online: s.isHost || s.link !== null,
        controller: s.controller,
        ctrlRtt: s.ctrlRtt,
        ready: s.ready,
        ping: s.isHost ? 0 : s.link ? Math.round(s.link.rtt) : -1,
      });
    }
    return { code: this.code, phase: this.phase, players };
  }

  slots(): number[] {
    return this.seats.filter((s): s is Seat => s !== null).map((s) => s.slot);
  }

  linkOf(slot: number): Link | null {
    return this.seats[slot]?.link ?? null;
  }

  setLocalName(name: string): void {
    const own = this.seats[this.localSlot]!;
    own.name = cleanName(name, 'Host');
    this.changed();
  }

  setLocalReady(ready: boolean): void {
    this.seats[this.localSlot]!.ready = ready;
    this.changed();
  }

  setLocalController(connected: boolean, rtt: number): void {
    const own = this.seats[this.localSlot]!;
    const rounded = Math.round(rtt);
    if (own.controller === connected && own.ctrlRtt === rounded) return;
    own.controller = connected;
    own.ctrlRtt = rounded;
    this.changed();
  }

  /** Alle verbundenen Mitspieler bereit? Der Host selbst zählt über den Start-Knopf. */
  canStart(): boolean {
    return this.seats.every((s) => !s || s.isHost || !s.link || s.ready);
  }

  setPhase(phase: Phase): void {
    if (this.phase === phase) return;
    this.phase = phase;
    if (phase === 'lobby') for (const s of this.seats) if (s) s.ready = false;
    this.changed();
  }

  broadcastFast(buf: ArrayBuffer): void {
    for (const s of this.seats) s?.link?.sendFast(buf);
  }

  /** Lobby bewusst schließen: alle bekommen eine eindeutige Meldung. */
  close(): void {
    if (this.closed) return;
    this.closed = true;
    window.clearInterval(this.timer);
    for (const s of this.seats) {
      const link = s?.link;
      if (!link) continue;
      link.onClose = null;
      this.sendTo(link, { t: 'closed' });
      window.setTimeout(() => link.close(), 400);
    }
  }

  /**
   * Alle Verbindungen sofort kappen, ohne die Plätze freizugeben (Seite wird
   * verlassen oder neu geladen). Die anderen merken es so nach Sekundenbruchteilen
   * statt erst nach dem Zeitlimit und beginnen gleich mit dem Wiederverbinden.
   */
  dropLinks(): void {
    for (const s of this.seats) s?.link?.close();
  }

  toSave(): HostLobbySave {
    return {
      code: this.code,
      seats: this.seats
        .filter((s): s is Seat => s !== null)
        .map((s) => ({ slot: s.slot, token: s.token, name: s.name, isHost: s.isHost })),
    };
  }

  // ---------------------------------------------------------------------

  private newSeat(slot: number, token: string, name: string, isHost: boolean): Seat {
    return {
      slot,
      token,
      name,
      isHost,
      link: null,
      ready: false,
      controller: false,
      ctrlRtt: -1,
      offlineSince: null,
    };
  }

  private sendTo(link: Link, msg: HostToScreen): void {
    link.send(msg as unknown as Record<string, unknown>);
  }

  private reject(link: Link, reason: RejectReason): void {
    link.onClose = null;
    this.sendTo(link, { t: 'reject', reason });
    window.setTimeout(() => link.close(), 400);
  }

  private handleHello(link: Link, msg: Extract<ScreenToHost, { t: 'hello' }>): void {
    if (msg.v !== PROTOCOL_VERSION) {
      this.reject(link, 'version');
      return;
    }
    const token = String(msg.token ?? '');
    if (token.length < 8) {
      this.reject(link, 'version');
      return;
    }

    let seat = this.seats.find((s) => s !== null && s.token === token && !s.isHost) ?? null;
    let isNew = false;
    if (!seat) {
      if (this.phase !== 'lobby') {
        this.reject(link, 'running');
        return;
      }
      const free = this.seats.findIndex((s) => s === null);
      if (free < 0) {
        this.reject(link, 'full');
        return;
      }
      seat = this.newSeat(free, token, cleanName(msg.name, `Spieler ${free + 1}`), false);
      this.seats[free] = seat;
      isNew = true;
    } else {
      seat.name = cleanName(msg.name, seat.name);
      const old = seat.link;
      if (old && old !== link) {
        // Derselbe Spieler kommt über eine neue Verbindung; die alte ist tot oder ein zweiter Tab.
        old.onClose = null;
        old.onMessage = null;
        old.onFast = null;
        this.sendTo(old, { t: 'replaced' });
        window.setTimeout(() => old.close(), 400);
      }
    }

    const s = seat;
    s.link = link;
    s.offlineSince = null;
    link.onMessage = (raw) => this.handleSeatMessage(s, link, raw as ScreenToHost);
    link.onFast = (view) => this.onFast?.(s.slot, view);
    link.onClose = () => {
      if (s.link !== link) return;
      s.link = null;
      s.offlineSince = Date.now();
      s.controller = false;
      s.ctrlRtt = -1;
      this.changed();
    };

    this.sendTo(link, { t: 'welcome', slot: s.slot, state: this.state(), build: BUILD_ID });
    if (isNew) this.onSeatsChanged?.();
    this.onPlayerLink?.(s.slot);
    this.changed();
  }

  private handleSeatMessage(seat: Seat, link: Link, msg: ScreenToHost): void {
    if (seat.link !== link) return;
    switch (msg.t) {
      case 'ready':
        seat.ready = !!msg.v;
        this.changed();
        break;
      case 'name':
        seat.name = cleanName(msg.v, seat.name);
        this.changed();
        break;
      case 'status': {
        const controller = !!msg.controller;
        const rtt = Number.isFinite(msg.ctrlRtt) ? Math.round(msg.ctrlRtt) : -1;
        if (seat.controller !== controller || seat.ctrlRtt !== rtt) {
          seat.controller = controller;
          seat.ctrlRtt = rtt;
          this.changed();
        }
        break;
      }
      case 'leave':
        link.onClose = null;
        this.removeSeat(seat);
        window.setTimeout(() => link.close(), 200);
        break;
      default:
        break;
    }
  }

  private removeSeat(seat: Seat): void {
    if (this.seats[seat.slot] !== seat) return;
    this.seats[seat.slot] = null;
    seat.link = null;
    this.onSeatsChanged?.();
    this.changed();
  }

  private housekeeping(): void {
    if (this.closed) return;
    if (this.phase === 'lobby') {
      const now = Date.now();
      for (const s of this.seats) {
        if (s && !s.isHost && !s.link && s.offlineSince !== null && now - s.offlineSince > LOBBY_GRACE_MS) {
          this.removeSeat(s);
        }
      }
    }
    // Regelmäßig senden, damit alle die aktuellen Ping-Werte sehen.
    this.changed();
  }

  private changed(): void {
    if (this.closed) return;
    const state = this.state();
    for (const s of this.seats) if (s?.link) this.sendTo(s.link, { t: 'lobby', state });
    this.onChange?.();
  }
}
