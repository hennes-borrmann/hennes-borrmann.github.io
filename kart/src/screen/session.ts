// Was ein Bildschirm über ein Neuladen der Seite hinweg behält.
//
// sessionStorage gilt pro Tab: zwei Tabs im selben Browser sind zwei
// verschiedene Bildschirme (praktisch zum Testen), ein neu geladener Tab ist
// derselbe wie vorher. Nur der Name liegt in localStorage.

import type { HostLobbySave } from '../lobby/hostLobby';
import { SCREEN_ID_LENGTH, randomCode, randomToken } from '../net/codes';

const KEY_SCREEN = 'kart.screen';
const KEY_SESSION = 'kart.session';
const KEY_NAME = 'kart.name';
/** Ältere Sitzungen werden nicht automatisch fortgesetzt. */
const SESSION_MAX_AGE_MS = 3 * 60 * 60 * 1000;

export interface ScreenIdentity {
  screenId: string;
  /** Mit diesem Token gibt der Signaling-Server dieselbe Kennung nach einem Neuladen zurück. */
  peerToken: string;
}

export interface Session {
  role: 'host' | 'client';
  code: string;
  playerToken: string;
  /** Nur Host: Token für die Raum-Kennung und die gesicherten Plätze. */
  roomPeerToken?: string;
  hostSave?: HostLobbySave;
  savedAt: number;
}

function read<T>(store: Storage, key: string): T | null {
  try {
    const raw = store.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(store: Storage, key: string, value: unknown): void {
  try {
    store.setItem(key, JSON.stringify(value));
  } catch {
    /* Privatmodus o. Ä.: dann eben ohne Wiederherstellung */
  }
}

export function loadScreenIdentity(): ScreenIdentity {
  const saved = read<ScreenIdentity>(sessionStorage, KEY_SCREEN);
  if (saved?.screenId && saved.peerToken) return saved;
  return newScreenIdentity();
}

export function newScreenIdentity(): ScreenIdentity {
  const id: ScreenIdentity = { screenId: randomCode(SCREEN_ID_LENGTH), peerToken: randomToken() };
  write(sessionStorage, KEY_SCREEN, id);
  return id;
}

export function loadSession(): Session | null {
  const s = read<Session>(sessionStorage, KEY_SESSION);
  if (!s || !s.code || !s.playerToken) return null;
  if (Date.now() - s.savedAt > SESSION_MAX_AGE_MS) return null;
  return s;
}

export function saveSession(session: Omit<Session, 'savedAt'>): void {
  write(sessionStorage, KEY_SESSION, { ...session, savedAt: Date.now() });
}

export function clearSession(): void {
  try {
    sessionStorage.removeItem(KEY_SESSION);
  } catch {
    /* egal */
  }
}

export function loadName(): string {
  try {
    return localStorage.getItem(KEY_NAME) ?? '';
  } catch {
    return '';
  }
}

export function saveName(name: string): void {
  try {
    localStorage.setItem(KEY_NAME, name);
  } catch {
    /* egal */
  }
}
