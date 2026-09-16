import { DEFAULT_SPEED_MPH, MPH_TO_MPS, ROUTE_TICK_MS } from './constants'
import type { Coordinates, RoutePlayback } from './types'

const EARTH_RADIUS_M = 6_371_000

export function toMps(mph = DEFAULT_SPEED_MPH): number {
  return mph * MPH_TO_MPS
}

export function haversineMeters(a: Coordinates, b: Coordinates): number {
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)))
}

export function bearingDegrees(from: Coordinates, to: Coordinates): number {
  const y = Math.sin(toRad(to.lng - from.lng)) * Math.cos(toRad(to.lat))
  const x =
    Math.cos(toRad(from.lat)) * Math.sin(toRad(to.lat)) -
    Math.sin(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.cos(toRad(to.lng - from.lng))
  return (toDeg(Math.atan2(y, x)) + 360) % 360
}

export function polylineLengthMeters(path: Coordinates[]): number {
  let total = 0
  for (let i = 1; i < path.length; i += 1) {
    total += haversineMeters(path[i - 1], path[i])
  }
  return total
}

export function pointAtDistance(
  path: Coordinates[],
  meters: number
): { point: Coordinates; bearing: number; arrived: boolean; segmentIndex: number } {
  if (path.length === 0) {
    throw new Error('Cannot interpolate an empty path.')
  }
  if (path.length === 1 || meters <= 0) {
    return { point: path[0], bearing: 0, arrived: path.length === 1, segmentIndex: 0 }
  }

  let remaining = meters
  for (let i = 1; i < path.length; i += 1) {
    const start = path[i - 1]
    const end = path[i]
    const segment = haversineMeters(start, end)
    if (remaining <= segment || i === path.length - 1) {
      const t = segment === 0 ? 1 : Math.min(1, remaining / segment)
      const point = {
        lat: start.lat + (end.lat - start.lat) * t,
        lng: start.lng + (end.lng - start.lng) * t
      }
      const arrived = i === path.length - 1 && remaining >= segment
      return {
        point: arrived ? end : point,
        bearing: bearingDegrees(start, end),
        arrived,
        segmentIndex: i - 1
      }
    }
    remaining -= segment
  }

  const last = path[path.length - 1]
  return { point: last, bearing: 0, arrived: true, segmentIndex: path.length - 2 }
}

export function createPlayback(stops: Coordinates[], path: Coordinates[]): RoutePlayback {
  return {
    stops,
    path,
    distanceTraveledM: 0,
    pathLengthM: polylineLengthMeters(path),
    lastTickAt: null
  }
}

export function stepPlayback(
  playback: RoutePlayback,
  dtSeconds: number,
  speedMps = toMps()
): { playback: RoutePlayback; position: Coordinates; bearing: number; arrived: boolean } {
  const advance = Math.max(0, dtSeconds) * speedMps
  const distanceTraveledM = Math.min(playback.pathLengthM, playback.distanceTraveledM + advance)
  const next: RoutePlayback = {
    ...playback,
    distanceTraveledM,
    lastTickAt: (playback.lastTickAt ?? 0) + dtSeconds * 1000
  }
  const sample = pointAtDistance(playback.path, distanceTraveledM)
  return {
    playback: next,
    position: sample.point,
    bearing: sample.bearing,
    arrived: sample.arrived || distanceTraveledM >= playback.pathLengthM
  }
}

export function tickPlayback(
  playback: RoutePlayback,
  speedMps = toMps(),
  tickMs = ROUTE_TICK_MS
): ReturnType<typeof stepPlayback> {
  return stepPlayback(playback, tickMs / 1000, speedMps)
}

export function metersPerTick(speedMph = DEFAULT_SPEED_MPH, tickMs = ROUTE_TICK_MS): number {
  return toMps(speedMph) * (tickMs / 1000)
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}

function toDeg(rad: number): number {
  return (rad * 180) / Math.PI
}
