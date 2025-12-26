<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { TagOutlined, PlusOutlined, CloseOutlined, RobotOutlined } from '@ant-design/icons-vue'

import { useEmojiStore } from '@/stores/emojiStore'
import type { Emoji } from '@/types/type'

interface Props {
  show: boolean
  emoji: Emoji
}

const props = defineProps<Props>()
const emit = defineEmits<{
  close: []
  'update:show': [value: boolean]
}>()

const emojiStore = useEmojiStore()
const newTag = ref('')
const showTagSuggestions = ref(false)
const showAISuggestions = ref(false)
const aiSuggestions = ref<string[]>([])

// Helper to hide tag suggestions with delay
const hideTagSuggestionsDelayed = () => {
  setTimeout(() => (showTagSuggestions.value = false), 200)
}

// 當前表情的標籤
const currentTags = ref<string[]>([])

// 建議標籤（來自熱門標籤但不在當前標籤中）
const suggestedTags = computed(() => {
  const popularTags = emojiStore.allTags.map(t => t.name).slice(0, 10)
  return popularTags.filter(tag => !currentTags.value.includes(tag))
})

// 監聽 emoji 變化
watch(
  () => props.emoji,
  newEmoji => {
    if (newEmoji) {
      currentTags.value = [...(newEmoji.tags || [])]
    }
  },
  { immediate: true }
)

// 添加新標籤
const addTag = () => {
  const trimmedTag = newTag.value.trim()
  if (trimmedTag && !currentTags.value.includes(trimmedTag)) {
    currentTags.value.push(trimmedTag)
    emojiStore.setEmojiTags(props.emoji.id, currentTags.value)
    newTag.value = ''
    showTagSuggestions.value = false
  }
}

// 添加建議標籤
const addSuggestedTag = (tag: string) => {
  currentTags.value.push(tag)
  emojiStore.setEmojiTags(props.emoji.id, currentTags.value)
}

// 移除標籤
const removeTag = (tag: string) => {
  const index = currentTags.value.indexOf(tag)
  if (index !== -1) {
    currentTags.value.splice(index, 1)
    emojiStore.setEmojiTags(props.emoji.id, currentTags.value)
  }
}

// 處理標籤輸入框回車
const handleTagInputEnter = (e: KeyboardEvent) => {
  e.preventDefault()
  addTag()
}

// AI 智能標籤建議
const generateAISuggestions = async () => {
  if (!props.emoji.url) return

  showAISuggestions.value = true
  aiSuggestions.value = []

  // 模擬 AI 生成標籤（實際應用中可以調用 AI API）
  const mockAISuggestions = [
    '表情',
    '可愛',
    '有趣',
    '搞笑',
    '萌',
    '動漫',
    '卡通',
    '人物',
    '動物',
    '食物',
    '情感',
    '心情',
    '反應',
    '日常',
    '網路'
  ]

  // 根據表情名稱生成相關標籤
  const emojiName = props.emoji.name.toLowerCase()
  const contextualTags = []

  if (emojiName.includes('cat') || emojiName.includes('貓')) contextualTags.push('貓', '動物')
  if (emojiName.includes('dog') || emojiName.includes('狗')) contextualTags.push('狗', '動物')
  if (emojiName.includes('happy') || emojiName.includes('開心')) contextualTags.push('開心', '快樂')
  if (emojiName.includes('sad') || emojiName.includes('難過')) contextualTags.push('難過', '情緒')
  if (emojiName.includes('angry') || emojiName.includes('生氣')) contextualTags.push('生氣', '憤怒')
  if (emojiName.includes('love') || emojiName.includes('愛')) contextualTags.push('愛', '心')
  if (emojiName.includes('lol') || emojiName.includes('笑')) contextualTags.push('笑', '搞笑')

  // 合併建議標籤
  const allSuggestions = [...contextualTags, ...mockAISuggestions]
  const filtered = allSuggestions.filter(tag => !currentTags.value.includes(tag))
  const shuffled = filtered.sort(() => 0.5 - Math.random())

  // 模擬異步延遲
  setTimeout(() => {
    aiSuggestions.value = shuffled.slice(0, 5)
  }, 500)
}

