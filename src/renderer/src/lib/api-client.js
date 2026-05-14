import axios from 'axios'
import { API_BASE_URL, REQUEST_TIMEOUT } from './api-config'

/**
 * Unified API client
 *
 * Uses the ipc-http bridge internally (via axios adapter override in main.js).
 * Provides consistent error handling, logging, and a clean interface.
 */

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: REQUEST_TIMEOUT,
  headers: {
    'Content-Type': 'application/json'
  }
})

/**
 * Handle API errors consistently
 */
function handleError(error, context = '') {
  const message = error?.response?.data?.message || error?.message || 'Error desconocido'
  const url = error?.config?.url || ''
  const status = error?.response?.status || 0

  console.error(`[API] ${context} [${status}] ${url}: ${message}`)

  // Create a normalized error
  const apiError = new Error(message)
  apiError.status = status
  apiError.url = url
  apiError.originalError = error

  return Promise.reject(apiError)
}

/**
 * Response interceptor for logging
 */
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Only handle errors that aren't caught by the calling code
    if (!error._handled) {
      console.error('[API] Unhandled error:', error?.config?.url, error?.message)
    }
    return Promise.reject(error)
  }
)

/**
 * Convenience methods with consistent error handling
 */
export const api = {
  // --- Songs ---
  getSongs() {
    return apiClient.get('/songs').catch((err) => handleError(err, 'getSongs'))
  },

  getSongsByIds(ids) {
    return apiClient.post('/songs/by-id', { ids }).catch((err) => handleError(err, 'getSongsByIds'))
  },

  getSong(id) {
    return apiClient.get(`/songs/${id}`).catch((err) => handleError(err, 'getSong'))
  },

  filterSongs(params) {
    return apiClient.post('/songs/filter', params).catch((err) => handleError(err, 'filterSongs'))
  },

  filterSongsByArtist(artistIds) {
    return apiClient.post('/songs/filter-by-artist', { artistIds }).catch((err) => handleError(err, 'filterSongsByArtist'))
  },

  updateSong(id, data) {
    return apiClient.post(`/songs/update/${id}`, data).catch((err) => handleError(err, 'updateSong'))
  },

  updateSongMarkers(id, markers) {
    return apiClient.post(`/songs/update-markers/${id}`, markers).catch((err) => handleError(err, 'updateSongMarkers'))
  },

  saveSongSpeed(songId, speed) {
    return apiClient.post('/songs/save-speed', { songId, speed }).catch((err) => handleError(err, 'saveSongSpeed'))
  },

  incrementPlaycount(id) {
    return apiClient.post(`/songs/increment-playcount/${id}`).catch((err) => handleError(err, 'incrementPlaycount'))
  },

  getSpeedVersion(id, use = false) {
    const url = use ? `/songs/speed-version/${id}?use=1` : `/songs/speed-version/${id}`
    return apiClient.get(url).catch((err) => handleError(err, 'getSpeedVersion'))
  },

  getFadeProfile(id) {
    return apiClient.get(`/songs/fade-profile/${id}`).catch((err) => handleError(err, 'getFadeProfile'))
  },

  preprocessSpeed(data) {
    return apiClient.post('/songs/preprocess-speed', data).catch((err) => handleError(err, 'preprocessSpeed'))
  },

  deleteSong(id) {
    return apiClient.post('/songs/delete', { id }).catch((err) => handleError(err, 'deleteSong'))
  },

  saveSong(data) {
    return apiClient.post('/songs/save', data).catch((err) => handleError(err, 'saveSong'))
  },

  importSong(data) {
    return apiClient.post('/songs/import', data).catch((err) => handleError(err, 'importSong'))
  },

  updateTags(recentlyAddedTime) {
    return fetch(`${API_BASE_URL}/songs/update-tags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recentlyAddedTime })
    }).then(r => r.json())
  },

  // --- Artists ---
  getArtists() {
    return apiClient.get('/artists').catch((err) => handleError(err, 'getArtists'))
  },

  createArtist(name) {
    return apiClient.post('/artists', { name }).catch((err) => handleError(err, 'createArtist'))
  },

  updateArtist(id, name) {
    return apiClient.post(`/artists/${id}`, { name }).catch((err) => handleError(err, 'updateArtist'))
  },

  deleteArtist(id) {
    return apiClient.post(`/artists/delete/${id}`).catch((err) => handleError(err, 'deleteArtist'))
  },

  // --- Tags ---
  getTags() {
    return apiClient.get('/tags').catch((err) => handleError(err, 'getTags'))
  },

  createTag(name) {
    return apiClient.post('/tags/save', { name }).catch((err) => handleError(err, 'createTag'))
  },

  updateTag(id, name) {
    return apiClient.post(`/tags/${id}`, { name }).catch((err) => handleError(err, 'updateTag'))
  },

  // --- Playlists ---
  getPlaylists() {
    return apiClient.get('/playlists').catch((err) => handleError(err, 'getPlaylists'))
  },

  getPlaylist(id) {
    return apiClient.get(`/playlists/${id}`).catch((err) => handleError(err, 'getPlaylist'))
  },

  savePlaylist(name, songs) {
    return apiClient.post('/playlists', { name, songs }).catch((err) => handleError(err, 'savePlaylist'))
  },

  updatePlaylist(id, data) {
    return apiClient.put(`/playlists/${id}`, data).catch((err) => handleError(err, 'updatePlaylist'))
  },

  deletePlaylist(id) {
    return apiClient.delete(`/playlists/${id}`).catch((err) => handleError(err, 'deletePlaylist'))
  },

  addSongsToPlaylist(playlistId, songIds) {
    return apiClient.post(`/playlists/${playlistId}/add-songs`, { songIds }).catch((err) => handleError(err, 'addSongsToPlaylist'))
  },

  // --- Downloads ---
  checkAppleMusic() {
    return apiClient.get('/apple-music/check').catch((err) => handleError(err, 'checkAppleMusic'))
  },

  downloadSong(payload) {
    return apiClient.post('/download', payload).catch((err) => handleError(err, 'downloadSong'))
  },

  // --- Lyrics ---
  getLyrics(artist, title) {
    const url = `${API_BASE_URL}/lyrics?artist=${encodeURIComponent(artist)}&title=${encodeURIComponent(title)}`
    return fetch(url).then(r => r.json())
  },

  // --- Raw request (for edge cases) ---
  request(config) {
    return apiClient(config).catch((err) => handleError(err, 'request'))
  }
}

/**
 * Get the raw axios instance for custom requests
 */
export function getRawClient() {
  return apiClient
}

export default api
