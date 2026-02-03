<script setup lang="ts">
import { ref, computed } from 'vue'

import type { Emoji } from '@/types/type'
import { useEmojiStore } from '@/stores/emojiStore'
import VirtualList from '@/options/components/VirtualList.vue'
import BatchActionsBar from '@/options/components/BatchActionsBar.vue'
import BatchRenameModal from '@/options/modals/BatchRenameModal.vue'
import AIRenameEmojiCard from '@/options/components/AIRenameEmojiCard'

const emojiStore = useEmojiStore()

// 只显示分组中的表情，排除常用和未分组的表情
const allEmojis = computed(() => {
  const groupedEmojis = emojiStore.sortedGroups.flatMap(group => {
    // 排除常用分组和未分组的表情
    if (group.id === 'favorites' || group.id === 'ungrouped') {
      return []
    }
    return group.emojis.map(emoji => ({ ...emoji, groupId: group.id }))
  })

  console.log(
    '[AIRenamePage] Computed grouped emojis:',
    groupedEmojis.length,
    'emojis from',
    emojiStore.sortedGroups.filter(g => g.id !== 'favorites' && g.id !== 'ungrouped').length,
    'groups'
  )

  return groupedEmojis
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

const groupCount = computed(
  () =>
    emojiStore.sortedGroups.filter(group => group.id !== 'favorites' && group.id !== 'ungrouped')
      .length
)
const totalEmojiCount = computed(() => allEmojis.value.length)

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
    <div class="mb-4 space-y-3">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 class="text-2xl font-bold">AI 批量重命名</h1>
          <p class="text-gray-600 dark:text-gray-400">
            选择多个表情，使用 AI 智能批量重命名。支持流式加载和虚拟滚动优化。
          </p>
        </div>
        <div class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          <span class="rounded-full bg-gray-100 dark:bg-gray-700 px-3 py-1">
            分组 {{ groupCount }}
          </span>
          <span class="rounded-full bg-gray-100 dark:bg-gray-700 px-3 py-1">
            表情 {{ totalEmojiCount }}
          </span>
          <span
            class="rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-300 px-3 py-1"
          >
            已选 {{ selectedCount }}
          </span>
        </div>
      </div>
      <div
        class="rounded-lg border bg-gradient-to-r from-amber-50 via-white to-emerald-50 dark:from-amber-900/10 dark:via-gray-900 dark:to-emerald-900/10 px-4 py-3 text-sm text-gray-600 dark:text-gray-300"
      >
        提示：先多选再生成，支持按分组流式加载；生成后可逐个排除或重新生成。
      </div>
    </div>

    <!-- 使用虚拟滚动优化的列表 -->
    <div v-if="allEmojis.length > 0" class="border rounded-lg overflow-hidden">
      <VirtualList
        ref="virtualListRef"
        :items="allEmojis"
        :item-height="itemHeight"
        :container-height="containerHeight"
        :buffer="5"
        :items-per-row="gridColumns"
      >
        <template #default="{ item: emoji }">
          <AIRenameEmojiCard
            :emoji="emoji"
            :selected="selectedEmojis.has(emoji.id)"
            @toggle="toggleSelection(emoji.id)"
          />
        </template>
      </VirtualList>
    </div>

    <div v-else class="border rounded-lg p-10">
      <a-empty description="暂无可批量重命名的表情" />
    </div>

    <BatchActionsBar
      v-if="selectedCount > 0"
      :selected-count="selectedCount"
      @select-all="handleSelectAll"
      @deselect-all="handleDeselectAll"
      @batch-rename="handleBatchRename"
      @cancel="handleCancelSelection"
    />

    <BatchRenameModal
      :visible="isBatchRenameModalVisible"
      :selected-emojis="selectedEmojiObjects"
      @close="isBatchRenameModalVisible = false"
      @apply="handleApplyBatchRename"
    />
  </div>
</template>
