export function buildSpotifySearchUrl(songName, artistNames = []) {
  const title = String(songName || '').trim()
  const artists = Array.isArray(artistNames)
    ? artistNames.filter(Boolean).map((value) => String(value).trim()).filter(Boolean).join(' ')
    : String(artistNames || '').trim()
  const term = [artists, title].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()

  if (!term) return ''

  return `https://open.spotify.com/search/${encodeURIComponent(term)}`
}
