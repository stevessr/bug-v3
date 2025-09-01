<template>
  <div class="space-y-8">
    <EmojiStats
      :groupCount="groupCount"
      :totalEmojis="totalEmojis"
      :favoritesCount="favoritesCount"
    />
  </div>
</template>

<script setup lang="ts">
import EmojiStats from '../components/EmojiStats.vue'

defineProps<{
  groupCount: number
  totalEmojis: number
  favoritesCount: number
}>()
</script>