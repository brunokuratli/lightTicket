#!/usr/bin/env bash
# Passt SBB Light (light-tool/) in einen light-sdk-Checkout ein.
#
#   light-tool/ci/prepare.sh <light-sdk-verzeichnis>
#
# Fehlt das Verzeichnis, wird light-sdk am gepinnten Commit
# (light-tool/ci/light-sdk.ref) dorthin geklont. Danach ersetzt das Skript
# den Inhalt des Moduls `tool/` (lighttool.toml, build.gradle.kts, src/)
# durch die Dateien aus light-tool/. Gebaut wird anschliessend im
# light-sdk-Verzeichnis mit:
#
#   ./gradlew -DlightSdk.toolOnly=true :tool:assembleDebug
#
# Läuft in GitHub Actions (.github/workflows/light-tool-apk.yml) und lokal gleich.
set -euo pipefail

if [ $# -ne 1 ]; then
  echo "Aufruf: $0 <light-sdk-verzeichnis>" >&2
  exit 2
fi

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
tool_src="$(cd "$here/.." && pwd)"
sdk_dir="$1"
ref="$(tr -d '[:space:]' < "$here/light-sdk.ref")"

if [ ! -d "$sdk_dir/.git" ]; then
  echo "light-sdk wird nach $sdk_dir geklont (Commit $ref)"
  git init -q "$sdk_dir"
  git -C "$sdk_dir" remote add origin https://github.com/lightphone/light-sdk.git
  git -C "$sdk_dir" fetch -q --depth 1 origin "$ref"
  git -C "$sdk_dir" checkout -q FETCH_HEAD
fi

actual="$(git -C "$sdk_dir" rev-parse HEAD)"
if [ "$actual" != "$ref" ]; then
  echo "Warnung: light-sdk steht auf $actual, gepinnt ist $ref" >&2
fi

tool_dir="$sdk_dir/tool"
if [ ! -f "$tool_dir/lighttool.toml" ]; then
  echo "$tool_dir ist kein light-sdk-:tool-Modul" >&2
  exit 1
fi

# Beispiel-Inhalt des SDK-Gerüsts entfernen, eigene Dateien einsetzen.
rm -rf "$tool_dir/src" "$tool_dir/build"
rm -f "$tool_dir/lighttool.toml" "$tool_dir/build.gradle.kts"
cp "$tool_src/lighttool.toml" "$tool_src/build.gradle.kts" "$tool_dir/"
cp -R "$tool_src/src" "$tool_dir/src"

echo "SBB Light in $tool_dir eingesetzt (light-sdk $actual)."
