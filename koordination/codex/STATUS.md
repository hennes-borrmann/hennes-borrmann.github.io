Zuletzt aktualisiert: 2026-11-11 04:16 UTC

Zuletzt nach neuen Aufgaben gesehen: 2026-11-11 04:15 UTC

| Aufgabe | Zustand | Zweig | Commit | geprüft (tsc / Tests) | Notiz |
| --- | --- | --- | --- | --- | --- |
| C-001 | fertig | codex/koordination | 94453f98616dccbb669647d5755e13e557109d17 | tsc OK / 123 Tests OK; 9 Wegwerfproben OK | Prüfung des Claude-Stands `326bd88167b7e1e1974d3f3992cfe744c9827714`; nur Bericht. Von Claude abgenommen; Nachprüfung als C-004 beauftragt. |
| C-002 | fertig | codex/c-002-musik | 0c23f20b78160a0647de63d60452ab38a5dde814 | npm ci OK; tsc OK / 112 Tests OK (10 neu) | Von Claude als Notendaten abgenommen und übernommen. Nicht angehört; wolken laut Claude inzwischen eingebunden. Musikzweig bleibt unverändert. |
| C-003 | fertig | codex/c-003-turn | 4a2e344e0c469bec49c121dff7c7c88f88bde674 | npm ci OK; tsc OK / 102 Tests OK; node --check OK; 24 lokale Worker-Prüfungen OK | Von Claude als Vorlage abgenommen. CORS, 30-Minuten-TTL, IP-Drosselung, Fehlerbehandlung und deutsche Anleitung; nicht ausgerollt. |
| C-004 | fertig | codex/c-004-grenztests | ff8eae3ea83610d5c67874420ee6bd8e266a0570 | npm ci OK; tsc und 150 Tests dreimal nacheinander OK (12 Dateien, 23 neue Tests) | Von Claude abgenommen und als ac0189b übernommen. Eigene Prüfung auf Basis ce3e36e, Protokoll 8. |
| C-005 | fertig | codex/koordination | 084785f28db47e1a7ef0dde154aa5b8120cbacf9 | npm ci OK; tsc OK / 145 Tests OK (12 Dateien); 13 Wegwerfproben OK | main deac72f4aa71d1c964ddde34001f43627951d259, Protokoll 9. Von Claude abgenommen; Korrekturen laut Auftrag in a2fc907. Nachprüfung auf Protokoll 10 inzwischen durch C-007; nur Bericht. |
| C-006 | fertig | codex/koordination | b7ec9a791670039afdd6fe47b6de8f21354551a3 | npm ci OK; tsc OK / 145 Tests OK; 128 Kombinationen je Basis/3 Varianten vollständig gemessen | Von Claude abgenommen. Bericht mit 2.048 Messrunden; keine getestete Variante ohne Nachteile. Claude übernimmt eine engere Drift-Freigabe am Innenrand; neue Fassung durch Codex ungeprüft. |
| C-007 | fertig | codex/c-007-mechaniktests | 93bf052b4ba42f9631e6dee96667a1731254dc74 | npm ci OK; tsc und 219 Tests dreimal nacheinander OK (14 Dateien, 36 neu) | Von Claude abgenommen, laut Auftrag als 54758ff übernommen und alle 36 Fälle auch auf Schritt-7-Stand erfolgreich. Eigene Prüfung weiterhin auf main 73cc904 / Protokoll 10; Zweig unverändert. |
| C-008 | fertig | codex/koordination | f8cc21c3fb23d1bd8b8c89a8e256c1a259138940 | npm ci auf identischer C-007-Basis OK; tsc und 183 Bestandstests erneut OK; 14 Wegwerfproben OK | main 73cc904 / Protokoll 10. Drei bestätigte Fehler, zwei Risiken; nur Bericht. Katapult verliert Rennfortschritt, Ziel 157 Ticks nach dritter Linienquerung. |
| C-009 | angenommen | codex/koordination | noch keiner | Startbedingung geprüft: main 73cc904 weiterhin Protokoll 10; fachliche Prüfung offen | Prüfbericht Tauchen. Erst beginnen, wenn origin/main exakt PROTOCOL_VERSION = 11 enthält; C-008 ist bereits geliefert. |

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

## C-007 · Grenztests abgeliefert

Basis 73cc9049e9d769c0cc273788290947f9afd9199d, Protokoll 10. Ausschließlich die neue Datei kart-src/tests/unit/mechanikgrenzen.test.ts auf codex/c-007-mechaniktests, Commit 93bf052b4ba42f9631e6dee96667a1731254dc74. 36 deterministische Tests ergänzen den Bestand:

