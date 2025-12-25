<script setup lang="ts">
import { ref, computed, isRef, onMounted, type Ref } from 'vue'
import { ReloadOutlined, CheckOutlined } from '@ant-design/icons-vue'

import type { AppSettings } from '../../types/type'

import SettingSwitch from './SettingSwitch.vue'

// Discourse 表情数据结构
interface DiscourseEmoji {
  name: string
  tonable: boolean
  url: string
  group: string
  search_aliases?: string[]
}

interface DiscourseEmojisResponse {
  [group: string]: DiscourseEmoji[]
}

const props = defineProps<{ settings: AppSettings | Ref<AppSettings> }>()
const settings = props.settings as AppSettings | Ref<AppSettings>

const emit = defineEmits(['update:enableChatMultiReactor', 'update:chatMultiReactorEmojis'])

// 默认表情列表
const DEFAULT_EMOJI_LIST = [
  'wavy_dash',
  'distorted_face',
  'melting_face',
  'melon',
  'nerd_face',
  'face_savoring_food',
  'six',
  'five',
  'hug',
  'flushed_face',
  'pleading_face',
  'face_holding_back_tears',
  'disguised_face',
  'hot_face',
  'cold_face',
  'face_with_monocle',
  'clown_face',
  'poop'
]

// Discourse 站点 URL
const discourseUrl = ref('https://linux.do')

// 状态
const loading = ref(false)
const availableEmojis = ref<DiscourseEmoji[]>([])
const emojiGroups = ref<string[]>([])
const selectedGroup = ref<string>('all')
const searchQuery = ref('')
const errorMessage = ref('')

const getSetting = (key: keyof AppSettings, defaultValue: any = false) => {
  try {
    if (isRef(settings)) return (settings.value && settings.value[key]) ?? defaultValue
    return (settings && (settings as AppSettings)[key]) ?? defaultValue
  } catch {
    return defaultValue
  }
}

// 当前选中的表情列表
const selectedEmojis = computed(() => {
  const list = getSetting('chatMultiReactorEmojis', []) as string[]
  return Array.isArray(list) && list.length > 0 ? list : [...DEFAULT_EMOJI_LIST]
})

// 过滤后的可用表情
const filteredEmojis = computed(() => {
  let emojis = availableEmojis.value

  // 按分组过滤
  if (selectedGroup.value !== 'all') {
    emojis = emojis.filter(e => e.group === selectedGroup.value)
  }

  // 按搜索词过滤
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase().trim()
    emojis = emojis.filter(
      e =>
        e.name.toLowerCase().includes(query) ||
        e.search_aliases?.some(alias => alias.toLowerCase().includes(query))
    )
  }

  return emojis
})

