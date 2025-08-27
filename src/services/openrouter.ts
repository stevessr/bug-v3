/**
 * OpenRouter API service for text and image generation
 * Based on the documentation in docs/function/openrouter image output.md
 */

export interface OpenRouterMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  images?: {
    type: 'image_url'
    image_url: {
      url: string
    }
  }[]
}

export interface OpenRouterRequest {
  model: string
  messages: OpenRouterMessage[]
  modalities?: string[]
  stream?: boolean
  max_tokens?: number
  temperature?: number
}

export interface OpenRouterResponse {
  choices: {
    message: {
      role: string
      content: string
      images?: {
        type: 'image_url'
        image_url: {
          url: string
        }
      }[]
    }
    delta?: {
      content?: string
      images?: {
        type: 'image_url'
        image_url: {
          url: string
        }
      }[]
    }
  }[]
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

export interface OpenRouterStreamChunk {
  choices: {
    delta: {
      content?: string
      images?: {
        type: 'image_url'
        image_url: {
          url: string
        }
      }[]
    }
  }[]
}

export class OpenRouterService {
  private apiKeys: string[] = []
  private currentKeyIndex = 0
  private baseUrl = 'https://openrouter.ai/api/v1/chat/completions'

  constructor(apiKeys: string[] = []) {
    this.apiKeys = apiKeys.filter((key) => key.trim())
  }

  setApiKeys(keys: string[]) {
    this.apiKeys = keys.filter((key) => key.trim())
    this.currentKeyIndex = 0
  }

  addApiKey(key: string) {
    if (key.trim() && !this.apiKeys.includes(key.trim())) {
      this.apiKeys.push(key.trim())
    }
  }

  removeApiKey(key: string) {
    const index = this.apiKeys.indexOf(key)
    if (index > -1) {
      this.apiKeys.splice(index, 1)
      if (this.currentKeyIndex >= this.apiKeys.length) {
        this.currentKeyIndex = 0
      }
    }
  }

  getApiKeys(): string[] {
    return [...this.apiKeys]
  }

  private getCurrentApiKey(): string {
    if (this.apiKeys.length === 0) {
      throw new Error('No API keys configured')
    }
    return this.apiKeys[this.currentKeyIndex]
  }

  private rotateApiKey() {
    if (this.apiKeys.length > 1) {
      this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length
    }
  }

  private async makeRequest(request: OpenRouterRequest, retryCount = 0): Promise<Response> {
    const apiKey = this.getCurrentApiKey()

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    })

    // If rate limited or unauthorized, try next API key
    if (
      (response.status === 429 || response.status === 401) &&
      retryCount < this.apiKeys.length - 1
    ) {
      this.rotateApiKey()
      return this.makeRequest(request, retryCount + 1)
    }

    return response
  }

  /**
   * Generate text completion
   */
  async generateText(
    messages: OpenRouterMessage[],
    model = 'google/gemini-2.5-flash-image-preview:free',
    options: Partial<OpenRouterRequest> = {},
  ): Promise<OpenRouterResponse> {
    const request: OpenRouterRequest = {
      model,
      messages,
      modalities: ['text'],
      ...options,
    }

    const response = await this.makeRequest(request)

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`OpenRouter API error: ${response.status} ${error}`)
    }

    return response.json()
  }

  /**
   * Generate image from text prompt
   */
  async generateImage(
    prompt: string,
    model = 'google/gemini-2.5-flash-image-preview',
    options: Partial<OpenRouterRequest> = {},
  ): Promise<OpenRouterResponse> {
    const messages: OpenRouterMessage[] = [
      {
        role: 'user',
        content: prompt,
      },
    ]

    const request: OpenRouterRequest = {
      model,
      messages,
      modalities: ['image', 'text'],
      ...options,
    }

    const response = await this.makeRequest(request)

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`OpenRouter API error: ${response.status} ${error}`)
    }

    return response.json()
  }

  /**
   * Stream text generation
   */
  async *streamText(
    messages: OpenRouterMessage[],
    model = 'google/gemini-2.5-flash-image-preview',
    options: Partial<OpenRouterRequest> = {},
  ): AsyncGenerator<OpenRouterStreamChunk, void, unknown> {
    const request: OpenRouterRequest = {
      model,
      messages,
      modalities: ['text'],
      stream: true,
      ...options,
    }

    const response = await this.makeRequest(request)

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`OpenRouter API error: ${response.status} ${error}`)
    }

    if (!response.body) {
      throw new Error('No response body')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') {
              return
            }
            try {
              const parsed = JSON.parse(data)
              if (parsed.choices) {
                yield parsed
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }

  /**
   * Stream image generation
   */
  async *streamImage(
    prompt: string,
    model = 'google/gemini-2.5-flash-image-preview',
    options: Partial<OpenRouterRequest> = {},
  ): AsyncGenerator<OpenRouterStreamChunk, void, unknown> {
    const messages: OpenRouterMessage[] = [
      {
        role: 'user',
        content: prompt,
      },
    ]

    const request: OpenRouterRequest = {
      model,
      messages,
      modalities: ['image', 'text'],
      stream: true,
      ...options,
    }

    const response = await this.makeRequest(request)

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`OpenRouter API error: ${response.status} ${error}`)
    }

    if (!response.body) {
      throw new Error('No response body')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') {
              return
            }
            try {
              const parsed = JSON.parse(data)
              if (parsed.choices) {
                yield parsed
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }

  /**
   * Get available models (placeholder - would need actual API endpoint)
   */
  async getModels(): Promise<{ id: string; name: string; modalities: string[] }[]> {
    // This would require an actual models endpoint from OpenRouter
    // For now, return common models based on documentation
    return [
      {
        id: 'google/gemini-2.5-flash-image-preview:free',
        name: 'Gemini 2.5 Flash (Image)',
        modalities: ['text', 'image'],
      },
      {
        id: 'openai/gpt-oss-20b:free',
        name: 'GPT OSS 20B (Free)',
        modalities: ['text'],
      },
      {
        id: 'z-ai/glm-4.5-air:free',
        name: 'GLM 4.5 Air (Free)',
        modalities: ['text'],
      },
      {
        id: 'qwen/qwen3-coder:free',
        name: 'Qwen 3 (Coder)',
        modalities: ['text'],
      },
      {
        id: 'tngtech/deepseek-r1t2-chimera:free',
        name: 'DeepSeek R1T2 Chimera (Free)',
        modalities: ['text'],
      },
    ]
  }
}

// Default instance
export const openRouterService = new OpenRouterService()
