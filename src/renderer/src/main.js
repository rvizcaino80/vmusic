import './assets/main.css'

import { createApp } from 'vue'
import App from './App.vue'
import { installIpcHttpBridge } from './lib/ipc-http'

installIpcHttpBridge()
createApp(App).mount('#app')
