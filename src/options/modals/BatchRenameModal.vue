<script setup lang="ts">
import { ref, watch, computed, type PropType, onMounted, onUnmounted } from 'vue'
import { CheckOutlined, CloseOutlined, ReloadOutlined } from '@ant-design/icons-vue'

import type { Emoji } from '@/types/type'
import { useEmojiStore } from '@/stores/emojiStore'
import { generateBatchNames } from '@/utils/geminiService'

const props = defineProps({
  visible: {
    type: Boolean,
    required: true
  },
  selectedEmojis: {
    type: Array as PropType<Emoji[]>,
    required: true
  }
})

const emit = defineEmits(['close', 'apply'])

const emojiStore = useEmojiStore()
const prompt = ref('')

// Enhanced state for streaming and multiple candidates
interface EmojiRenameState {
  originalName: string
  candidates: string[]
  selectedIndex: number
  status: 'pending' | 'processing' | 'completed' | 'rejected'
  isGenerating: boolean
}

const renameStates = ref<Record<string, EmojiRenameState>>({})
const isLoading = ref(false)
const error = ref<string | null>(null)
const currentProcessingIndex = ref(0)
const totalEmojis = computed(() => props.selectedEmojis.length)

// Lazy loading state
const loadedImages = ref<Set<string>>(new Set())
let imageObserver: IntersectionObserver | null = null

// Progress tracking
const progress = computed(() => {
  if (totalEmojis.value === 0) return 0
  return Math.round((currentProcessingIndex.value / totalEmojis.value) * 100)
})

const processedCount = computed(() => {
  return Object.values(renameStates.value).filter(
    state => state.status === 'completed' || state.status === 'rejected'
  ).length
})

const acceptedCount = computed(() => {
  return Object.values(renameStates.value).filter(state => state.status === 'completed').length
})

const rejectedCount = computed(() => {
  return Object.values(renameStates.value).filter(state => state.status === 'rejected').length
})

const geminiConfig = computed(() => ({
  apiKey: emojiStore.settings.geminiApiKey || '',
  model: emojiStore.settings.geminiModel || 'gemini-2.0-flash-exp',
  language: emojiStore.settings.geminiLanguage || 'Chinese',
  useCustomOpenAI: emojiStore.settings.useCustomOpenAI || false,
  customOpenAIEndpoint: emojiStore.settings.customOpenAIEndpoint || '',
  customOpenAIKey: emojiStore.settings.customOpenAIKey || '',
  customOpenAIModel: emojiStore.settings.customOpenAIModel || ''
}))

// Initialize rename states
const initializeStates = () => {
  renameStates.value = {}
  props.selectedEmojis.forEach(emoji => {
    renameStates.value[emoji.id] = {
      originalName: emoji.name,
      candidates: [],
      selectedIndex: 0,
      status: 'pending',
      isGenerating: false
    }
  })
  currentProcessingIndex.value = 0
}

watch(
  () => props.visible,
  isVisible => {
    if (isVisible) {
      // Reset state when modal becomes visible
      prompt.value = ''
      isLoading.value = false
      error.value = null
      loadedImages.value.clear()
      initializeStates()
      setupImageObserver()
    } else {
      cleanupImageObserver()
    }
  }
)

// Generate names with streaming effect
const handleGenerateNames = async () => {
  const config = geminiConfig.value

  // Check if we have the necessary API keys
  if (config.useCustomOpenAI) {
    if (!config.customOpenAIKey || !config.customOpenAIEndpoint) {
      error.value = 'Custom OpenAI API configuration is incomplete. Please check settings.'
      return
    }
  } else {
    if (!config.apiKey) {
      error.value = 'Gemini API Key is not configured in the settings.'
      return
    }
  }

  isLoading.value = true
  error.value = null
  currentProcessingIndex.value = 0
  initializeStates()

  try {
    // Process emojis in batches with streaming effect
    const concurrency = 3 // Process 3 at a time for streaming effect
    
    for (let i = 0; i < props.selectedEmojis.length; i += concurrency) {
      const batch = props.selectedEmojis.slice(i, Math.min(i + concurrency, props.selectedEmojis.length))
      
      // Mark batch as processing
      batch.forEach(emoji => {
        renameStates.value[emoji.id].status = 'processing'
        renameStates.value[emoji.id].isGenerating = true
      })

      // Generate names for batch
      const results = await generateBatchNames(batch, prompt.value, config)
      
      // Update states with results (simulate multiple candidates by generating variations)
      for (const emoji of batch) {
        const baseName = results[emoji.id]
        if (baseName) {
          // Generate 3 candidate variations
          const candidates = [
            baseName,
            baseName + ' ✨',
            baseName.replace(/\s+/g, '_')
          ]
          
          renameStates.value[emoji.id].candidates = candidates
          renameStates.value[emoji.id].status = 'completed'
        } else {
          renameStates.value[emoji.id].status = 'pending'
        }
        renameStates.value[emoji.id].isGenerating = false
        currentProcessingIndex.value++
      }

      // Add small delay for visual streaming effect
      if (i + concurrency < props.selectedEmojis.length) {
        await new Promise(resolve => setTimeout(resolve, 200))
      }
    }
  } catch (e: any) {
    error.value = `Failed to generate names: ${e.message}`
  } finally {
    isLoading.value = false
  }
}

