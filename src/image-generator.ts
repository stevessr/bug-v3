interface GenerateRequest {
  prompt: string
  aspectRatio: string
  numberOfImages: number
  style?: string
  inputImage?: string // Base64 encoded image for editing
  editMode?: boolean // Whether this is an edit operation
}

interface GeminiGenerateResponse {
  candidates: Array<{
    images: Array<{
      uri: string
    }>
  }>
}

interface SiliconFlowGenerateResponse {
  data: Array<{
    url: string
  }>
}

interface CloudflareGenerateResponse {
  result?: {
    image?: string // Base64 encoded image
  }
  success: boolean
  errors?: Array<{
    message: string
  }>
}

interface ChutesAIGenerateResponse {
  success: boolean
  data?: {
    url: string
  }
  error?: string
}

interface ImageProvider {
  name: string
  displayName: string
  generateImages(request: GenerateRequest): Promise<string[]>
  setApiKey(key: string): void
  loadApiKey(): string
}

class GeminiProvider implements ImageProvider {
  name = 'gemini'
  displayName = 'Google Gemini'
  private apiKey: string = ''
  private apiEndpoint =
    'https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:generateImage'

  setApiKey(key: string) {
    this.apiKey = key
    localStorage.setItem('gemini_api_key', key)
  }

  loadApiKey() {
    const saved = localStorage.getItem('gemini_api_key')
    if (saved) {
      this.apiKey = saved
      return saved
    }
    return ''
  }

  async generateImages(request: GenerateRequest): Promise<string[]> {
    if (!this.apiKey) {
      throw new Error('请先设置 API Key')
    }

    // Handle image editing mode
    if (request.editMode && request.inputImage) {
      return this.editImage(request)
    }

    const stylePrompt = request.style ? ` in ${request.style} style` : ''
    const fullPrompt = `${request.prompt}${stylePrompt}, aspect ratio ${request.aspectRatio}, high quality, detailed`

    const requestBody = {
      prompt: {
        text: fullPrompt
      },
      safetySettings: [
        {
          category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
          threshold: 'BLOCK_LOW_AND_ABOVE'
        },
        {
          category: 'HARM_CATEGORY_HATE_SPEECH',
          threshold: 'BLOCK_LOW_AND_ABOVE'
        }
      ],
      generationConfig: {
        number: request.numberOfImages
      }
    }

    try {
      const response = await fetch(`${this.apiEndpoint}?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(
          errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`
        )
      }

      const data: GeminiGenerateResponse = await response.json()

      if (!data.candidates || data.candidates.length === 0) {
        throw new Error('没有生成任何图片，请尝试修改您的描述')
      }

      const imageUrls: string[] = []
      for (const candidate of data.candidates) {
        if (candidate.images) {
          for (const image of candidate.images) {
            imageUrls.push(image.uri)
          }
        }
      }

      if (imageUrls.length === 0) {
        throw new Error('生成的图片无法获取，请稍后重试')
      }

      return imageUrls
    } catch (error: any) {
      console.error('Image generation failed:', error)
      if (error.message.includes('API_KEY_INVALID')) {
        throw new Error('API Key 无效，请检查您的密钥')
      } else if (error.message.includes('QUOTA_EXCEEDED')) {
        throw new Error('API 配额已用完，请稍后重试或检查计费设置')
      } else if (error.message.includes('PERMISSION_DENIED')) {
        throw new Error('权限被拒绝，请检查 API Key 权限设置')
      }
      throw error
    }
  }

  private async editImage(request: GenerateRequest): Promise<string[]> {
    const editEndpoint =
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-preview-image-generation:generateContent'

    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: request.prompt
            },
            {
              inline_data: {
                mime_type: 'image/jpeg',
                data: request.inputImage
              }
            }
          ]
        }
      ],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE']
      }
    }

    try {
      const response = await fetch(`${editEndpoint}?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(
          errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`
        )
      }

      const data = await response.json()

      // Extract image data from response
      const imageUrls: string[] = []
      if (data.candidates) {
        for (const candidate of data.candidates) {
          if (candidate.content && candidate.content.parts) {
            for (const part of candidate.content.parts) {
              if (part.inline_data && part.inline_data.data) {
                // Convert base64 to data URL
                const dataUrl = `data:${part.inline_data.mime_type || 'image/png'};base64,${part.inline_data.data}`
                imageUrls.push(dataUrl)
              }
            }
          }
        }
      }

      if (imageUrls.length === 0) {
        throw new Error('图片编辑失败，请尝试修改您的描述')
      }

      return imageUrls
    } catch (error: any) {
      console.error('Image editing failed:', error)
      if (error.message.includes('API_KEY_INVALID')) {
        throw new Error('API Key 无效，请检查您的密钥')
      } else if (error.message.includes('QUOTA_EXCEEDED')) {
        throw new Error('API 配额已用完，请稍后重试或检查计费设置')
      } else if (error.message.includes('PERMISSION_DENIED')) {
        throw new Error('权限被拒绝，请检查 API Key 权限设置')
      }
      throw error
    }
  }

  async downloadImage(url: string, filename: string): Promise<void> {
    try {
      const response = await fetch(url)
      const blob = await response.blob()

      const downloadUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(downloadUrl)
    } catch (error) {
      console.error('Download failed:', error)
      throw new Error('下载失败，请稍后重试')
    }
  }

  copyToClipboard(url: string): Promise<void> {
    return navigator.clipboard.writeText(url).catch(() => {
      // Fallback for older browsers
      const textarea = document.createElement('textarea')
      textarea.value = url
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    })
  }
}

