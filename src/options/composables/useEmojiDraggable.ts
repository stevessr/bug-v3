import { ref } from 'vue'

import type { Emoji, EmojiGroup } from '@/types/type'

/**
 * 拖拽功能 Composable
 * 负责管理分组和表情的拖拽状态及事件处理
 */
export function useEmojiDraggable(options: {
  onGroupReordered: (fromGroupId: string, toGroupId: string) => Promise<void>
  onEmojiMoved: (fromGroupId: string, fromIndex: number, toGroupId: string, toIndex: number) => void
  showError: (message: string) => void
  showSuccess: (message: string) => void
}) {
  const { onGroupReordered, onEmojiMoved, showError, showSuccess } = options

  // --- Group Drag State ---
  const draggedGroup = ref<EmojiGroup | null>(null)

  // --- Emoji Drag State ---
  const draggedEmoji = ref<Emoji | null>(null)
  const draggedEmojiGroupId = ref<string>('')
  const draggedEmojiIndex = ref<number>(-1)

  // --- Group Drag Handlers ---

  /**
   * 开始拖拽分组
   */
  const handleDragStart = (group: EmojiGroup, event: DragEvent) => {
    // 常用分组不允许移动
    if (group.id === 'favorites') {
      event.preventDefault()
      showError('常用分组不能移动位置')
      return
    }
    draggedGroup.value = group
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move'
    }
  }

  /**
   * 放置分组（重新排序）
   */
  const handleDrop = async (targetGroup: EmojiGroup, event: DragEvent) => {
    event.preventDefault()

    // 不能移动到常用分组位置
    if (targetGroup.id === 'favorites') {
      showError('不能移动到常用分组位置')
      draggedGroup.value = null
      return
    }

    // 执行重排序
    if (draggedGroup.value && draggedGroup.value.id !== targetGroup.id) {
      await onGroupReordered(draggedGroup.value.id, targetGroup.id)
      showSuccess('分组顺序已更新')
    }

    // 重置拖拽状态
    draggedGroup.value = null
  }

  // --- Emoji Drag Handlers ---

  /**
   * 开始拖拽表情
   */
  const handleEmojiDragStart = (emoji: Emoji, groupId: string, index: number, event: DragEvent) => {
    draggedEmoji.value = emoji
    draggedEmojiGroupId.value = groupId
    draggedEmojiIndex.value = index
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move'
    }
  }

  /**
   * 放置表情（移动到新位置）
   */
  const handleEmojiDrop = (targetGroupId: string, targetIndex: number, event: DragEvent) => {
    event.preventDefault()

    if (draggedEmoji.value && draggedEmojiGroupId.value) {
      onEmojiMoved(draggedEmojiGroupId.value, draggedEmojiIndex.value, targetGroupId, targetIndex)
      showSuccess('表情已移动')
    }

    resetEmojiDrag()
  }

  /**
   * 重置表情拖拽状态
   */
  const resetEmojiDrag = () => {
    try {
      draggedEmoji.value = null
      draggedEmojiGroupId.value = ''
      draggedEmojiIndex.value = -1

      // 清除 DOM 中的拖拽相关属性
      try {
        const els = document.querySelectorAll('[data-dragging="true"]')
        els.forEach(el => el.removeAttribute('data-dragging'))
      } catch {
        // ignore
      }
    } catch {
      // ignore
    }
  }

  return {
    // State
    draggedGroup,
    draggedEmoji,
    draggedEmojiGroupId,
    draggedEmojiIndex,

    // Group drag handlers
    handleDragStart,
    handleDrop,

    // Emoji drag handlers
    handleEmojiDragStart,
    handleEmojiDrop,
    resetEmojiDrag
  }
}
