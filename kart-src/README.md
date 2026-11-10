# Schräglage (Arbeitstitel)

Kart-Racer für den Browser. Jeder Spieler hat einen eigenen Bildschirm (iPad oder Desktop) und lenkt mit dem Handy. Online über Lobbys mit Raumcode, kein Splitscreen.

**Stand: Phase 3 mit Ausbau Schritt 2.** Vier Strecken mit Höhen, Sprüngen und Abgründen, neun Items, vier wählbare Figuren mit leicht verschiedenen Fahrwerten, KI-Gegner in drei Stärken, Grafik im Stil „Comic-Tusche“, Ton und Musik aus dem Synthesizer.

Alles ist selbst entworfen: Figuren, Strecken, Items, Namen, Klänge. Es gibt keine fremden Modelle, Bilder, Schriften oder Tonaufnahmen im Spiel.

## Spielen

**https://hennes-borrmann.github.io/kart/**

Auf dem iPad oder Rechner öffnen, Lobby erstellen, QR-Code mit dem Handy scannen, Strecke wählen, Rennen starten.

### Steuerung

| Handy | Tastatur | Wirkung |
| --- | --- | --- |
| Neigen | Pfeiltasten / A, D | Lenken |
| Gas | Pfeil hoch / W | Beschleunigen |
| Bremse | Pfeil runter / S | Bremsen, im Stand rückwärts |
| Drift | Shift | In der Kurve gedrückt halten, beim Loslassen gibt es Schub |
| Item | Leertaste | Eingesammeltes Item benutzen |
| – | Esc | Menü im Rennen (Einstellungen, Controller koppeln, zur Lobby) |

**Drift:** Einlenken und Drift halten. Das Kart stellt sich quer und dreht in diese Richtung weiter; mit der Lenkung wählst du nur noch zwischen engem und weitem Bogen. Je länger (und je enger), desto höher die Stufe – die Funken wechseln von Türkis über Gelb zu Magenta. Erst das Loslassen bringt den Schub.

### Strecken

| Strecke | Länge | Besonderheiten |
| --- | --- | --- |
| **Werkshof** | 720 m | Einsteigerstrecke: breit, überall Bande, sanfte Hügel, eine Laderampe zum Springen, ein rollendes Fass |
| **Möwenklippe** | 820 m | Holzsteg ohne Geländer, Serpentine die Klippe hinauf, zwei Kuppen, Sprung über die Bucht, eine Krabbe quert |
| **Glutkessel** | 760 m | Acht um einen Vulkan: überhöhte Kurven, schmaler Grat, Sprung über den Lavastrom, Felsbrücke über die eigene Strecke |
| **Nachtschicht** | 700 m | Hochstraße bei Nacht: rechte Winkel, Sprung von Dach zu Dach, Parkhaus-Spirale über sich selbst hinweg |

Wer von einer Kante oder in eine Lücke fällt, wird nach etwa einer Sekunde wieder auf die Strecke gesetzt – vor Sprüngen mit genug Anlauf. Bergab ist das Kart schneller als bergauf.

### Items (aus den gelben Kisten)

Neun Items:

| Item | Wirkung |
| --- | --- |
| **Zisch** | kräftiger Schub |
| **Rollreifen** | rollt geradeaus, prallt an der Bande ab, wirft Getroffene aus der Bahn |
| **Ölfleck** | bleibt hinter dir liegen |
| **Brummkreisel** | folgt der Strecke und steuert auf den Fahrer vor dir zu |
| **Stoßfänger** | fängt zwölf Sekunden lang den nächsten Treffer ab |
| **Kurzschluss** | drosselt alle, die vor dir liegen, für gut zwei Sekunden |
| **Nebelkerze** | Rauchwolke hinter dir – wer hineinfährt, sieht kurz nichts |
| **Sprungfeder** | Hüpfer aus der Fahrt: über Öl, Reifen und Hindernisse hinweg |
| **Abschleppdrache** | zieht dich vier Sekunden lang von selbst mit rund 145 km/h die Strecke entlang, auch über Lücken; wer im Weg steht, wird beiseitegeschoben; Lenken verschiebt die Spur, die Bremse kappt die Schnur |

Wer vorn liegt, bekommt eher Abwehr (Öl, Nebel, Stoßfänger); wer hinten liegt, eher Schub, Brummkreisel und Kurzschluss. Den Abschleppdrachen gibt es nur auf dem letzten Platz (bei vier Fahrern selten auch auf dem vorletzten) und nur, wenn das Kart davor mehr als 45 m Vorsprung hat.

Die Figur hält ihr Item sichtbar in der Hand und benutzt es mit einer eigenen Bewegung. Sucht ein Brummkreisel das eigene Kart, warnen ein Hinweis und ein Ton, der schneller wird, je näher er kommt.

