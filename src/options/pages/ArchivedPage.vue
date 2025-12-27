<script setup lang="ts">
import { onMounted, ref } from 'vue'

import { useEmojiStore } from '@/stores/emojiStore'
import { isImageUrl, normalizeImageUrl } from '@/utils/isImageUrl'
import ViewGroupDetailModal from '@/options/modals/ViewGroupDetailModal.vue'
import CachedImage from '@/components/CachedImage.vue'

const emojiStore = useEmojiStore()

const loading = ref(false)

// 展开状态
const expandedGroups = ref<Set<string>>(new Set())

const toggleExpand = (groupId: string) => {
  if (expandedGroups.value.has(groupId)) {
    expandedGroups.value.delete(groupId)
  } else {
    expandedGroups.value.add(groupId)
  }
}

// 详情模态框状态
const showDetailModal = ref(false)
const detailGroupName = ref('')
const detailContent = ref('')

const handleViewDetail = (group: { name: string; detail?: string }) => {
  detailGroupName.value = group.name
  detailContent.value = group.detail || ''
  showDetailModal.value = true
}

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
              <template v-if="isImageUrl(normalizeImageUrl(group.icon))">
                <CachedImage
                  :src="normalizeImageUrl(group.icon)"
                  alt="group icon"
                  class="w-8 h-8 object-contain rounded"
                />
              </template>
              <span v-else class="text-2xl">{{ group.icon || '📁' }}</span>
              <span class="font-medium dark:text-white">{{ group.name }}</span>
            </div>
            <span class="text-sm text-gray-500">{{ group.emojis?.length || 0 }} 个表情</span>
            <a-button size="small" @click="toggleExpand(group.id)">
              {{ expandedGroups.has(group.id) ? '收起' : '展开' }}
            </a-button>
          </div>

          <!-- 收起状态：预览前 12 个表情 -->
          <div
            v-if="!expandedGroups.has(group.id) && group.emojis && group.emojis.length > 0"
            class="flex flex-wrap gap-1 mb-3 max-h-24 overflow-hidden"
          >
            <CachedImage
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

          <!-- 展开状态：显示所有表情 -->
          <div
            v-if="expandedGroups.has(group.id) && group.emojis && group.emojis.length > 0"
            class="mb-3 border-t border-gray-100 dark:border-gray-700 pt-3"
          >
            <div
              class="grid gap-2"
              :style="{
                gridTemplateColumns: `repeat(${emojiStore.settings.gridColumns || 6}, minmax(0, 1fr))`
              }"
            >
              <div
                v-for="emoji in group.emojis"
                :key="emoji.id"
                class="relative group/emoji aspect-square"
              >
                <CachedImage
                  :src="emoji.displayUrl || emoji.url"
                  :alt="emoji.name"
                  :title="emoji.name"
                  class="w-full h-full object-contain rounded border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700"
                />
                <div
                  class="absolute bottom-0 left-0 right-0 bg-black bg-opacity-60 text-white text-xs p-1 truncate opacity-0 group-hover/emoji:opacity-100 transition-opacity"
                >
                  {{ emoji.name }}
                </div>
              </div>
            </div>
          </div>

          <!-- 无表情提示 -->
          <div
            v-if="expandedGroups.has(group.id) && (!group.emojis || group.emojis.length === 0)"
            class="mb-3 text-center text-gray-400 py-4"
          >
            此分组没有表情
          </div>

          <div class="flex gap-2">
            <a-button size="small" @click="handleViewDetail(group)">详情</a-button>
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

    <!-- 详情模态框 -->
    <ViewGroupDetailModal
      v-model:show="showDetailModal"
      :group-name="detailGroupName"
      :detail="detailContent"
    />
  </div>
</template>
