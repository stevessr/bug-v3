<script setup lang="ts">
import { computed } from 'vue'

import TagPill from '@/options/components/discourse/layout/TagPill'

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
  <div class="emoji-tags min-h-[20px]">
    <div class="flex flex-wrap gap-1 mt-1">
      <button
        v-for="tag in displayedTags"
        :key="tag"
        type="button"
        class="inline-flex"
        :disabled="!clickable"
        :class="{ 'cursor-default': !clickable }"
        :title="`标签: ${tag}`"
        @click="handleTagClick(tag)"
      >
        <TagPill :name="tag" :text="tag" :clickable="clickable" compact />
      </button>
      <TagPill
        v-if="hiddenCount > 0"
        :name="`+${hiddenCount}`"
        :text="`+${hiddenCount}`"
        :description="`还有 ${hiddenCount} 个标签`"
        compact
      />
    </div>
  </div>
</template>
