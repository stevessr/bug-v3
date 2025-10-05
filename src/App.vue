<script setup lang="ts">
import { computed, onMounted, ref, defineAsyncComponent, onErrorCaptured } from 'vue'

// 使用动态导入来减小初始包大小，并添加错误处理
const Popup = defineAsyncComponent({
  loader: () => import('./popup/Popup.vue'),
  loadingComponent: { template: '<div class="loading-spinner">加载 Popup 组件中...</div>' },
  errorComponent: { template: '<div class="error-message">Popup 组件加载失败，请刷新页面重试</div>' },
  delay: 200,
  timeout: 10000
})

const Options = defineAsyncComponent({
  loader: () => import('./options/Options.vue'),
  loadingComponent: { template: '<div class="loading-spinner">加载 Options 组件中...</div>' },
  errorComponent: { template: '<div class="error-message">Options 组件加载失败，请刷新页面重试</div>' },
  delay: 200,
  timeout: 10000
})

// 检测当前是 popup 模式还是 options 模式
const isPopupMode = ref(false)
const isLoading = ref(true)
const hasError = ref(false)
const errorMessage = ref('')

// 捕获组件错误
onErrorCaptured((err, _instance, info) => {
  console.error('[App.vue] Component Error:', err, info)
  hasError.value = true
  errorMessage.value = `Component loading error: ${err.message || err}`
  return false // 阻止错误继续传播
})

// 重新加载页面
const reloadPage = () => {
  window.location.reload()
}

onMounted(() => {
  // 通过 URL 参数判断模式
  const params = new URLSearchParams(window.location.search)
  const mode = params.get('mode')
  const hash = window.location.hash
  const hasRouteHash = hash && hash.length > 1 && hash !== '#/'

  console.log('[App.vue] 检测模式', { 
    mode, 
    hasRouteHash, 
    hash, 
    url: window.location.href,
    search: window.location.search
  })

  // 新的优先级逻辑：
  // 1. 明确指定 mode=options -> Options 模式
  // 2. 明确指定 mode=popup -> Popup 模式
  // 3. 有路由 hash -> Options 模式（因为需要路由功能）
  // 4. 默认 -> Popup 模式
  
  if (mode === 'options') {
    // 优先级 1: URL 明确指定 options 模式
    console.log('[App.vue] URL 明确指定 options 模式')
    isPopupMode.value = false
  } else if (mode === 'popup') {
    // 优先级 2: URL 明确指定 popup 模式
    console.log('[App.vue] URL 明确指定 popup 模式')
    isPopupMode.value = true
    // 如果同时有路由 hash，给出警告并清理路由
    if (hasRouteHash) {
      console.warn('[App.vue] 警告：popup 模式不支持路由，将清除路由 hash')
      window.history.replaceState({}, '', window.location.pathname + window.location.search)
    }
  } else if (hasRouteHash) {
    // 优先级 3: 有路由 hash，需要使用 options 模式来支持路由
    console.log('[App.vue] 检测到路由 hash，使用 Options 模式以支持路由功能')
    isPopupMode.value = false
  } else {
    // 优先级 4: 默认使用 popup 模式
    console.log('[App.vue] 无明确参数，默认使用 Popup 模式')
    isPopupMode.value = true
  }

  console.log('[App.vue] 最终模式：', isPopupMode.value ? 'Popup' : 'Options')
  
  // 设置一个短暂延迟确保组件能正确加载
  setTimeout(() => {
    isLoading.value = false
    console.log('[App.vue] 加载状态设置为 false，组件应该显示了')
  }, 50)
})

// 动态组件
const currentComponent = computed(() => {
  return isPopupMode.value ? Popup : Options
})
</script>

<template>
  <div v-if="hasError" class="error-container">
    <div class="error-content">
      <h2>组件加载错误</h2>
      <p>{{ errorMessage }}</p>
      <button @click="reloadPage" class="reload-button">
        刷新页面
      </button>
    </div>
  </div>
  <div v-else-if="isLoading" class="loading-container">
    <div class="loading-spinner">
      <div class="spinner-icon"></div>
      <div>正在加载 {{ isPopupMode ? 'Popup' : 'Options' }} 组件...</div>
    </div>
  </div>
  <Suspense v-else>
    <component :is="currentComponent" />
    <template #fallback>
      <div class="loading-container">
        <div class="loading-spinner">
          <div class="spinner-icon"></div>
          <div>组件加载中...</div>
        </div>
      </div>
    </template>
  </Suspense>
</template>

<style>
/* 基础样式已在各自组件中定义 */
html,
body,
#app {
  height: 100%;
  margin: 0;
  padding: 0;
}

.loading-container,
.error-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  background-color: #f5f5f5;
}

.loading-spinner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  font-size: 16px;
  color: #1890ff;
}

.spinner-icon {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #1890ff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.error-container {
  background-color: #fff5f5;
}

.error-content {
  text-align: center;
  padding: 32px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  max-width: 500px;
}

.error-content h2 {
  color: #f5222d;
  margin-bottom: 16px;
}

.error-content p {
  color: #666;
  margin-bottom: 24px;
}

.error-message {
  color: #f5222d;
  padding: 16px;
  background: #fff5f5;
  border-radius: 4px;
  border: 1px solid #ffccc7;
}

.reload-button {
  padding: 8px 24px;
  background-color: #1890ff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.3s;
}

.reload-button:hover {
  background-color: #40a9ff;
}
</style>
