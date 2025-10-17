<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

// 使用静态导入，扩展不需要代码分割
import Popup from './popup/Popup.vue'
import Options from './options/Options.vue'

import router from '@/options/router'

// 检测当前是 popup 模式还是 options 模式
const isPopupMode = ref(false)

onMounted(() => {
  // 通过 URL 查询参数判断模式（新格式：?type={options|popup}&tabs={route 或分组名}）
  const params = new URLSearchParams(window.location.search)
  const type = params.get('type')
  const tabs = params.get('tabs')
  const originalPath = window.location.pathname
  const originalSearch = window.location.search
  console.log('[App.vue] 检测模式', {
    type,
    tabs,
    url: window.location.href,
    search: window.location.search
  })

  // 重构后的优先级逻辑：
  // 1. 有 tabs 参数 -> 强制 Options 模式（Popup 不支持路由）
  // 2. 明确指定 mode=options -> Options 模式
  // 3. 明确指定 type=popup -> Popup 模式
  // 4. 默认 -> Popup 模式
  if (tabs && tabs.length > 0) {
    // 最高优先级：有路由 hash 或 tabs 参数，必须使用 Options 模式
    console.log('[App.vue] 检测到路由 hash 或 tabs 参数，强制使用 Options 模式（Popup 不支持路由）')
    isPopupMode.value = false

    // 如果有 tabs 参数，尝试导航到对应的路由（使用 hash 导航以兼容现有 router）
    // 支持传入路由名（如 groups）或分组名称，优先将其作为路由路径使用
    const target = tabs.startsWith('/') ? tabs : `/${tabs}`
    // 使用 router 进行导航（history 模式）
    // 使用 replace 保持导航的一致性（不在历史中新增一项）
    router
      .replace({ path: target })
      .then(() => {
        // router.replace 会修改地址栏的 path（例如 /groups），但我们希望地址栏保持原始的 index.html?type=...&tabs=...
        // 因此用 history.replaceState 恢复为原始的 path + search
        const restoreUrl = originalPath + (originalSearch || '')
        window.history.replaceState({}, '', restoreUrl)
      })
      .catch(e => {
        console.warn('[App.vue] router navigation failed:', e)
      })

    // 如果 URL 中有 type=popup 参数但又有路由或 tabs，说明 URL 不一致，清理该参数
    if (type === 'popup') {
      console.warn('[App.vue] 警告：URL 包含 type=popup 但有 tabs，已自动切换到 Options 模式')
      // 清理 URL，移除不一致的 type=popup 参数，但保留查询参数（例如 tabs）
      const search = window.location.search || ''
      const keptParams = new URLSearchParams(search)
      keptParams.delete('type')
      const newUrl =
        window.location.pathname + (keptParams.toString() ? `?${keptParams.toString()}` : '')
      window.history.replaceState({}, '', newUrl)
      console.log('[App.vue] 已清理 URL 为：', newUrl)
    }
  } else if (type === 'options') {
    // 优先级 2: URL 明确指定 options 模式
    console.log('[App.vue] URL 明确指定 options 模式')
    isPopupMode.value = false
  } else if (type === 'popup') {
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
