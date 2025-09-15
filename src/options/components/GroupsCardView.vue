<script setup lang="ts">
import { computed, type PropType, ref } from 'vue'

import { normalizeImageUrl } from '../../utils/isImageUrl'
import { useEmojiStore } from '../../stores/emojiStore'

import GroupActionsDropdown from './GroupActionsDropdown.vue'

type Group = {
  id: string
  name: string
  icon?: string
  emojis?: Array<unknown>
}

const { displayGroups, isImageUrl, touchRefFn } = defineProps({
  displayGroups: { type: Array as PropType<Group[]>, required: true },
  // accept a generic Function to match parent's optional signature
  isImageUrl: { type: Function as PropType<Function> },
  // function used to attach touch drag events from parent; accepts nullable el
  touchRefFn: {
    type: Function as PropType<((el: HTMLElement | null, group: Group) => void) | undefined>
  }
})

const emit = defineEmits([
  'groupDragStart',
  'groupDrop',
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

// ...existing code...

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

// Touch drag state & helpers
const touchState = ref<{
  active: boolean
  groupId: string | null
  startX: number
  startY: number
  dragging: boolean
}>({
  active: false,
  groupId: null,
  startX: 0,
  startY: 0,
  dragging: false
})

// visual drag state for feedback
const draggingId = ref<string | null>(null)
const dropTargetId = ref<string | null>(null)

// floating ghost element shown during touch drag
const ghostEl = ref<HTMLElement | null>(null)

const createDragGhost = (group: Group, x: number, y: number) => {
  removeDragGhost()
  const el = document.createElement('div')
  el.className = 'touch-drag-ghost'
  el.setAttribute('data-ghost-for', group.id)
  // basic inner content: image if available else name
  if (isImageUrl && isImageUrl(normalizeImageUrl(group.icon))) {
    const img = document.createElement('img')
    img.src = normalizeImageUrl(group.icon) || ''
    img.alt = group.name || ''
    el.appendChild(img)
  } else {
    el.textContent = group.icon || group.name || ''
  }
  document.body.appendChild(el)
  ghostEl.value = el
  updateDragGhost(x, y)
}

const updateDragGhost = (x: number, y: number) => {
  if (!ghostEl.value) return
  // place ghost centered under touch
  ghostEl.value.style.left = `${x}px`
  ghostEl.value.style.top = `${y}px`
}

const removeDragGhost = () => {
  if (ghostEl.value && ghostEl.value.parentNode) {
    ghostEl.value.parentNode.removeChild(ghostEl.value)
  }
  ghostEl.value = null
}

// HTML5 mouse drag handlers
const onDragStart = (group: Group, e: DragEvent) => {
  draggingId.value = group.id
  // inform parent (keeps previous contract)
  emit('groupDragStart', group, e)
  if (e.dataTransfer) {
    try {
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', group.id)
    } catch {
      // some environments may restrict setData
    }
  }
}

const onDragOver = (group: Group, e: DragEvent) => {
  e.preventDefault()
  dropTargetId.value = group.id
}

const onDragLeave = (_group: Group, _e: DragEvent) => {
  dropTargetId.value = null
}

const onDrop = (group: Group, e: DragEvent) => {
  e.preventDefault()
  // emit drop to parent; parent uses its own draggedGroup state
  emit('groupDrop', group, e)
  dropTargetId.value = null
  draggingId.value = null
}

const onDragEnd = (_e: DragEvent) => {
  draggingId.value = null
  dropTargetId.value = null
}

const getGroupById = (id: string | null) => {
  if (!id) return null
  return displayGroups.find(g => g.id === id) as Group | undefined
}

const findGroupIdFromPoint = (x: number, y: number) => {
  const el = document.elementFromPoint(x, y) as HTMLElement | null
  if (!el) return null
  const groupEl = el.closest('[data-group-id]') as HTMLElement | null
  if (!groupEl) return null
  return groupEl.getAttribute('data-group-id')
}

const onTouchStart = (group: Group, e: TouchEvent) => {
  const t = e.changedTouches[0]
  touchState.value = {
    active: true,
    groupId: group.id,
    startX: t.clientX,
    startY: t.clientY,
    dragging: false
  }
}

const onTouchMove = (group: Group, e: TouchEvent) => {
  if (!touchState.value.active || touchState.value.groupId !== group.id) return
  const t = e.changedTouches[0]
  const dx = t.clientX - touchState.value.startX
  const dy = t.clientY - touchState.value.startY
  const dist = Math.sqrt(dx * dx + dy * dy)
  const THRESHOLD = 8
  if (!touchState.value.dragging && dist > THRESHOLD) {
    touchState.value.dragging = true
    // wrap the original TouchEvent so downstream handlers get an Event-like object with preventDefault
    const wrappedStartEvent = {
      originalEvent: e,
      clientX: t.clientX,
      clientY: t.clientY,
      preventDefault: () => {
        if (e && typeof e.preventDefault === 'function' && e.cancelable) {
          try {
            e.preventDefault()
          } catch {
            // ignore
          }
        }
      }
    }
    emit('groupDragStart', group, wrappedStartEvent)
    // start visual dragging state and reuse drag start handler logic
    draggingId.value = group.id
    // call onDragStart so behavior mirrors mouse drag
    try {
      onDragStart(group, wrappedStartEvent as unknown as DragEvent)
    } catch {
      // no-op if cast isn't a real DragEvent
    }
    // create a floating preview for touch drag
    createDragGhost(group, t.clientX, t.clientY)
  }
  if (touchState.value.dragging) {
    // update drop target under current touch point for live feedback
    const curTargetId = findGroupIdFromPoint(t.clientX, t.clientY)
    dropTargetId.value = curTargetId
    // update floating ghost position if present
    updateDragGhost(t.clientX, t.clientY)
    // attempt to prevent page scroll while dragging, but check cancelable to avoid passive-listener warning
    if (e && typeof e.preventDefault === 'function' && e.cancelable) {
      try {
        e.preventDefault()
      } catch {
        // ignore
      }
    }
  }
}

const onTouchEnd = (group: Group, e: TouchEvent) => {
  if (!touchState.value.active) return
  const t = e.changedTouches[0]
  if (touchState.value.dragging) {
    // find target group under touch end point
    const targetId = findGroupIdFromPoint(t.clientX, t.clientY)
    const targetGroup = getGroupById(targetId) || group
    const wrappedEndEvent = {
      originalEvent: e,
      clientX: t.clientX,
      clientY: t.clientY,
      preventDefault: () => {
        if (e && typeof e.preventDefault === 'function' && e.cancelable) {
          try {
            e.preventDefault()
          } catch {
            // ignore
          }
        }
      }
    }
    emit('groupDrop', targetGroup, wrappedEndEvent)
    // visual feedback: mark drop target and clear dragging
    dropTargetId.value = targetGroup?.id || null
    // try to reuse drop handler logic
    try {
      onDrop(targetGroup, wrappedEndEvent as unknown as DragEvent)
    } catch {
      // fallback
      draggingId.value = null
      setTimeout(() => {
        dropTargetId.value = null
      }, 220)
    }
    // remove ghost and call drag end logic
    removeDragGhost()
    try {
      onDragEnd(wrappedEndEvent as unknown as DragEvent)
    } catch {
      // ignore
    }
  }
  touchState.value = { active: false, groupId: null, startX: 0, startY: 0, dragging: false }
}

const onTouchCancel = (_e: TouchEvent) => {
  touchState.value = { active: false, groupId: null, startX: 0, startY: 0, dragging: false }
  draggingId.value = null
  dropTargetId.value = null
  removeDragGhost()
}
</script>

<template>
  <div class="space-y-6">
    <div class="grid gap-4" :style="{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }">
      <div
        v-for="group in displayGroups"
        :key="group.id"
        class="group-card"
        :class="{
          'is-dragging': draggingId === group.id,
          'is-drop-target': dropTargetId === group.id
        }"
        :draggable="group.id !== 'favorites'"
        :ref="el => touchRefFn && touchRefFn(el as HTMLElement | null, group)"
        :data-group-id="group.id"
        @touchstart.prevent="onTouchStart(group, $event)"
        @touchmove="onTouchMove(group, $event)"
        @touchend="onTouchEnd(group, $event)"
        @touchcancel="onTouchCancel($event)"
      >
        <ACard
          hoverable
          :class="{
            'card-dragging': draggingId === group.id,
            'card-target': dropTargetId === group.id,
            'cursor-move': group.id !== 'favorites'
          }"
          class="relative"
          :draggable="group.id !== 'favorites'"
          :data-group-move="group.id !== 'favorites' ? '' : null"
          @dragstart="onDragStart(group, $event)"
          @dragover.prevent="onDragOver(group, $event)"
          @dragleave="onDragLeave(group, $event)"
          @drop="onDrop(group, $event)"
        >
          <!-- drag handle used to show visual affordance; actual touch-drag start now bound to the whole card via data-group-move on ACard -->
          <div class="absolute top-2 left-2 z-10">
            <div v-if="group.id !== 'favorites'" class="text-gray-400">⋮⋮</div>
            <div v-else class="text-yellow-500">⭐</div>
          </div>

          <div class="flex items-center justify-center bg-gray-50 dark:bg-gray-700 h-20">
            <div class="w-full flex items-center justify-center p-2">
              <a-image
                v-if="isImageUrl && isImageUrl(normalizeImageUrl(group.icon))"
                :src="normalizeImageUrl(group.icon)"
                alt="icon"
                class="max-w-full object-contain"
                @error="$emit('imageError', $event)"
              />
              <div v-else class="text-2xl">{{ group.icon }}</div>
            </div>
          </div>
          <a-card-meta :title="group.name">
            <div class="text-sm text-gray-500">{{ group.emojis?.length || 0 }} 个表情</div>
          </a-card-meta>
          <div class="mt-3 flex gap-2">
            <div v-if="group.id !== 'favorites'" class="relative">
              <GroupActionsDropdown
                :group="group"
                @edit="onEditCard"
                @export="onExportCard"
                @exportZip="onExportZipCard"
                @dedupe="onDedupeCard"
                @confirmDelete="g => $emit('confirmDeleteGroup', g)"
              />
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

.is-dragging {
  opacity: 0.7;
  transform: scale(0.98);
}

.is-drop-target {
  outline: 2px dashed rgba(59, 130, 246, 0.5); /* blue dashed */
  border-radius: 6px;
}

.card-dragging {
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.12);
  transition:
    transform 120ms ease,
    box-shadow 120ms ease;
}

.card-target {
  border: 2px solid rgba(59, 130, 246, 0.2);
}
</style>
