import { Pause, Play, Trash2 } from 'lucide-react'
import { MAX_ROUTE_STOPS } from '@shared/constants'
import { formatCoords } from '@shared/coordinates'
import { canPause, canResume } from '@shared/session-machine'
import type { Coordinates, SessionState } from '@shared/types'
import { Button } from '../ui/button'

export interface RouteStop extends Coordinates {
  label: string
}

export function RoutePlanner({
  stops,
  plannedMeters,
  session,
  adding,
  busy,
  onToggleAdd,
  onRemove,
  onClear,
  onPlan,
  onStart,
  onPause,
  onResume
}: {
  stops: RouteStop[]
  plannedMeters: number | null
  session: SessionState
  adding: boolean
  busy: boolean
  onToggleAdd: () => void
  onRemove: (index: number) => void
  onClear: () => void
  onPlan: () => void
  onStart: () => void
  onPause: () => void
  onResume: () => void
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs tracking-[0.16em] text-muted uppercase">Road route</h2>
        <span className="text-[11px] text-muted">
          {stops.length}/{MAX_ROUTE_STOPS} stops · ~45 mph · 1s ticks
        </span>
      </div>
      <p className="text-xs text-muted">
        Add up to 12 stops from the current preview, then plan through the public OSRM demo. Playback
        interpolates locally after that — no more routing requests.
      </p>
      <ul className="max-h-36 space-y-1 overflow-auto scrollbar-thin">
        {stops.length === 0 ? (
          <li className="rounded-md border border-dashed border-line px-3 py-2 text-xs text-muted">
            No stops yet. Preview a pin, then use Add stop.
          </li>
        ) : (
          stops.map((stop, index) => (
            <li
              key={`${stop.lat}-${stop.lng}-${index}`}
              className="flex items-center justify-between gap-2 rounded border border-line bg-ink px-2 py-1.5 text-xs"
            >
              <span>
                {index + 1}. {stop.label || formatCoords(stop)}
              </span>
              <button type="button" onClick={() => onRemove(index)} aria-label={`Remove stop ${index + 1}`}>
                <Trash2 className="h-3.5 w-3.5 text-muted hover:text-err" />
              </button>
            </li>
          ))
        )}
      </ul>
      {plannedMeters != null ? (
        <p className="text-xs text-go">Planned {(plannedMeters / 1609.344).toFixed(1)} miles of road geometry.</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button onClick={onToggleAdd} disabled={stops.length >= MAX_ROUTE_STOPS}>
          {adding ? 'Adding… click Preview first' : 'Add stop from preview'}
        </Button>
        <Button onClick={onPlan} disabled={stops.length < 2 || busy}>
          Plan road route
        </Button>
        <Button tone="warn" onClick={onStart} disabled={plannedMeters == null || busy}>
          Start route
        </Button>
        <Button onClick={onPause} disabled={!canPause(session)}>
          <Pause className="h-3.5 w-3.5" /> Pause
        </Button>
        <Button onClick={onResume} disabled={!canResume(session)}>
          <Play className="h-3.5 w-3.5" /> Resume
        </Button>
        <Button tone="ghost" onClick={onClear}>
          Clear stops
        </Button>
      </div>
    </section>
  )
}
