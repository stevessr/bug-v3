import { GeminiProvider } from './GeminiProvider'
import { SiliconFlowProvider } from './SiliconFlowProvider'
import { CloudflareProvider } from './CloudflareProvider'
import { ChutesAIProvider } from './ChutesAIProvider'

import type { ImageProvider, GenerateRequest } from '@/types/imageGenerator'

export class ProviderManager {
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

    // Load saved provider selection
    this.loadSelectedProvider()
  }

  getProviders(): ImageProvider[] {
    return Array.from(this.providers.values())
  }

  getProviderNames(): string[] {
    return Array.from(this.providers.keys())
  }

  setCurrentProvider(providerName: string): boolean {
    const provider = this.providers.get(providerName)
    if (provider) {
      this.currentProvider = provider
      localStorage.setItem('selected_provider', providerName)
      return true
    }
    return false
  }

  getCurrentProvider(): ImageProvider {
    return this.currentProvider
  }

  getCurrentProviderName(): string {
    return this.currentProvider.name
  }

  getProvider(name: string): ImageProvider | undefined {
    return this.providers.get(name)
  }

  loadSelectedProvider(): void {
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
    return this.currentProvider.copyToClipboard(url)
  }

  // Provider-specific methods
  setProviderModel(providerName: string, model: string): void {
    const provider = this.providers.get(providerName) as any
    if (provider && typeof provider.setModel === 'function') {
      provider.setModel(model)
    }
  }

  loadProviderModel(providerName: string): void {
    const provider = this.providers.get(providerName) as any
    if (provider && typeof provider.loadSelectedModel === 'function') {
      provider.loadSelectedModel()
    }
  }

  getProviderModel(providerName: string): string | undefined {
    const provider = this.providers.get(providerName) as any
    if (provider && typeof provider.getSelectedModel === 'function') {
      return provider.getSelectedModel()
    }
    return undefined
  }

  supportsImageEditing(providerName?: string): boolean {
    const provider = providerName ? this.providers.get(providerName) : this.currentProvider
    return provider?.name === 'gemini' // Currently only Gemini supports image editing
  }

  supportsModels(providerName?: string): boolean {
    const provider = providerName ? this.providers.get(providerName) : this.currentProvider
    return provider?.name === 'cloudflare' || provider?.name === 'chutesai'
  }
}
