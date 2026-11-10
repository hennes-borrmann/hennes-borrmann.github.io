// Die Lobby aus Sicht eines beigetretenen Bildschirms: Verbindung zum Host
// aufbauen, bei Abbruch von selbst wieder verbinden und den Zustand spiegeln.

import { BUILD_ID } from '../build';
import type { PeerEndpoint } from '../net/endpoint';
import type { Link } from '../net/link';
import {
  PROTOCOL_VERSION,
  roomPeerId,
  type FxKind,
  type HostToScreen,
  type LobbyState,
  type RejectReason,
  type ScreenToHost,
} from '../net/protocol';

export type ClientStatus =
  | 'connecting'
  | 'joined'
  | 'reconnecting'
  // Endzustände – danach wird nicht mehr von selbst verbunden:
  | 'not-found' // kein Host unter diesem Code
  | 'unreachable' // Host existiert, aber es kommt keine Verbindung zustande
  | 'rejected'
  | 'closed' // Host hat die Lobby geschlossen
  | 'lost' // Host ist verschwunden
  | 'replaced'; // derselbe Spieler ist in einem anderen Tab aktiv

const RETRY_MS = 1200;
/** So lange versuchen wir nach einem Abbruch, den Host wieder zu erreichen. */
const RECONNECT_WINDOW_MS = 30_000;
const FIRST_CONNECT_WINDOW_MS = 25_000;

const FINAL: ClientStatus[] = ['not-found', 'unreachable', 'rejected', 'closed', 'lost', 'replaced'];

export class ClientLobby {
  status: ClientStatus = 'connecting';
  rejectReason: RejectReason | null = null;
  state: LobbyState | null = null;
  slot = -1;
  link: Link | null = null;
  /** Zeitpunkt, bis zu dem noch Wiederverbindungsversuche laufen (für die Anzeige). */
  deadline = 0;
  /** Der Host läuft mit einer anderen Fassung der Seite. */
  buildMismatch = false;

  onChange: (() => void) | null = null;
  onFast: ((view: DataView) => void) | null = null;
  /** Verbindung zum Host steht (wieder) – Spielzustand neu abgleichen. */
  onLinkUp: (() => void) | null = null;
  /** Spürbares Ereignis vom Host (Treffer, Rempler, Kiste). */
  onFx: ((kind: FxKind) => void) | null = null;

  private everJoined: boolean;
  private retryTimer = 0;
  private disposed = false;
  private ready = false;
  private lastStatus = { controller: false, ctrlRtt: -1 };
  private readonly wake = (): void => {
    if (document.visibilityState === 'visible' && !this.link && !this.isFinal) this.attemptSoon(0);
  };

  /**
   * @param resume true, wenn wir nach einem Neuladen in eine bekannte Lobby zurückkehren.
   *               Dann gilt ein fehlender Host zunächst als vorübergehend.
   * @param endpoint Funktion statt Objekt, weil der Bildschirm seinen Endpunkt
   *                 austauschen kann (neue Kennung), während wir verbinden.
   */
  constructor(
    private readonly endpoint: () => PeerEndpoint,
    readonly code: string,
    private readonly token: string,
    private name: string,
    resume: boolean,
    /** Gewünschte Figur, -1 = Standardfigur des zugeteilten Platzes. */
    private character = -1,
  ) {
    this.everJoined = resume;
    this.status = resume ? 'reconnecting' : 'connecting';
    this.deadline = Date.now() + (resume ? RECONNECT_WINDOW_MS : FIRST_CONNECT_WINDOW_MS);
    document.addEventListener('visibilitychange', this.wake);
    this.attempt();
  }

  get isFinal(): boolean {
    return FINAL.includes(this.status);
  }

  setReady(ready: boolean): void {
    this.ready = ready;
    this.sendMsg({ t: 'ready', v: ready });
  }

  setCharacter(character: number): void {
    this.character = character;
    this.sendMsg({ t: 'char', v: character });
  }

  setName(name: string): void {
    this.name = name;
    this.sendMsg({ t: 'name', v: name });
  }

  reportStatus(controller: boolean, ctrlRtt: number): void {
    const rtt = Math.round(ctrlRtt);
    if (this.lastStatus.controller === controller && this.lastStatus.ctrlRtt === rtt) return;
    this.lastStatus = { controller, ctrlRtt: rtt };
    this.sendMsg({ t: 'status', controller, ctrlRtt: rtt });
  }

