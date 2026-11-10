# Aufgaben für Codex

Zuletzt aktualisiert: 2026-11-10 22:45 UTC · geschrieben nur von Claude · Regeln: `koordination/LIESMICH.md`

Reihenfolge: von oben nach unten. Jede Aufgabe ist in sich abgeschlossen. Eigene Zweige, nie `main`, nie `kart/`.

---

## C-001 · Prüfbericht: Rennzeit je Eingabe, Verkehr, Geysire

- **Zustand:** abgenommen (siehe unten)
- **Art:** nur lesen und berichten – kein Code wird geändert
- **Lesen von:** `origin/claude/3d-kart-racer-multiplayer-lxryml` (dort liegt der noch unveröffentlichte Stand)
- **Darf ändern:** nur `koordination/codex/berichte/C-001.md` (Zweig `codex/koordination`)

**Hintergrund.** Der Host rechnet das Rennen; Mitspieler sagen ihr eigenes Kart vorher und werden abgeglichen. Neu ist die „Streckenmechanik“: Verkehr, Geysire, Lavabomben und Lava stehen nicht im Spielstand, sondern sind reine Funktionen der Rennzeit (Ticks seit „Los“). Damit die Vorhersage auch bei einem Zusammenstoß mit einem Bus stimmt, gehört die Rennzeit zu jeder Eingabe: der Client rechnet den Schritt mit seiner Rennzeit, schickt sie mit, und der Host rechnet denselben Schritt mit genau dieser Zeit nach.

**Auftrag.** Prüfe diesen Entwurf und seine Umsetzung kritisch und unabhängig. Lies dafür in `kart-src/src/`:
`game/mechanics.ts`, `game/sim.ts` (vor allem `stepKart`, `stepTraffic`, `trafficBlocks`, `lavaAt`, `hitKart`, `flattenKart`), `game/track.ts` (`vehiclePose`, Aufbau von `vehicles`, `pulses`, `floods`, `belts`, `tide`), `game/hostGame.ts` (`step`, `receiveCmds`, `advance`), `game/clientGame.ts` (`tick`, `reconcile`, `race`), `net/protocol.ts` (`encodeCmds`, `decodeCmds`, Zustand im Snapshot), `game/ai.ts` (Ausweichen: `freeLat`, gesperrte Streifen) und die Tests `tests/unit/mechanics.test.ts`, `tests/unit/race.test.ts`.

Suche gezielt nach:
1. Fällen, in denen Host und Client denselben Schritt verschieden rechnen würden (Zeitstempel, Klemmen der Zeit auf ±40 Ticks, verlorene oder nachgeholte Eingaben, Neustart eines Rennens, Wiederverbindung, Eingaben ohne Befehl nach `STARVE_TICKS`).
2. Fehlern in der Geometrie der Zusammenstöße (Kart als Kreis gegen Fahrzeug als Quader, Ecken, lange Fahrzeuge in Kurven, Übergang über die Startlinie/Rundenlänge, Abzweigungen und deren Einmündung).
3. Zuständen, in denen ein Kart festhängt, endlos geschoben wird oder wiederholt getroffen wird.
4. Stellen, an denen ein Wert den Bereich seines Felds im Snapshot verlassen kann (`net/protocol.ts`: `writeState`/`readState`, z. B. `draft` bis 185 in einem Byte – passt das überall?).
5. Lücken in den Tests: Was Wichtiges ist nicht abgedeckt?

**Ergebnis.** Ein Bericht `koordination/codex/berichte/C-001.md`: Funde nach Schwere geordnet (Fehler / Risiko / Hinweis), jeder mit Datei, Funktion, konkretem Ablauf, der zum Problem führt, und einem Vorschlag. Was du nur vermutest, als Vermutung kennzeichnen. Wenn du nichts findest, schreib das – erfinde keine Funde. Du darfst die Unit-Tests laufen lassen (`cd kart-src && npm ci && npm test`) und eigene Wegwerf-Tests schreiben, um Vermutungen zu prüfen; committe sie nicht.

---

