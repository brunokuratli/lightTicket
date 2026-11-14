# SBB Light — natives Light-Phone-III-Tool (light-sdk)

Native Umsetzung von SBB Light für das **Light Phone III** mit dem offiziellen
[light-sdk](https://github.com/lightphone/light-sdk) (Kotlin + Jetpack Compose).

> [!WARNING]
> **Auf keinem Gerät und keinem Emulator getestet; ohne Gerät nicht prüfbar.**
> Belegt ist nur: Der Code kompiliert gegen den gepinnten light-sdk-Stand,
> besteht dessen Build-Regeln, und es entsteht ein Debug-APK. Ob das Tool auf
> LightOS startet, Daten lädt oder Tickets anzeigt, ist offen.

## Stand

- **light-sdk gepinnt** auf Commit
  [`e81295e6bc29f987c44c656fdf5081117bbee833`](https://github.com/lightphone/light-sdk/tree/e81295e6bc29f987c44c656fdf5081117bbee833)
  (Release 0.2.7, 12.11.2026), festgehalten in [`ci/light-sdk.ref`](ci/light-sdk.ref).
- **CI:** [`.github/workflows/light-tool-apk.yml`](../.github/workflows/light-tool-apk.yml)
  baut bei jedem Pull Request, der `light-tool/**` ändert, und von Hand
  («Run workflow»).
- **APK herunterladen:** im GitHub-Reiter *Actions* → Lauf «Light Tool APK» →
  unten bei *Artifacts* → `sbb-light-debug-apk` (ZIP mit `tool-debug.apk`,
  30 Tage aufbewahrt). Signiert mit dem öffentlichen Entwicklungs-Schlüssel des
  light-sdk (`sdk/keys/lightsdk-dev.jks`), nicht von Light.

## Was drin ist

| Datei | Inhalt |
|-------|--------|
| `lighttool.toml` | Tool-Manifest nach SDK-Schema: `id`, `label`, `versionCode`, `versionName`, Berechtigungen `INTERNET` und `READ_MEDIA_IMAGES`, `serverPackage` |
| `build.gradle.kts` | Ersetzt `tool/build.gradle.kts` im light-sdk; Plugins und Versionen aus dessen Version-Catalog, hängt nur an `:sdk:client` |
| `ci/prepare.sh` | Setzt `light-tool/` ins `:tool`-Modul eines light-sdk-Checkouts ein (klont bei Bedarf am gepinnten Commit) |
| `ci/light-sdk.ref` | Gepinnter light-sdk-Commit |
| `…/HomeScreen.kt` | `@InitialScreen`-Klasse (`LightScreen`), UI: Tabs Fahrplan / Abfahrten / Tickets + Vollbild-Viewer |
| `…/HomeScreenViewModel.kt` | `LightViewModel`: Zustand & Logik (drei Tabs) |
| `…/data/TransportApi.kt` | Fahrplan über `transport.opendata.ch` (HttpURLConnection + org.json) |
| `…/data/TicketStore.kt` | Ticket-Wallet: Bilder + JSON-Index im privaten Speicher (`lightContext.filesDir`) |
| `…/data/Models.kt` | Datenklassen |
| `…/ui/Theme.kt` | Monochromes Schwarz-Weiss-Theme (Material 3) |

Kein eigenes `AndroidManifest.xml`: Das light-sdk-Plugin erzeugt es aus
`lighttool.toml` und lehnt ein handgeschriebenes ab.

## Bauen

In CI läuft genau dies; lokal gleich (JDK 17 und Android-SDK mit Plattform 36
nötig, `ANDROID_HOME` oder `local.properties` mit `sdk.dir` gesetzt):

```bash
light-tool/ci/prepare.sh ../light-sdk      # klont light-sdk am gepinnten Commit, setzt das Tool ein
cd ../light-sdk
./gradlew -DlightSdk.toolOnly=true :tool:assembleDebug
# Ergebnis: tool/build/outputs/apk/debug/tool-debug.apk
```

`prepare.sh` überschreibt im light-sdk-Checkout `tool/lighttool.toml`,
`tool/build.gradle.kts` und `tool/src/`. Änderungen am Tool immer hier in
`light-tool/` machen, nicht im Checkout.

## Was beim Einpassen geändert wurde

Gegenüber dem ersten Gerüst, damit es gegen den echten SDK-Stand baut:

- `AndroidManifest.xml` entfernt (vom SDK verboten); Berechtigungen in `lighttool.toml`.
- `lighttool.toml` auf das SDK-Schema umgestellt (`label`, `versionCode`,
  `permissions = [...]`, `serverPackage`).
- `build.gradle.kts`: SDK-Plugins (`ksp`, `light-sdk`) dazu; `applicationId`,
  `namespace`, Versionen raus (vom SDK verboten); keine eigenen
  Bibliotheks-Versionen mehr, alles kommt über `:sdk:client`.
- Einstieg: `HomeScreen` ist jetzt eine `@InitialScreen`-Klasse
  (`LightScreen`) statt einer freien Composable-Funktion.
- `HomeScreenViewModel` ist ein `LightViewModel` statt `AndroidViewModel`
  (`android.app.Application` ist gesperrt).
- Ticket-Bild: Android Photo Picker (`androidx.activity`, gesperrt) ersetzt
  durch eine einfache Liste aus dem Album über `lightContext.media`
  (Berechtigung `READ_MEDIA_IMAGES`, Abfrage über `checkPermission`).
- `TicketStore` nimmt `filesDir` statt `Context` (`contentResolver` gesperrt).
- Quellenangabe «Fahrplandaten: opentransportdata.swiss» unter den Tabs
  Fahrplan und Abfahrten ergänzt.
- Bildschirm-wach-halten im Ticket-Viewer entfernt (brauchte Activity-Zugriff,
  gesperrt). Offen für Etappe 2.

Details, was das SDK erlaubt: [`docs/LIGHT-SDK-APIS.md`](../docs/LIGHT-SDK-APIS.md).

## Aufs Gerät bringen (ungeprüft)

```bash
adb install -r tool-debug.apk
```

Laut SDK-README sind aktuelle LightOS-Builds noch nicht durchgehend bereit für
SDK-Tools; empfohlen wird der LightOS-Emulator (`sdk/emulator`, siehe
`docs/system_app` im light-sdk). Für den Emulator in `lighttool.toml`
`serverPackage = "com.thelightphone.sdk.emulator"` setzen und mit
`-DlightSdk.allowAltServerPackage=true` bauen. Nichts davon ist ausprobiert.

## Offizielle Verteilung

Community-Tools müssen **quelloffen** sein — Light baut und signiert sie direkt
aus einem öffentlichen Git-Commit. Der Light-Builder erwartet `tool/lighttool.toml`,
`tool/build.gradle.kts`, `tool/src/main/` und `gradle.properties` (siehe
`docs/repo/README.md` im light-sdk); dieses Repo legt das Tool unter
`light-tool/` ab. Vor einer Einreichung ist zu klären, ob dafür ein eigenes
Repo oder ein Fork nötig ist.

## Bekannte offene Punkte

- **Laufzeit:** nichts auf Gerät oder Emulator geprüft (siehe oben).
- **Bild-Auswahl:** die Album-Liste zeigt nur Dateinamen (max. 30), keine
  Vorschaubilder; PDFs gehen so nicht (Etappe 2, z. B. über den Tool Manager).
- **Bildschirm wach / Helligkeit** beim Vorzeigen: keine SDK-Schnittstelle gefunden.
- **Aztec-Barcode:** Wir **zeigen** das gespeicherte Barcode-Bild (kein
  Erzeugen nötig). `com.google.zxing:core` steht in der SDK-Allowlist, falls
  später erzeugt werden soll.
- **UI-Bibliothek:** Das SDK bringt eigene Komponenten (`LightText`,
  `LightTheme`, …) mit; das Tool nutzt noch Material 3.
