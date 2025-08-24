/**
 * Enhanced AI Image Generator with Custom Provider Support
 */

export interface AIProvider {
  id: string
  name: string
  displayName: string
  description: string
  website?: string
  documentation?: string
  apiKeyFormat?: string
  apiKeyExample?: string
  models?: string[]
  supportedFeatures: {
    textToImage: boolean
    imageToImage: boolean
    inpainting: boolean
    outpainting: boolean
    upscaling: boolean
    styleTransfer: boolean
  }
  customEndpoint?: boolean
  customHeaders?: boolean
}

export interface CustomProviderConfig {
  id: string
  name: string
  displayName: string
  baseUrl: string
  apiKey: string
  headers?: Record<string, string>
  requestFormat: 'openai' | 'stability' | 'custom'
  responseFormat: 'openai' | 'stability' | 'custom'
  customRequestTemplate?: string
  customResponseParser?: string
  models: string[]
  defaultModel?: string
  maxImageSize?: number
  supportedFormats?: string[]
}

export interface GenerationRequest {
  prompt: string
  negativePrompt?: string
  aspectRatio?: string
  numberOfImages?: number
  style?: string
  model?: string
  seed?: number
  steps?: number
  guidance?: number
  strength?: number // for image-to-image
  inputImage?: string // Base64 for image-to-image
  maskImage?: string // Base64 for inpainting
  customParams?: Record<string, any>
}

export interface GenerationResponse {
  images: string[] // URLs or base64 data URLs
  metadata?: {
    seed?: number
    steps?: number
    guidance?: number
    model?: string
    time?: number
    cost?: number
  }
  error?: string
}

export class CustomAIProviderManager {
  private providers: Map<string, AIProvider> = new Map()
  private customConfigs: Map<string, CustomProviderConfig> = new Map()
  private activeProvider: string = 'openai'

  constructor() {
    this.initializeBuiltInProviders()
    this.loadCustomProviders()
  }

  private initializeBuiltInProviders(): void {
    // Built-in providers
    const builtInProviders: AIProvider[] = [
      {
        id: 'openai',
        name: 'openai',
        displayName: 'OpenAI DALL-E',
        description: 'OpenAI\'s DALL-E image generation model',
        website: 'https://openai.com',
        documentation: 'https://platform.openai.com/docs/guides/images',
        apiKeyFormat: 'sk-...',
        apiKeyExample: 'sk-1234567890abcdef...',
        models: ['dall-e-3', 'dall-e-2'],
        supportedFeatures: {
          textToImage: true,
          imageToImage: true,
          inpainting: false,
          outpainting: false,
          upscaling: false,
          styleTransfer: false
        }
      },
      {
        id: 'stability',
        name: 'stability',
        displayName: 'Stability AI',
        description: 'Stable Diffusion models by Stability AI',
        website: 'https://stability.ai',
        documentation: 'https://platform.stability.ai/docs',
        apiKeyFormat: 'sk-...',
        apiKeyExample: 'sk-1234567890abcdef...',
        models: ['stable-diffusion-xl-1024-v1-0', 'stable-diffusion-v1-6'],
        supportedFeatures: {
          textToImage: true,
          imageToImage: true,
          inpainting: true,
          outpainting: true,
          upscaling: true,
          styleTransfer: true
        }
      },
      {
        id: 'midjourney',
        name: 'midjourney',
        displayName: 'Midjourney (API)',
        description: 'Midjourney image generation via API',
        website: 'https://midjourney.com',
        documentation: 'https://docs.midjourney.com',
        models: ['midjourney-v6', 'midjourney-v5.2'],
        supportedFeatures: {
          textToImage: true,
          imageToImage: true,
          inpainting: false,
          outpainting: false,
          upscaling: true,
          styleTransfer: true
        }
      },
      {
        id: 'replicate',
        name: 'replicate',
        displayName: 'Replicate',
        description: 'Various AI models hosted on Replicate',
        website: 'https://replicate.com',
        documentation: 'https://replicate.com/docs',
        apiKeyFormat: 'r8_...',
        models: ['stability-ai/sdxl', 'playgroundai/playground-v2-1024px-aesthetic'],
        supportedFeatures: {
          textToImage: true,
          imageToImage: true,
          inpainting: true,
          outpainting: false,
          upscaling: true,
          styleTransfer: true
        }
      },
      {
        id: 'huggingface',
        name: 'huggingface',
        displayName: 'Hugging Face',
        description: 'AI models from Hugging Face Inference API',
        website: 'https://huggingface.co',
        documentation: 'https://huggingface.co/docs/inference',
        apiKeyFormat: 'hf_...',
        models: ['runwayml/stable-diffusion-v1-5', 'stabilityai/stable-diffusion-xl-base-1.0'],
        supportedFeatures: {
          textToImage: true,
          imageToImage: true,
          inpainting: true,
          outpainting: false,
          upscaling: false,
          styleTransfer: true
        }
      },
      {
        id: 'custom',
        name: 'custom',
        displayName: 'Custom Provider',
        description: 'Configure your own AI image generation endpoint',
        customEndpoint: true,
        customHeaders: true,
        supportedFeatures: {
          textToImage: true,
          imageToImage: true,
          inpainting: true,
          outpainting: true,
          upscaling: true,
          styleTransfer: true
        }
      }
    ]

    builtInProviders.forEach(provider => {
      this.providers.set(provider.id, provider)
    })
  }

