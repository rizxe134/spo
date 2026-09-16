import type { DeviceInfo, LocationFix, Platform } from '../../shared/types'

export interface CommandResult {
  stdout: string
  stderr: string
  code: number
}

export interface CommandRunner {
  run(file: string, args: string[], opts?: { timeoutMs?: number }): Promise<CommandResult>
}

export interface PrepareResult {
  ok: boolean
  message: string
}

export interface LocationAck {
  ok: boolean
  kind: 'command' | 'readback'
  message: string
  readback?: LocationFix | null
}

export interface WifiHandoffResult {
  ok: boolean
  newDeviceId?: string
  message: string
}

export interface AdapterAvailability {
  available: boolean
  runtime: 'available' | 'limited' | 'missing'
  message: string
}

export interface DeviceAdapter {
  readonly platform: Platform
  isAvailable(): Promise<AdapterAvailability>
  discover(): Promise<DeviceInfo[]>
  prepare(deviceId: string): Promise<PrepareResult>
  setFixedLocation(deviceId: string, fix: LocationFix): Promise<LocationAck>
  restore(deviceId: string): Promise<PrepareResult>
  startWifiHandoff?(deviceId: string): Promise<WifiHandoffResult>
}
