<template>
  <div
    :class="{
      'flex-col-reverse': props.position === 'top'
    }"
    class="justify-end player p-6 flex flex-col flex-1 max-h-[550px] min-w-0"
  >
    <div class="flex justify-between space-x-3">
      <div class="flex space-x-3 flex-1 min-w-0">
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
        <div class="flex-1 min-w-0">
          <h2 class="text-white text-xl select-none w-full truncate">
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
          <div class="flex items-center space-x-2 w-full min-w-0">
            <h1 class="text-white text-2xl select-none flex-1 min-w-0 truncate">
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
            <span v-if="status !== props.statuses['Sin Carga'] && finalModeLabel !== 'Exacto'"> | Final: {{ finalModeLabel }}</span>
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
import { Icon } from '@iconify/vue'
import * as cheerio from 'cheerio'
import axios from 'axios'

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
const hasManualEndMarker = ref(false)
const fadeProfile = ref({ hasFade: false, fadeStartSec: null, confidence: 0 })
let fadeProfileRequestSerial = 0
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
let forcedFadeEndAt = null
const regionColor = ref('rgba(255, 255, 255, 0.28)')
const fadeRegionColor = ref('rgba(255, 255, 255, 0.28)')
const waveformDuration = ref(0)
const savedSettings = JSON.parse(localStorage.getItem('vmusic_settings'))

const baseSpeedLabel = computed(() => {
  const value = baseSpeed.value || 0
  const sign = value > 0 ? '+' : ''

  return `${sign}${value}`
})

const canPreview = computed(() => status.value !== props.statuses.Reproduciendo && Boolean(songFull.value?.id))
const MIN_SPEED_OFFSET = -50
const MAX_SPEED_OFFSET = 50
const AUDIO_DEBUG = import.meta.env.DEV
const SPEED_PREPROCESS_DEBOUNCE_MS = 3200
const SPEED_SWITCH_FADE_OUT_MS = 90
const SPEED_SWITCH_FADE_IN_MS = 140

