import { contextBridge, ipcRenderer } from 'electron'
import type { AppSnapshot, Coordinates, SavedPlace } from '../shared/types'

export interface PinpointApi {
  getState: () => Promise<AppSnapshot>
  onState: (listener: (snapshot: AppSnapshot) => void) => () => void
  selectDevice: (deviceId: string) => Promise<void>
  preview: (coords: Coordinates) => Promise<void>
  applyFixed: () => Promise<void>
  restore: () => Promise<boolean>
  retry: () => Promise<void>
  pause: () => Promise<void>
  resume: () => Promise<void>
  startRoute: (stops: Coordinates[], path: Coordinates[]) => Promise<void>
  search: (query: string) => Promise<{ label: string; lat: number; lng: number; country?: string }[]>
  planRoute: (stops: Coordinates[]) => Promise<{ path: Coordinates[]; distanceM: number; durationS: number }>
  savePlace: (place: SavedPlace) => Promise<void>
  deletePlace: (id: string) => Promise<void>
  remember: (label: string) => Promise<void>
  updateSettings: (patch: Record<string, unknown>) => Promise<void>
  wifiHandoff: () => Promise<string>
  refreshDevices: () => Promise<void>
  quitRequest: () => Promise<{ restored: boolean; message: string }>
}

const api: PinpointApi = {
  getState: () => ipcRenderer.invoke('app:state'),
  onState: (listener) => {
    const wrapped = (_event: Electron.IpcRendererEvent, snapshot: AppSnapshot) => listener(snapshot)
    ipcRenderer.on('app:state', wrapped)
    return () => ipcRenderer.removeListener('app:state', wrapped)
  },
  selectDevice: (deviceId) => ipcRenderer.invoke('session:select', deviceId),
  preview: (coords) => ipcRenderer.invoke('session:preview', coords),
  applyFixed: () => ipcRenderer.invoke('session:apply'),
  restore: () => ipcRenderer.invoke('session:restore'),
  retry: () => ipcRenderer.invoke('session:retry'),
  pause: () => ipcRenderer.invoke('session:pause'),
  resume: () => ipcRenderer.invoke('session:resume'),
  startRoute: (stops, path) => ipcRenderer.invoke('session:start-route', stops, path),
  search: (query) => ipcRenderer.invoke('geo:search', query),
  planRoute: (stops) => ipcRenderer.invoke('geo:plan', stops),
  savePlace: (place) => ipcRenderer.invoke('places:save', place),
  deletePlace: (id) => ipcRenderer.invoke('places:delete', id),
  remember: (label) => ipcRenderer.invoke('places:remember', label),
  updateSettings: (patch) => ipcRenderer.invoke('settings:update', patch),
  wifiHandoff: () => ipcRenderer.invoke('device:wifi'),
  refreshDevices: () => ipcRenderer.invoke('device:refresh'),
  quitRequest: () => ipcRenderer.invoke('app:quit')
}

contextBridge.exposeInMainWorld('pinpoint', api)
