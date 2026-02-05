<script setup lang="ts">
import { ref, onMounted } from 'vue'
import {
  ApiOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ReloadOutlined,
  CopyOutlined
} from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'

const bridgeStatus = ref<'unknown' | 'connected' | 'disconnected'>('unknown')
const bridgeTesting = ref(false)
const bridgeError = ref('')

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

onMounted(() => {
  testMcpBridge()
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
              <span class="text-green-600 dark:text-green-400">已连接</span>
            </template>
            <template v-else-if="bridgeStatus === 'disconnected'">
              <CloseCircleOutlined class="text-red-500" />
              <span class="text-red-600 dark:text-red-400">未连接</span>
            </template>
            <template v-else>
              <span class="text-gray-500">未知</span>
            </template>
          </div>
          <a-button :loading="bridgeTesting" @click="testMcpBridge">
            <template #icon>
              <ReloadOutlined />
            </template>
            测试连接
          </a-button>
        </div>
      </div>

      <div v-if="bridgeError" class="mt-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
        <p class="text-sm text-red-600 dark:text-red-400">{{ bridgeError }}</p>
      </div>

      <div class="mt-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
        <h4 class="text-sm font-medium mb-2 dark:text-white">安装说明</h4>
        <ol class="text-sm text-gray-600 dark:text-gray-400 space-y-1 list-decimal list-inside">
          <li>下载并安装 MCP Native Host 程序</li>
          <li>确保 Native Messaging 配置正确</li>
          <li>重启浏览器后测试连接</li>
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
