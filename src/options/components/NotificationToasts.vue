<script setup lang="ts">
const { showSuccess, successMessage, showError, errorMessage } = defineProps<{
  showSuccess: boolean
  successMessage: string
  showError: boolean
  errorMessage: string
}>()

const emit = defineEmits(['update:showSuccess', 'update:showError'])

const closeSuccess = () => emit('update:showSuccess', false)
const closeError = () => emit('update:showError', false)
</script>

<template>
  <div>
    <transition name="toast" appear>
      <div
        v-if="showSuccess"
        class="toast success fixed bottom-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50"
        role="status"
      >
        <div
          class="flex items-center gap-3 bg-green-500/10 dark:bg-green-500/20 rounded-lg px-3 py-2"
        >
          <div class="flex-1">{{ successMessage }}</div>
          <a-button @click="closeSuccess" class="text-white/90 bg-green-500 dark:bg-green-600">✕</a-button>
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
          <a-button @click="closeError" class="text-white/90 bg-red-500 dark:bg-red-600">✕</a-button>
        </div>
      </div>
    </transition>
  </div>
</template>

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
