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
            gridTemplateColumns: `repeat(${emojiStore.settings.gridColumns}, minmax(0, 1fr))`,
          }"
        >
          <div
            v-for="(emoji, idx) in favoritesGroup.emojis"
            :key="`fav-${emoji.id || idx}`"
            class="emoji-item relative"
          >
            <div class="aspect-square bg-gray-50 rounded-lg overflow-hidden">
              <img
                :src="emoji.url"
                :alt="emoji.name"
                class="w-full h-full object-cover"
              />
            </div>
            <div class="absolute top-1 right-1 flex gap-1">
              <button @click="$emit('edit', emoji, 'favorites', idx)" title="编辑" class="text-xs px-1 py-0.5 bg-white bg-opacity-80 rounded">编辑</button>
              <button @click="$emit('remove', 'favorites', idx)" title="移除" class="text-xs px-1 py-0.5 bg-white bg-opacity-80 rounded">移除</button>
            </div>
            <div class="text-xs text-center text-gray-600 mt-1 truncate">
              {{ emoji.name }}
            </div>
          </div>
        </div>
        <div v-else class="text-sm text-gray-500">
          尚无常用表情，使用表情后会自动添加到常用。
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
const props = defineProps<{
  emojiStore: any;
}>();

const favoritesGroup = computed(() =>
  props.emojiStore?.sortedGroups?.find((g: any) => g.id === "favorites")
);
</script>

<style scoped>
.emoji-item {
  width: 80px;
}
</style>