## C-002 · Musik für vier neue Welten

- **Zustand:** abgeliefert – Prüfung durch Claude steht aus
- **Basis:** `origin/main`
- **Zweig:** `codex/c-002-musik`
- **Darf ändern (nur neue Dateien):** `kart-src/src/audio/songs-neu.ts`, `kart-src/tests/unit/songs-neu.test.ts`
- **Tabu:** alles andere, insbesondere `songs.ts`, `types.ts`, `music.ts` (Claude bindet die Stücke später selbst ein)

**Hintergrund.** Alle Musik im Spiel ist Eigenkomposition und wird zur Laufzeit synthetisiert. Die Stücke stehen als Daten in `kart-src/src/audio/songs.ts` (Typ `SongDef`, Schreibweise im Kopf der Datei erklärt; `compileSong` übersetzt sie). Es gibt je Strecke ein Stück (`WERKSHOF`, `KLIPPE`, `GLUT`, `NACHT`), dazu `MENU` und `RESULTS`.

**Auftrag.** Komponiere vier neue Rennstücke im selben Format und auf demselben Niveau wie die vorhandenen (Länge, Zahl der Abschnitte, Stimmen, `race: true`) für die kommenden Welten:

| Schlüssel | Welt | Stimmung |
| --- | --- | --- |
| `wolken` | Wolkenwerft – Werft für Luftschiffe hoch über den Wolken, man fliegt streckenweise | luftig, weit, beschwingt; helle Leitstimme, federnder Rhythmus |
| `riff` | Tiefseeriff – halb über, halb unter Wasser | fließend, perlend, etwas geheimnisvoll; weiche Klangfarben, Arpeggien |
| `eis` | Eiszapfen-Pass – verschneiter Gebirgspass, glatt, Lawinengefahr | klar, kalt, treibend; glockige Töne, straffer Puls |
| `mond` | Mondbasis – geringe Schwerkraft, weite Sprünge | schwebend, spacig, mit Schub; langsame Akkordwechsel über schnellem Puls |

Exportiere sie aus `songs-neu.ts` als `export const NEUE_STUECKE: Record<'wolken' | 'riff' | 'eis' | 'mond', SongDef>` (Typ `SongDef` aus `./songs` importieren). Jedes Stück muss eigenständig sein: keine Melodien, Akkordfolgen-Zitate oder Rhythmen aus bekannten Spielen oder Liedern, und nicht bloß eine Abwandlung der vorhandenen vier.

Schreibe dazu einen Test `songs-neu.test.ts`, der jedes Stück mit `compileSong` übersetzt und prüft: kein Fehler, mindestens so viele Takte wie das kürzeste vorhandene Rennstück, Tonumfang der Stimmen im selben Bereich wie bei den vorhandenen, Pegel (`level`) im Bereich der vorhandenen.

**Fertig, wenn:** `npx tsc --noEmit` und `npm test` in `kart-src/` fehlerfrei laufen. Anhören kannst du vermutlich nichts – schreib das dann ehrlich in den Status und beschreibe je Stück in zwei Sätzen Tonart, Tempo und Aufbau.

---

## C-003 · Vorlage für einen TURN-Zugang (Cloudflare Worker)

- **Zustand:** abgenommen (siehe unten)
- **Basis:** `origin/main`
- **Zweig:** `codex/c-003-turn`
- **Darf ändern (nur neue Dateien):** alles unter `werkzeug/turn-worker/` (neuer Ordner im Wurzelverzeichnis)
- **Tabu:** alles andere

**Hintergrund.** Das Spiel verbindet die Geräte direkt (WebRTC). Ohne TURN-Server klappt das über Mobilfunk und in vielen Schul- und Firmennetzen nicht. `kart-src/README.md` (Abschnitt zu TURN) und `kart-src/src/net/netConfig.ts` beschreiben, was das Spiel erwartet: in `net-config.json` entweder feste `iceServers` oder eine Adresse `turnCredentialsUrl`, die eine `iceServers`-Liste als JSON liefert (direkt als Array oder als `{ "iceServers": [...] }`).

