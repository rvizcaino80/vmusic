import {
  clipboard,
  app,
  shell,
  BrowserWindow,
  ipcMain,
  powerMonitor,
  powerSaveBlocker,
  dialog,
  session as electronSession
} from 'electron'
import os from 'os'
import { dirname, extname, join } from 'path'
import fs from 'fs'
import { spawn } from 'child_process'
import https from 'https'
import { pathToFileURL } from 'url'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { updateElectronApp, UpdateSourceType } from 'update-electron-app'
import icon from '../../resources/icon.png?asset'
import backendService from './backend/service.cjs'

let mainWindow = null
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
const CUSTOM_UPDATE_INTERVAL_MS = 10 * 60 * 1000
const CUSTOM_UPDATE_OWNER = 'rvizcaino80'
const CUSTOM_UPDATE_REPO = 'vmusic'
const COVER_CACHE_DIRNAME = 'covers'
const activePowerSaveBlockers = {
  appSuspension: null,
  displaySleep: null
}

function sanitizeCoverId(value) {
  return String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '_')
}

function getCoverCacheDir() {
  const dir = join(app.getPath('userData'), COVER_CACHE_DIRNAME)
  fs.mkdirSync(dir, { recursive: true })

  return dir
}

function findExistingCoverPath(cacheKey) {
  if (!cacheKey) return null

  const cacheDir = getCoverCacheDir()
  const prefix = `${cacheKey}.`

  try {
    const match = fs.readdirSync(cacheDir).find((entry) => entry.startsWith(prefix))

    return match ? join(cacheDir, match) : null
  } catch {
    return null
  }
}

function resolveCoverExtension(url, contentType = '') {
  const normalizedType = String(contentType || '').toLowerCase()
  if (normalizedType.includes('image/png')) return '.png'
  if (normalizedType.includes('image/webp')) return '.webp'
  if (normalizedType.includes('image/gif')) return '.gif'
  if (normalizedType.includes('image/avif')) return '.avif'
  if (normalizedType.includes('image/jpeg') || normalizedType.includes('image/jpg')) return '.jpg'

  try {
    const parsed = new URL(url)
    const parsedExt = extname(parsed.pathname || '').toLowerCase()
    if (['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'].includes(parsedExt)) {
      return parsedExt === '.jpeg' ? '.jpg' : parsedExt
    }
  } catch {}

  return '.jpg'
}

function toVersionedFileUrl(filePath) {
  const fileUrl = pathToFileURL(filePath)
  try {
    const stats = fs.statSync(filePath)
    fileUrl.searchParams.set('v', String(stats.mtimeMs || Date.now()))
  } catch {
    fileUrl.searchParams.set('v', String(Date.now()))
  }

  return fileUrl.toString()
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function startPowerSaveBlocker(kind, type) {
  const existingId = activePowerSaveBlockers[kind]
  if (existingId && powerSaveBlocker.isStarted(existingId)) {
    return existingId
  }

  const blockerId = powerSaveBlocker.start(type)
  activePowerSaveBlockers[kind] = blockerId

  return blockerId
}

function stopPowerSaveBlockers() {
  for (const kind of Object.keys(activePowerSaveBlockers)) {
    const blockerId = activePowerSaveBlockers[kind]
    if (!blockerId) continue

    try {
      if (powerSaveBlocker.isStarted(blockerId)) {
        powerSaveBlocker.stop(blockerId)
      }
    } catch {}

    activePowerSaveBlockers[kind] = null
  }
}

function keepAppAwake() {
  startPowerSaveBlocker('appSuspension', 'prevent-app-suspension')
  startPowerSaveBlocker('displaySleep', 'prevent-display-sleep')
}

async function cacheCoverImage(payload = {}) {
  const rawUrl = String(payload?.url || '').trim()
  const cacheKey = sanitizeCoverId(payload?.cacheKey)
  const forceRefresh = Boolean(payload?.forceRefresh)
  if (!rawUrl || !cacheKey) return null

  let parsedUrl
  try {
    parsedUrl = new URL(rawUrl)
  } catch {
    return null
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    return rawUrl
  }

  const existingCoverPath = findExistingCoverPath(cacheKey)
  if (!forceRefresh && existingCoverPath && fs.existsSync(existingCoverPath)) {
    return toVersionedFileUrl(existingCoverPath)
  }

  const response = await fetch(parsedUrl.toString(), {
    headers: {
      'User-Agent': 'Salsamania/1.0'
    }
  })
  if (!response.ok) {
    throw new Error(`Cover request failed with status ${response.status}`)
  }

  const arrayBuffer = await response.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  const ext = resolveCoverExtension(parsedUrl.toString(), response.headers.get('content-type'))
  const cacheDir = getCoverCacheDir()
  const targetPath = join(cacheDir, `${cacheKey}${ext}`)

  const previousPath = findExistingCoverPath(cacheKey)
  if (previousPath && previousPath !== targetPath) {
    try {
      fs.unlinkSync(previousPath)
    } catch {}
  }

  fs.writeFileSync(targetPath, buffer)

  return toVersionedFileUrl(targetPath)
}

async function readSpotifyValue(webContents, script) {
  try {
    return await webContents.executeJavaScript(script, true)
  } catch {
    return ''
  }
}

async function waitForSpotifyValue(webContents, script, timeoutMs = 15000, intervalMs = 300) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    const value = await readSpotifyValue(webContents, script)
    if (value) return value
    await delay(intervalMs)
  }

  return ''
}

