import { validateCoordinates } from '../shared/coordinates'
import { validateSearchQuery } from '../shared/search-validation'
import type { Coordinates, PlaceHit, PlannedRoute } from '../shared/types'

const searchCache = new Map<string, { at: number; hits: PlaceHit[] }>()
const SEARCH_TTL_MS = 5 * 60_000

export async function searchPlaces(photonUrl: string, rawQuery: string): Promise<PlaceHit[]> {
  const checked = validateSearchQuery(rawQuery)
  if (!checked.ok) {
    throw new Error(checked.error)
  }

  const cached = searchCache.get(checked.query)
  if (cached && Date.now() - cached.at < SEARCH_TTL_MS) {
    return cached.hits
  }

  const endpoint = new URL(photonUrl)
  endpoint.searchParams.set('q', checked.query)
  endpoint.searchParams.set('limit', '8')

  const response = await fetch(endpoint, {
    headers: { Accept: 'application/json' }
  })
  if (!response.ok) {
    throw new Error(`Photon search failed (${response.status}). Pin and coordinates still work.`)
  }
  const body = (await response.json()) as {
    features?: Array<{
      geometry?: { coordinates?: [number, number] }
      properties?: { name?: string; city?: string; country?: string; street?: string }
    }>
  }
  const hits = (body.features ?? [])
    .map((feature) => {
      const pair = feature.geometry?.coordinates
      if (!pair) return null
      const coords = validateCoordinates({ lat: pair[1], lng: pair[0] })
      if ('error' in coords) return null
      const bits = [feature.properties?.name, feature.properties?.street, feature.properties?.city, feature.properties?.country]
        .filter(Boolean)
        .join(', ')
      return {
        label: bits || `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`,
        lat: coords.lat,
        lng: coords.lng,
        country: feature.properties?.country
      } satisfies PlaceHit
    })
    .filter((hit): hit is PlaceHit => hit != null)

  searchCache.set(checked.query, { at: Date.now(), hits })
  return hits
}

export async function planRoadRoute(osrmUrl: string, stops: Coordinates[]): Promise<PlannedRoute> {
  if (stops.length < 2) {
    throw new Error('Add at least two stops before planning a road route.')
  }
  if (stops.length > 12) {
    throw new Error('Road routes are limited to 12 stops.')
  }
  const validated = stops.map((stop) => {
    const checked = validateCoordinates(stop)
    if ('error' in checked) throw new Error(checked.error)
    return checked
  })

  const path = validated.map((stop) => `${stop.lng},${stop.lat}`).join(';')
  const base = osrmUrl.replace(/\/$/, '')
  const url = `${base}/route/v1/driving/${path}?overview=full&geometries=geojson`

  const response = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!response.ok) {
    throw new Error(`OSRM planning failed (${response.status}). Try fewer stops or a different endpoint.`)
  }
  const body = (await response.json()) as {
    code?: string
    routes?: Array<{ distance?: number; duration?: number; geometry?: { coordinates?: [number, number][] } }>
  }
  const route = body.routes?.[0]
  const coordinates = route?.geometry?.coordinates
  if (body.code !== 'Ok' || !coordinates?.length) {
    throw new Error('OSRM did not return a driving geometry for those stops.')
  }

  return {
    path: coordinates.map(([lng, lat]) => ({ lat, lng })),
    distanceM: route.distance ?? 0,
    durationS: route.duration ?? 0
  }
}
