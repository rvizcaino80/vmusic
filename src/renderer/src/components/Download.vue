<template>
  <div class="overflow-y-auto">
    <div
      v-if="inProgressDownloads.length > 0"
      class="mb-4"
    >
      <a-divider>Descargas en curso</a-divider>
      <div class="space-y-2">
        <div
          v-for="task in inProgressDownloads"
          :key="task.id"
          class="flex items-center justify-between bg-gray-100 px-3 py-2 text-sm"
        >
          <div class="truncate">
            {{ task.title || task.url }}
          </div>
          <div class="text-gray-600">
            {{ task.statusLabel }}
          </div>
        </div>
      </div>
    </div>

    <a-divider>Descargar</a-divider>
    <div
      v-if="isError"
      class="px-2 py-1 bg-red-300 text-red-700 mb-4"
    >
      {{ errorMessage }}.
    </div>
    <a-form
      layout="vertical"
      class="space-y-3 mx-auto"
      :disabled="formDisabled"
      @submit.prevent="saveSong"
    >
      <a-form-item label="URL de Apple Music / Youtube">
        <a-input
          v-model:value="url"
          class="w-full"
          autofocus
          placeholder="URL"
          @change="onURLChange"
        />
      </a-form-item>

      <a-form-item
        v-if="showMetadataField"
        label="URL de metadata (Spotify / Shazam)"
      >
        <a-input
          v-model:value="metadataUrl"
          class="w-full"
          placeholder="Pega el enlace de Spotify o Shazam"
          @change="onMetadataURLChange"
        />
      </a-form-item>

      <div
        v-if="coverUrl"
        class="mt-2"
      >
        <img
          :src="coverUrl"
          alt="Portada"
          class="w-48 h-48 object-cover rounded border border-gray-300"
        >
      </div>

      <a-form-item label="Título">
        <a-input
          v-model:value.lazy="song"
          class="w-full"
          autofocus
          placeholder="Título de la canción"
        />
      </a-form-item>

      <a-alert
        v-if="notFoundArtist"
        :message="`No se encontró coincidencia exacta para (${notFoundArtist}).`"
        type="info"
      >
        <template #action>
          <a-button
            size="small"
            type="primary"
            @click="addNewArtist(notFoundArtist)"
          >
            Crear
          </a-button>
        </template>
      </a-alert>

      <a-form-item
        v-for="total in totalArtists"
        :key="total"
        :label="`Artista ${total > 1 ? total : ''}`"
      >
        <a-select
          v-model:value="selectedArtists[total]"
          :allow-clear="true"
          class="mb-1"
          show-search
          placeholder="Seleccione..."
          style="width: 100%"
          :options="localArtists.map(item => ({ label: item.name, value: item.id }))"
          :filter-option="filterOption"
        />
      </a-form-item>

      <div>
        <a-button
          @click="addArtist"
        >
          Agregar artista {{ totalArtists + 1 }}
        </a-button>
      </div>

      <a-form-item
        v-for="total in totalComposers"
        :key="total"
        :label="`Compositor ${total > 1 ? total : ''}`"
      >
        <a-select
          v-model:value="selectedComposers[total]"
          :allow-clear="true"
          class="mb-1"
          show-search
          placeholder="Seleccione..."
          style="width: 100%"
          :options="localArtists.map(item => ({ label: item.name, value: item.id }))"
          :filter-option="filterOption"
        />
      </a-form-item>

      <div>
        <a-button
          @click="addComposer"
        >
          Agregar compositor {{ totalComposers + 1 }}
        </a-button>
      </div>

      <a-form-item label="Etiquetas">
        <a-select
          v-model:value="selectedTags"
          mode="tags"
          style="width: 100%"
          :options="tags.map(item => ({ value: item.name }))"
          @change="onTagsChange"
        />
      </a-form-item>

      <a-form-item label="Nota (solo local)">
        <a-textarea
          v-model:value="noteText"
          :rows="3"
          placeholder="Escribe una nota para esta canción"
          allow-clear
        />
      </a-form-item>

      <a-button
        type="primary"
        html-type="submit"
        size="large"
        class="flex items-center space-x-1"
        :disabled="selectedTags.length === 0"
      >
        <Icon
          v-if="!isSaving"
          icon="ic:sharp-file-download"
          class="w-5 h-5"
        />
        Descargar
      </a-button>
    </a-form>
  </div>