class SiliconFlowProvider implements ImageProvider {
  name = 'siliconflow'
  displayName = 'SiliconFlow'
  private apiKey: string = ''
  private apiEndpoint = 'https://api.siliconflow.cn/v1/images/generations'

  setApiKey(key: string) {
    this.apiKey = key
    localStorage.setItem('siliconflow_api_key', key)
  }

  loadApiKey() {
    const saved = localStorage.getItem('siliconflow_api_key')
    if (saved) {
      this.apiKey = saved
      return saved
    }
    return ''
  }

  async generateImages(request: GenerateRequest): Promise<string[]> {
    if (!this.apiKey) {
      throw new Error('请先设置 SiliconFlow API Key')
    }

    // Map aspect ratio to image size
    const sizeMap: Record<string, string> = {
      '1:1': '1024x1024',
      '16:9': '1344x768',
      '9:16': '768x1344',
      '4:3': '1152x896',
      '3:4': '896x1152'
    }

    const imageSize = sizeMap[request.aspectRatio] || '1024x1024'
    const stylePrompt = request.style ? ` in ${request.style} style` : ''
    const fullPrompt = `${request.prompt}${stylePrompt}, high quality, detailed`

    const requestBody = {
      model: 'Kwai-Kolors/Kolors',
      prompt: fullPrompt,
      image_size: imageSize,
      batch_size: request.numberOfImages,
      num_inference_steps: 20,
      guidance_scale: 7.5
    }

    try {
      const response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(
          errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`
        )
      }

      const data: SiliconFlowGenerateResponse = await response.json()

      if (!data.data || data.data.length === 0) {
        throw new Error('没有生成任何图片，请尝试修改您的描述')
      }

      return data.data.map(item => item.url)
    } catch (error: any) {
      console.error('SiliconFlow image generation failed:', error)
      if (error.message.includes('401')) {
        throw new Error('API Key 无效，请检查您的 SiliconFlow 密钥')
      } else if (error.message.includes('429')) {
        throw new Error('API 请求过于频繁，请稍后重试')
      } else if (error.message.includes('403')) {
        throw new Error('权限被拒绝，请检查 API Key 权限设置')
      }
      throw error
    }
  }

  async downloadImage(url: string, filename: string): Promise<void> {
    try {
      const response = await fetch(url)
      const blob = await response.blob()

      const downloadUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(downloadUrl)
    } catch (error) {
      console.error('Download failed:', error)
      throw new Error('下载失败，请稍后重试')
    }
  }

  copyToClipboard(url: string): Promise<void> {
    return navigator.clipboard.writeText(url).catch(() => {
      // Fallback for older browsers
      const textarea = document.createElement('textarea')
      textarea.value = url
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    })
  }
}

class CloudflareProvider implements ImageProvider {
  name = 'cloudflare'
  displayName = 'Cloudflare Workers AI'
  private apiToken: string = ''
  private accountId: string = ''
  private selectedModel: string = '@cf/black-forest-labs/flux-1-schnell'

  setApiKey(key: string) {
    // For Cloudflare, we expect the key in format: "accountId:apiToken"
    const parts = key.split(':')
    if (parts.length === 2) {
      this.accountId = parts[0]
      this.apiToken = parts[1]
      localStorage.setItem('cloudflare_account_id', this.accountId)
      localStorage.setItem('cloudflare_api_token', this.apiToken)
    } else {
      // Assume it's just the token and account ID is stored separately
      this.apiToken = key
      localStorage.setItem('cloudflare_api_token', key)
    }
  }

  loadApiKey() {
    const savedAccountId = localStorage.getItem('cloudflare_account_id')
    const savedToken = localStorage.getItem('cloudflare_api_token')

    if (savedAccountId && savedToken) {
      this.accountId = savedAccountId
      this.apiToken = savedToken
      return `${savedAccountId}:${savedToken}`
    } else if (savedToken) {
      this.apiToken = savedToken
      return savedToken
    }
    return ''
  }

  setModel(model: string) {
    this.selectedModel = model
    localStorage.setItem('cloudflare_selected_model', model)
  }

  loadSelectedModel() {
    const saved = localStorage.getItem('cloudflare_selected_model')
    if (saved) {
      this.selectedModel = saved
    }
  }

  async generateImages(request: GenerateRequest): Promise<string[]> {
    if (!this.apiToken) {
      throw new Error('请先设置 Cloudflare API Token')
    }

    if (!this.accountId) {
      throw new Error('请先设置 Cloudflare Account ID')
    }

    const apiEndpoint = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/ai/run/${this.selectedModel}`

    let requestBody: any

    if (this.selectedModel === '@cf/black-forest-labs/flux-1-schnell') {
      // Flux model - simpler parameters
      const stylePrompt = request.style ? ` in ${request.style} style` : ''
      const fullPrompt = `${request.prompt}${stylePrompt}, high quality, detailed`

      requestBody = {
        prompt: fullPrompt,
        steps: 4 // Default for flux-schnell
      }
    } else {
      // Stable Diffusion XL Lightning model - more parameters
      const sizeMap: Record<string, { width: number; height: number }> = {
        '1:1': { width: 1024, height: 1024 },
        '16:9': { width: 1344, height: 768 },
        '9:16': { width: 768, height: 1344 },
        '4:3': { width: 1152, height: 896 },
        '3:4': { width: 896, height: 1152 }
      }

      const size = sizeMap[request.aspectRatio] || { width: 1024, height: 1024 }
      const stylePrompt = request.style ? ` in ${request.style} style` : ''
      const fullPrompt = `${request.prompt}${stylePrompt}, high quality, detailed`

      requestBody = {
        prompt: fullPrompt,
        width: size.width,
        height: size.height,
        num_steps: 20,
        guidance: 7.5
      }
    }

    try {
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(
          errorData.errors?.[0]?.message || `HTTP ${response.status}: ${response.statusText}`
        )
      }

      const data: CloudflareGenerateResponse = await response.json()

      if (!data.success || !data.result?.image) {
        throw new Error(data.errors?.[0]?.message || '没有生成任何图片，请尝试修改您的描述')
      }

      // Convert base64 to data URL
      const dataUrl = `data:image/png;base64,${data.result.image}`

      // For multiple images, we need to make multiple requests
      const imageUrls = [dataUrl]

      // Generate additional images if requested
      for (let i = 1; i < request.numberOfImages; i++) {
        try {
          const additionalResponse = await fetch(apiEndpoint, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${this.apiToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
          })

          if (additionalResponse.ok) {
            const additionalData: CloudflareGenerateResponse = await additionalResponse.json()
            if (additionalData.success && additionalData.result?.image) {
              imageUrls.push(`data:image/png;base64,${additionalData.result.image}`)
            }
          }
        } catch (error) {
          console.warn('Failed to generate additional image:', error)
        }
      }

      return imageUrls
    } catch (error: any) {
      console.error('Cloudflare image generation failed:', error)
      if (error.message.includes('401')) {
        throw new Error('API Token 无效，请检查您的 Cloudflare 凭据')
      } else if (error.message.includes('429')) {
        throw new Error('API 请求过于频繁，请稍后重试')
      } else if (error.message.includes('403')) {
        throw new Error('权限被拒绝，请检查 API Token 权限设置')
      }
      throw error
    }
  }

  async downloadImage(url: string, filename: string): Promise<void> {
    try {
      // For data URLs, convert to blob directly
      if (url.startsWith('data:')) {
        const response = await fetch(url)
        const blob = await response.blob()

        const downloadUrl = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = downloadUrl
        a.download = filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(downloadUrl)
      } else {
        // For regular URLs
        const response = await fetch(url)
        const blob = await response.blob()

        const downloadUrl = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = downloadUrl
        a.download = filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(downloadUrl)
      }
    } catch (error) {
      console.error('Download failed:', error)
      throw new Error('下载失败，请稍后重试')
    }
  }

  copyToClipboard(url: string): Promise<void> {
    return navigator.clipboard.writeText(url).catch(() => {
      // Fallback for older browsers
      const textarea = document.createElement('textarea')
      textarea.value = url
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    })
  }
}

class ChutesAIProvider implements ImageProvider {
  name = 'chutesai'
  displayName = 'Chutes AI'
  private apiToken: string = ''
  private apiEndpoint = 'https://image.chutes.ai/generate'
  private selectedModel: string = 'neta-lumina'

