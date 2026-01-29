<script setup lang="ts">
import { computed, ref, reactive, onMounted, onUnmounted, inject, type PropType } from 'vue'

import { useEmojiStore } from '../../stores/emojiStore'
import { normalizeImageUrl } from '../../utils/isImageUrl'
import CachedImage from '../../components/CachedImage.vue'
import ViewGroupDetailModal from '../modals/ViewGroupDetailModal.vue'
import BatchRenameModal from '../modals/BatchRenameModal.vue'

import GroupsCardView from './GroupsCardView.vue'
import GroupActionsDropdown from './GroupActionsDropdown.vue'
import DedupeChooser from './DedupeChooser.vue'
import DomainManager from './DomainManager.vue'
import EmojiGrid from './EmojiGrid.vue'
import BatchActionsBar from './BatchActionsBar.vue'

import { TouchDragHandler } from '@/options/utils/touchDragDrop'

const isBatchRenameModalVisible = ref(false)
const selectedEmojis = ref(new Set<string>())

const toggleSelection = (emojiId: string) => {
  if (selectedEmojis.value.has(emojiId)) {
    selectedEmojis.value.delete(emojiId)
  } else {
    selectedEmojis.value.add(emojiId)
  }
}

const selectedCount = computed(() => selectedEmojis.value.size)

const handleSelectAll = () => {
  const allEmojiIds = displayGroups.value
    .filter(group => expandedGroups.has(group.id))
    .flatMap(group => group.emojis.map(emoji => emoji.id))
  selectedEmojis.value = new Set(allEmojiIds)
}

const handleDeselectAll = () => {
  selectedEmojis.value.clear()
}

const handleCancelSelection = () => {
  selectedEmojis.value.clear()
}

const handleBatchRename = () => {
  isBatchRenameModalVisible.value = true
}

// 使用 Map 缓存 emoji 对象，避免嵌套循环
const emojiMap = computed(() => {
  const map = new Map<string, any>()
  for (const group of displayGroups.value) {
    for (const emoji of group.emojis) {
      map.set(emoji.id, emoji)
    }
  }
  return map
})

const selectedEmojiObjects = computed(() => {
  if (selectedEmojis.value.size === 0) return []

  const emojis: any[] = []
  const map = emojiMap.value

  for (const emojiId of selectedEmojis.value) {
    const emoji = map.get(emojiId)
    if (emoji) {
      emojis.push(emoji)
    }
  }
  return emojis
})

const handleApplyBatchRename = (newNames: Record<string, string>) => {
  emojiStore.updateEmojiNames(newNames)
  isBatchRenameModalVisible.value = false
  selectedEmojis.value.clear()
}

const emit = defineEmits([
  'openCreateGroup',
  'groupDragStart',
  'groupDrop',
  'toggleExpand',
  'openEditGroup',
  'telegramUpdate',
  'exportGroup',
  'exportGroupZip',
  'confirmDeleteGroup',
  'openAddEmoji',
  'emojiDragStart',
  'emojiDrop',
  'removeEmoji',
  'imageError',
  'editEmoji',
  'batchUpdateSizeStreaming',
  'exportGroupStreaming',
  'archiveGroup',
  'copyGroupAsMarkdown'
])
// props: only expandedGroups / isImageUrl / activeTab are expected from parent

// 注入流式处理方法
const streamingHandlers = inject('streamingHandlers') as any

// internal view mode for groups tab: 'list' or 'card'
const viewMode = ref<'list' | 'card' | 'domains'>('list')
const viewOptions = reactive([
  { label: '列表', value: 'list' },
  { label: '卡片', value: 'card' },
  { label: '域名', value: 'domains' }
])

const { expandedGroups, isImageUrl } = defineProps({
  expandedGroups: { type: Object as PropType<Set<string>>, required: true },
  isImageUrl: { type: Function }
})

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

// Local drag handlers to annotate dataTransfer so drops can distinguish
// between group reordering drags and emoji drags. This makes it possible
// to drop an emoji onto a group's empty area to append it.
const onGroupDragStartLocal = (group: any, e: DragEvent) => {
  // annotate dataTransfer for group drag
  if (e && e.dataTransfer) {
    try {
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('application/x-group', String(group.id))
    } catch {
      // ignore
    }
  }
  emit('groupDragStart', group, e)
}

const onGroupDropLocal = (group: any, e: DragEvent) => {
  e.preventDefault()
  try {
    if (e.dataTransfer) {
      const emojiData = e.dataTransfer.getData('application/x-emoji')
      if (emojiData) {
        // drop an emoji onto the group (append to end)
        try {
          JSON.parse(emojiData) // validate JSON format
          // emit same shape as emojiDrop used elsewhere: (targetGroupId, targetIndex, event)
          const targetIndex = Array.isArray(group.emojis) ? group.emojis.length : 0
          emit('emojiDrop', group.id, targetIndex, e)
          return
        } catch {
          // ignore parse error and fallback
        }
      }
    }
  } catch {
    // ignore
  }
  // otherwise treat as a group reorder drop
  emit('groupDrop', group, e)
}

