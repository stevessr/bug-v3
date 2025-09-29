<template>
  <div class="virtual-group-emojis">
    <div class="group-header mb-4">
      <slot name="header" />
    </div>
    
    <!-- 表情计数和设置 -->
    <div class="flex items-center justify-between mb-4">
      <div class="text-sm text-gray-600 dark:text-gray-300">
        共 {{ totalEmojis }} 个表情
        <span v-if="isVirtualized" class="ml-2 text-blue-600 dark:text-blue-400">
          (虚拟滚动已启用)
        </span>
      </div>
      <div class="flex items-center gap-2">
        <label class="text-xs text-gray-500">网格列数：</label>
        <a-input-number
          v-model:value="localGridColumns"
          :min="2"
          :max="8"
          size="small"
          class="w-16"
        />
        <a-button
          v-if="isVirtualized && visibleItemsCount < totalEmojis"
          @click="scrollToTop"
          size="small"
          type="text"
        >
          回到顶部
        </a-button>
      </div>
    </div>

    <!-- 虚拟滚动网格 (当表情数量超过阈值时使用) -->
    <VirtualEmojiGrid
      v-if="isVirtualized"
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

    <!-- 传统网格 (表情数量较少时使用) -->
    <div
      v-else
      class="traditional-grid"
      :style="{ maxHeight: `${containerHeight}px`, overflowY: 'auto' }"
    >
      <div
        class="grid gap-3"
        :style="{
          gridTemplateColumns: `repeat(${localGridColumns}, minmax(0, 1fr))`
        }"
      >
        <div
          v-for="item in flatEmojis"
          :key="item.key"
          class="emoji-item relative group cursor-move"
          :draggable="true"
          @dragstart="e => handleEmojiDragStart(item.emoji, item.groupId, item.index, e)"
          @dragover.prevent
          @drop="e => handleEmojiDrop(item.groupId, item.index, e)"
        >
          <div
            class="aspect-square bg-gray-50 rounded-lg overflow-hidden hover:bg-gray-100 transition-colors dark:bg-gray-700 dark:hover:bg-gray-600"
          >
            <img
              :src="item.emoji.url"
              :alt="item.emoji.name"
              class="w-full h-full object-cover"
              loading="lazy"
            />
          </div>
          <div class="text-xs text-center text-gray-600 mt-1 truncate dark:text-white">
            {{ item.emoji.name }}
          </div>
          <!-- Edit button -->
          <a-button
            @click="handleEditEmoji(item.emoji, item.groupId, item.index)"
            class="absolute bottom-1 right-1 w-4 h-4 bg-blue-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
            title="编辑表情"
          >
            ✎
          </a-button>
          <!-- Remove button -->
          <a-popconfirm
            title="确认移除此表情？"
            @confirm="handleRemoveEmoji(item.groupId, item.index)"
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

    <!-- 性能指标显示 (开发模式) -->
    <div v-if="showPerformanceStats" class="mt-4 p-2 bg-gray-100 rounded text-xs dark:bg-gray-700">
      <div class="grid grid-cols-2 gap-2 text-gray-600 dark:text-gray-300">
        <div>总表情数：{{ totalEmojis }}</div>
        <div>可见表情数：{{ visibleItemsCount }}</div>
        <div>虚拟化：{{ isVirtualized ? '是' : '否' }}</div>
        <div>内存节省：{{ memorySavingPercentage }}%</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, inject } from 'vue'
import { QuestionCircleOutlined } from '@ant-design/icons-vue'
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
  showPerformanceStats?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  gridColumns: 4,
  virtualizationThreshold: 100, // 超过 100 个表情启用虚拟滚动
  containerHeight: 500,
  itemHeight: 120,
  overscan: 3,
  showPerformanceStats: false
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
const localGridColumns = ref(props.gridColumns)

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

// 扁平化表情列表 (用于传统网格)
const flatEmojis = computed(() => {
  const items: Array<{
    key: string
    emoji: Emoji
    groupId: string
    index: number
    globalIndex: number
  }> = []
  
  let globalIndex = 0
  expandedEmojis.value.forEach(group => {
    (group.emojis || []).forEach((emoji, index) => {
      items.push({
        key: `${group.id}-${index}`,
        emoji,
        groupId: group.id,
        index,
        globalIndex: globalIndex++
      })
    })
  })
  
  return items
})

// 计算总表情数
const totalEmojis = computed(() => {
  return expandedEmojis.value.reduce((total, group) => 
    total + (group.emojis?.length || 0), 0
  )
})

// 判断是否启用虚拟滚动
const isVirtualized = computed(() => {
  return totalEmojis.value > props.virtualizationThreshold
})

// 可见表情数量 (用于性能统计)
const visibleItemsCount = computed(() => {
  if (!isVirtualized.value) return totalEmojis.value
  
  // 从虚拟滚动组件获取可见项数量
  if (virtualGridRef.value?.visibleRange) {
    const { startIndex, endIndex } = virtualGridRef.value.visibleRange
    return Math.max(0, endIndex - startIndex + 1)
  }
  
  return 0
})

// 内存节省百分比
const memorySavingPercentage = computed(() => {
  if (!isVirtualized.value || totalEmojis.value === 0) return 0
  
  const savedItems = totalEmojis.value - visibleItemsCount.value
  return Math.round((savedItems / totalEmojis.value) * 100)
})

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

// 监听网格列数变化
watch(localGridColumns, (newValue) => {
  if (options?.updateSettings) {
    options.updateSettings({ gridColumns: newValue })
  }
})

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
watch(localGridColumns, debouncedUpdate)

onMounted(() => {
  // 初始化网格列数
  if (options?.emojiStore?.settings?.gridColumns) {
    localGridColumns.value = options.emojiStore.settings.gridColumns
  }
})

// 暴露方法给父组件
defineExpose({
  scrollToTop,
  scrollToEmoji,
  totalEmojis: totalEmojis.value,
  visibleItemsCount: visibleItemsCount.value,
  isVirtualized: isVirtualized.value
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