// 从 Discourse 获取表情
const fetchEmojis = async () => {
  loading.value = true
  errorMessage.value = ''

  try {
    const url = `${discourseUrl.value}/emojis.json`
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json, text/javascript, */*; q=0.01',
        'X-Requested-With': 'XMLHttpRequest'
      },
      credentials: 'include'
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const data: DiscourseEmojisResponse = await response.json()

    // 扁平化表情列表
    const allEmojis: DiscourseEmoji[] = []
    const groups: string[] = []

    for (const [groupName, emojis] of Object.entries(data)) {
      groups.push(groupName)
      for (const emoji of emojis) {
        allEmojis.push({ ...emoji, group: groupName })
      }
    }

    availableEmojis.value = allEmojis
    emojiGroups.value = groups
    console.log(
      `[ChatMultiReactorSettings] Loaded ${allEmojis.length} emojis from ${groups.length} groups`
    )
  } catch (e) {
    console.error('[ChatMultiReactorSettings] Failed to fetch emojis:', e)
    errorMessage.value = `获取表情失败：${e instanceof Error ? e.message : String(e)}`
  } finally {
    loading.value = false
  }
}

// 添加表情到选中列表
const addEmoji = (emojiName: string) => {
  if (!selectedEmojis.value.includes(emojiName)) {
    emit('update:chatMultiReactorEmojis', [...selectedEmojis.value, emojiName])
  }
}

// 从选中列表移除表情
const removeEmoji = (emojiName: string) => {
  const newList = selectedEmojis.value.filter(e => e !== emojiName)
  emit('update:chatMultiReactorEmojis', newList)
}

// 检查表情是否已选中
const isSelected = (emojiName: string) => {
  return selectedEmojis.value.includes(emojiName)
}

// 切换表情选中状态
const toggleEmoji = (emojiName: string) => {
  if (isSelected(emojiName)) {
    removeEmoji(emojiName)
  } else {
    addEmoji(emojiName)
  }
}

// 重置为默认
const resetToDefault = () => {
  emit('update:chatMultiReactorEmojis', [...DEFAULT_EMOJI_LIST])
}

// 清空选中
const clearAll = () => {
  emit('update:chatMultiReactorEmojis', [])
}

// 获取表情 URL
const getEmojiUrl = (emojiName: string) => {
  const emoji = availableEmojis.value.find(e => e.name === emojiName)
  if (emoji?.url) {
    // 如果是相对 URL，补全为绝对 URL
    if (emoji.url.startsWith('/')) {
      return `${discourseUrl.value}${emoji.url}`
    }
    return emoji.url
  }
  // 回退到 Discourse 默认路径
  return `${discourseUrl.value}/images/emoji/twitter/${emojiName}.png`
}

// 组件挂载时尝试获取表情
onMounted(() => {
  // 如果启用了功能，自动获取表情
  if (getSetting('enableChatMultiReactor', false)) {
    fetchEmojis()
  }
})
</script>

<template>
  <div class="space-y-6">
    <!-- 功能开关 -->
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 p-6">
      <SettingSwitch
        :model-value="getSetting('enableChatMultiReactor', false)"
        @update:model-value="emit('update:enableChatMultiReactor', $event)"
        label="启用聊天多表情反应"
        description="在 Discourse 聊天消息旁添加按钮，一键发送多个表情反应"
      />
    </div>

    <!-- 表情配置（仅在启用时显示） -->
    <template v-if="getSetting('enableChatMultiReactor', false)">
      <!-- 当前选中的表情 -->
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700">
        <div
          class="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center"
        >
          <div>
            <h3 class="text-md font-semibold dark:text-white">已选表情</h3>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              点击发送按钮时将依次发送这些表情（共 {{ selectedEmojis.length }} 个）
            </p>
          </div>
          <div class="flex gap-2">
            <a-button size="small" @click="resetToDefault">重置默认</a-button>
            <a-button size="small" danger @click="clearAll">清空</a-button>
          </div>
        </div>
        <div class="p-4">
          <div v-if="selectedEmojis.length === 0" class="text-center text-gray-500 py-4">
            暂无选中的表情，请从下方列表添加
          </div>
          <div v-else class="flex flex-wrap gap-2">
            <a-tag
              v-for="(emoji, index) in selectedEmojis"
              :key="emoji"
              closable
              @close="removeEmoji(emoji)"
              class="flex items-center gap-1 px-2 py-1"
            >
              <span class="text-gray-500 text-xs mr-1">{{ index + 1 }}.</span>
              <img
                :src="getEmojiUrl(emoji)"
                :alt="emoji"
                class="w-5 h-5"
                @error="($event.target as HTMLImageElement).style.display = 'none'"
              />
              <span class="text-sm">{{ emoji }}</span>
            </a-tag>
          </div>
        </div>
      </div>

      <!-- 从 Discourse 获取表情 -->
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700">
        <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div class="flex justify-between items-center">
            <div>
              <h3 class="text-md font-semibold dark:text-white">可用表情</h3>
              <p class="text-sm text-gray-500 dark:text-gray-400">
                从 Discourse 站点获取可用表情列表
              </p>
            </div>
            <div class="flex gap-2 items-center">
              <a-input
                v-model:value="discourseUrl"
                placeholder="Discourse URL"
                style="width: 200px"
                size="small"
              />
              <a-button type="primary" size="small" :loading="loading" @click="fetchEmojis">
                <template #icon><ReloadOutlined /></template>
                获取表情
              </a-button>
            </div>
          </div>
        </div>

        <!-- 错误提示 -->
        <a-alert
          v-if="errorMessage"
          :message="errorMessage"
          type="error"
          class="m-4"
          closable
          @close="errorMessage = ''"
        />

        <!-- 过滤和搜索 -->
        <div
          v-if="availableEmojis.length > 0"
          class="px-6 py-3 border-b border-gray-200 dark:border-gray-700 flex gap-4"
        >
          <a-select v-model:value="selectedGroup" style="width: 150px" size="small">
            <a-select-option value="all">全部分组</a-select-option>
            <a-select-option v-for="group in emojiGroups" :key="group" :value="group">
              {{ group }}
            </a-select-option>
          </a-select>
          <a-input-search
            v-model:value="searchQuery"
            placeholder="搜索表情..."
            style="width: 200px"
            size="small"
            allow-clear
          />
          <span class="text-sm text-gray-500 self-center">
            显示 {{ filteredEmojis.length }} / {{ availableEmojis.length }} 个表情
          </span>
        </div>

        <!-- 表情网格 -->
        <div class="p-4 max-h-96 overflow-y-auto">
          <div v-if="loading" class="text-center py-8">
            <a-spin />
            <p class="mt-2 text-gray-500">正在获取表情...</p>
          </div>
          <div v-else-if="availableEmojis.length === 0" class="text-center py-8 text-gray-500">
            点击"获取表情"按钮从 Discourse 站点加载可用表情
          </div>
          <div v-else-if="filteredEmojis.length === 0" class="text-center py-8 text-gray-500">
            没有找到匹配的表情
          </div>
          <div v-else class="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-1">
            <div
              v-for="emoji in filteredEmojis"
              :key="emoji.name"
              class="relative cursor-pointer p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              :class="{ 'bg-blue-100 dark:bg-blue-900': isSelected(emoji.name) }"
              :title="emoji.name"
              @click="toggleEmoji(emoji.name)"
            >
              <img
                :src="emoji.url.startsWith('/') ? `${discourseUrl}${emoji.url}` : emoji.url"
                :alt="emoji.name"
                class="w-8 h-8 object-contain"
                loading="lazy"
              />
              <CheckOutlined
                v-if="isSelected(emoji.name)"
                class="absolute -top-1 -right-1 text-blue-500 bg-white dark:bg-gray-800 rounded-full text-xs"
              />
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
