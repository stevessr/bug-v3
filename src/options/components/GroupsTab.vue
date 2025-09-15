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
import GroupActionsDropdown from './GroupActionsDropdown.vue'
import DedupeChooser from './DedupeChooser.vue'

// computed list that excludes the favorites group so it doesn't appear in group management
const emojiStore = useEmojiStore()
const displayGroups = computed(() => {
  return (emojiStore.sortedGroups || []).filter((g: any) => g.id !== 'favorites')
})

// Touch drag handlers
const groupTouchHandler = ref<TouchDragHandler | null>(null)
const emojiTouchHandler = ref<TouchDragHandler | null>(null)
const openMenu = ref<string | null>(null)
// feedback messages per group id (short-lived)
const dedupeMessage = ref<Record<string, string>>({})

const showDedupeMessage = (groupId: string, msg: string, ms = 2000) => {
  dedupeMessage.value = { ...dedupeMessage.value, [groupId]: msg }
  setTimeout(() => {
    const copy = { ...dedupeMessage.value }
    delete copy[groupId]
    dedupeMessage.value = copy
  }, ms)
}

// ...existing code...

const closeMenu = () => {
  openMenu.value = null
}

const onEdit = (group: any) => {
  closeMenu()
  emit('openEditGroup', group)
}

const onExport = (group: any) => {
  closeMenu()
  emit('exportGroup', group)
}

const onExportZip = (group: any) => {
  closeMenu()
  emit('exportGroupZip', group)
}

const onDedupe = (group: any) => {
  closeMenu()
  // open a small chooser: by name or by url
  chooseDedupeFor.value = group.id
  // compute preview counts for confirmation
  computeDedupePreview(group.id)
}

const chooseDedupeFor = ref<string | null>(null)

// preview counts for the chooser (computed when opening chooser)
const previewDedupeByNameCount = ref<number | null>(null)
const previewDedupeByUrlCount = ref<number | null>(null)

const computeDedupePreview = (groupId: string | null) => {
  previewDedupeByNameCount.value = null
  previewDedupeByUrlCount.value = null
  if (!groupId) return
  try {
    const groups = (emojiStore.sortedGroups || []) as any[]
    const group = groups.find(g => g.id === groupId)
    if (!group || !Array.isArray(group.emojis)) return
    const emojis = group.emojis as any[]

    // by name
    const nameMap = new Map<string, number>()
    for (const e of emojis) {
      const n = String(e?.name ?? '')
      const c = nameMap.get(n) || 0
      nameMap.set(n, c + 1)
    }
    let removedByName = 0
    for (const v of nameMap.values()) if (v > 1) removedByName += v - 1

    // by url (ignore items without url)
    const urlMap = new Map<string, number>()
    for (const e of emojis) {
      const u = e?.url
      if (!u) continue
      const s = String(u)
      const c = urlMap.get(s) || 0
      urlMap.set(s, c + 1)
    }
    let removedByUrl = 0
    for (const v of urlMap.values()) if (v > 1) removedByUrl += v - 1

    previewDedupeByNameCount.value = removedByName
    previewDedupeByUrlCount.value = removedByUrl
  } catch (e) {
    // ignore
  }
}

const performDedupeChoice = (groupId: string | null, mode: 'name' | 'url') => {
  // Accept nullable groupId from template and validate here
  chooseDedupeFor.value = null
  if (!groupId) return
  try {
    let removed = 0
    if (mode === 'name') removed = emojiStore.dedupeGroupByName(groupId)
    else removed = emojiStore.dedupeGroup(groupId)

    if (removed > 0) showDedupeMessage(groupId, `已去重 ${removed} 个表情`)
    else showDedupeMessage(groupId, `未发现重复`)
  } catch {
    // ignore
  }
}

const onDelete = (group: any) => {
  closeMenu()
  emit('confirmDeleteGroup', group)
}

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
    // mark as a valid drop target for touch drag detection
    try {
      element.setAttribute('data-drop-target', 'group')
    } catch {
      // ignore if attribute cannot be set
    }
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
  // mark as a valid drop target and attach touch handler
  try {
    element.setAttribute('data-drop-target', 'emoji')
  } catch {
    // ignore
  }
  emojiTouchHandler.value?.addTouchEvents(element, true)
}
</script>

