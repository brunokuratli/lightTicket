# SBB Light

Ein minimalistischer **Schweizer Fahrplan** (SBB) mit **Ticket-Wallet** –
gebaut im Geist des [Light Phone](https://www.thelightphone.com): schwarz-weiss,
ablenkungsfrei, offline-fähig, ohne Tracking und ohne Konto.

- **Fahrplan** – Verbindungen von A nach B suchen (Datum/Zeit, ab/an).
- **Abfahrten** – Live-Abfahrtstafel für jede Haltestelle.
- **Tickets** – gekaufte SBB-Tickets als Barcode-Bild ablegen und dem
  Kontrollpersonal in einer grossen, hellen Vollbildansicht zeigen.

Die Fahrplandaten kommen von der freien API
[transport.opendata.ch](https://transport.opendata.ch) (kein Schlüssel nötig,
CORS aktiv). Tickets bleiben ausschliesslich auf dem Gerät (IndexedDB) – es gibt
keinen Server.

---

## Machbarkeit auf dem Light Phone

Kurzfassung der Recherche (Stand Juli 2026):

- Das **Light Phone II** hat **keinen Browser und kein App-System** – eine
  eigene App lässt sich dort nicht installieren.
- Das **Light Phone III** ist ebenfalls bewusst reduziert (kein klassisches
  Web-Browsing), **öffnet sich aber 2026 für eine kuratierte „Tool Library"**.
  Offizielle Tools müssen von Light freigegeben sein und **quelloffen,
  nicht-kommerziell und datensparsam** sein. Zusätzlich erlaubt ein
  **Entwicklermodus das Sideloading** eigener Tools ausserhalb der Library.
  (Quellen: [Wikipedia](https://en.wikipedia.org/wiki/Light_Phone_III),
  [Engadget](https://www.engadget.com/2161468/the-minimalist-light-phone-iii-will-soon-support-a-curated-set-of-third-party-apps/),
  [Gadget Hacks](https://smartphones.gadgethacks.com/news/light-phone-iii-third-party-apps-explained-rules-and-risks/))

**Konsequenz für die Umsetzung:** Es gibt (noch) kein öffentliches natives SDK.
Der pragmatische, sofort lauffähige Weg ist eine **schlanke, offline-fähige
Web-App (PWA)**, die

1. **heute** auf jedem Gerät mit Browser läuft (Testen, Companion-Nutzung),
2. bewusst **monochrom, kontraststark und minimal** gehalten ist – passend zur
   Design-Sprache von Light und damit anschlussfähig, falls sie später als
   Light-Tool eingereicht oder per Entwicklermodus portiert wird,
3. **quelloffen und nicht-kommerziell** ist – also genau die Kriterien der
   künftigen Tool Library erfüllt.

Diese erste Version ist damit sowohl direkt nutzbar als auch die richtige Basis
für eine spätere native Light-Phone-Integration.

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

SBB verkauft Tickets als PDF/Screenshot mit **Barcode (Aztec)**. Diese erste
Version integriert bewusst **nicht** den SBB-Kauf-Flow (dafür gibt es keine
öffentliche API) – stattdessen legst du dein bereits gekauftes Ticket zuverlässig
für jede Ticketart ab:

1. Tab **Tickets** → **Ticket hinzufügen**.
2. Titel, Gültigkeit und optional eine Notiz erfassen.
3. **Bild des Barcodes** wählen (Screenshot/Foto der Ticket-PDF).
4. Speichern – zum Vorzeigen **„Zeigen"** tippen: grosse, helle Vollbildansicht
   mit aktivem Wach-Halten des Displays.

## Technik

| Bereich        | Umsetzung                                          |
|----------------|----------------------------------------------------|
| Fahrplan       | `transport.opendata.ch/v1` (locations/connections/stationboard) |
| Speicher       | IndexedDB (Tickets), localStorage (Ansicht)        |
| Offline        | Service Worker (App-Shell precache, API network-only) |
| Abhängigkeiten | keine – reines HTML/CSS/JS                          |

## Roadmap

- Verbindungs-Detailansicht mit allen Zwischenhalten.
- Favoriten für häufige Strecken/Haltestellen.
- Einreichung als Light-Phone-Tool, sobald die Tool-Library-Spezifikation
  öffentlich ist.
