<script setup lang="ts">
import { defineProps, toRefs, type Ref } from 'vue'

import type { EmojiGroup } from '../../types/emoji'
import { isImageUrl, normalizeImageUrl } from '../../utils/isImageUrl'

const props = defineProps<{
  groups: EmojiGroup[]
  activeGroupId: string | null
  setActive: (id: string) => void
}>()

// Preserve reactivity for primitive props (like activeGroupId) by using toRefs
const { groups, activeGroupId, setActive } = toRefs(props) as {
  groups: Ref<EmojiGroup[]>
  activeGroupId: Ref<string | null>
  setActive: Ref<(id: string) => void>
}

// isImageUrl is imported and usable directly in the template
</script>

<template>
  <div class="group-tabs-scroll flex border-b border-gray-100 dark:border-gray-700 overflow-x-auto">
    <a-button
      v-for="group in groups"
      :key="group.id"
      @click="setActive(group.id)"
      class="flex-shrink-0 px-3 py-2 mobile:px-4 mobile:py-3 text-xs mobile:text-sm font-medium border-b-2 transition-colors"
      :class="[
        activeGroupId === group.id
          ? 'border-blue-500 text-blue-600 bg-blue-50 dark:border-blue-500 dark:text-white dark:bg-gray-700'
          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-white dark:hover:text-white dark:hover:border-gray-600'
      ]"
    >
      <span class="mr-1">
        <template v-if="isImageUrl && isImageUrl(normalizeImageUrl(group.icon))">
          <img
            :src="normalizeImageUrl(group.icon)"
            alt="group icon"
            class="w-4 h-4 mobile:w-5 mobile:h-5 object-contain inline-block"
          />
        </template>
        <template v-else>
          {{ group.icon }}
        </template>
      </span>
      {{ group.name }}
    </a-button>
  </div>
</template>

<style scoped>
/* WebKit browsers */
.group-tabs-scroll::-webkit-scrollbar {
  height: 10px;
}
.group-tabs-scroll::-webkit-scrollbar-track {
  background: #f3f4f6; /* tailwind gray-100 */
  border-radius: 9999px;
}
.group-tabs-scroll::-webkit-scrollbar-thumb {
  background: #3b82f6; /* tailwind blue-500 */
  border-radius: 9999px;
}

/* Dark mode overrides using parent .dark class */
:global(.dark) .group-tabs-scroll::-webkit-scrollbar-track {
  background: #1f2937; /* tailwind gray-800 */
}
:global(.dark) .group-tabs-scroll::-webkit-scrollbar-thumb {
  background: #9ca3af; /* tailwind gray-400 (light thumb on dark bg) */
}

/* Firefox */
.group-tabs-scroll {
  scrollbar-width: thin;
  scrollbar-color: #3b82f6 #f3f4f6;
}
:global(.dark) .group-tabs-scroll {
  scrollbar-color: #9ca3af #1f2937;
}
</style>
