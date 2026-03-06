const express = require("express");
const { google } = require("googleapis");
const helmet = require('helmet')
const cors = require('cors')
const { exec, spawn } = require("child_process");
var fs = require('fs');
const fsp = fs.promises;
const { stdout } = require("process");
const node_url = require('url');
const path = require('path');
const os = require('os');
const Sequelize = require('sequelize')
const { Model } = Sequelize
const dotenv = require('dotenv');
dotenv.config();
const dayjs = require('dayjs')
const mp3TaggerModule = require('./scripts/mp3Tagger')
const tagSongFileById = mp3TaggerModule?.tagSongFileById || mp3TaggerModule?.default?.tagSongFileById || null

const app = express();
const port = 3000;
const apiKey = "AIzaSyCY5jsbYqxlE17OLJu41UoXZ5jHfZf7A-I";
const youtube = google.youtube({
  version: "v3",
  auth: apiKey,
});

function resolveBinaryFromCandidates(name, explicitPath) {
  const candidates = []
  if (explicitPath) {
    candidates.push(path.resolve(explicitPath))
  }
  candidates.push(path.resolve(process.cwd(), 'build/bin', name))
  candidates.push(path.resolve(__dirname, '../../../build/bin', name))
  candidates.push(path.resolve(__dirname, '../../../../build/bin', name))
  if (process.resourcesPath) {
    candidates.push(path.resolve(process.resourcesPath, 'bin', name))
    candidates.push(path.resolve(process.resourcesPath, '..', 'bin', name))
  }

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      try {
        fs.chmodSync(candidate, 0o755)
      } catch {}

      return candidate
    }
  }

  return null
}

const FFMPEG_BIN = resolveBinaryFromCandidates('ffmpeg', process.env.VMUSIC_FFMPEG_BIN)
if (FFMPEG_BIN) {
  process.env.VMUSIC_FFMPEG_BIN = FFMPEG_BIN
}
const GAMDL_BIN = process.env.VMUSIC_GAMDL_BIN || process.env.GAMDL
const MUSIC_LIBRARY_DIR = path.resolve(process.env.VMUSIC_MUSIC_DIR || path.join(os.homedir(), 'Music', 'SalsamaniaLibrary'))
fs.mkdirSync(MUSIC_LIBRARY_DIR, { recursive: true })
const sqliteStoragePath = path.resolve(process.env.VMUSIC_DB_PATH || path.join(process.cwd(), 'src/main/backend/db/vmusic.sqlite'))
const AUDIO_DEBUG = process.env.NODE_ENV !== 'production'
const SPEED_CACHE_TTL_DAYS = Math.max(1, Number(process.env.VMUSIC_SPEED_CACHE_TTL_DAYS || 30))
const SPEED_CACHE_MAX_GB = Math.max(1, Number(process.env.VMUSIC_SPEED_CACHE_MAX_GB || 20))
const SPEED_CACHE_MAX_PERCENT = Math.min(95, Math.max(1, Number(process.env.VMUSIC_SPEED_CACHE_MAX_PERCENT || 25)))
const SPEED_CACHE_CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000
if (AUDIO_DEBUG) {
  console.info('[vmusic][audio-debug][backend] ffmpeg-bin', {
    ffmpeg: FFMPEG_BIN || null
  })
  if (!FFMPEG_BIN) {
    console.info('[vmusic][audio-debug][backend] ffmpeg-bin-context', {
      cwd: process.cwd(),
      dirname: __dirname,
      resourcesPath: process.resourcesPath || null,
      envBin: process.env.VMUSIC_FFMPEG_BIN || null
    })
  }
}
if (AUDIO_DEBUG) {
  console.info('[vmusic][audio-debug][backend] speed-cache-policy', {
    ttlDays: SPEED_CACHE_TTL_DAYS,
    maxGb: SPEED_CACHE_MAX_GB,
    maxPercent: SPEED_CACHE_MAX_PERCENT
  })
}

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: sqliteStoragePath,
  logging: false
})

class Artist extends Model {}
Artist.init({ name: Sequelize.DataTypes.STRING }, { sequelize, modelName: 'Artist' })

class ArtistSong extends Model {}
ArtistSong.init({
  artistId: Sequelize.DataTypes.INTEGER,
  songId: Sequelize.DataTypes.INTEGER
}, { sequelize, modelName: 'ArtistSong', tableName: 'ArtistSong' })

class Composer extends Model {}
Composer.init({ name: Sequelize.DataTypes.STRING }, { sequelize, modelName: 'Composer', tableName: 'Artists' })

class ComposerSong extends Model {}
ComposerSong.init({
  composerId: Sequelize.DataTypes.INTEGER,
  songId: Sequelize.DataTypes.INTEGER
}, { sequelize, modelName: 'ComposerSong', tableName: 'ComposerSong' })

class Song extends Model {}
Song.init({
  folder: Sequelize.DataTypes.STRING,
  ytid: Sequelize.DataTypes.STRING,
  name: Sequelize.DataTypes.STRING,
  speed: Sequelize.DataTypes.INTEGER,
  duration: Sequelize.DataTypes.INTEGER,
  start: Sequelize.DataTypes.INTEGER,
  end: Sequelize.DataTypes.INTEGER,
  duration_original: Sequelize.DataTypes.STRING,
  timestamp: {
    type: Sequelize.DataTypes.VIRTUAL,
    get() {
      return dayjs(this.createdAt).valueOf()
    },
    set() {
      throw new Error('Do not try to set the `timestamp` value!')
    }
  },
  isAppleMusic: {
    type: Sequelize.DataTypes.VIRTUAL,
    get() {
      return !isNaN(parseFloat(this.ytid)) && isFinite(this.ytid)
    },
    set() {
      throw new Error('Do not try to set the `isAppleMusic` value!')
    }
  }
}, { sequelize, modelName: 'Song' })

class SongTag extends Model {}
SongTag.init({
  songId: Sequelize.DataTypes.INTEGER,
  tagId: Sequelize.DataTypes.INTEGER
}, { sequelize, modelName: 'SongTag' })

class Tag extends Model {}
Tag.init({ name: Sequelize.DataTypes.STRING }, { sequelize, modelName: 'Tag' })

const db = {
  Artist,
  ArtistSong,
  Composer,
  ComposerSong,
  Song,
  SongTag,
  Tag,
  sequelize,
  Sequelize
}
const dbContext = db

Song.belongsToMany(Tag, { through: SongTag })
Tag.belongsToMany(Song, { through: SongTag })
Artist.belongsToMany(Song, { through: ArtistSong })
Song.belongsToMany(Artist, { through: ArtistSong })
Composer.belongsToMany(Song, { through: ComposerSong })
Song.belongsToMany(Composer, { through: ComposerSong })

async function getAudioDurationInSeconds(filePath) {
  const mm = await import('music-metadata')
  const metadata = await mm.parseFile(filePath)
  return Math.round(Number(metadata?.format?.duration || 0))
}

app.use(express.json({ limit: '25mb' }))
app.use(cors())
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'", 'http://localhost:3000', 'http://localhost:5173/']
    }
  }
}));

app.use("/static", express.static(MUSIC_LIBRARY_DIR));

