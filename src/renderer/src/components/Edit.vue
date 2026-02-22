<template>
  <div class="overflow-y-auto">
    <form
      class="space-y-3 max-w-[80%] mx-auto"
      @submit.prevent="saveSong"
    >
      <div>
        <a-typography-link
          class="mb-3 block"
          :href="url"
          target="_blank"
        >
          {{ isAppleMusic ? 'Ver original en Apple Music' : 'Ver original en Youtube' }}
        </a-typography-link>

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
          <button
            type="button"
            class="text-sm py-1 px-2 text-gray-800 bg-gray-400"
            @click="addArtist"
          >
            Agregar artista {{ totalArtists + 1 }}
          </button>
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
          <button
            type="button"
            class="text-sm py-1 px-2 text-gray-800 bg-gray-400"
            @click="addComposer"
          >
            Agregar compositor {{ totalComposers + 1 }}
          </button>
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
        <label class="text-sm text-gray-500 block">URL de metadata (Spotify / Shazam)</label>
        <a-input
          v-model:value="metadataUrl"
          class="w-full"
          placeholder="Pega el enlace de Spotify o Shazam"
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

      <button
        :disabled="isUpdateDisabled"
        type="submit"
        class="p-2 border border-gray-800 bg-gray-800 text-white flex items-center space-x-1 font-bold disabled:opacity-60 disabled:cursor-not-allowed"
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
      </button>
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

  return data.sort((a, b) => a.name.localeCompare(b.name)).filter((t) => t.id !== 9998)
}

async function getArtists() {
  const response = await fetch('http://localhost:3000/artists')
  const data = await response.json()

  return data.sort((a, b) => a.name.localeCompare(b.name))
}

function saveSong() {
  if (isUpdateDisabled.value) return

  isSaving.value = true
  const note = noteText.value

  let artistIds = selectedArtists.value.filter((item) => item)
  let composerIds = selectedComposers.value.filter((item) => item)

  const metadataPromise = metadataUrl.value.trim().length > 0 ? extractCoverFromMetadata(metadataUrl.value.trim()) : Promise.resolve(null)

  metadataPromise.then((cover) => {
    coverUrl.value = cover || ''
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
        emit('updated', props.id)
      })
      .catch(function(error) {})
      .finally(function() {
        isSaving.value = false
      })
  })
}

async function extractCoverFromMetadata(value) {
  try {
    const isSpotify = value.includes('open.spotify.com')
    const isShazam = value.includes('shazam.com/song/')
    if (isSpotify || isShazam) {
      const response = await fetch(value)
      const html = await response.text()
      const $ = cheerio.load(html)

      return $('meta[property="og:image"]').attr('content') || $('meta[name="twitter:image"]').attr('content') || null
    }
  } catch (error) {
    return null
  }

  return null
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
