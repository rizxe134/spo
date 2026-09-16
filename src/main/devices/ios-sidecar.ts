import type { DeviceInfo, LocationFix } from '../../shared/types'
import { ProcessRunner } from './runner'
import type {
  AdapterAvailability,
  DeviceAdapter,
  LocationAck,
  PrepareResult,
  WifiHandoffResult,
  CommandRunner
} from './types'

export function buildIosListArgs(): string[] {
  return ['-m', 'pymobiledevice3', 'usbmux', 'list']
}

export function buildIosSetArgs(fix: LocationFix): string[] {
  return ['-m', 'pymobiledevice3', 'developer', 'dvt', 'simulate-location', 'set', '--', String(fix.lat), String(fix.lng)]
}

export function buildIosClearArgs(): string[] {
  return ['-m', 'pymobiledevice3', 'developer', 'dvt', 'simulate-location', 'clear']
}

export function parsePymobiledeviceList(output: string): DeviceInfo[] {
  const trimmed = output.trim()
  if (!trimmed) return []

  try {
    const parsed = JSON.parse(trimmed) as unknown
    const rows = Array.isArray(parsed) ? parsed : [parsed]
    return rows.flatMap((row) => {
      if (!row || typeof row !== 'object') return []
      const record = row as Record<string, unknown>
      const udid = String(record.UniqueDeviceID ?? record.udid ?? record.Identifier ?? '')
      if (!udid) return []
      const name = String(record.DeviceName ?? record.name ?? `iPhone ${udid.slice(0, 8)}`)
      return [
        {
          id: udid,
          platform: 'ios' as const,
          name,
          transport: 'usb' as const,
          ready: true,
          detail: 'Listed by pymobiledevice3 — location simulation still needs a Developer Mode pair'
        }
      ]
    })
  } catch {
    return []
  }
}

export class IosSidecarAdapter implements DeviceAdapter {
  readonly platform = 'ios' as const

  constructor(
    private readonly pythonPath: string,
    private readonly runner: CommandRunner = new ProcessRunner()
  ) {}

  async isAvailable(): Promise<AdapterAvailability> {
    if (process.platform !== 'darwin') {
      const probe = await this.probeModule()
      if (!probe.installed) {
        return {
          available: false,
          runtime: 'missing',
          message:
            'iOS location simulation is a macOS sidecar (pymobiledevice3). It is not installed here, and Linux cannot complete DVT simulate-location. See docs/ios-setup.md.'
        }
      }
      return {
        available: false,
        runtime: 'limited',
        message:
          'pymobiledevice3 is importable, but this host is not macOS. Discovery may list a phone; Set location will fail until you run Pinpoint on a Mac with Developer Mode paired. See docs/ios-setup.md.'
      }
    }

    const probe = await this.probeModule()
    if (!probe.installed) {
      return {
        available: false,
        runtime: 'missing',
        message:
          `Could not import pymobiledevice3 with ${this.pythonPath}. Install it on this Mac: python3 -m pip install pymobiledevice3. See docs/ios-setup.md.`
      }
    }
    return {
      available: true,
      runtime: 'available',
      message: 'pymobiledevice3 sidecar is available on this Mac.'
    }
  }

  async discover(): Promise<DeviceInfo[]> {
    const availability = await this.isAvailable()
    if (availability.runtime === 'missing') return []
    try {
      const result = await this.runner.run(this.pythonPath, buildIosListArgs(), { timeoutMs: 12_000 })
      if (result.code !== 0) return []
      return parsePymobiledeviceList(result.stdout || result.stderr)
    } catch {
      return []
    }
  }

  async prepare(deviceId: string): Promise<PrepareResult> {
    const availability = await this.isAvailable()
    if (!availability.available) {
      return {
        ok: false,
        message: `${availability.message} Device ${deviceId} cannot be prepared on this host.`
      }
    }
    return { ok: true, message: 'iOS sidecar is present. Unlock the iPhone and keep Developer Mode on.' }
  }

  async setFixedLocation(deviceId: string, fix: LocationFix): Promise<LocationAck> {
    const availability = await this.isAvailable()
    if (!availability.available) {
      return {
        ok: false,
        kind: 'command',
        message: availability.message
      }
    }
    const result = await this.runner.run(this.pythonPath, buildIosSetArgs(fix), { timeoutMs: 20_000 })
    if (result.code !== 0) {
      return {
        ok: false,
        kind: 'command',
        message:
          result.stderr.trim() ||
          result.stdout.trim() ||
          `pymobiledevice3 refused simulate-location set for ${deviceId}.`
      }
    }
    return {
      ok: true,
      kind: 'command',
      message:
        'Sidecar acknowledged the DVT simulate-location command. That is not a GPS reading from Maps or Find My.'
    }
  }

  async restore(deviceId: string): Promise<PrepareResult> {
    const availability = await this.isAvailable()
    if (!availability.available) {
      return { ok: false, message: availability.message }
    }
    const result = await this.runner.run(this.pythonPath, buildIosClearArgs(), { timeoutMs: 20_000 })
    if (result.code !== 0) {
      return {
        ok: false,
        message:
          result.stderr.trim() ||
          result.stdout.trim() ||
          `Could not clear the simulated location on ${deviceId}. Cached apps may keep the last fix until they refresh.`
      }
    }
    return { ok: true, message: 'Sent simulate-location clear. Other apps may keep a cached reading for a while.' }
  }

  async startWifiHandoff(): Promise<WifiHandoffResult> {
    return {
      ok: false,
      message:
        'iOS Wi-Fi handoff is not implemented in this personal build. Keep the USB pair, or continue on macOS with a documented tunnel setup later.'
    }
  }

  private async probeModule(): Promise<{ installed: boolean; detail: string }> {
    try {
      const result = await this.runner.run(
        this.pythonPath,
        ['-c', 'import pymobiledevice3,sys; print(pymobiledevice3.__name__)'],
        { timeoutMs: 8_000 }
      )
      return { installed: result.code === 0, detail: result.stdout.trim() || result.stderr.trim() }
    } catch (error) {
      return { installed: false, detail: error instanceof Error ? error.message : String(error) }
    }
  }
}
