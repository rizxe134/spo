import { Smartphone, Usb, Wifi } from 'lucide-react'
import type { DeviceInfo } from '@shared/types'

export function DeviceList({
  devices,
  selectedId,
  lockedId,
  notes,
  onSelect,
  onRefresh,
  onWifi
}: {
  devices: DeviceInfo[]
  selectedId: string | null
  lockedId: string | null
  notes: { android: string; ios: string; adbFound: boolean; iosRuntime: string }
  onSelect: (id: string) => void
  onRefresh: () => void
  onWifi: () => void
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs tracking-[0.16em] text-muted uppercase">Phones</h2>
        <button type="button" className="text-xs text-pin hover:underline" onClick={onRefresh}>
          Refresh
        </button>
      </div>
      {devices.length === 0 ? (
        <p className="rounded-md border border-dashed border-line px-3 py-3 text-sm text-muted">
          No phones yet. Plug in over USB, authorize the computer, and install ADB for Android. iPhone
          simulation needs the macOS sidecar.
        </p>
      ) : (
        <ul className="space-y-2">
          {devices.map((device) => {
            const selected = device.id === selectedId
            const locked = device.id === lockedId
            return (
              <li key={device.id}>
                <button
                  type="button"
                  onClick={() => onSelect(device.id)}
                  className={`w-full rounded-md border px-3 py-2 text-left ${
                    selected ? 'border-pin bg-pin/10' : 'border-line bg-panel-2 hover:border-muted'
                  }`}
                >
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Smartphone className="h-4 w-4 text-pin" />
                    <span>{device.name}</span>
                    {locked ? <span className="ml-auto text-[10px] text-go">SESSION</span> : null}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted">
                    {device.transport === 'wifi' ? <Wifi className="h-3 w-3" /> : <Usb className="h-3 w-3" />}
                    <span>{device.platform === 'ios' ? 'iPhone' : 'Android'}</span>
                    <span>·</span>
                    <span className={device.ready ? 'text-go' : 'text-warn'}>
                      {device.ready ? 'ready' : 'not ready'}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted">{device.detail}</p>
                </button>
              </li>
            )
          })}
        </ul>
      )}
      <p className="text-[11px] leading-relaxed text-muted">{notes.android}</p>
      <p className="text-[11px] leading-relaxed text-muted">{notes.ios}</p>
      <button type="button" className="text-xs text-pin hover:underline" onClick={onWifi}>
        USB → Wi-Fi handoff
      </button>
    </section>
  )
}
