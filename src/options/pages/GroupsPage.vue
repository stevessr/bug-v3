<script setup lang="ts">
import { inject } from 'vue'

import type { OptionsInject } from '../types'
import GroupsTab from '../components/GroupsTab.vue'

import { useEmojiStore } from '@/stores/emojiStore'

const options = inject<OptionsInject>('options')!
const emojiStore = useEmojiStore()

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
    @confirmDeleteGroup="confirmDeleteGroup"
    @openAddEmoji="openAddEmojiModal"
    @emojiDragStart="handleEmojiDragStart"
    @emojiDrop="handleEmojiDrop"
    @removeEmoji="removeEmojiFromGroup"
    @editEmoji="openEditEmoji"
    @imageError="handleImageError"
    @archiveGroup="handleArchiveGroup"
  />
</template>