<template>
  <div>
    <div v-if="activeTab === 'groups'" class="space-y-8">
      <div class="bg-white rounded-lg shadow-sm border dark:border-gray-700 dark:bg-gray-800">
        <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div class="flex justify-between items-center">
            <div class="flex items-center gap-3">
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white">表情分组管理</h2>
              <div class="ml-4 inline-flex rounded-md bg-gray-50 p-1 dark:bg-gray-700">
                <button
                  class="px-3 py-1 text-sm rounded dark:bg-gray-800"
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
                  <div
                    v-if="group.id !== 'favorites'"
                    class="cursor-move text-gray-400 dark:text-gray-400"
                  >
                    ⋮⋮
                  </div>
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
                    <h3 class="font-medium text-gray-900 dark:text-white">
                      {{ group.name }}
                    </h3>
                    <p class="text-sm text-gray-500 dark:text-white">
                      {{ group.emojis?.length || 0 }} 个表情
                    </p>
                  </div>
                </div>
                <div class="flex items-center gap-2">
                  <button
                    @click="$emit('toggleExpand', group.id)"
                    class="px-3 py-1 text-sm text-gray-600 hover:bg-gray-50 rounded transition-colors dark:text-white dark:hover:bg-gray-700"
                  >
                    {{ expandedGroups.has(group.id) ? '收起' : '展开' }}
                  </button>

                  <!-- Unified action menu (use AntD dropdown) -->
                  <div class="relative" v-if="group.id !== 'favorites'">
                    <GroupActionsDropdown
                      :group="group"
                      @edit="onEdit"
                      @export="onExport"
                      @exportZip="onExportZip"
                      @dedupe="onDedupe"
                      @confirmDelete="onDelete"
                    />
                  </div>
                  <div v-if="dedupeMessage[group.id]" class="ml-2 text-sm text-green-600">
                    {{ dedupeMessage[group.id] }}
                  </div>
                  <div
                    v-else-if="group.id === 'favorites'"
                    class="text-sm text-gray-500 dark:text-white px-2"
                  >
                    系统分组
                  </div>
                </div>
              </div>

              <!-- Expanded emoji display -->
              <div
                v-if="expandedGroups.has(group.id)"
                class="px-4 pb-4 border-t border-gray-100 dark:border-gray-700"
              >
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
                        class="aspect-square bg-gray-50 rounded-lg overflow-hidden hover:bg-gray-100 transition-colors dark:bg-gray-700 dark:hover:bg-gray-600"
                      >
                        <img
                          :src="emoji.url"
                          :alt="emoji.name"
                          class="w-full h-full object-cover"
                        />
                      </div>
                      <div class="text-xs text-center text-gray-600 mt-1 truncate dark:text-white">
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
                      class="px-3 py-2 text-sm border border-dashed border-gray-300 rounded-lg hover:border-gray-400 transition-colors w-full dark:border-gray-600 dark:text-white dark:hover:border-gray-500"
                    >
                      + 添加表情
                    </button>
                  </div>
                  <!-- For favorites group, show info instead -->
                  <div v-if="group.id === 'favorites'" class="mt-4">
                    <div
                      class="px-3 py-2 text-sm text-gray-500 text-center border border-gray-200 rounded-lg bg-gray-50 dark:text-white dark:border-gray-700 dark:bg-gray-700"
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
        @toggleExpand="$emit('toggleExpand', $event)"
        @openEditGroup="$emit('openEditGroup', $event)"
        @exportGroup="$emit('exportGroup', $event)"
        @imageError="$emit('imageError', $event)"
      />
    </div>
    <!-- Dedupe chooser component -->
    <DedupeChooser
      :visible="chooseDedupeFor"
      :previewByNameCount="previewDedupeByNameCount"
      :previewByUrlCount="previewDedupeByUrlCount"
      @update:visible="v => (chooseDedupeFor = v)"
      @confirm="(groupId, mode) => performDedupeChoice(groupId, mode)"
    />
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
