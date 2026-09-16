import { APPIUM_SETTINGS_PKG } from '../../shared/constants'
import type { DeviceInfo, LocationFix } from '../../shared/types'
import {
  buildLocationServiceArgs,
  buildPrepareArgs,
  buildStopLocationArgs,
  buildTcpipArgs,
  buildWifiIpArgs,
  parseAdbDevices,
  parsePackagePath,
  parseWlanIp
} from './android-protocol'
import { ProcessRunner } from './runner'
import type {
  AdapterAvailability,
  DeviceAdapter,
  LocationAck,
  PrepareResult,
  WifiHandoffResult,
  CommandRunner
} from './types'

export class AndroidAdbAdapter implements DeviceAdapter {
  readonly platform = 'android' as const

  constructor(
    private readonly adbPath: string,
    private readonly runner: CommandRunner = new ProcessRunner()
  ) {}

  async isAvailable(): Promise<AdapterAvailability> {
    try {
      const result = await this.runner.run(this.adbPath, ['version'], { timeoutMs: 8_000 })
      if (result.code !== 0) {
        return {
          available: false,
          runtime: 'missing',
          message: `ADB at ${this.adbPath} did not report a version. ${result.stderr || result.stdout}`.trim()
        }
      }
      return {
        available: true,
        runtime: 'available',
        message: result.stdout.trim().split('\n')[0] ?? 'ADB found'
      }
    } catch (error) {
      return {
        available: false,
        runtime: 'missing',
        message: `ADB is not callable at ${this.adbPath}. Install platform-tools or set the path in Settings. ${asMessage(error)}`
      }
    }
  }

  async discover(): Promise<DeviceInfo[]> {
    const result = await this.runner.run(this.adbPath, ['devices', '-l'], { timeoutMs: 10_000 })
    if (result.code !== 0) {
      throw new Error(result.stderr.trim() || 'adb devices failed.')
    }
    return parseAdbDevices(result.stdout)
  }

  async prepare(deviceId: string): Promise<PrepareResult> {
    const args = buildPrepareArgs(deviceId)
    const pathResult = await this.runner.run(this.adbPath, args.path)
    if (!parsePackagePath(pathResult.stdout)) {
      return {
        ok: false,
        message:
          `Appium Settings (${APPIUM_SETTINGS_PKG}) is not installed on ${deviceId}. ` +
          'Sideload the helper APK, then select it as the mock location app. See docs/android-setup.md.'
      }
    }
    await this.runner.run(this.adbPath, args.grant)
    const mock = await this.runner.run(this.adbPath, args.mock)
    if (mock.code !== 0) {
      return {
        ok: false,
        message:
          `Could not allow mock locations for Appium Settings on ${deviceId}. ` +
          'Set it manually under Developer options. ' +
          (mock.stderr || mock.stdout)
      }
    }
    return { ok: true, message: 'Mock-location helper is installed and allowed.' }
  }

  async setFixedLocation(deviceId: string, fix: LocationFix): Promise<LocationAck> {
    const prepared = await this.prepare(deviceId)
    if (!prepared.ok) {
      return { ok: false, kind: 'command', message: prepared.message }
    }
    const result = await this.runner.run(this.adbPath, buildLocationServiceArgs(deviceId, fix))
    if (result.code !== 0) {
      return {
        ok: false,
        kind: 'command',
        message:
          result.stderr.trim() ||
          result.stdout.trim() ||
          'ADB could not start the Appium Settings location service.'
      }
    }
    return {
      ok: true,
      kind: 'command',
      message:
        'ADB acknowledged the mock-location command. The helper reasserts about every two seconds. ' +
        'This is not proof that a maps app already shows a fresh fix.',
      readback: null
    }
  }

  async restore(deviceId: string): Promise<PrepareResult> {
    const result = await this.runner.run(this.adbPath, buildStopLocationArgs(deviceId))
    if (result.code !== 0) {
      return {
        ok: false,
        message:
          result.stderr.trim() ||
          result.stdout.trim() ||
          'Could not stop the Appium Settings location service. The last mock may still be active on the phone.'
      }
    }
    return { ok: true, message: 'Asked Appium Settings to stop the mock-location service.' }
  }

  async startWifiHandoff(deviceId: string): Promise<WifiHandoffResult> {
    if (deviceId.includes(':')) {
      return { ok: false, message: 'This phone is already addressed as host:port. Nothing to hand off.' }
    }
    const ipResult = await this.runner.run(this.adbPath, buildWifiIpArgs(deviceId))
    const ip = parseWlanIp(ipResult.stdout)
    if (!ip) {
      return {
        ok: false,
        message: 'Could not read a wlan0 IPv4 address. Join the same Wi-Fi network and try again.'
      }
    }
    const tcpip = await this.runner.run(this.adbPath, buildTcpipArgs(deviceId, 5555))
    if (tcpip.code !== 0) {
      return { ok: false, message: tcpip.stderr.trim() || 'adb tcpip 5555 failed.' }
    }
    const connect = await this.runner.run(this.adbPath, ['connect', `${ip}:5555`])
    const text = `${connect.stdout} ${connect.stderr}`
    if (connect.code !== 0 || /failed|unable/i.test(text)) {
      return { ok: false, message: text.trim() || `Could not connect to ${ip}:5555.` }
    }
    return {
      ok: true,
      newDeviceId: `${ip}:5555`,
      message: `USB session handed off to ${ip}:5555. You can unplug after the new serial appears as ready.`
    }
  }
}

function asMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