</template>

<script setup>
import { computed, nextTick, ref, watch, defineEmits, onMounted, onUnmounted } from 'vue'
import axios from 'axios'
import { Icon } from '@iconify/vue'
import * as cheerio from 'cheerio'

// Download
const url = ref('')
const songId = ref('')
const songDuration = ref(0)
const songDurationOriginal = ref('')
const song = ref('')
const totalArtists = ref(1)
const totalComposers = ref(1)
const selectedTags = ref([])
const selectedArtists = ref([])
const selectedComposers = ref([])
const metadataUrl = ref('')
const coverUrl = ref('')
const isAppleLink = ref(false)
const isError = ref(false)
const errorMessage = ref('')
const noteText = ref('')
const emit = defineEmits(['downloaded', 'artists-updated'])
const localArtists = ref([])
const notFoundArtist = ref(null)
const formDisabled = ref(true)
const isInferringGenre = ref(false)
const downloadTasks = ref([])
const inProgressDownloads = computed(() => downloadTasks.value.filter((task) => task.status !== 'done' && task.status !== 'error'))
const isSaving = computed(() => inProgressDownloads.value.length > 0)
const TASKS_STORAGE_KEY = 'vmusic_download_tasks'
const COVER_MAP_STORAGE_KEY = 'vmusic_cover_map'
const NOTES_STORAGE_KEY = 'vmusic_song_notes'
const DOWNLOAD_TASK_TIMEOUT_MS = 5 * 60 * 1000
let downloadTasksWatchdog = null

function now() {
  return Date.now()
}