  private loadCustomProviders(): void {
    try {
      const stored = localStorage.getItem('custom_ai_providers')
      if (stored) {
        const configs: CustomProviderConfig[] = JSON.parse(stored)
        configs.forEach(config => {
          this.customConfigs.set(config.id, config)
        })
      }
    } catch (error) {
      console.error('Failed to load custom providers:', error)
    }
  }

  private saveCustomProviders(): void {
    try {
      const configs = Array.from(this.customConfigs.values())
      localStorage.setItem('custom_ai_providers', JSON.stringify(configs))
    } catch (error) {
      console.error('Failed to save custom providers:', error)
    }
  }

  public getProviders(): AIProvider[] {
    return Array.from(this.providers.values())
  }

  public getProvider(id: string): AIProvider | undefined {
    return this.providers.get(id)
  }

  public getCustomConfig(id: string): CustomProviderConfig | undefined {
    return this.customConfigs.get(id)
  }

  public addCustomProvider(config: CustomProviderConfig): void {
    // Validate config
    if (!config.id || !config.name || !config.baseUrl) {
      throw new Error('Invalid provider configuration')
    }

    // Add as custom provider
    const provider: AIProvider = {
      id: config.id,
      name: config.id,
      displayName: config.displayName,
      description: `Custom provider: ${config.name}`,
      customEndpoint: true,
      customHeaders: true,
      models: config.models,
      supportedFeatures: {
        textToImage: true,
        imageToImage: true,
        inpainting: true,
        outpainting: true,
        upscaling: true,
        styleTransfer: true
      }
    }

    this.providers.set(config.id, provider)
    this.customConfigs.set(config.id, config)
    this.saveCustomProviders()
  }

  public removeCustomProvider(id: string): void {
    this.providers.delete(id)
    this.customConfigs.delete(id)
    this.saveCustomProviders()
  }

  public updateCustomProvider(id: string, config: Partial<CustomProviderConfig>): void {
    const existing = this.customConfigs.get(id)
    if (!existing) {
      throw new Error('Provider not found')
    }

    const updated = { ...existing, ...config }
    this.customConfigs.set(id, updated)
    
    // Update provider info
    const provider = this.providers.get(id)
    if (provider) {
      provider.displayName = updated.displayName
      provider.models = updated.models
    }
    
    this.saveCustomProviders()
  }

  public setActiveProvider(id: string): void {
    if (!this.providers.has(id)) {
      throw new Error('Provider not found')
    }
    this.activeProvider = id
    localStorage.setItem('active_ai_provider', id)
  }

  public getActiveProvider(): string {
    const stored = localStorage.getItem('active_ai_provider')
    if (stored && this.providers.has(stored)) {
      this.activeProvider = stored
    }
    return this.activeProvider
  }

  public async generateImages(request: GenerationRequest): Promise<GenerationResponse> {
    const providerId = this.getActiveProvider()
    const provider = this.providers.get(providerId)
    
    if (!provider) {
      throw new Error('No active provider found')
    }

    // Handle custom providers
    if (this.customConfigs.has(providerId)) {
      return this.generateWithCustomProvider(providerId, request)
    }

    // Handle built-in providers
    switch (providerId) {
      case 'openai':
        return this.generateWithOpenAI(request)
      case 'stability':
        return this.generateWithStability(request)
      case 'midjourney':
        return this.generateWithMidjourney(request)
      case 'replicate':
        return this.generateWithReplicate(request)
      case 'huggingface':
        return this.generateWithHuggingFace(request)
      default:
        throw new Error(`Provider ${providerId} not implemented`)
    }
  }

