import { vi } from 'vitest'

// Mock window.electron2 for IPC calls
window.electron2 = {
  backendRequest: vi.fn().mockResolvedValue({ status: 200, data: {} }),
  platform: vi.fn().mockReturnValue('darwin')
}

// Mock localStorage
const localStorageMock = (() => {
  let store = {}
  return {
    getItem: vi.fn((key) => store[key] ?? null),
    setItem: vi.fn((key, value) => { store[key] = String(value) }),
    removeItem: vi.fn((key) => { delete store[key] }),
    clear: vi.fn(() => { store = {} }),
    get length() { return Object.keys(store).length },
    key: vi.fn((index) => Object.keys(store)[index] ?? null)
  }
})()

Object.defineProperty(window, 'localStorage', { value: localStorageMock })

// Mock IntersectionObserver
class MockIntersectionObserver {
  constructor(callback) { this.callback = callback }
  observe() { return null }
  unobserve() { return null }
  disconnect() { return null }
}
Object.defineProperty(window, 'IntersectionObserver', {
  value: MockIntersectionObserver,
  writable: true
})

// Mock ResizeObserver
class MockResizeObserver {
  constructor(callback) { this.callback = callback }
  observe() { return null }
  unobserve() { return null }
  disconnect() { return null }
}
Object.defineProperty(window, 'ResizeObserver', {
  value: MockResizeObserver,
  writable: true
})

// Mock AudioContext
class MockAudioContext {
  constructor() {
    this.state = 'running'
    this.sampleRate = 44100
  }
  createMediaElementSource() { return { connect: vi.fn() } }
  createAnalyser() { return { connect: vi.fn(), getByteFrequencyData: vi.fn(), getByteTimeDomainData: vi.fn(), fftSize: 2048, frequencyBinCount: 1024 } }
  createGain() { return { connect: vi.fn(), gain: { value: 0, setValueAtTime: vi.fn() } } }
  createBiquadFilter() { return { connect: vi.fn(), type: '', frequency: { value: 0 } } }
  close() { return Promise.resolve() }
  resume() { return Promise.resolve() }
}
Object.defineProperty(window, 'AudioContext', { value: MockAudioContext })

// Suppress Vue warnings in tests
process.env.VUE_PROD_DEVTOOLS = 'false'
