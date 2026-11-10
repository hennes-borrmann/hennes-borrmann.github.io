// Alles, was über die Leitung geht.
//
// Zuverlässiger Kanal: JSON-Nachrichten mit Feld "t" als Typ.
// Schneller Kanal: Binärpakete, erstes Byte = Pakettyp.

import { type Cmd, type KartState } from '../game/sim';

/** Wird bei jeder inkompatiblen Änderung erhöht; steckt auch in den Peer-Kennungen. */
export const PROTOCOL_VERSION = 2;
const ID_PREFIX = `hbkart${PROTOCOL_VERSION}`;

export const roomPeerId = (code: string): string => `${ID_PREFIX}-r-${code}`;
export const screenPeerId = (screenId: string): string => `${ID_PREFIX}-s-${screenId}`;

// --- Pakettypen schneller Kanal (0 und 1 gehören dem Link: Ping/Pong) -------

export const PKT_CTRL_INPUT = 0x10; // Handy → Bildschirm
export const PKT_CMD = 0x20; // Client-Bildschirm → Host
export const PKT_SNAPSHOT = 0x21; // Host → Client-Bildschirm

// --- Handy ↔ Bildschirm (zuverlässig) ---------------------------------------

export type ControllerToScreen =
  | { t: 'hello'; v: number; cid: string; build?: string }
  /** Item-Druck mit Zählerstand; sichert kurze Tipper ab, falls schnelle Pakete verloren gehen. */
  | { t: 'press'; n: number }
  | { t: 'info'; tilt: boolean; sensorHz: number; sendHz: number }
  | { t: 'bye' };

export type ScreenToController =
  /** slot = -1, solange der Bildschirm noch in keiner Lobby ist. */
  | { t: 'paired'; name: string; slot: number; room: string | null; phase: string; build?: string }
  /** Anzeige auf dem Handy während des Rennens. */
  | { t: 'hud'; racing: boolean; item: number; rolling: boolean; place: number; of: number; lap: number; laps: number }
  /** Rückmeldung zum Spüren: Vibration (Android) bzw. Aufblitzen (iOS). */
  | { t: 'fx'; k: FxKind }
  /** Ein anderes Handy hat diesen Bildschirm übernommen. */
  | { t: 'replaced' }
  | { t: 'reject'; reason: 'version' };

/** Spürbare Ereignisse für den Controller. */
export type FxKind = 'hit' | 'bump' | 'boost' | 'pickup' | 'item' | 'go' | 'finish' | 'wall';

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
  /** Freie Plätze im Rennen mit KI-Gegnern auffüllen. */
  bots: boolean;
}

export type RejectReason = 'full' | 'running' | 'version';

export type ScreenToHost =
  | { t: 'hello'; v: number; token: string; name: string; build?: string }
  | { t: 'ready'; v: boolean }
  | { t: 'name'; v: string }
  | { t: 'status'; controller: boolean; ctrlRtt: number }
  | { t: 'leave' };

export type HostToScreen =
  | { t: 'welcome'; slot: number; state: LobbyState; build?: string }
  | { t: 'lobby'; state: LobbyState }
  | { t: 'reject'; reason: RejectReason }
  /** Der Host hat die Lobby bewusst geschlossen. */
  | { t: 'closed' }
  /** Dieser Platz wurde von einem anderen Tab mit demselben Token übernommen. */
  | { t: 'replaced' }
  /** Ein Ereignis, das nur der Host kennt (Treffer, Rempler, Kiste) – fürs Handy dieses Spielers. */
  | { t: 'fx'; k: FxKind };

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
// Jeder Snapshot enthält den kompletten sichtbaren Spielstand. Geht einer
// verloren, ist nichts kaputt – der nächste bringt wieder alles mit.
//
// Kopf:  [u8 typ][u32 host-tick][u8 rennen-nr][u8 phase][u32 start-tick][u8 runden]
//        [u32 kisten-bitfeld][u8 anzahl karts][u8 anzahl reifen][u8 anzahl ölflecken]
// Kart:  [u8 slot (Bit 7 = KI)][u32 ptick][u32 ack][Zustand 30 Byte]
//        [u8 runde][u8 platz][u8 im ziel][u32 zielzeit in ticks]
//   ptick = wie viele Simulationsschritte dieses Kart insgesamt gemacht hat
//           (seine eigene Zeitachse – darüber wird es bei anderen interpoliert)
//   ack   = letzte vom Host verarbeitete Eingabe-Nummer dieses Spielers
// Reifen:   [u8 id][f32 x][f32 z][f32 vx][f32 vz]
// Ölfleck:  [u8 id][f32 x][f32 z]

