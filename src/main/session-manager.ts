import { DEVICE_POLL_MS, FIXED_REASSERT_MS, ROUTE_TICK_MS } from '../shared/constants'
import { metersPerTick, polylineLengthMeters, tickPlayback, toMps } from '../shared/route-math'
import {
  applyLabel,
  canRestore,
  canSetLocation,
  initialSession,
  reduceSession,
  shouldAutoDiscardRecovery,
  type SessionEvent
} from '../shared/session-machine'
import type {
  AdapterNotes,
  AppSnapshot,
  Coordinates,
  DeviceInfo,
  LocationFix,
  SessionState
} from '../shared/types'
import { DeviceRegistry } from './devices/registry'
import type { JsonStore } from './store'

export type StateListener = (snapshot: AppSnapshot) => void

export class SessionManager {
  private session = initialSession()
  private devices: DeviceInfo[] = []
  private notes: AdapterNotes = {
    android: 'Checking ADB…',
    ios: 'Checking iOS sidecar…',
    adbFound: false,
    iosRuntime: 'missing'
  }
  private listeners = new Set<StateListener>()
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private routeTimer: ReturnType<typeof setInterval> | null = null
  private reassertTimer: ReturnType<typeof setInterval> | null = null
  private busy = false

  constructor(
    private readonly registry: DeviceRegistry,
    private readonly store: JsonStore,
    private readonly speedMph: () => number
  ) {
    if (store.snapshot.recovery) {
      this.session = reduceSession(this.session, { type: 'LOAD_RECOVERY', record: store.snapshot.recovery })
    }
  }

  onChange(listener: StateListener): () => void {
    this.listeners.add(listener)
    listener(this.snapshot())
    return () => this.listeners.delete(listener)
  }

  snapshot(): AppSnapshot {
    return {
      session: this.session,
      devices: this.devices,
      places: this.store.snapshot.places,
      recents: this.store.snapshot.recents,
      settings: this.store.snapshot.settings,
      adapterNotes: this.notes
    }
  }

  start(): void {
    void this.refreshAdapters()
    void this.pollDevices()
    this.pollTimer = setInterval(() => {
      void this.pollDevices()
    }, DEVICE_POLL_MS)
  }

  stop(): void {
    if (this.pollTimer) clearInterval(this.pollTimer)
    this.clearPlaybackTimers()
  }

  async refreshAdapters(): Promise<void> {
    const notes = await this.registry.notes()
    this.notes = {
      android: notes.android.message,
      ios: notes.ios.message,
      adbFound: notes.android.available,
      iosRuntime: notes.ios.runtime
    }
    this.emit()
  }

  selectDevice(deviceId: string): void {
    this.dispatch({ type: 'SELECT_DEVICE', deviceId })
  }

  preview(coords: Coordinates): void {
    this.dispatch({ type: 'PREVIEW', coords })
  }

  async applyFixed(): Promise<void> {
    if (!canSetLocation(this.session) || !this.session.preview || !this.session.selectedDeviceId) {
      this.dispatch({ type: 'APPLY_FAILED', message: 'Choose a phone and a preview pin before applying.' })
      return
    }
    this.dispatch({ type: 'SET_FIXED' })
    await this.pushApplied(this.session.preview)
  }

  async startRoute(stops: Coordinates[], path: Coordinates[]): Promise<void> {
    if (stops.length < 2 || path.length < 2) {
      this.dispatch({ type: 'APPLY_FAILED', message: 'Plan a road route with at least two stops first.' })
      return
    }
    this.dispatch({
      type: 'START_ROUTE',
      stops,
      path,
      pathLengthM: polylineLengthMeters(path)
    })
    const first = path[0]
    await this.pushApplied(first, { speedMps: toMps(this.speedMph()) })
    if (this.session.phase === 'routing' || this.session.phase === 'active') {
      this.beginRouteTicks()
    }
  }

  pause(): void {
    this.dispatch({ type: 'PAUSE' })
    if (this.session.phase === 'paused') {
      this.clearRouteTimer()
    }
  }

  resume(): void {
    this.dispatch({ type: 'RESUME' })
    if (this.session.phase === 'routing') {
      this.beginRouteTicks()
    }
  }

