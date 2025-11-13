<script setup lang="ts">
import { ref, watch, computed, type PropType } from 'vue'
import type { Emoji } from '@/types/emoji'
import { useEmojiStore } from '@/stores/emojiStore'
import { generateBatchNames } from '@/utils/geminiService'

const props = defineProps({
  visible: {
    type: Boolean,
    required: true,
  },
  selectedEmojis: {
    type: Array as PropType<Emoji[]>,
    required: true,
  },
})

const emit = defineEmits(['close', 'apply'])

const emojiStore = useEmojiStore()
const prompt = ref('')
const language = ref(emojiStore.settings.geminiLanguage || 'en')
const newNames = ref<Record<string, string>>({})
const isLoading = ref(false)
const error = ref<string | null>(null)

const geminiConfig = computed(() => ({
  apiKey: emojiStore.settings.geminiApiKey,
  model: emojiStore.settings.geminiModel,
}))

watch(
  () => props.visible,
  (isVisible) => {
    if (isVisible) {
      // Reset state when modal becomes visible
      prompt.value = ''
      newNames.value = {}
      isLoading.value = false
      error.value = null
      language.value = emojiStore.settings.geminiLanguage || 'en'
    }
  }
)

const handleGenerateNames = async () => {
  if (!geminiConfig.value.apiKey) {
    error.value = 'Gemini API Key is not configured in the settings.'
    return
  }

  isLoading.value = true
  error.value = null
  newNames.value = {}

  try {
    const results = await generateBatchNames(props.selectedEmojis, prompt.value, {
      ...geminiConfig.value,
      language: language.value,
    })
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
  disabled: Object.keys(newNames.value).length === 0,
}))
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
      </div>
      <div>
        <p class="font-semibold">目标语言:</p>
        <a-select v-model:value="language" style="width: 120px">
          <a-select-option value="en">English</a-select-option>
          <a-select-option value="zh-CN">简体中文</a-select-option>
          <a-select-option value="ja">日本語</a-select-option>
          <a-select-option value="ko">한국어</a-select-option>
        </a-select>
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
                  <img :src="emoji.url" class="w-10 h-10 object-contain" />
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
