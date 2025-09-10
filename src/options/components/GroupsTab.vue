<script setup lang="ts">
/* eslint-disable @typescript-eslint/no-explicit-any */
const emit = defineEmits([
  'openCreateGroup',
  'groupDragStart',
  'groupDrop',
  'toggleExpand',
  'openEditGroup',
  'exportGroup',
  'exportGroupZip',
  'confirmDeleteGroup',
  'openAddEmoji',
  'emojiDragStart',
  'emojiDrop',
  'removeEmoji',
  'imageError',
  'editEmoji',
  'changeTab',
  'update:activeTab'
])
// props: only expandedGroups / isImageUrl / activeTab are expected from parent
import { computed, ref, onMounted, onUnmounted, type PropType } from 'vue'

function setTab(tab: string) {
  emit('changeTab', tab)
  emit('update:activeTab', tab)
}

const { expandedGroups, activeTab, isImageUrl } = defineProps({
  expandedGroups: { type: Object as PropType<Set<string>>, required: true },
  isImageUrl: { type: Function },
  activeTab: { type: String }
})

import { useEmojiStore } from '../../stores/emojiStore'
import { TouchDragHandler } from '../../utils/touchDragDrop'
import { normalizeImageUrl } from '../../utils/isImageUrl'

import GroupsCardView from './GroupsCardView.vue'

// computed list that excludes the favorites group so it doesn't appear in group management
const emojiStore = useEmojiStore()
const displayGroups = computed(() => {
  return (emojiStore.sortedGroups || []).filter((g: any) => g.id !== 'favorites')
})

// Touch drag handlers
const groupTouchHandler = ref<TouchDragHandler | null>(null)
const emojiTouchHandler = ref<TouchDragHandler | null>(null)

onMounted(() => {
  // Initialize touch handlers
  groupTouchHandler.value = new TouchDragHandler({
    onDragStart: element => {
      const groupData = (element as any).__groupData
      if (groupData && groupData.id !== 'favorites') {
        element.classList.add('touch-dragging')
      }
      // Emit synthetic dragstart so Options composable knows which group is being dragged
      try {
        const groupData = (element as any).__groupData
        if (groupData) {
          const syntheticEvent = new DragEvent('dragstart')
          emit('groupDragStart', groupData, syntheticEvent)
        }
      } catch {
        // ignore synthetic event creation errors in older browsers
      }
    },
    // Only start group dragging if the initial touch is on the move handle (.cursor-move)
    shouldStartDrag: (e: TouchEvent, element: HTMLElement) => {
      // Walk the event target's node chain (covers text nodes) up to the group element
      let node: Node | null = e.target as Node | null
      while (node && node !== element) {
        if (node instanceof Element && node.hasAttribute && node.hasAttribute('data-group-move'))
          return true
        node = node.parentNode
      }
      return false
    },
    onDragEnd: (element, dropTarget) => {
      element.classList.remove('touch-dragging')
      if (dropTarget) {
        const groupData = (element as any).__groupData
        const targetData = (dropTarget as any).__groupData
        if (groupData && targetData && groupData.id !== targetData.id) {
          // Create synthetic drag event for compatibility
          const syntheticEvent = new DragEvent('drop')
          emit('groupDrop', targetData, syntheticEvent)
        }
      }
    }
  })

  emojiTouchHandler.value = new TouchDragHandler({
    onDragStart: element => {
      element.classList.add('touch-dragging')
      // Emit synthetic dragstart so Options composable knows which emoji is being dragged
      try {
        const emojiData = (element as any).__emojiData
        if (emojiData) {
          const syntheticEvent = new DragEvent('dragstart')
          emit(
            'emojiDragStart',
            emojiData.emoji,
            emojiData.groupId,
            emojiData.index,
            syntheticEvent
          )
        }
      } catch {
        // ignore
      }
    },
    onDragEnd: (element, dropTarget) => {
      element.classList.remove('touch-dragging')
      if (dropTarget) {
        const emojiData = (element as any).__emojiData
        const targetData = (dropTarget as any).__emojiData
        if (emojiData && targetData) {
          // Create synthetic drag event for compatibility
          const syntheticEvent = new DragEvent('drop')
          emit('emojiDrop', targetData.groupId, targetData.index, syntheticEvent)
        }
      }
    }
  })
})