// Candidate selection
const selectCandidate = (emojiId: string, index: number) => {
  if (renameStates.value[emojiId]) {
    renameStates.value[emojiId].selectedIndex = index
  }
}

// Accept/Reject actions
const acceptRename = (emojiId: string) => {
  if (renameStates.value[emojiId]) {
    renameStates.value[emojiId].status = 'completed'
  }
}

const rejectRename = (emojiId: string) => {
  if (renameStates.value[emojiId]) {
    renameStates.value[emojiId].status = 'rejected'
  }
}

const regenerateForEmoji = async (emoji: Emoji) => {
  const config = geminiConfig.value
  const state = renameStates.value[emoji.id]
  if (!state) return

  state.isGenerating = true
  state.status = 'processing'

  try {
    const results = await generateBatchNames([emoji], prompt.value, config)
    const baseName = results[emoji.id]
    
    if (baseName) {
      state.candidates = [
        baseName,
        baseName + ' ✨',
        baseName.replace(/\s+/g, '_')
      ]
      state.selectedIndex = 0
      state.status = 'completed'
    }
  } catch (e) {
    console.error('Regenerate failed:', e)
  } finally {
    state.isGenerating = false
  }
}

const handleApply = () => {
  const finalNames: Record<string, string> = {}
  
  Object.entries(renameStates.value).forEach(([emojiId, state]) => {
    if (state.status === 'completed' && state.candidates.length > 0) {
      finalNames[emojiId] = state.candidates[state.selectedIndex]
    }
  })
  
  emit('apply', finalNames)
}

const okButtonProps = computed(() => ({
  disabled: acceptedCount.value === 0
}))

// Setup Intersection Observer for lazy loading images
const setupImageObserver = () => {
  if (typeof IntersectionObserver === 'undefined') return

  imageObserver = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target as HTMLImageElement
          const src = img.dataset.src
          if (src && !loadedImages.value.has(src)) {
            img.src = src
            loadedImages.value.add(src)
            imageObserver?.unobserve(img)
          }
        }
      })
    },
    {
      rootMargin: '50px'
    }
  )
}

const cleanupImageObserver = () => {
  if (imageObserver) {
    imageObserver.disconnect()
    imageObserver = null
  }
}

const observeImage = (el: any) => {
  if (el instanceof HTMLImageElement && imageObserver) {
    imageObserver.observe(el)
  }
}

onMounted(() => {
  if (props.visible) {
    setupImageObserver()
  }
})

onUnmounted(() => {
  cleanupImageObserver()
})
</script>

