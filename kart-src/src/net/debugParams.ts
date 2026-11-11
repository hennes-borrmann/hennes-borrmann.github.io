// Test- und Diagnose-Schalter über die URL. Sie werden vom Bildschirm an den
// Controller-Link (QR-Code) und an den Einladungslink weitergereicht, damit
// alle Geräte einer Testrunde dieselbe Einstellung nutzen.
//
//   ?turn=force   nur über TURN verbinden (prüft, ob der TURN-Server funktioniert)
//   ?turn=off     TURN ignorieren (zeigt, was ohne TURN noch geht)
//   ?lag=80       künstliche Verzögerung pro Richtung in ms
//   ?jitter=20    zufällige Zusatzverzögerung 0..n ms (nur schneller Kanal)
//   ?loss=5       Paketverlust in Prozent (nur schneller Kanal)
//   ?signal=host:port   eigener PeerJS-Server statt des öffentlichen
//   ?debug=0      Diagnose ausblenden; ?debug=1 zeigt sie auch im Rennen von Anfang an
//   ?peerlog=3    ausführliches PeerJS-Protokoll in der Browser-Konsole (0–3)
//   ?laps=1       Rundenzahl überschreiben (gilt für den Host)
//   ?aufbau=behutsam  das erste Bild Teil für Teil vorbereiten und festhalten, wobei die Grafik stirbt (gfxGuard.ts)
//   ?auto=1       das eigene Kart fährt von selbst (zum Testen ohne Controller)
//   ?track=2      Strecke vorwählen (0–3, gilt für den Host)
//   ?ai=0         Stärke der KI vorwählen (0 leicht, 1 mittel, 2 schwer)
//   ?q=low        Grafikqualität: low, medium, high oder auto
//   ?mute=1       ohne Ton starten

export type TurnMode = 'auto' | 'force' | 'off';

export interface DebugParams {
  turn: TurnMode;
  lag: number;
  jitter: number;
  loss: number;
  signal: string | null;
  debugOverlay: boolean;
  /** Diagnose auch im Rennen von Anfang an zeigen (?debug=1). */
  debugInRace: boolean;
  /** PeerJS-Protokollstufe: 0 nichts, 1 Fehler, 2 Warnungen, 3 alles. */
  peerLog: number;
  /** Rundenzahl, 0 = Vorgabe der Strecke. */
  laps: number;
  autopilot: boolean;
  /** Erstes Bild Teil für Teil vorbereiten (Suche nach einem Teil, das die Grafik beendet). */
  careful: boolean;
  /** Vorgewählte Strecke, -1 = keine Vorgabe. */
  track: number;
  /** Vorgewählte KI-Stärke, -1 = keine Vorgabe. */
  ai: number;
  quality: 'auto' | 'low' | 'medium' | 'high' | null;
  mute: boolean;
}

const FORWARDED = ['turn', 'lag', 'jitter', 'loss', 'signal', 'debug', 'peerlog', 'laps', 'auto', 'q', 'mute'];

function num(params: URLSearchParams, key: string, max: number): number {
  const v = Number(params.get(key));
  return Number.isFinite(v) && v > 0 ? Math.min(v, max) : 0;
}

export function readDebugParams(search: string = location.search): DebugParams {
  const p = new URLSearchParams(search);
  const turn = p.get('turn');
  const q = p.get('q');
  return {
    turn: turn === 'force' || turn === 'off' ? turn : 'auto',
    lag: num(p, 'lag', 2000),
    jitter: num(p, 'jitter', 1000),
    loss: num(p, 'loss', 90),
    signal: p.get('signal'),
    debugOverlay: p.get('debug') !== '0',
    debugInRace: p.get('debug') === '1',
    peerLog: p.has('peerlog') ? Math.max(0, Math.min(3, Number(p.get('peerlog')) || 0)) : 1,
    laps: Math.round(num(p, 'laps', 9)),
    autopilot: p.get('auto') === '1',
    careful: p.get('aufbau') === 'behutsam',
    track: p.has('track') ? Math.max(0, Math.round(Number(p.get('track')) || 0)) : -1,
    ai: p.has('ai') ? Math.max(0, Math.min(2, Math.round(Number(p.get('ai')) || 0))) : -1,
    quality: ['auto', 'low', 'medium', 'high'].includes(q ?? '') ? (q as 'auto' | 'low' | 'medium' | 'high') : null,
    mute: p.get('mute') === '1',
  };
}

/** Hängt die aktiven Test-Schalter an eine andere URL der App an. */
export function forwardDebugParams(target: URL, search: string = location.search): URL {
  const p = new URLSearchParams(search);
  for (const key of FORWARDED) {
    const v = p.get(key);
    if (v !== null) target.searchParams.set(key, v);
  }
  return target;
}
