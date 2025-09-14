import { createApp } from 'vue'
import { createPinia } from 'pinia'

import Waline from './Waline.vue'
import '../styles/main.ts'

const app = createApp(Waline)
const pinia = createPinia()

app.use(pinia)
app.mount('#app')
