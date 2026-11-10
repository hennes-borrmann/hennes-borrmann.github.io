# Schräglage (Arbeitstitel)

Kart-Racer für den Browser. Jeder Spieler hat einen eigenen Bildschirm (iPad oder Desktop) und lenkt mit dem Handy. Online über Lobbys mit Raumcode, kein Splitscreen.

**Stand: Phase 2 – spielbare Grundversion.** Eine Strecke, drei Runden, Drift mit Mini-Turbo, drei Items, KI-Gegner. Grafik und Sound sind noch Platzhalter; die kommen in Phase 3.

## Spielen

**https://hennes-borrmann.github.io/kart/**

Auf dem iPad oder Rechner öffnen, Lobby erstellen, QR-Code mit dem Handy scannen, Rennen starten. Mehr ist nicht nötig.

### Steuerung

| Handy | Tastatur | Wirkung |
| --- | --- | --- |
| Neigen | Pfeiltasten / A, D | Lenken |
| Gas | Pfeil hoch / W | Beschleunigen |
| Bremse | Pfeil runter / S | Bremsen, im Stand rückwärts |
| Drift | Shift | In der Kurve gedrückt halten, beim Loslassen gibt es Schub |
| Item | Leertaste | Eingesammeltes Item benutzen |

**Drift:** Einlenken und Drift halten. Das Kart stellt sich quer und dreht in diese Richtung weiter; mit der Lenkung wählst du nur noch zwischen engem und weitem Bogen. Je länger (und je enger), desto höher die Stufe – die Funken wechseln von Türkis über Gelb zu Magenta. Erst das Loslassen bringt den Schub.

**Items** (aus den gelben Kisten): *Zisch* gibt kräftigen Schub. Der *Rollreifen* rollt geradeaus, prallt an der Bande ab und wirft Getroffene aus der Bahn. Der *Ölfleck* bleibt hinter dir liegen.

Freie Plätze fahren KI-Gegner (in der Lobby abschaltbar). Sie werden etwas langsamer, wenn sie weit vorn liegen, und etwas schneller, wenn sie weit zurückliegen.

## Wie das Spiel auf die Website kommt

Dieser Ordner (`kart-src/`) enthält den Quellcode. `npm run build` schreibt das fertige Spiel nach `../kart/`, und dieser Ordner ist mit eingecheckt. GitHub Pages liefert das Repository so aus, wie es auf `main` liegt – sobald ein neuer Build auf `main` ist, ist er nach etwa einer Minute online. Es gibt keinen Build-Schritt auf GitHub und nichts einzustellen.

Nach jeder Änderung am Code gehört deshalb dazu: bauen und `kart/` mit einchecken.

Unten auf der Startseite und in der Diagnose steht eine Versionskennung (Datum und Uhrzeit des Builds). Haben zwei Geräte unterschiedliche Fassungen im Zwischenspeicher, weist das Spiel darauf hin; dann hilft Neuladen der Seite.

## Lokal entwickeln

Voraussetzung: Node.js 22.

```bash
cd kart-src
npm install
npm run dev          # http://localhost:5173  (Bildschirm), /c/ ist der Controller
```

Am Desktop lässt sich ohne Handy fahren: Pfeiltasten oder WASD, Shift = Drift, Leertaste = Item. Zwei Bildschirme testest du mit zwei **Fenstern** nebeneinander (nicht zwei Tabs in einem Fenster – ein Tab im Hintergrund wird vom Browser angehalten).

Für echte Handys reicht `npm run dev` nicht: der Bewegungssensor braucht HTTPS. Dafür ist die veröffentlichte Seite da.

## Was du prüfen solltest

1. iPad/Rechner: Seite öffnen, Namen eintragen, **Lobby erstellen**.
2. Handy: QR-Code unter „Dein Controller“ scannen → **Tippen zum Starten** → Sensor erlauben → Handy quer halten → **Kalibrieren**.
3. Zweiter Bildschirm: Einladungslink öffnen oder Raumcode eintippen, eigenes Handy koppeln, **Ich bin bereit**.
4. Host: **Rennen starten**. Nach dem Countdown drei Runden fahren.
5. Fahrgefühl: Beschleunigung, Lenkung, Drift und Mini-Turbo, Rempler, Items. Das Handy zeigt Platz, Runde und Item und vibriert bei Treffern (Android; das iPhone blitzt stattdessen am Rand auf).
6. Nach dem Ziel: Ergebnisliste, dann **Nochmal** oder **Zur Lobby** (wählt der Host).
7. Diagnose (Knopf „Diagnose“ oder Taste F2) bei Bedarf: Latenz, Raten, „direkt“ oder „über TURN“.

## TURN – was ohne nicht geht

WebRTC verbindet Geräte direkt. Das klappt im selben WLAN und zwischen den meisten Heimanschlüssen. Es scheitert typischerweise, wenn

