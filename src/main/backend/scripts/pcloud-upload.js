#!/usr/bin/env node
const fs = require('fs')
const path = require('path')
const axios = require('axios')
const { spawn } = require('child_process')
const db = require('../db/models')

const PROJECT_ROOT = path.join(__dirname, '..')
const PCLOUD_UPLOAD_CACHE_FILE = path.join(PROJECT_ROOT, '.pcloud_upload_cache.json')
const PCLOUD_DEFAULT_API = 'api.pcloud.com'
const PCLOUD_UPLOAD_ENDPOINT = '/uploadfile'
const PCLOUD_CREATE_FOLDER_ENDPOINT = '/createfolderifnotexists'
const PCLOUD_LIST_FOLDER_ENDPOINT = '/listfolder'
const PCLOUD_STAT_ENDPOINT = '/stat'
const PCLOUD_API_SERVER_ENDPOINT = 'https://api.pcloud.com/getapiserver'
const IGNORED_GENRE_TAG = 'agregado-reciente'
const REQUEST_TIMEOUT_MS = 600000
const UPLOAD_MAX_TIME_SECONDS = 600
const UPLOAD_CONNECT_TIMEOUT_SECONDS = 60

function parseArgs(argv) {
  const getArgValue = (flag) => {
    const index = argv.indexOf(flag)
    if (index === -1) return null
    return argv[index + 1] || null
  }

  return {
    songId: getArgValue('--song-id'),
    genre: getArgValue('--genre'),
    remotePath: getArgValue('--remote-path') || process.env.PCLOUD_BASE_PATH || '/v-music'
  }
}

function sanitizePath(remotePath) {
  const value = String(remotePath || '').trim()
  if (!value) return '/v-music'
  if (value === '/') return value
  return value.startsWith('/') ? value.replace(/\/+$/, '') : `/${value.replace(/\/+$/, '')}`
}

function joinRemotePath(folderPath, fileName) {
  const folder = sanitizePath(folderPath)
  const cleanName = String(fileName || '').replace(/^\/+/, '')
  if (folder === '/') return `/${cleanName}`
  return `${folder}/${cleanName}`
}

function sanitizeMetadataValue(value) {
  if (value === null || value === undefined) return ''
  return String(value).replace(/\s+/g, ' ').trim()
}

function buildSongFilePath(song) {
  return path.join(PROJECT_ROOT, '_music', sanitizeMetadataValue(song.folder), `${sanitizeMetadataValue(song.ytid)}.mp3`)
}

function getFileFingerprint(filePath) {
  const stat = fs.statSync(filePath)
  return `${stat.size}:${Math.floor(stat.mtimeMs)}`
}

function loadUploadCache() {
  try {
    const raw = fs.readFileSync(PCLOUD_UPLOAD_CACHE_FILE, 'utf-8')
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') return parsed
  } catch (error) {
  }
  return {}
}

function saveUploadCache(cache) {
  fs.writeFileSync(PCLOUD_UPLOAD_CACHE_FILE, JSON.stringify(cache, null, 2), 'utf-8')
}

function getSongGenre(song) {
  const tags = Array.isArray(song.Tags) ? song.Tags : []
  const sortedTags = tags
    .slice()
    .sort((a, b) => {
      const aTime = a?.SongTag?.createdAt ? new Date(a.SongTag.createdAt).getTime() : Number.MAX_SAFE_INTEGER
      const bTime = b?.SongTag?.createdAt ? new Date(b.SongTag.createdAt).getTime() : Number.MAX_SAFE_INTEGER
      return aTime - bTime
    })

  for (const tag of sortedTags) {
    const tagName = sanitizeMetadataValue(tag.name)
    if (!tagName) continue
    if (tagName.toLowerCase() === IGNORED_GENRE_TAG) continue
    return tagName
  }

  return ''
}

