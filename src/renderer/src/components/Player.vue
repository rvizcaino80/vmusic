<template>
  <div
    :class="{
      'flex-col-reverse': props.position === 'top'
    }"
    class="justify-end player p-6 flex flex-col flex-1 max-h-[550px] min-w-0"
  >
    <div class="flex justify-between space-x-3">
      <div class="flex space-x-3">
        <div
          v-if="songImage"
          :class="{
            'pulsate-bck': status === props.statuses.Reproduciendo,
          }"
          class="flex h-[80px] w-[80px] items-center justify-center"
        >
          <img
            :src="songImage"
            class="select-none"
            draggable="false"
          >
        </div>
        <div
          v-else
          :class="{
            'pulsate-bck': status === props.statuses.Reproduciendo,
            'player-deck-b': props.position === 'bottom',
            'player-deck-a': props.position === 'top'
          }"
          class="flex text-[70px] player-text text-bold text-center h-[80px] w-[80px] items-center justify-center"
        >
          <span
            v-if="props.position === 'top'"
            class="select-none"
          >A</span>
          <span
            v-if="props.position === 'bottom'"
            class="select-none"
          >B</span>
        </div>
        <div>
          <h2 class="text-white text-xl select-none max-w-[420px] truncate">
            <template v-if="artistsList.length">
              <template
                v-for="(a, idx) in artistsList"
                :key="a.id"
              >
                <button
                  type="button"
                  class="hover:underline"
                  title="Ver canciones de este artista"
                  @click.stop="emitArtistClick(a.id)"
                >
                  {{ a.name }}
                </button>
                <span v-if="idx < artistsList.length - 1">, </span>
              </template>
            </template>
            <span v-else>Sin artista</span>
            <span v-if="artist && composer"> ({{ composer }})</span>
          </h2>
          <div class="flex items-center space-x-2">
            <h1 class="text-white text-2xl select-none max-w-[380px] truncate">
              <button
                v-if="songFull?.id"
                type="button"
                class="hover:underline"
                title="Ver esta canción en biblioteca"
                @click.stop="emitSongClick"
              >
                {{ song || 'Sin canción' }}
              </button>
              <span v-else>{{ song || 'Sin canción' }}</span>
            </h1>
            <button
              v-if="canPreview"
              type="button"
              class="player-text player-preview-btn"
              title="Previsualizar en audífonos"
              @mousedown.stop.prevent="emitPreviewStart"
              @mouseup.stop="emitPreviewStop"
              @mouseleave.stop="emitPreviewStop"
              @touchstart.stop.prevent="emitPreviewStart"
              @touchend.stop="emitPreviewStop"
            >
              <i-mdi-headphones class="w-6 h-6" />
            </button>
          </div>
          <div class="text-sm text-gray-300 select-none">
            <span>Status: {{ getStatusName(status) }}</span>
            <span
              v-if="
                status === props.statuses.Nivelando ||
                  status === props.statuses.Placa ||
                  status === props.statuses.Cambiando
              "
            >
              ({{ Math.round(volume * 100) }})</span>
          </div>
        </div>
      </div>

      <div class="flex flex-col items-center text-gray-500">
        <div
          v-if="status !== props.statuses['Sin Carga']"
          class="flex flex-col items-center"
        >
          <span class="text-sm mb-0.5 select-none">Velocidad</span>
          <div class="flex flex-col items-center space-y-0.5">
            <div class="flex items-center space-x-1">
              <Icon
                class="cursor-pointer w-6 h-6 text-white"
                icon="teenyicons:left-solid"
                @click="setSpeed(-1)"
              />
              <span
                v-if="speed_added > 0"
                class="text-lime-500 font-bold text-xl select-none"
              >+</span>
              <span
                :class="{
                  'text-lime-500': speed_added > 0,
                  'text-red-500': speed_added < 0,
                  'text-white': speed_added === 0
                }"
                class="font-bold text-xl select-none"
              >
                {{ speed_added }}
              </span>
              <Icon
                class="cursor-pointer w-6 h-6 text-white"
                icon="teenyicons:right-solid"
                @click="setSpeed(1)"
              />
            </div>
            <span class="text-xs text-gray-400 select-none">Base: {{ baseSpeedLabel }}</span>
          </div>
        </div>
      </div>
    </div>
    <div
      v-show="status !== props.statuses['Sin Carga']"
      :id="playerId"
      :class="{ 'mb-3': props.position === 'top', 'mt-3': props.position === 'bottom' }"
      class="wavesurfer flex-1 min-w-0 w-full overflow-hidden"
    />
  </div>
