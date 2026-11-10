# Schräglage (Arbeitstitel)

Kart-Racer für den Browser. Jeder Spieler hat einen eigenen Bildschirm (iPad oder Desktop) und lenkt mit dem Handy. Online über Lobbys mit Raumcode, kein Splitscreen.

**Stand: Phase 1 – Verbindung und Lobby.** Es gibt noch kein Rennen, nur eine Testfläche mit einem Würfel pro Spieler.

## Lokal starten

Voraussetzung: Node.js 22.

```bash
cd kart
npm install
npm run dev          # http://localhost:5173  (Bildschirm), /c/ ist der Controller
```

Am Desktop lässt sich ohne Handy fahren: Pfeiltasten oder WASD, Shift = Drift, Leertaste = Item. Zwei Bildschirme testest du mit zwei **Fenstern** nebeneinander (nicht zwei Tabs in einem Fenster – ein Tab im Hintergrund wird vom Browser angehalten).

Für echte Handys reicht `npm run dev` nicht: der Bewegungssensor braucht HTTPS. Dafür ist das Deployment unten da. (`npm run dev:https` startet zwar mit selbstsigniertem Zertifikat im WLAN, die Zertifikatswarnung auf iPhone und iPad macht das aber unbequem.)

## Auf echten Geräten testen (GitHub Pages)

Der Workflow `.github/workflows/pages.yml` baut das Spiel und veröffentlicht es zusammen mit der bestehenden Website. Das Spiel liegt dann unter

**https://hennes-borrmann.github.io/kart/**

Einmalig in den Repository-Einstellungen auf GitHub:

1. **Settings → Pages → Build and deployment → Source: „GitHub Actions“** (statt „Deploy from a branch“).
2. Damit auch der Entwicklungs-Branch veröffentlicht werden darf: **Settings → Environments → github-pages → Deployment branches and tags → Add deployment branch or tag rule →** `claude/*`.
   Ohne Schritt 2 wird nur `main` veröffentlicht; dann muss der Branch erst per Pull Request nach `main`.

Danach veröffentlicht jeder Push automatisch (Dauer rund eine Minute, Fortschritt unter „Actions“). Veröffentlicht wird immer der komplette Stand des Branches, der zuletzt gepusht hat – also Website **und** Spiel aus diesem Branch.

## Was du prüfen solltest

1. iPad/Rechner: Seite öffnen, Namen eintragen, **Lobby erstellen**.
2. Handy: QR-Code unter „Dein Controller“ scannen → **Tippen zum Starten** → Sensor erlauben → Handy quer halten → **Kalibrieren**.
3. Zweiter Bildschirm: Einladungslink öffnen oder Raumcode eintippen, eigenes Handy koppeln, **Ich bin bereit**.
4. Host: **Testfahrt starten**. Fahren, lenken, Drift (Würfel neigt sich), Item (Würfel hüpft).
5. Diagnose (unten links, Taste F2 oder Knopf „Diagnose“) ablesen: Latenz, Raten, „direkt“ oder „über TURN“.
6. Robustheit: Handy sperren und entsperren, Seite auf Handy oder Bildschirm neu laden, WLAN kurz aus. Jeder sollte von selbst auf seinen Platz zurückkommen.

## TURN – was ohne nicht geht

WebRTC verbindet Geräte direkt. Das klappt im selben WLAN und zwischen den meisten Heimanschlüssen. Es scheitert typischerweise, wenn

- ein Gerät im **Mobilfunknetz** hängt (auch: Handy als Hotspot),
- ein **Schul-, Firmen- oder Gäste-WLAN** Geräte voneinander abschottet oder UDP sperrt.

Dann braucht es einen TURN-Server, der die Daten weiterreicht. **Aktuell ist keiner eingetragen** – in solchen Netzen kommt die Verbindung also nicht zustande (Meldung „Keine Verbindung zum Host“ bzw. das Handy bleibt bei „Verbinde …“). Über TURN steigt die Latenz, weil alles einen Umweg nimmt.

Eintragen in `public/net-config.json`, entweder mit festen Zugangsdaten:

```json
{
  "stun": ["stun:stun.l.google.com:19302"],
  "turn": { "urls": ["turn:HOST:3478", "turns:HOST:443?transport=tcp"], "username": "…", "credential": "…" },
  "turnCredentialsUrl": "",
  "peerServer": null
}
```

