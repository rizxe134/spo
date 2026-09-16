import { parseCoordinatePair } from '@shared/coordinates'
import { Input } from '../ui/input'
import { Button } from '../ui/button'

export function CoordinatePanel({
  lat,
  lng,
  onLat,
  onLng,
  onApplyPreview
}: {
  lat: string
  lng: string
  onLat: (value: string) => void
  onLng: (value: string) => void
  onApplyPreview: () => void
}) {
  const parsed = parseCoordinatePair(lat, lng)
  const invalid = 'error' in parsed

  return (
    <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
      <label className="block">
        <span className="mb-1 block text-[11px] tracking-wide text-muted uppercase">Latitude</span>
        <Input
          value={lat}
          onChange={(event) => onLat(event.target.value)}
          inputMode="decimal"
          placeholder="41.87810"
          aria-label="Latitude"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-[11px] tracking-wide text-muted uppercase">Longitude</span>
        <Input
          value={lng}
          onChange={(event) => onLng(event.target.value)}
          inputMode="decimal"
          placeholder="-87.62980"
          aria-label="Longitude"
        />
      </label>
      <div className="flex items-end">
        <Button type="button" onClick={onApplyPreview} disabled={invalid} title={invalid ? parsed.error : 'Move the preview pin'}>
          Preview
        </Button>
      </div>
    </div>
  )
}
