// AI provider utilities for emoji renaming
export interface AiProvider {
  name: string
  displayName: string
  isLocal: boolean
  requiresApiKey: boolean
}

export interface AiRenameResult {
  emoji: any
  suggestions: string[]
  selectedSuggestion: number
}

export const AI_PROVIDERS: Record<string, AiProvider> = {
  gemini: {
    name: 'gemini',
    displayName: 'Google Gemini',
    isLocal: false,
    requiresApiKey: true
  },
  openai: {
    name: 'openai', 
    displayName: 'OpenAI',
    isLocal: false,
    requiresApiKey: true
  },
  claude: {
    name: 'claude',
    displayName: 'Anthropic Claude',
    isLocal: false,
    requiresApiKey: true
  },
  'openai-compatible': {
    name: 'openai-compatible',
    displayName: 'OpenAI 兼容 API',
    isLocal: false,
    requiresApiKey: true
  },
  'chrome-ai': {
    name: 'chrome-ai',
    displayName: 'Chrome AI',
    isLocal: true,
    requiresApiKey: false
  },
  'edge-ai': {
    name: 'edge-ai',
    displayName: 'Edge AI',
    isLocal: true,
    requiresApiKey: false
  }
}

export class AiEmojiRenamer {
  async checkBrowserAiAvailability(): Promise<{ chromeAi: boolean; edgeAi: boolean }> {
    const result = { chromeAi: false, edgeAi: false }

    // Check Chrome AI
    try {
      if (typeof window !== 'undefined' && (window as any).chrome?.ai) {
        result.chromeAi = true
      }
    } catch (error) {
      console.log('Chrome AI not available')
    }

    // Check Edge AI
    try {
      if (typeof window !== 'undefined' && (window as any).navigator?.ml) {
        result.edgeAi = true
      }
    } catch (error) {
      console.log('Edge AI not available')
    }

    return result
  }

  async getAiSuggestions(emoji: any, provider: string, config: any): Promise<string[]> {
    const prompt = `请为这个表情图片提供3个简洁的中文名称建议。要求：
1. 名称简短（1-4个字）
2. 准确描述图片内容
3. 适合用作表情包名称
4. 只返回3个名称，用逗号分隔`

    switch (provider) {
      case 'gemini':
        return this.callGeminiApi(prompt, emoji.url, config.apiKey)
      case 'openai':
        return this.callOpenAiApi(prompt, emoji.url, config.apiKey)
      case 'claude':
        return this.callClaudeApi(prompt, emoji.url, config.apiKey)
      case 'openai-compatible':
        return this.callOpenAiCompatibleApi(prompt, emoji.url, config)
      case 'chrome-ai':
        return this.callChromeAi(prompt, emoji.url)
      case 'edge-ai':
        return this.callEdgeAi(prompt, emoji.url)
      default:
        throw new Error('不支持的 AI 提供商')
    }
  }

  private async callGeminiApi(prompt: string, imageUrl: string, apiKey: string): Promise<string[]> {
    const imageData = await this.getImageAsBase64(imageUrl)
    
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { 
              inline_data: {
                mime_type: 'image/jpeg',
                data: imageData.split(',')[1]
              }
            }
          ]
        }]
      })
    })

    const data = await response.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
    return text.split(',').map((s: string) => s.trim()).slice(0, 3)
  }

  private async callOpenAiApi(prompt: string, imageUrl: string, apiKey: string): Promise<string[]> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4-vision-preview',
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: imageUrl } }
          ]
        }],
        max_tokens: 100
      })
    })

    const data = await response.json()
    const text = data.choices?.[0]?.message?.content || ''
    return text.split(',').map((s: string) => s.trim()).slice(0, 3)
  }

  private async callClaudeApi(prompt: string, imageUrl: string, apiKey: string): Promise<string[]> {
    const imageData = await this.getImageAsBase64(imageUrl)
    
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 100,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { 
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/jpeg',
                data: imageData.split(',')[1]
              }
            }
          ]
        }]
      })
    })

    const data = await response.json()
    const text = data.content?.[0]?.text || ''
    return text.split(',').map((s: string) => s.trim()).slice(0, 3)
  }

  private async callOpenAiCompatibleApi(prompt: string, imageUrl: string, config: any): Promise<string[]> {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: imageUrl } }
          ]
        }],
        max_tokens: 100
      })
    })

    const data = await response.json()
    const text = data.choices?.[0]?.message?.content || ''
    return text.split(',').map((s: string) => s.trim()).slice(0, 3)
  }

  private async callChromeAi(prompt: string, imageUrl: string): Promise<string[]> {
    try {
      const session = await (window as any).chrome.ai.createTextSession()
      const response = await session.prompt(`${prompt}\n\n基于图片: ${imageUrl}`)
      return response.split(',').map((s: string) => s.trim()).slice(0, 3)
    } catch (error) {
      throw new Error('Chrome AI 不可用，请确保使用支持 AI 的 Chrome 版本')
    }
  }

  private async callEdgeAi(prompt: string, imageUrl: string): Promise<string[]> {
    try {
      const response = await (window as any).navigator.ml.generateText({
        prompt: `${prompt}\n\n基于图片: ${imageUrl}`,
        maxTokens: 100
      })
      return response.split(',').map((s: string) => s.trim()).slice(0, 3)
    } catch (error) {
      throw new Error('Edge AI 不可用，请确保使用支持 AI 的 Edge 版本')
    }
  }

  private async getImageAsBase64(imageUrl: string): Promise<string> {
    if (imageUrl.startsWith('data:')) {
      return imageUrl
    }
    
    try {
      const response = await fetch(imageUrl)
      const blob = await response.blob()
      
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })
    } catch (error) {
      throw new Error('无法获取图片数据')
    }
  }
}