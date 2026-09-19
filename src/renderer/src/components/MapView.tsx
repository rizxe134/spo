import { useEffect } from 'react'
import { MapContainer, Marker, Polyline, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import { divIcon } from 'leaflet'
import { DEFAULT_CENTER, DEFAULT_ZOOM } from '@shared/constants'
import type { Coordinates } from '@shared/types'

const pinIcon = (applied: boolean) =>
  divIcon({
    className: 'pinpoint-marker',
    html: `<div class="pinpoint-pin${applied ? ' is-applied' : ''}"></div>`,
    iconSize: [28, 36],
    iconAnchor: [14, 36]
  })

const movingIcon = divIcon({
  className: 'pinpoint-marker',
  html: '<div class="pinpoint-dot"></div>',
  iconSize: [14, 14],
  iconAnchor: [7, 7]
})

function ClickHandler({ onPreview }: { onPreview: (coords: Coordinates) => void }) {
  useMapEvents({
    click(event) {
      onPreview({ lat: event.latlng.lat, lng: event.latlng.lng })
    }
  })
  return null
}

function FitContainer() {
  const map = useMap()
  useEffect(() => {
    const id = window.requestAnimationFrame(() => map.invalidateSize())
    return () => window.cancelAnimationFrame(id)
  }, [map])
  return null
}

function Recenter({ target }: { target: Coordinates | null }) {
  const map = useMap()
  useEffect(() => {
    if (!target) return
    map.panTo([target.lat, target.lng], { animate: true })
  }, [map, target])
  return null
}

export function MapView({
  preview,
  applied,
  path,
  moving,
  onPreview
}: {
  preview: Coordinates | null
  applied: Coordinates | null
  path: Coordinates[]
  moving: Coordinates | null
  onPreview: (coords: Coordinates) => void
}) {
  const center = preview ?? applied ?? DEFAULT_CENTER

  return (
    <div className="pinpoint-map">
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={DEFAULT_ZOOM}
      className="pinpoint-map-canvas"
      zoomControl
      attributionControl
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitContainer />
      <ClickHandler onPreview={onPreview} />
      <Recenter target={moving ?? preview} />
      {path.length > 1 ? (
        <Polyline
          positions={path.map((point) => [point.lat, point.lng] as [number, number])}
          pathOptions={{ color: '#3dff6a', weight: 4, opacity: 0.85 }}
        />
      ) : null}
      {preview ? (
        <Marker
          position={[preview.lat, preview.lng]}
          icon={pinIcon(false)}
          draggable
          eventHandlers={{
            dragend: (event) => {
              const latlng = event.target.getLatLng()
              onPreview({ lat: latlng.lat, lng: latlng.lng })
            }
          }}
        />
      ) : null}
      {applied && (!preview || applied.lat !== preview.lat || applied.lng !== preview.lng) ? (
        <Marker position={[applied.lat, applied.lng]} icon={pinIcon(true)} />
      ) : null}
      {moving ? <Marker position={[moving.lat, moving.lng]} icon={movingIcon} /> : null}
    </MapContainer>
    </div>
  )
}
