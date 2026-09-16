import type { PinpointApi } from './index'

declare global {
  interface Window {
    pinpoint?: PinpointApi
  }
}

export {}
