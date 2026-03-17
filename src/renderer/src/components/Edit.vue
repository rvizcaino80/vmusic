<template>
  <div class="overflow-y-auto">
    <form
      class="space-y-3 max-w-[80%] mx-auto"
      @submit.prevent="saveSong"
    >
      <div>
        <a-button
          type="default"
          class="mb-3"
          :href="url"
          target="_blank"
        >
          {{ isAppleMusic ? 'Ver original en Apple Music' : 'Ver original en Youtube' }}
        </a-button>

        <label class="text-sm text-gray-500 block">Artista</label>
        <div
          v-for="total in totalArtists"
          :key="total"
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
        </div>

        <div class="mt-2">
          <a-button
            @click="addArtist"
          >
            Agregar artista {{ totalArtists + 1 }}
          </a-button>
        </div>
      </div>

      <div>
        <label class="text-sm text-gray-500 block">Compositor</label>
        <div
          v-for="total in totalComposers"
          :key="total"
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
        </div>

        <div class="mt-2">
          <a-button
            @click="addComposer"
          >
            Agregar compositor {{ totalComposers + 1 }}
          </a-button>
        </div>
      </div>

      <div>
        <label class="text-sm text-gray-500 block">Título</label>
        <a-input
          v-model:value.lazy="song"
          class="w-full"
          autofocus
          placeholder="Título de la canción"
        />
      </div>

      <div>
        <div class="flex items-center justify-between">
          <label class="text-sm text-gray-500 block">URL de portada o metadata</label>
          <div class="flex items-center gap-3">
            <a
              href="#"
              class="text-sm hover:underline"
              style="color: var(--vm-ant-primary);"
              @click.prevent="selectCoverFromDisk"
            >
              Seleccionar imagen
            </a>
            <a
              v-if="spotifySearchUrl"
              :href="spotifySearchUrl"
              class="text-sm hover:underline"
              style="color: var(--vm-ant-primary);"
              target="_blank"
              rel="noopener"
            >Buscar en Spotify</a>
          </div>
        </div>
        <a-input
          v-model:value="metadataUrl"
          class="w-full"
          placeholder="Pega una URL de imagen, Spotify o Shazam"
        />
      </div>

      <div>
        <label class="text-sm text-gray-500 block">Etiquetas</label>
        <a-checkbox-group
          v-model:value="selectedTags"
          name="checkboxgroup"
          :options="tags.map(item => ({ label: item.name, value: item.id }))"
          class="flex flex-col space-y-1"
        />
      </div>

      <div>
        <label class="text-sm text-gray-500 block">Nota (solo local)</label>
        <a-textarea
          v-model:value="noteText"
          :rows="3"
          placeholder="Escribe una nota para esta canción"
          allow-clear
        />
      </div>

      <a-button
        :disabled="isUpdateDisabled"
        type="primary"
        html-type="submit"
        size="large"
        class="flex items-center space-x-1"
      >
        <Icon
          v-if="isSaving"
          class="w-5 h-5 animate-spin"
          icon="gg:spinner-two-alt"
        />
        <Icon
          v-else
          class="w-5 h-5"
          icon="tdesign:save"
        />
        <span>Actualizar</span>
      </a-button>
    </form>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import axios from 'axios'
import { Icon } from '@iconify/vue'
import * as cheerio from 'cheerio'

// Download
const song = ref('')
const url = ref('')
const ytid = ref('')
const artistIds = ref([])
const totalArtists = ref(1)
const totalComposers = ref(1)
const songTags = ref([])
const tags = ref([])
const artists = ref([])
const isSaving = ref(false)
const selectedTags = ref([])
const selectedArtists = ref([])
const selectedComposers = ref([])
const localArtists = ref([])
const isAppleMusic = ref(false)
const metadataUrl = ref('')
const coverUrl = ref('')
const noteText = ref('')
const isUpdateDisabled = computed(() => isSaving.value || selectedTags.value.length === 0)
const selectedArtistNames = computed(() => {
  const artistIds = Object.values(selectedArtists.value || {}).filter(Boolean)
  if (!artistIds.length) return []
  const artistMap = new Map(localArtists.value.map((item) => [item.id, item.name]))

  return artistIds
    .map((id) => artistMap.get(id))
    .filter(Boolean)
})
const spotifySearchUrl = computed(() => {
  const title = song.value?.trim() || ''
  const artists = selectedArtistNames.value.join(' ').trim()
  const term = `${artists} ${title}`.trim()
  if (!term) return ''

  return `https://open.spotify.com/search/${encodeURIComponent(term)}`
})

