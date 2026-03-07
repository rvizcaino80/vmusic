import { clipboard, app, shell, BrowserWindow, ipcMain, powerMonitor, powerSaveBlocker, Menu, Tray, nativeImage } from 'electron'
import { join } from 'path'
import fs from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { updateElectronApp, UpdateSourceType } from 'update-electron-app'
import icon from '../../resources/icon.png?asset'
import traySIcon from '../../resources/tray-icon.png?asset'
import backendService from './backend/service.cjs'

let mainWindow = null
let tray = null
let mediaControlsState = {
  canControl: false,
  isPlaying: false,
  title: '',
  artist: ''
}

function extractGithubRepo(repository) {
  if (!repository) return null

  const raw = typeof repository === 'string' ? repository : repository.url
  if (!raw || typeof raw !== 'string') return null

  const trimmed = raw.trim()
  const match = trimmed.match(/github\.com[:/]([^/]+)\/([^/.]+)(?:\.git)?$/i)
  if (!match) return null

  return `${match[1]}/${match[2]}`
}

function resolveGithubRepo() {
  const repoFromEnv = (process.env.VMUSIC_GH_REPO || '').trim()
  if (repoFromEnv && repoFromEnv.includes('/')) {
    return repoFromEnv
  }

  try {
    const appPkgPath = join(app.getAppPath(), 'package.json')
    const appPkgRaw = fs.readFileSync(appPkgPath, 'utf8')
    const appPkg = JSON.parse(appPkgRaw)

    return extractGithubRepo(appPkg?.repository)
  } catch {
    return null
  }
}

function configureAutoUpdates() {
  if (is.dev) return
  if (!['darwin', 'win32'].includes(process.platform)) return

  const githubRepo = resolveGithubRepo()
  if (!githubRepo) {
    console.warn('[vmusic][updates] GitHub repo not found. Set VMUSIC_GH_REPO or package.json.repository.')

    return
  }

  try {
    updateElectronApp({
      updateSource: {
        type: UpdateSourceType.ElectronPublicUpdateService,
        repo: githubRepo
      },
      updateInterval: '30 minutes',
      logger: console,
      notifyUser: true
    })
  } catch (error) {
    console.error('[vmusic][updates] Failed to initialize auto-updates', error)
  }
}

function getWindowForMediaControls() {
  if (mainWindow && !mainWindow.isDestroyed()) return mainWindow

  return BrowserWindow.getAllWindows().find((window) => !window.isDestroyed()) || null
}

function sendMediaControlCommand(command) {
  const win = getWindowForMediaControls()
  if (!win || win.webContents.isDestroyed()) return
  win.webContents.send('media-controls:command', command)
}

function getTrayPlayPauseLabel() {
  if (!mediaControlsState.canControl) return 'Play'

  return mediaControlsState.isPlaying ? 'Pause' : 'Play'
}

function buildTrayMenu() {
  const currentTitle = mediaControlsState.title || 'Sin canción'
  const currentArtist = mediaControlsState.artist || 'Sin artista'
  const hasSong = Boolean(mediaControlsState.title || mediaControlsState.artist)

  return Menu.buildFromTemplate([
    {
      label: hasSong ? `${currentTitle} - ${currentArtist}` : 'Sin reproducción activa',
      enabled: false
    },
    { type: 'separator' },
    {
      label: 'Anterior',
      enabled: mediaControlsState.canControl,
      click: () => sendMediaControlCommand('previous')
    },
    {
      label: getTrayPlayPauseLabel(),
      enabled: mediaControlsState.canControl,
      click: () => sendMediaControlCommand('playpause')
    },
    {
      label: 'Siguiente',
      enabled: mediaControlsState.canControl,
      click: () => sendMediaControlCommand('next')
    },
    { type: 'separator' },
    {
      label: 'Mostrar ventana',
      click: () => {
        const win = getWindowForMediaControls()
        if (!win) return
        if (win.isMinimized()) {
          win.restore()
        }
        win.show()
        win.focus()
      }
    },
    {
      label: 'Salir',
      click: () => {
        app.quit()
      }
    }
  ])
}

function refreshTrayMenu() {
  if (!tray) return
  tray.setContextMenu(buildTrayMenu())
}

function createTray() {
  if (tray) return

  let trayIcon = nativeImage.createFromPath(traySIcon)
  if (trayIcon.isEmpty()) {
    trayIcon = nativeImage.createFromPath(icon)
  }
  if (!trayIcon.isEmpty()) {
    const traySize = process.platform === 'darwin' ? 18 : 16
    trayIcon = trayIcon.resize({ width: traySize, height: traySize })
    if (process.platform === 'darwin') {
      trayIcon.setTemplateImage(true)
    }
  }
  tray = new Tray(trayIcon)
  tray.setToolTip('Salsamanía')
  refreshTrayMenu()
}