oder mit `turnCredentialsUrl`: einer Adresse, die eine `iceServers`-Liste als JSON liefert (direkt als Array oder als `{ "iceServers": [...] }`).

Kostenlose Kontingente (Stand November 2026, bitte beim Anbieter prüfen):

- **Metered „Open Relay“**: 20 GB/Monat, kostenloses Konto nötig. Liefert die Serverliste über eine Adresse mit API-Schlüssel – passt zu `turnCredentialsUrl`.
- **Cloudflare Realtime TURN**: 1.000 GB/Monat frei. Die Zugangsdaten müssen serverseitig erzeugt werden (z. B. kleiner Cloudflare Worker), dessen Adresse dann in `turnCredentialsUrl` kommt.

Wichtig: Die Seite ist statisch. Was in `net-config.json` steht, kann jeder lesen und das Kontingent mitbenutzen. Für einen privaten Prototyp ist das vertretbar, für etwas Öffentliches nicht.

Prüfen, ob TURN funktioniert: Seite mit `?turn=force` öffnen (dann ist nur der Umweg erlaubt). Die Diagnose muss „über TURN“ zeigen.

## Test-Schalter (an die Adresse des Bildschirms hängen)

| Parameter | Wirkung |
| --- | --- |
| `?turn=force` / `?turn=off` | nur TURN bzw. TURN ignorieren |
| `?lag=80&jitter=20&loss=5` | künstliche Verzögerung (ms pro Richtung), Schwankung, Paketverlust in % |
| `?debug=0` | Diagnose beim Start ausgeblendet |
| `?signal=host:port` | eigener PeerJS-Server |
| `?peerlog=3` | ausführliches Verbindungsprotokoll in der Browser-Konsole |

Die Schalter wandern automatisch in den QR-Code und den Einladungslink.

## Aufbau

```
src/net/         Verbindungsschicht: Signaling-Endpunkt, Link (zuverlässiger + unreliable Kanal), Protokoll, ICE/TURN
src/lobby/       Lobby auf dem Host und auf den Mitspieler-Bildschirmen, Platzvergabe, Wiedereinstieg
src/controller/  Handy-Seite: Neigung → Lenkwert, Kalibrierung, Touch-Tasten, Verbindung zum Bildschirm
src/game/        Simulation (fester 60-Hz-Takt), Host-Autorität, Vorhersage/Abgleich, Interpolation, Eingaben
src/render/      three.js-Szene und Diagnose-Overlay
src/screen/      Ablauf und Oberfläche des Bildschirms
audio/           folgt in Phase 3
```

Netzwerkmodell: Der Lobby-Ersteller rechnet die Simulation. Die anderen schicken ihre Eingaben (60/s) und bekommen Zustände zurück (30/s). Das eigene Fahrzeug wird vorhergesagt und beim Eintreffen des Host-Stands abgeglichen, fremde Fahrzeuge werden 85 ms verzögert interpoliert.

## Tests

```bash
npm test             # Rechenkern: Lenkung, Filter, Protokoll, Vorhersage mit simulierter Leitung
```

`tests/e2e/run.cjs` spielt den kompletten Ablauf in Chromium durch (Lobby, Kopplung, Fahren, Abbrüche, Neuladen). Dafür braucht es Playwright, `npm run signal` und `npm run preview -- --port 4173` – Details stehen im Kopf der Datei.

## Bekannte Grenzen

- Verlässt der Host die Lobby, ist sie beendet (Host-Migration ist nicht gebaut). Lädt er nur neu, kommen alle von selbst zurück – in die Lobby, nicht in die laufende Testfahrt.
- Der Host muss im Vordergrund bleiben. Sperrt er das iPad oder wechselt die App, friert die Runde für alle ein.
- Der Host sieht sein eigenes Fahrzeug ohne Verzögerung, alle anderen sehen ihn leicht verzögert. Dieser Vorteil liegt im Modell.
- Das Signaling läuft über den öffentlichen PeerJS-Server. Er ist kostenlos und ohne Zusage zur Verfügbarkeit: fällt er aus, kann niemand beitreten oder koppeln (laufende Verbindungen bleiben bestehen).
- iOS fragt nach einem abgelehnten Sensor-Zugriff erst wieder, wenn Safari komplett geschlossen wurde. Bis dahin gibt es Touch-Lenkung als Ersatz.
