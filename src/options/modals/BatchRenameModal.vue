<script setup lang="ts">
import { ref, watch, computed, type PropType, onMounted, onUnmounted } from 'vue'

import type { Emoji } from '@/types/emoji'
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
const newNames = ref<Record<string, string>>({})
const isLoading = ref(false)
const error = ref<string | null>(null)

// Lazy loading state
const loadedImages = ref<Set<string>>(new Set())
let imageObserver: IntersectionObserver | null = null

const geminiConfig = computed(() => ({
  apiKey: emojiStore.settings.geminiApiKey,
  model: emojiStore.settings.geminiModel,
  language: emojiStore.settings.geminiLanguage || 'Chinese',
  useCustomOpenAI: emojiStore.settings.useCustomOpenAI,
  customOpenAIEndpoint: emojiStore.settings.customOpenAIEndpoint,
  customOpenAIKey: emojiStore.settings.customOpenAIKey,
  customOpenAIModel: emojiStore.settings.customOpenAIModel
}))

watch(
  () => props.visible,
  isVisible => {
    if (isVisible) {
      // Reset state when modal becomes visible
      prompt.value = ''
      newNames.value = {}
      isLoading.value = false
      error.value = null
      loadedImages.value.clear()
      setupImageObserver()
    } else {
      cleanupImageObserver()
    }
  }
)

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
  newNames.value = {}

  try {
    const results = await generateBatchNames(props.selectedEmojis, prompt.value, config)
    newNames.value = results
  } catch (e: any) {
    error.value = `Failed to generate names: ${e.message}`
  } finally {
    isLoading.value = false
  }
}

const handleApply = () => {
  emit('apply', newNames.value)
}

const okButtonProps = computed(() => ({
  disabled: Object.keys(newNames.value).length === 0
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

const observeImage = (el: HTMLImageElement | null) => {
  if (el && imageObserver) {
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
    width="800px"
    @cancel="$emit('close')"
    @ok="handleApply"
    :ok-button-props="okButtonProps"
    ok-text="应用"
  >
    <div class="space-y-4">
      <a-alert v-if="error" :message="error" type="error" show-icon />

      <div>
        <p class="font-semibold">命名提示:</p>
        <a-textarea
          v-model:value="prompt"
          placeholder="例如：给这些表情加上'搞笑'前缀，或者'根据图片内容生成描述性名称'"
          :rows="2"
        />
        <p class="text-xs text-gray-500 mt-1">
          语言设置已移至 设置 → AI 设置
        </p>
      </div>
      <a-button type="primary" @click="handleGenerateNames" :loading="isLoading">
        {{ isLoading ? '生成中...' : '生成预览' }}
      </a-button>

      <div v-if="isLoading" class="text-center p-4">
        <a-spin />
        <p class="text-gray-500 mt-2">正在调用 AI 生成名称，请稍候...</p>
      </div>

      <div v-if="!isLoading && Object.keys(newNames).length > 0">
        <h3 class="font-semibold mb-2">名称预览:</h3>
        <div class="max-h-60 overflow-y-auto border rounded-lg">
          <table class="w-full text-sm">
            <thead class="bg-gray-50 dark:bg-gray-700">
              <tr class="text-left">
                <th class="p-2 w-16">表情</th>
                <th class="p-2">原名称</th>
                <th class="p-2">新名称</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="emoji in selectedEmojis"
                :key="emoji.id"
                class="border-b dark:border-gray-600"
              >
                <td class="p-2">
                  <img
                    :data-src="emoji.url"
                    :src="loadedImages.has(emoji.url) ? emoji.url : ''"
                    class="w-10 h-10 object-contain bg-gray-100"
                    loading="lazy"
                    :ref="observeImage"
                    alt="emoji"
                  />
                </td>
                <td class="p-2">{{ emoji.name }}</td>
                <td class="p-2 text-green-600 font-medium">
                  {{ newNames[emoji.id] || '未生成' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </a-modal>
</template>
