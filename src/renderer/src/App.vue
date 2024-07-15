<script setup>
import axios from 'axios'
import { onMounted, computed, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import hotkeys from 'hotkeys-js'
import { version } from '../../../package.json'
import dayjs from 'dayjs'

/* Components */
import ContextMenu from './components/ContextMenu.vue'
import Artists from './components/Artists.vue'
import Tags from './components/Tags.vue'
import Player from './components/Player.vue'
import Download from './components/Download.vue'
import Edit from './components/Edit.vue'
import Wave from './components/Wave.vue'
import Multiselect from './components/Multiselect.vue'

let options = {
  library: 10,
  download: 20,
  downloadDetails: 25,
  tags: 30,
  settings: 40,
  artists: 50,
  edit: 60,
  wave: 70
}

const playerStatuses = {
  'Sin Carga': 10,
  Cargando: 20,
  Listo: 30,
  Reproduciendo: 40,
  Pausado: 50,
  Cambiando: 60,
  Detenido: 70,
  Placa: 80,
  Nivelando: 90
}

let currentSelectedOption = ref(null)

// Library
const artists = ref([])
const filteredArtists = ref([])
const songs = ref([])
const filteredSongs = ref([])
const selectedTags = ref([0])
const selectedArtists = ref([0])
const selectedSongs = ref([])
const filterQuery = ref('')
const deletedSongs = ref([])

// Tags
const tags = ref([])

//Playlist
const history = ref([])
const tagHistory = ref([])
const playlist = ref([])
const playlistDetails = ref([])
const currentMode = ref(0)
const selectedRows = ref([])

//Players
const player1 = ref(null)
const player2 = ref(null)
const isFirstPlay = ref(true)

//Multiselects
const artistMultiSelect = ref(null)
const tagMultiSelect = ref(null)

onMounted(() => {
  setInterval(function() {
    console.log('here')
    document.getElementById('logo').classList.add('jello-horizontal')
    setTimeout(function() {
      document.getElementById('logo').classList.remove('jello-horizontal')
    }, 1000)
  }, 10000)
  hotkeys('space', function (event, handler) {
    event.preventDefault()
    playPlaca()
  })
})

const removeAccents = (str) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '')

watch(filterQuery, (newValue, oldValue) => {
  filteredSongs.value = songs.value.filter((item) => {
    return (
      removeAccents(item.name.toLowerCase()).includes(removeAccents(newValue.toLowerCase())) ||
      removeAccents(
        item.Artists.map((a) => a.name)
          .join('')
          .toLowerCase()
      ).includes(removeAccents(newValue.toLowerCase()))
    )
  })
})

watch(selectedArtists, (newValue, oldValue) => {
  filterSongsByArtist()
})

watch(selectedTags, (newValue, oldValue) => {
  filterSongs()
})

const timeLeft = computed(() => {
  const a = dayjs()
  let left = 0
  let left0 = 0
  let left1 = 0
  let left2 = 0

  if (playlistDetails.value.length > 0) {
    left0 = playlistDetails.value.reduce((n, { duration }) => n + duration, 0)
  }

  if (player1.value && player1.value.left && player1.value.status !== playerStatuses['Sin Carga']) {
    left1 = player1.value.left
  }

  if (player2.value && player2.value.left && player2.value.status !== playerStatuses['Sin Carga']) {
    left2 = player2.value.left
  }

  left = left0 + left1 + left2

  const b = a.add(left, 'second')
  const dayDiff = b.diff(a, 'day')
  return [left, b.format('hh:mm A'), dayDiff]
})

function playPlaca() {
  const audio = document.querySelector('#placa')
  audio.volume = 0.6

  if (player1.value.status === playerStatuses.Reproduciendo) {
    player1.value.status = playerStatuses.Placa
    player1.value.tempFade()
  } else if (player2.value.status === playerStatuses.Reproduciendo) {
    player2.value.status = playerStatuses.Placa
    player2.value.tempFade()
  }

  audio.play()
}

function remove(array, element) {
  const index = array.findIndex((item) => item.id === element)
  array.splice(index, 1)
  selectedRows.value = []
}

function removeAll(array) {
  playlist.value = []
  playlistDetails.value = []
  selectedRows.value = []
}

function move(array, index, delta) {
  let newIndex = index + delta
  if (newIndex < 0 || newIndex == array.length) return
  let indexes = [index, newIndex].sort((a, b) => a - b)
  array.splice(indexes[0], 2, array[indexes[1]], array[indexes[0]])
}

function moveFirst(array, element) {
  const found = array.find((item) => item.id === element)

  const index = array.findIndex((item) => item.id === element)
  array.splice(index, 1)
  array.unshift(found)
}

