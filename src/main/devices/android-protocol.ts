import { APPIUM_LOCATION_SERVICE, APPIUM_SETTINGS_PKG } from '../../shared/constants'
import type { DeviceInfo, LocationFix } from '../../shared/types'

const READY_STATES = new Set(['device'])

export function parseAdbDevices(output: string): DeviceInfo[] {
  const lines = output.split(/\r?\n/).map((line) => line.trim())
  const devices: DeviceInfo[] = []

  for (const line of lines) {
    if (!line || line.startsWith('List of devices')) continue
    const parts = line.split(/\s+/)
    const serial = parts[0]
    const state = parts[1]
    if (!serial || !state) continue
    if (serial === '*') continue

    const props = parseProps(parts.slice(2))
    const model = props.model?.replace(/_/g, ' ')
    const transport = serial.includes(':') ? 'wifi' : props.usb ? 'usb' : 'unknown'
    const ready = READY_STATES.has(state)
    const detail = describeState(state, transport)

    devices.push({
      id: serial,
      platform: 'android',
      name: model ? `${model}` : `Android ${serial}`,
      transport,
      ready,
      detail
    })
  }

  return devices
}

export function buildAdbArgs(serial: string, rest: string[]): string[] {
  if (!serial.trim()) {
    throw new Error('ADB commands require an exact device serial.')
  }
  return ['-s', serial, ...rest]
}

export function buildLocationServiceArgs(serial: string, fix: LocationFix): string[] {
  return buildAdbArgs(serial, [
    'shell',
    'am',
    'start-foreground-service',
    '--user',
    '0',
    '-n',
    APPIUM_LOCATION_SERVICE,
    '--es',
    'longitude',
    String(fix.lng),
    '--es',
    'latitude',
    String(fix.lat),
    '--es',
    'altitude',
    String(fix.alt ?? 0),
    '--es',
    'speed',
    String(fix.speedMps ?? 0),
    '--es',
    'bearing',
    String(fix.bearing ?? 0),
    '--es',
    'accuracy',
    String(fix.accuracy ?? 5)
  ])
}

export function buildStopLocationArgs(serial: string): string[] {
  return buildAdbArgs(serial, ['shell', 'am', 'stopservice', APPIUM_LOCATION_SERVICE])
}

export function buildPrepareArgs(serial: string): { grant: string[]; mock: string[]; path: string[] } {
  return {
    path: buildAdbArgs(serial, ['shell', 'pm', 'path', APPIUM_SETTINGS_PKG]),
    grant: buildAdbArgs(serial, [
      'shell',
      'pm',
      'grant',
      APPIUM_SETTINGS_PKG,
      'android.permission.ACCESS_FINE_LOCATION'
    ]),
    mock: buildAdbArgs(serial, [
      'shell',
      'appops',
      'set',
      APPIUM_SETTINGS_PKG,
      'android:mock_location',
      'allow'
    ])
  }
}

export function buildWifiIpArgs(serial: string): string[] {
  return buildAdbArgs(serial, ['shell', 'ip', '-f', 'inet', 'addr', 'show', 'wlan0'])
}

export function buildTcpipArgs(serial: string, port = 5555): string[] {
  return buildAdbArgs(serial, ['tcpip', String(port)])
}

export function parseWlanIp(output: string): string | null {
  const match = output.match(/inet\s+(\d+\.\d+\.\d+\.\d+)/)
  return match?.[1] ?? null
}

export function parsePackagePath(output: string): boolean {
  return /package:\//.test(output)
}

function parseProps(tokens: string[]): Record<string, string> {
  const props: Record<string, string> = {}
  for (const token of tokens) {
    const idx = token.indexOf(':')
    if (idx <= 0) continue
    props[token.slice(0, idx)] = token.slice(idx + 1)
  }
  return props
}

function describeState(state: string, transport: DeviceInfo['transport']): string {
  if (state === 'device') {
    return transport === 'wifi' ? 'Ready over Wi-Fi ADB' : 'Ready over USB'
  }
  if (state === 'unauthorized') {
    return 'Unauthorized — unlock the phone and accept the RSA prompt'
  }
  if (state === 'offline') {
    return 'Offline — replug the cable or restart ADB'
  }
  if (state === 'no permissions') {
    return 'No permissions — add udev rules or run ADB as a permitted user'
  }
  return `Not ready (${state})`
}
