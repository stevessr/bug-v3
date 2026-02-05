<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import {
  ApiOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ReloadOutlined,
  CopyOutlined,
  SyncOutlined,
  LoadingOutlined
} from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'

type ConnectionStatus = 'unknown' | 'connected' | 'connecting' | 'disconnected' | 'reconnecting'

const bridgeStatus = ref<ConnectionStatus>('unknown')
const bridgeTesting = ref(false)
const bridgeError = ref('')
const reconnectCount = ref(0)

const testMcpBridge = async () => {
  bridgeTesting.value = true
  bridgeError.value = ''

  try {
    const response = await chrome.runtime.sendMessage({ type: 'MCP_BRIDGE_TEST' })
    if (response?.success && response?.data?.ok) {
      bridgeStatus.value = 'connected'
      message.success('MCP 桥接连接正常')
    } else {
      bridgeStatus.value = 'disconnected'
      bridgeError.value = response?.data?.error || response?.error || '连接失败'
      message.error(`MCP 桥接测试失败: ${bridgeError.value}`)
    }
  } catch (err) {
    bridgeStatus.value = 'disconnected'
    bridgeError.value = err instanceof Error ? err.message : '未知错误'
    message.error(`MCP 桥接测试失败: ${bridgeError.value}`)
  } finally {
    bridgeTesting.value = false
  }
}

const reconnectBridge = async () => {
  bridgeTesting.value = true
  bridgeError.value = ''
  reconnectCount.value = 0

  try {
    await chrome.runtime.sendMessage({ type: 'MCP_BRIDGE_RECONNECT' })
    message.info('正在重新连接...')
    // 延迟后测试连接
    setTimeout(() => {
      testMcpBridge()
    }, 1000)
  } catch (err) {
    bridgeError.value = err instanceof Error ? err.message : '重连失败'
    message.error(`重连失败: ${bridgeError.value}`)
    bridgeTesting.value = false
  }
}

// 获取连接状态
const fetchConnectionStatus = async () => {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'MCP_GET_STATUS' })
    if (response?.success) {
      bridgeStatus.value = response.data?.status || 'unknown'
    }
  } catch {
    // ignore
  }
}

const mcpTools = [
  {
    category: 'Chrome 标签页',
    tools: [
      { name: 'chrome.list_tabs', desc: '列出所有标签页' },
      { name: 'chrome.get_active_tab', desc: '获取当前活动标签页' },
      { name: 'chrome.tab_create', desc: '创建新标签页' },
      { name: 'chrome.tab_close', desc: '关闭标签页' },
      { name: 'chrome.navigate', desc: '导航到指定 URL' },
      { name: 'chrome.tab_reload', desc: '刷新标签页' }
    ]
  },
  {
    category: 'Chrome 窗口',
    tools: [
      { name: 'chrome.window_list', desc: '列出所有窗口' },
      { name: 'chrome.window_create', desc: '创建新窗口' },
      { name: 'chrome.window_close', desc: '关闭窗口' }
    ]
  },
  {
    category: 'DOM 操作',
    tools: [
      { name: 'chrome.click', desc: '点击元素' },
      { name: 'chrome.type', desc: '输入文本' },
      { name: 'chrome.scroll', desc: '滚动页面' },
      { name: 'chrome.screenshot', desc: '截取屏幕' },
      { name: 'chrome.dom_tree', desc: '获取 DOM 树' }
    ]
  },
  {
    category: 'Discourse 交互',
    tools: [
      { name: 'discourse.like_post', desc: '点赞帖子', params: 'baseUrl, postId, reactionId' },
      { name: 'discourse.get_topic_list', desc: '获取话题列表', params: 'baseUrl, strategy, page' },
      { name: 'discourse.get_topic', desc: '获取话题详情', params: 'baseUrl, topicId' },
      { name: 'discourse.send_timings', desc: '发送阅读时间', params: 'baseUrl, topicId, timeMs, postNumbers' },
      { name: 'discourse.create_post', desc: '创建回帖', params: 'baseUrl, topicId, raw, replyToPostNumber' },
      { name: 'discourse.get_user_activity', desc: '获取用户活动', params: 'baseUrl, username, filter, limit' },
      { name: 'discourse.browse_topic', desc: '综合浏览话题', params: 'baseUrl, topicId, readTimeMs, like' }
    ]
  }
]

const copyToolName = (name: string) => {
  navigator.clipboard.writeText(name)
  message.success(`已复制: ${name}`)
}

const copyCommand = (cmd: string) => {
  navigator.clipboard.writeText(cmd)
  message.success('命令已复制')
}

const statusLabel: Record<ConnectionStatus, string> = {
  unknown: '未知',
  connected: '已连接',
  connecting: '连接中',
  disconnected: '未连接',
  reconnecting: '重连中'
}

const statusColor: Record<ConnectionStatus, string> = {
  unknown: 'text-gray-500',
  connected: 'text-green-600 dark:text-green-400',
  connecting: 'text-blue-600 dark:text-blue-400',
  disconnected: 'text-red-600 dark:text-red-400',
  reconnecting: 'text-yellow-600 dark:text-yellow-400'
}

let statusInterval: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  testMcpBridge()
  // 定期更新状态
  statusInterval = setInterval(fetchConnectionStatus, 5000)
})

onUnmounted(() => {
  if (statusInterval) {
    clearInterval(statusInterval)
  }
})
</script>

