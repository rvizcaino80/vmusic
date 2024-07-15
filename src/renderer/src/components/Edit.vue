<script setup>
import { onMounted, ref } from "vue";
import axios from 'axios'
import { Icon } from '@iconify/vue'

// Download
const song = ref('')
const artistIds = ref([])
const totalArtists = ref(1)
const songTags = ref([])
const tags = ref([])
const artists = ref([])
const isSaving = ref(false)

const emit = defineEmits(['updated'])

const props = defineProps({
  id: {
    type: Number,
    required: true
  }
})

onMounted(() => {
  getTags()
  getArtists()
  axios
    .get('http://localhost:3000/songs/' + props.id)
    .then(function (response) {
      totalArtists.value = response.data.Artists.length
      song.value = response.data.name
      artistIds.value = response.data.Artists.map(item => (item.id))
      songTags.value = response.data.Tags.map(item => (item.id))
    })
    .catch(function (error) {
      console.log(error)
    })
    .finally(function () {
      // always executed
    })
})

function getTags() {
  axios
    .get('http://localhost:3000/tags')
    .then(function (response) {
      tags.value = response.data
    })
    .catch(function (error) {
      // handle error
      console.log(error)
    })
    .finally(function () {
      // always executed
    })
}

function getArtists() {
  axios
    .get('http://localhost:3000/artists')
    .then(function (response) {
      artists.value = response.data
    })
    .catch(function (error) {})
    .finally(function () {
      // always executed
    })
}

function saveSong() {
  isSaving.value = true

  artistIds.value = []
  const elements = document.querySelectorAll('.artist')
  elements.forEach((e) => {
    if(parseInt(e.value)) {
      artistIds.value.push(parseInt(e.value))
    }
  })

  axios
    .post('http://localhost:3000/songs/update/'  + props.id, {
      name: song.value,
      artists: artistIds.value.map((item) => item),
      tags: songTags.value.map((item) => item)
    })
    .then(function (response) {
      emit('updated')
    })
    .catch(function (error) {})
    .finally(function () {
      // always executed
    })
}

function addArtist() {
  totalArtists.value += 1
}
</script>

<template>
  <div>
    <form class="space-y-3 max-w-[80%] mx-auto" @submit.prevent="saveSong">
      <div>
        <label class="text-sm text-gray-500 block">Artista</label>
        <div class="space-y-2">
          <select v-for="index in totalArtists" autofocus class="w-full block artist">
            <option value="">-- Vacío --</option>
            <option
              v-for="artist in artists"
              :key="artist.id"
              :selected="artistIds[index-1] === artist.id"
              :value="artist.id"
            >
              {{ artist.name }}
            </option>
          </select>
        </div>

        <div class="mt-2">
          <button @click="addArtist" type="button" class="text-sm py-1 px-2 text-gray-800 bg-gray-400">
            Agregar artista {{ totalArtists + 1 }}
          </button>
        </div>
      </div>

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
        :disabled="isSaving"
        type="submit"
        class="p-2 border border-gray-800 bg-gray-800 text-white flex items-center space-x-1 font-bold"
      >
        <Icon v-if="isSaving" class="w-5 h-5 animate-spin" icon="gg:spinner-two-alt" />
        <Icon v-else class="w-5 h-5" icon="tdesign:save" />
        <span>Actualizar</span>
      </button>
    </form>
  </div>
</template>
