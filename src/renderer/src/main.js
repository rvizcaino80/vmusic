import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { installIpcHttpBridge } from './lib/ipc-http'
import router from './router'

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

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