  private async generateWithCustomProvider(
    providerId: string, 
    request: GenerationRequest
  ): Promise<GenerationResponse> {
    const config = this.customConfigs.get(providerId)
    if (!config) {
      throw new Error('Custom provider configuration not found')
    }

    const apiKey = localStorage.getItem(`${providerId}_api_key`)
    if (!apiKey) {
      throw new Error('API key not set for custom provider')
    }

    try {
      let requestBody: any
      let headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...config.headers
      }

      // Add API key to headers
      headers['Authorization'] = `Bearer ${apiKey}`

      // Format request based on template
      switch (config.requestFormat) {
        case 'openai':
          requestBody = {
            prompt: request.prompt,
            n: request.numberOfImages || 1,
            size: this.mapAspectRatioToSize(request.aspectRatio),
            model: request.model || config.defaultModel
          }
          break
        
        case 'stability':
          requestBody = {
            text_prompts: [
              { text: request.prompt, weight: 1 }
            ],
            cfg_scale: request.guidance || 7,
            steps: request.steps || 30,
            samples: request.numberOfImages || 1,
            width: 1024,
            height: 1024
          }
          
          if (request.negativePrompt) {
            requestBody.text_prompts.push({
              text: request.negativePrompt,
              weight: -1
            })
          }
          break
        
        case 'custom':
          if (config.customRequestTemplate) {
            // Parse custom template (simplified)
            requestBody = JSON.parse(
              config.customRequestTemplate
                .replace('{{prompt}}', request.prompt)
                .replace('{{negative_prompt}}', request.negativePrompt || '')
                .replace('{{num_images}}', (request.numberOfImages || 1).toString())
                .replace('{{model}}', request.model || config.defaultModel || '')
            )
          } else {
            // Default format
            requestBody = {
              prompt: request.prompt,
              negative_prompt: request.negativePrompt,
              num_images: request.numberOfImages || 1,
              model: request.model || config.defaultModel,
              ...request.customParams
            }
          }
          break
      }

      const response = await fetch(config.baseUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()

      // Parse response based on format
      return this.parseCustomResponse(data, config)
    } catch (error) {
      console.error('Custom provider generation failed:', error)
      throw new Error(`Custom provider generation failed: ${error}`)
    }
  }

  private parseCustomResponse(data: any, config: CustomProviderConfig): GenerationResponse {
    if (config.customResponseParser) {
      // Parse with custom parser (simplified)
      try {
        const parser = new Function('data', config.customResponseParser)
        return parser(data)
      } catch (error) {
        console.error('Custom response parser failed:', error)
      }
    }

    // Default parsing based on format
    switch (config.responseFormat) {
      case 'openai':
        if (data.data && Array.isArray(data.data)) {
          return {
            images: data.data.map((item: any) => item.url || item.b64_json)
          }
        }
        break
      
      case 'stability':
        if (data.artifacts && Array.isArray(data.artifacts)) {
          return {
            images: data.artifacts.map((artifact: any) => 
              artifact.base64 ? `data:image/png;base64,${artifact.base64}` : artifact.url
            )
          }
        }
        break
      
      case 'custom':
        // Try to find images in common response formats
        if (data.images && Array.isArray(data.images)) {
          return { images: data.images }
        }
        if (data.data && Array.isArray(data.data)) {
          return { images: data.data }
        }
        if (data.output && Array.isArray(data.output)) {
          return { images: data.output }
        }
        break
    }

    throw new Error('Unable to parse response from custom provider')
  }

  private async generateWithOpenAI(request: GenerationRequest): Promise<GenerationResponse> {
    const apiKey = localStorage.getItem('openai_api_key')
    if (!apiKey) {
      throw new Error('OpenAI API key not set')
    }

    const requestBody = {
      prompt: request.prompt,
      n: request.numberOfImages || 1,
      size: this.mapAspectRatioToSize(request.aspectRatio),
      model: request.model || 'dall-e-3',
      quality: 'standard',
      response_format: 'url'
    }

    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`)
    }

    const data = await response.json()
    return {
      images: data.data.map((item: any) => item.url)
    }
  }

  private async generateWithStability(request: GenerationRequest): Promise<GenerationResponse> {
    const apiKey = localStorage.getItem('stability_api_key')
    if (!apiKey) {
      throw new Error('Stability AI API key not set')
    }

    const requestBody = {
      text_prompts: [
        { text: request.prompt, weight: 1 }
      ],
      cfg_scale: request.guidance || 7,
      steps: request.steps || 30,
      samples: request.numberOfImages || 1,
      width: 1024,
      height: 1024
    }

    if (request.negativePrompt) {
      requestBody.text_prompts.push({
        text: request.negativePrompt,
        weight: -1
      })
    }

    const model = request.model || 'stable-diffusion-xl-1024-v1-0'
    const response = await fetch(`https://api.stability.ai/v1/generation/${model}/text-to-image`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      throw new Error(`Stability AI API error: ${response.status}`)
    }

