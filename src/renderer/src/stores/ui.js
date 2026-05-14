import { defineStore } from 'pinia'
import { ref } from 'vue'

/**
 * Navigation options mapping
 */
export const options = {
  library: 1,
  download: 2,
  add_mp3: 3,
  history: 4,
  playlists: 5,
  artists: 6,
  tags: 7,
  changelog: 8,
  settings: 9,
  edit: 10,
  wave: 11
}

export const useUIStore = defineStore('ui', () => {
  // --- Navigation ---
  const currentSelectedOption = ref(null)
  const showMenu = ref(false)

  // --- Modifier keys ---
  const isAltPressed = ref(false)
  const isLeftAltPressed = ref(false)
  const isLeftShiftPressed = ref(false)
  const isLeftMetaPressed = ref(false)

  // --- Window state ---
  const isWindowFullscreen = ref(false)

  // --- Sidebar ---
  const showAdvancedFunctions = ref(false)

  // --- Actions ---
  function setOption(option) {
    currentSelectedOption.value = option
  }

  function closePanel() {
    currentSelectedOption.value = null
  }

  function toggleMenu() {
    showMenu.value = !showMenu.value
  }

  function setModifierKeys(modifiers) {
    if (modifiers.alt !== undefined) isAltPressed.value = modifiers.alt
    if (modifiers.leftAlt !== undefined) isLeftAltPressed.value = modifiers.leftAlt
    if (modifiers.leftShift !== undefined) isLeftShiftPressed.value = modifiers.leftShift
    if (modifiers.leftMeta !== undefined) isLeftMetaPressed.value = modifiers.leftMeta
  }

  function resetModifierKeys() {
    isAltPressed.value = false
    isLeftAltPressed.value = false
    isLeftShiftPressed.value = false
    isLeftMetaPressed.value = false
  }

  function setFullscreen(fullscreen) {
    isWindowFullscreen.value = fullscreen
  }

  return {
    // State
    currentSelectedOption,
    showMenu,
    isAltPressed,
    isLeftAltPressed,
    isLeftShiftPressed,
    isLeftMetaPressed,
    isWindowFullscreen,
    showAdvancedFunctions,
    // Actions
    setOption,
    closePanel,
    toggleMenu,
    setModifierKeys,
    resetModifierKeys,
    setFullscreen
  }
})
