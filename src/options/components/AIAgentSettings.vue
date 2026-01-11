<script setup lang="ts">
import { ref, computed, type Ref } from 'vue'
import { ApiOutlined, DeleteOutlined, PlusOutlined, EditOutlined } from '@ant-design/icons-vue'

import type { AppSettings, McpServerConfig } from '../../types/type'
import { useSettingsForm } from '../composables/useSettingsForm'

import { BUILTIN_TOOL_NAMES } from '@/services/aiAgentService'

const props = defineProps<{ settings: AppSettings | Ref<AppSettings> }>()

const emit = defineEmits([
  'update:claudeApiKey',
  'update:claudeApiBaseUrl',
  'update:claudeModel',
  'update:claudeImageModel',
  'update:claudeMaxSteps',
  'update:claudeMaxTokens',
  'update:claudeMcpServers',
  'update:claudeEnabledBuiltinTools',
  'update:claudeEnableMcpTools',
  'update:ntfyServer',
  'update:ntfyTopic',
  'update:ntfyUsername',
  'update:ntfyPassword',
  'update:ntfyToken'
])

// Use the settings form composable
const { localValues, hasChanges, isValid, isSaving, handleSave, handleReset } = useSettingsForm(
  props.settings,
  [
    { key: 'claudeApiKey', default: '' },
    { key: 'claudeApiBaseUrl', default: 'https://api.anthropic.com' },
    { key: 'claudeModel', default: 'claude-sonnet-4-20250514' },
    { key: 'claudeImageModel', default: '' },
    { key: 'claudeMaxSteps', default: 30 },
    { key: 'claudeMaxTokens', default: 8192 },
    { key: 'claudeMcpServers', default: [] },
    { key: 'claudeEnabledBuiltinTools', default: BUILTIN_TOOL_NAMES },
    { key: 'claudeEnableMcpTools', default: true },
    { key: 'ntfyServer', default: 'https://ntfy.sh' },
    { key: 'ntfyTopic', default: '' },
    { key: 'ntfyUsername', default: '' },
    { key: 'ntfyPassword', default: '' },
    { key: 'ntfyToken', default: '' }
  ],
  emit as (event: string, ...args: any[]) => void,
  {
    successMessage: 'AI Agent 配置已保存'
  }
)

// Create computed properties for easier template access
const localClaudeApiKey = computed({
  get: () => localValues.claudeApiKey.value as string,
  set: val => {
    localValues.claudeApiKey.value = val
  }
})

const localClaudeApiBaseUrl = computed({
  get: () => localValues.claudeApiBaseUrl.value as string,
  set: val => {
    localValues.claudeApiBaseUrl.value = val
  }
})

const localClaudeModel = computed({
  get: () => localValues.claudeModel.value as string,
  set: val => {
    localValues.claudeModel.value = val
  }
})

const localClaudeImageModel = computed({
  get: () => localValues.claudeImageModel.value as string,
  set: val => {
    localValues.claudeImageModel.value = val
  }
})

const localClaudeMaxSteps = computed({
  get: () => localValues.claudeMaxSteps.value as number,
  set: val => {
    localValues.claudeMaxSteps.value = val
  }
})

const localClaudeMaxTokens = computed({
  get: () => localValues.claudeMaxTokens.value as number,
  set: val => {
    localValues.claudeMaxTokens.value = val
  }
})

const localMcpServers = computed({
  get: () => (localValues.claudeMcpServers.value as McpServerConfig[]) || [],
  set: val => {
    localValues.claudeMcpServers.value = val
  }
})

const localEnabledBuiltinTools = computed({
  get: () => (localValues.claudeEnabledBuiltinTools.value as string[]) || BUILTIN_TOOL_NAMES,
  set: val => {
    localValues.claudeEnabledBuiltinTools.value = val
  }
})

const localEnableMcpTools = computed({
  get: () => (localValues.claudeEnableMcpTools.value as boolean) !== false, // Default to true
  set: val => {
    localValues.claudeEnableMcpTools.value = val
  }
})

// ntfy.sh notification settings
const localNtfyServer = computed({
  get: () => (localValues.ntfyServer.value as string) || 'https://ntfy.sh',
  set: val => {
    localValues.ntfyServer.value = val
  }
})

