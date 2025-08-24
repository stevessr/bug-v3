import { createApp } from 'vue'

// Simplest possible Vue component
const TestComponent = {
  template: `<h1>AI Image Generator</h1>`
}

// Create and mount the Vue app
const app = createApp(TestComponent)

// Mount the app
app.mount('#app')