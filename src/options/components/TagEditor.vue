<script setup lang="ts">
import { ref, computed, watch } from 'vue'

import { useEmojiStore } from '@/stores/emojiStore'

interface Props {
  emojiId: string
  visible: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  close: []
}>()

const emojiStore = useEmojiStore()
const newTag = ref('')

// 当前表情的标签
const currentTags = computed(() => {
  return emojiStore.getEmojiTags(props.emojiId)
})

// 建议标签（来自热门标签但不在当前标签中）
const suggestedTags = computed(() => {
  const popularTags = emojiStore.allTags.map(t => t.name).slice(0, 10)
  return popularTags.filter(tag => !currentTags.value.includes(tag))
})

// 添加新标签
const addTag = () => {
  const trimmedTag = newTag.value.trim()
  if (trimmedTag && !currentTags.value.includes(trimmedTag)) {
    emojiStore.addTagToEmoji(props.emojiId, trimmedTag)
    newTag.value = ''
  }
}

// 添加建议标签
const addSuggestedTag = (tag: string) => {
  emojiStore.addTagToEmoji(props.emojiId, tag)
}

// 移除标签
const removeTag = (tag: string) => {
  emojiStore.removeTagFromEmoji(props.emojiId, tag)
}

// 关闭编辑器
const closeEditor = () => {
  emit('close')
}

// 监听 visible 变化，清空输入
watch(
  () => props.visible,
  newVal => {
    if (newVal) {
      newTag.value = ''
    }
  }
)
</script>
<template>
  <div class="tag-editor">
    <div class="tag-editor-header">
      <h3>标签管理</h3>
      <a-button @click="closeEditor" size="small" type="text">×</a-button>
    </div>

    <div class="tag-input-section">
      <a-input
        v-model:value="newTag"
        placeholder="输入新标签，按回车添加"
        @press-enter="addTag"
        size="small"
        style="margin-bottom: 8px"
      />
      <a-button @click="addTag" size="small" type="primary" :disabled="!newTag.trim()">
        添加标签
      </a-button>
    </div>

    <div class="current-tags">
      <div class="tags-list">
        <span v-for="tag in currentTags" :key="tag" class="tag-chip">
          {{ tag }}
          <span class="remove-tag" @click="removeTag(tag)">×</span>
        </span>
      </div>
    </div>

    <!-- 快速标签建议 -->
    <div class="tag-suggestions" v-if="suggestedTags.length > 0">
      <div class="suggestions-header">
        <span class="text-xs text-gray-500">快速添加：</span>
      </div>
      <div class="suggestions-list">
        <span
          v-for="tag in suggestedTags"
          :key="tag"
          class="suggestion-tag"
          @click="addSuggestedTag(tag)"
        >
          {{ tag }}
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tag-editor {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  padding: 16px;
  z-index: 1000;
  min-width: 300px;
  max-width: 400px;
}

.dark .tag-editor {
  background: #1f2937;
  color: #f3f4f6;
}

.tag-editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.tag-input-section {
  margin-bottom: 16px;
}

.current-tags {
  margin-bottom: 16px;
}

.tags-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tag-chip {
  display: inline-flex;
  align-items: center;
  padding: 4px 8px;
  background: #3b82f6;
  color: white;
  border-radius: 16px;
  font-size: 12px;
}

.tag-chip .remove-tag {
  margin-left: 6px;
  cursor: pointer;
  font-weight: bold;
  opacity: 0.8;
}

.tag-chip .remove-tag:hover {
  opacity: 1;
}

.tag-suggestions {
  border-top: 1px solid #e5e7eb;
  padding-top: 12px;
}

.dark .tag-suggestions {
  border-top-color: #4b5563;
}

.suggestions-header {
  margin-bottom: 8px;
}

.suggestions-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.suggestion-tag {
  display: inline-block;
  padding: 4px 8px;
  background: #e5e7eb;
  color: #374151;
  border-radius: 16px;
  font-size: 12px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.suggestion-tag:hover {
  background: #d1d5db;
}

.dark .suggestion-tag {
  background: #374151;
  color: #d1d5db;
}

.dark .suggestion-tag:hover {
  background: #4b5563;
}
</style>
