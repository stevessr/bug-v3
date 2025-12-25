<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useEmojiStore } from '@/stores/emojiStore'

const emojiStore = useEmojiStore()

const loading = ref(false)

const handleUnarchive = async (groupId: string) => {
  loading.value = true
  try {
    await emojiStore.unarchiveGroup(groupId)
  } finally {
    loading.value = false
  }
}

const handleDelete = async (groupId: string) => {
  loading.value = true
  try {
    await emojiStore.deleteArchivedGroup(groupId)
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  loading.value = true
  try {
    await emojiStore.refreshArchivedGroups()
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="archived-page">
    <div class="mb-4 flex items-center justify-between">
      <h2 class="text-xl font-semibold dark:text-white">已归档分组</h2>
      <a-button :loading="loading" @click="emojiStore.refreshArchivedGroups()">刷新</a-button>
    </div>

    <a-spin :spinning="loading">
      <div v-if="emojiStore.archivedGroups.length === 0" class="text-center py-12 text-gray-500">
        <p>暂无已归档的分组</p>
        <p class="text-sm mt-2">在分组管理中可以归档分组</p>
      </div>

      <div v-else class="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        <div
          v-for="group in emojiStore.archivedGroups"
          :key="group.id"
          class="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border dark:border-gray-700"
        >
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
              <span class="text-2xl">{{ group.icon || '📁' }}</span>
              <span class="font-medium dark:text-white">{{ group.name }}</span>
            </div>
            <span class="text-sm text-gray-500">{{ group.emojis?.length || 0 }} 个表情</span>
          </div>

          <div
            v-if="group.emojis && group.emojis.length > 0"
            class="flex flex-wrap gap-1 mb-3 max-h-24 overflow-hidden"
          >
            <img
              v-for="emoji in group.emojis.slice(0, 12)"
              :key="emoji.id"
              :src="emoji.displayUrl || emoji.url"
              :alt="emoji.name"
              class="w-8 h-8 object-contain rounded"
            />
            <span v-if="group.emojis.length > 12" class="text-sm text-gray-400 self-center ml-1">
              +{{ group.emojis.length - 12 }}
            </span>
          </div>

          <div class="flex gap-2">
            <a-button type="primary" size="small" @click="handleUnarchive(group.id)">恢复</a-button>
            <a-popconfirm
              title="确定永久删除此分组？"
              ok-text="删除"
              cancel-text="取消"
              @confirm="handleDelete(group.id)"
            >
              <a-button danger size="small">删除</a-button>
            </a-popconfirm>
          </div>
        </div>
      </div>
    </a-spin>
  </div>
</template>