  setApiKey(key: string) {
    this.apiToken = key
    localStorage.setItem('chutesai_api_token', key)
  }

  loadApiKey() {
    const saved = localStorage.getItem('chutesai_api_token')
    if (saved) {
      this.apiToken = saved
      return saved
    }
    return ''
  }

  setModel(model: string) {
    this.selectedModel = model
    localStorage.setItem('chutesai_selected_model', model)
  }

  loadSelectedModel() {
    const saved = localStorage.getItem('chutesai_selected_model')
    if (saved) {
      this.selectedModel = saved
    }
  }

  async generateImages(request: GenerateRequest): Promise<string[]> {
    if (!this.apiToken) {
      throw new Error('请先设置 Chutes AI API Token')
    }

    // Map aspect ratio to dimensions
    const sizeMap: Record<string, { width: number; height: number }> = {
      '1:1': { width: 1024, height: 1024 },
      '16:9': { width: 1344, height: 768 },
      '9:16': { width: 768, height: 1344 },
      '4:3': { width: 1152, height: 896 },
      '3:4': { width: 896, height: 1152 }
    }

    const size = sizeMap[request.aspectRatio] || { width: 1024, height: 1024 }
    const stylePrompt = request.style ? ` in ${request.style} style` : ''
    const fullPrompt = `${request.prompt}${stylePrompt}, high quality, detailed`

    let requestBody: any

    // Configure request based on selected model
    if (this.selectedModel === 'neta-lumina') {
      requestBody = {
        model: 'neta-lumina',
        prompt: fullPrompt,
        cfg: 4.5,
        seed: 0,
        steps: 30,
        width: Math.max(768, Math.min(2048, size.width)),
        height: Math.max(768, Math.min(2048, size.height)),
        sampler: 'res_multistep',
        scheduler: 'linear_quadratic',
        negative_prompt: 'blurry, worst quality, low quality'
      }
    } else if (this.selectedModel === 'chroma') {
      requestBody = {
        model: 'chroma',
        prompt: fullPrompt,
        cfg: 4.5,
        seed: 0,
        steps: 30,
        width: Math.max(200, Math.min(2048, size.width)),
        height: Math.max(200, Math.min(2048, size.height))
      }
    } else if (this.selectedModel === 'JuggernautXL') {
      requestBody = {
        model: 'JuggernautXL',
        prompt: fullPrompt,
        seed: null,
        width: Math.max(128, Math.min(2048, size.width)),
        height: Math.max(128, Math.min(2048, size.height)),
        guidance_scale: 7.5,
        negative_prompt: '',
        num_inference_steps: 25
      }
    }

    try {
      // Generate multiple images by making multiple requests
      const imageUrls: string[] = []

      for (let i = 0; i < request.numberOfImages; i++) {
        const response = await fetch(this.apiEndpoint, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`)
        }

        const data: ChutesAIGenerateResponse = await response.json()

        if (!data.success || !data.data?.url) {
          throw new Error(data.error || '没有生成任何图片，请尝试修改您的描述')
        }

        imageUrls.push(data.data.url)
      }

      return imageUrls
    } catch (error: any) {
      console.error('Chutes AI image generation failed:', error)
      if (error.message.includes('401')) {
        throw new Error('API Token 无效，请检查您的 Chutes AI 凭据')
      } else if (error.message.includes('429')) {
        throw new Error('API 请求过于频繁，请稍后重试')
      } else if (error.message.includes('403')) {
        throw new Error('权限被拒绝，请检查 API Token 权限设置')
      }
      throw error
    }
  }

  async downloadImage(url: string, filename: string): Promise<void> {
    try {
      const response = await fetch(url)
      const blob = await response.blob()

      const downloadUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(downloadUrl)
    } catch (error) {
      console.error('Download failed:', error)
      throw new Error('下载失败，请稍后重试')
    }
  }

  copyToClipboard(url: string): Promise<void> {
    return navigator.clipboard.writeText(url).catch(() => {
      // Fallback for older browsers
      const textarea = document.createElement('textarea')
      textarea.value = url
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    })
  }
}

class MultiProviderImageGenerator {
  private providers: Map<string, ImageProvider> = new Map()
  private currentProvider: ImageProvider

  constructor() {
    // Initialize providers
    const geminiProvider = new GeminiProvider()
    const siliconFlowProvider = new SiliconFlowProvider()
    const cloudflareProvider = new CloudflareProvider()
    const chutesAIProvider = new ChutesAIProvider()

    this.providers.set(geminiProvider.name, geminiProvider)
    this.providers.set(siliconFlowProvider.name, siliconFlowProvider)
    this.providers.set(cloudflareProvider.name, cloudflareProvider)
    this.providers.set(chutesAIProvider.name, chutesAIProvider)

    // Set default provider
    this.currentProvider = geminiProvider
  }

  getProviders(): ImageProvider[] {
    return Array.from(this.providers.values())
  }

  setCurrentProvider(providerName: string) {
    const provider = this.providers.get(providerName)
    if (provider) {
      this.currentProvider = provider
      localStorage.setItem('selected_provider', providerName)
    }
  }

  getCurrentProvider(): ImageProvider {
    return this.currentProvider
  }

  loadSelectedProvider() {
    const saved = localStorage.getItem('selected_provider')
    if (saved && this.providers.has(saved)) {
      this.currentProvider = this.providers.get(saved)!
    }
  }

  async generateImages(request: GenerateRequest): Promise<string[]> {
    return this.currentProvider.generateImages(request)
  }

  async downloadImage(url: string, filename: string): Promise<void> {
    // Use the current provider's download method if available, otherwise use generic method
    if ('downloadImage' in this.currentProvider) {
      return (this.currentProvider as any).downloadImage(url, filename)
    }

    // Generic download implementation
    try {
      const response = await fetch(url)
      const blob = await response.blob()

      const downloadUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(downloadUrl)
    } catch (error) {
      console.error('Download failed:', error)
      throw new Error('下载失败，请稍后重试')
    }
  }

  copyToClipboard(url: string): Promise<void> {
    return navigator.clipboard.writeText(url).catch(() => {
      // Fallback for older browsers
      const textarea = document.createElement('textarea')
      textarea.value = url
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    })
  }
}

// Initialize the application
const generator = new MultiProviderImageGenerator()

document.addEventListener('DOMContentLoaded', () => {
  const providerSelect = document.getElementById('providerSelect') as HTMLSelectElement
  const apiKeyInput = document.getElementById('apiKey') as HTMLInputElement
  const apiKeyHelp = document.getElementById('apiKeyHelp') as HTMLElement
  const apiKeyLink = document.getElementById('apiKeyLink') as HTMLAnchorElement
  const cloudflareModelSection = document.getElementById('cloudflareModelSection') as HTMLElement
  const cloudflareModelSelect = document.getElementById('cloudflareModel') as HTMLSelectElement
  const chutesaiModelSection = document.getElementById('chutesaiModelSection') as HTMLElement
  const chutesaiModelSelect = document.getElementById('chutesaiModel') as HTMLSelectElement
  const promptInput = document.getElementById('prompt') as HTMLTextAreaElement
  const promptLabel = document.getElementById('promptLabel') as HTMLElement
  const imageCountSelect = document.getElementById('imageCount') as HTMLSelectElement
  const aspectRatioSelect = document.getElementById('aspectRatio') as HTMLSelectElement
  const styleSelect = document.getElementById('style') as HTMLSelectElement
  const generateBtn = document.getElementById('generateBtn') as HTMLButtonElement

  // Image editing elements
  const modeRadios = document.querySelectorAll('input[name="mode"]') as NodeListOf<HTMLInputElement>
  const imageEditSection = document.getElementById('imageEditSection') as HTMLElement
  const imageUploadArea = document.getElementById('imageUploadArea') as HTMLElement
  const imageInput = document.getElementById('imageInput') as HTMLInputElement
  const imagePreview = document.getElementById('imagePreview') as HTMLElement
  const previewImg = document.getElementById('previewImg') as HTMLImageElement
  const removeImageBtn = document.getElementById('removeImage') as HTMLButtonElement

  let uploadedImageBase64: string | null = null
  const clearBtn = document.getElementById('clearBtn') as HTMLButtonElement
  const loading = document.getElementById('loading') as HTMLElement
  const error = document.getElementById('error') as HTMLElement
  const results = document.getElementById('results') as HTMLElement
  const imageGrid = document.getElementById('imageGrid') as HTMLElement

  // Load saved provider selection
  generator.loadSelectedProvider()
  const currentProvider = generator.getCurrentProvider()
  providerSelect.value = currentProvider.name

  // Update UI based on selected provider
  const updateProviderUI = () => {
    const provider = generator.getCurrentProvider()
    const savedApiKey = provider.loadApiKey()

    if (provider.name === 'gemini') {
      apiKeyInput.placeholder = '请输入您的 Gemini API Key'
      apiKeyHelp.innerHTML =
        '获取 API Key: <a id="apiKeyLink" href="https://ai.google.dev/gemini-api/docs/api-key" target="_blank">Google AI Studio</a>'
      cloudflareModelSection.style.display = 'none'
      chutesaiModelSection.style.display = 'none'
    } else if (provider.name === 'siliconflow') {
      apiKeyInput.placeholder = '请输入您的 SiliconFlow API Key'
      apiKeyHelp.innerHTML =
        '获取 API Key: <a id="apiKeyLink" href="https://cloud.siliconflow.cn" target="_blank">SiliconFlow 控制台</a>'
      cloudflareModelSection.style.display = 'none'
      chutesaiModelSection.style.display = 'none'
    } else if (provider.name === 'cloudflare') {
      apiKeyInput.placeholder = '请输入 Account ID:API Token (例如: abc123:def456)'
      apiKeyHelp.innerHTML =
        '获取凭据: <a id="apiKeyLink" href="https://dash.cloudflare.com/profile/api-tokens" target="_blank">Cloudflare API Tokens</a>'
      cloudflareModelSection.style.display = 'block'
      chutesaiModelSection.style.display = 'none'

      // Load saved model selection for Cloudflare
      const cloudflareProvider = provider as any
      if (cloudflareProvider.loadSelectedModel) {
        cloudflareProvider.loadSelectedModel()
        cloudflareModelSelect.value =
          cloudflareProvider.selectedModel || '@cf/black-forest-labs/flux-1-schnell'
      }
    } else if (provider.name === 'chutesai') {
      apiKeyInput.placeholder = '请输入您的 Chutes AI API Token'
      apiKeyHelp.innerHTML =
        '获取 API Token: <a id="apiKeyLink" href="https://chutes.ai" target="_blank">Chutes AI</a>'
      cloudflareModelSection.style.display = 'none'
      chutesaiModelSection.style.display = 'block'

      // Load saved model selection for Chutes AI
      const chutesaiProvider = provider as any
      if (chutesaiProvider.loadSelectedModel) {
        chutesaiProvider.loadSelectedModel()
        chutesaiModelSelect.value = chutesaiProvider.selectedModel || 'neta-lumina'
      }
    }

    apiKeyInput.value = savedApiKey
  }

  // Initialize UI
  updateProviderUI()

  // Provider selection handler
  providerSelect.addEventListener('change', () => {
    generator.setCurrentProvider(providerSelect.value)
    updateProviderUI()
  })

  // Cloudflare model selection handler
  cloudflareModelSelect.addEventListener('change', () => {
    const provider = generator.getCurrentProvider()
    if (provider.name === 'cloudflare') {
      const cloudflareProvider = provider as any
      if (cloudflareProvider.setModel) {
        cloudflareProvider.setModel(cloudflareModelSelect.value)
      }
    }
  })

  // Chutes AI model selection handler
  chutesaiModelSelect.addEventListener('change', () => {
    const provider = generator.getCurrentProvider()
    if (provider.name === 'chutesai') {
      const chutesaiProvider = provider as any
      if (chutesaiProvider.setModel) {
        chutesaiProvider.setModel(chutesaiModelSelect.value)
      }
    }
  })

  // Mode switching logic
  const updateModeUI = () => {
    const isEditMode =
      (document.querySelector('input[name="mode"]:checked') as HTMLInputElement)?.value === 'edit'

    if (isEditMode) {
      imageEditSection.style.display = 'block'
      promptLabel.textContent = '✏️ 描述您想要对图片进行的修改'
      promptInput.placeholder = '例如：在图片中添加一只小狗，让背景变成夕阳...'

      // Only show edit mode for Gemini provider
      if (generator.getCurrentProvider().name !== 'gemini') {
        showError('图片编辑功能目前仅支持 Google Gemini')
        ;(
          document.querySelector('input[name="mode"][value="generate"]') as HTMLInputElement
        ).checked = true
        updateModeUI()
        return
      }
    } else {
      imageEditSection.style.display = 'none'
      promptLabel.textContent = '📝 描述您想要生成的图片'
      promptInput.placeholder =
        '例如：一只可爱的橘猫坐在樱花树下，阳光透过花瓣洒在地面上，温暖的春日氛围...'
    }
  }

  // Mode radio button handlers
  modeRadios.forEach(radio => {
    radio.addEventListener('change', updateModeUI)
  })

  // Image upload handlers
  const handleImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      showError('请选择图片文件')
      return
    }

    const reader = new FileReader()
    reader.onload = e => {
      const result = e.target?.result as string
      uploadedImageBase64 = result.split(',')[1] // Remove data:image/...;base64, prefix
      previewImg.src = result
      imagePreview.style.display = 'block'
      imageUploadArea.style.display = 'none'
    }
    reader.readAsDataURL(file)
  }

  imageUploadArea.addEventListener('click', () => {
    imageInput.click()
  })

  imageInput.addEventListener('change', e => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (file) {
      handleImageFile(file)
    }
  })

  // Drag and drop for image upload
  imageUploadArea.addEventListener('dragover', e => {
    e.preventDefault()
    imageUploadArea.style.borderColor = '#3b82f6'
    imageUploadArea.style.backgroundColor = '#eff6ff'
  })

  imageUploadArea.addEventListener('dragleave', e => {
    e.preventDefault()
    imageUploadArea.style.borderColor = '#d1d5db'
    imageUploadArea.style.backgroundColor = '#f9fafb'
  })

  imageUploadArea.addEventListener('drop', e => {
    e.preventDefault()
    imageUploadArea.style.borderColor = '#d1d5db'
    imageUploadArea.style.backgroundColor = '#f9fafb'

    const file = e.dataTransfer?.files[0]
    if (file) {
      handleImageFile(file)
    }
  })

  removeImageBtn.addEventListener('click', () => {
    uploadedImageBase64 = null
    imagePreview.style.display = 'none'
    imageUploadArea.style.display = 'block'
    imageInput.value = ''
  })

  // Initialize mode UI
  updateModeUI()

  // Save API key when user types
  apiKeyInput.addEventListener('input', e => {
    const key = (e.target as HTMLInputElement).value.trim()
    if (key) {
      generator.getCurrentProvider().setApiKey(key)
    }
  })

  generateBtn.addEventListener('click', async () => {
    const prompt = promptInput.value.trim()
    const apiKey = apiKeyInput.value.trim()
    const isEditMode =
      (document.querySelector('input[name="mode"]:checked') as HTMLInputElement)?.value === 'edit'

    if (!apiKey) {
      showError('请先输入 API Key')
      return
    }

    if (!prompt) {
      showError(isEditMode ? '请输入编辑指令' : '请输入图片描述')
      return
    }

    if (isEditMode && !uploadedImageBase64) {
      showError('请先上传要编辑的图片')
      return
    }

    if (isEditMode && generator.getCurrentProvider().name !== 'gemini') {
      showError('图片编辑功能目前仅支持 Google Gemini')
      return
    }

    // Update API key
    generator.getCurrentProvider().setApiKey(apiKey)

    const request: GenerateRequest = {
      prompt,
      aspectRatio: aspectRatioSelect.value,
      numberOfImages: parseInt(imageCountSelect.value),
      style: styleSelect.value || undefined,
      editMode: isEditMode,
      inputImage: isEditMode ? uploadedImageBase64 : undefined
    }

    try {
      showLoading(true)
      hideError()
      hideResults()

      const imageUrls = await generator.generateImages(request)
      displayResults(imageUrls, prompt)
    } catch (err: any) {
      showError(err.message)
    } finally {
      showLoading(false)
    }
  })

  clearBtn.addEventListener('click', () => {
    hideResults()
    hideError()
    imageGrid.innerHTML = ''
  })

  function showLoading(show: boolean) {
    if (show) {
      loading.classList.add('show')
      generateBtn.disabled = true
    } else {
      loading.classList.remove('show')
      generateBtn.disabled = false
    }
  }

  function showError(message: string) {
    error.textContent = message
    error.style.display = 'block'
  }

  function hideError() {
    error.style.display = 'none'
  }

  function hideResults() {
    results.classList.remove('show')
  }

  function displayResults(imageUrls: string[], prompt: string) {
    imageGrid.innerHTML = ''

    imageUrls.forEach((url, index) => {
      const item = document.createElement('div')
      item.className = 'image-item'

      const img = document.createElement('img')
      img.src = url
      img.alt = `Generated image ${index + 1}`
      img.onerror = () => {
        img.style.display = 'none'
        const errorText = document.createElement('div')
        errorText.textContent = '图片加载失败'
        errorText.style.padding = '50px 20px'
        errorText.style.textAlign = 'center'
        errorText.style.color = '#999'
        item.appendChild(errorText)
      }

      const actions = document.createElement('div')
      actions.className = 'image-actions'

      const downloadBtn = document.createElement('button')
      downloadBtn.className = 'btn btn-primary'
      downloadBtn.style.marginRight = '10px'
      downloadBtn.style.fontSize = '14px'
      downloadBtn.style.padding = '8px 16px'
      downloadBtn.textContent = '📥 下载'
      downloadBtn.onclick = async () => {
        try {
          const filename = `ai-generated-${Date.now()}-${index + 1}.png`
          await generator.downloadImage(url, filename)
        } catch (err: any) {
          showError(err.message)
        }
      }

      const copyBtn = document.createElement('button')
      copyBtn.className = 'btn btn-secondary'
      copyBtn.style.fontSize = '14px'
      copyBtn.style.padding = '8px 16px'
      copyBtn.textContent = '📋 复制链接'
      copyBtn.onclick = async () => {
        try {
          await generator.copyToClipboard(url)
          copyBtn.textContent = '✅ 已复制'
          setTimeout(() => {
            copyBtn.textContent = '📋 复制链接'
          }, 2000)
        } catch (err) {
          showError('复制失败')
        }
      }

      actions.appendChild(downloadBtn)
      actions.appendChild(copyBtn)

      item.appendChild(img)
      item.appendChild(actions)
      imageGrid.appendChild(item)
    })

    results.classList.add('show')
  }

  // Add sample prompts for user convenience
  const samplePrompts = [
    '一只可爱的橘猫坐在樱花树下，阳光透过花瓣洒在地面上',
    '未来城市的霓虹夜景，飞行汽车穿梭在摩天大楼之间',
    '一座古老的图书馆，书架高耸入云，魔法书本在空中飞舞',
    '宁静的湖泊，倒映着雪山和晚霞，一只白鹤在湖面飞翔',
    '机器人在花园里浇花，周围开满五彩缤纷的花朵'
  ]

  // Add quick prompt buttons
  const promptSuggestions = document.createElement('div')
  promptSuggestions.style.marginTop = '10px'
  promptSuggestions.innerHTML = '<small style="color: #666;">快速示例：</small>'

  samplePrompts.forEach(prompt => {
    const btn = document.createElement('button')
    btn.style.cssText = `
      margin: 5px 5px 0 0;
      padding: 4px 8px;
      background: #f8f9fa;
      border: 1px solid #dee2e6;
      border-radius: 4px;
      font-size: 12px;
      cursor: pointer;
      color: #6c757d;
    `
    btn.textContent = prompt.substring(0, 20) + '...'
    btn.onclick = () => {
      promptInput.value = prompt
    }
    promptSuggestions.appendChild(btn)
  })

  promptInput.parentElement?.appendChild(promptSuggestions)
})
