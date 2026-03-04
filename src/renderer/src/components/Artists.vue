<template>
  <div class="flex flex-col space-y-6 min-h-[0]">
    <a-divider>Artistas</a-divider>

    <form
      class="space-x-2 flex items-center"
      @submit.prevent="saveArtist"
    >
      <a-input
        id="artistName"
        v-model:value="artistName"
        autofocus
        type="text"
        class="flex-1"
        placeholder="Nombre de artista"
      />
      <a-button
        type="primary"
        html-type="submit"
      >
        Agregar
      </a-button>
    </form>

    <div class="overflow-y-auto">
      <div
        v-for="artist in artists"
        :key="artist.id"
        class="border-bottom border-gray-700 flex-1 space-x-2 pr-3 flex items-center justify-between"
      >
        <a-input
          :id="`a${artist.id}`"
          :key="artist.id"
          type="text"
          class="block border-transparent focus:ring-0 focus:bg-white focus:border-ring-600 bg-transparent w-full text-black px-2 py-0.5 leading-tight text-base"
          :value="artist.name"
          @keyup.enter="updateArtist(artist.id)"
          @blur="updateArtist(artist.id)"
        />

        <a-button
          v-if="artist.Songs.length <= 0"
          size="small"
          @click="del(artist.id)"
        >
          Eliminar
        </a-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import axios from 'axios'

// const props = defineProps({ artists: Array })
const emit = defineEmits(['added'])

const artists = ref([])
const artistError = ref('')
const artistName = ref('')
const artistId = ref(null)

onMounted(() => {
  getArtists()
  document.getElementById('artistName').focus()
})

function getArtists() {
  axios
    .get('http://localhost:3000/artists')
    .then(function(response) {
      const indexedData = response.data?.data && typeof response.data.data === 'object' && !Array.isArray(response.data.data) && Object.keys(response.data.data)
        .every((key) => (/^\d+$/).test(key))
? Object.keys(response.data.data).map((key) => Number(key))
          .sort((a, b) => a - b)
          .map((index) => response.data.data[String(index)])
: []
      const payload = Array.isArray(response.data) ? response.data : Array.isArray(response.data?.data) ? response.data.data : indexedData
      artists.value = payload.sort((a, b) => a.name.localeCompare(b.name))
    })
    .catch(function(error) {
      // handle error
      console.log(error)
    })
    .finally(function() {
      // always executed
    })
}

function del(id) {
  axios
    .post('http://localhost:3000/artists/delete/' + id)
    .then(function(response) {
      artists.value = response.data
    })
    .catch(function(error) {
      // handle error
      console.log(error)
    })
    .finally(function() {
      // always executed
    })
}

function saveArtist() {
  axios
    .post('http://localhost:3000/artists', {
      name: artistName.value
    })
    .then(function(response) {
      getArtists()
      artistError.value = ''
      artistName.value = ''
    })
    .catch(function(error) {
      artistError.value = error.response.data.message
    })
    .finally(function() {
      // always executed
    })
}

function updateArtist(id) {
  const name = document.getElementById(`a${id}`).value
  document.getElementById(`a${id}`).blur()
  axios
    .post('http://localhost:3000/artists/' + id, {
      name: name
    })
    .then(function(response) {

    })
    .catch(function(error) {
      artistError.value = error.response.data.message
    })
    .finally(function() {
      // always executed
    })
}
</script>
