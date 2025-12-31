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
const { t } = useI18n()
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
      <h3>{{ t('tagManagement') }}</h3>
      <a-button @click="closeEditor" size="small" type="text">×</a-button>
    </div>

    <div class="tag-input-section">
      <a-input
        v-model:value="newTag"
        :placeholder="t('enterNewTagPlaceholder')"
        @press-enter="addTag"
        size="small"
        style="margin-bottom: 8px"
      />
      <a-button @click="addTag" size="small" type="primary" :disabled="!newTag.trim()">
        {{ t('addTag') }}
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
        <span class="text-xs text-gray-500">{{ t('quickAdd') }}：</span>
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

<style scoped src="./TagEditor.css" />
