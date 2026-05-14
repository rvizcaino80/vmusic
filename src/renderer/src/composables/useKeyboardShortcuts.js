/**
 * Keyboard Shortcuts composable - Handle keyboard and media session events
 * Extracted from App.vue
 */
import { onMounted, onUnmounted } from 'vue'
import { usePlayerStore } from '../stores/player'
import { useUIStore, options } from '../stores/ui'

export function useKeyboardShortcuts() {
  const playerStore = usePlayerStore()
  const uiStore = useUIStore()

  const ESC_DOUBLE_PRESS_WINDOW_MS = 1000
  let lastEscapePressAt = 0

  function isEditableKeyboardTarget(target) {
    if (!target) return false
    const tag = target.tagName?.toLowerCase()
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return true
    if (target.isContentEditable) return true
    return false
  }

  function seekActivePlayer(deltaSeconds) {
    const player = playerStore.activePlayer
    if (player && player.seekTo) {
      const currentTime = player.getCurrentTime?.() || 0
      player.seekTo(Math.max(0, currentTime + deltaSeconds))
    }
  }

  function adjustActivePlayerSpeed(delta) {
    const player = playerStore.activePlayer
    if (player && player.setPlaybackSpeed) {
      const currentSpeed = player.getPlaybackSpeed?.() || 1
      player.setPlaybackSpeed(Math.max(0.5, Math.min(2, currentSpeed + delta)))
    }
  }

  function resetActivePlayerSpeed() {
    const player = playerStore.activePlayer
    if (player && player.setPlaybackSpeed) {
      player.setPlaybackSpeed(1)
    }
  }

  function onHardwareMediaKey(event) {
    // Map media keys to player actions
    // The actual implementation depends on Media Session API
    // This is a fallback for older browsers
    if (event.key === 'MediaPlayPause') {
      playerStore.activePlayer?.playPause?.()
    } else if (event.key === 'MediaTrackNext') {
      // Emit next event - handled by App.vue
      window.dispatchEvent(new CustomEvent('vmusic-next-track'))
    } else if (event.key === 'MediaTrackPrevious') {
      window.dispatchEvent(new CustomEvent('vmusic-prev-track'))
    }
  }

  function onKeyboardSeekKey(event) {
    if (isEditableKeyboardTarget(event.target)) return

    const isAlt = uiStore.isAltPressed
    const isShift = uiStore.isLeftShiftPressed

    // Arrow Left/Right: seek
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      seekActivePlayer(isAlt ? -10 : -5)
      return
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      seekActivePlayer(isAlt ? 10 : 5)
      return
    }

    // Arrow Up/Down: speed
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      adjustActivePlayerSpeed(isShift ? 0.1 : 0.05)
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      adjustActivePlayerSpeed(isShift ? -0.1 : -0.05)
      return
    }

    // Escape: close panels or double-escape to reset filters
    if (event.key === 'Escape') {
      const now = Date.now()
      if (now - lastEscapePressAt < ESC_DOUBLE_PRESS_WINDOW_MS) {
        lastEscapePressAt = 0
        window.dispatchEvent(new CustomEvent('vmusic-double-escape'))
      } else {
        lastEscapePressAt = now
      }
      return
    }
  }

  function onModifierKeyDown(event) {
    uiStore.setModifierKeys({
      alt: event.altKey,
      leftAlt: event.code === 'AltLeft',
      leftShift: event.code === 'ShiftLeft',
      leftMeta: event.metaKey
    })
  }

  function onModifierKeyUp(event) {
    if (!event.altKey && !event.shiftKey && !event.metaKey) {
      uiStore.resetModifierKeys()
    } else {
      uiStore.setModifierKeys({
        alt: event.altKey,
        leftAlt: event.code === 'AltLeft' ? false : uiStore.isLeftAltPressed,
        leftShift: event.code === 'ShiftLeft' ? false : uiStore.isLeftShiftPressed,
        leftMeta: event.metaKey
      })
    }
  }

  function onWindowBlurResetModifiers() {
    uiStore.resetModifierKeys()
  }

  function setupKeyboardListeners() {
    window.addEventListener('keydown', onKeyboardSeekKey)
    window.addEventListener('keydown', onModifierKeyDown)
    window.addEventListener('keyup', onModifierKeyUp)
    window.addEventListener('blur', onWindowBlurResetModifiers)
    // Media keys
    navigator.mediaSession?.setActionHandler?.('play', () => playerStore.activePlayer?.play?.())
    navigator.mediaSession?.setActionHandler?.('pause', () => playerStore.activePlayer?.pause?.())
    navigator.mediaSession?.setActionHandler?.('nexttrack', () => window.dispatchEvent(new CustomEvent('vmusic-next-track')))
    navigator.mediaSession?.setActionHandler?.('previoustrack', () => window.dispatchEvent(new CustomEvent('vmusic-prev-track')))
  }

  function cleanupKeyboardListeners() {
    window.removeEventListener('keydown', onKeyboardSeekKey)
    window.removeEventListener('keydown', onModifierKeyDown)
    window.removeEventListener('keyup', onModifierKeyUp)
    window.removeEventListener('blur', onWindowBlurResetModifiers)
  }

  return {
    setupKeyboardListeners,
    cleanupKeyboardListeners,
    seekActivePlayer,
    adjustActivePlayerSpeed,
    resetActivePlayerSpeed,
    isEditableKeyboardTarget
  }
}
