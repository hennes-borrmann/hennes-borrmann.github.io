// Verbindung Handy → Bildschirm, mit automatischem Wiederverbinden.
//
// Das Handy kennt die Kennung des Bildschirms aus dem QR-Code und versucht es
// so lange, bis die Verbindung steht – auch nach Funkloch, Bildschirmsperre
// oder wenn der Bildschirm seine Seite neu lädt. Nur wenn ein anderes Handy
// übernommen hat, hört es auf (sonst würden sich zwei Handys gegenseitig
// verdrängen).

import { randomCode, randomToken } from '../net/codes';
import { PeerEndpoint } from '../net/endpoint';
import type { Link, LinkOptions } from '../net/link';
import type { NetSetup } from '../net/netConfig';
import { PROTOCOL_VERSION, screenPeerId, type ControllerToScreen, type ScreenToController } from '../net/protocol';

export type ConnStatus =
  | 'connecting'
  | 'connected'
  | 'searching' // Bildschirm ist (gerade) nicht erreichbar, wir versuchen es weiter
  | 'replaced'
  | 'version';

export interface PairedInfo {
  name: string;
  slot: number;
  room: string | null;
  phase: string;
}

const RETRY_MS = 1200;
const KEY = 'kart.controller.id';

function identity(): { cid: string; token: string } {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw) {
      const v = JSON.parse(raw) as { cid: string; token: string };
      if (v.cid && v.token) return v;
    }
  } catch {
    /* egal */
  }
  const v = { cid: randomCode(10), token: randomToken() };
  try {
    sessionStorage.setItem(KEY, JSON.stringify(v));
  } catch {
    /* egal */
  }
  return v;
}

export class ScreenConnection {
  status: ConnStatus = 'connecting';
  link: Link | null = null;
  paired: PairedInfo | null = null;
  /** Zahl der bisherigen Verbindungsabbrüche (für die Anzeige). */
  drops = 0;
  onChange: (() => void) | null = null;

  private readonly endpoint: PeerEndpoint;
  private readonly id = identity();
  private retryTimer = 0;
  private everConnected = false;

  constructor(
    setup: NetSetup,
    private readonly screenId: string,
    linkOptions: LinkOptions,
  ) {
    this.endpoint = new PeerEndpoint(`hbkart${PROTOCOL_VERSION}-c-${this.id.cid}`, this.id.token, setup, linkOptions);
    this.endpoint.onStatus = () => {
      this.onChange?.();
      if (this.endpoint.online && !this.link) this.attemptSoon(0);
    };
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && !this.link) this.attemptSoon(0);
    });
    this.attempt();
  }

  get connected(): boolean {
    return this.status === 'connected' && this.link !== null && this.link.state === 'open';
  }

  get signalingOnline(): boolean {
    return this.endpoint.online;
  }

  sendFast(buf: ArrayBuffer): void {
    if (this.connected) this.link!.sendFast(buf);
  }

  send(msg: ControllerToScreen): void {
    if (this.connected) this.link!.send(msg as unknown as Record<string, unknown>);
  }

  /** Nach "ein anderes Handy hat übernommen": die Steuerung zurückholen. */
  takeOver(): void {
    if (this.status !== 'replaced') return;
    this.status = 'connecting';
    this.onChange?.();
    this.attemptSoon(0);
  }

  private get stopped(): boolean {
    return this.status === 'replaced' || this.status === 'version';
  }

  private attemptSoon(delay: number): void {
    window.clearTimeout(this.retryTimer);
    this.retryTimer = window.setTimeout(() => this.attempt(), delay);
  }

  private attempt(): void {
    if (this.stopped || this.link) return;
    const link = this.endpoint.connect(screenPeerId(this.screenId), { role: 'controller' });
    if (!link) {
      this.attemptSoon(600);
      return;
    }
    this.link = link;
    link.onOpen = () => {
      const hello: ControllerToScreen = { t: 'hello', v: PROTOCOL_VERSION, cid: this.id.cid };
      link.send(hello as unknown as Record<string, unknown>);
    };
    link.onMessage = (raw) => {
      if (this.link !== link) return;
      const msg = raw as ScreenToController;
      if (msg.t === 'paired') {
        this.paired = { name: msg.name, slot: msg.slot, room: msg.room, phase: msg.phase };
        this.everConnected = true;
        this.status = 'connected';
        this.onChange?.();
      } else if (msg.t === 'replaced' || msg.t === 'reject') {
        this.status = msg.t === 'replaced' ? 'replaced' : 'version';
        this.link = null;
        link.onClose = null;
        window.setTimeout(() => link.close(), 300);
        this.onChange?.();
      }
    };
    link.onClose = (reason) => {
      if (this.link !== link) return;
      this.link = null;
      if (this.stopped) return;
      if (this.status === 'connected') this.drops++;
      this.status = reason === 'unavailable' || this.everConnected ? 'searching' : 'connecting';
      this.onChange?.();
      this.attemptSoon(RETRY_MS);
    };
  }
}
