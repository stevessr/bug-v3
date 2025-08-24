<template>
  <div>
    <transition name="toast" appear>
      <div
        v-if="showSuccess"
        class="toast success fixed bottom-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50"
        role="status"
      >
        <div class="flex items-center gap-3">
          <div class="flex-1">{{ successMessage }}</div>
          <button @click="closeSuccess" class="text-white/90">✕</button>
        </div>
      </div>
    </transition>

    <transition name="toast" appear>
      <div
        v-if="showError"
        class="toast error fixed bottom-4 right-4 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-50"
        role="alert"
      >
        <div class="flex items-center gap-3">
          <div class="flex-1">{{ errorMessage }}</div>
          <button @click="closeError" class="text-white/90">✕</button>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { defineProps, defineEmits } from 'vue'

const { showSuccess, successMessage, showError, errorMessage } = defineProps<{
  showSuccess: boolean
  successMessage: string
  showError: boolean
  errorMessage: string
}>()

const emit = defineEmits<{
  (e: 'update:showSuccess', value: boolean): void
  (e: 'update:showError', value: boolean): void
}>()

const closeSuccess = () => emit('update:showSuccess', false)
const closeError = () => emit('update:showError', false)
</script>

<style scoped>
/* toast slide up + fade */
.toast-enter-from,
.toast-leave-to {
  transform: translateY(8px);
  opacity: 0;
}
.toast-enter-active,
.toast-leave-active {
  transition:
    transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1),
    opacity 220ms ease;
}

.toast {
  will-change: transform, opacity;
}

.toast.success {
  background-color: #16a34a; /* tailwind green-600 */
}
.toast.error {
  background-color: #dc2626; /* tailwind red-600 */
}
</style>
