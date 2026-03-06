import './assets/main.css'

import { createApp } from 'vue'
import App from './App.vue'
import { installIpcHttpBridge } from './lib/ipc-http'

installIpcHttpBridge()
window.addEventListener('unhandledrejection', (event) => {
  const reason = event?.reason
  const name = String(reason?.name || '')
  const message = String(reason?.message || '')
  const isAbort = name === 'AbortError' || message.toLowerCase().includes('aborted')
  if (isAbort) {
    event.preventDefault()
  }
})
createApp(App).mount('#app')
