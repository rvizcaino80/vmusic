<template>
  <div
    :class="{
      'flex-col-reverse': props.position === 'top'
    }"
    class="justify-end player p-6 flex flex-col flex-1 max-h-[550px]"
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
              {{ song || 'Sin canción'
              }}
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
          <div class="text-sm text-gray-500 select-none">
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
      class="wavesurfer flex-1"
    />
  </div>
</template>

<script setup>
import { onBeforeMount, onMounted, onBeforeUnmount, ref, watch, computed } from 'vue'
import WaveSurfer from 'wavesurfer.js'
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js'
import { Icon } from '@iconify/vue'
import * as cheerio from 'cheerio'

const emit = defineEmits(['fading', 'stopped', 'loaded', 'speed', 'artist-click', 'preview-start', 'preview-stop'])

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
const regionColor = ref('rgba(114,0,0,0.64)')
const savedSettings = JSON.parse(localStorage.getItem('vmusic_settings'))

const baseSpeedLabel = computed(() => {
  const value = baseSpeed.value || 0
  const sign = value > 0 ? '+' : ''

  return `${sign}${value}`
})

const canPreview = computed(() => status.value !== props.statuses.Reproduciendo && Boolean(songFull.value?.id))

onBeforeMount(() => {
  status.value = props.statuses['Sin Carga']
  playerId.value = 'w' + Math.random().toString(36)
    .substring(2, 7)
})

onMounted(() => {
  updateBaseSpeed()
  init()
})

function init() {
  const waveColor = getCurrentWaveColor()
  const cursorColor = getThemeColor('--vm-player-cursor', '#FFFFFF')
  const crossfaderCursorColor = getThemeColor('--vm-player-crossfader-cursor', '#FF0000')
  regionColor.value = getThemeColor('--vm-player-region', 'rgba(114,0,0,0.64)')

  originalOptions = {
    normalize: true,
    container: '#' + playerId.value,
    cursorColor,
    height: 'auto',
    fillParent: true,
    waveColor
  }

  crossfaderOptions = {
    normalize: true,
    container: '#' + playerId.value,
    cursorColor: crossfaderCursorColor,
    height: 'auto',
    fillParent: true,
    waveColor
  }

  player = WaveSurfer.create(originalOptions)

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
    songImage.value = ''
    wsRegions.clearRegions()
    player.toggleInteraction(false)
    status.value = props.statuses.Cargando
    player.seekTo(0)
  })

  player.on('ready', (d) => {
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
  })

  player.on('play', () => {
    player.toggleInteraction(true)
    status.value = props.statuses.Reproduciendo
  })

  player.on('pause', () => {
    status.value = props.statuses.Pausado
  })

  player.on('finish', () => {
    resetSongMetadata()
    player.setPlaybackRate(1.0)
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
  emit('fading')
}

function calculateVolume(ct) {
  const crossfader_time = savedSettings.crossfaderTime
  left.value = end.value - ct

  if (status.value === props.statuses.Cambiando && ct > end.value) {
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
    if (left.value > crossfader_time) {
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
      player.setVolume(left.value / crossfader_time)
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
}

function setSong(s) {
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
  speed_added.value = s.speed
  artistsList.value = s.Artists || []
  artist.value = artistsList.value.map((i) => i.name).join(', ')
  primaryArtistId.value = artistsList.value?.[0]?.id || null
  composer.value = s.Composers.map((i) => i.name).join(', ')
  player.setPlaybackRate(1.0)
  player.setVolume(1)
  player.load('http://localhost:3000/static/' + s.folder + '/' + s.ytid + '.mp3')
}

function play() {
  player.play()
}

function pause() {
  player.pause()
}

function stop() {
  player.stop()
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
  speed_added.value = val || 0
  applySpeed()
}

function setSpeed(val) {
  speed_added.value = speed_added.value + val
  applySpeed()
  emit('speed')
}

function applySpeed() {
  const total = 1 + (speed_added.value + baseSpeed.value) / 100
  speed.value = parseFloat(total)
  player.setPlaybackRate(speed.value)
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
  const activeSchema = document.documentElement.getAttribute('data-color-schema')
  if (activeSchema === 'monochrome' && status.value === props.statuses.Reproduciendo) {
    return '#FFFFFF'
  }

  return getThemeColor(props.position === 'top' ? '--vm-player-wave-a' : '--vm-player-wave-b', props.position === 'top' ? '#EAB308' : '#EC4899')
}

function syncWaveColor() {
  if (!player) return
  const waveColor = getCurrentWaveColor()
  player.setOptions({ waveColor })
  crossfaderOptions = {
    ...crossfaderOptions,
    waveColor
  }
  originalOptions = {
    ...originalOptions,
    waveColor
  }
}

function handleThemeChanged() {
  if (!player) return
  const waveColor = getCurrentWaveColor()
  const cursorColor = getThemeColor('--vm-player-cursor', '#FFFFFF')
  const crossfaderCursorColor = getThemeColor('--vm-player-crossfader-cursor', '#FF0000')
  regionColor.value = getThemeColor('--vm-player-region', 'rgba(114,0,0,0.64)')

  player.setOptions({
    waveColor,
    cursorColor
  })
  crossfaderOptions = {
    ...crossfaderOptions,
    waveColor,
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
  setSong,
  next,
  speed_added,
  baseSpeed,
  refreshBaseSpeed: () => {
    updateBaseSpeed()
    applySpeed()
  },
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
</style>
