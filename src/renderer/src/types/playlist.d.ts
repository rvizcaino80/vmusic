/**
 * Type definitions for Playlist entities
 */

import type { Song } from './song'

export interface Playlist {
  id: number
  name: string
  songCount: number
  createdAt: string
  updatedAt: string
}

export interface PlaylistEntry {
  entryId: string
  song: Song
  order: number
  speed?: number
  _isSelected?: boolean
  rowIndex?: number
}

export interface PlaylistData {
  id: number
  name: string
  songs: Song[]
  createdAt: string
  updatedAt: string
}
