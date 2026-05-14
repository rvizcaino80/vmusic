/**
 * Cover Art composable - Manage cover image URL mapping
 * Extracted from App.vue
 */
import { ref } from 'vue'

const COVER_MAP_STORAGE_KEY = 'vmusic_cover_map'

export function useCoverArt() {
  const coverMap = ref({})

  function loadCoverMap() {
    try {
      const stored = localStorage.getItem(COVER_MAP_STORAGE_KEY)
      coverMap.value = stored ? JSON.parse(stored) : {}
    } catch (err) {
      console.error('Error loading cover map:', err)
      coverMap.value = {}
    }
  }

  function saveCoverMap() {
    try {
      localStorage.setItem(COVER_MAP_STORAGE_KEY, JSON.stringify(coverMap.value))
    } catch (err) {
      console.error('Error saving cover map:', err)
    }
  }

  function getSongCoverUrl(song, alternateMap) {
    const map = alternateMap || coverMap.value
    if (!song) return ''

    // Try ytid first, then id
    const url = map[song.ytid] || map[song.id] || ''
    return url
  }

  function setCoverUrl(songId, url) {
    coverMap.value[songId] = url
    saveCoverMap()
  }

  function songHasCover(song, alternateMap) {
    const map = alternateMap || coverMap.value
    if (!song) return false
    return Boolean(map[song.ytid] || map[song.id])
  }

  function getStoredCoverMap() {
    return { ...coverMap.value }
  }

  // Load on init
  loadCoverMap()

  return {
    coverMap,
    loadCoverMap,
    getSongCoverUrl,
    setCoverUrl,
    songHasCover,
    getStoredCoverMap
  }
}
