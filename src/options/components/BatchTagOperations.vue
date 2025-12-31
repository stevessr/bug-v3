<script setup lang="ts">
import { ref, computed } from 'vue'

import { useEmojiStore } from '@/stores/emojiStore'

interface Props {
  selectedEmojiIds: string[]
  visible: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  close: []
}>()

const emojiStore = useEmojiStore()
const newTag = ref('')

// 获取选中表情的公共标签
const popularTags = computed(() => {
  if (props.selectedEmojiIds.length === 0) return []

  const tagCounts = new Map<string, number>()

  props.selectedEmojiIds.forEach(emojiId => {
    const tags = emojiStore.getEmojiTags(emojiId)
    tags.forEach(tag => {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1)
    })
  })

  return Array.from(tagCounts.entries())
    .map(([name, count]) => ({ name, count: Number(count) }))
    .sort((a, b) => b.count - a.count)
})

// 添加标签到选中的表情
const addTagToSelected = () => {
  const trimmedTag = newTag.value.trim()
  if (!trimmedTag) return

  const changedCount = emojiStore.addTagToMultipleEmojis(props.selectedEmojiIds, trimmedTag)
  if (changedCount > 0) {
    message.success(`已为 ${changedCount} 个表情添加标签 "${trimmedTag}"`)
    newTag.value = ''
  }
}

// 从选中的表情移除标签
const removeTagFromSelected = (tag: string) => {
  const changedCount = emojiStore.removeTagFromMultipleEmojis(props.selectedEmojiIds, tag)
  if (changedCount > 0) {
    message.success(`已从 ${changedCount} 个表情移除标签 "${tag}"`)
  }
}

// 清除所有标签
const clearAllTags = () => {
  let totalRemoved = 0
  props.selectedEmojiIds.forEach(emojiId => {
    const tags = emojiStore.getEmojiTags(emojiId)
    tags.forEach(tag => {
      if (emojiStore.removeTagFromEmoji(emojiId, tag)) {
        totalRemoved++
      }
    })
  })

  if (totalRemoved > 0) {
    message.success(`已清除 ${totalRemoved} 个标签`)
  }
}

// 从第一个表情复制标签
const copyTagsFromFirst = () => {
  if (props.selectedEmojiIds.length === 0) return

  const firstEmojiTags = emojiStore.getEmojiTags(props.selectedEmojiIds[0])
  if (firstEmojiTags.length === 0) {
    message.info('第一个表情没有标签')
    return
  }

  let totalAdded = 0
  props.selectedEmojiIds.slice(1).forEach(emojiId => {
    firstEmojiTags.forEach(tag => {
      if (emojiStore.addTagToEmoji(emojiId, tag)) {
        totalAdded++
      }
    })
  })

  if (totalAdded > 0) {
    message.success(`已为其他表情复制 ${totalAdded} 个标签`)
  }
}

// 关闭批量操作
const closeBatchOperations = () => {
  emit('close')
}
</script>

<template>
  <div class="batch-tag-operations">
    <div class="batch-header">
      <h3>批量标签操作</h3>
      <div class="selected-count">已选择 {{ selectedEmojiIds.length }} 个表情</div>
    </div>

    <div class="batch-actions">
      <!-- 添加标签 -->
      <div class="action-section">
        <h4>添加标签</h4>
        <div class="tag-input-group">
          <a-input
            v-model:value="newTag"
            placeholder="输入标签名称"
            size="small"
            style="flex: 1; margin-right: 8px"
          />
          <a-button
            @click="addTagToSelected"
            size="small"
            type="primary"
            :disabled="!newTag.trim() || selectedEmojiIds.length === 0"
          >
            添加到选中
          </a-button>
        </div>
      </div>

      <!-- 移除标签 -->
      <div class="action-section">
        <h4>移除标签</h4>
        <div class="tag-list">
          <span v-for="tag in popularTags" :key="tag.name" class="tag-chip">
            {{ tag.name }}
            <span class="tag-count">({{ tag.count }})</span>
            <a-button
              @click="removeTagFromSelected(tag.name)"
              size="small"
              type="text"
              class="remove-btn"
            >
              ×
            </a-button>
          </span>
        </div>
      </div>

      <!-- 快速操作 -->
      <div class="action-section">
        <h4>快速操作</h4>
        <div class="quick-actions">
          <a-button
            @click="clearAllTags"
            size="small"
            danger
            :disabled="selectedEmojiIds.length === 0"
          >
            清除所有标签
          </a-button>
          <a-button
            @click="copyTagsFromFirst"
            size="small"
            :disabled="selectedEmojiIds.length === 0"
          >
            复制第一个表情的标签
          </a-button>
        </div>
      </div>
    </div>

    <div class="batch-footer">
      <a-button @click="closeBatchOperations" size="small">关闭</a-button>
    </div>
  </div>
</template>

<style scoped src="./BatchTagOperations.css" />