</template>

<script setup>
import { onBeforeMount, onMounted, onBeforeUnmount, ref, watch, computed } from 'vue'
import WaveSurfer from 'wavesurfer.js'
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js'
import { PitchShifter } from 'soundtouchjs'
import { Icon } from '@iconify/vue'
import * as cheerio from 'cheerio'

const emit = defineEmits(['fading', 'stopped', 'loaded', 'speed', 'artist-click', 'song-click', 'preview-start', 'preview-stop', 'finished'])

const props = defineProps({
  position: String,
  statuses: {
    type: Object,
    required: true
  },
  outputSinkId: {
    type: String,
    required: false,
    default: null
  }
})

let player = null
const duration = ref(0.0)
const songFull = ref({ })
const songId = ref(null)
const start = ref(null)
const end = ref(null)
const song = ref('')
const artistsList = ref([])
const composer = ref('')
const artist = ref('')
const primaryArtistId = ref(null)
const status = ref()
const playerId = ref('')
const volume = ref(1.0)
const speed = ref(1.0)
const left = ref(0)
const speed_added = ref(0.0)
const volume_added = ref(0.0)
const songImage = ref('')
const baseSpeed = ref(0)
let wsRegions = null
let originalOptions = {}
let crossfaderOptions = {}
let mediaElement = null
let resizeObserver = null
let resizeRafId = null
let resizeFollowupTimeoutId = null
let hardRebuildTimeoutId = null
let isRebuildingWaveform = false
let pendingRestoreState = null
const regionColor = ref('rgba(114,0,0,0.64)')
const savedSettings = JSON.parse(localStorage.getItem('vmusic_settings'))

const baseSpeedLabel = computed(() => {
  const value = baseSpeed.value || 0
  const sign = value > 0 ? '+' : ''

  return `${sign}${value}`
})

const canPreview = computed(() => status.value !== props.statuses.Reproduciendo && Boolean(songFull.value?.id))
const MIN_SPEED_OFFSET = -50
const MAX_SPEED_OFFSET = 50
const SOUND_TOUCH_BUFFER_SIZE = 16384
const SOUND_TOUCH_SYNC_THRESHOLD_SEC = 1.2
const SOUND_TOUCH_RESYNC_COOLDOWN_MS = 5000
const ENABLE_SOUND_TOUCH_AUTO_RESYNC = false
let soundTouchContext = null
let soundTouchGain = null
let soundTouchShifter = null
let soundTouchBuffer = null
let soundTouchBufferUrl = ''
let soundTouchLoadingPromise = null
let soundTouchTimePlayed = 0
let soundTouchLastResyncAt = 0
let activeMediaUrl = ''

onBeforeMount(() => {
  status.value = props.statuses['Sin Carga']
  playerId.value = 'w' + Math.random().toString(36)
    .substring(2, 7)
})

onMounted(() => {
  updateBaseSpeed()
  init()
  window.addEventListener('resize', onViewportResize)
  setupResizeObserver()
})