function normalizeArtistName(value) {
  return (value || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&|\+/g, ' y ')
    .replace(/\band\b/g, ' y ')
    .replace(/\bfeat(?:\.|uring)?\b/g, ' ')
    .replace(/\bft\.?\b/g, ' ')
    .replace(/\bx\b/g, ' y ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeExactArtistName(value) {
  return (value || '')
    .toString()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeSearchText(value) {
  return (value || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function artistTokens(value) {
  return normalizeArtistName(value).split(' ')
    .filter((token) => token.length > 0)
}

function splitArtistCandidates(value) {
  const raw = (value || '').toString().trim()
  if (!raw) return []

  const chunks = raw.split(/\s*(?:,|;|\/|&|\+|\s+y\s+|\s+and\s+|\s+feat\.?\s+|\s+featuring\s+|\s+ft\.?\s+|\s+x\s+)\s*/i)
  const dedup = new Set([raw, ...chunks])

  return [...dedup]
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
}

function artistSpecificity(value) {
  const normalized = normalizeArtistName(value)
  if (!normalized) return 0
  const tokens = normalized.split(' ')
    .filter((token) => token.length > 0)

  return (tokens.length * 1000) + normalized.length
}

function shouldReplaceBest(bestScore, bestArtist, nextScore, nextArtistName) {
  if (nextScore > bestScore) return true
  if (nextScore < bestScore) return false
  if (!bestArtist) return true

  const bestSpecificity = artistSpecificity(bestArtist?.name || '')
  const nextSpecificity = artistSpecificity(nextArtistName || '')

  return nextSpecificity > bestSpecificity
}

function scoreArtistSimilarity(a, b) {
  const normalizedA = normalizeArtistName(a)
  const normalizedB = normalizeArtistName(b)
  if (!normalizedA || !normalizedB) return 0
  if (normalizedA === normalizedB) return 1

  const shortest = Math.min(normalizedA.length, normalizedB.length)
  if (shortest >= 4 && (normalizedA.includes(normalizedB) || normalizedB.includes(normalizedA))) {
    return 0.92
  }

  const tokensA = new Set(artistTokens(a))
  const tokensB = new Set(artistTokens(b))
  if (tokensA.size <= 0 || tokensB.size <= 0) return 0

  let common = 0
  for (const token of tokensA) {
    if (tokensB.has(token)) common += 1
  }

  const base = common / Math.max(tokensA.size, tokensB.size)
  const firstA = [...tokensA][0]
  const firstB = [...tokensB][0]
  const startsEqual = firstA && firstB && firstA === firstB ? 0.08 : 0

  return Math.min(1, base + startsEqual)
}

function findBestArtistMatch(name) {
  const artistList = localArtists.value.length > 0 ? localArtists.value : props.artists
  if (!name || !Array.isArray(artistList) || artistList.length <= 0) return null

  const normalizedFullName = normalizeArtistName(name)
  const fullNameTokens = artistTokens(name)
  const candidates = splitArtistCandidates(name)
  let bestArtist = null
  let bestScore = 0

  // Phase 1: prioritize the complete metadata artist string.
  artistList.forEach((artist) => {
    const artistName = artist?.name || ''
    if (!artistName) return

    const normalizedArtistName = normalizeArtistName(artistName)
    let score = scoreArtistSimilarity(name, artistName)

    if (normalizedFullName && normalizedArtistName === normalizedFullName) {
      score = 1
    }

    if (fullNameTokens.length > 1 && artistTokens(artistName).length === 1 && score < 1) {
      score -= 0.12
    }

    if (shouldReplaceBest(bestScore, bestArtist, score, artistName)) {
      bestScore = score
      bestArtist = artist
    }
  })

  if (bestScore >= 0.95) return bestArtist

  // Phase 2: fallback to splitted candidates if full-name match is weak.
  artistList.forEach((artist) => {
    const artistName = artist?.name || ''
    if (!artistName) return

    candidates.forEach((candidate) => {
      let score = scoreArtistSimilarity(candidate, artistName)

      if (fullNameTokens.length > 1 && artistTokens(artistName).length === 1 && score < 1) {
        score -= 0.12
      }

      if (shouldReplaceBest(bestScore, bestArtist, score, artistName)) {
        bestScore = score
        bestArtist = artist
      }
    })
  })

  return bestScore >= 0.8 ? bestArtist : null
}

function findArtistMatchDetails(name) {
  const artistList = localArtists.value.length > 0 ? localArtists.value : props.artists
  if (!name || !Array.isArray(artistList) || artistList.length <= 0) {
    return { artist: null, isPerfect: false }
  }

  const normalizedExactInput = normalizeExactArtistName(name)
  const perfectArtist = artistList.find((artist) => normalizeExactArtistName(artist?.name || '') === normalizedExactInput) || null
  if (perfectArtist) {
    return { artist: perfectArtist, isPerfect: true }
  }

  return { artist: findBestArtistMatch(name), isPerfect: false }
}

function normalizeTask(task) {
  const createdAt = typeof task?.createdAt === 'number' ? task.createdAt : now()
  const updatedAt = typeof task?.updatedAt === 'number' ? task.updatedAt : createdAt
  const status = task?.status || 'downloading'

  return {
    ...task,
    status,
    statusLabel: task?.statusLabel || (status === 'saving' ? 'Guardando...' : 'Descargando...'),
    createdAt,
    updatedAt
  }
}

function syncTasksToStorage() {
  localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(downloadTasks.value))
}

function setTaskStatus(task, status, statusLabel) {
  task.status = status
  task.statusLabel = statusLabel
  task.updatedAt = now()
  syncTasksToStorage()
}

function removeTask(taskId) {
  downloadTasks.value = downloadTasks.value.filter((item) => item.id !== taskId)
  syncTasksToStorage()
}

function cleanupTimedOutTasks() {
  const current = now()
  const before = downloadTasks.value.length

  downloadTasks.value = downloadTasks.value.filter((task) => {
    if (task.status === 'done' || task.status === 'error') return true
    const age = current - (task.updatedAt || task.createdAt || current)

    return age <= DOWNLOAD_TASK_TIMEOUT_MS
  })

  if (downloadTasks.value.length !== before) {
    syncTasksToStorage()
  }
}

function saveNoteLocally(ytid, note) {
  if (!ytid) return
  try {
    const stored = localStorage.getItem(NOTES_STORAGE_KEY)
    const parsed = stored ? JSON.parse(stored) : {}
    if (note && note.trim().length > 0) {
      parsed[ytid] = note.trim()
    } else {
      delete parsed[ytid]
    }
    localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(parsed))
  } catch (error) {
    // ignore storage errors
  }
}

function resetForm() {
  url.value = ''
  song.value = ''
  metadataUrl.value = ''
  coverUrl.value = ''
  noteText.value = ''
  selectedTags.value = []
  selectedArtists.value = []
  selectedComposers.value = []
  totalArtists.value = 1
  totalComposers.value = 1
  notFoundArtist.value = null
  isAppleLink.value = false
  formDisabled.value = false
}

// Mostrar campo extra para cualquier fuente que no sea Apple Music
const showMetadataField = computed(() => url.value && !isAppleLink.value)

const props = defineProps({
  tags: {
    type: Array,
    required: true
  },
  artists: {
    type: Array,
    required: true
  },
  selectedArtist: {
    type: [Number, null],
    required: false,
    default: null
  }
})

watch(() => props.artists, (n, o) => {
  if (n && n.length > 0) {
    localArtists.value = [...n]

    window.electron2.getClipboardText().then((text) => {
      const trimmed = (text || '').trim()
      const isApple = trimmed.includes('music.apple')
      const isYoutube = trimmed.includes('youtube.com') || trimmed.includes('youtu.be')

      if (isApple || isYoutube) {
        url.value = text
        const urlObject = { target: { value: url.value } }
        onURLChange(urlObject)
      } else {
        formDisabled.value = false
      }
    })
  }
})

watch(() => props.selectedArtist, (n, o) => {
  if (n) {
    totalArtists.value = 1
    selectedArtists.value[1] = n
  }
})

watch(() => selectedArtists.value[1], (artistId) => {
  autoSelectGenreFromArtist(artistId)
})

function saveSong() {
  window.electron2.emptyClipboard()
  isError.value = false
  errorMessage.value = ''
  const noteForSong = noteText.value

  const artistIds = selectedArtists.value.filter((item) => item)
  const composerIds = selectedComposers.value.filter((item) => item)
  const trimmedUrl = url.value.trim()
  const trimmedSong = song.value.trim()

  const isValidSource = trimmedUrl.includes('music.apple') || trimmedUrl.includes('youtube.com') || trimmedUrl.includes('youtu.be')
  const normalizedTags = selectedTags.value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item) => item.length > 0)

  if (
    normalizedTags.length <= 0 || artistIds.length <= 0 || trimmedUrl.length <= 0 || trimmedSong.length <= 0
  ) {
    errorMessage.value = 'La información está incompleta'
    isError.value = true
  } else if (!isValidSource) {
    errorMessage.value = 'La URL principal debe ser de Apple Music o YouTube'
    isError.value = true
  } else {
    const taskId = `${Date.now()}-${Math.random().toString(16)
      .slice(2)}`
    const task = {
      id: taskId,
      url: trimmedUrl,
      title: trimmedSong,
      status: 'downloading',
      statusLabel: 'Descargando...',
      createdAt: now(),
      updatedAt: now()
    }
    const coverFromMeta = coverUrl.value || ''

    downloadTasks.value = [task, ...downloadTasks.value]
    syncTasksToStorage()
    resetForm()

    const payload = {
      url: trimmedUrl,
      song: trimmedSong,
      artists: artistIds,
      composers: composerIds,
      duration: songDuration.value,
      durationOriginal: songDurationOriginal.value,
      songTags: normalizedTags,
      coverUrl: coverFromMeta
    }

    axios
      .post('http://localhost:3000/download', { url: payload.url })
      .then(function(response) {
        const ytid = response.data?.ytid || response.data
        if (!ytid) {
          throw new Error('No se recibió el identificador (ytid) de la descarga')
        }
        payload.ytid = ytid
        saveNoteLocally(ytid, noteForSong)
        setTaskStatus(task, 'saving', 'Guardando...')

        return axios.post('http://localhost:3000/songs/save', {
          ytid: payload.ytid,
          song: payload.song,
          artists: payload.artists,
          composers: payload.composers,
          duration: payload.duration,
          durationOriginal: payload.durationOriginal,
          songTags: payload.songTags
        })
      })
      .then(function() {
        emit('downloaded', artistIds)
        setTaskStatus(task, 'done', 'Completada')
        if (payload.ytid && payload.coverUrl) {
          try {
            const stored = localStorage.getItem(COVER_MAP_STORAGE_KEY)
            const parsed = stored ? JSON.parse(stored) : {}
            parsed[payload.ytid] = payload.coverUrl
            localStorage.setItem(COVER_MAP_STORAGE_KEY, JSON.stringify(parsed))
          } catch (error) {
            // ignore storage issues
          }
        }
      })
      .catch(function(error) {
        setTaskStatus(task, 'error', 'Error')
        isError.value = true
        errorMessage.value = error.response?.data?.message || error.message || 'Error al descargar'
      })
      .finally(function() {
        if (task.status === 'done' || task.status === 'error') {
          removeTask(task.id)
        }
      })
  }
}

