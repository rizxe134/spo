import type { PinpointApi } from '../../preload'
import { createPreviewApi } from './preview/mockApi'

export function getApi(): PinpointApi {
  if (window.pinpoint) return window.pinpoint
  return createPreviewApi()
}

export function isBrowserPreview(): boolean {
  return !window.pinpoint
}
