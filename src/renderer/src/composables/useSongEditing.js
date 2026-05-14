/**
 * Song Editing composable - Handle song metadata editing and refresh
 * Extracted from App.vue
 */
import { usePlayerStore } from '../stores/player'
import { useLibraryStore } from '../stores/library'
import api from '../lib/api-client'

export function useSongEditing() {
  const playerStore = usePlayerStore()
  const libraryStore = useLibraryStore()

  async function refreshSongInLibrary(id) {
    try {
      const { data } = await api.getSong(id)
      if (data) {
        // Update song in filteredSongs
        const index = libraryStore.filteredSongs.findIndex((s) => s.id === id)
        if (index !== -1) {
          libraryStore.filteredSongs[index] = { ...libraryStore.filteredSongs[index], ...data }
        }
      }
    } catch (err) {
      console.error('Error refreshing song in library:', err)
    }
  }

  function refreshEditedSongInLoadedPlayer(playerRef, updatedSong) {
    if (!playerRef || !playerRef.songFull?.id) return

    if (playerRef.songFull.id === updatedSong.id) {
      Object.assign(playerRef.songFull, updatedSong)
    }
  }

  function refreshEditedSongInLoadedPlayers(updatedSong) {
    refreshEditedSongInLoadedPlayer(playerStore.player1, updatedSong)
    refreshEditedSongInLoadedPlayer(playerStore.player2, updatedSong)
  }

  async function reloadEditedSongInInactivePlayer(playerRef, songId, markers) {
    if (!playerRef || !playerRef.songFull?.id) return
    if (playerRef.songFull.id !== songId) return

    // Only reload if not playing
    if (playerRef.status === 'playing') return

    try {
      const { data: song } = await api.getSong(songId)
      if (song) {
        Object.assign(playerRef.songFull, song)
      }
    } catch (err) {
      console.error('Error reloading edited song:', err)
    }
  }

  async function reloadEditedSongInInactivePlayers(songId, markers) {
    await Promise.all([
      reloadEditedSongInInactivePlayer(playerStore.player1, songId, markers),
      reloadEditedSongInInactivePlayer(playerStore.player2, songId, markers)
    ])
  }

  async function onWaveUpdated(markers) {
    // Called when waveform markers are updated
    // Reload markers in inactive players
    if (!markers?.songId) return
    await reloadEditedSongInInactivePlayers(markers.songId, markers)
  }

  async function onSongUpdated(payload) {
    // Called when a song edit is saved
    const updatedSong = payload?.song || payload
    if (!updatedSong?.id) return

    await refreshSongInLibrary(updatedSong.id)
    refreshEditedSongInLoadedPlayers(updatedSong)
  }

  return {
    refreshSongInLibrary,
    refreshEditedSongInLoadedPlayer,
    refreshEditedSongInLoadedPlayers,
    reloadEditedSongInInactivePlayer,
    reloadEditedSongInInactivePlayers,
    onWaveUpdated,
    onSongUpdated
  }
}