async function seedSpotifySearchInput(webContents, searchTerm = '') {
  const normalizedSearchTerm = String(searchTerm || '').trim()
  if (!normalizedSearchTerm) return { seeded: false, reason: 'empty-search-term' }

  return readSpotifyValue(webContents,
    `(() => {
      const value = ${JSON.stringify(normalizedSearchTerm)}
      const inputs = Array.from(document.querySelectorAll('input'))
      const inputDetails = inputs.slice(0, 20).map((element) => ({
        type: String(element?.type || ''),
        placeholder: String(element?.placeholder || ''),
        ariaLabel: String(element?.getAttribute?.('aria-label') || ''),
        dataTestId: String(element?.getAttribute?.('data-testid') || ''),
        role: String(element?.getAttribute?.('role') || ''),
        value: String(element?.value || '')
      }))
      const input = inputs.find((element) => {
        if (!element) return false
        const type = String(element.type || '').toLowerCase()
        const placeholder = String(element.placeholder || '').toLowerCase()
        const ariaLabel = String(element.getAttribute?.('aria-label') || '').toLowerCase()
        const dataTestId = String(element.getAttribute?.('data-testid') || '').toLowerCase()
        return type === 'search'
          || type === 'text'
          || placeholder.includes('search')
          || ariaLabel.includes('search')
          || dataTestId.includes('search')
      })
      if (!input) {
        return { seeded: false, reason: 'no-search-input', inputCount: inputs.length, inputDetails }
      }
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      if (!setter) {
        return { seeded: false, reason: 'no-input-setter', inputCount: inputs.length, inputDetails }
      }
      setter.call(input, value)
      input.focus()
      input.dispatchEvent(new Event('input', { bubbles: true, composed: true }))
      input.dispatchEvent(new Event('change', { bubbles: true }))
      input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter', code: 'Enter', keyCode: 13, which: 13 }))
      input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'Enter', code: 'Enter', keyCode: 13, which: 13 }))
      return { seeded: true, inputCount: inputs.length, value: input.value || '', inputDetails }
    })()`)
}

async function activateSpotifySearchView(webContents) {
  return readSpotifyValue(webContents,
    `(() => {
      const candidates = Array.from(document.querySelectorAll('a, button, [role="link"], [role="button"]'))
      const target = candidates.find((element) => {
        const text = String(element?.innerText || element?.textContent || '').trim().toLowerCase()
        const ariaLabel = String(element?.getAttribute?.('aria-label') || '').trim().toLowerCase()
        const href = String(element?.href || element?.getAttribute?.('href') || '').trim().toLowerCase()
        return text === 'search'
          || text.includes('search')
          || ariaLabel.includes('search')
          || href.includes('/search')
      })
      if (!target) {
        return { activated: false, reason: 'no-search-target', candidateCount: candidates.length }
      }
      target.click()
      return { activated: true, candidateCount: candidates.length, text: String(target.innerText || target.textContent || '').trim() }
    })()`)
}

async function dismissSpotifyCookieBanner(webContents) {
  return readSpotifyValue(webContents,
    `(() => {
      const candidates = Array.from(document.querySelectorAll('button, [role="button"], a'))
      const target = candidates.find((element) => {
        const text = String(element?.innerText || element?.textContent || '').trim().toLowerCase()
        const ariaLabel = String(element?.getAttribute?.('aria-label') || '').trim().toLowerCase()
        return /accept|agree|allow all|reject all|deny|dismiss|close|got it|continue/i.test(text)
          || /accept|agree|allow all|reject all|deny|dismiss|close|got it|continue/i.test(ariaLabel)
      })
      if (!target) {
        return { dismissed: false, reason: 'no-cookie-target', candidateCount: candidates.length }
      }
      target.click()
      return { dismissed: true, candidateCount: candidates.length, text: String(target.innerText || target.textContent || '').trim() }
    })()`)
}

function normalizeSpotifyUrl(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw
  if (raw.startsWith('/')) return `https://open.spotify.com${raw}`

  return `https://open.spotify.com/${raw}`
}

function buildSpotifyTrackUrl(trackId) {
  const raw = String(trackId || '').trim()
  if (!raw) return ''

  return `https://open.spotify.com/track/${raw}`
}

function extractSpotifyTrackId(value = '') {
  const raw = String(value || '').trim()
  if (!raw) return ''
  const uriMatch = raw.match(/spotify:track:([a-zA-Z0-9]+)/i)
  if (uriMatch?.[1]) return uriMatch[1]
  const urlMatch = raw.match(/open\.spotify\.com\/track\/([a-zA-Z0-9]+)/i)
  if (urlMatch?.[1]) return urlMatch[1]

  return ''
}

async function getSpotifyCookieHeader() {
  try {
    const cookies = await electronSession.defaultSession.cookies.get({ domain: '.spotify.com' })
    if (!Array.isArray(cookies) || cookies.length === 0) return ''

    return cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ')
  } catch {
    return ''
  }
}

async function getSpotifyAccessToken() {
  const cookie = await getSpotifyCookieHeader()
  const tokenUrl = 'https://open.spotify.com/get_access_token?reason=transport&productType=web_player'
  const response = await fetch(tokenUrl, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      Accept: 'application/json',
      Referer: 'https://open.spotify.com/',
      Cookie: cookie
    }
  })
  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`Spotify token request failed (${response.status}): ${body.slice(0, 200)}`)
  }

  const data = await response.json()
  const accessToken = String(data?.accessToken || '').trim()
  if (!accessToken) {
    throw new Error('Spotify token response missing accessToken')
  }

  return accessToken
}

