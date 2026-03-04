const path = require('path')
const Module = require('module')
const { pathToFileURL } = require('url')
const fs = require('fs')
const os = require('os')
const { app } = require('electron')

const routes = []

const appMock = {
  use() {},
  get(routePath, handler) {
    routes.push({ method: 'GET', routePath, handler })
  },
  post(routePath, handler) {
    routes.push({ method: 'POST', routePath, handler })
  },
  put(routePath, handler) {
    routes.push({ method: 'PUT', routePath, handler })
  },
  delete(routePath, handler) {
    routes.push({ method: 'DELETE', routePath, handler })
  },
  listen() {}
}

function createExpressMock() {
  return appMock
}

createExpressMock.json = () => () => {}
createExpressMock.static = () => () => {}

const noopMiddlewareFactory = () => () => {}

const originalLoad = Module._load
Module._load = function patchedLoader(request, parent, isMain) {
  if (request === 'express') return createExpressMock
  if (request === 'cors') return noopMiddlewareFactory
  if (request === 'helmet') return noopMiddlewareFactory

  return originalLoad.call(this, request, parent, isMain)
}

function resolveBundledBinary(name) {
  const envKey = `VMUSIC_${name.toUpperCase().replace(/-/g, '_')}_BIN`
  const explicit = process.env[envKey]
  if (explicit && fs.existsSync(explicit)) {
    return explicit
  }

  const candidates = []
  if (app?.isPackaged) {
    candidates.push(path.join(process.resourcesPath, 'bin', name))
  } else {
    candidates.push(path.resolve(__dirname, '../../../build/bin', name))
  }

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      try {
        fs.chmodSync(candidate, 0o755)
      } catch {}
      process.env[envKey] = candidate
      return candidate
    }
  }

  return null
}

function resolveMusicRoot() {
  const configured = process.env.VMUSIC_MUSIC_DIR
  if (configured) {
    return path.resolve(configured)
  }

  const defaultExternal = path.join(os.homedir(), 'Music', 'SalsamaniaLibrary')
  process.env.VMUSIC_MUSIC_DIR = defaultExternal
  return defaultExternal
}

function resolveUserDataDir() {
  try {
    return app.getPath('userData')
  } catch {
    return path.join(os.homedir(), '.vmusic')
  }
}

function resolveDbPath() {
  const configured = process.env.VMUSIC_DB_PATH
  if (configured) {
    const absoluteConfigured = path.resolve(configured)
    fs.mkdirSync(path.dirname(absoluteConfigured), { recursive: true })
    return absoluteConfigured
  }

  const userDataDir = resolveUserDataDir()
  fs.mkdirSync(userDataDir, { recursive: true })
  const targetDb = path.join(userDataDir, 'vmusic.sqlite')
  const packagedSeed = path.join(process.resourcesPath || '', 'db', 'vmusic.sqlite')
  const legacyCandidates = [
    packagedSeed,
    path.resolve(process.cwd(), 'src/main/backend/db/vmusic.sqlite'),
    path.resolve(__dirname, 'db/vmusic.sqlite')
  ]
  const legacySource = legacyCandidates.find((candidate) => fs.existsSync(candidate))

  const getSize = (filePath) => {
    try {
      return fs.statSync(filePath).size || 0
    } catch {
      return 0
    }
  }

  const shouldSeedFromLegacy = (() => {
    if (!legacySource) return false
    if (!fs.existsSync(targetDb)) return true
    const targetSize = getSize(targetDb)
    const legacySize = getSize(legacySource)
    if (targetSize === 0 && legacySize > 0) return true
    return false
  })()

  if (shouldSeedFromLegacy && legacySource) {
    try {
      fs.copyFileSync(legacySource, targetDb)
    } catch {}
  }

  process.env.VMUSIC_DB_PATH = targetDb
  return targetDb
}

const MUSIC_ROOT = resolveMusicRoot()
fs.mkdirSync(MUSIC_ROOT, { recursive: true })
resolveDbPath()

resolveBundledBinary('yt-dlp')
resolveBundledBinary('aacgain')
const gamdlBin = resolveBundledBinary('gamdl')
resolveBundledBinary('ffmpeg')
if (gamdlBin) {
  process.env.GAMDL = gamdlBin
}

try {
  require('./server.base.cjs')
} finally {
  Module._load = originalLoad
}

function normalizePath(inputPath) {
  if (!inputPath) return '/'
  try {
    const parsed = new URL(inputPath, 'http://localhost')
    return parsed.pathname || '/'
  } catch {
    return inputPath.startsWith('/') ? inputPath : `/${inputPath}`
  }
}

function matchRoute(routePath, actualPath) {
  const templateParts = routePath.split('/').filter(Boolean)
  const actualParts = actualPath.split('/').filter(Boolean)

  if (templateParts.length !== actualParts.length) return null

  const params = {}
  for (let i = 0; i < templateParts.length; i++) {
    const t = templateParts[i]
    const a = actualParts[i]

    if (t.startsWith(':')) {
      params[t.slice(1)] = decodeURIComponent(a)
      continue
    }

    if (t !== a) return null
  }

  return params
}

function findRoute(method, requestPath) {
  const normalizedMethod = String(method || 'GET').toUpperCase()
  const normalizedPath = normalizePath(requestPath)

  for (const route of routes) {
    if (route.method !== normalizedMethod) continue
    const params = matchRoute(route.routePath, normalizedPath)
    if (params) {
      return {
        route,
        params,
        normalizedPath
      }
    }
  }

  return null
}

