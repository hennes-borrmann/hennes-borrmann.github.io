# Stand Claude

Zuletzt aktualisiert: 2026-11-11 07:10 UTC · geschrieben nur von Claude

## Woran gerade gearbeitet wird

| Wer | Aufgabe | Bereich (für Codex gesperrt) |
| --- | --- | --- |
| Claude | Schritt 8: Eiszapfen-Pass (Schnee und Eis, Lawinen, Eiszapfen) und Schritt 9: Mondbasis (geringe Schwerkraft, Sprungplatten, Meteoriten) – Kulissen, Darstellung der Mechanik, Raumausrüstung der Karts | `kart-src/src/**`, `kart-src/tests/**` (außer den Dateien, die in `AUFGABEN.md` freigegeben sind), `kart/**` |

## Veröffentlicht

- Schritt 7 (2026-11-11 06:34 UTC, Version 261111-0624, Protokoll 11): Tiefseeriff – Tauchen (langsames Sinken, Strömungen, Blasenschlote mit Schubringen), Tauchausrüstung an allen Karts, Unterwasser-Ton, Musik `riff`. Dazu: Rennfortschritt über Abzweigungen in einem Maß (Fund F1 aus C-008, betraf alle Strecken) und neu ausgeglichene Wege (Möwenklippe: Schubfelder auf den Serpentinen, keins mehr in der Grotte); Anzeige von Ring und Aufwind folgt der Rechnung (F2/F3); KI löst einen Drift am Innenrand (C-006); Tests aus C-007 (`mechanikgrenzen.test.ts`). Im Stand liegen schon Eiszapfen-Pass und Mondbasis – die Lobby bietet sie noch nicht an (nur mit `?alle=1`), ihre Kulissen fehlen noch.
- Schritt 6 (2026-11-11, Protokoll 10): Wolkenwerft – Fliegen (Gleitflug über Lücken, Aufwinde, Schubringe, Korridor), Gleitflügel an allen Karts, Musik `wolken`. Dazu die Korrekturen aus C-005 (Presse: quadratische Trefferfläche und gemeinsamer Ablauf für Bild und Physik über `pressOpen`; Bandränder laufen aus; stetige Wasserlinie) und die Tests aus C-004 (`netzgrenzen.test.ts`).
- Schritt 5 (2026-11-10, Version 261110-2308, Protokoll 9): Förderbänder und Stampfpressen im Werkshof; Ebbe und Flut an der Möwenklippe; Item-Druck übersteht gestaute Eingaben; Uhr des Mitspielers folgt dem Host nach einem Hänger.
- Schritt 4 (2026-11-10, Protokoll 8): Stadtverkehr auf der Nachtschicht; Geysire, Lavabomben und Lavaschwall im Glutkessel; Untergründe deutlicher; Rennzeit je Eingabe im Netzcode.

## Plan

Schritt 8 Eiszapfen-Pass → Schritt 9 Mondbasis. Danach: Funde aus C-009/C-010 einarbeiten.

## Für Codex frei

Alles, was in `AUFGABEN.md` unter „Darf ändern“ steht – sonst nichts.
