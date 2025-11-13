<script setup lang="ts">
import { ref, computed } from 'vue'

import { useEmojiStore } from '@/stores/emojiStore'
import EmojiGrid from '@/options/components/EmojiGrid.vue'
import BatchActionsBar from '@/options/components/BatchActionsBar.vue'
import BatchRenameModal from '@/options/modals/BatchRenameModal.vue'
import type { Emoji } from '@/types/emoji'

const emojiStore = useEmojiStore()

const allEmojis = computed(() => {
  return emojiStore.sortedGroups.flatMap(group =>
    group.emojis.map(emoji => ({ ...emoji, groupId: group.id }))
  )
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
</script>

<template>
  <div class="p-4">
    <h1 class="text-2xl font-bold mb-4">AI 批量重命名</h1>
    <p class="mb-4 text-gray-600">在这里，您可以选择多个表情，并使用 AI 批量重命名它们。</p>

    <EmojiGrid
      :emojis="allEmojis"
      group-id="all-emojis"
      :grid-columns="emojiStore.settings.gridColumns"
      :selected-emojis="selectedEmojis"
      @toggle-selection="toggleSelection"
    />

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
