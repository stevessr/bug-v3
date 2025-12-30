<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  TagOutlined,
  DeleteOutlined,
  EditOutlined,
  SearchOutlined,
  PlusOutlined
} from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'

import CachedImage from '@/components/CachedImage.vue'
import { useEmojiStore } from '@/stores/emojiStore'

const { t } = useI18n()

const emojiStore = useEmojiStore()
const searchTerm = ref('')
const editingTag = ref<string | null>(null)
const newTagName = ref('')
const showCreateModal = ref(false)
const newTagNameCreate = ref('')

// 所有標籤
const allTags = computed(() => {
  return emojiStore.allTags.filter(tag =>
    tag.name.toLowerCase().includes(searchTerm.value.toLowerCase())
  )
})

// 編輯標籤
const startEditTag = (tagName: string) => {
  editingTag.value = tagName
  newTagName.value = tagName
}

// 保存標籤編輯
const saveTagEdit = () => {
  if (!editingTag.value || !newTagName.value.trim()) return

  const oldName = editingTag.value
  const newName = newTagName.value.trim()

  if (oldName === newName) {
    editingTag.value = null
    return
  }

  // 遍歷所有表情，更新標籤名稱
  emojiStore.groups.forEach(group => {
    group.emojis.forEach(emoji => {
      if (emoji.tags) {
        const index = emoji.tags.indexOf(oldName)
        if (index !== -1) {
          emoji.tags[index] = newName
        }
      }
    })
  })

  emojiStore.maybeSave()
  message.success(t('tagRenameSuccess', { oldName, newName }))
  editingTag.value = null
}

// 取消編輯
const cancelEdit = () => {
  editingTag.value = null
  newTagName.value = ''
}

// 創建新標籤
const createNewTag = async () => {
  const tagName = newTagNameCreate.value.trim()
  if (!tagName) {
    message.warning(t('pleaseEnterTagName'))
    return
  }

  // 檢查標籤是否已存在
  const existingTag = emojiStore.allTags.find(t => t.name.toLowerCase() === tagName.toLowerCase())
  if (existingTag) {
    message.warning(t('tagAlreadyExists'))
    return
  }

  // 創建一個臨時表情並添加標籤，然後移除表情
  // 這樣可以確保標籤被添加到系統中
  const tempGroupId = emojiStore.groups[0]?.id || 'default'
  const tempEmoji = {
    name: `temp-${Date.now()}`,
    url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
    tags: [tagName],
    packet: Date.now()
  }

  const addedEmoji = emojiStore.addEmoji(tempGroupId, tempEmoji)

  // 立即移除臨時表情
  if (addedEmoji) {
    const groupIndex = emojiStore.groups.findIndex(g => g.id === tempGroupId)
    const emojiIndex = emojiStore.groups[groupIndex]?.emojis.findIndex(e => e.id === addedEmoji.id)
    if (emojiIndex !== -1 && emojiIndex !== undefined) {
      emojiStore.groups[groupIndex].emojis.splice(emojiIndex, 1)
      emojiStore.maybeSave()
    }
  }

  message.success(t('tagCreateSuccess', { tagName }))
  newTagNameCreate.value = ''
  showCreateModal.value = false
}

// 刪除標籤
const deleteTag = (tagName: string) => {
  let count = 0

  // 從所有表情中移除該標籤
  emojiStore.groups.forEach(group => {
    group.emojis.forEach(emoji => {
      if (emoji.tags) {
        const index = emoji.tags.indexOf(tagName)
        if (index !== -1) {
          emoji.tags.splice(index, 1)
          count++
        }
      }
    })
  })

  if (count > 0) {
    emojiStore.maybeSave()
    message.success(t('tagDeleteSuccess', { count, tagName }))
  } else {
    message.info(t('tagNotUsed', { tagName }))
  }
}

// 獲取使用該標籤的表情數量 (kept for potential future use)
// @ts-expect-error kept for API compatibility
const _getTagUsageCount = (tagName: string) => {
  let count = 0
  emojiStore.groups.forEach(group => {
    group.emojis.forEach(emoji => {
      if (emoji.tags && emoji.tags.includes(tagName)) {
        count++
      }
    })
  })
  return count
}

// 獲取使用該標籤的表情列表
const getTagEmojis = (tagName: string) => {
  const emojis: Array<{ emoji: any; group: string }> = []
  emojiStore.groups.forEach(group => {
    group.emojis.forEach(emoji => {
      if (emoji.tags && emoji.tags.includes(tagName)) {
        emojis.push({ emoji, group: group.name })
      }
    })
  })
  return emojis
}

// 處理標籤點擊（篩選功能）
const handleTagClick = (tagName: string) => {
  // 這裡可以添加標籤篩選邏輯
  message.info(t('tagClickInfo', { tagName }))
}
</script>

