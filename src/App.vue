<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

// 使用静态导入，扩展不需要代码分割
import Popup from './popup/Popup.vue'
import Options from './options/Options.vue'

// 检测当前是 popup 模式还是 options 模式
const isPopupMode = ref(false)

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

  // 重构后的优先级逻辑：
  // 1. 有路由 hash -> 强制 Options 模式（因为 Popup 不支持路由）
  // 2. 明确指定 mode=options -> Options 模式
  // 3. 明确指定 mode=popup -> Popup 模式
  // 4. 默认 -> Popup 模式
  
  if (hasRouteHash) {
    // 最高优先级：有路由 hash，必须使用 Options 模式
    console.log('[App.vue] 检测到路由 hash，强制使用 Options 模式（Popup 不支持路由）')
    isPopupMode.value = false
    
    // 如果 URL 中有 mode=popup 参数但又有路由，说明 URL 不一致，清理参数
    if (mode === 'popup') {
      console.warn('[App.vue] 警告：URL 包含 mode=popup 但有路由 hash，已自动切换到 Options 模式')
      // 清理 URL，移除不一致的 mode=popup 参数
      const newUrl = window.location.pathname + window.location.hash
      window.history.replaceState({}, '', newUrl)
      console.log('[App.vue] 已清理 URL 为：', newUrl)
    }
  } else if (mode === 'options') {
    // 优先级 2: URL 明确指定 options 模式
    console.log('[App.vue] URL 明确指定 options 模式')
    isPopupMode.value = false
  } else if (mode === 'popup') {
    // 优先级 3: URL 明确指定 popup 模式
    console.log('[App.vue] URL 明确指定 popup 模式')
    isPopupMode.value = true
  } else {
    // 优先级 4: 默认使用 popup 模式
    console.log('[App.vue] 无明确参数，默认使用 Popup 模式')
    isPopupMode.value = true
  }

  console.log('[App.vue] 最终模式：', isPopupMode.value ? 'Popup' : 'Options')
  
  // 根据模式为 body 添加对应的 class，以应用不同的样式
  if (isPopupMode.value) {
    document.body.classList.add('popup-mode')
    document.body.classList.remove('options-mode')
  } else {
    document.body.classList.add('options-mode')
    document.body.classList.remove('popup-mode')
  }
})

// 动态组件
const currentComponent = computed(() => {
  return isPopupMode.value ? Popup : Options
})
</script>

<template>
  <component :is="currentComponent" />
</template>

<style>
/* 基础样式已在各自组件中定义 */
html,
body {
  margin: 0;
  padding: 0;
  width: 100%;
}

#app {
  width: 100%;
}

/* Popup 模式：固定高度，内部滚动 */
body.popup-mode,
body.popup-mode html,
body.popup-mode #app {
  height: 100%;
  overflow: hidden;
}

/* Options 模式：允许页面滚动 */
body.options-mode {
  min-height: 100vh;
  overflow-y: auto;
}

body.options-mode #app {
  min-height: 100vh;
}
</style>
