// Kopplung Handy ↔ dieser Bildschirm (Bildschirm-Seite).
//
// Es steuert immer genau ein Handy. Scannt ein zweites den QR-Code, übernimmt
// es – das erste bekommt Bescheid und versucht nicht mehr, sich von selbst
// zurückzuverbinden. Verbindet sich dasselbe Handy erneut (nach Funkloch oder
// Bildschirmsperre), ersetzt es einfach seine alte Verbindung.

import { BUILD_ID } from '../build';
import { ControllerInput } from '../game/input';
import type { Link, PathInfo } from '../net/link';
import {
  PKT_CTRL_INPUT,
  PROTOCOL_VERSION,
  type ControllerToScreen,
  type FxKind,
  type ScreenToController,
} from '../net/protocol';

export interface PairedInfo {
  name: string;
  slot: number;
  room: string | null;
  phase: string;
}

const HELLO_TIMEOUT_MS = 8000;

export class ControllerPairing {
  readonly input = new ControllerInput();
  link: Link | null = null;
  /** Was das Handy über sich meldet. */
  info = { tilt: false, sensorHz: 0, sendHz: 0 };
  path: PathInfo | null = null;
  /** Das Handy läuft mit einer anderen Fassung der Seite (meist: alter Zwischenspeicher). */
  buildMismatch = false;
  onChange: (() => void) | null = null;

  private cid: string | null = null;
  private lastInfoJson = '';

  constructor(private readonly getInfo: () => PairedInfo) {}

  get connected(): boolean {
    return this.link !== null && this.link.state === 'open';
  }

  get rtt(): number {
    return this.link ? this.link.rtt : -1;
  }

  /** Eingehende Verbindung eines Handys annehmen. */
  accept(link: Link): void {
    const timeout = window.setTimeout(() => link.close(), HELLO_TIMEOUT_MS);
    link.onClose = () => window.clearTimeout(timeout);
    link.onMessage = (raw) => {
      const msg = raw as ControllerToScreen;
      if (msg.t !== 'hello') return;
      window.clearTimeout(timeout);
      if (msg.v !== PROTOCOL_VERSION) {
        this.sendTo(link, { t: 'reject', reason: 'version' });
        window.setTimeout(() => link.close(), 400);
        return;
      }
      this.buildMismatch = typeof msg.build === 'string' && msg.build !== BUILD_ID;
      this.adopt(link, String(msg.cid ?? ''));
    };
  }

  /** Dem Handy mitteilen, wenn sich Name, Platz oder Phase geändert haben. */
  pushInfo(force = false): void {
    if (!this.link || this.link.state !== 'open') return;
    const info = this.getInfo();
    const json = JSON.stringify(info);
    if (!force && json === this.lastInfoJson) return;
    this.lastInfoJson = json;
    this.sendTo(this.link, { t: 'paired', ...info, build: BUILD_ID });
  }

  /** Anzeige auf dem Handy: Item, Platz, Runde. */
  sendHud(hud: { racing: boolean; item: number; rolling: boolean; place: number; of: number; lap: number; laps: number }): void {
    if (this.link && this.link.state === 'open') this.sendTo(this.link, { t: 'hud', ...hud });
  }

  /** Spürbares Ereignis: das Handy vibriert bzw. blitzt auf. */
  sendFx(kind: FxKind): void {
    if (this.link && this.link.state === 'open') this.sendTo(this.link, { t: 'fx', k: kind });
  }

  async refreshPath(): Promise<void> {
    this.path = this.link ? await this.link.getPath() : null;
  }

  private sendTo(link: Link, msg: ScreenToController): void {
    link.send(msg as unknown as Record<string, unknown>);
  }

  private adopt(link: Link, cid: string): void {
    const old = this.link;
    if (old && old !== link) {
      old.onClose = null;
      old.onMessage = null;
      old.onFast = null;
      if (cid !== this.cid) this.sendTo(old, { t: 'replaced' });
      window.setTimeout(() => old.close(), 400);
    }
    this.link = link;
    this.cid = cid;
    this.path = null;
    this.input.reset();
    this.info = { tilt: false, sensorHz: 0, sendHz: 0 };

    link.onFast = (view) => {
      if (view.getUint8(0) === PKT_CTRL_INPUT) this.input.onPacket(view);
    };
    link.onMessage = (raw) => {
      const msg = raw as ControllerToScreen;
      if (msg.t === 'press') this.input.onItemPress(Number(msg.n) || 0);
      else if (msg.t === 'info') {
        this.info = { tilt: !!msg.tilt, sensorHz: Number(msg.sensorHz) || 0, sendHz: Number(msg.sendHz) || 0 };
      } else if (msg.t === 'bye') {
        link.close();
      }
    };
    link.onClose = () => {
      if (this.link !== link) return;
      this.link = null;
      this.path = null;
      this.input.reset();
      this.onChange?.();
    };

    this.pushInfo(true);
    this.onChange?.();
  }
}
