<script setup lang="ts">
const emit = defineEmits([
  'open-create-group',
  'group-dragstart',
  'group-drop',
  'toggle-expand',
  'open-edit-group',
  'export-group',
  'confirm-delete-group',
  'open-add-emoji',
  'emoji-drag-start',
  'emoji-drop',
  'remove-emoji',
  'image-error',
  'edit-emoji'
])

const props = defineProps<{
  emojiStore: any
  expandedGroups: Set<string>
  isImageUrl?: (s: string) => boolean
  activeTab?: string
}>()

import { computed, ref, onMounted, onUnmounted } from 'vue'

import { TouchDragHandler } from '../../utils/touchDragDrop'

// computed list that excludes the favorites group so it doesn't appear in group management
const displayGroups = computed(() => {
  return (props.emojiStore?.sortedGroups || []).filter((g: any) => g.id !== 'favorites')
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
          emit('group-dragstart', groupData, syntheticEvent)
        }
      } catch (err) {
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
        try {
          const groupData = (element as any).__groupData
          const targetData = (dropTarget as any).__groupData
          if (groupData && targetData && groupData.id !== targetData.id) {
            // Create synthetic drag event for compatibility
            const syntheticEvent = new DragEvent('drop')
            emit('group-drop', targetData, syntheticEvent)
          }
        } catch (error) {
          console.error('Error in group touch drop:', error)
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
            'emoji-drag-start',
            emojiData.emoji,
            emojiData.groupId,
            emojiData.index,
            syntheticEvent
          )
        }
      } catch (err) {
        // ignore
      }
    },
    onDragEnd: (element, dropTarget) => {
      element.classList.remove('touch-dragging')
      if (dropTarget) {
        try {
          const emojiData = (element as any).__emojiData
          const targetData = (dropTarget as any).__emojiData
          if (emojiData && targetData) {
            // Create synthetic drag event for compatibility
            const syntheticEvent = new DragEvent('drop')
            emit('emoji-drop', targetData.groupId, targetData.index, syntheticEvent)
          }
        } catch (error) {
          console.error('Error in emoji touch drop:', error)
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
const addGroupTouchEvents = (element: HTMLElement, group: any) => {
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
  <div v-if="activeTab === 'groups'" class="space-y-8">
    <div class="bg-white rounded-lg shadow-sm border">
      <div class="px-6 py-4 border-b border-gray-200">
        <div class="flex justify-between items-center">
          <h2 class="text-lg font-semibold text-gray-900">表情分组管理</h2>
          <button
            @click.stop="emit('open-create-group')"
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
            @dragstart="emit('group-dragstart', group, $event)"
            @dragover.prevent
            @drop="emit('group-drop', group, $event)"
            :ref="el => el && addGroupTouchEvents(el as HTMLElement, group)"
          >
            <div class="flex items-center justify-between p-4" v-if="group.name != '未分组'">
              <div class="flex items-center gap-3" data-group-move>
                <div v-if="group.id !== 'favorites'" class="cursor-move text-gray-400">⋮⋮</div>
                <div v-else class="w-6 text-yellow-500">⭐</div>
                <div class="text-lg">
                  <template v-if="isImageUrl && isImageUrl(group.icon)">
                    <img
                      :src="group.icon"
                      alt="group icon"
                      class="w-6 h-6 object-contain rounded"
                      @error="emit('image-error', $event)"
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
                  @click.stop="emit('toggle-expand', group.id)"
                  class="px-3 py-1 text-sm text-gray-600 hover:bg-gray-50 rounded transition-colors"
                >
                  {{ expandedGroups.has(group.id) ? '收起' : '展开' }}
                </button>
                <button
                  v-if="group.id !== 'favorites'"
                  @click.stop="emit('open-edit-group', group)"
                  class="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded transition-colors"
                >
                  编辑
                </button>
                <button
                  @click.stop="emit('export-group', group)"
                  class="px-3 py-1 text-sm text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                >
                  导出
                </button>
                <button
                  v-if="group.id !== 'favorites' && group.id !== 'nachoneko'"
                  @click.stop="emit('confirm-delete-group', group)"
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
                    @dragstart="emit('emoji-drag-start', emoji, group.id, index, $event)"
                    @dragover.prevent
                    @drop="emit('emoji-drop', group.id, index, $event)"
                    :ref="
                      el => el && addEmojiTouchEvents(el as HTMLElement, emoji, group.id, index)
                    "
                  >
                    <div
                      class="aspect-square bg-gray-50 rounded-lg overflow-hidden hover:bg-gray-100 transition-colors"
                    >
                      <img :src="emoji.url" :alt="emoji.name" class="w-full h-full object-cover" />
                    </div>
                    <div class="text-xs text-center text-gray-600 mt-1 truncate">
                      {{ emoji.name }}
                    </div>
                    <!-- Edit button in bottom right corner -->
                    <button
                      @click.stop="emit('edit-emoji', emoji, group.id, index)"
                      class="absolute bottom-1 right-1 w-4 h-4 bg-blue-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                      title="编辑表情"
                    >
                      ✎
                    </button>
                    <!-- Remove button in top right corner -->
                    <button
                      @click.stop="emit('remove-emoji', group.id, index)"
                      class="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      ×
                    </button>
                  </div>
                </div>

                <!-- Add emoji button (hidden for favorites group) -->
                <div v-if="group.id !== 'favorites'" class="mt-4">
                  <button
                    @click="emit('open-add-emoji', group.id)"
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
