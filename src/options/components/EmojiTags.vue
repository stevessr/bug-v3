<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  tags: string[]
  maxDisplay?: number // 最多显示的标签数量
  clickable?: boolean // 标签是否可点击
}

const props = withDefaults(defineProps<Props>(), {
  maxDisplay: 3,
  clickable: false
})

const emit = defineEmits<{
  tagClick: [tag: string]
}>()

const displayedTags = computed(() => {
  if (!props.tags) return []
  return props.tags.slice(0, props.maxDisplay)
})

const hiddenCount = computed(() => {
  if (!props.tags) return 0
  return Math.max(0, props.tags.length - props.maxDisplay)
})

// 处理标签点击
const handleTagClick = (tag: string) => {
  if (props.clickable) {
    emit('tagClick', tag)
  }
}
</script>

<template>
  <div class="emoji-tags">
    <div class="flex flex-wrap gap-1 mt-1">
      <span
        v-for="tag in displayedTags"
        :key="tag"
        class="tag-item"
        :title="`标签: ${tag}`"
        :class="{ 'cursor-pointer hover:bg-blue-200 dark:hover:bg-blue-800': clickable }"
        @click="handleTagClick(tag)"
      >
        {{ tag }}
      </span>
      <span
        v-if="hiddenCount > 0"
        class="tag-more"
        :title="`还有 ${hiddenCount} 个标签`"
      >
        +{{ hiddenCount }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.emoji-tags {
  @apply min-h-[20px];
}

.tag-item {
  @apply inline-block px-2 py-0.5 text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded transition-colors;
}

.tag-more {
  @apply inline-block px-2 py-0.5 text-xs bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 rounded;
}
</style>
