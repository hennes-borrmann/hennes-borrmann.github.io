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
  type CupState,
  type FxKind,
  type HostToScreen,
  type LobbyPlayer,
  type LobbyState,
  type Phase,
  type RejectReason,
  type ScreenToHost,
} from '../net/protocol';
import { MAX_PLAYERS } from '../game/sim';
import { cleanCupRaces, cupOver, makeDraw, newCup, resetSlot, scoreRace } from './cup';

/** In der Lobby wird ein getrennter Spieler nach dieser Zeit entfernt. */
const LOBBY_GRACE_MS = 45_000;
const HELLO_TIMEOUT_MS = 8000;
export const MAX_NAME_LENGTH = 14;
/** Wählbare Rundenzahl in der Lobby. */
export const MIN_LAPS = 2;
export const MAX_LAPS = 5;
export const DEFAULT_LAPS = 3;

/** Rundenzahl auf MIN_LAPS..MAX_LAPS begrenzen. */
export function cleanLaps(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_LAPS;
  return Math.max(MIN_LAPS, Math.min(MAX_LAPS, Math.round(n)));
}

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
  /** Gewählte Figur (0..3). */
  character: number;
}

export interface HostLobbySave {
  code: string;
  seats: { slot: number; token: string; name: string; isHost: boolean; character?: number }[];
  bots?: boolean;
  aiLevel?: number;
  track?: number;
  laps?: number;
  cupRaces?: number;
  /** Stand eines laufenden Turniers (ohne Auslosung – die beginnt nach dem Neuladen von vorn). */
  cup?: CupState | null;
}

