# Stand Claude

Zuletzt aktualisiert: 2026-11-11 20:30 UTC · geschrieben nur von Claude

## Woran gerade gearbeitet wird

| Wer | Aufgabe | Bereich (für Codex gesperrt) |
| --- | --- | --- |
| Claude | Zehn weitere Strecken, siehe Plan: Schritt 10 (Sturmhafen) in Arbeit – Spielseite fertig, Kulisse/Darstellung/Ton in Arbeit; Schritt 11 (Vulkaninsel) – Spielseite fertig, Darstellung offen. Liegt in eigenen Arbeitszweigen, noch nicht auf `main`. | `kart-src/src/**`, `kart-src/tests/**`, `kart-src/tools/**`, `kart-src/public/**` (außer den Dateien, die in `AUFGABEN.md` freigegeben sind), `kart/**` |

## Veröffentlicht

- Turnier-Modus (2026-11-11, Version 261111-2006, Protokoll 13): In der Lobby wählt der Host „Einzelrennen“ oder „Turnier“ mit 3, 5 oder 10 Rennen. Vor jedem Rennen wird die Strecke ausgelost – ein Streifen mit den Bildern aller Strecken läuft auf allen Bildschirmen von rechts nach links durch und bleibt an der Marke stehen (keine Strecke zweimal, bevor alle dran waren). Sterne je Rennen: einer für jedes Kart, das man hinter sich lässt (höchstens 3); Gesamtwertung nach Sternen, dann Siegen, dann letztem Rennen. Streckenbilder liegen als JPG in `kart-src/public/karten/` und entstehen mit `kart-src/tools/streckenbilder.cjs`. Geprüft: 299 Unit-Tests; Browser-Test 161 von 163 – die zwei offenen (Uhrenabgleich und Auffahrunfall im Abschnitt Streckenmechanik) scheitern unter derselben Maschinenlast genauso an der zuvor veröffentlichten Version 261111-1008, sind also Messumgebung. Nicht geprüft: Safari/iPad.
- Schritte 8 und 9 (2026-11-11, Version 261111-1008, Protokoll 12, acht Strecken): Eiszapfen-Pass – Schnee und Eis (Rutschen), Lawinen, Eiszapfen; Mondbasis – geringe Schwerkraft, Sprungplatten, Meteoriten, Raumausrüstung an allen Karts; je eigene Kulisse, Töne und Musik.
- Korrektur Grafik (2026-11-11, Versionen 261111-0943 und 261111-1008): Auf einem iPad der 10. Generation ging seit Schritt 5 im Werkshof der Grafikkontext verloren. Die Maschinen im Werkshof zeichnen jetzt ohne eigenen Shader, Textur und Instanzen (am Gerät bestätigt: Bild ist wieder da); die Blasenschlote am Tiefseeriff vorsorglich ohne Uniform-Felder und Shader-Schleifen (am Gerät nicht geprüft). Neu: `tests/unit/maschinenbild.test.ts`, `tests/unit/shaderregeln.test.ts`.
- Schritt 7 (2026-11-11 06:34 UTC, Version 261111-0624, Protokoll 11): Tiefseeriff – Tauchen (langsames Sinken, Strömungen, Blasenschlote mit Schubringen), Tauchausrüstung an allen Karts, Unterwasser-Ton, Musik `riff`. Dazu: Rennfortschritt über Abzweigungen in einem Maß (Fund F1 aus C-008, betraf alle Strecken) und neu ausgeglichene Wege (Möwenklippe: Schubfelder auf den Serpentinen, keins mehr in der Grotte); Anzeige von Ring und Aufwind folgt der Rechnung (F2/F3); KI löst einen Drift am Innenrand (C-006); Tests aus C-007 (`mechanikgrenzen.test.ts`). Im Stand liegen schon Eiszapfen-Pass und Mondbasis – die Lobby bietet sie noch nicht an (nur mit `?alle=1`), ihre Kulissen fehlen noch.
- Schritt 6 (2026-11-11, Protokoll 10): Wolkenwerft – Fliegen (Gleitflug über Lücken, Aufwinde, Schubringe, Korridor), Gleitflügel an allen Karts, Musik `wolken`. Dazu die Korrekturen aus C-005 (Presse: quadratische Trefferfläche und gemeinsamer Ablauf für Bild und Physik über `pressOpen`; Bandränder laufen aus; stetige Wasserlinie) und die Tests aus C-004 (`netzgrenzen.test.ts`).
- Schritt 5 (2026-11-10, Version 261110-2308, Protokoll 9): Förderbänder und Stampfpressen im Werkshof; Ebbe und Flut an der Möwenklippe; Item-Druck übersteht gestaute Eingaben; Uhr des Mitspielers folgt dem Host nach einem Hänger.
- Schritt 4 (2026-11-10, Protokoll 8): Stadtverkehr auf der Nachtschicht; Geysire, Lavabomben und Lavaschwall im Glutkessel; Untergründe deutlicher; Rennzeit je Eingabe im Netzcode.

## Plan

Auftrag des Nutzers vom 2026-11-11 abends: Turnier-Modus und zehn weitere Strecken, jede mit eigener Mechanik; jede einzeln testen und veröffentlichen. Regeln: höchstens drei Agenten parallel; keine eigenen Shader mit Schleifen oder Uniform-Feldern (`tests/unit/shaderregeln.test.ts`), neue Darstellung möglichst nur mit Techniken, die der Werkshof schon nutzt (auf dem iPad des Nutzers bestätigt); keine Loopings.

| Schritt | Inhalt | Stand |
| --- | --- | --- |
| T | Turnier-Modus | veröffentlicht (261111-2006) |
| 10 | Sturmhafen – Wind (Böen, Windschatten hinter Containern), schwankende Pontons | in Arbeit |
| 11 | Vulkaninsel im Ausbruch – Platten brechen nach Plan weg, die Hängebrücke stürzt ein, die Lavaröhre läuft leer und öffnet sich | in Arbeit |
| 12 | Zeitriss-Ruine – die Strecke ändert sich jede Runde (Abzweigungen öffnen/schließen) | offen |
| 13 | Gewitterkamm – Dunkelheit (Sicht über Nebel, kein neuer Shader), Blitze, Blitzableiter | offen |
| 14 | Dschungel-Fluss – Flöße und Stämme, Strömung, Wasserfall-Sprung | offen |
| 15 | Spiegelkabinett – Portale | offen |
| 16 | Wüstenexpress – fahrender Zug, auf und neben den Waggons | offen |
| 17 | Riesenkinderzimmer – Schrumpfen und Wachsen | offen |
| 18 | Achterbahn-Rummel – Schienen mit Takt-Schub, Weichen, ohne Looping | offen |
| 19 | Magnetwerk – Fahren an Wand und Decke (zuletzt) | offen |

## Für Codex frei

Alles, was in `AUFGABEN.md` unter „Darf ändern“ steht – sonst nichts.