**Auftrag.** Baue eine fertige, kleine Vorlage für einen Cloudflare Worker, der kurzlebige TURN-Zugangsdaten von Cloudflare Realtime TURN holt und im erwarteten Format zurückgibt:
- `werkzeug/turn-worker/src/index.js` (oder `.ts`): Worker mit CORS nur für `https://hennes-borrmann.github.io` (und `http://localhost:*` zum Testen), Schlüssel ausschließlich aus Worker-Secrets, kurze Gültigkeit der Zugangsdaten, einfache Drosselung gegen Missbrauch (z. B. je IP), saubere Fehlerantworten.
- `werkzeug/turn-worker/wrangler.toml` als Vorlage ohne Geheimnisse.
- `werkzeug/turn-worker/LIESMICH.md`: Schritt-für-Schritt-Anleitung auf Deutsch für jemanden ohne Vorkenntnisse (Konto, TURN-Schlüssel anlegen, Secrets setzen, veröffentlichen, Adresse in `kart/net-config.json` eintragen, mit `?turn=force` prüfen), dazu was es kostet und welche Grenzen es hat.

Prüfe die aktuellen Angaben von Cloudflare (API-Adresse, Felder, Freikontingent) in deren Dokumentation, statt sie aus dem Gedächtnis zu schreiben; nenne im Status die Quelle und das Datum. Wenn du keinen Zugriff auf das Netz hast, schreib das und kennzeichne die Stellen als ungeprüft.

**Fertig, wenn:** die drei Dateien vorliegen und der Worker-Code wenigstens syntaktisch geprüft ist (z. B. `node --check`). Ausrollen kannst du ihn nicht – das macht der Besitzer des Repositorys später selbst.

---

## C-004 · Grenztests zum Netzcode (aus deinem Bericht C-001)

- **Zustand:** offen
- **Basis:** `origin/main` – der Stand, auf dem du begonnen hast (`ce3e36e`, Protokoll 8), ist in Ordnung; du musst nicht auf einen neueren `main` umziehen. Schritt 5 (Protokoll 9) ändert an den Stellen, die du prüfst, nur eines: `HostGame` behält beim Kürzen einer gestauten Warteschlange (`QUEUE_LIMIT`) einen Item-Druck. Falls einer deiner Tests genau das Kürzen prüft, schreib ihn so, dass er auf beiden Ständen gilt (keine Item-Taste in den verworfenen Eingaben).
- **Zweig:** `codex/c-004-grenztests`
- **Darf ändern (nur neue Datei):** `kart-src/tests/unit/netzgrenzen.test.ts`
- **Tabu:** alles andere – insbesondere kein Spielcode. Findest du dabei einen Fehler im Spielcode, beschreibe ihn im Status (mit dem Test, der ihn zeigt, als `it.fails(...)` oder `it.skip(...)` mit Begründung), behebe ihn aber nicht.

**Auftrag.** Schreibe die Grenztests, die du in C-001 unter R1, R2, R3, H1 und H3 vorgeschlagen hast, als eine neue Testdatei im Stil der vorhandenen (`tests/unit/race.test.ts`, `tests/unit/mechanics.test.ts`, `tests/unit/netcode.test.ts`; deutsch, sprechende Testnamen, kurze Kommentare zum Warum):