const localNtfyTopic = computed({
  get: () => (localValues.ntfyTopic.value as string) || '',
  set: val => {
    localValues.ntfyTopic.value = val
  }
})

const localNtfyUsername = computed({
  get: () => (localValues.ntfyUsername.value as string) || '',
  set: val => {
    localValues.ntfyUsername.value = val
  }
})

const localNtfyPassword = computed({
  get: () => (localValues.ntfyPassword.value as string) || '',
  set: val => {
    localValues.ntfyPassword.value = val
  }
})

const localNtfyToken = computed({
  get: () => (localValues.ntfyToken.value as string) || '',
  set: val => {
    localValues.ntfyToken.value = val
  }
})

const allBuiltinTools = BUILTIN_TOOL_NAMES

// MCP Server Management
const newMcpServer = ref({
  name: '',
  url: '',
  type: 'sse' as 'sse' | 'streamable-http',
  apiKey: ''
})

function addMcpServer() {
  if (!newMcpServer.value.name.trim() || !newMcpServer.value.url.trim()) return

  const server: McpServerConfig = {
    id: Date.now().toString(),
    name: newMcpServer.value.name.trim(),
    url: newMcpServer.value.url.trim(),
    type: newMcpServer.value.type,
    enabled: true,
    apiKey: newMcpServer.value.apiKey.trim() || undefined
  }

  localMcpServers.value = [...localMcpServers.value, server]
  newMcpServer.value = { name: '', url: '', type: 'sse', apiKey: '' }
}

function removeMcpServer(id: string) {
  localMcpServers.value = localMcpServers.value.filter(s => s.id !== id)
}

function toggleMcpServer(id: string) {
  localMcpServers.value = localMcpServers.value.map(s =>
    s.id === id ? { ...s, enabled: !s.enabled } : s
  )
}

// MCP Server Editing
const editingServer = ref<McpServerConfig | null>(null)
const showEditModal = ref(false)
const editForm = ref({
  name: '',
  url: '',
  type: 'sse' as 'sse' | 'streamable-http',
  apiKey: ''
})

function openEditModal(server: McpServerConfig) {
  editingServer.value = server
  editForm.value = {
    name: server.name,
    url: server.url,
    type: server.type,
    apiKey: server.apiKey || ''
  }
  showEditModal.value = true
}

function saveEditedServer() {
  if (!editingServer.value) return
  if (!editForm.value.name.trim() || !editForm.value.url.trim()) return

  localMcpServers.value = localMcpServers.value.map(s =>
    s.id === editingServer.value!.id
      ? {
          ...s,
          name: editForm.value.name.trim(),
          url: editForm.value.url.trim(),
          type: editForm.value.type,
          apiKey: editForm.value.apiKey.trim() || undefined
        }
      : s
  )

  showEditModal.value = false
  editingServer.value = null
}

function cancelEdit() {
  showEditModal.value = false
  editingServer.value = null
}

// MCP Server Testing
const mcpTestingIds = ref<Set<string>>(new Set())
const mcpTestResults = ref<Map<string, { success: boolean; message: string }>>(new Map())

