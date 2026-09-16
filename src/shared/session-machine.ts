import {
  DISCARDABLE_RECOVERY,
  PROTECTED_PHASES,
  type Coordinates,
  type RecoveryKind,
  type RecoveryRecord,
  type SessionPhase,
  type SessionState,
  type Platform,
  type SessionMode,
  type AckKind,
  type RoutePlayback
} from './types'
import { sameCoords } from './coordinates'

export type SessionEvent =
  | { type: 'SELECT_DEVICE'; deviceId: string }
  | { type: 'PREVIEW'; coords: Coordinates }
  | { type: 'SET_FIXED' }
  | { type: 'START_ROUTE'; stops: Coordinates[]; path: Coordinates[]; pathLengthM: number }
  | { type: 'APPLY_SUCCEEDED'; coords: Coordinates; at: number; ack: AckKind }
  | { type: 'APPLY_FAILED'; message: string }
  | { type: 'ROUTE_TICK'; coords: Coordinates; playback: RoutePlayback; arrived: boolean; at: number }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'RESTORE' }
  | { type: 'RESTORE_SUCCEEDED' }
  | { type: 'RESTORE_FAILED'; message: string }
  | { type: 'DEVICE_LOST' }
  | { type: 'DEVICE_RECONNECTED' }
  | { type: 'DISCARD_RECOVERY' }
  | { type: 'LOAD_RECOVERY'; record: RecoveryRecord }
  | { type: 'CLEAR_ERROR' }

export function initialSession(): SessionState {
  return {
    phase: 'idle',
    selectedDeviceId: null,
    lockedDeviceId: null,
    preview: null,
    applied: null,
    mode: null,
    route: null,
    lastError: null,
    lastAckAt: null,
    lastAckKind: null,
    recovery: null,
    reconnectAttempts: 0
  }
}

export function isProtectedPhase(phase: SessionPhase): boolean {
  return PROTECTED_PHASES.includes(phase)
}

export function isLivePhase(phase: SessionPhase): boolean {
  return phase === 'active' || phase === 'routing' || phase === 'paused'
}

export function isDiscardableRecovery(kind: RecoveryKind | undefined | null): boolean {
  return kind != null && DISCARDABLE_RECOVERY.includes(kind)
}

export function previewDiffersFromApplied(state: SessionState): boolean {
  if (!state.preview) return false
  if (!state.applied) return true
  return !sameCoords(state.preview, state.applied)
}

export function canSelectDevice(state: SessionState, deviceId: string): boolean {
  if (!state.lockedDeviceId) return true
  if (state.lockedDeviceId === deviceId) return true
  return !isProtectedPhase(state.phase)
}

export function canSetLocation(state: SessionState): boolean {
  if (!state.selectedDeviceId || !state.preview) return false
  if (state.phase === 'applying' || state.phase === 'stopping') return false
  if (state.lockedDeviceId && state.lockedDeviceId !== state.selectedDeviceId) return false
  if (state.phase === 'reconnecting') return false
  return true
}

export function canRestore(state: SessionState): boolean {
  if (state.phase === 'stopping') return false
  return (
    isProtectedPhase(state.phase) ||
    state.phase === 'error' ||
    state.phase === 'disconnected' ||
    state.recovery != null
  )
}

export function canPause(state: SessionState): boolean {
  return state.phase === 'routing'
}

export function canResume(state: SessionState): boolean {
  return state.phase === 'paused'
}

export function applyLabel(state: SessionState): 'Set location' | 'Update location' {
  if (isLivePhase(state.phase) || state.phase === 'reconnecting' || state.phase === 'error') {
    return 'Update location'
  }
  return 'Set location'
}

export function recoveryKindForPhase(phase: SessionPhase): RecoveryKind {
  if (phase === 'error') return 'error'
  if (phase === 'disconnected' || phase === 'reconnecting') return 'waiting'
  if (phase === 'applying') return 'applying'
  if (phase === 'stopping') return 'stopping'
  if (isLivePhase(phase)) return 'active'
  return 'unknown'
}

export function shouldAutoDiscardRecovery(
  recovery: RecoveryRecord | null,
  incomingDeviceId: string | null
): boolean {
  if (!recovery || !incomingDeviceId) return false
  if (recovery.deviceId === incomingDeviceId) return false
  return isDiscardableRecovery(recovery.kind)
}

