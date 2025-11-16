<script setup lang="ts">
import { ref, computed } from 'vue'

import { useEmojiStore } from '@/stores/emojiStore'
import VirtualList from '@/options/components/VirtualList.vue'
import BatchActionsBar from '@/options/components/BatchActionsBar.vue'
import BatchRenameModalOptimized from '@/options/modals/BatchRenameModalOptimized.vue'

const emojiStore = useEmojiStore()

// 只显示分组中的表情，排除常用和未分组的表情
const allEmojis = computed(() => {
  return emojiStore.sortedGroups.flatMap(group => {
    // 排除常用分组和未分组的表情
    if (group.id === 'favorites' || group.id === 'ungrouped') {
      return []
    }
    return group.emojis.map(emoji => ({ ...emoji, groupId: group.id }))
  })
})

const selectedEmojis = ref(new Set<string>())

const toggleSelection = (emojiId: string) => {
  if (selectedEmojis.value.has(emojiId)) {
    selectedEmojis.value.delete(emojiId)
  } else {
    selectedEmojis.value.add(emojiId)
  }
}

const selectedCount = computed(() => selectedEmojis.value.size)

const handleSelectAll = () => {
  selectedEmojis.value = new Set(allEmojis.value.map(e => e.id))
}

const handleDeselectAll = () => {
  selectedEmojis.value.clear()
}

const handleCancelSelection = () => {
  selectedEmojis.value.clear()
}

const isBatchRenameModalVisible = ref(false)

const handleBatchRename = () => {
  isBatchRenameModalVisible.value = true
}

const selectedEmojiObjects = computed(() => {
  const emojis: Emoji[] = []
  const selected = selectedEmojis.value
  if (selected.size === 0) return emojis

  for (const emoji of allEmojis.value) {
    if (selected.has(emoji.id)) {
      emojis.push(emoji)
    }
  }
  return emojis
})

const handleApplyBatchRename = (newNames: Record<string, string>) => {
  emojiStore.updateEmojiNames(newNames)
  isBatchRenameModalVisible.value = false
  selectedEmojis.value.clear()
}

// 虚拟列表引用
const virtualListRef = ref<InstanceType<typeof VirtualList> | null>(null)

// 使用设置中的网格列数
const gridColumns = computed(() => emojiStore.settings.gridColumns || 4)

// 根据网格列数计算项目高度
const itemHeight = computed(() => {
  // 每行显示 gridColumns 个卡片，每个卡片高度约为 180px（包括名称）
  return 180
})
const containerHeight = 600
</script>

<template>
  <div class="p-4">
    <div class="mb-4">
      <h1 class="text-2xl font-bold">AI 批量重命名</h1>
      <p class="text-gray-600 dark:text-gray-400">
        选择多个表情，使用 AI 智能批量重命名。支持流式加载和虚拟滚动优化。
      </p>
    </div>

    <!-- 使用虚拟滚动优化的列表 -->
    <div class="border rounded-lg overflow-hidden">
      <VirtualList
        ref="virtualListRef"
        :items="allEmojis"
        :item-height="itemHeight"
        :container-height="containerHeight"
        :buffer="5"
        :items-per-row="gridColumns"
      >
        <template #default="{ item: emoji, index }">
          <a-card
            class="m-1 cursor-pointer hover:shadow-md transition-shadow h-full flex flex-col"
            :class="{ 'border-blue-500 border-2': selectedEmojis.has(emoji.id) }"
            @click="toggleSelection(emoji.id)"
            hoverable
          >
            <div class="flex flex-col items-center flex-1 p-2">
              <img
                :src="emoji.url"
                :alt="emoji.name"
                class="w-16 h-16 object-contain mb-2"
                loading="lazy"
              />
              <div class="text-center truncate w-full text-sm dark:text-white mb-1">
                {{ emoji.name }}
              </div>
              <div class="flex items-center">
                <input
                  type="checkbox"
                  :checked="selectedEmojis.has(emoji.id)"
                  class="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  @click.stop="toggleSelection(emoji.id)"
                />
              </div>
            </div>
          </a-card>
        </template>
      </VirtualList>
    </div>

    <BatchActionsBar
      v-if="selectedCount > 0"
      :selected-count="selectedCount"
      @select-all="handleSelectAll"
      @deselect-all="handleDeselectAll"
      @batch-rename="handleBatchRename"
      @cancel="handleCancelSelection"
    />

    <BatchRenameModalOptimized
      :visible="isBatchRenameModalVisible"
      :selected-emojis="selectedEmojiObjects"
      @close="isBatchRenameModalVisible = false"
      @apply="handleApplyBatchRename"
    />
  </div>
</template>
