import { createApp } from 'vue'
import { createPinia } from 'pinia'
import Popup from './Popup.vue'
import '../styles/main.css'

const pinia = createPinia()
const app = createApp(Popup)

app.use(pinia)
app.mount('#app')