function songHasTag(song, tagName) {
  const normalizedTarget = sanitizeMetadataValue(tagName).toLowerCase()
  if (!normalizedTarget) return false

  const tags = Array.isArray(song.Tags) ? song.Tags : []
  return tags.some((tag) => {
    const current = sanitizeMetadataValue(tag.name).toLowerCase()
    if (!current) return false
    if (current === IGNORED_GENRE_TAG) return false
    return current === normalizedTarget
  })
}

async function resolveApiServer(accessToken) {
  const fallback = {
    apiHost: PCLOUD_DEFAULT_API,
    binApiHost: PCLOUD_DEFAULT_API
  }

  try {
    const response = await axios.get(PCLOUD_API_SERVER_ENDPOINT, {
      params: {
        ...accessToken
      },
      timeout: 8000
    })
    const apiList = response?.data?.api
    const binApiList = response?.data?.binapi
    const apiHost = Array.isArray(apiList) && apiList.length > 0 && typeof apiList[0] === 'string'
      ? apiList[0]
      : fallback.apiHost
    const binApiHost = Array.isArray(binApiList) && binApiList.length > 0 && typeof binApiList[0] === 'string'
      ? binApiList[0]
      : fallback.binApiHost

    return { apiHost, binApiHost }
  } catch (error) {
    return fallback
  }
}

async function createFolderIfNotExists({ apiHost, accessToken, folderPath }) {
  const url = `https://${apiHost}${PCLOUD_CREATE_FOLDER_ENDPOINT}`
  const params = {
    ...accessToken,
    path: folderPath
  }
  const response = await axios.get(url, { params, timeout: REQUEST_TIMEOUT_MS })
  if (response?.data?.result !== 0) {
    throw new Error(`createfolderifnotexists fallo (${response?.data?.result}): ${response?.data?.error || 'sin detalle'}`)
  }
}

async function listRemoteFilesInFolder({ apiHost, accessToken, folderPath }) {
  const url = `https://${apiHost}${PCLOUD_LIST_FOLDER_ENDPOINT}`
  const params = {
    ...accessToken,
    path: folderPath,
    recursive: 0,
    nofiles: 0
  }
  const response = await axios.get(url, { params, timeout: REQUEST_TIMEOUT_MS })
  if (response?.data?.result !== 0) {
    const errorMessage = String(response?.data?.error || '')
    const notFound =
      response?.data?.result === 2005 ||
      /does not exist/i.test(errorMessage) ||
      /directory not found/i.test(errorMessage)

    // If folder is missing, treat as empty (caller creates it first anyway).
    if (notFound) return new Set()

    throw new Error(`listfolder fallo (${response?.data?.result}): ${errorMessage || 'sin detalle'}`)
  }

  const contents = Array.isArray(response?.data?.metadata?.contents)
    ? response.data.metadata.contents
    : []

  const fileNames = contents
    .filter((entry) => entry && entry.isfile)
    .map((entry) => sanitizeMetadataValue(entry.name).toLowerCase())
    .filter(Boolean)

  return new Set(fileNames)
}

async function listRemoteFilesInFolderWithHostFallback({ apiHosts, accessToken, folderPath }) {
  let lastError = null
  for (const host of apiHosts) {
    try {
      const files = await listRemoteFilesInFolder({
        apiHost: host,
        accessToken,
        folderPath
      })
      return files
    } catch (error) {
      lastError = error
      console.log(`[fallback-listfolder] ${folderPath} fallo en ${host}: ${error.message}`)
    }
  }

  if (lastError) throw lastError
  return new Set()
}

async function remoteFileExistsViaStat({ apiHost, accessToken, remoteFilePath }) {
  const url = `https://${apiHost}${PCLOUD_STAT_ENDPOINT}`
  const params = {
    ...accessToken,
    path: remoteFilePath
  }
  const response = await axios.get(url, { params, timeout: REQUEST_TIMEOUT_MS })
  if (response?.data?.result === 0) {
    return Boolean(response?.data?.metadata?.isfile)
  }

  const errorMessage = String(response?.data?.error || '')
  const notFound =
    response?.data?.result === 2005 ||
    response?.data?.result === 2055 ||
    /does not exist/i.test(errorMessage) ||
    /not found/i.test(errorMessage) ||
    /directory not found/i.test(errorMessage)

  if (notFound) return false
  throw new Error(`stat fallo (${response?.data?.result}): ${errorMessage || 'sin detalle'}`)
}