- ein Gerät im **Mobilfunknetz** hängt (auch: Handy als Hotspot),
- ein **Schul-, Firmen- oder Gäste-WLAN** Geräte voneinander abschottet oder UDP sperrt.

Dann braucht es einen TURN-Server, der die Daten weiterreicht. **Aktuell ist keiner eingetragen** – in solchen Netzen kommt die Verbindung also nicht zustande (Meldung „Keine Verbindung zum Host“ bzw. das Handy bleibt bei „Verbinde …“). Über TURN steigt die Latenz, weil alles einen Umweg nimmt.

Eintragen in `public/net-config.json` (danach neu bauen), entweder mit festen Zugangsdaten:

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
| `?debug=0` / `?debug=1` | Diagnose ausgeblendet bzw. auch im Rennen von Anfang an sichtbar |
| `?laps=1` | Rundenzahl überschreiben (zählt beim Host) |
| `?auto=1` | das eigene Kart fährt von selbst – zum Ausprobieren ohne Controller |
| `?signal=host:port` | eigener PeerJS-Server |
| `?peerlog=3` | ausführliches Verbindungsprotokoll in der Browser-Konsole |

Die Schalter wandern automatisch in den QR-Code und den Einladungslink.

## Aufbau

```
src/net/         Verbindungsschicht: Signaling-Endpunkt, Link (zuverlässiger + unreliable Kanal), Protokoll, ICE/TURN
src/lobby/       Lobby auf dem Host und auf den Mitspieler-Bildschirmen, Platzvergabe, Wiedereinstieg
src/controller/  Handy-Seite: Neigung → Lenkwert, Kalibrierung, Touch-Tasten, Verbindung zum Bildschirm
src/game/        sim.ts Fahrphysik · track.ts Strecke · ai.ts KI-Fahrer · hostGame.ts Rennen auf dem Host
                 (Ablauf, Items, Rempler) · clientGame.ts Vorhersage/Abgleich · interp.ts Interpolation
src/render/      three.js-Szene (Strecke, Karts, Effekte) und Diagnose-Overlay
src/screen/      Ablauf und Oberfläche des Bildschirms
audio/           folgt in Phase 3
```

Netzwerkmodell: Der Lobby-Ersteller rechnet das Rennen. Die anderen schicken ihre Eingaben (60/s) und bekommen den kompletten Spielstand zurück (30/s). Das eigene Kart wird vorhergesagt – samt Drift, Schub, Bande und Boost-Feldern – und beim Eintreffen des Host-Stands abgeglichen. Fremde Karts werden 85 ms verzögert interpoliert. Rempler, Treffer und Kisten entscheidet allein der Host.

Eine weitere Strecke braucht nur eine neue `TrackDef` in `track.ts` (Stützpunkte, Breite, Boost-Felder, Kistenreihen). Fahrgefühl wird über die Konstanten am Anfang von `sim.ts` abgestimmt, die Stärke der KI in `ai.ts`.

## Tests

```bash
npm test             # Fahrphysik, Strecke, KI-Runden, komplette Rennen (auch über simulierte Leitung), Lenkung, Protokoll
```

`tests/e2e/run.cjs` spielt den kompletten Ablauf in Chromium durch (Lobby, Kopplung, Fahren, Abbrüche, Neuladen). Dafür braucht es Playwright, `npm run signal` und `npm run preview -- --port 4173` – Details stehen im Kopf der Datei.

## Bekannte Grenzen

- Verlässt der Host die Lobby, ist sie beendet (Host-Migration ist nicht gebaut). Lädt er nur neu, kommen alle von selbst zurück – in die Lobby, nicht ins laufende Rennen.
- Rempler kennt nur der Host. Auf den anderen Bildschirmen rutscht das eigene Kart nach einem Rempler deshalb einen Moment später nach (bei guter Verbindung kaum sichtbar, bei schlechter als kleines Nachziehen).
- Fällt die Verbindung eines Mitspielers im Rennen aus, fährt nach anderthalb Sekunden die KI für ihn weiter, bis er zurück ist.
- Der Host muss im Vordergrund bleiben. Sperrt er das iPad oder wechselt die App, friert die Runde für alle ein.
- Der Host sieht sein eigenes Fahrzeug ohne Verzögerung, alle anderen sehen ihn leicht verzögert. Dieser Vorteil liegt im Modell.
- Das Signaling läuft über den öffentlichen PeerJS-Server. Er ist kostenlos und ohne Zusage zur Verfügbarkeit: fällt er aus, kann niemand beitreten oder koppeln (laufende Verbindungen bleiben bestehen).
- iOS fragt nach einem abgelehnten Sensor-Zugriff erst wieder, wenn Safari komplett geschlossen wurde. Bis dahin gibt es Touch-Lenkung als Ersatz.
