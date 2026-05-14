/**
 * Type definitions for Electron IPC bridge
 */

interface ElectronBackendRequest {
  method: string
  path: string
  query?: Record<string, string | string[]>
  body?: Record<string, unknown>
}

interface ElectronBackendResponse {
  status: number
  data: unknown
}

interface Electron2API {
  backendRequest: (request: ElectronBackendRequest) => Promise<ElectronBackendResponse>
  platform: () => string
  checkForUpdates?: () => void
  installUpdate?: () => void
  onUpdaterEvent?: (callback: (event: unknown, payload: Record<string, unknown>) => void) => () => void
}

declare global {
  interface Window {
    electron2: Electron2API
  }
}

export {}