function init() {
  const waveColor = getCurrentWaveColor()
  const progressColor = getCurrentProgressColor()
  const cursorColor = getThemeColor('--vm-player-cursor', '#FFFFFF')
  const crossfaderCursorColor = getThemeColor('--vm-player-crossfader-cursor', '#FF0000')
  regionColor.value = getThemeColor('--vm-player-region', 'rgba(114,0,0,0.64)')

  mediaElement = document.createElement('audio')
  mediaElement.preload = 'auto'
  mediaElement.crossOrigin = 'anonymous'
  mediaElement.preservesPitch = false
  mediaElement.webkitPreservesPitch = false
  mediaElement.mozPreservesPitch = false

  originalOptions = {
    normalize: true,
    container: '#' + playerId.value,
    cursorColor,
    height: 'auto',
    fillParent: true,
    backend: 'MediaElement',
    media: mediaElement,
    waveColor,
    progressColor
  }

  crossfaderOptions = {
    normalize: true,
    container: '#' + playerId.value,
    cursorColor: crossfaderCursorColor,
    height: 'auto',
    fillParent: true,
    waveColor,
    progressColor
  }

  player = WaveSurfer.create(originalOptions)
  applyPreservePitch()

  wsRegions = player.registerPlugin(RegionsPlugin.create())

  player.on('decode', (d) => {
    if (start.value && start.value !== 0) {
      player.setTime(start.value)
      wsRegions.addRegion({
        id: 'inicio',
        start: 0,
        end: start.value,
        color: regionColor.value,
        drag: false,
        resize: false
      })
    }

    if (end.value) {
      wsRegions.addRegion({
        id: 'final',
        start: end.value,
        end: d,
        color: regionColor.value,
        drag: false,
        resize: false
      })
    } else {
      end.value = d
    }

    left.value = end.value
  })

  wsRegions.on('region-clicked', (region, e) => {
    e.stopPropagation() // prevent triggering a click on the waveform
  })

  player.on('load', () => {
    applyPreservePitch()
    songImage.value = ''
    wsRegions.clearRegions()
    player.toggleInteraction(false)
    status.value = props.statuses.Cargando
    player.seekTo(0)
  })

  player.on('ready', (d) => {
    applyPreservePitch()
    setSinkId(props.outputSinkId)
    if (songFull.value.isAppleMusic) {
      const url = `https://music.apple.com/co/song/taste/${songFull.value.ytid}`
      fetch(url).then((response) => {
        response.text().then((html) => {
          const $ = cheerio.load(html)
          const songInfo = JSON.parse($('script').first()
            .text())
          songImage.value = songInfo.image.replace('1200', '200')
        })
      })
        .catch((e) => {
          console.log(e)
          songImage.value = ''
          loadCoverFromMap()
        })
    } else {
      songImage.value = ''
      loadCoverFromMap()
    }

    player.setOptions(originalOptions)
    player.toggleInteraction(false)
    emit('loaded')
    duration.value = d
    status.value = props.statuses.Listo
    setInitialSpeed(speed_added.value)

    if (pendingRestoreState) {
      const restore = pendingRestoreState
      pendingRestoreState = null

      if (typeof restore.speedAdded === 'number') {
        setInitialSpeed(restore.speedAdded)
      }
      if (typeof restore.volume === 'number') {
        player.setVolume(restore.volume)
        syncSoundTouchGain(restore.volume)
      }
      if (typeof restore.time === 'number' && Number.isFinite(restore.time)) {
        player.setTime(Math.max(0, restore.time))
      }
      if (restore.shouldPlay) {
        player.play()
      }
    }

    isRebuildingWaveform = false
  })

  player.on('play', () => {
    player.toggleInteraction(true)
    status.value = props.statuses.Reproduciendo
    ensureSoundTouchForCurrentState()
  })

  player.on('pause', () => {
    status.value = props.statuses.Pausado
    stopSoundTouchPlayback()
  })

  player.on('finish', () => {
    const finishedSong = songFull.value?.id ? { ...songFull.value } : null
    if (finishedSong) {
      emit('finished', finishedSong)
    }
    resetSongMetadata()
    stopSoundTouchPlayback()
    player.setPlaybackRate(1.0, false)
    speed_added.value = 0

    player.toggleInteraction(false)
    player.stop()
    player.destroy()
    init()

    wsRegions.clearRegions()
    status.value = props.statuses['Sin Carga']
    emit('stopped')
  })

  player.on('timeupdate', (currentTime) => {
    if (
      status.value === props.statuses.Reproduciendo || status.value === props.statuses.Cambiando || status.value === props.statuses.Placa || status.value === props.statuses.Nivelando
    ) {
      volume.value = player.getVolume()
      calculateVolume(currentTime)
      maybeResyncSoundTouch(currentTime)
    }
  })
}

function next() {
  const finishedSong = songFull.value?.id ? { ...songFull.value } : null
  if (finishedSong) {
    emit('finished', finishedSong)
  }
  left.value = 0
  resetSongMetadata()
  stopSoundTouchPlayback()
  start.value = null
  end.value = null
  player.stop()
  player.destroy()
  init()
  wsRegions.clearRegions()
  status.value = props.statuses['Sin Carga']
  emit('stopped')
  emit('fading')
}

