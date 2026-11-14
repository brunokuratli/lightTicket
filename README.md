# SBB Light

Ein minimalistischer **Schweizer Fahrplan** (SBB) mit **Ticket-Wallet** –
gebaut im Geist des [Light Phone](https://www.thelightphone.com): schwarz-weiss,
ablenkungsfrei, offline-fähig, ohne Tracking und ohne Konto.

- **Fahrplan** – Verbindungen von A nach B suchen (Datum/Zeit, ab/an).
- **Abfahrten** – Live-Abfahrtstafel für jede Haltestelle.
- **Tickets** – gekaufte SBB-Billette als **Original-PDF** (oder Bild) ablegen
  und dem Kontrollpersonal zeigen: QR-Code gross oder ganze Seite, auch offline.

Die Fahrplandaten kommen von der freien API
[transport.opendata.ch](https://transport.opendata.ch) (kein Schlüssel nötig,
CORS aktiv). Fahrplandaten: [opentransportdata.swiss](https://opentransportdata.swiss).
Tickets bleiben ausschliesslich auf dem Gerät (IndexedDB) – es gibt keinen Server.

## Zwei Umsetzungen in diesem Repo

| Ordner | Was | Zweck |
|--------|-----|-------|
| Wurzel (`index.html` …) | **PWA** (HTML/CSS/JS) | Sofort lauffähiger Prototyp, läuft in jedem Browser |
| [`light-tool/`](light-tool/) | **Natives Light-Phone-III-Tool** (Kotlin/Compose, [light-sdk](https://github.com/lightphone/light-sdk)) | Die eigentliche App fürs Light Phone III |

Seit Juli 2026 gibt es das offizielle **light-sdk** (Kotlin + Jetpack Compose).
Damit ist die native Umsetzung fürs Light Phone III der richtige Weg; die PWA
bleibt als Referenz und zum schnellen Testen. Details zur nativen Variante:
[`light-tool/README.md`](light-tool/README.md).

➡️ **Schritt-für-Schritt-Anleitung** (Web-Version nutzen **und** native App aufs
Light Phone III bringen): [`ANLEITUNG.md`](ANLEITUNG.md) – auch als
einseitiges PDF zum Teilen: [`docs/SBB-Light-Anleitung.pdf`](docs/SBB-Light-Anleitung.pdf).

📐 **Konzept** (Ist-Stand, Light-Phone-Grenzen, Datenquellen, Tickets, Etappenplan):
[`docs/KONZEPT.md`](docs/KONZEPT.md).

Die Web-Version wird per GitHub Actions auf **GitHub Pages** veröffentlicht
(Workflow: `.github/workflows/deploy-pages.yml`). Einmalig muss unter
**Settings → Pages → Source** „GitHub Actions" gewählt werden; danach ist die
App unter `https://brunokuratli.github.io/lightTicket/` erreichbar.

---

## Machbarkeit auf dem Light Phone

Kurzfassung der Recherche (Stand Juli 2026):

- Das **Light Phone II** hat **keinen Browser und kein App-System** – eine
  eigene App lässt sich dort nicht installieren.
- Das **Light Phone III** ist ebenfalls bewusst reduziert (kein klassisches
  Web-Browsing), hat aber seit **Juli 2026** ein offizielles Entwickler-SDK:
  das [**light-sdk**](https://github.com/lightphone/light-sdk) (Kotlin +
  Jetpack Compose). Tools laufen im `:tool`-Modul, werden per Gradle zu einem
  APK gebaut und heute per **ADB sideloadet**; offiziell verteilte Tools baut
  und signiert **Light aus einem öffentlichen, quelloffenen Git-Commit**.
  (Quellen: [light-sdk](https://github.com/lightphone/light-sdk),
  [Wikipedia](https://en.wikipedia.org/wiki/Light_Phone_III),
  [Engadget](https://www.engadget.com/2161468/the-minimalist-light-phone-iii-will-soon-support-a-curated-set-of-third-party-apps/))

**Konsequenz für die Umsetzung:**

1. Die **native App fürs Light Phone III** wird mit dem light-sdk gebaut
   (Kotlin/Compose) – siehe [`light-tool/`](light-tool/). Sie ist bewusst
   **monochrom, minimal und quelloffen** und erfüllt damit die Kriterien für
   eine offizielle Light-Freigabe.
2. Die **PWA** (Wurzel dieses Repos) bleibt als **Referenz und schneller Test**:
   sie läuft heute in jedem Browser und diente als lauffähiger Prototyp.

---

## Lokal starten

Kein Build, keine Abhängigkeiten. Einfach als statische Dateien ausliefern:

```bash
# eine beliebige statische Auslieferung, z. B.:
python3 -m http.server 8080
# dann http://localhost:8080 öffnen
```

Für die volle PWA-/Offline-Funktion (Service Worker) muss die Seite über
`http://localhost` oder **HTTPS** ausgeliefert werden.

## Auf dem Handy „installieren"

Im mobilen Browser öffnen → Menü → **Zum Startbildschirm hinzufügen**. Danach
startet die App im Vollbild und der App-Shell funktioniert offline; gespeicherte
Tickets sind auch ohne Internet abrufbar.

---

## Tickets hinzufügen

Die App kauft keine Tickets (dafür gibt es keine öffentliche API). Sie legt ein
bereits gekauftes Billett ab und zeigt es vor. Erste Wahl ist das
**Original-PDF** (Begründung: `docs/KONZEPT.md`, Abschnitt 5).

1. Das PDF des Billetts aufs Gerät holen (Bestätigungs-Mail der SBB oder
   SBB.ch → Profil → Bestellungen) und in «Dateien» sichern.
2. Tab **Tickets** → **Ticket hinzufügen** → Datei wählen. Der Titel wird aus
   dem Dateinamen vorgeschlagen; Gültigkeit und Notiz optional.
3. Die App liest das PDF auf dem Gerät, zeichnet jede Seite als Bild und sucht
   den QR-Code. «QR gross» ist ein **Ausschnitt der Originalpixel**, der Code
   wird nicht neu gezeichnet und sein Inhalt nicht gespeichert.
4. Zum Vorzeigen **«Zeigen»**: QR-Code gross, Umschalter «Ganze Seite»
   (OT-Nummer, Name, Gültigkeit lesbar), Link zum Original-PDF. Der Bildschirm
   bleibt wach, wo der Browser das erlaubt. Ausweis im Original mitführen.

Ein Bild (Screenshot des QR-Codes) geht weiterhin, ist aber schwächer belegt.
Wird kein QR-Code erkannt (z. B. Aztec-Code bei internationalen Billetten),
zeigt die App die ganze Seite. Abgelaufene Billette sind markiert.

Hinweis iPhone: Safari kann Daten einer Webseite nach längerer Nichtnutzung
löschen; als App auf dem Home-Bildschirm installiert ist das nicht der Fall.

## Technik

| Bereich        | Umsetzung                                          |
|----------------|----------------------------------------------------|
| Fahrplan       | `transport.opendata.ch/v1` (locations/connections/stationboard) |
| Speicher       | IndexedDB (Original-PDF, gerenderte Seiten, QR-Ausschnitt), localStorage (Ansicht) |
| PDF / QR       | pdf.js 4.10.38 (Legacy-Build) und jsQR 1.4.0, beide Apache-2.0, lokal in `vendor/`, erst beim Import geladen |
| Offline        | Service Worker (App-Hülle und Bibliotheken vorab gespeichert, eigene Dateien zuerst aus dem Netz, API nur Netz) |
| Abhängigkeiten | keine Build-Schritte; Laufzeit nur `vendor/`        |
| Tests          | `npm ci && npx playwright install chromium && npm test` (iPhone-Format; CI zusätzlich WebKit; echte Suche Zürich HB → Bern) |

## Roadmap

- Verbindungs-Detailansicht mit allen Zwischenhalten.
- Light Phone III: PDF-Billett im nativen Tool (Etappe 2 im Konzept).
- Favoriten für häufige Strecken/Haltestellen.
- Einreichung als Light-Phone-Tool, sobald die Tool-Library-Spezifikation
  öffentlich ist.
