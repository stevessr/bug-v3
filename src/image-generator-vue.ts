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
    // Initialize managers
    const providerManager = new SimpleProviderManager()
    const configManager = new ConfigManager()
    configManager.loadConfig()

    // Reactive state
    const prompt = ref('')
    const selectedProvider = ref(providerManager.getCurrentProviderName())
    const isGenerating = ref(false)
    const generatedImages = ref<string[]>([])
    const error = ref('')

    // Configuration states
    const geminiApiKey = ref(configManager.getConfig('gemini', 'apiKey'))
    const siliconflowApiKey = ref(configManager.getConfig('siliconflow', 'apiKey'))
    const cloudflareAccountId = ref(configManager.getConfig('cloudflare', 'accountId'))
    const cloudflareApiToken = ref(configManager.getConfig('cloudflare', 'apiToken'))
    const cloudflareModel = ref(configManager.getConfig('cloudflare', 'model', '@cf/stabilityai/stable-diffusion-xl-base-1.0'))
    const cloudflareCustomModel = ref(configManager.getConfig('cloudflare', 'customModel', false))
    const chutesaiApiKey = ref(configManager.getConfig('chutesai', 'apiKey'))
    
    // Browser AI states
    const chromeAiAvailable = ref(false)
    const edgeAiAvailable = ref(false)

    // Image settings
    const aspectRatio = ref('1:1')
    const numberOfImages = ref(1)
    const style = ref('photographic')

    // Watch for config changes and save them
    watch([geminiApiKey], () => configManager.setConfig('gemini', 'apiKey', geminiApiKey.value))
    watch([siliconflowApiKey], () => configManager.setConfig('siliconflow', 'apiKey', siliconflowApiKey.value))
    watch([cloudflareAccountId], () => configManager.setConfig('cloudflare', 'accountId', cloudflareAccountId.value))
    watch([cloudflareApiToken], () => configManager.setConfig('cloudflare', 'apiToken', cloudflareApiToken.value))
    watch([cloudflareModel], () => configManager.setConfig('cloudflare', 'model', cloudflareModel.value))
    watch([cloudflareCustomModel], () => configManager.setConfig('cloudflare', 'customModel', cloudflareCustomModel.value))
    watch([chutesaiApiKey], () => configManager.setConfig('chutesai', 'apiKey', chutesaiApiKey.value))

    // Browser AI availability check
    onMounted(async () => {
      await checkBrowserAiAvailability()
    })

    const checkBrowserAiAvailability = async () => {
      // Check Chrome AI
      try {
        if (typeof window !== 'undefined' && (window as any).chrome?.ai) {
          const canCreateSession = await (window as any).chrome.ai.canCreateTextSession()
          chromeAiAvailable.value = canCreateSession === 'readily'
          console.log('Chrome AI available:', chromeAiAvailable.value)
        }
      } catch (error) {
        console.log('Chrome AI not available:', error)
      }

      // Check Edge AI
      try {
        if (typeof window !== 'undefined' && (window as any).navigator?.ml) {
          edgeAiAvailable.value = true
          console.log('Edge AI available:', edgeAiAvailable.value)
        }
      } catch (error) {
        console.log('Edge AI not available:', error)
      }
    }

    // Provider change handler
    watch(selectedProvider, (newProvider) => {
      providerManager.setCurrentProvider(newProvider)
    })

    // Computed properties
    const availableProviders = computed(() => 
      providerManager.getProviderNames()
        .filter(name => {
          // Filter out browser AI providers if not available
          if (name === 'chromeai' && !chromeAiAvailable.value) return false
          if (name === 'edgeai' && !edgeAiAvailable.value) return false
          return true
        })
        .map(name => ({
          value: name,
          label: providerManager.getProviderDisplayName(name)
        }))
    )

    const canGenerate = computed(() => {
      if (!prompt.value.trim()) return false
      
      switch (selectedProvider.value) {
        case 'gemini':
          return geminiApiKey.value.trim() !== ''
        case 'siliconflow':
          return siliconflowApiKey.value.trim() !== ''
        case 'cloudflare':
          return cloudflareAccountId.value.trim() !== '' && cloudflareApiToken.value.trim() !== ''
        case 'chutesai':
          return chutesaiApiKey.value.trim() !== ''
        case 'chromeai':
          return chromeAiAvailable.value
        case 'edgeai':
          return edgeAiAvailable.value
        default:
          return false
      }
    })

    // Methods
    const generateImages = async () => {
      if (!canGenerate.value || isGenerating.value) return

      isGenerating.value = true
      error.value = ''
      generatedImages.value = []

      try {
        const images = await generateImagesForProvider(selectedProvider.value, {
          prompt: prompt.value,
          aspectRatio: aspectRatio.value,
          numberOfImages: numberOfImages.value,
          style: style.value
        })
        generatedImages.value = images
      } catch (err: any) {
        error.value = err.message || 'Generation failed'
        console.error('Image generation error:', err)
      } finally {
        isGenerating.value = false
      }
    }

    const generateImagesForProvider = async (provider: string, request: any): Promise<string[]> => {
      switch (provider) {
        case 'gemini':
          return generateWithGemini(request)
        case 'siliconflow':
          return generateWithSiliconFlow(request)
        case 'cloudflare':
          return generateWithCloudflare(request)
        case 'chutesai':
          return generateWithChutesAI(request)
        case 'chromeai':
          return generateWithChromeAI(request)
        case 'edgeai':
          return generateWithEdgeAI(request)
        default:
          throw new Error('Unknown provider')
      }
    }

    const generateWithGemini = async (request: any): Promise<string[]> => {
      // Simplified Gemini implementation
      throw new Error('Gemini provider not implemented in this simplified version')
    }

    const generateWithSiliconFlow = async (request: any): Promise<string[]> => {
      // Simplified SiliconFlow implementation
      throw new Error('SiliconFlow provider not implemented in this simplified version')
    }

    const generateWithCloudflare = async (request: any): Promise<string[]> => {
      // Simplified Cloudflare implementation
      throw new Error('Cloudflare provider not implemented in this simplified version')
    }

    const generateWithChutesAI = async (request: any): Promise<string[]> => {
      // Simplified ChutesAI implementation
      throw new Error('ChutesAI provider not implemented in this simplified version')
    }

    const generateWithChromeAI = async (request: any): Promise<string[]> => {
      if (!chromeAiAvailable.value) {
        throw new Error('Chrome AI is not available. Please ensure you are using Chrome 127+ with AI features enabled.')
      }

      try {
        // Note: Chrome AI is primarily for text generation, not image generation
        // This is a demonstration of how to use Chrome AI APIs
        const session = await (window as any).chrome.ai.createTextSession()
        
        // Generate a description or enhancement of the prompt
        const enhancedPrompt = await session.prompt(
          `Enhance this image generation prompt to be more detailed and descriptive: "${request.prompt}"`
        )
        
        // Since Chrome AI doesn't generate images directly, we'll return a message
        // In a real implementation, you might use this enhanced prompt with another image service
        return [`Chrome AI enhanced prompt: ${enhancedPrompt}. Note: Chrome AI does not generate images directly. Please use an image generation provider.`]
      } catch (error) {
        throw new Error(`Chrome AI error: ${error.message}`)
      }
    }

    const generateWithEdgeAI = async (request: any): Promise<string[]> => {
      if (!edgeAiAvailable.value) {
        throw new Error('Edge AI is not available. Please ensure you are using Microsoft Edge with AI features enabled.')
      }

      try {
        // Note: Edge AI APIs are still in development and primarily for text assistance
        // This is a demonstration of how to use Edge AI APIs when available
        const response = await (window as any).navigator.ml.generateText({
          prompt: `Create a detailed image description based on this prompt: "${request.prompt}"`,
          maxTokens: 500
        })
        
        // Since Edge AI doesn't generate images directly, we'll return a description
        return [`Edge AI generated description: ${response}. Note: Edge AI does not generate images directly. Please use an image generation provider.`]
      } catch (error) {
        throw new Error(`Edge AI error: ${error.message}`)
      }
    }

    const downloadImage = (imageUrl: string, index: number) => {
      const link = document.createElement('a')
      link.href = imageUrl
      link.download = `generated-image-${index + 1}.png`
      link.click()
    }

    const copyToClipboard = async (imageUrl: string) => {
      try {
        await navigator.clipboard.writeText(imageUrl)
        // Show success message
      } catch (err) {
        console.error('Failed to copy to clipboard:', err)
      }
    }

    return {
      // State
      prompt,
      selectedProvider,
      isGenerating,
      generatedImages,
      error,
      // Config
      geminiApiKey,
      siliconflowApiKey,
      cloudflareAccountId,
      cloudflareApiToken,
      cloudflareModel,
      cloudflareCustomModel,
      chutesaiApiKey,
      // Browser AI
      chromeAiAvailable,
      edgeAiAvailable,
      // Settings
      aspectRatio,
      numberOfImages,
      style,
      // Computed
      availableProviders,
      canGenerate,
      // Methods
      generateImages,
      downloadImage,
      copyToClipboard
    }
  },

  template: `
    <div class="image-generator">
      <div class="header">
        <h1>🎨 AI 图片生成器</h1>
        <p>使用 Google Gemini AI 生成高质量图片</p>
      </div>

      <div class="generator-container">
        <div class="config-section">
          <h3>🛠️ API 配置</h3>
          
          <div class="config-item">
            <label>选择提供商:</label>
            <select v-model="selectedProvider" class="form-select">
              <option v-for="provider in availableProviders" :key="provider.value" :value="provider.value">
                {{ provider.label }}
              </option>
            </select>
          </div>

          <!-- Gemini Config -->
          <div v-if="selectedProvider === 'gemini'" class="api-config">
            <div class="config-item">
              <label>Gemini API Key:</label>
              <input 
                v-model="geminiApiKey" 
                type="password" 
                class="form-input" 
                placeholder="输入你的 Gemini API Key"
              />
            </div>
          </div>

          <!-- SiliconFlow Config -->
          <div v-if="selectedProvider === 'siliconflow'" class="api-config">
            <div class="config-item">
              <label>SiliconFlow API Key:</label>
              <input 
                v-model="siliconflowApiKey" 
                type="password" 
                class="form-input" 
                placeholder="输入你的 SiliconFlow API Key"
              />
            </div>
          </div>

          <!-- Cloudflare Config -->
          <div v-if="selectedProvider === 'cloudflare'" class="api-config">
            <div class="config-item">
              <label>账户 ID (Account ID):</label>
              <input 
                v-model="cloudflareAccountId" 
                type="text" 
                class="form-input" 
                placeholder="输入 Cloudflare 账户 ID"
              />
            </div>
            <div class="config-item">
              <label>API Token:</label>
              <input 
                v-model="cloudflareApiToken" 
                type="password" 
                class="form-input" 
                placeholder="输入 Cloudflare API Token"
              />
            </div>
            <div class="config-item">
              <label>
                <input type="checkbox" v-model="cloudflareCustomModel" />
                使用自定义模型
              </label>
              <input 
                v-if="cloudflareCustomModel"
                v-model="cloudflareModel" 
                type="text" 
                class="form-input" 
                placeholder="@cf/custom/model-name"
              />
              <select v-else v-model="cloudflareModel" class="form-select">
                <option value="@cf/stabilityai/stable-diffusion-xl-base-1.0">Flux 1 Schnell (快速)</option>
              </select>
            </div>
          </div>

          <!-- ChutesAI Config -->
          <div v-if="selectedProvider === 'chutesai'" class="api-config">
            <div class="config-item">
              <label>Chutes AI API Key:</label>
              <input 
                v-model="chutesaiApiKey" 
                type="password" 
                class="form-input" 
                placeholder="输入你的 Chutes AI API Key"
              />
            </div>
          </div>
        </div>

        <div class="prompt-section">
          <h3>✍️ 图片描述</h3>
          <textarea 
            v-model="prompt" 
            class="prompt-textarea" 
            placeholder="描述你想要生成的图片..."
            rows="4"
          ></textarea>
        </div>

        <div class="settings-section">
          <h3>⚙️ 生成设置</h3>
          <div class="config-grid">
            <div class="config-item">
              <label>宽高比:</label>
              <select v-model="aspectRatio" class="form-select">
                <option value="1:1">正方形 (1:1)</option>
                <option value="16:9">横屏 (16:9)</option>
                <option value="9:16">竖屏 (9:16)</option>
                <option value="4:3">传统 (4:3)</option>
                <option value="3:4">竖版传统 (3:4)</option>
              </select>
            </div>
            <div class="config-item">
              <label>图片数量:</label>
              <select v-model="numberOfImages" class="form-select">
                <option :value="1">1</option>
                <option :value="2">2</option>
                <option :value="4">4</option>
              </select>
            </div>
            <div class="config-item">
              <label>风格:</label>
              <select v-model="style" class="form-select">
                <option value="photographic">摄影</option>
                <option value="digital-art">数字艺术</option>
                <option value="illustration">插画</option>
                <option value="anime">动漫</option>
                <option value="3d-render">3D渲染</option>
              </select>
            </div>
          </div>
        </div>

        <div class="generate-section">
          <button 
            @click="generateImages" 
            :disabled="!canGenerate || isGenerating"
            class="generate-btn"
          >
            {{ isGenerating ? '🎨 生成中...' : '🚀 生成图片' }}
          </button>
        </div>

        <div v-if="error" class="error-message">
          ❌ {{ error }}
        </div>

        <div v-if="generatedImages.length > 0" class="results-section">
          <h3>🎉 生成结果</h3>
          <div class="image-grid">
            <div v-for="(image, index) in generatedImages" :key="index" class="image-item">
              <img :src="image" :alt="'生成的图片 ' + (index + 1)" />
              <div class="image-actions">
                <button @click="downloadImage(image, index)" class="action-btn">💾 下载</button>
                <button @click="copyToClipboard(image)" class="action-btn">📋 复制链接</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
}

// Create and mount the Vue app
const app = createApp({
  components: {
    ImageGeneratorMain
  }
})

app.mount('#app')