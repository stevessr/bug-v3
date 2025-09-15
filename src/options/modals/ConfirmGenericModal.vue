<script setup lang="ts">
import { defineProps, defineEmits } from 'vue'

defineProps<{
  show: boolean
  title?: string
  message?: string
}>()

// keep parameter name for clarity; disable unused-var lint for emit type param
// use runtime emit names to avoid typing parameter name conflicts
const emit = defineEmits(['update:show', 'confirm', 'cancel'])

const close = () => {
  emit('update:show', false)
  emit('cancel')
}
const confirm = () => emit('confirm')
</script>

<template>
  <transition name="modal" appear>
    <div
      v-if="show"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      @click="close"
    >
      <div class="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md" @click.stop>
  <h3 class="text-lg font-semibold mb-4 dark:text-white">{{ title || '确认' }}</h3>
  <p class="text-gray-600 dark:text-gray-300 mb-6">{{ message || '确定要继续此操作吗？' }}</p>
        <div class="flex justify-end gap-3">
          <button
            @click="close"
            class="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
          >
            取消
          </button>
          <button
            @click="confirm"
            class="px-4 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
          >
            确定
          </button>
        </div>
      </div>
    </div>
  </transition>
</template>
