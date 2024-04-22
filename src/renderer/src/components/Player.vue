<script setup>
import { defineEmits, onBeforeMount, onMounted, ref } from "vue";
import WaveSurfer from 'wavesurfer.js'

let player = null
const duration = ref(0.0)
const songId = ref(null)
const song = ref('')
const artist = ref('')
const status = ref()
const playerId = ref('')
const volume = ref(1.0)
const left = ref(0)

onBeforeMount(() => {
  status.value = props.statuses['Sin Carga']
  playerId.value = 'w' + Math.random().toString(36).substring(2, 7)
})

onMounted(() => {
  player = WaveSurfer.create({
    normalize: true,
    container: '#' + playerId.value,
    cursorColor: '#ffffff'
  })

  if (props.position === 'top') {
    player.setOptions({
      waveColor: '#EAB308'
    })
  } else {
    player.setOptions({
      waveColor: '#EC4899'
    })
  }

  player.on('load', (url) => {
    player.toggleInteraction(false)
    status.value = props.statuses.Cargando
  })

  player.on('ready', (d) => {
    player.toggleInteraction(false)
    emit('loaded')
    duration.value = d
    status.value = props.statuses.Listo
  })

  player.on('play', () => {
    player.toggleInteraction(true)
    status.value = props.statuses.Reproduciendo
  })

  player.on('pause', () => {
    status.value = props.statuses.Pausado
  })

  player.on('finish', () => {
    player.toggleInteraction(false)
    artist.value = ''
    song.value = ''
    player.empty()
    player.stop()
    status.value = props.statuses['Sin Carga']
    emit('stopped')
  })

  player.on('timeupdate', (currentTime) => {
    if (
      status.value === props.statuses.Reproduciendo ||
      status.value === props.statuses.Cambiando ||
      status.value === props.statuses.Placa ||
      status.value === props.statuses.Nivelando
    ) {
      volume.value = player.getVolume()
      calculateVolume(currentTime)
    }
  })
})

function calculateVolume(ct) {
  left.value = duration.value - ct

  if (left.value > 8) {
    if (status.value !== props.statuses.Placa && status.value !== props.statuses.Nivelando) {
      player.setVolume(1.0)
    }
  } else {
    if (status.value === props.statuses.Reproduciendo) {
      player.toggleInteraction(false)
      status.value = props.statuses.Cambiando

      setTimeout(function() {
        emit('fading')
      }, 2500)
    }
    player.setVolume(left.value / 8)
  }
}

function tempFade(duration = 4000) {
  player.toggleInteraction(false)
  let vol = player.getVolume()

  if (vol > 0.4) {
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
  player.load(url)
}

function setSong(s) {
  songId.value = s.id
  song.value = s.name
  artist.value = s.Artists.map(i => i.name).join(', ')
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

const emit = defineEmits(['fading', 'stopped', 'loaded'])

const props = defineProps({
  position: String,
  statuses: {
    type: Object,
    required: true
  }
})

defineExpose({
  position: props.position,
  songId,
  status,
  left,
  tempFade,
  load,
  play,
  pause,
  stop,
  setSong
})
</script>

<template>
  <div :class="{'flex-col-reverse': props.position === 'top'}" class="player p-6 flex flex-col">
    <div class="flex items-center space-x-3">
      <div
        :class="{'bg-pink-500': props.position === 'bottom', 'bg-yellow-500': props.position === 'top' }"
        class="flex text-[70px] text-white text-bold text-center h-[80px] w-[80px] items-center justify-center">
        <span v-if="props.position === 'top'">A</span>
        <span v-if="props.position === 'bottom'">B</span>
      </div>
      <div>
        <h2 class="text-white text-xl">{{ artist || 'Sin artista' }}</h2>
        <h1 class="text-white text-3xl">{{ song || 'Sin canción' }}</h1>
        <div class="text-sm text-gray-500">
          <span>Status: {{ getStatusName(status) }}</span>
          <span v-if="(status === props.statuses.Nivelando || status === props.statuses.Placa || status === props.statuses.Cambiando)"> ({{ Math.round(volume * 100) }})</span>
        </div>
      </div>
    </div>
    <div :id="playerId" class="wavesurfer mb-3"></div>
  </div>
</template>
