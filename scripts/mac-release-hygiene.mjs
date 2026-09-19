import { existsSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Launchpad indexes every Spo.app it can see, including an unpacked copy under release/.
 * After a dmg build, strip those bundles so only /Applications/Spo.app (from the dmg) remains.
 * .metadata_never_index is a Spotlight hint; it does not hide .app bundles from Launchpad.
 */
const releaseDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'release')
const strip = process.argv.includes('--strip-unpacked')

function walkApps(dir, found = []) {
  if (!existsSync(dir)) return found
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    let stat
    try {
      stat = statSync(full)
    } catch {
      continue
    }
    if (stat.isDirectory() && name === 'Spo.app') found.push(full)
    else if (stat.isDirectory()) walkApps(full, found)
  }
  return found
}

if (existsSync(releaseDir)) {
  writeFileSync(join(releaseDir, '.metadata_never_index'), '')
  if (strip) {
    for (const app of walkApps(releaseDir)) {
      rmSync(app, { recursive: true, force: true })
    }
  }
}
