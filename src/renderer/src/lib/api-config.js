/**
 * API Configuration
 * Centralized endpoints for the backend API
 */

export const API_BASE_URL = 'http://localhost:3000'

export const API_ENDPOINTS = {
  // Songs
  SONGS: '/songs',
  SONGS_BY_ID: '/songs/by-id',
  SONG: (id) => `/songs/${id}`,
  SONGS_FILTER: '/songs/filter',
  SONGS_FILTER_BY_ARTIST: '/songs/filter-by-artist',
  SONGS_UPDATE: (id) => `/songs/update/${id}`,
  SONGS_UPDATE_MARKERS: (id) => `/songs/update-markers/${id}`,
  SONGS_SAVE_SPEED: '/songs/save-speed',
  SONGS_INCREMENT_PLAYCOUNT: (id) => `/songs/increment-playcount/${id}`,
  SONGS_SPEED_VERSION: (id) => `/songs/speed-version/${id}`,
  SONGS_FADE_PROFILE: (id) => `/songs/fade-profile/${id}`,
  SONGS_PREPROCESS_SPEED: '/songs/preprocess-speed',
  SONGS_DELETE: '/songs/delete',
  SONGS_SAVE: '/songs/save',
  SONGS_IMPORT: '/songs/import',
  SONGS_UPDATE_TAGS: '/songs/update-tags',
  SONGS_GET_ONE_BY_TAG: '/songs/get-one-by-tag',
  SONGS_COUNT: '/songs/count',
  SONGS_TOUCH_SPEED_VERSION: (id) => `/songs/touch-speed-version/${id}`,

  // Artists
  ARTISTS: '/artists',
  ARTIST: (id) => `/artists/${id}`,
  ARTISTS_DELETE: (id) => `/artists/delete/${id}`,

  // Tags
  TAGS: '/tags',
  TAGS_SAVE: '/tags/save',
  TAG: (id) => `/tags/${id}`,

  // Playlists
  PLAYLISTS: '/playlists',
  PLAYLIST: (id) => `/playlists/${id}`,
  PLAYLIST_ADD_SONGS: (id) => `/playlists/${id}/add-songs`,

  // Downloads
  DOWNLOAD: '/download',
  APPLE_MUSIC_CHECK: '/apple-music/check',

  // Other
  LYRICS: '/lyrics',
  AUDIO_RECOGNIZE: '/audio/recognize',
  SEARCH: '/search',
  DETAILS: '/details',
}

/**
 * Default request timeout in milliseconds
 */
export const REQUEST_TIMEOUT = 30000
