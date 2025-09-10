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
  <div class="flex border-b border-gray-100 overflow-x-auto">
    <button
      v-for="group in groups"
      :key="group.id"
      @click="setActive(group.id)"
      class="flex-shrink-0 px-3 py-2 mobile:px-4 mobile:py-3 text-xs mobile:text-sm font-medium border-b-2 transition-colors"
      :class="[
        activeGroupId === group.id
          ? 'border-blue-500 text-blue-600 bg-blue-50'
          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
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
    </button>
  </div>
</template>
