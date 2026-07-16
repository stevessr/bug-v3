import { createApp } from 'vue'
import { createPinia } from 'pinia'

import '../styles/theme.ts'

import router from './router'
import Options from './Options.vue'

// Suppress ResizeObserver loop errors (safe to ignore in most cases)
// These can occur when DOM mutations happen during ResizeObserver callbacks
const resizeObserverErrHandler = (e: ErrorEvent) => {
  if (
    e.message === 'ResizeObserver loop completed with undelivered notifications.' ||
    e.message === 'ResizeObserver loop limit exceeded'
  ) {
    e.stopImmediatePropagation()
    return false
  }
}
window.addEventListener('error', resizeObserverErrHandler)

const pinia = createPinia()
//
// Use a static import so the Options component is bundled into the options entry
const app = createApp(Options)
app.use(pinia)
app.use(router)
app.mount('#app')

const requestedTab = new URLSearchParams(window.location.search).get('tabs')?.trim()
if (requestedTab) {
  const originalUrl = `${window.location.pathname}${window.location.search}`
  const target = requestedTab.startsWith('/') ? requestedTab : `/${requestedTab}`

  void router
    .replace({ path: target })
    .then(() => {
      // Keep the query-based extension URL stable while retaining the resolved
      // in-memory route used by the options application.
      window.history.replaceState({}, '', originalUrl)
    })
    .catch(error => {
      console.warn('[Options] Failed to navigate to requested tab:', error)
    })
}

// Store data will be loaded in useOptions composable's onMounted hook