function pickFirstSpotifyTrackFromSearchData(data) {
  const search = data?.data?.search || data?.data?.searchV2 || data?.search?.results || data?.searchResults || data?.results || data?.data || data || {}
  const candidates = []
  const visited = new Set()

  const pushCandidate = (item) => {
    if (!item || typeof item !== 'object') return
    const uri = item?.uri || item?.data?.uri || item?.track?.uri || item?.item?.uri || ''
    const trackId = extractSpotifyTrackId(uri)
    if (!trackId) return

    const coverSource = item?.coverArt?.sources || item?.album?.coverArt?.sources || item?.data?.coverArt?.sources || item?.albumOfTrack?.coverArt?.sources || item?.track?.album?.coverArt?.sources || item?.visual?.image?.sources || item?.images || []
    const coverUrl = Array.isArray(coverSource) && coverSource.length > 0 ? String(coverSource[coverSource.length - 1]?.url || coverSource[0]?.url || '').trim() : ''

    candidates.push({
      trackId,
      coverUrl
    })
  }

  const walk = (value, depth = 0) => {
    if (!value || typeof value !== 'object' || visited.has(value) || depth > 5) return
    visited.add(value)

    if (Array.isArray(value)) {
      for (const item of value) {
        if (item && typeof item === 'object') {
          pushCandidate(item)
          walk(item, depth + 1)
        }
      }

      return
    }

    pushCandidate(value)

    const preferredKeys = [
      'tracks',
      'topResults',
      'topResult',
      'results',
      'items',
      'content',
      'data',
      'album',
      'albumOfTrack',
      'track',
      'item',
      'entities',
      'pages',
      'sections'
    ]

    for (const key of preferredKeys) {
      if (value[key] && typeof value[key] === 'object') {
        walk(value[key], depth + 1)
      }
    }
  }

  walk(search, 0)
  const picked = candidates[0] || { trackId: '', coverUrl: '' }

  return {
    trackId: picked.trackId || '',
    coverUrl: picked.coverUrl || ''
  }
}

async function fetchSpotifySearchDesktop(searchTerm = '') {
  const token = await getSpotifyAccessToken()

  return fetchSpotifySearchDesktopWithToken(token, searchTerm)
}

