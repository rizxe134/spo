export type HostOs = 'mac' | 'windows' | 'linux'
export type PhoneKind = 'iphone' | 'android'

export interface ChecklistItem {
  id: string
  title: string
  detail: string
}

export interface SetupProfile {
  os: HostOs
  phone: PhoneKind
  title: string
  summary: string
  items: ChecklistItem[]
}

export const SETUP_PROFILES: SetupProfile[] = [
  {
    os: 'mac',
    phone: 'iphone',
    title: 'Mac + iPhone over USB',
    summary: 'iOS location simulation needs Apple’s developer tooling and a macOS sidecar. This Linux build only stubs that path.',
    items: [
      {
        id: 'mac-iphone-cable',
        title: 'Use a data-capable cable',
        detail: 'Charge-only Lightning or USB-C cables will never appear to the computer. Prefer an Apple-certified data cable.'
      },
      {
        id: 'mac-iphone-trust',
        title: 'Trust this computer',
        detail: 'Unlock the iPhone and tap Trust when the pairing dialog appears. Unlock again if the session drops.'
      },
      {
        id: 'mac-iphone-developer',
        title: 'Turn on Developer Mode',
        detail: 'On iOS 16+, Settings → Privacy & Security → Developer Mode. Reboot if the toggle is missing until Xcode or the sidecar has paired once.'
      },
      {
        id: 'mac-iphone-sidecar',
        title: 'Install the pymobiledevice3 sidecar on macOS',
        detail: 'Spo looks for pymobiledevice3 on several pythons, not only /usr/bin/python3. Packaged Spo.app has a short GUI PATH; it prepends Anaconda and Homebrew bins and can pick `/opt/anaconda3/bin/python3` when Prefs still says `python3`. See docs/ios-setup.md.'
      }
    ]
  },
  {
    os: 'mac',
    phone: 'android',
    title: 'Mac + Android over USB',
    summary: 'Android mocking uses ADB plus the Appium Settings helper as the selected mock-location app.',
    items: [
      {
        id: 'mac-android-debug',
        title: 'Enable USB debugging',
        detail: 'Settings → About → tap Build number seven times, then enable USB debugging in Developer options.'
      },
      {
        id: 'mac-android-mode',
        title: 'Choose File transfer / PTP, not Charge only',
        detail: 'When you plug in, pick a data mode so ADB can see the phone. Authorize the RSA fingerprint.'
      },
      {
        id: 'mac-android-adb',
        title: 'Install platform-tools',
        detail: 'Put `adb` on PATH, or set the ADB path in Spo settings. `adb devices` should list the serial as device.'
      },
      {
        id: 'mac-android-helper',
        title: 'Install Appium Settings and select it as the mock location app',
        detail: 'Install io.appium.settings, then Developer options → Select mock location app. Spo can also run `appops set … android:mock_location allow`.'
      }
    ]
  },
  {
    os: 'windows',
    phone: 'iphone',
    title: 'Windows + iPhone over USB',
    summary: 'Windows can talk to an iPhone only after Apple Mobile Device Support is present. Location simulation still needs the Python sidecar.',
    items: [
      {
        id: 'win-iphone-itunes',
        title: 'Install Apple Mobile Device Support',
        detail: 'Install iTunes or Apple Devices so the usbmux service can see the phone. Replug after install.'
      },
      {
        id: 'win-iphone-trust',
        title: 'Trust this computer',
        detail: 'Unlock the iPhone and accept the Trust prompt. Confirm the device appears before trying Set location.'
      },
      {
        id: 'win-iphone-sidecar',
        title: 'Install pymobiledevice3',
        detail: 'The iOS adapter shells to `python3 -m pymobiledevice3`. Follow docs/ios-setup.md. This is not bundled on Windows in the 0.1.0 personal build.'
      },
      {
        id: 'win-iphone-limit',
        title: 'Expect a stub until the sidecar is present',
        detail: 'Without pymobiledevice3, Spo lists no iPhones and explains the missing runtime instead of pretending a fix was applied.'
      }
    ]
  },
  {
    os: 'windows',
    phone: 'android',
    title: 'Windows + Android over USB',
    summary: 'The same ADB + Appium Settings path as macOS, plus the Google USB driver on many PCs.',
    items: [
      {
        id: 'win-android-driver',
        title: 'Install a USB driver if the phone stays unauthorized',
        detail: 'Google USB Driver (or the OEM driver) is required on many Windows machines before `adb devices` shows device.'
      },
      {
        id: 'win-android-debug',
        title: 'Enable USB debugging and authorize this PC',
        detail: 'Developer options → USB debugging. Accept the RSA prompt. Use File transfer rather than Charge only.'
      },
      {
        id: 'win-android-adb',
        title: 'Install Android platform-tools',
        detail: 'Add platform-tools to PATH or paste the adb.exe path in Settings. Spo shells to that binary only.'
      },
      {
        id: 'win-android-helper',
        title: 'Install Appium Settings as the mock-location app',
        detail: 'Sideload the helper APK, then select it under Developer options. Restore stops the LocationService; it does not uninstall the helper.'
      }
    ]
  },
  {
    os: 'linux',
    phone: 'android',
    title: 'Linux + Android over USB',
    summary: 'This is the path this personal build can actually exercise. udev rules often matter more than the app.',
    items: [
      {
        id: 'linux-android-udev',
        title: 'Allow your user to talk to the phone',
        detail: 'Install android-sdk-platform-tools (or Google platform-tools) and add udev rules so the device is not stuck on no permissions.'
      },
      {
        id: 'linux-android-debug',
        title: 'Enable USB debugging',
        detail: 'Same Developer options flow as other desktops. Authorize this computer’s RSA key.'
      },
      {
        id: 'linux-android-helper',
        title: 'Install Appium Settings',
        detail: 'Spo will refuse Set location if io.appium.settings is missing, rather than inventing a mock provider.'
      }
    ]
  },
  {
    os: 'linux',
    phone: 'iphone',
    title: 'Linux + iPhone',
    summary: 'usbmuxd can sometimes list an iPhone. Developer location simulation is a macOS-oriented sidecar and is stubbed here.',
    items: [
      {
        id: 'linux-iphone-usbmux',
        title: 'Install usbmuxd if you only need detection',
        detail: 'A listed iPhone is not enough. DVT simulate-location typically fails on Linux; Spo reports that instead of faking success.'
      },
      {
        id: 'linux-iphone-macos',
        title: 'Use a Mac for a real iOS session',
        detail: 'See docs/ios-setup.md for the pymobiledevice3 steps Spo will call when that runtime exists.'
      }
    ]
  }
]

export function setupProfile(os: HostOs, phone: PhoneKind): SetupProfile {
  return (
    SETUP_PROFILES.find((profile) => profile.os === os && profile.phone === phone) ??
    SETUP_PROFILES[4]
  )
}