async function testMcpServer(server: McpServerConfig) {
  mcpTestingIds.value.add(server.id)
  mcpTestingIds.value = new Set(mcpTestingIds.value)
  mcpTestResults.value.delete(server.id)

  try {
    const headers: Record<string, string> = {
      Accept: 'application/json, text/event-stream'
    }
    if (server.apiKey) {
      headers['Authorization'] = `Bearer ${server.apiKey}`
    }
    if (server.headers) {
      Object.assign(headers, server.headers)
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)

    const response = await fetch(server.url, {
      method: 'GET',
      headers,
      signal: controller.signal
    })

    clearTimeout(timeout)

    if (response.ok) {
      mcpTestResults.value.set(server.id, {
        success: true,
        message: `OK (${response.status})`
      })
    } else {
      mcpTestResults.value.set(server.id, {
        success: false,
        message: `HTTP ${response.status}`
      })
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    mcpTestResults.value.set(server.id, {
      success: false,
      message: message.includes('abort') ? 'Timeout' : message
    })
  } finally {
    mcpTestingIds.value.delete(server.id)
    mcpTestingIds.value = new Set(mcpTestingIds.value)
    mcpTestResults.value = new Map(mcpTestResults.value)
  }
}
</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700">
    <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
      <h2 class="text-lg font-semibold dark:text-white">AI Agent 配置</h2>
      <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
        配置 Claude AI 浏览器助手，支持自动化浏览器操作
      </p>
    </div>

    <div class="p-6 space-y-6">
      <!-- Claude API Configuration -->
      <div class="space-y-4">
        <h3 class="text-md font-medium dark:text-white">Claude API 配置</h3>

        <div class="space-y-3">
          <div>
            <label class="block text-sm font-medium dark:text-white mb-2">API Key:</label>
            <a-input-password
              v-model:value="localClaudeApiKey"
              placeholder="输入你的 Claude API Key"
              class="w-full"
            />
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
              获取 API Key:
              <a
                href="https://console.anthropic.com/"
                target="_blank"
                class="text-blue-500 hover:underline"
              >
                Anthropic Console
              </a>
            </p>
          </div>

          <div>
            <label class="block text-sm font-medium dark:text-white mb-2">API Base URL:</label>
            <a-input
              v-model:value="localClaudeApiBaseUrl"
              placeholder="https://api.anthropic.com"
              class="w-full"
            />
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
              自定义 API 基础地址，用于反代或企业部署
            </p>
          </div>

          <div>
            <label class="block text-sm font-medium dark:text-white mb-2">模型：</label>
            <a-input
              v-model:value="localClaudeModel"
              placeholder="claude-sonnet-4-20250514"
              class="w-full"
            />
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
              例如：claude-sonnet-4-20250514, claude-opus-4-20250514
            </p>
          </div>

          <div>
            <label class="block text-sm font-medium dark:text-white mb-2">
              图片转述模型（可选）：
            </label>
            <a-input
              v-model:value="localClaudeImageModel"
              placeholder="留空则使用主模型"
              class="w-full"
            />
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
              用于转述截图内容的模型，留空则使用主模型
            </p>
          </div>
        </div>
      </div>

      <!-- Agent Parameters -->
      <div class="pt-4 border-t border-gray-200 dark:border-gray-700 space-y-4">
        <h3 class="text-md font-medium dark:text-white">Agent 参数</h3>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium dark:text-white mb-2">最大步骤数：</label>
            <a-input-number
              v-model:value="localClaudeMaxSteps"
              :min="5"
              :max="1000"
              :step="5"
              class="w-full"
            />
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Agent 执行的最大步骤数量</p>
          </div>

          <div>
            <label class="block text-sm font-medium dark:text-white mb-2">最大 Token 数：</label>
            <a-input-number
              v-model:value="localClaudeMaxTokens"
              :min="1024"
              :max="32768"
              :step="1024"
              class="w-full"
            />
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">每次 AI 响应的最大 Token 数</p>
          </div>
        </div>
      </div>

      <!-- Tools Configuration -->
      <div class="pt-4 border-t border-gray-200 dark:border-gray-700 space-y-4">
        <h3 class="text-md font-medium dark:text-white">工具配置</h3>
        <p class="text-sm text-gray-600 dark:text-gray-400">
          控制 Agent 可以使用的内置工具和 MCP 工具
        </p>

        <div class="space-y-4">
          <!-- Built-in Tools Selection -->
          <div>
            <label class="block text-sm font-medium dark:text-white mb-2">内置工具：</label>
            <a-select
              v-model:value="localEnabledBuiltinTools"
              mode="multiple"
              placeholder="选择要启用的内置工具"
              class="w-full"
              :max-tag-count="5"
              show-search
              :filter-option="
                (input: string, option: any) =>
                  String(option?.value || '')
                    .toLowerCase()
                    .includes(input.toLowerCase())
              "
            >
              <a-select-option v-for="tool in allBuiltinTools" :key="tool" :value="tool">
                {{ tool }}
              </a-select-option>
            </a-select>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
              选择 Agent
              可以使用的内置工具。留空则启用全部工具。包括浏览器操作、标签管理、存储、剪贴板等工具。
            </p>
          </div>

          <!-- MCP Tools Toggle -->
          <div class="flex items-center justify-between">
            <div>
              <label class="block text-sm font-medium dark:text-white mb-1">启用 MCP 工具</label>
              <p class="text-xs text-gray-500 dark:text-gray-400">
                允许 Agent 使用下方配置的 MCP 服务器提供的工具
              </p>
            </div>
            <a-switch v-model:checked="localEnableMcpTools" />
          </div>
        </div>
      </div>

      <!-- ntfy.sh Notification Settings -->
      <div class="pt-4 border-t border-gray-200 dark:border-gray-700 space-y-4">
        <h3 class="text-md font-medium dark:text-white">ntfy.sh 通知配置</h3>
        <p class="text-sm text-gray-600 dark:text-gray-400">
          配置 ntfy.sh 推送通知服务，Agent 可发送任务状态、错误告警等通知
        </p>

        <div class="space-y-3">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium dark:text-white mb-2">服务器地址：</label>
              <a-input
                v-model:value="localNtfyServer"
                placeholder="https://ntfy.sh"
                class="w-full"
              />
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                ntfy 服务器地址，支持自建服务器
              </p>
            </div>

            <div>
              <label class="block text-sm font-medium dark:text-white mb-2">默认话题：</label>
              <a-input
                v-model:value="localNtfyTopic"
                placeholder="my-agent-notifications"
                class="w-full"
              />
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                默认推送话题，Agent 将推送通知到此话题
              </p>
            </div>
          </div>

          <div class="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded">
            <p class="text-sm text-blue-800 dark:text-blue-200">
              💡 <strong>如何接收通知：</strong>
            </p>
            <ul class="text-xs text-blue-700 dark:text-blue-300 mt-2 ml-4 space-y-1">
              <li>• 网页端：访问 <code class="bg-blue-100 dark:bg-blue-800 px-1 rounded">https://ntfy.sh/your-topic</code></li>
              <li>• 移动端：下载 ntfy App，订阅你的话题</li>
              <li>• CLI：运行 <code class="bg-blue-100 dark:bg-blue-800 px-1 rounded">ntfy subscribe your-topic</code></li>
            </ul>
          </div>

          <!-- Authentication (collapsed by default) -->
          <a-collapse ghost>
            <a-collapse-panel key="auth" header="认证设置（可选，用于私有话题）">
              <div class="space-y-3">
                <div>
                  <label class="block text-sm font-medium dark:text-white mb-2">用户名：</label>
                  <a-input
                    v-model:value="localNtfyUsername"
                    placeholder="留空表示无需认证"
                    class="w-full"
                  />
                </div>

                <div>
                  <label class="block text-sm font-medium dark:text-white mb-2">密码：</label>
                  <a-input-password
                    v-model:value="localNtfyPassword"
                    placeholder="留空表示无需认证"
                    class="w-full"
                  />
                </div>

                <div class="pt-2 border-t border-gray-200 dark:border-gray-700">
                  <label class="block text-sm font-medium dark:text-white mb-2">
                    Bearer Token（替代用户名密码）：
                  </label>
                  <a-input-password
                    v-model:value="localNtfyToken"
                    placeholder="留空表示使用用户名密码认证"
                    class="w-full"
                  />
                  <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    若填写 Token，将优先使用 Token 认证
                  </p>
                </div>
              </div>
            </a-collapse-panel>
          </a-collapse>

          <div class="p-3 bg-gray-50 dark:bg-gray-700 rounded">
            <p class="text-sm font-medium dark:text-white mb-2">📚 使用示例：</p>
            <div class="text-xs text-gray-600 dark:text-gray-300 space-y-1 font-mono">
              <p>Agent 任务： "处理数据，完成后发送通知"</p>
              <p class="text-green-600 dark:text-green-400">
                → 自动调用: send_ntfy_notification("数据处理完成!")
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- MCP Servers -->
      <div class="pt-4 border-t border-gray-200 dark:border-gray-700 space-y-4">
        <h3 class="text-md font-medium dark:text-white">MCP 服务器</h3>
        <p class="text-sm text-gray-600 dark:text-gray-400">
          配置 Model Context Protocol (MCP) 服务器以扩展 Agent 能力
        </p>

        <!-- Server List -->
        <div class="space-y-2">
          <div
            v-if="localMcpServers.length === 0"
            class="text-center py-4 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 rounded"
          >
            未配置 MCP 服务器
          </div>

          <div
            v-for="server in localMcpServers"
            :key="server.id"
            class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded"
          >
            <div class="flex items-center gap-3 flex-1 min-w-0">
              <a-switch
                :checked="server.enabled"
                size="small"
                @change="toggleMcpServer(server.id)"
              />
              <span
                class="font-medium dark:text-white truncate"
                :class="{ 'text-gray-400 line-through': !server.enabled }"
              >
                {{ server.name }}
              </span>
              <a-tag size="small">{{ server.type }}</a-tag>
              <a-tag
                v-if="mcpTestResults.get(server.id)"
                :color="mcpTestResults.get(server.id)?.success ? 'success' : 'error'"
                size="small"
              >
                {{ mcpTestResults.get(server.id)?.message }}
              </a-tag>
            </div>
            <div class="flex items-center gap-2">
              <a-button type="text" size="small" @click="openEditModal(server)">
                <template #icon><EditOutlined /></template>
              </a-button>
              <a-button
                type="text"
                size="small"
                :loading="mcpTestingIds.has(server.id)"
                @click="testMcpServer(server)"
              >
                <template #icon><ApiOutlined /></template>
                {{ mcpTestingIds.has(server.id) ? '测试中...' : '测试' }}
              </a-button>
              <a-button type="text" danger size="small" @click="removeMcpServer(server.id)">
                <template #icon><DeleteOutlined /></template>
              </a-button>
            </div>
          </div>
        </div>

        <!-- Add Server Form -->
        <div class="space-y-3 p-4 bg-gray-50 dark:bg-gray-700 rounded">
          <h4 class="text-sm font-medium dark:text-white">添加 MCP 服务器</h4>
          <div class="grid grid-cols-2 gap-3">
            <a-input v-model:value="newMcpServer.name" placeholder="服务器名称" size="small" />
            <a-input v-model:value="newMcpServer.url" placeholder="服务器地址" size="small" />
            <a-select v-model:value="newMcpServer.type" size="small">
              <a-select-option value="sse">SSE</a-select-option>
              <a-select-option value="streamable-http">Streamable HTTP</a-select-option>
            </a-select>
            <a-input-password
              v-model:value="newMcpServer.apiKey"
              placeholder="API Key（可选）"
              size="small"
            />
          </div>
          <a-button
            type="primary"
            size="small"
            :disabled="!newMcpServer.name.trim() || !newMcpServer.url.trim()"
            @click="addMcpServer"
          >
            <template #icon><PlusOutlined /></template>
            添加服务器
          </a-button>
        </div>
      </div>

      <!-- Action Buttons -->
      <div
        class="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700"
      >
        <a-button @click="handleReset" :disabled="!hasChanges || isSaving">重置</a-button>
        <a-button
          type="primary"
          @click="handleSave"
          :loading="isSaving"
          :disabled="!hasChanges || !isValid"
        >
          保存配置
        </a-button>
      </div>
    </div>

    <!-- Edit MCP Server Modal -->
    <a-modal
      v-model:open="showEditModal"
      title="编辑 MCP 服务器"
      @ok="saveEditedServer"
      @cancel="cancelEdit"
      :ok-button-props="{ disabled: !editForm.name.trim() || !editForm.url.trim() }"
    >
      <div class="space-y-4 py-4">
        <div>
          <label class="block text-sm font-medium mb-2">服务器名称：</label>
          <a-input v-model:value="editForm.name" placeholder="服务器名称" />
        </div>
        <div>
          <label class="block text-sm font-medium mb-2">服务器地址：</label>
          <a-input v-model:value="editForm.url" placeholder="服务器地址" />
        </div>
        <div>
          <label class="block text-sm font-medium mb-2">连接类型：</label>
          <a-select v-model:value="editForm.type" class="w-full">
            <a-select-option value="sse">SSE</a-select-option>
            <a-select-option value="streamable-http">Streamable HTTP</a-select-option>
          </a-select>
        </div>
        <div>
          <label class="block text-sm font-medium mb-2">API Key（可选）：</label>
          <a-input-password v-model:value="editForm.apiKey" placeholder="API Key" />
        </div>
      </div>
    </a-modal>
  </div>
</template>
