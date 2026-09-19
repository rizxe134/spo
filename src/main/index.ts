import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { AndroidAdbAdapter } from './devices/android-adb'
import { IosSidecarAdapter } from './devices/ios-sidecar'
import { DeviceRegistry } from './devices/registry'
import { planRoadRoute, searchPlaces } from './geo'
import { SessionManager } from './session-manager'
import { JsonStore, storePath } from './store'
import type { Coordinates, SavedPlace } from '../shared/types'
import type { AppSettings } from '../shared/types'

let window: BrowserWindow | null = null
let manager: SessionManager | null = null
let store: JsonStore | null = null
let allowQuit = false

function preloadScript(): string {
  const bundled = join(__dirname, '../preload/index.mjs')
  const fallback = join(__dirname, '../preload/index.js')
  return existsSync(bundled) ? bundled : fallback
}

function windowIcon(): string | undefined {
  const candidates = [
    join(__dirname, '../renderer/icon.png'),
    join(__dirname, '../../build/icon.png')
  ]
  return candidates.find((path) => existsSync(path))
}

function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 980,
    minHeight: 680,
    title: 'Spo',
    backgroundColor: '#050705',
    icon: windowIcon(),
    autoHideMenuBar: true,
    webPreferences: {
      preload: preloadScript(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow.show())

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

function attachIpc(current: SessionManager, currentStore: JsonStore): void {
  ipcMain.handle('app:state', () => current.snapshot())
  ipcMain.handle('session:select', (_event, deviceId: string) => current.selectDevice(deviceId))
  ipcMain.handle('session:preview', (_event, coords: Coordinates) => current.preview(coords))
  ipcMain.handle('session:apply', () => current.applyFixed())
  ipcMain.handle('session:restore', () => current.restore())
  ipcMain.handle('session:retry', () => current.retry())
  ipcMain.handle('session:pause', () => current.pause())
  ipcMain.handle('session:resume', () => current.resume())
  ipcMain.handle('session:start-route', (_event, stops: Coordinates[], path: Coordinates[]) =>
    current.startRoute(stops, path)
  )
  ipcMain.handle('geo:search', (_event, query: string) =>
    searchPlaces(currentStore.snapshot.settings.photonUrl, query)
  )
  ipcMain.handle('geo:plan', (_event, stops: Coordinates[]) =>
    planRoadRoute(currentStore.snapshot.settings.osrmUrl, stops)
  )
  ipcMain.handle('places:save', (_event, place: SavedPlace) => {
    currentStore.savePlace(place)
    current.notify()
  })
  ipcMain.handle('places:delete', (_event, id: string) => {
    currentStore.deletePlace(id)
    current.notify()
  })
  ipcMain.handle('places:remember', (_event, label: string) => current.rememberPreview(label))
  ipcMain.handle('settings:update', (_event, patch: Partial<AppSettings>) => {
    currentStore.updateSettings(patch)
    current.notify()
  })
  ipcMain.handle('device:wifi', () => current.wifiHandoff())
  ipcMain.handle('device:refresh', () => current.refreshAdapters())
  ipcMain.handle('app:quit', async () => {
    const restored = await current.restore()
    return {
      restored,
      message: restored
        ? 'Restore finished. You can quit.'
        : current.snapshot().session.lastError ?? 'Restore did not finish.'
    }
  })
}

function emitState(snapshot: ReturnType<SessionManager['snapshot']>): void {
  window?.webContents.send('app:state', snapshot)
}

app.whenReady().then(() => {
  store = new JsonStore(storePath(app.getPath('userData')))
  const android = new AndroidAdbAdapter(store.snapshot.settings.adbPath || 'adb')
  const ios = new IosSidecarAdapter(store.snapshot.settings.pythonPath || 'python3')
  const registry = new DeviceRegistry(android, ios)
  manager = new SessionManager(registry, store, () => store?.snapshot.settings.speedMph ?? 45)
  attachIpc(manager, store)
  manager.onChange(emitState)
  manager.start()
  window = createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      window = createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', (event) => {
  if (allowQuit || !manager) return
  const session = manager.snapshot().session
  const needsRestore = session.phase !== 'idle' || session.recovery != null
  if (!needsRestore) {
    manager.stop()
    return
  }
  event.preventDefault()
  void (async () => {
    const restored = await manager!.restore()
    if (restored) {
      allowQuit = true
      manager?.stop()
      app.quit()
      return
    }
    const choice = await dialog.showMessageBox({
      type: 'warning',
      buttons: ['Stay open', 'Quit anyway'],
      defaultId: 0,
      cancelId: 0,
      title: 'Spo could not restore',
      message: 'Restore did not finish. The phone may still be mocked.',
      detail:
        manager!.snapshot().session.lastError ??
        'Quit anyway keeps a local recovery record. Spo will not resume automatically next launch.'
    })
    if (choice.response === 1) {
      allowQuit = true
      manager?.stop()
      app.quit()
    }
  })()
})
