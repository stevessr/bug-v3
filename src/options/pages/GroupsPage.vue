<script setup lang="ts">
import { inject } from 'vue'
import { useRouter } from 'vue-router'

import type { OptionsInject } from '../types'
import GroupsTab from '../components/GroupsTab.vue'

import { getTelegramGroupSource } from '@/utils/telegram/groupSource'
import { useEmojiStore } from '@/stores/emojiStore'

const options = inject<OptionsInject>('options')!
const emojiStore = useEmojiStore()
const router = useRouter()

const {
  expandedGroups,
  isImageUrl,
  exportProgress,
  exportProgressGroupId,
  toggleGroupExpansion,
  handleDragStart,
  handleDrop,
  openEditGroup,
  exportGroup,
  exportGroupZip,
  copyGroupAsMarkdown,
  confirmDeleteGroup,
  openAddEmojiModal,
  handleEmojiDragStart,
  handleEmojiDrop,
  removeEmojiFromGroup,
  openEditEmoji,
  handleImageError,
  showCreateGroupModal
} = options

const handleArchiveGroup = async (group: any) => {
  if (group && group.id) {
    try {
      await emojiStore.archiveGroup(group.id)
    } catch (error) {
      message.error(`归档失败：${error instanceof Error ? error.message : String(error)}`)
    }
  }
}

const handleTelegramUpdate = (group: any) => {
  if (!group || !group.id) return
  const input = getTelegramGroupSource(group.detail)
  router.push({
    path: '/import',
    query: {
      source: 'telegram',
      tgGroupId: String(group.id),
      tgInput: input || undefined,
      tgAuto: '1'
    }
  })
}
</script>

<template>
  <GroupsTab
    :emojiStore="emojiStore"
    :expandedGroups="expandedGroups"
    :isImageUrl="isImageUrl"
    :exportProgress="exportProgress"
    :exportProgressGroupId="exportProgressGroupId"
    @openCreateGroup="showCreateGroupModal = true"
    @groupDragStart="handleDragStart"
    @groupDrop="handleDrop"
    @toggleExpand="toggleGroupExpansion"
    @openEditGroup="openEditGroup"
    @exportGroup="exportGroup"
    @exportGroupZip="exportGroupZip"
    @copyGroupAsMarkdown="copyGroupAsMarkdown"
    @confirmDeleteGroup="confirmDeleteGroup"
    @telegramUpdate="handleTelegramUpdate"
    @openAddEmoji="openAddEmojiModal"
    @emojiDragStart="handleEmojiDragStart"
    @emojiDrop="handleEmojiDrop"
    @removeEmoji="removeEmojiFromGroup"
    @editEmoji="openEditEmoji"
    @imageError="handleImageError"
    @archiveGroup="handleArchiveGroup"
  />
</template>