// 添加 AI 建議標籤
const addAISuggestedTag = (tag: string) => {
  currentTags.value.push(tag)
  emojiStore.setEmojiTags(props.emoji.id, currentTags.value)
}

// 關閉編輯器
const closeEditor = () => {
  emit('close')
  emit('update:show', false)
}

// 監聽 visible 變化，清空輸入
watch(
  () => props.show,
  newVal => {
    if (newVal) {
      newTag.value = ''
      showTagSuggestions.value = false
      showAISuggestions.value = false
    }
  }
)
</script>

<template>
  <div v-if="show" class="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
    <div class="fixed inset-0 bg-gray-500 bg-opacity-75" @click="closeEditor"></div>

    <div class="flex items-center justify-center min-h-screen p-4">
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6 relative">
        <!-- 標題 -->
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          <TagOutlined class="mr-2" />
          編輯標籤 - {{ emoji.name }}
        </h3>

        <!-- 當前標籤顯示 -->
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 dark:text-white mb-2">
            當前標籤
          </label>
          <div v-if="currentTags.length > 0" class="flex flex-wrap gap-2">
            <span
              v-for="tag in currentTags"
              :key="tag"
              class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
            >
              {{ tag }}
              <button
                type="button"
                @click="removeTag(tag)"
                class="ml-1 text-blue-600 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-100"
                title="移除標籤"
              >
                <CloseOutlined class="text-xs" />
              </button>
            </span>
          </div>
          <div v-else class="text-gray-500 dark:text-gray-400 text-sm">暫無標籤</div>
        </div>

        <!-- 添加新標籤 -->
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 dark:text-white mb-2">
            添加新標籤
          </label>
          <div class="relative">
            <div class="flex gap-2">
              <input
                v-model="newTag"
                type="text"
                class="flex-1 border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-black dark:text-white dark:border-gray-600"
                placeholder="輸入新標籤..."
                @focus="showTagSuggestions = true"
                @blur="hideTagSuggestionsDelayed"
                @keydown.enter="handleTagInputEnter"
              />
              <button
                type="button"
                @click="addTag"
                :disabled="!newTag.trim()"
                class="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <PlusOutlined />
              </button>
            </div>

            <!-- 建議標籤下拉 -->
            <div
              v-if="showTagSuggestions && suggestedTags.length > 0"
              class="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-40 overflow-y-auto"
            >
              <div class="p-2">
                <div class="text-xs text-gray-500 dark:text-gray-400 mb-2">熱門標籤：</div>
                <div class="flex flex-wrap gap-2">
                  <button
                    v-for="tag in suggestedTags"
                    :key="tag"
                    type="button"
                    @click="addSuggestedTag(tag)"
                    class="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                  >
                    {{ tag }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- AI 智能建議 -->
        <div class="mb-6">
          <div class="flex items-center justify-between mb-2">
            <label class="text-sm font-medium text-gray-700 dark:text-white">AI 智能建議</label>
            <button
              type="button"
              @click="generateAISuggestions"
              class="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1"
            >
              <RobotOutlined />
              生成建議
            </button>
          </div>

          <div v-if="showAISuggestions && aiSuggestions.length > 0" class="flex flex-wrap gap-2">
            <button
              v-for="tag in aiSuggestions"
              :key="tag"
              type="button"
              @click="addAISuggestedTag(tag)"
              class="px-3 py-1 text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded-full hover:bg-green-200 dark:hover:bg-green-800"
            >
              {{ tag }}
              <PlusOutlined class="text-xs ml-1" />
            </button>
          </div>
          <div v-else-if="showAISuggestions" class="text-gray-500 dark:text-gray-400 text-sm">
            正在生成 AI 建議...
          </div>
        </div>

        <!-- 關閉按鈕 -->
        <div class="flex justify-end">
          <button
            type="button"
            @click="closeEditor"
            class="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
          >
            完成
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 添加過渡動畫 */
.fixed {
  transition: all 0.2s ease-in-out;
}

.bg-gray-500 {
  transition: opacity 0.2s ease-in-out;
}
</style>
