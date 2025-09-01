import { createApp } from 'vue'
import { createPinia } from 'pinia'

import Options from './Options.vue'
import router from './router'
import '../styles/main.css'

const pinia = createPinia()
const app = createApp(Options)

app.use(pinia)
app.use(router)
app.mount('#app')

// Initialize store data
import { useEmojiStore } from '../stores/emojiStore'

const store = useEmojiStore(pinia)
store.loadData()
