import type { GenerateRequest } from '@/types/imageGenerator'


export abstract class BaseProvider {
  abstract name: string
  abstract displayName: string
  protected apiKey: string = ''

  // Implementations must provide a typed generateImages method
  // Use a leading underscore to avoid 'defined but never used' lint warnings in base class
  abstract generateImages(_request: GenerateRequest): Promise<string[]>

  setApiKey(key: string): void {
    this.apiKey = key
    localStorage.setItem(`${this.name}_api_key`, key)
  }

  loadApiKey(): string {
    const saved = localStorage.getItem(`${this.name}_api_key`)
    if (saved) {
      this.apiKey = saved
      return saved
    }
    return ''
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

  protected handleApiError(error: unknown, providerName: string): never {
    console.error(`${providerName} image generation failed:`, error)

    const message = typeof error === 'string' ? error : (error as any)?.message || ''

    if (message.includes('401') || message.includes('API_KEY_INVALID')) {
      throw new Error('API Key 无效，请检查您的密钥')
    } else if (message.includes('429') || message.includes('QUOTA_EXCEEDED')) {
      throw new Error('API 请求过于频繁或配额已用完，请稍后重试')
    } else if (message.includes('403') || message.includes('PERMISSION_DENIED')) {
      throw new Error('权限被拒绝，请检查 API Key 权限设置')
    }

    if (typeof error === 'string') throw new Error(error)
    throw error as Error
  }
}
