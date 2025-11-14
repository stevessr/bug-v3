import { createApp } from 'vue'
import { createPinia } from 'pinia'

import './styles/main.ts'
import router from './options/router'
import App from './App.vue'

const pinia = createPinia()
const app = createApp(App)
app.use(pinia)
// Always register router. Root redirect was removed to avoid unwanted automatic navigation.
app.use(router)
app.mount('#app')

// Store data will be loaded by the active component (Popup or Options) in their respective composables
