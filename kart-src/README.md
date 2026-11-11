# Schräglage (Arbeitstitel)

Kart-Racer für den Browser. Jeder Spieler hat einen eigenen Bildschirm (iPad oder Desktop) und lenkt mit dem Handy. Online über Lobbys mit Raumcode, kein Splitscreen.

**Stand: Phase 3 mit Ausbau Schritt 7.** Sechs Strecken von je rund 1,5 km mit Abzweigungen, Höhlen, Steilkurven, Sprüngen und eigenen Untergründen – jede mit eigener Streckenmechanik (Förderbänder und Stampfpressen im Werkshof; Ebbe und Flut an der Möwenklippe; Geysire, Lavabomben und Lavaschwall im Glutkessel; Stadtverkehr auf der Nachtschicht; Fliegen auf der Wolkenwerft; Tauchen am Tiefseeriff) –, neun Items, vier wählbare Figuren mit leicht verschiedenen Fahrwerten, KI-Gegner in drei Stärken, lebendige Kulissen, Grafik im Stil „Comic-Tusche“, Ton und Musik aus dem Synthesizer.

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

| Strecke | Länge | Untergrund | Besonderheiten |
| --- | --- | --- | --- |
| **Werkshof** | 1 480 m | Asphalt, Stahlplatten, Schotter | Einsteigerstrecke. Verladebrücke mit Querbändern oder Lagerhalle mit Laufbändern (die Wege kreuzen sich), Steilkurve, zwei Reihen Stampfpressen, Laderampe, rutschige Kehre über den Schotterplatz, Schikane oder Sprung über die Containergrube |
| **Möwenklippe** | 1 490 m | Sand, Holzbohlen, Waldweg, Wiese, Fels | Strandpromenade, schmaler Holzsteg ohne Geländer, Serpentinen durch den Kiefernwald oder Felsgrotte darunter hindurch, Wiese am Leuchtturm, Abfahrt mit Sprung, Steilkurve, Uferstraße (bei Flut unter Wasser) oder Steg mit Sprung über die Bucht |
| **Glutkessel** | 1 480 m | Fels, Schotter (Asche), Gitterrost | Eine Acht um den Vulkan: Bogen oder Sprung über den Lavastrom, schmaler Grat ohne Bande oder Lavahöhle darunter, Sprung über die Glutrinne, Felsbrücke über die eigene Strecke, Steilkurve in der Abfahrt |
| **Nachtschicht** | 1 470 m | Neon-Asphalt, Stahl, Pflaster | Hochstraße bei Nacht: rechte Winkel, Bogen um den Block oder Sprung über die Dächer, Hochstraße oder Röhre auf Bodenhöhe darunter, Parkhaus-Spirale als Steilkurve |
| **Wolkenwerft** | 1 460 m | Holzbohlen, Stahl | Luftschiffwerft über den Wolken, alles auf Stegen: Helling, Wendelrampe, dann 180 m Gleitflug zum Ballonhafen; Laufsteg außen herum oder per Katapult im Flug quer über die Bucht; durch den Hangar aufs Dach und im Bogen zurück zur Helling geflogen |
| **Tiefseeriff** | 1 410 m | Holzbohlen, Riff-Fels, Sand, Stahl | Vom Steg mit einem Sprung ins Wasser und unter der Oberfläche weiter: Korallengarten mit Strömungen und Buckeln, außen um den Graben oder mit einem Schwebesprung darüber, Seegraswald mit Querströmungen, außen um das Wrack oder mitten hindurch, den Riffhang hinauf und wieder an die Luft |

**Abzweigungen:** Jede Strecke teilt sich zweimal (die Wolkenwerft einmal). Beide Wege zählen für Runden und Platzierung gleich und dauern ähnlich lange; der eine ist meist sicherer, der andere riskanter (Sprung, keine Bande) oder enger. Eine gelbe Tafel im Keil zeigt die Gabelung an. Solange beide Fahrbahnen ineinander liegen, steht zwischen ihnen keine Begrenzung, sie liegen in einer Ebene, und jede Stelle wird nur einmal gezeichnet: die Hauptstrecke hat Vorrang und zieht ihre Randlinie gestrichelt über die Öffnung, die Abzweigung beginnt an ihrem Fahrbahnrand. Erst hinter dem Keil findet die Abzweigung zu ihrer eigenen Höhe. Zwei Tests prüfen das auf allen Strecken.

