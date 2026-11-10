// Ein Endpunkt beim PeerJS-Signaling-Server unter einer festen Kennung.
//
// Kümmert sich um das, was PeerJS nicht von allein macht:
//   - Signaling-Verbindung nach Abbruch wieder aufbauen (mit Backoff)
//   - dieselbe Kennung nach einem Neuladen der Seite zurückholen
//     (über ein gespeichertes Token akzeptiert der Server die Rückkehr)
//   - "Gegenstelle unbekannt" dem richtigen Verbindungsversuch zuordnen

import { Peer, type DataConnection, type PeerOptions } from 'peerjs';
import { Link, type LinkOptions } from './link';
import { readDebugParams } from './debugParams';
import type { NetSetup } from './netConfig';

export type EndpointStatus =
  | 'connecting'
  | 'online'
  | 'offline' // Signaling weg, wir versuchen es weiter
  | 'id-taken' // Kennung gehört bereits jemand anderem
  | 'unsupported'; // Browser kann kein WebRTC

export class PeerEndpoint {
  status: EndpointStatus = 'connecting';
  onStatus: ((status: EndpointStatus) => void) | null = null;
  onIncoming: ((link: Link) => void) | null = null;

  private peer: Peer | null = null;
  private destroyed = false;
  private retryTimer = 0;
  private backoff = 600;
  private readonly pending = new Map<string, Set<Link>>();
  private readonly wake = (): void => {
    if (document.visibilityState === 'visible') this.kick();
  };

  constructor(
    readonly id: string,
    private readonly token: string,
    private readonly setup: NetSetup,
    private readonly linkOptions: LinkOptions,
  ) {
    this.create();
    window.addEventListener('online', this.wake);
    document.addEventListener('visibilitychange', this.wake);
  }

  get online(): boolean {
    return this.status === 'online';
  }

  /** Baut eine Verbindung zu einer anderen Kennung auf. null, wenn das Signaling gerade fehlt. */
  connect(targetId: string, metadata: Record<string, unknown>): Link | null {
    const peer = this.peer;
    if (!peer || peer.destroyed || peer.disconnected || !peer.open) return null;
    let conn: DataConnection | undefined;
    try {
      conn = peer.connect(targetId, { reliable: true, serialization: 'raw', metadata });
    } catch (err) {
      console.warn('[endpoint] connect fehlgeschlagen', err);
      return null;
    }
    if (!conn) return null;
    const link = new Link(conn, this.linkOptions);
    let set = this.pending.get(targetId);
    if (!set) this.pending.set(targetId, (set = new Set()));
    set.add(link);
    link.onSettled = () => {
      const s = this.pending.get(targetId);
      s?.delete(link);
      if (s && s.size === 0) this.pending.delete(targetId);
    };
    return link;
  }

  /** Sofort versuchen, das Signaling wiederherzustellen (z. B. wenn die Seite wieder sichtbar wird). */
  kick(): void {
    if (this.destroyed || this.status === 'online' || this.status === 'id-taken' || this.status === 'unsupported') return;
    window.clearTimeout(this.retryTimer);
    this.retryTimer = 0;
    this.recover();
  }

  destroy(): void {
    this.destroyed = true;
    window.clearTimeout(this.retryTimer);
    window.removeEventListener('online', this.wake);
    document.removeEventListener('visibilitychange', this.wake);
    try {
      this.peer?.destroy();
    } catch {
      /* egal */
    }
    this.peer = null;
  }

  // ---------------------------------------------------------------------

  private setStatus(status: EndpointStatus): void {
    if (this.status === status) return;
    this.status = status;
    this.onStatus?.(status);
  }

  private create(): void {
    if (this.destroyed) return;
    const options: PeerOptions = {
      token: this.token,
      config: this.setup.rtc,
      debug: readDebugParams().peerLog,
      ...this.setup.peerServer,
    };
    let peer: Peer;
    try {
      peer = new Peer(this.id, options);
    } catch (err) {
      console.error('[endpoint] Peer konnte nicht erstellt werden', err);
      this.setStatus('unsupported');
      return;
    }
    this.peer = peer;

    peer.on('open', () => {
      if (this.peer !== peer) return;
      this.backoff = 600;
      this.setStatus('online');
    });

    peer.on('connection', (conn) => {
      if (this.peer !== peer) return;
      const link = new Link(conn, this.linkOptions);
      if (this.onIncoming) this.onIncoming(link);
      else link.close();
    });

    peer.on('disconnected', () => {
      if (this.peer !== peer || this.destroyed) return;
      if (this.status === 'id-taken' || this.status === 'unsupported') return;
      this.setStatus('offline');
      this.scheduleRecover();
    });

    peer.on('close', () => {
      if (this.peer !== peer || this.destroyed) return;
      if (this.status === 'id-taken' || this.status === 'unsupported') return;
      this.setStatus('offline');
      this.scheduleRecover();
    });

    peer.on('error', (err) => {
      if (this.peer !== peer || this.destroyed) return;
      const type = err.type as string;
      switch (type) {
        case 'peer-unavailable': {
          // Die Meldung endet mit der Kennung der unbekannten Gegenstelle.
          const match = /peer (\S+)$/.exec(err.message);
          const target = match?.[1];
          if (target) {
            const set = this.pending.get(target);
            if (set) for (const link of [...set]) link.failUnavailable();
          }
          break;
        }
        case 'unavailable-id':
          this.setStatus('id-taken');
          break;
        case 'browser-incompatible':
          this.setStatus('unsupported');
          break;
        case 'network':
        case 'server-error':
        case 'socket-error':
        case 'socket-closed':
          this.setStatus('offline');
          this.scheduleRecover();
          break;
        default:
          // 'webrtc', 'negotiation-failed' usw. betreffen einzelne Verbindungen;
          // die behandelt der jeweilige Link selbst.
          console.warn('[endpoint] PeerJS-Fehler', type, err.message);
      }
    });
  }

  private scheduleRecover(): void {
    if (this.destroyed || this.retryTimer) return;
    this.retryTimer = window.setTimeout(() => {
      this.retryTimer = 0;
      this.recover();
    }, this.backoff);
    this.backoff = Math.min(this.backoff * 2, 5000);
  }

  private recover(): void {
    if (this.destroyed) return;
    const peer = this.peer;
    if (!peer || peer.destroyed) {
      this.setStatus('connecting');
      this.create();
      return;
    }
    if (peer.disconnected) {
      try {
        peer.reconnect();
      } catch {
        this.scheduleRecover();
      }
      return;
    }
    if (!peer.open) this.scheduleRecover();
  }
}
