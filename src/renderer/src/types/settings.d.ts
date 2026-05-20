/**
 * Type definitions for Settings
 */

export interface AppSettings {
  crossfaderTime: number
  recentlyAddedTime: number
  historyLimit: number
  previewSinkId: string
  deckSinkId: string
  baseSpeed: number
  colorSchema: string
  showAdvancedFunctions: boolean
  autoUpdateCovers: boolean
  excludeTags: number[]
}
