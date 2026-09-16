import { applyLabel, canRestore, canSetLocation, previewDiffersFromApplied } from '@shared/session-machine'
import { formatCoords } from '@shared/coordinates'
import type { SessionState } from '@shared/types'
import { Button } from '../ui/button'

const PHASE_COPY: Record<SessionState['phase'], string> = {
  idle: 'Preview only. Nothing has been sent to a phone.',
  applying: 'Sending the mock to the selected phone…',
  active: 'Holding a fixed location. The helper keeps reasserting it.',
  routing: 'Playing the planned road route at about 45 mph.',
  paused: 'Route paused. The last point is still the applied mock.',
  reconnecting: 'Phone disconnected. Waiting for the same device. This is not restored.',
  stopping: 'Restore in progress — asking the helper to clear the mock.',
  error: 'Last command failed. The previous mock may still be on the phone.',
  disconnected: 'Session is unresolved. Lost connectivity never means restored.'
}

export function SessionBar({
  session,
  busy,
  onApply,
  onRestore,
  onRetry
}: {
  session: SessionState
  busy: boolean
  onApply: () => void
  onRestore: () => void
  onRetry: () => void
}) {
  const label = applyLabel(session)
  const canApply = canSetLocation(session) && (session.phase === 'idle' || previewDiffersFromApplied(session) || session.phase === 'error')
  const pending = previewDiffersFromApplied(session)

  return (
    <section className="space-y-3 rounded-md border border-line bg-panel-2 p-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xs tracking-[0.16em] text-muted uppercase">Session</h2>
        <span className="rounded-full border border-line px-2 py-0.5 text-[11px] text-paper">{session.phase}</span>
      </div>
      <p className="text-sm leading-relaxed text-paper/90">{PHASE_COPY[session.phase]}</p>
      <dl className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <dt className="text-muted">Preview</dt>
          <dd>{formatCoords(session.preview)}</dd>
        </div>
        <div>
          <dt className="text-muted">Applied</dt>
          <dd>{formatCoords(session.applied)}</dd>
        </div>
      </dl>
      {pending ? (
        <p className="text-xs text-pin">Pin moved. Press {label} to send it — the phone still has the last applied fix.</p>
      ) : null}
      {session.lastAckAt ? (
        <p className="text-[11px] text-muted">
          Last {session.lastAckKind ?? 'command'} ack {new Date(session.lastAckAt).toLocaleTimeString()}. That is not a
          GPS reading from a maps app.
        </p>
      ) : null}
      {session.lastError ? <p className="text-xs text-err">{session.lastError}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button tone="warn" disabled={!canApply || busy} onClick={onApply}>
          {label}
        </Button>
        <Button tone="danger" disabled={!canRestore(session) || busy} onClick={onRestore}>
          Restore
        </Button>
        {(session.phase === 'error' || session.phase === 'reconnecting' || session.phase === 'disconnected') && (
          <Button disabled={busy} onClick={onRetry}>
            Retry location
          </Button>
        )}
      </div>
    </section>
  )
}
