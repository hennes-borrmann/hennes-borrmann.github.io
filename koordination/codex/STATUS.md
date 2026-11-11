Zuletzt aktualisiert: 2026-11-11 01:46 UTC

Zuletzt nach neuen Aufgaben gesehen: 2026-11-11 01:45 UTC

| Aufgabe | Zustand | Zweig | Commit | geprüft (tsc / Tests) | Notiz |
| --- | --- | --- | --- | --- | --- |
| C-001 | fertig | codex/koordination | 94453f98616dccbb669647d5755e13e557109d17 | tsc OK / 123 Tests OK; 9 Wegwerfproben OK | Prüfung des Claude-Stands `326bd88167b7e1e1974d3f3992cfe744c9827714`; nur Bericht. Von Claude abgenommen; Nachprüfung als C-004 beauftragt. |
| C-002 | fertig | codex/c-002-musik | 0c23f20b78160a0647de63d60452ab38a5dde814 | npm ci OK; tsc OK / 112 Tests OK (10 neu) | Von Claude als Notendaten abgenommen und übernommen. Nicht angehört; wolken laut Claude inzwischen eingebunden. Musikzweig bleibt unverändert. |
| C-003 | fertig | codex/c-003-turn | 4a2e344e0c469bec49c121dff7c7c88f88bde674 | npm ci OK; tsc OK / 102 Tests OK; node --check OK; 24 lokale Worker-Prüfungen OK | Von Claude als Vorlage abgenommen. CORS, 30-Minuten-TTL, IP-Drosselung, Fehlerbehandlung und deutsche Anleitung; nicht ausgerollt. |
| C-004 | fertig | codex/c-004-grenztests | ff8eae3ea83610d5c67874420ee6bd8e266a0570 | npm ci OK; tsc und 150 Tests dreimal nacheinander OK (12 Dateien, 23 neue Tests) | Von Claude abgenommen und als ac0189b übernommen. Eigene Prüfung auf Basis ce3e36e, Protokoll 8. |
| C-005 | fertig | codex/koordination | 084785f28db47e1a7ef0dde154aa5b8120cbacf9 | npm ci OK; tsc OK / 145 Tests OK (12 Dateien); 13 Wegwerfproben OK | main deac72f4aa71d1c964ddde34001f43627951d259, Protokoll 9. Von Claude abgenommen; Korrekturen laut Auftrag in a2fc907. Eigene Nachprüfung noch ungeprüft; nur Bericht. |
| C-006 | fertig | codex/koordination | b7ec9a791670039afdd6fe47b6de8f21354551a3 | npm ci OK; tsc OK / 145 Tests OK; 128 Kombinationen je Basis/3 Varianten vollständig gemessen | Drift wird trotz entgegengesetzter Ziellenkung gehalten; Bericht mit 2.048 ausgewerteten Runden. Keine der drei Varianten erfüllt das Kriterium ohne Verschlechterung. Spielcode unverändert. |
| C-007 | in Arbeit | codex/c-007-mechaniktests | noch keiner | Startbedingung erfüllt: main 73cc904, Protokoll 10 | Ergänzende Mechanik-Grenztests; Ausführung noch offen. |
| C-008 | angenommen | codex/koordination | noch keiner | noch ungeprüft | Prüfbericht zum Fliegen auf Protokoll 10, nach C-007. |

## C-002 · Stückbeschreibungen

- **Wolkenwerft:** G-lydisch bei 132 BPM, helle Dreieck-Leitstimme und federnder Rhythmus. Zwei Abschnitte zu acht Takten führen vom aufwärts springenden Motiv zu höher liegenden Antworten.
- **Tiefseeriff:** cis-Dorisch bei 126 BPM, weiche Sinusmelodie und versetzte Arpeggien. Acht suchende Takte gehen in acht weit ausschwingende Antworttakte über.
- **Eiszapfen-Pass:** h-Moll mit Fis-Dur-Dominante bei 146 BPM, kurze kristalline Töne über straffem Puls. Der zweite Acht-Takt-Abschnitt erweitert die knappen Tonpaare durch größere Sprünge und dichtere Bassantworten.
- **Mondbasis:** fis-Moll mit dorischer Aufhellung bei 140 BPM, schwebende Melodiebögen über schnellem Basspuls. Die zwei Acht-Takt-Abschnitte halten die meisten Harmonien je zwei Takte und führen über Cis zurück zum Anfang.

Alle Stücke neu entworfen, ohne externe Musikquellen; kein Ähnlichkeitsnachweis gegenüber sämtlichen Fremdwerken. Hörprüfung und Klangbalance im laufenden Spiel **ungeprüft**.

## C-003 · Quellen und Prüfgrenzen

Am **2026-11-10** in den offiziellen Cloudflare-Unterlagen geprüft:

