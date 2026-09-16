import { describe, expect, it } from 'vitest'
import { DEFAULT_SPEED_MPH, ROUTE_TICK_MS } from '../src/shared/constants'
import {
  createPlayback,
  haversineMeters,
  metersPerTick,
  pointAtDistance,
  polylineLengthMeters,
  stepPlayback,
  tickPlayback,
  toMps
} from '../src/shared/route-math'

const a = { lat: 41.88, lng: -87.63 }
const b = { lat: 41.89, lng: -87.63 }
const c = { lat: 41.89, lng: -87.62 }

describe('route interpolation', () => {
  it('uses ~45 mph and one-second ticks', () => {
    const meters = metersPerTick(DEFAULT_SPEED_MPH, ROUTE_TICK_MS)
    expect(meters).toBeCloseTo(20.1168, 4)
    expect(toMps(45)).toBeCloseTo(20.1168, 4)
  })

  it('measures a straight north segment with haversine', () => {
    const meters = haversineMeters(a, b)
    expect(meters).toBeGreaterThan(1000)
    expect(meters).toBeLessThan(1300)
  })

  it('walks along a polyline and reports arrival', () => {
    const path = [a, b, c]
    const length = polylineLengthMeters(path)
    const start = pointAtDistance(path, 0)
    expect(start.point).toEqual(a)
    expect(start.arrived).toBe(false)

    const mid = pointAtDistance(path, length / 2)
    expect(mid.arrived).toBe(false)
    expect(mid.point.lat).toBeGreaterThan(a.lat)

    const end = pointAtDistance(path, length)
    expect(end.arrived).toBe(true)
    expect(end.point).toEqual(c)
  })

  it('advances playback by one second and can pause by skipping ticks', () => {
    const path = [a, b]
    let play = createPlayback([a, b], path)
    const first = tickPlayback(play)
    expect(first.arrived).toBe(false)
    expect(first.playback.distanceTraveledM).toBeCloseTo(metersPerTick(), 5)
    expect(first.position.lat).toBeGreaterThan(a.lat)

    const paused = first.playback
    expect(paused.distanceTraveledM).toBe(first.playback.distanceTraveledM)

    const resumed = tickPlayback(paused)
    expect(resumed.playback.distanceTraveledM).toBeGreaterThan(paused.distanceTraveledM)
  })

  it('clamps past the end of the path', () => {
    const path = [a, b]
    const play = createPlayback([a, b], path)
    const long = stepPlayback(play, 3600, toMps())
    expect(long.arrived).toBe(true)
    expect(long.position).toEqual(b)
    expect(long.playback.distanceTraveledM).toBe(play.pathLengthM)
  })
})
