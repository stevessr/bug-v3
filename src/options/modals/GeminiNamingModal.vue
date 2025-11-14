<script setup lang="ts">
import { ref, computed } from 'vue'
import { LoadingOutlined } from '@ant-design/icons-vue'
import { watch } from 'vue'

import { analyzeImageForNaming, type ImageAnalysisResult } from '@/utils/geminiService'
import { useEmojiStore } from '@/stores/emojiStore'

const props = defineProps<{
  show: boolean
  imageUrl: string
}>()

const emits = defineEmits<{
  'update:show': [value: boolean]
  nameSelected: [name: string, analysis: ImageAnalysisResult]
}>()

const emojiStore = useEmojiStore()

const isAnalyzing = ref(false)
const error = ref<string>('')
const analysis = ref<ImageAnalysisResult | null>(null)
const selectedName = ref<string>('')
const customName = ref<string>('')

const language = computed(() => {
  return emojiStore.settings.geminiLanguage || 'Chinese'
})

const hasApiKey = computed(() => {
  return !!emojiStore.settings.geminiApiKey
})

const suggestedNames = computed(() => {
  return analysis.value?.suggestedNames || []
})

const analyzeImage = async () => {
  if (!hasApiKey.value) {
    error.value = '请先在设置中配置 Gemini API Key'
    return
  }

  if (!props.imageUrl) {
    error.value = '没有可分析的图片'
    return
  }

  isAnalyzing.value = true
  error.value = ''
  analysis.value = null
  selectedName.value = ''
  customName.value = ''

  try {
    const result = await analyzeImageForNaming(props.imageUrl, {
      apiKey: emojiStore.settings.geminiApiKey!,
      language: language.value,
      model: emojiStore.settings.geminiModel,
      useCustomOpenAI: emojiStore.settings.useCustomOpenAI,
      customOpenAIEndpoint: emojiStore.settings.customOpenAIEndpoint,
      customOpenAIKey: emojiStore.settings.customOpenAIKey,
      customOpenAIModel: emojiStore.settings.customOpenAIModel
    })

    analysis.value = result

    // Auto-select first suggestion
    if (result.suggestedNames.length > 0) {
      selectedName.value = result.suggestedNames[0]
    }
  } catch (err: any) {
    error.value = err.message || '分析图片时出错'
    console.error('Error analyzing image:', err)
  } finally {
    isAnalyzing.value = false
  }
}

const selectName = (name: string) => {
  selectedName.value = name
  customName.value = '' // Clear custom name when selecting a suggested name
}

const handleConfirm = () => {
  const finalName = customName.value.trim() || selectedName.value
  if (!finalName) {
    error.value = '请选择或输入一个名称'
    return
  }

  if (analysis.value) {
    emits('nameSelected', finalName, analysis.value)
  }
  handleCancel()
}

const handleCancel = () => {
  emits('update:show', false)
  // Reset state
  setTimeout(() => {
    isAnalyzing.value = false
    error.value = ''
    analysis.value = null
    selectedName.value = ''
    customName.value = ''
  }, 300)
}

// Auto-analyze when modal opens
watch(
  () => props.show,
  newShow => {
    if (newShow && hasApiKey.value) {
      // Delay slightly to ensure modal is visible
      setTimeout(() => {
        analyzeImage()
      }, 100)
    }
  }
)
</script>

<template>
  <a-modal :open="show" title="AI 智能命名" :footer="null" @cancel="handleCancel" width="600px">
    <div class="space-y-4">
      <!-- API Key Warning -->
      <div v-if="!hasApiKey" class="bg-yellow-50 border border-yellow-200 rounded p-3">
        <p class="text-sm text-yellow-800">
          ⚠️ 请先在设置页面配置 Gemini API Key 才能使用智能命名功能
        </p>
        <a href="#/settings" class="text-sm text-blue-600 hover:underline" @click="handleCancel">
          前往设置 →
        </a>
      </div>

      <!-- Image Preview -->
      <div class="flex justify-center">
        <img
          :src="imageUrl"
          alt="Preview"
          class="max-w-full max-h-48 rounded border border-gray-200"
        />
      </div>

      <!-- Loading State -->
      <div v-if="isAnalyzing" class="text-center py-8">
        <LoadingOutlined class="text-3xl text-blue-500 mb-2" />
        <p class="text-gray-600">AI 正在分析图片内容...</p>
      </div>

      <!-- Error Message -->
      <div v-if="error && !isAnalyzing" class="bg-red-50 border border-red-200 rounded p-3">
        <p class="text-sm text-red-800">{{ error }}</p>
        <a-button size="small" type="link" @click="analyzeImage">重试</a-button>
      </div>

      <!-- Analysis Results -->
      <div v-if="analysis && !isAnalyzing" class="space-y-4">
        <!-- Description -->
        <div v-if="analysis.description">
          <label class="block text-sm font-medium text-gray-700 mb-1">图片描述：</label>
          <p class="text-sm text-gray-600 bg-gray-50 p-2 rounded">{{ analysis.description }}</p>
        </div>

        <!-- Suggested Names -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">建议的名称：</label>
          <div class="grid grid-cols-2 gap-2">
            <button
              v-for="name in suggestedNames"
              :key="name"
              class="px-3 py-2 rounded border text-sm transition-colors"
              :class="[
                selectedName === name
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 bg-white hover:border-blue-300'
              ]"
              @click="selectName(name)"
            >
              {{ name }}
            </button>
          </div>
        </div>

        <!-- Tags -->
        <div v-if="analysis.tags && analysis.tags.length > 0">
          <label class="block text-sm font-medium text-gray-700 mb-1">标签：</label>
          <div class="flex flex-wrap gap-2">
            <span
              v-for="tag in analysis.tags"
              :key="tag"
              class="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs"
            >
              {{ tag }}
            </span>
          </div>
        </div>

        <!-- Custom Name Input -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">或者输入自定义名称：</label>
          <a-input
            v-model:value="customName"
            placeholder="输入自定义名称"
            @focus="selectedName = ''"
          />
        </div>

        <!-- Selected Name Preview -->
        <div
          v-if="selectedName || customName"
          class="bg-blue-50 border border-blue-200 rounded p-2"
        >
          <p class="text-sm text-blue-800">
            将使用名称：
            <strong>{{ customName || selectedName }}</strong>
          </p>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="flex justify-end gap-2 pt-4 border-t">
        <a-button @click="handleCancel">取消</a-button>
        <a-button v-if="!hasApiKey" type="primary" disabled>配置 API Key</a-button>
        <a-button v-else-if="!analysis && !isAnalyzing" type="primary" @click="analyzeImage">
          开始分析
        </a-button>
        <a-button
          v-else-if="analysis"
          type="primary"
          :disabled="!selectedName && !customName.trim()"
          @click="handleConfirm"
        >
          确认使用
        </a-button>
      </div>
    </div>
  </a-modal>
</template>