function convertTime(given_seconds) {
  const dateObj = new Date(given_seconds * 1000)
  const minutes = dateObj.getUTCMinutes()
  const seconds = dateObj.getUTCSeconds()
  const timeString = minutes.toString().padStart(2, '0') + ':' + seconds.toString().padStart(2, '0')
  return timeString
}

const AUDIO_RECOGNITION_SAMPLE_RATE = 8000
const AUDIO_RECOGNITION_FRAME_SIZE = 1024
const AUDIO_RECOGNITION_HOP_SIZE = 512
const AUDIO_RECOGNITION_MAX_SONG_SECONDS = 90
const AUDIO_RECOGNITION_MAX_SAMPLE_SECONDS = 20
const AUDIO_RECOGNITION_MIN_CONFIDENCE = 0.72
const AUDIO_FEATURE_CACHE_FILE = path.join(__dirname, '.audio_feature_cache.json')
const FADE_PROFILE_CACHE_FILE = path.join(__dirname, '.fade_profile_cache.json')
const FADE_PROFILE_ANALYZER_VERSION = 'v9'
const AUDIO_FEATURE_FREQUENCIES = [
  82, 110, 146, 196, 261, 329, 440, 523, 659, 783, 987, 1174,
  100, 150, 230, 350, 530, 800, 1200, 1800, 2600, 3400
]

let audioFeatureCache = {}
let audioFeatureCacheLoaded = false
let audioFeatureCacheDirty = false
let audioWindow = null
let fadeProfileCache = {}
let fadeProfileCacheLoaded = false
let fadeProfileCacheDirty = false

function getAudioExtensionFromMime(mimeType) {
  if (typeof mimeType !== 'string') return 'webm'
  if (mimeType.includes('ogg')) return 'ogg'
  if (mimeType.includes('wav')) return 'wav'
  if (mimeType.includes('mp4') || mimeType.includes('m4a')) return 'm4a'

  return 'webm'
}

function normalizeVector(vector) {
  let norm = 0
  for (let i = 0; i < vector.length; i++) {
    norm += vector[i] * vector[i]
  }
  norm = Math.sqrt(norm)
  if (!norm) return vector.map(() => 0)

  return vector.map((value) => value / norm)
}

function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return 0
  if (a.length !== b.length || a.length === 0) return 0
  let dot = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
  }

  return dot
}

function getAnalysisWindow() {
  if (audioWindow) return audioWindow
  const window = new Float32Array(AUDIO_RECOGNITION_FRAME_SIZE)
  for (let i = 0; i < AUDIO_RECOGNITION_FRAME_SIZE; i++) {
    window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (AUDIO_RECOGNITION_FRAME_SIZE - 1)))
  }
  audioWindow = window

  return audioWindow
}

function goertzelPower(frame, targetFrequency, sampleRate) {
  const omega = (2 * Math.PI * targetFrequency) / sampleRate
  const coeff = 2 * Math.cos(omega)
  let s0 = 0
  let s1 = 0
  let s2 = 0

  for (let i = 0; i < frame.length; i++) {
    s0 = frame[i] + (coeff * s1) - s2
    s2 = s1
    s1 = s0
  }

  return (s1 * s1) + (s2 * s2) - (coeff * s1 * s2)
}

function decodePcmBuffer(pcmBuffer) {
  const sampleCount = Math.floor(pcmBuffer.length / 2)
  const samples = new Float32Array(sampleCount)
  for (let i = 0; i < sampleCount; i++) {
    const intSample = pcmBuffer.readInt16LE(i * 2)
    samples[i] = intSample / 32768
  }

  return samples
}

function extractFeatureVectorFromPcm(pcmBuffer, sampleRate) {
  const samples = decodePcmBuffer(pcmBuffer)
  const totalFrames = Math.max(0, Math.floor((samples.length - AUDIO_RECOGNITION_FRAME_SIZE) / AUDIO_RECOGNITION_HOP_SIZE) + 1)
  if (totalFrames <= 0) return null

  const means = new Array(AUDIO_FEATURE_FREQUENCIES.length).fill(0)
  const sqMeans = new Array(AUDIO_FEATURE_FREQUENCIES.length).fill(0)
  let fluxAccum = 0
  let prevNormalizedFrame = null
  const window = getAnalysisWindow()

  for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
    const offset = frameIndex * AUDIO_RECOGNITION_HOP_SIZE
    const frame = new Float32Array(AUDIO_RECOGNITION_FRAME_SIZE)
    for (let i = 0; i < AUDIO_RECOGNITION_FRAME_SIZE; i++) {
      frame[i] = samples[offset + i] * window[i]
    }

    const energies = AUDIO_FEATURE_FREQUENCIES.map((frequency) => Math.max(0, goertzelPower(frame, frequency, sampleRate)))
    const energySum = energies.reduce((acc, value) => acc + value, 0) || 1
    const normalizedFrame = energies.map((value) => value / energySum)

    for (let i = 0; i < normalizedFrame.length; i++) {
      means[i] += normalizedFrame[i]
      sqMeans[i] += normalizedFrame[i] * normalizedFrame[i]
    }

    if (prevNormalizedFrame) {
      let frameFlux = 0
      for (let i = 0; i < normalizedFrame.length; i++) {
        const delta = normalizedFrame[i] - prevNormalizedFrame[i]
        frameFlux += Math.max(0, delta)
      }
      fluxAccum += frameFlux
    }
    prevNormalizedFrame = normalizedFrame
  }

  const invTotal = 1 / totalFrames
  const std = new Array(AUDIO_FEATURE_FREQUENCIES.length).fill(0)
  for (let i = 0; i < means.length; i++) {
    means[i] = means[i] * invTotal
    const variance = Math.max(0, (sqMeans[i] * invTotal) - (means[i] * means[i]))
    std[i] = Math.sqrt(variance)
  }

  const fluxMean = fluxAccum / Math.max(1, totalFrames - 1)
  const featureVector = normalizeVector([...means, ...std, fluxMean])

  return featureVector
}

function decodeAudioToPcmBuffer(inputPath, maxSeconds) {
  return new Promise((resolve, reject) => {
    if (!FFMPEG_BIN) {
      reject(new Error('No se encontró el binario embebido de ffmpeg'))
      return
    }

    const args = [
      '-hide_banner',
      '-loglevel', 'error',
      '-i', inputPath,
      '-t', String(maxSeconds),
      '-ac', '1',
      '-ar', String(AUDIO_RECOGNITION_SAMPLE_RATE),
      '-f', 's16le',
      'pipe:1'
    ]
    const ff = spawn(FFMPEG_BIN, args)
    const chunks = []
    let stderr = ''

    ff.stdout.on('data', (chunk) => chunks.push(chunk))
    ff.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })
    ff.on('error', (error) => reject(error))
    ff.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`ffmpeg failed (${code}): ${stderr}`))

        return
      }
      resolve(Buffer.concat(chunks))
    })
  })
}