- Alte und künftige Zeitklemme mit 39/40/41 Ticks an Pressenfreigabe und steigender Wasserlinie: echte Eingabepakete, Host-Schritt und anschließender Snapshot. Beide Überschreitungsrichtungen erzeugen nachgewiesene Unterschiede vor dem Abgleich; danach Position unter 0.0001 m und identische Timer.
- Neun Item-Zeitlagen: Schild, Feder, Drache einen Tick vor, im und nach Aufschlag. Schild/Drache schützen mit einem Tick Vorsprung; die Feder bleibt dann noch in Pressenhöhe und schützt nicht. Im selben Tick kommen alle zu spät, wie beauftragt. Kein daraus abgeleiteter Fehlerbericht.
- Rücksetzen unter Presse und im tiefsten Rücksetzpunkt der Uferstraße, Schutzzeit und Flucht innerhalb fester Frist; Flut für die Flucht festgehalten, damit die KI nicht nur Ebbe abwartet. Gegenband/Hallenwand nach seitlichem Stoß mit/ohne Rauch. Kein Sturz oder Hänger in diesen Fällen.
- Rollreifen, Kreisel und Öl: alle 30 Folgezustände mit/ohne Band bzw. Wasser identisch, Bewegungs- bzw. Stillstandskontrolle. Beide Hallenbandnähte über echte Snapshot-Quantisierung mit nachgewiesenem Seitenwechsel der Rundung; vor und nach jedem Abgleich unter 0.0001 m. Landung innen/außen am seitlichen Bandrand und beide Längsenden geprüft. Bereits vorhandene Tests zu Pressenecken, Hub und flat-Feld nicht dupliziert.

npm ci erfolgreich. npx tsc --noEmit und die vollständige Suite **dreimal nacheinander erfolgreich**, jeweils **14 Dateien / 219 Tests** (183 Bestand + 36 neu). Keine it.fails-/skip-Fälle nötig. Keine echte Uhr oder zufällige Item-Auslosung in den neuen Tests; alle veränderten Streckenreferenzen werden wiederhergestellt. Reale Netze, Browser/GPU, subjektives Fahrgefühl und vollständiger Zustandsraum bleiben **ungeprüft**.

## C-008 · Prüfbericht abgeliefert

Basis origin/main 73cc9049e9d769c0cc273788290947f9afd9199d, Protokoll 10. Bericht koordination/codex/berichte/C-008.md, Commit f8cc21c3fb23d1bd8b8c89a8e256c1a259138940. Spielcode unverändert.

- Hohe Priorität: Host summiert segDelta mit verschiedenen Maßstäben innerhalb und außerhalb der Katapult-Abzweigung. Direkte Fortschrittsdifferenz 266, Summe über sämtliche Abzweigungsabschnitte nur 241.207469. Echter Host mit Figur 0/mittel/fester Katapult-Route beendet das Rennen erst 157 Ticks bzw. 2.617 s und ungefähr 69 m nach der dritten vollen Ziellinienquerung. Auch Rundenzähler und Rangliste verwenden diesen fehlerhaften Fortschritt. Laufsteg-Route im Vergleich neun Ticks verspätet. Kein Fix eingebaut; konkrete Reproduktion und Vorschlag im Bericht.
- Zwei kleinere Rückmeldungsfehler über die echte RaceScene.detect-Methode reproduziert: Boost-Item im Flug meldet RING!/ring ohne Ringkontakt; Aufwind oberhalb der Flugdecke meldet AUFWIND!/lift trotz sinkender Physik. Aufrufe aufgezeichnet, kein GPU-Bild oder Ton geprüft.
- Float32-Risiko an Ring-/Aufwindgrenzen bestätigt; zusätzlich 72 echte Host-/Client-Fälle an Flugkante, Landung, Gabelung und Einmündung. Größter Unterschied vor Abgleich 0.045996 m, nach bestätigtem Snapshot stets unter 0.00001 m. Kontinuierliche Korridorgrenze unauffällig. Derselbe Ring kann bei langsamem oder gedrehtem Kart alle neun Ticks nachladen; als Designrisiko abgegrenzt, kein unbewiesener Endlosaufenthalt.
- 144 KI-Flugfälle (drei Flüge, vier Figuren, drei Stärken, normal/Rauch/seitlicher Impuls/Rücksetzen) bis zur tatsächlichen Bodenberührung erfolgreich, kein weiterer Sturz oder Wandtreffer. 24 Kombinationen aus Figur/Stärke/Route mit je zwei vollen physischen Runden erfolgreich. 48 zusätzliche Erholungsfälle, 45 tiefe/seitliche Landungen, 18 Abschlepp-Endfälle, niedrige/negative Anfangstempi, echte Rückwärts-Eintritte und kontrollierte Host-Item-/Zweikartkontakte geprüft. Tiefe Landungen oder bewusstes Abfliegen außen können erwartungsgemäß einmal stürzen; anschließend kein Hänger. Rücksetzpunkt hinter Landung weicht von der im Kommentar beschriebenen Anlaufregel ab; gewünschte Regel offen.
- npm ci bereits für C-007 auf exakt gleicher Basis erfolgreich; Abhängigkeiten unverändert weiterverwendet. TypeScript und reine main-Bestandssuite erneut erfolgreich: 13 Dateien / 183 Tests. 14 Wegwerfproben außerhalb des Repositorys erfolgreich; eigener Syntaxfehler vor Ausführung korrigiert. Alle Quellen wie beauftragt gelesen, keine Proben committet.

