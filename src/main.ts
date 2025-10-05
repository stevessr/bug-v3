import { createApp } from 'vue'
import { createPinia } from 'pinia'

import './styles/main.ts'
import { useEmojiStore } from './stores/emojiStore'
import router from './options/router'

import App from './App.vue'

const pinia = createPinia()
const app = createApp(App)
app.use(pinia)
app.use(router) // 始终注册路由，即使在 Popup 模式下也不会影响
app.mount('#app')

// Initialize store data
const store = useEmojiStore(pinia)
store.loadData()
