// Eine Verbindung zwischen zwei Geräten (Handy↔Bildschirm oder Bildschirm↔Host).
//
// Jeder Link hat zwei Kanäle auf derselben WebRTC-Verbindung:
//   - zuverlässig + geordnet (PeerJS-DataConnection) für Ereignisse als JSON
//   - unzuverlässig + ungeordnet für schnelle Daten (Eingaben, Snapshots)
//
// Warum ein eigener zweiter Kanal: PeerJS kann von sich aus nur "ungeordnet",
// aber nicht "ohne Wiederholung" (reliable:false setzt nur ordered:false).
// Für Echtzeitdaten ist Wiederholen schädlich – ein verlorenes Paket ist beim
// erneuten Senden schon veraltet und staut alles Nachfolgende. Deshalb legen
// beide Seiten denselben "negotiated" DataChannel mit maxRetransmits:0 an.

import type { DataConnection } from 'peerjs';

/** Feste Stream-ID des schnellen Kanals; muss auf beiden Seiten gleich sein. */
const FAST_CHANNEL_ID = 9;
const HEARTBEAT_MS = 500;
/** Ab so viel gepufferten Bytes werfen wir schnelle Pakete lieber weg als sie zu stauen. */
const FAST_BACKLOG_LIMIT = 32 * 1024;

export const PKT_PING = 0;
export const PKT_PONG = 1;

export type LinkState = 'connecting' | 'open' | 'closed';

export type LinkCloseReason =
  | 'local' // wir haben geschlossen
  | 'remote' // Gegenseite hat geschlossen oder ist weg
  | 'timeout' // keine Daten mehr / Aufbau hat zu lange gedauert
  | 'failed' // ICE-Aushandlung gescheitert (oft: NAT/Firewall ohne TURN)
  | 'unavailable'; // Gegenstelle ist beim Signaling-Server nicht bekannt

export interface NetSim {
  lag: number;
  jitter: number;
  loss: number;
}

export interface LinkOptions {
  openTimeoutMs: number;
  idleTimeoutMs: number;
  netSim?: NetSim;
}

export interface PathInfo {
  kind: 'direct' | 'relay' | 'unknown';
  /** z. B. "host", "srflx", "relay" */
  local: string;
  remote: string;
  protocol: string;
}

export class Link {
  state: LinkState = 'connecting';
  closeReason: LinkCloseReason | null = null;
  /** Umlaufzeit in ms (Median der letzten Messungen), -1 solange unbekannt. */
  rtt = -1;
  rttLast = -1;
  private readonly rttSamples: number[] = [];
  readonly remoteId: string;
  readonly metadata: Record<string, unknown>;
  readonly counters = { fastIn: 0, fastOut: 0, fastDropped: 0, msgIn: 0, msgOut: 0 };

  onOpen: (() => void) | null = null;
  onClose: ((reason: LinkCloseReason) => void) | null = null;
  onMessage: ((msg: Record<string, unknown>) => void) | null = null;
  onFast: ((view: DataView) => void) | null = null;
  /** Interner Hook für den PeerEndpoint (Buchführung offener Verbindungsversuche). */
  onSettled: (() => void) | null = null;

  private fast: RTCDataChannel | null = null;
  private readonly pc: RTCPeerConnection | null;
  private heartbeat = 0;
  private openTimer = 0;
  private lastRecv = performance.now();
  private lastBeat = performance.now();
  private readonly pingBuf = new ArrayBuffer(9);
  private readonly pingView = new DataView(this.pingBuf);
  private readonly sim: NetSim | null;

  constructor(
    private readonly conn: DataConnection,
    private readonly opts: LinkOptions,
  ) {
    this.remoteId = conn.peer;
    this.metadata = (conn.metadata ?? {}) as Record<string, unknown>;
    this.pc = conn.peerConnection ?? null;
    const s = opts.netSim;
    this.sim = s && (s.lag > 0 || s.jitter > 0 || s.loss > 0) ? s : null;

    this.createFastChannel();

    conn.on('open', () => this.handleOpen());
    conn.on('data', (data) => this.handleReliable(data));
    conn.on('close', () => this.finish('remote'));
    conn.on('error', (err) => {
      // PeerJS meldet eine gescheiterte ICE-Aushandlung als Fehler; ist die
      // Verbindung dabei noch nie offen gewesen, kommt kein 'close' hinterher.
      console.warn('[link] Fehler', this.remoteId, err);
      if (this.state === 'connecting') this.finish('failed');
    });

    this.openTimer = window.setTimeout(() => {
      if (this.state === 'connecting') this.finish('timeout');
    }, opts.openTimeoutMs);

    if (conn.open) this.handleOpen();
  }