function calculateVolume(ct) {
  const crossfader_time = savedSettings.crossfaderTime
  left.value = end.value - ct

  if (status.value === props.statuses.Cambiando && ct > end.value) {
    const finishedSong = songFull.value?.id ? { ...songFull.value } : null
    if (finishedSong) {
      emit('finished', finishedSong)
    }
    left.value = 0
    resetSongMetadata()
    stopSoundTouchPlayback()
    start.value = null
    end.value = null
    player.stop()
    player.destroy()
    init()
    wsRegions.clearRegions()
    status.value = props.statuses['Sin Carga']
    emit('stopped')
  } else {
    if (left.value > crossfader_time) {
      if (status.value !== props.statuses.Placa && status.value !== props.statuses.Nivelando) {
        player.setVolume(1.0)
        syncSoundTouchGain(1.0)
      }
    } else {
      if (status.value === props.statuses.Reproduciendo) {
        player.toggleInteraction(false)
        status.value = props.statuses.Cambiando

        player.setOptions(crossfaderOptions)
        emit('fading')
      }
      player.setVolume(left.value / crossfader_time)
      syncSoundTouchGain(left.value / crossfader_time)
    }
  }
}

function tempFade(duration = 3000) {
  player.toggleInteraction(false)
  let vol = player.getVolume()

  if (vol > 0.6) {
    const nextVol = vol - 0.1
    player.setVolume(nextVol)
    syncSoundTouchGain(nextVol)
    setTimeout(tempFade, 100)
  } else {
    setTimeout(function() {
      status.value = props.statuses.Nivelando
      volToNormal()
    }, duration)
  }
}

const clamp = (val, min, max) => Math.min(Math.max(val, min), max)

function volToNormal() {
  let vol = player.getVolume()

  if (vol < 1.0) {
    let new_vol = clamp(vol + 0.05, 0, 1)
    player.setVolume(new_vol)
    syncSoundTouchGain(new_vol)
    setTimeout(volToNormal, 100)
  } else {
    player.toggleInteraction(true)
    status.value = props.statuses.Reproduciendo
  }
}

function load(url) {
  // player.load(url)
}

function resetSongMetadata() {
  artist.value = ''
  artistsList.value = []
  composer.value = ''
  song.value = ''
  songImage.value = ''
  songFull.value = {}
  songId.value = null
  primaryArtistId.value = null
  activeMediaUrl = ''
}

async function setSong(s) {
  /*
   *  Create your own media element
   * Get this value from db
   */
  songFull.value = s
  start.value = s.start
  end.value = s.end
  songId.value = s.id
  song.value = s.name
  songImage.value = ''
  speed.value = 1
  speed_added.value = normalizeSpeedOffset(s.speed)
  artistsList.value = s.Artists || []
  artist.value = artistsList.value.map((i) => i.name).join(', ')
  primaryArtistId.value = artistsList.value?.[0]?.id || null
  composer.value = s.Composers.map((i) => i.name).join(', ')
  player.setPlaybackRate(1.0, false)
  player.setVolume(1)
  syncSoundTouchGain(1)
  const mediaUrl = await window.electron2.getMediaUrl({
    folder: s.folder,
    ytid: s.ytid
  })
  activeMediaUrl = mediaUrl

  // Warm up the decoded buffer so switching to SoundTouch is immediate.
  loadSoundTouchBuffer(mediaUrl)
  player.load(mediaUrl)
}

function play() {
  player.play()
}

function pause() {
  stopSoundTouchPlayback()
  player.pause()
}

function stop() {
  stopSoundTouchPlayback()
  player.stop()
}

function restart() {
  if (!player) return
  const restartAt = Number.isFinite(start.value) ? Math.max(0, start.value) : 0
  player.setTime(restartAt)
}

function getStatusName(status) {
  for (let s in props.statuses) {
    if (props.statuses.hasOwnProperty(s)) {
      if (props.statuses[s] === status) {
        return s
      }
    }
  }
}
function setInitialSpeed(val) {
  updateBaseSpeed()
  speed_added.value = normalizeSpeedOffset(val)
  applySpeed()
}

function setSpeed(val) {
  const nextOffset = normalizeSpeedOffset(speed_added.value) + Number(val || 0)
  speed_added.value = clamp(nextOffset, MIN_SPEED_OFFSET, MAX_SPEED_OFFSET)
  applySpeed()
  emit('speed')
}

function applySpeed() {
  const totalOffset = normalizeSpeedOffset(speed_added.value) + normalizeSpeedOffset(baseSpeed.value)
  const total = 1 + totalOffset / 100
  speed.value = clamp(Number(total), 0.5, 1.8)
  player.setPlaybackRate(speed.value, false)
  if (soundTouchShifter) {
    soundTouchShifter.tempo = speed.value
  }
  ensureSoundTouchForCurrentState()
}

function normalizeSpeedOffset(value) {
  const num = Number(value)
  if (!Number.isFinite(num)) return 0

  return num
}

