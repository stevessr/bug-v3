<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { QuestionCircleOutlined } from '@ant-design/icons-vue'

import type { Emoji } from '../../types/emoji'

interface VirtualEmojiItem {
  key: string
  emoji: Emoji
  groupId: string
  index: number
  globalIndex: number
  isVisible: boolean
}

interface Props {
  emojis: Array<{ groupId: string; emojis: Emoji[] }>
  gridColumns: number
  itemHeight?: number
  containerHeight?: number
  overscan?: number
}

const props = withDefaults(defineProps<Props>(), {
  itemHeight: 120, // 预估每个表情项的高度
  containerHeight: 400, // 容器高度
  overscan: 5 // 预渲染的额外行数
})

const emit = defineEmits<{
  editEmoji: [emoji: Emoji, groupId: string, index: number]
  removeEmoji: [groupId: string, index: number]
  emojiDragStart: [emoji: Emoji, groupId: string, index: number, event: DragEvent]
  emojiDrop: [groupId: string, index: number, event: DragEvent]
}>()

// Refs
const containerRef = ref<HTMLElement>()
const scrollTop = ref(0)

// 计算所有表情项
const allItems = computed(() => {
  const items: VirtualEmojiItem[] = []
  let globalIndex = 0

  props.emojis.forEach(group => {
    group.emojis.forEach((emoji, index) => {
      items.push({
        key: `${group.groupId}-${index}`,
        emoji,
        groupId: group.groupId,
        index,
        globalIndex: globalIndex++,
        isVisible: false
      })
    })
  })

  return items
})

// 计算网格布局
const rowHeight = computed(() => props.itemHeight)
const itemsPerRow = computed(() => Math.max(1, props.gridColumns))
const totalRows = computed(() => Math.ceil(allItems.value.length / itemsPerRow.value))
const totalHeight = computed(() => totalRows.value * rowHeight.value)

// 计算可见范围 - 优化计算逻辑，减少跳跃
const visibleRange = computed(() => {
  const containerHeight = props.containerHeight
  const scrollPosition = scrollTop.value
  const itemHeight = rowHeight.value

  // 使用更精确的计算方式
  const startRow = Math.floor(scrollPosition / itemHeight)
  const endRow = Math.ceil((scrollPosition + containerHeight) / itemHeight)

  // 添加 overscan，但确保边界安全
  const totalRowCount = totalRows.value
  const startRowWithOverscan = Math.max(0, startRow - props.overscan)
  const endRowWithOverscan = Math.min(totalRowCount - 1, endRow + props.overscan)

  // 计算项目索引，确保不超出范围
  const itemsCount = allItems.value.length
  const startIndex = Math.min(itemsCount - 1, startRowWithOverscan * itemsPerRow.value)
  const endIndex = Math.min(
    itemsCount - 1,
    Math.max(startIndex, (endRowWithOverscan + 1) * itemsPerRow.value - 1)
  )

  return {
    startIndex: Math.max(0, startIndex),
    endIndex: Math.max(0, endIndex),
    startRow: startRowWithOverscan
  }
})

// 可见项
const visibleItems = computed(() => {
  const { startIndex, endIndex } = visibleRange.value
  return allItems.value.slice(startIndex, endIndex + 1).map(item => ({
    ...item,
    isVisible: true
  }))
})

// 偏移量 - 使用更稳定的计算方式，避免跳跃
const offsetY = computed(() => {
  const startRow = visibleRange.value.startRow
  const offset = startRow * rowHeight.value

  // 移除边界钳制，让浏览器自然处理滚动边界
  return offset
})

// 滚动处理 - 直接同步更新
const isScrolling = ref(false)
const handleScroll = (event: Event) => {
  const target = event.target as HTMLElement
  scrollTop.value = target.scrollTop
  isScrolling.value = true

  // 标记滚动结束
  if (scrollEndTimer) clearTimeout(scrollEndTimer)
  scrollEndTimer = setTimeout(() => {
    isScrolling.value = false
  }, 150)
}

// 拖拽处理
const handleEmojiDragStart = (emoji: Emoji, groupId: string, index: number, event: DragEvent) => {
  emit('emojiDragStart', emoji, groupId, index, event)
}

const handleEmojiDrop = (groupId: string, index: number, event: DragEvent) => {
  emit('emojiDrop', groupId, index, event)
}

// 触摸事件处理 (需要从父组件传入)
const addEmojiTouchEvents = (
  _element: HTMLElement,
  _emoji: Emoji,
  _groupId: string,
  _index: number
) => {
  // 这里需要与现有的触摸处理逻辑集成
  // 暂时留空，由父组件处理
}

// 滚动结束计时器
let scrollEndTimer: NodeJS.Timeout | null = null

// 自动调整容器高度
const adjustContainerHeight = () => {
  if (containerRef.value) {
    const rect = containerRef.value.getBoundingClientRect()
    const availableHeight = window.innerHeight - rect.top - 100 // 留一些边距
    if (availableHeight > 200) {
      // 最小 200px 高度
      containerRef.value.style.height = `${Math.min(availableHeight, props.containerHeight)}px`
    }
  }
}