  /** true, wenn schnelle Daten wirklich über den unreliable Kanal laufen. */
  get fastIsUnreliable(): boolean {
    return this.fast !== null && this.fast.readyState === 'open';
  }

  send(msg: Record<string, unknown>): void {
    if (this.state !== 'open') return;
    const text = JSON.stringify(msg);
    this.counters.msgOut++;
    if (this.sim && this.sim.lag > 0) {
      // Konstante Verzögerung, damit die Reihenfolge erhalten bleibt.
      window.setTimeout(() => this.rawSend(text), this.sim.lag);
    } else {
      this.rawSend(text);
    }
  }

  sendFast(buf: ArrayBuffer): void {
    if (this.state !== 'open') return;
    this.counters.fastOut++;
    if (this.sim) {
      if (Math.random() * 100 < this.sim.loss) return;
      const delay = this.sim.lag + Math.random() * this.sim.jitter;
      if (delay > 0) {
        // Kopie, weil Aufrufer ihre Puffer wiederverwenden.
        const copy = buf.slice(0);
        window.setTimeout(() => this.rawSendFast(copy), delay);
        return;
      }
    }
    this.rawSendFast(buf);
  }

  close(): void {
    this.finish('local');
  }

  /** Liest aus den WebRTC-Statistiken, ob die Verbindung direkt oder über TURN läuft. */
  async getPath(): Promise<PathInfo> {
    const unknown: PathInfo = { kind: 'unknown', local: '?', remote: '?', protocol: '?' };
    if (!this.pc || this.state !== 'open') return unknown;
    try {
      const stats = await this.pc.getStats();
      let pairId: string | undefined;
      let fallbackPair: Record<string, unknown> | undefined;
      const byId = new Map<string, Record<string, unknown>>();
      stats.forEach((report: Record<string, unknown>) => {
        byId.set(report.id as string, report);
        if (report.type === 'transport' && report.selectedCandidatePairId) {
          pairId = report.selectedCandidatePairId as string;
        }
        if (report.type === 'candidate-pair') {
          // Firefox kennt 'selected', Safari/ältere Browser nur nominated+succeeded.
          if (report.selected === true || (report.nominated === true && report.state === 'succeeded')) {
            fallbackPair = report;
          }
        }
      });
      const pair = (pairId ? byId.get(pairId) : undefined) ?? fallbackPair;
      if (!pair) return unknown;
      const local = byId.get(pair.localCandidateId as string);
      const remote = byId.get(pair.remoteCandidateId as string);
      if (!local || !remote) return unknown;
      const lt = String(local.candidateType ?? '?');
      const rt = String(remote.candidateType ?? '?');
      const relay = lt === 'relay' || rt === 'relay';
      let protocol = String(local.protocol ?? '?');
      if (lt === 'relay' && local.relayProtocol) protocol = `${protocol}, TURN über ${String(local.relayProtocol)}`;
      return { kind: relay ? 'relay' : 'direct', local: lt, remote: rt, protocol };
    } catch {
      return unknown;
    }
  }

  // ---------------------------------------------------------------------

  private createFastChannel(): void {
    if (!this.pc) return;
    try {
      const dc = this.pc.createDataChannel('fast', {
        negotiated: true,
        id: FAST_CHANNEL_ID,
        ordered: false,
        maxRetransmits: 0,
      });
      dc.binaryType = 'arraybuffer';
      dc.onmessage = (e) => {
        if (e.data instanceof ArrayBuffer) this.handleFast(e.data);
      };
      this.fast = dc;
    } catch (err) {
      // Dann laufen schnelle Daten ersatzweise über den zuverlässigen Kanal.
      console.warn('[link] kein unreliable Kanal möglich, nutze Ersatzweg', err);
      this.fast = null;
    }
  }