**Streckenmechanik:** Jede Strecke soll sich nicht nur anders ansehen, sondern anders fahren:

- **Werkshof – die Maschinen laufen.** In der Lagerhalle liegen drei Laufbänder nebeneinander: das mittlere trägt nach vorn (gut 25 km/h obendrauf), die beiden äußeren kommen einem entgegen. Auf der Verladebrücke schieben drei Querbänder abwechselnd nach rechts und links – wer nicht gegenlenkt, wird jedes Mal um bis zu drei Meter versetzt. Hinter der Steilkurve und vor der Zielgeraden stehen je drei **Stampfpressen** quer über der Bahn und schlagen reihum zu: die Lampe am Portal blinkt immer schneller, der Schatten wächst, der Stempel senkt sich an. Zwei Spuren sind immer frei. Wer drunter gerät, wird nicht geschleudert, sondern **geplättet** („PLATT!“) und fährt gut zwei Sekunden flach und nur gut halb so schnell.
- **Möwenklippe – Ebbe und Flut.** Der Meeresspiegel steigt und fällt im Takt von 46 Sekunden; das Rennen beginnt bei Ebbe. Die Uferstraße um die Bucht liegt in zwei Senken tiefer als der Flutpegel: bei Ebbe ist sie der bequeme Weg, bei Flut steht sie bis zu einem halben Meter unter Wasser und kostet knapp drei Sekunden – dann lohnt der Steg mit dem Sprung. Die Straße fällt zum Meer hin ab, an der Landseite ist das Wasser flacher. Eine Pegeltafel vor der Gabelung zeigt den Stand; Boote, Bojen und die Brandung gehen mit dem Wasser mit.

- **Nachtschicht – Stadtverkehr.** Auf der Hochstraße fahren rund 40 Fahrzeuge in drei Spuren mit: links die Straßenbahn auf ihrem Gleis und Taxis, in der Mitte Taxis und Lieferwagen, rechts langsamer die Busse. Die Spuren sind so besetzt, dass nebeneinander höchstens zwei Fahrzeuge fahren – eine ganze Spur ist immer frei. Wer mit Tempo ins Heck fährt, schleudert; seitlich streift man nur entlang, und eine gestreifte Ecke kostet Tempo, aber keinen Dreher. Dicht hinter einem Fahrzeug lädt der **Windschatten** (die Tempostriche wachsen); wer geladen ausschert, wird gut eine Sekunde lang schneller („SOG!“). Die Dächer und die Röhre sind verkehrsfrei.
- **Glutkessel – der Vulkan spielt mit.** Geysire sitzen in Reihen quer über der Bahn und brechen reihum aus – eine Spur bleibt immer frei; wer über einem steht, wird hochgeworfen. Lavabomben kündigen sich mit einem wachsenden Schatten an und lassen kurz eine Glutpfütze zurück. Durch die Höhle schießt im Takt ein Lavaschwall, der das Kart auf halbes Tempo bremst: bei freier Bahn ist die Höhle der schnellere Weg, bei Lava der langsamere. Die Ampel vor der Gabelung zeigt, wie es bei der Durchfahrt sein wird.

- **Wolkenwerft – Fliegen.** An drei Stellen endet die Fahrbahn an einer Absprungkante: dort klappen die Karts Flügel aus (jede Figur ihre eigenen) und **gleiten** – sie sinken nur langsam, lenken weich und halten ihr Tempo. Gelenkt wird wie am Boden; Gas und Bremse braucht man in der Luft nicht. **Aufwinde** (helle, aufsteigende Säulen) heben das Kart, **Schubringe** geben Schub wie ein Boost-Feld – wer beides mitnimmt, kommt hoch und schnell an und spart die Auffahrt von der tiefer liegenden Fangrampe. Markierungsballone zeigen den Korridor: wer ihn seitlich verlässt, sackt durch und wird vor die Kante zurückgesetzt. Die Abkürzung per Katapult ist kürzer, verlangt aber einen sauberen Flug; der Laufsteg außen herum bleibt am Boden.

