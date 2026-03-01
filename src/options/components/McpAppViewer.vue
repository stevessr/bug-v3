<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import {
  LoadingOutlined,
  ReloadOutlined,
  FullscreenOutlined,
  CloseOutlined
} from '@ant-design/icons-vue'

import { fetchUIResource, createAppSandbox, sendMessageToApp } from '@/agent/mcpUI'
import type { McpServerConfig } from '@/agent/types'

const props = defineProps<{
  server: McpServerConfig
  resourceUri: string
  toolResult?: unknown
  height?: string
}>()

const emit = defineEmits<{
  message: [data: unknown]
  close: []
  callTool: [name: string, args: Record<string, unknown>]
}>()

const containerRef = ref<HTMLDivElement>()
const loading = ref(true)
const error = ref<string | null>(null)
const fullscreen = ref(false)

let sandbox: { iframe: HTMLIFrameElement; destroy: () => void } | null = null

// 加载并渲染 MCP App
const loadApp = async () => {
  if (!containerRef.value) return

  loading.value = true
  error.value = null

  // 销毁之前的沙箱
  if (sandbox) {
    sandbox.destroy()
    sandbox = null
  }

  try {
    // 获取 UI 资源
    const resource = await fetchUIResource(props.server, props.resourceUri)

    if (!resource) {
      error.value = '无法加载 UI 资源'
      loading.value = false
      return
    }

    // 创建沙箱
    sandbox = createAppSandbox(resource, containerRef.value, {
      height: props.height || '400px',
      onMessage: handleAppMessage
    })

    // 等待 iframe 加载完成
    sandbox.iframe.onload = () => {
      loading.value = false

      // 如果有工具结果，发送给 App
      if (props.toolResult !== undefined) {
        sendToolResult(props.toolResult)
      }
    }

    sandbox.iframe.onerror = () => {
      loading.value = false
      error.value = '加载 App 失败'
    }
  } catch (err) {
    loading.value = false
    error.value = err instanceof Error ? err.message : '加载失败'
  }
}

// 处理来自 App 的消息
const handleAppMessage = (data: unknown) => {
  if (typeof data !== 'object' || data === null) return

  const msg = data as Record<string, unknown>

  // 处理标准 MCP App 消息
  if (msg.type === 'mcp-app') {
    const payload = msg.payload as Record<string, unknown>

    switch (payload?.method) {
      case 'callServerTool':
        // App 请求调用服务器工具
        emit(
          'callTool',
          payload.name as string,
          (payload.arguments as Record<string, unknown>) || {}
        )
        break

      case 'ready':
        // App 准备就绪，发送初始数据
        if (props.toolResult !== undefined) {
          sendToolResult(props.toolResult)
        }
        break

      default:
        // 其他消息转发给父组件
        emit('message', data)
    }
  } else {
    emit('message', data)
  }
}

// 发送工具结果给 App
const sendToolResult = (result: unknown) => {
  if (!sandbox) return

  sendMessageToApp(sandbox.iframe, {
    type: 'mcp-app',
    payload: {
      method: 'toolResult',
      content: Array.isArray(result) ? result : [{ type: 'text', text: JSON.stringify(result) }]
    }
  })
}

// 发送工具调用结果给 App
const sendToolCallResult = (name: string, result: unknown) => {
  if (!sandbox) return

  sendMessageToApp(sandbox.iframe, {
    type: 'mcp-app',
    payload: {
      method: 'callServerToolResult',
      name,
      result
    }
  })
}

// 重新加载
const reload = () => {
  loadApp()
}

// 切换全屏
const toggleFullscreen = () => {
  fullscreen.value = !fullscreen.value
}

// 关闭
const close = () => {
  emit('close')
}

// 暴露方法供父组件调用
defineExpose({
  sendToolResult,
  sendToolCallResult,
  reload
})

// 监听 resourceUri 变化
watch(() => props.resourceUri, loadApp)

// 监听 toolResult 变化
watch(
  () => props.toolResult,
  newResult => {
    if (newResult !== undefined && sandbox && !loading.value) {
      sendToolResult(newResult)
    }
  }
)

onMounted(loadApp)

onUnmounted(() => {
  if (sandbox) {
    sandbox.destroy()
    sandbox = null
  }
})
</script>

<template>
  <div
    class="mcp-app-viewer"
    :class="{
      'fixed inset-0 z-50 bg-black/50': fullscreen,
      'p-4': fullscreen
    }"
  >
    <div
      class="bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow-lg"
      :class="{
        'h-full': fullscreen
      }"
    >
      <!-- 头部工具栏 -->
      <div
        class="flex items-center justify-between px-3 py-2 bg-gray-100 dark:bg-gray-700 border-b dark:border-gray-600"
      >
        <div class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          <span
            class="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded text-xs"
          >
            MCP App
          </span>
          <span class="truncate max-w-xs">{{ resourceUri }}</span>
        </div>

        <div class="flex items-center gap-1">
          <a-button size="small" type="text" @click="reload" :loading="loading">
            <template #icon><ReloadOutlined /></template>
          </a-button>
          <a-button size="small" type="text" @click="toggleFullscreen">
            <template #icon><FullscreenOutlined /></template>
          </a-button>
          <a-button size="small" type="text" @click="close">
            <template #icon><CloseOutlined /></template>
          </a-button>
        </div>
      </div>

      <!-- 内容区域 -->
      <div
        class="relative"
        :style="{ height: fullscreen ? 'calc(100% - 40px)' : height || '400px' }"
      >
        <!-- 加载状态 -->
        <div
          v-if="loading"
          class="absolute inset-0 flex items-center justify-center bg-gray-50 dark:bg-gray-800"
        >
          <div class="text-center">
            <LoadingOutlined class="text-3xl text-blue-500 mb-2" />
            <p class="text-gray-500 dark:text-gray-400">加载中...</p>
          </div>
        </div>

        <!-- 错误状态 -->
        <div
          v-else-if="error"
          class="absolute inset-0 flex items-center justify-center bg-gray-50 dark:bg-gray-800"
        >
          <div class="text-center text-red-500">
            <p class="mb-2">{{ error }}</p>
            <a-button size="small" @click="reload">重试</a-button>
          </div>
        </div>

        <!-- App 容器 -->
        <div ref="containerRef" class="w-full h-full" />
      </div>

      <!-- 安全提示 -->
      <div
        class="px-3 py-1.5 bg-yellow-50 dark:bg-yellow-900/20 text-xs text-yellow-700 dark:text-yellow-300 border-t dark:border-gray-600"
      >
        此 App 运行在安全沙箱中，无法访问您的数据
      </div>
    </div>
  </div>
</template>

<style scoped>
.mcp-app-viewer :deep(iframe) {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
