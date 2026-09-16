import { useState } from 'react'
import { Search } from 'lucide-react'
import { validateSearchQuery } from '@shared/search-validation'
import type { PlaceHit } from '@shared/types'
import { Button } from '../ui/button'
import { Input } from '../ui/input'

export function SearchBar({
  onSearch,
  onPick
}: {
  onSearch: (query: string) => Promise<PlaceHit[]>
  onPick: (hit: PlaceHit) => void
}) {
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<PlaceHit[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit() {
    const checked = validateSearchQuery(query)
    if (!checked.ok) {
      setError(checked.error)
      setHits([])
      return
    }
    setBusy(true)
    setError(null)
    try {
      const next = await onSearch(checked.query)
      setHits(next)
      if (next.length === 0) setError('No places matched. Drop a pin or type coordinates instead.')
    } catch (err) {
      setHits([])
      setError(err instanceof Error ? err.message : 'Search failed. Pin and coordinates still work.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative">
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-2.5 left-2.5 h-4 w-4 text-muted" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search a place (Photon)"
            className="pl-8"
            aria-label="Place search"
          />
        </div>
        <Button type="submit" disabled={busy}>
          {busy ? 'Searching…' : 'Search'}
        </Button>
      </form>
      {error ? <p className="mt-2 text-xs text-err">{error}</p> : null}
      {hits.length > 0 ? (
        <ul className="absolute z-20 mt-2 max-h-56 w-full overflow-auto rounded-md border border-line bg-panel shadow-xl scrollbar-thin">
          {hits.map((hit) => (
            <li key={`${hit.label}-${hit.lat}-${hit.lng}`}>
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-sm hover:bg-white/5"
                onClick={() => {
                  onPick(hit)
                  setHits([])
                  setQuery(hit.label)
                }}
              >
                {hit.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
