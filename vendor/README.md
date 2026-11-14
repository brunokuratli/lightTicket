# Eingebettete Bibliotheken

Lokal abgelegt, damit der Ticket-Import offline geht und keine Daten an ein CDN fliessen.
Unverändert aus dem npm-Paket übernommen, nur umbenannt (`.mjs` → `.js`, damit jeder
Webserver den richtigen MIME-Typ liefert).

| Datei | Herkunft | Lizenz |
|-------|----------|--------|
| `pdfjs/pdf.min.js`, `pdfjs/pdf.worker.min.js` | `pdfjs-dist@4.10.38`, `legacy/build/pdf.min.mjs`, `legacy/build/pdf.worker.min.mjs` | Apache-2.0 (`pdfjs/LICENSE`) |
| `jsqr/jsQR.js` | `jsqr@1.4.0`, `dist/jsQR.js` | Apache-2.0 (`jsqr/LICENSE`) |

pdf.js wird mit `isEvalSupported: false` aufgerufen. jsQR dient nur dazu, die Lage
des QR-Codes zu finden; angezeigt wird ein Ausschnitt der Originalpixel.
