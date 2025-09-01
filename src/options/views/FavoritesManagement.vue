<template>
  <div>
    <FavoritesTab
      :emojiStore="emojiStore"
      @remove="emit('remove', $event)"
      @edit="emit('edit', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import FavoritesTab from '../components/FavoritesTab.vue'

defineProps<{
  emojiStore: any
}>()

const emit = defineEmits(['remove', 'edit'])
</script>