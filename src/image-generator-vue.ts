import { createApp, ref, computed, onMounted, watch } from 'vue'

// Provider Manager (simplified for inline use)
class SimpleProviderManager {
  currentProvider: string
  providers: Record<string, { name: string; displayName: string }>

  constructor() {
    this.currentProvider = 'gemini'
    this.providers = {
      gemini: { name: 'gemini', displayName: 'Google Gemini' },
      siliconflow: { name: 'siliconflow', displayName: 'SiliconFlow' },
      cloudflare: { name: 'cloudflare', displayName: 'Cloudflare Workers AI' },
      chutesai: { name: 'chutesai', displayName: 'Chutes AI' },
      chromeai: { name: 'chromeai', displayName: 'Chrome AI' },
      edgeai: { name: 'edgeai', displayName: 'Edge AI' }
    }
    this.loadSelectedProvider()
  }

  getProviderNames() {
    return Object.keys(this.providers)
  }

  getCurrentProviderName() {
    return this.currentProvider
  }

  setCurrentProvider(providerName: string) {
    if (this.providers[providerName]) {
      this.currentProvider = providerName
      this.saveSelectedProvider()
    }
  }

  getProviderDisplayName(providerName: string) {
    return this.providers[providerName]?.displayName || providerName
  }

  private loadSelectedProvider() {
    const saved = localStorage.getItem('selectedImageProvider')
    if (saved && this.providers[saved]) {
      this.currentProvider = saved
    }
  }

  private saveSelectedProvider() {
    localStorage.setItem('selectedImageProvider', this.currentProvider)
  }
}

// Configuration Manager
class ConfigManager {
  private configs: Record<string, any> = {}

  getConfig(provider: string, key: string, defaultValue: any = '') {
    const providerConfigs = this.configs[provider] || {}
    return providerConfigs[key] !== undefined ? providerConfigs[key] : defaultValue
  }

  setConfig(provider: string, key: string, value: any) {
    if (!this.configs[provider]) {
      this.configs[provider] = {}
    }
    this.configs[provider][key] = value
    this.saveConfig()
  }

  private saveConfig() {
    localStorage.setItem('imageGeneratorConfigs', JSON.stringify(this.configs))
  }

  loadConfig() {
    const saved = localStorage.getItem('imageGeneratorConfigs')
    if (saved) {
      try {
        this.configs = JSON.parse(saved)
      } catch (e) {
        console.error('Failed to parse saved config:', e)
      }
    }
  }
}

// Image Generator Main Component
const ImageGeneratorMain = {
  setup() {
    return {
      message: 'Hello Vue!'
    }
  },

  template: `
    <div class="image-generator">
      <div class="header">
        <h1>🎨 AI 图片生成器</h1>
        <p>{{ message }}</p>
      </div>
    </div>
  `
}

// Create and mount the Vue app
const app = createApp(ImageGeneratorMain)

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    app.mount('#app')
  })
} else {
  // DOM is already ready
  app.mount('#app')
}