async function remoteFileExistsViaStatWithHostFallback({ apiHosts, accessToken, remoteFilePath }) {
  let lastError = null
  for (const host of apiHosts) {
    try {
      const exists = await remoteFileExistsViaStat({
        apiHost: host,
        accessToken,
        remoteFilePath
      })
      return exists
    } catch (error) {
      lastError = error
      console.log(`[fallback-stat] ${remoteFilePath} fallo en ${host}: ${error.message}`)
    }
  }

  if (lastError) throw lastError
  return false
}

async function createFolderIfNotExistsWithRetry({ apiHost, accessToken, folderPath, attempts = 3 }) {
  let lastError = null
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      await createFolderIfNotExists({ apiHost, accessToken, folderPath })
      return
    } catch (error) {
      lastError = error
      const isRetryable =
        error?.code === 'ECONNRESET' ||
        error?.code === 'ETIMEDOUT' ||
        /socket hang up/i.test(error?.message || '')

      if (!isRetryable || attempt === attempts) {
        throw error
      }

      const delayMs = attempt * 1500
      console.log(`[retry-folder] ${folderPath} intento ${attempt + 1}/${attempts} en ${delayMs}ms por: ${error.message}`)
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }

  throw lastError
}

async function ensureRemotePathExistsWithHostFallback({ apiHosts, accessToken, folderPath, createdFolders }) {
  let lastError = null
  for (const host of apiHosts) {
    try {
      await ensureRemotePathExists({
        apiHost: host,
        accessToken,
        folderPath,
        createdFolders
      })
      return host
    } catch (error) {
      lastError = error
      console.log(`[fallback-folder] ${folderPath} fallo en ${host}: ${error.message}`)
    }
  }

  throw lastError
}

async function ensureRemotePathExists({ apiHost, accessToken, folderPath, createdFolders }) {
  const normalized = sanitizePath(folderPath)
  if (normalized === '/') return

  const parts = normalized.split('/').filter(Boolean)
  let currentPath = ''
  for (const part of parts) {
    currentPath += `/${part}`
    if (createdFolders.has(currentPath)) continue
    await createFolderIfNotExistsWithRetry({
      apiHost,
      accessToken,
      folderPath: currentPath
    })
    createdFolders.add(currentPath)
  }
}

async function uploadFile({ apiHost, accessToken, folderPath, filePath, fileName }) {
  const url = `https://${apiHost}${PCLOUD_UPLOAD_ENDPOINT}`
  console.log(`[uploading] ${fileName} -> ${folderPath}`)

  const tokenEntries = Object.entries(accessToken)
  const args = [
    '-sS',
    '--http1.1',
    '--connect-timeout', String(UPLOAD_CONNECT_TIMEOUT_SECONDS),
    '--max-time', String(UPLOAD_MAX_TIME_SECONDS),
    '-X', 'POST',
    ...tokenEntries.flatMap(([key, value]) => ['-F', `${key}=${value}`]),
    '-F', `path=${folderPath}`,
    '-F', `filename=${fileName}`,
    '-F', `file=@${filePath};filename=${fileName}`,
    url
  ]

  await new Promise((resolve, reject) => {
    const child = spawn('curl', args)
    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString()
    })

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })

    child.on('error', reject)
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`curl fallo (${code}): ${stderr || 'sin detalle'}`))
        return
      }

      let parsed
      try {
        parsed = JSON.parse(stdout)
      } catch (error) {
        reject(new Error(`Respuesta invalida de pCloud: ${stdout || 'vacia'}`))
        return
      }

      if (parsed?.result !== 0) {
        reject(new Error(`uploadfile fallo (${parsed?.result}): ${parsed?.error || 'sin detalle'}`))
        return
      }

      resolve()
    })
  })
}

