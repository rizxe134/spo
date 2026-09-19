import { useEffect, useMemo, useState } from 'react'
import { MapPin, Settings2 } from 'lucide-react'
import { APP_NAME, APP_VERSION, DEFAULT_CENTER, MAX_ROUTE_STOPS } from '@shared/constants'
import { formatCoords, parseCoordinatePair } from '@shared/coordinates'
import type { AppSettings, AppSnapshot, Coordinates, PlaceHit } from '@shared/types'
import { getApi } from './api'
import { CoordinatePanel } from './components/CoordinatePanel'
import { DeviceList } from './components/DeviceList'
import { MapView } from './components/MapView'
import { RoutePlanner, type RouteStop } from './components/RoutePlanner'
import { SavedPlaces } from './components/SavedPlaces'
import { SearchBar } from './components/SearchBar'
import { SessionBar } from './components/SessionBar'
import { SettingsDialog } from './components/SettingsDialog'
import { SetupWizard } from './components/SetupWizard'
import { StatusBanner } from './components/StatusBanner'
import { Button } from './ui/button'

const api = getApi()

export function App() {
  const [snap, setSnap] = useState<AppSnapshot | null>(null)
  const [lat, setLat] = useState('')
  const [lng, setLng] = useState('')
  const [placeName, setPlaceName] = useState('')
  const [stops, setStops] = useState<RouteStop[]>([])
  const [plannedPath, setPlannedPath] = useState<Coordinates[]>([])
  const [plannedMeters, setPlannedMeters] = useState<number | null>(null)
  const [addingStop, setAddingStop] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [showSetup, setShowSetup] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  useEffect(() => {
    void api.getState().then((state) => {
      setSnap(state)
      setShowSetup(!state.settings.setupComplete)
      if (state.session.preview) {
        syncInputs(state.session.preview)
      } else {
        void api.preview(DEFAULT_CENTER)
      }
    })
    return api.onState((state) => {
      setSnap(state)
      if (state.session.preview) syncInputs(state.session.preview)
    })
  }, [])

  const moving = useMemo(() => {
    if (!snap) return null
    if (snap.session.phase === 'routing' || snap.session.phase === 'paused') return snap.session.applied
    return null
  }, [snap])

  if (!snap) {
    return (
      <div className="flex h-full items-center justify-center text-muted">
        Opening {APP_NAME}…
      </div>
    )
  }

  const preview = snap.session.preview
  const routePath = snap.session.route?.path ?? plannedPath

  async function setPreview(coords: Coordinates, label?: string) {
    await api.preview(coords)
    syncInputs(coords)
    if (label) {
      setPlaceName(label)
      await api.remember(label)
    }
    if (addingStop) {
      setStops((current) => {
        if (current.length >= MAX_ROUTE_STOPS) return current
        return [...current, { ...coords, label: label || formatCoords(coords) }]
      })
      setAddingStop(false)
      setPlannedPath([])
      setPlannedMeters(null)
    }
  }

  function syncInputs(coords: Coordinates | null) {
    if (!coords) return
    setLat(coords.lat.toFixed(6))
    setLng(coords.lng.toFixed(6))
  }

  async function applyPreviewFromFields() {
    const parsed = parseCoordinatePair(lat, lng)
    if ('error' in parsed) {
      setNotice(parsed.error)
      return
    }
    await setPreview(parsed)
  }

  async function applyFixed() {
    setBusy(true)
    setNotice(null)
    try {
      await api.applyFixed()
    } finally {
      setBusy(false)
    }
  }

  async function restore() {
    setBusy(true)
    try {
      const ok = await api.restore()
      setNotice(ok ? 'Restore finished. Confirm in the phone app — caches can linger.' : null)
    } finally {
      setBusy(false)
    }
  }

  async function plan() {
    setBusy(true)
    setNotice(null)
    try {
      const planned = await api.planRoute(stops)
      setPlannedPath(planned.path)
      setPlannedMeters(planned.distanceM)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Route planning failed.')
    } finally {
      setBusy(false)
    }
  }

  async function startRoute() {
    if (plannedPath.length < 2) {
      setNotice('Plan a road route before starting playback.')
      return
    }
    setBusy(true)
    try {
      await api.startRoute(stops, plannedPath)
    } finally {
      setBusy(false)
    }
  }

  async function savePlace() {
    if (!preview) {
      setNotice('Drop a preview pin first.')
      return
    }
    const name = placeName.trim() || formatCoords(preview)
    await api.savePlace({
      id: `${preview.lat.toFixed(5)},${preview.lng.toFixed(5)}`,
      name,
      lat: preview.lat,
      lng: preview.lng,
      createdAt: Date.now()
    })
    setPlaceName('')
  }

  async function saveSettings(patch: Partial<AppSettings>) {
    await api.updateSettings(patch)
    setShowSettings(false)
    setShowSetup(false)
  }

  return (
    <div className="flex h-full flex-col">
      <header className="relative z-20 flex flex-wrap items-center gap-3 border-b border-line bg-ink px-4 py-3">
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-pin" />
          <div>
            <div className="font-serif text-xl leading-none">{APP_NAME}</div>
            <div className="text-[11px] text-muted">v{APP_VERSION} · personal USB location pin</div>
          </div>
        </div>
        <div className="ml-auto flex gap-2">
          <Button type="button" onClick={() => setShowSetup(true)}>
            Setup
          </Button>
          <Button type="button" onClick={() => setShowSettings(true)}>
            <Settings2 className="h-4 w-4" /> Prefs
          </Button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="scrollbar-thin space-y-5 overflow-auto border-b border-line p-4 lg:border-r lg:border-b-0">
          <StatusBanner session={snap.session} />
          <DeviceList
            devices={snap.devices}
            selectedId={snap.session.selectedDeviceId}
            lockedId={snap.session.lockedDeviceId}
            notes={snap.adapterNotes}
            onSelect={(id) => void api.selectDevice(id)}
            onRefresh={() => void api.refreshDevices()}
            onWifi={() => {
              void api.wifiHandoff().then(setNotice)
            }}
          />
          <SessionBar
            session={snap.session}
            busy={busy}
            onApply={() => void applyFixed()}
            onRestore={() => void restore()}
            onRetry={() => void api.retry()}
          />
          <SavedPlaces
            places={snap.places}
            recents={snap.recents}
            draftName={placeName}
            onDraftName={setPlaceName}
            onSave={() => void savePlace()}
            onDelete={(id) => void api.deletePlace(id)}
            onPick={(nextLat, nextLng, label) => void setPreview({ lat: nextLat, lng: nextLng }, label)}
          />
        </aside>

        <main className="flex min-h-[480px] flex-col">
          <div className="relative z-10 space-y-3 border-b border-line bg-ink p-4">
            <SearchBar
              onSearch={(query) => api.search(query)}
              onPick={(hit: PlaceHit) => void setPreview({ lat: hit.lat, lng: hit.lng }, hit.label)}
            />
            <CoordinatePanel
              lat={lat}
              lng={lng}
              onLat={setLat}
              onLng={setLng}
              onApplyPreview={() => void applyPreviewFromFields()}
            />
            {notice ? <p className="text-xs text-warn">{notice}</p> : null}
          </div>
          <div className="relative z-0 min-h-[320px] flex-1 overflow-hidden">
            <div className="absolute inset-0">
              <MapView
                preview={preview}
                applied={snap.session.applied}
                path={routePath}
                moving={moving}
                onPreview={(coords) => void setPreview(coords)}
              />
            </div>
          </div>
          <div className="border-t border-line p-4">
            <RoutePlanner
              stops={stops}
              plannedMeters={plannedMeters}
              session={snap.session}
              adding={addingStop}
              busy={busy}
              onToggleAdd={() => {
                if (preview && !addingStop) {
                  setStops((current) => {
                    if (current.length >= MAX_ROUTE_STOPS) return current
                    return [...current, { ...preview, label: placeName || formatCoords(preview) }]
                  })
                  setPlannedPath([])
                  setPlannedMeters(null)
                  return
                }
                setAddingStop((value) => !value)
              }}
              onRemove={(index) => {
                setStops((current) => current.filter((_, i) => i !== index))
                setPlannedPath([])
                setPlannedMeters(null)
              }}
              onClear={() => {
                setStops([])
                setPlannedPath([])
                setPlannedMeters(null)
              }}
              onPlan={() => void plan()}
              onStart={() => void startRoute()}
              onPause={() => void api.pause()}
              onResume={() => void api.resume()}
            />
          </div>
        </main>
      </div>

      {showSetup ? (
        <SetupWizard settings={snap.settings} onClose={() => setShowSetup(false)} onSave={saveSettings} />
      ) : null}
      {showSettings ? (
        <SettingsDialog settings={snap.settings} onClose={() => setShowSettings(false)} onSave={saveSettings} />
      ) : null}
    </div>
  )
}
