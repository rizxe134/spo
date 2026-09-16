import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { DEFAULT_OSRM_URL, DEFAULT_PHOTON_URL, DEFAULT_SPEED_MPH, MAX_RECENTS } from '../shared/constants'
import type { AppSettings, RecentSelection, RecoveryRecord, SavedPlace } from '../shared/types'

export interface PersistedStore {
  settings: AppSettings
  places: SavedPlace[]
  recents: RecentSelection[]
  recovery: RecoveryRecord | null
}

const DEFAULT_SETTINGS: AppSettings = {
  photonUrl: DEFAULT_PHOTON_URL,
  osrmUrl: DEFAULT_OSRM_URL,
  speedMph: DEFAULT_SPEED_MPH,
  adbPath: 'adb',
  pythonPath: 'python3',
  setupComplete: false,
  setupOs: null,
  setupPhone: null
}

export function defaultStore(): PersistedStore {
  return {
    settings: { ...DEFAULT_SETTINGS },
    places: [],
    recents: [],
    recovery: null
  }
}

export class JsonStore {
  private data: PersistedStore

  constructor(private readonly filePath: string) {
    this.data = this.read()
  }

  get snapshot(): PersistedStore {
    return this.data
  }

  updateSettings(patch: Partial<AppSettings>): AppSettings {
    this.data.settings = { ...this.data.settings, ...patch }
    this.write()
    return this.data.settings
  }

  savePlace(place: SavedPlace): SavedPlace[] {
    this.data.places = [place, ...this.data.places.filter((item) => item.id !== place.id)]
    this.write()
    return this.data.places
  }

  deletePlace(id: string): SavedPlace[] {
    this.data.places = this.data.places.filter((item) => item.id !== id)
    this.write()
    return this.data.places
  }

  remember(recent: RecentSelection): RecentSelection[] {
    const next = [recent, ...this.data.recents.filter((item) => item.id !== recent.id)]
    this.data.recents = next.slice(0, MAX_RECENTS)
    this.write()
    return this.data.recents
  }

  setRecovery(record: RecoveryRecord | null): void {
    this.data.recovery = record
    this.write()
  }

  private read(): PersistedStore {
    try {
      if (!existsSync(this.filePath)) return defaultStore()
      const parsed = JSON.parse(readFileSync(this.filePath, 'utf8')) as Partial<PersistedStore>
      return {
        settings: { ...DEFAULT_SETTINGS, ...parsed.settings },
        places: parsed.places ?? [],
        recents: parsed.recents ?? [],
        recovery: parsed.recovery ?? null
      }
    } catch {
      return defaultStore()
    }
  }

  private write(): void {
    mkdirSync(dirname(this.filePath), { recursive: true })
    writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf8')
  }
}

export function storePath(userData: string): string {
  return join(userData, 'pinpoint-store.json')
}