function moveUp(array, element) {
  const index = array.findIndex((item) => item.id === element)
  move(array, index, -1)
}

function moveDown(array, element) {
  const index = array.findIndex((item) => item.id === element)
  move(array, index, 1)
}

function selectAllSongs() {
  if (selectedSongs.value.length === filteredSongs.value.length) {
    selectedSongs.value = []
  } else {
    selectedSongs.value = filteredSongs.value.map((item) => item.id)
  }
}

function reset() {
  filterQuery.value = ''
  selectedSongs.value = []
}

function setOption(option) {
  currentSelectedOption.value = option

  if (currentSelectedOption.value === options.library) {
    reset()
    getArtists(true)
  } else if (currentSelectedOption.value === options.download) {
    getTags()
    getArtists()
    reset()
  } else if (currentSelectedOption.value === options.tags) {
    getTags()
  }
}

function hideMenu(evt) {
  if (evt.target.classList.contains('backdrop')) {
    currentSelectedOption.value = null
    reset()
  }
}

function details() {
  axios
    .get('http://localhost:3000/details?id=' + searchResultIds.value.join(','))
    .then(function (response) {
      searchResultsWithPlayer.value = response.data

      searchResults.value.forEach((item) => {
        let found = searchResultsWithPlayer.value.filter((i) => i.id === item.id.videoId)[0]
        item.contentDetails = found.contentDetails
        item.player = found.player
      })

      isSearchCompleted.value = true
    })
    .catch(function (error) {
      // handle error
      console.log(error)
    })
    .finally(function () {
      // always executed
    })
}

function search() {
  currentDownloadStep.value = downloadSteps.search
  axios
    .get('http://localhost:3000/search?search_query=' + searchQuery.value + ' audio')
    .then(function (response) {
      searchResults.value = response.data
      searchResultIds.value = searchResults.value.map((item) => item.id.videoId)
      details()
    })
    .catch(function (error) {
      // handle error
      console.log(error)
    })
    .finally(function () {
      // always executed
    })
}

/*Tags*/
function getTags() {
  axios
    .get('http://localhost:3000/tags')
    .then(function (response) {
      tags.value = response.data.sort((a, b) => a.name.localeCompare(b.name))
      selectedTags.value = tags.value.map((item) => item.id)
    })
    .catch(function (error) {
      // handle error
      console.log(error)
    })
    .finally(function () {
      // always executed
    })
}

function getArtists(filter = false) {
  axios
    .get('http://localhost:3000/artists')
    .then(function (response) {
      artists.value = response.data.sort((a, b) => a.name.localeCompare(b.name))

      if (filter) {
        filterSongsByArtist()
      }
    })
    .catch(function (error) {})
    .finally(function () {
      // always executed
    })
}

function filterSongsByArtist() {
  axios
    .post('http://localhost:3000/songs/filter-by-artist', {
      artists: selectedArtists.value,
      tags: selectedTags.value
    })
    .then(function (response) {
      songs.value = response.data.songs.sort((a, b) => a.name.localeCompare(b.name))
      filteredSongs.value = response.data.songs
      tags.value = response.data.tags.sort((a, b) => a.name.localeCompare(b.name))
      selectedTags.value = tags.value.map((item) => item.id)
    })
    .catch(function (error) {})
    .finally(function () {
      // always executed
    })
}

function filterSongs() {
  axios
    .post('http://localhost:3000/songs/filter', {
      artists: selectedArtists.value,
      tags: selectedTags.value
    })
    .then(function (response) {
      songs.value = response.data.sort((a, b) => a.name.localeCompare(b.name))
      filteredSongs.value = response.data
    })
    .catch(function (error) {})
    .finally(function () {
      // always executed
    })
}

const showMenu = ref(false)
const menuX = ref(0)
const menuY = ref(0)
const targetRow = ref({})
const contextMenuActions = ref([{ label: 'Eliminar', action: 'delete' }])

const showContextMenu = (event, song) => {
  //selectRow(song)
  event.preventDefault()
  showMenu.value = true
  targetRow.value = song
  menuX.value = event.clientX
  menuY.value = event.clientY
}

const closeContextMenu = () => {
  showMenu.value = false
}

function deleteSong() {
  axios
    .post('http://localhost:3000/songs/delete', {
      id: selectedSongs.value[0]
    })
    .then(function (response) {
      deletedSongs.value.push(response.data[0])
    })
    .catch(function (error) {})
    .finally(function () {
      selectedSongs.value = []
    })
}

const shuffle = (array) => {
  return array.sort(() => Math.random() - 0.5)
}

