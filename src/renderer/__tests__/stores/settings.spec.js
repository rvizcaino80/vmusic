import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useSettingsStore } from '../../src/stores/settings'

describe('useSettingsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('should have default values when nothing is stored', () => {
    const store = useSettingsStore()
    expect(store.rowsPerPage).toBe(50)
    expect(store.rowsPerPageFs).toBe(100)
    expect(store.crossfaderTime).toBe(8)
    expect(store.colorSchema).toBe('sunset')
    expect(store.showAdvancedFunctions).toBe(false)
    expect(store.autoUpdateCovers).toBe(true)
    expect(store.baseSpeed).toBe(0)
  })

  it('should load persisted values from localStorage', () => {
    localStorage.setItem('vmusic_settings', JSON.stringify({
      rowsPerPage: 25,
      colorSchema: 'aurora',
      showAdvancedFunctions: true
    }))

    const store = useSettingsStore()
    expect(store.rowsPerPage).toBe(25)
    expect(store.colorSchema).toBe('aurora')
    expect(store.showAdvancedFunctions).toBe(true)
    // Non-specified values should fall back to defaults
    expect(store.crossfaderTime).toBe(8)
  })

  it('should update settings correctly', () => {
    const store = useSettingsStore()
    store.updateSettings({
      rowsPerPage: 100,
      crossfaderTime: 12,
      colorSchema: 'ocean'
    })
    expect(store.rowsPerPage).toBe(100)
    expect(store.crossfaderTime).toBe(12)
    expect(store.colorSchema).toBe('ocean')
    // Unchanged values remain default
    expect(store.historyLimit).toBe(100)
  })

  it('should persist to localStorage on change', () => {
    const store = useSettingsStore()
    store.updateSettings({ rowsPerPage: 75 })
    store.persist()

    const stored = JSON.parse(localStorage.getItem('vmusic_settings'))
    expect(stored.rowsPerPage).toBe(75)
  })

  it('should compute rows per page based on fullscreen mode', () => {
    const store = useSettingsStore()
    store.updateSettings({ rowsPerPage: 50, rowsPerPageFs: 200 })
    expect(store.getRowsPerPageByMode(false)).toBe(50)
    expect(store.getRowsPerPageByMode(true)).toBe(200)
  })

  it('should normalize invalid values on load', () => {
    localStorage.setItem('vmusic_settings', JSON.stringify({
      rowsPerPage: 'invalid',
      crossfaderTime: null,
      colorSchema: 123
    }))

    const store = useSettingsStore()
    expect(store.rowsPerPage).toBe(50) // Falls back to default
    expect(store.crossfaderTime).toBe(8)
    expect(store.colorSchema).toBe('sunset')
  })

  it('should handle corrupt localStorage gracefully', () => {
    localStorage.setItem('vmusic_settings', '{corrupt-json')
    const store = useSettingsStore()
    expect(store.rowsPerPage).toBe(50)
    expect(store.colorSchema).toBe('sunset')
  })
})
