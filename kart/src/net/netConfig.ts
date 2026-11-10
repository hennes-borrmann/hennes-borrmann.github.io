// ICE-/TURN- und Signaling-Konfiguration.
//
// Die Werte stehen in public/net-config.json und werden zur Laufzeit geladen.
// So lässt sich ein TURN-Server eintragen, ohne den Code anzufassen.
//
// Zwei Wege für TURN:
//   1. "turn": feste Zugangsdaten { urls, username, credential }
//   2. "turnCredentialsUrl": eine URL, die eine iceServers-Liste als JSON liefert
//      (entweder direkt als Array oder als { "iceServers": [...] }).
//      Das passt zu Anbietern mit kurzlebigen Zugangsdaten.

import type { PeerOptions } from 'peerjs';
import { readDebugParams, type TurnMode } from './debugParams';

interface TurnEntry {
  urls: string | string[];
  username?: string;
  credential?: string;
}

interface NetConfigFile {
  stun?: string[];
  turn?: TurnEntry | TurnEntry[] | null;
  turnCredentialsUrl?: string;
  peerServer?: { host: string; port?: number; path?: string; secure?: boolean; key?: string } | null;
}

export interface NetSetup {
  rtc: RTCConfiguration;
  /** Optionen für den PeerJS-Konstruktor (leer = öffentlicher PeerJS-Server). */
  peerServer: Pick<PeerOptions, 'host' | 'port' | 'path' | 'secure' | 'key'>;
  turn: {
    /** Ist überhaupt ein TURN-Server eingetragen und geladen? */
    available: boolean;
    mode: TurnMode;
    /** Fehlermeldung, falls das Laden der Zugangsdaten gescheitert ist. */
    error: string | null;
  };
}

const DEFAULT_STUN = ['stun:stun.l.google.com:19302'];

function isTurnUrl(url: string): boolean {
  return url.startsWith('turn:') || url.startsWith('turns:');
}

function hasTurn(server: RTCIceServer): boolean {
  const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
  return urls.some(isTurnUrl);
}

/** Browser lehnen Port 53 ab; solche Einträge würden die Verbindung nur bremsen. */
function sanitize(server: RTCIceServer): RTCIceServer | null {
  const urls = (Array.isArray(server.urls) ? server.urls : [server.urls]).filter(
    (u) => typeof u === 'string' && !/:53(\?|$)/.test(u),
  );
  if (urls.length === 0) return null;
  return { ...server, urls };
}

async function fetchJson(url: string, timeoutMs: number): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { cache: 'no-store', signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function parseSignal(spec: string): NetSetup['peerServer'] {
  // "host:port" oder "host" – für lokale Tests ohne TLS, sonst mit TLS.
  const [host, portRaw] = spec.split(':');
  const local = host === 'localhost' || host === '127.0.0.1' || /^(10|192\.168|172\.(1[6-9]|2\d|3[01]))\./.test(host);
  const port = portRaw ? Number(portRaw) : local ? 9000 : 443;
  return { host, port, path: '/', secure: !local };
}

/**
 * @param appRoot Basis-URL der App (Ordner, in dem net-config.json liegt).
 */
export async function loadNetSetup(appRoot: URL): Promise<NetSetup> {
  const debug = readDebugParams();
  let file: NetConfigFile = {};
  try {
    file = (await fetchJson(new URL('net-config.json', appRoot).href, 4000)) as NetConfigFile;
  } catch (err) {
    console.warn('[net] net-config.json nicht geladen, nutze Standardwerte', err);
  }

  const iceServers: RTCIceServer[] = [];
  const stun = file.stun && file.stun.length > 0 ? file.stun : DEFAULT_STUN;
  iceServers.push({ urls: stun });

  let turnError: string | null = null;
  const turnServers: RTCIceServer[] = [];

  if (file.turn) {
    const entries = Array.isArray(file.turn) ? file.turn : [file.turn];
    for (const e of entries) {
      const urls = Array.isArray(e.urls) ? e.urls : [e.urls];
      if (urls.filter(Boolean).length > 0) turnServers.push({ urls, username: e.username, credential: e.credential });
    }
  }

  if (file.turnCredentialsUrl) {
    try {
      const data = await fetchJson(file.turnCredentialsUrl, 5000);
      const list = Array.isArray(data) ? data : (data as { iceServers?: unknown }).iceServers;
      const arr = Array.isArray(list) ? list : list ? [list] : [];
      for (const s of arr as RTCIceServer[]) if (s && s.urls) turnServers.push(s);
      if (!turnServers.some(hasTurn)) turnError = 'Antwort enthielt keinen TURN-Server';
    } catch (err) {
      turnError = `TURN-Zugangsdaten nicht abrufbar (${(err as Error).message})`;
    }
  }

  if (debug.turn !== 'off') {
    for (const s of turnServers) {
      const clean = sanitize(s);
      if (clean) iceServers.push(clean);
    }
  }

  const available = iceServers.some(hasTurn);
  const rtc: RTCConfiguration = { iceServers };
  if (debug.turn === 'force') {
    // Ohne eingetragenen TURN-Server kommt mit 'relay' gar keine Verbindung zustande –
    // genau das soll der Test dann auch zeigen.
    rtc.iceTransportPolicy = 'relay';
  }

  let peerServer: NetSetup['peerServer'] = {};
  if (debug.signal) peerServer = parseSignal(debug.signal);
  else if (file.peerServer?.host) peerServer = { ...file.peerServer };

  return { rtc, peerServer, turn: { available, mode: debug.turn, error: turnError } };
}
