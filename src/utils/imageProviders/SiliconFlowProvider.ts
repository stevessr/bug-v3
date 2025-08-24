import { BaseProvider } from './BaseProvider'
import type { GenerateRequest, SiliconFlowGenerateResponse } from '@/types/imageGenerator'

export class SiliconFlowProvider extends BaseProvider {
  name = 'siliconflow'
  displayName = 'SiliconFlow'
  private apiEndpoint = 'https://api.siliconflow.cn/v1/images/generations'

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
      this.handleApiError(error, 'SiliconFlow')
    }
  }
}
