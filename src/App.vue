<script setup lang="ts">
import { computed, onMounted, ref, defineAsyncComponent } from 'vue'

// 使用动态导入来减小初始包大小
const Popup = defineAsyncComponent(() => import('./popup/Popup.vue'))
const Options = defineAsyncComponent(() => import('./options/Options.vue'))

// 检测当前是 popup 模式还是 options 模式
const isPopupMode = ref(false)

onMounted(() => {
  // 通过 URL 参数判断模式
  const params = new URLSearchParams(window.location.search)
  const mode = params.get('mode')
  
  if (mode === 'popup') {
    isPopupMode.value = true
  } else if (mode === 'options') {
    isPopupMode.value = false
  } else {
    // 如果没有指定模式，通过窗口大小和 hash 判断
    // 如果 URL 包含路由 hash，说明是 options 页面
    const hasRouteHash = window.location.hash && window.location.hash.length > 1
    if (hasRouteHash) {
      isPopupMode.value = false
    } else {
      // 否则通过窗口大小判断：popup 通常是较小的窗口
      const isSmallWindow = window.innerWidth < 500 || window.innerHeight < 500
      isPopupMode.value = isSmallWindow
    }
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
body,
#app {
  height: 100%;
  margin: 0;
  padding: 0;
}

/* 异步组件加载时的样式 */
.v-async-component {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
