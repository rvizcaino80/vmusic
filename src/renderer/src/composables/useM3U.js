/**
 * M3U composable - Import and export M3U playlist files
 * Extracted from App.vue
 */
import { ref } from 'vue'
import { useLibraryStore } from '../stores/library'
import { usePlaylistStore } from '../stores/playlist'
import api from '../lib/api-client'

export function useM3U() {
  const libraryStore = useLibraryStore()
  const playlistStore = usePlaylistStore()

  function parseM3U(content) {
    const lines = content.split('\n')
    const entries = []
    let currentMetadata = null

    for (const rawLine of lines) {
      const line = rawLine.trim()
      if (!line) continue

      if (line.startsWith('#EXTINF:')) {
        // Parse metadata line: #EXTINF:duration,Artist - Title
        const match = line.match(/#EXTINF:\s*(-?\d+\.?\d*)\s*,(.+)/)
        if (match) {
          currentMetadata = {
            duration: parseFloat(match[1]) || 0,
            title: match[2].trim()
          }
        }
      } else if (!line.startsWith('#')) {
        // Path line
        entries.push({
          path: line,
          metadata: currentMetadata
        })
        currentMetadata = null
      }
    }

    return entries
  }

  function getSongPathInfo(path) {
    // Extract folder and ytid/name from path
    const normalized = path.replace(/\\/g, '/')
    const parts = normalized.split('/')
    const fileName = parts[parts.length - 1] || ''
    const folder = parts.length > 1 ? parts.slice(0, -1).join('/') : ''

    // Remove extension
    const nameWithoutExt = fileName.replace(/\.\w+$/, '')

    return {
      folder,
      ytid: nameWithoutExt,
      name: nameWithoutExt
    }
  }

  async function loadSongsForImport() {
    if (playlistStore.importSongsCacheLoaded) {
      return playlistStore.importSongsCache
    }

    try {
      // Fetch all songs from API
      const { data } = await api.filterSongs({})
      const songs = Array.isArray(data?.songs || data) ? (data.songs || data) : []
      playlistStore.importSongsCache = songs
      playlistStore.importSongsCacheLoaded = true
      return songs
    } catch (err) {
      console.error('Error loading songs for M3U import:', err)
      return []
    }
  }

  async function importM3UContent(content) {
    const entries = parseM3U(content)
    if (entries.length === 0) return []

    const allSongs = await loadSongsForImport()
    if (allSongs.length === 0) return []

    const matchedEntries = []
    for (const entry of entries) {
      const pathInfo = getSongPathInfo(entry.path)

      // Try to find matching song
      const song = allSongs.find((s) => {
        // Match by ytid
        if (s.ytid && pathInfo.ytid && s.ytid === pathInfo.ytid) return true
        // Match by name
        if (s.name && pathInfo.name && s.name.toLowerCase() === pathInfo.name.toLowerCase()) return true
        return false
      })

      if (song) {
        matchedEntries.push(playlistStore.createPlaylistEntry(song))
      }
    }

    return matchedEntries
  }

  function buildM3UContent(songs) {
    let content = '#EXTM3U\n'
    for (const song of songs) {
      const artistName = song.artists?.[0]?.name || 'Unknown Artist'
      const title = song.name || 'Unknown'
      const duration = song.duration || -1
      const ytid = song.ytid || song.id || 'unknown'

      content += `#EXTINF:${duration},${artistName} - ${title}\n`
      content += `${song.folder ? song.folder + '/' : ''}${ytid}.mp3\n`
    }
    return content
  }

  return {
    parseM3U,
    getSongPathInfo,
    loadSongsForImport,
    importM3UContent,
    buildM3UContent
  }
}