async function fetchSpotifySearchDesktopWithToken(token, searchTerm = '') {
  const accessToken = String(token || '').trim()
  const normalizedSearchTerm = String(searchTerm || '').trim()
  if (!accessToken || !normalizedSearchTerm) return null
  const params = new URLSearchParams({
    operationName: 'searchDesktop',
    variables: JSON.stringify({
      searchTerm: normalizedSearchTerm,
      offset: 0,
      limit: 10,
      numberOfTopResults: 5
    }),
    extensions: JSON.stringify({
      persistedQuery: {
        version: 1,
        sha256Hash: '75bbf6bfcfdf85b8fc828417bfad92b7cd66bf7f556d85670f4da8292373ebec'
      }
    })
  })
  const response = await fetch(`https://api-partner.spotify.com/pathfinder/v1/query?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
        Referer: 'https://open.spotify.com/'
      }
    })
  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`Spotify search request failed (${response.status}): ${body.slice(0, 200)}`)
  }

  return response.json()
}

async function fetchSpotifyTrackUrlFromBrowser(searchUrl = '', searchTerm = '') {
  const targetSearchUrl = String(searchUrl || '').trim()
  const normalizedSearchTerm = String(searchTerm || '').trim()
  if (!targetSearchUrl || !normalizedSearchTerm) return null

  const searchWindow = new BrowserWindow({
    show: false,
    width: 1280,
    height: 900,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true,
      backgroundThrottling: false
    }
  })

  try {
    const debuggerProtocol = searchWindow.webContents.debugger
    let debuggerAttached = false
    let tokenRequestId = ''
    let tokenResolved = false
    let tokenResolve = null
    let tokenReject = null
    const tokenPromise = new Promise((resolve, reject) => {
      tokenResolve = resolve
      tokenReject = reject
    })

    const cleanupDebugger = () => {
      if (!debuggerAttached) return
      try {
        debuggerProtocol.removeAllListeners('message')
      } catch {}
      try {
        debuggerProtocol.detach()
      } catch {}
      debuggerAttached = false
    }

    const handleDebuggerMessage = async(_event, method, params) => {
      if (method === 'Network.requestWillBeSent') {
        const requestUrl = String(params?.request?.url || '')
        if ((/open\.spotify\.com\/api\/token/i).test(requestUrl)) {
          tokenRequestId = String(params?.requestId || '')
          console.debug('[vmusic][spotify-cover] browser token request', {
            url: requestUrl,
            requestId: tokenRequestId
          })
        }

        return
      }

      if (method === 'Network.responseReceived') {
        const responseUrl = String(params?.response?.url || '')
        if (!(/open\.spotify\.com\/api\/token/i).test(responseUrl)) return
        console.debug('[vmusic][spotify-cover] browser token response received', {
          url: responseUrl,
          requestId: String(params?.requestId || '')
        })

        return
      }

      if (method !== 'Network.loadingFinished') return
      const requestId = String(params?.requestId || '')
      if (!tokenRequestId || requestId !== tokenRequestId || tokenResolved) return

      try {
        const bodyResponse = await debuggerProtocol.sendCommand('Network.getResponseBody', {
          requestId
        })
        const rawBody = String(bodyResponse?.body || '')
        console.debug('[vmusic][spotify-cover] browser token response body', {
          length: rawBody.length,
          sample: rawBody.slice(0, 500)
        })
        let parsedBody = null
        try {
          parsedBody = JSON.parse(rawBody)
        } catch {}
        const token = String(parsedBody?.accessToken || parsedBody?.access_token || '').trim()
        if (token) {
          tokenResolved = true
          tokenResolve(token)
          console.debug('[vmusic][spotify-cover] browser token captured', {
            hasToken: true,
            tokenLength: token.length
          })
        }
      } catch (error) {
        console.warn('[vmusic][spotify-cover] browser token read failed', {
          requestId,
          error
        })
        tokenReject(error)
      }
    }

    try {
      debuggerProtocol.attach('1.3')
      debuggerAttached = true
      debuggerProtocol.sendCommand('Network.enable')
      debuggerProtocol.on('message', handleDebuggerMessage)
    } catch (error) {
      console.warn('[vmusic][spotify-cover] browser debugger attach failed', error)
    }

    const loadSearchPage = searchWindow.loadURL(targetSearchUrl)
    const loaded = await Promise.race([
      loadSearchPage
        .then(() => true)
        .catch((error) => {
          console.warn('[vmusic][spotify-cover] browser search load failed', error)

          return false
        }),
      delay(12000).then(() => false)
    ])
    console.debug('[vmusic][spotify-cover] browser search load completed', {
      loaded,
      targetSearchUrl
    })
    if (!loaded) return null

    const token = await Promise.race([tokenPromise, delay(10000).then(() => '')]).catch(() => '')
    if (!token) {
      console.warn('[vmusic][spotify-cover] browser token missing', { targetSearchUrl })

      return null
    }

    const browserSearchResult = await fetchSpotifySearchDesktopWithToken(token,
      normalizedSearchTerm)
    console.debug('[vmusic][spotify-cover] browser token search result', browserSearchResult)
    const picked = pickFirstSpotifyTrackFromSearchData(browserSearchResult)
    console.debug('[vmusic][spotify-cover] browser token picked candidate', picked)

    return picked?.trackId ? buildSpotifyTrackUrl(picked.trackId) : ''
  } finally {
    try {
      cleanupDebugger()
    } catch {}
    if (!searchWindow.isDestroyed()) {
      searchWindow.destroy()
    }
  }
}

async function fetchSpotifySearchFromBrowser(searchUrl = '', searchTerm = '') {
  const targetSearchUrl = String(searchUrl || '').trim()
  const normalizedSearchTerm = String(searchTerm || '').trim()
  if (!targetSearchUrl || !normalizedSearchTerm) return null

  const searchWindow = new BrowserWindow({
    show: false,
    width: 1280,
    height: 900,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true,
      backgroundThrottling: false
    }
  })

  try {
    const debuggerProtocol = searchWindow.webContents.debugger
    let debuggerAttached = false
    const trackedRequests = new Map()
    let capturedSpotifyToken = ''
    let resolvedResponse = false
    let responseResolve = null
    let responseReject = null
    const responsePromise = new Promise((resolve, reject) => {
      responseResolve = resolve
      responseReject = reject
    })

    const cleanupDebugger = () => {
      if (!debuggerAttached) return
      try {
        debuggerProtocol.removeAllListeners('message')
      } catch {}
      try {
        debuggerProtocol.detach()
      } catch {}
      debuggerAttached = false
    }

    const resolveTrackedResponse = async(requestId) => {
      if (resolvedResponse || !requestId || !trackedRequests.has(requestId)) return
      const trackedRequest = trackedRequests.get(requestId) || {}

      try {
        const bodyResponse = await debuggerProtocol.sendCommand('Network.getResponseBody', {
          requestId
        })
        const rawBody = String(bodyResponse?.body || '')
        console.debug('[vmusic][spotify-cover] browser api response body', {
          url: trackedRequest.url || '',
          length: rawBody.length,
          sample: rawBody.slice(0, 500)
        })
        let parsedBody = null
        try {
          parsedBody = JSON.parse(rawBody)
        } catch {}

        const picked = pickFirstSpotifyTrackFromSearchData(parsedBody || rawBody || null)
        console.debug('[vmusic][spotify-cover] browser api picked candidate', {
          requestId,
          operationName: trackedRequest.operationName || '',
          query: trackedRequest.query || '',
          picked
        })
        if (picked?.trackId || picked?.coverUrl) {
          resolvedResponse = true
          responseResolve(parsedBody || rawBody || null)

          return
        }

        trackedRequests.delete(requestId)
      } catch (error) {
        console.warn('[vmusic][spotify-cover] browser api body read failed', {
          requestId,
          url: trackedRequest.url || '',
          error
        })
        trackedRequests.delete(requestId)
      }
    }

    const resolveSpotifyTokenResponse = async(requestId) => {
      try {
        const bodyResponse = await debuggerProtocol.sendCommand('Network.getResponseBody', {
          requestId
        })
        const rawBody = String(bodyResponse?.body || '')
        console.debug('[vmusic][spotify-cover] browser token response body', {
          length: rawBody.length,
          sample: rawBody.slice(0, 500)
        })
        let parsedBody = null
        try {
          parsedBody = JSON.parse(rawBody)
        } catch {}
        const token = String(parsedBody?.accessToken || parsedBody?.access_token || '').trim()
        if (token) {
          capturedSpotifyToken = token
          console.debug('[vmusic][spotify-cover] browser token captured', {
            hasToken: Boolean(token),
            tokenLength: token.length
          })
        }
      } catch (error) {
        console.warn('[vmusic][spotify-cover] browser token read failed', {
          requestId,
          error
        })
      }
    }

    const handleDebuggerMessage = async(_event, method, params) => {
      if (method === 'Fetch.requestPaused') {
        const requestId = String(params?.requestId || '')
        const requestUrl = String(params?.request?.url || '')
        const requestMethod = String(params?.request?.method || '')
        const requestPostData = String(params?.request?.postData || '')
        const isSpotifyQuery = (/api-partner\.spotify\.com\/pathfinder\/v[12]\/query/i).test(requestUrl)

        if (isSpotifyQuery && requestMethod === 'POST') {
          let parsedPostData = null
          try {
            parsedPostData = JSON.parse(requestPostData || '{}')
          } catch {}
          const operationName = String(parsedPostData?.operationName || '')
          const currentQuery = String(parsedPostData?.variables?.query || '').trim()
          const shouldRewrite = (/findTopResults|searchDesktop/i).test(operationName) && !currentQuery

          if (shouldRewrite) {
            const nextPostData = {
              ...parsedPostData,
              variables: {
                ...(parsedPostData?.variables || {}),
                query: normalizedSearchTerm
              }
            }
            const serializedPostData = JSON.stringify(nextPostData)
            const encodedPostData = Buffer.from(serializedPostData, 'utf8').toString('base64')
            console.debug('[vmusic][spotify-cover] browser api request rewritten', {
              requestId,
              operationName,
              fromQuery: currentQuery,
              toQuery: normalizedSearchTerm
            })
            trackedRequests.set(requestId, {
              url: requestUrl,
              method: requestMethod,
              postData: serializedPostData.slice(0, 500),
              operationName,
              query: normalizedSearchTerm
            })
            try {
              await debuggerProtocol.sendCommand('Fetch.continueRequest', {
                requestId,
                postData: encodedPostData
              })
            } catch (error) {
              console.warn('[vmusic][spotify-cover] browser api rewrite failed', {
                requestId,
                error
              })
              await debuggerProtocol
                .sendCommand('Fetch.continueRequest', { requestId })
                .catch(() => {})
            }

            return
          }
        }

        await debuggerProtocol.sendCommand('Fetch.continueRequest', { requestId }).catch(() => {})

        return
      }

      if (method === 'Network.requestWillBeSent') {
        const requestUrl = String(params?.request?.url || '')
        const requestPostData = String(params?.request?.postData || '')
        if ((/open\.spotify\.com\/api\/token/i).test(requestUrl)) {
          trackedRequests.set(String(params?.requestId || ''), {
            url: requestUrl,
            method: String(params?.request?.method || ''),
            postData: requestPostData.slice(0, 500),
            operationName: 'apiToken',
            query: ''
          })
          console.debug('[vmusic][spotify-cover] browser token request', {
            url: requestUrl,
            requestId: String(params?.requestId || '')
          })

          return
        }
        if ((/api-partner\.spotify\.com\/pathfinder\/v[12]\/query/i).test(requestUrl)) {
          let parsedPostData = null
          try {
            parsedPostData = JSON.parse(requestPostData || '{}')
          } catch {}
          const operationName = String(parsedPostData?.operationName || '')
          const query = String(parsedPostData?.variables?.query || parsedPostData?.variables?.searchTerm || '')
          const normalizedQuery = String(query || '')
            .trim()
            .toLowerCase()
          const normalizedNeedle = String(normalizedSearchTerm || '')
            .trim()
            .toLowerCase()
          const matchesSearch = Boolean(normalizedQuery) && (normalizedQuery.includes(normalizedNeedle) || normalizedNeedle.includes(normalizedQuery) || (/findTopResults|searchDesktop/i).test(operationName || requestPostData || requestUrl))
          const requestId = String(params?.requestId || '')
          trackedRequests.set(requestId, {
            url: requestUrl,
            method: String(params?.request?.method || ''),
            postData: requestPostData.slice(0, 500),
            operationName,
            query
          })
          console.debug('[vmusic][spotify-cover] browser api request', {
            url: requestUrl,
            method: String(params?.request?.method || ''),
            requestId,
            operationName,
            query,
            matchesSearch,
            postDataSample: requestPostData.slice(0, 200)
          })
          if (!matchesSearch) {
            trackedRequests.delete(requestId)
          }
        }

        return
      }
      if (method === 'Network.responseReceived') {
        const responseUrl = String(params?.response?.url || '')
        if ((/open\.spotify\.com\/api\/token/i).test(responseUrl)) {
          console.debug('[vmusic][spotify-cover] browser token response received', {
            url: responseUrl,
            requestId: String(params?.requestId || '')
          })

          return
        }
        if (!(/api-partner\.spotify\.com\/pathfinder\/v[12]\/query/i).test(responseUrl)) return
        console.debug('[vmusic][spotify-cover] browser api response received', {
          url: responseUrl,
          requestId: String(params?.requestId || '')
        })

        return
      }
      if (method === 'Network.loadingFinished') {
        const requestId = String(params?.requestId || '')
        const trackedRequest = trackedRequests.get(requestId)
        if ((/^https:\/\/open\.spotify\.com\/api\/token/i).test(String(trackedRequest?.url || ''))) {
          await resolveSpotifyTokenResponse(requestId)

          return
        }
        if (!trackedRequests.has(requestId)) return
        await resolveTrackedResponse(requestId)
      }
    }

    try {
      debuggerProtocol.attach('1.3')
      debuggerAttached = true
      debuggerProtocol.sendCommand('Network.enable')
      debuggerProtocol.sendCommand('Fetch.enable', {
        patterns: [
          {
            urlPattern: '*api-partner.spotify.com/pathfinder/v1/query*',
            requestStage: 'Request'
          },
          {
            urlPattern: '*api-partner.spotify.com/pathfinder/v2/query*',
            requestStage: 'Request'
          }
        ]
      })
      debuggerProtocol.on('message', handleDebuggerMessage)
    } catch (error) {
      console.warn('[vmusic][spotify-cover] browser debugger attach failed', error)
    }

    const loadSearchPage = searchWindow.loadURL(targetSearchUrl)
    const loaded = await Promise.race([
      loadSearchPage
        .then(() => true)
        .catch((error) => {
          console.warn('[vmusic][spotify-cover] browser search load failed', error)

          return false
        }),
      delay(12000).then(() => false)
    ])
    console.debug('[vmusic][spotify-cover] browser search load completed', {
      loaded,
      targetSearchUrl
    })
    if (!loaded) return null

    const activatedSearchView = await activateSpotifySearchView(searchWindow.webContents)
    console.debug('[vmusic][spotify-cover] browser search view activated', activatedSearchView)

    await delay(1000)
    const dismissedCookieBanner = await dismissSpotifyCookieBanner(searchWindow.webContents)
    console.debug('[vmusic][spotify-cover] browser cookie banner dismissed', dismissedCookieBanner)

    await delay(1000)
    const seededSearch = await seedSpotifySearchInput(searchWindow.webContents,
      normalizedSearchTerm)
    console.debug('[vmusic][spotify-cover] browser search input seeded', seededSearch)

    if (capturedSpotifyToken) {
      try {
        const browserSearchResult = await fetchSpotifySearchDesktopWithToken(capturedSpotifyToken,
          normalizedSearchTerm)
        console.debug('[vmusic][spotify-cover] browser token search result', browserSearchResult)
        const picked = pickFirstSpotifyTrackFromSearchData(browserSearchResult)
        console.debug('[vmusic][spotify-cover] browser token picked candidate', picked)
        if (picked?.trackId) {
          trackHref = buildSpotifyTrackUrl(picked.trackId)
        }
      } catch (error) {
        console.warn('[vmusic][spotify-cover] browser token search failed', error)
      }
    }

    await delay(2500)

    const browserSnapshot = await readSpotifyValue(searchWindow.webContents,
      `(() => ({
        htmlLength: String(document.documentElement?.innerHTML || '').length,
        bodyTextSample: String(document.body?.innerText || '').slice(0, 3000),
        anchorCount: document.querySelectorAll('a[href]').length,
        trackAnchors: Array.from(document.querySelectorAll('a[href]'))
          .map((anchor) => String(anchor.href || anchor.getAttribute('href') || '').trim())
          .filter((href) => /\\/track\\//i.test(href))
          .slice(0, 20),
        resourceEntries: (performance.getEntriesByType('resource') || [])
          .map((entry) => String(entry.name || '').trim())
          .filter(Boolean)
          .slice(0, 50)
      }))()`)
    console.debug('[vmusic][spotify-cover] browser snapshot', browserSnapshot)

    const trackHref = await Promise.race([
      responsePromise.then((payload) => {
        const picked = pickFirstSpotifyTrackFromSearchData(payload)
        console.debug('[vmusic][spotify-cover] browser search picked', picked)

        return picked.coverUrl || (picked.trackId ? buildSpotifyTrackUrl(picked.trackId) : '')
      }),
      waitForSpotifyValue(searchWindow.webContents,
        `(() => {
          const text = document.documentElement?.innerHTML || ''
          const patterns = [
            /href="([^"]*\\/track\\/[^"]+)"/i,
            /href='([^']*\\/track\\/[^']+)'/i,
            /"([^"]*\\/track\\/[^"]+)"/i,
            /'([^']*\\/track\\/[^']+)'/i,
            /spotify:track:([a-zA-Z0-9]+)/i
          ]
          for (const pattern of patterns) {
            const match = text.match(pattern)
            if (match?.[1]) {
              if (match[1].includes('spotify:track:')) {
                return 'https://open.spotify.com/track/' + match[1].split('spotify:track:').pop()
              }
              return String(match[1]).trim()
            }
          }
          const anchors = Array.from(document.querySelectorAll('a[href*="/track/"], a[href*="open.spotify.com/track/"]'))
          const firstAnchor = anchors.find((anchor) => {
            const href = anchor?.href || anchor?.getAttribute?.('href') || ''
            return /\\/track\\//i.test(href)
          })
          return String(firstAnchor?.href || firstAnchor?.getAttribute?.('href') || '').trim()
        })()`,
        20000,
        250)
    ])

    console.debug('[vmusic][spotify-cover] browser search request completed', {
      targetSearchUrl,
      trackHref
    })

    return trackHref || null
  } finally {
    try {
      cleanupDebugger()
    } catch {}
    if (!searchWindow.isDestroyed()) {
      searchWindow.destroy()
    }
  }
}

function extractSpotifyTrackHrefFromHtml(html = '') {
  const source = String(html || '')
  if (!source) return ''

  const hrefPatterns = [
    /href="([^"]*\/track\/[^"]+)"/i,
    /href='([^']*\/track\/[^']+)'/i,
    /"([^"]*\/track\/[^"]+)"/i,
    /'([^']*\/track\/[^']+)'/i,
    /spotify:track:([a-zA-Z0-9]+)/i
  ]

  for (const pattern of hrefPatterns) {
    const match = source.match(pattern)
    if (match?.[1]) {
      if (match[1].includes('spotify:track:')) {
        return `https://open.spotify.com/track/${match[1].split('spotify:track:').pop()}`
      }

      return match[1]
    }
  }

  return ''
}

