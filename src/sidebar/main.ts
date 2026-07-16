import { createApp } from 'vue'
import { createPinia } from 'pinia'

import '../styles/theme.ts'

import Sidebar from './Sidebar.vue'

const app = createApp(Sidebar)
app.use(createPinia())
app.mount('#app')