function decodeAudioSegmentToPcmBuffer(inputPath, startSeconds, maxSeconds) {
  return new Promise((resolve, reject) => {
    if (!FFMPEG_BIN) {
      reject(new Error('No se encontró el binario embebido de ffmpeg'))
      return
    }

    const args = [
      '-hide_banner',
      '-loglevel', 'error',
      '-ss', String(Math.max(0, Number(startSeconds) || 0)),
      '-i', inputPath,
      '-t', String(Math.max(0.5, Number(maxSeconds) || 1)),
      '-ac', '1',
      '-ar', '11025',
      '-f', 's16le',
      'pipe:1'
    ]
    const ff = spawn(FFMPEG_BIN, args)
    const chunks = []
    let stderr = ''

    ff.stdout.on('data', (chunk) => chunks.push(chunk))
    ff.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })
    ff.on('error', (error) => reject(error))
    ff.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`ffmpeg failed (${code}): ${stderr}`))
        return
      }
      resolve(Buffer.concat(chunks))
    })
  })
}

async function computeFeatureVectorFromFile(inputPath, maxSeconds) {
  const pcmBuffer = await decodeAudioToPcmBuffer(inputPath, maxSeconds)
  if (!pcmBuffer || pcmBuffer.length < 4096) return null

  return extractFeatureVectorFromPcm(pcmBuffer, AUDIO_RECOGNITION_SAMPLE_RATE)
}

async function loadAudioFeatureCache() {
  if (audioFeatureCacheLoaded) return
  try {
    const raw = await fsp.readFile(AUDIO_FEATURE_CACHE_FILE, 'utf-8')
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') {
      audioFeatureCache = parsed
    }
  } catch (error) {
    audioFeatureCache = {}
  } finally {
    audioFeatureCacheLoaded = true
  }
}

async function saveAudioFeatureCache() {
  if (!audioFeatureCacheDirty) return
  try {
    await fsp.writeFile(AUDIO_FEATURE_CACHE_FILE, JSON.stringify(audioFeatureCache), 'utf-8')
    audioFeatureCacheDirty = false
  } catch (error) {
    console.warn('No se pudo guardar cache de audio', error.message)
  }
}

async function loadFadeProfileCache() {
  if (fadeProfileCacheLoaded) return
  try {
    const raw = await fsp.readFile(FADE_PROFILE_CACHE_FILE, 'utf-8')
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') {
      fadeProfileCache = parsed
    }
  } catch {
    fadeProfileCache = {}
  } finally {
    fadeProfileCacheLoaded = true
  }
}

async function saveFadeProfileCache() {
  if (!fadeProfileCacheDirty) return
  try {
    await fsp.writeFile(FADE_PROFILE_CACHE_FILE, JSON.stringify(fadeProfileCache), 'utf-8')
    fadeProfileCacheDirty = false
  } catch (error) {
    console.warn('No se pudo guardar cache de fade profile', error.message)
  }
}

function computeRmsSeries(pcmBuffer, sampleRate, windowSeconds = 0.2) {
  const samples = decodePcmBuffer(pcmBuffer)
  const windowSize = Math.max(256, Math.floor(sampleRate * windowSeconds))
  const series = []
  for (let offset = 0; offset + windowSize <= samples.length; offset += windowSize) {
    let sum = 0
    for (let i = 0; i < windowSize; i++) {
      const s = samples[offset + i]
      sum += s * s
    }
    const rms = Math.sqrt(sum / windowSize)
    if (Number.isFinite(rms)) {
      series.push(rms)
    }
  }

  return series
}

function analyseFadeFromSeries(series, tailStartSec, windowSeconds = 0.2) {
  if (!Array.isArray(series) || series.length < 16) {
    return { hasFade: false, fadeStartSec: null, confidence: 0 }
  }

  const smoothed = series.map((_, i) => {
    const prev = series[Math.max(0, i - 1)]
    const curr = series[i]
    const next = series[Math.min(series.length - 1, i + 1)]
    return (prev + curr + next) / 3
  })
  const baseline = Math.max(...smoothed)
  if (!Number.isFinite(baseline) || baseline <= 0) {
    return { hasFade: false, fadeStartSec: null, confidence: 0 }
  }
  const threshold = baseline * 0.5
  const minSustainFrames = Math.max(4, Math.floor(1 / windowSeconds))
  let crossingIndex = -1

  for (let i = 0; i < smoothed.length; i++) {
    if (smoothed[i] > threshold) continue
    let sustained = true
    for (let j = 0; j < minSustainFrames; j++) {
      const idx = Math.min(smoothed.length - 1, i + j)
      if (smoothed[idx] > threshold * 1.05) {
        sustained = false
        break
      }
    }
    if (sustained) {
      crossingIndex = i
      break
    }
  }

  if (crossingIndex < 0) {
    return { hasFade: false, fadeStartSec: null, confidence: 0 }
  }

  const endValue = smoothed[smoothed.length - 1]
  const maxEndValue = threshold * 0.9
  if (!Number.isFinite(endValue) || endValue > maxEndValue) {
    return { hasFade: false, fadeStartSec: null, confidence: 0 }
  }

  const lookbackFrames = Math.max(3, Math.floor(1.2 / windowSeconds))
  const preStart = Math.max(0, crossingIndex - lookbackFrames)
  const preSlice = smoothed.slice(preStart, Math.max(preStart + 1, crossingIndex))
  const preLevel = preSlice.reduce((acc, value) => acc + value, 0) / Math.max(1, preSlice.length)
  const minDropAfterCross = baseline * 0.15
  if (!Number.isFinite(preLevel) || (preLevel - endValue) < minDropAfterCross) {
    return { hasFade: false, fadeStartSec: null, confidence: 0 }
  }

  let reboundFrames = 0
  for (let i = crossingIndex; i < smoothed.length; i++) {
    if (smoothed[i] > threshold * 1.02) reboundFrames += 1
  }
  if (reboundFrames > 1) {
    return { hasFade: false, fadeStartSec: null, confidence: 0 }
  }

  const confidence = Math.min(1, Math.max(0, (baseline - smoothed[crossingIndex]) / Math.max(0.0001, baseline)))
  const fadeStartSec = Number((tailStartSec + (crossingIndex * windowSeconds)).toFixed(3))

  return {
    hasFade: true,
    fadeStartSec,
    confidence: Number(confidence.toFixed(3))
  }
}

async function getSongFadeProfile(song) {
  await loadFadeProfileCache()
  const cacheKey = String(song.id)
  const songPath = getSongAudioPath(song)
  if (!fs.existsSync(songPath)) {
    return { hasFade: false, fadeStartSec: null, confidence: 0 }
  }
  const stat = fs.statSync(songPath)
  const fingerprintKey = `${FADE_PROFILE_ANALYZER_VERSION}:${song.folder}/${song.ytid}.mp3:${stat.size}:${stat.mtimeMs}:${song.duration || 0}`
  const cached = fadeProfileCache[cacheKey]
  if (cached && cached.fingerprintKey === fingerprintKey) {
    return cached.profile
  }

  const durationSeconds = Number(song.duration || 0)
  const tailDuration = Math.min(10, Math.max(4, durationSeconds || 10))
  const tailStartSec = Math.max(0, durationSeconds - tailDuration)
  const pcm = await decodeAudioSegmentToPcmBuffer(songPath, tailStartSec, tailDuration)
  const series = computeRmsSeries(pcm, 11025, 0.2)
  const profile = analyseFadeFromSeries(series, tailStartSec, 0.2)
  const minFadeDurationSeconds = 1.05
  if (profile?.hasFade && Number.isFinite(durationSeconds) && durationSeconds > 0) {
    const fadeDurationSeconds = durationSeconds - Number(profile.fadeStartSec)
    if (!Number.isFinite(fadeDurationSeconds) || fadeDurationSeconds <= minFadeDurationSeconds) {
      profile.hasFade = false
      profile.fadeStartSec = null
      profile.confidence = 0
    }
  }

  fadeProfileCache[cacheKey] = {
    fingerprintKey,
    profile
  }
  fadeProfileCacheDirty = true
  return profile
}