/** Gültige Figur 0..3; sonst der Rückfallwert (üblich: die Standardfigur des Platzes). */
export function cleanCharacter(raw: unknown, fallback: number): number {
  const n = typeof raw === 'number' && Number.isInteger(raw) && raw >= 0 && raw < 4 ? raw : fallback;
  return ((n % 4) + 4) % 4;
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
  /** Freie Plätze im Rennen mit KI-Gegnern auffüllen. */
  bots = true;
  /** Stärke der KI-Gegner: 0 leicht, 1 mittel, 2 schwer. */
  aiLevel = 1;
  /** Gewählte Strecke. */
  track = 0;
  /** Rundenzahl des Rennens. */
  laps = DEFAULT_LAPS;
  /** Einstellung: 0 = Einzelrennen, sonst die Zahl der Rennen eines Turniers. */
  cupRaces = 0;
  /** Das laufende (oder gerade beendete) Turnier. */
  cup: CupState | null = null;
  readonly localSlot: number;

  /** Irgendetwas an der Lobby hat sich geändert (für die Anzeige). */
  onChange: (() => void) | null = null;
  /** Ein Platz wurde vergeben oder freigegeben. */
  onSeatsChanged: (() => void) | null = null;
  /** Ein Spieler hat sich (neu) verbunden. */
  onPlayerLink: ((slot: number) => void) | null = null;
  /** Die Verbindung eines Spielers ist weg (sein Platz bleibt reserviert). */
  onPlayerDown: ((slot: number) => void) | null = null;
  onFast: ((slot: number, view: DataView) => void) | null = null;

  private readonly seats: (Seat | null)[] = new Array(MAX_PLAYERS).fill(null);
  private readonly timer: number;
  private closed = false;
  private drawId = 0;
  /** Im Turnier: Das laufende Rennen ist noch nicht gewertet. */
  private cupRaceOpen = false;

  constructor(
    readonly code: string,
    localToken: string,
    localName: string,
    saved?: HostLobbySave,
  ) {
    if (saved && saved.code === code) {
      if (typeof saved.bots === 'boolean') this.bots = saved.bots;
      if (typeof saved.aiLevel === 'number') this.aiLevel = Math.max(0, Math.min(2, saved.aiLevel | 0));
      if (typeof saved.track === 'number') this.track = Math.max(0, saved.track | 0);
      if (typeof saved.laps === 'number') this.laps = cleanLaps(saved.laps);
      this.cupRaces = cleanCupRaces(saved.cupRaces);
      if (saved.cup && Array.isArray(saved.cup.stars) && cleanCupRaces(saved.cup.races) > 0) this.cup = { ...saved.cup, draw: null };
      // Nach einem Neuladen des Host-Bildschirms: Plätze wiederherstellen,
      // damit die anderen beim automatischen Wiederverbinden ihren Platz finden.
      for (const s of saved.seats) {
        if (s.slot < 0 || s.slot >= MAX_PLAYERS) continue;
        this.seats[s.slot] = {
          slot: s.slot,
          token: s.token,
          name: s.name,
          isHost: s.isHost,
          character: cleanCharacter(s.character, s.slot),
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
        character: s.character,
        controller: s.controller,
        ctrlRtt: s.ctrlRtt,
        ready: s.ready,
        ping: s.isHost ? 0 : s.link ? Math.round(s.link.rtt) : -1,
      });
    }
    return {
      code: this.code,
      phase: this.phase,
      players,
      cupRaces: this.cupRaces,
      cup: this.cup,
      bots: this.bots,
      aiLevel: this.aiLevel,
      track: this.track,
      laps: this.laps,
    };
  }

  // --- Turnier -------------------------------------------------------------

  /** Einzelrennen (0) oder Turnier über 3, 5 oder 10 Rennen – nur, solange keines läuft. */
  setCupRaces(n: number): void {
    const races = cleanCupRaces(n);
    if (this.phase !== 'lobby' || (this.cup && !cupOver(this.cup)) || this.cupRaces === races) return;
    this.cupRaces = races;
    // Ein beendetes Turnier bleibt nur stehen, solange weiter Turnier eingestellt ist.
    if (this.cup && races === 0) this.cup = null;
    this.changed();
  }

  /** Läuft ein Turnier, das noch Rennen vor sich hat? */
  cupRunning(): boolean {
    return this.cup !== null && !cupOver(this.cup);
  }

  /** Beginnt ein neues Turnier mit der eingestellten Länge (ein altes wird ersetzt). */
  startCup(): void {
    if (this.cupRaces <= 0) return;
    this.cup = newCup(this.cupRaces);
    this.cupRaceOpen = false;
    this.changed();
  }

  /**
   * Lost die nächste Strecke aus und zeigt die Auslosung auf allen Bildschirmen.
   * @returns die ausgeloste Strecke, oder −1, wenn kein Turnier läuft
   */
  beginDraw(offered: number, rnd: () => number): number {
    if (!this.cup || cupOver(this.cup)) return -1;
    const draw = makeDraw(this.cup, offered, rnd, ++this.drawId);
    this.cup = { ...this.cup, draw };
    this.changed();
    return draw.strip[draw.stop];
  }

  /** Die Auslosung ist durchgelaufen: ihre Strecke gilt, das nächste Rennen kann beginnen. */
  finishDraw(): boolean {
    const draw = this.cup?.draw;
    if (!this.cup || !draw) return false;
    this.track = draw.strip[draw.stop];
    this.cup = { ...this.cup, draw: null };
    this.cupRaceOpen = true;
    // Bewusst ohne eigene Meldung: Der Aufrufer schaltet gleich danach auf "Rennen" – so erfahren die
    // Bildschirme beides zusammen und zeigen zwischen Auslosung und Rennen nicht kurz die Lobby.
    return true;
  }

  /** Wertet das laufende Rennen des Turniers – genau einmal, egal wie oft es gemeldet wird. */
  scoreCupRace(standings: { slot: number; place: number }[]): void {
    if (!this.cup || !this.cupRaceOpen) return;
    this.cupRaceOpen = false;
    this.cup = scoreRace(this.cup, this.track, standings);
    this.changed();
  }

  /** Beendet das Turnier (auch mittendrin): Es gilt wieder, was in der Lobby eingestellt ist. */
  endCup(): void {
    if (!this.cup) return;
    this.cup = null;
    this.cupRaceOpen = false;
    this.changed();
  }

  setBots(bots: boolean): void {
    if (this.bots === bots) return;
    this.bots = bots;
    this.changed();
  }

  setAiLevel(level: number): void {
    const l = Math.max(0, Math.min(2, level | 0));
    if (this.aiLevel === l) return;
    this.aiLevel = l;
    this.changed();
  }

  /** Rundenzahl (nur in der Lobby; der Wert gilt ab dem nächsten Start). */
  setLaps(n: number): void {
    if (this.phase !== 'lobby') return;
    const laps = cleanLaps(n);
    if (this.laps === laps) return;
    this.laps = laps;
    this.changed();
  }

  setTrack(track: number): void {
    // Im laufenden Turnier bestimmt die Auslosung die Strecke.
    if (this.track === track || this.cupRunning()) return;
    this.track = track;
    this.changed();
  }

  /** Spürbares Ereignis an das Handy eines Mitspielers weiterreichen. */
  sendFx(slot: number, kind: FxKind): void {
    const link = this.seats[slot]?.link;
    if (link) this.sendTo(link, { t: 'fx', k: kind });
  }

  slots(): number[] {
    return this.seats.filter((s): s is Seat => s !== null).map((s) => s.slot);
  }

  linkOf(slot: number): Link | null {
    return this.seats[slot]?.link ?? null;
  }

  setLocalCharacter(character: number): void {
    const own = this.seats[this.localSlot]!;
    own.character = cleanCharacter(character, own.slot);
    this.changed();
  }

  /** Figur je Platz (für das Rennen); freie Plätze fehlen. */
  characters(): number[] {
    const out: number[] = [];
    for (const s of this.seats) if (s) out[s.slot] = s.character;
    return out;
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
        .map((s) => ({ slot: s.slot, token: s.token, name: s.name, isHost: s.isHost, character: s.character })),
      bots: this.bots,
      aiLevel: this.aiLevel,
      track: this.track,
      laps: this.laps,
      cupRaces: this.cupRaces,
      cup: this.cup ? { ...this.cup, draw: null } : null,
    };
  }

  // ---------------------------------------------------------------------

  private newSeat(slot: number, token: string, name: string, isHost: boolean, character?: number): Seat {
    return {
      slot,
      token,
      name,
      isHost,
      character: cleanCharacter(character, slot),
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
      seat = this.newSeat(free, token, cleanName(msg.name, `Spieler ${free + 1}`), false, msg.char);
      this.seats[free] = seat;
      // Bisher fuhr auf diesem Platz die KI (oder jemand anderes): ihre Sterne erbt der Neue nicht.
      if (this.cup) this.cup = resetSlot(this.cup, free);
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
      this.onPlayerDown?.(s.slot);
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
      case 'char':
        seat.character = cleanCharacter(msg.v, seat.character);
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
    if (this.cup) this.cup = resetSlot(this.cup, seat.slot);
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
