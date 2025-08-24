<template>
  <div
    v-if="show"
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
    @click="close"
  >
    <div class="bg-white rounded-lg p-6 w-full max-w-md" @click.stop>
      <h3 class="text-lg font-semibold mb-4">新建分组</h3>
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">分组名称</label>
          <input
            v-model="name"
            type="text"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="输入分组名称"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">分组图标 / 图片链接</label>
          <input
            v-model="icon"
            type="text"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="例如：😀 或 https://..."
          />
          <div v-if="isImageUrl(icon)" class="mt-2 text-center">
            <img
              :src="icon"
              alt="预览"
              class="w-10 h-10 object-contain mx-auto border border-gray-200 rounded"
              @error="handleImageError"
            />
          </div>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">分组颜色</label>
          <div class="flex gap-2">
            <div
              v-for="color in colorOptions"
              :key="color"
              :class="[
                'w-8 h-8 rounded cursor-pointer border-2',
                selectedColor === color ? 'border-gray-900' : 'border-gray-300'
              ]"
              :style="{ backgroundColor: color }"
              @click="selectedColor = color"
            ></div>
          </div>
        </div>
      </div>
      <div class="flex justify-end gap-3 mt-6">
        <button
          @click="close"
          class="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded transition-colors"
        >
          取消
        </button>
        <button
          @click="create"
          class="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          创建
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useEmojiStore } from '../../stores/emojiStore'
import { flushBuffer } from '../../utils/indexedDB'
import { isImageUrl } from '../../utils/isImageUrl'

const { show } = defineProps<{ show: boolean }>()

const emits = defineEmits<{
  (e: 'update:show', value: boolean): void
  (e: 'created'): void
}>()

const name = ref('')
const icon = ref('📁')
const selectedColor = ref('#3B82F6')
const colorOptions = [
  '#3B82F6',
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#8B5CF6',
  '#F97316',
  '#06B6D4',
  '#84CC16'
]

const emojiStore = useEmojiStore()

const handleImageError = (event: Event) => {
  const target = event.target as HTMLImageElement
  target.src = ''
}

const close = () => {
  emits('update:show', false)
}

const create = () => {
  if (!name.value.trim()) return
  emojiStore.createGroup(name.value.trim(), icon.value || '📁')
  void flushBuffer(true).then(() => console.log('[CreateGroupModal] created group flushed'))
  name.value = ''
  icon.value = '📁'
  selectedColor.value = '#3B82F6'
  emits('created')
  emits('update:show', false)
}
</script>