function getSongAudioPath(song) {
  return path.join(MUSIC_LIBRARY_DIR, song.folder, `${song.ytid}.mp3`)
}

function getSongSpeedAudioPath(song) {
  return path.join(MUSIC_LIBRARY_DIR, song.folder, `${song.ytid}_speed.mp3`)
}

function getSongSpeedMetaPath(song) {
  return path.join(MUSIC_LIBRARY_DIR, song.folder, `${song.ytid}_speed.json`)
}

function normalizePlaybackRate(value) {
  const rate = Number(value)
  if (!Number.isFinite(rate)) return 1

  return Math.min(Math.max(rate, 0.5), 1.8)
}

function buildAtempoFilter(rate) {
  const clamped = normalizePlaybackRate(rate)
  const parts = []
  let remaining = clamped

  while (remaining > 2.0) {
    parts.push('atempo=2.0')
    remaining = remaining / 2.0
  }

  while (remaining < 0.5) {
    parts.push('atempo=0.5')
    remaining = remaining / 0.5
  }

  parts.push(`atempo=${remaining.toFixed(6)}`)
  return parts.join(',')
}

async function readSpeedMeta(song) {
  const metaPath = getSongSpeedMetaPath(song)
  try {
    const raw = await fsp.readFile(metaPath, 'utf-8')
    const parsed = JSON.parse(raw)
    const rate = normalizePlaybackRate(parsed?.rate)

    return {
      rate,
      updatedAt: parsed?.updatedAt || null
    }
  } catch {
    return null
  }
}

async function writeSpeedMeta(song, rate) {
  const metaPath = getSongSpeedMetaPath(song)
  const speedAudioPath = getSongSpeedAudioPath(song)
  let sizeBytes = null
  try {
    const stat = await fsp.stat(speedAudioPath)
    sizeBytes = stat.size || null
  } catch {}
  const payload = {
    rate: normalizePlaybackRate(rate),
    updatedAt: new Date().toISOString(),
    lastUsedAt: new Date().toISOString(),
    useCount: 1,
    sizeBytes
  }
  await fsp.writeFile(metaPath, JSON.stringify(payload), 'utf-8')
}

async function touchSpeedMeta(song, baseMeta = null) {
  const metaPath = getSongSpeedMetaPath(song)
  const speedAudioPath = getSongSpeedAudioPath(song)
  const existingMeta = baseMeta || await readSpeedMeta(song) || {}
  let sizeBytes = null
  try {
    const stat = await fsp.stat(speedAudioPath)
    sizeBytes = stat.size || null
  } catch {}

  const payload = {
    rate: normalizePlaybackRate(existingMeta?.rate),
    updatedAt: existingMeta?.updatedAt || new Date().toISOString(),
    lastUsedAt: new Date().toISOString(),
    useCount: Number(existingMeta?.useCount || 0) + 1,
    sizeBytes
  }
  await fsp.writeFile(metaPath, JSON.stringify(payload), 'utf-8')
}

async function collectSpeedCacheEntries() {
  const folders = await fsp.readdir(MUSIC_LIBRARY_DIR, { withFileTypes: true })
    .catch(() => [])
  const entries = []

  for (const folder of folders) {
    if (!folder.isDirectory()) continue
    const folderPath = path.join(MUSIC_LIBRARY_DIR, folder.name)
    const files = await fsp.readdir(folderPath, { withFileTypes: true })
      .catch(() => [])
    for (const file of files) {
      if (!file.isFile()) continue
      if (!file.name.endsWith('_speed.mp3')) continue
      const speedPath = path.join(folderPath, file.name)
      const metaPath = speedPath.replace(/\.mp3$/i, '.json')
      let stat = null
      let meta = null
      try {
        stat = await fsp.stat(speedPath)
      } catch {}
      try {
        meta = JSON.parse(await fsp.readFile(metaPath, 'utf-8'))
      } catch {
        meta = null
      }
      if (!stat) continue

      const lastUsedAt = Date.parse(meta?.lastUsedAt || meta?.updatedAt || '') || Number(stat.mtimeMs)
      entries.push({
        speedPath,
        metaPath,
        sizeBytes: Number(stat.size || 0),
        lastUsedAt,
        rate: normalizePlaybackRate(meta?.rate)
      })
    }
  }

  return entries
}

async function computeLibrarySizes() {
  const folders = await fsp.readdir(MUSIC_LIBRARY_DIR, { withFileTypes: true })
    .catch(() => [])
  let originalBytes = 0
  let speedBytes = 0

  for (const folder of folders) {
    if (!folder.isDirectory()) continue
    const folderPath = path.join(MUSIC_LIBRARY_DIR, folder.name)
    const files = await fsp.readdir(folderPath, { withFileTypes: true })
      .catch(() => [])
    for (const file of files) {
      if (!file.isFile()) continue
      if (!file.name.endsWith('.mp3')) continue
      const filePath = path.join(folderPath, file.name)
      let stat = null
      try {
        stat = await fsp.stat(filePath)
      } catch {}
      if (!stat) continue

      if (file.name.endsWith('_speed.mp3')) {
        speedBytes += Number(stat.size || 0)
      } else {
        originalBytes += Number(stat.size || 0)
      }
    }
  }

  return {
    originalBytes,
    speedBytes
  }
}

async function deleteSpeedEntry(entry) {
  try {
    await fsp.unlink(entry.speedPath)
  } catch {}
  try {
    await fsp.unlink(entry.metaPath)
  } catch {}
}

let speedCacheCleanupRunning = false
async function cleanupSpeedCache() {
  if (speedCacheCleanupRunning) return
  speedCacheCleanupRunning = true
  try {
    const now = Date.now()
    const ttlMs = SPEED_CACHE_TTL_DAYS * 24 * 60 * 60 * 1000
    const entries = await collectSpeedCacheEntries()
    let deletedByTtl = 0
    for (const entry of entries) {
      if ((now - entry.lastUsedAt) > ttlMs) {
        await deleteSpeedEntry(entry)
        deletedByTtl += 1
      }
    }

    let remaining = await collectSpeedCacheEntries()
    const sizes = await computeLibrarySizes()
    const absoluteLimitBytes = SPEED_CACHE_MAX_GB * 1024 * 1024 * 1024
    const percentLimitBytes = Math.floor((sizes.originalBytes || 0) * (SPEED_CACHE_MAX_PERCENT / 100))
    const effectiveLimitBytes = Math.min(absoluteLimitBytes, percentLimitBytes > 0 ? percentLimitBytes : absoluteLimitBytes)
    let currentSpeedBytes = remaining.reduce((acc, item) => acc + item.sizeBytes, 0)
    let deletedByLru = 0

    if (currentSpeedBytes > effectiveLimitBytes) {
      remaining = remaining.sort((a, b) => a.lastUsedAt - b.lastUsedAt)
      for (const entry of remaining) {
        if (currentSpeedBytes <= effectiveLimitBytes) break
        await deleteSpeedEntry(entry)
        currentSpeedBytes -= entry.sizeBytes
        deletedByLru += 1
      }
    }

    if (AUDIO_DEBUG && (deletedByTtl > 0 || deletedByLru > 0)) {
      console.info('[vmusic][audio-debug][backend] speed-cache-cleanup', {
        deletedByTtl,
        deletedByLru,
        effectiveLimitBytes
      })
    }
  } catch (error) {
    if (AUDIO_DEBUG) {
      console.warn('[vmusic][audio-debug][backend] speed-cache-cleanup-failed', error.message)
    }
  } finally {
    speedCacheCleanupRunning = false
  }
}

