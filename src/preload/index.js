import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {}

/*
 * Use `contextBridge` APIs to expose Electron APIs to
 * renderer only if context isolation is enabled, otherwise
 * just add to the DOM global.
 */
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)

    contextBridge.exposeInMainWorld('electron2', {
      getClipboardText: () => ipcRenderer.invoke('get-clipboard-text'),
      emptyClipboard: () => ipcRenderer.invoke('empty-clipboard'),
      getWindowDisplayMode: () => ipcRenderer.invoke('get-window-display-mode'),
      backendRequest: (payload) => ipcRenderer.invoke('backend:request', payload),
      getMediaUrl: (payload) => ipcRenderer.invoke('backend:get-media-url', payload),
      cacheCoverImage: (payload) => ipcRenderer.invoke('covers:cache-image', payload),
      importCoverFile: (payload) => ipcRenderer.invoke('covers:import-file', payload),
      getCustomUpdaterState: () => ipcRenderer.invoke('custom-updater:get-state'),
      checkCustomUpdater: () => ipcRenderer.invoke('custom-updater:check'),
      checkAndPrepareCustomUpdater: () => ipcRenderer.invoke('custom-updater:check-and-prepare'),
      installCustomUpdaterNow: () => ipcRenderer.invoke('custom-updater:install-now'),
      onCustomUpdaterState: (listener) => ipcRenderer.on('custom-updater:state', listener),
      offCustomUpdaterState: (listener) => ipcRenderer.removeListener('custom-updater:state', listener),
      onWindowDisplayModeChanged: (listener) => ipcRenderer.on('window-display-mode-changed', listener),
      offWindowDisplayModeChanged: (listener) => ipcRenderer.removeListener('window-display-mode-changed', listener),
      onWindowFullscreenChanged: (listener) => ipcRenderer.on('window-fullscreen-changed', listener),
      offWindowFullscreenChanged: (listener) => ipcRenderer.removeListener('window-fullscreen-changed', listener),
      onSystemPowerEvent: (listener) => ipcRenderer.on('system-power-event', listener),
      offSystemPowerEvent: (listener) => ipcRenderer.removeListener('system-power-event', listener)
    })

    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  window.electron = electronAPI
  window.electron2 = {
    getClipboardText: () => ipcRenderer.invoke('get-clipboard-text'),
    emptyClipboard: () => ipcRenderer.invoke('empty-clipboard'),
    getWindowDisplayMode: () => ipcRenderer.invoke('get-window-display-mode'),
    backendRequest: (payload) => ipcRenderer.invoke('backend:request', payload),
    getMediaUrl: (payload) => ipcRenderer.invoke('backend:get-media-url', payload),
    cacheCoverImage: (payload) => ipcRenderer.invoke('covers:cache-image', payload),
    importCoverFile: (payload) => ipcRenderer.invoke('covers:import-file', payload),
    getCustomUpdaterState: () => ipcRenderer.invoke('custom-updater:get-state'),
    checkCustomUpdater: () => ipcRenderer.invoke('custom-updater:check'),
    checkAndPrepareCustomUpdater: () => ipcRenderer.invoke('custom-updater:check-and-prepare'),
    installCustomUpdaterNow: () => ipcRenderer.invoke('custom-updater:install-now'),
    onCustomUpdaterState: (listener) => ipcRenderer.on('custom-updater:state', listener),
    offCustomUpdaterState: (listener) => ipcRenderer.removeListener('custom-updater:state', listener),
    onWindowDisplayModeChanged: (listener) => ipcRenderer.on('window-display-mode-changed', listener),
    offWindowDisplayModeChanged: (listener) => ipcRenderer.removeListener('window-display-mode-changed', listener),
    onWindowFullscreenChanged: (listener) => ipcRenderer.on('window-fullscreen-changed', listener),
    offWindowFullscreenChanged: (listener) => ipcRenderer.removeListener('window-fullscreen-changed', listener),
    onSystemPowerEvent: (listener) => ipcRenderer.on('system-power-event', listener),
    offSystemPowerEvent: (listener) => ipcRenderer.removeListener('system-power-event', listener)
  }
  window.api = api
}