onUnmounted(() => {
  groupTouchHandler.value?.destroy()
  emojiTouchHandler.value?.destroy()
})

// Function to add touch events to group elements
// Accept nullable element because Vue ref callbacks may be invoked with null
const addGroupTouchEvents = (element: HTMLElement | null, group: any) => {
  if (!element) return
  if (group.id !== 'favorites') {
    ;(element as any).__groupData = group
    groupTouchHandler.value?.addTouchEvents(element, true)
  }
}

// Function to add touch events to emoji elements
const addEmojiTouchEvents = (element: HTMLElement, emoji: any, groupId: string, index: number) => {
  ;(element as any).__emojiData = { emoji, groupId, index }
  // Prevent touchstart on emoji from bubbling up and starting a group drag
  const stopTouch = (e: TouchEvent) => {
    e.stopPropagation()
  }
  element.addEventListener('touchstart', stopTouch, { passive: false })
  // store reference so it can be removed later if needed
  ;(element as any).__stopEmojiTouch = stopTouch
  emojiTouchHandler.value?.addTouchEvents(element, true)
}
</script>

<template>
  <div>
    <div v-if="activeTab === 'groups'" class="space-y-8">
      <div class="bg-white rounded-lg shadow-sm border">
        <div class="px-6 py-4 border-b border-gray-200">
          <div class="flex justify-between items-center">
            <div class="flex items-center gap-3">
              <h2 class="text-lg font-semibold text-gray-900">表情分组管理</h2>
              <div class="ml-4 inline-flex rounded-md bg-gray-50 p-1">
                <button
                  class="px-3 py-1 text-sm rounded"
                  @click="setTab('groups')"
                  :class="{ 'bg-white shadow': (activeTab as any) === 'groups' }"
                >
                  列表
                </button>
                <button
                  class="px-3 py-1 text-sm rounded"
                  @click="setTab('groups-card')"
                  :class="{ 'bg-white shadow': (activeTab as any) === 'groups-card' }"
                >
                  卡片
                </button>
              </div>
            </div>
            <button
              @click="$emit('openCreateGroup')"
              class="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              新建分组
            </button>
          </div>
        </div>

        <div class="p-6">
          <div class="space-y-4">
            <div
              v-for="group in displayGroups"
              :key="group.id"
              class="group-item border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
              :draggable="group.id !== 'favorites'"
              @dragstart="$emit('groupDragStart', group, $event)"
              @dragover.prevent
              @drop="$emit('groupDrop', group, $event)"
              :ref="el => el && addGroupTouchEvents(el as HTMLElement, group)"
            >
              <div class="flex items-center justify-between p-4" v-if="group.name != '未分组'">
                <div class="flex items-center gap-3" data-group-move>
                  <div v-if="group.id !== 'favorites'" class="cursor-move text-gray-400">⋮⋮</div>
                  <div v-else class="w-6 text-yellow-500">⭐</div>
                  <div class="text-lg">
                    <template v-if="isImageUrl && isImageUrl(normalizeImageUrl(group.icon))">
                      <img
                        :src="normalizeImageUrl(group.icon)"
                        alt="group icon"
                        class="w-6 h-6 object-contain rounded"
                        @error="$emit('imageError', $event)"
                      />
                    </template>
                    <template v-else>
                      {{ group.icon }}
                    </template>
                  </div>
                  <div>
                    <h3 class="font-medium text-gray-900">
                      {{ group.name }}
                    </h3>
                    <p class="text-sm text-gray-500">{{ group.emojis?.length || 0 }} 个表情</p>
                  </div>
                </div>
                <div class="flex items-center gap-2">
                  <button
                    @click="$emit('toggleExpand', group.id)"
                    class="px-3 py-1 text-sm text-gray-600 hover:bg-gray-50 rounded transition-colors"
                  >
                    {{ expandedGroups.has(group.id) ? '收起' : '展开' }}
                  </button>
                  <button
                    v-if="group.id !== 'favorites'"
                    @click="$emit('openEditGroup', group)"
                    class="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded transition-colors"
                  >
                    编辑
                  </button>
                  <button
                    @click="$emit('exportGroup', group)"
                    class="px-3 py-1 text-sm text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                  >
                    导出
                  </button>
                  <button
                    @click="$emit('exportGroupZip', group)"
                    class="px-3 py-1 text-sm text-green-600 hover:bg-green-50 rounded transition-colors"
                  >
                    打包下载
                  </button>
                  <button
                    v-if="group.id !== 'favorites' && group.id !== 'nachoneko'"
                    @click="$emit('confirmDeleteGroup', group)"
                    class="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded transition-colors"
                  >
                    删除
                  </button>
                </div>
              </div>

              <!-- Expanded emoji display -->
              <div v-if="expandedGroups.has(group.id)" class="px-4 pb-4 border-t border-gray-100">
                <div class="mt-4">
                  <div
                    class="grid gap-3"
                    :style="{
                      gridTemplateColumns: `repeat(${emojiStore.settings.gridColumns}, minmax(0, 1fr))`
                    }"
                  >
                    <div
                      v-for="(emoji, index) in group.emojis"
                      :key="`${group.id}-${index}`"
                      class="emoji-item relative group cursor-move"
                      :draggable="true"
                      @dragstart="$emit('emojiDragStart', emoji, group.id, index, $event)"
                      @dragover.prevent
                      @drop="$emit('emojiDrop', group.id, index, $event)"
                      :ref="
                        el => el && addEmojiTouchEvents(el as HTMLElement, emoji, group.id, index)
                      "
                    >
                      <div
                        class="aspect-square bg-gray-50 rounded-lg overflow-hidden hover:bg-gray-100 transition-colors"
                      >
                        <img
                          :src="emoji.url"
                          :alt="emoji.name"
                          class="w-full h-full object-cover"
                        />
                      </div>
                      <div class="text-xs text-center text-gray-600 mt-1 truncate">
                        {{ emoji.name }}
                      </div>
                      <!-- Edit button in bottom right corner -->
                      <button
                        @click="$emit('editEmoji', emoji, group.id, index)"
                        class="absolute bottom-1 right-1 w-4 h-4 bg-blue-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                        title="编辑表情"
                      >
                        ✎
                      </button>
                      <!-- Remove button in top right corner -->
                      <button
                        @click="$emit('removeEmoji', group.id, index)"
                        class="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        ×
                      </button>
                    </div>
                  </div>

                  <!-- Add emoji button (hidden for favorites group) -->
                  <div v-if="group.id !== 'favorites'" class="mt-4">
                    <button
                      @click="$emit('openAddEmoji', group.id)"
                      class="px-3 py-2 text-sm border border-dashed border-gray-300 rounded-lg hover:border-gray-400 transition-colors w-full"
                    >
                      + 添加表情
                    </button>
                  </div>
                  <!-- For favorites group, show info instead -->
                  <div v-if="group.id === 'favorites'" class="mt-4">
                    <div
                      class="px-3 py-2 text-sm text-gray-500 text-center border border-gray-200 rounded-lg bg-gray-50"
                    >
                      使用表情会自动添加到常用分组
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Card view for groups (moved to separate component) -->
    <div v-else-if="activeTab === 'groups-card'">
      <GroupsCardView
        :displayGroups="displayGroups"
        :isImageUrl="isImageUrl"
        :expandedGroups="expandedGroups"
        :touchRefFn="addGroupTouchEvents"
        @groupDragStart="(...args) => $emit('groupDragStart', ...args)"
        @groupDrop="(...args) => $emit('groupDrop', ...args)"
        @toggleExpand="(...args) => $emit('toggleExpand', ...args)"
        @openEditGroup="(...args) => $emit('openEditGroup', ...args)"
        @exportGroup="(...args) => $emit('exportGroup', ...args)"
        @imageError="(...args) => $emit('imageError', ...args)"
      />
    </div>
  </div>
</template>

<style scoped>
.group-item.touch-dragging {
  opacity: 0.6;
  transform: scale(0.95);
  transition:
    opacity 0.2s,
    transform 0.2s;
}

.emoji-item.touch-dragging {
  opacity: 0.6;
  transform: scale(0.9);
  transition:
    opacity 0.2s,
    transform 0.2s;
}

.touch-drag-preview {
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  border-radius: 8px;
}

/* Enhanced touch targets for mobile */
@media (max-width: 768px) {
  .emoji-item {
    margin: 4px;
  }

  .emoji-item button {
    opacity: 1; /* Always show buttons on mobile */
  }
}
</style>
