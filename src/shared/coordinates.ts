import type { Coordinates } from './types'

const LAT_MIN = -90
const LAT_MAX = 90
const LNG_MIN = -180
const LNG_MAX = 180

export function parseCoordinatePair(latRaw: string, lngRaw: string): Coordinates | { error: string } {
  const lat = Number.parseFloat(latRaw.trim())
  const lng = Number.parseFloat(lngRaw.trim())
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { error: 'Latitude and longitude must be finite numbers.' }
  }
  return validateCoordinates({ lat, lng })
}

export function validateCoordinates(coords: Coordinates): Coordinates | { error: string } {
  if (!Number.isFinite(coords.lat) || !Number.isFinite(coords.lng)) {
    return { error: 'Coordinates must be finite numbers.' }
  }
  if (coords.lat < LAT_MIN || coords.lat > LAT_MAX) {
    return { error: 'Latitude must be between -90 and 90.' }
  }
  if (coords.lng < LNG_MIN || coords.lng > LNG_MAX) {
    return { error: 'Longitude must be between -180 and 180.' }
  }
  return { lat: coords.lat, lng: coords.lng }
}

export function sameCoords(a: Coordinates | null, b: Coordinates | null, epsilon = 1e-6): boolean {
  if (!a || !b) return false
  return Math.abs(a.lat - b.lat) < epsilon && Math.abs(a.lng - b.lng) < epsilon
}

export function formatCoords(coords: Coordinates | null, digits = 5): string {
  if (!coords) return '—'
  const ns = coords.lat >= 0 ? 'N' : 'S'
  const ew = coords.lng >= 0 ? 'E' : 'W'
  return `${Math.abs(coords.lat).toFixed(digits)}°${ns}, ${Math.abs(coords.lng).toFixed(digits)}°${ew}`
}

export function coordsKey(coords: Coordinates): string {
  return `${coords.lat.toFixed(6)},${coords.lng.toFixed(6)}`
}
