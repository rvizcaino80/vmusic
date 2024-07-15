<template>
  <div class="flex flex-col space-y-6 min-h-[0]">
    <form class="space-x-2 flex items-center" @submit.prevent="saveArtist">
      <input
        v-model="artistName"
        autofocus
        id="artistName"
        type="text"
        class="flex-1"
        placeholder="Nombre de artista"
      />
      <button type="submit" class="p-2 border border-gray-800 bg-gray-800 text-white font-bold">
        Agregar
      </button>
    </form>

    <div class="overflow-y-auto">
      <div
        v-for="artist in artists"
        :key="artist.id"
        class="border-bottom border-gray-700 flex-1 space-x-2 pr-3 flex items-center justify-between"
      >
        <input
          :id="`a${artist.id}`"
          :key="artist.id"
          type="text"
          class="block border-transparent focus:ring-0 focus:bg-white focus:border-ring-600 bg-transparent w-full text-black px-2 py-0.5 leading-tight text-base"
          :value="artist.name"
          @keyup.enter="updateArtist(artist.id)"
          @blur="updateArtist(artist.id)"
        />
        <button
          v-if="artist.Songs.length <= 0"
          class=" px-2 py-1 bg-gray-800 text-white text-xs"
          @click="del(artist.id)">
          Eliminar
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import axios from 'axios'

//const props = defineProps({ artists: Array })
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
    .then(function (response) {
      artists.value = response.data.sort((a, b) => a.name.localeCompare(b.name))
    })
    .catch(function (error) {
      // handle error
      console.log(error)
    })
    .finally(function () {
      // always executed
    })
}

function del(id) {
  axios
    .post('http://localhost:3000/artists/delete/' + id)
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

function updateArtist(id) {
  const name = document.getElementById(`a${id}`).value
  document.getElementById(`a${id}`).blur()
  axios
    .post('http://localhost:3000/artists/' + id, {
      name: name
    })
    .then(function (response) {

    })
    .catch(function (error) {
      artistError.value = error.response.data.message
    })
    .finally(function () {
      // always executed
    })
}
</script>