function applyPreservePitch() {
  if (!player || typeof player.getMediaElement !== 'function') return
  const media = player.getMediaElement()
  if (!media) return

  media.preservesPitch = false
  media.webkitPreservesPitch = false
  media.mozPreservesPitch = false
}

function emitPreviewStart() {
  if (canPreview.value) {
    emit('preview-start', { song: songFull.value, status: status.value })
  }
}

function emitPreviewStop() {
  emit('preview-stop')
}

function emitArtistClick(id) {
  const targetId = id || primaryArtistId.value
  if (targetId) {
    emit('artist-click', targetId)
  }
}

function emitSongClick() {
  if (!songFull.value?.id) return
  emit('song-click', {
    id: songFull.value.id,
    name: songFull.value.name || song.value
  })
}

function updateBaseSpeed() {
  const s = JSON.parse(localStorage.getItem('vmusic_settings')) || {}
  baseSpeed.value = typeof s.baseSpeed === 'number' ? s.baseSpeed : 0
}
function setVolume(val) {
  volume_added.value = volume_added.value + val
  const newVolume = volume.value + val / 20

  volume.value = parseFloat(newVolume)
  player.setVolume(volume.value)
  syncSoundTouchGain(volume.value)
}

function setSinkId(sinkId) {
  if (!sinkId || sinkId === 'default' || !player || typeof player.setSinkId !== 'function') return
  try {
    player.setSinkId(sinkId)
    if (soundTouchContext && typeof soundTouchContext.setSinkId === 'function') {
      soundTouchContext.setSinkId(sinkId).catch(() => {})
    }
  } catch (error) {
    console.warn('No se pudo cambiar la salida del deck', error)
  }
}

function shouldUseSoundTouch() {
  return Math.abs(speed.value - 1) > 0.0001
}

function ensureSoundTouchContext() {
  if (soundTouchContext && soundTouchGain) return true
  const Ctx = window.AudioContext || window.webkitAudioContext
  if (!Ctx) return false

  soundTouchContext = new Ctx()
  soundTouchGain = soundTouchContext.createGain()
  soundTouchGain.gain.value = clamp(Number(volume.value || 1), 0, 1)
  soundTouchGain.connect(soundTouchContext.destination)

  return true
}

async function loadSoundTouchBuffer(mediaUrl) {
  if (!mediaUrl) return null
  if (!ensureSoundTouchContext()) return null
  if (soundTouchBuffer && soundTouchBufferUrl === mediaUrl) return soundTouchBuffer
  if (soundTouchLoadingPromise && soundTouchBufferUrl === mediaUrl) return soundTouchLoadingPromise

  soundTouchBufferUrl = mediaUrl
  soundTouchLoadingPromise = (async() => {
    const response = await fetch(mediaUrl)
    const bytes = await response.arrayBuffer()
    const decoded = await soundTouchContext.decodeAudioData(bytes.slice(0))
    soundTouchBuffer = decoded

    return decoded
  })()
    .catch((error) => {
      if (soundTouchBufferUrl === mediaUrl) {
        soundTouchBuffer = null
      }
      console.warn('No se pudo preparar SoundTouch para el deck', error)

      return null
    })
    .finally(() => {
      if (soundTouchBufferUrl === mediaUrl) {
        soundTouchLoadingPromise = null
      }
    })

  return soundTouchLoadingPromise
}

function syncSoundTouchGain(nextVolume = null) {
  if (!soundTouchGain) return
  const baseVolume = nextVolume == null ? volume.value : nextVolume
  soundTouchGain.gain.value = clamp(Number(baseVolume || 0), 0, 1)
}

function stopSoundTouchPlayback() {
  if (soundTouchShifter) {
    try {
      soundTouchShifter.disconnect()
    } catch (error) {
      // ignore
    }
    soundTouchShifter = null
  }
  soundTouchTimePlayed = 0
  if (player && typeof player.setMuted === 'function') {
    player.setMuted(false)
  }
}

