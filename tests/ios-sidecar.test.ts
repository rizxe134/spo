import { describe, expect, it } from 'vitest'
import {
  formatIosSidecarFailure,
  waitForHeldStart,
  type HoldHandle,
  type HoldSpawner
} from '../src/main/devices/held-process'
import { IosSidecarAdapter, buildIosSetArgs } from '../src/main/devices/ios-sidecar'
import { ScriptedRunner } from '../src/main/devices/runner'

class FakeHold implements HoldHandle {
  alive: boolean
  stdout: string
  stderr: string
  killed: NodeJS.Signals | null = null
  private readonly exitWaiters: Array<(value: { code: number | null }) => void> = []

  constructor(opts?: { alive?: boolean; stdout?: string; stderr?: string }) {
    this.alive = opts?.alive ?? true
    this.stdout = opts?.stdout ?? ''
    this.stderr = opts?.stderr ?? ''
  }

  get pid(): number {
    return 4242
  }

  kill(signal: NodeJS.Signals = 'SIGINT'): void {
    this.killed = signal
    this.alive = false
    for (const resolve of this.exitWaiters) resolve({ code: 0 })
    this.exitWaiters.length = 0
  }

  waitForExit(): Promise<{ code: number | null }> {
    if (!this.alive) return Promise.resolve({ code: 0 })
    return new Promise((resolve) => this.exitWaiters.push(resolve))
  }
}

class FakeHolds implements HoldSpawner {
  readonly started: string[][] = []
  next: FakeHold | (() => FakeHold) = () => new FakeHold()
  last: FakeHold | null = null

  start(_file: string, args: string[]): HoldHandle {
    this.started.push(args)
    const hold = typeof this.next === 'function' ? this.next() : this.next
    this.last = hold
    return hold
  }
}

const probeRunner = new ScriptedRunner(async (_file, args) => {
  if (args[0] === '-c') return { stdout: 'pymobiledevice3', stderr: '', code: 0 }
  if (args.includes('clear')) return { stdout: '', stderr: '', code: 0 }
  if (args.includes('list')) return { stdout: '[]', stderr: '', code: 0 }
  return { stdout: '', stderr: 'unexpected finite command', code: 1 }
})

function macAdapter(holds: FakeHolds, runner = probeRunner): IosSidecarAdapter {
  return new IosSidecarAdapter('python3', runner, { holds, hostPlatform: 'darwin', settleMs: 50 })
}

describe('iOS hold helpers', () => {
  it('treats a process that stays alive as a successful start, not a timeout', async () => {
    const hold = new FakeHold({ alive: true, stdout: 'holding location\n' })
    const started = await waitForHeldStart(hold, { settleMs: 60 })
    expect(started.ok).toBe(true)
    expect(started.message).toMatch(/holding/i)
    expect(hold.alive).toBe(true)
  })

  it('surfaces Developer Mode / mounter stderr when set exits immediately', async () => {
    const hold = new FakeHold({
      alive: false,
      stderr: 'ERROR: Device is not in Developer Mode. Mount the developer disk image.'
    })
    const started = await waitForHeldStart(hold, { settleMs: 60 })
    expect(started.ok).toBe(false)
    expect(started.message).toMatch(/Developer Mode|mounter|developer disk/i)
    expect(formatIosSidecarFailure('', hold.stderr, 'fallback')).toMatch(/Developer Mode/)
  })
})

describe('iOS sidecar hold session', () => {
  it('starts simulate-location set and does not require the process to exit', async () => {
    const holds = new FakeHolds()
    const adapter = macAdapter(holds)
    const ack = await adapter.setFixedLocation('UDID1', { lat: 37.77, lng: -122.41 })
    expect(ack.ok).toBe(true)
    expect(ack.message).toMatch(/holding|still running|stays running/i)
    expect(holds.started[0]).toEqual(buildIosSetArgs({ lat: 37.77, lng: -122.41 }))
    expect(holds.last?.alive).toBe(true)
  })

  it('reuses a live hold for the same coordinates', async () => {
    const holds = new FakeHolds()
    const adapter = macAdapter(holds)
    await adapter.setFixedLocation('UDID1', { lat: 1, lng: 2 })
    const again = await adapter.setFixedLocation('UDID1', { lat: 1, lng: 2 })
    expect(again.ok).toBe(true)
    expect(holds.started).toHaveLength(1)
  })

  it('replaces the hold when the target changes', async () => {
    const holds = new FakeHolds()
    const adapter = macAdapter(holds)
    await adapter.setFixedLocation('UDID1', { lat: 1, lng: 2 })
    const first = holds.last
    await adapter.setFixedLocation('UDID1', { lat: 3, lng: 4 })
    expect(first?.killed).toBe('SIGINT')
    expect(holds.started).toHaveLength(2)
    expect(holds.last?.alive).toBe(true)
  })

  it('fails with sidecar stderr when set dies immediately', async () => {
    const holds = new FakeHolds()
    holds.next = () =>
      new FakeHold({
        alive: false,
        stderr: 'Failed to start DVT: Developer Mode is disabled'
      })
    const adapter = macAdapter(holds)
    const ack = await adapter.setFixedLocation('UDID1', { lat: 1, lng: 2 })
    expect(ack.ok).toBe(false)
    expect(ack.message).toMatch(/Developer Mode/)
  })

  it('Restore kills the held set process and runs clear', async () => {
    const holds = new FakeHolds()
    let cleared = false
    const runner = new ScriptedRunner(async (_file, args) => {
      if (args[0] === '-c') return { stdout: 'pymobiledevice3', stderr: '', code: 0 }
      if (args.includes('clear')) {
        cleared = true
        return { stdout: '', stderr: '', code: 0 }
      }
      return { stdout: '', stderr: '', code: 0 }
    })
    const adapter = macAdapter(holds, runner)
    await adapter.setFixedLocation('UDID1', { lat: 10, lng: 20 })
    const result = await adapter.restore('UDID1')
    expect(result.ok).toBe(true)
    expect(holds.last?.killed).toBe('SIGINT')
    expect(cleared).toBe(true)
  })

  it('Restore still succeeds if clear errors after the hold was interrupted', async () => {
    const holds = new FakeHolds()
    const runner = new ScriptedRunner(async (_file, args) => {
      if (args[0] === '-c') return { stdout: 'pymobiledevice3', stderr: '', code: 0 }
      if (args.includes('clear')) return { stdout: '', stderr: 'already cleared', code: 1 }
      return { stdout: '', stderr: '', code: 0 }
    })
    const adapter = macAdapter(holds, runner)
    await adapter.setFixedLocation('UDID1', { lat: 10, lng: 20 })
    const result = await adapter.restore('UDID1')
    expect(result.ok).toBe(true)
    expect(result.message).toMatch(/Stopped the holding|clear/)
  })

  it('dispose stops a held simulate-location process', async () => {
    const holds = new FakeHolds()
    const adapter = macAdapter(holds)
    await adapter.setFixedLocation('UDID1', { lat: 1, lng: 2 })
    await adapter.dispose()
    expect(holds.last?.killed).toBe('SIGINT')
    expect(holds.last?.alive).toBe(false)
  })
})
