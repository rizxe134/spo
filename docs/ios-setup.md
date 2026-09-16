# iPhone setup (macOS sidecar)

Pinpoint’s iOS adapter uses the same TypeScript interface as Android (`discover` / `prepare` / `setFixedLocation` / `restore`). On this Linux build it is a **bounded stub**.

Developer location simulation goes through a [pymobiledevice3](https://github.com/doronz88/pymobiledevice3) sidecar. That stack is oriented around macOS, Developer Mode, and Apple’s DVT services. It is not something this personal MVP can complete inside a Linux cloud agent.

## What this build does today

- Probes `python3 -c "import pymobiledevice3"`
- If the module is missing: reports `missing` and lists no iPhones
- If the module imports on Linux: reports `limited`. Discovery may still try `python3 -m pymobiledevice3 usbmux list`. **Set location refuses** with a message that DVT simulate-location needs a Mac
- Wi-Fi handoff is not implemented for iOS

The UI never pretends a location was applied when the sidecar cannot run.

## Next steps on a Mac

1. Install Xcode command-line tools and plug in a data-capable cable.
2. Unlock the iPhone, tap **Trust**, and enable **Developer Mode** (iOS 16+: Settings → Privacy & Security).
3. Install Python 3.12+ and the sidecar:

   ```sh
   python3 -m pip install pymobiledevice3
   python3 -m pymobiledevice3 usbmux list
   ```

4. Point Pinpoint → Prefs → Python path at that interpreter if it is not `python3`.
5. Commands Pinpoint will call when `isAvailable()` is true:

   ```sh
   python3 -m pymobiledevice3 developer dvt simulate-location set -- <lat> <lng>
   python3 -m pymobiledevice3 developer dvt simulate-location clear
   ```

6. A DVT acknowledgement is not a Maps / Find My reading. Cached apps can keep the last fix after clear. An iPhone reboot is a further recovery step if the developer simulation sticks.

## Windows

Install Apple Mobile Device Support (iTunes or Apple Devices) so the phone enumerates, then the same `pymobiledevice3` steps. This 0.1.0 tree does not bundle a Windows sidecar.

## Linux

`usbmuxd` may list a phone. Treat that as detection only. Do not expect Set location to succeed until you run Pinpoint on a Mac with the sidecar paired.
