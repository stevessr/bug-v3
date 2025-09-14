import { createApp } from 'vue'
import { createPinia } from 'pinia'

import { useEmojiStore } from '../stores/emojiStore'

import '../styles/main.css'
const pinia = createPinia()

// Dynamically import the Options component to delay loading heavy code until options page is rendered
void (async () => {
	const module = await import('./Options.vue')
	const Options = module.default
	const app = createApp(Options)
	app.use(pinia)
	app.mount('#app')

	// Initialize store data
	const store = useEmojiStore(pinia)
	store.loadData()
})()