const emit = defineEmits(['updated'])
const COVER_MAP_STORAGE_KEY = 'vmusic_cover_map'
const NOTES_STORAGE_KEY = 'vmusic_song_notes'

const props = defineProps({
  id: {
    type: Number,
    required: true
  }
})

onMounted(async() => {
  tags.value = await getTags()
  localArtists.value = await getArtists()

  axios
    .get('http://localhost:3000/songs/' + props.id)
    .then(function(response) {
      url.value = response.data.isAppleMusic ? `https://music.apple.com/co/song/${response.data.ytid}` : `https://www.youtube.com/watch?v=${response.data.ytid}`
      ytid.value = response.data.ytid
      totalArtists.value = response.data.Artists ? response.data.Artists.length : 1
      totalComposers.value = response.data.Composers ? response.data.Composers.length : 1
      song.value = response.data.name
      isAppleMusic.value = response.data.isAppleMusic

      if (totalArtists.value > 0) {
        response.data.Artists.forEach((item, index) => {
          selectedArtists.value[index + 1] = item.id
        })
      } else {
        totalArtists.value = 1
      }

      if (response.data.Composers && response.data.Composers.length > 0) {
        response.data.Composers.forEach((item, index) => {
          selectedComposers.value[index + 1] = item.id
        })
      } else {
        totalComposers.value = 1
      }

      selectedTags.value = response.data.Tags.map((item) => (item.id))
      coverUrl.value = getStoredCoverUrl(response.data.ytid)
      loadNote()
    })
    .catch(function(error) {
      console.log(error)
    })
    .finally(function() {
      // always executed
    })
})

async function getTags() {
  const response = await fetch('http://localhost:3000/tags')
  const data = await response.json()
  let indexedData = []
  if (data?.data && typeof data.data === 'object' && !Array.isArray(data.data) && Object.keys(data.data).every((key) => (/^\d+$/).test(key))) {
    indexedData = Object.keys(data.data).map((key) => Number(key))
      .sort((a, b) => a - b)
      .map((index) => data.data[String(index)])
  }
  const normalized = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : indexedData

  return normalized.sort((a, b) => a.name.localeCompare(b.name)).filter((t) => t.id !== 9998)
}

async function getArtists() {
  const response = await fetch('http://localhost:3000/artists')
  const data = await response.json()
  let indexedData = []
  if (data?.data && typeof data.data === 'object' && !Array.isArray(data.data) && Object.keys(data.data).every((key) => (/^\d+$/).test(key))) {
    indexedData = Object.keys(data.data).map((key) => Number(key))
      .sort((a, b) => a - b)
      .map((index) => data.data[String(index)])
  }
  const normalized = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : indexedData

  return normalized.sort((a, b) => a.name.localeCompare(b.name))
}

