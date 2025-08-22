<template>
  <div class="space-y-8">
    <div class="bg-white rounded-lg shadow-sm border">
      <div class="px-6 py-4 border-b border-gray-200">
        <div class="flex justify-between items-center">
          <h2 class="text-lg font-semibold text-gray-900">未分组表情</h2>
        </div>
      </div>

      <div class="p-6">
        <div v-if="ungroup && ungroup.emojis?.length" class="grid gap-3" :style="{ gridTemplateColumns: `repeat(${emojiStore.settings.gridColumns}, minmax(0, 1fr))` }">
          <div v-for="(emoji, idx) in ungroup.emojis" :key="`ung-${emoji.id || idx}`" class="emoji-item relative">
            <div class="aspect-square bg-gray-50 rounded-lg overflow-hidden">
              <img :src="emoji.url" :alt="emoji.name" class="w-full h-full object-cover" />
            </div>
            <div class="absolute top-1 right-1 flex gap-1">
              <button @click="$emit('edit', emoji, ungroup.id, idx)" title="编辑" class="text-xs px-1 py-0.5 bg-white bg-opacity-80 rounded">编辑</button>
              <button @click="$emit('remove', ungroup.id, idx)" title="移除" class="text-xs px-1 py-0.5 bg-white bg-opacity-80 rounded">移除</button>
            </div>
            <div class="text-xs text-center text-gray-600 mt-1 truncate">{{ emoji.name }}</div>
          </div>
        </div>
        <div v-else class="text-sm text-gray-500">未分组表情为空。</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
const props = defineProps<{ emojiStore: any }>();
const emits = defineEmits<{
  (e: 'remove', groupId: string, idx: number): void;
  (e: 'edit', emoji: any, groupId: string, idx: number): void;
}>();

const ungroup = computed(() => props.emojiStore?.groups?.find((g: any) => g.id === 'ungrouped'));
</script>

<style scoped>
.emoji-item { width: 80px; }
</style>
