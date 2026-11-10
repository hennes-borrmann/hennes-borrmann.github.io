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
//   ?debug=0      Debug-Overlay beim Start ausblenden
//   ?peerlog=3    ausführliches PeerJS-Protokoll in der Browser-Konsole (0–3)

export type TurnMode = 'auto' | 'force' | 'off';

export interface DebugParams {
  turn: TurnMode;
  lag: number;
  jitter: number;
  loss: number;
  signal: string | null;
  debugOverlay: boolean;
  /** PeerJS-Protokollstufe: 0 nichts, 1 Fehler, 2 Warnungen, 3 alles. */
  peerLog: number;
}

const FORWARDED = ['turn', 'lag', 'jitter', 'loss', 'signal', 'debug', 'peerlog'];

function num(params: URLSearchParams, key: string, max: number): number {
  const v = Number(params.get(key));
  return Number.isFinite(v) && v > 0 ? Math.min(v, max) : 0;
}

export function readDebugParams(search: string = location.search): DebugParams {
  const p = new URLSearchParams(search);
  const turn = p.get('turn');
  return {
    turn: turn === 'force' || turn === 'off' ? turn : 'auto',
    lag: num(p, 'lag', 2000),
    jitter: num(p, 'jitter', 1000),
    loss: num(p, 'loss', 90),
    signal: p.get('signal'),
    debugOverlay: p.get('debug') !== '0',
    peerLog: p.has('peerlog') ? Math.max(0, Math.min(3, Number(p.get('peerlog')) || 0)) : 1,
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
