<script setup lang="ts">
import { ref, watch } from 'vue'

import { normalizeImageUrl } from '../../utils/isImageUrl'
const props = defineProps({
  show: { type: Boolean, required: true },
  editingGroupId: { type: String, required: true },
  initialName: { type: String, required: true },
  initialIcon: { type: String, required: true },
  initialDetail: { type: String, default: '' },
  isImageUrl: { type: Function }
})
const emits = defineEmits(['update:show', 'save', 'imageError'])

const localName = ref(props.initialName || '')
const localIcon = ref(props.initialIcon || '')
const localDetail = ref(props.initialDetail || '')

watch(
  () => props.initialName,
  v => (localName.value = v || '')
)
watch(
  () => props.initialIcon,
  v => (localIcon.value = v || '')
)
watch(
  () => props.initialDetail,
  v => (localDetail.value = v || '')
)

const save = () => {
  emits('save', {
    id: props.editingGroupId,
    name: localName.value.trim(),
    icon: localIcon.value || '📁',
    detail: localDetail.value.trim()
  })
  emits('update:show', false)
}
</script>

<template>
  <div
    v-if="show"
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
    @click="$emit('update:show', false)"
  >
    <div class="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md" @click.stop>
      <h3 class="text-lg font-semibold mb-4 dark:text-white">编辑分组</h3>
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1 dark:text-white">
            分组名称
          </label>
          <input
            v-model="localName"
            type="text"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-black dark:text-white dark:border-gray-600"
            title="分组名称"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1 dark:text-white">
            分组图标/图片链接
          </label>
          <input
            v-model="localIcon"
            type="text"
            placeholder="例如：😀 或 https://..."
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-black dark:text-white dark:border-gray-600"
            title="分组图标或图片链接"
          />
          <div
            v-if="isImageUrl && isImageUrl(normalizeImageUrl(localIcon))"
            class="mt-2 text-center"
          >
            <img
              :src="normalizeImageUrl(localIcon)"
              alt="预览"
              class="w-10 h-10 object-contain mx-auto border border-gray-200 rounded"
              @error="$emit('imageError', $event)"
            />
          </div>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1 dark:text-white">
            详细信息（支持 Markdown 格式）
          </label>
          <textarea
            v-model="localDetail"
            rows="6"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-black dark:text-white dark:border-gray-600"
            placeholder="输入分组的详细描述信息，支持 Markdown 格式..."
            title="分组详细描述 (支持 Markdown)"
          ></textarea>
        </div>
      </div>
      <div class="flex justify-end gap-3 mt-6">
        <a-button
          @click="$emit('update:show', false)"
          class="px-4 py-2 text-sm text-gray-600 dark:text-white hover:bg-gray-100 rounded transition-colors"
          title="取消编辑分组"
        >
          取消
        </a-button>
        <a-button
          @click="save"
          class="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          title="保存分组更改"
        >
          保存
        </a-button>
      </div>
    </div>
  </div>
</template>
