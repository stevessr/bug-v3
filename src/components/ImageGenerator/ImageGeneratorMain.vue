<script setup lang="ts">
import ApiConfig from './ApiConfig.vue'
import GenerationMode from './GenerationMode.vue'
import PromptInput from './PromptInput.vue'
import GenerationConfig from './GenerationConfig.vue'
import GenerateButton from './GenerateButton.vue'
import ResultDisplay from './ResultDisplay.vue'

import { useImageGenerator } from '@/composables/useImageGenerator'

// Use the composable
const {
  providerManager,
  isGenerating,
  error,
  generatedImages,
  generationMode,
  uploadedImage,
  prompt,
  generationConfig,
  canGenerate,
  generateImages,
  clearResults,
  downloadImage,
  copyImageUrl
} = useImageGenerator()

// Event handlers
const onProviderChanged = (provider: string) => {
  console.log('Provider changed to:', provider)
  // Reset edit mode if new provider doesn't support it
  if (generationMode.value === 'edit' && !providerManager.supportsImageEditing()) {
    generationMode.value = 'generate'
  }
}

const onApiKeyChanged = (_key: string) => {
  console.log('API key changed')
}

const onModelChanged = (model: string) => {
  console.log('Model changed to:', model)
}

const onModeChanged = (mode: 'generate' | 'edit') => {
  console.log('Mode changed to:', mode)
  // Clear uploaded image when switching to generate mode
  if (mode === 'generate') {
    uploadedImage.value = undefined
  }
}

const onImageChanged = (image: string | undefined) => {
  console.log('Image changed:', !!image)
}

const onPromptChanged = (_newPrompt: string) => {
  console.log('Prompt changed')
}

const onConfigChanged = (config: typeof generationConfig.value) => {
  console.log('Config changed:', config)
}

const onGenerate = async () => {
  await generateImages()
}

const onClear = () => {
  clearResults()
}

const onDownloadImage = async (url: string, filename: string) => {
  try {
    await downloadImage(url, filename)
  } catch (err: any) {
    alert(err.message || '下载失败')
  }
}

const onCopyImageUrl = async (url: string) => {
  try {
    await copyImageUrl(url)
    alert('链接已复制到剪贴板')
  } catch (err) {
    alert('复制失败')
  }
}
</script>

<template>
  <div class="image-generator">
    <div class="container">
      <header class="header">
        <h1>🎨 AI 图片生成器</h1>
        <p>使用先进的 AI 技术，将您的想象转化为精美的图片</p>
      </header>

      <div class="generator-content">
        <!-- API Configuration -->
        <ApiConfig
          :provider-manager="providerManager"
          @provider-changed="onProviderChanged"
          @api-key-changed="onApiKeyChanged"
          @model-changed="onModelChanged"
        />

        <!-- Generation Mode -->
        <GenerationMode
          v-model="generationMode"
          v-model:uploaded-image="uploadedImage"
          :provider-manager="providerManager"
          @mode-changed="onModeChanged"
          @image-changed="onImageChanged"
        />

        <!-- Prompt Input -->
        <PromptInput
          v-model="prompt"
          :is-edit-mode="generationMode === 'edit'"
          @prompt-changed="onPromptChanged"
        />

        <!-- Generation Configuration -->
        <GenerationConfig v-model="generationConfig" @config-changed="onConfigChanged" />

        <!-- Generate Button -->
        <GenerateButton
          :is-generating="isGenerating"
          :has-results="generatedImages.length > 0"
          :can-generate="canGenerate"
          @generate="onGenerate"
          @clear="onClear"
        />

        <!-- Results Display -->
        <ResultDisplay
          :is-loading="isGenerating"
          :error="error"
          :images="generatedImages"
          @download-image="onDownloadImage"
          @copy-image-url="onCopyImageUrl"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.image-generator {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px 0;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
}

.header {
  text-align: center;
  margin-bottom: 40px;
  color: white;
}

.header h1 {
  font-size: 2.5rem;
  margin: 0 0 10px 0;
  font-weight: 700;
}

.header p {
  font-size: 1.1rem;
  margin: 0;
  opacity: 0.9;
}

.generator-content {
  background: rgba(255, 255, 255, 0.95);
  border-radius: 16px;
  padding: 30px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(10px);
}

@media (max-width: 768px) {
  .header h1 {
    font-size: 2rem;
  }

  .header p {
    font-size: 1rem;
  }

  .generator-content {
    padding: 20px;
    margin: 0 10px;
  }

  .container {
    padding: 0 10px;
  }
}
</style>