async function startSoundTouchPlayback(fromTime = null) {
  if (!player || !activeMediaUrl || !shouldUseSoundTouch()) {
    stopSoundTouchPlayback()

    return
  }
  if (!ensureSoundTouchContext()) return

  const buffer = await loadSoundTouchBuffer(activeMediaUrl)
  if (!buffer) return
  if (!player || typeof player.isPlaying !== 'function' || !player.isPlaying()) return

  stopSoundTouchPlayback()

  if (soundTouchContext.state === 'suspended') {
    try {
      await soundTouchContext.resume()
    } catch (error) {
      // ignore
    }
  }

  const shifter = new PitchShifter(soundTouchContext, buffer, SOUND_TOUCH_BUFFER_SIZE)
  shifter.pitch = 1
  shifter.tempo = speed.value
  shifter.on('play', (detail) => {
    soundTouchTimePlayed = Number(detail?.timePlayed || 0)
  })

  const durationSec = typeof player.getDuration === 'function' ? player.getDuration() : (buffer.duration || 0)
  const currentTime = Number.isFinite(fromTime) ? fromTime : (typeof player.getCurrentTime === 'function' ? player.getCurrentTime() : 0)
  if (durationSec > 0) {
    shifter.percentagePlayed = clamp(currentTime / durationSec, 0, 1)
  }
  shifter.connect(soundTouchGain)
  soundTouchShifter = shifter
  syncSoundTouchGain()

  if (typeof player.setMuted === 'function') {
    player.setMuted(true)
  }
}

function ensureSoundTouchForCurrentState() {
  if (!player || typeof player.isPlaying !== 'function' || !player.isPlaying() || !shouldUseSoundTouch()) {
    stopSoundTouchPlayback()

    return
  }
  if (soundTouchShifter) {
    soundTouchShifter.tempo = speed.value
    if (typeof player.setMuted === 'function') {
      player.setMuted(true)
    }
    syncSoundTouchGain()

    return
  }
  startSoundTouchPlayback()
}

function maybeResyncSoundTouch(currentTime) {
  if (!ENABLE_SOUND_TOUCH_AUTO_RESYNC) return
  if (!soundTouchShifter || !shouldUseSoundTouch()) return
  if (player && typeof player.isSeeking === 'function' && player.isSeeking()) return
  const drift = Math.abs(Number(currentTime || 0) - Number(soundTouchTimePlayed || 0))
  if (drift < SOUND_TOUCH_SYNC_THRESHOLD_SEC) return

  const now = Date.now()
  if ((now - soundTouchLastResyncAt) < SOUND_TOUCH_RESYNC_COOLDOWN_MS) return
  soundTouchLastResyncAt = now
  startSoundTouchPlayback(currentTime)
}

function loadCoverFromMap() {
  try {
    const stored = localStorage.getItem('vmusic_cover_map')
    if (!stored || !songFull.value?.ytid) return
    const parsed = JSON.parse(stored)
    const cover = parsed[songFull.value.ytid]
    if (cover) {
      songImage.value = cover
    }
  } catch (error) {
    // ignore
  }
}

function getThemeColor(varName, fallback) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(varName)
    .trim()

  return value || fallback
}

function getCurrentWaveColor() {
  return getThemeColor(props.position === 'top' ? '--vm-player-wave-a' : '--vm-player-wave-b', props.position === 'top' ? '#EAB308' : '#EC4899')
}

function getCurrentProgressColor() {
  const waveColor = getCurrentWaveColor()

  return `color-mix(in srgb, ${waveColor} 72%, black 28%)`
}

function forceWaveContainerFit() {
  const mount = document.getElementById(playerId.value)
  if (!mount) return
  mount.style.overflow = 'hidden'

  const waveHost = Array.from(mount.children)
    .find((node) => node && node.shadowRoot)
  const shadow = waveHost?.shadowRoot
  if (!shadow) return

  const scroll = shadow.querySelector('.scroll')
  const wrapper = shadow.querySelector('.wrapper')
  const canvases = shadow.querySelector('.canvases')
  const progress = shadow.querySelector('.progress')

  if (scroll) {
    scroll.style.width = '100%'
    scroll.style.maxWidth = '100%'
    scroll.style.height = '100%'
    scroll.style.maxHeight = '100%'
    scroll.style.overflowX = 'hidden'
    scroll.style.overflowY = 'hidden'
  }
  if (wrapper) {
    wrapper.style.width = '100%'
    wrapper.style.maxWidth = '100%'
    wrapper.style.height = '100%'
    wrapper.style.maxHeight = '100%'
  }
  if (canvases) {
    canvases.style.width = '100%'
    canvases.style.maxWidth = '100%'
    canvases.style.height = '100%'
    canvases.style.maxHeight = '100%'
  }
  if (progress) {
    progress.style.width = '100%'
    progress.style.maxWidth = '100%'
    progress.style.height = '100%'
    progress.style.maxHeight = '100%'
  }
}

