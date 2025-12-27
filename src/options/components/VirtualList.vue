<script setup lang="ts" generic="T">
import { ref, computed, onUnmounted, watch, nextTick } from 'vue'

interface Props {
  items: T[]
  itemHeight: number
  containerHeight?: number
  buffer?: number
  itemsPerRow?: number // 每行显示的项目数
}

const props = withDefaults(defineProps<Props>(), {
  containerHeight: 600,
  buffer: 3,
  itemsPerRow: 1 // 默认为 1，保持向后兼容
})

defineSlots<{
  default(props: { item: T; index: number }): any
}>()

const containerRef = ref<HTMLElement | null>(null)
const scrollTop = ref(0)

// 计算每行显示的项目数
const itemsPerRow = computed(() => {
  return props.itemsPerRow > 0 ? props.itemsPerRow : 1
})

// 计算需要显示的行数
const totalRows = computed(() => Math.ceil(props.items.length / itemsPerRow.value))

const visibleRowCount = computed(() => Math.ceil(props.containerHeight / props.itemHeight))

const startIndex = computed(() => {
  const rowIndex = Math.floor(scrollTop.value / props.itemHeight) - props.buffer
  const index = Math.max(0, rowIndex) * itemsPerRow.value
  return Math.min(index, props.items.length)
})

const endIndex = computed(() => {
  const rowIndex = startIndex.value / itemsPerRow.value + visibleRowCount.value + props.buffer * 2
  return Math.min(props.items.length, Math.ceil(rowIndex) * itemsPerRow.value)
})

const visibleItems = computed(() => {
  return props.items.slice(startIndex.value, endIndex.value).map((item, idx) => ({
    item,
    index: startIndex.value + idx
  }))
})

const offsetY = computed(() => Math.floor(startIndex.value / itemsPerRow.value) * props.itemHeight)

const handleScroll = (e: Event) => {
  const target = e.target as HTMLElement
  scrollTop.value = target.scrollTop
}

// Auto scroll to bottom when new items are added (for streaming)
const autoScroll = ref(false)

// 使用 requestAnimationFrame 优化滚动性能（比 setTimeout 更流畅）
let scrollRafId: number | null = null
const handleScrollDebounced = (e: Event) => {
  if (scrollRafId) {
    cancelAnimationFrame(scrollRafId)
  }
  scrollRafId = requestAnimationFrame(() => {
    handleScroll(e)
  })
}

watch(
  () => props.items.length,
  (newLen, oldLen) => {
    if (newLen > oldLen && autoScroll.value && containerRef.value) {
      // 使用 nextTick 确保 DOM 更新后再滚动
      nextTick(() => {
        if (containerRef.value) {
          containerRef.value.scrollTop = containerRef.value.scrollHeight
        }
      })
    }
  }
)

const enableAutoScroll = () => {
  autoScroll.value = true
}

const disableAutoScroll = () => {
  autoScroll.value = false
}

// 优化的滚动到顶部方法
const scrollToTop = () => {
  if (containerRef.value) {
    containerRef.value.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

// 清理资源：取消待处理的 RAF
onUnmounted(() => {
  if (scrollRafId) {
    cancelAnimationFrame(scrollRafId)
    scrollRafId = null
  }
})

// 优化的滚动到底部方法
const scrollToBottom = () => {
  if (containerRef.value) {
    containerRef.value.scrollTo({ top: containerRef.value.scrollHeight, behavior: 'smooth' })
  }
}

defineExpose({
  enableAutoScroll,
  disableAutoScroll,
  scrollToTop,
  scrollToBottom
})

// 清理定时器
onUnmounted(() => {
  if (scrollRafId) {
    cancelAnimationFrame(scrollRafId)
  }
})
</script>

<template>
  <div
    ref="containerRef"
    class="virtual-list-container"
    :style="{ height: `${containerHeight}px` }"
    @scroll="handleScrollDebounced"
  >
    <div class="virtual-list-spacer" :style="{ height: `${totalRows * itemHeight}px` }">
      <div class="virtual-list-viewport" :style="{ transform: `translateY(${offsetY}px)` }">
        <div
          v-for="item in visibleItems"
          :key="item.index"
          class="virtual-list-item"
          :style="{
            '--items-per-row': itemsPerRow,
            height: `${itemHeight}px`
          }"
        >
          <slot :item="item.item" :index="item.index"></slot>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.virtual-list-container {
  overflow: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(156, 163, 175, 0.5) transparent;
}

.virtual-list-spacer {
  position: relative;
}

.virtual-list-viewport {
  /* 使用 will-change 优化滚动性能 */
  will-change: transform;
}

.virtual-list-item {
  display: inline-block;
  /* 使用 CSS 变量减少内联样式计算 */
  width: calc(100% / var(--items-per-row));
  box-sizing: border-box;
}

.virtual-list-container::-webkit-scrollbar {
  width: 8px;
}

.virtual-list-container::-webkit-scrollbar-track {
  background: transparent;
}

.virtual-list-container::-webkit-scrollbar-thumb {
  background-color: rgba(156, 163, 175, 0.5);
  border-radius: 4px;
}

.virtual-list-container::-webkit-scrollbar-thumb:hover {
  background-color: rgba(156, 163, 175, 0.7);
}
</style>
