<template>
  <div class="overflow-y-auto">
    <form class="space-y-3 max-w-[80%] mx-auto" @submit.prevent="saveSong">
      <div>
        <label class="text-sm text-gray-500 block">Artista</label>
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
          <button @click="addArtist" type="button" class="text-sm py-1 px-2 text-gray-800 bg-gray-400">
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
        <span>Actualizar</span>
      </button>
    </form>
  </div>
</template>

<script setup>
import { onMounted, ref, watch } from "vue";
import axios from 'axios'
import { Icon } from '@iconify/vue'

// Download
const song = ref('')
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

const emit = defineEmits(['updated'])

const props = defineProps({
  id: {
    type: Number,
    required: true
  }
})

onMounted(async () => {
  tags.value = await getTags()
  localArtists.value = await getArtists()

  axios
    .get('http://localhost:3000/songs/' + props.id)
    .then(function (response) {
      totalArtists.value = response.data.Artists ? response.data.Artists.length : 1
      totalComposers.value = response.data.Composers ? response.data.Composers.length : 1
      song.value = response.data.name

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

      selectedTags.value = response.data.Tags.map(item => (item.id))
    })
    .catch(function (error) {
      console.log(error)
    })
    .finally(function () {
      // always executed
    })
})

async function getTags() {
  const response = await fetch('http://localhost:3000/tags')
  const data = await response.json()
  return data.sort((a, b) => a.name.localeCompare(b.name))
}

async function getArtists() {
  const response = await fetch('http://localhost:3000/artists')
  const data = await response.json()
  return data.sort((a, b) => a.name.localeCompare(b.name))
}

function saveSong() {
  isSaving.value = true

  let artistIds = selectedArtists.value.filter(item => item)
  let composerIds = selectedComposers.value.filter(item => item)

  axios
    .post('http://localhost:3000/songs/update/'  + props.id, {
      name: song.value,
      artists: artistIds,
      composers: composerIds,
      tags: selectedTags.value
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

function addComposer() {
  totalComposers.value += 1
}

const filterOption = (input, option) => {
  return option.label.toLowerCase().indexOf(input.toLowerCase()) >= 0;
};
</script>