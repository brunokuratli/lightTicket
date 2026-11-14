# Light SDK: welche APIs ein Tool nutzen darf

Stand: light-sdk Commit
[`e81295e`](https://github.com/lightphone/light-sdk/tree/e81295e6bc29f987c44c656fdf5081117bbee833)
(«chore: release 0.2.7», 12.11.2026), gepinnt in `light-tool/ci/light-sdk.ref`.

Grundlage sind nur die **Quellen und die Doku des SDK**. «Erlaubt» heisst: Die
Build-Regeln des SDK lassen es zu, und/oder das SDK bietet dafür eine eigene
Schnittstelle. Ob es **zur Laufzeit auf LightOS** funktioniert, ist in keinem
Fall geprüft: **Auf keinem Gerät und keinem Emulator getestet.**

## Wie das SDK einschränkt

| Mechanismus | Quelle |
|-------------|--------|
| Gesperrte Imports, u. a. `android.app.*`, `android.content.Context`, `android.content.Intent`, `androidx.activity.*`, `LocalContext`, Reflection | `plugin/src/main/kotlin/com/thelightphone/plugin/LightSdkPlugin.kt`, `BLOCKED_IMPORTS` |
| Gesperrte Code-Muster, u. a. `startActivity(`, `contentResolver`, `getSystemService(`, `bindService(`, `registerReceiver(`, Casts auf `Activity`/`Context` | ebd., `BLOCKED_CODE_PATTERNS` |
| Kein eigenes `AndroidManifest.xml`; Manifest, `applicationId`, Versionen kommen aus `lighttool.toml` | ebd., `validateNoUserManifest`, `CONSUMER_BUILD_SCRIPT_PATTERNS`; `docs/tool_metadata/README.md` |
| Abhängigkeiten nur aus der Allowlist | `plugin/src/main/resources/com/thelightphone/plugin/allowed-dependencies.txt` |
| Berechtigungen nur aus der Allowlist (u. a. `INTERNET`, `CAMERA`, `READ_MEDIA_IMAGES`, `NFC`) | `plugin/src/main/kotlin/com/thelightphone/plugin/LightToolMetadata.kt`, `ALLOWED_PERMISSIONS` |
| Lint-Regeln gegen `LocalContext.current`, `LocalView.current`, Activity-Casts | `lint-rules/src/main/kotlin/com/thelightphone/lint/ActivityAccessDetector.kt` |

Die Sperren sind **textuell zur Build-Zeit** (Zeilen-Scan, Regex). Was dort
nicht steht, ist nicht ausdrücklich erlaubt, sondern nur nicht gesperrt.

## Ergebnis

| Thema | Einstufung | Begründung / Quelle |
|-------|-----------|---------------------|
| **Dateiwahl über Storage Access Framework** (`ACTION_OPEN_DOCUMENT`, `ActivityResultContracts.OpenDocument`, Photo Picker `PickVisualMedia`) | **nicht erlaubt** | Braucht `android.content.Intent` oder `androidx.activity.*` (beide in `BLOCKED_IMPORTS`) und zum Lesen `contentResolver` (in `BLOCKED_CODE_PATTERNS`). Darum wurde der Photo Picker im Gerüst ersetzt. |
| Bilder aus dem Album lesen | **erlaubt** | Eigene SDK-Schnittstelle `lightContext.media` (`loadImages`, `decodeImage`, `readItem`) mit Berechtigung `READ_MEDIA_IMAGES`: `sdk/client/src/main/kotlin/com/thelightphone/sdk/LightMedia.kt`, `sdk/client/README.md` Abschnitt «Images and video». Nur Bilder und Videos, **keine PDFs**. SBB Light nutzt diesen Weg. |
| Dateien vom Computer aufs Gerät (z. B. PDF-Billett) | **erlaubt (SDK-Weg), ungeprüft auf LightOS** | «Tool Manager»: Capability `tool-manager-provider`, Upload per Browser im lokalen Netz in `files/shared/<pfad>` des Tools: `docs/tool_manager/README.md`, `examples/tool-manager-demo`. Möglicher Ersatz für Dateiwahl und für «Weg B» in Etappe 4. |
| **`PdfRenderer`** (`android.graphics.pdf.PdfRenderer` + `android.os.ParcelFileDescriptor`) | **ungeprüft (nicht gesperrt)** | Weder Import noch Aufruf stehen in `BLOCKED_IMPORTS`/`BLOCKED_CODE_PATTERNS`; Android-Plattform-API, keine Abhängigkeit nötig. Lesen aus eigener Datei (`lightContext.filesDir`) braucht keinen `contentResolver`. Kein Beispiel im SDK nutzt es; Laufzeit auf LightOS unbelegt. Statische Probe siehe unten. |
| **Kamera: Barcode/QR scannen** | **erlaubt** | Berechtigung `CAMERA` in der Allowlist; SDK-Komponenten `LightCodeScanner` (Formate u. a. QR, **Aztec**, PDF417) und `LightQrCodeScanner`: `sdk/ui/src/main/kotlin/com/thelightphone/sdk/ui/LightCodeScanner.kt`, `sdk/client/src/main/kotlin/com/thelightphone/sdk/LightClientUiUtils.kt`; genutzt in `examples/authenticator`. |
| Kamera: Foto aufnehmen und speichern | **nicht erlaubt (direkt) / ungeprüft (über SDK)** | CameraX (`androidx.camera`) steht nicht in `allowed-dependencies.txt`, darf also nicht selbst eingebunden werden. Eine SDK-Schnittstelle für Fotoaufnahme gibt es im gepinnten Stand nicht. Ein Kamera-Intent bräuchte `Intent`/`startActivity` (gesperrt). |
| **Lokaler Port** (Server im eigenen WLAN) | **ungeprüft (nicht gesperrt, Hinweise dafür)** | `java.net.ServerSocket` ist nicht gesperrt; `INTERNET` erlaubt; Gruppe `io.ktor` (auch `ktor-server-*`) steht in der Allowlist. Der Builder hat eine Test-Fixture mit `embeddedServer(CIO, port = 8080)`: `builder/tests/fixtures/ktor-server-tool/`. Klartext-HTTP braucht die Capability `cleartext-http` (`docs/tool_metadata/README.md`). Ob LightOS eingehende Verbindungen zulässt: unbelegt. |
| Bildschirm wach halten / Helligkeit | **nicht erlaubt (bisheriger Weg) / ungeprüft** | Der Weg über `Activity.window` (`FLAG_KEEP_SCREEN_ON`) braucht `LocalContext` und einen Activity-Cast (gesperrt). Eine SDK-Schnittstelle dafür ist im gepinnten Stand nicht zu finden. Im Tool vorerst entfernt (TODO Etappe 2). |
| Netzwerk über `HttpURLConnection` + `org.json` | **erlaubt (baut)** | Nicht gesperrt; der CI-Build mit `TransportApi.kt` läuft durch. Das SDK selbst empfiehlt Ktor/OkHttp (`tool/…/DetailScreen.kt`). |

## Statische Probe

Zusätzlich zum Lesen der Quellen wurde lokal (nicht im Repo) eine Probedatei
mit `PdfRenderer`, `ParcelFileDescriptor` und `ServerSocket` ins `:tool`-Modul
gelegt und die Validierung des SDK-Plugins laufen gelassen. Ergebnis siehe
Abschnitt «Probe-Ergebnis». Das prüft nur die Build-Regeln, nicht das Verhalten
auf dem Gerät.

## Probe-Ergebnis

Lokal am 14.11.2026, light-sdk `e81295e`, JDK 17, Android-SDK-Plattform 36,
Befehl `./gradlew -DlightSdk.toolOnly=true :tool:compileDebugKotlin`:

| Probe | Ergebnis |
|-------|----------|
| `import android.content.Intent` + `Intent(Intent.ACTION_OPEN_DOCUMENT)` | Build bricht ab: `blocked import 'android.content.Intent'` |
| `PdfRenderer(ParcelFileDescriptor.open(file, MODE_READ_ONLY))`, Seite 0 in ein `Bitmap` rendern | keine Verletzung, kompiliert |
| `java.net.ServerSocket(0)` öffnen | keine Verletzung, kompiliert |

Die Probedateien liegen nicht im Repo. Die Lint-Regeln des SDK
(`./gradlew :tool:lint`) wurden dabei nicht ausgeführt.
