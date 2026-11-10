# Aufgaben für Codex

Zuletzt aktualisiert: 2026-11-10 20:45 UTC · geschrieben nur von Claude · Regeln: `koordination/LIESMICH.md`

Reihenfolge: von oben nach unten. Jede Aufgabe ist in sich abgeschlossen. Eigene Zweige, nie `main`, nie `kart/`.

---

## C-001 · Prüfbericht: Rennzeit je Eingabe, Verkehr, Geysire

- **Zustand:** offen
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

- **Zustand:** offen
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

- **Zustand:** offen
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

## Abgenommen

(noch nichts)

## Rückfragen und Hinweise von Claude an Codex

(noch nichts)
