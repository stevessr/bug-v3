<template>
  <div class="image-generator">
    <div class="container">
      <!-- Header -->
      <div class="header">
        <h1>AI 图片生成器</h1>
        <p>使用 AI 技术生成创意图片</p>
      </div>

      <!-- Main Content -->
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
          :provider-manager="providerManager"
          :uploaded-image="uploadedImage"
          @mode-changed="onModeChanged"
          @image-changed="onImageUploaded"
        />

        <!-- Prompt Input -->
        <PromptInput
          v-model="prompt"
          :is-edit-mode="generationMode === 'edit'"
          @prompt-changed="onPromptChanged"
        />

        <!-- Generation Configuration -->
        <GenerationConfig
          v-model="generationConfig"
          @config-changed="onConfigChanged"
        />

        <!-- Generate Button -->
        <div class="generate-section">
          <button
            @click="onGenerate"
            :disabled="isGenerating || !canGenerate"
            class="generate-btn"
          >
            <span v-if="isGenerating" class="loading-spinner"></span>
            {{ isGenerating ? '生成中...' : '🎨 生成图片' }}
          </button>

          <button
            v-if="generatedImages.length > 0"
            @click="onClear"
            class="clear-btn"
          >
            🗑️ 清空结果
          </button>
        </div>

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

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import ApiConfig from './ApiConfig.vue';
import GenerationMode from './GenerationModeNew.vue';
import PromptInput from './PromptInput.vue';
import GenerationConfig from './GenerationConfig.vue';
import ResultDisplay from './ResultDisplay.vue';
import { providerManager } from './providerManager';
import type { GenerateRequest } from './types';

const selectedProvider = ref('gemini');
const generationMode = ref<'generate' | 'edit'>('generate');
const uploadedImage = ref('');
const prompt = ref('');
const generationConfig = ref({
  imageCount: 1,
  aspectRatio: '1:1',
  style: ''
});

const isGenerating = ref(false);
const error = ref<string | null>(null);
const generatedImages = ref<string[]>([]);

const canGenerate = computed(() => {
  const hasPrompt = prompt.value.trim().length > 0;
  const hasImageForEdit = generationMode.value !== 'edit' || uploadedImage.value;
  return hasPrompt && hasImageForEdit;
});

const onProviderChanged = (provider: string) => {
  console.log('Provider changed to:', provider);
  selectedProvider.value = provider;
  // If switching away from Gemini, disable edit mode
  if (provider !== 'gemini' && generationMode.value === 'edit') {
    console.log('Disabling edit mode due to provider change');
    generationMode.value = 'generate';
  }
};

const onApiKeyChanged = (_apiKey: string) => {
  // API key changes are handled in the ApiConfig component
  console.log('API Key updated for provider:', selectedProvider.value);
};

const onModelChanged = (model: string) => {
  console.log('Model changed to:', model);
};

const onModeChanged = (mode: 'generate' | 'edit') => {
  generationMode.value = mode;
  if (mode !== 'edit') {
    uploadedImage.value = '';
  }
};

const onImageUploaded = (base64: string | undefined) => {
  uploadedImage.value = base64 || '';
};

const onPromptChanged = (newPrompt: string) => {
  prompt.value = newPrompt;
};

const onConfigChanged = (config: typeof generationConfig.value) => {
  generationConfig.value = config;
};

const onGenerate = async () => {
  if (!canGenerate.value) return;

  isGenerating.value = true;
  error.value = null;

  try {
    const request: GenerateRequest = {
      prompt: prompt.value,
      aspectRatio: generationConfig.value.aspectRatio,
      numberOfImages: generationConfig.value.imageCount,
      style: generationConfig.value.style,
      editMode: generationMode.value === 'edit',
      inputImage: generationMode.value === 'edit' ? uploadedImage.value : undefined
    };

    // Simulate API call - in real implementation, use the provider manager
    await simulateGeneration(request);
    
  } catch (err) {
    error.value = err instanceof Error ? err.message : '生成失败，请稍后重试';
  } finally {
    isGenerating.value = false;
  }
};

const simulateGeneration = async (request: GenerateRequest): Promise<void> => {
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Simulate error for demo
  if (Math.random() < 0.3) {
    throw new Error('模拟 API 错误 - 请在实际项目中实现 API 调用');
  }
  
  // Generate placeholder URLs
  const count = request.numberOfImages;
  const newImages: string[] = [];
  
  for (let i = 0; i < count; i++) {
    // Using placeholder service for demo
    newImages.push(`https://picsum.photos/512/512?random=${Date.now()}-${i}`);
  }
  
  generatedImages.value = newImages;
};

const onClear = () => {
  generatedImages.value = [];
  error.value = null;
};

const onDownloadImage = async (url: string, filename: string) => {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const downloadUrl = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(downloadUrl);
  } catch (err) {
    console.error('Download failed:', err);
  }
};

const onCopyImageUrl = async (url: string) => {
  try {
    await navigator.clipboard.writeText(url);
    // Show success feedback (could use a toast notification)
    console.log('Image URL copied to clipboard');
  } catch (err) {
    console.error('Copy failed:', err);
  }
};

onMounted(() => {
  // Initialize any needed setup
});
</script>

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
  text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
}

.header p {
  font-size: 1.1rem;
  opacity: 0.9;
  margin: 0;
}

.generator-content {
  background: rgba(255, 255, 255, 0.95);
  border-radius: 20px;
  padding: 32px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(10px);
}

.generate-section {
  display: flex;
  gap: 16px;
  justify-content: center;
  align-items: center;
  margin: 32px 0;
  flex-wrap: wrap;
}

.generate-btn {
  background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
  color: white;
  border: none;
  padding: 16px 32px;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 160px;
  justify-content: center;
}

.generate-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 10px 20px rgba(59, 130, 246, 0.3);
}

.generate-btn:disabled {
  background: #9ca3af;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.clear-btn {
  background: #ef4444;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.clear-btn:hover {
  background: #dc2626;
  transform: translateY(-1px);
}

.loading-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top: 2px solid white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

@media (max-width: 768px) {
  .header h1 {
    font-size: 2rem;
  }
  
  .generator-content {
    padding: 20px;
    margin: 0 10px;
  }
  
  .generate-section {
    flex-direction: column;
    align-items: center;
  }
  
  .generate-btn,
  .clear-btn {
    width: 100%;
    max-width: 300px;
  }
  
  .container {
    padding: 0 10px;
  }
}
</style>