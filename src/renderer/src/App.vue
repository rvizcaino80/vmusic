<script setup>
import axios from 'axios'
import { onMounted, ref, watch } from 'vue'
import { decodeHTML5 } from 'entities'
import { Icon } from '@iconify/vue'
import * as duration from 'duration-fns'
import hotkeys from 'hotkeys-js'

/* Components */
import ContextMenu from './components/ContextMenu.vue'
import Artists from './components/Artists.vue'
import Tags from './components/Tags.vue'
import Player from './components/Player.vue'

let options = {
  library: 10,
  download: 20,
  downloadDetails: 25,
  tags: 30,
  settings: 40,
  artists: 50
}

let downloadSteps = {
  search: 10,
  download: 20,
  edit: 30,
  saving: 40,
  error: 50
}

const playerStatuses = {
  'Sin Carga': 10,
  Cargando: 20,
  Listo: 30,
  Reproduciendo: 40,
  Pausado: 50,
  Cambiando: 60,
  Detenido: 60,
  Placa: 70,
  Nivelando: 80,
}

onMounted(() => {
  hotkeys('space', function(event, handler){
    event.preventDefault()
    playPlaca()
  })
})

let currentSelectedOption = ref(null)

// Download
const isSearchCompleted = ref(false)
const searchQuery = ref('')
const searchResults = ref([])
const searchResultsWithPlayer = ref([])
const searchResultIds = ref([])
const currentDownloadStep = ref(downloadSteps.search)
const songId = ref('')
const songDuration = ref(0)
const songDurationOriginal = ref('')
const song = ref('')
const artistIds = ref([])
const totalArtists = ref(1)
const songTags = ref([])

// Library
const artists = ref([])
const songs = ref([])
const selectedTags = ref([0])
const selectedArtists = ref([0])
const selectedSongs = ref([])

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

watch(selectedSongs, (newValue, oldValue) => {
})

function selectAllSongs() {
  if (selectedSongs.value.length === songs.value.length) {
    selectedSongs.value = []
  } else {
    selectedSongs.value = songs.value.map((item) => item.id)
  }
}

function reset() {
  songId.value = ''
  songDuration.value = 0
  songDurationOriginal.value = ''
  song.value = ''
  artistIds.value = []
  songTags.value = []
  currentDownloadStep.value = downloadSteps.search
  searchQuery.value = null
  searchResults.value = []
  searchResultsWithPlayer.value = []
  searchResultIds.value = []
}