function extractSpotifyOgImageFromHtml(html = '') {
  const source = String(html || '')
  if (!source) return ''

  const match = source.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i) || source.match(/<meta[^>]+name="twitter:image"[^>]+content="([^"]+)"/i) || source.match(/<meta[^>]+property='og:image'[^>]+content='([^']+)'/i) || source.match(/<meta[^>]+name='twitter:image'[^>]+content='([^']+)'/i)

  return match?.[1] || ''
}

async function fetchTextWithSpotifyHeaders(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8'
    }
  })
  if (!response.ok) return ''

  return response.text()
}

async function resolveSpotifyCoverFromSearchUrl(searchUrl = '') {
  const targetSearchUrl = String(searchUrl || '').trim()
  if (!targetSearchUrl) return null
  console.debug('[vmusic][spotify-cover] resolve start', { targetSearchUrl })
  let trackHref = ''
  const resolutionPath = []

  const searchTerm = (() => {
    try {
      const parsed = new URL(targetSearchUrl)
      const segments = parsed.pathname.split('/').filter(Boolean)
      const rawTerm = decodeURIComponent(segments.slice(1).join(' ') || parsed.searchParams.get('q') || '')

      return String(rawTerm || '').trim()
    } catch {
      return ''
    }
  })()

  if (searchTerm) {
    try {
      console.debug('[vmusic][spotify-cover] browser search start', { searchTerm })
      resolutionPath.push('browser-search:start')
      const browserTrackHref = await fetchSpotifyTrackUrlFromBrowser(targetSearchUrl, searchTerm)
      if (browserTrackHref) {
        trackHref = normalizeSpotifyUrl(browserTrackHref)
        resolutionPath.push('browser-search:track')
        console.debug('[vmusic][spotify-cover] browser search picked', { trackHref })
      }
    } catch (error) {
      resolutionPath.push('browser-search:error')
      console.warn('[vmusic][spotify-cover] browser search failed', error)
    }
  }

  const tryResolveFromHtml = async(url, label) => {
    try {
      const html = await fetchTextWithSpotifyHeaders(url)
      console.debug(`[vmusic][spotify-cover] ${label} fetch`, { length: String(html || '').length })

      return html
    } catch (error) {
      console.warn(`[vmusic][spotify-cover] ${label} fetch failed`, error)

      return ''
    }
  }

  if (!trackHref) {
    const searchHtml = await tryResolveFromHtml(targetSearchUrl, 'search')
    trackHref = extractSpotifyTrackHrefFromHtml(searchHtml)
    console.debug('[vmusic][spotify-cover] track from search html', { trackHref })
    if (trackHref) {
      resolutionPath.push('search-html:track')
    }
  } else {
    console.debug('[vmusic][spotify-cover] track from browser/api result', { trackHref })
  }
  if (!trackHref) {
    return {
      ok: false,
      error: 'spotify-track-not-found',
      searchTerm,
      targetSearchUrl,
      resolutionPath
    }
  }

  console.debug('[vmusic][spotify-cover] track resolved', { trackHref })
  const trackUrl = normalizeSpotifyUrl(trackHref)
  if (!trackUrl) return null

  const trackHtml = await tryResolveFromHtml(trackUrl, 'track')
  let imageUrl = extractSpotifyOgImageFromHtml(trackHtml)
  console.debug('[vmusic][spotify-cover] image from track html', { imageUrl })

  if (!imageUrl) {
    const trackWindow = new BrowserWindow({
      show: false,
      width: 1280,
      height: 900,
      autoHideMenuBar: true,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
        webSecurity: true,
        backgroundThrottling: false
      }
    })

    try {
      const loadTrackPage = trackWindow.loadURL(trackUrl)
      const trackLoaded = await Promise.race([
        loadTrackPage
          .then(() => true)
          .catch((error) => {
            console.warn('[vmusic][spotify-cover] track load failed', error)

            return false
          }),
        delay(12000).then(() => false)
      ])
      console.debug('[vmusic][spotify-cover] track load completed', { trackLoaded, trackUrl })
      if (trackLoaded) {
        const trackDomHtml = await readSpotifyValue(trackWindow.webContents,
          'document.documentElement.outerHTML')
        console.debug('[vmusic][spotify-cover] track dom fallback', {
          hasHtml: Boolean(trackDomHtml),
          length: String(trackDomHtml || '').length
        })
        imageUrl = extractSpotifyOgImageFromHtml(trackDomHtml)
      }
    } finally {
      if (!trackWindow.isDestroyed()) {
        trackWindow.destroy()
      }
    }
  }

  console.debug('[vmusic][spotify-cover] image resolved', { imageUrl })

  if (!imageUrl) {
    return {
      ok: false,
      error: 'spotify-cover-not-resolved',
      searchTerm,
      targetSearchUrl,
      trackUrl,
      resolutionPath
    }
  }

  return imageUrl
}

