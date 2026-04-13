<template>
  <div class="overflow-y-auto">
    <form
      class="space-y-3 max-w-[80%] mx-auto"
      @submit.prevent="saveSong"
    >
      <a-divider>Agregar MP3</a-divider>

      <div
        v-if="isError"
        class="mb-4 border border-amber-400 bg-amber-200 px-2 py-1 text-amber-900"
      >
        {{ errorMessage }}.
      </div>

      <div>
        <label class="text-sm text-gray-500 block">Archivo MP3</label>
        <a-button
          type="default"
          class="w-full"
          @click="selectMp3File"
        >
          {{ mp3FileName || 'Seleccionar archivo...' }}
        </a-button>
        <input
          ref="fileInput"
          type="file"
          accept=".mp3"
          class="hidden"
          @change="onFileSelected"
        >
      </div>

      <div>
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
            :options="localArtists.map((item) => ({ label: item.name, value: item.id }))"
            :filter-option="filterOption"
          />
        </div>

        <div class="mt-2">
          <a-button @click="addArtist">
            Agregar artista {{ totalArtists + 1 }}
          </a-button>
        </div>
      </div>

      <div>
        <label class="text-sm text-gray-500 block">Título</label>
        <a-input
          v-model:value="songTitle"
          class="w-full"
          autofocus
          placeholder="Título de la canción"
        />
      </div>

      <div>
        <label class="text-sm text-gray-500 block">Etiquetas</label>
        <a-checkbox-group
          v-model:value="selectedTags"
          name="checkboxgroup"
          :options="tags.map((item) => ({ label: item.name, value: item.id }))"
          class="flex flex-col space-y-1"
        />
      </div>

      <a-button
        type="primary"
        html-type="submit"
        size="large"
        class="flex items-center space-x-1"
        :disabled="isSaveDisabled"
      >
        <Icon
          v-if="isSaving"
          class="w-5 h-5 animate-spin"
          icon="gg:spinner-two-alt"
        />
        <Icon
          v-else
          class="w-5 h-5"
          icon="ic:sharp-file-upload"
        />
        <span>Guardar</span>
      </a-button>
    </form>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import axios from 'axios'
import { Icon } from '@iconify/vue'

const songTitle = ref('')
const totalArtists = ref(1)
const selectedTags = ref([])
const selectedArtists = ref([])
const localArtists = ref([])
const tags = ref([])
const isSaving = ref(false)
const isError = ref(false)
const errorMessage = ref('')
const mp3FilePath = ref('')
const mp3FileName = ref('')
const fileInput = ref(null)

const isSaveDisabled = computed(() => {
  return isSaving.value || !mp3FilePath.value || !songTitle.value.trim()
})

const emit = defineEmits(['saved'])

const props = defineProps({
  artists: {
    type: Array,
    required: true
  },
  tags: {
    type: Array,
    required: true
  }
})

onMounted(async() => {
  localArtists.value = [...props.artists]
  tags.value = [...props.tags]
})

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

function addArtist() {
  totalArtists.value += 1
}

async function selectMp3File() {
  if (!window.electron2?.importMp3File) {
    if (fileInput.value) {
      fileInput.value.click()
    }

    return
  }

  const filePath = await window.electron2.importMp3File()
  if (filePath) {
    mp3FilePath.value = filePath
    mp3FileName.value = filePath.split(/[\\/]/).pop()
  }
}

function onFileSelected(event) {
  const file = event.target.files[0]
  if (file) {
    mp3FilePath.value = file.path || file.name
    mp3FileName.value = file.name
  }
}

function resetForm() {
  songTitle.value = ''
  totalArtists.value = 1
  selectedTags.value = []
  selectedArtists.value = []
  mp3FilePath.value = ''
  mp3FileName.value = ''
  isError.value = false
  errorMessage.value = ''
}

async function saveSong() {
  if (isSaveDisabled.value) return

  isSaving.value = true
  isError.value = false
  errorMessage.value = ''

  const artistIds = selectedArtists.value.filter((item) => item)
  const tagIds = selectedTags.value

  if (!mp3FilePath.value) {
    isError.value = true
    errorMessage.value = 'Selecciona un archivo MP3'
    isSaving.value = false

    return
  }

  if (!songTitle.value.trim()) {
    isError.value = true
    errorMessage.value = 'Ingresa el título de la canción'
    isSaving.value = false

    return
  }

  try {
    await axios.post('http://localhost:3000/songs/import', {
      filePath: mp3FilePath.value,
      name: songTitle.value.trim(),
      artists: artistIds,
      tags: tagIds
    })

    emit('saved')
    resetForm()
  } catch (error) {
    isError.value = true
    errorMessage.value = error.response?.data?.message || error.message || 'Error al guardar'
  } finally {
    isSaving.value = false
  }
}
</script>
