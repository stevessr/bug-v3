<template>
  <div>
    <UngroupedTab
      :emojiStore="emojiStore"
      @remove="emit('remove', $event)"
      @edit="emit('edit', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import UngroupedTab from '../components/UngroupedTab.vue'

defineProps<{
  emojiStore: any
}>()

const emit = defineEmits(['remove', 'edit'])
</script>