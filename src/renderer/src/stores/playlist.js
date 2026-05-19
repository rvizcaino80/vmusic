import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '../lib/api-client'

/**
 * Generate unique entry IDs for playlist rows
 */
let entryIdCounter = 0
function generateEntryId() {
  entryIdCounter++
  return `entry_${Date.now()}_${entryIdCounter}`
}

export const usePlaylistStore = defineStore('playlist', () => {
  // --- Active playlist (current playing queue) ---
  const playlist = ref([])
  const playlistDetails = ref([])
  const currentMode = ref('playlist') // 'playlist' | 'history'

  // --- Selection ---
  const selectedRows = ref([])

  // --- Saved playlists ---
  const savedPlaylists = ref([])

  // --- M3U ---
  const m3uInput = ref('')
  const isImportingM3U = ref(false)
  const isExportingM3U = ref(false)
  const importSongsCache = ref([])
  const importSongsCacheLoaded = ref(false)

  // --- History ---
  const history = ref([])
  const tagHistory = ref([])
  const songHistory = ref([])
  const historySelectedRows = ref([])

  // --- Playlist search (within active playlist) ---
  const playlistSearchQuery = ref('')
  const playlistSearchResults = ref([])
  const playlistSearchIndex = ref(-1)

  // --- Context menu ---
  const songContextMenu = ref({
    visible: false,
    x: 0,
    y: 0,
    song: null
  })

  // --- Save playlist modal ---
  const savePlaylistModalVisible = ref(false)
  const playlistNameToSave = ref('')
  const savePlaylistError = ref('')

  // --- Quick create playlist modal ---
  const quickCreatePlaylistModalVisible = ref(false)
  const quickPlaylistName = ref('')

  // --- Computed ---
  const playlistSource = computed(() => playlistDetails.value.slice())

  const playlistRows = computed(() => {
    return playlistDetails.value.map((entry, index) => ({
      ...entry,
      rowIndex: index,
      _isSelected: selectedRows.value.includes(entry.entryId)
    }))
  })

  const repeatedArtistWarningSet = computed(() => {
    const warningSet = new Set()
    for (let i = 1; i < playlistDetails.value.length; i++) {
      const prev = playlistDetails.value[i - 1]
      const curr = playlistDetails.value[i]
      if (!prev || !curr) continue
      const prevArtists = prev.Artists || prev.song?.Artists || prev.artists || prev.song?.artists || []
      const currArtists = curr.Artists || curr.song?.Artists || curr.artists || curr.song?.artists || []
      if (!Array.isArray(prevArtists) || !Array.isArray(currArtists)) continue
      const prevIds = new Set(prevArtists.map((a) => a.id))
      if (currArtists.some((a) => prevIds.has(a.id))) {
        warningSet.add(curr.entryId)
      }
    }
    return warningSet
  })

  const defaultPlaylistName = computed(() => {
    if (playlistDetails.value.length === 0) return 'Nueva playlist'
    const first = playlistDetails.value[0]?.song?.name || ''
    const last = playlistDetails.value[playlistDetails.value.length - 1]?.song?.name || ''
    return first || last ? `${first} - ${last}` : 'Nueva playlist'
  })

  // --- Actions: Playlist manipulation ---

  function createPlaylistEntry(song, options = {}) {
    return {
      entryId: options.entryId || generateEntryId(),
      song: song || {},
      order: options.order ?? playlistDetails.value.length + 1,
      speed: options.speed ?? song?.speed ?? 0,
      ...options
    }
  }

  function syncPlaylistStateFromDetails() {
    playlist.value = playlistDetails.value.map((entry) => entry.song)
  }

  function addSong(entry) {
    playlistDetails.value.push(entry)
    syncPlaylistStateFromDetails()
    return entry
  }

  function addSongs(entries) {
    playlistDetails.value.push(...entries)
    syncPlaylistStateFromDetails()
  }

  function removeEntry(entryId) {
    const index = playlistDetails.value.findIndex((e) => e.entryId === entryId)
    if (index !== -1) {
      playlistDetails.value.splice(index, 1)
      syncPlaylistStateFromDetails()
      // Remove from selection
      selectedRows.value = selectedRows.value.filter((id) => id !== entryId)
      return true
    }
    return false
  }

  function clearAll() {
    playlistDetails.value = []
    playlist.value = []
    selectedRows.value = []
    playlistSearchResults.value = []
    playlistSearchIndex.value = -1
  }

  function moveEntry(entryId, delta) {
    const index = playlistDetails.value.findIndex((e) => e.entryId === entryId)
    if (index === -1) return false

    const newIndex = index + delta
    if (newIndex < 0 || newIndex >= playlistDetails.value.length) return false

    const [item] = playlistDetails.value.splice(index, 1)
    playlistDetails.value.splice(newIndex, 0, item)
    syncPlaylistStateFromDetails()
    return true
  }

  function moveToTop(entryId) {
    const index = playlistDetails.value.findIndex((e) => e.entryId === entryId)
    if (index <= 0) return false

    const [item] = playlistDetails.value.splice(index, 1)
    playlistDetails.value.unshift(item)
    syncPlaylistStateFromDetails()
    return true
  }

  function moveToBottom(entryId) {
    const index = playlistDetails.value.findIndex((e) => e.entryId === entryId)
    if (index === -1 || index === playlistDetails.value.length - 1) return false

    const [item] = playlistDetails.value.splice(index, 1)
    playlistDetails.value.push(item)
    syncPlaylistStateFromDetails()
    return true
  }

  function shufflePlaylist(fromIndex = 0) {
    const start = Math.max(0, fromIndex)
    const toShuffle = playlistDetails.value.slice(start)
    for (let i = toShuffle.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[toShuffle[i], toShuffle[j]] = [toShuffle[j], toShuffle[i]]
    }
    playlistDetails.value.splice(start, toShuffle.length, ...toShuffle)
    syncPlaylistStateFromDetails()
  }

  function toggleRowSelection(entryId) {
    const idx = selectedRows.value.indexOf(entryId)
    if (idx === -1) {
      selectedRows.value.push(entryId)
    } else {
      selectedRows.value.splice(idx, 1)
    }
  }

  // --- Playlist search ---

  function updatePlaylistSearch() {
    const query = playlistSearchQuery.value.toLowerCase().trim()
    if (!query) {
      playlistSearchResults.value = []
      playlistSearchIndex.value = -1
      return
    }

    function levenshtein(a, b) {
      if (a === b) return 0
      if (a.length === 0) return b.length
      if (b.length === 0) return a.length
      if (Math.abs(a.length - b.length) > 2) return Math.abs(a.length - b.length)
      const m = a.length, n = b.length
      let prev = new Uint8Array(n + 1)
      let curr = new Uint8Array(n + 1)
      for (let j = 0; j <= n; j++) prev[j] = j
      for (let i = 1; i <= m; i++) {
        curr[0] = i
        for (let j = 1; j <= n; j++) {
          const cost = a[i - 1] === b[j - 1] ? 0 : 1
          curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost)
        }
        ;[prev, curr] = [curr, prev]
      }
      return prev[n]
    }

    function matchesQuery(q, str) {
      return str.includes(q) || levenshtein(q, str) <= 2
    }

    playlistDetails.value.forEach((entry, index) => {
      const song = entry.song || {}
      const name = (song.name || '').toLowerCase()
      const artistsArr = song.artists || song.Artists || []
      const artistNames = artistsArr.map((a) => a.name.toLowerCase()).join(' ')
      if (matchesQuery(query, name) || matchesQuery(query, artistNames)) {
        results.push({ index, entryId: entry.entryId })
      }
    })

    playlistSearchResults.value = results
    playlistSearchIndex.value = results.length > 0 ? 0 : -1
  }

  function nextPlaylistResult() {
    if (playlistSearchResults.value.length === 0) return null
    playlistSearchIndex.value = (playlistSearchIndex.value + 1) % playlistSearchResults.value.length
    return playlistSearchResults.value[playlistSearchIndex.value]
  }

  function prevPlaylistResult() {
    if (playlistSearchResults.value.length === 0) return null
    playlistSearchIndex.value =
      (playlistSearchIndex.value - 1 + playlistSearchResults.value.length) % playlistSearchResults.value.length
    return playlistSearchResults.value[playlistSearchIndex.value]
  }

  // --- Saved playlists (API) ---

  async function fetchSavedPlaylists() {
    try {
      const { data } = await api.getPlaylists()
      savedPlaylists.value = Array.isArray(data) ? data : []
      return savedPlaylists.value
    } catch (err) {
      console.error('Error al cargar playlists:', err)
      savedPlaylists.value = []
      return []
    }
  }

  async function loadPlaylist(id, mode = 'replace') {
    try {
      const { data } = await api.getPlaylist(id)
      if (!data?.songs) return []

      const entries = data.songs.map((song, index) =>
        createPlaylistEntry(song, { order: index + 1 })
      )

      if (mode === 'replace') {
        playlistDetails.value = entries
      } else {
        // Append mode
        playlistDetails.value.push(...entries)
      }

      syncPlaylistStateFromDetails()
      return entries
    } catch (err) {
      console.error('Error al cargar playlist:', err)
      return []
    }
  }

  async function savePlaylistToServer(name, songs) {
    try {
      await api.savePlaylist(name, songs)
      await fetchSavedPlaylists()
      return true
    } catch (err) {
      console.error('Error al guardar playlist:', err)
      return false
    }
  }

  async function deleteSavedPlaylist(id) {
    try {
      await api.deletePlaylist(id)
      savedPlaylists.value = savedPlaylists.value.filter((p) => p.id !== id)
      return true
    } catch (err) {
      console.error('Error al eliminar playlist:', err)
      return false
    }
  }

  // --- Context menu ---

  function openSongContextMenu(event, song) {
    songContextMenu.value = {
      visible: true,
      x: event.clientX,
      y: event.clientY,
      song
    }
  }

  function closeContextMenu() {
    songContextMenu.value = {
      visible: false,
      x: 0,
      y: 0,
      song: null
    }
  }

  // --- Modals ---

  function openSavePlaylistModal() {
    savePlaylistModalVisible.value = true
    playlistNameToSave.value = defaultPlaylistName.value
    savePlaylistError.value = ''
  }

  function closeSavePlaylistModal() {
    savePlaylistModalVisible.value = false
    playlistNameToSave.value = ''
    savePlaylistError.value = ''
  }

  // --- History ---

  function addToHistory(entry) {
    history.value.unshift(entry)
  }

  function clearHistory() {
    history.value = []
    songHistory.value = []
  }

  // --- M3U ---

  function setM3UContent(content) {
    m3uInput.value = content
  }

  return {
    // State
    playlist,
    playlistDetails,
    currentMode,
    selectedRows,
    savedPlaylists,
    m3uInput,
    isImportingM3U,
    isExportingM3U,
    importSongsCache,
    importSongsCacheLoaded,
    history,
    tagHistory,
    songHistory,
    historySelectedRows,
    playlistSearchQuery,
    playlistSearchResults,
    playlistSearchIndex,
    songContextMenu,
    savePlaylistModalVisible,
    playlistNameToSave,
    savePlaylistError,
    quickCreatePlaylistModalVisible,
    quickPlaylistName,

    // Computed
    playlistSource,
    playlistRows,
    repeatedArtistWarningSet,
    defaultPlaylistName,

    // Actions: Playlist manipulation
    createPlaylistEntry,
    syncPlaylistStateFromDetails,
    addSong,
    addSongs,
    removeEntry,
    clearAll,
    moveEntry,
    moveToTop,
    moveToBottom,
    shufflePlaylist,
    toggleRowSelection,

    // Actions: Search
    updatePlaylistSearch,
    nextPlaylistResult,
    prevPlaylistResult,

    // Actions: Saved playlists
    fetchSavedPlaylists,
    loadPlaylist,
    savePlaylistToServer,
    deleteSavedPlaylist,

    // Actions: Context menu
    openSongContextMenu,
    closeContextMenu,

    // Actions: Modals
    openSavePlaylistModal,
    closeSavePlaylistModal,

    // Actions: History
    addToHistory,
    clearHistory,

    // Actions: M3U
    setM3UContent
  }
})
