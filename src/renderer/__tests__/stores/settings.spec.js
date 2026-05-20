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
    expect(store.crossfaderTime).toBe(8)
    expect(store.colorSchema).toBe('sunset')
    expect(store.showAdvancedFunctions).toBe(false)
    expect(store.autoUpdateCovers).toBe(true)
    expect(store.baseSpeed).toBe(0)
  })

  it('should load persisted values from localStorage', () => {
    localStorage.setItem('vmusic_settings', JSON.stringify({
      colorSchema: 'aurora',
      showAdvancedFunctions: true
    }))

    const store = useSettingsStore()
    expect(store.colorSchema).toBe('aurora')
    expect(store.showAdvancedFunctions).toBe(true)
    // Non-specified values should fall back to defaults
    expect(store.crossfaderTime).toBe(8)
  })

  it('should update settings correctly', () => {
    const store = useSettingsStore()
    store.updateSettings({
      crossfaderTime: 12,
      colorSchema: 'ocean'
    })
    expect(store.crossfaderTime).toBe(12)
    expect(store.colorSchema).toBe('ocean')
    // Unchanged values remain default
    expect(store.historyLimit).toBe(100)
  })

  it('should persist to localStorage on change', () => {
    const store = useSettingsStore()
    store.updateSettings({ crossfaderTime: 5 })
    store.persist()

    const stored = JSON.parse(localStorage.getItem('vmusic_settings'))
    expect(stored.crossfaderTime).toBe(5)
  })

  it('should normalize invalid values on load', () => {
    localStorage.setItem('vmusic_settings', JSON.stringify({
      crossfaderTime: null,
      colorSchema: 123
    }))

    const store = useSettingsStore()
    expect(store.crossfaderTime).toBe(8)
    expect(store.colorSchema).toBe('sunset')
  })

  it('should handle corrupt localStorage gracefully', () => {
    localStorage.setItem('vmusic_settings', '{corrupt-json')
    const store = useSettingsStore()
    expect(store.crossfaderTime).toBe(8)
    expect(store.colorSchema).toBe('sunset')
  })
})