    const data = await response.json()
    return {
      images: data.artifacts.map((artifact: any) => 
        `data:image/png;base64,${artifact.base64}`
      )
    }
  }

  private async generateWithMidjourney(request: GenerationRequest): Promise<GenerationResponse> {
    // Placeholder for Midjourney API implementation
    throw new Error('Midjourney integration not yet implemented')
  }

  private async generateWithReplicate(request: GenerationRequest): Promise<GenerationResponse> {
    const apiKey = localStorage.getItem('replicate_api_key')
    if (!apiKey) {
      throw new Error('Replicate API key not set')
    }

    const model = request.model || 'stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b'
    
    const prediction = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        version: model,
        input: {
          prompt: request.prompt,
          negative_prompt: request.negativePrompt,
          num_outputs: request.numberOfImages || 1,
          guidance_scale: request.guidance || 7.5,
          num_inference_steps: request.steps || 50
        }
      })
    })

    if (!prediction.ok) {
      throw new Error(`Replicate API error: ${prediction.status}`)
    }

    const predictionData = await prediction.json()
    
    // Poll for completion
    let result = predictionData
    while (result.status === 'starting' || result.status === 'processing') {
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      const statusResponse = await fetch(`https://api.replicate.com/v1/predictions/${result.id}`, {
        headers: {
          'Authorization': `Token ${apiKey}`
        }
      })
      
      result = await statusResponse.json()
    }

    if (result.status === 'failed') {
      throw new Error('Replicate generation failed')
    }

    return {
      images: Array.isArray(result.output) ? result.output : [result.output]
    }
  }

  private async generateWithHuggingFace(request: GenerationRequest): Promise<GenerationResponse> {
    const apiKey = localStorage.getItem('huggingface_api_key')
    if (!apiKey) {
      throw new Error('Hugging Face API key not set')
    }

    const model = request.model || 'runwayml/stable-diffusion-v1-5'
    
    const response = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputs: request.prompt,
        parameters: {
          negative_prompt: request.negativePrompt,
          guidance_scale: request.guidance || 7.5,
          num_inference_steps: request.steps || 50
        }
      })
    })

    if (!response.ok) {
      throw new Error(`Hugging Face API error: ${response.status}`)
    }

    const blob = await response.blob()
    const dataUrl = await this.blobToDataUrl(blob)

    return {
      images: [dataUrl]
    }
  }

  private mapAspectRatioToSize(aspectRatio?: string): string {
    const sizeMap: Record<string, string> = {
      '1:1': '1024x1024',
      '16:9': '1792x1024',
      '9:16': '1024x1792',
      '4:3': '1152x896',
      '3:4': '896x1152'
    }
    return sizeMap[aspectRatio || '1:1'] || '1024x1024'
  }

  private blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  }

  public exportProviderConfig(id: string): string {
    const config = this.customConfigs.get(id)
    if (!config) {
      throw new Error('Provider not found')
    }
    
    // Remove sensitive data
    const exportConfig = { ...config }
    delete exportConfig.apiKey
    
    return JSON.stringify(exportConfig, null, 2)
  }

  public importProviderConfig(configJson: string): void {
    try {
      const config: CustomProviderConfig = JSON.parse(configJson)
      
      // Validate required fields
      if (!config.id || !config.name || !config.baseUrl) {
        throw new Error('Invalid configuration format')
      }
      
      // Generate new ID if exists
      if (this.customConfigs.has(config.id)) {
        config.id = `${config.id}_${Date.now()}`
      }
      
      this.addCustomProvider(config)
    } catch (error) {
      throw new Error(`Failed to import configuration: ${error}`)
    }
  }

  public testProvider(id: string): Promise<boolean> {
    return new Promise(async (resolve) => {
      try {
        const testRequest: GenerationRequest = {
          prompt: 'test image generation',
          numberOfImages: 1
        }
        
        const originalProvider = this.getActiveProvider()
        this.setActiveProvider(id)
        
        await this.generateImages(testRequest)
        
        this.setActiveProvider(originalProvider)
        resolve(true)
      } catch (error) {
        console.error('Provider test failed:', error)
        resolve(false)
      }
    })
  }
}