# Plan: Billett automatisch aufs Gerät, Störungsmeldungen

Stand: 15.11.2026. Auftrag des Inhabers: «Finden wir nicht einen einfacheren,
automatischeren Weg um das Ticket ins App zu kriegen? […] Was ist der
Schlüssel zur Störungsmeldung?» Dieses Dokument ist ein **Plan, kein Bau**.
Gebaut wird erst nach dem Go des Inhabers. Es ergänzt `docs/KONZEPT.md`
(Abschnitte 4.2, 5.3 und 7).

Lesehilfe: Aussagen mit Quelle sind belegt (Link). Was nicht an einer Quelle
geprüft ist, steht mit **«ungeprüft»** dabei. Konten, Schlüssel und Käufe
macht nur der Inhaber.

---

## Kurzfassung

- **Billett-Import, Empfehlung Variante A:** Die Person leitet die
  SBB-Bestätigungsmail (einmal eingerichtet per Mailregel: automatisch) an
  eine persönliche Adresse unseres kleinen Dienstes weiter. Der Dienst nimmt
  das Billett-PDF heraus, verschlüsselt es für das gekoppelte Gerät, das Light
  Phone holt es beim Öffnen ab, der Dienst löscht es. Rund 10 bis 11
  Personentage, rund USD 5 pro Monat.
- **Mitbauen:** die Upload-Seite aus **Variante B** (Teilen-Menü auf Android,
  Upload-Seite auf iOS) als Rückfall. Sie nutzt denselben Kern (Relay,
  Verschlüsselung, Abholung), rund 2 Personentage mehr.
- **Nicht bauen:** **Variante C** (QR-Code mit dem Light Phone abscannen und
  neu zeichnen): ohne Server und gratis, aber nach den SBB-AGB nicht
  abgesichert und nicht automatisch. **SwissPass- oder Kundenkonto-
  Verknüpfung** ist ohne Partnervertrag nicht zulässig.
- **Vor dem Bau klären:** echte SBB-Mails ansehen (PDF-Anhang oder nur Link?),
  `HttpURLConnection` und `javax.crypto` auf LightOS, Name ohne «SBB»,
  Rückfrage bei Light zu fremden Servern.
- **Störungsmeldungen:** Der Schlüssel ist **SIRI-SX** von
  opentransportdata.swiss (Haltestellen als SLOID, Texte kurz/mittel/lang).
  Der API-Schlüssel erlaubt nur 2 Abrufe pro Minute, darum holt ein
  Cloudflare Worker die Meldungen einmal pro Minute für alle; das Tool fragt
  nur den Worker. Kein Schlüssel im APK. Rund 5 bis 6,5 Personentage; läuft
  im selben Worker-Plan (USD 5 pro Monat).
- **Vom Inhaber nötig:** Go, Registrierung im API Manager (gratis),
  Cloudflare-Konto, Name des Tools.

---

## 1. Ausgangslage

Heute kommt ein Billett nur über einen Computer aufs Light Phone III: PDF im
Tool Manager im selben WLAN hochladen (`docs/LIGHT-SDK-APIS.md`). Das Gerät
hat keine Mail und keinen Browser. Dateiwahl und «Teilen an» sind im SDK
gesperrt; erlaubt sind Netzwerk (`HttpURLConnection`), Kamera-Scanner und der
Tool Manager.

