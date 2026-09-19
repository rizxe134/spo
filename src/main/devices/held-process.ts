import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { childEnv } from '../runtime-path'

export interface HoldHandle {
  readonly pid?: number
  get alive(): boolean
  get stdout(): string
  get stderr(): string
  kill(signal?: NodeJS.Signals): void
  waitForExit(): Promise<{ code: number | null }>
}

export interface HoldSpawner {
  start(file: string, args: string[]): HoldHandle
}

export class ChildHoldHandle implements HoldHandle {
  private exitCode: number | null = null
  private collectedOut = ''
  private collectedErr = ''
  private readonly exit: Promise<{ code: number | null }>

  constructor(private readonly child: ChildProcessWithoutNullStreams) {
    this.exit = new Promise((resolve) => {
      child.stdout.on('data', (chunk: Buffer) => {
        this.collectedOut += chunk.toString('utf8')
      })
      child.stderr.on('data', (chunk: Buffer) => {
        this.collectedErr += chunk.toString('utf8')
      })
      child.on('error', () => {
        this.exitCode = this.exitCode ?? 1
        resolve({ code: this.exitCode })
      })
      child.on('close', (code) => {
        this.exitCode = code
        resolve({ code })
      })
    })
  }

  get pid(): number | undefined {
    return this.child.pid
  }

  get alive(): boolean {
    return this.exitCode === null && this.child.exitCode === null && !this.child.killed
  }

  get stdout(): string {
    return this.collectedOut
  }

  get stderr(): string {
    return this.collectedErr
  }

  kill(signal: NodeJS.Signals = 'SIGINT'): void {
    if (!this.alive) return
    try {
      this.child.kill(signal)
    } catch {
      // already gone
    }
  }

  waitForExit(): Promise<{ code: number | null }> {
    return this.exit
  }
}

export class ChildHoldSpawner implements HoldSpawner {
  start(file: string, args: string[]): HoldHandle {
    const child = spawn(file, args, { windowsHide: true, env: childEnv() })
    return new ChildHoldHandle(child)
  }
}

export function formatIosSidecarFailure(stdout: string, stderr: string, fallback: string): string {
  const text = [stderr.trim(), stdout.trim()].filter(Boolean).join('\n')
  if (!text) return fallback
  if (/developer mode/i.test(text)) {
    return `Developer Mode is not ready.\n${text}`
  }
  if (/mounter|developer disk|image was not mounted|Mounting/i.test(text)) {
    return `Developer disk / mounter is not ready.\n${text}`
  }
  if (/pair|trust this computer|locked/i.test(text)) {
    return `Unlock the iPhone and Trust this computer.\n${text}`
  }
  return text
}

export async function waitForHeldStart(
  handle: HoldHandle,
  opts?: { settleMs?: number }
): Promise<{ ok: boolean; message: string }> {
  const settleMs = opts?.settleMs ?? 800
  const deadline = Date.now() + settleMs
  while (Date.now() < deadline) {
    if (!handle.alive) {
      return {
        ok: false,
        message: formatIosSidecarFailure(
          handle.stdout,
          handle.stderr,
          'pymobiledevice3 simulate-location set exited before it could hold a location.'
        )
      }
    }
    await sleep(50)
  }
  if (!handle.alive) {
    return {
      ok: false,
      message: formatIosSidecarFailure(
        handle.stdout,
        handle.stderr,
        'pymobiledevice3 simulate-location set exited before it could hold a location.'
      )
    }
  }
  const early = [handle.stdout, handle.stderr].map((part) => part.trim()).filter(Boolean).join('\n')
  return {
    ok: true,
    message: early
      ? `Sidecar is holding simulate-location (process still running).\n${early}`
      : 'Sidecar is holding simulate-location. The set command stays running on purpose until Restore.'
  }
}

export async function stopHeld(handle: HoldHandle | null): Promise<void> {
  if (!handle || !handle.alive) return
  handle.kill('SIGINT')
  await Promise.race([handle.waitForExit(), sleep(1_500)])
  if (handle.alive) handle.kill('SIGTERM')
  await Promise.race([handle.waitForExit(), sleep(800)])
  if (handle.alive) handle.kill('SIGKILL')
  await Promise.race([handle.waitForExit(), sleep(400)])
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
