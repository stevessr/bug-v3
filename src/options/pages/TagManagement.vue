<script setup lang="ts">
import { ref, computed } from 'vue'
import { TagOutlined, DeleteOutlined, EditOutlined, SearchOutlined } from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'

import { useEmojiStore } from '@/stores/emojiStore'

const emojiStore = useEmojiStore()
const searchTerm = ref('')
const editingTag = ref<string | null>(null)
const newTagName = ref('')

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
  message.success(`標籤 "${oldName}" 已重命名為 "${newName}"`)
  editingTag.value = null
}

// 取消編輯
const cancelEdit = () => {
  editingTag.value = null
  newTagName.value = ''
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
    message.success(`已從 ${count} 個表情中移除標籤 "${tagName}"`)
  } else {
    message.info(`標籤 "${tagName}" 未被使用`)
  }
}

// 獲取使用該標籤的表情數量
const getTagUsageCount = (tagName: string) => {
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
</script>

<template>
  <div class="p-6">
    <div class="mb-6">
      <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">
        <TagOutlined class="mr-2" />
        標籤管理
      </h2>
      <p class="text-gray-600 dark:text-gray-400">
        管理所有表情標籤，包括重命名、刪除和查看使用情況
      </p>
    </div>

    <!-- 搜索框 -->
    <div class="mb-6">
      <div class="relative">
        <SearchOutlined class="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
        <input
          v-model="searchTerm"
          type="text"
          placeholder="搜索標籤..."
          class="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white dark:border-gray-600"
        />
      </div>
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
                title="保存"
              >
                ✓
              </button>
              <button
                @click="cancelEdit"
                class="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                title="取消"
              >
                ✕
              </button>
            </div>
            <!-- 顯示模式 -->
            <div v-else class="flex items-center gap-2">
              <span
                class="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
              >
                {{ tag.name }}
              </span>
              <span class="text-sm text-gray-500 dark:text-gray-400">({{ tag.count }} 次)</span>
            </div>
          </div>

          <!-- 操作按鈕 -->
          <div v-if="editingTag !== tag.name" class="flex gap-1">
            <button
              @click="startEditTag(tag.name)"
              class="text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400"
              title="編輯標籤"
            >
              <EditOutlined class="text-sm" />
            </button>
            <button
              @click="deleteTag(tag.name)"
              class="text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
              title="刪除標籤"
            >
              <DeleteOutlined class="text-sm" />
            </button>
          </div>
        </div>

        <!-- 使用該標籤的表情預覽 -->
        <div class="mt-3">
          <div class="text-xs text-gray-500 dark:text-gray-400 mb-2">使用此標籤的表情：</div>
          <div class="flex flex-wrap gap-1">
            <div
              v-for="(item, index) in getTagEmojis(tag.name).slice(0, 6)"
              :key="item.emoji.id"
              class="relative group"
              :title="`${item.emoji.name} (${item.group})`"
            >
              <img
                :src="item.emoji.displayUrl || item.emoji.url"
                :alt="item.emoji.name"
                class="w-8 h-8 object-cover rounded border border-gray-200 dark:border-gray-600"
              />
              <!-- 超過6個時顯示更多指示器 -->
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
        {{ searchTerm ? '未找到匹配的標籤' : '還沒有任何標籤' }}
      </p>
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
