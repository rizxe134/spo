export type Platform = 'android' | 'ios'

export type Transport = 'usb' | 'wifi' | 'unknown'

export type SessionPhase =
  | 'idle'
  | 'applying'
  | 'active'
  | 'routing'
  | 'paused'
  | 'reconnecting'
  | 'stopping'
  | 'error'
  | 'disconnected'

export type SessionMode = 'fixed' | 'route'

export type RecoveryKind =
  | 'unknown'
  | 'waiting'
  | 'error'
  | 'active'
  | 'applying'
  | 'reconnecting'
  | 'stopping'

export type AckKind = 'command' | 'readback'

export interface Coordinates {
  lat: number
  lng: number
}

export interface LocationFix extends Coordinates {
  alt?: number
  speedMps?: number
  bearing?: number
  accuracy?: number
}

export interface RoutePlayback {
  stops: Coordinates[]
  path: Coordinates[]
  distanceTraveledM: number
  pathLengthM: number
  lastTickAt: number | null
}

export interface RecoveryRecord {
  deviceId: string
  platform: Platform
  kind: RecoveryKind
  mode: SessionMode | null
  target: Coordinates | null
  route: RoutePlayback | null
  updatedAt: number
  message?: string
}

export interface SessionState {
  phase: SessionPhase
  selectedDeviceId: string | null
  lockedDeviceId: string | null
  preview: Coordinates | null
  applied: Coordinates | null
  mode: SessionMode | null
  route: RoutePlayback | null
  lastError: string | null
  lastAckAt: number | null
  lastAckKind: AckKind | null
  recovery: RecoveryRecord | null
  reconnectAttempts: number
}

export interface DeviceInfo {
  id: string
  platform: Platform
  name: string
  transport: Transport
  ready: boolean
  detail: string
}

export interface SavedPlace {
  id: string
  name: string
  lat: number
  lng: number
  createdAt: number
}

export interface RecentSelection {
  id: string
  label: string
  lat: number
  lng: number
  at: number
}

export interface AppSettings {
  photonUrl: string
  osrmUrl: string
  speedMph: number
  adbPath: string
  pythonPath: string
  setupComplete: boolean
  setupOs: 'mac' | 'windows' | 'linux' | null
  setupPhone: 'iphone' | 'android' | null
}

export interface PlaceHit {
  label: string
  lat: number
  lng: number
  country?: string
}

export interface PlannedRoute {
  path: Coordinates[]
  distanceM: number
  durationS: number
}

export interface AppSnapshot {
  session: SessionState
  devices: DeviceInfo[]
  places: SavedPlace[]
  recents: RecentSelection[]
  settings: AppSettings
  adapterNotes: AdapterNotes
}

export interface AdapterNotes {
  android: string
  ios: string
  adbFound: boolean
  iosRuntime: 'available' | 'limited' | 'missing'
}

export const PROTECTED_PHASES: readonly SessionPhase[] = [
  'applying',
  'active',
  'routing',
  'paused',
  'reconnecting',
  'stopping'
]

export const DISCARDABLE_RECOVERY: readonly RecoveryKind[] = ['unknown', 'waiting', 'error']