<template>
  <a-modal
    :open="visible"
    title="AI 批量重命名"
    width="900px"
    @cancel="$emit('close')"
    @ok="handleApply"
    :ok-button-props="okButtonProps"
    ok-text="应用选中的重命名"
  >
    <div class="space-y-4">
      <a-alert v-if="error" :message="error" type="error" show-icon closable @close="error = null" />

      <div>
        <p class="font-semibold mb-2">命名提示：</p>
        <a-textarea
          v-model:value="prompt"
          placeholder="例如：给这些表情加上'搞笑'前缀，或者'根据图片内容生成描述性名称'"
          :rows="2"
          :disabled="isLoading"
        />
        <p class="text-xs text-gray-500 mt-1">语言设置已移至 设置 → AI 设置</p>
      </div>
      
      <div class="flex items-center justify-between">
        <a-button 
          type="primary" 
          @click="handleGenerateNames" 
          :loading="isLoading"
          :disabled="isLoading || !prompt"
        >
          {{ isLoading ? '生成中...' : '开始生成' }}
        </a-button>

        <div v-if="processedCount > 0" class="text-sm text-gray-600">
          <span class="text-green-600 font-medium">✓ {{ acceptedCount }}</span> 已接受 · 
          <span class="text-red-600 font-medium">✗ {{ rejectedCount }}</span> 已拒绝 · 
          <span class="text-gray-500">{{ totalEmojis - processedCount }}</span> 待处理
        </div>
      </div>

      <!-- Progress Bar -->
      <div v-if="isLoading || processedCount > 0" class="space-y-2">
        <div class="flex items-center justify-between text-sm">
          <span class="text-gray-600">
            处理进度：{{ currentProcessingIndex }} / {{ totalEmojis }}
          </span>
          <span class="text-gray-600">{{ progress }}%</span>
        </div>
        <a-progress 
          :percent="progress" 
          :status="isLoading ? 'active' : 'success'"
          :stroke-color="{
            '0%': '#108ee9',
            '100%': '#87d068',
          }"
        />
      </div>

      <!-- Results List with Streaming -->
      <div v-if="Object.keys(renameStates).length > 0" class="space-y-3">
        <h3 class="font-semibold">重命名预览：</h3>
        <div class="max-h-96 overflow-y-auto space-y-2 pr-2">
          <div
            v-for="emoji in selectedEmojis"
            :key="emoji.id"
            class="border rounded-lg p-3 transition-all"
            :class="{
              'bg-green-50 border-green-200': renameStates[emoji.id]?.status === 'completed',
              'bg-red-50 border-red-200': renameStates[emoji.id]?.status === 'rejected',
              'bg-blue-50 border-blue-200': renameStates[emoji.id]?.status === 'processing',
              'bg-gray-50 border-gray-200': renameStates[emoji.id]?.status === 'pending'
            }"
          >
            <div class="flex items-start gap-3">
              <!-- Emoji Preview -->
              <div class="flex-shrink-0">
                <img
                  :data-src="emoji.url"
                  :src="loadedImages.has(emoji.url) ? emoji.url : ''"
                  class="w-12 h-12 object-contain bg-white rounded"
                  loading="lazy"
                  :ref="observeImage"
                  alt="emoji"
                />
              </div>

              <!-- Content -->
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-2">
                  <span class="text-sm text-gray-600">原名称：</span>
                  <span class="font-medium">{{ emoji.name }}</span>
                </div>

                <!-- Loading State -->
                <div v-if="renameStates[emoji.id]?.isGenerating" class="flex items-center gap-2">
                  <a-spin size="small" />
                  <span class="text-sm text-gray-500">正在生成候选名称...</span>
                </div>

                <!-- Candidates -->
                <div v-else-if="renameStates[emoji.id]?.candidates.length > 0" class="space-y-2">
                  <div class="text-sm text-gray-600 mb-1">候选名称 (点击选择):</div>
                  <div class="flex flex-wrap gap-2">
                    <a-tag
                      v-for="(candidate, index) in renameStates[emoji.id].candidates"
                      :key="index"
                      :color="renameStates[emoji.id].selectedIndex === index ? 'blue' : 'default'"
                      class="cursor-pointer px-3 py-1 text-sm"
                      @click="selectCandidate(emoji.id, index)"
                    >
                      {{ candidate }}
                    </a-tag>
                  </div>
                </div>

                <!-- Pending State -->
                <div v-else-if="renameStates[emoji.id]?.status === 'pending'" class="text-sm text-gray-400">
                  等待生成...
                </div>
              </div>

              <!-- Actions -->
              <div class="flex-shrink-0 flex gap-1">
                <a-tooltip title="接受重命名">
                  <a-button
                    v-if="renameStates[emoji.id]?.status !== 'completed'"
                    type="text"
                    size="small"
                    :disabled="!renameStates[emoji.id]?.candidates.length || renameStates[emoji.id]?.isGenerating"
                    @click="acceptRename(emoji.id)"
                  >
                    <template #icon>
                      <CheckOutlined class="text-green-600" />
                    </template>
                  </a-button>
                </a-tooltip>

                <a-tooltip title="拒绝重命名">
                  <a-button
                    v-if="renameStates[emoji.id]?.status !== 'rejected'"
                    type="text"
                    size="small"
                    :disabled="renameStates[emoji.id]?.isGenerating"
                    @click="rejectRename(emoji.id)"
                  >
                    <template #icon>
                      <CloseOutlined class="text-red-600" />
                    </template>
                  </a-button>
                </a-tooltip>

                <a-tooltip title="重新生成">
                  <a-button
                    type="text"
                    size="small"
                    :loading="renameStates[emoji.id]?.isGenerating"
                    :disabled="isLoading"
                    @click="regenerateForEmoji(emoji)"
                  >
                    <template #icon>
                      <ReloadOutlined />
                    </template>
                  </a-button>
                </a-tooltip>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else class="text-center py-8 text-gray-400">
        <p>输入命名提示后点击"开始生成"来为选中的表情生成新名称</p>
      </div>
    </div>
  </a-modal>
</template>
