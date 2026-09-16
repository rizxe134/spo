import { useState, type ReactNode } from 'react'
import type { AppSettings } from '@shared/types'
import { Button } from '../ui/button'
import { Input } from '../ui/input'

export function SettingsDialog({
  settings,
  onClose,
  onSave
}: {
  settings: AppSettings
  onClose: () => void
  onSave: (patch: Partial<AppSettings>) => Promise<void>
}) {
  const [draft, setDraft] = useState(settings)

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-xl border border-line bg-panel p-6">
        <h2 className="font-serif text-2xl">Preferences</h2>
        <p className="mt-1 text-sm text-muted">
          Endpoints stay on this machine. The public Photon and OSRM demos are for light personal use
          only.
        </p>
        <div className="mt-4 space-y-3">
          <Field label="Photon search URL">
            <Input
              value={draft.photonUrl}
              onChange={(event) => setDraft({ ...draft, photonUrl: event.target.value })}
            />
          </Field>
          <Field label="OSRM route URL">
            <Input value={draft.osrmUrl} onChange={(event) => setDraft({ ...draft, osrmUrl: event.target.value })} />
          </Field>
          <Field label="Route speed (mph)">
            <Input
              type="number"
              min={5}
              max={80}
              value={draft.speedMph}
              onChange={(event) => setDraft({ ...draft, speedMph: Number(event.target.value) || 45 })}
            />
          </Field>
          <Field label="ADB path">
            <Input value={draft.adbPath} onChange={(event) => setDraft({ ...draft, adbPath: event.target.value })} />
          </Field>
          <Field label="Python path (iOS sidecar)">
            <Input
              value={draft.pythonPath}
              onChange={(event) => setDraft({ ...draft, pythonPath: event.target.value })}
            />
          </Field>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button tone="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            tone="warn"
            onClick={() => {
              void onSave(draft)
            }}
          >
            Save
          </Button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs text-muted uppercase">{label}</span>
      {children}
    </label>
  )
}