const onEmojiDragStartLocal = (emoji: any, groupId: string, index: number, e: DragEvent) => {
  if (e && e.dataTransfer) {
    try {
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('application/x-emoji', JSON.stringify({ groupId, index }))
    } catch {
      // ignore
    }
  }
  emit('emojiDragStart', emoji, groupId, index, e)
}

const onEdit = (group: any) => {
  closeMenu()
  emit('openEditGroup', group)
}

const onTelegramUpdate = (group: any) => {
  closeMenu()
  emit('telegramUpdate', group)
}

const onExport = (group: any) => {
  closeMenu()
  emit('exportGroup', group)
}

const onExportZip = (group: any) => {
  closeMenu()
  emit('exportGroupZip', group)
}

const onAIRename = (group: any) => {
  closeMenu()
  // Select all emojis in the group for batch rename
  const groupEmojis = group.emojis || []
  selectedEmojis.value = new Set(groupEmojis.map((e: any) => e.id))
  isBatchRenameModalVisible.value = true
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
  } catch {
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

const onArchive = (group: any) => {
  closeMenu()
  emit('archiveGroup', group)
}

const onCopyAsMarkdown = (group: any) => {
  closeMenu()
  emit('copyGroupAsMarkdown', group)
}

// --- View Detail Modal ---
const viewDetailModalVisible = ref(false)
const viewDetailGroup = ref<any | null>(null)

const onViewDetail = (group: any) => {
  closeMenu()
  viewDetailGroup.value = group
  viewDetailModalVisible.value = true
}

const closeViewDetailModal = () => {
  viewDetailModalVisible.value = false
  viewDetailGroup.value = null
}

// --- Batch update size modal state & handlers ---
const batchModalVisible = ref(false)
const batchTargetGroup = ref<any | null>(null)

const currentImagePreview = ref<string | null>(null)
const batchProgress = ref({ current: 0, total: 0 })
const batchRunning = ref(false)

const openBatchModal = (group: any) => {
  closeMenu()
  // 直接调用流式处理方法
  if (streamingHandlers?.batchUpdateSizeStreaming) {
    streamingHandlers.batchUpdateSizeStreaming(group)
  } else {
    // 回退到 emit 事件
    emit('batchUpdateSizeStreaming', group)
  }
}

const closeBatchModal = () => {
  batchModalVisible.value = false
  batchTargetGroup.value = null
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

// Domain management moved to `DomainManager.vue`
</script>

<template>
  <div>
    <div class="space-y-8">
      <div class="bg-white rounded-lg shadow-sm border dark:border-gray-700 dark:bg-gray-800">
        <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div class="flex justify-between items-center">
            <div class="flex items-center gap-3">
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white">表情分组管理</h2>
              <div class="ml-4">
                <a-segmented v-model:value="viewMode" :options="viewOptions" />
              </div>
            </div>
            <a-button
              @click="$emit('openCreateGroup')"
              class="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              新建分组
            </a-button>
          </div>
        </div>

        <div class="p-6">
          <div v-if="viewMode === 'list'">
            <div class="space-y-4">
              <div
                v-for="group in displayGroups"
                :key="group.id"
                class="group-item border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                :draggable="group.id !== 'favorites'"
                @dragstart="e => onGroupDragStartLocal(group, e)"
                @dragover.prevent
                @drop="e => onGroupDropLocal(group, e)"
                :ref="el => el && addGroupTouchEvents(el as HTMLElement, group)"
              >
                <div class="flex items-center justify-between p-4" v-if="group.name != '未分组'">
                  <div class="flex items-center gap-3" data-group-move>
                    <div
                      v-if="group.id !== 'favorites'"
                      class="cursor-move text-gray-400 dark:text-white"
                    >
                      ⋮⋮
                    </div>
                    <div v-else class="w-6 text-yellow-500">⭐</div>
                    <div class="text-lg">
                      <template v-if="isImageUrl && isImageUrl(normalizeImageUrl(group.icon))">
                        <CachedImage
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
                    <a-button
                      @click="$emit('toggleExpand', group.id)"
                      class="px-3 py-1 text-sm text-gray-600 hover:bg-gray-50 rounded transition-colors dark:text-white dark:hover:bg-gray-700"
                    >
                      {{ expandedGroups.has(group.id) ? '收起' : '展开' }}
                    </a-button>

                    <!-- Unified action menu (use AntD dropdown) -->
                    <div class="relative" v-if="group.id !== 'favorites'">
                      <GroupActionsDropdown
                        :group="group as any"
                        @edit="onEdit"
                        @telegramUpdate="onTelegramUpdate"
                        @viewDetail="onViewDetail"
                        @export="onExport"
                        @exportZip="onExportZip"
                        @dedupe="onDedupe"
                        @aiRename="onAIRename"
                        @confirmDelete="onDelete"
                        @batchUpdateSize="openBatchModal"
                        @archive="onArchive"
                        @copyAsMarkdown="onCopyAsMarkdown"
                      />
                    </div>
                    <div
                      v-if="dedupeMessage[group.id]"
                      class="ml-2 text-sm text-green-600 dark:text-white"
                    >
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

                <!-- Expanded emoji display with lazy loading -->
                <div
                  v-if="expandedGroups.has(group.id)"
                  class="px-4 pb-4 border-t border-gray-100 dark:border-gray-700"
                >
                  <div class="mt-4">
                    <!-- Add emoji button (hidden for favorites group) -->
                    <div v-if="group.id !== 'favorites'" class="mb-4">
                      <a-button
                        @click="$emit('openAddEmoji', group.id)"
                        class="px-3 py-2 text-sm border border-dashed border-gray-300 rounded-lg hover:border-gray-400 transition-colors w-full dark:border-gray-600 dark:text-white dark:hover:border-gray-500"
                      >
                        + 添加表情
                      </a-button>
                    </div>
                    <!-- For favorites group, show info instead -->
                    <div v-if="group.id === 'favorites'" class="mb-4">
                      <div
                        class="px-3 py-2 text-sm text-gray-500 text-center border border-gray-200 rounded-lg bg-gray-50 dark:text-white dark:border-gray-700 dark:bg-gray-700"
                      >
                        使用表情会自动添加到常用分组
                      </div>
                    </div>

                    <!-- 懒加载表情网格 - 仅展开时渲染 -->
                    <EmojiGrid
                      :emojis="group.emojis || []"
                      :group-id="group.id"
                      :grid-columns="emojiStore.settings.gridColumns"
                      :selected-emojis="selectedEmojis"
                      @toggle-selection="toggleSelection"
                      @edit-emoji="
                        (emoji, groupId, index) => $emit('editEmoji', emoji, groupId, index)
                      "
                      @remove-emoji="(groupId, index) => $emit('removeEmoji', groupId, index)"
                      @emoji-drag-start="
                        (emoji, groupId, index, event) =>
                          onEmojiDragStartLocal(emoji, groupId, index, event)
                      "
                      @emoji-drop="
                        (groupId, index, event) => $emit('emojiDrop', groupId, index, event)
                      "
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div v-if="viewMode === 'card'">
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
        </div>
        <!-- Discourse domains management moved to DomainManager component -->
        <div
          v-if="viewMode === 'domains'"
          class="p-6 border-t border-gray-100 dark:border-gray-700"
        >
          <DomainManager />
        </div>
        <!-- Batch update size modal (自动从 URL 解析尺寸并显示当前图片预览) -->
        <a-modal v-model:open="batchModalVisible" title="批量更新尺寸" :footer="null">
          <div class="space-y-4">
            <div class="flex items-center gap-4">
              <div
                class="w-24 h-24 bg-gray-100 rounded overflow-hidden flex items-center justify-center"
              >
                <CachedImage
                  v-if="currentImagePreview"
                  :src="currentImagePreview"
                  alt="预览"
                  class="w-full h-full object-contain"
                />
                <div v-else class="text-sm text-gray-500">无图片</div>
              </div>
              <div>
                <div class="text-sm text-gray-700 dark:text-white">
                  正在处理：{{ batchProgress.current }} / {{ batchProgress.total }}
                </div>
                <div class="text-xs text-gray-500 dark:text-white mt-1">
                  自动从图片 URL 解析尺寸并写回
                </div>
              </div>
            </div>

            <div>
              <a-progress
                :percent="
                  batchProgress.total
                    ? Math.round((batchProgress.current / batchProgress.total) * 100)
                    : 0
                "
              />
            </div>

            <div class="flex justify-end gap-2">
              <a-button @click="closeBatchModal" :disabled="batchRunning">关闭</a-button>
            </div>
          </div>
        </a-modal>
      </div>
    </div>

    <!-- Batch Actions Bar -->
    <BatchActionsBar
      v-if="selectedCount > 0"
      :selected-count="selectedCount"
      @select-all="handleSelectAll"
      @deselect-all="handleDeselectAll"
      @batch-rename="handleBatchRename"
      @cancel="handleCancelSelection"
    />

    <!-- Dedupe chooser component -->
    <DedupeChooser
      :visible="chooseDedupeFor"
      :previewByNameCount="previewDedupeByNameCount"
      :previewByUrlCount="previewDedupeByUrlCount"
      @update:visible="v => (chooseDedupeFor = v)"
      @confirm="(groupId, mode) => performDedupeChoice(groupId, mode)"
    />

    <!-- View Detail Modal -->
    <ViewGroupDetailModal
      :show="viewDetailModalVisible"
      :groupName="viewDetailGroup?.name || ''"
      :detail="viewDetailGroup?.detail || ''"
      @update:show="closeViewDetailModal"
    />

    <!-- Batch Rename Modal -->
    <BatchRenameModal
      :visible="isBatchRenameModalVisible"
      :selected-emojis="selectedEmojiObjects"
      @close="isBatchRenameModalVisible = false"
      @apply="handleApplyBatchRename"
    />

    <!-- Domain manager handled by DomainManager.vue -->
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