  async restore(): Promise<boolean> {
    if (!canRestore(this.session)) return true
    const deviceId = this.session.lockedDeviceId ?? this.session.selectedDeviceId
    const device = this.devices.find((item) => item.id === deviceId)
    this.dispatch({ type: 'RESTORE' })
    this.clearPlaybackTimers()
    if (!deviceId) {
      this.dispatch({ type: 'RESTORE_SUCCEEDED' })
      return true
    }
    if (!device) {
      this.dispatch({
        type: 'RESTORE_FAILED',
        message: 'The phone is unplugged. Reconnect the same device before Pinpoint can send Restore.'
      })
      return false
    }
    try {
      const result = await this.registry.adapterFor(device.platform).restore(device.id)
      if (!result.ok) {
        this.dispatch({ type: 'RESTORE_FAILED', message: result.message })
        return false
      }
      this.dispatch({ type: 'RESTORE_SUCCEEDED' })
      return true
    } catch (error) {
      this.dispatch({ type: 'RESTORE_FAILED', message: asMessage(error) })
      return false
    }
  }

  async retry(): Promise<void> {
    if (this.session.mode === 'route' && this.session.route) {
      await this.pushApplied(this.session.applied ?? this.session.route.path[0], {
        speedMps: toMps(this.speedMph())
      })
      if (this.session.phase === 'routing' || this.session.phase === 'active') {
        this.beginRouteTicks()
      }
      return
    }
    if (this.session.preview) {
      await this.applyFixed()
    }
  }

  async wifiHandoff(): Promise<string> {
    const device = this.selectedDevice()
    if (!device) return 'Select a phone first.'
    const result = await this.registry.wifiHandoff(device)
    if (result.ok && result.newDeviceId) {
      this.session = {
        ...this.session,
        selectedDeviceId: result.newDeviceId,
        lockedDeviceId: this.session.lockedDeviceId ? result.newDeviceId : this.session.lockedDeviceId
      }
      await this.pollDevices()
    }
    return result.message
  }

  applyLabel(): ReturnType<typeof applyLabel> {
    return applyLabel(this.session)
  }

  rememberPreview(label: string): void {
    if (!this.session.preview) return
    this.store.remember({
      id: `${this.session.preview.lat.toFixed(5)},${this.session.preview.lng.toFixed(5)}`,
      label,
      lat: this.session.preview.lat,
      lng: this.session.preview.lng,
      at: Date.now()
    })
    this.emit()
  }

  notify(): void {
    this.emit()
  }

  private async pushApplied(coords: Coordinates, extra?: Partial<LocationFix>): Promise<void> {
    const device = this.selectedDevice()
    if (!device) {
      this.dispatch({
        type: 'APPLY_FAILED',
        message: 'No phone is selected, or it disappeared from the device list.'
      })
      return
    }
    if (this.busy) return
    this.busy = true
    try {
      const fix: LocationFix = { ...coords, accuracy: 5, ...extra }
      const ack = await this.registry.adapterFor(device.platform).setFixedLocation(device.id, fix)
      if (!ack.ok) {
        this.dispatch({ type: 'APPLY_FAILED', message: ack.message })
        return
      }
      this.dispatch({
        type: 'APPLY_SUCCEEDED',
        coords,
        at: Date.now(),
        ack: ack.kind
      })
      this.beginReassert()
    } catch (error) {
      this.dispatch({ type: 'APPLY_FAILED', message: asMessage(error) })
    } finally {
      this.busy = false
    }
  }

  private beginRouteTicks(): void {
    this.clearRouteTimer()
    this.routeTimer = setInterval(() => {
      void this.advanceRoute()
    }, ROUTE_TICK_MS)
  }

  private async advanceRoute(): Promise<void> {
    if (this.session.phase !== 'routing' || !this.session.route) return
    const stepped = tickPlayback(this.session.route, toMps(this.speedMph()), ROUTE_TICK_MS)
    const device = this.lockedDevice()
    if (!device) {
      this.dispatch({ type: 'DEVICE_LOST' })
      this.clearRouteTimer()
      return
    }
    try {
      const ack = await this.registry.adapterFor(device.platform).setFixedLocation(device.id, {
        ...stepped.position,
        speedMps: toMps(this.speedMph()),
        bearing: stepped.bearing,
        accuracy: 8
      })
      if (!ack.ok) {
        this.dispatch({ type: 'APPLY_FAILED', message: ack.message })
        this.clearRouteTimer()
        return
      }
      this.dispatch({
        type: 'ROUTE_TICK',
        coords: stepped.position,
        playback: stepped.playback,
        arrived: stepped.arrived,
        at: Date.now()
      })
      if (stepped.arrived) {
        this.clearRouteTimer()
        this.beginReassert()
      }
    } catch (error) {
      this.dispatch({ type: 'APPLY_FAILED', message: asMessage(error) })
      this.clearRouteTimer()
    }
  }