- **Tiefseeriff – Tauchen.** Der größte Teil der Strecke liegt unter Wasser, und dort trägt das Wasser: das Kart sinkt nur langsam, deshalb wird jeder Korallenbuckel zu einem weiten Schwebesprung (anderthalb Sekunden und 30 m statt einer halben und 10 m), und der Graben ist nur so zu überqueren. Es rollt schneller aus, rutscht in Kurven etwas mehr und ist eine Spur langsamer; im Schweben lässt es sich besser lenken als in der Luft. **Strömungen** nehmen es mit – auch im Schweben: im Korallengarten zieht rechts eine mit und kommt links eine entgegen, im Seegraswald schieben Querströmungen abwechselnd zur Seite. **Blasenschlote** blasen im Takt (nebeneinander stehende abwechselnd) und heben das Kart vier Meter an – genau dort hängt ein Schubring. Eine Qualle pendelt als Hindernis über die Bahn. Abgetaucht klingt alles dumpf.

Verkehr, Geysire, Lava, Pressen, Gezeiten und Blasenschlote laufen nach einem festen Fahrplan (Rennzeit seit „Los“), sind also auf jedem Bildschirm gleich und in jedem Rennen gleich – man kann sie lernen.

**Untergründe** fahren sich deutlich verschieden: Sand und Schotter rutschen stark und kosten Tempo, laden dafür den Drift schneller; der Waldweg lässt das Heck arbeiten, die Wiese bremst; Fels und Neon-Asphalt kleben; Stahl ist am schnellsten, aber glatt – auch beim Bremsen; Pflaster ist holprig. Auf losem Grund zieht das Kart eine Staubfahne. Jede Sorte hat ihre eigene Begrenzung – Holzzaun, Seil, Felswall, Mauer, Leitplanke.

**Steilkurven** sind nach innen geneigt und geben Halt: man kommt deutlich schneller herum als in einer flachen Kurve.

Im Hintergrund bewegt sich die Welt: Vulkane brechen aus und werfen Lavabomben, Möwenschwärme kreisen, ein Kutter zieht durch die Bucht, Kräne drehen sich, ein Güterzug fährt um den Werkshof, über der Stadt ziehen ein Luftschiff und Feuerwerk. Das alles ist Kulisse und greift nicht ins Rennen ein.

**Pressen und Bild stimmen überein:** Eine Presse ist genau so lange gefährlich, wie ihr Stempel unter Karthöhe steht, und zwar unter der ganzen quadratischen Platte. Die Wirkung eines Förderbands läuft zu seinen Rändern hin über einen halben Meter aus – auf der Naht zweier gegenläufiger Bänder steht man still.

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
4. Host: Strecke, KI-Stärke und Rundenzahl (2–5, Vorgabe 3) wählen, **Rennen starten**. Die Mitspieler sehen die Auswahl, ändern kann sie nur der Host.
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
| `?laps=1` | Rundenzahl überschreiben, geht der Auswahl in der Lobby vor (zählt beim Host) |
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
src/game/        sim.ts Fahrphysik (Ebene + Höhe, Sprünge, Abstürze, Gleitflug, Tauchen) · track.ts Streckenbau · tracks.ts die Strecken
                 · mechanics.ts Streckenmechanik (Verkehr, Geysire, Lavabomben, Lavaschwall, Förderbänder,
                   Stampfpressen, Gezeiten, Blasenschlote) als Funktion der Rennzeit, dazu die Regeln fürs Fliegen und Tauchen
                 · ai.ts KI-Fahrer · hostGame.ts Rennen auf dem Host (Ablauf, Items, Rempler, Hindernisse)
                 · clientGame.ts Vorhersage/Abgleich · interp.ts Interpolation
src/render/      three.js-Szene: world.ts Fahrbahn, Gelände, Himmel · scenery.ts Kulissen · kartModel.ts Figuren
                 · things.ts Items und Hindernisse · mechanics.ts (+ mechanics/) Verkehr, Lava, Maschinen, Gezeiten, Flug, Tauchen
                 · effects.ts Teilchen, Spuren, Comic-Wörter · toon.ts Farbstufen und Kontur
