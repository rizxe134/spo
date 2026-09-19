import { isBrowserPreview } from '../api'
import type { SessionState } from '@shared/types'

export function StatusBanner({ session }: { session: SessionState }) {
  const preview = isBrowserPreview()
  const disconnected = session.phase === 'disconnected' || session.phase === 'reconnecting'
  const recovery = session.recovery && session.phase !== 'idle'

  if (!preview && !disconnected && !recovery && !session.lastError) return null

  return (
    <div className="space-y-2">
      {preview ? (
        <div className="rounded-md border border-pin/40 bg-pin/10 px-3 py-2 text-sm">
          Browser preview — map, search, saved places, and session controls work with a simulated
          Android phone. Hardware Set/Restore only runs inside Electron with ADB.
        </div>
      ) : null}
      {disconnected ? (
        <div className="rounded-md border border-warn/50 bg-warn/10 px-3 py-2 text-sm">
          {session.lastError ??
            'The phone is not reachable. Spo did not restore the mock. Reconnect the same device or Restore after it returns.'}
        </div>
      ) : null}
      {recovery && session.phase === 'disconnected' ? (
        <div className="rounded-md border border-line bg-panel-2 px-3 py-2 text-sm text-muted">
          Unresolved recovery for {session.recovery?.deviceId}. This is never auto-resumed on launch.
          Use Retry location or Restore on that same phone.
        </div>
      ) : null}
    </div>
  )
}