function setOption(option) {
  currentSelectedOption.value = option

  if (currentSelectedOption.value === options.library) {
    reset()
    getArtists(true)
  } else if (currentSelectedOption.value === options.download) {
    getArtists()
    reset()

    setTimeout(function () {
      document.getElementById('searchQuery').focus()
    }, 200)
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

function download(song) {
  songId.value = song.id.videoId
  songDurationOriginal.value = song.contentDetails.duration
  songDuration.value = duration.toSeconds(song.contentDetails.duration)

  currentDownloadStep.value = downloadSteps.download

  axios
    .post('http://localhost:3000/download', {
      id: songId.value
    })
    .then(function (response) {
      currentDownloadStep.value = downloadSteps.edit
      getTags()

      setTimeout(function () {
        document.getElementById('song').focus()
      }, 200)
    })
    .catch(function (error) {
      currentDownloadStep.value = downloadSteps.error
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
      tags.value = response.data
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

function saveSong() {
  currentDownloadStep.value = downloadSteps.saving

  const elements = document.querySelectorAll('.artist')
  elements.forEach((e) => {
    artistIds.value.push(e.value)
  })

  axios
    .post('http://localhost:3000/songs/save', {
      ytid: songId.value,
      song: song.value,
      artists: artistIds.value,
      duration: songDuration.value,
      durationOriginal: songDurationOriginal.value,
      songTags: songTags.value
    })
    .then(function (response) {
      currentSelectedOption.value = options.library
      getArtists(true)
      currentDownloadStep.value = downloadSteps.search
    })
    .catch(function (error) {})
    .finally(function () {
      // always executed
    })
}

function getArtists(filter = false) {
  axios
    .get('http://localhost:3000/artists')
    .then(function (response) {
      artists.value = response.data
      selectedArtists.value = artists.value.map((item) => item.id)

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
      songs.value = response.data.songs
      tags.value = response.data.tags
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
      songs.value = response.data
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
const contextMenuActions = ref([
  { label: 'Agregar al comienzo', action: 'add-first' },
  { label: 'Agregar al final', action: 'add-last' }
])

const showContextMenu = (event, song) => {
  closeContextMenu()
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
    player1.value.setSong(nextSong)
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
    player1.value.play()
  } else {
    if (player1.value.status === playerStatuses.Pausado) {
      player1.value.play()
    } else if (player2.value.status === playerStatuses.Pausado) {
      player2.value.play()
    } else {
      checkPlayers(true)
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
    player2.value.play()
  } else if (p.position === 'bottom') {
    player1.value.play()
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
    if (playlist.value.length <= 0) {
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
    }
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
  console.log(calculatedTag)
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
</script>

<template>
  <!-- Overlay to close the menu -->
  <div v-if="showMenu" class="overlay" @click="closeContextMenu" @click.right="closeContextMenu" />

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
      class="right-[115px] fixed flex h-full flex-col bg-gray-300 p-6 w-2/5 text-black"
      @click="hideMenu"
    >
      <div v-if="currentSelectedOption === options.download">
        <form class="mb-6 space-x-2 flex items-center" @submit.prevent="search">
          <input
            id="searchQuery"
            v-model="searchQuery"
            type="text"
            class="flex-1"
            placeholder="Ingresa un término de búsqueda"
          />
          <button
            type="submit"
            class="p-2 border border-gray-800 bg-gray-800 text-white flex items-center space-x-1 font-bold"
          >
            <Icon class="w-5 h-5" icon="gravity-ui:magnifier" />
            <span>Buscar</span>
          </button>
        </form>

        <div
          v-if="currentDownloadStep === downloadSteps.error"
          class="text-red-500 flex items-center space-x-1"
        >
          <Icon class="w-6 h-6" icon="bxs:error-alt" />
          <span>La canción ya existe en la biblioteca.</span>
        </div>

        <form
          v-if="
            currentDownloadStep === downloadSteps.edit ||
            currentDownloadStep === downloadSteps.saving
          "
          class="space-y-3 max-w-[60%] mx-auto"
          @submit.prevent="saveSong"
        >
          <div>
            <label class="text-sm text-gray-500 block">Título</label>
            <input
              id="song"
              v-model="song"
              type="text"
              class="w-full block"
              placeholder="Título de la canción"
            />
          </div>

          <div>
            <label class="text-sm text-gray-500 block">Artista</label>
            <div class="flex items-center space-x-2">
              <select class="w-full block artist">
                <option value="" selected>-- Seleccionar Artista --</option>
                <option v-for="artist in artists" :key="artist.id" :value="artist.id">
                  {{ artist.name }}
                </option>
              </select>
              <Icon class="w-6 h-6 cursor-pointer" icon="el:plus" />
              <Icon class="text-gray-400 w-6 h-6 cursor-default" icon="el:minus" />
            </div>
          </div>

          <div>
            <label class="text-sm text-gray-500 block">Etiquetas</label>

            <div v-for="tag in tags" :key="tag.id" class="relative flex items-center mb-1">
              <div class="mr-2 flex items-center">
                <input
                  v-model="songTags"
                  type="checkbox"
                  :value="tag.id"
                  class="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
                />
              </div>
              <div class="min-w-0 flex-1 leading-6">
                <label for="person-1" class="select-none font-medium text-gray-900">{{
                  tag.name
                }}</label>
              </div>
            </div>
          </div>

          <button
            :disabled="currentDownloadStep === downloadSteps.saving"
            type="submit"
            class="p-2 border border-gray-800 bg-gray-800 text-white flex items-center space-x-1 font-bold"
          >
            <Icon
              v-if="currentDownloadStep === downloadSteps.edit"
              class="w-5 h-5"
              icon="tdesign:save"
            />
            <Icon
              v-if="currentDownloadStep === downloadSteps.saving"
              class="w-5 h-5 animate-spin"
              icon="gg:spinner-two-alt"
            />
            <span>Guardar</span>
          </button>
        </form>

        <div v-if="currentDownloadStep === downloadSteps.download">
          <Icon class="w-24 h-24 mx-auto animate-spin" icon="icon-park-solid:record-disc" />
          <div class="text-center">Descargando...</div>
        </div>

        <div
          v-if="currentDownloadStep === downloadSteps.search && isSearchCompleted"
          class="grid grid-cols-2 gap-4"
        >
          <div v-for="result in searchResults" :key="result.id">
            <div class="mb-1">
              <div v-html="result.player.embedHtml"></div>
            </div>
            <div class="text-base leading-tight mb-1">{{ decodeHTML5(result.snippet.title) }}</div>

            <div
              class="cursor-pointer px-2 py-1 bg-gray-800 text-white flex items-center space-x-1 w-min"
              @click="download(result)"
            >
              <Icon icon="ri:download-fill" />
              <div class="text-base leading-tight font-bold">Descargar</div>
            </div>
          </div>
        </div>
      </div>

      <Artists v-if="currentSelectedOption === options.artists"></Artists>

      <Tags v-if="currentSelectedOption === options.tags" :tags="tags" @saved="getTags"></Tags>

      <div
        v-if="currentSelectedOption === options.library"
        class="flex flex-col space-y-4 flex-1 min-h-[0]"
      >
        <div class="library-filters flex items-start h-[200px] space-x-4">
          <div class="h-full flex-1 flex flex-col">
            <label class="block text-sm text-gray-600 mb-1">Artista</label>
            <select
              id="selectedArtists"
              v-model="selectedArtists"
              name="selectedArtists"
              class="h-full flex-1 p-0"
              multiple
              @change="filterSongsByArtist"
            >
              <option v-for="a in artists" :key="a.id" class="px-2" :value="a.id">
                {{ a.name }}
              </option>
            </select>
          </div>

          <div class="h-full flex-1 flex flex-col">
            <label class="block text-sm text-gray-600 mb-1">Etiqueta</label>
            <select
              id="selectedTags"
              v-model="selectedTags"
              class="h-full flex-1 p-0"
              name="selectedTags"
              multiple
              @change="filterSongs"
            >
              <option v-for="tag in tags" :key="tag.id" class="px-2" :value="tag.id">
                {{ tag.name }}
              </option>
            </select>
          </div>
        </div>

        <div class="flex items-center space-x-3">
          <button
            v-if="playlistDetails.length === 0"
            :disabled="selectedSongs.length <= 0"
            type="button"
            class="text-sm whitespace-nowrap px-2 py-2 bg-gray-800 text-white font-bold flex items-center space-x-1 disabled:bg-gray-400 disabled:text-gray-300"
            @click="addToPlaylist(0)"
          >
            <Icon class="w-5 h-5" icon="material-symbols:add" />
            <span>Agregar</span>
          </button>
          <button
            v-if="playlistDetails.length === 0"
            :disabled="selectedSongs.length <= 0"
            type="button"
            class="text-sm whitespace-nowrap px-2 py-2 bg-gray-800 text-white font-bold flex items-center space-x-1 disabled:bg-gray-400 disabled:text-gray-300"
            @click="addToPlaylist(3)"
          >
            <Icon class="w-4 h-4" icon="oi:random" />
            <span>Agregar aleatorio</span>
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
            :disabled="selectedSongs.length <= 0"
            type="button"
            class="text-sm whitespace-nowrap px-2 py-2 bg-gray-800 text-white font-bold flex items-center space-x-1 disabled:bg-gray-400 disabled:text-gray-300"
            @click="addToPlaylist(2)"
          >
            <Icon class="w-5 h-5" icon="material-symbols:info-outline" />
            <span>Info</span>
          </button>
        </div>

        <div class="flex-1 overflow-y-auto">
          <table class="library border-collapse w-full">
            <tr>
              <td>
                <Icon
                  v-if="selectedSongs.length === songs.length"
                  class="cursor-pointer"
                  icon="icomoon-free:checkbox-checked"
                  @click="selectAllSongs"
                />
                <Icon
                  v-else
                  class="cursor-pointer"
                  icon="icomoon-free:checkbox-unchecked"
                  @click="selectAllSongs"
                />
              </td>
              <td class="text-sm">Título</td>
              <td class="text-sm">Artista(s)</td>
              <td class="text-sm text-right">Duración</td>
            </tr>
            <tr
              v-for="s in songs"
              :key="s.id"
              @click="toggleSelectedSongs(s.id)"
              @contextmenu.prevent="showContextMenu($event, s)"
            >
              <td class="w-[40px]">
                <Icon v-if="selectedSongs.includes(s.id)" icon="icomoon-free:checkbox-checked" />
                <Icon v-else icon="icomoon-free:checkbox-unchecked" />
              </td>
              <td class="font-bold">
                <span class="text-black">{{ s.name }}</span>
              </td>
              <td>{{ s.Artists.map((i) => i.name).join(', ') }}</td>
              <td class="text-right">
                {{ s.duration_original }}
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
      ></Player>
      <div>
        <audio id="placa" class="hidden" controls>
          <source preload="auto" src="/placa.mp3" type="audio/mp3">
        </audio>
      </div>
      <Player
        ref="player2"
        :statuses="playerStatuses"
        position="bottom"
        @loaded="checkPlayers(player2)"
        @stopped="checkPlayers(player2)"
        @fading="songFading(player2)"
      ></Player>
    </div>

    <div class="flex-[6] flex flex-col p-4 pr-10 space-y-4">
      <div class="flex items-center justify-between">
        <div class="control-buttons flex items-center space-x-3">
          <button
            :disabled="
              (player1 && player1.status === playerStatuses.Cambiando) ||
              (player2 && player2.status === playerStatuses.Cambiando)
            "
            type="button"
            class="disabled:opacity-30 disabled:cursor-default cursor-pointer rounded-full bg-gray-600 p-2"
          >
            <Icon class="w-6 h-6 text-white" icon="material-symbols:skip-previous" />
          </button>

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
              (player1 && player1.status === playerStatuses.Cambiando) ||
              (player2 && player2.status === playerStatuses.Cambiando)
            "
            type="button"
            class="disabled:opacity-30 disabled:cursor-default cursor-pointer rounded-full bg-gray-600 p-2"
            @click="play"
          >
            <Icon class="w-10 h-10 text-white" icon="mdi:play" />
          </button>

          <button
            :disabled="
              (player1 && player1.status === playerStatuses.Cambiando) ||
              (player2 && player2.status === playerStatuses.Cambiando)
            "
            type="button"
            class="disabled:opacity-30 disabled:cursor-default cursor-pointer rounded-full bg-gray-600 p-2"
          >
            <Icon class="w-6 h-6 text-white" icon="material-symbols:skip-next" />
          </button>
        </div>

        <div>
          <select
            v-model="currentMode"
            class="text-base block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-indigo-600"
          >
            <option value="0">Manual</option>
          </select>
        </div>
      </div>

      <div class="bg-gray-900 flex-1 overflow-y-auto basis-0">
        <table class="dark border-collapse w-full">
          <tr v-for="s in playlistDetails" @click="selectRow($event, s.id)">
            <td class="cursor-pointer" :class="{ 'bg-pink-500': selectedRows.includes(s.id) }">
              {{ s.name }}
            </td>
            <td class="cursor-pointer" :class="{ 'bg-pink-500': selectedRows.includes(s.id) }">
              {{ s.Artists.map((i) => i.name).join(', ') }}
            </td>
            <td class="cursor-pointer" :class="{ 'bg-pink-500': selectedRows.includes(s.id) }">
              {{ s.duration_original }}
            </td>
          </tr>
        </table>
      </div>

      <div class="play-next-status text-sm text-white">
        {{ playlistDetails.length }} canciones restantes
      </div>
    </div>

    <div class="z-50 flex flex-col space-y-10 justify-between items-center bg-gray-100 fullheight">
      <div class="flex flex-col w-full">
        <div
          :class="{ 'bg-gray-300': currentSelectedOption === options.library }"
          class="group hover:cursor-pointer flex flex-col items-center justify-center px-6 pt-6"
          @click="setOption(options.library)"
        >
          <div><img class="block" src="/icons/library.png" alt="Library Icon" /></div>
          <div class="text-center font-bold">Biblioteca</div>
        </div>

        <div
          :class="{ 'bg-gray-300': currentSelectedOption === options.download }"
          class="group hover:cursor-pointer flex flex-col items-center justify-center px-6 pt-6"
          @click="setOption(options.download)"
        >
          <div>
            <Icon class="w-16 h-16" icon="ic:sharp-download" />
          </div>
          <div class="text-center font-bold">Descargar</div>
        </div>
      </div>

      <div class="flex flex-col w-full">
        <div
          :class="{ 'bg-gray-300': currentSelectedOption === options.artists }"
          class="group hover:cursor-pointer flex flex-col items-center justify-center px-6 pb-6"
          @click="setOption(options.artists)"
        >
          <div>
            <Icon class="w-16 h-16" icon="material-symbols:artist" />
          </div>
          <div class="text-center font-bold">Artistas</div>
        </div>

        <div
          :class="{ 'bg-gray-300': currentSelectedOption === options.tags }"
          class="group hover:cursor-pointer flex flex-col items-center justify-center px-6 pb-6"
          @click="setOption(options.tags)"
        >
          <div>
            <Icon class="w-16 h-16" icon="mdi:tags" />
          </div>
          <div class="text-center font-bold">Etiquetas</div>
        </div>

        <div
          :class="{ 'bg-gray-300': currentSelectedOption === options.settings }"
          class="group hover:cursor-pointer flex flex-col items-center justify-center px-6 pb-6"
          @click="setOption(options.settings)"
        >
          <div>
            <Icon class="w-16 h-16" icon="ic:sharp-settings" />
          </div>
          <div class="text-center font-bold">Ajustes</div>
        </div>
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
