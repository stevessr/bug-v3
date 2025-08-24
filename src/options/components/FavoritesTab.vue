<script setup lang="ts">
import { computed } from 'vue'
const props = defineProps<{
  emojiStore: any
}>()

defineEmits<{
  (e: 'remove', groupId: string, idx: number): void
  (e: 'edit', emoji: any, groupId: string, idx: number): void
}>()

const favoritesGroup = computed(() =>
  props.emojiStore?.sortedGroups?.find((g: any) => g.id === 'favorites')
)
</script>

<template>
  <div class="space-y-8">
    <div class="bg-white rounded-lg shadow-sm border">
      <div class="px-6 py-4 border-b border-gray-200">
        <div class="flex justify-between items-center">
          <h2 class="text-lg font-semibold text-gray-900">常用表情</h2>
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
            class="emoji-item relative"
          >
            <div class="aspect-square bg-gray-50 rounded-lg overflow-hidden">
              <img
                :src="emoji.displayUrl || emoji.url"
                :alt="emoji.name"
                class="w-full h-full object-cover"
              />
            </div>
            <!-- Activity badge -->
            <div
              v-if="emoji.usageCount && emoji.usageCount > 0"
              class="absolute top-1 left-1 bg-blue-500 text-white text-xs rounded-full px-1.5 py-0.5 font-semibold min-w-[20px] text-center"
            >
              {{ emoji.usageCount > 99 ? '99+' : emoji.usageCount }}
            </div>
            <div
              v-else
              class="absolute top-1 left-1 bg-yellow-500 text-white text-xs rounded-full px-1 py-0.5"
              title="收藏的表情"
            >
              ⭐
            </div>
            <div class="absolute top-1 right-1 flex gap-1">
              <button
                @click="$emit('edit', emoji, 'favorites', idx)"
                title="编辑"
                class="text-xs px-1 py-0.5 bg-white bg-opacity-80 rounded hover:bg-opacity-100"
              >
                编辑
              </button>
              <button
                @click="$emit('remove', 'favorites', idx)"
                title="移除"
                class="text-xs px-1 py-0.5 bg-white bg-opacity-80 rounded hover:bg-opacity-100"
              >
                移除
              </button>
            </div>
            <div class="text-xs text-center text-gray-600 mt-1 truncate">
              {{ emoji.name }}
            </div>
          </div>
        </div>
        <div v-else class="text-sm text-gray-500">尚无常用表情，使用表情后会自动添加到常用。</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.emoji-item {
  width: 80px;
}
</style>