async function getSongFeature(song) {
  await loadAudioFeatureCache()
  const cacheKey = String(song.id)
  const songPath = getSongAudioPath(song)
  const exists = fs.existsSync(songPath)
  if (!exists) return null

  const stat = fs.statSync(songPath)
  const fingerprintKey = `${song.folder}/${song.ytid}.mp3:${stat.size}:${stat.mtimeMs}`
  const cached = audioFeatureCache[cacheKey]
  if (cached && cached.fingerprintKey === fingerprintKey && Array.isArray(cached.feature)) {
    return cached.feature
  }

  const feature = await computeFeatureVectorFromFile(songPath, AUDIO_RECOGNITION_MAX_SONG_SECONDS)
  if (!feature) return null

  audioFeatureCache[cacheKey] = {
    fingerprintKey,
    feature
  }
  audioFeatureCacheDirty = true

  return feature
}

function simplifySong(song) {
  return {
    id: song.id,
    name: song.name,
    ytid: song.ytid,
    folder: song.folder,
    Artists: Array.isArray(song.Artists) ? song.Artists.map((artist) => ({
      id: artist.id,
      name: artist.name
    })) : []
  }
}

app.get("/search", async (req, res, next) => {
  try {
    const searchQuery = req.query.search_query;
    const response = await youtube.search.list({
      part: "snippet",
      type: "video",
      q: searchQuery,
      videoDimension: "2d",
      regionCode: 'CO',
      maxResults: 6,
    });

    res.send(response.data.items);
  } catch (err) {
    next(err);
  }
});

app.get("/details", async (req, res, next) => {
  try {
    const id = req.query.id;
    const response = await youtube.videos.list({
      part: "contentDetails,player",
      id: id,
    });

    res.send(response.data.items);
  } catch (err) {
    next(err);
  }
});

function YouTubeGetID(url) {
  var ID = '';
  url = url.replace(/(>|<)/gi, '').split(/(vi\/|v=|\/v\/|youtu\.be\/|\/embed\/)/);
  if (url[2] !== undefined) {
    ID = url[2].split(/[^0-9a-z_\-]/i);
    ID = ID[0];
  }
  else {
    ID = url;
  }
  return ID;
}

const DOWNLOADABLE_EXTENSIONS = ['.mp3', '.m4a', '.flac', '.wav', '.ogg', '.webm', '.opus', '.mp4']

function sanitizeYoutubeDownloadUrl(url) {
  if (!isYoutubeUrl(url)) {
    return url
  }

  try {
    const parsed = new URL(url)
    parsed.searchParams.delete('list')
    parsed.searchParams.delete('start_radio')
    return parsed.toString()
  } catch (error) {
    return url
  }
}

function isYoutubeUrl(url) {
  return typeof url === 'string' && (url.includes('youtube') || url.includes('youtu.be'))
}

function getAppleMusicTrackId(url) {
  const urlObject = node_url.parse(url, true)
  return urlObject?.query?.i
}

function getDownloadedFilePath(id) {
  const normalizedId = id.toString().trim()

  for (const extension of DOWNLOADABLE_EXTENSIONS) {
    const filePath = path.join(MUSIC_LIBRARY_DIR, `${normalizedId}${extension}`)
    try {
      const stat = fs.statSync(filePath)
      if (stat.isFile() && stat.size > 0) {
        return filePath
      }
    } catch (error) {
    }
  }

  return null
}

/*TAGS*/
app.get("/tags", async (req, res, next) => {
  const tags = await Tag.findAll({
    order: ['name']
  })
  res.send(tags)
})

app.post("/tags/save", async (req, res, next) => {
  if (req.body.name) {
    const results = await Tag.findAll({
      where: {
        name: req.body.name.trim()
      }
    })

    if (results.length > 0) {
      return res.status(400).send({
        message: 'La etiqueta ya existe'
      });
    } else {
      const t = await Tag.create({ name: req.body.name.trim() });
      res.send(t)
    }
  } else {
    return res.status(400).send({
      message: 'La etiqueta no puede ser vacía'
    });
  }
})

app.post("/tags/:id", async (req, res, next) => {
  await Tag.update(
    {
      name: req.body.name,
    },
    {
      where: {
        id: req.params.id,
      },
    },
  );

  res.send('ok')
})

/*SONGS*/
app.get("/songs", async (req, res, next) => {
  const songs = await Song.findAll({
    order: ['name'],
    include: Artist
  })
  res.send(songs)
})

app.post("/songs/by-id", async (req, res, next) => {
  const songs = await Song.findAll({
    where: {
      id: req.body.ids,
    },
    include: [
      {
        model: Artist,
        as: 'Artists'
      },
      {
        model: Composer,
        as: 'Composers'
      },
      {
        model: Tag,
        as: 'Tags'
      }
    ]
  })

  res.send(songs.sort(function (a, b) {
    return req.body.ids.indexOf(a.id) - req.body.ids.indexOf(b.id);
  }))
})

app.get("/songs/:id", async (req, res, next) => {
  const id = req.params.id;
  const songs = await Song.findAll({
    where: {
      id: id
    },
    include: [
      {
        model: Artist
      },
      {
        model: Composer,
        as: 'Composers'
      },
      {
        model: Tag,
        as: 'Tags'
      }
    ]
  })
  res.send(songs[0])
})

app.post("/songs/update-tags", async (req, res, next) => {
  const checkExistId = await Tag.count({ where: { id: 9998 } })

  if (!checkExistId) {
    await Tag.create({ id: 9998, name: 'agregado-reciente' });
  }

  const allSongs = await Song.findAll({
    where: {
      '$Tags.id$': [9998]
    },
    include: [
      {
        model: Tag,
        as: 'Tags'
      }
    ]
  })

  allSongs.forEach((song) => {
    song.removeTag(9998)
  })

  const treshold = dayjs().subtract(req.body.recentlyAddedTime, 'hour').format()
  const songs = await Song.findAll({
    where: {
      createdAt: {
        [Sequelize.Op.gte]: treshold,
      }
    }
  })

  songs.forEach(async (song) => {
    await song.addTag(9998)
  })

  res.send(songs)
})

