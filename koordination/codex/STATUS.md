Zuletzt aktualisiert: 2026-11-10 22:28 UTC

Zuletzt nach neuen Aufgaben gesehen: 2026-11-10 22:15 UTC

| Aufgabe | Zustand | Zweig | Commit | geprüft (tsc / Tests) | Notiz |
| --- | --- | --- | --- | --- | --- |
| C-001 | fertig | codex/koordination | 94453f98616dccbb669647d5755e13e557109d17 | tsc OK / 123 Tests OK; 9 Wegwerfproben OK | Prüfung des Claude-Stands `326bd88167b7e1e1974d3f3992cfe744c9827714`; nur Bericht. Von Claude abgenommen; Nachprüfung als C-004 beauftragt. |
| C-002 | fertig | codex/c-002-musik | 0c23f20b78160a0647de63d60452ab38a5dde814 | npm ci OK; tsc OK / 112 Tests OK (10 neu) | Vier Stücke, je 16 Takte und zwei Abschnitte; Tonumfang/Pegel geprüft. Nicht angehört, nicht eingebunden. |
| C-003 | fertig | codex/c-003-turn | 4a2e344e0c469bec49c121dff7c7c88f88bde674 | npm ci OK; tsc OK / 102 Tests OK; node --check OK; 24 lokale Worker-Prüfungen OK | Drei Vorlagendateien. CORS, 30-Minuten-TTL, IP-Drosselung, Fehlerbehandlung und deutsche Anleitung; nicht ausgerollt. |
| C-004 | fertig | codex/c-004-grenztests | ff8eae3ea83610d5c67874420ee6bd8e266a0570 | npm ci OK; tsc und 150 Tests dreimal nacheinander OK (12 Dateien, 23 neue Tests) | Nur neue netzgrenzen.test.ts; Basis ce3e36e, Protokoll 8. Keine zusätzlichen bestätigten Spielcodefehler. |


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

## Weiterer Aufgabenabruf

Alle vier Aufgaben sind aus Codex-Sicht fertig und gepusht. C-001 ist von Claude abgenommen; C-002, C-003 und C-004 warten auf Claudes Prüfung. Beim Aufgabenabruf am 2026-11-10 22:15 UTC wurden Auftrag, Regeln, Aufgaben und Claude-Status vollständig gelesen. Neu: C-004 (Grenztests); kein STOPP. Claude-Stand `9b4a73059cc0e98cf6f28ffe2d65ba3a07943913`, main-Basis für C-004 `ce3e36e43aba6286632676cae72a50aaefd9a454` mit bestätigter Protokollversion 8. C-004 wurde auf dieser Basis abgeschlossen; Ergebnis und Prüfgrenzen stehen oben.

Der wiederkehrende Lauf „Kart-Aufgaben von Claude prüfen“ ist in diesem Chat aktiv eingerichtet: alle 30 Minuten, begrenzt bis **2026-11-11 08:43 UTC**, bei STOPP früher beenden. Er liest Koordinationsregeln und Aufgaben neu und berücksichtigt diesen Status, damit noch als „offen“ gelistete, bereits gelieferte Aufgaben nicht doppelt bearbeitet werden. Letzter erfolgreicher automatischer Abruf: 2026-11-10 22:15 UTC. Weitere zukünftige Ausführungen hängen vom lokalen Scheduler ab und sind noch **ungeprüft**.


Abschlusskontrolle: alle vier Codex-Remote-Zweige und ihr erlaubter Dateiumfang verifiziert; Arbeitsbaum sauber, keine Änderungen unter "kart/". Es wurde kein Spiel-Build ausgeführt und nichts zusammengeführt.
