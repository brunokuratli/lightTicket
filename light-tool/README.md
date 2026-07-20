# SBB Light — natives Light-Phone-III-Tool (light-sdk)

Native Umsetzung von SBB Light für das **Light Phone III** mit dem offiziellen
[light-sdk](https://github.com/lightphone/light-sdk) (Kotlin + Jetpack Compose).

> Status: **Scaffold**. Der Code ist vollständig und idiomatisch, wurde aber
> mangels Android-Toolchain noch nicht kompiliert. Bauen, Emulieren und der
> ADB-Sideload passieren in Android Studio (siehe unten). Ein paar Stellen sind
> bewusst als „an die SDK-Version anzupassen" markiert.

## Was drin ist

| Datei | Inhalt |
|-------|--------|
| `lighttool.toml` | Tool-Manifest (Name, ID, Berechtigung `network`) |
| `build.gradle.kts` | Modul-Build, hängt an `:sdk:client`, nur Compose + Coroutines |
| `src/main/AndroidManifest.xml` | `INTERNET`-Berechtigung |
| `…/HomeScreen.kt` | UI: Tabs Fahrplan / Abfahrten / Tickets + Vollbild-Viewer |
| `…/HomeScreenViewModel.kt` | Zustand & Logik (drei Tabs) |
| `…/data/TransportApi.kt` | Fahrplan über `transport.opendata.ch` (HttpURLConnection + org.json) |
| `…/data/TicketStore.kt` | Ticket-Wallet: Bilder + JSON-Index in privatem Speicher |
| `…/data/Models.kt` | Datenklassen |
| `…/ui/Theme.kt` | Monochromes Schwarz-Weiss-Theme |

**Bewusst dependency-arm:** Netzwerk über `java.net.HttpURLConnection`, JSON über
das in Android enthaltene `org.json` — so umgehen wir die von der SDK
eingeschränkten Fremd-Bibliotheken. Verwendet werden nur Compose und Coroutines
(beide von Light empfohlen).

## Integration in einen light-sdk-Fork

Diese Dateien sind der **Inhalt des `:tool`-Moduls**, nicht ein eigenständiges
Gradle-Projekt. So bringst du sie zusammen:

1. `light-sdk` forken und klonen, in **Android Studio** öffnen.
2. Im Modul `tool/` die Beispiel-Sources durch die hier liegenden ersetzen
   (Paket `com.lightticket.sbb`). `HomeScreen()` ist der Einstiegspunkt, den der
   SDK-Host rendert.
3. `lighttool.toml`, `build.gradle.kts` und `AndroidManifest.xml` mit den
   entsprechenden Dateien aus `examples/authenticator` **abgleichen**
   (Schlüsselnamen/Plugin-IDs/Versionen können je SDK-Stand abweichen).
4. Falls die SDK eine eigene UI-/Theme-Bibliothek mitbringt: deren Komponenten
   bevorzugen; unser `Theme.kt` ist nur der Fallback.

## Bauen & aufs Gerät bringen

```bash
# im light-sdk-Fork:
./gradlew :tool:assembleDebug
# APK per ADB auf das Light Phone III sideloaden:
adb install -r tool/build/outputs/apk/debug/tool-debug.apk
```

Ohne echtes Gerät: den in der SDK enthaltenen **LightOS-Emulator** verwenden
(für Berechtigungen/Push wie in der SDK-Doku beschrieben).

## Offizielle Verteilung

Community-Tools müssen **quelloffen** sein — Light baut und signiert sie direkt
aus einem öffentlichen Git-Commit. Das erfüllt dieses Repo. Sobald der
Einreichungsweg offen ist, reichen wir den Commit bei Light ein.

## Bekannte Punkte für den ersten Build

- **Bild-Auswahl:** Tickets werden über den Android Photo Picker
  (`PickVisualMedia`) hinzugefügt. Auf LightOS ggf. an den dort verfügbaren
  Auswahl-/Import-Mechanismus anpassen.
- **Aztec-Barcode:** Wir **zeigen** das gespeicherte Barcode-Bild (kein
  Erzeugen nötig). Soll der Code aus Rohdaten *erzeugt* werden, braucht es eine
  von der SDK freigegebene Bibliothek — bei Light anfragen.
- **Manifest-Schema** der `lighttool.toml` gegen die geklonte SDK-Version prüfen.
