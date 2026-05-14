/**
 * Song Notes composable - Manage per-song notes in localStorage
 * Extracted from App.vue
 */
import { ref } from 'vue'

const SONG_NOTES_STORAGE_KEY = 'vmusic_song_notes'

export function useSongNotes() {
  const songNotesMap = ref({})

  function loadSongNotesMap() {
    try {
      const stored = localStorage.getItem(SONG_NOTES_STORAGE_KEY)
      songNotesMap.value = stored ? JSON.parse(stored) : {}
    } catch (err) {
      console.error('Error loading song notes:', err)
      songNotesMap.value = {}
    }
  }

  function saveSongNotesMap() {
    try {
      localStorage.setItem(SONG_NOTES_STORAGE_KEY, JSON.stringify(songNotesMap.value))
    } catch (err) {
      console.error('Error saving song notes:', err)
    }
  }

  function getSongNote(song) {
    if (!song?.ytid) return ''
    const map = songNotesMap.value
    return map[song.ytid] || map[song.id] || ''
  }

  function setSongNote(songOrYtid, note) {
    const key = typeof songOrYtid === 'object' ? (songOrYtid.ytid || songOrYtid.id) : songOrYtid
    if (!key) return

    if (note && note.trim()) {
      songNotesMap.value[key] = note.trim()
    } else {
      delete songNotesMap.value[key]
    }
    saveSongNotesMap()
  }

  function onSongNotesChanged() {
    loadSongNotesMap()
  }

  // Load on init
  loadSongNotesMap()

  return {
    songNotesMap,
    loadSongNotesMap,
    getSongNote,
    setSongNote,
    onSongNotesChanged
  }
}