  private beginReassert(): void {
    this.clearReassertTimer()
    if (this.session.phase !== 'active' || !this.session.applied) return
    this.reassertTimer = setInterval(() => {
      void this.reassertFixed()
    }, FIXED_REASSERT_MS)
  }

  private async reassertFixed(): Promise<void> {
    if (this.session.phase !== 'active' || !this.session.applied) return
    const device = this.lockedDevice()
    if (!device) {
      this.dispatch({ type: 'DEVICE_LOST' })
      return
    }
    try {
      const ack = await this.registry.adapterFor(device.platform).setFixedLocation(device.id, this.session.applied)
      if (!ack.ok) {
        this.dispatch({ type: 'DEVICE_LOST' })
        return
      }
      this.dispatch({
        type: 'APPLY_SUCCEEDED',
        coords: this.session.applied,
        at: Date.now(),
        ack: ack.kind
      })
    } catch {
      this.dispatch({ type: 'DEVICE_LOST' })
    }
  }

  private async pollDevices(): Promise<void> {
    try {
      const devices = await this.registry.discover()
      this.devices = devices
      this.reconcilePresence()
    } catch (error) {
      this.notes = {
        ...this.notes,
        android: asMessage(error)
      }
    }
    this.emit()
  }

  private reconcilePresence(): void {
    const incoming = this.devices.find((item) => item.ready)
    if (shouldAutoDiscardRecovery(this.session.recovery, incoming?.id ?? null)) {
      this.dispatch({ type: 'DISCARD_RECOVERY' })
      if (incoming) this.dispatch({ type: 'SELECT_DEVICE', deviceId: incoming.id })
      return
    }

    const locked = this.session.lockedDeviceId
    if (!locked) {
      if (!this.session.selectedDeviceId && incoming) {
        this.dispatch({ type: 'SELECT_DEVICE', deviceId: incoming.id })
      }
      return
    }

    const present = this.devices.find((item) => item.id === locked && item.ready)
    if (!present && this.session.phase !== 'idle') {
      if (this.session.phase !== 'reconnecting' && this.session.phase !== 'disconnected') {
        this.dispatch({ type: 'DEVICE_LOST' })
        this.clearRouteTimer()
      }
      return
    }
    if (present && this.session.phase === 'reconnecting') {
      this.dispatch({ type: 'DEVICE_RECONNECTED' })
      const target = this.session.applied ?? this.session.preview
      if (target) void this.pushApplied(target)
    }
  }

  private dispatch(event: SessionEvent): void {
    this.session = reduceSession(this.session, event)
    this.store.setRecovery(this.session.recovery)
    this.emit()
  }

  private emit(): void {
    const snap = this.snapshot()
    for (const listener of this.listeners) listener(snap)
  }

  private selectedDevice(): DeviceInfo | undefined {
    const id = this.session.selectedDeviceId
    return this.devices.find((item) => item.id === id)
  }

  private lockedDevice(): DeviceInfo | undefined {
    const id = this.session.lockedDeviceId ?? this.session.selectedDeviceId
    return this.devices.find((item) => item.id === id)
  }

  private clearPlaybackTimers(): void {
    this.clearRouteTimer()
    this.clearReassertTimer()
  }

  private clearRouteTimer(): void {
    if (this.routeTimer) {
      clearInterval(this.routeTimer)
      this.routeTimer = null
    }
  }

  private clearReassertTimer(): void {
    if (this.reassertTimer) {
      clearInterval(this.reassertTimer)
      this.reassertTimer = null
    }
  }
}

export function describeMetersPerTick(speedMph: number): number {
  return metersPerTick(speedMph, ROUTE_TICK_MS)
}

function asMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
