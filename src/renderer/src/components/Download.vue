<template>
  <div class="overflow-y-auto">

    <div v-if="isError" class="px-2 py-1 bg-red-300 text-red-700 mb-4">
      {{ errorMessage }}.
    </div>
    <form class="space-y-3 mx-auto" @submit.prevent="saveSong">
      <div>
        <label class="text-sm text-gray-500 block">Artista</label>
        <!--select :key="index" v-for="index in totalArtists" class="w-full block artist">
          <option value="" selected>-- Vacío --</option>
          <option v-for="artist in artists" :key="artist.id" :value="artist.id">
            {{ artist.name }}
          </option>
        </select-->
        <div :key="total" v-for="total in totalArtists">
          <a-select
            :allow-clear="true"
            class="mb-1"
            v-model:value="selectedArtists[total]"
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
        <div :key="total" v-for="total in totalComposers">
          <a-select
            :allow-clear="true"
            class="mb-1"
            v-model:value="selectedComposers[total]"
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
        <label class="text-sm text-gray-500 block">URL de Apple Music / Youtube</label>
        <a-input class="w-full" v-model:value.lazy="url" autofocus placeholder="URL" />
      </div>

      <div>
        <label class="text-sm text-gray-500 block">Título</label>
        <a-input class="w-full" v-model:value.lazy="song" autofocus placeholder="Título de la canción" />
      </div>

      <div>
        <label class="text-sm text-gray-500 block">Etiquetas</label>
        <a-checkbox-group v-model:value="selectedTags" name="checkboxgroup" :options="tags.map(item => ({ label: item.name, value: item.id }))" />
      </div>

      <button
        :disabled="isSaving"
        type="submit"
        class="p-2 border border-gray-800 bg-gray-800 text-white flex items-center space-x-1 font-bold"
      >
        <Icon v-if="isSaving" class="w-5 h-5 animate-spin" icon="gg:spinner-two-alt" />
        <Icon v-else class="w-5 h-5" icon="tdesign:save" />
        <span>Descargar</span>
      </button>
    </form>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import axios from 'axios'
import { Icon } from '@iconify/vue'

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
const isSaving = ref(false)
const isError = ref(false)
const errorMessage = ref('')
const emit = defineEmits(['downloaded'])
const localArtists = ref([])

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

watch(() => props.artists, (n, o) => {
  if (n && n.length > 0) {
    localArtists.value = [...n]
  }
})

function saveSong() {
  isError.value = false
  errorMessage.value = ''

  let artistIds = selectedArtists.value.filter(item => item)
  let composerIds = selectedComposers.value.filter(item => item)

  if (
    selectedTags.value.length <= 0 ||
    artistIds.length <= 0 ||
    url.value.length <= 0 ||
    song.value.length <= 0
  ) {
    errorMessage.value = 'La información está incompleta'
    isError.value = true
  } else {
    isSaving.value = true

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
            artists: artistIds,
            composers: composerIds,
            duration: songDuration.value,
            durationOriginal: songDurationOriginal.value,
            songTags: selectedTags.value
          })
          .then(function (response) {
            emit('downloaded')
          })
          .catch(function (error) {})
          .finally(function () {
            // always executed
          })
      })
      .catch(function (error) {
        isSaving.value = false
        isError.value = true
        errorMessage.value = error.response.data.message
      })
      .finally(function () {
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

const filterOption = (input, option) => {
  return option.label.toLowerCase().indexOf(input.toLowerCase()) >= 0;
};
</script>