const currentMediaVariant = ref('original')
const processedSpeedRate = ref(null)
let speedPreprocessDebounceId = null
let preprocessRequestSerial = 0
let volumeAnimationToken = 0
const isPreprocessingSpeed = ref(false)
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

  const renderWaveRegions = () => {
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

    if (!hasManualEndMarker.value && fadeProfile.value?.hasFade && Number.isFinite(fadeProfile.value?.fadeStartSec)) {
      const fadeStartPlayback = Math.max(0, toPlaybackTime(fadeProfile.value.fadeStartSec))
      const fadeEndPlayback = Math.max(fadeStartPlayback, playbackEnd || totalDuration)
      if (fadeEndPlayback - fadeStartPlayback > 0.05) {
        wsRegions.addRegion({
          id: 'fade-detected',
          start: fadeStartPlayback,
          end: fadeEndPlayback,
          color: fadeRegionColor.value,
          drag: false,
          resize: false
        })
      }
    }
  }

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

  player.on('load', () => {
    applyPreservePitch()
    songImage.value = ''
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
        player.setVolume(restore.volume)
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
  currentMediaVariant.value = 'original'
  processedSpeedRate.value = null
  fadeProfileRequestSerial += 1
  fadeProfile.value = { hasFade: false, fadeStartSec: null, confidence: 0 }
  waveformDuration.value = 0
  forcedFadeEndAt = null
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
  const playbackEnd = toPlaybackTime(end.value)
  left.value = playbackEnd - ct
  const canDetectNaturalFade = status.value === props.statuses.Reproduciendo && !hasManualEndMarker.value
  const realFadeDetected = canDetectNaturalFade && shouldTriggerBackendFade(ct, crossfader_time)
  const hasForcedFade = Number.isFinite(forcedFadeEndAt)

  if (realFadeDetected && !hasForcedFade && status.value === props.statuses.Reproduciendo) {
    forcedFadeEndAt = ct + Math.max(0.1, Number(crossfader_time || 0))
  }

  const forcedFadeFinished = Number.isFinite(forcedFadeEndAt) && ct >= forcedFadeEndAt
  if (status.value === props.statuses.Cambiando && (forcedFadeFinished || (!Number.isFinite(forcedFadeEndAt) && ct > playbackEnd))) {
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
    player.destroy()
    init()
    wsRegions.clearRegions()
    status.value = props.statuses['Sin Carga']
    emit('stopped')
  } else {
    const shouldStartCrossfade = Number.isFinite(forcedFadeEndAt) || left.value <= crossfader_time
    if (!shouldStartCrossfade) {
      if (status.value !== props.statuses.Placa && status.value !== props.statuses.Nivelando) {
        player.setVolume(1.0)
      }
    } else {
      if (status.value === props.statuses.Reproduciendo) {
        player.toggleInteraction(false)
        status.value = props.statuses.Cambiando

        player.setOptions(crossfaderOptions)
        emit('fading')
      }
      const forcedRemaining = Number.isFinite(forcedFadeEndAt) ? (forcedFadeEndAt - ct) : left.value
      player.setVolume(clamp(forcedRemaining / Math.max(0.1, crossfader_time), 0, 1))
    }
  }
}

function tempFade(duration = 3000) {
  player.toggleInteraction(false)
  let vol = player.getVolume()

  if (vol > 0.6) {
    player.setVolume(vol - 0.1)
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
  const totalOffset = normalizeSpeedOffset(speed_added.value) + normalizeSpeedOffset(baseSpeed.value)
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

  return endValue < (durationValue - 0.25)
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
    const response = await window.electron2.backendRequest({
      method: 'GET',
      path: `/songs/fade-profile/${song.id}`
    })
    if (requestSerial !== fadeProfileRequestSerial) return
    if (!songFull.value?.id || songFull.value.id !== song.id) return
    if (Number(response?.status || 500) >= 400) {
      fadeProfile.value = { hasFade: false, fadeStartSec: null, confidence: 0 }
      debugAudio('fade-profile-miss', {
        songId: song.id,
        status: Number(response?.status || 500),
        data: response?.data || null
      })

      return
    }
    const data = response?.data || {}
    const rawFadeStartSec = data?.fadeStartSec
    const parsedFadeStartSec = (
      rawFadeStartSec === null || rawFadeStartSec === undefined || rawFadeStartSec === ''
    )
? null
: (Number.isFinite(Number(rawFadeStartSec)) ? Number(rawFadeStartSec) : null)
    fadeProfile.value = {
      hasFade: Boolean(data.hasFade),
      fadeStartSec: parsedFadeStartSec,
      confidence: Number.isFinite(Number(data.confidence)) ? Number(data.confidence) : 0
    }
    if (wsRegions && Number.isFinite(waveformDuration.value) && waveformDuration.value > 0) {
      const totalDuration = Number(waveformDuration.value)
      const playbackStart = toPlaybackTime(start.value)
      const playbackEnd = toPlaybackTime(end.value || toSourceTime(totalDuration))
      wsRegions.clearRegions()
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
      if (!hasManualEndMarker.value && fadeProfile.value?.hasFade && Number.isFinite(fadeProfile.value?.fadeStartSec)) {
        const fadeStartPlayback = Math.max(0, toPlaybackTime(fadeProfile.value.fadeStartSec))
        const fadeEndPlayback = Math.max(fadeStartPlayback, playbackEnd || totalDuration)
        if (fadeEndPlayback - fadeStartPlayback > 0.05) {
          wsRegions.addRegion({
            id: 'fade-detected',
            start: fadeStartPlayback,
            end: fadeEndPlayback,
            color: fadeRegionColor.value,
            drag: false,
            resize: false
          })
        }
      }
    }

    debugAudio('fade-profile-loaded', {
      songId: song.id,
      song: song.name || '',
      hasFade: fadeProfile.value.hasFade,
      fadeStartSec: fadeProfile.value.fadeStartSec,
      confidence: fadeProfile.value.confidence
    })
  } catch (error) {
    if (requestSerial !== fadeProfileRequestSerial) return
    fadeProfile.value = { hasFade: false, fadeStartSec: null, confidence: 0 }
    debugAudio('fade-profile-error', {
      songId: song.id,
      error: String(error?.message || error)
    })
  }
}

function shouldTriggerBackendFade(playbackCurrentTime, crossfaderTime) {
  if (!songFull.value?.id) return false
  if (!Number.isFinite(playbackCurrentTime)) return false
  if (hasManualEndMarker.value) return false
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

function animateVolumeTo(targetVolume, durationMs) {
  if (!player || typeof player.getVolume !== 'function' || typeof player.setVolume !== 'function') {
    return Promise.resolve()
  }

  const from = clamp(Number(player.getVolume()), 0, 1)
  const to = clamp(Number(targetVolume), 0, 1)
  if (durationMs <= 0 || Math.abs(from - to) < 0.001) {
    player.setVolume(to)

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
      player.setVolume(clamp(vol, 0, 1))

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
  const currentVolume = typeof player.getVolume === 'function' ? player.getVolume() : volume.value
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

function scheduleSpeedPreprocess() {
  clearPreprocessDebounce()
  speedPreprocessDebounceId = setTimeout(() => {
    speedPreprocessDebounceId = null
    triggerSpeedPreprocess()
  }, SPEED_PREPROCESS_DEBOUNCE_MS)
}

async function triggerSpeedPreprocess() {
  if (!songFull.value?.id) return

  const songIdSnapshot = songFull.value.id
  const targetRate = getTargetPlaybackRate()
  if (ratesMatch(targetRate, 1)) return

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

    return
  }

  if (!songFull.value?.id || songFull.value.id !== songIdSnapshot) {
    debugAudio('preprocess-discarded-song-changed', {
      songId: songIdSnapshot,
      requestSerial
    })
    isPreprocessingSpeed.value = false

    return
  }
  if (requestSerial !== preprocessRequestSerial) {
    debugAudio('preprocess-discarded-stale-request', {
      songId: songIdSnapshot,
      requestSerial,
      latest: preprocessRequestSerial
    })
    isPreprocessingSpeed.value = false

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

    return
  }
  if (currentMediaVariant.value === 'speed' && ratesMatch(processedSpeedRate.value, targetRate)) {
    debugAudio('preprocess-discarded-already-active', {
      songId: songIdSnapshot,
      rate: roundRate(targetRate)
    })
    isPreprocessingSpeed.value = false

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

    return
  }

  isPreprocessingSpeed.value = false
  await switchMediaVariant('speed', targetRate, true)
}

async function setSong(s) {
  /*
   *  Create your own media element
   * Get this value from db
   */
  songFull.value = s
  hasManualEndMarker.value = hasExplicitEndMarker(s)
  fadeProfileRequestSerial += 1
  fadeProfile.value = { hasFade: false, fadeStartSec: null, confidence: 0 }
  forcedFadeEndAt = null
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
  player.setPlaybackRate(1.0, true)
  player.setVolume(1)
  clearPreprocessDebounce()
  preprocessRequestSerial += 1
  isPreprocessingSpeed.value = false
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
    debugAudio('set-song-preprocess-miss', {
      songId: s.id,
      targetRate: roundRate(initialRate)
    })
    scheduleSpeedPreprocess()
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

function restart() {
  if (!player) return
  const restartAt = Number.isFinite(start.value) ? Math.max(0, toPlaybackTime(start.value)) : 0
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
  }
  emit('speed')
}

function applySpeed() {
  const total = getTargetPlaybackRate()
  speed.value = total

  const shouldUseNativeRate = currentMediaVariant.value !== 'speed' || !ratesMatch(processedSpeedRate.value, total)
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
  const newVolume = volume.value + val / 20

  volume.value = parseFloat(newVolume)
  player.setVolume(volume.value)
}

function setSinkId(sinkId) {
  if (!sinkId || sinkId === 'default' || !player || typeof player.setSinkId !== 'function') return
  try {
    player.setSinkId(sinkId)
  } catch (error) {
    console.warn('No se pudo cambiar la salida del deck', error)
  }
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
  clearPreprocessDebounce()
  preprocessRequestSerial += 1
  isPreprocessingSpeed.value = false
  volumeAnimationToken += 1
  fadeProfileRequestSerial += 1
  fadeProfile.value = { hasFade: false, fadeStartSec: null, confidence: 0 }
  forcedFadeEndAt = null
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