  sendFast(buf: ArrayBuffer): void {
    if (this.status === 'joined') this.link?.sendFast(buf);
  }

  /** Lobby bewusst verlassen: der Platz wird sofort frei. */
  leave(): void {
    this.sendMsg({ t: 'leave' });
    const link = this.link;
    this.dispose();
    if (link) window.setTimeout(() => link.close(), 300);
  }

  dispose(): void {
    this.disposed = true;
    window.clearTimeout(this.retryTimer);
    document.removeEventListener('visibilitychange', this.wake);
    if (this.link) {
      this.link.onClose = null;
      this.link.onMessage = null;
      this.link.onFast = null;
    }
  }

  // ---------------------------------------------------------------------

  private sendMsg(msg: ScreenToHost): void {
    if (this.status === 'joined') this.link?.send(msg as unknown as Record<string, unknown>);
  }

  private setStatus(status: ClientStatus): void {
    this.status = status;
    this.onChange?.();
  }

  private finish(status: ClientStatus): void {
    window.clearTimeout(this.retryTimer);
    const link = this.link;
    this.link = null;
    if (link) {
      link.onClose = null;
      window.setTimeout(() => link.close(), 300);
    }
    this.setStatus(status);
  }

  private attemptSoon(delay: number): void {
    window.clearTimeout(this.retryTimer);
    this.retryTimer = window.setTimeout(() => this.attempt(), delay);
  }

  private attempt(): void {
    if (this.disposed || this.isFinal || this.link) return;
    if (Date.now() > this.deadline) {
      this.finish(this.everJoined ? 'lost' : 'unreachable');
      return;
    }
    const link = this.endpoint().connect(roomPeerId(this.code), { role: 'screen' });
    if (!link) {
      // Signaling gerade nicht da – der Endpoint verbindet selbst neu.
      this.attemptSoon(600);
      return;
    }
    this.link = link;
    link.onOpen = () => {
      const hello: ScreenToHost = { t: 'hello', v: PROTOCOL_VERSION, token: this.token, name: this.name, build: BUILD_ID };
      if (this.character >= 0) hello.char = this.character;
      link.send(hello as unknown as Record<string, unknown>);
    };
    link.onMessage = (raw) => this.handleMessage(link, raw as HostToScreen);
    link.onFast = (view) => this.onFast?.(view);
    link.onClose = (reason) => {
      if (this.link !== link) return;
      this.link = null;
      if (this.disposed || this.isFinal) return;
      if (!this.everJoined && reason === 'unavailable') {
        this.finish('not-found');
        return;
      }
      if (this.status === 'joined') {
        this.deadline = Date.now() + RECONNECT_WINDOW_MS;
        this.setStatus('reconnecting');
      } else {
        this.onChange?.();
      }
      this.attemptSoon(RETRY_MS);
    };
  }

  private handleMessage(link: Link, msg: HostToScreen): void {
    if (this.link !== link) return;
    switch (msg.t) {
      case 'welcome':
        this.slot = msg.slot;
        this.state = msg.state;
        this.buildMismatch = typeof msg.build === 'string' && msg.build !== BUILD_ID;
        this.everJoined = true;
        this.status = 'joined';
        // Der Host kennt nach einem Wiedereinstieg unseren Stand nicht mehr.
        this.lastStatus = { controller: false, ctrlRtt: -1 };
        if (this.ready && msg.state.phase === 'lobby') this.sendMsg({ t: 'ready', v: true });
        this.onLinkUp?.();
        this.onChange?.();
        break;
      case 'lobby':
        this.state = msg.state;
        if (msg.state.phase === 'lobby') {
          const me = msg.state.players.find((p) => p.slot === this.slot);
          if (me) this.ready = me.ready;
        }
        this.onChange?.();
        break;
      case 'fx':
        this.onFx?.(msg.k);
        break;
      case 'reject':
        this.rejectReason = msg.reason;
        this.finish('rejected');
        break;
      case 'closed':
        this.finish('closed');
        break;
      case 'replaced':
        this.finish('replaced');
        break;
      default:
        break;
    }
  }
}
