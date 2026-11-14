# Konzept: Fahrplan und Tickets auf dem Light Phone

Stand: 14.11.2026. Auftrag des Inhabers: ein ausgereiftes Konzept, wie eine
Person mit Light Phone möglichst viel von dem nutzen kann, was die SBB-App und
der Fahrplan bieten, und wie ein bereits gekauftes Ticket aufs Gerät kommt und
vorgezeigt wird. Tickets werden **nicht gekauft**, nur abgelegt und gezeigt.

Lesehilfe: Aussagen mit Quelle sind belegt (Link). Was nicht an einer Quelle
geprüft ist, steht mit **«ungeprüft»** dabei. Name, Veröffentlichung und Kanal
sind Entscheide des Inhabers und stehen nur als Fragen in Abschnitt 7.

---

## Kurzfassung

- **Light Phone III** ist das Zielgerät. Es hat keinen Browser, die PWA läuft
  dort also nicht. Der Weg ist ein natives Tool mit dem offiziellen
  [light-sdk](https://github.com/lightphone/light-sdk) (Kotlin/Compose). Der
  Ordner `light-tool/` enthält dafür ein Gerüst, das noch nie gebaut wurde.
- **Light Phone II** kann keine Tools von Dritten ausführen. Für diese
  Nutzer bleiben nur Wege ohne eigene Software (SwissPass-Karte, Ausdruck)
  oder ein SMS-Dienst mit eigenem Server (Entscheid, Abschnitt 7).
- **Fahrplan:** Verbindungen, Abfahrten, Gleis und Verspätung gehen heute schon
  über `transport.opendata.ch` (ohne Schlüssel). Störungsmeldungen und
  Zugformation brauchen opentransportdata.swiss mit API-Schlüssel; ein
  Schlüssel gehört nicht in ein quelloffenes APK. Das ist die zentrale
  Architekturfrage.
- **Ticket:** Die robusteste Form ist das **Original-PDF** des SBB-Billetts,
  auf dem Gerät gerendert (ganze Seite plus vergrösserter QR-Code). Ein
  Bild nur des QR-Codes (heutiger Stand) ist schwächer belegt. Für Light Phone II
  und als Rückfallebene: Billett **auf die SwissPass-Karte laden**.
- **Datenschutz:** Ticket und Ausweisdaten bleiben auf dem Gerät. Übertragung
  per USB oder im eigenen WLAN, kein fremder Server.
- **Etappen 1 bis 8**, jede klein und prüfbar (Abschnitt 6).

---

## 1. Ist-Stand des Repos

Geprüft am 14.11.2026 am Stand `main` (Merge von PR #2, `16b600d`).

| Teil | Was es ist | Stand |
|------|-----------|-------|
| Wurzel: `index.html`, `app.js` (381 Zeilen), `styles.css`, `sw.js`, `manifest.webmanifest` | PWA ohne Abhängigkeiten | lauffähig; GitHub Pages liefert `https://brunokuratli.github.io/lightTicket/` aus (HTTP 200, letzter Deploy-Lauf erfolgreich am 21.07.2026) |
| `light-tool/` | natives Light-Phone-III-Tool (Kotlin/Compose, Paket `com.lightticket.sbb`) | **Gerüst, nie kompiliert** (so steht es in `light-tool/README.md`) |
| `ANLEITUNG.md`, `docs/SBB-Light-Anleitung.pdf` | Anleitung PWA und Sideload | vorhanden |
| `.github/workflows/deploy-pages.yml` | Veröffentlichung der PWA bei jedem Push auf `main` | aktiv |

### Was schon geht (PWA, und im Code des Tools gleich angelegt)

- **Verbindungen** A nach B mit Datum, Zeit, Ab/An; Abfahrt, Ankunft, Dauer,
  Umstiege, Linien, **Gleis der Abfahrt**, **Verspätung** der Abfahrt.
- **Abfahrtstafel** einer Haltestelle (14 Abfahrten, Linie, Ziel, Gleis,
  Verspätung).
- **Haltestellen-Vorschläge** beim Tippen.
- **Ticket-Ablage:** Titel, Gültigkeit, Notiz und **ein Bild** (Screenshot oder
  Foto des Barcodes). Speicher: IndexedDB (PWA) bzw. privater App-Speicher
  (Tool). Nichts verlässt das Gerät.
- **Vorzeigen:** Vollbild, Bildschirm bleibt wach (Wake Lock bzw.
  `FLAG_KEEP_SCREEN_ON`).
- **Offline:** App-Hülle und Tickets offline (Service Worker), Fahrplan nur
  online.

### Was nicht geht

- **Light Phone III kann die PWA nicht öffnen** (kein Browser, siehe
  Abschnitt 3). Die PWA hilft nur Personen mit einem zweiten Gerät.
- **Das native Tool ist nicht gebaut**, nicht getestet und nicht auf einem
  Gerät gelaufen. `lighttool.toml` und `build.gradle.kts` sind laut eigenem
  Kommentar «an die SDK-Version anzupassen».
- **Keine PDF-Tickets:** Der Import nimmt nur Bilder (`PickVisualMedia`,
  `ImageOnly`). Das SBB-Billett kommt aber als PDF (Abschnitt 5).
- Keine **Verbindungsdetails** (Zwischenhalte, Umsteigegleise, Ankunftsgleis
  pro Teilstrecke), keine **Gleisänderung** als solche erkennbar.
- Keine **Störungsmeldungen**, keine **Zugformation** (Sektor, 1./2. Klasse).
- Keine **Favoriten**, kein **Heimweg**, keine gespeicherten Suchen.
- **Kein Offline-Fahrplan**, keine Anzeige der letzten Ergebnisse ohne Netz.
- Keine **Quellenangabe** «Timetable data: opentransportdata.swiss» in der UI,
  die der Betreiber der API erbittet
  ([Dokumentation](https://transport.opendata.ch/docs.html)).
- README nennt den Barcode «Aztec». Die SBB-AGB sprechen beim Weiterleiten von
  einem **QR-Code** (Abschnitt 5). Welcher Code auf welchem Billett steht:
  **ungeprüft** (vermutlich QR bei Inlandbilletten, Aztec bei internationalen
  Billetten nach UIC, **ungeprüft**).

---

## 2. Was ein Light-Phone-Nutzer braucht

Ausgangslage: Wer ein Light Phone wählt, will wenig Bildschirmzeit. Das Tool
muss also mit **möglichst wenigen Tipps** die eine Frage beantworten, die gerade
ansteht. Reihenfolge nach Wichtigkeit unterwegs:

| # | Bedürfnis | Was das Tool zeigt | Daten | Heute |
|---|-----------|--------------------|-------|-------|
| 1 | **Ticket vorzeigen** | ein Tipp vom Startbildschirm, ganze Seite, QR gross, Bildschirm hell und wach | lokal | Bild ja, PDF nein |
| 2 | **Heimweg** | ein Knopf: nächste 3 Verbindungen vom nächsten Halt (oder vom zuletzt gewählten) nach «Zuhause» | Verbindungen | nein |
| 3 | **Abfahrten** | nächste Abfahrten an einer Favoriten-Haltestelle, mit Gleis und Verspätung | Abfahrtstafel | ja (ohne Favoriten) |
| 4 | **Verbindung** | A nach B, Ab/An; Detail mit Umsteigeort, Umsteigezeit, Gleis an jedem Halt | Verbindungen | ohne Detail |
| 5 | **Echtzeit** | Verspätung, Ausfall, **Gleisänderung** deutlich markiert; Aktualisieren von Hand, nicht im Dauertakt | Echtzeit | Verspätung ja |
| 6 | **Störungen** | Hinweis an der Verbindung, wenn eine Meldung die Strecke betrifft; kurze Liste der aktuellen Meldungen | SIRI-SX / GTFS-RT Service Alerts | nein |
| 7 | **Gleis und Sektor** | Gleis immer; Sektor und Klasse, wenn Formationsdaten da sind | Formation | Gleis ja |
| 8 | **Favoriten** | 3 bis 5 Strecken und Haltestellen, auf dem Startbildschirm | lokal | nein |
| 9 | **Offline** | Tickets immer; letzte Suchergebnisse und Heimweg mit Zeitstempel «Stand 07:42»; klarer Hinweis, dass Echtzeit fehlt | lokal | nur Tickets |

Bewusst **nicht** im Umfang: Kauf, Preise, Konto, Push-Werbung, Karten,
Reisebegleiter mit Dauer-Ortung. Push-Meldungen für Verspätung auf einer
gemerkten Verbindung wären möglich (das SDK soll Push können, siehe
Abschnitt 3), brauchen aber einen Server; daher spätere Etappe und Entscheid.

---

## 3. Grenzen des Light Phone

### Light Phone III

| Punkt | Angabe | Quelle |
|-------|--------|--------|
| Bildschirm | 3,92 Zoll, AMOLED, monochrom (Graustufen), 1080 × 1240 Pixel, rund 419 ppi | [Wikipedia](https://en.wikipedia.org/wiki/Light_Phone_III), [PhoneScoop](https://www.phonescoop.com/phones/phone.php?p=7252) |
| Browser | keiner; «Notably absent are any general-purpose web browsers» | [Wikipedia](https://en.wikipedia.org/wiki/Light_Phone_III) |
| Betriebssystem | LightOS, auf einem reduzierten Android ohne Google-Dienste | [Wikipedia](https://en.wikipedia.org/wiki/Light_Phone_III); Emulator-Vorgabe API 34 ohne Play Services: [light-sdk](https://github.com/lightphone/light-sdk) |
| Eingebaute Tools | u. a. Telefon, Nachrichten, Kamera, Album, Kalender, Notizen, Directions, Hotspot, Musik, Podcasts | [Wikipedia](https://en.wikipedia.org/wiki/Light_Phone_III) |
| Kamera | 50 MP hinten; vorne 8 MP, beim Start deaktiviert | [Wikipedia](https://en.wikipedia.org/wiki/Light_Phone_III) |
| NFC | Hardware vorhanden, ohne Funktion | [Wikipedia](https://en.wikipedia.org/wiki/Light_Phone_III) |
| Speicher | 128 GB, 6 GB RAM | [PhoneScoop](https://www.phonescoop.com/phones/phone.php?p=7252) (Sekundärquelle) |
| E-Mail | keine | [Wikipedia](https://en.wikipedia.org/wiki/Light_Phone_III) (keine Mail-App in der Tool-Liste); Mail-Tools von Dritten werden «eventuell nicht freigegeben» ([WIRED](https://www.wired.com/story/exclusive-light-phone-developer-kit/)) |
| App Store | keiner. Stattdessen eine kuratierte, nicht kommerzielle, quelloffene «Tool Library» | [Engadget, 30.04.2026](https://www.engadget.com/2161468/the-minimalist-light-phone-iii-will-soon-support-a-curated-set-of-third-party-apps/), [WIRED](https://www.wired.com/story/exclusive-light-phone-developer-kit/) |

**Entwicklung von Tools (light-sdk):**

- Kotlin, Compose, Coroutines, MVVM. Light **schränkt ein, welche
  Android-APIs und Bibliotheken** benutzt werden dürfen; Wünsche nach
  weiteren Bibliotheken nimmt Light entgegen
  ([light-sdk](https://github.com/lightphone/light-sdk)).
- Tools müssen **quelloffen** sein; Light baut und signiert sie aus einem
  öffentlichen Git-Commit. Einreichen über ein Entwicklerkonto im Light-Dashboard,
  mit Git-Ref und Changelog; die **Paket-ID ist eindeutig und später nicht
  änderbar** ([light-sdk](https://github.com/lightphone/light-sdk)).
- Nutzer wählen zwischen drei Stufen: von Light freigegebene Tools, mit dem
  SDK gebaute Tools, beliebige Tools. Nicht von Light signierte Tools lassen
  sich nur nach einem Hinweis auf Datenschutz- und Leistungsrisiken
  installieren ([light-sdk](https://github.com/lightphone/light-sdk)).
- Das SDK soll mit Erlaubnis der Person Zugriff auf **Fotos, Videos, Audio
  und andere Dateien** und auf **Push-Mitteilungen** geben
  ([Engadget](https://www.engadget.com/2161468/the-minimalist-light-phone-iii-will-soon-support-a-curated-set-of-third-party-apps/)).
  Ob Datei-Auswahl (Storage Access Framework), «Teilen an»-Intents, Kamera-API
  und `PdfRenderer` in Tools erlaubt sind: **ungeprüft**, erst im SDK-Fork
  nachzuweisen (Etappe 1).
- Stand laut SDK-README («July 1, 2026 Update»): Die Verteil-Infrastruktur sei
  noch im Aufbau, aktuelle LightOS-Builds «not yet ready to play nice» mit
  SDK-Tools; empfohlen sind Emulator oder ADB-Sideload. Ob sich das seither
  geändert hat und ob die Tool Library wie angekündigt im Herbst 2026
  gestartet ist: **ungeprüft**.
- Dateien aufs Gerät: Fotos laufen laut einem Test über USB mit
  «Media Transfer»; eine Synchronisation über das Web-Dashboard sei geplant
  ([WIRED-Test, Spiegel](https://wirednews.pages.dev/review/light-phone-iii),
  Datum **ungeprüft**). Über das Dashboard lassen sich Musik und Kontakte
  hochladen ([Engadget-Test](https://www.engadget.com/light-phone-iii-review-minimalism-stretched-to-the-point-of-frustration-141559294.html)).
  Ob Tools eigene Inhalte über das Dashboard bekommen können: **ungeprüft**.

**Folgen für das Konzept:** natives Tool statt Web; grosse Schrift, schwarzer
Grund, wenig Elemente (monochromes OLED); nur Bibliotheken, die Android
mitbringt (`HttpURLConnection`, `org.json`, `PdfRenderer`), jede weitere bei
Light anfragen; Paket-ID vor der ersten Einreichung festlegen.

### Light Phone II

| Punkt | Angabe | Quelle |
|-------|--------|--------|
| Bildschirm | 2,84 Zoll E-Ink, schwarz-weiss; Auflösung je nach Quelle 600 × 480 oder 640 × 480 (**ungeprüft**, welche stimmt) | [MobileRead](https://wiki.mobileread.com/wiki/Litephone_2), [Wikipedia](https://en.wikipedia.org/wiki/Light_Phone_II) |
| Browser, App Store | keine | [The Privacy Dad](https://theprivacydad.com/light-phone-2-review/) |
| Tools von Dritten | **nicht möglich**; Tools von Dritten nur auf dem neuesten Gerät | [WIRED](https://www.wired.com/story/exclusive-light-phone-developer-kit/) |
| Was es kann | Telefon, SMS, Hotspot, Directions, Musik, Podcasts, Notizen u. a. | [MobileRead](https://wiki.mobileread.com/wiki/Litephone_2) |

**Folge:** Für das Light Phone II gibt es kein Tool. Möglich sind nur:
(a) Billett auf die **SwissPass-Karte** laden oder **A4-Ausdruck**
(Abschnitt 5); (b) ein **SMS-Dienst** («Bern Zürich 17:00» an eine Nummer,
Antwort mit drei Verbindungen). (b) braucht einen Server, eine SMS-Nummer mit
laufenden Kosten und verarbeitet Reisedaten auf einem Server; daher nur als
Frage an den Inhaber (Abschnitt 7). Ein E-Ink-Bildschirm von 2,84 Zoll ist für
das Vorzeigen eines Billetts ohnehin ungeeignet (Lesbarkeit für Scanner
**ungeprüft**).

---

## 4. Datenquellen und Rechte

### 4.1 transport.opendata.ch (heute im Einsatz)

- Inoffizielle API von Opendata.ch für den Schweizer öV, gespeist aus dem
  nationalen Fahrplan und den Echtzeitdaten von opentransportdata.swiss
  ([Startseite](https://transport.opendata.ch/),
  [Dokumentation](https://transport.opendata.ch/docs.html)).
- Endpunkte `/locations`, `/connections`, `/stationboard`. **Kein Schlüssel**
  nötig, **CORS** aktiv.
- **Kontingent:** «There is no fixed limit per client.» Antworten sollen
  zwischengespeichert werden; wer dieselbe Anfrage alle paar Sekunden stellt,
  wird gedrosselt ([Dokumentation](https://transport.opendata.ch/docs.html)).
- **Quellenangabe** erbeten: «Timetable data: opentransportdata.swiss».
- Kein Vertrag, keine Zusage zur Verfügbarkeit (Betrieb durch einen Verein,
  Verfügbarkeitszusage **ungeprüft**). Störungsmeldungen und Formation liefert
  diese API nach unserem Stand nicht (**ungeprüft** im Detail; im Code werden
  sie nicht abgefragt).

### 4.2 opentransportdata.swiss (offizielle Plattform)

Betrieben von der SBB im Auftrag des Bundesamts für Verkehr
([Nutzungsbedingungen](https://opentransportdata.swiss/en/terms-of-use/)).
Übersicht der Dienste: [Cookbook](https://opentransportdata.swiss/en/cookbook/).
Schlüssel gibt es im [API Manager](https://api-manager.opentransportdata.swiss/)
([Anleitung](https://opentransportdata.swiss/en/cookbook/development-miscellaneous-cookbook/howto-access-apis/)).

| Dienst | Zweck für uns | Schlüssel | Kontingent je Schlüssel |
|--------|---------------|-----------|-------------------------|
| **OJP 2.0** (Open Journey Planner) | Verbindungen, Abfahrten, Haltestellen, Zwischenhalte | ja | 50 pro Minute, 20 000 pro Tag (gratis); 2 500/min und 1 Mio./Tag für CHF 500 pro Monat; 5 000/min und 2 Mio./Tag für CHF 1 000 pro Monat |
| **OJPFare** | Preise (nicht im Umfang) | ja | wie OJP |
| **Train Formation Service** | Sektor, Klasse, Wagenreihung | ja | 50/min, 20 000/Tag |
| **GTFS-RT**, **GTFS-RT Service Alerts** | Echtzeit und Störungen als Gesamtfeed | ja | 5 pro Minute |
| **SIRI-SX Unplanned** | ungeplante Störungen | ja | 2 pro Minute, 3 000 pro Tag |
| **SIRI-SX Planned** | geplante Einschränkungen (Bau) | ja | 10 pro Stunde, 48 pro Tag |
| **GTFS statisch**, weitere Dateien | Fahrplan als Datei (Offline-Grundlage) | nein (Dateien ohne Registrierung) | keine Angabe |

Quelle der Zahlen: [Limits and costs](https://opentransportdata.swiss/en/limits-and-costs/)
(gelesen am 14.11.2026; «Limits and costs subject to change»). Endpunkt
Formation: `api.opentransportdata.swiss/formation/v1/…`
([opendata.swiss](https://ckan.opendata.swiss/dataset/formationsdaten)).

**Nutzungsbedingungen, das Wesentliche**
([Terms of use](https://opentransportdata.swiss/en/terms-of-use/)):

- Daten dürfen verarbeitet und veröffentlicht werden, auch als Teil einer
  Anwendung. Eine ausdrückliche Aussage zu kommerzieller Nutzung fehlt;
  unser Tool ist nicht kommerziell (Kommerzfrage damit **ungeprüft**, aber
  für uns nicht tragend).
- **Quellenangabe** «opentransportdata.swiss» ist Pflicht.
- Daten müssen so oft aktualisiert werden wie die Rohdaten.
- Für Dienste braucht es Registrierung und Zugangsschlüssel; die SBB kann ihn
  **sperren**, wiederholtes Überschreiten des Kontingents kann zu einem
  kostenpflichtigen Vertrag führen.
- Keine Haftung der SBB für Richtigkeit oder Verfügbarkeit.
- Schweizer Recht, Gerichtsstand Bern, die deutsche Fassung gilt.

**Folge für die Architektur (wichtig):** Ein Schlüssel ist an die Person
oder Firma gebunden, die ihn beantragt. In einem **quelloffenen** Tool, das
Light aus einem öffentlichen Commit baut, wäre ein eingebauter Schlüssel
öffentlich. Ausserdem teilen sich alle Nutzer das Kontingent eines Schlüssels
(20 000 OJP-Anfragen pro Tag; SIRI-SX nur 2 pro Minute). Drei Wege:

1. **Ohne Schlüssel bleiben:** Verbindungen, Abfahrten, Gleis, Verspätung über
   transport.opendata.ch. Keine Störungen, keine Formation. Kein Server.
2. **Eigener Schlüssel je Nutzer:** Person trägt ihren eigenen Schlüssel im
   Tool ein. Kein Server, aber eine Registrierung, die für die Zielgruppe zu
   schwer ist.
3. **Kleiner eigener Zwischendienst:** holt SIRI-SX und Formation mit einem
   Schlüssel, speichert zwischen (z. B. Störungen einmal pro Minute für alle),
   gibt nur die nötigen Ausschnitte weiter. Kein Ticket und keine Person geht
   darüber, nur Haltestellen- oder Zugnummern. Braucht Betrieb, Kosten und
   einen Schlüssel auf den Betreiber. **Entscheid des Inhabers.**

Empfehlung: Etappen 1 bis 5 mit Weg 1. Störungen und Formation erst nach
einem Entscheid für Weg 3.

### 4.3 Weitere

- **SBB-App und SBB-Webshop:** keine öffentliche API für Kauf oder
  Ticketabruf (so schon im README festgehalten; heutiger Stand **ungeprüft**).
  Kein Scraping, kein Anmelden mit dem SwissPass-Login im Tool.
- **Marke und Name «SBB»:** Das Tool heisst heute «SBB Light», die Paket-ID
  lautet `com.lightticket.sbb`. Die Nutzungsbedingungen von
  opentransportdata.swiss regeln die Marke nicht. Ob und wie der Name «SBB»
  verwendet werden darf, ist hier **nicht geprüft und nicht entschieden**;
  siehe Frage in Abschnitt 7.

---

## 5. Ticket aufs Gerät bringen und vorzeigen

### 5.1 Welche Formen es gibt

| Form | Woher | Belegt |
|------|-------|--------|
| **PDF-Billett** | Webshop SBB.ch (Profil «Bestellungen anzeigen» oder Bestätigungs-Mail, dort Billett oder Download-Link); auch in SBB Mobile, wenn mit demselben SwissPass-Login gekauft | [SBB-Hilfe Online-Kauf](https://www.sbb.ch/de/hilfe-und-kontakt/produkte-services/billette/schweiz/billette.html) |
| **Billett in SBB Mobile** (Bildschirm-Billett mit QR-Code) | App | [SBB-Hilfe](https://www.sbb.ch/de/hilfe-und-kontakt/produkte-services/billette/schweiz/billette.html) |
| **QR-Code weitergeleitet** | aus der App per WhatsApp, iMessage, SMS, E-Mail an Dritte, zulässig «sofern die Bestimmungen zur Ausweispflicht respektiert werden» | [AGB Kauf Webshop](https://www.sbb.ch/de/meta/legallines/agb-kauf-webshop.html) |
| **Apple Wallet** | aus der App | [AGB Kauf Webshop](https://www.sbb.ch/de/meta/legallines/agb-kauf-webshop.html); für Light Phone ohne Nutzen |
| **Auf SwissPass-Karte geladen** | am SBB-Automaten seit Mitte September 2025; Kontrolle scannt die Karte; Laden über SBB.ch wird laut Bericht nicht umgesetzt | [Blick](https://www.blick.ch/schweiz/neue-funktion-auf-swisspass-laden-diese-unsichtbaren-sbb-billette-verunsichern-oev-passagiere-id21838568.html), [Beobachter](https://www.beobachter.ch/konsum/reisen/unsichtbare-sbb-billette-irritieren-passagiere-920860) |
| **Abo auf SwissPass** (GA, Halbtax, Verbund) | Karte; SwissPass Mobile in der App, Karte oder Ausweis trotzdem mitführen | [SBB SwissPass Mobile](https://www.sbb.ch/de/angebote/swisspass-karte-mobile), [SBB Community](https://community.sbb.ch/d/1756-sind-pass-oder-ausweiskopien-bei-der-fahrausweiskontrolle-akzeptiert) |
| **A4-Ausdruck** | Webshop-PDF | [AGB Kauf Webshop](https://www.sbb.ch/de/meta/legallines/agb-kauf-webshop.html) |

### 5.2 Was bei der Kontrolle gilt

Aus den [AGB Kauf Webshop](https://www.sbb.ch/de/meta/legallines/agb-kauf-webshop.html)
(belegt, sinngemäss oder wörtlich):

- «Bei der Kontrolle von elektronischen Billetten besteht eine
  Ausweispflicht.» Billette sind personengebunden und nicht übertragbar;
  Ausweis im Original (amtlich; in der Schweiz auch Halbtax oder GA).
- Bildschirm: «das Billett muss auf dem Bildschirm sichtbar oder in einer
  Applikation des Endgerätes verfügbar sein.»
- «Das mobile Endgerät ist – sofern verlangt – dem Kontrollpersonal zur
  Kontrolle der Billette auszuhändigen.»
- Papier: vollständig, A4, 100 % (nicht skaliert); die 12-stellige
  OT-Nummer oben rechts muss lesbar sein; «Nicht einwandfrei lesbare Billette
  sind zur Fahrt ungültig.» Über Fax oder andere Geräte kopierte Billette
  gelten nicht.
- «Die von der SBB zugestellte E-Mail-Bestätigung gilt NICHT als Fahrausweis.»
  (Die Hilfeseite sagt dagegen, das Billett werde «in der Regel direkt in der
  Bestellbestätigungs-E-Mail angezeigt»; gemeint ist dann das Billett selbst,
  nicht der Bestätigungstext. Feinheit **ungeprüft**.)

Nicht belegt bzw. **ungeprüft**:

- Ob ein **Bildschirmfoto nur des QR-Codes** akzeptiert wird. Die AGB
  erlauben das Weiterleiten «als QR-Code», sagen aber nichts zu Screenshots.
  Ein Beitrag in der SBB-Community verneint den «Print-Screen des QR-Codes» und
  verlangt das PDF ([SBB Community](https://sbbcffffs-community.sbb.ch/t5/Abos-und-Billette/Ticket-Billett-in-die-App-importieren/m-p/52394);
  Nutzerbeitrag, keine Regel).
- Ob Prüfgeräte des Kontrollpersonals einen **QR-Code auf einem monochromen
  OLED** des Light Phone III zuverlässig lesen (sehr wahrscheinlich, da
  Schwarz-Weiss, aber **ungeprüft**; Feldtest in Etappe 3).
- Ob ein **neu gezeichneter** QR-Code (aus dem gelesenen Inhalt neu erzeugt)
  gilt. Rechtlich heikel (Nähe zur «Kopie»); wir zeigen **immer die
  Originalpixel bzw. das Original-PDF**, nie eine Neuzeichnung.

**Folge:** Erste Wahl ist das **Original-PDF** auf dem Gerät, als ganze Seite
anzeigbar (OT-Nummer, Name, Gültigkeit lesbar) und mit einem Knopf auf den
QR-Code vergrössert. Zweite Wahl ein Bild des QR-Codes, mit dem Hinweis, dass
es schwächer belegt ist. Rückfallebene ohne Gerät: SwissPass-Karte oder
A4-Ausdruck. Ausweis im Original bleibt immer nötig; das Tool speichert **keine
Ausweisbilder**.

### 5.3 Wie das Ticket aufs Gerät kommt

Das Light Phone III hat **keine E-Mail** und keinen Browser. Deshalb:

| Weg | Ablauf | Server nötig | Bewertung |
|-----|--------|--------------|-----------|
| **A. USB** | Light Phone an den Computer, Dateiübertragung, PDF in `Download/`; im Tool «Ticket hinzufügen», Datei wählen | nein | belegt, dass USB-Übertragung für Fotos geht ([WIRED-Test](https://wirednews.pages.dev/review/light-phone-iii)); Dateiwahl im Tool **ungeprüft**. Erste Etappe. |
| **B. Eigenes WLAN** | Tool zeigt «Empfangen» mit Adresse und Einmal-Code (z. B. `http://192.168.1.23:8080`, Code 4 Ziffern); Person öffnet die Adresse am Laptop oder Handy im selben WLAN oder über den Hotspot des Light Phone und lädt das PDF hoch; Tool beendet den Empfang nach einer Datei oder 5 Minuten | nein | bequem, keine fremde Stelle; ob ein Tool einen lokalen Port öffnen darf: **ungeprüft** (SDK-Einschränkungen) |
| **C. Kamera** | QR-Code vom Bildschirm eines anderen Geräts oder vom Ausdruck abfotografieren, Foto zuschneiden, als Bild ablegen | nein | geht ohne Zweitgerät mit Datei; Bildqualität und Annahme **ungeprüft**; kein Neuzeichnen |
| **D. «Teilen an» / Dateiauswahl aus Album** | Bild aus dem eingebauten Album übernehmen (heutiger Code: Foto-Auswahl) | nein | im Code angelegt; Verhalten auf LightOS **ungeprüft** |
| **E. Light-Dashboard** | Datei im Web-Dashboard für das Tool hochladen | Light | nur, falls Light das für Tools anbietet (**ungeprüft**); Daten liegen dann bei Light |
| **F. Mail-Weiterleitung an einen eigenen Dienst** | Person leitet die SBB-Mail an eine Adresse des Dienstes weiter, Gerät holt das PDF ab | ja (eigener) | Ticket mit Name und Reisedaten liegt auf einem Server; nur mit Ende-zu-Ende-Verschlüsselung und sofortigem Löschen denkbar; **nicht empfohlen**, höchstens als Entscheid |
| **G. MMS/SMS** | QR-Code aus SBB Mobile (Zweitgerät) per SMS an das Light Phone weiterleiten (AGB erlauben das Weiterleiten als QR-Code) | nein | ob Light Phone III Bilder per MMS empfängt und ob ein Tool sie lesen darf: **ungeprüft** |

Empfehlung: A in Etappe 2, B in Etappe 4, C als Zusatz. F nicht bauen ohne
ausdrücklichen Entscheid.

### 5.4 Datenschutz

- Ticket (Name, Strecke, Datum, OT-Nummer) ist eine Personendaten-Sammlung.
  Es bleibt im **privaten App-Speicher**, wird nicht synchronisiert, nicht
  gesichert und nicht übertragen.
- Keine Analyse, kein Absturzbericht an Dritte, keine Werbe- oder
  Tracking-Bibliothek. Das Tool fragt nur die Fahrplan-API an; dabei gehen
  Haltestellennamen und Zeiten an transport.opendata.ch (bzw. später an den
  eigenen Zwischendienst), nie das Ticket.
- Abgelaufene Tickets: Hinweis «abgelaufen» und Löschen auf Knopfdruck;
  automatisch löschen nur, wenn die Person es einschaltet.
- Lokaler Empfang (Weg B) nur auf Knopfdruck, mit Einmal-Code, zeitlich
  begrenzt, nur eine Datei, nur PDF/PNG/JPEG bis 5 MB.
- Ein Datenschutzhinweis gehört in die Tool-Beschreibung; die Tool Library
  verlangt Achtung der Privatsphäre «to the fullest extent»
  ([Engadget](https://www.engadget.com/2161468/the-minimalist-light-phone-iii-will-soon-support-a-curated-set-of-third-party-apps/)).

---

## 6. Architektur und Etappen

### 6.1 Architektur

```
Light Phone III
└─ Tool (Kotlin/Compose, light-sdk, Paket-ID offen)
   ├─ ui/         Start (Ticket · Heimweg · Favoriten), Verbindung, Abfahrten, Ticket-Vollbild
   ├─ timetable/  TimetableSource (Schnittstelle)
   │   ├─ TransportOpendataSource   heute, ohne Schlüssel
   │   └─ ProxySource               später, Störungen + Formation (nur nach Entscheid)
   ├─ cache/      letzte Ergebnisse je Suche, mit Zeitstempel (Offline-Anzeige)
   ├─ favorites/  Strecken, Haltestellen, «Zuhause» (lokal, JSON)
   ├─ tickets/    TicketStore: Original-Datei (PDF oder Bild) + Index
   │   ├─ PdfPageRenderer   android.graphics.pdf.PdfRenderer, keine Fremdbibliothek
   │   └─ LocalReceiver     Empfang im eigenen WLAN (Etappe 4, wenn SDK es erlaubt)
   └─ net/        HttpURLConnection mit Zeitlimit, Drosselung (min. 30 s je gleiche Anfrage)

PWA (Wurzel)  bleibt Referenz für Zweitgeräte; Ausbau nur nach Entscheid.

Optional, nur nach Entscheid:
Zwischendienst  SIRI-SX + Formation mit einem Schlüssel, zwischengespeichert,
                gibt Meldungen je Haltestelle/Zug zurück, speichert keine Anfragen.
```

Grundsätze: eine Quelle hinter einer Schnittstelle, damit OJP oder der
Zwischendienst später ohne Umbau der UI dazukommen; nur Android-Bordmittel;
jede Netzabfrage mit Zeitlimit und Drosselung (Bitte von transport.opendata.ch);
Quellenangabe «Timetable data: opentransportdata.swiss» im Info-Bildschirm.

### 6.2 Etappen

Jede Etappe ist ein eigener Pull Request, endet mit einer prüfbaren Aussage
und braucht kein Konto, keinen Kauf und keinen Schlüssel, ausser wo vermerkt.

| Etappe | Inhalt | Fertig heisst |
|--------|--------|---------------|
| **1. Tool baut** | `light-tool/` in einen Fork des light-sdk einpassen (Werte aus `examples/authenticator`), CI-Job, der `./gradlew :tool:assembleDebug` baut; Nachweis im Fork, welche APIs erlaubt sind (Dateiwahl, `PdfRenderer`, Kamera, lokaler Port) | CI grün mit APK als Artefakt; Liste «erlaubt / nicht erlaubt» in `docs/` |
| **2. PDF-Ticket** | Import von PDF und Bild über die Dateiauswahl; Original speichern; ganze Seite rendern; Knopf «QR gross» (Ausschnitt in Originalpixeln, kein Neuzeichnen); Helligkeit auf Maximum, Bildschirm wach | Unit-Test mit einem selbst erzeugten Muster-PDF (kein echtes Billett im Repo); Emulator-Screenshot der Vollbildansicht |
| **3. Feldtest Vorzeigen** | Inhaber zeigt ein echtes, selbst gekauftes Billett auf dem Light Phone III (PDF und QR-Bild) bei einer Kontrolle | Protokoll: welche Form angenommen wurde, ob der Scanner las; Ergebnis entscheidet, ob QR-Bild-Ablage bleibt |
| **4. Empfang ohne Kabel** | Weg B (eigenes WLAN, Einmal-Code, 5 Minuten) und Weg C (Kamera-Foto), nur wenn Etappe 1 sie als erlaubt belegt | Test: Upload von einem zweiten Gerät im Emulator-Netz; Empfang endet nach Zeitablauf |
| **5. Start, Favoriten, Heimweg** | Startbildschirm mit Ticket des Tages, «Heimweg», 3 bis 5 Favoriten; «Zuhause» festlegen | Test der Favoriten-Speicherung; Heimweg mit zwei Tipps erreichbar |
| **6. Verbindungsdetail und Echtzeit** | Teilstrecken mit Abfahrts- und Ankunftsgleis, Umsteigezeit, Zwischenhalte; Verspätung, Ausfall, Gleisänderung hervorgehoben; Aktualisieren von Hand, Drosselung | Golden-Test gegen gespeicherte API-Antworten; Gleisänderung im Test sichtbar |
| **7. Offline** | letzte Ergebnisse je Suche und Heimweg mit Zeitstempel zwischenspeichern; klare Anzeige «ohne Echtzeit, Stand 07:42» | Test im Flugmodus des Emulators: Ticket, Favoriten, letzter Heimweg sichtbar |
| **8. Störungen und Formation** (nur nach Entscheid, Abschnitt 4.2 Weg 3) | Zwischendienst mit einem Schlüssel, SIRI-SX und Formation; im Tool `ProxySource` | Meldung erscheint an betroffener Verbindung; Kontingent im Betrieb unter 50 % |

Danach, je nach Entscheid: Einreichung in die Tool Library (Paket-ID vorher
fest), Anpassen oder Einfrieren der PWA, SMS-Dienst für Light Phone II.

Was der Inhaber nicht tun muss, bis Etappe 3: nichts. Für Etappe 3 braucht es
ein Light Phone III und ein selbst gekauftes Billett; für Etappe 8 einen
Schlüssel im API Manager (beantragt erst nach Entscheid).

---

## 7. Offene Fragen an den Inhaber

1. **Name:** Bleibt «SBB Light», oder ein Name ohne «SBB»? (Marke nicht
   geprüft, siehe 4.3.)
2. **Paket-ID:** `com.lightticket.sbb` ist bei Light nach der ersten
   Einreichung nicht mehr änderbar. Welche Domain bzw. welcher Name soll darin
   stehen?
3. **Veröffentlichung:** Nur für den Eigengebrauch per Sideload, oder Einreichung
   in die Tool Library von Light (quelloffen, nicht kommerziell, Prüfung durch
   Light)? Das Repo ist heute schon öffentlich.
4. **Kanal und Zielgruppe:** Nur Light Phone III, oder auch die PWA für
   Zweitgeräte weiter pflegen? Soll für Light Phone II ein SMS-Dienst geprüft
   werden (Server, SMS-Kosten, Reisedaten auf einem Server)?
5. **Zwischendienst:** Störungen und Formation über einen eigenen kleinen
   Dienst mit einem Schlüssel von opentransportdata.swiss (Betrieb, Kosten,
   Schlüssel auf den Inhaber), oder bewusst ohne?
6. **Mail-Weiterleitung (Weg F):** ausschliessen, oder unter Bedingungen
   (Ende-zu-Ende, sofort löschen) prüfen?
7. **Gerät für Tests:** Gibt es ein Light Phone III für Etappe 3, und wer
   macht den Feldtest bei einer Kontrolle?
8. **Lizenz:** `lighttool.toml` nennt MIT, im Repo liegt keine
   Lizenzdatei. Gilt MIT?
