<template>
  <div class="player player-shell min-w-0">
    <div class="player-vinyl-column">
      <div
        :class="{
          'player-vinyl-playing': status === props.statuses.Reproduciendo,
          'player-deck-b': props.position === 'bottom',
          'player-deck-a': props.position === 'top',
          'player-vinyl-ejectable': canEject
        }"
        class="player-vinyl-frame"
        :style="{ backgroundImage: `url(${cdBgUrl})` }"
        :title="canEject ? 'Expulsar disco' : ''"
        @click.stop="ejectDisc"
      >
        <div class="player-vinyl-cover-wrapper">
          <img
            v-if="songImage"
            :src="songImage"
            class="player-vinyl-cover select-none"
            draggable="false"
            :style="coverStyle"
          />
          <div
            v-else
            :class="{
              'player-deck-b': props.position === 'bottom',
              'player-deck-a': props.position === 'top'
            }"
            class="player-vinyl-fallback player-text text-bold text-center"
          />
        </div>
        <img
          :src="cdCenterUrl"
          :class="{ 'player-vinyl-center-no-cover': !songImage }"
          class="player-vinyl-center select-none"
          alt=""
          draggable="false"
        />
        <div v-if="canEject" class="player-vinyl-eject-overlay">
          <Icon
            icon="bi:trash"
            class="player-vinyl-eject-icon"
            aria-hidden="true"
          />
        </div>
      </div>
    </div>

    <div
      :class="{
        'player-layout-reverse': props.position === 'top'
      }"
      class="player-main player-fixed-layout min-w-0"
    >
      <div class="player-header flex justify-between space-x-3">
        <div class="flex-1 min-w-0">
          <h2 class="text-white text-2xl select-none w-full truncate">
            <template v-if="artistsList.length">
              <template v-for="(a, idx) in artistsList" :key="a.id">
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
          </h2>
          <div class="flex items-center space-x-2 w-full min-w-0">
            <div class="flex-1 min-w-0">
              <h1 class="text-white text-xl select-none truncate">
                <button
                  v-if="songFull?.id"
                  type="button"
                  class="hover:underline"
                  title="Ver información de esta canción"
                  @click.stop="emitSongClick"
                >
                  {{ song || 'Sin canción' }}
                </button>
                <span v-else>{{ song || 'Sin canción' }}</span>
                <span v-if="artist && composer" class="text-gray-300"> ({{ composer }})</span>
              </h1>
            </div>
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
        </div>

        <div class="flex flex-col items-center text-gray-500 translate-y-[6px]">
          <div v-if="status !== props.statuses['Sin Carga']" class="flex flex-col items-center">
            <span class="text-sm mb-0.5 select-none flex items-center gap-1">
              Velocidad
              <Icon
                v-if="isUsingNativeRateMode"
                class="w-4 h-4 text-cyan-300"
                icon="mdi:sine-wave"
                title="Usando playbackRate + preservesPitch"
              />
              <Icon
                v-else-if="isUsingProcessedSpeedFile"
                class="w-4 h-4 text-lime-300"
                icon="mdi:content-save"
                title="Usando audio preprocesado en disco"
              />
            </span>
            <div class="flex flex-col items-center space-y-0.5">
              <div class="flex items-center space-x-1">
                <Icon
                  class="cursor-pointer w-6 h-6 text-white"
                  icon="teenyicons:left-solid"
                  @click="setSpeed(-1)"
                />
                <span v-if="speed_added > 0" class="text-lime-500 font-bold text-xl select-none"
                  >+</span
                >
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
        class="wavesurfer wavesurfer-fixed-height min-w-0 w-full overflow-hidden"
      />
    </div>
  </div>
</template>

<script setup>
import { onBeforeMount, onMounted, onBeforeUnmount, ref, watch, computed } from 'vue'
import WaveSurfer from 'wavesurfer.js'
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js'
import { Icon } from '@iconify/vue'
import axios from 'axios'
import { buildSpotifySearchUrl } from '../lib/spotify-cover'

defineOptions({
  name: 'MusicPlayer'
})

const emit = defineEmits([
  'fading',
  'stopped',
  'loaded',
  'speed',
  'artist-click',
  'song-click',
  'preview-start',
  'preview-stop',
  'finished',
  'cover-updated',
  'timeupdate'
])

