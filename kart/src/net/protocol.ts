// Alles, was über die Leitung geht.
//
// Zuverlässiger Kanal: JSON-Nachrichten mit Feld "t" als Typ.
// Schneller Kanal: Binärpakete, erstes Byte = Pakettyp.

import { type Cmd, type KartState } from '../game/sim';

/** Wird bei jeder inkompatiblen Änderung erhöht; steckt auch in den Peer-Kennungen. */
export const PROTOCOL_VERSION = 1;
const ID_PREFIX = `hbkart${PROTOCOL_VERSION}`;

export const roomPeerId = (code: string): string => `${ID_PREFIX}-r-${code}`;
export const screenPeerId = (screenId: string): string => `${ID_PREFIX}-s-${screenId}`;

// --- Pakettypen schneller Kanal (0 und 1 gehören dem Link: Ping/Pong) -------

export const PKT_CTRL_INPUT = 0x10; // Handy → Bildschirm
export const PKT_CMD = 0x20; // Client-Bildschirm → Host
export const PKT_SNAPSHOT = 0x21; // Host → Client-Bildschirm

// --- Handy ↔ Bildschirm (zuverlässig) ---------------------------------------

export type ControllerToScreen =
  | { t: 'hello'; v: number; cid: string }
  /** Item-Druck mit Zählerstand; sichert kurze Tipper ab, falls schnelle Pakete verloren gehen. */
  | { t: 'press'; n: number }
  | { t: 'info'; tilt: boolean; sensorHz: number; sendHz: number }
  | { t: 'bye' };

export type ScreenToController =
  /** slot = -1, solange der Bildschirm noch in keiner Lobby ist. */
  | { t: 'paired'; name: string; slot: number; room: string | null; phase: string }
  /** Ein anderes Handy hat diesen Bildschirm übernommen. */
  | { t: 'replaced' }
  | { t: 'reject'; reason: 'version' };

// --- Bildschirm ↔ Host (zuverlässig) ----------------------------------------

export type Phase = 'lobby' | 'game';

export interface LobbyPlayer {
  slot: number;
  name: string;
  isHost: boolean;
  /** Bildschirm dieses Spielers ist mit dem Host verbunden. */
  online: boolean;
  controller: boolean;
  /** Umlaufzeit Handy↔Bildschirm in ms, -1 = unbekannt. */
  ctrlRtt: number;
  ready: boolean;
  /** Umlaufzeit Bildschirm↔Host in ms, -1 = unbekannt, 0 beim Host selbst. */
  ping: number;
}

export interface LobbyState {
  code: string;
  phase: Phase;
  players: LobbyPlayer[];
}

export type RejectReason = 'full' | 'running' | 'version';

export type ScreenToHost =
  | { t: 'hello'; v: number; token: string; name: string }
  | { t: 'ready'; v: boolean }
  | { t: 'name'; v: string }
  | { t: 'status'; controller: boolean; ctrlRtt: number }
  | { t: 'leave' };

export type HostToScreen =
  | { t: 'welcome'; slot: number; state: LobbyState }
  | { t: 'lobby'; state: LobbyState }
  | { t: 'reject'; reason: RejectReason }
  /** Der Host hat die Lobby bewusst geschlossen. */
  | { t: 'closed' }
  /** Dieser Platz wurde von einem anderen Tab mit demselben Token übernommen. */
  | { t: 'replaced' };

// --- Binär: Controller-Eingabe ----------------------------------------------
// [u8 typ][u16 seq][i8 lenkung][u8 tasten][u8 item-zähler]
// Der Item-Zähler erhöht sich bei jedem Druck. So erkennt der Bildschirm jeden
// Druck genau einmal, egal ob er ihn im schnellen Paket oder über die
// zuverlässige 'press'-Nachricht zuerst sieht.

export const CTRL_INPUT_SIZE = 6;

export function writeCtrlInput(view: DataView, seq: number, steer: number, buttons: number, itemCount: number): void {
  view.setUint8(0, PKT_CTRL_INPUT);
  view.setUint16(1, seq & 0xffff);
  view.setInt8(3, steer);
  view.setUint8(4, buttons);
  view.setUint8(5, itemCount & 0xff);
}

export function readCtrlInput(
  view: DataView,
): { seq: number; steer: number; buttons: number; itemCount: number } | null {
  if (view.byteLength < CTRL_INPUT_SIZE) return null;
  return { seq: view.getUint16(1), steer: view.getInt8(3), buttons: view.getUint8(4), itemCount: view.getUint8(5) };
}

