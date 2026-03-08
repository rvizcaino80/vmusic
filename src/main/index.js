import { clipboard, app, shell, BrowserWindow, ipcMain, powerMonitor, powerSaveBlocker, Menu, Tray, nativeImage } from 'electron'
import os from 'os'
import { join } from 'path'
import fs from 'fs'
import { spawn, spawnSync } from 'child_process'
import https from 'https'
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
let customUpdateCheckTimer = null
let customUpdateState = {
  status: 'idle',
  version: '',
  releaseNotes: '',
  releaseUrl: '',
  downloaded: false,
  supported: process.platform === 'darwin',
  message: ''
}
let customUpdateContext = {
  latestRelease: null,
  zipAsset: null,
  zipPath: null,
  extractedAppPath: null,
  targetAppPath: null,
  shouldInstallOnQuit: false,
  helperLaunched: false
}
const CUSTOM_UPDATE_INTERVAL_MS = 30 * 60 * 1000
const CUSTOM_UPDATE_OWNER = 'rvizcaino80'
const CUSTOM_UPDATE_REPO = 'vmusic'

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
  if (process.platform === 'darwin' && !isMacAppEligibleForAutoUpdate()) {
    console.warn('[vmusic][updates] Skipping auto-update because the app is not signed with a valid Developer ID identity.')

    return
  }

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

function isMacAppEligibleForAutoUpdate() {
  try {
    const appPath = app.getPath('exe').includes('.app/') ? app.getPath('exe').split('.app/')[0] + '.app' : app.getAppPath()
    const result = spawnSync('codesign', ['-dv', '--verbose=4', appPath], {
      encoding: 'utf8'
    })
    const output = `${result.stdout || ''}\n${result.stderr || ''}`
    if (result.status !== 0 && !output.trim()) {
      throw new Error(`codesign exited with status ${result.status}`)
    }

    const signature = output.match(/Signature=(.+)/)?.[1]?.trim() || ''
    const teamIdentifier = output.match(/TeamIdentifier=(.+)/)?.[1]?.trim() || ''
    const isAdhoc = signature.toLowerCase() === 'adhoc'
    const hasTeam = teamIdentifier && teamIdentifier !== 'not set'

    if (isAdhoc || !hasTeam) {
      console.warn('[vmusic][updates] macOS signature is not eligible for auto-update', {
        signature,
        teamIdentifier
      })

      return false
    }

    return true
  } catch (error) {
    console.warn('[vmusic][updates] Failed to inspect macOS code signature', error)

    return false
  }
}

function broadcastCustomUpdateState() {
  BrowserWindow.getAllWindows()
    .filter((window) => !window.isDestroyed())
    .forEach((window) => {
      window.webContents.send('custom-updater:state', customUpdateState)
    })
}

function setCustomUpdateState(nextState) {
  customUpdateState = {
    ...customUpdateState,
    ...nextState
  }
  broadcastCustomUpdateState()
}

function compareVersions(a, b) {
  const parse = (value) => String(value || '')
    .replace(/^v/i, '')
    .split('.')
    .map((part) => Number.parseInt(part, 10) || 0)
  const left = parse(a)
  const right = parse(b)
  const maxLength = Math.max(left.length, right.length)

  for (let index = 0; index < maxLength; index += 1) {
    const diff = (left[index] || 0) - (right[index] || 0)
    if (diff !== 0) return diff
  }

  return 0
}

function getCurrentBundlePath() {
  const exePath = app.getPath('exe')
  const appMarker = '.app/'
  const markerIndex = exePath.indexOf(appMarker)
  if (markerIndex !== -1) {
    return `${exePath.slice(0, markerIndex)}.app`
  }

  return app.getAppPath()
}

function ensureUserApplicationsDir() {
  const userApplicationsDir = join(os.homedir(), 'Applications')
  fs.mkdirSync(userApplicationsDir, { recursive: true })

  return userApplicationsDir
}

function getWritableTargetAppPath() {
  const currentBundlePath = getCurrentBundlePath()
  const userApplicationsDir = ensureUserApplicationsDir()
  const preferredPath = join(userApplicationsDir, 'Salsamania.app')

  if (currentBundlePath.startsWith(userApplicationsDir)) {
    return currentBundlePath
  }

  if (currentBundlePath === preferredPath) {
    return currentBundlePath
  }

  return preferredPath
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'ignore', ...options })
    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) {
        resolve()

        return
      }

      reject(new Error(`${command} exited with code ${code}`))
    })
  })
}