function createWindow() {
  const appTitle = `Salsamanía v${app.getVersion()}`

  // Create the browser window.
  mainWindow = new BrowserWindow({
    title: appTitle,
    width: 1920,
    height: 1080,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      nodeIntegration: true,
      webSecurity: false,
      webviewTag: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.maximize()
    mainWindow.show()
    mainWindow.setTitle(appTitle)
    setTimeout(() => {
      if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.send('window-display-mode-changed', {
          isFullScreen: mainWindow.isFullScreen(),
          isMaximized: mainWindow.isMaximized()
        })
      }
    }, 800)
  })

  mainWindow.on('page-title-updated', (event) => {
    event.preventDefault()
    mainWindow.setTitle(appTitle)
  })

  const sendWindowDisplayMode = () => {
    mainWindow.webContents.send('window-display-mode-changed', {
      isFullScreen: mainWindow.isFullScreen(),
      isMaximized: mainWindow.isMaximized()
    })
  }

  mainWindow.on('enter-full-screen', sendWindowDisplayMode)
  mainWindow.on('leave-full-screen', sendWindowDisplayMode)
  mainWindow.on('maximize', sendWindowDisplayMode)
  mainWindow.on('unmaximize', sendWindowDisplayMode)
  mainWindow.on('resized', sendWindowDisplayMode)
  mainWindow.on('closed', () => {
    mainWindow = null
    mediaControlsState = {
      canControl: false,
      isPlaying: false,
      title: '',
      artist: ''
    }
    refreshTrayMenu()
  })

  mainWindow.webContents.on('did-finish-load', sendWindowDisplayMode)

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)

    return { action: 'deny' }
  })

  /*
   * HMR for renderer base on electron-vite cli.
   * Load the remote URL for development or the local html file for production.
   */
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

/*
 * This method will be called when Electron has finished
 * initialization and is ready to create browser windows.
 * Some APIs can only be used after this event occurs.
 */
app.whenReady().then(() => {
  configureAutoUpdates()

  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  /*
   * Default open or close DevTools by F12 in development
   * and ignore CommandOrControl + R in production.
   * see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
   */
  app.on('browser-window-created', (_, window) => {
    const { session } = window.webContents

    session.webRequest.onBeforeRequest({ urls: ['http://localhost:3000/static/*'] }, (details, callback) => {
      const staticPrefix = 'http://localhost:3000/static/'
      if (!details.url.startsWith(staticPrefix)) {
        callback({ cancel: false })

        return
      }

      const staticPath = details.url.slice(staticPrefix.length)
      callback({ redirectURL: backendService.getLocalStaticUrl(staticPath) })
    })

    session.webRequest.onHeadersReceived({ urls: ['*://*/*'] },
      (d, c) => {
        if (d.responseHeaders['X-Frame-Options']) {
          delete d.responseHeaders['X-Frame-Options']
        } else if (d.responseHeaders['x-frame-options']) {
          delete d.responseHeaders['x-frame-options']
        }

        c({ cancel: false, responseHeaders: d.responseHeaders })
      })
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))
  ipcMain.handle('get-clipboard-text', async(event, ...args) => {
    const clipboardText = clipboard.readText()

    return clipboardText
  })

  ipcMain.handle('empty-clipboard', async(event, ...args) => {
    clipboard.clear()
  })

  ipcMain.handle('get-window-display-mode', async(event, ...args) => {
    const win = BrowserWindow.fromWebContents(event.sender) || BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0]
    if (!win) {
      return { isFullScreen: false, isMaximized: false }
    }

    return {
      isFullScreen: win.isFullScreen(),
      isMaximized: win.isMaximized()
    }
  })

  ipcMain.handle('backend:request', async(_event, payload) => {
    return backendService.dispatchRequest(payload)
  })

  ipcMain.handle('backend:get-media-url', async(_event, payload) => {
    return backendService.getMediaUrl(payload?.folder, payload?.ytid)
  })
  ipcMain.on('media-controls:update-state', (_event, payload = {}) => {
    mediaControlsState = {
      canControl: Boolean(payload.canControl),
      isPlaying: Boolean(payload.isPlaying),
      title: String(payload.title || ''),
      artist: String(payload.artist || '')
    }
    refreshTrayMenu()
  })

  createWindow()
  createTray()

  powerMonitor.on('lock-screen', () => {
    powerSaveBlocker.start('prevent-display-sleep')
  })
  powerMonitor.on('suspend', () => {
    powerSaveBlocker.start('prevent-app-suspension')
  })

  app.on('activate', function() {
    /*
     * On macOS it's common to re-create a window in the app when the
     * dock icon is clicked and there are no other windows open.
     */
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

/*
 * Quit when all windows are closed, except on macOS. There, it's common
 * for applications and their menu bar to stay active until the user quits
 * explicitly with Cmd + Q.
 */
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

/*
 * In this file you can include the rest of your app"s specific main process
 * code. You can also put them in separate files and require them here.
 */
