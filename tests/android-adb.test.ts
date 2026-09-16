import { describe, expect, it } from 'vitest'
import {
  buildAdbArgs,
  buildLocationServiceArgs,
  buildPrepareArgs,
  buildStopLocationArgs,
  parseAdbDevices,
  parseWlanIp
} from '../src/main/devices/android-protocol'
import { AndroidAdbAdapter } from '../src/main/devices/android-adb'
import { ScriptedRunner } from '../src/main/devices/runner'
import { IosSidecarAdapter, buildIosSetArgs, parsePymobiledeviceList } from '../src/main/devices/ios-sidecar'

const SAMPLE_DEVICES = `List of devices attached
emulator-5554          offline transport_id:1
4412abc                device usb:1-3 product:oriole model:Pixel_6 device:oriole transport_id:2
192.168.1.20:5555      device product:oriole model:Pixel_6 device:oriole transport_id:3
unauthorized_phone     unauthorized usb:1-4 product:panther model:Pixel_7
`

describe('android protocol', () => {
  it('parses ready USB and Wi-Fi phones and filters unusable rows', () => {
    const devices = parseAdbDevices(SAMPLE_DEVICES)
    expect(devices.map((item) => item.id)).toEqual([
      'emulator-5554',
      '4412abc',
      '192.168.1.20:5555',
      'unauthorized_phone'
    ])
    const pixel = devices.find((item) => item.id === '4412abc')
    expect(pixel?.ready).toBe(true)
    expect(pixel?.transport).toBe('usb')
    expect(pixel?.name).toBe('Pixel 6')
    expect(devices.find((item) => item.id === '192.168.1.20:5555')?.transport).toBe('wifi')
    expect(devices.find((item) => item.id === 'unauthorized_phone')?.ready).toBe(false)
    expect(devices.find((item) => item.id === 'emulator-5554')?.ready).toBe(false)
  })

  it('always targets an exact serial and never a bare adb shell', () => {
    const args = buildLocationServiceArgs('4412abc', { lat: 41.87, lng: -87.62, accuracy: 5 })
    expect(args.slice(0, 2)).toEqual(['-s', '4412abc'])
    expect(args).toContain('start-foreground-service')
    expect(args).toContain('io.appium.settings/.LocationService')
    expect(args.join(' ')).toContain('41.87')
    expect(args.join(' ')).toContain('-87.62')
    expect(args).toContain('accuracy')
    expect(() => buildAdbArgs('', ['shell'])).toThrow(/exact device serial/)
    expect(buildStopLocationArgs('4412abc')[1]).toBe('4412abc')
    expect(buildPrepareArgs('4412abc').path[1]).toBe('4412abc')
  })

  it('reads a wlan0 IPv4 address', () => {
    expect(parseWlanIp('13: wlan0: <BROADCAST> inet 10.0.0.14/24 brd 10.0.0.255')).toBe('10.0.0.14')
    expect(parseWlanIp('no ip here')).toBeNull()
  })
})

describe('android adapter', () => {
  it('degrades with a clear error when Appium Settings is missing', async () => {
    const runner = new ScriptedRunner(async (_file, args) => {
      if (args.includes('path')) {
        return { stdout: '', stderr: '', code: 1 }
      }
      return { stdout: '', stderr: 'unexpected', code: 1 }
    })
    const adapter = new AndroidAdbAdapter('adb', runner)
    const ack = await adapter.setFixedLocation('4412abc', { lat: 1, lng: 2 })
    expect(ack.ok).toBe(false)
    expect(ack.message).toMatch(/Appium Settings/)
  })

  it('returns a command acknowledgement after a successful service start', async () => {
    const runner = new ScriptedRunner(async (_file, args) => {
      if (args.includes('path')) return { stdout: 'package:/data/app/settings.apk', stderr: '', code: 0 }
      return { stdout: '', stderr: '', code: 0 }
    })
    const adapter = new AndroidAdbAdapter('/opt/adb', runner)
    const ack = await adapter.setFixedLocation('4412abc', { lat: 41.8, lng: -87.6 })
    expect(ack.ok).toBe(true)
    expect(ack.kind).toBe('command')
    expect(ack.message).toMatch(/acknowledged/)
  })

  it('surfaces ADB discovery failures', async () => {
    const runner = new ScriptedRunner(async () => ({
      stdout: '',
      stderr: 'adb: no devices/emulators found',
      code: 1
    }))
    const adapter = new AndroidAdbAdapter('adb', runner)
    await expect(adapter.discover()).rejects.toThrow(/no devices/)
  })
})

describe('ios sidecar stub', () => {
  it('builds pymobiledevice3 simulate-location arguments', () => {
    const args = buildIosSetArgs({ lat: 37.77, lng: -122.41 })
    expect(args).toContain('pymobiledevice3')
    expect(args).toContain('simulate-location')
    expect(args.at(-2)).toBe('37.77')
    expect(args.at(-1)).toBe('-122.41')
  })

  it('parses a JSON device list', () => {
    const devices = parsePymobiledeviceList(
      JSON.stringify([{ UniqueDeviceID: 'UDID1', DeviceName: 'Rishabh iPhone' }])
    )
    expect(devices).toEqual([
      expect.objectContaining({ id: 'UDID1', name: 'Rishabh iPhone', platform: 'ios' })
    ])
  })

  it('refuses Set location on a non-macOS host even if the module imports', async () => {
    const runner = new ScriptedRunner(async (_file, args) => {
      if (args[0] === '-c') return { stdout: 'pymobiledevice3', stderr: '', code: 0 }
      return { stdout: 'should not run', stderr: '', code: 0 }
    })
    const adapter = new IosSidecarAdapter('python3', runner)
    const ack = await adapter.setFixedLocation('UDID1', { lat: 1, lng: 2 })
    if (process.platform === 'darwin') {
      expect(ack.ok).toBe(true)
    } else {
      expect(ack.ok).toBe(false)
      expect(ack.message).toMatch(/macOS|Linux|not macOS/i)
    }
  })
})
