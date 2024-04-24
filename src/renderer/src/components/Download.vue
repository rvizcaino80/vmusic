<script setup>
import { ref } from 'vue'
import axios from 'axios'
import { Icon } from '@iconify/vue'

// Download
const url = ref('')
const songId = ref('')
const songDuration = ref(0)
const songDurationOriginal = ref('')
const song = ref('')
const artistIds = ref([])
const totalArtists = ref(1)
const songTags = ref([])
const isSaving = ref(false)

const props = defineProps({
  tags: {
    type: Array,
    required: true
  },
  artists: {
    type: Array,
    required: true
  }
})

setTimeout(function () {
  document.getElementById('url').focus()
}, 200)

function saveSong() {
  const elements = document.querySelectorAll('.artist')
  elements.forEach((e) => {
    artistIds.value.push(e.value)
  })

  axios
    .post('http://localhost:3000/download', {
      url: url.value
    })
    .then(function (response) {
      songId.value = response.data

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
          //currentSelectedOption.value = options.library
        })
        .catch(function (error) {})
        .finally(function () {
          // always executed
        })
    })
    .catch(function (error) {
      console.log(error)
    })
    .finally(function () {
      // always executed
    })


}

function download() {

}
</script>

<template>
  <div>
    <form class="space-y-3 max-w-[80%] mx-auto" @submit.prevent="saveSong">
      <div>
        <label class="text-sm text-gray-500 block">URL de Youtube</label>
        <input
          id="url"
          v-model="url"
          type="text"
          class="w-full block"
          placeholder="URL de Youtube"
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
        </div>

        <div class="mt-2">
          <button type="button" class="text-sm py-1 px-2 text-gray-800 bg-gray-400">
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
        <span>Descargar</span>
      </button>
    </form>
  </div>

</template>
