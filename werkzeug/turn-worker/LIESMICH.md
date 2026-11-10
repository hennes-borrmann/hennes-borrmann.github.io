# TURN-Zugang für Schräglage

Diese Vorlage erzeugt kurzlebige Cloudflare-TURN-Zugangsdaten für das Spiel. Der Browser ruft `GET /credentials` auf; zurück kommt `{ "iceServers": [...] }`, wie es `kart-src/src/net/netConfig.ts` erwartet. Der langfristige Schlüssel bleibt im Worker. Der Worker vermittelt nur Zugangsdaten; die Renndaten laufen anschließend über Cloudflares TURN-Server.

**Stand der Dokumentationsprüfung: 10.11.2026.** Die Vorlage ist noch nicht ausgerollt. Echte Zugangsdaten, Cloudflare-Laufzeit und eine reale TURN-Verbindung wurden nicht getestet. Es werden keine zusätzlichen Bibliotheken für den Worker benötigt.

## 1. Konto und TURN-Schlüssel anlegen

1. Ein Konto im [Cloudflare-Dashboard](https://dash.cloudflare.com/) anlegen beziehungsweise anmelden und das gewünschte Konto auswählen. Eine eigene Domain ist für die `workers.dev`-Adresse nicht nötig.
2. Im Dashboard nach **Realtime / TURN** suchen und einen neuen **TURN key** für dieses Spiel anlegen. Den Einstieg bietet auch [Cloudflare: TURN-Zugangsdaten erzeugen](https://developers.cloudflare.com/realtime/turn/generate-credentials/).
3. Die **TURN Key ID** und den zu diesem Schlüssel gehörenden **API Token** sicher aufbewahren. Benötigt wird der TURN-Schlüssel, kein globaler Cloudflare-API-Schlüssel. Kontospezifische Freischaltungs- oder Abrechnungsschritte nur nach Prüfung der im Dashboard angezeigten Bedingungen durchführen; diese wurden hier nicht durchlaufen.
4. Weder den Token noch die später erzeugten Zugangsdaten in GitHub, `net-config.json`, Screenshots oder Chatnachrichten kopieren.

## 2. Werkzeug vorbereiten

Node.js samt npm muss auf dem eigenen Rechner installiert sein. Ein Terminal im Repository öffnen und in den Vorlagenordner wechseln:

```sh
cd werkzeug/turn-worker
node --version
npx wrangler@4 --version
npx wrangler@4 login
```

`npx` lädt das Cloudflare-Veröffentlichungswerkzeug Wrangler bei Bedarf in seinen Werkzeugcache; die Vorlage benötigt keine `package.json` und keine neuen Spielabhängigkeiten. Beim Login öffnet sich der Browser. Dort das richtige Cloudflare-Konto auswählen. Für die Drosselung wird **Wrangler 4.36.0 oder neuer** benötigt. [Cloudflare: Rate-Limiting-Binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)

In `wrangler.toml` darf der Workername angepasst werden. Die `namespace_id = "1001"` ist eine selbst gewählte positive Nummer: Wird diese Nummer im Konto bereits von einer anderen Drosselung verwendet, hier eine freie Nummer wählen, damit keine Zähler geteilt werden.

## 3. Worker veröffentlichen und Secrets setzen

Zuerst die Vorlage veröffentlichen:

```sh
npx wrangler@4 deploy
```

Die ausgegebene HTTPS-Adresse aufschreiben, etwa `https://schraeglage-turn.DEIN-KUERZEL.workers.dev`. Ohne Secrets gibt der veröffentlichte Worker zunächst nur einen kontrollierten Fehler zurück. Nun beide Werte einzeln als Secrets hinterlegen:

```sh
npx wrangler@4 secret put TURN_KEY_ID
npx wrangler@4 secret put TURN_KEY_API_TOKEN
```

Jeweils erst an der Eingabeaufforderung den betreffenden Wert einfügen; ihn nicht als Teil eines Terminalbefehls speichern. `secret put` veröffentlicht die Änderung unmittelbar. Alternativ im Dashboard beim Worker unter **Settings → Variables and Secrets** beide Namen mit Typ **Secret** anlegen und speichern/veröffentlichen. Die Werte gehören nicht in `[vars]` der TOML-Datei. [Cloudflare: Worker-Secrets](https://developers.cloudflare.com/workers/configuration/secrets/)

Die vollständige Abrufadresse lautet jetzt:

```text
https://schraeglage-turn.DEIN-KUERZEL.workers.dev/credentials
```

Ein direktes Öffnen dieser Adresse in der Browser-Adressleiste kann **403** liefern: Eine Navigation sendet normalerweise keinen erlaubten `Origin`-Header. Für einen technischen Test mit curl (unter Windows `curl.exe`) den erlaubten Ursprung ausdrücklich angeben:

```sh
curl -i -H "Origin: https://hennes-borrmann.github.io" https://schraeglage-turn.DEIN-KUERZEL.workers.dev/credentials
```

Erwartet: HTTP 200, `Access-Control-Allow-Origin` mit genau diesem Ursprung, `Cache-Control: no-store` und eine `iceServers`-Liste mit mindestens einer `turn:`- oder `turns:`-Adresse samt `username` und `credential`. Die Antwort enthält temporäre Zugangsdaten und gehört nicht ins Repository.

## 4. Adresse im Spiel eintragen

**Diesen Schritt führt der Besitzer beziehungsweise Claude bei der Veröffentlichung aus. Diese Vorlage hat `kart/` nicht geändert.**

In der veröffentlichten Datei `kart/net-config.json` das Feld `turnCredentialsUrl` auf die vollständige Workeradresse setzen. Bestehende andere Einstellungen erhalten. Ein vollständiges einfaches Beispiel ist:

```json
{
  "stun": ["stun:stun.l.google.com:19302"],
  "turn": null,
  "turnCredentialsUrl": "https://schraeglage-turn.DEIN-KUERZEL.workers.dev/credentials",
  "peerServer": null
}
```

`iceServers` ist das **Antwortformat des Workers**, kein zusätzliches Konfigurationsfeld der Spiel-Datei. Für spätere Veröffentlichungen denselben URL-Wert auch in `kart-src/public/net-config.json` vorsehen, damit er beim nächsten regulären Build erhalten bleibt. Die Veröffentlichungsarbeit bleibt bei Claude; zum Prüfen dieser Vorlage ist kein Spiel-Build nötig.

## 5. Verbindung prüfen

1. Alle beteiligten Bildschirm- und Handy-Seiten neu laden, damit sie frische Zugangsdaten holen.
2. Die [Spielseite mit erzwungenem TURN](https://hennes-borrmann.github.io/kart/?turn=force) öffnen; falls schon Parameter vorhanden sind, `&turn=force` verwenden.
3. Lobby erstellen, zweiten Bildschirm verbinden und Controller koppeln. Die Netz-Testschalter werden laut Spiel-README in die Einladungslinks und QR-Codes übernommen.
4. Die Diagnose im Menü beziehungsweise mit F2 öffnen. Sie muss für die betreffende Verbindung **„über TURN“** anzeigen. Nur HTTP 200 vom Worker beweist noch keine funktionierende TURN-Verbindung.
5. Mit einem Gerät im WLAN und einem im Mobilfunk testen. Danach ohne `turn=force` neu laden, damit wieder direkte Verbindungen möglich sind.

Für lokale Spieltests ist ausschließlich `http://localhost` mit beliebigem Port zusätzlich als Ursprung erlaubt, zum Beispiel `http://localhost:5173`. `https://localhost`, `127.0.0.1`, LAN-IP-Adressen, andere GitHub-Pages-Domains und `Origin: null` sind nicht freigegeben. Der veröffentlichte Worker kann auch von der lokalen Spielseite abgerufen werden; dafür müssen keine Secrets lokal in Dateien liegen.

## Gültigkeit, Kosten und Grenzen

- **Gültigkeit:** Vorgabe sind 1800 Sekunden, also 30 Minuten ab Ausstellung. `TURN_TTL_SECONDS` in `wrangler.toml` kann zwischen 60 und 3600 Sekunden liegen; danach die Änderung veröffentlichen. Die API erhält einen POST an `https://rtc.live.cloudflare.com/v1/turn/keys/{TURN_KEY_ID}/credentials/generate-ice-servers`, Bearer-Token und `{ "ttl": 1800 }`. Cloudflare antwortet mit `iceServers`. [API-Anleitung](https://developers.cloudflare.com/realtime/turn/generate-credentials/)
- **Lange Sitzungen:** Das bestehende Spiel lädt die Zugangsdaten in `loadNetSetup` beim Seitenstart. Diese Vorlage ergänzt keine automatische Erneuerung im Spiel. Vor längeren Spielblöcken alle Seiten gemeinsam neu laden; die Zeit in der Lobby zählt mit. Für dauerhaft laufende Sitzungen braucht das Spiel später eine Erneuerung der ICE-Konfiguration. Cloudflare erlaubt höchstens 48 Stunden pro Zugang; nach Ablauf kann auch eine laufende Verbindung nach kurzer Verzögerung enden. [TURN-FAQ](https://developers.cloudflare.com/realtime/turn/faq/)
- **TURN-Kosten:** Laut aktueller Dokumentation sind die ersten **1.000 GB pro Monat** gemeinsam für Realtime TURN und SFU frei. Darüber fallen **0,05 US-Dollar je GB ausgehender Daten** an. Beispielrechnung: 1.200 GB insgesamt bedeuten 200 kostenpflichtige GB, also 10 US-Dollar für diesen Datenanteil; andere Dienste und mögliche Steuern sind dabei nicht enthalten. [Realtime-Preise](https://developers.cloudflare.com/realtime/sfu/platform/pricing/)
- **Worker-Kosten:** Separates Kontingent: Workers Free nennt **100.000 Anfragen pro Tag** und 10 ms CPU-Zeit je Aufruf. Workers Paid beginnt bei **5 US-Dollar pro Monat**, mit weiteren Kontingenten und Mehrverbrauchspreisen. Auch abgewiesene Anfragen erreichen den Worker. Den tatsächlich gewählten Tarif vor Veröffentlichung prüfen. [Workers-Preise](https://developers.cloudflare.com/workers/platform/pricing/)
- **Drosselung:** 20 Abrufe je IP in 60 Sekunden; bei Überschreitung HTTP 429 und `Retry-After: 60`. Geräte hinter demselben Schul-/Heimanschluss teilen sich das Limit. Cloudflares Zähler gelten je Standort und sind näherungsweise; sie sind kein weltweites hartes Budgetlimit. [Rate-Limiting-Genauigkeit](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/#accuracy)
- **Öffentlicher Zugang:** CORS steuert Browserzugriffe, ist keine Anmeldung. Eigene Programme können einen erlaubten Origin-Header senden; temporäre Zugangsdaten bleiben innerhalb ihrer Laufzeit weitergebbar. TTL und Drosselung begrenzen Missbrauch, verhindern ihn aber nicht. Nutzung und Kosten im Cloudflare-Konto beobachten; für einen geschlossenen Dienst wären zusätzlich überprüfbare Spielersitzungen erforderlich.
- **Erreichbarkeit:** TURN umgeht viele NAT-/Firewall-Probleme, garantiert aber keine Verbindung in jedem Netz. Der vorhandene PeerJS-Signalisierungsdienst muss ebenfalls erreichbar sein. Der Worker verändert diesen Dienst nicht.

## Fehler finden

| HTTP | Bedeutung | Nächster Schritt |
| --- | --- | --- |
| 403 | Ursprung fehlt/ist nicht erlaubt oder unzulässige Preflight-Header | Spiel über den freigegebenen Ursprung öffnen; beim curl-Test `Origin` angeben. |
| 404 | Falscher Pfad | `/credentials` an die Workeradresse anhängen. |
| 405 | Falsche Methode | GET verwenden; OPTIONS dient nur der CORS-Vorabprüfung. |
| 429 | IP-Limit erreicht | Eine Minute warten; mehrere Geräte teilen eventuell eine öffentliche IP. |
| 502 | Anbieterfehler oder ungültige Serverliste | TURN Key ID und zugehörigen Token sowie den Cloudflare-Status prüfen. |
| 503 | Secrets/TTL/Binding fehlen oder Drosselung gestört | Namen und Secret-Typen prüfen, `wrangler.toml` vollständig veröffentlichen. |
| 504 | Anbieterantwort dauert zu lange | Später erneut versuchen; der Worker bricht nach 3,5 Sekunden ab. |

Der Worker reicht keine rohen Anbieterfehler durch und protokolliert weder IP-Adressen noch Secrets. Erfolgreiche Antworten werden nicht gecacht. Wenn das Spiel „TURN nicht verfügbar“ meldet, in den Browser-Entwicklerwerkzeugen unter Netzwerk den Abruf von `/credentials` und dessen HTTP-Status prüfen.

## Lokale Syntaxprüfung

Im Vorlagenordner:

```sh
node --check src/index.js
```

Das prüft JavaScript-Syntax, aber weder Cloudflare-Bindings noch echte Zugangsdaten, Rechnungen oder WebRTC. Ein optionaler Testlauf mit Wrangler ersetzt ebenfalls nicht den abschließenden Verbindungstest über zwei Geräte.