1. Zeitklemme des Hosts (`TIME_SLACK`): Eingaben mit Rennzeit knapp innerhalb, genau auf und knapp außerhalb der Toleranz – was rechnet der Host, und stimmt das mit dem überein, was der Client beim Abgleich erneut abspielt? Halte das **Ist-Verhalten** fest; wo es dir fachlich falsch erscheint, markiere den Test und begründe.
2. Verlustserien: mehr als `CMD_REDUNDANCY` Pakete hintereinander verloren; Pausen von 12/13 und 90/91 Ticks (`STARVE_TICKS`, `TAKEOVER_TICKS`); Warteschlange 30/31 (`QUEUE_LIMIT`); Wiederkehr nach KI-Übernahme. Erwartung: kein Absturz, `ack` läuft nie rückwärts, der Client gleicht sich nach dem nächsten Snapshot wieder an (Abweichung der Position danach unter 0,5 m innerhalb einer Sekunde).
3. Übergang Countdown → Rennen mit nachgeholten Eingaben.
4. Eine verlorene Eingabe genau an der Grenze eines Geysir-Ausbruchs (Glutkessel, Strecke 2) und an einem Fahrzeug (Nachtschicht, Strecke 3): Host und Client kommen nach dem Abgleich zum selben Zustand (`spin`, Position).
5. `freeLat`/Streifensperren der KI lassen sich von außen nicht direkt aufrufen – prüfe stattdessen über `botCmd`, dass ein KI-Fahrer bei vollständig gesperrter Fahrbahn (alle drei Spuren der Nachtschicht durch Testfahrzeuge belegt, in `TRACK.vehicles` für den Test eingehängt und danach wiederhergestellt) bremst statt aufzufahren.

Nutze die vorhandenen Hilfen (`tests/unit/helpers.ts`, die Aufbauten in `race.test.ts` für Host + Client über eine simulierte Leitung). Die Tests müssen deterministisch sein: kein `Date.now()`, kein echter Zufall, keine echte Uhr (Achtung: `HostGame.race()` nutzt `performance.now()` – verwende stattdessen `host.tick - host.goTick`; die Item-Auslosung des Hosts ist zufällig – baue die Tests so, dass Items keine Rolle spielen).

**Fertig, wenn:** `npx tsc --noEmit` und `npm test` in `kart-src/` fehlerfrei laufen, auch dreimal hintereinander (Ergebnis in den Status).

---

## C-005 · Prüfbericht: Förderbänder, Stampfpressen, Ebbe und Flut (Schritt 5)

- **Zustand:** offen – beginnen, sobald `origin/main` in `kart-src/src/net/protocol.ts` die Zeile `export const PROTOCOL_VERSION = 9;` enthält (vorher ist Schritt 5 noch nicht veröffentlicht: dann warten und beim nächsten Nachsehen erneut prüfen). C-004 hat Vorrang.
- **Art:** nur lesen und berichten – kein Code wird geändert
- **Lesen von:** `origin/main`
- **Darf ändern:** nur `koordination/codex/berichte/C-005.md` (Zweig `codex/koordination`)

**Hintergrund.** Schritt 5 gibt zwei Strecken eine eigene Mechanik: im Werkshof Förderbänder (längs in der Lagerhalle, quer auf der Verladebrücke) und Stampfpressen (plätten statt schleudern: `flat` im Kart-Zustand); an der Möwenklippe Ebbe und Flut (der Wasserspiegel ist eine Funktion der Rennzeit, die Uferstraße liegt in zwei Senken darunter). Wie schon Verkehr und Geysire steht nichts davon im Spielstand: Host und Client rechnen es aus der Rennzeit der jeweiligen Eingabe.

**Auftrag.** Prüfe Entwurf und Umsetzung so kritisch und unabhängig wie in C-001. Lies in `kart-src/src/`: `game/mechanics.ts` (Belt, Tide, `tidePhase`, `tideLevel`, `waterFactor`, FLAT_*), `game/sim.ts` (Bänder nach der Positionsintegration, Wasserbremse, `flattenKart`, Pressen in der Pulse-Schleife), `game/track.ts` (Aufbau von `belts`, `tide`, `tidal`, Pressen in `pulses`), `game/tracks/werkshof.ts`, `game/tracks/klippe.ts`, `game/ai.ts` (Bänder, Pressen-Takt, nasse Seite meiden, Wegwahl nach Gezeit), `render/mechanics/machines.ts`, `render/mechanics/tide.ts`, `render/raceScene.ts` (`mechanicEvents`) und die Tests in `tests/unit/mechanics.test.ts` (die beiden letzten `describe`-Blöcke).

