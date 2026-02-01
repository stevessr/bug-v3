<script setup lang="ts">
type UserMainTab = 'summary' | 'activity' | 'messages' | 'badges' | 'follow'

defineProps<{
  active: UserMainTab
}>()

const emit = defineEmits<{
  (e: 'switchTab', tab: UserMainTab): void
}>()

const tabs: { key: UserMainTab; label: string }[] = [
  { key: 'summary', label: '概览' },
  { key: 'activity', label: '动态' },
  { key: 'messages', label: '私信' },
  { key: 'badges', label: '徽章' },
  { key: 'follow', label: '关注' }
]
</script>

<template>
  <div class="user-tabs flex gap-1 overflow-x-auto border-b dark:border-gray-700 pb-1">
    <button
      v-for="tab in tabs"
      :key="tab.key"
      class="px-4 py-2 text-sm rounded-t whitespace-nowrap transition-colors"
      :class="
        active === tab.key
          ? 'bg-blue-500 text-white'
          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
      "
      @click="emit('switchTab', tab.key)"
    >
      {{ tab.label }}
    </button>
  </div>
</template>

<style scoped src="../css/UserTabs.css"></style>
