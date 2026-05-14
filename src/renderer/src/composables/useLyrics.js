/**
 * Lyrics composable - Fetch and display synchronized lyrics
 * Extracted from App.vue
 */
import { ref, computed } from 'vue'
import { usePlayerStore } from '../stores/player'
import api from '../lib/api-client'

export function useLyrics() {
  const store = usePlayerStore()

  const lyricsLines = ref([])
  const lyricsSynced = ref(false)
  const lyricsLoading = ref(false)
  const currentLyricIndex = ref(-1)
  const activeDeck = ref('top') // 'top' | 'bottom'

  const activeLyricsPlayer = computed(() => {
    return store.getPlayerByPosition(activeDeck.value)
  })

  const shouldShowLyrics = computed(() => {
    return lyricsLines.value.length > 0 && lyricsSynced.value
  })

  const prevLyricsLine = computed(() => {
    if (currentLyricIndex.value > 0 && shouldShowLyrics.value) {
      return lyricsLines.value[currentLyricIndex.value - 1]?.text || ''
    }
    return ''
  })

  const activeLyricsLine = computed(() => {
    if (currentLyricIndex.value >= 0 && shouldShowLyrics.value && currentLyricIndex.value < lyricsLines.value.length) {
      return lyricsLines.value[currentLyricIndex.value]?.text || ''
    }
    return ''
  })

  const nextLyricsLine = computed(() => {
    if (currentLyricIndex.value >= 0 && currentLyricIndex.value + 1 < lyricsLines.value.length && shouldShowLyrics.value) {
      return lyricsLines.value[currentLyricIndex.value + 1]?.text || ''
    }
    return ''
  })

  function handleLyricsTimeupdate(currentTime) {
    if (!lyricsSynced.value || lyricsLines.value.length === 0) return

    // Binary search for the current time
    let low = 0
    let high = lyricsLines.value.length - 1
    let found = -1

    while (low <= high) {
      const mid = Math.floor((low + high) / 2)
      if (lyricsLines.value[mid].time <= currentTime) {
        found = mid
        low = mid + 1
      } else {
        high = mid - 1
      }
    }

    if (found !== currentLyricIndex.value) {
      currentLyricIndex.value = found
    }
  }

  async function fetchLyricsForPlayer(playerRef) {
    if (!playerRef?.songFull?.name) {
      lyricsLines.value = []
      lyricsSynced.value = false
      currentLyricIndex.value = -1
      return
    }

    const song = playerRef.songFull
    const artist = song.artists?.[0]?.name || ''
    const title = song.name

    if (!artist || !title) return

    lyricsLoading.value = true
    try {
      const data = await api.getLyrics(artist, title)
      if (data?.synced && Array.isArray(data.lines)) {
        lyricsLines.value = data.lines
        lyricsSynced.value = true
      } else if (data?.plain) {
        // Unsynchronized lyrics - show as plain text
        lyricsLines.value = data.plain.split('\n').map((text, i) => ({
          time: i,
          text: text.trim()
        }))
        lyricsSynced.value = false
      } else {
        lyricsLines.value = []
        lyricsSynced.value = false
      }
      currentLyricIndex.value = -1
    } catch (err) {
      console.error('Error fetching lyrics:', err)
      lyricsLines.value = []
      lyricsSynced.value = false
    } finally {
      lyricsLoading.value = false
    }
  }

  function clearLyrics() {
    lyricsLines.value = []
    lyricsSynced.value = false
    lyricsLoading.value = false
    currentLyricIndex.value = -1
  }

  return {
    // State
    lyricsLines,
    lyricsSynced,
    lyricsLoading,
    currentLyricIndex,
    activeDeck,
    // Computed
    shouldShowLyrics,
    prevLyricsLine,
    activeLyricsLine,
    nextLyricsLine,
    // Actions
    handleLyricsTimeupdate,
    fetchLyricsForPlayer,
    clearLyrics
  }
}
