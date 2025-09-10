<script setup lang="ts">
import { computed, type PropType, ref } from 'vue'
import { Card as ACard } from 'ant-design-vue'

import { normalizeImageUrl } from '../../utils/isImageUrl'
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
  'imageError',
  'confirmDeleteGroup'
])

const emojiStore = useEmojiStore()
const columns = computed(() => emojiStore.settings?.gridColumns || 3)
const openMenuCard = ref<string | null>(null)
const dedupeMessageCard = ref<Record<string, string>>({})

const showDedupeMessageCard = (groupId: string, msg: string, ms = 2000) => {
  dedupeMessageCard.value = { ...dedupeMessageCard.value, [groupId]: msg }
  setTimeout(() => {
    const copy = { ...dedupeMessageCard.value }
    delete copy[groupId]
    dedupeMessageCard.value = copy
  }, ms)
}

const toggleMenuCard = (groupId: string) => {
  openMenuCard.value = openMenuCard.value === groupId ? null : groupId
}

const onEditCard = (group: Group) => {
  openMenuCard.value = null
  emit('openEditGroup', group)
}

const onExportCard = (group: Group) => {
  openMenuCard.value = null
  emit('exportGroup', group)
}

const onExportZipCard = (group: Group) => {
  openMenuCard.value = null
  emit('exportGroupZip', group)
}

const onDedupeCard = (group: Group) => {
  openMenuCard.value = null
  try {
    const removed = emojiStore.dedupeGroup(group.id)
    if (removed > 0) {
      showDedupeMessageCard(group.id, `已去重 ${removed} 个表情`)
    } else {
      showDedupeMessageCard(group.id, `未发现重复`)
    }
  } catch {
    // ignore
  }
}
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
              <template v-if="isImageUrl && isImageUrl(normalizeImageUrl(group.icon))">
                <img
                  :src="normalizeImageUrl(group.icon)"
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
            <div v-if="group.id !== 'favorites'" class="relative">
              <button @click="toggleMenuCard(group.id)" class="px-3 py-1 text-sm rounded border">
                操作 ▾
              </button>
              <div
                v-if="openMenuCard === group.id"
                class="absolute right-0 mt-2 w-36 bg-white border rounded shadow z-50"
              >
                <button
                  class="w-full text-left px-3 py-2 hover:bg-gray-50"
                  @click.prevent="onEditCard(group)"
                >
                  编辑
                </button>
                <button
                  class="w-full text-left px-3 py-2 hover:bg-gray-50"
                  @click.prevent="onExportCard(group)"
                >
                  导出
                </button>
                <button
                  class="w-full text-left px-3 py-2 hover:bg-gray-50"
                  @click.prevent="onExportZipCard(group)"
                >
                  打包下载
                </button>
                <button
                  class="w-full text-left px-3 py-2 hover:bg-gray-50"
                  @click.prevent="onDedupeCard(group)"
                >
                  去重
                </button>
                <button
                  class="w-full text-left px-3 py-2 hover:bg-gray-50 text-red-600"
                  @click.prevent="$emit('confirmDeleteGroup', group)"
                >
                  删除
                </button>
              </div>
            </div>
            <div v-else class="text-sm text-gray-500">系统分组</div>
          </div>
          <div v-if="dedupeMessageCard[group.id]" class="mt-2 text-sm text-green-600">
            {{ dedupeMessageCard[group.id] }}
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