### Figuren

Jeder Spieler wählt in der Lobby eine von vier Figuren; dieselbe Figur darf mehrfach vorkommen. Die Lackfarbe des Karts bleibt am Spielerplatz (rot, türkis, gelb, violett), damit man gleiche Figuren unterscheiden kann.

| Figur | Stärke | Preis dafür |
| --- | --- | --- |
| **Kolben-Kalle** | rund 1 % mehr Höchsttempo | 12 % weniger Beschleunigung, etwas weniger Halt in Kurven |
| **Vera Vergaser** | 14 % mehr Beschleunigung – nach Kurven, Treffern und Stürzen schneller wieder da | minimal weniger Höchsttempo, leicht (wird bei Remplern weiter geschoben) |
| **Bremsen-Bert** | verliert neben der Fahrbahn deutlich weniger Tempo, schwer (wird kaum weggeschoben) | keine besondere Stärke beim reinen Fahren |
| **Zünd-Zoe** | 5 % mehr Halt in schnellen Kurven, Mini-Turbo lädt 8 % schneller | knapp 1 % weniger Höchsttempo |

Abgeglichen wird per Simulation (`tests/unit/characters.test.ts`): dieselbe KI fährt mit jeder Figur jede Strecke, einmal mit und einmal ohne Drift. Die besten Runden liegen je Strecke höchstens rund 1 % auseinander, im Mittel über alle Strecken unter 0,5 %. Ob es sich für Menschen fair anfühlt, kann nur ein Test mit Menschen zeigen.

### KI-Gegner

Freie Plätze fahren KI-Gegner (in der Lobby abschaltbar), Stärke **Leicht**, **Mittel** oder **Schwer**. Sie nutzen dieselbe Physik und dieselben Items wie Menschen. „Leicht“ driftet nie und wird deutlich langsamer, wenn sie vorn liegt; „Schwer“ driftet in jeder Kurve und holt stärker auf.

### Einstellungen (je Bildschirm)

Knopf „Einstellungen“ in der Lobby oder im Menü während des Rennens:

- **Grafik:** Automatisch, Niedrig, Mittel, Hoch. „Automatisch“ senkt die Auflösung, sobald das Bild unter 50 Bilder pro Sekunde fällt, und geht notfalls eine Stufe herunter.
- **Bildrate anzeigen:** blendet oben die gemessenen Bilder pro Sekunde ein – so lässt sich prüfen, ob ein Gerät 60 schafft.
- **Musik / Geräusche / Ton aus.**

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

Am Desktop lässt sich ohne Handy fahren (Tasten siehe oben). Zwei Bildschirme testest du mit zwei **Fenstern** nebeneinander (nicht zwei Tabs in einem Fenster – ein Tab im Hintergrund wird vom Browser angehalten).

Für echte Handys reicht `npm run dev` nicht: der Bewegungssensor braucht HTTPS. Dafür ist die veröffentlichte Seite da.

## Was du prüfen solltest

1. iPad/Rechner: Seite öffnen, Namen eintragen, **Lobby erstellen**.
2. Handy: QR-Code unter „Dein Controller“ scannen → **Tippen zum Starten** → Sensor erlauben → Handy quer halten → **Kalibrieren**.
3. Zweiter Bildschirm: Einladungslink öffnen oder Raumcode eintippen, eigenes Handy koppeln, **Ich bin bereit**.
4. Host: Strecke und KI-Stärke wählen, **Rennen starten**.
5. Auf dem iPad in den Einstellungen **Bildrate anzeigen** einschalten und im Rennen ablesen.
6. Nach dem Ziel: Ergebnisliste, dann **Nochmal** oder **Zur Lobby** (wählt der Host).
7. Diagnose (im Menü oder Taste F2) bei Bedarf: Latenz, Raten, „direkt“ oder „über TURN“.

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
| `?track=2` / `?ai=0` | Strecke (0–3) bzw. KI-Stärke (0–2) vorwählen (zählt beim Host) |
| `?q=low` | Grafik: `low`, `medium`, `high`, `auto` |
| `?mute=1` | ohne Ton starten |
| `?auto=1` | das eigene Kart fährt von selbst – zum Ausprobieren ohne Controller |
| `?signal=host:port` | eigener PeerJS-Server |
| `?peerlog=3` | ausführliches Verbindungsprotokoll in der Browser-Konsole |

Die Schalter für Netz, Grafik und Ton wandern automatisch in den QR-Code und den Einladungslink.

## Aufbau

