<template>
  <div>
    <GroupsTab
      :emojiStore="emojiStore"
      :expandedGroups="expandedGroups"
      :isImageUrl="isImageUrl"
      activeTab="groups"
      @open-create-group="emit('open-create-group')"
      @group-dragstart="emit('group-dragstart', $event)"
      @group-drop="emit('group-drop', $event)"
      @toggle-expand="emit('toggle-expand', $event)"
      @open-edit-group="emit('open-edit-group', $event)"
      @export-group="emit('export-group', $event)"
      @confirm-delete-group="emit('confirm-delete-group', $event)"
      @open-add-emoji="emit('open-add-emoji', $event)"
      @emoji-drag-start="emit('emoji-drag-start', $event)"
      @emoji-drop="emit('emoji-drop', $event)"
      @remove-emoji="emit('remove-emoji', $event)"
      @edit-emoji="emit('edit-emoji', $event)"
      @image-error="emit('image-error', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import GroupsTab from '../components/GroupsTab.vue'

defineProps<{
  emojiStore: any
  expandedGroups: Set<string>
  isImageUrl?: (s: string) => boolean
}>()

defineEmits([
  'open-create-group',
  'group-dragstart',
  'group-drop',
  'toggle-expand',
  'open-edit-group',
  'export-group',
  'confirm-delete-group',
  'open-add-emoji',
  'emoji-drag-start',
  'emoji-drop',
  'remove-emoji',
  'edit-emoji',
  'image-error'
])
</script>