<template>
  <div class="virtual-group-emojis">
    <div class="group-header mb-4">
      <slot name="header" />
    </div>
    
    <!-- 表情计数和设置 -->
    <div class="flex items-center justify-between mb-4">
      <div class="text-sm text-gray-600 dark:text-gray-300">
        共 {{ totalEmojis }} 个表情
      </div>
      <div></div>
    </div>

    <!-- 始终使用虚拟滚动网格 -->
    <VirtualEmojiGrid
      ref="virtualGridRef"
      :emojis="formattedEmojis"
      :grid-columns="localGridColumns"
      :container-height="containerHeight"
      :item-height="itemHeight"
      :overscan="overscan"
      @edit-emoji="handleEditEmoji"
      @remove-emoji="handleRemoveEmoji"
      @emoji-drag-start="handleEmojiDragStart"
      @emoji-drop="handleEmojiDrop"
    />

    
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, inject } from 'vue'
import VirtualEmojiGrid from './VirtualEmojiGrid.vue'
import type { Emoji, EmojiGroup } from '../../types/emoji'

interface Props {
  groups: EmojiGroup[]
  expandedGroups: Set<string>
  gridColumns?: number
  virtualizationThreshold?: number // 超过此数量才启用虚拟滚动
  containerHeight?: number
  itemHeight?: number
  overscan?: number
}

const props = withDefaults(defineProps<Props>(), {
  gridColumns: 4,
  virtualizationThreshold: 100, // 超过 100 个表情启用虚拟滚动
  containerHeight: 500,
  itemHeight: 120,
  overscan: 3,
  
})

const emit = defineEmits<{
  editEmoji: [emoji: Emoji, groupId: string, index: number]
  removeEmoji: [groupId: string, index: number]
  emojiDragStart: [emoji: Emoji, groupId: string, index: number, event: DragEvent]
  emojiDrop: [groupId: string, index: number, event: DragEvent]
}>()

// 注入 options 上下文获取设置
const options = inject('options') as any

// Refs
const virtualGridRef = ref<InstanceType<typeof VirtualEmojiGrid>>()

// Use global store setting for columns when available to keep in sync with Settings page
const localGridColumns = computed(() => {
  try {
    return options?.emojiStore?.settings?.gridColumns ?? props.gridColumns
  } catch {
    return props.gridColumns
  }
})

// 计算展开的表情
const expandedEmojis = computed(() => {
  return props.groups.filter(group => 
    props.expandedGroups.has(group.id) && group.emojis && group.emojis.length > 0
  )
})

// 格式化表情数据给虚拟滚动使用
const formattedEmojis = computed(() => {
  return expandedEmojis.value.map(group => ({
    groupId: group.id,
    emojis: group.emojis || []
  }))
})

// flatEmojis removed — we always use virtualized grid

// 计算总表情数
const totalEmojis = computed(() => {
  return expandedEmojis.value.reduce((total, group) => 
    total + (group.emojis?.length || 0), 0
  )
})

// (性能统计已移除)

// 事件处理
const handleEditEmoji = (emoji: Emoji, groupId: string, index: number) => {
  emit('editEmoji', emoji, groupId, index)
}

const handleRemoveEmoji = (groupId: string, index: number) => {
  emit('removeEmoji', groupId, index)
}

const handleEmojiDragStart = (emoji: Emoji, groupId: string, index: number, event: DragEvent) => {
  emit('emojiDragStart', emoji, groupId, index, event)
}

const handleEmojiDrop = (groupId: string, index: number, event: DragEvent) => {
  emit('emojiDrop', groupId, index, event)
}

// 滚动控制
const scrollToTop = () => {
  if (virtualGridRef.value) {
    virtualGridRef.value.scrollToItem(0)
  }
}

const scrollToEmoji = (groupId: string, emojiIndex: number) => {
  let globalIndex = 0
  
  for (const group of expandedEmojis.value) {
    if (group.id === groupId) {
      globalIndex += emojiIndex
      break
    }
    globalIndex += group.emojis?.length || 0
  }
  
  if (virtualGridRef.value) {
    virtualGridRef.value.scrollToItem(globalIndex)
  }
}

// 不再将本地列数写回全局设置；使用 props.gridColumns 作为唯一来源
// props.gridColumns changes are implicitly respected via computed above

// 响应式调整
const updateLayout = () => {
  nextTick(() => {
    // 触发重新计算
    if (virtualGridRef.value) {
      // 虚拟滚动组件会自动处理布局更新
    }
  })
}

// 性能优化：防抖更新
let updateTimer: NodeJS.Timeout | null = null
const debouncedUpdate = () => {
  if (updateTimer) clearTimeout(updateTimer)
  updateTimer = setTimeout(updateLayout, 100)
}

// 监听展开状态变化
watch(() => props.expandedGroups.size, debouncedUpdate)
watch(() => props.gridColumns, debouncedUpdate)

// 暴露方法给父组件
defineExpose({
  scrollToTop,
  scrollToEmoji,
  totalEmojis: totalEmojis.value
})
</script>

<style scoped>
.virtual-group-emojis {
  width: 100%;
}

.traditional-grid {
  /* 自定义滚动条样式 */
  scrollbar-width: thin;
  scrollbar-color: #cbd5e0 #f7fafc;
}

.traditional-grid::-webkit-scrollbar {
  width: 6px;
}

.traditional-grid::-webkit-scrollbar-track {
  background: #f7fafc;
  border-radius: 3px;
}

.traditional-grid::-webkit-scrollbar-thumb {
  background: #cbd5e0;
  border-radius: 3px;
}

.emoji-item {
  transition: all 0.2s ease;
}

.emoji-item:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

/* 加载优化 */
.emoji-item img {
  transition: opacity 0.3s ease;
}

.emoji-item img[loading="lazy"] {
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: loading 1.5s infinite;
}

@keyframes loading {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* 响应式布局 */
@media (max-width: 768px) {
  .emoji-item button {
    opacity: 1; /* 移动端总是显示操作按钮 */
  }
}

/* 暗色主题适配 */
.dark .emoji-item img[loading="lazy"] {
  background: linear-gradient(90deg, #374151 25%, #4b5563 50%, #374151 75%);
  background-size: 200% 100%;
}
</style>