export const RACE_COUNTDOWN = 0;
export const RACE_RUNNING = 1;
export const RACE_RESULTS = 2;

const STATE_SIZE = 30;
const SNAP_HEADER = 19;
const SNAP_KART_SIZE = 9 + STATE_SIZE + 7;
const SNAP_TIRE_SIZE = 17;
const SNAP_OIL_SIZE = 9;

export interface SnapshotKart {
  slot: number;
  bot: boolean;
  ptick: number;
  ack: number;
  state: KartState;
  lap: number;
  place: number;
  finished: boolean;
  /** Zeit von "Los" bis ins Ziel in Ticks (nur gültig, wenn finished). */
  finishTicks: number;
}

export interface SnapshotTire {
  id: number;
  x: number;
  z: number;
  vx: number;
  vz: number;
}

export interface SnapshotOil {
  id: number;
  x: number;
  z: number;
}

export interface Snapshot {
  tick: number;
  /** Zählt bei jedem Neustart hoch – daran erkennt der Client ein neues Rennen. */
  raceId: number;
  phase: number;
  /** Host-Tick, bei dem die Ampel auf "Los" springt. */
  goTick: number;
  laps: number;
  /** Bit i gesetzt = Kiste i liegt bereit. */
  boxes: number;
  karts: SnapshotKart[];
  tires: SnapshotTire[];
  oils: SnapshotOil[];
}

function writeState(v: DataView, o: number, s: KartState): void {
  v.setFloat32(o, s.x);
  v.setFloat32(o + 4, s.z);
  v.setFloat32(o + 8, s.heading);
  v.setFloat32(o + 12, s.vx);
  v.setFloat32(o + 16, s.vz);
  v.setUint16(o + 20, s.seg);
  v.setUint8(o + 22, s.boost);
  v.setInt8(o + 23, s.driftDir);
  v.setUint8(o + 24, s.driftCharge);
  v.setUint8(o + 25, s.spin);
  v.setUint8(o + 26, s.shield);
  v.setUint8(o + 27, (s.item & 15) | ((s.nextItem & 15) << 4));
  v.setUint8(o + 28, s.roulette);
  v.setUint8(o + 29, s.flags);
}

function readState(v: DataView, o: number): KartState {
  const items = v.getUint8(o + 27);
  return {
    x: v.getFloat32(o),
    z: v.getFloat32(o + 4),
    heading: v.getFloat32(o + 8),
    vx: v.getFloat32(o + 12),
    vz: v.getFloat32(o + 16),
    seg: v.getUint16(o + 20),
    boost: v.getUint8(o + 22),
    driftDir: v.getInt8(o + 23),
    driftCharge: v.getUint8(o + 24),
    spin: v.getUint8(o + 25),
    shield: v.getUint8(o + 26),
    item: items & 15,
    nextItem: items >> 4,
    roulette: v.getUint8(o + 28),
    flags: v.getUint8(o + 29),
  };
}

