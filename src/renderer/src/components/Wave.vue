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
import { computed, onBeforeMount, onMounted, ref } from 'vue'
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
        start.value = song.value.start ? song.value.start : 0
        end.value = song.value.end && song.value.end > 0 ? song.value.end : Math.round(d)

        wsRegions.addRegion({
          id: 'inicio',
          start: start.value,
          content: 'Inicio',
          color: '#FF1493FF'
        })
        wsRegions.addRegion({
          id: 'final',
          start: end.value - 0.3,
          content: 'Fin',
          color: '#FF1493FF'
        })
      })

      wsRegions.on('region-updated', (region) => {
        if (region.id === 'final') {
          end.value = region.start
        } else {
          start.value = region.start
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
</script>
