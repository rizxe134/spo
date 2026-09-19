import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { delimiter, isAbsolute, join } from 'node:path'

export const MAC_EXTRA_BIN_DIRS = [
  '/opt/anaconda3/bin',
  '/opt/miniconda3/bin',
  '/opt/homebrew/bin',
  '/opt/homebrew/sbin',
  '/usr/local/bin',
  '/usr/local/sbin'
]

/** Directories GUI-launched apps usually lack on PATH. Existence is not required so tests and PATH prepend stay stable. */
export function extraBinDirs(platform = process.platform, home = homedir()): string[] {
  if (platform === 'darwin') {
    return [
      ...MAC_EXTRA_BIN_DIRS,
      join(home, 'anaconda3/bin'),
      join(home, 'miniconda3/bin'),
      join(home, 'opt/anaconda3/bin'),
      join(home, 'Library/Android/sdk/platform-tools')
    ]
  }
  if (platform === 'linux') return ['/usr/local/bin']
  return []
}

export function augmentPath(
  current = process.env.PATH ?? '',
  platform = process.platform,
  home = homedir()
): string {
  const parts = current.split(delimiter).filter(Boolean)
  const seen = new Set(parts)
  const prepend: string[] = []
  for (const dir of extraBinDirs(platform, home)) {
    if (seen.has(dir)) continue
    seen.add(dir)
    prepend.push(dir)
  }
  return [...prepend, ...parts].join(delimiter)
}

export function applyAugmentedProcessPath(platform = process.platform): string {
  const next = augmentPath(process.env.PATH ?? '', platform)
  process.env.PATH = next
  return next
}

export function childEnv(base: NodeJS.ProcessEnv = process.env, platform = process.platform): NodeJS.ProcessEnv {
  return { ...base, PATH: augmentPath(base.PATH ?? '', platform) }
}

export function pythonCandidates(
  configured: string,
  platform = process.platform,
  home = homedir(),
  pathEnv = process.env.PATH ?? ''
): string[] {
  const value = configured.trim() || 'python3'
  const extras = extraBinDirs(platform, home)
  const fromPath = pathEnv
    .split(delimiter)
    .filter(Boolean)
    .map((dir) => join(dir, 'python3'))
  const known = extras.map((dir) => join(dir, 'python3'))
  const ordered: string[] = []
  const seen = new Set<string>()
  const push = (bin: string) => {
    if (!bin || seen.has(bin)) return
    seen.add(bin)
    ordered.push(bin)
  }

  if (isAbsolute(value)) push(value)
  else if (value !== 'python3' && value !== 'python') push(value)

  for (const bin of known) push(bin)
  for (const bin of fromPath) push(bin)
  if (!isAbsolute(value)) push(value)
  if (platform === 'darwin' || platform === 'linux') push('/usr/bin/python3')
  return ordered
}

export async function resolvePythonInterpreter(
  configured: string,
  probe: (bin: string) => Promise<boolean>,
  exists: (bin: string) => boolean = existsSync,
  platform = process.platform,
  home = homedir(),
  pathEnv = process.env.PATH ?? ''
): Promise<{ python: string; probed: boolean }> {
  const candidates = pythonCandidates(configured, platform, home, pathEnv)
  const existing = candidates.filter((bin) => exists(bin) || !bin.includes('/'))
  for (const bin of existing) {
    try {
      if (await probe(bin)) return { python: bin, probed: true }
    } catch {
      // try the next interpreter
    }
  }
  const fallback =
    existing.find((bin) => exists(bin)) ??
    existing[0] ??
    (configured.trim() || 'python3')
  return { python: fallback, probed: false }
}
