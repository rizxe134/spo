# Changelog

## 0.1.4 — 2026-09-19

- App icon: 8-bit cyber-green ghost pin (Dock / Applications via electron-builder, header, favicon)

## 0.1.3 — 2026-09-19

- macOS packaging via electron-builder: unsigned `Spo.app` and `.dmg` from `npm run dist:mac` (build on a Mac; Gatekeeper right-click → Open)

## 0.1.2 — 2026-09-19

- Rebrand user-facing name from Pinpoint to Spo
- Black + cyber green theme (dark panels, neon green accents, readable body text)

## 0.1.1 — 2026-09-19

- iOS: `simulate-location set` is held as a live process (it does not exit). Timeout-on-exit is no longer treated as failure. Restore sends SIGINT and `simulate-location clear`.

## 0.1.0 — 2026-09-16

Initial personal MVP.

- Original Electron + React + TypeScript desktop app named Pinpoint (MIT)
- OpenStreetMap map, Photon search, draggable preview pin, lat/lng entry
- Explicit Set location / Update location; pin selection never applies by itself
- Fixed-location session that reasserts coordinates while the process stays open
- Road-route mode: up to 12 stops, OSRM plan, ~45 mph / 1s interpolation, Pause / Resume
- Local saved places and recents; no accounts or telemetry
- Android adapter: ADB device list, Appium Settings prepare/set/restore, USB→Wi-Fi handoff attempt
- iOS adapter: same interface, pymobiledevice3 probe, clean stub on Linux with macOS docs
- First-run setup checklist for Mac/Windows/Linux × iPhone/Android
- Quit attempts Restore by default; unresolved sessions stay in a local recovery file
- Unit tests for session state, routing math, search validation, and ADB targeting
- `npm run preview` browser renderer with a simulated phone
