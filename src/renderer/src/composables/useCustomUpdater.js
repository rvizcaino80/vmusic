/**
 * Custom Updater composable - Manage app update lifecycle
 * Extracted from App.vue
 */
import { ref, computed, onMounted, onUnmounted } from 'vue'

const isDev = import.meta.env.DEV

export function useCustomUpdater() {
  // --- State ---
  const customUpdaterState = ref({
    status: 'idle',
    version: '',
    message: '',
    downloaded: false,
    supported: false
  })
  const customUpdaterOverlayOpen = ref(false)
  const customUpdaterInitialStateHandled = ref(false)
  const customUpdaterDevtoolsOpen = ref(false)
  const customUpdaterDevPresetKey = ref('')

  // --- Dev presets ---
  const customUpdaterDevPresets = [
    {
      key: 'checking',
      label: 'Buscando',
      state: {
        status: 'checking',
        version: 'v2.4.0',
        message: 'Estamos consultando la última versión disponible para preparar la actualización.'
      },
      progress: 12
    },
    {
      key: 'available',
      label: 'Disponible',
      state: {
        status: 'available',
        version: 'v2.4.0',
        message: 'La actualización ya fue encontrada y está lista para descargarse en segundo plano.'
      },
      progress: 28
    },
    {
      key: 'downloading',
      label: 'Descargando',
      state: {
        status: 'downloading',
        version: 'v2.4.0',
        message: 'Descargando el paquete seguro. La app seguirá preparando el reemplazo automáticamente.'
      },
      progress: 68
    },
    {
      key: 'downloaded',
      label: 'Lista',
      state: {
        status: 'downloaded',
        version: 'v2.4.0',
        message: 'Todo está listo. Solo falta cerrar y aplicar la nueva versión.'
      },
      progress: 100
    },
    {
      key: 'installing',
      label: 'Instalando',
      state: {
        status: 'installing',
        version: 'v2.4.0',
        message: 'Reemplazando la aplicación actual con la nueva versión. Esto toma solo un momento.'
      },
      progress: 100
    },
    {
      key: 'error',
      label: 'Error',
      state: {
        status: 'error',
        version: 'v2.4.0',
        message: 'No pudimos terminar la actualización. Revisa permisos o vuelve a intentarlo.'
      },
      progress: 100
    }
  ]

  // --- Computed ---
  const customUpdaterDevPreset = computed(() => customUpdaterDevPresets.find((preset) => preset.key === customUpdaterDevPresetKey.value) || null)
  const customUpdaterPreviewActive = computed(() => isDev && Boolean(customUpdaterDevPreset.value))
  const customUpdaterDisplayState = computed(() => {
    if (!customUpdaterPreviewActive.value) {
      return customUpdaterState.value
    }

    return {
      ...customUpdaterState.value,
      ...customUpdaterDevPreset.value.state,
      downloaded: customUpdaterDevPreset.value.state.status === 'downloaded'
    }
  })

  const customUpdaterVisible = computed(() => customUpdaterOverlayOpen.value || customUpdaterPreviewActive.value || ['checking', 'available', 'downloading', 'downloaded', 'installing', 'error'].includes(customUpdaterDisplayState.value.status))
  const customUpdaterBlocking = computed(() => {
    const status = customUpdaterDisplayState.value.status

    return status === 'installing'
  })
  const customUpdaterActionVisible = computed(() => {
    const status = customUpdaterDisplayState.value.status


    // Solo mostrar el icono si hay error; la descarga e instalación son automáticas
    return status === 'error'
  })
  const customUpdaterDevtoolsVisible = computed(() => customUpdaterDevtoolsOpen.value)

  const customUpdaterStatusLabel = computed(() => {
    const map = {
      idle: 'Sin actualizaciones',
      checking: 'Buscando',
      available: 'Descargar',
      downloading: 'Descargando',
      downloaded: 'Instalar',
      installing: 'Instalando',
      error: 'Error'
    }

    return map[customUpdaterDisplayState.value.status] || 'Sin actualizaciones'
  })

  const customUpdaterStatusDetail = computed(() => {
    const s = customUpdaterDisplayState.value
    if (s.status === 'idle' && !s.supported) return 'No disponible en esta versión'
    if (s.status === 'error') return s.message || 'Error desconocido'

    return ''
  })

  const customUpdaterProgressValue = computed(() => {
    if (customUpdaterPreviewActive.value) {
      const preset = customUpdaterDevPreset.value

      return preset ? preset.progress : 0
    }

    // Map real states to progress
    const progressMap = {
      idle: 0,
      checking: 12,
      available: 28,
      downloading: 68,
      downloaded: 100,
      installing: 100,
      error: 100
    }

    return progressMap[customUpdaterDisplayState.value.status] || 0
  })

  const customUpdaterProgressVisible = computed(() => {
    return ['checking', 'downloading', 'installing'].includes(customUpdaterDisplayState.value.status) || customUpdaterPreviewActive.value
  })

  const customUpdaterProgressCaption = computed(() => {
    const s = customUpdaterDisplayState.value
    if (s.status === 'checking') return 'Consultando versión...'
    if (s.status === 'downloading') return 'Descargando actualización...'
    if (s.status === 'installing') return 'Instalando...'

    return ''
  })

  const customUpdaterTitle = computed(() => {
    const s = customUpdaterDisplayState.value
    if (s.status === 'checking') return 'Buscando actualizaciones'
    if (s.status === 'available') return 'Actualización disponible'
    if (s.status === 'downloading') return 'Descargando actualización'
    if (s.status === 'downloaded') return 'Actualización lista'
    if (s.status === 'installing') return 'Instalando actualización'
    if (s.status === 'error') return 'Error de actualización'

    return 'Actualización'
  })

  const customUpdaterMessage = computed(() => {
    return customUpdaterDisplayState.value.message || ''
  })

  // --- IPC listener ---
  function updaterListener(_event, payload) {
    customUpdaterState.value = {
      ...customUpdaterState.value,
      ...payload
    }
  }

  // --- Actions ---
  function checkCustomUpdater() {
    if (window.electron2?.checkForUpdates) {
      window.electron2.checkForUpdates()
    }
  }

  function checkAndPrepareCustomUpdater() {
    if (window.electron2?.checkAndPrepareCustomUpdater) {
      window.electron2.checkAndPrepareCustomUpdater()
    }
  }

  function openCustomUpdaterOverlay() {
    customUpdaterOverlayOpen.value = true
  }

  function closeCustomUpdaterOverlay() {
    customUpdaterOverlayOpen.value = false
  }

  function installCustomUpdaterNow() {
    if (window.electron2?.installCustomUpdaterNow) {
      window.electron2.installCustomUpdaterNow()
    }
  }

  function applyCustomUpdaterPreview(key) {
    customUpdaterDevPresetKey.value = key
  }

  function clearCustomUpdaterPreview() {
    customUpdaterDevPresetKey.value = ''
  }

  function toggleCustomUpdaterDevtools() {
    customUpdaterDevtoolsOpen.value = !customUpdaterDevtoolsOpen.value
  }

  function shouldAutoOpenLibraryAtStartup(status) {
    return status !== 'checking' && status !== 'downloading' && status !== 'available'
  }

  // --- Lifecycle ---
  let removeListener = null

  onMounted(() => {
    if (window.electron2?.onCustomUpdaterState) {
      removeListener = window.electron2.onCustomUpdaterState(updaterListener)
    }
  })

  onUnmounted(() => {
    if (removeListener) removeListener()
  })

  return {

    // State
    customUpdaterState,
    customUpdaterOverlayOpen,
    customUpdaterInitialStateHandled,
    customUpdaterDevtoolsOpen,
    customUpdaterDevPresetKey,
    customUpdaterDevPresets,

    // Computed
    customUpdaterDevPreset,
    customUpdaterPreviewActive,
    customUpdaterDisplayState,
    customUpdaterVisible,
    customUpdaterBlocking,
    customUpdaterActionVisible,
    customUpdaterDevtoolsVisible,
    customUpdaterStatusLabel,
    customUpdaterStatusDetail,
    customUpdaterProgressValue,
    customUpdaterProgressVisible,
    customUpdaterProgressCaption,
    customUpdaterTitle,
    customUpdaterMessage,

    // Actions
    checkCustomUpdater,
    checkAndPrepareCustomUpdater,
    openCustomUpdaterOverlay,
    closeCustomUpdaterOverlay,
    installCustomUpdaterNow,
    applyCustomUpdaterPreview,
    clearCustomUpdaterPreview,
    toggleCustomUpdaterDevtools,
    shouldAutoOpenLibraryAtStartup
  }
}