function addArtist() {
  totalArtists.value += 1
}

function addComposer() {
  totalComposers.value += 1
}

async function onTagsChange(e) {
}

function normalizeTagName(tagName) {
  return (tagName || '').trim()
}

function isIgnoredGenre(tagName) {
  const normalized = normalizeTagName(tagName).toLowerCase()

  return normalized === 'agregado-reciente' || normalized === 'reciente'
}

async function autoSelectGenreFromArtist(artistId) {
  if (!artistId || isInferringGenre.value) return

  isInferringGenre.value = true
  try {
    const response = await axios.post('http://localhost:3000/songs/filter-by-artist', {
      artists: [artistId]
    })

    const songs = Array.isArray(response.data?.songs) ? response.data.songs : []
    const counts = new Map()

    songs.forEach((songItem) => {
      const tags = Array.isArray(songItem?.Tags) ? songItem.Tags : []
      tags.forEach((tag) => {
        const tagName = normalizeTagName(tag?.name || '')
        if (!tagName || isIgnoredGenre(tagName)) return
        counts.set(tagName, (counts.get(tagName) || 0) + 1)
      })
    })

    if (counts.size <= 0) return

    const [genreName] = [...counts.entries()].sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1]

      return a[0].localeCompare(b[0])
    })[0]

    if (genreName) {
      selectedTags.value = [genreName]
    }
  } catch (error) {
    console.warn('No se pudo inferir género por artista', error?.message || error)
  } finally {
    isInferringGenre.value = false
  }
}

