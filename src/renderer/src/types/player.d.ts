/**
 * Type definitions for Player entities
 */

export type PlayerStatus = 'idle' | 'loading' | 'ready' | 'playing' | 'paused' | 'changing' | 'stopped' | 'leveling'

export interface PlayerState {
  status: PlayerStatus
  songFull: { id?: number; name?: string; artists?: { id: number; name: string }[] } | null
  isReady: boolean
  isPaused?: boolean
  position: string
  left: boolean
}

export interface PreviewState {
  status: 'idle' | 'loading' | 'playing'
  songId: number | null
  isPreviewLoading: boolean
  sinkId: string
}

export interface AudioDevice {
  deviceId: string
  groupId: string
  kind: string
  label: string
}
