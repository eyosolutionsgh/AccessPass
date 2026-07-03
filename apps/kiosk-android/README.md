# VMS Kiosk (Android)

A thin native **WebView shell** that turns any Android device — a consumer tablet (Samsung Tab A)
or a vendor POS terminal (ZCS Z92/T10, Sunmi, PAX) — into a VMS check-in kiosk. It loads the
on-prem VMS web app and injects a `window.kiosk` bridge so the **same** `/check-in` UI gains native
hardware: a vendor QR/barcode scanner, NFC tag tap, and badge printing.

All visitor and business logic stays in the web app + tRPC API. This shell only marshals hardware
events to and from JavaScript — it is the native half of the `KioskBridge` seam defined in
`apps/web/src/lib/kiosk.ts`.

## How it fits the Device Profile system

A registered device (a **checkpoint**) has a server-side **Device Profile**
(`deviceType / scannerSource / printerTarget / nfcEnabled / credentialMode`). The web check-in page
reads that profile and decides _which_ path to use; this shell _provides_ the native paths it asks
for and **degrades gracefully** when a capability is missing (e.g. no vendor scanner → the web app
falls back to the camera). So one APK serves every hardware tier — the server config, not the build,
selects behaviour.

### Bridge contract (`window.kiosk`)

Injected on every page load, matching the web's `KioskBridge` type exactly:

| Member              | Native implementation                                                                                                                                                                            |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `config`            | `{ deviceId, webUrl, facilityId? }` from `kiosk-config.json`. Also mirrored into `localStorage['vms.kiosk.deviceId']` so the web hook resolves the device id even before React reads the bridge. |
| `scanQr()`          | One-shot read from the ZCS **HardReader** engine (`HardwareScanner`). Resolves `null` if no vendor reader → web uses the camera.                                                                 |
| `readNfc()`         | One-shot NFC tag UID via reader-mode (`NfcReader`). Used for "tap NFC tag".                                                                                                                      |
| `issueTag()`        | Same as `readNfc()` — a tapped card's UID becomes the reusable tag id.                                                                                                                           |
| `printBadge(badge)` | `VendorPrinter`: best-effort ZCS thermal print **and** always renders a badge PDF to `<externalFiles>/badges/` (returns its `path`).                                                             |
| `reset()`           | Reloads the start URL (returns to the idle check-in screen).                                                                                                                                     |

The bridge is async over a synchronous `@JavascriptInterface`: JS calls `AndroidKiosk.<m>(reqId)`,
native does the work on the hardware/UI thread, then calls back
`window.__kioskResolve(reqId, value)` to settle the Promise.

## Configuration

Edit `src/main/assets/kiosk-config.json` (the bundled default), or drop a `kiosk-config.json`
override into the installed app's external files dir to re-point a device **without rebuilding**:
`/sdcard/Android/data/com.vms.kiosk/files/kiosk-config.json`.

```json
{
  "webUrl": "http://10.0.2.2:5173", // VMS web app base URL (10.0.2.2 = host from the emulator)
  "startPath": "/check-in", // page to open on launch
  "deviceId": "kiosk-android-1", // must match a registered checkpoint in Admin → Checkpoints
  "facilityId": "", // optional facility UUID
  "lockTask": false, // true = pin to the kiosk app (see below)
  "relaunchOnBoot": true, // cold-start the kiosk after a device reboot
  "relaunchOnCrash": true // relaunch after a fatal crash (loop-guarded, see below)
}
```

> **HTTPS note:** the camera QR fallback uses `getUserMedia`, which browsers allow only in a secure
> context (HTTPS or `localhost`). Over plain-HTTP LAN, rely on the **hardware scanner** or serve the
> web app over HTTPS. Cleartext is permitted (`network_security_config.xml`) for on-prem HTTP.

## Build

No Gradle — a raw-SDK pipeline (aapt2 → javac → d8 → zipalign → apksigner), mirroring
`mobile_app_samples/z92_hardware_tester`.

```bash
cd apps/kiosk-android
./build.sh          # -> build/VmsKiosk.apk
```

Requirements (auto-detected; override via env):

- Android SDK with **build-tools 37.0.0** and **platforms/android-34** (`ANDROID_HOME`).
- A JDK — uses Android Studio's bundled JBR if present (`JAVAC`/`KEYTOOL` to override).

