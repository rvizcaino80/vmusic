<template>
  <div class="flex flex-col justify-center min-h-0 flex-1">
    <div
      id="wave"
      class="wavesurfer h-[620px] mb-10"
    />

    <div class="flex items-start justify-between">
      <div class="space-x-3 flex items-center w-[300px]">
        <Icon
          class="w-8 h-8 cursor-pointer"
          icon="mdi:zoom-out-outline"
          @click="sliderMinus"
        />
        <a-slider
          v-model:value="sliderValue"
          class="flex-1"
          :min="0"
          :max="30"
          @change="onZoomChange"
        />
        <Icon
          class="w-8 h-8 cursor-pointer"
          icon="mdi:zoom-in-outline"
          @click="sliderPlus"
        />
      </div>

      <div class="flex-1 mx-auto text-center">
        <button
          v-if="isPlaying"
          type="button"
          class="disabled:opacity-30 disabled:cursor-default cursor-pointer rounded-full bg-gray-800 p-2"
          @click="pause()"
        >
          <Icon
            class="w-5 h-5 text-white"
            icon="material-symbols:pause"
          />
        </button>

        <button
          v-else
          type="button"
          class="disabled:opacity-30 disabled:cursor-default cursor-pointer rounded-full bg-gray-800 p-2"
          @click="play()"
        >
          <Icon
            class="w-5 h-5 text-white"
            icon="mdi:play"
          />
        </button>
      </div>

      <div class="flex items-center space-x-3 justify-center">
        <a-button
          size="large"
          type="primary"
          @click="save"
        >
          Guardar
        </a-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import WaveSurfer from 'wavesurfer.js'
import { Icon } from '@iconify/vue'
import axios from 'axios'
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js'

let player = null
let isPlaying = ref(false)
const song = ref({})
const start = ref(0)
const end = ref(0)
const duration = ref(0)

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

onMounted(() => {
  axios
    .get('http://localhost:3000/songs/' + props.id)
    .then(function(response) {
      song.value = response.data

      player = WaveSurfer.create({
        normalize: true,
        container: '#wave',
        cursorColor: '#00000000',
        height: 600,
        waveColor: '#4B5563FF',
        progressColor: '#6B7280FF',
        cursorWidth: 2,
        hideScrollbar: false,
        autoScroll: true,
        autoCenter: true,
        minPxPerSec: 30
      })

      const wsRegions = player.registerPlugin(RegionsPlugin.create())

      player.on('decode', (d) => {
        duration.value = d
        const maxPoint = Math.max(0, d - 0.01)
        const rawStart = typeof song.value.start === 'number' ? song.value.start : 0
        const defaultEnd = d > 0 ? d : 0
        const rawEnd = song.value.end && song.value.end > 0 ? song.value.end : defaultEnd

        start.value = clamp(rawStart, 0, maxPoint)
        end.value = clamp(rawEnd, start.value + 0.01, d)
        const finalMarker = clamp(end.value - 0.3, 0, maxPoint)

        wsRegions.addRegion({
          id: 'inicio',
          start: start.value,
          content: 'Inicio',
          color: '#FF1493FF'
        })
        wsRegions.addRegion({
          id: 'final',
          start: finalMarker,
          content: 'Fin',
          color: '#FF1493FF'
        })
      })

      wsRegions.on('region-updated', (region) => {
        const maxPoint = Math.max(0, duration.value - 0.01)
        if (region.id === 'final') {
          end.value = clamp(region.start, start.value + 0.01, duration.value)
        } else {
          start.value = clamp(region.start, 0, Math.min(maxPoint, end.value - 0.01))
        }
      })

      player.on('play', () => {
        isPlaying.value = true
      })

      player.on('pause', () => {
        isPlaying.value = false
      })

      player.on('load', () => {
        player.toggleInteraction(false)
      })

      player.on('ready', (d) => {
        player.toggleInteraction(true)
        applySinkId(props.previewSinkId)
      })

      player.on('timeupdate', (currentTime) => {
        if (currentTime >= end.value) {
          player.pause()
        }
      })

      player.setPlaybackRate(1.0)
      player.setVolume(1)
      player.load('http://localhost:3000/static/' + song.value.folder + '/' + song.value.ytid + '.mp3')
    })
    .catch(function(error) {
      console.log(error)
    })
    .finally(function() {
      // always executed
    })
})

const emit = defineEmits(['wave-updated'])
const sliderValue = ref(30)

const props = defineProps({
  id: {
    type: Number,
    required: true
  },
  previewSinkId: {
    type: String,
    required: false,
    default: null
  }
})

function pause() {
  player.pause()
}

function play() {
  player.play()
}

function save() {
  emit('wave-updated', { start: start.value, end: end.value })
  player.toggleInteraction(false)
}

function sliderMinus() {
  if (sliderValue.value > 0) {
    sliderValue.value = sliderValue.value - 5
  }

  player.setOptions({
    minPxPerSec: sliderValue.value
  })
}

function sliderPlus() {
  if (sliderValue.value < 30) {
    sliderValue.value = sliderValue.value + 5
  }

  player.setOptions({
    minPxPerSec: sliderValue.value
  })
}

function onZoomChange(z) {
  player.setOptions({
    minPxPerSec: z
  })
}

async function applySinkId(sinkId) {
  if (!sinkId || sinkId === 'default' || !player || typeof player.setSinkId !== 'function') return
  try {
    await player.setSinkId(sinkId)
  } catch (error) {
    console.warn('No se pudo cambiar la salida de la onda', error)
  }
}

watch(() => props.previewSinkId, (val) => {
  applySinkId(val)
})

onBeforeUnmount(() => {
  if (player) {
    player.destroy()
    player = null
  }
})
</script>
