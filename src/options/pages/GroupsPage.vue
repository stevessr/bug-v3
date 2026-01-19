<script setup lang="ts">
import { inject } from 'vue'
import { useRouter } from 'vue-router'

import type { OptionsInject } from '../types'
import GroupsTab from '../components/GroupsTab.vue'

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
    await emojiStore.archiveGroup(group.id)
  }
}

const getTelegramInputFromGroup = (group: any): string => {
  const detail = String(group?.detail ?? '')
  const prefix = 'Telegram 贴纸包：'
  const index = detail.indexOf(prefix)
  if (index === -1) return ''
  return detail.slice(index + prefix.length).trim()
}

const handleTelegramUpdate = (group: any) => {
  if (!group || !group.id) return
  const input = getTelegramInputFromGroup(group)
  router.push({
    path: '/telegram-import',
    query: {
      tgGroupId: String(group.id),
      tgInput: input || undefined
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
