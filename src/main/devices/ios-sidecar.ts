import type { DeviceInfo, LocationFix } from '../../shared/types'
import {
  ChildHoldSpawner,
  formatIosSidecarFailure,
  stopHeld,
  waitForHeldStart,
  type HoldHandle,
  type HoldSpawner
} from './held-process'
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

export interface IosSidecarOptions {
  holds?: HoldSpawner
  hostPlatform?: NodeJS.Platform
  settleMs?: number
}

export class IosSidecarAdapter implements DeviceAdapter {
  readonly platform = 'ios' as const
  private held: HoldHandle | null = null
  private heldFix: LocationFix | null = null
  private readonly holds: HoldSpawner
  private readonly hostPlatform: NodeJS.Platform
  private readonly settleMs: number

  constructor(
    private readonly pythonPath: string,
    private readonly runner: CommandRunner = new ProcessRunner(),
    options: IosSidecarOptions = {}
  ) {
    this.holds = options.holds ?? new ChildHoldSpawner()
    this.hostPlatform = options.hostPlatform ?? process.platform
    this.settleMs = options.settleMs ?? 800
  }

  async isAvailable(): Promise<AdapterAvailability> {
    if (this.hostPlatform !== 'darwin') {
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
          'pymobiledevice3 is importable, but this host is not macOS. Discovery may list a phone; Set location will fail until you run Spo on a Mac with Developer Mode paired. See docs/ios-setup.md.'
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

    if (this.held?.alive && sameFix(this.heldFix, fix)) {
      return {
        ok: true,
        kind: 'command',
        message: 'Sidecar is still holding the simulated location. The set process is not required to exit.'
      }
    }

    await stopHeld(this.held)
    this.held = null

    let handle: HoldHandle
    try {
      handle = this.holds.start(this.pythonPath, buildIosSetArgs(fix))
    } catch (error) {
      return {
        ok: false,
        kind: 'command',
        message: error instanceof Error ? error.message : String(error)
      }
    }

    const started = await waitForHeldStart(handle, { settleMs: this.settleMs })
    if (!started.ok) {
      this.held = null
      this.heldFix = null
      return { ok: false, kind: 'command', message: started.message }
    }

    this.held = handle
    this.heldFix = fix
    return {
      ok: true,
      kind: 'command',
      message:
        `${started.message} This is not a GPS reading from Maps or Find My. Restore sends Ctrl+C / clear.`
    }
  }

  async restore(deviceId: string): Promise<PrepareResult> {
    const availability = await this.isAvailable()
    const hadHeld = this.held != null
    await stopHeld(this.held)
    this.held = null
    this.heldFix = null

    if (!availability.available) {
      return hadHeld
        ? { ok: true, message: 'Stopped the holding simulate-location process. clear could not run on this host.' }
        : { ok: false, message: availability.message }
    }

    try {
      const result = await this.runner.run(this.pythonPath, buildIosClearArgs(), { timeoutMs: 15_000 })
      if (result.code === 0) {
        return {
          ok: true,
          message: 'Stopped the holding set process and sent simulate-location clear. Cached apps may keep a reading for a while.'
        }
      }
      const detail = formatIosSidecarFailure(
        result.stdout,
        result.stderr,
        `simulate-location clear failed for ${deviceId}.`
      )
      if (hadHeld) {
        return {
          ok: true,
          message: `Stopped the holding set process (Ctrl+C). clear reported: ${detail}`
        }
      }
      return { ok: false, message: detail }
    } catch (error) {
      if (hadHeld) {
        return {
          ok: true,
          message: `Stopped the holding set process. clear did not finish: ${error instanceof Error ? error.message : String(error)}`
        }
      }
      return { ok: false, message: error instanceof Error ? error.message : String(error) }
    }
  }

  async dispose(): Promise<void> {
    await stopHeld(this.held)
    this.held = null
    this.heldFix = null
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

function sameFix(a: LocationFix | null, b: LocationFix): boolean {
  if (!a) return false
  return Math.abs(a.lat - b.lat) < 1e-7 && Math.abs(a.lng - b.lng) < 1e-7
}
