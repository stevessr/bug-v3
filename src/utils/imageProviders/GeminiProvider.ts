import { BaseProvider } from './BaseProvider'
import type { GenerateRequest, GeminiGenerateResponse } from '@/types/imageGenerator'

export class GeminiProvider extends BaseProvider {
  name = 'gemini'
  displayName = 'Google Gemini'
  private apiEndpoint =
    'https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:generateImage'

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
      this.handleApiError(error, 'Gemini')
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
      this.handleApiError(error, 'Gemini')
    }
  }
}
