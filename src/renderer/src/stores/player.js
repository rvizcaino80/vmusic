import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const usePlayerStore = defineStore('player', () => {
  // --- Player refs (set by Player.vue components on mount) ---
  const player1 = ref(null)
  const player2 = ref(null)

  // --- Playback state ---
  const isFirstPlay = ref(true)
  const lastActiveDeckPosition = ref('top')

  // --- Preview state ---
  const previewAudio = ref(null)
  const previewSongId = ref(null)
  const previewStatus = ref('idle') // 'idle' | 'loading' | 'playing'
  const isPreviewLoading = ref(false)
  const previewSinkId = ref('')
  const previewOutputs = ref([])
  const previewPlaylistEntryId = ref(null)
  const waveEditorPreviewActive = ref(false)

  // --- Audio output ---
  const deckSinkId = ref('')

  // --- System power ---
  const playbackStateBeforePowerInterruption = ref(null)

  // --- Computed ---
  const activePlayer = computed(() => {
    if (!player1.value || !player2.value) return null
    if (player1.value.status === 'playing') return player1.value
    if (player2.value.status === 'playing') return player2.value
    return lastActiveDeckPosition.value === 'top' ? player1.value : player2.value
  })

  const activeDeckPosition = computed(() => {
    if (!activePlayer.value) return lastActiveDeckPosition.value
    return activePlayer.value === player1.value ? 'top' : 'bottom'
  })

  function isPlayerReady(playerRef) {
    return playerRef && playerRef.isReady
  }

  function isPlayerPlaying(playerRef) {
    return playerRef && playerRef.status === 'playing'
  }

  function getPlayerByPosition(position) {
    return position === 'top' ? player1.value : player2.value
  }

  function getReadyPlayerForPlayback() {
    // Find a player that has a song loaded and is ready
    if (player1.value && player1.value.isReady && player1.value.songFull?.id) return player1.value
    if (player2.value && player2.value.isReady && player2.value.songFull?.id) return player2.value
    return null
  }

  function getActivePlayerForManualNext() {
    const p1 = player1.value
    const p2 = player2.value

    // If one is playing and the other isn't, use the playing one
    if (p1 && p2) {
      if (p1.status === 'playing' && p2.status !== 'playing') return p1
      if (p2.status === 'playing' && p1.status !== 'playing') return p2
      // If both are playing, use the last active deck
      return lastActiveDeckPosition.value === 'top' ? p1 : p2
    }
    return p1 || p2
  }

  function getMediaTargetPlayer() {
    const p1 = player1.value
    const p2 = player2.value
    if (p1 && p1.status === 'playing') return p1
    if (p2 && p2.status === 'playing') return p2
    return null
  }

  function isDeckReadyForAutoTransition(playerRef) {
    if (!playerRef || !playerRef.isReady) return false
    return playerRef.status === 'paused' || playerRef.status === 'idle'
  }

  function rememberActiveDeck(playerRef) {
    if (playerRef === player1.value) lastActiveDeckPosition.value = 'top'
    else if (playerRef === player2.value) lastActiveDeckPosition.value = 'bottom'
  }

  // --- Preview ---
  function isMissingAudioDeviceError(error) {
    const msg = String(error?.message || '').toLowerCase()
    return msg.includes('no audio output') || msg.includes('missing') || msg.includes('not found')
  }

  function resetPreviewState() {
    previewStatus.value = 'idle'
    previewSongId.value = null
    isPreviewLoading.value = false
    previewPlaylistEntryId.value = null
  }

  // --- Power ---
  function isPlayerActivelyPlaying(playerRef) {
    if (!playerRef) return false
    return playerRef.status === 'playing' && !playerRef.isPaused
  }

  function capturePlaybackStateBeforePowerInterruption() {
    playbackStateBeforePowerInterruption.value = {
      player1WasPlaying: player1.value ? isPlayerActivelyPlaying(player1.value) : false,
      player2WasPlaying: player2.value ? isPlayerActivelyPlaying(player2.value) : false,
      player1Position: player1.value?.getCurrentTime?.() || 0,
      player2Position: player2.value?.getCurrentTime?.() || 0
    }
  }

  function clearPowerInterruptionState() {
    playbackStateBeforePowerInterruption.value = null
  }

  return {
    // State
    player1,
    player2,
    isFirstPlay,
    lastActiveDeckPosition,
    previewAudio,
    previewSongId,
    previewStatus,
    isPreviewLoading,
    previewSinkId,
    previewOutputs,
    previewPlaylistEntryId,
    waveEditorPreviewActive,
    deckSinkId,
    playbackStateBeforePowerInterruption,

    // Computed
    activePlayer,
    activeDeckPosition,

    // Methods
    isPlayerReady,
    isPlayerPlaying,
    getPlayerByPosition,
    getReadyPlayerForPlayback,
    getActivePlayerForManualNext,
    getMediaTargetPlayer,
    isDeckReadyForAutoTransition,
    rememberActiveDeck,
    isMissingAudioDeviceError,
    resetPreviewState,
    isPlayerActivelyPlaying,
    capturePlaybackStateBeforePowerInterruption,
    clearPowerInterruptionState
  }
})
