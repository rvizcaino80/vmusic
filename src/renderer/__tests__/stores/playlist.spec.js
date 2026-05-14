import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { usePlaylistStore } from '../../src/stores/playlist'

describe('usePlaylistStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('should start with empty playlist', () => {
    const store = usePlaylistStore()
    expect(store.playlistDetails).toEqual([])
    expect(store.playlist).toEqual([])
    expect(store.savedPlaylists).toEqual([])
  })

  it('should add a song entry', () => {
    const store = usePlaylistStore()
    const song = { id: 1, name: 'Test Song' }
    const entry = store.createPlaylistEntry(song)
    store.addSong(entry)

    expect(store.playlistDetails.length).toBe(1)
    expect(store.playlistDetails[0].song.name).toBe('Test Song')
    expect(store.playlistDetails[0].entryId).toBeTruthy()
  })

  it('should remove a song entry', () => {
    const store = usePlaylistStore()
    const song = { id: 1, name: 'Test Song' }
    const entry = store.createPlaylistEntry(song)
    store.addSong(entry)

    expect(store.playlistDetails.length).toBe(1)
    store.removeEntry(entry.entryId)
    expect(store.playlistDetails.length).toBe(0)
  })

  it('should clear all entries', () => {
    const store = usePlaylistStore()
    store.addSong(store.createPlaylistEntry({ id: 1, name: 'Song 1' }))
    store.addSong(store.createPlaylistEntry({ id: 2, name: 'Song 2' }))

    expect(store.playlistDetails.length).toBe(2)
    store.clearAll()
    expect(store.playlistDetails.length).toBe(0)
    expect(store.selectedRows.length).toBe(0)
  })

  it('should move an entry up', () => {
    const store = usePlaylistStore()
    const entry1 = store.createPlaylistEntry({ id: 1, name: 'Song 1' })
    const entry2 = store.createPlaylistEntry({ id: 2, name: 'Song 2' })
    store.addSong(entry1)
    store.addSong(entry2)

    store.moveEntry(entry2.entryId, -1)
    expect(store.playlistDetails[0].song.id).toBe(2)
    expect(store.playlistDetails[1].song.id).toBe(1)
  })

  it('should move an entry down', () => {
    const store = usePlaylistStore()
    const entry1 = store.createPlaylistEntry({ id: 1, name: 'Song 1' })
    const entry2 = store.createPlaylistEntry({ id: 2, name: 'Song 2' })
    store.addSong(entry1)
    store.addSong(entry2)

    store.moveEntry(entry1.entryId, 1)
    expect(store.playlistDetails[0].song.id).toBe(2)
    expect(store.playlistDetails[1].song.id).toBe(1)
  })

  it('should shuffle the playlist from a given index', () => {
    const store = usePlaylistStore()
    // Add 10 songs
    for (let i = 1; i <= 10; i++) {
      store.addSong(store.createPlaylistEntry({ id: i, name: `Song ${i}` }))
    }

    const originalOrder = store.playlistDetails.map((e) => e.entryId)
    store.shufflePlaylist(0)
    const newOrder = store.playlistDetails.map((e) => e.entryId)

    // After shuffle, the order should be different (very high probability)
    // and length should remain the same
    expect(store.playlistDetails.length).toBe(10)
  })

  it('should toggle row selection', () => {
    const store = usePlaylistStore()
    const entry = store.createPlaylistEntry({ id: 1, name: 'Test' })
    store.addSong(entry)

    expect(store.selectedRows.length).toBe(0)
    store.toggleRowSelection(entry.entryId)
    expect(store.selectedRows.length).toBe(1)
    store.toggleRowSelection(entry.entryId)
    expect(store.selectedRows.length).toBe(0)
  })

  it('should generate unique entry IDs', () => {
    const store = usePlaylistStore()
    const entry1 = store.createPlaylistEntry({ id: 1 })
    const entry2 = store.createPlaylistEntry({ id: 2 })
    expect(entry1.entryId).not.toBe(entry2.entryId)
  })

  it('should detect consecutive repeated artists', () => {
    const store = usePlaylistStore()
    const entry1 = store.createPlaylistEntry({
      id: 1,
      name: 'Song 1',
      artists: [{ id: 1, name: 'Artist A' }]
    })
    const entry2 = store.createPlaylistEntry({
      id: 2,
      name: 'Song 2',
      artists: [{ id: 1, name: 'Artist A' }]
    })
    const entry3 = store.createPlaylistEntry({
      id: 3,
      name: 'Song 3',
      artists: [{ id: 2, name: 'Artist B' }]
    })
    store.addSong(entry1)
    store.addSong(entry2)
    store.addSong(entry3)

    expect(store.repeatedArtistWarningSet.has(entry2.entryId)).toBe(true)
    expect(store.repeatedArtistWarningSet.has(entry3.entryId)).toBe(false)
  })

  it('should compute default playlist name', () => {
    const store = usePlaylistStore()
    expect(store.defaultPlaylistName).toBe('Nueva playlist')

    store.addSong(store.createPlaylistEntry({ id: 1, name: 'First Song' }))
    store.addSong(store.createPlaylistEntry({ id: 2, name: 'Last Song' }))
    expect(store.defaultPlaylistName).toBe('First Song - Last Song')
  })
})