async function onURLChange(e) {
  notFoundArtist.value = null
  selectedArtists.value[1] = null
  totalArtists.value = 1
  metadataUrl.value = ''
  coverUrl.value = ''
  isAppleLink.value = e.target.value.includes('music.apple')

  const isValidSource = e.target.value.includes('music.apple') || e.target.value.includes('youtube.com') || e.target.value.includes('youtu.be')
  if (!isValidSource) {
    formDisabled.value = false

    return
  }

  if (isAppleLink.value) {
    const response = await fetch(e.target.value)
    const html = await response.text()
    const $ = cheerio.load(html)
    const songInfo = JSON.parse($('script').first()
      .text())

    const title = songInfo.name.charAt(0).toUpperCase() + songInfo.name.slice(1).toLowerCase()
    await nextTick()
    song.value = title
    coverUrl.value = songInfo.image ? songInfo.image.replace('1200', '200') : ''

    let tempArtist = null
    if (songInfo.audio.byArtist.length > 0) {
      tempArtist = songInfo.audio.byArtist[0].name
    }

    const { artist: match, isPerfect } = findArtistMatchDetails(tempArtist)

    if (match) {
      await nextTick()
      selectedArtists.value[1] = match.id
      notFoundArtist.value = isPerfect ? null : tempArtist
    } else {
      notFoundArtist.value = tempArtist
    }
  } else {
    formDisabled.value = false
  }

  formDisabled.value = false
}

