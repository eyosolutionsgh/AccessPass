#!/usr/bin/env bash
# Builds the VMS kiosk APK with the raw Android SDK toolchain (no Gradle), mirroring the proven
# z92_hardware_tester pipeline: aapt2 compile/link -> javac -> d8 -> zip dex -> zipalign -> apksigner.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
SDK_DIR="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
BUILD_TOOLS="${BUILD_TOOLS:-$SDK_DIR/build-tools/37.0.0}"
ANDROID_JAR="${ANDROID_JAR:-$SDK_DIR/platforms/android-34/android.jar}"
APP_NAME="VmsKiosk"

# Prefer Android Studio's bundled JDK (the system has no standalone javac here).
JBR="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
JAVAC_BIN="${JAVAC:-javac}"
KEYTOOL_BIN="${KEYTOOL:-keytool}"
if [ -x "$JBR/bin/javac" ]; then
  export JAVA_HOME="$JBR"
  export PATH="$JAVA_HOME/bin:$PATH"
  JAVAC_BIN="$JAVA_HOME/bin/javac"
  KEYTOOL_BIN="$JAVA_HOME/bin/keytool"
fi

for tool in "$BUILD_TOOLS/aapt2" "$BUILD_TOOLS/d8" "$BUILD_TOOLS/zipalign" "$BUILD_TOOLS/apksigner"; do
  [ -x "$tool" ] || { echo "Missing build tool: $tool" >&2; exit 1; }
done
[ -f "$ANDROID_JAR" ] || { echo "Missing android.jar: $ANDROID_JAR" >&2; exit 1; }

# Optional vendor SDK jars (none required — the hardware paths use reflection). Drop jars in:
#   libs/provided/  compiled against but NOT bundled — the device framework supplies them at
#                   runtime (ZCS T10 HardReader, ZCS printer SDK, …). Lets you replace reflection
#                   with direct calls without changing the runtime contract.
#   libs/bundled/   compiled against AND packaged into the APK — app-level SDKs that ship in-app.
shopt -s nullglob
PROVIDED_JARS=(libs/provided/*.jar)
BUNDLED_JARS=(libs/bundled/*.jar)
shopt -u nullglob
# `${arr[@]+"${arr[@]}"}` = safe expansion of a possibly-empty array under `set -u` (macOS bash 3.2).
for j in ${PROVIDED_JARS[@]+"${PROVIDED_JARS[@]}"}; do echo "provided SDK: $j"; done
for j in ${BUNDLED_JARS[@]+"${BUNDLED_JARS[@]}"}; do echo "bundled SDK:  $j"; done

CLASSPATH_ARG="build/apk/base.apk"
for j in ${PROVIDED_JARS[@]+"${PROVIDED_JARS[@]}"} ${BUNDLED_JARS[@]+"${BUNDLED_JARS[@]}"}; do
  CLASSPATH_ARG="$CLASSPATH_ARG:$j"
done

cd "$ROOT_DIR"
rm -rf build
mkdir -p build/compiled build/classes build/dex build/apk debug

echo "==> aapt2 compile resources"
"$BUILD_TOOLS/aapt2" compile --dir src/main/res -o build/compiled

echo "==> aapt2 link (manifest + assets)"
"$BUILD_TOOLS/aapt2" link \
  -I "$ANDROID_JAR" \
  --manifest src/main/AndroidManifest.xml \
  -A src/main/assets \
  --min-sdk-version 23 \
  --target-sdk-version 34 \
  -o build/apk/base.apk \
  build/compiled/*.flat

echo "==> javac"
"$JAVAC_BIN" -encoding UTF-8 -source 1.8 -target 1.8 \
  -bootclasspath "$ANDROID_JAR" \
  -classpath "$CLASSPATH_ARG" \
  -d build/classes \
  $(find src/main/java -name '*.java' | sort)

echo "==> d8 dex"
D8_LIBS=(--lib "$ANDROID_JAR")
for j in ${PROVIDED_JARS[@]+"${PROVIDED_JARS[@]}"}; do D8_LIBS+=(--lib "$j"); done
"$BUILD_TOOLS/d8" --min-api 23 \
  "${D8_LIBS[@]}" \
  --output build/dex \
  $(find build/classes -name '*.class' | sort) \
  ${BUNDLED_JARS[@]+"${BUNDLED_JARS[@]}"}

cp build/apk/base.apk "build/${APP_NAME}-unsigned.apk"
/usr/bin/zip -j "build/${APP_NAME}-unsigned.apk" build/dex/classes.dex >/dev/null
"$BUILD_TOOLS/zipalign" -f 4 "build/${APP_NAME}-unsigned.apk" "build/${APP_NAME}-aligned.apk"

KEYSTORE_PATH="debug/vms-kiosk-debug.keystore"
if [ ! -f "$KEYSTORE_PATH" ]; then
  echo "==> generating debug keystore"
  "$KEYTOOL_BIN" -genkeypair \
    -keystore "$KEYSTORE_PATH" \
    -storepass android -keypass android \
    -alias androiddebugkey -keyalg RSA -keysize 2048 -validity 10000 \
    -dname "CN=VMS Kiosk Debug,O=VMS,C=GH"
fi

echo "==> apksigner sign"
"$BUILD_TOOLS/apksigner" sign \
  --ks "$KEYSTORE_PATH" \
  --ks-pass pass:android --key-pass pass:android \
  --out "build/${APP_NAME}.apk" \
  "build/${APP_NAME}-aligned.apk"

"$BUILD_TOOLS/apksigner" verify --verbose "build/${APP_NAME}.apk" >/dev/null
echo "Built: $ROOT_DIR/build/${APP_NAME}.apk"
