<script setup lang="ts">
import { type PropType } from 'vue'

const props = defineProps({
  // visible holds the groupId when the chooser should be shown
  visible: { type: String as PropType<string | null>, required: false },
  previewByNameCount: { type: Number as PropType<number | null>, required: false },
  previewByUrlCount: { type: Number as PropType<number | null>, required: false }
})

const emit = defineEmits<{
  (e: 'update:visible', v: string | null): void
  (e: 'confirm', groupId: string | null, mode: 'name' | 'url'): void
}>()

const close = () => emit('update:visible', null)

const confirmName = () => {
  emit('confirm', props.visible ?? null, 'name')
  // ensure chooser closes
  emit('update:visible', null)
}

const confirmUrl = () => {
  emit('confirm', props.visible ?? null, 'url')
  emit('update:visible', null)
}
</script>

<template>
  <div v-if="visible" class="fixed inset-0 flex items-center justify-center" style="z-index: 1000">
    <div class="bg-black/40 absolute inset-0" style="z-index: 1000" @click="close"></div>
    <div
      class="bg-white dark:bg-gray-800 p-4 rounded shadow-lg w-80"
      style="z-index: 1010; pointer-events: auto"
    >
      <h3 class="font-medium mb-2 dark:text-white">去重方式</h3>
      <p class="text-sm text-gray-600 dark:text-white mb-4">请请选择按名称还是按 URL 去重</p>
      <div class="flex gap-2 justify-end">
        <button
          class="px-3 py-1 border dark:border-gray-600 rounded dark:text-white dark:hover:bg-gray-700"
          @click.prevent="close"
        >
          取消
        </button>

        <a-popconfirm
          placement="top"
          :title="`确认按名称去重吗？将删除 ${previewByNameCount ?? 0} 个重复表情。此操作不可撤销。`"
          ok-text="确定"
          cancel-text="取消"
          @confirm="confirmName"
        >
          <button class="px-3 py-1 bg-blue-600 text-white rounded">按名称</button>
        </a-popconfirm>

        <a-popconfirm
          placement="top"
          :title="`确认按 URL 去重吗？将删除 ${previewByUrlCount ?? 0} 个重复表情。此操作不可撤销。`"
          ok-text="确定"
          cancel-text="取消"
          @confirm="confirmUrl"
        >
          <button class="px-3 py-1 bg-green-600 text-white rounded">按 URL</button>
        </a-popconfirm>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* keep same minimal styling as inline version */
</style>
