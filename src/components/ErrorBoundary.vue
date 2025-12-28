<script setup lang="ts">
import { ref, onErrorCaptured } from 'vue'

const hasError = ref(false)
const errorMessage = ref('')
const errorStack = ref('')

onErrorCaptured((err: Error, instance, info) => {
  hasError.value = true
  errorMessage.value = err.message || '发生未知错误'
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

        <h3 class="error-title">组件加载失败</h3>
        <p class="error-message">{{ errorMessage }}</p>

        <details v-if="errorStack" class="error-details">
          <summary>查看详细信息</summary>
          <pre class="error-stack">{{ errorStack }}</pre>
        </details>

        <div class="error-actions">
          <button @click="resetError" class="btn-retry">重试</button>
          <button @click="() => window.location.reload()" class="btn-reload">刷新页面</button>
        </div>
      </div>
    </div>

    <slot v-else></slot>
  </div>
</template>

<style scoped>
.error-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  padding: 2rem;
}

.error-card {
  max-width: 500px;
  width: 100%;
  padding: 2rem;
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  text-align: center;
}

.error-icon {
  width: 64px;
  height: 64px;
  margin: 0 auto 1rem;
  color: #ef4444;
}

.error-title {
  font-size: 1.5rem;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 0.5rem;
}

.error-message {
  color: #6b7280;
  margin-bottom: 1rem;
  line-height: 1.5;
}

.error-details {
  margin: 1rem 0;
  text-align: left;
}

.error-details summary {
  cursor: pointer;
  color: #3b82f6;
  font-size: 0.875rem;
  padding: 0.5rem;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.error-details summary:hover {
  background-color: #eff6ff;
}

.error-stack {
  margin-top: 0.5rem;
  padding: 1rem;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  font-size: 0.75rem;
  color: #374151;
  overflow-x: auto;
  max-height: 200px;
  overflow-y: auto;
}

.error-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: center;
  margin-top: 1.5rem;
}

.btn-retry,
.btn-reload {
  padding: 0.5rem 1.5rem;
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-retry {
  background: #3b82f6;
  color: white;
}

.btn-retry:hover {
  background: #2563eb;
}

.btn-reload {
  background: #f3f4f6;
  color: #374151;
}

.btn-reload:hover {
  background: #e5e7eb;
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .error-card {
    background: #1f2937;
  }

  .error-title {
    color: #f9fafb;
  }

  .error-message {
    color: #d1d5db;
  }

  .error-details summary:hover {
    background-color: #374151;
  }

  .error-stack {
    background: #374151;
    border-color: #4b5563;
    color: #e5e7eb;
  }

  .btn-reload {
    background: #374151;
    color: #f9fafb;
  }

  .btn-reload:hover {
    background: #4b5563;
  }
}
</style>