export function encodeSnapshot(snap: Snapshot): ArrayBuffer {
  const size =
    SNAP_HEADER + snap.karts.length * SNAP_KART_SIZE + snap.tires.length * SNAP_TIRE_SIZE + snap.oils.length * SNAP_OIL_SIZE;
  const buf = new ArrayBuffer(size);
  const v = new DataView(buf);
  v.setUint8(0, PKT_SNAPSHOT);
  v.setUint32(1, snap.tick);
  v.setUint8(5, snap.raceId & 0xff);
  v.setUint8(6, snap.phase);
  v.setUint32(7, snap.goTick);
  v.setUint8(11, snap.laps);
  v.setUint32(12, snap.boxes >>> 0);
  v.setUint8(16, snap.karts.length);
  v.setUint8(17, snap.tires.length);
  v.setUint8(18, snap.oils.length);
  let o = SNAP_HEADER;
  for (const k of snap.karts) {
    v.setUint8(o, (k.slot & 0x7f) | (k.bot ? 0x80 : 0));
    v.setUint32(o + 1, k.ptick);
    v.setUint32(o + 5, k.ack);
    writeState(v, o + 9, k.state);
    const r = o + 9 + STATE_SIZE;
    v.setUint8(r, k.lap);
    v.setUint8(r + 1, k.place);
    v.setUint8(r + 2, k.finished ? 1 : 0);
    v.setUint32(r + 3, k.finishTicks);
    o += SNAP_KART_SIZE;
  }
  for (const t of snap.tires) {
    v.setUint8(o, t.id);
    v.setFloat32(o + 1, t.x);
    v.setFloat32(o + 5, t.z);
    v.setFloat32(o + 9, t.vx);
    v.setFloat32(o + 13, t.vz);
    o += SNAP_TIRE_SIZE;
  }
  for (const t of snap.oils) {
    v.setUint8(o, t.id);
    v.setFloat32(o + 1, t.x);
    v.setFloat32(o + 5, t.z);
    o += SNAP_OIL_SIZE;
  }
  return buf;
}

export function decodeSnapshot(view: DataView): Snapshot | null {
  if (view.byteLength < SNAP_HEADER) return null;
  const nKarts = view.getUint8(16);
  const nTires = view.getUint8(17);
  const nOils = view.getUint8(18);
  if (view.byteLength < SNAP_HEADER + nKarts * SNAP_KART_SIZE + nTires * SNAP_TIRE_SIZE + nOils * SNAP_OIL_SIZE) return null;
  const snap: Snapshot = {
    tick: view.getUint32(1),
    raceId: view.getUint8(5),
    phase: view.getUint8(6),
    goTick: view.getUint32(7),
    laps: view.getUint8(11),
    boxes: view.getUint32(12),
    karts: [],
    tires: [],
    oils: [],
  };
  let o = SNAP_HEADER;
  for (let i = 0; i < nKarts; i++) {
    const head = view.getUint8(o);
    const r = o + 9 + STATE_SIZE;
    snap.karts.push({
      slot: head & 0x7f,
      bot: (head & 0x80) !== 0,
      ptick: view.getUint32(o + 1),
      ack: view.getUint32(o + 5),
      state: readState(view, o + 9),
      lap: view.getUint8(r),
      place: view.getUint8(r + 1),
      finished: view.getUint8(r + 2) !== 0,
      finishTicks: view.getUint32(r + 3),
    });
    o += SNAP_KART_SIZE;
  }
  for (let i = 0; i < nTires; i++) {
    snap.tires.push({
      id: view.getUint8(o),
      x: view.getFloat32(o + 1),
      z: view.getFloat32(o + 5),
      vx: view.getFloat32(o + 9),
      vz: view.getFloat32(o + 13),
    });
    o += SNAP_TIRE_SIZE;
  }
  for (let i = 0; i < nOils; i++) {
    snap.oils.push({ id: view.getUint8(o), x: view.getFloat32(o + 1), z: view.getFloat32(o + 5) });
    o += SNAP_OIL_SIZE;
  }
  return snap;
}