  private handleOpen(): void {
    if (this.state !== 'connecting') return;
    this.state = 'open';
    window.clearTimeout(this.openTimer);
    this.lastRecv = performance.now();
    this.lastBeat = this.lastRecv;
    this.heartbeat = window.setInterval(() => this.beat(), HEARTBEAT_MS);
    this.onSettled?.();
    this.onOpen?.();
    this.beat();
  }

  private beat(): void {
    if (this.state !== 'open') return;
    const now = performance.now();
    // War die Seite eingefroren (Handy im Hintergrund), sagt die lange Pause
    // nichts über die Leitung aus – der Gegenseite eine neue Frist geben.
    if (now - this.lastBeat > 2000) this.lastRecv = now;
    this.lastBeat = now;
    if (now - this.lastRecv > this.opts.idleTimeoutMs) {
      this.finish('timeout');
      return;
    }
    this.pingView.setUint8(0, PKT_PING);
    this.pingView.setFloat64(1, now);
    this.sendFast(this.pingBuf);
  }

  private handleReliable(data: unknown): void {
    this.lastRecv = performance.now();
    if (typeof data === 'string') {
      this.counters.msgIn++;
      let msg: unknown;
      try {
        msg = JSON.parse(data);
      } catch {
        return;
      }
      if (msg && typeof msg === 'object') this.onMessage?.(msg as Record<string, unknown>);
    } else if (data instanceof ArrayBuffer) {
      // Ersatzweg: schnelle Pakete über den zuverlässigen Kanal.
      this.handleFast(data);
    }
  }

  private handleFast(buf: ArrayBuffer): void {
    if (this.state === 'closed' || buf.byteLength < 1) return;
    this.lastRecv = performance.now();
    const view = new DataView(buf);
    const type = view.getUint8(0);
    if (type === PKT_PING) {
      if (buf.byteLength < 9) return;
      const reply = buf.slice(0);
      new DataView(reply).setUint8(0, PKT_PONG);
      this.sendFast(reply);
      return;
    }
    if (type === PKT_PONG) {
      if (buf.byteLength < 9) return;
      const sample = this.lastRecv - view.getFloat64(1);
      if (sample >= 0 && sample < 60000) {
        // Median der letzten fünf Messungen: einzelne Ausreißer (etwa direkt
        // nach dem Verbindungsaufbau) verfälschen die Anzeige nicht.
        this.rttLast = sample;
        this.rttSamples.push(sample);
        if (this.rttSamples.length > 5) this.rttSamples.shift();
        const sorted = [...this.rttSamples].sort((a, b) => a - b);
        this.rtt = sorted[sorted.length >> 1];
      }
      return;
    }
    this.counters.fastIn++;
    this.onFast?.(view);
  }

  private rawSend(data: string | ArrayBuffer): void {
    if (this.state !== 'open') return;
    try {
      this.conn.send(data);
    } catch (err) {
      console.warn('[link] Senden fehlgeschlagen', err);
    }
  }

  private rawSendFast(buf: ArrayBuffer): void {
    if (this.state !== 'open') return;
    const dc = this.fast;
    if (dc && dc.readyState === 'open') {
      if (dc.bufferedAmount > FAST_BACKLOG_LIMIT) {
        this.counters.fastDropped++;
        return;
      }
      try {
        dc.send(buf);
      } catch {
        this.counters.fastDropped++;
      }
    } else {
      this.rawSend(buf);
    }
  }

  private finish(reason: LinkCloseReason): void {
    if (this.state === 'closed') return;
    const wasConnecting = this.state === 'connecting';
    this.state = 'closed';
    this.closeReason = reason;
    console.debug('[link] geschlossen', this.remoteId, reason);
    window.clearTimeout(this.openTimer);
    window.clearInterval(this.heartbeat);
    try {
      this.fast?.close();
    } catch {
      /* egal */
    }
    try {
      this.conn.close();
    } catch {
      /* egal */
    }
    if (wasConnecting) this.onSettled?.();
    this.onClose?.(reason);
  }

  /** Vom PeerEndpoint aufgerufen, wenn der Signaling-Server das Ziel nicht kennt. */
  failUnavailable(): void {
    if (this.state === 'connecting') this.finish('unavailable');
  }
}
