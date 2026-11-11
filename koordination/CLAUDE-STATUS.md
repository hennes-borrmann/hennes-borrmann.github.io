# Stand Claude

Zuletzt aktualisiert: 2026-11-11 10:50 UTC · geschrieben nur von Claude

## Woran gerade gearbeitet wird

| Wer | Aufgabe | Bereich (für Codex gesperrt) |
| --- | --- | --- |
| Claude | Alle neun Schritte sind veröffentlicht. Offen: Funde aus C-009/C-010 einarbeiten, sobald Berichte vorliegen; Rückmeldungen von echten Geräten. | `kart-src/src/**`, `kart-src/tests/**` (außer den Dateien, die in `AUFGABEN.md` freigegeben sind), `kart/**` |

## Veröffentlicht

- Schritte 8 und 9 (2026-11-11, Version 261111-1008, Protokoll 12, acht Strecken): Eiszapfen-Pass – Schnee und Eis (Rutschen), Lawinen, Eiszapfen; Mondbasis – geringe Schwerkraft, Sprungplatten, Meteoriten, Raumausrüstung an allen Karts; je eigene Kulisse, Töne und Musik.
- Korrektur Grafik (2026-11-11, Versionen 261111-0943 und 261111-1008): Auf einem iPad der 10. Generation ging seit Schritt 5 im Werkshof der Grafikkontext verloren. Die Maschinen im Werkshof zeichnen jetzt ohne eigenen Shader, Textur und Instanzen (am Gerät bestätigt: Bild ist wieder da); die Blasenschlote am Tiefseeriff vorsorglich ohne Uniform-Felder und Shader-Schleifen (am Gerät nicht geprüft). Neu: `tests/unit/maschinenbild.test.ts`, `tests/unit/shaderregeln.test.ts`.
- Schritt 7 (2026-11-11 06:34 UTC, Version 261111-0624, Protokoll 11): Tiefseeriff – Tauchen (langsames Sinken, Strömungen, Blasenschlote mit Schubringen), Tauchausrüstung an allen Karts, Unterwasser-Ton, Musik `riff`. Dazu: Rennfortschritt über Abzweigungen in einem Maß (Fund F1 aus C-008, betraf alle Strecken) und neu ausgeglichene Wege (Möwenklippe: Schubfelder auf den Serpentinen, keins mehr in der Grotte); Anzeige von Ring und Aufwind folgt der Rechnung (F2/F3); KI löst einen Drift am Innenrand (C-006); Tests aus C-007 (`mechanikgrenzen.test.ts`). Im Stand liegen schon Eiszapfen-Pass und Mondbasis – die Lobby bietet sie noch nicht an (nur mit `?alle=1`), ihre Kulissen fehlen noch.
- Schritt 6 (2026-11-11, Protokoll 10): Wolkenwerft – Fliegen (Gleitflug über Lücken, Aufwinde, Schubringe, Korridor), Gleitflügel an allen Karts, Musik `wolken`. Dazu die Korrekturen aus C-005 (Presse: quadratische Trefferfläche und gemeinsamer Ablauf für Bild und Physik über `pressOpen`; Bandränder laufen aus; stetige Wasserlinie) und die Tests aus C-004 (`netzgrenzen.test.ts`).
- Schritt 5 (2026-11-10, Version 261110-2308, Protokoll 9): Förderbänder und Stampfpressen im Werkshof; Ebbe und Flut an der Möwenklippe; Item-Druck übersteht gestaute Eingaben; Uhr des Mitspielers folgt dem Host nach einem Hänger.
- Schritt 4 (2026-11-10, Protokoll 8): Stadtverkehr auf der Nachtschicht; Geysire, Lavabomben und Lavaschwall im Glutkessel; Untergründe deutlicher; Rennzeit je Eingabe im Netzcode.

## Plan

Die Schritte 4 bis 9 sind veröffentlicht. Als Nächstes: Funde aus C-009/C-010 einarbeiten.

## Für Codex frei

Alles, was in `AUFGABEN.md` unter „Darf ändern“ steht – sonst nichts.
