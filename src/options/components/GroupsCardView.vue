<script setup lang="ts">
import { computed, type PropType } from 'vue'
import { Card as ACard } from 'ant-design-vue'

import { useEmojiStore } from '../../stores/emojiStore'

type Group = {
  id: string
  name: string
  icon?: string
  emojis?: Array<unknown>
}

const { displayGroups, isImageUrl, expandedGroups, touchRefFn } = defineProps({
  displayGroups: { type: Array as PropType<Group[]>, required: true },
  // accept a generic Function to match parent's optional signature
  isImageUrl: { type: Function as PropType<Function> },
  expandedGroups: { type: Object as PropType<Set<string>>, required: true },
  // function used to attach touch drag events from parent; accepts nullable el
  touchRefFn: {
    type: Function as PropType<((el: HTMLElement | null, group: Group) => void) | undefined>
  }
})

const emit = defineEmits([
  'groupDragStart',
  'groupDrop',
  'toggleExpand',
  'openEditGroup',
  'exportGroup',
  'exportGroupZip',
  'imageError'
])

const emojiStore = useEmojiStore()
const columns = computed(() => emojiStore.settings?.gridColumns || 3)
</script>

<template>
  <div class="space-y-6">
    <div class="grid gap-4" :style="{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }">
      <div
        v-for="group in displayGroups"
        :key="group.id"
        class="group-card"
        :draggable="group.id !== 'favorites'"
        @dragstart="$emit('groupDragStart', group, $event)"
        @dragover.prevent
        @drop="$emit('groupDrop', group, $event)"
        :ref="el => touchRefFn && touchRefFn(el as HTMLElement | null, group)"
      >
        <ACard hoverable class="relative">
          <!-- drag handle (used by TouchDragHandler.shouldStartDrag via data-group-move) -->
          <div class="absolute top-2 left-2 z-10">
            <div v-if="group.id !== 'favorites'" class="cursor-move text-gray-400" data-group-move>
              ⋮⋮
            </div>
            <div v-else class="text-yellow-500">⭐</div>
          </div>

          <template #cover>
            <div class="flex items-center justify-center h-24 bg-gray-50">
              <template v-if="isImageUrl && isImageUrl(group.icon)">
                <img
                  :src="group.icon"
                  alt="icon"
                  class="h-16 object-contain"
                  @error="$emit('imageError', $event)"
                />
              </template>
              <template v-else>
                <div class="text-2xl">{{ group.icon }}</div>
              </template>
            </div>
          </template>
          <ACard.Meta :title="group.name">
            <template #description>
              <div class="text-sm text-gray-500">{{ group.emojis?.length || 0 }} 个表情</div>
            </template>
          </ACard.Meta>
          <div class="mt-3 flex gap-2">
            <button
              @click="$emit('toggleExpand', group.id)"
              class="px-3 py-1 text-sm rounded border"
            >
              {{ expandedGroups.has(group.id) ? '收起' : '展开' }}
            </button>
            <button
              v-if="group.id !== 'favorites'"
              @click="$emit('openEditGroup', group)"
              class="px-3 py-1 text-sm rounded border"
            >
              编辑
            </button>
            <button @click="$emit('exportGroup', group)" class="px-3 py-1 text-sm rounded border">
              导出
            </button>
            <button
              @click="$emit('exportGroupZip', group)"
              class="px-3 py-1 text-sm rounded border"
            >
              打包下载
            </button>
          </div>
        </ACard>
      </div>
    </div>
  </div>
</template>

<style scoped>
.group-card {
  /* keep spacing consistent with list view */
  padding: 0;
}
</style>
