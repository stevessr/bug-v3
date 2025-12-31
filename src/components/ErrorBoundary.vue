<script setup lang="ts">
import { ref, onErrorCaptured } from 'vue'

const { t } = useI18n()

const hasError = ref(false)
const errorMessage = ref('')
const errorStack = ref('')

onErrorCaptured((err: Error, instance, info) => {
  hasError.value = true
  errorMessage.value = err.message || t('unknownError')
  errorStack.value = err.stack || ''

  console.error('[ErrorBoundary] Caught error:', {
    message: err.message,
    stack: err.stack,
    component: instance?.$options.name || 'Unknown',
    info
  })

  // 阻止错误向上传播
  return false
})

const resetError = () => {
  hasError.value = false
  errorMessage.value = ''
  errorStack.value = ''
}

const reloadPage = () => {
  window.location.reload()
}
</script>

<template>
  <div class="error-boundary">
    <div v-if="hasError" class="error-container">
      <div class="error-card">
        <svg class="error-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          ></path>
        </svg>

        <h3 class="error-title">{{ t('componentLoadFailed') }}</h3>
        <p class="error-message">{{ errorMessage }}</p>

        <details v-if="errorStack" class="error-details">
          <summary>{{ t('viewDetails') }}</summary>
          <pre class="error-stack">{{ errorStack }}</pre>
        </details>

        <div class="error-actions">
          <button @click="resetError" class="btn-retry">{{ t('retry') }}</button>
          <button @click="reloadPage" class="btn-reload">{{ t('reloadPage') }}</button>
        </div>
      </div>
    </div>

    <slot v-else></slot>
  </div>
</template>

<style scoped src="./ErrorBoundary.css" />
