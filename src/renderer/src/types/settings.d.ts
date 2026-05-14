/**
 * Type definitions for Settings
 */

export interface AppSettings {
  rowsPerPage: number
  rowsPerPageFs: number
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
