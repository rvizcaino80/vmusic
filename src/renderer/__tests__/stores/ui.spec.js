import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useUIStore } from '../../src/stores/ui'

describe('useUIStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('should start with no panel selected', () => {
    const store = useUIStore()
    expect(store.currentSelectedOption).toBeNull()
    expect(store.showMenu).toBe(false)
  })

  it('should set the current option', () => {
    const store = useUIStore()
    store.setOption('playlists')
    expect(store.currentSelectedOption).toBe('playlists')
  })

  it('should close the panel', () => {
    const store = useUIStore()
    store.setOption('settings')
    expect(store.currentSelectedOption).toBe('settings')
    store.closePanel()
    expect(store.currentSelectedOption).toBeNull()
  })

  it('should toggle menu', () => {
    const store = useUIStore()
    expect(store.showMenu).toBe(false)
    store.toggleMenu()
    expect(store.showMenu).toBe(true)
    store.toggleMenu()
    expect(store.showMenu).toBe(false)
  })

  it('should set modifier keys', () => {
    const store = useUIStore()
    store.setModifierKeys({ alt: true, leftAlt: true, leftShift: false, leftMeta: false })
    expect(store.isAltPressed).toBe(true)
    expect(store.isLeftAltPressed).toBe(true)
    expect(store.isLeftShiftPressed).toBe(false)
  })

  it('should reset modifier keys', () => {
    const store = useUIStore()
    store.setModifierKeys({ alt: true, leftAlt: true, leftShift: true, leftMeta: true })
    store.resetModifierKeys()
    expect(store.isAltPressed).toBe(false)
    expect(store.isLeftAltPressed).toBe(false)
    expect(store.isLeftShiftPressed).toBe(false)
    expect(store.isLeftMetaPressed).toBe(false)
  })

  it('should set fullscreen state', () => {
    const store = useUIStore()
    expect(store.isWindowFullscreen).toBe(false)
    store.setFullscreen(true)
    expect(store.isWindowFullscreen).toBe(true)
  })
})
