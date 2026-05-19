import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '../lib/api-client'

export const useLibraryStore = defineStore('library', () => {
  // --- State ---
  const songs = ref([])
  const artists = ref([])
  const tags = ref([])
  const filteredSongs = ref([])

  // --- Filter state ---
  const selectedTags = ref([])
  const selectedArtists = ref([])
  const artistFilterQuery = ref('')
  const tagFilterQuery = ref('')
  const artistFilterMode = ref('union') // 'union' | 'intersection'
  const tagFilterMode = ref('union') // 'union' | 'intersection'
  const filterQuery = ref('')
  const debouncedFilterQuery = ref('')

  // --- Selection ---
  const selectedSongs = ref([])

  // --- Deleted songs ---
  const deletedSongs = ref([])

  // --- Loading ---
  const isLoadingLibrary = ref(false)

  // --- Audio ---
  const autopause = ref(false)

  // --- M3U source filter ---
  const m3uExportSourceFilter = ref('any') // 'any' | 'youtube' | 'apple-music'

  // --- Computed ---
  const deletedSongsSet = computed(() => new Set(deletedSongs.value))

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

  function matchesQuery(query, str) {
    return str.includes(query) || levenshtein(query, str) <= 2
  }

  const filteredSongs2 = computed(() => {
    let result = filteredSongs.value

    // Client-side filtering
    if (debouncedFilterQuery.value) {
      const query = debouncedFilterQuery.value.toLowerCase()
      result = result.filter((song) => {
        const name = song.nameNorm || (song.name || '').toLowerCase()
        const artistsArr = song.artists || song.Artists || []
        const artistNames = song.artistsNorm || artistsArr.map((a) => a.name.toLowerCase()).join(' ')
        return matchesQuery(query, name) || matchesQuery(query, artistNames)
      })
    }

    return result
  })

  // --- Actions ---

  async function fetchArtists() {
    try {
      const { data } = await api.getArtists()
      artists.value = Array.isArray(data) ? data : []
      return artists.value
    } catch (err) {
      console.error('Error al cargar artistas:', err)
      artists.value = []
      return []
    }
  }

  async function fetchTags() {
    try {
      const { data } = await api.getTags()
      tags.value = Array.isArray(data) ? data : []
      return tags.value
    } catch (err) {
      console.error('Error al cargar tags:', err)
      tags.value = []
      return []
    }
  }

  async function filterSongs() {
    isLoadingLibrary.value = true
    try {
      const params = { artistIds: selectedArtists.value, tagIds: selectedTags.value }
      const { data } = await api.filterSongs(params)

      // Apply combined artist/tag filter client-side
      filteredSongs.value = applyCombinedFilters(data?.songs || data || [])

      // Update tags from response if available
      if (data?.tags) {
        tags.value = data.tags
      }

      return filteredSongs.value
    } catch (err) {
      console.error('Error al filtrar canciones:', err)
      filteredSongs.value = []
      return []
    } finally {
      isLoadingLibrary.value = false
    }
  }

  function applyCombinedFilters(items) {
    if (!items || items.length === 0) return []

    const artistIds = selectedArtists.value
    const tagIds = selectedTags.value

    if (artistIds.length === 0 && tagIds.length === 0) {
      return items
    }

    return items.filter((item) => {
      const songArtistIds = (item.artists || []).map((a) => String(a.id))
      const songTagIds = (item.tags || []).map((t) => String(t.id))

      // Artist filter
      let artistMatch = true
      if (artistIds.length > 0) {
        if (artistFilterMode.value === 'intersection') {
          artistMatch = artistIds.every((id) => songArtistIds.includes(String(id)))
        } else {
          artistMatch = artistIds.some((id) => songArtistIds.includes(String(id)))
        }
      }

      // Tag filter
      let tagMatch = true
      if (tagIds.length > 0) {
        if (tagFilterMode.value === 'intersection') {
          tagMatch = tagIds.every((id) => songTagIds.includes(String(id)))
        } else {
          tagMatch = tagIds.some((id) => songTagIds.includes(String(id)))
        }
      }

      return artistMatch && tagMatch
    })
  }

  function normalizeSelectionIds(values) {
    return (values || []).map((v) => String(v))
  }

  function setArtistFilter(ids) {
    selectedArtists.value = ids || []
  }

  function setTagFilter(ids) {
    selectedTags.value = ids || []
  }

  function setFilterQuery(query) {
    filterQuery.value = query || ''
  }

  function addDeletedSong(id) {
    if (!deletedSongs.value.includes(id)) {
      deletedSongs.value.push(id)
    }
  }

  function resetFilters() {
    selectedArtists.value = []
    selectedTags.value = []
    artistFilterQuery.value = ''
    tagFilterQuery.value = ''
    filterQuery.value = ''
    debouncedFilterQuery.value = ''
    selectedSongs.value = []
    m3uExportSourceFilter.value = 'any'
  }

  return {
    // State
    songs,
    artists,
    tags,
    filteredSongs,
    selectedTags,
    selectedArtists,
    artistFilterQuery,
    tagFilterQuery,
    artistFilterMode,
    tagFilterMode,
    filterQuery,
    debouncedFilterQuery,
    selectedSongs,
    deletedSongs,
    isLoadingLibrary,
    autopause,
    m3uExportSourceFilter,

    // Computed
    deletedSongsSet,
    filteredSongs2,

    // Actions
    fetchArtists,
    fetchTags,
    filterSongs,
    applyCombinedFilters,
    normalizeSelectionIds,
    setArtistFilter,
    setTagFilter,
    setFilterQuery,
    addDeletedSong,
    resetFilters
  }
})
