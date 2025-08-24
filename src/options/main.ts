import { createApp } from 'vue'
import { createPinia } from 'pinia'
import Antd from 'ant-design-vue'
import 'ant-design-vue/dist/reset.css'

import Options from './Options.vue'
import '../styles/main.css'

const pinia = createPinia()
const app = createApp(Options)

app.use(pinia)
app.use(Antd)
app.mount('#app')

// Initialize store data
import { useEmojiStore } from '../stores/emojiStore'

const store = useEmojiStore(pinia)
store.loadData()