export function reduceSession(state: SessionState, event: SessionEvent): SessionState {
  switch (event.type) {
    case 'SELECT_DEVICE': {
      if (!canSelectDevice(state, event.deviceId)) {
        return {
          ...state,
          lastError: 'Another phone already owns the live session. Restore it before switching.'
        }
      }
      return { ...state, selectedDeviceId: event.deviceId, lastError: null }
    }
    case 'PREVIEW': {
      return { ...state, preview: event.coords }
    }
    case 'SET_FIXED': {
      if (!canSetLocation(state) || !state.selectedDeviceId || !state.preview) return state
      const next: SessionState = {
        ...state,
        phase: 'applying',
        mode: 'fixed',
        lockedDeviceId: state.selectedDeviceId,
        lastError: null,
        route: null
      }
      return withRecovery(next, 'android')
    }
    case 'START_ROUTE': {
      if (!canSetLocation(state) || !state.selectedDeviceId) return state
      const route: RoutePlayback = {
        stops: event.stops,
        path: event.path,
        distanceTraveledM: 0,
        pathLengthM: event.pathLengthM,
        lastTickAt: null
      }
      const next: SessionState = {
        ...state,
        phase: 'applying',
        mode: 'route',
        lockedDeviceId: state.selectedDeviceId,
        preview: event.path[0] ?? state.preview,
        lastError: null,
        route
      }
      return withRecovery(next, 'android')
    }
    case 'APPLY_SUCCEEDED': {
      const goingRoute = state.mode === 'route' && state.route
      const next: SessionState = {
        ...state,
        phase: goingRoute ? 'routing' : 'active',
        applied: event.coords,
        lastAckAt: event.at,
        lastAckKind: event.ack,
        lastError: null,
        reconnectAttempts: 0
      }
      return withRecovery(next, inferPlatform(next))
    }
    case 'APPLY_FAILED': {
      const next: SessionState = {
        ...state,
        phase: 'error',
        lastError: event.message
      }
      return withRecovery(next, inferPlatform(next), event.message)
    }
    case 'ROUTE_TICK': {
      if (state.phase !== 'routing' || !state.route) return state
      const next: SessionState = {
        ...state,
        applied: event.coords,
        preview: event.coords,
        route: event.playback,
        lastAckAt: event.at,
        phase: event.arrived ? 'active' : 'routing',
        mode: event.arrived ? 'fixed' : 'route'
      }
      return withRecovery(next, inferPlatform(next))
    }
    case 'PAUSE': {
      if (!canPause(state)) return state
      const next: SessionState = { ...state, phase: 'paused' }
      return withRecovery(next, inferPlatform(next))
    }
    case 'RESUME': {
      if (!canResume(state)) return state
      const next: SessionState = { ...state, phase: 'routing' }
      return withRecovery(next, inferPlatform(next))
    }
    case 'RESTORE': {
      if (!canRestore(state)) return state
      const next: SessionState = {
        ...state,
        phase: 'stopping',
        lastError: null
      }
      return withRecovery(next, inferPlatform(next))
    }
    case 'RESTORE_SUCCEEDED': {
      return {
        ...initialSession(),
        selectedDeviceId: state.selectedDeviceId,
        preview: state.preview
      }
    }
    case 'RESTORE_FAILED': {
      const next: SessionState = {
        ...state,
        phase: 'error',
        lastError: event.message
      }
      return withRecovery(next, inferPlatform(next), event.message)
    }
    case 'DEVICE_LOST': {
      if (state.phase === 'idle') return state
      if (state.phase === 'stopping') {
        return withRecovery(
          { ...state, lastError: 'Phone unplugged while restoring. Reconnect to send the clear command.' },
          inferPlatform(state),
          'Phone unplugged while restoring.'
        )
      }
      if (isProtectedPhase(state.phase) || state.phase === 'error') {
        const next: SessionState = {
          ...state,
          phase: 'reconnecting',
          lastError: 'Phone disconnected. Waiting to reconnect the same device. This is not restored.',
          reconnectAttempts: state.reconnectAttempts + 1
        }
        return withRecovery(next, inferPlatform(next), next.lastError ?? undefined)
      }
      return state
    }
    case 'DEVICE_RECONNECTED': {
      if (state.phase !== 'reconnecting' || !state.lockedDeviceId) return state
      const next: SessionState = {
        ...state,
        phase: 'applying',
        lastError: null
      }
      return withRecovery(next, inferPlatform(next))
    }
    case 'DISCARD_RECOVERY': {
      if (state.recovery && !isDiscardableRecovery(state.recovery.kind)) return state
      return {
        ...initialSession(),
        selectedDeviceId: state.selectedDeviceId,
        preview: state.preview
      }
    }
    case 'LOAD_RECOVERY': {
      return {
        ...state,
        recovery: event.record,
        lockedDeviceId: event.record.deviceId,
        selectedDeviceId: event.record.deviceId,
        applied: event.record.target,
        preview: event.record.target ?? state.preview,
        mode: event.record.mode,
        route: event.record.route,
        phase: phaseFromRecovery(event.record.kind),
        lastError: event.record.message ?? null
      }
    }
    case 'CLEAR_ERROR': {
      return { ...state, lastError: null }
    }
    default:
      return state
  }
}

function inferPlatform(state: SessionState): Platform {
  return state.recovery?.platform ?? 'android'
}

function withRecovery(state: SessionState, platform: Platform, message?: string): SessionState {
  if (!state.lockedDeviceId) return { ...state, recovery: null }
  const record: RecoveryRecord = {
    deviceId: state.lockedDeviceId,
    platform,
    kind: recoveryKindForPhase(state.phase),
    mode: state.mode,
    target: state.applied ?? state.preview,
    route: state.route,
    updatedAt: Date.now(),
    message
  }
  return { ...state, recovery: record }
}

function phaseFromRecovery(kind: RecoveryKind): SessionPhase {
  switch (kind) {
    case 'waiting':
      return 'disconnected'
    case 'error':
      return 'error'
    case 'applying':
      return 'applying'
    case 'stopping':
      return 'stopping'
    case 'reconnecting':
      return 'reconnecting'
    case 'active':
      return 'disconnected'
    default:
      return 'disconnected'
  }
}
