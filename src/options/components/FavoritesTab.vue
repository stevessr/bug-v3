<script setup lang="ts">
import { computed } from 'vue'
import { QuestionCircleOutlined, DeleteOutlined } from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'

import { useEmojiStore } from '../../stores/emojiStore'

defineEmits(['remove', 'edit'])

const emojiStore = useEmojiStore()

const favoritesGroup = computed(() => {
  return emojiStore.sortedGroups.find(g => g.id === 'favorites')
})

const handleClearAllFavorites = () => {
  emojiStore.clearAllFavorites()
  message.success('已清空所有常用表情')
}
</script>

<template>
  <div class="space-y-8">
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700">
      <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div class="flex justify-between items-center">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white">常用表情</h2>
          <a-popconfirm
            v-if="favoritesGroup && favoritesGroup.emojis?.length"
            title="确认清空所有常用表情吗？此操作不可撤销。"
            ok-text="确认"
            cancel-text="取消"
            @confirm="handleClearAllFavorites"
          >
            <template #icon>
              <QuestionCircleOutlined style="color: red" />
            </template>
            <a-button danger size="small">
              <template #icon>
                <DeleteOutlined />
              </template>
              清空常用
            </a-button>
          </a-popconfirm>
        </div>
      </div>

      <div class="p-6">
        <div
          v-if="favoritesGroup && favoritesGroup.emojis?.length"
          class="grid gap-3"
          :style="{
            gridTemplateColumns: `repeat(${emojiStore.settings.gridColumns}, minmax(0, 1fr))`
          }"
        >
          <div
            v-for="(emoji, idx) in favoritesGroup.emojis"
            :key="`fav-${emoji.id || idx}`"
            class="emoji-item relative group"
          >
            <a-badge
              :count="emoji.usageCount && emoji.usageCount > 0 ? emoji.usageCount : 0"
              :overflow-count="99"
              :show-zero="false"
            >
              <template v-if="!emoji.usageCount || emoji.usageCount === 0" #count>
                <span class="favorite-star">⭐</span>
              </template>
              <div class="aspect-square bg-gray-50 dark:bg-gray-700 rounded-lg overflow-hidden">
                <img
                  :src="emoji.displayUrl || emoji.url"
                  :alt="emoji.name"
                  class="w-full h-full object-cover"
                />
              </div>
            </a-badge>
            <!-- Actions: hidden by default, shown on hover below the image -->
            <div class="mt-2 flex justify-center items-center">
              <div
                class="opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex gap-2"
              >
                <a-button
                  @click="$emit('edit', emoji, 'favorites', idx)"
                  title="编辑"
                  class="text-xs px-2 py-0.5 bg-white bg-opacity-90 dark:bg-gray-700 rounded hover:bg-opacity-100"
                >
                  编辑
                </a-button>
                <a-popconfirm title="确认移除此表情？" @confirm="$emit('remove', 'favorites', idx)">
                  <template #icon>
                    <QuestionCircleOutlined style="color: red" />
                  </template>
                  <a-button
                    title="移除"
                    class="text-xs px-2 py-0.5 bg-white bg-opacity-90 dark:bg-gray-700 rounded hover:bg-opacity-100"
                  >
                    移除
                  </a-button>
                </a-popconfirm>
              </div>
            </div>
            <div class="text-xs text-center text-gray-600 mt-1 truncate dark:text-white">
              {{ emoji.name }}
            </div>
          </div>
        </div>
        <div v-else class="text-sm text-gray-500 dark:text-white">
          尚无常用表情，使用表情后会自动添加到常用。
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.emoji-item {
  width: 80px;
}

.favorite-star {
  font-size: 12px;
  background: linear-gradient(135deg, #ffd700 0%, #ffa500 100%);
  border-radius: 50%;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 4px rgba(255, 215, 0, 0.4);
}
</style>
