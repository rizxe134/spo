import { describe, expect, it } from 'vitest'
import {
  applyLabel,
  canSelectDevice,
  canSetLocation,
  initialSession,
  previewDiffersFromApplied,
  reduceSession,
  shouldAutoDiscardRecovery
} from '../src/shared/session-machine'
import type { RecoveryRecord, SessionState } from '../src/shared/types'

const chicago = { lat: 41.8781, lng: -87.6298 }
const loop = { lat: 41.883, lng: -87.625 }

function withPreview(deviceId = 'pixel'): SessionState {
  let state = initialSession()
  state = reduceSession(state, { type: 'SELECT_DEVICE', deviceId })
  state = reduceSession(state, { type: 'PREVIEW', coords: chicago })
  return state
}

function applied(deviceId = 'pixel'): SessionState {
  let state = withPreview(deviceId)
  state = reduceSession(state, { type: 'SET_FIXED' })
  state = reduceSession(state, {
    type: 'APPLY_SUCCEEDED',
    coords: chicago,
    at: 1,
    ack: 'command'
  })
  return state
}

describe('session machine', () => {
  it('keeps pin selection as preview until Set location', () => {
    const state = withPreview()
    expect(state.phase).toBe('idle')
    expect(state.preview).toEqual(chicago)
    expect(state.applied).toBeNull()
    expect(previewDiffersFromApplied(state)).toBe(true)
    expect(applyLabel(state)).toBe('Set location')
    expect(canSetLocation(state)).toBe(true)
  })

  it('applies a fixed location and then labels the action Update', () => {
    const state = applied()
    expect(state.phase).toBe('active')
    expect(state.applied).toEqual(chicago)
    expect(state.lockedDeviceId).toBe('pixel')
    expect(applyLabel(state)).toBe('Update location')
    expect(previewDiffersFromApplied(state)).toBe(false)
  })

  it('lets Update change only after a new preview', () => {
    let state = applied()
    state = reduceSession(state, { type: 'PREVIEW', coords: loop })
    expect(state.phase).toBe('active')
    expect(state.applied).toEqual(chicago)
    expect(previewDiffersFromApplied(state)).toBe(true)
    state = reduceSession(state, { type: 'SET_FIXED' })
    expect(state.phase).toBe('applying')
    state = reduceSession(state, { type: 'APPLY_SUCCEEDED', coords: loop, at: 2, ack: 'command' })
    expect(state.applied).toEqual(loop)
    expect(state.phase).toBe('active')
  })

  it('blocks a second phone while a session is protected', () => {
    const state = applied('pixel')
    expect(canSelectDevice(state, 'galaxy')).toBe(false)
    const next = reduceSession(state, { type: 'SELECT_DEVICE', deviceId: 'galaxy' })
    expect(next.selectedDeviceId).toBe('pixel')
    expect(next.lastError).toMatch(/owns the live session/)
  })

  it('marks disconnect as not restored and reconnects the same phone', () => {
    let state = applied()
    state = reduceSession(state, { type: 'DEVICE_LOST' })
    expect(state.phase).toBe('reconnecting')
    expect(state.lastError).toMatch(/not restored/)
    expect(state.recovery?.kind).toBe('waiting')
    state = reduceSession(state, { type: 'DEVICE_RECONNECTED' })
    expect(state.phase).toBe('applying')
    expect(state.lockedDeviceId).toBe('pixel')
  })

  it('Restore clears the session back to idle and keeps the preview', () => {
    let state = applied()
    state = reduceSession(state, { type: 'RESTORE' })
    expect(state.phase).toBe('stopping')
    state = reduceSession(state, { type: 'RESTORE_SUCCEEDED' })
    expect(state.phase).toBe('idle')
    expect(state.applied).toBeNull()
    expect(state.lockedDeviceId).toBeNull()
    expect(state.preview).toEqual(chicago)
    expect(state.recovery).toBeNull()
  })

  it('failed apply becomes an unresolved error recovery', () => {
    let state = withPreview()
    state = reduceSession(state, { type: 'SET_FIXED' })
    state = reduceSession(state, { type: 'APPLY_FAILED', message: 'no device' })
    expect(state.phase).toBe('error')
    expect(state.recovery?.kind).toBe('error')
    expect(state.lastError).toBe('no device')
  })

  it('discards unknown/waiting/error recovery when a different USB phone appears', () => {
    const waiting: RecoveryRecord = {
      deviceId: 'old-phone',
      platform: 'android',
      kind: 'waiting',
      mode: 'fixed',
      target: chicago,
      route: null,
      updatedAt: 1
    }
    expect(shouldAutoDiscardRecovery(waiting, 'new-phone')).toBe(true)
    expect(shouldAutoDiscardRecovery(waiting, 'old-phone')).toBe(false)

    const protectedRecord: RecoveryRecord = { ...waiting, kind: 'active' }
    expect(shouldAutoDiscardRecovery(protectedRecord, 'new-phone')).toBe(false)

    let state = reduceSession(initialSession(), { type: 'LOAD_RECOVERY', record: waiting })
    expect(state.phase).toBe('disconnected')
    state = reduceSession(state, { type: 'DISCARD_RECOVERY' })
    expect(state.phase).toBe('idle')
    expect(state.recovery).toBeNull()
  })

  it('does not discard recovery while applying, reconnecting, or stopping', () => {
    const applying: RecoveryRecord = {
      deviceId: 'pixel',
      platform: 'android',
      kind: 'applying',
      mode: 'fixed',
      target: chicago,
      route: null,
      updatedAt: 1
    }
    expect(shouldAutoDiscardRecovery(applying, 'galaxy')).toBe(false)
  })

  it('pauses and resumes a route without losing distance', () => {
    let state = withPreview()
    state = reduceSession(state, {
      type: 'START_ROUTE',
      stops: [chicago, loop],
      path: [chicago, loop],
      pathLengthM: 800
    })
    state = reduceSession(state, { type: 'APPLY_SUCCEEDED', coords: chicago, at: 1, ack: 'command' })
    expect(state.phase).toBe('routing')
    state = reduceSession(state, {
      type: 'ROUTE_TICK',
      coords: { lat: 41.88, lng: -87.628 },
      playback: {
        stops: [chicago, loop],
        path: [chicago, loop],
        distanceTraveledM: 200,
        pathLengthM: 800,
        lastTickAt: 1000
      },
      arrived: false,
      at: 2
    })
    state = reduceSession(state, { type: 'PAUSE' })
    expect(state.phase).toBe('paused')
    expect(state.route?.distanceTraveledM).toBe(200)
    state = reduceSession(state, { type: 'RESUME' })
    expect(state.phase).toBe('routing')
    expect(state.route?.distanceTraveledM).toBe(200)
  })

  it('startup load of a recovery is never treated as an automatic resume to active', () => {
    const record: RecoveryRecord = {
      deviceId: 'pixel',
      platform: 'android',
      kind: 'active',
      mode: 'fixed',
      target: chicago,
      route: null,
      updatedAt: 1,
      message: 'Unresolved from last quit'
    }
    const state = reduceSession(initialSession(), { type: 'LOAD_RECOVERY', record })
    expect(state.phase).toBe('disconnected')
    expect(state.recovery?.deviceId).toBe('pixel')
  })
})
