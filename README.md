<p align="center">
  <img src="docs/logo.png" alt="Spo logo — 8-bit cyber-green ghost pin" width="160" height="160" />
</p>

# Spo


A personal Electron app for pinning a phone GPS location or playing a short road route over USB. Search a place, drag a pin, or type coordinates, then explicitly **Set location** or **Update location**. Selecting a pin only changes the preview.

This is original software written from scratch for personal use. It is inspired by the *public product description* of Ghost (a small desktop tool for fixed GPS / road-route mocking). It is **not** a fork, clone, or copy of Ghost, GhostMe, or any other existing repository.

License: MIT.

## Download (macOS Apple Silicon)

Get the ready-to-run app from **[Releases](https://github.com/rizxe134/spo/releases/tag/v0.1.0)**:

1. Download `Spo-0.1.0-mac-arm64.dmg`
2. Open the DMG and drag **Spo** to Applications
3. First launch: right-click Spo → **Open** (unsigned build)

Intel Macs / Windows: build from source for now (`npm run dist:mac` on the matching OS).


## What works in 0.1.0

- Interactive OpenStreetMap map, Photon place search, draggable pin, lat/lng fields
- Saved places and recent selections stored only in a local JSON file
- Session state machine: preview vs applied, Set / Update, Restore, reconnect messaging
- Road routes: up to 12 stops, public OSRM plan, ~45 mph / 1-second interpolation, Pause / Resume
- Android adapter that shells to ADB + Appium Settings (`io.appium.settings`) when a phone is present
- iOS adapter with the same interface; on Linux it is a bounded stub (real DVT simulation is a macOS sidecar)
- First-run USB checklist for Mac / Windows / Linux × iPhone / Android
- Honest errors: a lost cable is never shown as “restored”

## What needs a real phone

`npm test` and the browser preview do **not** prove phone compatibility. You need:

- A data-capable USB cable
- Android: USB debugging, `adb devices` showing `device`, and Appium Settings selected as the mock-location app
- iPhone: a Mac with Developer Mode and `pymobiledevice3` — this Linux environment cannot finish that path

A successful ADB command acknowledgement is not a fresh GPS reading in Maps. Verify in the app you care about.

## Requirements

- Node.js 20+ and npm
- For Android sessions: Android platform-tools (`adb`) on `PATH`, or set the path in Prefs
- For iPhone sessions (macOS): Python 3.12+ and `python3 -m pip install pymobiledevice3`

## Install and run

```sh
npm install
npm test
npm run dev
```

`npm run dev` launches the Electron window (map + device adapters).

Browser-only UI preview (simulated Android phone, live Photon/OSRM if the network allows):

```sh
npm run preview
```

That serves the renderer at `http://127.0.0.1:43217`. Hardware Set / Restore only exists inside Electron.

Production renderer inside Electron after a build:

```sh
npm run build
npm start
```

## Install Spo as a Mac app (Applications / Launchpad)

Build this **on the Mac** you already use for Spo. A Linux machine cannot produce a trusted, double-clickable `Spo.app` for you. The package is **unsigned** — there is no Apple Developer signing or notarization in this personal build.

```sh
npm install
npm test
npm run dist:mac
```

That compiles the Electron app and writes **only** an unsigned disk image:

- `release/Spo-0.1.0-mac-arm64.dmg` (or the matching `x64` dmg)

`dist:mac` is **dmg-only**. electron-builder still stages an unpacked `Spo.app` while it builds the image; the post-dist script then **deletes** that copy under `release/` and writes `release/.metadata_never_index`. Leave the leftover bundle in the repo and Launchpad will show **two** Spo apps (`/Applications/Spo.app` plus `release/mac-arm64/Spo.app`).

The Dock / Applications icon is the 8-bit cyber-green ghost in `build/icon.png`. electron-builder turns that PNG into the macOS `.icns` when you run `dist:mac` on a Mac.

Then:

1. Open the `.dmg` and drag Spo into **Applications**. Do not keep a second `Spo.app` next to the project.
2. Because the app is unsigned, Gatekeeper may block the first launch. In Finder, **right-click Spo.app → Open**, then click Open.  
   If macOS still quarantines a download, you can also run:  
   `xattr -dr com.apple.quarantine /Applications/Spo.app`
3. After that, Spo appears in Applications and Launchpad like any other app.

If Launchpad already shows duplicates from an older build, delete the copy under `release/` (or run `npm run mac:hygiene`) and empty Launchpad’s extra icon, or log out and back in.

Opening Spo from Applications / Dock uses a **minimal PATH**. Spo prepends `/opt/anaconda3/bin`, `/opt/homebrew/bin`, and `/usr/local/bin` before spawning ADB or Python, and it resolves Prefs `python3` to an interpreter that can `import pymobiledevice3` (for example `/opt/anaconda3/bin/python3`). You do not need a login shell for that. Paste an absolute interpreter in Prefs if you want to pin one; saving Prefs recreates the iOS adapter.

Other scripts:

- `npm run pack` — unpacked app directory for the **current** OS. On a Mac this leaves `release/…/Spo.app`, which Launchpad will index. Copy it to `/Applications` if you must, then run `npm run mac:hygiene` so the project copy is gone.
- `npm run dist` — installer for the **current** OS (on a Mac: dmg, then the same hygiene strip)
- `npm run dist:mac` — macOS `.dmg` only (run this on a Mac)
- `npm run mac:hygiene` — strip any `Spo.app` still sitting under `release/`

Do not treat a cloud or Linux `release/` folder as a Mac installer.

## Phone setup

- Android (the path this project actually implements): [docs/android-setup.md](docs/android-setup.md)
- iPhone (macOS sidecar next steps): [docs/ios-setup.md](docs/ios-setup.md)
- USB → Wi-Fi handoff for Android 11+ is attempted with `adb tcpip` + `adb connect` after a working USB session. iOS Wi-Fi handoff is not implemented.

## Privacy

No accounts, telemetry, analytics, or cloud location history. Device identifiers and saved coordinates stay in the local application settings file (`pinpoint-store.json` under Electron `userData`, or `localStorage` in the browser preview).

Search sends the text you submit to the configured Photon endpoint. Planning a route sends stop coordinates (not device IDs) to the configured OSRM endpoint. Map tiles come from OpenStreetMap. The public demos are for light personal use and have no uptime guarantee — change the URLs in Prefs if you run your own.

## Tests

```sh
npm test
```

Unit tests cover session transitions, route interpolation, search/coordinate validation, ADB argument targeting, and adapter failure messages. They use doubles, not phones.

## Project layout

```
src/shared/     session machine, route math, validation (no Node/Electron)
src/main/       Electron main, store, ADB / iOS adapters
src/preload/    contextBridge API
src/renderer/   React UI (also used by npm run preview)
tests/          vitest
docs/           phone setup
```

## Honesty

USB unplug, sleep, force-quit, and a crashed helper cannot guarantee an immediate real GPS. Android’s helper can keep the last mock without a cable. After Spo restarts, a saved recovery record is never auto-resumed — use Retry location or Restore on the same phone.