Reale Geräte/Browser, Bild/Ton, Fahrgefühl, echte Leitungen mit Verlust/Jitter, freie KI-Wegwahl über viele Rennen, andere KI-Slots/skill-Werte und vollständiger Zustandsraum **ungeprüft**. C-001 bis C-008 sind geliefert; C-001 bis C-007 inzwischen von Claude abgenommen. C-008 wartet auf Abnahme/Nacharbeit.

## C-006 / C-007 · Abnahme beim Abruf am 2026-11-11 02:45 UTC

Claude hat beide Aufgaben abgenommen. Laut AUFGABEN.md liegt C-007 als Cherry-Pick 54758ff auf dem Stand für Schritt 7; alle 36 Tests laufen dort auch mit Tauchen, Eis, Mond, Sprungplatten, neuer Drachen-Regel und KI-Drift. Der Codezweig bleibt unverändert. Eigene Testresultate weiterhin ausschließlich auf der dokumentierten Protokoll-10-Basis.

Zu C-006 setzt Claude eine engere Fassung von Variante B um: Drift lösen, wenn die Ziellinie weiter nach außen verlangt als der weiteste Driftbogen zulässt und der Innenrand nahe ist (1.6 m, bei schmaler Bahn weniger). Claudes Vergleich nennt weniger Gras/Bandentreffer im Werkshof und Glutkessel bei leicht besseren Mittelzeiten, aber weiterhin einzelne um etwa 0.2 s langsamere Kombinationen. Das strenge Kriterium ohne jede Verschlechterung wird also ausdrücklich nicht erfüllt. Diese neue Implementierung und Claudes Messzahlen sind durch Codex **ungeprüft**; keine Nacharbeit angefordert.

## C-009 · Angenommen, wartet auf Veröffentlichung

Neuer Auftrag zum Tauchen am Tiefseeriff, danach nur lesende Hinweise zu den Eis-/Mondtests. Erlaubt ist ausschließlich koordination/codex/berichte/C-009.md auf codex/koordination, zusätzlich die üblichen Status-/Log-Einträge. Start ausdrücklich erst, wenn origin/main in kart-src/src/net/protocol.ts die Zeile `export const PROTOCOL_VERSION = 11;` enthält. Auch beim Abruf 04:15 UTC ist main unverändert 73cc9049e9d769c0cc273788290947f9afd9199d und enthält weiterhin Version 10; deshalb noch keine fachliche Arbeit begonnen. C-008 hat Vorrang und ist bereits abgeliefert. Startbedingung beim nächsten regulären Abruf erneut prüfen.

## Weiterer Aufgabenabruf

Beim Aufgabenabruf am 2026-11-11 04:15 UTC zuerst bisherigen Koordinationsstand gelesen, danach git fetch origin und alle vier aktuellen Auftragsdateien vollständig gelesen. Claude c5fff781ee61a541bdc8fc24a364ce4068798bbc und main 73cc9049e9d769c0cc273788290947f9afd9199d unverändert. Keine neuen Aufgaben, Nacharbeiten, Abnahmen oder STOPP. C-008 bereits geliefert; C-009 weiter angenommen, da main nach erneuter Prüfung noch Protokoll 10 enthält und die Startbedingung Version 11 nicht erfüllt. Keine Tests wiederholt, keine neue fachliche Prüfung und keine Doppelarbeit. Bestehende Ergebnisse und ungeprüfte Punkte unverändert. Nächster regulärer Abruf 04:45 UTC.

Der wiederkehrende Lauf „Kart-Aufgaben von Claude prüfen“ ist in diesem Chat aktiv eingerichtet: alle 30 Minuten, begrenzt bis **2026-11-11 08:43 UTC**, bei STOPP früher beenden. Er liest Koordinationsregeln und Aufgaben neu und berücksichtigt diesen Status, damit noch als „offen“ gelistete, bereits gelieferte Aufgaben nicht doppelt bearbeitet werden. Letzter erfolgreicher automatischer Abruf: 2026-11-11 04:15 UTC. Weitere zukünftige Ausführungen hängen vom lokalen Scheduler ab und sind noch **ungeprüft**.


Bei diesem Abruf nur STATUS.md und LOG.md geändert. Die letzten Fachlieferungen bleiben unverändert: C-007 enthält ausschließlich die erlaubte neue Testdatei, C-008 ausschließlich Bericht und Koordinationsdokumentation. Keine eigenen Änderungen unter "kart/", kein Spiel-Build, kein Merge und kein Push nach main oder claude/*.
