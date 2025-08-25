<script setup lang="ts">
import { ref, computed } from 'vue'
import { message } from 'ant-design-vue'

import { useEmojiStore } from '@/stores/emojiStore'

const emojiStore = useEmojiStore()

const selectedEmoji = ref<any | null>(null)
const newName = ref('')

const allEmojis = computed(() => {
  return emojiStore.groups.flatMap(group =>
    (group.emojis || []).map(e => ({ ...e, groupId: group.id }))
  )
})

const selectEmoji = (emoji: any) => {
  selectedEmoji.value = emoji
  newName.value = emoji.name || emoji.text || ''
}

const applyRename = async () => {
  if (!selectedEmoji.value) return
  const payload = {
    emoji: { ...selectedEmoji.value, name: newName.value, text: newName.value },
    groupId: selectedEmoji.value.groupId,
    index: (
      emojiStore.groups.find(g => g.id === selectedEmoji.value.groupId)?.emojis || []
    ).findIndex((e: any) => e === selectedEmoji.value)
  }

  try {
    await emojiStore.updateEmojiInGroup(payload.groupId, payload.index, payload.emoji)
    message.success('表情重命名成功')
  } catch (e) {
    console.error(e)
    message.error('重命名失败')
  }
}

const suggestName = async () => {
  if (!selectedEmoji.value) return
  // Placeholder for AI suggestion - implement provider integration later
  const suggestion = `emoji_${Date.now() % 1000}`
  newName.value = suggestion
  message.info('AI 建议已填充（示例）')
}
</script>
<template>
  <div class="p-6">
    <h1 class="text-2xl font-bold mb-4">AI 表情重命名（独立页面）</h1>
    <p class="text-sm text-gray-600 mb-6">选择已有表情，并使用 AI 或批量操作重命名（示例界面）。</p>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div class="col-span-2">
        <div class="bg-white rounded-lg p-4">
          <h3 class="font-medium mb-2">表情列表</h3>
          <div class="grid grid-cols-4 gap-2 max-h-96 overflow-y-auto">
            <div
              v-for="(emoji, idx) in allEmojis"
              :key="emoji.id || idx"
              class="p-2 border rounded text-center cursor-pointer hover:bg-gray-50"
              :class="{ 'ring-2 ring-blue-400': selectedEmoji && selectedEmoji === emoji }"
              @click="selectEmoji(emoji)"
            >
              <img v-if="emoji.src" :src="emoji.src" class="w-16 h-16 object-contain mx-auto" />
              <div class="text-xs mt-2 truncate">{{ emoji.name || emoji.text || 'unnamed' }}</div>
            </div>
          </div>
        </div>
      </div>

      <div>
        <div class="bg-white rounded-lg p-4 space-y-4">
          <h3 class="font-medium">操作</h3>
          <div v-if="selectedEmoji">
            <div class="text-sm text-gray-700">
              当前: {{ selectedEmoji.name || selectedEmoji.text }}
            </div>
            <a-input v-model:value="newName" placeholder="输入新名称" />
            <div class="flex space-x-2">
              <a-button type="primary" @click="applyRename">应用重命名</a-button>
              <a-button @click="suggestName">AI 建议</a-button>
            </div>
          </div>
          <div v-else class="text-sm text-gray-500">请选择一个表情开始操作</div>
        </div>
      </div>
    </div>
  </div>
</template>
