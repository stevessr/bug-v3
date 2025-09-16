import { createApp } from 'vue'
import { createPinia } from 'pinia'

import { useEmojiStore } from '../stores/emojiStore'

import '../styles/main.ts'
import Options from './Options.vue'

const pinia = createPinia()
//
// Use a static import so the Options component is bundled into the options entry
const app = createApp(Options)
app.use(pinia)
app.mount('#app')

// Initialize store data
const store = useEmojiStore(pinia)
store.loadData()