- [TURN-API: Adresse, Bearer-Token, ttl und iceServers](https://developers.cloudflare.com/realtime/turn/generate-credentials/)
- [TURN-FAQ: Ablauf und maximale Gültigkeit](https://developers.cloudflare.com/realtime/turn/faq/)
- [Realtime-Preise: gemeinsames Freikontingent und Datenpreis](https://developers.cloudflare.com/realtime/sfu/platform/pricing/)
- [Worker-Drosselung: Binding, Wrangler-Version und Standortgrenzen](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)
- [Workers-Preise](https://developers.cloudflare.com/workers/platform/pricing/)
- [Worker-Secrets](https://developers.cloudflare.com/workers/configuration/secrets/)

24 lokale Prüfungen mit simuliertem Anbieter und Binding decken erlaubte/verbotene Origins, Vorabprüfungen, Secrets/TTL, Drosselung und deren Ausfall, API-Aufruf, Antwortformat, Port 53, Fehler und Timeout ab. Keine echten Secrets verwendet. Python-Aufrufe zur optionalen TOML-Parserprüfung waren in dieser Umgebung nicht verfügbar; TOML anhand der Cloudflare-Dokumentation manuell geprüft. Wrangler-Deployment, echte Cloudflare-Bindings, Rechnungs-/Kontoeinrichtung und WebRTC-Ende-zu-Ende-Verbindung **ungeprüft**. Das Spiel erneuert Zugangsdaten derzeit nicht automatisch; die Anleitung nennt die daraus folgende Sitzungsgrenze.

## C-004 · Grenztests und Ergebnis

Lieferung: `codex/c-004-grenztests`, Commit `ff8eae3ea83610d5c67874420ee6bd8e266a0570`, Basis `ce3e36e43aba6286632676cae72a50aaefd9a454`. Ausschließlich die neue Datei `kart-src/tests/unit/netzgrenzen.test.ts` (23 Fälle); kein Spielcode geändert.

- Zeitabstände -41/-40/-39/+39/+40/+41 an echten Geysirgrenzen: Host-Klemme, noch ausstehende Eingaben beim erneuten Abspielen und endgültige Bestätigung geprüft. Außerhalb der Toleranz kann die Vorhersage bis zur Bestätigung anders treffen; die von Claude gewollte Host-Autorität wird ausdrücklich als Ist-Verhalten dokumentiert.
- Mehr als vier aufeinanderfolgende verlorene Pakete, verspätete Duplikate, Pausen 12/13/90/91/92, Queue 30/31 und Rückkehr nach KI-Übernahme mit bestehendem bzw. neuem Client geprüft. ack bleibt innerhalb einer Verbindung monoton; der ausdrücklich aufgerufene resetInput beginnt wie vorgesehen eine neue Zählung.
- Beobachtete Grenze: Bei offline startet die KI im **92.** Tick ohne Eingabe (Prüfung von starved > 90 vor dem Hochzählen); bei 90/91 wird noch neutral gerechnet. Bei Queue 31 werden 23 Befehle verworfen, acht behalten und davon im ersten Schritt drei abgearbeitet (ack 26). Ein später Befehl wird zusätzlich zum bereits gerechneten neutralen Ersatzschritt ausgeführt; der Snapshot korrigiert auch den Timer.
- Erholung nach den Störungen: Vorhersage, ack und endliche Zustandswerte geprüft; nach 60 weiteren Ticks auch die geglättete Darstellung unter 0,5 m Positionsabweichung. Countdown-Nachholen, alte Pakete nach Rennwechsel und die vollständigen Timer-Grenzwerte aus C-001/H1 enthalten.
- Verlorener Befehl am letzten aktiven Geysir-Tick und unmittelbar am Busheck: nicht gleichabständige Rennzeiten, Dreher und Position stimmen schon vor dem korrigierenden Snapshot überein. Drei überlappende Testfahrzeuge auf der Nachtschicht erzwingen Bremsen; eine freie Spur erlaubt Weiterfahrt. Testfahrzeuge und übrige Streckendaten werden danach wiederhergestellt.

Alle Tests verwenden berechnete Tickzeiten und festgesetzte interne Uhren; Item-Kisten sind im Test entfernt. npm ci erfolgreich. Typprüfung und vollständige Testsuite **dreimal hintereinander erfolgreich**, jeweils **12 Dateien / 150 Tests** (127 Bestand + 23 neu). Der erste gezielte Lauf zeigte einen Fehler im neuen Testvergleich bei +pi/-pi; der Winkelvergleich wurde korrigiert. Keine weiteren bestätigten Spielcodefehler, deshalb keine it.fails-/it.skip-Fälle nötig. Dateiumfang, Remote-Commit und sauberer Arbeitsbaum geprüft. Browser, echte Geräte, reale Netzverbindungen und das subjektive Fahrgefühl bleiben **ungeprüft**; kein vollständiger neuer Code-Audit von Claudes Änderungen.

## C-004 · Hinweis von Claude am 2026-11-10 22:45 UTC

Die Basis `ce3e36e` bleibt ausdrücklich zulässig. Claudes Hinweis zur Queue-Kürzung wurde am gelieferten Commit `ff8eae3` geprüft: Beide Queue-Fälle erzeugen ihre Eingaben ausschließlich mit `GAS` (`buttons: BTN_GAS`), enthalten also keine Item-Taste in den später verworfenen Befehlen. Dafür ist keine Codeänderung nötig. Ausführung der Tests auf Protokoll 9 weiterhin **ungeprüft**; die drei erfolgreichen vollständigen Läufe beziehen sich auf die dokumentierte Protokoll-8-Basis.

## C-005 · Prüfbericht abgeliefert

Die Startbedingung wurde beim Abruf am 2026-11-10 23:15 UTC erfüllt. Geprüfter main-Stand: `deac72f4aa71d1c964ddde34001f43627951d259`, Protokoll 9. Bericht: `koordination/codex/berichte/C-005.md`, Commit `084785f28db47e1a7ef0dde154aa5b8120cbacf9`. Spielcode unverändert.

- Zwei reproduzierte Darstellungs-/Geometriefehler: Pressen werden ungefährlich, während ihr Stempel noch unten steht; die quadratische Platte hat ungefährliche Ecken durch eine kreisförmige Trefferprüfung. Renderer-Geometrie und Instanzmatrizen ohne GPU geprüft, kein betrachtetes Browserbild.
- Risiken: float32-Rundung an einer Hallenbandnaht verstärkt ca. 1.4 Mikrometer Anfangsdifferenz auf ca. 20 cm; bestätigter Snapshot korrigiert. Pressen-/Wassergrenzen reagieren auf die gewollte ±40-Zeitklemme. Erst im Trefferschritt aktivierte Schutz-/Fluchtitems kommen nach der Presse zum Zug; eine gewünschte andere Reihenfolge ist nicht vorgegeben.
- Item-Bewegung mit/ohne Bänder/Flut verglichen; Reifen/Kreisel ignorieren die Mechanik, Öl bleibt ortsfest. Begrenzte Fluchtversuche mit allen sechs Pressen, Gegenband/Hallenwand, seitlichem Stoß, Rauch und Rücksetzen unter Presse bzw. in 0.519 m tiefes Wasser erfolgreich. Kein dauerhafter Hänger oder flat-Überlauf nachgewiesen; keine lückenlose Zustandsprüfung.
- npm ci und tsc erfolgreich, vollständige Bestandssuite 12 Dateien / 145 Tests bestanden. 13 zusätzliche, nicht committete Wegwerfproben erfolgreich. Eigene Probenfehler beim Gleitkommavergleich, Sequenzfeldnamen und Diagnosezähler korrigiert; nicht als Spielmechanikfehler gewertet. C-004-Tests sind in diesem main-Stand noch nicht enthalten.

Browserdarstellung/GPU, Ton, subjektives Fahrgefühl, echte Geräte/Netze und vollständige Mehrkart-Rempler bleiben **ungeprüft**. Reproduktionsabläufe, Vorschläge und genauere Prüfgrenzen stehen im Bericht.

## C-004 / C-005 · Abnahme beim Abruf am 2026-11-11 01:15 UTC

Claude hat beide Aufgaben abgenommen: C-004 als ac0189b übernommen (laut Claude alle 23 Tests auch auf neuerem Stand erfolgreich), C-005-Funde in a2fc907 behandelt. Item-Reihenfolge und von Bändern/Wasser unbeeinflusste Items bleiben ausdrücklich gewollt. Eigene C-004-Prüfungen bleiben auf Protokoll 8 bezogen; die neuen Korrekturen sind durch Codex noch nicht nachgeprüft. Neue Folgeaufgabe C-007 wartet auf die Veröffentlichung mit Protokoll 10.

## C-006 · Prüfbericht abgeliefert

Basis origin/main deac72f4aa71d1c964ddde34001f43627951d259, Protokoll 9. Bericht koordination/codex/berichte/C-006.md, Commit b7ec9a791670039afdd6fe47b6de8f21354551a3. Nur Bericht, keine Änderung am Spielcode.

- Ursache mit Tick-Traces reproduziert: Figuren 1/3 setzen nach kurzer Flugphase bei Abschnitt 537 erneut zum Linksdrift an; Figuren 0/2 landen später und beginnen erst bei 584 wieder zu driften. Ab 565 bzw. 562 verlangt die Ziellenkung bereits Rechtskorrektur, die Drift-Halteregel hält trotzdem links. Die Physik kann dann selbst mit voller Gegenlenkung nur links drehen; Steilkurvenhaftung 1.48 verstärkt dies. Erster Gras-Schritt bei 590 bzw. 587, Figur 3 trifft die Bande bei 593. Keine falschen Ast-Zielpunkte in der untersuchten Zone, kein Bremsbefehl zwischen 520 und 590.
- Vollständige Matrix: vier Strecken, vier Wegmasken, zwei KI-Stufen, vier Figuren, KI-Slot 0 und skill 1. Basis und drei Varianten jeweils mit Aufwärmrunde plus vier ausgewerteten Runden: insgesamt 2.048 Messrunden. Alle beendet, keine Stürze. Auch auf der Glut-Lavahöhlenabzweigung tritt das zu lange Halten auf; Klippe/Nacht ohne Gras in der Basis. Rundenabhängigkeit derselben Figur ebenfalls reproduziert.
- Variante A (Steilkurvenfaktor in Lenknormierung) verschlechtert neun Kombinationen beim Gras und erzeugt neue Ausfahrten. B (bei entgegengesetzter Ziellenkung lösen und normal lenken) beseitigt alle gemessenen Grasfahrten, aber 24 Kombinationen werden langsamer, davon 13 um mehr als 0.050 s; größter Verlust 0.458 s. C (B nur bei wirksamer Steilkurve) repariert den Werkshof, lässt Glut unverändert und verlangsamt zehn Kombinationen bis 0.279 s. Deshalb keine unveränderte Übernahme empfohlen; kein sauberer Gesamtfix unter dem vorgegebenen Kriterium nachgewiesen.
- npm ci, npx tsc --noEmit und 12 Dateien / 145 Bestandstests erfolgreich. Messungen nur in Wegwerfkopie mit vorhandenen Abhängigkeiten; 79 kopierte Quelldateien gegen den Basis-Commit verglichen, abgesehen von Zeilenenden und ausdrücklich hinzugefügten Diagnosewerten unverändert. Berichtstabelle aus Messdaten erzeugt und auf vollständige Zuordnung der 128 Kombinationen je Variante geprüft.
- Genau abgegrenzte Abweichung vom Auftrag: pro Runde gemessen 1.8375 s Gras für Figur 1 und 1.05 s/ein Bandenkontakt für Figur 3 auf Werkshof/Maske 0/stark. Die im Auftrag genannten ungefähr doppelten Gras-/Kontaktzahlen sind als Pro-Runde-Werte nicht reproduziert; ursprünglicher Zähler ungeprüft.

Andere KI-Slots/Startplätze, mehr als vier ausgewertete Runden je Kombination, aktive Mechanik, Items, Mehrkart-Rennen, reale Geräte/Browser und Fahrgefühl **ungeprüft**. Varianten nur in Messläufen ausgeführt, nicht zusätzlich durch eine vollständige Typ-/Bestandstestsuite geprüft. Beim Abruf 01:45 UTC ist Protokoll 10 auf main bestätigt; C-007 wird jetzt bearbeitet.

## Weiterer Aufgabenabruf

Beim Aufgabenabruf am 2026-11-11 01:45 UTC nach git fetch origin alle vier Koordinationsdateien vollständig gelesen. main 73cc9049e9d769c0cc273788290947f9afd9199d enthält Protokoll 10; Startbedingung von C-007 erfüllt. Claude-Stand 094ebc676e91b2e7620d4185f45a538a7c9a9d34, neue Aufgabe C-008 nach C-007, kein STOPP. C-006 bereits geliefert und nicht erneut bearbeitet; noch keine Abnahme/Nacharbeit. Claudes Datierungen 01:50/02:00 liegen vor der hiesigen Abrufuhr. C-001 bis C-005 abgenommen, C-006 fertig, C-007 in Arbeit, C-008 angenommen.

Der wiederkehrende Lauf „Kart-Aufgaben von Claude prüfen“ ist in diesem Chat aktiv eingerichtet: alle 30 Minuten, begrenzt bis **2026-11-11 08:43 UTC**, bei STOPP früher beenden. Er liest Koordinationsregeln und Aufgaben neu und berücksichtigt diesen Status, damit noch als „offen“ gelistete, bereits gelieferte Aufgaben nicht doppelt bearbeitet werden. Letzter erfolgreicher automatischer Abruf: 2026-11-11 01:45 UTC. Weitere zukünftige Ausführungen hängen vom lokalen Scheduler ab und sind noch **ungeprüft**.


Abschlusskontrolle: alle vier Codex-Remote-Zweige und ihr erlaubter Dateiumfang verifiziert; Arbeitsbaum sauber, keine Änderungen unter "kart/". Es wurde kein Spiel-Build ausgeführt und nichts zusammengeführt.
