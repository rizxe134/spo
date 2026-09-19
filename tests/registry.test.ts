import { describe, expect, it } from 'vitest'
import { AndroidAdbAdapter } from '../src/main/devices/android-adb'
import { IosSidecarAdapter } from '../src/main/devices/ios-sidecar'
import { DeviceRegistry } from '../src/main/devices/registry'
import { ScriptedRunner } from '../src/main/devices/runner'

function iosListing(udid: string): IosSidecarAdapter {
  const runner = new ScriptedRunner(async (_file, args) => {
    if (args[0] === '-c') return { stdout: 'pymobiledevice3', stderr: '', code: 0 }
    if (args.includes('list')) {
      return {
        stdout: JSON.stringify([{ UniqueDeviceID: udid, DeviceName: udid }]),
        stderr: '',
        code: 0
      }
    }
    return { stdout: '', stderr: '', code: 0 }
  })
  return new IosSidecarAdapter('python3', runner, { hostPlatform: 'darwin', settleMs: 20 })
}

describe('DeviceRegistry.replaceIos', () => {
  it('discovers with the replacement sidecar after dispose', async () => {
    const android = new AndroidAdbAdapter(
      'adb',
      new ScriptedRunner(async () => ({ stdout: '', stderr: '', code: 1 }))
    )
    const first = iosListing('OLD')
    const registry = new DeviceRegistry(android, first)
    expect((await registry.discover()).map((device) => device.id)).toEqual(['OLD'])

    await registry.replaceIos(iosListing('NEW'))
    expect((await registry.discover()).map((device) => device.id)).toEqual(['NEW'])
  })
})