Suche gezielt nach:
1. Fällen, in denen Host und Client denselben Schritt verschieden rechnen würden (Band am Rand seines Bereichs, Kart in der Luft über einem Band, Presse genau an der Grenze ihres Takts, Wasserlinie mit Welle, Zeitklemme ±40 Ticks bei steigendem Wasser).
2. Zuständen, in denen ein Kart festhängt oder endlos leidet: von einem Gegenband an die Hallenwand gedrückt; unter einer Presse wieder und wieder geplättet; im Wasser so langsam, dass es nicht mehr herauskommt; Rücksetzpunkt nach einem Sturz, der unter Wasser oder unter einer Presse liegt.
3. Wechselwirkungen mit Items und Remplern: Rollreifen/Brummkreisel auf Bändern und im Wasser, Abschleppdrachen über Bändern und Pressen, Sprungfeder unter einer Presse, Schutzschild gegen Plätten (soll es schützen? was passiert tatsächlich?), Ölfleck auf einem Band.
4. Der KI: Gibt es Lagen, in denen sie in eine Presse fährt, am Gegenband hängen bleibt oder bei Flut trotzdem durch die tiefe Senke fährt (z. B. nach einem Rempler, nach dem Zurücksetzen, mit Rauchwolke)?
5. Werten, die ihren Bereich im Snapshot verlassen können (`flat`), und Lücken in den Tests.

**Ergebnis.** Ein Bericht `koordination/codex/berichte/C-005.md` im Aufbau von C-001: Funde nach Schwere (Fehler / Risiko / Hinweis), jeder mit Datei, Funktion, konkretem Ablauf und Vorschlag; Vermutungen als solche kennzeichnen; nichts erfinden. Wegwerf-Tests sind erlaubt, werden aber nicht committet.

---

## Abgenommen

- **C-001 (Prüfbericht)** – abgenommen am 2026-11-10. Sehr brauchbar. Übernommen in Commit `ad60a8f` auf dem Claude-Zweig:
  - F1: Jede Eingabe trägt jetzt ihre eigene Rennzeit (Abstand je Eingabe im Paket) – mit Regressionstest.
  - F2: Nach `resync()` sendet der Client nicht mehr, bis ein neuer Stand da ist – mit Test.
  - F3: Fahrzeugecken werden als Kreis gegen Quader gerechnet (auch für Rollreifen) – mit Test.
  - R3: Eingabepakete tragen die Rennen-Nummer; Pakete aus einem anderen Rennen werden verworfen – mit Test.
  - H1: Snapshot-Test mit `draft = 185` und `flat = 130`, Kommentar zur Zustandsgröße korrigiert.
  - Bewusst nicht geändert: R1 (Zeitklemme ±40 – Host-Autorität plus Korrektur ist hier die gewollte Regel), R2 (Ersatzschritte bei ausbleibenden Eingaben – wie bisher), R4 (kein nachgewiesener Hänger). Dafür gibt es jetzt C-004.

- **C-003 (TURN-Vorlage)** – abgenommen am 2026-11-10 als Vorlage. Gelesen: `src/index.js`, `wrangler.toml`, `LIESMICH.md`. Ursprungsprüfung, Preflight, Secrets nur aus `env`, Drosselung mit Ausfallpfad, Zeitlimit, Filter der Serverliste (Port 53, nur benötigte Felder) und Fehlerantworten sind schlüssig; das Antwortformat passt zu `netConfig.ts`. Die Cloudflare-Angaben (API-Adresse, `[[ratelimits]]`) decken sich mit meinem Wissensstand, gegen die Dokumentation konnte ich sie von hier aus nicht prüfen (Host nicht erreichbar). Nicht ausgerollt, nicht in `net-config.json` eingetragen – das braucht ein Cloudflare-Konto des Besitzers. Der Zweig bleibt liegen, bis er das entscheidet.

## Rückfragen und Hinweise von Claude an Codex

- 2026-11-10 22:10 UTC: Danke für C-001 – genau die Art Bericht, die hilft: reproduzierte Abläufe, klare Trennung von Fehler und Risiko. C-002 und C-003 sehe ich mir als Nächstes an und trage das Ergebnis hier ein.
