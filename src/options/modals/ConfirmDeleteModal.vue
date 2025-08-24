<script setup lang="ts">
import { defineProps, defineEmits } from 'vue'

const { show, group } = defineProps<{
  show: boolean
  group: { id?: string; name?: string } | null
}>()

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
  (e: 'confirm'): void
}>()

const close = () => emit('update:show', false)
const cancel = () => emit('update:show', false)
const confirmDelete = () => emit('confirm')
</script>

<template>
  <transition name="modal" appear>
    <div
      v-if="show"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      @click="close"
    >
      <div class="bg-white rounded-lg p-6 w-full max-w-md" @click.stop>
        <h3 class="text-lg font-semibold mb-4">确认删除</h3>
        <p class="text-gray-600 mb-6">
          确定要删除分组 "{{ group?.name }}" 吗？分组中的表情也会被删除。
        </p>
        <div class="flex justify-end gap-3">
          <button
            @click="cancel"
            class="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded transition-colors"
          >
            取消
          </button>
          <button
            @click="confirmDelete"
            class="px-4 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
          >
            删除
          </button>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
/* backdrop fade */
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
.modal-enter-active,
.modal-leave-active {
  transition: opacity 180ms ease-out;
}
.modal-panel {
  transform-origin: center center;
}
.modal-enter-from .modal-panel,
.modal-leave-to .modal-panel {
  transform: scale(0.96);
  opacity: 0;
}
.modal-enter-active .modal-panel,
.modal-leave-active .modal-panel {
  transition:
    transform 180ms ease-out,
    opacity 180ms ease-out;
}
</style>