src/audio/       Ton: Mischpult, Motoren, Geräusche, Musik – alles zur Laufzeit erzeugt
src/screen/      Ablauf und Oberfläche des Bildschirms (Lobby, Renn-Anzeige, Minikarte, Einstellungen)
```

Netzwerkmodell: Der Lobby-Ersteller rechnet das Rennen. Die anderen schicken ihre Eingaben (60/s) und bekommen den kompletten Spielstand zurück (30/s). Das eigene Kart wird vorhergesagt – samt Drift, Schub, Bande, Sprüngen, Abstürzen und Boost-Feldern – und beim Eintreffen des Host-Stands abgeglichen. Fremde Karts werden 85 ms verzögert interpoliert. Rempler, Treffer, Kisten und Hindernisse entscheidet allein der Host.

**Streckenmechanik und Netz:** Verkehr, Geysire, Lava, Pressen und der Wasserspiegel stehen nicht im Spielstand und reisen nicht über das Netz. Ihre Stellung ist eine reine Funktion der Rennzeit (Ticks seit „Los“), die jeder Bildschirm selbst ausrechnet. Damit die Vorhersage auch dann stimmt, wenn ein Mitspieler einen Bus streift, gehört die Rennzeit zu jeder Eingabe: sein Bildschirm rechnet den Schritt mit seiner Rennzeit, schickt sie mit, und der Host rechnet denselben Schritt mit genau dieser Zeit nach. Im simulierten Netz (40 ms, Schwankung, Paketverlust, blind durch den Verkehr gelenkt) bleiben 99 % der Korrekturen unter 5 cm.

Eine neue Strecke ist nur eine weitere Beschreibung in `src/game/tracks.ts` (Stützpunkte mit Höhe, dazu Schanzen, Lücken, offene Kanten, Boost-Felder, Kisten); Gelände, Kulissen und Minikarte entstehen daraus von selbst.

## Grafik: wie der Comic-Look entsteht

- **Farbstufen statt Verläufe:** drei Helligkeitsstufen pro Fläche (Toon-Shading), kantige Flächen, Farbe pro Fläche.
- **Tuschekontur:** Figuren, Items, Kulissen und Wolken werden ein zweites Mal gezeichnet – nur die Rückseiten, leicht aufgeblasen, in Tuschefarbe.
- **Comic-Mittel:** Wörter wie „KRACH!“ bei Ereignissen, Tempostriche bei Schub, gerasterte Schatten, kurzer Bildstopp bei Treffern, Stauchen und Strecken der Karts.
- Keine Schattenberechnung, keine Nachbearbeitung des Bildes: rund 30–45 Zeichenaufrufe und 40.000–70.000 Dreiecke pro Bild.

## Ton: Quellen

Es gibt keine Tondateien. Motoren, Geräusche und Musik werden im Browser mit der Web Audio API erzeugt (Oszillatoren, Rauschen, Filter, Hüllkurven); die Musikstücke sind eigene Kompositionen und stehen als Noten in `src/audio/songs.ts` und `src/audio/songs-neu.ts`. Fremde Aufnahmen, Samples oder Melodien werden nicht verwendet.

## Tests

```bash
npm test             # Unit-Tests: Physik, Strecken, KI auf allen Strecken, Items, Netzcode
npm run signal       # lokaler Signaling-Server (Port 9000) für den Browser-Test
npm run build && npm run preview -- --port 4173
node tests/e2e/run.cjs   # Browser-Test in Chromium: Lobby, Kopplung, Rennen, Wiederverbindung, Phase 3, Streckenmechanik
```

Der Browser-Test läuft auf einem Rechner über die lokale Schleife. Er sagt nichts über echte Netze, Safari, iOS-Berechtigungen, echte Neigungssensoren oder die Bildrate eines iPads.

## Bekannte Grenzen

- **Nicht auf echten Geräten geprüft** (von mir aus): iPhone/iPad, Safari, echte Sensoren, echte Netze, Bildrate auf dem iPad, Höreindruck des Tons.
- **Größere Welten:** Seit den langen Strecken zeichnet das Spiel rund doppelt so viele Dreiecke wie vorher (je nach Strecke etwa 110 000–150 000 in hoher Qualität). Ob das auf jedem iPad flüssig bleibt, ist nicht gemessen; notfalls in den Einstellungen die Qualität senken.
- **KI an Gabelungen:** Die KI-Gegner würfeln ihren Weg, sie wählen ihn nicht nach Lage des Rennens. Ausnahmen: die Lavahöhle im Glutkessel nehmen mittlere und starke Gegner nur bei freier Bahn, und an der Möwenklippe nehmen sie bei Flut den Steg, bei Ebbe die Uferstraße.
- **KI hinter der Werkshof-Brücke:** Wer als KI über die Verladebrücke kommt, gerät in der folgenden Steilkurve je nach Figur für zwei bis vier Sekunden in den Seitenstreifen und verliert rund eine Sekunde pro Runde; durch die Halle fahren alle sauber. Die Ursache ist noch nicht gefunden.
- **KI und Maschinen:** Allein fahrend werden die Gegner von den Stampfpressen nie erwischt (sie rechnen den Takt aus); geplättet werden sie nur, wenn ein Rempler oder ein Item sie aus der Spur bringt. Die Querbänder der Brücke gleichen sie aus, ohne sie zu nutzen.
- **Fliegen:** In der Luft wird nur gelenkt – steigen und sinken bestimmen Aufwinde und Ideallinie, nicht der Spieler. Die KI fliegt Aufwinde und Ringe an, wählt die Flug-Abkürzung aber wie jede Abzweigung per Würfel. Ein Rollreifen endet an der Absprungkante; der Brummkreisel folgt der Ideallinie auch durch die Luft und trifft nur, wer nahe an ihr fliegt.
- **Tauchen:** Unter Wasser gilt dieselbe Steuerung wie an Land – auf- und abtauchen kann man nicht selbst, die Höhe bestimmen Fahrbahn, Buckel und Schlote. Die KI hält auf blasende Schlote zu, nutzt die Strömungen aber nur über die Spurwahl. Rollreifen, Brummkreisel und Ölfleck verhalten sich unter Wasser wie an Land (kein Auftrieb, keine Strömung).
- **Items und Maschinen:** Rollreifen, Brummkreisel und Ölfleck werden von Förderbändern und Wasser nicht beeinflusst (ein Ölfleck bleibt auf einem laufenden Band liegen).
- **Wasser:** Die Flut bremst nur auf der Uferstraße. Wer vom Steg ins Wasser fällt, wird wie bisher zurückgesetzt; schwimmen oder tauchen gibt es (noch) nicht.
- **KI im Verkehr:** Die Gegner weichen aus und bremsen, fahren im Verkehr aber vorsichtiger als ein guter Mensch und brauchen pro Runde einige Sekunden länger als auf freier Strecke. Den Windschatten nutzen sie nicht gezielt.
- **Verkehr und Items:** Ein Rollreifen zerschellt an Fahrzeugen; Brummkreisel, Öl und Rauch gehen durch sie hindurch.
- **Fremde Karts im Verkehr:** Jedes Kart erlebt den Verkehr zu seiner eigenen Rennzeit. Auf dem eigenen Bildschirm stimmt das eigene Kart genau; ein fremdes kann beim Überholen eines Busses um Zentimeter bis wenige Dezimeter „im Blech“ erscheinen.
- **Ohne TURN** keine Verbindung über Mobilfunk und viele Schul-/Firmennetze (siehe oben).
- **Der Host hat keinen Latenz-Nachteil** und muss im Vordergrund bleiben. Verlässt er die Lobby, ist das Rennen für alle vorbei (Host-Wechsel ist nicht eingebaut).
- **Rempler, Treffer durch Items und die Pendel-Hindernisse** kennt nur der Host; beim Mitspieler zieht das eigene Kart danach einen Moment nach. (Verkehr, Geysire, Bomben, Lava, Bänder, Pressen und Flut sagt jeder Bildschirm selbst vorher.)
- **Rauchwolke:** nimmt Menschen die Sicht und lässt die KI nur „eiern“ – wer den Streckenverlauf auswendig kennt, verliert wenig.