function addToPlaylist(action, play = false) {
  if (action === 0) {
    playlist.value = selectedSongs.value.concat(playlist.value)
  } else if (action === 1) {
    playlist.value = selectedSongs.value.concat(playlist.value)
  } else if (action === 2) {
    selectedSongs.value.forEach((song) => {
      playlist.value.push(song)
    })
  } else if (action === 3) {
    selectedSongs.value = shuffle(selectedSongs.value)
    selectedSongs.value.forEach((song) => {
      playlist.value.push(song)
    })
  }

  axios
    .post('http://localhost:3000/songs/by-id', {
      ids: selectedSongs.value
    })
    .then(function (response) {
      let temp = []
      selectedSongs.value.forEach((item) => {
        temp.push(response.data.filter((s) => s.id === item)[0])
      })

      temp.forEach((item) => {
        item.played = false
      })

      if (action === 0) {
        playlistDetails.value = temp.concat(playlistDetails.value)
      } else if (action === 1) {
        playlistDetails.value = temp.concat(playlistDetails.value)
      } else if (action === 2) {
        temp.forEach((song) => {
          playlistDetails.value.push(song)
        })
      } else if (action === 3) {
        temp.forEach((song) => {
          playlistDetails.value.push(song)
        })
      }
    })
    .catch(function (error) {
      console.log(error)
    })
    .finally(function () {
      loadPlayers(play)
    })
}

function loadPlayers(play = false) {
  selectedSongs.value = []

  if (
    player1.value.status === playerStatuses.Detenido ||
    player1.value.status === playerStatuses['Sin Carga']
  ) {
    let nextSong = getFirstUnplayedSong()
    if (nextSong) {
      player1.value.setSong(nextSong)
    }
  }

  if (
    player2.value.status === playerStatuses.Detenido ||
    player2.value.status === playerStatuses['Sin Carga']
  ) {
    let nextSong = getFirstUnplayedSong()
    if (nextSong) {
      player2.value.setSong(nextSong)
    }
  }

  if (play) {
    if (isFirstPlay.value) {
      if (player1.value.status === playerStatuses.Listo) {
        isFirstPlay.value = false
        player1.value.play()
      }
    } else {
      if (player1.value.status === playerStatuses.Pausado) {
        player1.value.play()
      }

      if (player2.value.status === playerStatuses.Pausado) {
        player2.value.play()
      }
    }
  }
}

function loadDeck(deck) {
  const index = playlistDetails.value.findIndex((item) => item.id === selectedRows.value[0])
  const found = playlistDetails.value.find((item) => item.id === selectedRows.value[0])
  playlistDetails.value.splice(index, 1)

  if (deck === 'A'){
    if(player1.value.status === playerStatuses.Listo || player1.value.status === playerStatuses.Pausado) {
      playlistDetails.value.splice(index, 0, player1.value.songFull)
      player1.value.setSong(found)
    }
  } else {
    if(player2.value.status === playerStatuses.Listo || player2.value.status === playerStatuses.Pausado) {
      playlistDetails.value.splice(index, 0, player2.value.songFull)
      player2.value.setSong(found)
    }
  }

  selectedRows.value = []
}

function getFirstUnplayedSong() {
  if (playlistDetails.value.length > 0) {
    history.value.push(playlist.value.shift())
    let songFound = playlistDetails.value.shift()

    songFound.Tags.forEach((t) => {
      tagHistory.value.push(t.id)
    })

    return songFound
  }
}

function play() {
  if (isFirstPlay.value && player1.value.status === playerStatuses.Listo) {
    isFirstPlay.value = false
    player1.value.play()
  } else {
    if (player2.value.status === playerStatuses.Pausado) {
      player2.value.play()
    } else {
      player1.value.play()
    }
  }
}

function pause() {
  if (player1.value.status === playerStatuses.Reproduciendo) {
    player1.value.pause()
  }

  if (player2.value.status === playerStatuses.Reproduciendo) {
    player2.value.pause()
  }
}

function songFading(p) {
  if (p.position === 'top') {
    if (player2.value.status === playerStatuses.Listo) {
      player2.value.play()
    }
  } else if (p.position === 'bottom') {
    if (player1.value.status === playerStatuses.Listo) {
      player1.value.play()
    }
  } else {
    player1.value.stop()
    player2.value.stop()
  }
}

function checkPlayers(play = false) {
  if (
    player1.value.status === playerStatuses.Detenido ||
    player1.value.status === playerStatuses['Sin Carga'] ||
    player2.value.status === playerStatuses.Detenido ||
    player2.value.status === playerStatuses['Sin Carga']
  ) {
    loadPlayers(play)

    /*if (playlist.value.length <= 0) {
      const tag = getTagsForAutoPlaying()

      // Add item to playlist
      axios
        .post('http://localhost:3000/songs/get-one-by-tag', {
          history: history.value,
          tag: tag
        })
        .then(function (response) {
          if (response.data.id) {
            selectedSongs.value = [response.data.id]
            addToPlaylist(0, play)
          }
        })
        .catch(function (error) {
          console.log(error)
        })
        .finally(function () {
          // always executed
        })
    } else {
      loadPlayers(play)
    }*/
  }
}

