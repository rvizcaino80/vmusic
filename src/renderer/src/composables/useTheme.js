/**
 * Theme composable - Color schema management
 * Extracted from App.vue
 */
import { ref, watch } from 'vue'
import { useSettingsStore } from '../stores/settings'

const COLOR_SCHEMA_DEFAULT = 'sunset'
const COLOR_SCHEMA_VALUES = [
  'monochrome', 'sunset', 'aurora', 'orquidea', 'tormenta_cobre',
  'bosque', 'linen', 'coral', 'nocturno', 'ocean', 'oceano'
]
const COLOR_SCHEMA_TRANSITION_MS = 1000

export function useTheme() {
  const settings = useSettingsStore()

  let colorSchemaTransitionTimer = null
  let colorSchemaTransitionRaf = null

  function normalizeColorSchema(schema) {
    if (schema === 'default') return 'sunset'
    if (schema === 'graphite') return 'aurora'
    if (!schema || !COLOR_SCHEMA_VALUES.includes(schema)) return COLOR_SCHEMA_DEFAULT
    return schema
  }

  function applyColorSchema(schema) {
    const normalized = normalizeColorSchema(schema)
    const root = document.documentElement
    root.classList.add('vm-theme-transitioning')

    // Force browser to commit transition styles
    root.offsetHeight

    if (colorSchemaTransitionRaf) {
      cancelAnimationFrame(colorSchemaTransitionRaf)
    }
    colorSchemaTransitionRaf = requestAnimationFrame(() => {
      root.setAttribute('data-color-schema', normalized)
      window.dispatchEvent(
        new CustomEvent('vmusic-color-schema-changed', {
          detail: { schema: normalized }
        })
      )
      colorSchemaTransitionRaf = null
    })

    if (colorSchemaTransitionTimer) {
      clearTimeout(colorSchemaTransitionTimer)
    }
    colorSchemaTransitionTimer = setTimeout(() => {
      root.classList.remove('vm-theme-transitioning')
      colorSchemaTransitionTimer = null
    }, COLOR_SCHEMA_TRANSITION_MS + 40)

    return normalized
  }

  // Watch for settings changes and apply theme
  watch(() => settings.colorSchema, (newSchema) => {
    if (newSchema) {
      applyColorSchema(newSchema)
    }
  })

  // Apply initial schema
  function initializeTheme() {
    applyColorSchema(settings.colorSchema)
  }

  return {
    applyColorSchema,
    normalizeColorSchema,
    initializeTheme,
    COLOR_SCHEMA_VALUES,
    COLOR_SCHEMA_DEFAULT
  }
}
