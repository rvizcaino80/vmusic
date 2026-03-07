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
      onWindowDisplayModeChanged: (listener) => ipcRenderer.on('window-display-mode-changed', listener),
      offWindowDisplayModeChanged: (listener) => ipcRenderer.removeListener('window-display-mode-changed', listener),
      onWindowFullscreenChanged: (listener) => ipcRenderer.on('window-fullscreen-changed', listener),
      offWindowFullscreenChanged: (listener) => ipcRenderer.removeListener('window-fullscreen-changed', listener),
      onMediaControlsCommand: (listener) => ipcRenderer.on('media-controls:command', listener),
      offMediaControlsCommand: (listener) => ipcRenderer.removeListener('media-controls:command', listener),
      updateMediaControlsState: (payload) => ipcRenderer.send('media-controls:update-state', payload)
    })

    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  window.electron = electronAPI
  window.api = api
}