app.post("/songs/update/:id", async (req, res, next) => {
  try {
    const songId = Number(req.params.id)
    const tags = Array.isArray(req.body.tags) ? req.body.tags : []
    const artists = Array.isArray(req.body.artists) ? req.body.artists : []
    const composers = Array.isArray(req.body.composers) ? req.body.composers : []

    await Song.update(
      {
        name: req.body.name
      },
      {
        where: {
          id: songId,
        },
      },
    );

    await SongTag.destroy({
      where: {
        songId
      }
    });

    await ArtistSong.destroy({
      where: {
        songId
      }
    });

    await ComposerSong.destroy({
      where: {
        songId
      }
    });

    await Promise.all(tags.map((item) => SongTag.create({ songId, tagId: item })))
    await Promise.all(artists.map((item) => ArtistSong.create({ songId, artistId: item })))
    await Promise.all(composers.map((item) => ComposerSong.create({ songId, composerId: item })))

    if (typeof tagSongFileById === 'function') {
      try {
        await tagSongFileById({
          db: dbContext,
          baseDir: __dirname,
          songId
        })
      } catch (tagError) {
        console.warn('[vmusic] No se pudo actualizar metadatos ID3', tagError?.message || tagError)
      }
    } else {
      console.warn('[vmusic] tagSongFileById no está disponible en este build')
    }

    res.send('ok')
  } catch (error) {
    console.error(error)
    return res.status(500).send({
      message: 'La canción fue actualizada pero no se pudo sincronizar el tag mp3',
      error: error.message
    })
  }
})

app.post("/songs/update-markers/:id", async (req, res, next) => {
  await Song.update(
    {
      start: req.body.start,
      end: req.body.end
    },
    {
      where: {
        id: req.params.id,
      },
    },
  );

  res.send('ok')
})

app.post("/songs/get-one-by-tag", async (req, res, next) => {
  const songs = await Song.findAll({
    where: {
      id: { [Sequelize.Op.notIn]: req.body.history },
      '$Tags.id$': req.body.tag
    },
    include: [
      {
        model: Artist
      },
      {
        model: Tag,
        as: 'Tags'
      }
    ],
    order: Sequelize.literal('random()')
  })
  res.send(songs[0])
})

app.post("/songs/filter-by-artist", async (req, res, next) => {
  const songs = await Song.findAll({
    where: {
      '$Artists.id$': req.body.artists
    },
    include: {
      model: Artist,
      as: 'Artists'
    }
  })

  const songIds = songs.map(song => (song.id))

  const songsFull = await Song.findAll({
    where: {
      'id': songIds,
    },
    order: ['name'],
    include: { all: true, nested: true },
    order: [
      ['name', 'ASC'],
      [{ model: Artist }, 'name', 'asc']
    ],
  })

  let tags = []
  songsFull.forEach(s => {
    let temp = s.Tags.map(t => ({ id: t.id, name: t.name }))

    temp.forEach(t => {
      tags.push(t)
    })
  })

  const unique = [...new Map(tags.map(item => [item['id'], item])).values()];

  res.send({ songs: songsFull, tags: unique })
})

app.post("/songs/filter", async (req, res, next) => {
  const filteredSongs = await Song.findAll({
    where: {
      '$Artists.id$': req.body.artists,
      '$Tags.id$': req.body.tags
    },
    include: [
      {
        model: Artist,
        as: 'Artists'
      },
      {
        model: Tag,
        as: 'Tags'
      }
    ]
  })

  const songIds = [...new Set(filteredSongs.map(song => song.id))]

  if (!songIds.length) {
    return res.send([])
  }

  const songs = await Song.findAll({
    where: {
      id: songIds
    },
    order: [
      ['name', 'ASC'],
      [{ model: Artist }, 'name', 'asc']
    ],
    include: [
      {
        model: Artist,
        as: 'Artists'
      },
      {
        model: Composer,
        as: 'Composers'
      },
      {
        model: Tag,
        as: 'Tags'
      }
    ]
  })

  res.send(songs)
})

app.post("/songs/count", async (req, res, next) => {
  const songs = await Song.findAll({
    where: {
      '$Tags.id$': req.body.tags
    },
    include: [
      {
        model: Tag,
        as: 'Tags'
      }
    ]
  })

  res.send(songs.length)
})

app.post("/songs/save-speed", async (req, res, next) => {
  await Song.update(
    {
      speed: req.body.speed
    },
    {
      where: {
        id: req.body.id,
      },
    },
  );

  res.send('ok')
})

app.get("/songs/speed-version/:id", async (req, res, next) => {
  const song = await Song.findByPk(req.params.id)
  if (!song) {
    return res.status(404).send({
      message: 'Canción no encontrada'
    })
  }

  const speedAudioPath = getSongSpeedAudioPath(song)
  if (!fs.existsSync(speedAudioPath)) {
    return res.send({
      exists: false,
      rate: null
    })
  }

  const meta = await readSpeedMeta(song)
  if (req.query?.use === '1') {
    await touchSpeedMeta(song, meta).catch(() => {})
  }
  return res.send({
    exists: true,
    rate: meta?.rate || null
  })
})

app.get("/songs/fade-profile/:id", async (req, res, next) => {
  const song = await Song.findByPk(req.params.id)
  if (!song) {
    return res.status(404).send({
      message: 'Canción no encontrada'
    })
  }

  try {
    const profile = await getSongFadeProfile(song)
    await saveFadeProfileCache()
    return res.send(profile)
  } catch (error) {
    return res.status(500).send({
      message: 'No se pudo analizar fade profile',
      error: error.message
    })
  }
})

app.post("/songs/touch-speed-version/:id", async (req, res, next) => {
  const song = await Song.findByPk(req.params.id)
  if (!song) {
    return res.status(404).send({
      message: 'Canción no encontrada'
    })
  }

  const speedAudioPath = getSongSpeedAudioPath(song)
  if (!fs.existsSync(speedAudioPath)) {
    return res.send({
      ok: false,
      exists: false
    })
  }

  await touchSpeedMeta(song).catch(() => {})
  return res.send({
    ok: true,
    exists: true
  })
})