function calcularPorcentaje(arr) {
  let frecuencia = {}
  arr.forEach((item) => {
    frecuencia[item] = (frecuencia[item] || 0) + 1
  })

  let porcentajes = {}
  Object.keys(frecuencia).forEach((item) => {
    const porcentaje = (frecuencia[item] / arr.length) * 100
    porcentajes[item] = porcentaje.toFixed(2)
  })

  return porcentajes
}

function getRandomInt(max) {
  return Math.floor(Math.random() * max)
}

function getTagsForAutoPlaying() {
  const mode = {
    1: 100
  }

  let calculatedTag = Object.keys(mode)[getRandomInt(Object.keys(mode).length - 1)]
  let found = false

  let tags = []

  if (tagHistory.value.length > 0) {
    tagHistory.value.forEach((tag) => {
      if (Object.keys(mode).includes(tag.toString())) {
        tags.push(tag)
      }
    })
  } else {
    tags.push(calculatedTag)
  }

  /*let songsInLibrary = {}
  tags.forEach(t => {
    songsInLibrary[t] = getSongsInLibrary(t)
  })
  console.log('ok', songsInLibrary)*/

  const percents = calcularPorcentaje(tags)

  Object.keys(mode).forEach((t) => {
    if (!found) {
      const tag = parseInt(t)

      if (!percents[tag]) {
        found = true
        calculatedTag = tag
      } else if (percents[tag] <= mode[tag]) {
        found = true
        calculatedTag = tag
      }
    }
  })

  return calculatedTag
}

function toggleSelectedSongs(id) {
  if (selectedSongs.value.includes(id)) {
    selectedSongs.value = selectedSongs.value.filter(function (item) {
      return item !== id
    })
  } else {
    selectedSongs.value.push(id)
  }
}

function selectRow(e, id) {
  if (e.metaKey) {
    selectedRows.value.push(id)
  } else {
    selectedRows.value = []
    selectedRows.value.push(id)
  }
}

function downloaded() {
  setOption(options.library)
}

function updated() {
  selectedSongs.value = []
  setOption(options.library)
}

function waveUpdated(markers) {
  axios
    .post('http://localhost:3000/songs/update-markers/' + selectedSongs.value[0], markers)
    .then(function (response) {})
    .catch(function (error) {
      console.log(error)
    })
    .finally(function () {
      selectedSongs.value = []
      setOption(options.library)
    })
}

function saveSpeed(p) {
  let id = null
  let speed = null

  if (p.position === 'top') {
    id = player1.value.songId
    speed = player1.value.speed_added
  } else {
    id = player2.value.songId
    speed = player2.value.speed_added
  }

  axios
    .post('http://localhost:3000/songs/save-speed', {
      id: id,
      speed: speed
    })
    .then(function (response) {})
}

function next() {
  if (player1.value.status === playerStatuses.Reproduciendo) {
    player1.value.next()
  } else if (player2.value.status === playerStatuses.Reproduciendo) {
    player2.value.next()
  }
}

function artistsChanged(data) {
  selectedArtists.value = data
}

function tagsChanged(data) {
  selectedTags.value = data
}

function selectAllArtists() {
  artistMultiSelect.value.selectAll()
}

function selectNoneArtists() {
  artistMultiSelect.value.selectNone()
}

function selectAllTags() {
  tagMultiSelect.value.selectAll()
}

function selectNoneTags() {
  tagMultiSelect.value.selectNone()
}
</script>