async function onMetadataURLChange(e) {
  isError.value = false
  errorMessage.value = ''
  const value = e.target.value.trim()
  metadataUrl.value = value
  coverUrl.value = ''

  if (!value) return

  const isSpotify = value.includes('open.spotify.com')
  const isShazam = value.includes('shazam.com/song/')
  if (!isSpotify && !isShazam) {
    isError.value = true
    errorMessage.value = 'La URL de metadata debe ser de Spotify o Shazam'

    return
  }

  try {
    const response = await fetch(value)
    const html = await response.text()
    const $ = cheerio.load(html)

    const image = $('meta[property=\"og:image\"]').attr('content') || $('meta[name=\"twitter:image\"]').attr('content')
    let title = null
    let artist = null

    if (isSpotify) {
      title = $('meta[property=\"og:title\"]').attr('content')
      artist = $('meta[name=\"music:musician_description\"]').attr('content') || $('meta[property=\"music:musician\"]').attr('content') || $('meta[property=\"og:description\"]').attr('content')
        ?.split(' · ')?.[0]
    } else {
      const ogTitle = $('meta[property=\"og:title\"]').attr('content') || $('meta[name=\"twitter:title\"]').attr('content') || ''
      const cleanOgTitle = ogTitle.replace(/\s*\|\s*Shazam.*$/i, '').trim()
      if (cleanOgTitle.includes(' - ')) {
        const [track, artistPart] = cleanOgTitle.split(' - ')
        title = track?.trim() || null
        artist = artistPart?.trim() || null
      } else {
        title = cleanOgTitle || null
      }

      if (!artist) {
        const jsonLdText = $('script[type=\"application/ld+json\"]').first()
          .text()
        if (jsonLdText) {
          try {
            const parsed = JSON.parse(jsonLdText)
            const metadata = Array.isArray(parsed) ? parsed.find((i) => i?.['@type'] === 'MusicRecording') : parsed
            if (!title) {
              title = metadata?.name || null
            }
            artist = metadata?.byArtist?.name || metadata?.byArtist?.[0]?.name || artist
          } catch (error) {
            // ignore invalid json-ld
          }
        }
      }

      if (!artist) {
        const description = $('meta[property=\"og:description\"]').attr('content') || $('meta[name=\"description\"]').attr('content') || ''
        const match = description.match(/listen to\s+(.+?)\s+by\s+(.+?)(?:\s+on\s+|$)/i)
        if (match) {
          if (!title) {
            title = match[1]?.trim() || null
          }
          artist = match[2]?.trim() || null
        }
      }
    }

    coverUrl.value = image || ''

    await fillSongAndArtist(title, artist)
  } catch (err) {
    isError.value = true
    errorMessage.value = 'No se pudo extraer la información del enlace de metadata'
  }
}

async function fillSongAndArtist(title, artistName) {
  if (title) {
    const formattedTitle = title.charAt(0).toUpperCase() + title.slice(1)
    await nextTick()
    song.value = formattedTitle
  }

  if (artistName) {
    const { artist: match, isPerfect } = findArtistMatchDetails(artistName)

    if (match) {
      await nextTick()
      selectedArtists.value[1] = match.id
      notFoundArtist.value = isPerfect ? null : artistName
    } else {
      notFoundArtist.value = artistName
    }
  }
}

const filterOption = (input, option) => {
  const normalizedInput = normalizeSearchText(input)
  const normalizedLabel = normalizeSearchText(option?.label || '')

  return normalizedLabel.includes(normalizedInput)
}

function addNewArtist(name) {
  axios
    .post('http://localhost:3000/artists', {
      name: name.trim()
    })
    .then(function(response) {
      emit('artists-updated', response.data.id)
      notFoundArtist.value = null
    })
    .catch(function(error) {
      artistError.value = error.response.data.message
    })
    .finally(function() {
      // always executed
    })
}

onMounted(() => {
  const stored = localStorage.getItem(TASKS_STORAGE_KEY)
  if (stored) {
    try {
      const parsed = JSON.parse(stored)
      if (Array.isArray(parsed)) {
        downloadTasks.value = parsed.map((task) => normalizeTask(task))
      }
    } catch (error) {
      // ignore invalid cache
    }
  }
  cleanupTimedOutTasks()
  downloadTasksWatchdog = setInterval(cleanupTimedOutTasks, 5000)
})

onUnmounted(() => {
  if (downloadTasksWatchdog) {
    clearInterval(downloadTasksWatchdog)
    downloadTasksWatchdog = null
  }
})
</script>