async function uploadFileWithRetry({ apiHost, accessToken, folderPath, filePath, fileName, attempts = 3 }) {
  let lastError = null
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      await uploadFile({ apiHost, accessToken, folderPath, filePath, fileName })
      return
    } catch (error) {
      lastError = error
      const isRetryable =
        error?.code === 'ECONNRESET' ||
        error?.code === 'EPIPE' ||
        error?.code === 'ETIMEDOUT' ||
        /socket hang up/i.test(error?.message || '') ||
        /Operation timed out/i.test(error?.message || '') ||
        /curl fallo \(52\)/i.test(error?.message || '') ||
        /curl fallo \(55\)/i.test(error?.message || '')

      if (!isRetryable || attempt === attempts) {
        throw error
      }

      const delayMs = attempt * 1500
      console.log(`[retry] ${fileName} intento ${attempt + 1}/${attempts} en ${delayMs}ms por: ${error.message}`)
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }

  throw lastError
}

async function uploadFileWithHostFallback({ uploadHosts, accessToken, folderPath, filePath, fileName }) {
  let lastError = null
  for (const host of uploadHosts) {
    try {
      await uploadFileWithRetry({
        apiHost: host,
        accessToken,
        folderPath,
        filePath,
        fileName
      })
      return host
    } catch (error) {
      lastError = error
      console.log(`[fallback-upload] ${fileName} fallo en ${host}: ${error.message}`)
    }
  }

  throw lastError
}

async function loadSongById(songId) {
  return db.Song.findByPk(songId, {
    include: [
      {
        model: db.Tag,
        as: 'Tags'
      }
    ]
  })
}

async function loadAllSongsWithTags() {
  return db.Song.findAll({
    include: [
      {
        model: db.Tag,
        as: 'Tags'
      }
    ],
    order: [['id', 'ASC']]
  })
}

