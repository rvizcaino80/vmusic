<template>
  <div>
    <form class="mb-6 space-x-2 flex items-center" @submit.prevent="saveArtist">
      <input
        autofocus
        id="artistName"
        v-model="artistName"
        type="text"
        class="flex-1"
        placeholder="Nombre de artista"
      />
      <button type="submit" class="p-2 border border-gray-800 bg-gray-800 text-white font-bold">
        Agregar
      </button>
    </form>

    <div
      v-for="artist in artists"
      :key="artist.id"
      class="inline-block bg-gray-600 text-white rounded-full px-3 py-1 mb-2 mr-2"
    >
      {{ artist.name }}
    </div>
  </div>
</template>

<script setup>
import { defineEmits, onMounted, ref } from 'vue'
import axios from 'axios'

//const props = defineProps({ artists: Array })
const emit = defineEmits(['added'])

const artists = ref([])
const artistError = ref('')
const artistName = ref('')

onMounted(() => {
  getArtists()
  document.getElementById('artistName').focus()
})

function getArtists() {
  axios
    .get('http://localhost:3000/artists')
    .then(function (response) {
      artists.value = response.data
    })
    .catch(function (error) {
      // handle error
      console.log(error)
    })
    .finally(function () {
      // always executed
    })
}

function saveArtist() {
  axios
    .post('http://localhost:3000/artists', {
      name: artistName.value
    })
    .then(function (response) {
      getArtists()
      artistError.value = ''
      artistName.value = ''
    })
    .catch(function (error) {
      artistError.value = error.response.data.message
    })
    .finally(function () {
      // always executed
    })
}
</script>
