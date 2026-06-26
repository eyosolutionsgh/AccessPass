# Vendor SDK jars (optional)

The kiosk shell needs **no** jars to build or run — `HardwareScanner`, `NfcReader`, and
`VendorPrinter` reach the device's framework SDKs via reflection, so the APK compiles cleanly and
each path simply disables itself when the SDK is absent.

Drop vendor jars here only to replace reflection with direct, compile-checked calls:

- **`libs/provided/*.jar`** — compiled against but **not** packaged into the APK. Use for SDKs the
  device framework already supplies at runtime: the ZCS **T10 HardReader** scanner SDK and the
  **ZCS printer SDK** (`com.zcs.sdk.*`). Bundling these would clash with the system copy.
- **`libs/bundled/*.jar`** — compiled against **and** packaged into the APK. Use for app-level SDKs
  that must ship inside the app (some Sunmi/PAX helper libraries).

`build.sh` picks up both globs automatically (it prints what it found); nothing to wire up. After
adding a `provided` jar you can, e.g., rewrite `VendorPrinter.tryVendorPrint` to call
`com.zcs.sdk.DriverManager` directly instead of reflectively.

> Vendor jars are git-ignored — they are licensed device SDKs, not part of this repo.