function httpsGetJson(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, {
      headers: {
        'User-Agent': 'Salsamania-Updater',
        Accept: 'application/vnd.github+json'
      }
    }, (response) => {
      if ((response.statusCode || 0) >= 300 && (response.statusCode || 0) < 400 && response.headers.location) {
        resolve(httpsGetJson(response.headers.location))

        return
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Request failed with status ${response.statusCode}`))

        return
      }

      let body = ''
      response.setEncoding('utf8')
      response.on('data', (chunk) => {
        body += chunk
      })
      response.on('end', () => {
        try {
          resolve(JSON.parse(body))
        } catch (error) {
          reject(error)
        }
      })
    })

    request.on('error', reject)
  })
}

function downloadFile(url, destinationPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destinationPath)
    const request = https.get(url, {
      headers: {
        'User-Agent': 'Salsamania-Updater',
        Accept: 'application/octet-stream'
      }
    }, (response) => {
      if ((response.statusCode || 0) >= 300 && (response.statusCode || 0) < 400 && response.headers.location) {
        file.close(() => {
          fs.rmSync(destinationPath, { force: true })
          resolve(downloadFile(response.headers.location, destinationPath))
        })

        return
      }

      if (response.statusCode !== 200) {
        file.close(() => {
          fs.rmSync(destinationPath, { force: true })
          reject(new Error(`Download failed with status ${response.statusCode}`))
        })

        return
      }

      response.pipe(file)
      file.on('finish', () => {
        file.close(resolve)
      })
    })

    request.on('error', (error) => {
      file.close(() => {
        fs.rmSync(destinationPath, { force: true })
        reject(error)
      })
    })
  })
}

function selectMacZipAsset(release) {
  const assets = Array.isArray(release?.assets) ? release.assets : []
  const arch = process.arch === 'arm64' ? 'arm64' : 'x64'
  const matchesArch = (name) => {
    const normalized = String(name || '').toLowerCase()
    if (!normalized.endsWith('.zip')) return false
    if (!normalized.includes('mac')) return false

    return arch === 'arm64' ? normalized.includes('arm64') : normalized.includes('x64') || normalized.includes('amd64')
  }

  return assets.find((asset) => matchesArch(asset.name)) || assets.find((asset) => {
    const normalized = String(asset?.name || '').toLowerCase()

    return normalized.endsWith('.zip') && normalized.includes('mac')
  }) || null
}

async function checkCustomMacUpdate({ silent = false } = {}) {
  if (process.platform !== 'darwin') return customUpdateState

  try {
    if (!silent) {
      setCustomUpdateState({
        status: 'checking',
        message: 'Buscando actualizaciones...'
      })
    }

    const release = await httpsGetJson(`https://api.github.com/repos/${CUSTOM_UPDATE_OWNER}/${CUSTOM_UPDATE_REPO}/releases/latest`)
    const latestVersion = String(release?.tag_name || release?.name || '')
      .replace(/^v/i, '')
    const currentVersion = String(app.getVersion() || '').replace(/^v/i, '')
    const zipAsset = selectMacZipAsset(release)

    customUpdateContext.latestRelease = release
    customUpdateContext.zipAsset = zipAsset
    customUpdateContext.targetAppPath = getWritableTargetAppPath()

    if (!latestVersion || compareVersions(latestVersion, currentVersion) <= 0) {
      setCustomUpdateState({
        status: 'up-to-date',
        version: currentVersion,
        releaseNotes: '',
        releaseUrl: release?.html_url || '',
        downloaded: false,
        message: 'Ya tienes la última versión.'
      })

      return customUpdateState
    }

    if (!zipAsset?.browser_download_url) {
      throw new Error('No se encontró un zip de macOS para la última release.')
    }

    setCustomUpdateState({
      status: 'available',
      version: latestVersion,
      releaseNotes: String(release?.body || ''),
      releaseUrl: String(release?.html_url || ''),
      downloaded: false,
      message: `Actualización disponible: ${latestVersion}`
    })

    return customUpdateState
  } catch (error) {
    setCustomUpdateState({
      status: 'error',
      message: error?.message || 'No se pudo buscar actualizaciones.'
    })

    return customUpdateState
  }
}

async function downloadCustomMacUpdate() {
  if (process.platform !== 'darwin') return customUpdateState
  if (!customUpdateContext.zipAsset?.browser_download_url) {
    await checkCustomMacUpdate()
  }
  if (!customUpdateContext.zipAsset?.browser_download_url) {
    throw new Error('No hay update disponible para descargar.')
  }

  setCustomUpdateState({
    status: 'downloading',
    downloaded: false,
    message: 'Descargando actualización...'
  })

  const tempDir = fs.mkdtempSync(join(os.tmpdir(), 'salsamania-update-'))
  const zipPath = join(tempDir, customUpdateContext.zipAsset.name || 'update.zip')
  const extractDir = join(tempDir, 'extract')
  fs.mkdirSync(extractDir, { recursive: true })

  await downloadFile(customUpdateContext.zipAsset.browser_download_url, zipPath)
  await runCommand('ditto', ['-x', '-k', zipPath, extractDir])

  const extractedEntries = fs.readdirSync(extractDir)
  const appName = extractedEntries.find((entry) => entry.endsWith('.app'))
  if (!appName) {
    throw new Error('No se encontró la app dentro del zip descargado.')
  }

  customUpdateContext.zipPath = zipPath
  customUpdateContext.extractedAppPath = join(extractDir, appName)
  customUpdateContext.targetAppPath = getWritableTargetAppPath()

  setCustomUpdateState({
    status: 'downloaded',
    downloaded: true,
    message: 'Actualización descargada. Lista para instalar.'
  })

  return customUpdateState
}

function launchCustomMacInstallHelper() {
  if (customUpdateContext.helperLaunched || !customUpdateContext.extractedAppPath || !customUpdateContext.targetAppPath) {
    return
  }

  const helperScriptPath = join(os.tmpdir(), `salsamania-install-${Date.now()}.sh`)
  const escapedSource = customUpdateContext.extractedAppPath.replace(/"/g, '\\"')
  const escapedTarget = customUpdateContext.targetAppPath.replace(/"/g, '\\"')
  const script = `#!/bin/bash
set -e
for i in {1..60}; do
  if ! pgrep -x "Salsamania" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
mkdir -p "${join(os.homedir(), 'Applications').replace(/"/g, '\\"')}"
rm -rf "${escapedTarget}"
ditto "${escapedSource}" "${escapedTarget}"
open "${escapedTarget}"
`
  fs.writeFileSync(helperScriptPath, script, { mode: 0o755 })
  const child = spawn('/bin/bash', [helperScriptPath], {
    detached: true,
    stdio: 'ignore'
  })
  child.unref()
  customUpdateContext.helperLaunched = true
}

function requestCustomMacInstallNow() {
  if (customUpdateState.status !== 'downloaded') {
    throw new Error('No hay actualización descargada para instalar.')
  }

  customUpdateContext.shouldInstallOnQuit = true
  setCustomUpdateState({
    status: 'installing',
    message: 'Instalando actualización...'
  })
  app.quit()
}

function scheduleCustomMacUpdateChecks() {
  if (process.platform !== 'darwin') return
  if (customUpdateCheckTimer) {
    clearInterval(customUpdateCheckTimer)
    customUpdateCheckTimer = null
  }

  checkCustomMacUpdate({ silent: false })
    .then((state) => {
      if (state.status === 'available') {
        return downloadCustomMacUpdate()
      }

      return null
    })
    .catch((error) => {
      setCustomUpdateState({
        status: 'error',
        message: error?.message || 'No se pudo preparar la actualización.'
      })
    })

  customUpdateCheckTimer = setInterval(() => {
    checkCustomMacUpdate({ silent: true })
      .then((state) => {
        if (state.status === 'available' && !customUpdateState.downloaded) {
          return downloadCustomMacUpdate()
        }

        return null
      })
      .catch(() => {})
  }, CUSTOM_UPDATE_INTERVAL_MS)
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
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.send('custom-updater:state', customUpdateState)
  })

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
  ipcMain.handle('custom-updater:get-state', async() => customUpdateState)
  ipcMain.handle('custom-updater:check', async() => checkCustomMacUpdate({ silent: false }))
  ipcMain.handle('custom-updater:install-now', async() => {
    requestCustomMacInstallNow()

    return { ok: true }
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
  scheduleCustomMacUpdateChecks()

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

app.on('before-quit', () => {
  if (customUpdateCheckTimer) {
    clearInterval(customUpdateCheckTimer)
    customUpdateCheckTimer = null
  }
  if (process.platform === 'darwin' && customUpdateContext.shouldInstallOnQuit) {
    launchCustomMacInstallHelper()
  }
})

/*
 * In this file you can include the rest of your app"s specific main process
 * code. You can also put them in separate files and require them here.
 */