async function run() {
  const { songId, genre, remotePath } = parseArgs(process.argv.slice(2))
  const oauthAccessToken = sanitizeMetadataValue(process.env.PCLOUD_ACCESS_TOKEN)
  const authToken = sanitizeMetadataValue(process.env.PCLOUD_AUTH_TOKEN)
  const tokenParams = oauthAccessToken
    ? { access_token: oauthAccessToken }
    : authToken
      ? { auth: authToken }
      : null
  const baseRemotePath = sanitizePath(remotePath)

  if (!tokenParams) {
    throw new Error('Falta token. Define PCLOUD_ACCESS_TOKEN (OAuth) o PCLOUD_AUTH_TOKEN (login clasico)')
  }

  console.log(`[start] Subida a pCloud por ${songId ? `song-id=${songId}` : `genre=${genre}`}`)
  console.log(`[start] Carpeta remota base: ${baseRemotePath}`)

  if (!songId && !genre) {
    throw new Error('Debes pasar --song-id <id> o --genre <nombre>')
  }

  if (songId && genre) {
    throw new Error('Usa solo una opcion: --song-id o --genre')
  }

  const { apiHost, binApiHost } = await resolveApiServer(tokenParams)
  const metadataHosts = [apiHost]
  const uploadHosts = [apiHost]

  console.log(`[start] API host (metadata): ${metadataHosts.join(', ')}`)
  console.log(`[start] API host (upload): ${uploadHosts.join(', ')}`)
  const uploadPlan = []

  if (songId) {
    const numericId = Number(songId)
    if (!Number.isInteger(numericId)) {
      throw new Error(`song-id invalido: ${songId}`)
    }

    const song = await loadSongById(numericId)
    if (!song) {
      throw new Error(`No existe la cancion con id ${numericId}`)
    }

    const filePath = buildSongFilePath(song)
    if (!fs.existsSync(filePath)) {
      throw new Error(`No existe el archivo mp3 para songId=${numericId}: ${filePath}`)
    }

    uploadPlan.push({
      songId: song.id,
      genre: getSongGenre(song),
      filePath
    })
  } else {
    const normalizedGenre = sanitizeMetadataValue(genre).toLowerCase()
    if (!normalizedGenre) {
      throw new Error('El genero no puede ser vacio')
    }

    const songs = await loadAllSongsWithTags()
    for (const song of songs) {
      if (!songHasTag(song, normalizedGenre)) continue

      const filePath = buildSongFilePath(song)
      if (!fs.existsSync(filePath)) {
        console.log(`[skip] songId=${song.id} sin mp3`)
        continue
      }

      uploadPlan.push({
        songId: song.id,
        genre: normalizedGenre,
        filePath
      })
    }
  }

  if (!uploadPlan.length) {
    console.log('No hay canciones para subir con ese criterio')
    return
  }

  console.log(`[start] Canciones a subir: ${uploadPlan.length}`)

  const createdFolders = new Set()
  const remoteFolderFilesCache = new Map()
  const uploadCache = loadUploadCache()
  let uploaded = 0
  let skipped = 0
  let failed = 0

  for (const item of uploadPlan) {
    const genreFolder = sanitizeMetadataValue(item.genre || 'sin-genero')
    const targetFolder = sanitizePath(`${baseRemotePath}/${genreFolder}`)
    const fileName = path.basename(item.filePath)

    try {
      await ensureRemotePathExistsWithHostFallback({
        apiHosts: metadataHosts,
        accessToken: tokenParams,
        folderPath: targetFolder,
        createdFolders
      })

      if (!remoteFolderFilesCache.has(targetFolder)) {
        const existingFiles = await listRemoteFilesInFolderWithHostFallback({
          apiHosts: metadataHosts,
          accessToken: tokenParams,
          folderPath: targetFolder
        })
        remoteFolderFilesCache.set(targetFolder, existingFiles)
      }

      const existingFiles = remoteFolderFilesCache.get(targetFolder)
      const fileNameNormalized = fileName.toLowerCase()
      const remoteFilePath = joinRemotePath(targetFolder, fileName)
      const fileFingerprint = getFileFingerprint(item.filePath)
      const cacheKey = `${remoteFilePath.toLowerCase()}`
      const cachedFingerprint = uploadCache[cacheKey]

      if (cachedFingerprint && cachedFingerprint === fileFingerprint) {
        skipped += 1
        console.log(`[skip] songId=${item.songId} cache local coincide para ${remoteFilePath}`)
        continue
      }

      if (existingFiles.has(fileNameNormalized)) {
        skipped += 1
        console.log(`[skip] songId=${item.songId} ya existe en ${targetFolder}/${fileName}`)
        uploadCache[cacheKey] = fileFingerprint
        continue
      }

      const existsViaStat = await remoteFileExistsViaStatWithHostFallback({
        apiHosts: metadataHosts,
        accessToken: tokenParams,
        remoteFilePath
      })
      if (existsViaStat) {
        skipped += 1
        existingFiles.add(fileNameNormalized)
        console.log(`[skip] songId=${item.songId} ya existe en ${remoteFilePath}`)
        uploadCache[cacheKey] = fileFingerprint
        continue
      }

      await uploadFileWithHostFallback({
        uploadHosts,
        accessToken: tokenParams,
        folderPath: targetFolder,
        filePath: item.filePath,
        fileName
      })

      uploaded += 1
      existingFiles.add(fileNameNormalized)
      uploadCache[cacheKey] = fileFingerprint
      console.log(`[ok] songId=${item.songId} -> ${targetFolder}/${fileName}`)
    } catch (error) {
      failed += 1
      console.error(`[error] songId=${item.songId}: ${error.message}`)
    }
  }

  console.log(`Resumen -> uploaded=${uploaded}, skipped=${skipped}, failed=${failed}, total=${uploadPlan.length}`)
  saveUploadCache(uploadCache)
  if (failed > 0) process.exitCode = 1
}

run()
  .catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
  .finally(async () => {
    await db.sequelize.close()
  })
