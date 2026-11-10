# Auftrag für Codex (zum Einfügen)

Du arbeitest im GitHub-Repository `hennes-borrmann/hennes-borrmann.github.io`. Darin liegt ein Kart-Rennspiel für den Browser (Quellcode in `kart-src/`: TypeScript, three.js, Vite; die gebaute, veröffentlichte Fassung in `kart/`).

An dem Projekt arbeitet bereits ein anderes KI-System (Claude). Es leitet die Entwicklung, führt alles zusammen und veröffentlicht. Du übernimmst klar abgegrenzte Aufgaben, die Claude dir in einer Datei im Repository stellt, und hältst dort fest, was du tust. Arbeite gründlich und mit höchster Denkstufe, selbstständig und ohne Rückfragen an mich – ich bin nicht erreichbar.

## 1. Zuerst lesen

```
git fetch origin
git show origin/claude/3d-kart-racer-multiplayer-lxryml:koordination/LIESMICH.md
git show origin/claude/3d-kart-racer-multiplayer-lxryml:koordination/AUFGABEN.md
git show origin/claude/3d-kart-racer-multiplayer-lxryml:koordination/CLAUDE-STATUS.md
```

(Falls dieser Zweig nicht lesbar ist: dieselben Dateien von `origin/main`.) `LIESMICH.md` enthält die Regeln der Zusammenarbeit – sie gelten vollständig. `AUFGABEN.md` enthält deine Aufgaben. `CLAUDE-STATUS.md` zeigt, woran Claude und seine Agenten gerade arbeiten; diese Bereiche sind für dich gesperrt.

## 2. Harte Grenzen

- Nie nach `main` oder in einen Zweig `claude/…` pushen. Nie einen Pull Request zusammenführen. Keine Einstellungen des Repositorys ändern. Keine anderen Repositorys anfassen.
- Nie den Ordner `kart/` ändern und nie `npm run build` ausführen (das schreibt nach `kart/`).
- Nur die Dateien ändern, die in der jeweiligen Aufgabe unter „Darf ändern“ stehen. Reicht das nicht: Aufgabe als „blockiert“ melden, nicht ausweiten.
- Nichts erfinden: was du nicht geprüft hast, als ungeprüft kennzeichnen. Keine fremden Inhalte (Melodien, Namen, Figuren, Bilder aus anderen Spielen), keine neuen Abhängigkeiten.
- Keine persönlichen Daten in Dateien schreiben – das Repository ist öffentlich.

## 3. Dein Tagebuch und dein Stand

Lege, falls er noch nicht existiert, den Zweig `codex/koordination` an (von `origin/main`) und pflege dort – und nur dort – diese Dateien:

- `koordination/codex/STATUS.md`: eine Tabelle mit einer Zeile je Aufgabe:
  `| Aufgabe | Zustand | Zweig | Commit | geprüft (tsc / Tests) | Notiz |`
  Zustände: `angenommen`, `in Arbeit`, `fertig`, `blockiert`. Ganz oben: `Zuletzt aktualisiert: JJJJ-MM-TT HH:MM UTC` und `Zuletzt nach neuen Aufgaben gesehen: …`.
- `koordination/codex/LOG.md`: fortlaufend, neueste Einträge unten, je Arbeitsblock eine Zeile: `- JJJJ-MM-TT HH:MM UTC · C-00x · was getan wurde, was dabei herauskam`.
- `koordination/codex/berichte/…`: Berichte, wenn eine Aufgabe einen verlangt.

Nach jedem Arbeitsblock (spätestens alle 30 Minuten und immer, wenn eine Aufgabe ihren Zustand wechselt): beide Dateien aktualisieren, committen, `codex/koordination` pushen. Schlägt der Push fehl, weil sich der Zweig bewegt hat: `git pull --rebase`, dann erneut.

## 4. Aufgaben abarbeiten

Arbeite die Aufgaben mit Zustand „offen“ oder „Nacharbeit“ in `AUFGABEN.md` von oben nach unten ab. Für jede Aufgabe mit Code: ein eigener Zweig mit dem dort genannten Namen, ausgehend von der dort genannten Basis; Commits beginnen mit der Aufgabennummer (z. B. `[C-002] …`); vor dem Abliefern in `kart-src/`: `npm ci`, `npx tsc --noEmit`, `npm test` – Ergebnis in den Status. Zweig pushen, in `STATUS.md` „fertig“ mit Zweig und Commit eintragen. Claude prüft und übernimmt die Arbeit; du führst nichts zusammen.

Wenn du in deiner Umgebung nicht pushen darfst: Sag das in deiner Antwort deutlich, und liefere die Änderungen als Pull Request im Entwurfszustand (nicht zusammenführen) – Stand und Tagebuch dann in dessen Beschreibung.

## 5. Regelmäßig nach neuen Aufgaben sehen

Wenn alle offenen Aufgaben erledigt oder blockiert sind: 30 Minuten warten, dann `git fetch origin` und `AUFGABEN.md` (Abschnitt 1) neu lesen. Gibt es neue Aufgaben, Nacharbeit oder Hinweise von Claude: weiterarbeiten. Trage jedes Nachsehen mit Uhrzeit in `STATUS.md` ein („Zuletzt nach neuen Aufgaben gesehen“). Wiederhole das bis zu zwölf Stunden lang – oder bis in `AUFGABEN.md` ganz oben `STOPP` steht.

Wenn du in deiner Umgebung einen wiederkehrenden Lauf einrichten kannst (alle 30 Minuten mit diesem Auftrag), richte ihn ein. Wenn du weder warten noch planen kannst: Trage in `STATUS.md` ein, dass deine Sitzung endet, und schreibe in deine Antwort, dass ich dich mit dem Satz „Lies koordination/AUFGABEN.md und mach weiter“ neu starten soll.

## 6. Zum Schluss

Fasse in deiner Antwort kurz zusammen: welche Aufgaben in welchem Zustand sind, welche Zweige und Commits es gibt, was geprüft und was nicht geprüft wurde, und ob du weiter nachsiehst oder neu gestartet werden musst.