/** Ist a neuer als b? (16-Bit-Zähler mit Überlauf) */
export function seq16Newer(a: number, b: number): boolean {
  const d = (a - b) & 0xffff;
  return d !== 0 && d < 0x8000;
}

// --- Binär: Eingaben Client → Host ------------------------------------------
// [u8 typ][u32 seq der neuesten Eingabe][u8 anzahl][anzahl × (i8 lenkung, u8 tasten)]
// Die Eingaben stehen alt → neu. Jedes Paket wiederholt die letzten paar,
// damit ein einzelnes verlorenes Paket keine Lücke reißt.

export const CMD_REDUNDANCY = 4;

export function encodeCmds(newestSeq: number, cmds: Cmd[]): ArrayBuffer {
  const buf = new ArrayBuffer(6 + cmds.length * 2);
  const v = new DataView(buf);
  v.setUint8(0, PKT_CMD);
  v.setUint32(1, newestSeq);
  v.setUint8(5, cmds.length);
  for (let i = 0; i < cmds.length; i++) {
    v.setInt8(6 + i * 2, cmds[i].steer);
    v.setUint8(7 + i * 2, cmds[i].buttons);
  }
  return buf;
}

export function decodeCmds(view: DataView): { newestSeq: number; cmds: Cmd[] } | null {
  if (view.byteLength < 6) return null;
  const count = view.getUint8(5);
  if (view.byteLength < 6 + count * 2) return null;
  const cmds: Cmd[] = [];
  for (let i = 0; i < count; i++) {
    cmds.push({ steer: view.getInt8(6 + i * 2), buttons: view.getUint8(7 + i * 2) });
  }
  return { newestSeq: view.getUint32(1), cmds };
}

// --- Binär: Snapshot Host → Client ------------------------------------------
// [u8 typ][u32 host-tick][u8 anzahl][anzahl × Spieler]
// Spieler: [u8 slot][u32 ptick][u32 ack][Zustand 25 Byte]
//   ptick = wie viele Simulationsschritte dieser Spieler insgesamt gemacht hat
//           (seine eigene Zeitachse – darüber wird er bei anderen interpoliert)
//   ack   = letzte vom Host verarbeitete Eingabe-Nummer dieses Spielers

const STATE_SIZE = 25;
const SNAP_PLAYER_SIZE = 9 + STATE_SIZE;

export interface SnapshotPlayer {
  slot: number;
  ptick: number;
  ack: number;
  state: KartState;
}

export interface Snapshot {
  tick: number;
  players: SnapshotPlayer[];
}

function writeState(v: DataView, o: number, s: KartState): void {
  v.setFloat32(o, s.x);
  v.setFloat32(o + 4, s.z);
  v.setFloat32(o + 8, s.y);
  v.setFloat32(o + 12, s.vy);
  v.setFloat32(o + 16, s.heading);
  v.setFloat32(o + 20, s.speed);
  v.setUint8(o + 24, s.flags);
}

function readState(v: DataView, o: number): KartState {
  return {
    x: v.getFloat32(o),
    z: v.getFloat32(o + 4),
    y: v.getFloat32(o + 8),
    vy: v.getFloat32(o + 12),
    heading: v.getFloat32(o + 16),
    speed: v.getFloat32(o + 20),
    flags: v.getUint8(o + 24),
  };
}

export function encodeSnapshot(snap: Snapshot): ArrayBuffer {
  const buf = new ArrayBuffer(6 + snap.players.length * SNAP_PLAYER_SIZE);
  const v = new DataView(buf);
  v.setUint8(0, PKT_SNAPSHOT);
  v.setUint32(1, snap.tick);
  v.setUint8(5, snap.players.length);
  let o = 6;
  for (const p of snap.players) {
    v.setUint8(o, p.slot);
    v.setUint32(o + 1, p.ptick);
    v.setUint32(o + 5, p.ack);
    writeState(v, o + 9, p.state);
    o += SNAP_PLAYER_SIZE;
  }
  return buf;
}

export function decodeSnapshot(view: DataView): Snapshot | null {
  if (view.byteLength < 6) return null;
  const count = view.getUint8(5);
  if (view.byteLength < 6 + count * SNAP_PLAYER_SIZE) return null;
  const players: SnapshotPlayer[] = [];
  let o = 6;
  for (let i = 0; i < count; i++) {
    players.push({
      slot: view.getUint8(o),
      ptick: view.getUint32(o + 1),
      ack: view.getUint32(o + 5),
      state: readState(view, o + 9),
    });
    o += SNAP_PLAYER_SIZE;
  }
  return { tick: view.getUint32(1), players };
}
