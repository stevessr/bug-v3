import { BaseProvider } from './BaseProvider'

import type { GenerateRequest, ChutesAIGenerateResponse } from '@/types/imageGenerator'

export class ChutesAIProvider extends BaseProvider {
  name = 'chutesai'
  displayName = 'Chutes AI'
  private apiEndpoint = 'https://image.chutes.ai/generate'
  private selectedModel: string = 'neta-lumina'

  setModel(model: string): void {
    this.selectedModel = model
    localStorage.setItem('chutesai_selected_model', model)
  }

  loadSelectedModel(): void {
    const saved = localStorage.getItem('chutesai_selected_model')
    if (saved) {
      this.selectedModel = saved
    }
  }

  getSelectedModel(): string {
    return this.selectedModel
  }

  async generateImages(request: GenerateRequest): Promise<string[]> {
    if (!this.apiKey) {
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
            Authorization: `Bearer ${this.apiKey}`,
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
      this.handleApiError(error, 'Chutes AI')
    }
  }
}