function saveSong() {
  if (isUpdateDisabled.value) return

  isSaving.value = true
  const note = noteText.value

  let artistIds = selectedArtists.value.filter((item) => item)
  let composerIds = selectedComposers.value.filter((item) => item)

  const metadataPromise = metadataUrl.value.trim().length > 0 ? resolveCoverFromInput(metadataUrl.value.trim()) : Promise.resolve(coverUrl.value || null)

  metadataPromise.then(async(cover) => {
    if (cover) {
      coverUrl.value = cover
      if (
        ytid.value &&
        window.electron2?.cacheCoverImage &&
        /^https?:/i.test(coverUrl.value)
      ) {
        const cachedCoverUrl = await window.electron2.cacheCoverImage({
          cacheKey: ytid.value,
          url: coverUrl.value,
          forceRefresh: true
        })
        if (cachedCoverUrl) {
          coverUrl.value = cachedCoverUrl
        }
      }
    }
    if (ytid.value && coverUrl.value) {
      try {
        const stored = localStorage.getItem(COVER_MAP_STORAGE_KEY)
        const parsed = stored ? JSON.parse(stored) : {}
        parsed[ytid.value] = coverUrl.value
        localStorage.setItem(COVER_MAP_STORAGE_KEY, JSON.stringify(parsed))
      } catch (error) {
        // ignore storage issues
      }
    }
  }).finally(() => {
    axios
      .post('http://localhost:3000/songs/update/' + props.id, {
        name: song.value,
        artists: artistIds,
        composers: composerIds,
        tags: selectedTags.value
      })
      .then(function(response) {
        saveNoteLocally(ytid.value, note)
        emit('updated', { id: props.id, coverUrl: coverUrl.value || '', ytid: ytid.value || '' })
      })
      .catch(function(error) {})
      .finally(function() {
        isSaving.value = false
      })
  })
}

async function resolveCoverFromInput(value) {
  try {
    const isSpotify = value.includes('open.spotify.com')
    const isShazam = value.includes('shazam.com/song/')
    if (isSpotify || isShazam) {
      const response = await fetch(value)
      const html = await response.text()
      const $ = cheerio.load(html)

      return $('meta[property="og:image"]').attr('content') || $('meta[name="twitter:image"]').attr('content') || null
    }

    const parsed = new URL(value)
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString()
    }
  } catch (error) {
    return null
  }

  return null
}

function getStoredCoverUrl(ytidValue) {
  if (!ytidValue) return ''

  try {
    const stored = localStorage.getItem(COVER_MAP_STORAGE_KEY)
    const parsed = stored ? JSON.parse(stored) : {}

    return parsed[ytidValue] || ''
  } catch (error) {
    return ''
  }
}

async function selectCoverFromDisk() {
  if (!ytid.value || !window.electron2?.importCoverFile) return

  try {
    const importedCoverUrl = await window.electron2.importCoverFile({ cacheKey: ytid.value })
    if (!importedCoverUrl) return

    coverUrl.value = importedCoverUrl
    const stored = localStorage.getItem(COVER_MAP_STORAGE_KEY)
    const parsed = stored ? JSON.parse(stored) : {}
    parsed[ytid.value] = importedCoverUrl
    localStorage.setItem(COVER_MAP_STORAGE_KEY, JSON.stringify(parsed))
  } catch (error) {
    console.warn('[vmusic][edit] no se pudo importar portada', error)
  }
}

function addArtist() {
  totalArtists.value += 1
}

function addComposer() {
  totalComposers.value += 1
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

const filterOption = (input, option) => {
  const normalizedInput = normalizeSearchText(input)
  const normalizedLabel = normalizeSearchText(option?.label || '')

  return normalizedLabel.includes(normalizedInput)
}

function saveNoteLocally(ytidValue, note) {
  if (!ytidValue) return
  try {
    const stored = localStorage.getItem(NOTES_STORAGE_KEY)
    const parsed = stored ? JSON.parse(stored) : {}
    if (note && note.trim().length > 0) {
      parsed[ytidValue] = note.trim()
    } else {
      delete parsed[ytidValue]
    }
    localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(parsed))
    window.dispatchEvent(new CustomEvent('vmusic-song-notes-changed'))
  } catch (error) {
    // ignore
  }
}

function loadNote() {
  if (!ytid.value) return
  try {
    const stored = localStorage.getItem(NOTES_STORAGE_KEY)
    const parsed = stored ? JSON.parse(stored) : {}
    noteText.value = parsed[ytid.value] || ''
  } catch (error) {
    noteText.value = ''
  }
}
</script>