```
src/net/         Verbindungsschicht: Signaling-Endpunkt, Link (zuverlässiger + unreliable Kanal), Protokoll, ICE/TURN
src/lobby/       Lobby auf dem Host und auf den Mitspieler-Bildschirmen, Platzvergabe, Wiedereinstieg
src/controller/  Handy-Seite: Neigung → Lenkwert, Kalibrierung, Touch-Tasten, Verbindung zum Bildschirm
src/game/        sim.ts Fahrphysik (Ebene + Höhe, Sprünge, Abstürze) · track.ts Streckenbau · tracks.ts die vier Strecken
                 · ai.ts KI-Fahrer · hostGame.ts Rennen auf dem Host (Ablauf, Items, Rempler, Hindernisse)
                 · clientGame.ts Vorhersage/Abgleich · interp.ts Interpolation
src/render/      three.js-Szene: world.ts Fahrbahn, Gelände, Himmel · scenery.ts Kulissen · kartModel.ts Figuren
                 · things.ts Items und Hindernisse · effects.ts Teilchen, Spuren, Comic-Wörter · toon.ts Farbstufen und Kontur
src/audio/       Ton: Mischpult, Motoren, Geräusche, Musik – alles zur Laufzeit erzeugt
src/screen/      Ablauf und Oberfläche des Bildschirms (Lobby, Renn-Anzeige, Minikarte, Einstellungen)
```

Netzwerkmodell: Der Lobby-Ersteller rechnet das Rennen. Die anderen schicken ihre Eingaben (60/s) und bekommen den kompletten Spielstand zurück (30/s). Das eigene Kart wird vorhergesagt – samt Drift, Schub, Bande, Sprüngen, Abstürzen und Boost-Feldern – und beim Eintreffen des Host-Stands abgeglichen. Fremde Karts werden 85 ms verzögert interpoliert. Rempler, Treffer, Kisten und Hindernisse entscheidet allein der Host.

Eine neue Strecke ist nur eine weitere Beschreibung in `src/game/tracks.ts` (Stützpunkte mit Höhe, dazu Schanzen, Lücken, offene Kanten, Boost-Felder, Kisten); Gelände, Kulissen und Minikarte entstehen daraus von selbst.

## Grafik: wie der Comic-Look entsteht

- **Farbstufen statt Verläufe:** drei Helligkeitsstufen pro Fläche (Toon-Shading), kantige Flächen, Farbe pro Fläche.
- **Tuschekontur:** Figuren, Items, Kulissen und Wolken werden ein zweites Mal gezeichnet – nur die Rückseiten, leicht aufgeblasen, in Tuschefarbe.
- **Comic-Mittel:** Wörter wie „KRACH!“ bei Ereignissen, Tempostriche bei Schub, gerasterte Schatten, kurzer Bildstopp bei Treffern, Stauchen und Strecken der Karts.
- Keine Schattenberechnung, keine Nachbearbeitung des Bildes: rund 30–45 Zeichenaufrufe und 40.000–70.000 Dreiecke pro Bild.

## Ton: Quellen

Es gibt keine Tondateien. Motoren, Geräusche und Musik werden im Browser mit der Web Audio API erzeugt (Oszillatoren, Rauschen, Filter, Hüllkurven); die Musikstücke sind eigene Kompositionen und stehen als Noten in `src/audio/songs.ts`. Fremde Aufnahmen, Samples oder Melodien werden nicht verwendet.

## Tests

```bash
npm test             # Unit-Tests: Physik, Strecken, KI auf allen Strecken, Items, Netzcode
npm run signal       # lokaler Signaling-Server (Port 9000) für den Browser-Test
npm run build && npm run preview -- --port 4173
node tests/e2e/run.cjs   # Browser-Test in Chromium: Lobby, Kopplung, Rennen, Wiederverbindung, Phase 3
```

Der Browser-Test läuft auf einem Rechner über die lokale Schleife. Er sagt nichts über echte Netze, Safari, iOS-Berechtigungen, echte Neigungssensoren oder die Bildrate eines iPads.

## Bekannte Grenzen

- **Nicht auf echten Geräten geprüft** (von mir aus): iPhone/iPad, Safari, echte Sensoren, echte Netze, Bildrate auf dem iPad, Höreindruck des Tons.
- **Ohne TURN** keine Verbindung über Mobilfunk und viele Schul-/Firmennetze (siehe oben).
- **Der Host hat keinen Latenz-Nachteil** und muss im Vordergrund bleiben. Verlässt er die Lobby, ist das Rennen für alle vorbei (Host-Wechsel ist nicht eingebaut).
- **Rempler, Treffer und Hindernisse** kennt nur der Host; beim Mitspieler zieht das eigene Kart danach einen Moment nach.
- **Rauchwolke:** nimmt Menschen die Sicht und lässt die KI nur „eiern“ – wer den Streckenverlauf auswendig kennt, verliert wenig.