**Was die SBB-AGB sagen** (geprüft am 15.11.2026,
[AGB Kauf Webshop](https://www.sbb.ch/de/meta/legallines/agb-kauf-webshop.html)):

- Das Billett muss «auf dem Bildschirm sichtbar oder in einer Applikation des
  Endgerätes verfügbar sein». Ausweispflicht, personengebunden.
- «Die von der SBB zugestellte E-Mail-Bestätigung gilt NICHT als Fahrausweis.»
- «Über Fax oder andere Geräte ausgedruckte bzw. kopierte Billette werden
  nicht als gültig anerkannt» (Abschnitt Papier).
- Weiterleiten «als QR-Code» an Dritte ist ausdrücklich nur für Billette aus
  **Apple Wallet** und der **Alipay/WeChat Mini App** zugelassen.
  **Korrektur zu KONZEPT 5.1:** Dort steht, Weiterleiten sei «aus der App»
  allgemein erlaubt; das ist enger.

Folge: Jede Variante muss das **unveränderte Billett-PDF** aufs Gerät bringen.
Den QR-Code neu zu zeichnen ist nicht abgesichert.

---

## 2. Drei Varianten

Je eine Seite, ausgearbeitet von je einem Hilfsagenten und hier gegengelesen.

### 2.1 Variante A: Mail-Weiterleitung an eigenen Dienst

**Ablauf für den Nutzer**

*Einmalig:*
1. Im Tool «Koppeln» wählen. Das Tool zeigt einmalig einen Code, z. B. `K4-9QX2`.
2. Vom eigenen Mailkonto eine Mail mit dem Code im Betreff an `koppeln@in.<domain>` senden.
3. Das Tool zeigt dann die persönliche Adresse, z. B. `x7k2@in.<domain>`. Nur die gekoppelte Absenderadresse darf Billette liefern.

*Pro Billett:*
1. Die SBB-Bestätigungsmail an `x7k2@in.<domain>` weiterleiten (einmal eingerichtet auch als Mailregel möglich, dann ganz automatisch).
2. Das Tool öffnen. Es holt das Billett, speichert es und löscht es auf dem Server.

**Technik**

- **Empfang:** [Cloudflare Email Routing](https://developers.cloudflare.com/email-routing/) leitet alle Adressen (Catch-all) an einen Email Worker. Höchstens 25 MiB je Mail; Mails ohne gültiges SPF oder DKIM werden abgewiesen, DMARC des Absenders gilt ([Postmaster](https://developers.cloudflare.com/email-routing/postmaster/), [Limits](https://developers.cloudflare.com/email-routing/limits/)). Der Worker prüft den obersten `Authentication-Results`-Header ([Runtime API](https://developers.cloudflare.com/email-routing/email-workers/runtime-api/)), zerlegt die Mail, legt das verschlüsselte PDF in R2 und Kopplung/Index in KV ab.
- **Anhang oder Link?** Laut SBB-Hilfe wird das Billett «in der Regel direkt in der Bestellbestätigungs-E-Mail angezeigt oder Sie erhalten einen Download-Link» ([SBB-Hilfe](https://www.sbb.ch/de/hilfe-und-kontakt/produkte-services/billette/schweiz/billette.html)). Beim Gastkauf kam das PDF laut einem Nutzerbericht als Anhang ([SBB Community](https://community.sbb.ch/d/32732-warum-kein-billettverkauf-als-pdf-datei-im-anhang-der-email), nur über Suchergebnis, **ungeprüft**). Der Worker deckt drei Fälle ab: (a) PDF-Anhang wird übernommen; (b) Link auf `sbb.ch` (feste Host-Liste): Worker ruft ihn ab, nimmt nur `application/pdf` an; ob das ohne Login, Cookies oder Bot-Sperre geht und wie lange der Link gilt: **ungeprüft** (Alternative: Link verschlüsselt ans Tool, Tool lädt selbst); (c) nur ein Bild in der Mail: abgelehnt, kein Nachbau des QR-Codes.
- **Verschlüsselung:** Ein Schlüssel aus dem kurzen Kopplungscode liesse sich offline durchprobieren. Besser: Das Tool erzeugt beim Koppeln ein Schlüsselpaar (RSA-OAEP über `javax.crypto`, im SDK nicht gesperrt, Laufzeit **ungeprüft**). Der Server kennt nur den öffentlichen Schlüssel und verschlüsselt das PDF sofort (AES-GCM, Schlüssel mit RSA geschützt). Echtes Ende-zu-Ende ist das nicht: Die Mail liegt kurz unverschlüsselt im Speicher des Workers.
- **Abholung:** Beim Öffnen fragt das Tool `GET /v1/tickets` mit Geräte-Token über `HttpURLConnection`, entschlüsselt, speichert lokal unter `billette/` und löscht per `DELETE`. Kein Abruf im Hintergrund (`android.app.*` gesperrt, Push im gepinnten SDK nicht belegt).

**Datenschutz**

- Billette sind personengebunden und tragen Name und Reise. Der Betreiber ist Verantwortlicher nach [revDSG](https://www.fedlex.admin.ch/eli/cc/2022/491/de): Datenschutzerklärung (Art. 19), Datensicherheit (Art. 8), Auftragsbearbeitung mit Cloudflare (Art. 9), Bekanntgabe in die USA (Art. 16; Zertifizierung unter Swiss-U.S. DPF **ungeprüft**).
- Löschfristen: Rohmail nie gespeichert; verschlüsseltes PDF nach Abholung sofort gelöscht, sonst nach 72 Stunden; Kopplung verfällt nach 12 Monaten ohne Abruf.
- Missbrauch: nur gekoppelte Absender mit bestandener DMARC-Prüfung, nur PDF bis 5 MB. Die DKIM-Signatur der SBB lässt sich nur prüfen, wenn die Mail «als Anhang» weitergeleitet wird (**ungeprüft**, je nach Mailanbieter).

**Kosten**

Email Routing: eingehende Mails unbegrenzt, gratis ([Preise](https://developers.cloudflare.com/email-service/platform/pricing/)). Workers Free: 100 000 Anfragen pro Tag, aber 10 ms CPU je Aufruf; Mail zerlegen und verschlüsseln braucht vermutlich mehr, also realistisch Workers Paid **USD 5 pro Monat** ([Workers-Preise](https://developers.cloudflare.com/workers/platform/pricing/)). R2 gratis bis 10 GB ([R2-Preise](https://developers.cloudflare.com/r2/pricing/)). Domain: Unterdomain einer bestehenden Domain gratis, neue `.ch` rund CHF 10–20 pro Jahr (**ungeprüft**). Derselbe Worker-Plan trägt auch den Störungsdienst (Abschnitt 4).

**Aufwand**

| Teil | Personentage |
|------|--------------|
| Worker (Empfang, Mail zerlegen, Link abrufen, Kopplung, API) | 4 |
| Tool (Koppeln, Abholung, Entschlüsselung) | 3 |
| Sicherheit, Datenschutzerklärung, automatisches Löschen | 2 |
| Tests mit echten SBB-Mails | 1–2 |
| **Total** | **10–11** |

Betrieb danach ca. 0,5 Personentage pro Quartal.

**Risiken**

- AGB: «Die von der SBB zugestellte E-Mail-Bestätigung gilt NICHT als Fahrausweis» ([AGB Kauf Webshop](https://www.sbb.ch/de/meta/legallines/agb-kauf-webshop.html)). Der Dienst liefert also nur das Billett-PDF, nie den Mailtext. Das PDF wird unverändert übernommen und auf dem Bildschirm gezeigt; das deckt die Regel «auf dem Bildschirm sichtbar oder in einer Applikation des Endgerätes verfügbar». Ausweispflicht gilt immer.
- Ändert die SBB das Mailformat oder sperrt den Linkabruf, bricht die Abholung.
- Marke: Inhalte, Marken und Logos gehören der SBB ([Rechtlicher Hinweis](https://www.sbb.ch/de/meta/legallines/rechtlicher-hinweis.html)); kein «sbb» in Domain oder Adresse.
- Light könnte Tools mit Mail-Bezug nicht freigeben ([WIRED](https://www.wired.com/story/exclusive-light-phone-developer-kit/)).
- Der Dienst sammelt personengebundene Billette und wird damit zum Angriffsziel.

**Offene Prüfpunkte**

1. Echte Bestätigungsmails prüfen (mit Login und als Gast): Anhang, Link oder nur Bild?
2. Lässt sich der Link ohne Login und von Cloudflare-Adressen abrufen, wie lange gilt er?
3. Bleibt die DKIM-Signatur der SBB beim Weiterleiten über Gmail, Outlook und Bluewin erhalten?
4. Funktionieren RSA-OAEP und `HttpURLConnection` zur Laufzeit auf LightOS?
5. Cloudflare: DPF-Zertifizierung, Auftragsbearbeitung, R2-Speicherort EU?
6. Entscheid des Inhabers zu Weg F (KONZEPT Abschnitt 7, Frage 6).

### 2.2 Variante B: Teilen-Menü und Web-Upload

**Ablauf für den Nutzer**

*Einmalig:* Im Tool «Koppeln» wählen. Das Light Phone zeigt einen QR-Code mit Kanal-ID und Schlüssel, z. B. `…/lightTicket/#c=…&k=…`. Der Teil nach `#` geht nie an einen Server. Die Person scannt den Code mit dem Smartphone. Auf Android installiert sie danach die PWA, auf iOS fügt sie den Kurzbefehl hinzu oder setzt ein Lesezeichen auf die Upload-Seite.
*Pro Billett:* Im Mailprogramm oder in SBB Mobile auf «Teilen» → «SBB Light» tippen. Auf iOS ein PDF aus «Dateien» auf der Upload-Seite wählen. Das Tool holt das Billett beim nächsten Öffnen ab und legt es wie heute unter `billette/` ab.

**Technik**

- **Web Share Target:** Laut MDN-Kompatibilitätsdaten geht es in Chrome Android ab 76, Safari und iOS haben es nicht, Firefox auch nicht ([BCD](https://github.com/mdn/browser-compat-data/blob/main/manifests/webapp/share_target.json)). Dateien kommen nur per `POST` mit `multipart/form-data`, ein Service Worker nimmt sie an ([MDN](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/share_target)). Die PWA muss installiert sein ([Chrome Developers](https://developer.chrome.com/docs/capabilities/web-apis/web-share-target)). Nötig sind ein Eintrag `share_target` in `manifest.webmanifest` und ein Handler in `sw.js`.
- **iOS-Kurzbefehl:** Er nimmt die Eingabe aus dem Teilen-Menü an und schickt sie mit «Inhalte von URL abrufen» per `POST` und Formular-Body ab ([Apple](https://support.apple.com/guide/shortcuts/apd58d46713f/ios), [Beispiel](https://indieweb.org/Shortcut)). Kurzbefehle bieten keine Verschlüsselungsaktion (**ungeprüft**). Für Ende-zu-Ende-Verschlüsselung ist deshalb die Upload-Seite mit WebCrypto besser.
- **SBB Mobile:** Das Weiterleiten als QR-Code erlauben die AGB ausdrücklich nur für Billette aus Apple Wallet und der Alipay/WeChat Mini App ([AGB Kauf Webshop](https://www.sbb.ch/de/meta/legallines/agb-kauf-webshop.html)). Ob die App beim Teilen ein PDF, ein Bild oder nur einen Link oder Text hergibt, ist **ungeprüft**. Ein Link wäre ohne SBB-Login wertlos. Sicher ist nur das Webshop-PDF.
- **Relay:** Ein Cloudflare Worker mit R2. Das Smartphone verschlüsselt das Billett mit AES-GCM, der Schlüssel stammt aus der Kopplung. Der Worker legt nur Chiffrat unter der Kanal-ID ab. Das Tool fragt mit HMAC-Signatur ab (`HttpURLConnection`, `javax.crypto`; Letzteres ist im SDK nicht gesperrt, aber **ungeprüft**), entschlüsselt und quittiert. Danach löscht der Worker die Datei. Als Rückfall greift eine R2-Lifecycle-Regel, sie löscht «typically within 24 hours» ([Cloudflare](https://developers.cloudflare.com/r2/buckets/object-lifecycles/)). Push gibt es nicht, das Tool fragt beim Öffnen ab. Ein Hintergrundabruf über `LightWork` ist **ungeprüft**.
- **Ohne Server (direkt zum Tool Manager):** Der Tool Manager läuft auf dem Gerät über HTTPS auf Port 54449 mit `*.my.local-ip.co`. Mixed Content ist damit kein Problem. Die Kopplung läuft über einen 6-stelligen TOTP-Code an `POST /api/pair`, danach werden Anfragen mit HMAC signiert ([server/README](https://github.com/lightphone/light-tool-manager/blob/main/server/README.md)). In `Application.kt` (Commit `9d353c4`) ist aber **kein CORS-Plugin** installiert. Darum scheitert schon die Kopplung von github.io aus, weil die JSON-Anfrage einen Preflight auslöst. Dazu kommt in Chrome ab 142 eine Abfrage für «Local Network Access» ([Chromium](https://groups.google.com/a/chromium.org/g/blink-dev/c/lRnFRIfzDMU)). Ein eigener Ktor-Server im Tool könnte CORS senden, hätte aber kein Zertifikat. Mit reinem HTTP würde der Mixed-Content-Schutz greifen. **Fazit:** Ohne Server geht es nur, wenn Light CORS zulässt.

**Datenschutz**

Der Relay sieht nur Chiffrat, Grösse, Zeit und IP-Adresse. Er schreibt keine Logs mit Inhalt und hält die Datei höchstens 24 Stunden. Cloudflare ist ein US-Anbieter: Das gehört in die Datenschutzerklärung nach revDSG. Den Schlüssel kennen nur die beiden Geräte. Beim iOS-Kurzbefehl im Klartext liegt das Billett unverschlüsselt auf dem Server. Davon raten wir ab.

**Kosten**

Der Workers Free Plan bietet 100 000 Anfragen pro Tag ([Cloudflare](https://developers.cloudflare.com/workers/platform/pricing/)). R2 ist gratis bis 10 GB-Monat, 1 Mio. Class-A-Operationen, ohne Egress-Kosten ([Cloudflare](https://developers.cloudflare.com/r2/pricing/)). GitHub Pages bleibt. Erwartet sind CHF 0 pro Monat. Ab dem Paid Plan kostet es USD 5 pro Monat. Ob R2 eine hinterlegte Zahlungsart verlangt, ist **ungeprüft**.

**Aufwand**

| Teil | Personentage |
|---|---|
| PWA: Share Target, Upload-Seite, Kopplung, WebCrypto | 2 |
| Worker mit R2, Auth, Löschen | 1,5 |
| Tool: Kopplungs-QR, Abruf, Entschlüsselung, Ablage | 3 |
| iOS-Kurzbefehl, Anleitung | 0,5 |
| Tests, Sicherheitsprüfung | 1,5 |
| **Total** | **ca. 8,5** |

Die Variante ohne Server kostet ca. 3 Personentage, aber erst, wenn Light CORS freigibt.

**Risiken**

- **AGB:** Weiterleiten als QR-Code ist nur für Wallet- und Mini-App-Billette ausdrücklich erlaubt, immer mit Ausweispflicht. Das unveränderte PDF auf dem Bildschirm deckt die Regel «auf dem Bildschirm sichtbar oder in einer Applikation des Endgerätes verfügbar». Die Bestätigungsmail «gilt NICHT als Fahrausweis». Teilen muss deshalb das Billett-PDF, nicht den Mailtext ([AGB](https://www.sbb.ch/de/meta/legallines/agb-kauf-webshop.html)).
- **Marke:** «SBB Light» erscheint im Teilen-Menü wie ein offizieller Dienst. Das Verwechslungsrisiko ist hoch, ein neutraler Name ist nötig. Ob die Marke geschützt ist, ist **ungeprüft**.
- **Abhängigkeit:** Für Kopplung und Abruf braucht das Light Phone Internet.
- **Tool Library:** Ob Light einen fremden Server und `javax.crypto` zulässt, ist **ungeprüft**.
- **Kanal-ID:** Geht sie verloren, ist Spam möglich. Gegenmittel: Grenzen von 5 MB und PDF/PNG/JPEG, Rate-Limit.

**Offene Prüfpunkte**

1. Was gibt SBB Mobile auf Android und iOS beim «Teilen» heraus?
2. Erscheint ein PDF-Anhang aus Gmail bzw. Apple Mail im Teilen-Menü?
3. Läuft `javax.crypto` in Tools auf LightOS? Gibt es Hintergrundabruf über `LightWork`?
4. Gibt Light CORS frei oder bietet eine Kopplungs-URL im Tool Manager an? Bei Ja ist der Relay unnötig.
5. Gibt es eine Verschlüsselung im iOS-Kurzbefehl, oder bleibt auf iOS nur die Upload-Seite?
6. Darf ein Relay bei Cloudflare in den USA laufen, oder braucht es einen Schweizer Anbieter?
7. Name ohne «SBB» vor dem Share Target festlegen.

### 2.3 Variante C: Billett mit dem Light Phone abscannen

**Geprüft und verworfen: SwissPass- oder Kundenkonto-Verknüpfung.** Es gibt keine öffentliche Schnittstelle, über die ein fremdes Tool die Billette einer Privatperson abholen kann. Die SBB Swiss Mobility API (B2P) ist eine Verkaufsschnittstelle für registrierte Vertriebspartner mit Vertrag und Bonitätsprüfung und holt keine bereits gekauften Billette ab ([SBB Swiss Mobility API](https://company.sbb.ch/en/offers/services/swiss-mobility-solutions/api.html), [B2P-Doku](https://b2p.app.sbb.ch/docs/index.html)). Eine SwissPass-Anbindung setzt eine vereinbarte Partnerschaft voraus ([Beispiel SecuTix](https://go.confluence.secutix.com/wiki/spaces/RN/pages/43058470/SwissPass+integration+and+Axess+interface)). Ein SwissPass-Login im Tool mit Scraping hiesse: Zugangsdaten im Tool und Umgehen der Zwei-Faktor-Anmeldung ([blue News](https://www.bluewin.ch/en/news/switzerland/swisspass-login-even-more-complicated-since-mid-may-heres-why-li.2714242)). Der [rechtliche Hinweis SBB.ch](https://www.sbb.ch/de/meta/legallines/rechtlicher-hinweis.html) erlaubt Kopien nur zum Eigengebrauch und widerruflich. Die SwissPass-Nutzungsbedingungen liessen sich nicht abrufen (Server 403): **ungeprüft**. Ergebnis: **ohne Partnervertrag nicht zulässig**, verworfen (wie KONZEPT 4.3).

**Ablauf für den Nutzer**

1. Billett wie gewohnt in SBB Mobile oder auf SBB.ch kaufen.
2. Im Tool «Billett scannen» wählen, Kamera auf den QR-Code halten: am Handy, am Laptop (PDF) oder auf dem Ausdruck.
3. Das Tool zeigt die erkannten Angaben und fragt ab, was fehlt (Strecke, Datum, gültig bis, Name). Die Person bestätigt.
4. Bei der Kontrolle: Billett öffnen. Code gross, schwarz auf weiss, darunter die Angaben und «Ausweis zeigen».

**Technik**

- **Scanner:** `LightCodeScanner` liest QR, Aztec und PDF417 und liefert `value` und `rawBytes` ([SDK-Quelle, e81295e](https://github.com/lightphone/light-sdk/blob/e81295e6bc29f987c44c656fdf5081117bbee833/sdk/ui/src/main/kotlin/com/thelightphone/sdk/ui/LightCodeScanner.kt)).
- **Inhalt:** binär, Protobuf mit angehängter Signatur, vermutlich DSA (Reverse Engineering, selbst als veraltet markiert: [KDE](https://community.kde.org/KDE_PIM/KItinerary/SBB_Barcode)). Das Tool speichert die **Rohbytes**, nicht den Text.
- **Grenzen des Scanners:** verwirft Treffer ohne Textwert; ob binäre SBB-Codes durchkommen: **ungeprüft**. Nutzt intern ML Kit; ob das ohne Google-Dienste läuft: **ungeprüft**.
- **Neu rendern** mit `zxing` im Byte-Modus (Allowlist, schon im Projekt). Die Signatur bleibt gültig, wenn der Inhalt bitgleich ist.
- **Prüfung bei der Kontrolle:** offline oder online: **ungeprüft**; die SBB legt das nicht offen ([ETH zu EasyRide](https://ethrat.mironet.ch/research/researchers-outsmarted-easyride-function-on-swiss-travel-app.html)).
- **Wechselnder Code:** Laut SBB-Community erneuert SBB Mobile den QR-Code alle 15 Sekunden ([SBB Community](https://community.sbb.ch/d/23389-sbbmobile-qr-code-in-billette-und-abos), nur über Suchergebnis belegt, **ungeprüft**). Stimmt das, veraltet ein Scan aus der App sofort; stabil ist nur der Code aus PDF oder Ausdruck.
- **Sicherheitsmerkmale:** Das PDF-Billett trug 2014 ein graues Prüfquadrat ([Netzwoche 2014](https://www.netzwoche.ch/news/2014-01-31/onlineticketing-loesung-der-sbb-stammt-nicht-von-elca); heute **ungeprüft**). Ein neu gerenderter Code verliert es.

**Datenschutz**

Der Code enthält vermutlich Name, Geburtsdatum, Strecke und Preis. Alles bleibt im privaten App-Speicher, ohne Netz und ohne Konto; Löschen nach Ablauf wie KONZEPT 5.4.

**Kosten**

Keine laufenden Kosten, kein Server, kein Konto.

**Aufwand**

Rund 5 Personentage: Scanner und Rohbytes 1,5; Formular 1; Rendern und Anzeige 1; Tests mit echten Billetten 1,5.

**Risiken**

- **AGB:** Das Billett muss «auf dem Bildschirm sichtbar oder in einer Applikation des Endgerätes verfügbar» sein, die OT-Nummer lesbar; «über Fax oder andere Geräte ausgedruckte bzw. kopierte Billette» gelten nicht (Papier); Weiterleiten «als QR-Code» ist ausdrücklich nur für Wallet- und Alipay/WeChat-Billette erlaubt ([AGB Kauf Webshop](https://www.sbb.ch/de/meta/legallines/agb-kauf-webshop.html)). Ob ein **neu erzeugter** Code ohne Billettlayout gilt, ist offen. Widerspricht der Regel «nie Neuzeichnung» in KONZEPT 5.2, bräuchte einen ausdrücklichen Entscheid.
- **Ablehnung bei der Kontrolle:** Busse und Ärger trägt die reisende Person.
- **Wechselnde App-Codes** machen den bequemsten Weg (Scan vom Handy) womöglich wertlos.
- **Selbst erfasste Angaben** können falsch sein; massgebend ist allein der Code.

**Offene Prüfpunkte**

1. Schriftliche Anfrage an den SBB-Kundendienst: Gilt ein bitgleich neu gerenderter Code ohne Billettlayout?
2. Wechselt der Code in SBB Mobile? Zwei Scans im Abstand von 30 Sekunden vergleichen.
3. Liefert `LightCodeScanner` die vollständigen Rohbytes, im Emulator und auf LightOS?
4. Liest ein Kontrollgerät den neu gerenderten Code? Feldtest nach docs/FELDTEST.md.

---

## 3. Bewertung und Empfehlung

Bewertet von einem vierten, unabhängigen Hilfsagenten nach festem Raster,
je Kriterium 1 (schlecht) bis 5 (gut).

| Kriterium | Gewicht | A Mail-Weiterleitung | B Teilen/Upload | C Abscannen |
|---|---|---|---|---|
| Einfachheit für den Nutzer | 25 % | 4 | 3 | 3 |
| Automatisierung | 20 % | 5 | 3 | 1 |
| Datenschutz | 15 % | 2 | 4 | 5 |
| Zulässigkeit (SBB-AGB) | 20 % | 4 | 4 | 1 |
| Kosten | 10 % | 3 | 5 | 5 |
| Bauzeit | 10 % | 2 | 3 | 4 |
| **Gewichtetes Total** | 100 % | **3,60** | **3,55** | **2,80** |

- **A:** Stärkste Seite ist die Automatisierung: Mit einer Mailregel kommt jedes Billett ohne Zutun aufs Gerät. Schwächste Seite ist der Datenschutz: Der Dienst sieht Mail und PDF kurz im Klartext und wird damit Verantwortlicher und Angriffsziel.
- **B:** Stärkste Seite ist der Datenschutz: Der Relay speichert nur Chiffrat, den Schlüssel kennen nur die beiden Geräte. Schwächste Seite: Jedes Billett muss von Hand geteilt werden, und auf iOS fehlt das Share Target ganz.
- **C:** Stärkste Seiten sind Datenschutz und Kosten (kein Server, kein Konto). Schwächste Seite ist die Zulässigkeit: Der Code wird neu gezeichnet, und Codes aus der App wechseln womöglich alle 15 Sekunden.

A und B liegen fast gleichauf. Den Ausschlag gibt der erste Prüfpunkt: Was steht in der echten SBB-Mail?

**Empfehlung.** Variante A passt am besten zum Auftrag «einfach, automatisch, mit Konto bei unserem Dienst». Gebaut wird sie erst, wenn drei Punkte geklärt sind: (1) zwei bis drei echte SBB-Bestätigungsmails (mit Login und als Gast): PDF-Anhang oder nur Link, und braucht der Link ein Login? (2) läuft `HttpURLConnection` und `javax.crypto` auf LightOS? (3) Name ohne «SBB» und Rückfrage bei Light, ob die Tool Library einen fremden Server zulässt. Der kleinste prüfbare Schritt ist ein Worker, der weitergeleitete Mails annimmt, nur ihre Struktur meldet (Anhang, Link, DKIM) und nichts speichert. Danach folgt der gemeinsame Kern von A und B: Relay, Verschlüsselung, Abholung im Tool. Die Upload-Seite aus B wird gleich mitgebaut, als Rückfall für Mails mit nur einem Link und für Personen ohne Mailregel (rund 2 Personentage mehr). Enthält die SBB-Mail nur einen Link mit Login, fällt A weg und B wird Hauptweg.

**Warum nicht zuerst:**

- **B:** verlangt pro Billett Handarbeit und ist auf iOS holprig; trifft den gewünschten automatischen Weg nur halb.
- **C:** ein neu gezeichneter Code trägt ohne schriftliche Zusage der SBB nicht; eine Ablehnung bei der Kontrolle trägt die reisende Person.

Kritische Hinweise des Bewerters: Die Verschlüsselung in A ist kein echtes Ende-zu-Ende. Holt der Server Links von sbb.ch automatisch ab, entsteht ein eigenes AGB-Risiko; besser lädt dann das Tool selbst. B unterschätzt, wie viel Einfachheit auf iOS ohne Share Target fehlt. C erfüllt «automatisch» nicht.

---

## 4. Störungsmeldungen

**Kurz:** Den «Schlüssel» zur Störungsmeldung liefert **SIRI-SX (VDV736)** von opentransportdata.swiss. Dort sind die betroffenen Haltestellen als SLOID und die Linien maschinenlesbar angegeben, und die Texte gibt es in mehreren Grössen. Der API-Schlüssel läuft auf den Inhaber und erlaubt nur 2 Abrufe pro Minute. Deshalb holt ein kleiner Zwischendienst die Meldungen einmal pro Minute für alle Nutzer ab. Das Tool fragt nur diesen Dienst ab. Im APK steckt kein Schlüssel.

### 4.1 Quellen im Vergleich

| Quelle | Format | Inhalt | Kontingent | Registrierung / Kosten |
|---|---|---|---|---|
| **SIRI-SX Unplanned** (`api.opentransportdata.swiss/la/siri-sx-unplanned`) | XML (SIRI-SX/VDV736, CH-Profil) | Alle laufenden Ereignisse im Schweizer ÖV. Texte mit `xml:lang` und in den Grössen S/M/L (`TextualContentSize`). Haltestellen als `StopPointRef` (`ch:1:sloid:8202`), ausländische als UIC-Nummer. Linien als `LineRef`. Welche Sprachen tatsächlich kommen: **ungeprüft**. | 2 pro Minute, 3 000 pro Tag | API Manager, gratis |
| **SIRI-SX Planned** (`…/la/siri-sx`) | XML, gross | Geplante Ereignisse, z. B. Bauarbeiten | 10 pro Stunde, 48 pro Tag | wie oben |
| **GTFS-RT Service Alerts** (`…/la/gtfs-sa`) | Protobuf (JSON nur zum Testen) | Texte DE, FR, IT, EN; `stopId` als SLOID, `routeId`; Vorschau 3 Stunden | 5 pro Minute laut Limits-Seite, «maximal zwei pro Minute» laut Cookbook (**Widerspruch**) | wie oben |
| **data.sbb.ch «Rail traffic information»** | JSON, RSS, Atom | Nur SBB-Bahn, alle 5 Minuten; nur Freitext mit Titel, Zeitraum, Link; **keine Haltestellen- oder Linien-IDs**; im Test kam trotz `lang=de` Englisch | Header `x-ratelimit-limit: 6000` pro Tag (ob pro IP: **ungeprüft**) | **ohne Schlüssel**, gratis, Quellenangabe «data.sbb.ch» |
| **transport.opendata.ch** | JSON | keine Felder für Störungen | – | ohne Schlüssel |
| HRDF, «Ereignisdaten» | – | HRDF ist Soll-Fahrplan; «Ereignisdaten» ist im Katalog derselbe SIRI-SX-Dienst | – | – |

Quellen: [Limits and costs](https://opentransportdata.swiss/en/limits-and-costs/) (gelesen 15.11.2026), [Cookbook SIRI-SX](https://opentransportdata.swiss/de/cookbook/siri-sx/), [Cookbook GTFS-SA](https://opentransportdata.swiss/en/cookbook/gtfs-sa/), [Realisierungsvorgabe SIRI-SX CH v1.0](https://www.tp-info.ch/sites/default/files/2024-07/realization_guide_siri-sx_oev_schweiz_v1.0.pdf), [data.sbb.ch rail-traffic-information](https://data.sbb.ch/explore/dataset/rail-traffic-information), [Bedingungen data.sbb.ch](https://data.sbb.ch/conditions), [transport.opendata.ch](https://transport.opendata.ch/docs.html).

**Ganz ohne Schlüssel** geht es nur mit data.sbb.ch: zulässig (offizielle API, kein Scraping), aber nur SBB-Bahn und nur Freitext. Ein Hinweis an der Verbindung wäre nur über unsicheren Textabgleich möglich. Die Webseite sbb.ch/…/verkehrsinformationen lesen wir nicht maschinell aus (Scraping). Das Cookbook rät, `Affects` «noch nicht» zu verwenden; wie zuverlässig die SLOID-Angaben sind, ist im Betrieb zu prüfen (**ungeprüft**).

### 4.2 Empfehlung Schnittstelle

Hauptquelle **SIRI-SX Unplanned**, jede Minute abgefragt (1 440 von 3 000 pro Tag), dazu **SIRI-SX Planned** einmal pro Stunde (24 von 48). So empfiehlt es auch das Cookbook. Gründe: ganzer Schweizer ÖV; Haltestellen als SLOID, die Nummer entspricht der DIDOK-Nummer ohne «85» und passt damit zu den Stations-IDs von transport.opendata.ch (Abbildung **ungeprüft**, im Dienst mit einer atlas-Liste absichern); Textgrösse S passt zum Bildschirm. Mit 2 Abrufen pro Minute reicht das Kontingent nur für **einen** zentralen Abruf; direkte Abrufe aus jedem Gerät sind ausgeschlossen. GTFS-SA ist Rückfallquelle, data.sbb.ch Notlösung ohne Dienst (nur Liste, kein Hinweis an der Verbindung).

### 4.3 Zwischendienst ohne Schlüssel im APK

```
Cron (jede Minute) ─► Worker ─GET+Bearer(Secret)─► SIRI-SX Unplanned
                         │  XML parsen, nur aktive Meldungen, Text S/M (de, fr, it, en)
                         ▼
                Speicher: {stand, meldungen[], index: sloid→[id], linie→[id]}
                         ▲
Tool ──GET /alerts?stops=8507000,8503000 ──► Worker liest Speicher, filtert
     ◄── {stand:"10:42", quelle:"opentransportdata.swiss", meldungen:[…]} (≤ 2 KB)
Tool ──GET /alerts/summary ──► die 10 neuesten Meldungen für die Liste
```

- **Schlüssel** als Worker-Secret beim Dienst, weder im Repo noch im APK.
- **Missbrauchsschutz:** höchstens 10 Haltestellen pro Anfrage; nur Ausschnitte, keine Rohdaten; Rate Limit pro IP (Rate-Limiting-Bindung, im Free-Plan **ungeprüft**); `Cache-Control: max-age=60`.
- **Keine Nutzerdaten:** keine Logs mit Haltestellen, keine Nutzer-ID, kein Billett.
- **Aktualität:** Feld `stand` bis ins Tool; älter als 5 Minuten → «Störungsinfo veraltet».
- **Quellenangabe** «opentransportdata.swiss» in jeder Antwort und im Info-Bildschirm.
- **Alternativen** zu Cloudflare: Deno Deploy (Deno KV, `Deno.cron`), Fly.io, eigener VPS. Alle machbar; Preise **ungeprüft**; ein VPS braucht am meisten Pflege.

### 4.4 Kosten, Bedingungen, Aufwand, Risiken

**Kosten** ([Workers-Limits](https://developers.cloudflare.com/workers/platform/limits/), [Preise](https://developers.cloudflare.com/workers/platform/pricing/), [KV-Limits](https://developers.cloudflare.com/kv/platform/limits/)):

- **Free-Plan:** 100 000 Requests pro Tag, 5 Cron Triggers, **10 ms CPU pro Aufruf**, KV **1 000 Schreibvorgänge pro Tag**. Ein Schreibvorgang pro Minute (1 440/Tag) liegt **über dem Limit**; Ausweg: nur bei Änderung schreiben. Das XML in 10 ms zu parsen ist unwahrscheinlich (**ungeprüft**).
- **Workers Paid: USD 5 pro Monat**, mit 10 Mio. Requests, 30 Mio. CPU-ms, 1 Mio. KV-Schreibvorgängen pro Monat. Deckt das Projekt voll ab. **Empfohlen.**
- **Domain:** `*.workers.dev` gratis; eigene Domain rund CHF 10 bis 20 pro Jahr (**ungeprüft**).
- **opentransportdata.swiss:** gratis innerhalb des Kontingents.

**Bedingungen** ([Terms of use](https://opentransportdata.swiss/en/terms-of-use/)): Daten dürfen «processed, analysed and published» werden, Weitergabe über einen eigenen Dienst ist nach unserer Lesart zulässig. Quellenangabe Pflicht (Ziffer 5.1). Aktualisierung so oft wie die Rohdaten (5.2), mit Abruf pro Minute erfüllt. Die SBB kann den Schlüssel sperren; wiederholtes Überschreiten kann zu einem kostenpflichtigen Vertrag führen. Eine ausdrückliche Klausel «personengebunden» fehlt (**ungeprüft**, ob der API Manager etwas sagt); der Schlüssel läuft auf das Konto des Inhabers.

**Aufwand:**

| Teil | Personentage |
|---|---|
| Worker mit Parser, Index, Endpunkten | 2 bis 3 |
| Tests mit gespeicherten XML-Beispielen | 1 |
| `ProxySource` und Anzeige im Tool | 1,5 bis 2 |
| Betrieb, Monitoring, Doku | 0,5 |
| **Total** | **5 bis 6,5** |

**Risiken:** `Affects` laut Cookbook noch nicht empfohlen, Hinweise an der Verbindung können fehlen (dann nur Liste). Kontingente «subject to change». Schlüssel gesperrt → alle Nutzer zugleich ohne Störungsinfo. Änderungen am CH-Profil brechen den Parser. Fällt der Dienst aus, läuft das Tool ohne Störungsinfo weiter; Fahrplan bleibt über transport.opendata.ch.

### 4.5 Was es vom Inhaber braucht

1. **Entscheid** für den Zwischendienst und die Plattform (Empfehlung: Cloudflare Workers Paid, USD 5 pro Monat).
2. **Registrierung** im [API Manager](https://api-manager.opentransportdata.swiss/) (gratis), Abo für SIRI-SX Unplanned und Planned; den Schlüssel hinterlegt der Inhaber selbst als Worker-Secret.
3. **Cloudflare-Konto** und gegebenenfalls Domain.

Bis dahin lassen sich Parser und `ProxySource` gegen gespeicherte Beispieldaten vorbereiten.

---

## 5. Reihenfolge nach dem Go

| Schritt | Was | Ergebnis | Braucht vom Inhaber |
|---|---|---|---|
| 0 | Zwei bis drei echte SBB-Bestätigungsmails ansehen (mit Login, als Gast): Anhang, Link oder Bild? | Entscheid A als Hauptweg oder B | Mails weiterleiten oder zeigen |
| 1 | Probe auf Gerät/Emulator: `HttpURLConnection`, `javax.crypto` | belegt oder verworfen | – |
| 2 | Worker «Mail-Probe»: nimmt Mails an, meldet nur Struktur und DKIM, speichert nichts | Format belegt | Cloudflare-Konto |
| 3 | Gemeinsamer Kern: Relay (R2), Kopplung, Verschlüsselung, Abholung im Tool | Billett kommt ohne Computer | – |
| 4 | A: Mail-Eingang; B: Upload-Seite und Share Target | beide Wege | Datenschutzerklärung freigeben |
| 5 | Störungen: Worker mit SIRI-SX, `ProxySource` im Tool | Hinweis an der Verbindung | Schlüssel im API Manager |

Schritt 5 ist unabhängig von 0 bis 4 und kann zuerst kommen, wenn der
Inhaber Störungen höher gewichtet.

## 6. Entscheide für den Inhaber

1. **Billett-Import:** Go für Variante A mit Upload-Seite aus B als Rückfall
   (Empfehlung), oder nur B, oder beim heutigen Weg über den Computer bleiben.
2. **Störungen:** Go für den Zwischendienst mit SIRI-SX auf Cloudflare
   Workers (USD 5 pro Monat), oder ohne Störungen.
3. **Name** ohne «SBB» (KONZEPT Frage 1), bevor ein Dienst mit Adresse oder
   Teilen-Menü live geht.
