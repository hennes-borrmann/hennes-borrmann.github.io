# Koordination: wer macht was

An diesem Projekt (Kart-Racer „Schräglage“, Quellcode in `kart-src/`) arbeiten zwei KI-Systeme:

- **Claude** leitet die Entwicklung, baut die Kernlogik, führt alles zusammen, testet und veröffentlicht. Claude setzt dafür eigene Hilfsagenten ein.
- **Codex** (ChatGPT) übernimmt klar abgegrenzte Aufgaben, die Claude in `AUFGABEN.md` stellt.

Damit nichts durcheinanderkommt, gilt: **Jede Datei hat genau einen Schreiber.**

| Datei | Zweig | schreibt | Inhalt |
| --- | --- | --- | --- |
| `koordination/LIESMICH.md` | `claude/3d-kart-racer-multiplayer-lxryml` | Claude | diese Regeln |
| `koordination/AUFGABEN.md` | `claude/3d-kart-racer-multiplayer-lxryml` | Claude | Aufgaben für Codex, Abnahme, Rückfragen |
| `koordination/CLAUDE-STATUS.md` | `claude/3d-kart-racer-multiplayer-lxryml` | Claude | woran Claude und seine Agenten gerade arbeiten, gesperrte Bereiche |
| `koordination/codex/STATUS.md` | `codex/koordination` | Codex | Stand jeder Aufgabe |
| `koordination/codex/LOG.md` | `codex/koordination` | Codex | Tagebuch: was wann getan wurde |
| `koordination/codex/berichte/*.md` | `codex/koordination` | Codex | Berichte (z. B. Prüfberichte) |

Claude schreibt nie in `koordination/codex/`, Codex nie in die Dateien von Claude. Wer dem anderen etwas sagen will, schreibt es in seine eigene Datei.

## Zweige

- `main` ist die veröffentlichte Fassung (GitHub Pages). **Nur Claude** führt dorthin zusammen.
- `claude/3d-kart-racer-multiplayer-lxryml` ist Claudes Arbeitszweig. Er wird nach jeder Veröffentlichung auf `main` zurückgesetzt (die Koordinationsdateien bleiben dabei erhalten). **Nur Claude** schreibt dorthin.
- `codex/koordination` gehört Codex und enthält nur `koordination/codex/…`.
- `codex/<aufgabe>` – ein Zweig je Aufgabe, z. B. `codex/c-002-musik`. Ausgangspunkt steht in der Aufgabe (meist `origin/main`).

## Regeln für Codex

1. **Nie** nach `main` oder in einen Zweig `claude/…` pushen. **Nie** einen Pull Request zusammenführen. Keine Einstellungen des Repositorys ändern.
2. **Nie** den Ordner `kart/` anfassen (das ist die gebaute, veröffentlichte Fassung) und **nie** `npm run build` ausführen (das schreibt nach `kart/`). Zum Prüfen eines Builds: `npx vite build --outDir /tmp/kart-probe --emptyOutDir`.
3. Nur die Dateien ändern, die in der Aufgabe unter „Darf ändern“ stehen. Reicht das nicht, die Aufgabe als „blockiert“ melden und begründen – nicht eigenmächtig ausweiten.
4. Vor dem Abliefern muss in `kart-src/` durchlaufen: `npm ci`, `npx tsc --noEmit`, `npm test`. Das Ergebnis gehört in den Status. Was nicht geprüft wurde, als ungeprüft kennzeichnen. Nichts erfinden.
5. Stil wie im Bestand: Kommentare und Bezeichner deutsch, keine neuen Abhängigkeiten, keine fremden Inhalte (keine Modelle, Bilder, Klänge, Melodien, Namen aus anderen Spielen – alles ist selbst entworfen).
6. Commits beginnen mit der Aufgabennummer, z. B. `[C-002] Musik für die Wolkenwerft`.
7. Nach jedem Arbeitsblock: `LOG.md` ergänzen, `STATUS.md` aktualisieren, `codex/koordination` pushen. Schlägt der Push fehl, weil der Zweig sich bewegt hat: `git pull --rebase` und erneut.
8. Keine persönlichen Daten in diese Dateien – das Repository ist öffentlich.

## Ablauf einer Aufgabe

1. Claude trägt die Aufgabe in `AUFGABEN.md` ein (Zustand **offen**).
2. Codex trägt sie in `STATUS.md` als **angenommen** ein, arbeitet auf seinem Zweig und meldet **fertig** (mit Zweig und Commit) oder **blockiert** (mit Grund).
3. Claude prüft, übernimmt die Arbeit in seinen Zweig und vermerkt in `AUFGABEN.md` **abgenommen** – oder **Nacharbeit** mit dem, was fehlt.
4. Erst mit Claudes nächster Veröffentlichung landet die Arbeit auf `main`.

## Nachsehen, ob es Neues gibt

Codex liest die Aufgaben so (ohne den eigenen Arbeitsstand zu verändern):

```
git fetch origin
git show origin/claude/3d-kart-racer-multiplayer-lxryml:koordination/AUFGABEN.md
```

Claude liest den Stand von Codex so:

```
git fetch origin codex/koordination
git show origin/codex/koordination:koordination/codex/STATUS.md
```

Steht in `AUFGABEN.md` ganz oben `STOPP`, hört Codex nach der laufenden Aufgabe auf.
