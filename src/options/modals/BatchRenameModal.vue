<script setup lang="ts">
import { ref, watch, computed, type PropType } from 'vue'

import type { Emoji } from '@/types/type'
import { useEmojiStore } from '@/stores/emojiStore'
import { generateBatchNamesStreaming } from '@/utils/geminiService'
import { getEmojiImageUrlSync } from '@/utils/imageUrlHelper'
import VirtualList from '@/options/components/VirtualList.vue'

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
const excludedIds = ref(new Set<string>())
const isLoading = ref(false)
const error = ref<string | null>(null)
const progress = ref<{ current: number; total: number; groupIndex?: number }>({
  current: 0,
  total: 0,
  groupIndex: 0
})
const enableGroupedStreaming = ref(true)

// Virtual list ref - use any to avoid vue-tsc generic inference issues
const virtualListRef = ref<any>(null)

// Removed expensive emojiRenderList computed property


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
      excludedIds.value.clear()
      isLoading.value = false
      error.value = null
      progress.value = { current: 0, total: 0, groupIndex: 0 }
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
  progress.value = { current: 0, total: props.selectedEmojis.length, groupIndex: 0 }

  // Enable auto-scroll during generation
  if (virtualListRef.value) {
    virtualListRef.value.enableAutoScroll()
  }

  try {
    await generateBatchNamesStreaming(
      props.selectedEmojis,
      prompt.value,
      config as any,
      (chunkResults, progressInfo) => {
        // Update names in real-time with incremental updates
        // This avoids Vue reactivity triggering a full list re-render
        Object.assign(newNames.value, chunkResults)
        progress.value = progressInfo
      },
      5, // concurrency
      enableGroupedStreaming.value // group by groupId
    )
  } catch (e: any) {
    error.value = `Failed to generate names: ${e.message}`
  } finally {
    isLoading.value = false
    // Disable auto-scroll after generation
    if (virtualListRef.value) {
      virtualListRef.value.disableAutoScroll()
    }
  }
}

const toggleExclude = (id: string) => {
  if (excludedIds.value.has(id)) {
    excludedIds.value.delete(id)
  } else {
    excludedIds.value.add(id)
  }
}

const handleApply = () => {
  const finalNames: Record<string, string> = {}
  for (const [id, name] of Object.entries(newNames.value)) {
    if (!excludedIds.value.has(id)) {
      finalNames[id] = name
    }
  }
  emit('apply', finalNames)
}

const okButtonProps = computed(() => ({
  disabled: Object.keys(newNames.value).length === 0
}))

const progressPercentage = computed(() => {
  if (progress.value.total === 0) return 0
  return Math.round((progress.value.current / progress.value.total) * 100)
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
    ok-text="应用"
  >
    <div class="space-y-4">
      <a-alert v-if="error" :message="error" type="error" show-icon />

      <div>
        <p class="font-semibold">命名提示：</p>
        <a-textarea
          v-model:value="prompt"
          placeholder="例如：给这些表情加上'搞笑'前缀，或者'根据图片内容生成描述性名称'"
          :rows="2"
        />
        <p class="text-xs text-gray-500 mt-1">语言设置已移至 设置 → AI 设置</p>
      </div>

      <div class="flex items-center gap-4">
        <a-button type="primary" @click="handleGenerateNames" :loading="isLoading">
          {{ isLoading ? '生成中...' : '开始生成' }}
        </a-button>
        <a-checkbox v-model:checked="enableGroupedStreaming" :disabled="isLoading">
          按分组流式加载
        </a-checkbox>
        <span class="text-sm text-gray-600">已选择 {{ selectedEmojis.length }} 个表情</span>
      </div>

      <div v-if="isLoading" class="space-y-2">
        <a-progress :percent="progressPercentage" status="active" />
        <p class="text-center text-gray-500 text-sm">
          正在生成 ({{ progress.current }} / {{ progress.total }})
          <span v-if="enableGroupedStreaming && progress.groupIndex !== undefined">
            - 分组 {{ progress.groupIndex + 1 }}
          </span>
        </p>
      </div>

      <div
        v-if="Object.keys(newNames).length > 0 || isLoading"
        class="border rounded-lg overflow-hidden"
      >
        <div class="bg-gray-50 dark:bg-gray-700 px-4 py-2 border-b flex items-center">
          <h3 class="font-semibold flex-1">
            名称预览 ({{ Object.keys(newNames).length }} / {{ selectedEmojis.length }})
          </h3>
          <span class="text-xs text-gray-500">虚拟滚动优化</span>
        </div>

        <VirtualList
          ref="virtualListRef"
          :items="selectedEmojis"
          :item-height="60"
          :container-height="400"
          :buffer="5"
        >
          <template #default="{ item: emoji }">
            <div
              class="px-4 py-2 border-b dark:border-gray-600 flex items-center gap-3"
              :class="{ 'opacity-50': excludedIds.has(emoji.id) }"
            >
              <a-checkbox
                :checked="!excludedIds.has(emoji.id)"
                :disabled="!newNames[emoji.id]"
                @change="toggleExclude(emoji.id)"
              />
              <img
                :src="getEmojiImageUrlSync(emoji)"
                class="w-12 h-12 object-contain bg-gray-100 rounded"
                loading="lazy"
                alt="emoji"
              />
              <div class="flex-1 min-w-0">
                <div class="text-sm text-gray-600 dark:text-gray-400 truncate">
                  {{ emoji.name }}
                </div>
                <div
                  class="text-sm font-medium truncate"
                  :class="{
                    'text-green-600': !!newNames[emoji.id],
                    'text-gray-400 animate-pulse': !newNames[emoji.id] && isLoading,
                    'text-gray-400': !newNames[emoji.id] && !isLoading
                  }"
                >
                  {{ newNames[emoji.id] || '等待生成...' }}
                </div>
              </div>
            </div>
          </template>
        </VirtualList>
      </div>

      <div v-if="!isLoading && Object.keys(newNames).length === 0" class="text-center py-8">
        <p class="text-gray-500">点击"开始生成"按钮使用 AI 生成新名称</p>
      </div>
    </div>
  </a-modal>
</template>

<style scoped>
@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.animate-pulse {
  animation: pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
</style>
