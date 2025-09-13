import { ref, computed } from 'vue'

import { ProviderManager } from '@/utils/imageProviders'
import type { GenerateRequest } from '@/types/imageGenerator'

/* eslint-disable @typescript-eslint/no-explicit-any */

export function useImageGenerator() {
  const providerManager = new ProviderManager()
  const isGenerating = ref(false)
  const error = ref<string | null>(null)
  const generatedImages = ref<string[]>([])

  // Form data
  const generationMode = ref<'generate' | 'edit'>('generate')
  const uploadedImage = ref<string | undefined>()
  const prompt = ref('')
  const generationConfig = ref({
    imageCount: 4,
    aspectRatio: '1:1',
    style: ''
  })

  // Computed
  const canGenerate = computed(() => {
    const hasPrompt = prompt.value.trim().length > 0
    const currentProvider = providerManager.getCurrentProvider()
    const hasApiKey =
      currentProvider && typeof currentProvider.loadApiKey === 'function'
        ? currentProvider.loadApiKey().length > 0
        : false
    const hasImageForEdit = generationMode.value === 'edit' ? !!uploadedImage.value : true

    return hasPrompt && hasApiKey && hasImageForEdit && !isGenerating.value
  })

  // Methods
  const generateImages = async () => {
    if (!canGenerate.value) return

    isGenerating.value = true
    error.value = null
    generatedImages.value = []

    try {
      const request: GenerateRequest = {
        prompt: prompt.value.trim(),
        aspectRatio: generationConfig.value.aspectRatio,
        numberOfImages: generationConfig.value.imageCount,
        style: generationConfig.value.style || undefined,
        editMode: generationMode.value === 'edit',
        inputImage: uploadedImage.value
      }

      const images = await providerManager.generateImages(request)
      generatedImages.value = images
    } catch (err: any) {
      error.value = err.message || '生成图片时发生错误，请稍后重试'
      console.error('Generation failed:', err)
    } finally {
      isGenerating.value = false
    }
  }

  const clearResults = () => {
    generatedImages.value = []
    error.value = null
  }

  const downloadImage = async (url: string, filename: string) => {
    try {
      await providerManager.downloadImage(url, filename)
    } catch (err: any) {
      throw new Error(err.message || '下载失败')
    }
  }

  const copyImageUrl = async (url: string) => {
    try {
      await providerManager.copyToClipboard(url)
    } catch (err) {
      throw new Error('复制失败')
    }
  }

  const resetForm = () => {
    generationMode.value = 'generate'
    uploadedImage.value = undefined
    prompt.value = ''
    generationConfig.value = {
      imageCount: 4,
      aspectRatio: '1:1',
      style: ''
    }
    clearResults()
  }

  return {
    // State
    providerManager,
    isGenerating,
    error,
    generatedImages,
    generationMode,
    uploadedImage,
    prompt,
    generationConfig,

    // Computed
    canGenerate,

    // Methods
    generateImages,
    clearResults,
    downloadImage,
    copyImageUrl,
    resetForm
  }
}
