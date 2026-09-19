import { useState } from 'react'
import { setupProfile, type HostOs, type PhoneKind } from '@shared/setup-checklists'
import type { AppSettings } from '@shared/types'
import { Button } from '../ui/button'

export function SetupWizard({
  settings,
  onClose,
  onSave
}: {
  settings: AppSettings
  onClose: () => void
  onSave: (patch: Partial<AppSettings>) => Promise<void>
}) {
  const [os, setOs] = useState<HostOs>(settings.setupOs ?? guessOs())
  const [phone, setPhone] = useState<PhoneKind>(settings.setupPhone ?? 'android')
  const profile = setupProfile(os, phone)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-xl border border-line bg-panel p-6 shadow-2xl scrollbar-thin">
        <p className="text-xs tracking-[0.18em] text-pin uppercase">First-run checklist</p>
        <h2 className="mt-1 font-serif text-3xl">Set up this computer and phone</h2>
        <p className="mt-2 text-sm text-muted">
          Pick the pair you actually have. Spo does not install drivers or change phone settings
          for you — it only talks to ADB or the iOS sidecar after you finish these steps.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block text-xs text-muted uppercase">Computer</span>
            <select
              className="h-9 w-full rounded-md border border-line bg-ink px-2"
              value={os}
              onChange={(event) => setOs(event.target.value as HostOs)}
            >
              <option value="mac">macOS</option>
              <option value="windows">Windows</option>
              <option value="linux">Linux</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs text-muted uppercase">Phone</span>
            <select
              className="h-9 w-full rounded-md border border-line bg-ink px-2"
              value={phone}
              onChange={(event) => setPhone(event.target.value as PhoneKind)}
            >
              <option value="android">Android</option>
              <option value="iphone">iPhone</option>
            </select>
          </label>
        </div>
        <div className="mt-5 rounded-lg border border-line bg-ink p-4">
          <h3 className="font-medium">{profile.title}</h3>
          <p className="mt-1 text-sm text-muted">{profile.summary}</p>
          <ol className="mt-3 list-decimal space-y-3 pl-5 text-sm">
            {profile.items.map((item) => (
              <li key={item.id}>
                <div className="font-medium">{item.title}</div>
                <p className="text-muted">{item.detail}</p>
              </li>
            ))}
          </ol>
        </div>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button tone="ghost" onClick={onClose}>
            Later
          </Button>
          <Button
            tone="warn"
            onClick={() => {
              void onSave({ setupComplete: true, setupOs: os, setupPhone: phone })
            }}
          >
            I have this cable ready
          </Button>
        </div>
      </div>
    </div>
  )
}

function guessOs(): HostOs {
  const platform = navigator.platform.toLowerCase()
  if (platform.includes('mac')) return 'mac'
  if (platform.includes('win')) return 'windows'
  return 'linux'
}
