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

<style scoped>
/* Additional styling for markdown content */
.markdown-content {
  @apply text-gray-900 dark:text-gray-100;
}

.markdown-content :deep(h1),
.markdown-content :deep(h2),
.markdown-content :deep(h3),
.markdown-content :deep(h4),
.markdown-content :deep(h5),
.markdown-content :deep(h6) {
  @apply font-semibold mt-4 mb-2 dark:text-white;
}

.markdown-content :deep(p) {
  @apply mb-3;
}

.markdown-content :deep(ul),
.markdown-content :deep(ol) {
  @apply pl-5 mb-3;
}

.markdown-content :deep(li) {
  @apply mb-1;
}

.markdown-content :deep(code) {
  @apply bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded text-sm;
}

.markdown-content :deep(pre) {
  @apply bg-gray-100 dark:bg-gray-700 p-3 rounded overflow-x-auto mb-3;
}

.markdown-content :deep(pre code) {
  @apply bg-transparent p-0;
}

.markdown-content :deep(blockquote) {
  @apply border-l-4 border-gray-300 dark:border-gray-600 pl-4 italic my-3;
}

.markdown-content :deep(a) {
  @apply text-blue-600 dark:text-blue-400 hover:underline;
}

.markdown-content :deep(table) {
  @apply border-collapse w-full mb-3;
}

.markdown-content :deep(th),
.markdown-content :deep(td) {
  @apply border border-gray-300 dark:border-gray-600 px-3 py-2;
}

.markdown-content :deep(th) {
  @apply bg-gray-100 dark:bg-gray-700 font-semibold;
}

.markdown-content :deep(img) {
  @apply max-w-full h-auto rounded;
}
</style>
