import { createApp } from 'vue'
import { createPinia } from 'pinia'

import '../styles/main.ts'

import router from './router'
import Options from './Options.vue'

const pinia = createPinia()
//
// Use a static import so the Options component is bundled into the options entry
const app = createApp(Options)
app.use(pinia)
app.use(router)
app.mount('#app')

// Store data will be loaded in useOptions composable's onMounted hook
