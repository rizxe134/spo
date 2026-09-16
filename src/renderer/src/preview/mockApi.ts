import { DEFAULT_OSRM_URL, DEFAULT_PHOTON_URL, DEFAULT_SPEED_MPH, ROUTE_TICK_MS } from '@shared/constants'
import { polylineLengthMeters, tickPlayback, toMps } from '@shared/route-math'
import {
  applyLabel,
  canSetLocation,
  initialSession,
  reduceSession
} from '@shared/session-machine'
import type { AppSettings, AppSnapshot, Coordinates, DeviceInfo, SavedPlace, SessionState } from '@shared/types'
import type { PinpointApi } from '../../../preload'

const DEMO_ANDROID: DeviceInfo = {
  id: 'demo-pixel',
  platform: 'android',
  name: 'Pixel 8 (preview)',
  transport: 'usb',
  ready: true,
  detail: 'Simulated USB phone for the browser preview'
}

const DEMO_IOS: DeviceInfo = {
  id: 'demo-iphone',
  platform: 'ios',
  name: 'iPhone (preview stub)',
  transport: 'usb',
  ready: false,
  detail: 'iOS sidecar is stubbed in this preview — same error you would see on Linux'
}

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function createPreviewApi(): PinpointApi {
  let session: SessionState = initialSession()
  let settings: AppSettings = loadJson('pinpoint.settings', {
    photonUrl: DEFAULT_PHOTON_URL,
    osrmUrl: DEFAULT_OSRM_URL,
    speedMph: DEFAULT_SPEED_MPH,
    adbPath: 'adb',
    pythonPath: 'python3',
    setupComplete: false,
    setupOs: null,
    setupPhone: null
  })
  let places = loadJson<SavedPlace[]>('pinpoint.places', [])
  let recents = loadJson<AppSnapshot['recents']>('pinpoint.recents', [])
  const listeners = new Set<(snapshot: AppSnapshot) => void>()
  let routeTimer: ReturnType<typeof setInterval> | null = null

  session = reduceSession(session, { type: 'SELECT_DEVICE', deviceId: DEMO_ANDROID.id })

  const snapshot = (): AppSnapshot => ({
    session,
    devices: [DEMO_ANDROID, DEMO_IOS],
    places,
    recents,
    settings,
    adapterNotes: {
      android: 'Browser preview: Android commands are simulated. Use Electron + ADB for a real phone.',
      ios: 'Browser preview uses the same iOS stub as Linux: no DVT simulate-location.',
      adbFound: true,
      iosRuntime: 'limited'
    }
  })

  const emit = (): void => {
    const snap = snapshot()
    for (const listener of listeners) listener(snap)
  }

  const dispatch = (event: Parameters<typeof reduceSession>[1]): void => {
    session = reduceSession(session, event)
    emit()
  }

  const persist = (): void => {
    localStorage.setItem('pinpoint.settings', JSON.stringify(settings))
    localStorage.setItem('pinpoint.places', JSON.stringify(places))
    localStorage.setItem('pinpoint.recents', JSON.stringify(recents))
  }

  const applyToDemo = async (): Promise<void> => {
    if (session.selectedDeviceId === DEMO_IOS.id) {
      dispatch({
        type: 'APPLY_FAILED',
        message:
          'iOS location simulation is a macOS sidecar (pymobiledevice3). The preview and this Linux host only stub that path. See docs/ios-setup.md.'
      })
      return
    }
    const target = session.preview
    if (!target) {
      dispatch({ type: 'APPLY_FAILED', message: 'Choose a preview pin before applying.' })
      return
    }
    await wait(180)
    dispatch({ type: 'APPLY_SUCCEEDED', coords: target, at: Date.now(), ack: 'command' })
  }

  const startTicks = (): void => {
    if (routeTimer) clearInterval(routeTimer)
    routeTimer = setInterval(() => {
      if (session.phase !== 'routing' || !session.route) return
      const stepped = tickPlayback(session.route, toMps(settings.speedMph), ROUTE_TICK_MS)
      dispatch({
        type: 'ROUTE_TICK',
        coords: stepped.position,
        playback: stepped.playback,
        arrived: stepped.arrived,
        at: Date.now()
      })
      if (stepped.arrived && routeTimer) {
        clearInterval(routeTimer)
        routeTimer = null
      }
    }, ROUTE_TICK_MS)
  }

  const api: PinpointApi = {
    getState: async () => snapshot(),
    onState: (listener) => {
      listeners.add(listener)
      listener(snapshot())
      return () => listeners.delete(listener)
    },
    selectDevice: async (deviceId) => {
      dispatch({ type: 'SELECT_DEVICE', deviceId })
    },
    preview: async (coords) => {
      dispatch({ type: 'PREVIEW', coords })
    },
    applyFixed: async () => {
      if (session.selectedDeviceId === DEMO_IOS.id) {
        await applyToDemo()
        return
      }
      if (!canSetLocation(session)) {
        dispatch({ type: 'APPLY_FAILED', message: 'Choose a preview pin before applying.' })
        return
      }
      dispatch({ type: 'SET_FIXED' })
      await applyToDemo()
    },
    restore: async () => {
      dispatch({ type: 'RESTORE' })
      await wait(120)
      dispatch({ type: 'RESTORE_SUCCEEDED' })
      if (routeTimer) clearInterval(routeTimer)
      return true
    },
    retry: async () => api.applyFixed(),
    pause: async () => {
      dispatch({ type: 'PAUSE' })
      if (routeTimer) {
        clearInterval(routeTimer)
        routeTimer = null
      }
    },
    resume: async () => {
      dispatch({ type: 'RESUME' })
      startTicks()
    },
    startRoute: async (stops, path) => {
      dispatch({
        type: 'START_ROUTE',
        stops,
        path,
        pathLengthM: polylineLengthMeters(path)
      })
      await wait(160)
      dispatch({ type: 'APPLY_SUCCEEDED', coords: path[0], at: Date.now(), ack: 'command' })
      startTicks()
    },
    search: async (query) => {
      const url = new URL(settings.photonUrl)
      url.searchParams.set('q', query.trim())
      url.searchParams.set('limit', '8')
      const response = await fetch(url)
      if (!response.ok) throw new Error(`Photon search failed (${response.status}).`)
      const body = (await response.json()) as {
        features?: Array<{
          geometry?: { coordinates?: [number, number] }
          properties?: { name?: string; city?: string; country?: string }
        }>
      }
      return (body.features ?? []).flatMap((feature) => {
        const pair = feature.geometry?.coordinates
        if (!pair) return []
        return [
          {
            label: [feature.properties?.name, feature.properties?.city, feature.properties?.country]
              .filter(Boolean)
              .join(', '),
            lat: pair[1],
            lng: pair[0],
            country: feature.properties?.country
          }
        ]
      })
    },
    planRoute: async (stops) => {
      const path = stops.map((stop) => `${stop.lng},${stop.lat}`).join(';')
      const url = `${settings.osrmUrl.replace(/\/$/, '')}/route/v1/driving/${path}?overview=full&geometries=geojson`
      const response = await fetch(url)
      if (!response.ok) throw new Error(`OSRM planning failed (${response.status}).`)
      const body = (await response.json()) as {
        code?: string
        routes?: Array<{ distance?: number; duration?: number; geometry?: { coordinates?: [number, number][] } }>
      }
      const route = body.routes?.[0]
      if (body.code !== 'Ok' || !route?.geometry?.coordinates?.length) {
        throw new Error('OSRM did not return a driving geometry.')
      }
      return {
        path: route.geometry.coordinates.map(([lng, lat]) => ({ lat, lng })),
        distanceM: route.distance ?? 0,
        durationS: route.duration ?? 0
      }
    },
    savePlace: async (place) => {
      places = [place, ...places.filter((item) => item.id !== place.id)]
      persist()
      emit()
    },
    deletePlace: async (id) => {
      places = places.filter((item) => item.id !== id)
      persist()
      emit()
    },
    remember: async (label) => {
      if (!session.preview) return
      const recent = {
        id: `${session.preview.lat.toFixed(5)},${session.preview.lng.toFixed(5)}`,
        label,
        lat: session.preview.lat,
        lng: session.preview.lng,
        at: Date.now()
      }
      recents = [recent, ...recents.filter((item) => item.id !== recent.id)].slice(0, 10)
      persist()
      emit()
    },
    updateSettings: async (patch) => {
      settings = { ...settings, ...patch } as AppSettings
      persist()
      emit()
    },
    wifiHandoff: async () =>
      'Browser preview only simulates USB. In Electron, Android handoff runs adb tcpip + connect after a working USB session.',
    refreshDevices: async () => {
      emit()
    },
    quitRequest: async () => {
      const restored = await api.restore()
      return { restored, message: applyLabel(session) }
    }
  }

  return api
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
