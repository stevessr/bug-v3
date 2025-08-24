<template>
  <div v-if="false" class="bg-white rounded-lg shadow-sm border">
    <div class="px-6 py-4 border-b border-gray-200">
      <div class="flex justify-between items-center">
        <h2 class="text-lg font-semibold text-gray-900">表情管理</h2>
        <div class="flex gap-2">
          <select
            v-model="selectedGroupId"
            class="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">所有分组</option>
            <option v-for="group in emojiStore.groups" :key="group.id" :value="group.id">
              {{ group.name }}
            </option>
          </select>
          <button
            @click="$emit('open-add-emoji')"
            class="px-4 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
          >
            添加表情
          </button>
        </div>
      </div>
    </div>

    <div class="p-6">
      <div class="grid grid-cols-6 gap-4">
        <div
          v-for="emoji in filteredEmojis"
          :key="emoji.id"
          class="relative group border border-gray-200 rounded-lg p-3 hover:border-gray-300 transition-colors"
        >
          <img
            :src="emoji.url"
            :alt="emoji.name"
            class="w-full h-16 object-contain mb-2"
            @error="$emit('image-error', $event)"
          />
          <p class="text-xs text-gray-600 truncate">{{ emoji.name }}</p>
          <div class="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              @click="$emit('delete-emoji', emoji.id)"
              class="w-6 h-6 bg-red-500 text-white rounded-full text-xs hover:bg-red-600 transition-colors"
            >
              ×
            </button>
          </div>
        </div>
      </div>

      <div v-if="filteredEmojis.length === 0" class="text-center py-12">
        <p class="text-gray-500">暂无表情</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
const props = defineProps<{ emojiStore: any }>()
const emits = defineEmits(['open-add-emoji', 'delete-emoji', 'image-error'])

const selectedGroupId = ref('')

const filteredEmojis = computed(() => {
  if (!selectedGroupId.value) return props.emojiStore.groups.flatMap((group: any) => group.emojis)
  const group = props.emojiStore.groups.find((g: any) => g.id === selectedGroupId.value)
  return group ? group.emojis : []
})
</script>