async function importCoverFile(payload = {}) {
  const cacheKey = sanitizeCoverId(payload?.cacheKey)
  if (!cacheKey) return null

  const ownerWindow = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0] || null
  const result = await dialog.showOpenDialog(ownerWindow, {
    title: 'Seleccionar portada',
    properties: ['openFile'],
    filters: [{ name: 'Imagenes', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'] }]
  })

  if (result.canceled || !result.filePaths?.[0]) return null

  const sourcePath = result.filePaths[0]
  const ext = resolveCoverExtension(sourcePath)
  const cacheDir = getCoverCacheDir()
  const targetPath = join(cacheDir, `${cacheKey}${ext}`)
  const previousPath = findExistingCoverPath(cacheKey)

  if (previousPath && previousPath !== targetPath) {
    try {
      fs.unlinkSync(previousPath)
    } catch {}
  }

  fs.copyFileSync(sourcePath, targetPath)

  return toVersionedFileUrl(targetPath)
}

async function importMp3File() {
  const ownerWindow = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0] || null
  const result = await dialog.showOpenDialog(ownerWindow, {
    title: 'Seleccionar archivo MP3',
    properties: ['openFile'],
    filters: [{ name: 'Archivos MP3', extensions: ['mp3'] }]
  })

  if (result.canceled || !result.filePaths?.[0]) return null

  return result.filePaths[0]
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
  if (process.platform !== 'win32') return

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

function broadcastCustomUpdateState() {
  BrowserWindow.getAllWindows()
    .filter((window) => !window.isDestroyed())
    .forEach((window) => {
      window.webContents.send('custom-updater:state', customUpdateState)
    })
}

function broadcastSystemPowerEvent(type) {
  BrowserWindow.getAllWindows()
    .filter((window) => !window.isDestroyed())
    .forEach((window) => {
      window.webContents.send('system-power-event', { type })
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

function isInstalledInApplicationsDir(bundlePath = getCurrentBundlePath()) {
  const normalizedPath = String(bundlePath || '')
  const userApplicationsDir = ensureUserApplicationsDir()

  return (
    normalizedPath.startsWith('/Applications/') || normalizedPath.startsWith(`${userApplicationsDir}/`) || normalizedPath === '/Applications/Salsamania.app' || normalizedPath === join(userApplicationsDir, 'Salsamania.app')
  )
}

function relaunchFromUserApplications() {
  if (process.platform !== 'darwin' || is.dev) return false

  const currentBundlePath = getCurrentBundlePath()
  const targetAppPath = getWritableTargetAppPath()
  if (!currentBundlePath.endsWith('.app')) return false
  if (isInstalledInApplicationsDir(currentBundlePath)) return false
  if (currentBundlePath === targetAppPath) return false

  const helperScriptPath = join(os.tmpdir(), `salsamania-relocate-${Date.now()}.sh`)
  const escapedSource = currentBundlePath.replace(/"/g, '\\"')
  const escapedTarget = targetAppPath.replace(/"/g, '\\"')
  const escapedApplicationsDir = dirname(targetAppPath).replace(/"/g, '\\"')
  const script = `#!/bin/bash
set -e
mkdir -p "${escapedApplicationsDir}"
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
  app.isQuiting = true
  app.quit()

  return true
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
    const request = https.get(url,
      {
        headers: {
          'User-Agent': 'Salsamania-Updater',
          Accept: 'application/vnd.github+json'
        }
      },
      (response) => {
        if (
          (response.statusCode || 0) >= 300 && (response.statusCode || 0) < 400 && response.headers.location
        ) {
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
    const request = https.get(url,
      {
        headers: {
          'User-Agent': 'Salsamania-Updater',
          Accept: 'application/octet-stream'
        }
      },
      (response) => {
        if (
          (response.statusCode || 0) >= 300 && (response.statusCode || 0) < 400 && response.headers.location
        ) {
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

  return (
    assets.find((asset) => matchesArch(asset.name)) || assets.find((asset) => {
      const normalized = String(asset?.name || '').toLowerCase()

      return normalized.endsWith('.zip') && normalized.includes('mac')
    }) || null
  )
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
    const latestVersion = String(release?.tag_name || release?.name || '').replace(/^v/i, '')
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
    if (!silent) {
      setCustomUpdateState({
        status: 'error',
        message: error?.message || 'No se pudo buscar actualizaciones.'
      })
    }

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

async function prepareCustomMacUpdate({ silent = false } = {}) {
  const state = await checkCustomMacUpdate({ silent })
  if (state.status === 'available') {
    return downloadCustomMacUpdate()
  }

  return state
}

function launchCustomMacInstallHelper() {
  if (
    customUpdateContext.helperLaunched || !customUpdateContext.extractedAppPath || !customUpdateContext.targetAppPath
  ) {
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

  // Primera búsqueda silenciosa — nunca bloquear la app por una actualización
  prepareCustomMacUpdate({ silent: true }).catch(() => {
    // Falla silenciosa: no se modifica el estado
  })

  customUpdateCheckTimer = setInterval(() => {
    prepareCustomMacUpdate({ silent: true }).catch(() => {})
  }, CUSTOM_UPDATE_INTERVAL_MS)
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
    if (BrowserWindow.getAllWindows().length === 0 && !app.isQuiting) {
      app.quit()
    }
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

  if (is.dev) {
    app.setName('Salsamania-DEV')
  }

  if (relaunchFromUserApplications()) {
    return
  }

  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  /*
   * Default open or close DevTools by F12 in development
   * and ignore CommandOrControl + R in production.
   * see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
   */
  app.on('browser-window-created', (_, window) => {
    const { session } = window.webContents

    session.webRequest.onBeforeRequest({ urls: ['http://localhost:3000/static/*'] },
      (details, callback) => {
        const staticPrefix = 'http://localhost:3000/static/'
        if (!details.url.startsWith(staticPrefix)) {
          callback({ cancel: false })

          return
        }

        const staticPath = details.url.slice(staticPrefix.length)
        callback({ redirectURL: backendService.getLocalStaticUrl(staticPath) })
      })

    session.webRequest.onHeadersReceived({ urls: ['*://*/*'] }, (d, c) => {
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
  ipcMain.handle('covers:cache-image', async(_event, payload) => {
    return cacheCoverImage(payload)
  })
  ipcMain.handle('covers:resolve-spotify-cover', async(_event, payload) => {
    const target = payload?.searchUrl || payload?.url || ''
    console.debug('[vmusic][spotify-cover] ipc handler start', { target })
    try {
      const result = await resolveSpotifyCoverFromSearchUrl(target)
      console.debug('[vmusic][spotify-cover] ipc handler result', { target, result })

      return result
    } catch (error) {
      console.warn('[vmusic][spotify-cover] ipc handler failed', error)

      return {
        ok: false,
        error: String(error?.message || error || 'spotify-cover-ipc-failed'),
        stack: String(error?.stack || ''),
        target
      }
    }
  })
  ipcMain.handle('covers:import-file', async(_event, payload) => {
    return importCoverFile(payload)
  })
  ipcMain.handle('mp3:import-file', async() => {
    return importMp3File()
  })
  ipcMain.handle('custom-updater:get-state', async() => customUpdateState)
  ipcMain.handle('custom-updater:check', async() => checkCustomMacUpdate({ silent: false }))
  ipcMain.handle('custom-updater:check-and-prepare', async() => prepareCustomMacUpdate({ silent: false }))
  ipcMain.handle('custom-updater:install-now', async() => {
    requestCustomMacInstallNow()

    return { ok: true }
  })
  ipcMain.handle('db:backup', async() => {
    if (typeof backendService.backupDb === 'function') {
      backendService.backupDb()
      return { ok: true }
    }
    return { ok: false, error: 'backupDb no disponible' }
  })

  createWindow()
  keepAppAwake()
  scheduleCustomMacUpdateChecks()

  powerMonitor.on('lock-screen', () => {
    broadcastSystemPowerEvent('lock-screen')
  })
  powerMonitor.on('suspend', () => {
    broadcastSystemPowerEvent('suspend')
  })
  powerMonitor.on('resume', () => {
    broadcastSystemPowerEvent('resume')
  })
  powerMonitor.on('unlock-screen', () => {
    broadcastSystemPowerEvent('unlock-screen')
  })

  app.on('activate', function() {
    /*
     * On macOS it's common to re-create a window in the app when the
     * dock icon is clicked and there are no other windows open.
     */
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  app.quit()
})

app.on('before-quit', () => {
  app.isQuiting = true
  stopPowerSaveBlockers()
  if (customUpdateCheckTimer) {
    clearInterval(customUpdateCheckTimer)
    customUpdateCheckTimer = null
  }
  if (typeof backendService.backupDb === 'function') {
    backendService.backupDb()
  }
  if (process.platform === 'darwin' && customUpdateContext.shouldInstallOnQuit) {
    launchCustomMacInstallHelper()
  }
})

/*
 * In this file you can include the rest of your app"s specific main process
 * code. You can also put them in separate files and require them here.
 */
