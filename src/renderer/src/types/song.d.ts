/**
 * Type definitions for Song entities
 */

export interface Artist {
  id: number
  name: string
  createdAt?: string
  updatedAt?: string
}

export interface Tag {
  id: number
  name: string
  createdAt?: string
  updatedAt?: string
}

export interface Song {
  id: number
  ytid: string
  folder?: string
  name: string
  speed?: number
  duration: number
  start?: number
  end?: number
  duration_original?: string
  playCount: number
  artists?: Artist[]
  composers?: Artist[]
  tags?: Tag[]
  isAppleMusic?: boolean
  createdAt: string
  updatedAt: string
}

export interface FilterParams {
  artistIds?: number[]
  tagIds?: number[]
  limit?: number
  offset?: number
}