const props = defineProps({
  position: {
    type: String,
    default: ''
  },
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
const cdBgUrl = new URL('./cd-bg.png', window.location.href).href
const cdCenterUrl = new URL('./cd-center.png', window.location.href).href
const duration = ref(0.0)
const songFull = ref({})
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
const baseVolume = ref(1.0)
const speed = ref(1.0)
const left = ref(0)
const speed_added = ref(0.0)
const volume_added = ref(0.0)
const songImage = ref('')
const coverZoom = ref(0)
const coverStyle = computed(() => ({
  transform: `scale(${1 + coverZoom.value * 0.05})`
}))
const baseSpeed = ref(0)
const hasManualEndMarker = ref(false)
const fadeProfile = ref({ hasFade: false, fadeStartSec: null, confidence: 0 })
let fadeProfileRequestSerial = 0
let wsRegions = null
let originalOptions = {}
let crossfaderOptions = {}
let mediaElement = null
let isRebuildingWaveform = false
let pendingRestoreState = null
let forcedFadeEndAt = null
let playCountIncremented = false
const regionColor = ref('rgba(255, 255, 255, 0.28)')
const fadeRegionColor = ref('rgba(255, 255, 255, 0.28)')
const waveformDuration = ref(0)
const savedSettings = JSON.parse(localStorage.getItem('vmusic_settings'))

const baseSpeedLabel = computed(() => {
  const value = baseSpeed.value || 0
  const sign = value > 0 ? '+' : ''

  return `${sign}${value}`
})

const canPreview = computed(
  () => status.value !== props.statuses.Reproduciendo && Boolean(songFull.value?.id)
)

const canEject = computed(() => {
  if (!songFull.value?.id) return false
  if (status.value === props.statuses.Reproduciendo) return false
  if (status.value === props.statuses.Cambiando) return false
  if (status.value === props.statuses.Nivelando) return false
  if (status.value === props.statuses.Cargando) return false
  return true
})
const MIN_SPEED_OFFSET = -50
const MAX_SPEED_OFFSET = 50
const KEYBOARD_SEEK_FORWARD_END_GUARD_SECONDS = 10
const AUDIO_DEBUG = import.meta.env.DEV
const SPEED_PREPROCESS_DEBOUNCE_MS = 3200
const SPEED_SWITCH_FADE_OUT_MS = 90
const SPEED_SWITCH_FADE_IN_MS = 140
const WAVEFORM_BAR_HEIGHT = 1

const currentMediaVariant = ref('original')
const processedSpeedRate = ref(null)
let speedPreprocessDebounceId = null
let preprocessRequestSerial = 0
let volumeAnimationToken = 0
const previewDuckMultiplier = ref(1)
const isPreprocessingSpeed = ref(false)
const isInitialSpeedPreprocessPending = ref(false)
const coverCacheRequests = new Map()
const spotifyCoverRequests = new Map()
const isUsingProcessedSpeedFile = computed(() => {
  if (ratesMatch(speed.value, 1)) return false

  return currentMediaVariant.value === 'speed' && ratesMatch(processedSpeedRate.value, speed.value)
})
const isUsingNativeRateMode = computed(() => {
  if (ratesMatch(speed.value, 1)) return false

  return !isUsingProcessedSpeedFile.value
})
const finalModeLabel = computed(() => {
  if (hasManualEndMarker.value) return 'Manual'
  if (fadeProfile.value?.hasFade) return 'Automático'

  return 'Exacto'
})
const visibleStatusLabel = computed(() => {
  if (isPreprocessingSpeed.value) return 'Procesando velocidad'

  return getStatusName(status.value)
})

function isReadyStatus() {
  return status.value === props.statuses.Listo || status.value === props.statuses.Pausado
}

function debugAudio(event, payload = null) {
  if (!AUDIO_DEBUG) return
  const deck = props.position === 'top' ? 'A' : 'B'
  if (payload && typeof payload === 'object') {
    console.info(`[vmusic][audio-debug][deck-${deck}] ${event}`, payload)

    return
  }
  console.info(`[vmusic][audio-debug][deck-${deck}] ${event}`)
}

function safePlay() {
  if (!isReadyStatus()) return
  if (!player || typeof player.play !== 'function') return
  try {
    const maybePromise = player.play()
    if (maybePromise && typeof maybePromise.catch === 'function') {
      maybePromise.catch((error) => {
        const msg = String(error?.message || '')
        const name = String(error?.name || '')
        const isAbort = name === 'AbortError' || msg.toLowerCase().includes('aborted')
        if (!isAbort) {
          console.warn('[vmusic][audio] play failed', error)
        }
      })
    }
  } catch (error) {
    const msg = String(error?.message || '')
    const name = String(error?.name || '')
    const isAbort = name === 'AbortError' || msg.toLowerCase().includes('aborted')
    if (!isAbort) {
      console.warn('[vmusic][audio] play failed', error)
    }
  }
}

onBeforeMount(() => {
  status.value = props.statuses['Sin Carga']
  playerId.value = 'w' + Math.random().toString(36).substring(2, 7)
})

onMounted(() => {
  updateBaseSpeed()
  init()
})

function init() {
  const waveColor = getCurrentWaveColor()
  const progressColor = getCurrentProgressColor()
  const cursorColor = getThemeColor('--vm-player-cursor', '#FFFFFF')
  const crossfaderCursorColor = getThemeColor('--vm-player-crossfader-cursor', '#FF0000')
  regionColor.value = 'rgba(255, 255, 255, 0.28)'
  fadeRegionColor.value = 'rgba(255, 255, 255, 0.28)'

  mediaElement = document.createElement('audio')
  mediaElement.preload = 'auto'
  mediaElement.crossOrigin = 'anonymous'
  mediaElement.preservesPitch = true
  mediaElement.webkitPreservesPitch = true
  mediaElement.mozPreservesPitch = true
  forcedFadeEndAt = null

  originalOptions = {
    normalize: true,
    container: '#' + playerId.value,
    cursorColor,
    barHeight: WAVEFORM_BAR_HEIGHT,
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
    barHeight: WAVEFORM_BAR_HEIGHT,
    height: 'auto',
    fillParent: true,
    waveColor,
    progressColor
  }

  player = WaveSurfer.create(originalOptions)
  applyPreservePitch()

  wsRegions = player.registerPlugin(RegionsPlugin.create())

  player.on('decode', (d) => {
    waveformDuration.value = d
    const playbackStart = toPlaybackTime(start.value)
    if (start.value && start.value !== 0) {
      player.setTime(playbackStart)
    }
    if (!end.value) end.value = toSourceTime(d)
    renderWaveRegions()
    left.value = toPlaybackTime(end.value)
  })

  wsRegions.on('region-clicked', (region, e) => {
    e.stopPropagation() // prevent triggering a click on the waveform
  })

  player.on('error', (err) => {
    console.warn('[vmusic][audio] Error al cargar audio:', err)
    // Si la canción estaba cargándose, restaurar estado sin auto-cargar
    // la siguiente canción para no saltar canciones silenciosamente
    if (status.value === props.statuses.Cargando) {
      status.value = props.statuses['Sin Carga']
    }
  })

  player.on('load', () => {
    applyPreservePitch()
    waveformDuration.value = 0
    wsRegions.clearRegions()
    player.toggleInteraction(false)
    status.value = props.statuses.Cargando
    player.seekTo(0)
    debugAudio('player-load', {
      songId: songFull.value?.id || null,
      variant: currentMediaVariant.value,
      targetRate: roundRate(getTargetPlaybackRate())
    })
  })

  player.on('ready', (d) => {
    applyPreservePitch()
    setSinkId(props.outputSinkId)
    songImage.value = getStoredCoverForSong(songFull.value)
    if (songImage.value) {
      cacheCoverInBackground(songFull.value, songImage.value)
    }

    player.setOptions(originalOptions)
    player.toggleInteraction(false)
    emit('loaded')
    duration.value = d
    status.value = props.statuses.Listo
    setInitialSpeed(speed_added.value)
    debugAudio('player-ready', {
      songId: songFull.value?.id || null,
      variant: currentMediaVariant.value,
      speedRate: processedSpeedRate.value,
      playbackRate: roundRate(speed.value)
    })

    if (pendingRestoreState) {
      const restore = pendingRestoreState
      pendingRestoreState = null

      if (typeof restore.speedAdded === 'number') {
        setInitialSpeed(restore.speedAdded)
      }
      if (typeof restore.volume === 'number') {
        applyVolume(restore.volume)
      }
      if (typeof restore.time === 'number' && Number.isFinite(restore.time)) {
        player.setTime(Math.max(0, restore.time))
      }
      if (restore.shouldPlay) {
        safePlay()
      }
      if (typeof restore.fadeInTarget === 'number') {
        animateVolumeTo(restore.fadeInTarget, SPEED_SWITCH_FADE_IN_MS)
      }
    }

    isRebuildingWaveform = false
  })

  player.on('play', () => {
    player.toggleInteraction(true)
    status.value = props.statuses.Reproduciendo
    // Incrementar contador de reproducción solo una vez por canción
    if (songFull.value?.id && !playCountIncremented) {
      playCountIncremented = true
      import('axios').then((axiosModule) => {
        const axios = axiosModule.default || axiosModule
        axios
          .post(`http://localhost:3000/songs/increment-playcount/${songFull.value.id}`)
          .catch(() => {
            // Silenciar errores - el conteo no es crítico
          })
      })
    }
  })

  player.on('pause', () => {
    status.value = props.statuses.Pausado
  })

  player.on('finish', () => {
    const finishedSong = songFull.value?.id ? { ...songFull.value } : null
    if (finishedSong) {
      emit('finished', finishedSong)
    }
    resetSongMetadata()
    clearPreprocessDebounce()
    preprocessRequestSerial += 1
    isPreprocessingSpeed.value = false
    isInitialSpeedPreprocessPending.value = false
    currentMediaVariant.value = 'original'
    processedSpeedRate.value = null
    fadeProfileRequestSerial += 1
    fadeProfile.value = { hasFade: false, fadeStartSec: null, confidence: 0 }
    waveformDuration.value = 0
    forcedFadeEndAt = null
    player.setPlaybackRate(1.0, true)
    speed_added.value = 0

    player.toggleInteraction(false)
    player.stop()
    destroyCurrentPlayer()
    init()

    wsRegions.clearRegions()
    status.value = props.statuses['Sin Carga']
    emit('stopped')
  })

let lastLyricsEmit = 0

player.on('timeupdate', (currentTime) => {
  if (
    status.value === props.statuses.Reproduciendo ||
    status.value === props.statuses.Cambiando ||
    status.value === props.statuses.Placa ||
    status.value === props.statuses.Nivelando
  ) {
    calculateVolume(currentTime)
    const now = Date.now()
    if (now - lastLyricsEmit > 200) {
      lastLyricsEmit = now
      emit('timeupdate', currentTime)
    }
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
  clearPreprocessDebounce()
  preprocessRequestSerial += 1
  isPreprocessingSpeed.value = false
  isInitialSpeedPreprocessPending.value = false
  currentMediaVariant.value = 'original'
  processedSpeedRate.value = null
  fadeProfileRequestSerial += 1
  fadeProfile.value = { hasFade: false, fadeStartSec: null, confidence: 0 }
  waveformDuration.value = 0
  forcedFadeEndAt = null
  start.value = null
  end.value = null
  player.setPlaybackRate(1.0, true)
  speed_added.value = 0
  player.stop()
  destroyCurrentPlayer()
  init()
  wsRegions.clearRegions()
  status.value = props.statuses['Sin Carga']
  emit('stopped')
  emit('fading')
}

function calculateVolume(ct) {
  const crossfader_time = savedSettings.crossfaderTime
  const playbackEnd = toPlaybackTime(end.value)
  left.value = playbackEnd - ct
  const canDetectNaturalFade = status.value === props.statuses.Reproduciendo
  const realFadeDetected = canDetectNaturalFade && shouldTriggerBackendFade(ct, crossfader_time)
  const hasForcedFade = Number.isFinite(forcedFadeEndAt)

  if (realFadeDetected && !hasForcedFade && status.value === props.statuses.Reproduciendo) {
    forcedFadeEndAt = ct + Math.max(0.1, Number(crossfader_time || 0))
  }

  const forcedFadeFinished = Number.isFinite(forcedFadeEndAt) && ct >= forcedFadeEndAt
  if (
    status.value === props.statuses.Cambiando &&
    (forcedFadeFinished || (!Number.isFinite(forcedFadeEndAt) && ct > playbackEnd))
  ) {
    const finishedSong = songFull.value?.id ? { ...songFull.value } : null
    if (finishedSong) {
      emit('finished', finishedSong)
    }
    forcedFadeEndAt = null
    left.value = 0
    resetSongMetadata()
    start.value = null
    end.value = null
    player.stop()
    destroyCurrentPlayer()
    init()
    wsRegions.clearRegions()
    status.value = props.statuses['Sin Carga']
    emit('stopped')
  } else {
    const shouldStartCrossfade = Number.isFinite(forcedFadeEndAt) || left.value <= crossfader_time
    if (!shouldStartCrossfade) {
      if (status.value !== props.statuses.Placa && status.value !== props.statuses.Nivelando) {
        applyVolume(1.0)
      }
    } else {
      if (status.value === props.statuses.Reproduciendo) {
        player.toggleInteraction(false)
        status.value = props.statuses.Cambiando

        player.setOptions(crossfaderOptions)
        emit('fading')
      }
      const forcedRemaining = Number.isFinite(forcedFadeEndAt) ? forcedFadeEndAt - ct : left.value
      applyVolume(clamp(forcedRemaining / Math.max(0.1, crossfader_time), 0, 1))
    }
  }
}

function tempFade(duration = 3000) {
  player.toggleInteraction(false)
  let vol = baseVolume.value

  if (vol > 0.6) {
    applyVolume(vol - 0.1)
    setTimeout(tempFade, 100)
  } else {
    setTimeout(function () {
      status.value = props.statuses.Nivelando
      volToNormal()
    }, duration)
  }
}

const clamp = (val, min, max) => Math.min(Math.max(val, min), max)

function volToNormal() {
  let vol = baseVolume.value

  if (vol < 1.0) {
    let new_vol = clamp(vol + 0.05, 0, 1)
    applyVolume(new_vol)
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
  waveformDuration.value = 0
}

function roundRate(value) {
  return Number(Number(value || 1).toFixed(3))
}

function getTargetPlaybackRate() {
  const totalOffset =
    normalizeSpeedOffset(speed_added.value) + normalizeSpeedOffset(baseSpeed.value)
  const total = 1 + totalOffset / 100

  return clamp(Number(total), 0.5, 1.8)
}

function ratesMatch(a, b) {
  return Math.abs(roundRate(a) - roundRate(b)) < 0.001
}

function getCurrentMediaScale() {
  if (currentMediaVariant.value === 'speed' && Number.isFinite(processedSpeedRate.value)) {
    return Number(processedSpeedRate.value)
  }

  return 1
}

function hasExplicitEndMarker(songData) {
  const endValue = Number(songData?.end)
  if (!Number.isFinite(endValue) || endValue <= 0) return false
  const durationValue = Number(songData?.duration)
  if (!Number.isFinite(durationValue) || durationValue <= 0) return true

  return endValue < durationValue - 0.25
}

function toPlaybackTime(sourceTime) {
  const value = Number(sourceTime)
  if (!Number.isFinite(value)) return 0
  const scale = Math.max(0.001, getCurrentMediaScale())

  return value / scale
}

function toSourceTime(playbackTime) {
  const value = Number(playbackTime)
  if (!Number.isFinite(value)) return 0
  const scale = Math.max(0.001, getCurrentMediaScale())

  return value * scale
}

async function loadFadeProfile(song) {
  if (!song?.id) return
  if (hasManualEndMarker.value) {
    fadeProfile.value = { hasFade: false, fadeStartSec: null, confidence: 0 }
    debugAudio('fade-profile-skip-manual-end', {
      songId: song.id
    })

    return
  }

  fadeProfileRequestSerial += 1
  const requestSerial = fadeProfileRequestSerial
  try {
    const response = await axios.get(`http://localhost:3000/songs/fade-profile/${song.id}`)
    if (requestSerial !== fadeProfileRequestSerial) return

    const profile = response?.data || {}
    fadeProfile.value = {
      hasFade: Boolean(profile?.hasFade),
      fadeStartSec: Number.isFinite(Number(profile?.fadeStartSec))
        ? Number(profile.fadeStartSec)
        : null,
      confidence: Number.isFinite(Number(profile?.confidence)) ? Number(profile.confidence) : 0
    }
  } catch (error) {
    if (requestSerial !== fadeProfileRequestSerial) return
    fadeProfile.value = { hasFade: false, fadeStartSec: null, confidence: 0 }
    console.warn('[vmusic][fade-profile] failed to load fade profile', error)
  }
}

function shouldTriggerBackendFade(playbackCurrentTime, crossfaderTime) {
  if (!fadeProfile.value?.hasFade) return false
  if (!Number.isFinite(end.value) || end.value <= 0) return false

  const playbackEnd = toPlaybackTime(end.value)
  const triggerAt = toPlaybackTime(fadeProfile.value.fadeStartSec)
  if (!Number.isFinite(playbackEnd) || !Number.isFinite(triggerAt)) return false

  const maxTrigger = Math.max(0, playbackEnd - Math.max(0.1, Number(crossfaderTime || 0)))
  const safeTriggerAt = Math.min(triggerAt, maxTrigger)

  return playbackCurrentTime >= safeTriggerAt
}

function getCurrentPlayableStates() {
  return [
    props.statuses.Reproduciendo,
    props.statuses.Cambiando,
    props.statuses.Nivelando,
    props.statuses.Placa
  ]
}

function applyVolume(targetVolume, options = {}) {
  const { persistBase = true } = options
  const normalizedBaseVolume = clamp(Number(targetVolume), 0, 1)
  if (persistBase) {
    baseVolume.value = normalizedBaseVolume
  }
  const appliedVolume = clamp(normalizedBaseVolume * previewDuckMultiplier.value, 0, 1)
  if (player && typeof player.setVolume === 'function') {
    player.setVolume(appliedVolume)
  }
  volume.value = appliedVolume

  return appliedVolume
}

function animateVolumeTo(targetVolume, durationMs) {
  if (!player || typeof player.setVolume !== 'function') {
    return Promise.resolve()
  }

  const from = clamp(Number(baseVolume.value), 0, 1)
  const to = clamp(Number(targetVolume), 0, 1)
  if (durationMs <= 0 || Math.abs(from - to) < 0.001) {
    applyVolume(to)

    return Promise.resolve()
  }

  volumeAnimationToken += 1
  const token = volumeAnimationToken
  const startAt = performance.now()

  return new Promise((resolve) => {
    const tick = (now) => {
      if (token !== volumeAnimationToken || !player) {
        resolve()

        return
      }

      const progress = clamp((now - startAt) / durationMs, 0, 1)
      const vol = from + (to - from) * progress
      applyVolume(vol)

      if (progress >= 1) {
        resolve()

        return
      }
      requestAnimationFrame(tick)
    }

    requestAnimationFrame(tick)
  })
}

async function fetchSpeedVersionStatus(songId) {
  try {
    const response = await axios.get(`http://localhost:3000/songs/speed-version/${songId}`)

    return response.data || { exists: false, rate: null }
  } catch (error) {
    return { exists: false, rate: null }
  }
}

async function touchSpeedVersionUsage(songId) {
  if (!songId) return
  try {
    await axios.get(`http://localhost:3000/songs/speed-version/${songId}?use=1`)
  } catch (error) {
    // ignore usage-mark failures
  }
}

async function resolveInitialVariant(song, targetRate) {
  if (!song?.id) {
    return { variant: 'original', rate: null }
  }

  if (ratesMatch(targetRate, 1)) {
    return { variant: 'original', rate: null }
  }

  const status = await fetchSpeedVersionStatus(song.id)
  if (status?.exists && Number.isFinite(status?.rate) && ratesMatch(status.rate, targetRate)) {
    return { variant: 'speed', rate: Number(status.rate) }
  }

  return { variant: 'original', rate: null }
}

async function getMediaUrlForVariant(song, variant) {
  const ytid = variant === 'speed' ? `${song.ytid}_speed` : song.ytid

  return window.electron2.getMediaUrl({
    folder: song.folder,
    ytid
  })
}

async function switchMediaVariant(variant, variantRate = null, doFade = true) {
  if (!player || !songFull.value?.id) return
  if (variant !== 'original' && variant !== 'speed') return

  const songSnapshot = { ...songFull.value }
  const now = typeof player.getCurrentTime === 'function' ? player.getCurrentTime() : 0
  const sourceScale = getCurrentMediaScale()
  const targetScale = variant === 'speed' ? Number(variantRate || 1) : 1
  const sourcePosition = Math.max(0, now * sourceScale)
  const targetTime = sourcePosition / Math.max(0.001, targetScale)
  const shouldPlay = getCurrentPlayableStates().includes(status.value)
  const currentVolume = baseVolume.value
  const mutedVolume = clamp(currentVolume * 0.35, 0.08, 1)
  debugAudio('switch-variant-start', {
    songId: songSnapshot?.id || null,
    from: currentMediaVariant.value,
    to: variant,
    fromTime: roundRate(now),
    targetTime: roundRate(targetTime),
    variantRate: variant === 'speed' ? roundRate(variantRate || 1) : 1
  })

  if (doFade) {
    await animateVolumeTo(mutedVolume, SPEED_SWITCH_FADE_OUT_MS)
  }

  pendingRestoreState = {
    time: targetTime,
    shouldPlay,
    speedAdded: speed_added.value,
    volume: doFade ? mutedVolume : currentVolume,
    fadeInTarget: doFade ? currentVolume : null
  }

  currentMediaVariant.value = variant
  processedSpeedRate.value = variant === 'speed' ? Number(variantRate || 1) : null
  if (variant === 'speed') {
    touchSpeedVersionUsage(songSnapshot?.id)
  }
  const mediaUrl = await getMediaUrlForVariant(songSnapshot, variant)
  player.load(mediaUrl)
  debugAudio('switch-variant-load', {
    songId: songSnapshot?.id || null,
    variant,
    rate: processedSpeedRate.value
  })
}

function clearPreprocessDebounce() {
  if (speedPreprocessDebounceId) {
    clearTimeout(speedPreprocessDebounceId)
    speedPreprocessDebounceId = null
  }
}

function scheduleSpeedPreprocess(options = {}) {
  const { immediate = false } = options
  clearPreprocessDebounce()
  if (immediate) {
    triggerSpeedPreprocess()

    return
  }
  speedPreprocessDebounceId = setTimeout(() => {
    speedPreprocessDebounceId = null
    triggerSpeedPreprocess()
  }, SPEED_PREPROCESS_DEBOUNCE_MS)
}

async function triggerSpeedPreprocess() {
  if (!songFull.value?.id) {
    isInitialSpeedPreprocessPending.value = false

    return
  }

  const songIdSnapshot = songFull.value.id
  const targetRate = getTargetPlaybackRate()
  if (ratesMatch(targetRate, 1)) {
    isInitialSpeedPreprocessPending.value = false

    return
  }

  preprocessRequestSerial += 1
  const requestSerial = preprocessRequestSerial
  isPreprocessingSpeed.value = true
  debugAudio('preprocess-start', {
    songId: songIdSnapshot,
    rate: roundRate(targetRate),
    requestSerial
  })

  try {
    await axios.post('http://localhost:3000/songs/preprocess-speed', {
      id: songIdSnapshot,
      rate: targetRate
    })
  } catch (error) {
    const errorData = error?.response?.data || null
    const errorStatus = error?.response?.status || null
    const payload = {
      songId: songIdSnapshot,
      rate: roundRate(targetRate),
      requestSerial,
      status: errorStatus,
      error: errorData
    }
    debugAudio('preprocess-failed', payload)
    if (AUDIO_DEBUG) {
      console.error('[vmusic][audio-debug][preprocess-failed-json]', JSON.stringify(payload))
    }
    isPreprocessingSpeed.value = false
    isInitialSpeedPreprocessPending.value = false

    return
  }

  if (!songFull.value?.id || songFull.value.id !== songIdSnapshot) {
    debugAudio('preprocess-discarded-song-changed', {
      songId: songIdSnapshot,
      requestSerial
    })
    isPreprocessingSpeed.value = false
    isInitialSpeedPreprocessPending.value = false

    return
  }
  if (requestSerial !== preprocessRequestSerial) {
    debugAudio('preprocess-discarded-stale-request', {
      songId: songIdSnapshot,
      requestSerial,
      latest: preprocessRequestSerial
    })
    isPreprocessingSpeed.value = false
    isInitialSpeedPreprocessPending.value = false

    return
  }

  const currentTargetRate = getTargetPlaybackRate()
  if (!ratesMatch(currentTargetRate, targetRate)) {
    debugAudio('preprocess-discarded-rate-mismatch', {
      songId: songIdSnapshot,
      completedRate: roundRate(targetRate),
      currentRate: roundRate(currentTargetRate)
    })
    isPreprocessingSpeed.value = false
    isInitialSpeedPreprocessPending.value = false

    return
  }
  if (currentMediaVariant.value === 'speed' && ratesMatch(processedSpeedRate.value, targetRate)) {
    debugAudio('preprocess-discarded-already-active', {
      songId: songIdSnapshot,
      rate: roundRate(targetRate)
    })
    isPreprocessingSpeed.value = false
    isInitialSpeedPreprocessPending.value = false

    return
  }

  debugAudio('preprocess-finished', {
    songId: songIdSnapshot,
    rate: roundRate(targetRate),
    requestSerial
  })

  if (getCurrentPlayableStates().includes(status.value)) {
    debugAudio('preprocess-ready-deferred-while-playing', {
      songId: songIdSnapshot,
      rate: roundRate(targetRate)
    })
    isPreprocessingSpeed.value = false
    isInitialSpeedPreprocessPending.value = false

    return
  }

  isPreprocessingSpeed.value = false
  isInitialSpeedPreprocessPending.value = false
  await switchMediaVariant('speed', targetRate, true)
}

async function setSong(s) {
  /*
   *  Create your own media element
   * Get this value from db
   */
  console.log('[vmusic][auto-cover] setSong entry', {
    id: s?.id || null,
    ytid: s?.ytid || null,
    name: s?.name || '',
    hasCoverUrl: Boolean(s?.coverUrl || s?.songImage || s?.cover || s?.image || s?.artwork)
  })
  songFull.value = s
  playCountIncremented = false
  status.value = props.statuses.Cargando
  hasManualEndMarker.value = hasExplicitEndMarker(s)
  fadeProfileRequestSerial += 1
  fadeProfile.value = { hasFade: false, fadeStartSec: null, confidence: 0 }
  forcedFadeEndAt = null
  start.value = s.start
  end.value = s.end
  songId.value = s.id
  applySongMetadata(s)
  try {
    const zoomStored = localStorage.getItem('vmusic_cover_zoom')
    const zoomParsed = zoomStored ? JSON.parse(zoomStored) : {}
    const ytid = s.ytid || s.song?.ytid || songFull.value?.ytid
    const raw = typeof zoomParsed[ytid] === 'number' ? zoomParsed[ytid] : 0
    coverZoom.value = Math.max(0, Math.min(10, raw))
  } catch {
    coverZoom.value = 0
  }
  speed.value = 1
  speed_added.value = normalizeSpeedOffset(s.speed)
  player.setPlaybackRate(1.0, true)
  applyVolume(1)
  clearPreprocessDebounce()
  preprocessRequestSerial += 1
  isPreprocessingSpeed.value = false
  isInitialSpeedPreprocessPending.value = false
  updateBaseSpeed()
  const initialRate = getTargetPlaybackRate()
  const initialVariant = await resolveInitialVariant(s, initialRate)
  currentMediaVariant.value = initialVariant.variant
  processedSpeedRate.value = initialVariant.rate
  if (initialVariant.variant === 'speed') {
    touchSpeedVersionUsage(s.id)
  }
  debugAudio('set-song', {
    songId: s.id,
    initialRate: roundRate(initialRate),
    selectedVariant: initialVariant.variant,
    selectedVariantRate: initialVariant.rate
  })
  const mediaUrl = await getMediaUrlForVariant(s, initialVariant.variant)
  player.load(mediaUrl)
  loadFadeProfile(s)

  if (initialVariant.variant !== 'speed' && !ratesMatch(initialRate, 1)) {
    isInitialSpeedPreprocessPending.value = true
    debugAudio('set-song-preprocess-miss', {
      songId: s.id,
      targetRate: roundRate(initialRate)
    })
    scheduleSpeedPreprocess({ immediate: true })
  }
}

function play() {
  safePlay()
}

function pause() {
  player.pause()
}

function stop() {
  player.stop()
}

/**
 * Destruye el WaveSurfer actual limpiando correctamente el mediaElement
 * del DOM para evitar elementos <audio> huérfanos que puedan interferir
 */
function destroyCurrentPlayer() {
  if (!player) return
  try {
    const mediaEl = typeof player.getMediaElement === 'function' ? player.getMediaElement() : null
    player.destroy()
    if (mediaEl && mediaEl.parentNode) {
      mediaEl.parentNode.removeChild(mediaEl)
    }
  } catch (e) {
    // Ignorar errores durante la destrucción
  }
}

function ejectDisc() {
  if (!canEject.value) return

  resetSongMetadata()
  clearPreprocessDebounce()
  preprocessRequestSerial += 1
  isPreprocessingSpeed.value = false
  isInitialSpeedPreprocessPending.value = false
  currentMediaVariant.value = 'original'
  processedSpeedRate.value = null
  fadeProfileRequestSerial += 1
  fadeProfile.value = { hasFade: false, fadeStartSec: null, confidence: 0 }
  waveformDuration.value = 0
  forcedFadeEndAt = null
  start.value = null
  end.value = null
  player.setPlaybackRate(1.0, true)
  speed_added.value = 0
  player.stop()
  destroyCurrentPlayer()
  init()
  wsRegions.clearRegions()
  status.value = props.statuses['Sin Carga']
  emit('stopped')
}

function restart() {
  if (!isReadyStatus()) return
  if (!player) return
  const restartAt = Number.isFinite(start.value) ? Math.max(0, toPlaybackTime(start.value)) : 0
  player.setTime(restartAt)
}

function seekBy(deltaSeconds) {
  if (!isReadyStatus()) return
  if (!player || !songFull.value?.id || typeof player.getCurrentTime !== 'function') return

  const now = player.getCurrentTime()
  const playbackStart = Number.isFinite(start.value) ? Math.max(0, toPlaybackTime(start.value)) : 0
  const playbackEnd = Number.isFinite(end.value)
    ? Math.max(playbackStart, toPlaybackTime(end.value))
    : Number.POSITIVE_INFINITY
  const requestedDelta = Number(deltaSeconds || 0)
  const maxForwardTime = Number.isFinite(playbackEnd)
    ? Math.max(playbackStart, playbackEnd - KEYBOARD_SEEK_FORWARD_END_GUARD_SECONDS)
    : playbackEnd
  const clampedMaxTime = requestedDelta > 0 ? maxForwardTime : playbackEnd
  const targetTime = clamp(now + requestedDelta, playbackStart, clampedMaxTime)

  player.setTime(targetTime)
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
  const targetRate = getTargetPlaybackRate()
  debugAudio('speed-change', {
    songId: songFull.value?.id || null,
    speedAdded: speed_added.value,
    targetRate: roundRate(targetRate),
    variant: currentMediaVariant.value,
    variantRate: processedSpeedRate.value
  })
  if (!ratesMatch(targetRate, 1)) {
    scheduleSpeedPreprocess()
  } else {
    clearPreprocessDebounce()
    isInitialSpeedPreprocessPending.value = false
  }
  emit('speed')
}

function applySpeed() {
  const total = getTargetPlaybackRate()
  speed.value = total

  const shouldUseNativeRate =
    currentMediaVariant.value !== 'speed' || !ratesMatch(processedSpeedRate.value, total)
  const playbackRate = shouldUseNativeRate ? total : 1
  player.setPlaybackRate(playbackRate, true)
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

  media.preservesPitch = true
  media.webkitPreservesPitch = true
  media.mozPreservesPitch = true
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
  const newVolume = baseVolume.value + val / 20

  applyVolume(parseFloat(newVolume))
}

function setPreviewDucking(active, multiplier = 0.2) {
  previewDuckMultiplier.value = active ? clamp(Number(multiplier) || 0.2, 0, 1) : 1
  applyVolume(baseVolume.value, { persistBase: false })
}

function setSinkId(sinkId) {
  if (!sinkId || sinkId === 'default' || !player || typeof player.setSinkId !== 'function') return
  try {
    const maybePromise = player.setSinkId(sinkId)
    if (maybePromise && typeof maybePromise.catch === 'function') {
      maybePromise.catch((error) => {
        console.warn('No se pudo cambiar la salida del deck', error)
      })
    }
  } catch (error) {
    console.warn('No se pudo cambiar la salida del deck', error)
  }
}

function getStoredCoverForSong(song) {
  if (!song) return ''

  const directCover =
    song.songImage || song.coverUrl || song.cover || song.image || song.artwork || ''
  if (directCover) return directCover

  try {
    const stored = localStorage.getItem('vmusic_cover_map')
    if (!stored || !song.ytid) return ''
    const parsed = JSON.parse(stored)

    return parsed[song.ytid] || ''
  } catch (error) {
    return ''
  }
}

function isRemoteCoverUrl(value) {
  try {
    const parsed = new URL(String(value || '').trim())

    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

async function cacheCoverInBackground(song, coverUrl) {
  const cacheKey = String(song?.ytid || '').trim()
  if (!cacheKey || !coverUrl || !isRemoteCoverUrl(coverUrl) || !window.electron2?.cacheCoverImage)
    return
  if (coverCacheRequests.has(cacheKey)) return

  console.debug('Descargando portada', { ytid: cacheKey, url: coverUrl })
  const request = window.electron2
    .cacheCoverImage({ cacheKey, url: coverUrl })
    .then((localUrl) => {
      if (!localUrl) return

      try {
        const stored = localStorage.getItem('vmusic_cover_map')
        const parsed = stored ? JSON.parse(stored) : {}
        parsed[cacheKey] = localUrl
        localStorage.setItem('vmusic_cover_map', JSON.stringify(parsed))
      } catch (error) {}

      if (songFull.value?.ytid === cacheKey) {
        songImage.value = localUrl
      }
    })
    .catch((error) => {
      console.warn('[vmusic][cover-cache] no se pudo cachear portada', error)
    })
    .finally(() => {
      coverCacheRequests.delete(cacheKey)
    })

  coverCacheRequests.set(cacheKey, request)
}

function isAutoUpdateCoversEnabled() {
  try {
    const settings = JSON.parse(localStorage.getItem('vmusic_settings')) || {}

    return Boolean(settings.autoUpdateCovers)
  } catch {
    return false
  }
}

function persistCoverUrl(songData, coverUrl) {
  const cacheKey = String(songData?.ytid || '').trim()
  if (!cacheKey || !coverUrl) return

  try {
    const stored = localStorage.getItem('vmusic_cover_map')
    const parsed = stored ? JSON.parse(stored) : {}
    parsed[cacheKey] = coverUrl
    localStorage.setItem('vmusic_cover_map', JSON.stringify(parsed))
  } catch (error) {}

  if (songFull.value?.ytid === cacheKey) {
    songImage.value = coverUrl
  }
}

async function resolveCoverFromSpotifySearch(songData) {
  if (!songData?.id || !songData?.ytid) return null
  if (!isAutoUpdateCoversEnabled()) {
    console.log('[vmusic][auto-cover] disabled', { songId: songData.id, ytid: songData.ytid })

    return null
  }

  const currentCover = getStoredCoverForSong(songData)
  if (currentCover) {
    console.log('[vmusic][auto-cover] already have cover', {
      songId: songData.id,
      ytid: songData.ytid,
      cover: currentCover
    })

    return currentCover
  }

  const artistNames = Array.isArray(songData.Artists)
    ? songData.Artists.map((artist) => artist?.name).filter(Boolean)
    : []
  const searchUrl = buildSpotifySearchUrl(songData.name, artistNames)
  if (!searchUrl) {
    console.log('[vmusic][auto-cover] empty search url', {
      songId: songData.id,
      ytid: songData.ytid,
      name: songData.name
    })

    return null
  }

  const requestKey = `${songData.ytid}:${searchUrl}`
  if (spotifyCoverRequests.has(requestKey)) {
    console.log('[vmusic][auto-cover] request deduped', { requestKey })

    return spotifyCoverRequests.get(requestKey)
  }

  const request = (async () => {
    if (!window.electron2?.resolveSpotifyCover) {
      console.log('[vmusic][auto-cover] ipc unavailable', { requestKey })

      return null
    }

    try {
      console.log('[vmusic][auto-cover] resolving via spotify', {
        songId: songData.id,
        ytid: songData.ytid,
        searchUrl
      })
      const spotifyResult = await window.electron2.resolveSpotifyCover({ searchUrl })
      const resolvedCoverUrl =
        typeof spotifyResult === 'string'
          ? spotifyResult
          : String(
              spotifyResult?.coverUrl ||
                spotifyResult?.imageUrl ||
                spotifyResult?.resolvedCoverUrl ||
                ''
            )
      console.log('[vmusic][auto-cover] spotify result', {
        requestKey,
        resolvedCoverUrl,
        spotifyResult
      })
      if (!resolvedCoverUrl) return null

      let finalCoverUrl = resolvedCoverUrl
      if (isRemoteCoverUrl(resolvedCoverUrl) && window.electron2?.cacheCoverImage) {
        try {
          const cachedCoverUrl = await window.electron2.cacheCoverImage({
            cacheKey: songData.ytid,
            url: resolvedCoverUrl,
            forceRefresh: true
          })
          if (cachedCoverUrl) {
            finalCoverUrl = cachedCoverUrl
          }
        } catch (error) {
          console.warn('[vmusic][auto-cover] no se pudo cachear la portada de Spotify', error)
        }
      }

      persistCoverUrl(songData, finalCoverUrl)
      console.log('[vmusic][auto-cover] cover persisted', { requestKey, finalCoverUrl })
      if (songFull.value?.id === songData.id) {
        emit('cover-updated', {
          id: songData.id,
          ytid: songData.ytid,
          coverUrl: finalCoverUrl
        })
      }

      return finalCoverUrl
    } catch (error) {
      console.warn('[vmusic][auto-cover] no se pudo resolver la portada de Spotify', error)

      return null
    }
  })().finally(() => {
    spotifyCoverRequests.delete(requestKey)
  })

  spotifyCoverRequests.set(requestKey, request)

  return request
}

function renderWaveRegions() {
  if (!wsRegions) return
  wsRegions.clearRegions()
  const totalDuration = Number(waveformDuration.value)
  if (!Number.isFinite(totalDuration) || totalDuration <= 0) return

  const playbackStart = toPlaybackTime(start.value)
  const playbackEnd = toPlaybackTime(end.value || toSourceTime(totalDuration))

  if (start.value && start.value !== 0) {
    wsRegions.addRegion({
      id: 'inicio',
      start: 0,
      end: playbackStart,
      color: regionColor.value,
      drag: false,
      resize: false
    })
  }

  if (end.value) {
    wsRegions.addRegion({
      id: 'final',
      start: playbackEnd,
      end: totalDuration,
      color: regionColor.value,
      drag: false,
      resize: false
    })
  }
}

function applySongMetadata(songData) {
  if (!songData) return

  songFull.value = {
    ...songFull.value,
    ...songData
  }

  // Actualizar marcadores de inicio/fin si vienen en los datos
  if (typeof songData.start === 'number') {
    start.value = songData.start
  }
  if (typeof songData.end === 'number') {
    end.value = songData.end
  }
  if (typeof songData.start === 'number' || typeof songData.end === 'number') {
    renderWaveRegions()
  }

  const coverProbe = {
    ytid: songFull.value?.ytid || null,
    songImage: songFull.value?.songImage || '',
    coverUrl: songFull.value?.coverUrl || '',
    cover: songFull.value?.cover || '',
    image: songFull.value?.image || '',
    artwork: songFull.value?.artwork || ''
  }
  console.log('[vmusic][auto-cover] apply metadata', coverProbe)
  song.value = songFull.value.name || ''
  artistsList.value = songFull.value.Artists || []
  artist.value = artistsList.value.map((i) => i.name).join(', ')
  primaryArtistId.value = artistsList.value?.[0]?.id || null
  composer.value = (songFull.value.Composers || []).map((i) => i.name).join(', ')

  try {
    const zoomStored = localStorage.getItem('vmusic_cover_zoom')
    const zoomParsed = zoomStored ? JSON.parse(zoomStored) : {}
    const raw = typeof zoomParsed[songFull.value.ytid] === 'number' ? zoomParsed[songFull.value.ytid] : 0
    coverZoom.value = Math.max(0, Math.min(10, raw))
  } catch {
    coverZoom.value = 0
  }

  const nextCover = getStoredCoverForSong(songFull.value)
  console.log('[vmusic][auto-cover] resolved current cover', {
    songId: songFull.value?.id,
    ytid: songFull.value?.ytid || null,
    nextCover: nextCover || ''
  })
  songImage.value = nextCover || ''
  if (nextCover) {
    cacheCoverInBackground(songFull.value, nextCover)

    return
  }

  void resolveCoverFromSpotifySearch(songFull.value)
}

function getThemeColor(varName, fallback) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(varName).trim()

  return value || fallback
}

function getCurrentWaveColor() {
  return getThemeColor(
    props.position === 'top' ? '--vm-player-wave-a' : '--vm-player-wave-b',
    props.position === 'top' ? '#EAB308' : '#EC4899'
  )
}

function getCurrentProgressColor() {
  const waveColor = getCurrentWaveColor()

  return `color-mix(in srgb, ${waveColor} 72%, black 28%)`
}

function forceWaveContainerFit() {
  const mount = document.getElementById(playerId.value)
  if (!mount) return
  mount.style.overflow = 'hidden'

  const waveHost = Array.from(mount.children).find((node) => node && node.shadowRoot)
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
  const cursorColor =
    status.value === props.statuses.Cambiando
      ? getThemeColor('--vm-player-crossfader-cursor', '#FF0000')
      : getThemeColor('--vm-player-cursor', '#FFFFFF')

  player.setOptions({
    waveColor,
    progressColor,
    cursorColor,
    barHeight: WAVEFORM_BAR_HEIGHT,
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
    volume: baseVolume.value
  }

  pendingRestoreState = restoreState

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

function refreshWaveform() {
  redrawWaveform()
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
  regionColor.value = 'rgba(255, 255, 255, 0.28)'
  fadeRegionColor.value = 'rgba(255, 255, 255, 0.28)'

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

watch(
  () => props.outputSinkId,
  (val) => {
    setSinkId(val)
  }
)

watch(status, () => {
  syncWaveColor()
})

window.addEventListener('vmusic-color-schema-changed', handleThemeChanged)

onBeforeUnmount(() => {
  window.removeEventListener('vmusic-color-schema-changed', handleThemeChanged)
  clearPreprocessDebounce()
  preprocessRequestSerial += 1
  isPreprocessingSpeed.value = false
  isInitialSpeedPreprocessPending.value = false
  volumeAnimationToken += 1
  fadeProfileRequestSerial += 1
  fadeProfile.value = { hasFade: false, fadeStartSec: null, confidence: 0 }
  forcedFadeEndAt = null
})

defineExpose({
  position: props.position,
  songId,
  status,
  left,
  songFull,
  songImage,
  tempFade,
  load,
  play,
  pause,
  stop,
  restart,
  seekBy,
  setSpeed,
  setSong,
  updateSongMetadata: applySongMetadata,
  resolveMissingCover: () => resolveCoverFromSpotifySearch(songFull.value),
  next,
  speed_added,
  baseSpeed,
  isPreprocessingSpeed,
  isInitialSpeedPreprocessPending,
  refreshBaseSpeed: () => {
    updateBaseSpeed()
    applySpeed()
  },
  getMediaElement: () => {
    if (player && typeof player.getMediaElement === 'function') {
      return player.getMediaElement()
    }

    return mediaElement
  },
  refreshWaveform,
  forceWaveformRebuild: hardRebuildWaveform,
  setSinkId,
  setPreviewDucking,
  ejectDisc
})
</script>

<style scoped>
.player-text {
  color: var(--vm-player-text);
}

.player-shell {
  flex: none;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 24px;
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

.player-fixed-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  row-gap: 12px;
}

.player-main {
  min-width: 0;
}

.player-header {
  min-width: 0;
}

.player-vinyl-column {
  display: flex;
  align-items: center;
  justify-content: center;
}

.player-vinyl-frame {
  position: relative;
  width: clamp(174px, 15.84vw, 242px);
  height: clamp(174px, 15.84vw, 242px);
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #000;
  background-position: center;
  background-repeat: no-repeat;
  background-size: contain;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.34);
  overflow: hidden;
}

.player-vinyl-playing {
  animation: vm-player-vinyl-spin 8s linear infinite;
}

.player-vinyl-ejectable {
  cursor: pointer;
}

.player-vinyl-ejectable:hover {
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.34), 0 0 0 2px rgba(255, 255, 255, 0.15);
}

.player-vinyl-eject-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3;
  opacity: 0;
  transition: opacity 0.15s ease;
  border-radius: 999px;
  pointer-events: none;
}

.player-vinyl-ejectable:hover .player-vinyl-eject-overlay {
  opacity: 1;
}

.player-vinyl-eject-icon {
  color: white;
  width: clamp(64px, 8vw, 96px);
  height: clamp(64px, 8vw, 96px);
  filter: drop-shadow(1px 0 0 black) drop-shadow(-1px 0 0 black)
    drop-shadow(0 1px 0 black) drop-shadow(0 -1px 0 black)
    drop-shadow(0 2px 6px rgba(0, 0, 0, 0.5));
}

.player-vinyl-cover-wrapper {
  position: absolute;
  top: 3%;
  left: 3%;
  width: 94%;
  height: 94%;
  border-radius: 999px;
  overflow: hidden;
  z-index: 1;
}

.player-vinyl-cover,
.player-vinyl-fallback {
  width: 100%;
  height: 100%;
}

.player-vinyl-cover {
  display: block;
  object-fit: cover;
  opacity: 0.9;
}

.player-vinyl-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: clamp(2.2rem, 3.2vw, 3rem);
  line-height: 1;
  text-transform: uppercase;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.08);
}

.player-vinyl-fallback.player-deck-a {
  background-color: color-mix(in srgb, var(--vm-player-wave-a) 70%, transparent);
}

.player-vinyl-fallback.player-deck-b {
  background-color: color-mix(in srgb, var(--vm-player-wave-b) 70%, transparent);
}

.player-vinyl-center {
  position: absolute;
  width: 28%;
  height: 28%;
  object-fit: contain;
  opacity: 0.3;
  z-index: 2;
  pointer-events: none;
}

.player-vinyl-center-no-cover {
  opacity: 0.75;
}

.player-layout-reverse .player-header {
  order: 2;
}

.player-layout-reverse .wavesurfer-fixed-height {
  order: 1;
}

.wavesurfer-fixed-height {
  flex: none !important;
  align-self: stretch;
  height: 132px !important;
  min-height: 132px !important;
  max-height: 132px !important;
}

.wavesurfer::part(scroll) {
  overflow-x: hidden !important;
  width: 100% !important;
  max-width: 100% !important;
  height: 100% !important;
  max-height: 100% !important;
}

.wavesurfer::part(wrapper) {
  width: 100% !important;
  max-width: 100% !important;
  height: 100% !important;
  max-height: 100% !important;
}

@keyframes vm-player-vinyl-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(-360deg);
  }
}

@media (max-width: 900px) {
  .player-shell {
    grid-template-columns: minmax(0, 1fr);
    justify-items: center;
  }

  .player-main {
    width: 100%;
  }
}
</style>
