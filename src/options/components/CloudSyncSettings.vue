<script setup lang="ts">
import MultiSyncSettings from './MultiSyncSettings.vue'

defineProps<{
  settings: any
  emojiStore: any
  showSuccess: (msg: string) => void
  showError: (msg: string) => void
}>()
</script>

<template>
  <MultiSyncSettings
    :settings="settings"
    :emojiStore="emojiStore"
    :showSuccess="showSuccess"
    :showError="showError"
  />
</template>
