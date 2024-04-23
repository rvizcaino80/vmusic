<script setup>
import { computed, onBeforeMount, onMounted, ref } from 'vue'
import WaveSurfer from 'wavesurfer.js'
import { Icon } from '@iconify/vue'

let player = null
const duration = ref(0.0)
const songId = ref(null)
const song = ref('')
const artist = ref('')
const status = ref()
const playerId = ref('')
const volume = ref(1.0)
const speed = ref(1.0)
const left = ref(0)
const speed_added = ref(0.0)
const volume_added = ref(0.0)

onBeforeMount(() => {
  status.value = props.statuses['Sin Carga']
  playerId.value = 'w' + Math.random().toString(36).substring(2, 7)
})

onMounted(() => {
  player = WaveSurfer.create({
    height: 200,
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

  player.on('load', () => {
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
    //Get this value from db
    player.setPlaybackRate(1.0)
    speed_added.value = 0

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

      setTimeout(function () {
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
    setTimeout(function () {
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
  //Get this value from db
  player.setPlaybackRate(1.0)
  speed_added.value = 0
  songId.value = s.id
  song.value = s.name
  artist.value = s.Artists.map((i) => i.name).join(', ')
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

function setSpeed(val) {
  speed_added.value = speed_added.value + val
  const newSpeed = speed.value + val / 100
  speed.value = parseFloat(newSpeed)
  player.setPlaybackRate(speed.value)
}

function setVolume(val) {
  volume_added.value = volume_added.value + val
  const newVolume = volume.value + val / 20
  console.log(newVolume)

  volume.value = parseFloat(newVolume)
  player.setVolume(volume.value)
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
  <div :class="{ 'flex-col-reverse': props.position === 'top' }" class="player p-6 flex flex-col">
    <div
      :class="{ 'items-end': props.position === 'top', 'items-start': props.position === 'bottom' }"
      class="flex justify-between space-x-3"
    >
      <div class="flex space-x-3">
        <div
          :class="{
            'bg-pink-500': props.position === 'bottom',
            'bg-yellow-500': props.position === 'top'
          }"
          class="flex text-[70px] text-white text-bold text-center h-[80px] w-[80px] items-center justify-center"
        >
          <span class="select-none" v-if="props.position === 'top'">A</span>
          <span class="select-none" v-if="props.position === 'bottom'">B</span>
        </div>
        <div>
          <h2 class="text-white text-xl select-none">{{ artist || 'Sin artista' }}</h2>
          <h1 class="text-white text-2xl select-none">{{ song || 'Sin canción' }}</h1>
          <div class="text-sm text-gray-500 select-none">
            <span>Status: {{ getStatusName(status) }}</span>
            <span
              v-if="
                status === props.statuses.Nivelando ||
                status === props.statuses.Placa ||
                status === props.statuses.Cambiando
              "
            >
              ({{ Math.round(volume * 100) }})</span
            >
          </div>
        </div>
      </div>

      <div class="flex flex-col items-center text-gray-500">
        <!--div class="flex flex-col items-center mb-2">
          <span class="text-xs leading-none mb-0.5 select-none">Volumen</span>
          <div class="flex items-center space-x-1">
            <Icon
              class="cursor-pointer w-4 h-4 text-white"
              icon="teenyicons:left-solid"
              @click="setVolume(-1)"
            />
            <span
              v-if="volume_added > 0"
              class="text-white font-bold text-sm leading-none select-none"
              >+</span
            >
            <span class="text-white font-bold text-sm leading-none select-none">
              {{ volume_added }}
            </span>
            <Icon
              class="cursor-pointer w-4 h-4 text-white"
              icon="teenyicons:right-solid"
              @click="setVolume(1)"
            />
          </div>
        </div-->

        <div class="flex flex-col items-center">
          <span class="text-sm mb-0.5 select-none">Velocidad</span>
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
        </div>
      </div>
    </div>
    <div
      v-show="status !== props.statuses['Sin Carga']"
      :id="playerId"
      :class="{ 'mb-3': props.position === 'top', 'mt-3': props.position === 'bottom' }"
      class="wavesurfer"
    ></div>
  </div>
</template>
