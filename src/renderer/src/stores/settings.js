import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

const COLOR_SCHEMA_VALUES = [
  'monochrome', 'sunset', 'aurora', 'orquidea', 'tormenta_cobre',
  'bosque', 'linen', 'coral', 'nocturno', 'ocean', 'oceano'
]

const STORAGE_KEY = 'vmusic_settings'

/**
 * Default settings values
 */
const DEFAULTS = {
  crossfaderTime: 8,
  recentlyAddedTime: 7,
  historyLimit: 100,
  previewSinkId: '',
  deckSinkId: '',
  baseSpeed: 0,
  colorSchema: 'sunset',
  showAdvancedFunctions: false,
  autoUpdateCovers: true,
  excludeTags: []
}

/**
 * Normalize and validate settings from localStorage
 */
function normalizeSettings(raw) {
  if (!raw || typeof raw !== 'object') return { ...DEFAULTS }

  return {
    crossfaderTime: Number(raw.crossfaderTime) || DEFAULTS.crossfaderTime,
    recentlyAddedTime: Number(raw.recentlyAddedTime) || DEFAULTS.recentlyAddedTime,
    historyLimit: Number(raw.historyLimit) || DEFAULTS.historyLimit,
    previewSinkId: String(raw.previewSinkId || ''),
    deckSinkId: String(raw.deckSinkId || ''),
    baseSpeed: Number(raw.baseSpeed) || DEFAULTS.baseSpeed,
    colorSchema: COLOR_SCHEMA_VALUES.includes(String(raw.colorSchema || ''))
      ? String(raw.colorSchema)
      : DEFAULTS.colorSchema,
    showAdvancedFunctions: Boolean(raw.showAdvancedFunctions),
    autoUpdateCovers: raw.autoUpdateCovers !== false,
    excludeTags: Array.isArray(raw.excludeTags) ? raw.excludeTags : []
  }
}

export const useSettingsStore = defineStore('settings', () => {
  // Load initial state from localStorage
  let stored
  try {
    stored = normalizeSettings(JSON.parse(localStorage.getItem(STORAGE_KEY)))
  } catch {
    stored = { ...DEFAULTS }
  }

  // --- State ---
  const crossfaderTime = ref(stored.crossfaderTime)
  const recentlyAddedTime = ref(stored.recentlyAddedTime)
  const historyLimit = ref(stored.historyLimit)
  const previewSinkId = ref(stored.previewSinkId)
  const deckSinkId = ref(stored.deckSinkId)
  const baseSpeed = ref(stored.baseSpeed)
  const colorSchema = ref(stored.colorSchema)
  const showAdvancedFunctions = ref(stored.showAdvancedFunctions)
  const autoUpdateCovers = ref(stored.autoUpdateCovers)
  const excludeTags = ref(stored.excludeTags)

  // --- Persist to localStorage on change ---
  function persist() {
    const data = {
      crossfaderTime: crossfaderTime.value,
      recentlyAddedTime: recentlyAddedTime.value,
      historyLimit: historyLimit.value,
      previewSinkId: previewSinkId.value,
      deckSinkId: deckSinkId.value,
      baseSpeed: baseSpeed.value,
      colorSchema: colorSchema.value,
      showAdvancedFunctions: showAdvancedFunctions.value,
      autoUpdateCovers: autoUpdateCovers.value,
      excludeTags: excludeTags.value
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }

  // Watch all settings and persist
  watch(
    [
      crossfaderTime, recentlyAddedTime,
      historyLimit, previewSinkId, deckSinkId, baseSpeed, colorSchema,
      showAdvancedFunctions, autoUpdateCovers, excludeTags
    ],
    persist,
    { deep: true }
  )

  // --- Actions ---
  function updateSettings(settings) {
    if (settings.crossfaderTime !== undefined) crossfaderTime.value = settings.crossfaderTime
    if (settings.recentlyAddedTime !== undefined) recentlyAddedTime.value = settings.recentlyAddedTime
    if (settings.historyLimit !== undefined) historyLimit.value = settings.historyLimit
    if (settings.previewSinkId !== undefined) previewSinkId.value = settings.previewSinkId
    if (settings.deckSinkId !== undefined) deckSinkId.value = settings.deckSinkId
    if (settings.baseSpeed !== undefined) baseSpeed.value = settings.baseSpeed
    if (settings.colorSchema !== undefined) colorSchema.value = settings.colorSchema
    if (settings.showAdvancedFunctions !== undefined) showAdvancedFunctions.value = settings.showAdvancedFunctions
    if (settings.autoUpdateCovers !== undefined) autoUpdateCovers.value = settings.autoUpdateCovers
    if (settings.excludeTags !== undefined) excludeTags.value = settings.excludeTags
  }

  function resetToDefaults() {
    updateSettings(DEFAULTS)
  }

  return {
    // State
    crossfaderTime,
    recentlyAddedTime,
    historyLimit,
    previewSinkId,
    deckSinkId,
    baseSpeed,
    colorSchema,
    showAdvancedFunctions,
    autoUpdateCovers,
    excludeTags,
    // Actions
    updateSettings,
    resetToDefaults,
    persist
  }
})