// 滚动到指定项
const scrollToItem = (globalIndex: number) => {
  const row = Math.floor(globalIndex / itemsPerRow.value)
  const targetScrollTop = row * rowHeight.value

  if (containerRef.value) {
    containerRef.value.querySelector('.virtual-scroll-container')?.scrollTo({
      top: targetScrollTop,
      behavior: 'smooth'
    })
  }
}

// 监听窗口大小变化
const handleResize = () => {
  nextTick(() => {
    adjustContainerHeight()
  })
}

onMounted(() => {
  adjustContainerHeight()
  window.addEventListener('resize', handleResize)

  // 直接使用同步滚动处理
  const scrollContainer = containerRef.value?.querySelector('.virtual-scroll-container')
  if (scrollContainer) {
    scrollContainer.addEventListener('scroll', handleScroll, { passive: true })
  }
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)

  if (scrollEndTimer) {
    clearTimeout(scrollEndTimer)
  }

  const scrollContainer = containerRef.value?.querySelector('.virtual-scroll-container')
  if (scrollContainer) {
    scrollContainer.removeEventListener('scroll', handleScroll)
  }
})

// 暴露方法给父组件
defineExpose({
  scrollToItem,
  scrollTop: scrollTop.value,
  visibleRange
})
</script>

<template>
  <div class="virtual-emoji-grid" ref="containerRef">
    <!-- 虚拟滚动容器 -->
    <div
      class="virtual-scroll-container"
      :style="{
        height: `${containerHeight}px`,
        overflowY: 'auto',
        position: 'relative'
      }"
      @scroll="handleScroll"
    >
      <!-- 总高度占位符 -->
      <div class="virtual-spacer" :style="{ height: `${totalHeight}px`, position: 'relative' }">
        <!-- 可见项容器 -->
        <div
          class="virtual-items"
          :style="{
            position: 'absolute',
            top: `${offsetY}px`,
            left: 0,
            right: 0
          }"
        >
          <div
            class="grid gap-3"
            :style="{
              gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))`
            }"
          >
            <div
              v-for="item in visibleItems"
              :key="item.key"
              class="emoji-item relative group cursor-move"
              :draggable="true"
              @dragstart="e => handleEmojiDragStart(item.emoji, item.groupId, item.index, e)"
              @dragover.prevent
              @drop="e => handleEmojiDrop(item.groupId, item.index, e)"
              :ref="
                el =>
                  el && addEmojiTouchEvents(el as HTMLElement, item.emoji, item.groupId, item.index)
              "
            >
              <div
                class="aspect-square bg-gray-50 rounded-lg overflow-hidden hover:bg-gray-100 transition-colors dark:bg-gray-700 dark:hover:bg-gray-600"
              >
                <img
                  :src="item.emoji.url"
                  :alt="item.emoji.name"
                  class="w-full h-full object-cover"
                  :loading="item.isVisible ? 'eager' : 'lazy'"
                />
              </div>
              <div class="text-xs text-center text-gray-600 mt-1 truncate dark:text-white">
                {{ item.emoji.name }}
              </div>
              <!-- Edit button -->
              <a-button
                @click="$emit('editEmoji', item.emoji, item.groupId, item.index)"
                class="absolute bottom-1 right-1 w-4 h-4 bg-blue-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                title="编辑表情"
              >
                ✎
              </a-button>
              <!-- Remove button -->
              <a-popconfirm
                title="确认移除此表情？"
                @confirm="$emit('removeEmoji', item.groupId, item.index)"
              >
                <template #icon>
                  <QuestionCircleOutlined style="color: red" />
                </template>
                <a-button
                  class="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  ×
                </a-button>
              </a-popconfirm>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.virtual-emoji-grid {
  width: 100%;
}

.virtual-scroll-container {
  /* 自定义滚动条样式 */
  scrollbar-width: thin;
  scrollbar-color: #cbd5e0 #f7fafc;

  /* 优化滚动性能 */
  scroll-behavior: smooth;
  -webkit-overflow-scrolling: touch;

  /* 减少滚动时的重绘 */
  will-change: scroll-position;
  transform: translateZ(0);
}

.virtual-scroll-container::-webkit-scrollbar {
  width: 8px;
}

.virtual-scroll-container::-webkit-scrollbar-track {
  background: #f7fafc;
  border-radius: 4px;
}

.virtual-scroll-container::-webkit-scrollbar-thumb {
  background: #cbd5e0;
  border-radius: 4px;
}

.virtual-scroll-container::-webkit-scrollbar-thumb:hover {
  background: #a0aec0;
}

/* 虚拟滚动容器优化 */
.virtual-spacer {
  /* 使用 GPU 加速 */
  transform: translateZ(0);
}

.virtual-items {
  /* 减少重排重绘 */
  will-change: transform;
}

.emoji-item {
  transition:
    transform 0.2s,
    opacity 0.2s;
}

.emoji-item:hover {
  transform: translateY(-2px);
}

.emoji-item.touch-dragging {
  opacity: 0.6;
  transform: scale(0.9);
}

/* 加载状态 */
.emoji-item img {
  transition: opacity 0.3s;
}

.emoji-item img[loading='lazy'] {
  opacity: 0.7;
}

/* 响应式调整 */
@media (max-width: 768px) {
  .emoji-item {
    margin: 2px;
  }

  .emoji-item button {
    opacity: 1; /* 移动端始终显示按钮 */
  }
}
</style>
