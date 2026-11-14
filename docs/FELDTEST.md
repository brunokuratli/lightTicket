# Feldtest: Billett bei einer Kontrolle vorzeigen (Etappe 3)

Ziel nach `docs/KONZEPT.md` Abschnitt 6.2: Herausfinden, ob das Kontrollpersonal
ein Billett auf dem Light Phone III (und in der PWA) annimmt und ob der Scanner
den Code liest. **Nur mit einem echten, selbst gekauften Billett.** Kein fremdes
Billett, kein bearbeitetes PDF, kein neu gezeichneter Code.

Regeln aus den AGB Webshop (Konzept 5.2): Ausweis im Original mitführen; das
Billett muss auf dem Bildschirm sichtbar sein; das Gerät auf Verlangen
aushändigen. **Immer eine Rückfallebene dabei haben** (SBB-App auf einem
zweiten Telefon oder A4-Ausdruck), damit der Test nie zur Busse wird.

## Vorbereitung (am Vorabend, 15 Minuten)

1. Billett im SBB-Webshop oder in der SBB-App kaufen, **PDF herunterladen**
   (Original, nicht weiterleiten, nicht drucken und abfotografieren).
2. **Light Phone III** (Tool «SBB Light», Debug-APK aus der CI):
   - Telefon und Computer im selben WLAN.
   - Am Computer den Tool Manager von Light öffnen → «SBB Light» →
     «Billette» → PDF hochladen.
   - Im Tool: «Tickets» → «Billett-PDF vom Computer» → «Zeigen».
     Prüfen: «QR gross» zeigt den Code scharf, «Ganze Seite» zeigt das Billett
     mit lesbarer OT-Nummer oben rechts.
   - Bildschirm bleibt an, solange das Billett offen ist? (Notieren.)
3. **PWA** (Zweitgerät, z. B. iPhone): https://brunokuratli.github.io/lightTicket/
   → «Tickets» → «Ticket hinzufügen» → dasselbe PDF wählen → «Zeigen».
4. Helligkeit am Light Phone von Hand auf Maximum (das Tool kann sie nicht
   setzen).

## Bei der Kontrolle

Reihenfolge, damit jede Form einmal geprüft wird (über mehrere Fahrten
verteilen, nicht alles bei einer Kontrolle):

1. Light Phone, **«QR gross»** zeigen.
2. Wenn verlangt oder nicht gelesen: **«Ganze Seite»** zeigen.
3. Wenn nicht angenommen: PWA bzw. Rückfallebene zeigen.

Nicht diskutieren, nicht erklären, dass es ein Test ist, ausser das
Kontrollpersonal fragt. Bei Zweifeln sofort die Rückfallebene zeigen.

## Protokoll (je Kontrolle eine Zeile)

| Datum | Strecke / Zug | Gerät | Form (QR gross / ganze Seite / PWA) | Scanner gelesen? (ja / nein / nicht gescannt) | Angenommen? | Bemerkung (Helligkeit, Spiegelung, Rückfrage) |
|-------|---------------|-------|--------------------------------------|----------------------------------------------|-------------|-----------------------------------------------|
|       |               |       |                                      |                                              |             |                                               |

## Was das Ergebnis entscheidet

- **«QR gross» wird gelesen und angenommen:** Ablage als PDF mit QR-Ausschnitt
  bleibt Standard.
- **Nur «Ganze Seite» angenommen:** Viewer öffnet künftig mit ganzer Seite.
- **Light Phone wird nicht gelesen** (z. B. Display zu dunkel oder spiegelt):
  Befund an den COO; Billett-Funktion im Tool nicht weiter ausbauen, bis geklärt.
- **Nur QR-Bild ohne PDF** wurde nicht getestet und bleibt ungeprüft
  (Konzept 5.2: SBB-Community verlangt das PDF).

Ergebnis in Notion (Aufgabe OKA-113) und in diesem Repo als Nachtrag festhalten.
