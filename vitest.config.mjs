import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'happy-dom',
    include: ['src/renderer/__tests__/**/*.{test,spec}.{js,ts}'],
    globals: true,
    setupFiles: ['src/renderer/__tests__/setup.js'],
    coverage: {
      provider: 'v8',
      include: ['src/renderer/src/**/*.{js,vue}'],
      exclude: [
        'src/renderer/src/**/*.spec.*',
        'src/renderer/src/**/*.test.*',
        'src/renderer/src/main.js',
        'src/renderer/src/lib/ipc-http.js'
      ]
    }
  },
  resolve: {
    alias: {
      '@renderer': resolve('src/renderer/src')
    }
  }
})