function createResponse(settle) {
  let sent = false
  const response = {
    statusCode: 200,
    status(code) {
      this.statusCode = Number(code) || 500
      return this
    },
    send(payload) {
      if (sent) return this
      sent = true
      settle({
        status: this.statusCode,
        data: normalizeForIpc(payload)
      })
      return this
    },
    json(payload) {
      return this.send(payload)
    }
  }

  return response
}

function normalizeForIpc(value) {
  if (value === undefined) return null
  if (value === null) return null
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value
  }

  try {
    return JSON.parse(JSON.stringify(value))
  } catch {
    return value
  }
}

function buildErrorResponse(error) {
  const message = error?.message || 'Internal backend error'
  return {
    status: 500,
    data: {
      message,
      error: message
    }
  }
}

function parseQuery(inputPath, explicitQuery) {
  if (explicitQuery && typeof explicitQuery === 'object') return explicitQuery

  try {
    const parsed = new URL(inputPath, 'http://localhost')
    const query = {}
    for (const [key, value] of parsed.searchParams.entries()) {
      if (Object.prototype.hasOwnProperty.call(query, key)) {
        const current = query[key]
        query[key] = Array.isArray(current) ? [...current, value] : [current, value]
      } else {
        query[key] = value
      }
    }
    return query
  } catch {
    return {}
  }
}

function buildQueryString(query) {
  if (!query || typeof query !== 'object') return ''
  const params = new URLSearchParams()
  for (const [key, rawValue] of Object.entries(query)) {
    if (Array.isArray(rawValue)) {
      rawValue.forEach((value) => params.append(key, String(value)))
      continue
    }
    if (rawValue !== undefined && rawValue !== null) {
      params.append(key, String(rawValue))
    }
  }
  const value = params.toString()
  return value ? `?${value}` : ''
}

async function dispatchViaLocalHttp({ method, path: requestPath, query, body }) {
  const normalizedMethod = String(method || 'GET').toUpperCase()
  const normalizedPath = normalizePath(requestPath)
  const queryString = buildQueryString(parseQuery(requestPath, query))
  const url = `http://127.0.0.1:3000${normalizedPath}${queryString}`
  const init = {
    method: normalizedMethod,
    headers: {
      'Content-Type': 'application/json'
    }
  }

  if (normalizedMethod !== 'GET' && normalizedMethod !== 'HEAD') {
    init.body = JSON.stringify(body && typeof body === 'object' ? body : {})
  }

  let lastError = null
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, init)
      const text = await response.text()
      let payload = text
      try {
        payload = text ? JSON.parse(text) : null
      } catch {}

      return {
        status: response.status,
        data: normalizeForIpc(payload)
      }
    } catch (error) {
      lastError = error
      await new Promise((resolve) => setTimeout(resolve, 120))
    }
  }

  return buildErrorResponse(lastError || new Error('No se pudo contactar backend local'))
}

async function dispatchRequest({ method = 'GET', path: requestPath = '/', query, body } = {}) {
  if (routes.length === 0) {
    return dispatchViaLocalHttp({ method, path: requestPath, query, body })
  }

  const found = findRoute(method, requestPath)
  if (!found) {
    return {
      status: 404,
      data: {
        message: `Route not found: ${String(method).toUpperCase()} ${normalizePath(requestPath)}`
      }
    }
  }

  return new Promise((resolve) => {
    const req = {
      method: String(method).toUpperCase(),
      path: found.normalizedPath,
      params: found.params,
      query: parseQuery(requestPath, query),
      body: body && typeof body === 'object' ? body : {}
    }

    let settled = false

    const settle = (payload) => {
      if (settled) return
      settled = true
      resolve(payload)
    }

    const res = createResponse(settle)

    const timeoutId = setTimeout(() => {
      settleWithCleanup({
        status: 504,
        data: {
          message: `Backend request timeout: ${req.method} ${req.path}`
        }
      })
    }, 5 * 60 * 1000)

    const settleWithCleanup = (payload) => {
      clearTimeout(timeoutId)
      settle(payload)
    }

    const next = (error) => {
      if (!error) return settleWithCleanup({ status: 500, data: { message: 'Unhandled middleware flow' } })
      settleWithCleanup(buildErrorResponse(error))
    }

    res.send = ((originalSend) => (payload) => {
      originalSend.call(res, payload)
      clearTimeout(timeoutId)
      return res
    })(res.send)

    try {
      const maybePromise = found.route.handler(req, res, next)

      Promise.resolve(maybePromise)
        .then(() => {
          if (settled) return
          if (res.statusCode && !settled) {
            settleWithCleanup({
              status: res.statusCode,
              data: null
            })
          }
        })
        .catch((error) => {
          settleWithCleanup(buildErrorResponse(error))
        })
    } catch (error) {
      settleWithCleanup(buildErrorResponse(error))
    }
  })
}

function getMediaPath(folder, ytid) {
  return path.join(MUSIC_ROOT, String(folder || '').trim(), `${String(ytid || '').trim()}.mp3`)
}

function getMediaUrl(folder, ytid) {
  return pathToFileURL(getMediaPath(folder, ytid)).toString()
}

function getLocalStaticUrl(staticPath) {
  const normalized = String(staticPath || '').replace(/^\/+/, '')
  const filePath = path.join(MUSIC_ROOT, normalized)
  return pathToFileURL(filePath).toString()
}

module.exports = {
  dispatchRequest,
  getMediaPath,
  getMediaUrl,
  getLocalStaticUrl,
  routes
}
