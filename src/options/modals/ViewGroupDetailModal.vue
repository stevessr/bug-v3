<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue'
import { marked } from 'marked'
import DOMPurify from 'dompurify'

const props = defineProps({
  show: { type: Boolean, required: true },
  groupName: { type: String, required: true },
  detail: { type: String, default: '' }
})

const emits = defineEmits(['update:show'])

// Configure marked for safe rendering
marked.setOptions({
  breaks: true,
  gfm: true
})

const renderedDetail = computed(() => {
  if (!props.detail || !props.detail.trim()) {
    return '<p class="text-gray-500 dark:text-gray-400 italic">暂无详细信息</p>'
  }
  try {
    const html = marked.parse(props.detail) as string
    return DOMPurify.sanitize(html)
  } catch (error) {
    console.error('Error rendering markdown:', error)
    return `<p class="text-red-500">渲染失败</p>`
  }
})

const detailContainer = ref<HTMLElement | null>(null)

watchEffect(() => {
  const el = detailContainer.value
  if (!el) {
    return
  }
  el.innerHTML = renderedDetail.value
})

const close = () => {
  emits('update:show', false)
}
</script>

<template>
  <div
    v-if="show"
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
    @click="close"
  >
    <div
      class="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto"
      @click.stop
    >
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-lg font-semibold dark:text-white">{{ groupName }} - 详细信息</h3>
        <button
          @click="close"
          class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
          title="关闭"
        >
          ✕
        </button>
      </div>

      <!-- Markdown rendered content with prose styling -->
      <div
        ref="detailContainer"
        class="prose prose-sm dark:prose-invert max-w-none markdown-content"
      ></div>

      <div class="flex justify-end mt-6">
        <a-button
          @click="close"
          class="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          title="关闭分组详细信息"
        >
          关闭
        </a-button>
      </div>
    </div>
  </div>
</template>

<style scoped src="./ViewGroupDetailModal.css" />