Install / run:

```bash
adb install -r build/VmsKiosk.apk
adb shell am start -n com.vms.kiosk/.MainActivity
adb logcat -s VmsKiosk            # bridge + hardware logs
```

## Kiosk lock-down (production)

The shell has three independent hardening layers. The first two are on by default and need no
provisioning; the third (true tamper-proofing) requires a one-time device-owner setup per tablet.

### 1. Self-healing (default on — availability)

A dedicated terminal must recover unattended:

- **`"relaunchOnBoot": true`** — a `BootReceiver` cold-starts the kiosk on `BOOT_COMPLETED`, so a
  power blip doesn't leave the device parked on the launcher. (Redundant, but harmless, when the app
  is also the Home launcher.)
- **`"relaunchOnCrash": true`** — a default uncaught-exception handler reschedules the app via
  `AlarmManager` and kills the process, so a WebView/renderer crash reopens to `/check-in`.
  **Crash-loop guard:** a crash within the first 15 s of startup is treated as a persistent fault
  (bad config, unreachable server) and is _not_ relaunched — it surfaces so a human can fix it,
  rather than spinning.

Set either flag to `false` during development if the auto-restart gets in the way.

### 2. Escape resistance (default on — soft)

Full-screen immersive-sticky mode hides the nav/status bars and the Back button is intercepted (it
returns to the idle screen instead of exiting). This stops accidental exits, but immersive-sticky
still lets a deliberate edge-swipe reveal Home/Recents — it is **not** tamper-proof on its own. For
that, use layer 3.

### 3. Lock Task Mode (opt-in — tamper-proof)

`"lockTask": true` calls `startLockTask()`. To pin **without** the system confirmation dialog (and
hard-block Home/Recents), make the app a device owner (factory-fresh / no accounts) and allow-list
it:

```bash
adb shell dpm set-device-owner com.vms.kiosk/.NoopAdmin   # if you add a DeviceAdminReceiver
# or, simplest screen-pinning (user-exitable): Settings → Security → Screen pinning
```

For a dedicated terminal, also set this app as the **Home** launcher (the manifest declares the
`HOME` category) so a reboot lands straight in the kiosk.

> **Even without layer 3, an escape is harmless:** the `/check-in` `/check-out` `/checkpoint` routes
> are `PostGate`-wrapped — they require a signed-in staff member on a paired device, so a visitor who
> reaches the Android launcher can do nothing. Layers 1–2 are about _availability and polish_; layer
> 3 is about _physical tamper-resistance_ on an unattended device.

## Hardware integration notes

- **Scanner / NFC** use the device framework via reflection — no vendor jar needed to compile or
  run; absent hardware just disables that path. The `HardReader` sequence
  (`getSystemService("HardReader")` → `open(115200)` → `addListener`) is proven on the ZCS T10.
- **Vendor thermal print** (`com.zcs.sdk.*`) is reflective and best-effort. Drop the ZCS printer SDK
  jar into `libs/provided/` (auto-detected by `build.sh` — see [libs/README.md](libs/README.md)) to
  compile direct calls; until then `printBadge` still produces a PDF artifact.

## Files

```
src/main/
  AndroidManifest.xml            launcher + HOME + NFC intents, perms (INTERNET/CAMERA/NFC)
  assets/kiosk-config.json       runtime config (overridable on-device)
  res/xml/                       nfc_tech_filter, network_security_config
  java/com/vms/kiosk/
    MainActivity.java            WebView + JS bridge + lifecycle + lock task + crash relaunch
    BootReceiver.java            relaunches the kiosk on device reboot (BOOT_COMPLETED)
    KioskConfig.java             config loader (asset / external-files override)
    HardwareScanner.java         ZCS T10 HardReader (reflection)
    NfcReader.java               reader-mode NFC UID capture
    VendorPrinter.java           ZCS thermal print (reflection) + PDF badge render
  java/com/common/callback/
    IDecodeReaderListener.java   vendor scanner callback interface (name must match the SDK)
build.sh                         raw-SDK build pipeline (auto-includes libs/provided + libs/bundled)
libs/                            optional vendor SDK jars (git-ignored) — see libs/README.md
```
