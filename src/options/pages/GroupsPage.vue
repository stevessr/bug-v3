<script setup lang="ts">
import { inject } from 'vue'

import type { OptionsInject } from '../types'
import GroupsTab from '../components/GroupsTab.vue'

const options = inject<OptionsInject>('options')!

const {
  emojiStore,
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
  />
</template>