<template>
  <div class="space-y-6">
    <!-- 连接状态卡片 -->
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 p-6">
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-3">
          <ApiOutlined class="text-2xl text-blue-500" />
          <div>
            <h3 class="text-lg font-semibold dark:text-white">MCP 桥接状态</h3>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              Model Context Protocol 本地桥接服务
            </p>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <div class="flex items-center gap-2">
            <template v-if="bridgeStatus === 'connected'">
              <CheckCircleOutlined class="text-green-500" />
            </template>
            <template v-else-if="bridgeStatus === 'connecting' || bridgeStatus === 'reconnecting'">
              <LoadingOutlined class="text-blue-500 animate-spin" />
            </template>
            <template v-else-if="bridgeStatus === 'disconnected'">
              <CloseCircleOutlined class="text-red-500" />
            </template>
            <template v-else>
              <SyncOutlined class="text-gray-500" />
            </template>
            <span :class="statusColor[bridgeStatus]">{{ statusLabel[bridgeStatus] }}</span>
          </div>
          <a-button :loading="bridgeTesting" @click="testMcpBridge">
            <template #icon>
              <ReloadOutlined />
            </template>
            测试连接
          </a-button>
          <a-button @click="reconnectBridge" :disabled="bridgeTesting">
            <template #icon>
              <SyncOutlined />
            </template>
            重新连接
          </a-button>
        </div>
      </div>

      <div v-if="bridgeError" class="mt-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
        <p class="text-sm text-red-600 dark:text-red-400">{{ bridgeError }}</p>
      </div>

      <div class="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <h4 class="text-sm font-medium mb-2 dark:text-white">启动 MCP 服务器</h4>
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-2">
          运行以下命令启动本地 MCP 服务器：
        </p>
        <div class="flex items-center gap-2">
          <code class="flex-1 px-3 py-2 bg-gray-800 text-green-400 rounded font-mono text-sm">
            pnpm mcp
          </code>
          <a-button size="small" @click="copyCommand('pnpm mcp')">
            <template #icon>
              <CopyOutlined />
            </template>
          </a-button>
        </div>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-2">
          服务器默认运行在 http://127.0.0.1:7465
        </p>
      </div>

      <div class="mt-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
        <h4 class="text-sm font-medium mb-2 dark:text-white">使用方式</h4>
        <ol class="text-sm text-gray-600 dark:text-gray-400 space-y-1 list-decimal list-inside">
          <li>运行 <code class="px-1 bg-gray-200 dark:bg-gray-600 rounded">pnpm mcp</code> 启动服务器</li>
          <li>扩展自动通过 WebSocket 连接 <code class="px-1 bg-gray-200 dark:bg-gray-600 rounded">ws://127.0.0.1:7465/ws</code></li>
          <li>MCP 客户端通过 Streamable HTTP 调用 <code class="px-1 bg-gray-200 dark:bg-gray-600 rounded">POST http://127.0.0.1:7465/mcp</code></li>
        </ol>
      </div>
    </div>

    <!-- 可用工具列表 -->
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 p-6">
      <h3 class="text-lg font-semibold mb-4 dark:text-white">可用 MCP 工具</h3>
      <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
        以下工具可通过 MCP 协议调用，用于自动化浏览器操作和 Discourse 交互。
      </p>

      <div class="space-y-6">
        <div v-for="category in mcpTools" :key="category.category">
          <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {{ category.category }}
          </h4>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div
              v-for="tool in category.tools"
              :key="tool.name"
              class="flex items-start justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <div class="flex-1">
                <div class="flex items-center gap-2">
                  <code class="text-sm font-mono text-blue-600 dark:text-blue-400">{{
                    tool.name
                  }}</code>
                  <a-button
                    type="text"
                    size="small"
                    class="opacity-50 hover:opacity-100"
                    @click="copyToolName(tool.name)"
                  >
                    <template #icon>
                      <CopyOutlined class="text-xs" />
                    </template>
                  </a-button>
                </div>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">{{ tool.desc }}</p>
                <p v-if="'params' in tool && tool.params" class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                  参数: {{ tool.params }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Discourse 工具详细说明 -->
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 p-6">
      <h3 class="text-lg font-semibold mb-4 dark:text-white">Discourse 工具使用示例</h3>

      <div class="space-y-4">
        <div class="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <h4 class="text-sm font-medium mb-2 dark:text-white">点赞帖子</h4>
          <pre
            class="text-xs bg-gray-800 text-green-400 p-3 rounded overflow-x-auto"
          ><code>{
  "tool": "discourse.like_post",
  "args": {
    "baseUrl": "https://linux.do",
    "postId": 12345,
    "reactionId": "heart"
  }
}</code></pre>
        </div>

        <div class="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <h4 class="text-sm font-medium mb-2 dark:text-white">获取话题列表</h4>
          <pre
            class="text-xs bg-gray-800 text-green-400 p-3 rounded overflow-x-auto"
          ><code>{
  "tool": "discourse.get_topic_list",
  "args": {
    "baseUrl": "https://linux.do",
    "strategy": "latest",
    "page": 0
  }
}</code></pre>
        </div>

        <div class="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <h4 class="text-sm font-medium mb-2 dark:text-white">创建回帖</h4>
          <pre
            class="text-xs bg-gray-800 text-green-400 p-3 rounded overflow-x-auto"
          ><code>{
  "tool": "discourse.create_post",
  "args": {
    "baseUrl": "https://linux.do",
    "topicId": 12345,
    "raw": "这是回复内容...",
    "replyToPostNumber": 1
  }
}</code></pre>
        </div>

        <div class="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <h4 class="text-sm font-medium mb-2 dark:text-white">综合浏览话题（阅读 + 点赞）</h4>
          <pre
            class="text-xs bg-gray-800 text-green-400 p-3 rounded overflow-x-auto"
          ><code>{
  "tool": "discourse.browse_topic",
  "args": {
    "baseUrl": "https://linux.do",
    "topicId": 12345,
    "readTimeMs": 15000,
    "like": true
  }
}</code></pre>
        </div>
      </div>
    </div>
  </div>
</template>
