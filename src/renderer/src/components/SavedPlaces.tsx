import { Bookmark, Clock, Trash2 } from 'lucide-react'
import { formatCoords } from '@shared/coordinates'
import type { RecentSelection, SavedPlace } from '@shared/types'
import { Button } from '../ui/button'
import { Input } from '../ui/input'

export function SavedPlaces({
  places,
  recents,
  draftName,
  onDraftName,
  onSave,
  onDelete,
  onPick
}: {
  places: SavedPlace[]
  recents: RecentSelection[]
  draftName: string
  onDraftName: (value: string) => void
  onSave: () => void
  onDelete: (id: string) => void
  onPick: (lat: number, lng: number, label: string) => void
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-xs tracking-[0.16em] text-muted uppercase">Saved locally</h2>
      <div className="flex gap-2">
        <Input
          value={draftName}
          onChange={(event) => onDraftName(event.target.value)}
          placeholder="Name this preview"
          aria-label="Saved place name"
        />
        <Button onClick={onSave}>
          <Bookmark className="h-3.5 w-3.5" /> Save
        </Button>
      </div>
      <ul className="max-h-32 space-y-1 overflow-auto scrollbar-thin">
        {places.length === 0 ? (
          <li className="text-xs text-muted">No saved places yet. Names never leave this computer.</li>
        ) : (
          places.map((place) => (
            <li key={place.id} className="flex items-center justify-between gap-2 text-sm">
              <button
                type="button"
                className="truncate text-left hover:text-pin"
                onClick={() => onPick(place.lat, place.lng, place.name)}
              >
                {place.name}
                <span className="ml-2 text-xs text-muted">{formatCoords(place)}</span>
              </button>
              <button type="button" onClick={() => onDelete(place.id)} aria-label={`Delete ${place.name}`}>
                <Trash2 className="h-3.5 w-3.5 text-muted hover:text-err" />
              </button>
            </li>
          ))
        )}
      </ul>
      <div>
        <h3 className="mb-1 flex items-center gap-1 text-[11px] text-muted uppercase">
          <Clock className="h-3 w-3" /> Recent
        </h3>
        <ul className="space-y-1 text-xs">
          {recents.length === 0 ? (
            <li className="text-muted">Selections stay in the local settings file only.</li>
          ) : (
            recents.map((item) => (
              <li key={item.id}>
                <button type="button" className="hover:text-pin" onClick={() => onPick(item.lat, item.lng, item.label)}>
                  {item.label}
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </section>
  )
}
