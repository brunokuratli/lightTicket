# Anleitung: SBB Light benutzen & aufs Light Phone III bringen

Diese Anleitung hat zwei Teile:

- **Teil A** – die App **sofort im Browser** ausprobieren (Web-Version / PWA).
- **Teil B** – die **native App** auf dem Light Phone III installieren.

---

## Teil A — Web-Version sofort ausprobieren

### A1. Einmalig: Online-Link aktivieren (macht Bruno)

Die Web-Version wird über **GitHub Pages** veröffentlicht. Das muss **einmal**
eingeschaltet werden:

1. Auf GitHub das Repo **`brunokuratli/lightTicket`** öffnen.
2. **Settings → Pages**.
3. Unter **Build and deployment → Source**: **„GitHub Actions"** auswählen.
4. Fertig. Sobald der Branch nach `main` gemerged ist (oder man unter
   **Actions → „Deploy PWA to GitHub Pages" → Run workflow** manuell startet),
   erscheint der Link – üblicherweise:
   **`https://brunokuratli.github.io/lightTicket/`**

> Der Link ist öffentlich. Auf der Web-Version funktioniert der Fahrplan live;
> Tickets werden nur im jeweiligen Browser gespeichert.

### A2. Auf dem Handy „installieren" (PWA)

1. Den Link im mobilen Browser öffnen.
2. Browser-Menü → **„Zum Startbildschirm hinzufügen"**.
3. Die App startet danach im Vollbild wie eine normale App; gespeicherte Tickets
   sind auch offline abrufbar.

### A3. Lokal testen (ohne GitHub Pages)

Im Projektordner:

```bash
python3 -m http.server 8080
# dann http://localhost:8080 öffnen
```

---

## Teil B — Native App auf dem Light Phone III

Das Light Phone III nutzt für eigene Tools das offizielle **light-sdk**
(Kotlin/Compose). Unser fertiger Tool-Code liegt im Ordner **`light-tool/`**.

### Was du brauchst

- Einen Computer (Mac/Windows/Linux) mit **[Android Studio](https://developer.android.com/studio)**.
- Das Light Phone III mit **USB-Kabel**.
- Grundeinstellung am Gerät: **Entwicklermodus / USB-Debugging** aktiviert
  (in den LightOS-Einstellungen unter „Developer" – nach Light-Anleitung).

### B1. SDK holen und Tool einsetzen

1. Das SDK forken/klonen:
   ```bash
   git clone https://github.com/lightphone/light-sdk.git
   ```
2. In **Android Studio** öffnen: **File → Open →** den `light-sdk`-Ordner wählen.
   Beim ersten Öffnen lädt Android Studio die Abhängigkeiten (Gradle Sync) –
   das kann ein paar Minuten dauern.
3. Unsere Tool-Dateien aus **`light-tool/`** in das **`tool/`-Modul** des SDK
   kopieren:
   - `light-tool/src/main/kotlin/com/lightticket/sbb/**`  → in `tool`s Quellordner
     (`tool/src/main/kotlin/…`).
   - `light-tool/lighttool.toml`, `build.gradle.kts`, `AndroidManifest.xml`
     mit den Dateien im `tool/`-Modul **abgleichen** (Werte übernehmen; falls
     Schlüssel-/Versionsnamen abweichen, nach dem Vorbild von
     `examples/authenticator/` anpassen).
4. **Gradle Sync** erneut ausführen: oben rechts das Elefanten-Icon
   **„Sync Project with Gradle Files"** klicken (oder gelbe Leiste → **Sync now**).

### B2. Im Emulator testen (ohne Gerät)

1. Oben in der Symbolleiste beim **Gerät-Dropdown** einen Emulator wählen bzw.
   über **Device Manager** einen anlegen.
2. Neben dem Dropdown das **grüne ▶ „Run"** klicken. Die App startet im Emulator.
3. Für volle LightOS-Funktionen den in der SDK beschriebenen **LightOS-Emulator**
   verwenden (siehe SDK-README).

### B3. Aufs echte Light Phone III (Sideload per ADB)

1. Gerät per USB anschliessen; am Gerät die USB-Debugging-Abfrage bestätigen.
2. In Android Studio erscheint das Telefon im **Gerät-Dropdown** – auswählen.
3. **▶ „Run"** klicken → Android Studio baut und installiert die App direkt.

   Alternative über die Kommandozeile:
   ```bash
   ./gradlew :tool:assembleDebug
   adb install -r tool/build/outputs/apk/debug/tool-debug.apk
   ```
4. Die App **„SBB Light"** erscheint in der Tool-Liste des Light Phone.

### B4. Ticket hinterlegen

1. In der App Tab **Tickets → „Ticket hinzufügen"**.
2. Titel/Gültigkeit eintragen und ein **Bild des Barcodes** wählen
   (Screenshot/Foto der gekauften SBB-Ticket-PDF).
3. Zum Vorzeigen **„Zeigen"** – der Barcode erscheint gross und hell, das Display
   bleibt dabei wach.

### B5. (Optional) Offiziell bei Light einreichen

Community-Tools müssen **quelloffen** sein – Light baut und signiert sie aus
einem öffentlichen Git-Commit. Da unser Code offen auf GitHub liegt, kann das
Tool eingereicht werden, sobald Light den Einreichungsweg öffnet.

---

## Wenn etwas klemmt

- **Gradle-Fehler beim Sync:** meist eine Versions-/Plugin-Abweichung. Werte in
  `tool/build.gradle.kts` an die des SDK-Beispiels `examples/authenticator`
  angleichen und erneut syncen.
- **Fahrplan lädt nicht:** Internet nötig; die App zeigt sonst einen Hinweis.
  Tickets funktionieren trotzdem offline.
- **Bild-Auswahl auf LightOS ungewohnt:** LightOS ist reduziert; ggf. den dort
  vorhandenen Import-/Auswahl-Weg nutzen (in `HomeScreen.kt` als anpassbar
  markiert).
