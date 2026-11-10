// Cloudflare-Worker: nur kurzlebige ICE-Zugangsdaten gehen an den Browser.
// API und Felder geprüft am 2026-11-10:
// https://developers.cloudflare.com/realtime/turn/generate-credentials/
const SPIEL_ORIGIN = 'https://hennes-borrmann.github.io';
const ZEITLIMIT_MS = 3500; // Das Spiel wartet insgesamt höchstens fünf Sekunden.

function erlaubterUrsprung(ursprung) {
  if (ursprung === SPIEL_ORIGIN) return true;
  if (!ursprung) return false;
  try {
    const adresse = new URL(ursprung);
    return adresse.origin === ursprung && adresse.protocol === 'http:' && adresse.hostname === 'localhost';
  } catch {
    return false;
  }
}

function antwort(status, inhalt, ursprung = null, zusatz = {}) {
  const headers = new Headers({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    Vary: 'Origin, Access-Control-Request-Method, Access-Control-Request-Headers',
    ...zusatz,
  });
  if (ursprung) headers.set('Access-Control-Allow-Origin', ursprung);
  return new Response(inhalt === null ? null : JSON.stringify(inhalt), { status, headers });
}

/** Nur benötigte ICE-Felder weitergeben; kein Fehlertext und keine Metadaten des Anbieters. */
function serverListe(daten) {
  if (!Array.isArray(daten?.iceServers)) return null;
  const liste = [];
  let hatTurn = false;
  for (const server of daten.iceServers) {
    if (!server || typeof server !== 'object') return null;
    const roh = typeof server.urls === 'string' ? [server.urls] : server.urls;
    if (!Array.isArray(roh) || roh.some((url) => typeof url !== 'string' || !/^(stun|stuns|turn|turns):[^\s]+$/.test(url))) return null;
    // Browser sperren Port 53. Mindestens eine brauchbare TURN-Adresse muss bleiben.
    const urls = roh.filter((url) => !/:53(?:\?|$)/.test(url));
    if (urls.length === 0) continue;
    if (urls.some((url) => /^turns?:/.test(url))) {
      if (typeof server.username !== 'string' || !server.username || typeof server.credential !== 'string' || !server.credential) return null;
      liste.push({ urls, username: server.username, credential: server.credential });
      hatTurn = true;
    } else {
      liste.push({ urls });
    }
  }
  return hatTurn ? liste : null;
}

export default {
  async fetch(request, env) {
    const ursprung = request.headers.get('Origin');
    if (!erlaubterUrsprung(ursprung)) return antwort(403, { error: 'Ursprung nicht erlaubt.' });
    if (new URL(request.url).pathname !== '/credentials') return antwort(404, { error: 'Adresse nicht gefunden.' }, ursprung);

    if (request.method === 'OPTIONS') {
      if (request.headers.get('Access-Control-Request-Method') !== 'GET') {
        return antwort(405, { error: 'Nur GET ist erlaubt.' }, ursprung, { Allow: 'GET, OPTIONS' });
      }
      const angefragt = (request.headers.get('Access-Control-Request-Headers') ?? '').split(',').map((h) => h.trim().toLowerCase()).filter(Boolean);
      if (angefragt.some((h) => h !== 'content-type' && h !== 'accept')) {
        return antwort(403, { error: 'Angefragte Header nicht erlaubt.' }, ursprung);
      }
      return antwort(204, null, ursprung, {
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type, Accept',
        'Access-Control-Max-Age': '600',
      });
    }
    if (request.method !== 'GET') return antwort(405, { error: 'Nur GET ist erlaubt.' }, ursprung, { Allow: 'GET, OPTIONS' });

    // Beide Werte ausschließlich als Worker-Secrets setzen, niemals aus URL/Body übernehmen.
    const schluessel = env.TURN_KEY_ID;
    const token = env.TURN_KEY_API_TOKEN;
    const gueltigkeit = Number(env.TURN_TTL_SECONDS ?? '1800');
    if (typeof schluessel !== 'string' || !schluessel.trim() || typeof token !== 'string' || !token.trim() ||
        !Number.isInteger(gueltigkeit) || gueltigkeit < 60 || gueltigkeit > 3600 || typeof env.TURN_LIMITER?.limit !== 'function') {
      return antwort(503, { error: 'TURN-Zugang ist noch nicht eingerichtet.' }, ursprung);
    }

    try {
      // Cloudflare setzt die Client-IP. Lokal ohne diesen Header teilen sich alle Anfragen einen Schlüssel.
      // Keine IP-Adressen, Secrets oder Zugangsdaten in Logs schreiben.
      const ip = request.headers.get('CF-Connecting-IP') || 'ohne-ip';
      const ergebnis = await env.TURN_LIMITER.limit({ key: `turn:${ip}` });
      if (ergebnis.success === false) return antwort(429, { error: 'Zu viele Abrufe. Bitte nach einer Minute erneut versuchen.' }, ursprung, { 'Retry-After': '60' });
      if (ergebnis.success !== true) throw new Error('Drosselung ohne Ergebnis');
    } catch {
      return antwort(503, { error: 'Abrufschutz vorübergehend nicht verfügbar.' }, ursprung);
    }

    const abbruch = new AbortController();
    const timer = setTimeout(() => abbruch.abort(), ZEITLIMIT_MS);
    try {
      const upstream = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(schluessel.trim())}/credentials/generate-ice-servers`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token.trim()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ttl: gueltigkeit }),
        redirect: 'error',
        signal: abbruch.signal,
      });
      if (!upstream.ok) return antwort(502, { error: 'TURN-Anbieter konnte keine Zugangsdaten ausstellen.' }, ursprung);
      const iceServers = serverListe(await upstream.json());
      if (!iceServers) return antwort(502, { error: 'TURN-Anbieter lieferte keine gültige Serverliste.' }, ursprung);
      return antwort(200, { iceServers }, ursprung);
    } catch {
      return antwort(abbruch.signal.aborted ? 504 : 502, { error: 'TURN-Anbieter vorübergehend nicht erreichbar.' }, ursprung);
    } finally {
      clearTimeout(timer);
    }
  },
};
