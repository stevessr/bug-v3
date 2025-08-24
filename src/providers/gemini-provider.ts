import { ImageProvider, GenerateRequest, GeminiGenerateResponse } from '../types/image-generator-types'

export class GeminiProvider implements ImageProvider {
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
    // Implementation for image editing using Gemini
    throw new Error('Gemini 图片编辑功能暂未实现')
  }
}