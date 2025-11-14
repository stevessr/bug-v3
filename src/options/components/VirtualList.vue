<script setup lang="ts" generic="T">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'

interface Props {
  items: T[]
  itemHeight: number
  containerHeight?: number
  buffer?: number
}

const props = withDefaults(defineProps<Props>(), {
  containerHeight: 600,
  buffer: 3
})

defineSlots<{
  default(props: { item: T; index: number }): any
}>()

const containerRef = ref<HTMLElement | null>(null)
const scrollTop = ref(0)

const visibleCount = computed(() => Math.ceil(props.containerHeight / props.itemHeight))

const totalHeight = computed(() => props.items.length * props.itemHeight)

const startIndex = computed(() => {
  const index = Math.floor(scrollTop.value / props.itemHeight) - props.buffer
  return Math.max(0, index)
})

const endIndex = computed(() => {
  const index = startIndex.value + visibleCount.value + props.buffer * 2
  return Math.min(props.items.length, index)
})

const visibleItems = computed(() => {
  return props.items.slice(startIndex.value, endIndex.value).map((item, idx) => ({
    item,
    index: startIndex.value + idx
  }))
})

const offsetY = computed(() => startIndex.value * props.itemHeight)

const handleScroll = (e: Event) => {
  const target = e.target as HTMLElement
  scrollTop.value = target.scrollTop
}

// Auto scroll to bottom when new items are added (for streaming)
const autoScroll = ref(false)

watch(
  () => props.items.length,
  (newLen, oldLen) => {
    if (newLen > oldLen && autoScroll.value && containerRef.value) {
      // Scroll to bottom smoothly
      setTimeout(() => {
        if (containerRef.value) {
          containerRef.value.scrollTop = containerRef.value.scrollHeight
        }
      }, 50)
    }
  }
)

const enableAutoScroll = () => {
  autoScroll.value = true
}

const disableAutoScroll = () => {
  autoScroll.value = false
}

defineExpose({
  enableAutoScroll,
  disableAutoScroll,
  scrollToTop: () => {
    if (containerRef.value) {
      containerRef.value.scrollTop = 0
    }
  },
  scrollToBottom: () => {
    if (containerRef.value) {
      containerRef.value.scrollTop = containerRef.value.scrollHeight
    }
  }
})
</script>

<template>
  <div
    ref="containerRef"
    class="virtual-list-container"
    :style="{ height: `${containerHeight}px`, overflow: 'auto' }"
    @scroll="handleScroll"
  >
    <div :style="{ height: `${totalHeight}px`, position: 'relative' }">
      <div :style="{ transform: `translateY(${offsetY}px)` }">
        <div
          v-for="{ item, index } in visibleItems"
          :key="index"
          :style="{ height: `${itemHeight}px` }"
        >
          <slot :item="item" :index="index"></slot>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.virtual-list-container {
  scrollbar-width: thin;
  scrollbar-color: rgba(156, 163, 175, 0.5) transparent;
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
