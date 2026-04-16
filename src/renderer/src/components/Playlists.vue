<template>
  <div class="flex flex-col space-y-4 flex-1 min-h-[0]">
    <div class="flex items-center justify-between space-x-3">
      <h2 class="text-lg font-bold">Playlists guardadas</h2>
      <span class="text-xs text-gray-500">{{ playlists.length }} playlists</span>
    </div>

    <div class="flex-1 overflow-y-auto">
      <div v-if="loading" class="text-center py-8">
        <a-spin size="small" />
        <p class="text-sm text-gray-500 mt-2">Cargando...</p>
      </div>

      <div v-else-if="playlists.length === 0" class="text-center text-gray-500 py-8">
        No hay playlists guardadas
      </div>

      <div v-else class="space-y-2">
        <div
          v-for="playlist in playlists"
          :key="playlist.id"
          class="bg-gray-200 rounded p-3 flex items-center justify-between group hover:bg-gray-300 transition-colors cursor-pointer"
          @click="selectPlaylist(playlist)"
        >
          <div class="flex-1 min-w-0">
            <div class="font-medium truncate">{{ playlist.name }}</div>
            <div class="text-xs text-gray-600">
              {{ playlist.get('songCount') || 0 }} canciones • {{ formatDate(playlist.createdAt) }}
            </div>
          </div>

          <div
            class="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity"
            @click.stop
          >
            <a-button size="small" type="primary" @click.stop="loadPlaylist(playlist)">
              <i-mdi-play class="w-4 h-4" />
            </a-button>
            <a-button size="small" @click.stop="renamePlaylist(playlist)">
              <i-mdi-pencil class="w-4 h-4" />
            </a-button>
            <a-button size="small" danger @click.stop="deletePlaylist(playlist)">
              <i-mdi-delete class="w-4 h-4" />
            </a-button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Modal cargar playlist -->
  <a-modal
    v-model:open="loadModalVisible"
    title="Cargar playlist"
    :ok-text="'Cargar'"
    :cancel-text="'Cancelar'"
    @ok="confirmLoad"
    @cancel="loadModalVisible = false"
  >
    <p>¿Qué deseas hacer con "{{ selectedPlaylist?.name }}"?</p>
    <a-radio-group v-model:value="loadMode" class="mt-4 flex flex-col gap-2">
      <a-radio value="replace">Reemplazar playlist actual</a-radio>
      <a-radio value="append">Agregar al final de la actual</a-radio>
    </a-radio-group>
  </a-modal>

  <!-- Modal renombrar -->
  <a-modal
    v-model:open="renameModalVisible"
    title="Renombrar playlist"
    :ok-text="'Guardar'"
    :cancel-text="'Cancelar'"
    @ok="confirmRename"
    @cancel="renameModalVisible = false"
  >
    <a-input v-model:value="newName" placeholder="Nuevo nombre" />
    <p v-if="renameError" class="text-red-500 text-sm mt-2">{{ renameError }}</p>
  </a-modal>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'
import dayjs from 'dayjs'

const emit = defineEmits(['load-playlist'])

const playlists = ref([])
const loading = ref(false)
const selectedPlaylist = ref(null)
const loadModalVisible = ref(false)
const renameModalVisible = ref(false)
const loadMode = ref('replace')
const newName = ref('')
const renameError = ref('')

async function fetchPlaylists() {
  loading.value = true
  try {
    const { data } = await axios.get('http://localhost:3000/playlists')
    playlists.value = data
  } catch (error) {
    console.error('Error al cargar playlists:', error)
  } finally {
    loading.value = false
  }
}

function selectPlaylist(playlist) {
  selectedPlaylist.value = playlist
  loadMode.value = 'replace'
  loadModalVisible.value = true
}

async function confirmLoad() {
  try {
    const { data } = await axios.get(`http://localhost:3000/playlists/${selectedPlaylist.value.id}`)
    emit('load-playlist', {
      songs: data.PlaylistSongs || [],
      mode: loadMode.value,
      name: data.name
    })
    loadModalVisible.value = false
  } catch (error) {
    console.error('Error al cargar playlist:', error)
  }
}

function loadPlaylist(playlist) {
  selectedPlaylist.value = playlist
  loadMode.value = 'replace'
  loadModalVisible.value = true
}

function renamePlaylist(playlist) {
  selectedPlaylist.value = playlist
  newName.value = playlist.name
  renameError.value = ''
  renameModalVisible.value = true
}

async function confirmRename() {
  try {
    renameError.value = ''
    await axios.put(`http://localhost:3000/playlists/${selectedPlaylist.value.id}`, {
      name: newName.value
    })
    await fetchPlaylists()
    renameModalVisible.value = false
  } catch (error) {
    if (error.response?.status === 409) {
      renameError.value = 'Ya existe una playlist con ese nombre'
    } else {
      renameError.value = 'Error al renombrar'
    }
  }
}

async function deletePlaylist(playlist) {
  if (!confirm(`¿Eliminar playlist "${playlist.name}"?`)) return
  try {
    await axios.delete(`http://localhost:3000/playlists/${playlist.id}`)
    await fetchPlaylists()
  } catch (error) {
    console.error('Error al eliminar playlist:', error)
  }
}

function formatDate(date) {
  return dayjs(date).format('DD/MM/YYYY')
}

onMounted(fetchPlaylists)
</script>
