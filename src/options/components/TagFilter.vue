<script setup lang="ts">
import { computed } from 'vue'

import { useEmojiStore } from '@/stores/emojiStore'

const emojiStore = useEmojiStore()

// 获取热门标签（按使用次数排序，最多显示 20 个）
const popularTags = computed(() => {
  return emojiStore.allTags.slice(0, 20)
})

// 当前选中的标签
const selectedTags = computed({
  get: () => emojiStore.selectedTags,
  set: (tags: string[]) => emojiStore.setSelectedTags(tags)
})

// 检查标签是否被选中
const isSelected = (tagName: string) => {
  return selectedTags.value.includes(tagName)
}

// 切换标签选择状态
const toggleTag = (tagName: string) => {
  emojiStore.toggleTagFilter(tagName)
}

// 移除标签
const removeTag = (tagName: string) => {
  const newTags = selectedTags.value.filter(tag => tag !== tagName)
  emojiStore.setSelectedTags(newTags)
}

// 清除所有标签筛选
const clearAllTags = () => {
  emojiStore.clearTagFilters()
}
</script>

<template>
  <div class="tag-filter">
    <div class="tag-filter-header">
      <h3 class="text-sm font-medium mb-2">标签筛选</h3>
      <a-button
        v-if="selectedTags.length > 0"
        @click="clearAllTags"
        size="small"
        type="text"
        class="text-blue-500"
      >
        清除筛选
      </a-button>
    </div>

    <div class="tag-list">
      <div
        v-for="tag in popularTags"
        :key="tag.name"
        class="tag-chip"
        :class="{ active: isSelected(tag.name) }"
        @click="toggleTag(tag.name)"
        :title="`${tag.name} (${tag.count} 个表情)`"
      >
        <span class="tag-name">{{ tag.name }}</span>
        <span class="tag-count">{{ tag.count }}</span>
      </div>
    </div>

    <!-- 显示当前选中的标签 -->
    <div v-if="selectedTags.length > 0" class="selected-tags">
      <div class="selected-tags-header">
        <span class="text-xs text-gray-500">已选择标签：</span>
      </div>
      <div class="selected-tag-list">
        <span v-for="tag in selectedTags" :key="tag" class="selected-tag" @click="removeTag(tag)">
          {{ tag }}
          <span class="remove-tag">×</span>
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped src="./TagFilter.css" />
