import { createApp } from 'vue'
import { createPinia } from 'pinia'

import './styles/main.ts'
import router from './options/router'
import App from './App.vue'
import { getMessage } from './utils/i18n'

const pinia = createPinia()
const app = createApp(App)
app.use(pinia)
// Always register router. Root redirect was removed to avoid unwanted automatic navigation.
app.use(router)

// Set up global i18n property
app.config.globalProperties.$t = getMessage

app.mount('#app')

// Store data will be loaded by the active component (Popup or Options) in their respective composables
