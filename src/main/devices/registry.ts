import type { DeviceInfo } from '../../shared/types'
import { AndroidAdbAdapter } from './android-adb'
import { IosSidecarAdapter } from './ios-sidecar'
import type { AdapterAvailability, DeviceAdapter, WifiHandoffResult } from './types'

export class DeviceRegistry {
  constructor(
    private readonly android: AndroidAdbAdapter,
    private readonly ios: IosSidecarAdapter
  ) {}

  adapters(): DeviceAdapter[] {
    return [this.android, this.ios]
  }

  adapterFor(platform: DeviceInfo['platform']): DeviceAdapter {
    return platform === 'ios' ? this.ios : this.android
  }

  async notes(): Promise<{
    android: AdapterAvailability
    ios: AdapterAvailability
  }> {
    const [android, ios] = await Promise.all([this.android.isAvailable(), this.ios.isAvailable()])
    return { android, ios }
  }

  async discover(): Promise<DeviceInfo[]> {
    const batches = await Promise.all(
      this.adapters().map(async (adapter) => {
        try {
          return await adapter.discover()
        } catch {
          return [] as DeviceInfo[]
        }
      })
    )
    return batches.flat()
  }

  async wifiHandoff(device: DeviceInfo): Promise<WifiHandoffResult> {
    const adapter = this.adapterFor(device.platform)
    if (!adapter.startWifiHandoff) {
      return { ok: false, message: 'This adapter has no Wi-Fi handoff.' }
    }
    return adapter.startWifiHandoff(device.id)
  }
}
