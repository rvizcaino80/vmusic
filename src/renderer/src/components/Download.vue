<template>
  <div class="overflow-y-auto">
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
        label="URL de metadata (Spotify / MusicBrainz / Discogs)"
      >
        <a-input
          v-model:value="metadataUrl"
          class="w-full"
          placeholder="Pega el enlace de Spotify, MusicBrainz o Discogs"
          @change="onMetadataURLChange"
        />
      </a-form-item>

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
        :message="`Artista (${notFoundArtist}) no encontrado.`"
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

      <a-button
        :loading="isSaving"
        type="primary"
        html-type="submit"
        size="large"
        class="flex items-center space-x-1"
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
import { computed, nextTick, ref, watch, defineEmits, onMounted } from 'vue'
import axios from 'axios'
import { Icon } from '@iconify/vue'
import * as cheerio from 'cheerio'
import slugify from '@sindresorhus/slugify'

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
const isAppleLink = ref(false)
const isSaving = ref(false)
const isError = ref(false)
const errorMessage = ref('')
const emit = defineEmits(['downloaded', 'artists-updated'])
const localArtists = ref([])
const notFoundArtist = ref(null)
const formDisabled = ref(true)

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
      if (text.includes('music.apple')) {
        url.value = text
        const urlObject = {}
        urlObject['target'] = {}
        urlObject['target']['value'] = url.value

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

function saveSong() {
  window.electron2.emptyClipboard()
  isError.value = false
  errorMessage.value = ''

  let artistIds = selectedArtists.value.filter((item) => item)
  let composerIds = selectedComposers.value.filter((item) => item)

  const isValidSource = url.value.includes('music.apple') || url.value.includes('youtube.com') || url.value.includes('youtu.be')

  if (
    selectedTags.value.length <= 0 || artistIds.length <= 0 || url.value.length <= 0 || song.value.length <= 0
  ) {
    errorMessage.value = 'La información está incompleta'
    isError.value = true
  } else if (!isValidSource) {
    errorMessage.value = 'La URL principal debe ser de Apple Music o YouTube'
    isError.value = true
  } else {
    isSaving.value = true

    axios
      .post('http://localhost:3000/download', {
        url: url.value
      })
      .then(function(response) {
        songId.value = response.data?.ytid || response.data

        if (!songId.value) {
          throw new Error('No se recibió el identificador (ytid) de la descarga')
        }

        axios
          .post('http://localhost:3000/songs/save', {
            ytid: songId.value,
            song: song.value,
            artists: artistIds,
            composers: composerIds,
            duration: songDuration.value,
            durationOriginal: songDurationOriginal.value,
            songTags: selectedTags.value.map((item) => slugify(item))
          })
          .then(function(response) {
            emit('downloaded', artistIds)
          })
          .catch(function(error) {})
          .finally(function() {
            // always executed
          })
      })
      .catch(function(error) {
        isSaving.value = false
        isError.value = true
        errorMessage.value = error.response?.data?.message || error.message || 'Error al descargar'
      })
      .finally(function() {
        // always executed
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

async function onURLChange(e) {
  notFoundArtist.value = null
  selectedArtists.value[1] = null
  totalArtists.value = 1
  metadataUrl.value = ''
  isAppleLink.value = e.target.value.includes('music.apple')

  if (isAppleLink.value) {
    const response = await fetch(e.target.value)
    const html = await response.text()
    const $ = cheerio.load(html)
    const songInfo = JSON.parse($('script').first()
      .text())

    const title = songInfo.name.charAt(0).toUpperCase() + songInfo.name.slice(1).toLowerCase()
    await nextTick()
    song.value = title

    let tempArtist = null
    if (songInfo.audio.byArtist.length > 0) {
      tempArtist = songInfo.audio.byArtist[0].name
    }

    const a = props.artists.filter((a) => a.name.trim().toLowerCase() === tempArtist.trim().toLowerCase())

    if (a.length > 0) {
      await nextTick()
      selectedArtists.value[1] = a[0].id
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

  if (!value) return

  try {
    if (value.includes('musicbrainz.org')) {
      const response = await fetch(value)
      const html = await response.text()
      const $ = cheerio.load(html)

      const title = $('div.recordingheader h1 bdi').first()
        .text() || $('h1 bdi').first()
        .text()
      const artist = $('div.recordingheader p.subheader bdi').first()
        .text() || $('dd.artist bdi').first()
        .text()

      await fillSongAndArtist(title, artist)
    } else if (value.includes('discogs.com')) {
      const releaseId = value.match(/release\/(\d+)/)?.[1]

      if (releaseId) {
        const apiResponse = await fetch(`https://api.discogs.com/releases/${releaseId}`, {
          headers: {
            'User-Agent': 'v-music-downloader/1.0'
          }
        })

        if (!apiResponse.ok) throw new Error('No se pudo obtener la información de Discogs')

        const data = await apiResponse.json()
        const title = data.title
        const artist = data.artists?.[0]?.name

        await fillSongAndArtist(title, artist)
      }
    } else if (value.includes('open.spotify.com')) {
      const response = await fetch(value)
      const html = await response.text()
      const $ = cheerio.load(html)

      const title = $('meta[property=\"og:title\"]').attr('content')
      const artist = $('meta[name=\"music:musician_description\"]').attr('content') || $('meta[property=\"music:musician\"]').attr('content') || $('meta[property=\"og:description\"]').attr('content')
        ?.split(' · ')?.[0]

      await fillSongAndArtist(title, artist)
    }
  } catch (err) {
    isError.value = true
    errorMessage.value = 'No se pudo extraer la información del enlace adicional'
  }
}

async function fillSongAndArtist(title, artistName) {
  if (title) {
    const formattedTitle = title.charAt(0).toUpperCase() + title.slice(1)
    await nextTick()
    song.value = formattedTitle
  }

  if (artistName) {
    const match = props.artists.filter((a) => a.name.trim().toLowerCase() === artistName.trim().toLowerCase())

    if (match.length > 0) {
      await nextTick()
      selectedArtists.value[1] = match[0].id
    } else {
      notFoundArtist.value = artistName
    }
  }
}

const filterOption = (input, option) => {
  return option.label.toLowerCase().indexOf(input.toLowerCase()) >= 0
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
</script>
