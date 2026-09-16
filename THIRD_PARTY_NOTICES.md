# Third-party notices

Pinpoint is MIT-licensed original code. It talks to public services and optional helpers that have their own terms.

- OpenStreetMap tile data © OpenStreetMap contributors, ODbL. https://www.openstreetmap.org/copyright
- Photon geocoder (default `https://photon.komoot.io/api/`) — public demo, no availability guarantee
- OSRM demo (`https://router.project-osrm.org`) — light noncommercial use, about one request per second
- Android Debug Bridge (Google platform-tools) — you install separately
- Appium Settings (`io.appium.settings`) — Apache-2.0 helper APK you sideload; not bundled here
- pymobiledevice3 — optional Python sidecar for iOS; not bundled here
- Electron, React, Leaflet, Vite, and other npm packages — see `package-lock.json` after `npm install`

Do not treat the public Photon or OSRM demos as a production backend.