<template>
  <!-- Overlay to close the menu -->
  <div v-if="showMenu" class="overlay" @click="closeContextMenu" @click.right="closeContextMenu" />

  <audio id="placa" class="hidden" controls>
    <source preload="auto" src="/placa.mp3" type="audio/mp3" />
  </audio>

  <!-- Custom Context Menu -->
  <ContextMenu
    v-if="showMenu"
    :song="targetRow"
    :actions="contextMenuActions"
    :x="menuX"
    :y="menuY"
    @action-clicked="handleActionClick"
  />

  <div
    v-if="currentSelectedOption"
    class="backdrop bg-black bg-opacity-70 z-50 fixed w-full h-full"
    @click="hideMenu"
  >
    <div
      :class="{
        'w-9/12': currentSelectedOption === options.library,
        'w-11/12': currentSelectedOption === options.wave,
        'w-2/5': currentSelectedOption !== options.wave && currentSelectedOption !== options.library
      }"
      class="right-[40px] fixed flex h-full flex-col min-h-[0] bg-gray-300 p-6 text-black"
      @click="hideMenu"
    >
      <Edit
        v-if="currentSelectedOption === options.edit"
        :id="selectedSongs[0]"
        :tags="tags"
        :artists="artists"
        @updated="updated"
      ></Edit>

      <Download
        v-if="currentSelectedOption === options.download"
        :tags="tags"
        :artists="artists"
        @downloaded="downloaded"
      ></Download>

      <Artists v-if="currentSelectedOption === options.artists"></Artists>

      <Tags v-if="currentSelectedOption === options.tags" :tags="tags" @added="getTags"></Tags>

      <Wave
        v-if="currentSelectedOption === options.wave"
        :id="selectedSongs[0]"
        @wave-updated="waveUpdated"
      ></Wave>
      <div
        v-if="currentSelectedOption === options.library"
        class="flex flex-col space-y-4 flex-1 min-h-[0]"
      >
        <div class="library-filters flex items-start h-[200px] space-x-4">
          <div class="h-full flex-1 flex flex-col min-h-[0]">
            <div class="flex items-center space-x-2 text-xs text-white mb-2">
              <button @click="selectAllArtists" class="px-2 py-1 bg-gray-700 flex items-center space-x-1">
                <Icon class="w-4 h-4" icon="ri:checkbox-line" />
                <span>Todos</span>
              </button>
              <button @click="selectNoneArtists" class="px-2 py-1 bg-gray-700 flex items-center space-x-1">
                <Icon class="w-4 h-4" icon="carbon:checkbox" />
                <span>Ninguno</span>
              </button>
            </div>

            <div class="overflow-y-scroll bg-gray-300 flex-1">
              <multiselect
                ref="artistMultiSelect"
                name="artists"
                :list="artists"
                @changed="artistsChanged"
              ></multiselect>
            </div>
          </div>

          <div class="h-full flex-1 flex flex-col min-h-[0]">
            <div class="flex items-center space-x-2 text-xs text-white mb-2">
              <button @click="selectAllTags" class="px-2 py-1 bg-gray-700 flex items-center space-x-1">
                <Icon class="w-4 h-4" icon="ri:checkbox-line" />
                <span>Todos</span>
              </button>
              <button @click="selectNoneTags" class="px-2 py-1 bg-gray-700 flex items-center space-x-1">
                <Icon class="w-4 h-4" icon="carbon:checkbox" />
                <span>Ninguno</span>
              </button>
            </div>

            <div class="overflow-y-scroll bg-gray-300 flex-1">
              <multiselect
                ref="tagMultiSelect"
                name="tags"
                :list="tags"
                @changed="tagsChanged"
              ></multiselect>
            </div>
          </div>
        </div>

        <div class="flex items-center justify-between space-x-3">
          <div class="flex items-center space-x-3">
            <button
              v-if="playlistDetails.length === 0"
              :disabled="selectedSongs.length <= 0 || player1.status === playerStatuses.Cambiando || player2.status
              === playerStatuses.Cambiando"
              type="button"
              class="text-sm whitespace-nowrap px-2 py-2 bg-gray-800 text-white font-bold flex items-center space-x-1 disabled:bg-gray-400 disabled:text-gray-300"
              @click="addToPlaylist(0)"
            >
              <Icon class="w-5 h-5" icon="material-symbols:add" />
              <span>Agregar</span>
            </button>
            <button
              v-if="playlistDetails.length === 0"
              :disabled="selectedSongs.length <= 1  || player1.status === playerStatuses.Cambiando || player2.status
              === playerStatuses.Cambiando"
              type="button"
              class="text-sm whitespace-nowrap px-2 py-2 bg-gray-800 text-white font-bold flex items-center space-x-1 disabled:bg-gray-400 disabled:text-gray-300"
              @click="addToPlaylist(3)"
            >
              <Icon class="w-4 h-4" icon="oi:random" />
              <span>Aleatorio</span>
            </button>
            <template v-if="playlistDetails.length > 0">
              <button
                :disabled="selectedSongs.length <= 0"
                type="button"
                class="text-sm whitespace-nowrap px-2 py-2 bg-gray-800 text-white font-bold flex items-center space-x-1 disabled:bg-gray-400 disabled:text-gray-300"
                @click="addToPlaylist(1)"
              >
                <Icon class="w-5 h-5" icon="ic:baseline-move-up" />
                <span>Al comienzo</span>
              </button>
              <button
                :disabled="selectedSongs.length <= 0"
                type="button"
                class="text-sm whitespace-nowrap px-2 py-2 bg-gray-800 text-white font-bold flex items-center space-x-1 disabled:bg-gray-400 disabled:text-gray-300"
                @click="addToPlaylist(2)"
              >
                <Icon class="w-5 h-5" icon="ic:baseline-move-down" />
                <span>Al final</span>
              </button>
            </template>
            <button
              :disabled="selectedSongs.length !== 1"
              type="button"
              class="text-sm whitespace-nowrap px-2 py-2 bg-gray-800 text-white font-bold flex items-center space-x-1 disabled:bg-gray-400 disabled:text-gray-300"
              @click="currentSelectedOption = options.edit"
            >
              <Icon class="w-5 h-5" icon="material-symbols:info-outline" />
              <span>Info</span>
            </button>
            <button
              :disabled="selectedSongs.length !== 1"
              type="button"
              class="text-sm whitespace-nowrap px-2 py-2 bg-gray-800 text-white font-bold flex items-center space-x-1 disabled:bg-gray-400 disabled:text-gray-300"
              @click="currentSelectedOption = options.wave"
            >
              <Icon class="w-5 h-5" icon="mdi:sine-wave" />
              <span>Onda</span>
            </button>
            <button
              :disabled="selectedSongs.length !== 1"
              type="button"
              class="text-sm whitespace-nowrap px-2 py-2 bg-red-600 text-white font-bold flex items-center space-x-1 disabled:bg-gray-400 disabled:text-gray-300"
              @click="deleteSong"
            >
              <Icon class="w-5 h-5" icon="iwwa:delete" />
              <span>Eliminar</span>
            </button>
          </div>

          <input
            v-model="filterQuery"
            placeholder="Filtrar por título o artista"
            class="text-sm min-w-[170px]"
            type="text"
          />
        </div>

        <div class="flex-1 overflow-y-auto">
          <table class="library border-collapse w-full">
            <tr>
              <td class="w-[40px]">
                <Icon
                  v-if="selectedSongs.length === filteredSongs.length"
                  class="cursor-pointer"
                  icon="icomoon-free:checkbox-checked"
                  @click="selectAllSongs"
                />
                <Icon
                  v-else
                  class="text-gray-400 cursor-pointer"
                  icon="icomoon-free:checkbox-unchecked"
                  @click="selectAllSongs"
                />
              </td>
              <td class="text-xs">Título</td>
              <td class="text-xs">Artista(s)</td>
              <td class="text-xs">Duración</td>
              <td class="text-xs text-center">Fuente</td>
            </tr>
            <tr v-for="s in filteredSongs" :key="s.id" @click="toggleSelectedSongs(s.id)">
              <td class="text-sm w-[40px]">
                <template v-if="!deletedSongs.includes(s.id)">
                  <Icon v-if="selectedSongs.includes(s.id)" icon="icomoon-free:checkbox-checked" />
                  <Icon v-else class="text-gray-400" icon="icomoon-free:checkbox-unchecked" />
                </template>
              </td>
              <td class="text-sm">
                <span
                  :class="{ 'text-red-500 line-through': deletedSongs.includes(s.id) }"
                  class="text-black"
                  >{{ s.name }}</span
                >
              </td>
              <td
                :class="{ 'text-red-500 line-through': deletedSongs.includes(s.id) }"
                class="text-sm text-gray-500"
              >
                {{ s.Artists.map((i) => i.name).join(', ') }}
              </td>
              <td
                :class="{ 'text-red-500 line-through': deletedSongs.includes(s.id) }"
                class="text-sm text-gray-500"
              >
                {{ s.duration_original }}
              </td>
              <td
                class="text-center text-sm text-gray-500"
              >
                <Icon v-if="s.isAppleMusic" class="mx-auto w-6 h-6" icon="ic:baseline-apple" />
                <Icon v-else class="mx-auto w-6 h-6" icon="mingcute:youtube-fill" />
              </td>
            </tr>
          </table>
        </div>
      </div>
    </div>
  </div>

  <div class="flex items-stretch">
    <div class="flex-[5] flex flex-col justify-between">
      <Player
        ref="player1"
        :statuses="playerStatuses"
        position="top"
        @loaded="checkPlayers(player1)"
        @stopped="checkPlayers(player1)"
        @fading="songFading(player1)"
        @speed="saveSpeed(player1)"
      ></Player>
      <div class="p-6">
        <div class="relative">
          <div class="select-none absolute text-sm text-gray-500 right-[140px] top-[40px]">
            v{{ version }}
          </div>
          <img
            id="logo"
            class="w-full h-auto select-none"
            src="/logo.png"
            alt="Salsamanía por Rogers Vizcaino"
          />
        </div>
      </div>
      <Player
        ref="player2"
        :statuses="playerStatuses"
        position="bottom"
        @loaded="checkPlayers(player2)"
        @stopped="checkPlayers(player2)"
        @fading="songFading(player2)"
        @speed="saveSpeed(player2)"
      ></Player>
    </div>

    <div class="flex-[6] flex flex-col p-4 space-y-2">
      <div class="flex items-center space-x-10 justify-between">
        <div class="control-buttons flex items-center space-x-3">
          <button
            v-if="
              (player1 &&
                (player1.status === playerStatuses.Reproduciendo ||
                  player1.status === playerStatuses.Cambiando ||
                  player1.status === playerStatuses.Placa ||
                  player1.status === playerStatuses.Nivelando)) ||
              (player2 &&
                (player2.status === playerStatuses.Reproduciendo ||
                  player2.status === playerStatuses.Cambiando ||
                  player2.status === playerStatuses.Placa ||
                  player2.status === playerStatuses.Nivelando))
            "
            :disabled="
              (player1 && player1.status === playerStatuses.Cambiando) ||
              (player2 && player2.status === playerStatuses.Cambiando)
            "
            type="button"
            class="disabled:opacity-30 disabled:cursor-default cursor-pointer rounded-full bg-gray-600 p-2"
            @click="pause"
          >
            <Icon class="w-10 h-10 text-white" icon="material-symbols:pause" />
          </button>

          <button
            v-else
            :disabled="
               (!player1 || player1.status === playerStatuses.Cambiando || player1.status ===
              playerStatuses['Sin Carga'])
               && (!player2 || player2.status === playerStatuses['Sin Carga'] ||
                player2.status === playerStatuses.Cambiando)
            "
            type="button"
            class="disabled:opacity-30 disabled:cursor-default cursor-pointer rounded-full bg-gray-600 p-2"
            @click="play"
          >
            <Icon class="w-10 h-10 text-white" icon="mdi:play" />
          </button>

          <button
            :disabled="
              (!player1 || player1.status === playerStatuses.Cambiando || player1.status ===
              playerStatuses['Sin Carga'])
               && (!player2 || player2.status === playerStatuses['Sin Carga'] ||
                player2.status === playerStatuses.Cambiando)
            "
            type="button"
            class="disabled:opacity-30 disabled:cursor-default cursor-pointer rounded-full bg-gray-600 p-2"
            @click="next"
          >
            <Icon class="w-6 h-6 text-white" icon="material-symbols:skip-next" />
          </button>
        </div>

        <div class="flex items-center space-x-3">
          <button
            :disabled="selectedRows.length <= 0"
            type="button"
            class="disabled:opacity-30 disabled:cursor-default cursor-pointer rounded-full bg-gray-600 p-2"
            @click="moveFirst(playlistDetails, selectedRows[0])"
          >
            <Icon class="w-6 h-6 text-white" icon="ic:baseline-move-up" />
          </button>

          <button
            :disabled="selectedRows.length <= 0"
            type="button"
            class="disabled:opacity-30 disabled:cursor-default cursor-pointer rounded-full bg-gray-600 p-2"
            @click="moveUp(playlistDetails, selectedRows[0])"
          >
            <Icon class="w-6 h-6 text-white" icon="teenyicons:up-solid" />
          </button>

          <button
            :disabled="selectedRows.length <= 0"
            type="button"
            class="disabled:opacity-30 disabled:cursor-default cursor-pointer rounded-full bg-gray-600 p-2"
            @click="moveDown(playlistDetails, selectedRows[0])"
          >
            <Icon class="w-6 h-6 text-white" icon="teenyicons:down-solid" />
          </button>

          <button
            :disabled="selectedRows.length <= 0"
            type="button"
            class="disabled:opacity-30 disabled:cursor-default cursor-pointer rounded-full bg-gray-600 text-white p-2"
            @click="remove(playlistDetails, selectedRows[0])"
          >
            <Icon class="w-6 h-6 text-white" icon="mdi:remove-bold" />
          </button>
        </div>

        <div class="flex items-center space-x-3">
          <button
            :disabled="!player1 || selectedRows.length <= 0 || player1.status === playerStatuses.Reproduciendo ||
            player1.status === playerStatuses.Cambiando"
            type="button"
            class="flex items-center space-x-1 disabled:opacity-30 disabled:cursor-default cursor-pointer bg-gray-600 text-white p-2"
            @click="loadDeck('A')"
          >
            <Icon class="w-6 h-6 text-white" icon="ic:baseline-download" />
            <span class="inline-block bg-[#EAB308FF] p-1 leading-none">A</span>
          </button>

          <button
            :disabled="!player2 || selectedRows.length <= 0 || player2.status === playerStatuses.Reproduciendo ||
            player2.status === playerStatuses.Cambiando"
            type="button"
            class="flex items-center space-x-1 disabled:opacity-30 disabled:cursor-default cursor-pointer bg-gray-600 text-white p-2"
            @click="loadDeck('B')"
          >
            <Icon class="w-6 h-6 text-white" icon="ic:baseline-download" />
            <span class="inline-block bg-[#EC4899FF] p-1 leading-none">B</span>
          </button>
        </div>
      </div>

      <div class="bg-gray-900 flex-1 overflow-y-auto basis-0">
        <table class="dark border-collapse w-full text-sm">
          <tr v-for="s in playlistDetails" :key="s.id" @click="selectRow($event, s.id)">
            <td class="cursor-pointer" :class="{ 'bg-pink-500': selectedRows.includes(s.id) }">
              {{ s.name }}
            </td>
            <td class="cursor-pointer" :class="{ 'bg-pink-500': selectedRows.includes(s.id) }">
              {{ s.Artists.map((i) => i.name).join(', ') }}
            </td>
          </tr>
        </table>
      </div>

      <div class="flex items-center justify-between">
        <div class="play-next-status text-xs text-white">
          <span v-if="playlistDetails.length <= 0">No hay más canciones</span>
          <span v-else-if="playlistDetails.length > 1">{{ playlistDetails.length }} canciones restantes</span>
          <span v-else>1 canción restante</span>.
          <span v-if="timeLeft[0] > 0">La reproducción terminará a las {{ timeLeft[1] }}</span>
          <span class="text-lime-500" v-if="timeLeft[2] > 0"> +{{ timeLeft[2] }} día(s).</span>
          <span v-else>.</span>
        </div>

        <div class="flex items-center space-x-2">
          <button
            :disabled="playlistDetails.length <= 1"
            type="button"
            class="flex text-white text-xs items-center space-x-1 disabled:opacity-30 disabled:cursor-default cursor-pointer bg-gray-600 p-1 px-2"
            @click="shuffle(playlistDetails)"
          >
            <Icon class="w-4 h-4" icon="ic:baseline-shuffle" />
            <span>Revolver</span>
          </button>

          <button
            :disabled="playlistDetails.length <= 0"
            type="button"
            class="flex text-white text-xs items-center space-x-1 disabled:opacity-30 disabled:cursor-default cursor-pointer bg-gray-600 p-1 px-2"
            @click="removeAll(playlistDetails)"
          >
            <Icon class="w-4 h-4" icon="iconamoon:trash-fill" />
            <span>Vaciar</span>
          </button>
        </div>
      </div>

    </div>

    <div
      class="z-50 text-sm flex flex-col space-y-10 justify-between items-center bg-gray-100 fullheight"
    >
      <div class="flex flex-col w-full">
        <div
          :class="{
            'bg-gray-300':
              currentSelectedOption === options.library || currentSelectedOption === options.wave
          }"
          class="group hover:cursor-pointer flex flex-col items-center justify-center px-1 pt-2 pb-2"
          @click="setOption(options.library)"
        >
          <div>
            <Icon class="w-8 h-8" icon="material-symbols:library-music-outline-sharp" />
          </div>
        </div>

        <div
          :class="{ 'bg-gray-300': currentSelectedOption === options.download }"
          class="group hover:cursor-pointer flex flex-col items-center justify-center px-1 pt-2 pb-2"
          @click="setOption(options.download)"
        >
          <div>
            <Icon class="w-10 h-10" icon="ic:sharp-download" />
          </div>
        </div>
      </div>

      <div class="flex flex-col w-full">
        <div
          :class="{ 'bg-gray-300': currentSelectedOption === options.artists }"
          class="group hover:cursor-pointer flex flex-col items-center justify-center px-1 pt-2 pb-2"
          @click="setOption(options.artists)"
        >
          <div>
            <Icon class="w-8 h-8" icon="material-symbols:artist" />
          </div>
        </div>

        <div
          :class="{ 'bg-gray-300': currentSelectedOption === options.tags }"
          class="group hover:cursor-pointer flex flex-col items-center justify-center px-1 pt-2 pb-2"
          @click="setOption(options.tags)"
        >
          <div>
            <Icon class="w-8 h-8" icon="mdi:tags" />
          </div>
        </div>

        <!--div
          :class="{ 'bg-gray-300': currentSelectedOption === options.settings }"
          class="group hover:cursor-pointer flex flex-col items-center justify-center px-3 pt-3 pb-3"
          @click="setOption(options.settings)"
        >
          <div>
            <Icon class="w-8 h-8" icon="ic:sharp-settings" />
          </div>
          <div class="text-center font-bold">Ajustes</div>
        </div-->
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: transparent;
  z-index: 51;
}

.overlay::before {
  content: '';
  position: absolute;
  width: 100%;
  height: 100%;
}

.overlay:hover {
  cursor: pointer;
}
</style>