app.post("/songs/preprocess-speed", async (req, res, next) => {
  const song = await Song.findByPk(req.body.id)
  if (!song) {
    return res.status(404).send({
      message: 'Canción no encontrada'
    })
  }

  const sourcePath = getSongAudioPath(song)
  if (!fs.existsSync(sourcePath)) {
    return res.status(404).send({
      message: 'No se encontró el mp3 original'
    })
  }

  const rate = normalizePlaybackRate(req.body.rate)
  if (AUDIO_DEBUG) {
    console.info('[vmusic][audio-debug][backend] preprocess-request', {
      songId: song.id,
      rate
    })
  }
  if (Math.abs(rate - 1.0) < 0.001) {
    if (AUDIO_DEBUG) {
      console.info('[vmusic][audio-debug][backend] preprocess-skipped-rate-1', {
        songId: song.id
      })
    }
    return res.send({
      ok: true,
      skipped: true,
      reason: 'Rate 1.0 usa archivo original'
    })
  }

  const speedAudioPath = getSongSpeedAudioPath(song)
  const currentMeta = await readSpeedMeta(song)
  if (fs.existsSync(speedAudioPath) && currentMeta && Math.abs(currentMeta.rate - rate) < 0.001) {
    await touchSpeedMeta(song, currentMeta).catch(() => {})
    if (AUDIO_DEBUG) {
      console.info('[vmusic][audio-debug][backend] preprocess-reused', {
        songId: song.id,
        rate
      })
    }
    return res.send({
      ok: true,
      reused: true,
      rate: currentMeta.rate
    })
  }

  if (!FFMPEG_BIN) {
    return res.status(500).send({
      message: 'No se encontró el binario embebido de ffmpeg'
    })
  }

  const tempOutput = `${speedAudioPath}.tmp-${Date.now()}-${Math.random().toString(16).slice(2)}.mp3`
  const args = [
    '-y',
    '-i', sourcePath,
    '-vn',
    '-filter:a', buildAtempoFilter(rate),
    '-f', 'mp3',
    '-b:a', '192k',
    tempOutput
  ]
  const ff = spawn(FFMPEG_BIN, args)
  let ffmpegStderr = ''

  ff.stderr.on('data', (data) => {
    ffmpegStderr += data.toString()
  })

  ff.on('error', (error) => {
    console.warn('Error ejecutando ffmpeg preprocess-speed', error.message)
  })

  ff.on('close', async(code) => {
    if (code !== 0) {
      if (AUDIO_DEBUG) {
        console.info('[vmusic][audio-debug][backend] preprocess-failed', {
          songId: song.id,
          rate,
          code,
          sourcePath,
          outputPath: speedAudioPath,
          stderr: ffmpegStderr.trim().slice(-1200)
        })
      }
      try {
        await fsp.unlink(tempOutput)
      } catch {}
      return res.status(500).send({
        message: 'No se pudo preprocesar la velocidad',
        code,
        error: ffmpegStderr.trim().slice(-600)
      })
    }

    try {
      await fsp.rename(tempOutput, speedAudioPath)
      await writeSpeedMeta(song, rate)
      if (AUDIO_DEBUG) {
        console.info('[vmusic][audio-debug][backend] preprocess-complete', {
          songId: song.id,
          rate,
          output: speedAudioPath
        })
      }
      return res.send({
        ok: true,
        rate
      })
    } catch (error) {
      try {
        await fsp.unlink(tempOutput)
      } catch {}
      return res.status(500).send({
        message: 'No se pudo guardar la versión preprocesada',
        error: error.message
      })
    }
  })
})

app.post("/audio/recognize", async (req, res, next) => {
  try {
    const { audioBase64, mimeType } = req.body || {}
    if (!audioBase64 || typeof audioBase64 !== 'string') {
      return res.status(400).send({
        message: 'audioBase64 es requerido'
      })
    }

    const extension = getAudioExtensionFromMime(mimeType)
    const tempInputPath = path.join(
      os.tmpdir(),
      `vmusic-recognition-${Date.now()}-${Math.random().toString(16).slice(2)}.${extension}`
    )

    await fsp.writeFile(tempInputPath, Buffer.from(audioBase64, 'base64'))

    let sampleFeature = null
    try {
      sampleFeature = await computeFeatureVectorFromFile(tempInputPath, AUDIO_RECOGNITION_MAX_SAMPLE_SECONDS)
    } finally {
      fsp.unlink(tempInputPath).catch(() => {})
    }

    if (!sampleFeature) {
      return res.status(422).send({
        message: 'No se pudo extraer una firma de audio de la muestra'
      })
    }

    const songs = await Song.findAll({
      include: [
        {
          model: Artist,
          as: 'Artists'
        }
      ]
    })

    const scoredMatches = []
    for (const song of songs) {
      try {
        const songFeature = await getSongFeature(song)
        if (!songFeature) continue
        const confidence = cosineSimilarity(sampleFeature, songFeature)
        scoredMatches.push({
          song: simplifySong(song),
          confidence
        })
      } catch (error) {
        console.warn(`No se pudo analizar canción ${song.id}`, error.message)
      }
    }

    await saveAudioFeatureCache()

    scoredMatches.sort((a, b) => b.confidence - a.confidence)
    const topMatches = scoredMatches.slice(0, 5)
      .map((match) => ({
        song: match.song,
        confidence: Number(match.confidence.toFixed(4))
      }))

    const best = topMatches[0]
    if (!best || best.confidence < AUDIO_RECOGNITION_MIN_CONFIDENCE) {
      return res.send({
        found: false,
        threshold: AUDIO_RECOGNITION_MIN_CONFIDENCE,
        topMatches
      })
    }

    return res.send({
      found: true,
      threshold: AUDIO_RECOGNITION_MIN_CONFIDENCE,
      match: best,
      topMatches
    })
  } catch (error) {
    console.error(error)
    return res.status(500).send({
      message: 'No se pudo reconocer el audio',
      error: error.message
    })
  }
})

app.post("/songs/delete", async (req, res, next) => {
  const song = await Song.findByPk(req.body.id);

  const file = path.join(MUSIC_LIBRARY_DIR, song.folder, `${song.ytid}.mp3`);

  fs.unlink(file, (err) => {
    if (err) {
      // An error occurred while deleting the file
      if (err.code === 'ENOENT') {
        // The file does not exist
        console.error('The file does not exist');
      } else {
        // Some other error
        console.error(err.message);
      }
    } else {
      // The file was deleted successfully
      console.log('The file was deleted');
    }
  });

  await song.destroy()
  res.send([song.id])
})

app.post("/download", async (req, res, next) => {
  const rawRequestUrl = typeof req.body.url === 'string' ? req.body.url.trim() : ''
  const requestUrl = sanitizeYoutubeDownloadUrl(rawRequestUrl)
  if (!requestUrl) {
    return res.status(400).send({
      message: 'La URL es requerida'
    });
  }

  // ID is the URL now
  let yid
  if (isYoutubeUrl(requestUrl)) {
    yid = YouTubeGetID(requestUrl)
  } else {
    yid = getAppleMusicTrackId(requestUrl)
  }

  if (!yid) {
    return res.status(400).send({
      message: 'No se pudo identificar la canción en la URL'
    });
  }

  const results = await Song.findAll({
    where: {
      ytid: yid
    }
  })

  if (results.length > 0) {
    return res.status(400).send({
      message: 'Esa canción ya está en la biblioteca'
    });
  }

  let command
  let args

  if (isYoutubeUrl(requestUrl)) {
    const url = `https://www.youtube.com/watch?v=${yid}`
    command = process.env.VMUSIC_YT_DLP_BIN
    if (!command) {
      return res.status(500).send({
        message: 'No se encontró el binario embebido de yt-dlp'
      });
    }
    args = [
      '--no-playlist',
      '-f', 'bestaudio[protocol^=https]/bestaudio/best',
      '-o', path.join(MUSIC_LIBRARY_DIR, '%(id)s.%(ext)s'),
      '--rm-cache-dir',
      '-i',
      url
    ]
    if (FFMPEG_BIN) {
      args.splice(args.length - 1, 0, '--ffmpeg-location', path.dirname(FFMPEG_BIN))
    }

    console.log(command, args.join(' '))
    const ls = spawn(command, args);
    let stderrOutput = ''

    ls.stdout.on("data", data => {
      console.log(`stdout: ${data}`);
    });

    ls.stderr.on("data", data => {
      console.log(`stderr: ${data}`);
      stderrOutput += data.toString()
    });

    ls.on('error', (error) => {
      console.log(`error: ${error.message}`);
    });

    ls.on("close", code => {
      console.log(`child process exited with code ${code}`);

      if (code === 0 && getDownloadedFilePath(yid)) {
        res.send(yid)
      } else {
        const details = stderrOutput.trim()
        return res.status(400).send({
          message: details ? `No se pudo descargar el archivo: ${details.slice(-400)}` : 'No se pudo descargar el archivo',
          code
        });
      }
    });
  } else {
    command = GAMDL_BIN
    if (!command) {
      return res.status(500).send({
        message: 'No se encontró el binario embebido de gamdl'
      });
    }

    args = [
      '--no-synced-lyrics',
      '--overwrite',
      '--template-file-multi-disc',
      '{title_id}',
      '--template-file-single-disc',
      '{title_id}',
      '--template-folder-no-album',
      '',
      '--template-folder-album',
      '',
      '--template-folder-compilation',
      '',
      '-o',
      MUSIC_LIBRARY_DIR,
      requestUrl
    ]

    const gamdl = spawn(command, args)

    gamdl.stdout.on('data', (data) => {
      console.log(`stdout: ${data}`)
    })

    gamdl.stderr.on('data', (data) => {
      console.log(`stderr: ${data}`)
    })

    gamdl.on('error', (error) => {
      console.log(`error: ${error.message}`)
    })

    gamdl.on('close', (code) => {
      if (code !== 0) {
        return res.status(400).send({
          message: 'No se pudo descargar el archivo',
          code
        })
      }

      if (!getDownloadedFilePath(yid)) {
        return res.status(400).send({
          message: 'No se pudo descargar el archivo'
        })
      }

      res.send(yid)
    })
  }
})