<template>
  <div class="p-6">
    <div class="mb-6">
      <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">
        <TagOutlined class="mr-2" />
        {{ t('tagManagement') }}
      </h2>
      <p class="text-gray-600 dark:text-gray-400">
        {{ t('tagManagementDescription') }}
      </p>
    </div>

    <!-- 操作區域 -->
    <div class="mb-6 flex flex-col sm:flex-row gap-4">
      <!-- 搜索框 -->
      <div class="relative flex-1">
        <SearchOutlined class="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
        <input
          v-model="searchTerm"
          type="text"
          :placeholder="t('searchTags')"
          class="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white dark:border-gray-600"
        />
      </div>

      <!-- 創建新標籤按鈕 -->
      <button
        @click="showCreateModal = true"
        class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-2"
      >
        <PlusOutlined />
        {{ t('createTag') }}
      </button>
    </div>

    <!-- 標籤列表 -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <div
        v-for="tag in allTags"
        :key="tag.name"
        class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow"
      >
        <div class="flex items-start justify-between mb-2">
          <div class="flex-1">
            <!-- 編輯模式 -->
            <div v-if="editingTag === tag.name" class="flex items-center gap-2">
              <input
                v-model="newTagName"
                type="text"
                class="flex-1 px-2 py-1 border border-gray-300 rounded text-sm dark:bg-gray-700 dark:text-white dark:border-gray-600"
                @keydown.enter="saveTagEdit"
                @keydown.escape="cancelEdit"
                ref="editInput"
              />
              <button
                @click="saveTagEdit"
                class="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300"
                :title="t('save')"
              >
                ✓
              </button>
              <button
                @click="cancelEdit"
                class="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                :title="t('cancel')"
              >
                ✕
              </button>
            </div>
            <!-- 顯示模式 -->
            <div v-else class="flex items-center gap-2">
              <span
                class="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 cursor-pointer hover:bg-blue-200 dark:hover:bg-blue-800"
                @click="handleTagClick(tag.name)"
              >
                {{ tag.name }}
              </span>
              <span class="text-sm text-gray-500 dark:text-gray-400">
                ({{ tag.count }} {{ t('times') }})
              </span>
            </div>
          </div>

          <!-- 操作按鈕 -->
          <div v-if="editingTag !== tag.name" class="flex gap-1">
            <button
              @click="startEditTag(tag.name)"
              class="text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400"
              :title="t('editTag')"
            >
              <EditOutlined class="text-sm" />
            </button>
            <button
              @click="deleteTag(tag.name)"
              class="text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
              :title="t('deleteTag')"
            >
              <DeleteOutlined class="text-sm" />
            </button>
          </div>
        </div>

        <!-- 使用該標籤的表情預覽 -->
        <div class="mt-3">
          <div class="text-xs text-gray-500 dark:text-gray-400 mb-2">
            {{ t('useThisTagEmojis') }}
          </div>
          <div class="flex flex-wrap gap-1">
            <div
              v-for="(item, index) in getTagEmojis(tag.name).slice(0, 6)"
              :key="item.emoji.id"
              class="relative group"
              :title="`${item.emoji.name} (${item.group})`"
            >
              <CachedImage
                :src="item.emoji.displayUrl || item.emoji.url"
                :alt="item.emoji.name"
                class="w-8 h-8 object-cover rounded border border-gray-200 dark:border-gray-600"
              />
              <!-- 超過 6 個時顯示更多指示器 -->
              <div
                v-if="index === 5 && getTagEmojis(tag.name).length > 6"
                class="absolute inset-0 bg-black bg-opacity-50 rounded flex items-center justify-center text-white text-xs"
              >
                +{{ getTagEmojis(tag.name).length - 6 }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 空狀態 -->
    <div v-if="allTags.length === 0" class="text-center py-12">
      <TagOutlined class="text-4xl text-gray-300 dark:text-gray-600 mb-4" />
      <p class="text-gray-500 dark:text-gray-400">
        {{ searchTerm ? t('noMatchingTags') : t('noTagsYet') }}
      </p>
      <button
        v-if="!searchTerm"
        @click="showCreateModal = true"
        class="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
      >
        {{ t('createFirstTag') }}
      </button>
    </div>

    <!-- 創建標籤模態框 -->
    <div
      v-if="showCreateModal"
      class="fixed inset-0 z-50 overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div class="fixed inset-0 bg-gray-500 bg-opacity-75" @click="showCreateModal = false"></div>

      <div class="flex items-center justify-center min-h-screen p-4">
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {{ t('createNewTag') }}
          </h3>

          <input
            v-model="newTagNameCreate"
            type="text"
            :placeholder="t('enterTagName')"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white dark:border-gray-600"
            @keydown.enter="createNewTag"
          />

          <div class="mt-4 flex justify-end gap-2">
            <button
              @click="showCreateModal = false"
              class="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
            >
              {{ t('cancel') }}
            </button>
            <button
              @click="createNewTag"
              class="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
            >
              {{ t('createTag') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.grid {
  display: grid;
  gap: 1rem;
}

@media (min-width: 768px) {
  .grid-cols-1 {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 1024px) {
  .grid-cols-1 {
    grid-template-columns: repeat(3, 1fr);
  }
}
</style>