function redrawWaveform() {
  if (!player) return
  const mount = document.getElementById(playerId.value)
  const mountWidth = mount?.clientWidth || 0
  const mountHeight = mount?.clientHeight || 0
  const renderHeight = mountHeight > 0 ? mountHeight : 'auto'

  const waveColor = getCurrentWaveColor()
  const progressColor = getCurrentProgressColor()
  const cursorColor = status.value === props.statuses.Cambiando ? getThemeColor('--vm-player-crossfader-cursor', '#FF0000') : getThemeColor('--vm-player-cursor', '#FFFFFF')

  player.setOptions({
    waveColor,
    progressColor,
    cursorColor,
    width: '100%',
    minPxPerSec: 0,
    height: renderHeight,
    fillParent: true
  })
  if (mountWidth > 0) {
    player.setOptions({ width: mountWidth })
  }
  if (mountHeight > 0) {
    player.setOptions({ height: mountHeight })
  }

  const decodedData = typeof player.getDecodedData === 'function' ? player.getDecodedData() : null
  if (!decodedData) {
    forceWaveContainerFit()

    return
  }

  // Ensure WaveSurfer collapses to the new container width after fullscreen restore.
  if (typeof player.zoom === 'function') {
    player.zoom(0)
  }

  // Force renderer layout recomputation on window restore/fullscreen transitions.
  const renderer = typeof player.getRenderer === 'function' ? player.getRenderer() : null
  if (renderer && typeof renderer.reRender === 'function') {
    renderer.reRender()
  }

  forceWaveContainerFit()
}

function hardRebuildWaveform() {
  if (!player || isRebuildingWaveform) return
  if (!songFull.value?.id) return

  isRebuildingWaveform = true

  const shouldPlay = [
    props.statuses.Reproduciendo,
    props.statuses.Cambiando,
    props.statuses.Nivelando,
    props.statuses.Placa
  ].includes(status.value)

  const restoreSong = { ...songFull.value }
  const restoreState = {
    time: typeof player.getCurrentTime === 'function' ? player.getCurrentTime() : 0,
    shouldPlay,
    speedAdded: speed_added.value,
    volume: typeof player.getVolume === 'function' ? player.getVolume() : volume.value
  }

  pendingRestoreState = restoreState
  stopSoundTouchPlayback()

  try {
    player.stop()
  } catch (error) {
    // ignore
  }

  try {
    player.destroy()
  } catch (error) {
    // ignore
  }

  init()
  setSong(restoreSong)

  setTimeout(() => {
    if (isRebuildingWaveform) {
      isRebuildingWaveform = false
    }
  }, 5000)
}

function scheduleWaveformRedraw() {
  if (resizeRafId) {
    cancelAnimationFrame(resizeRafId)
  }
  resizeRafId = requestAnimationFrame(() => {
    resizeRafId = null
    redrawWaveform()
  })
}

function onViewportResize() {
  refreshWaveform()
}

function setupResizeObserver() {
  if (typeof ResizeObserver === 'undefined') return
  const container = document.getElementById(playerId.value)
  if (!container) return

  resizeObserver = new ResizeObserver(() => {
    refreshWaveform()
  })
  resizeObserver.observe(container)
}

function shouldHardRebuildWaveform() {
  if (!player || !songFull.value?.id) return false
  if (isRebuildingWaveform) return false

  const decodedData = typeof player.getDecodedData === 'function' ? player.getDecodedData() : null
  if (!decodedData) return false

  const mount = document.getElementById(playerId.value)
  if (!mount || mount.clientWidth <= 0) return false

  const waveHost = Array.from(mount.children)
    .find((node) => node && node.shadowRoot)
  const shadow = waveHost?.shadowRoot
  if (!shadow) return false

  const scroll = shadow.querySelector('.scroll')
  const wrapper = shadow.querySelector('.wrapper')
  const widths = [scroll?.clientWidth, wrapper?.clientWidth].filter((value) => Number.isFinite(value) && value > 0)
  const heights = [scroll?.clientHeight, wrapper?.clientHeight].filter((value) => Number.isFinite(value) && value > 0)
  if (widths.length <= 0) return false

  const widthMismatch = widths.some((width) => Math.abs(width - mount.clientWidth) > 4)
  const heightMismatch = heights.length > 0 ? heights.some((height) => Math.abs(height - mount.clientHeight) > 4) : false
  const scrollOversized = scroll && Number.isFinite(scroll.scrollWidth) ? (scroll.scrollWidth - mount.clientWidth) > 4 : false
  const scrollOversizedY = scroll && Number.isFinite(scroll.scrollHeight) ? (scroll.scrollHeight - mount.clientHeight) > 4 : false

  return widthMismatch || heightMismatch || scrollOversized || scrollOversizedY
}