app.post("/songs/save", async (req, res, next) => {
  const folder = 'm' + Math.floor(Math.random() * 100)
  const dir = path.join(MUSIC_LIBRARY_DIR, folder);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const oldPath = getDownloadedFilePath(req.body.ytid)
  if (!oldPath) {
    return res.status(400).send({
      message: 'No se encontró el archivo descargado para guardar la canción'
    });
  }


  let newPath = path.join(dir, req.body.ytid.toString().trim() + '.mp3')

  //ffmpeg -i oldPath -af "silenceremove=start_periods=1:start_threshold=0.02:start_silence=0.5:stop_periods=1:stop_threshold=0.02:stop_silence=0.5:detection=peak" newPath
  const command = FFMPEG_BIN
  if (!command) {
    return res.status(500).send({
      message: 'No se encontró el binario embebido de ffmpeg'
    });
  }
  const args = ['-i', oldPath, '-b:a', '192k', '-af', 'areverse,atrim=start=0.2,silenceremove=start_periods=1:start_silence=0.1:start_threshold=0.02,areverse,atrim=start=0.2,silenceremove=start_periods=1:start_silence=0.1:start_threshold=0.02', newPath]
  const ls = spawn(command, args);
  let ffmpegStderr = ''

  ls.stdout.on("data", data => {
    console.log(`stdout: ${data}`);
  });

  ls.stderr.on("data", data => {
    console.log(`stderr: ${data}`);
    ffmpegStderr += data.toString()
  });

  ls.on('error', (error) => {
    console.log(`error: ${error.message}`);
  });

  ls.on("close", code => {
    if (code !== 0) {
      return res.status(500).send({
        message: 'No se pudo convertir el audio con ffmpeg',
        code,
        error: ffmpegStderr.trim().slice(-600)
      })
    }

    fs.unlink(oldPath, (err) => {
      if (err) {
        console.error(`Error removing file: ${err}`);
        return;
      }

      console.log(`File ${oldPath} has been successfully removed.`);
    });

    const aacgainBin = process.env.VMUSIC_AACGAIN_BIN
    if (aacgainBin) {
      exec(`\"${aacgainBin}\" -r -k \"${newPath}\"`, (error, stdout, stderr) => {
        if (error) {
          console.warn('aacgain falló', error.message)
        } else {
          console.log(stdout)
        }
      })
    }

    ;(async () => {
      try {
        const durationSeconds = await getAudioDurationInSeconds(newPath)
        if (!durationSeconds) {
          return res.status(500).send({
            message: 'No se pudo leer la duración del mp3'
          })
        }

        const s = await Song.create({
          folder: folder,
          ytid: req.body.ytid.toString().trim(),
          name: req.body.song.trim(),
          duration: durationSeconds,
          duration_original: convertTime(durationSeconds)
        })

        await s.addArtists(req.body.artists)
        await s.addComposers(req.body.composers)

        // Check tags
        const tags = await Tag.findAll({
          order: ['name']
        })

        const tagIds = []
        const tagsForCreating = []
        req.body.songTags.forEach((tag) => {
          const tagFound = tags.find(t => tag === t.name)
          if (tagFound) {
            tagIds.push(tagFound.id)
          } else {
            tagsForCreating.push(tag)
          }
        })

        await s.addTags(tagIds)

        for (const tag of tagsForCreating) {
          const t = await Tag.create({ name: tag })
          await s.addTags(t.id)
        }

        if (typeof tagSongFileById === 'function') {
          try {
            await tagSongFileById({
              db: dbContext,
              baseDir: __dirname,
              songId: s.id,
              filePath: newPath
            })
          } catch (tagError) {
            console.warn('[vmusic] No se pudo etiquetar ID3; se guarda canción sin metadata embebida', tagError?.message || tagError)
          }
        } else {
          console.warn('[vmusic] tagSongFileById no está disponible en este build; se omite etiquetado ID3')
        }

        res.send(s)
      } catch (saveError) {
        console.error(saveError)
        return res.status(500).send({
          message: 'No se pudo guardar y etiquetar la canción',
          error: saveError.message,
          details: saveError?.stack || saveError?.message || null
        })
      }
    })();
  });

})

/*ARTISTS*/
app.get("/artists", async (req, res, next) => {
  const artists = await Artist.findAll({
    order: ['name'],
    include: [
      {
        model: Song,
        as: 'Songs'
      }
    ]
  })
  res.send(artists)
})

app.post("/artists", async (req, res, next) => {
  if (req.body.name) {
    const results = await Artist.findAll({
      where: {
        name: req.body.name.trim()
      }
    })

    if (results.length > 0) {
      return res.status(400).send({
        message: 'El artista ya existe'
      });
    } else {
      const t = await Artist.create({ name: req.body.name.trim() });
      res.send(t)
    }
  } else {
    return res.status(400).send({
      message: 'El artista no puede ser vacío'
    });
  }
})

app.post("/artists/:id", async (req, res, next) => {
  await Artist.update(
    {
      name: req.body.name,
    },
    {
      where: {
        id: req.params.id,
      },
    },
  );

  res.send('ok')
})

app.post("/artists/delete/:id", async (req, res, next) => {
  const artist = await Artist.findByPk(req.params.id);
  await artist.destroy()
  const artists = await Artist.findAll({
    order: ['name'],
    include: [
      {
        model: Song,
        as: 'Songs'
      }
    ]
  })
  res.send(artists)
})


async function startServer() {
  try {
    await sequelize.authenticate()
    await sequelize.sync()
    cleanupSpeedCache().catch(() => {})
    setInterval(() => {
      cleanupSpeedCache().catch(() => {})
    }, SPEED_CACHE_CLEANUP_INTERVAL_MS)
    app.listen(port, () => {
      console.log(`Example app listening at http://localhost:${port}`);
    })
  } catch (error) {
    console.error('[vmusic] Failed to initialize database schema', error)
    process.exit(1)
  }
}

startServer()
