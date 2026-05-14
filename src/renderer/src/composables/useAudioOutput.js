/**
 * Audio Output composable - Manage audio output devices
 * Extracted from App.vue
 */
import { ref, watch } from 'vue'
import { usePlayerStore } from '../stores/player'
import { useSettingsStore } from '../stores/settings'

const HEADPHONE_REGEX = /(head(phone|set)|aud[ií]fono|auricular|earbud)/i

export function useAudioOutput() {
  const playerStore = usePlayerStore()
  const settingsStore = useSettingsStore()

  function normalizeOutputDeviceId(deviceId) {
    if (!deviceId || deviceId === 'default' || deviceId === 'undefined' || deviceId === 'null') {
      return ''
    }
    return deviceId
  }

  function buildOutputOptions(outputs) {
    return (outputs || []).map((device) => ({
      label: device.label || `Dispositivo ${device.deviceId.slice(0, 8)}`,
      value: device.deviceId
    }))
  }

  function pickPreferredOutputDevice(outputs, preferredId) {
    if (!outputs || outputs.length === 0) return null

    // Try preferred ID first
    if (preferredId) {
      const preferred = outputs.find((d) => d.deviceId === preferredId)
      if (preferred) return preferred
    }

    // Try default device
    const defaultDevice = outputs.find((d) => d.deviceId === 'default')
    if (defaultDevice) return defaultDevice

    // Fall back to first device
    return outputs[0]
  }

  async function requestOutputDevices() {
    try {
      // Need user interaction first for audio devices
      const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaStream.getTracks().forEach((track) => track.stop())

      const devices = await navigator.mediaDevices.enumerateDevices()
      return devices.filter((d) => d.kind === 'audiooutput')
    } catch (err) {
      console.error('Error enumerating audio devices:', err)
      return []
    }
  }

  function persistResolvedOutputSettings(values) {
    if (values.deckSinkId !== undefined) {
      settingsStore.deckSinkId = values.deckSinkId
    }
    if (values.previewSinkId !== undefined) {
      settingsStore.previewSinkId = values.previewSinkId
    }
    settingsStore.persist()
  }

  function applyDeckSinkToPlayers() {
    const sinkId = normalizeOutputDeviceId(settingsStore.deckSinkId)
    playerStore.deckSinkId = sinkId

    if (playerStore.player1 && playerStore.player1.setSinkId) {
      playerStore.player1.setSinkId(sinkId)
    }
    if (playerStore.player2 && playerStore.player2.setSinkId) {
      playerStore.player2.setSinkId(sinkId)
    }
  }

  async function loadPreviewOutputs() {
    try {
      const outputs = await requestOutputDevices()
      playerStore.previewOutputs = outputs
      return outputs
    } catch (err) {
      console.error('Error loading preview outputs:', err)
      return []
    }
  }

  async function resolvePreferredOutputDevices() {
    const outputs = await requestOutputDevices()
    if (outputs.length === 0) return

    // Find headphones for preview
    const headphones = outputs.find((d) => HEADPHONE_REGEX.test(d.label))
    const preferredPreview = headphones || outputs[1] || outputs[0]

    const resolvedValues = {}

    if (!settingsStore.deckSinkId) {
      const deckDevice = pickPreferredOutputDevice(outputs, 'default')
      resolvedValues.deckSinkId = deckDevice?.deviceId || ''
    }

    if (!settingsStore.previewSinkId || settingsStore.previewSinkId === settingsStore.deckSinkId) {
      resolvedValues.previewSinkId = preferredPreview?.deviceId || ''
    }

    if (Object.keys(resolvedValues).length > 0) {
      persistResolvedOutputSettings(resolvedValues)
    }
  }

  async function initializePreferredOutputDevices() {
    const settings = settingsStore
    if (settings.deckSinkId && settings.previewSinkId) {
      // Already configured, just apply
      applyDeckSinkToPlayers()
      return
    }

    // Auto-detect
    await resolvePreferredOutputDevices()
    applyDeckSinkToPlayers()
  }

  async function ensurePreviewPlayer() {
    if (playerStore.previewAudio) return

    const audio = new Audio()
    audio.crossOrigin = 'anonymous'
    audio.preload = 'auto'
    playerStore.previewAudio = audio
  }

  async function preparePreviewOutput() {
    await ensurePreviewPlayer()

    const sinkId = normalizeOutputDeviceId(settingsStore.previewSinkId)
    if (sinkId && playerStore.previewAudio?.setSinkId) {
      try {
        await playerStore.previewAudio.setSinkId(sinkId)
      } catch (err) {
        console.warn('Could not set preview sink:', err)
      }
    }

    playerStore.previewSinkId = sinkId
  }

  return {
    normalizeOutputDeviceId,
    buildOutputOptions,
    pickPreferredOutputDevice,
    requestOutputDevices,
    persistResolvedOutputSettings,
    applyDeckSinkToPlayers,
    loadPreviewOutputs,
    resolvePreferredOutputDevices,
    initializePreferredOutputDevices,
    ensurePreviewPlayer,
    preparePreviewOutput,
    HEADPHONE_REGEX
  }
}
