import { createApp } from 'vue'
import { createPinia } from 'pinia'
import Tenor from './Tenor.vue'
import '../styles/main.css'

const app = createApp(Tenor)
const pinia = createPinia()

app.use(pinia)
app.mount('#app')
