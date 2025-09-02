<script setup lang="ts">
/* eslint-disable @typescript-eslint/no-explicit-any */
import { computed, ref } from 'vue'
import { Dropdown as ADropdown, Menu as AMenu, Button as AButton } from 'ant-design-vue'
import { DownOutlined } from '@ant-design/icons-vue'

import { useEmojiStore } from '../../stores/emojiStore'

defineEmits(['openAddEmoji', 'deleteEmoji', 'imageError'])

const emojiStore = useEmojiStore()
const selectedGroupId = ref('')

const filteredEmojis = computed(() => {
  if (!selectedGroupId.value) return emojiStore.groups.flatMap((group: any) => group.emojis)
  const group = emojiStore.groups.find((g: any) => g.id === selectedGroupId.value)
  return group ? group.emojis : []
})

const onSelectedGroupSelect = (info: { key: string | number }) => {
  selectedGroupId.value = String(info.key)
}

const selectedGroupLabel = computed(() => {
  if (!selectedGroupId.value) return '所有分组'
  const g = emojiStore.groups.find((x: any) => x.id === selectedGroupId.value)
  return g ? g.name : '所有分组'
})
</script>

<template>
  <div v-if="false" class="bg-white rounded-lg shadow-sm border">
    <div class="px-6 py-4 border-b border-gray-200">
      <div class="flex justify-between items-center">
        <h2 class="text-lg font-semibold text-gray-900">表情管理</h2>
        <div class="flex gap-2">
          <ADropdown>
            <template #overlay>
              <AMenu @click="onSelectedGroupSelect">
                <AMenu.Item key="">所有分组</AMenu.Item>
                <AMenu.Item v-for="group in emojiStore.groups" :key="group.id" :value="group.id">
                  {{ group.name }}
                </AMenu.Item>
              </AMenu>
            </template>
            <AButton>
              {{ selectedGroupLabel }}
              <DownOutlined />
            </AButton>
          </ADropdown>
          <button
            @click="$emit('openAddEmoji')"
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
            @error="$emit('imageError', $event)"
          />
          <p class="text-xs text-gray-600 truncate">{{ emoji.name }}</p>
          <div class="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              @click="$emit('deleteEmoji', emoji.id)"
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
