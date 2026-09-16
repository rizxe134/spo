# Android setup (ADB + Appium Settings)

Pinpoint talks to a real Android phone by shelling to `adb`. It does not bundle platform-tools or the helper APK in 0.1.0.

## 1. Computer

1. Install [Android platform-tools](https://developer.android.com/tools/releases/platform-tools) so `adb` is on your `PATH`, or paste the full path in Pinpoint → Prefs.
2. On Linux, add udev rules (or the distro `android-sdk-platform-tools` package) so the phone is not stuck on `no permissions`.
3. On Windows, install the Google USB driver or the OEM driver if `adb devices` never leaves `unauthorized`.

Confirm:

```sh
adb version
adb devices -l
```

You want a serial listed as `device`, not `unauthorized` or `offline`.

## 2. Phone

1. Enable Developer options (tap Build number seven times).
2. Enable **USB debugging**. Unlock the phone and accept this computer’s RSA fingerprint.
3. When you plug in, choose **File transfer** / PTP — not Charge only.
4. Install **Appium Settings** (`io.appium.settings`) from the project’s [GitHub releases](https://github.com/appium/io.appium.settings/releases). Sideload the APK with `adb install`.
5. Developer options → **Select mock location app** → Appium Settings.  
   Pinpoint also runs `adb shell appops set io.appium.settings android:mock_location allow` during Prepare.

## 3. What Pinpoint sends

For the selected serial only (`adb -s <serial> …`):

- `pm path io.appium.settings` — refuse Set location if the helper is missing
- `pm grant` fine location + `appops` mock allow
- `am start-foreground-service --user 0 -n io.appium.settings/.LocationService` with latitude, longitude, altitude, speed, bearing, and accuracy
- Restore: `am stopservice io.appium.settings/.LocationService`

The helper reasserts about every two seconds. Pinpoint also re-sends the fixed target every 10 seconds while the session is active. An ADB acknowledgement is **not** proof that Maps already shows a new fix.

## 4. USB → Wi-Fi (Android 11+)

After a working USB session, use **USB → Wi-Fi handoff**. Pinpoint reads `wlan0`, runs `adb tcpip 5555`, then `adb connect <ip>:5555`. Stay on the same network. Cable-free pairing (wireless debugging) is not automated in 0.1.0 — pair with `adb pair` yourself if you want that.

## 5. Restore and leftovers

Restore stops the mock service. It does not uninstall Appium Settings. If the cable is gone, Pinpoint cannot send the stop command until that same phone is back. The upstream helper can keep the last coordinates without USB. Reboot the phone if a mock sticks after Restore.

## 6. No device

If ADB is missing or no serial is ready, the device list stays empty and Set location fails with a concrete error. That is expected. The browser preview simulates a Pixel so you can try the UI without hardware.
