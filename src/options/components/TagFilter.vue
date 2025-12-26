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

<style scoped>
.tag-filter {
  padding: 16px;
  background: #f8f9fa;
  border-radius: 8px;
  margin-bottom: 16px;
}

.dark .tag-filter {
  background: #1f2937;
}

.tag-filter-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.tag-chip {
  display: inline-flex;
  align-items: center;
  padding: 4px 8px;
  background: #e9ecef;
  border: 1px solid #dee2e6;
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 12px;
}

.tag-chip:hover {
  background: #dee2e6;
  border-color: #adb5bd;
}

.tag-chip.active {
  background: #3b82f6;
  border-color: #3b82f6;
  color: white;
}

.dark .tag-chip {
  background: #374151;
  border-color: #4b5563;
  color: #d1d5db;
}

.dark .tag-chip:hover {
  background: #4b5563;
  border-color: #6b7280;
}

.dark .tag-chip.active {
  background: #2563eb;
  border-color: #2563eb;
  color: white;
}

.tag-name {
  margin-right: 4px;
  font-weight: 500;
}

.tag-count {
  font-size: 10px;
  opacity: 0.7;
  background: rgba(0, 0, 0, 0.1);
  border-radius: 8px;
  padding: 1px 4px;
}

.tag-chip.active .tag-count {
  background: rgba(255, 255, 255, 0.2);
}

.selected-tags {
  border-top: 1px solid #dee2e6;
  padding-top: 12px;
}

.dark .selected-tags {
  border-top-color: #4b5563;
}

.selected-tags-header {
  margin-bottom: 8px;
}

.selected-tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.selected-tag {
  display: inline-flex;
  align-items: center;
  padding: 4px 8px;
  background: #3b82f6;
  color: white;
  border-radius: 16px;
  font-size: 12px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.selected-tag:hover {
  background: #2563eb;
}

.remove-tag {
  margin-left: 6px;
  font-weight: bold;
  font-size: 14px;
}
</style>