function scheduleHardRebuildCheck() {
  if (hardRebuildTimeoutId) {
    clearTimeout(hardRebuildTimeoutId)
    hardRebuildTimeoutId = null
  }

  hardRebuildTimeoutId = setTimeout(() => {
    hardRebuildTimeoutId = null
    if (shouldHardRebuildWaveform()) {
      hardRebuildWaveform()
    }
  }, 320)
}

function runWaveformRefreshPass() {
  scheduleWaveformRedraw()
  scheduleHardRebuildCheck()
}

function refreshWaveform() {
  runWaveformRefreshPass()
  if (resizeFollowupTimeoutId) {
    clearTimeout(resizeFollowupTimeoutId)
    resizeFollowupTimeoutId = null
  }

  // Follow-up pass catches Electron fullscreen/restore layout timing.
  resizeFollowupTimeoutId = setTimeout(() => {
    resizeFollowupTimeoutId = null
    runWaveformRefreshPass()
  }, 180)
}

function syncWaveColor() {
  if (!player) return
  const waveColor = getCurrentWaveColor()
  const progressColor = getCurrentProgressColor()
  player.setOptions({ waveColor, progressColor })
  crossfaderOptions = {
    ...crossfaderOptions,
    waveColor,
    progressColor
  }
  originalOptions = {
    ...originalOptions,
    waveColor,
    progressColor
  }
}

function handleThemeChanged() {
  if (!player) return
  const waveColor = getCurrentWaveColor()
  const progressColor = getCurrentProgressColor()
  const cursorColor = getThemeColor('--vm-player-cursor', '#FFFFFF')
  const crossfaderCursorColor = getThemeColor('--vm-player-crossfader-cursor', '#FF0000')
  regionColor.value = getThemeColor('--vm-player-region', 'rgba(114,0,0,0.64)')

  player.setOptions({
    waveColor,
    progressColor,
    cursorColor
  })
  crossfaderOptions = {
    ...crossfaderOptions,
    waveColor,
    progressColor,
    cursorColor: crossfaderCursorColor
  }
}

watch(() => props.outputSinkId,
  (val) => {
    setSinkId(val)
  })

watch(status, () => {
  syncWaveColor()
})

window.addEventListener('vmusic-color-schema-changed', handleThemeChanged)

onBeforeUnmount(() => {
  window.removeEventListener('vmusic-color-schema-changed', handleThemeChanged)
  window.removeEventListener('resize', onViewportResize)
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
  if (resizeRafId) {
    cancelAnimationFrame(resizeRafId)
    resizeRafId = null
  }
  if (resizeFollowupTimeoutId) {
    clearTimeout(resizeFollowupTimeoutId)
    resizeFollowupTimeoutId = null
  }
  if (hardRebuildTimeoutId) {
    clearTimeout(hardRebuildTimeoutId)
    hardRebuildTimeoutId = null
  }
  stopSoundTouchPlayback()
  soundTouchBuffer = null
  soundTouchBufferUrl = ''
  if (soundTouchContext && typeof soundTouchContext.close === 'function') {
    soundTouchContext.close().catch(() => {})
  }
  soundTouchContext = null
  soundTouchGain = null
  soundTouchLoadingPromise = null
})

defineExpose({
  position: props.position,
  songId,
  status,
  left,
  songFull,
  tempFade,
  load,
  play,
  pause,
  stop,
  restart,
  setSong,
  next,
  speed_added,
  baseSpeed,
  refreshBaseSpeed: () => {
    updateBaseSpeed()
    applySpeed()
  },
  refreshWaveform,
  forceWaveformRebuild: hardRebuildWaveform,
  setSinkId
})
</script>

<style scoped>
.player-text {
  color: var(--vm-player-text);
}

.player-deck-a {
  background-color: var(--vm-player-wave-a);
}

.player-deck-b {
  background-color: var(--vm-player-wave-b);
}

.player-preview-btn:hover {
  color: var(--vm-player-preview-hover);
}

.wavesurfer::part(scroll) {
  overflow-x: hidden !important;
  width: 100% !important;
  max-width: 100% !important;
}

.wavesurfer::part(wrapper) {
  width: 100% !important;
  max-width: 100% !important;
}
</style>
