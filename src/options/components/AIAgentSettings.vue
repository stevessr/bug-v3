<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { nanoid } from 'nanoid'

import SkillsSettings from './SkillsSettings.vue'

import {
  getAgentFolderRootState,
  pickAgentFolderRoot,
  removeAgentFolderHandle,
  requestAgentFolderPermission,
  supportsAgentFolderAccess,
  type FolderPermissionState
} from '@/agent/folderAccess'
import { useAgentSettings } from '@/agent/useAgentSettings'
import type {
  AgentFolderRoot,
  AgentPermissions,
  McpServerConfig,
  SubAgentConfig
} from '@/agent/types'

const { settings, addSubagent, removeSubagent, restoreDefaults } = useAgentSettings()
const enableLocalMcpBridge = __ENABLE_LOCAL_MCP_BRIDGE__

const headerDrafts = reactive<Record<string, string>>({})
const headerErrors = reactive<Record<string, string>>({})
const mcpBridgeEnabled = ref(true)
const mcpTestStatus = ref('')
const mcpTestLoading = ref(false)
const mcpServerStatus = reactive<Record<string, string>>({})
const mcpServerLoading = reactive<Record<string, boolean>>({})
const folderRootStatus = reactive<Record<string, string>>({})
const folderRootLoading = reactive<Record<string, boolean>>({})
const MCP_BRIDGE_DISABLE_KEY = 'mcp-native-host-disabled'
const folderAccessSupported = supportsAgentFolderAccess()

const subagentOptions = computed(() =>
  settings.value.subagents.map(agent => ({
    label: agent.name,
    value: agent.id
  }))
)

const addMcpServer = () => {
  const id = nanoid()
  const server: McpServerConfig = {
    id,
    name: '新 MCP 服务',
    url: '',
    transport: 'sse',
    headers: {},
    enabled: true
  }
  settings.value = { ...settings.value, mcpServers: [...settings.value.mcpServers, server] }
  headerDrafts[id] = '{}'
}

const removeMcpServer = (id: string) => {
  settings.value = {
    ...settings.value,
    mcpServers: settings.value.mcpServers.filter(server => server.id !== id)
  }
  delete headerDrafts[id]
  delete headerErrors[id]
}

const syncHeaderDraft = (server: McpServerConfig) => {
  const json = JSON.stringify(server.headers || {}, null, 2)
  headerDrafts[server.id] = json
}

const updateHeaders = (server: McpServerConfig) => {
  const raw = headerDrafts[server.id] || ''
  if (!raw.trim()) {
    server.headers = {}
    headerErrors[server.id] = ''
    return
  }
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') {
      server.headers = parsed as Record<string, string>
      headerErrors[server.id] = ''
    } else {
      headerErrors[server.id] = '必须是 JSON 对象'
    }
  } catch (error: any) {
    headerErrors[server.id] = error?.message || 'JSON 解析失败'
  }
}

const addPresetSubagent = () => {
  addSubagent({
    name: '新代理预设',
    description: '可作为任务模板复用。',
    systemPrompt: '你是任务代理，按照提示执行自动化步骤。',
    permissions: {
      click: true,
      scroll: true,
      touch: false,
      screenshot: true,
      navigate: true,
      clickDom: true,
      input: true,
      fileAccess: false
    },
    enabled: true,
    isPreset: true
  })
}

const updatePermission = (agent: SubAgentConfig, key: keyof AgentPermissions, value: boolean) => {
  agent.permissions[key] = value
}

const normalizeFolderAliasValue = (value: string) =>
  value
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}_-]+/gu, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '') || 'folder'

const ensureUniqueFolderAlias = (value: string, excludeId?: string) => {
  const base = normalizeFolderAliasValue(value)
  const used = new Set(
    settings.value.folderRoots
      .filter(root => root.id !== excludeId)
      .map(root => root.alias.toLowerCase())
  )
  if (!used.has(base.toLowerCase())) return base

  let suffix = 2
  let candidate = `${base}-${suffix}`
  while (used.has(candidate.toLowerCase())) {
    suffix += 1
    candidate = `${base}-${suffix}`
  }
  return candidate
}

const describePermissionState = (
  permission: FolderPermissionState,
  readOnly: boolean,
  handleName: string
) => {
  if (permission === 'granted') {
    return `${handleName || '已选文件夹'} · ${readOnly ? '只读已授权' : '读写已授权'}`
  }
  if (permission === 'prompt') {
    return `${handleName || '已选文件夹'} · 需要重新授权${readOnly ? '读取' : '读写'}权限`
  }
  if (permission === 'denied') {
    return `${handleName || '已选文件夹'} · 权限被拒绝，请重新授权`
  }
  if (permission === 'missing') {
    return `${handleName || '未选择文件夹'} · 句柄缺失，请重新选择`
  }
  return '当前环境不支持文件夹访问'
}

const refreshFolderRootState = async (root: AgentFolderRoot) => {
  folderRootLoading[root.id] = true
  try {
    const state = await getAgentFolderRootState(root)
    if (state.handleName && root.handleName !== state.handleName) {
      root.handleName = state.handleName
    }
    folderRootStatus[root.id] = state.error
      ? state.error
      : describePermissionState(
          state.permission,
          root.readOnly,
          state.handleName || root.handleName
        )
  } catch (error: any) {
    folderRootStatus[root.id] = error?.message || '无法读取文件夹状态'
  } finally {
    folderRootLoading[root.id] = false
  }
}

const refreshAllFolderRoots = async () => {
  if (!folderAccessSupported) return
  await Promise.all(settings.value.folderRoots.map(root => refreshFolderRootState(root)))
}

const ensureFolderAlias = (root: AgentFolderRoot) => {
  root.alias = ensureUniqueFolderAlias(root.alias || root.handleName || 'folder', root.id)
}

const addFolderRoot = async () => {
  if (!folderAccessSupported) return
  const id = nanoid()
  try {
    folderRootLoading[id] = true
    const selected = await pickAgentFolderRoot(id, 'read')
    const root: AgentFolderRoot = {
      id,
      alias: ensureUniqueFolderAlias(selected.handleName || 'folder'),
      handleName: selected.handleName,
      enabled: true,
      readOnly: true
    }
    settings.value = {
      ...settings.value,
      folderRoots: [...settings.value.folderRoots, root]
    }
    folderRootStatus[id] = describePermissionState(selected.permission, true, selected.handleName)
    await refreshFolderRootState(root)
  } catch (error: any) {
    if (error?.name !== 'AbortError') {
      folderRootStatus[id] = error?.message || '选择文件夹失败'
    }
  } finally {
    folderRootLoading[id] = false
  }
}

const reselectFolderRoot = async (root: AgentFolderRoot) => {
  if (!folderAccessSupported) return
  folderRootLoading[root.id] = true
  try {
    const selected = await pickAgentFolderRoot(root.id, root.readOnly ? 'read' : 'readwrite')
    root.handleName = selected.handleName
    ensureFolderAlias(root)
    folderRootStatus[root.id] = describePermissionState(
      selected.permission,
      root.readOnly,
      selected.handleName
    )
    await refreshFolderRootState(root)
  } catch (error: any) {
    if (error?.name !== 'AbortError') {
      folderRootStatus[root.id] = error?.message || '重新选择文件夹失败'
    }
  } finally {
    folderRootLoading[root.id] = false
  }
}

const requestFolderRootPermission = async (root: AgentFolderRoot) => {
  folderRootLoading[root.id] = true
  try {
    const result = await requestAgentFolderPermission(root.id, root.readOnly ? 'read' : 'readwrite')
    if (result.handleName) {
      root.handleName = result.handleName
    }
    folderRootStatus[root.id] = describePermissionState(
      result.permission,
      root.readOnly,
      result.handleName || root.handleName
    )
    await refreshFolderRootState(root)
  } catch (error: any) {
    folderRootStatus[root.id] = error?.message || '授权失败'
  } finally {
    folderRootLoading[root.id] = false
  }
}

const onFolderReadOnlyChange = async (root: AgentFolderRoot, value: boolean) => {
  if (value) {
    root.readOnly = true
    await refreshFolderRootState(root)
    return
  }

  folderRootLoading[root.id] = true
  try {
    const result = await requestAgentFolderPermission(root.id, 'readwrite')
    if (result.permission !== 'granted') {
      folderRootStatus[root.id] = describePermissionState(
        result.permission,
        true,
        result.handleName || root.handleName
      )
      root.readOnly = true
      return
    }

    root.readOnly = false
    if (result.handleName) {
      root.handleName = result.handleName
    }
    folderRootStatus[root.id] = describePermissionState(
      result.permission,
      false,
      result.handleName || root.handleName
    )
    await refreshFolderRootState(root)
  } catch (error: any) {
    root.readOnly = true
    folderRootStatus[root.id] = error?.message || '申请写入权限失败'
  } finally {
    folderRootLoading[root.id] = false
  }
}

const removeFolderRoot = async (id: string) => {
  settings.value = {
    ...settings.value,
    folderRoots: settings.value.folderRoots.filter(root => root.id !== id)
  }
  delete folderRootStatus[id]
  delete folderRootLoading[id]
  await removeAgentFolderHandle(id)
}

const restoreAgentDefaults = async () => {
  const rootIds = settings.value.folderRoots.map(root => root.id)
  restoreDefaults()
  Object.keys(folderRootStatus).forEach(key => delete folderRootStatus[key])
  Object.keys(folderRootLoading).forEach(key => delete folderRootLoading[key])
  await Promise.all(rootIds.map(id => removeAgentFolderHandle(id)))
}

const loadMcpBridgeState = () => {
  if (!enableLocalMcpBridge) return
  if (typeof localStorage === 'undefined') return
  const raw = localStorage.getItem(MCP_BRIDGE_DISABLE_KEY)
  mcpBridgeEnabled.value = raw ? raw !== 'true' : true
  if (chrome?.runtime?.sendMessage) {
    chrome.runtime.sendMessage({
      type: 'MCP_BRIDGE_SET_DISABLED',
      disabled: !mcpBridgeEnabled.value
    })
  }
}

const onMcpBridgeToggle = (value: boolean) => {
  if (!enableLocalMcpBridge) return
  mcpBridgeEnabled.value = value
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(MCP_BRIDGE_DISABLE_KEY, value ? 'false' : 'true')
  }
  if (chrome?.runtime?.sendMessage) {
    chrome.runtime.sendMessage({ type: 'MCP_BRIDGE_SET_DISABLED', disabled: !value })
  }
}

const testMcpBridgeConnection = async () => {
  if (!enableLocalMcpBridge) {
    mcpTestStatus.value = '当前构建已禁用本地 MCP 桥接'
    return
  }
  if (!chrome?.runtime?.sendMessage) {
    mcpTestStatus.value = '无法调用扩展后台'
    return
  }
  mcpTestLoading.value = true
  mcpTestStatus.value = '测试中...'
  try {
    const resp = await chrome.runtime.sendMessage({ type: 'MCP_BRIDGE_TEST' })
    if (resp?.success && resp?.data?.ok) {
      mcpTestStatus.value = '测试成功：已建立连接'
    } else {
      mcpTestStatus.value = resp?.data?.error || resp?.error || '测试失败'
    }
  } catch (error: any) {
    mcpTestStatus.value = error?.message || '测试失败'
  } finally {
    mcpTestLoading.value = false
  }
}

const testMcpServerConnection = async (server: McpServerConfig) => {
  if (!chrome?.runtime?.sendMessage) {
    mcpServerStatus[server.id] = '无法调用扩展后台'
    return
  }
  mcpServerLoading[server.id] = true
  mcpServerStatus[server.id] = '测试中...'
  try {
    const resp = await chrome.runtime.sendMessage({
      type: 'MCP_SERVER_TEST',
      options: {
        url: server.url,
        headers: server.headers || {},
        transport: server.transport
      }
    })
    if (resp?.success && resp?.data?.ok) {
      const statusText = resp.data.status ? `HTTP ${resp.data.status}` : '连接成功'
      mcpServerStatus[server.id] = `测试成功：${statusText}`
    } else {
      mcpServerStatus[server.id] = resp?.data?.error || resp?.error || '测试失败'
    }
  } catch (error: any) {
    mcpServerStatus[server.id] = error?.message || '测试失败'
  } finally {
    mcpServerLoading[server.id] = false
  }
}

onMounted(() => {
  loadMcpBridgeState()
})

onMounted(() => {
  void refreshAllFolderRoots()
})

watch(
  () => settings.value.folderRoots.map(root => root.id).join(','),
  () => {
    void refreshAllFolderRoots()
  }
)
</script>

<template>
  <div class="space-y-6">
    <div class="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4 space-y-4">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-base font-medium dark:text-white">Pi Agent 连接</h3>
          <p class="text-xs text-gray-500 dark:text-gray-400">
            使用 Pi Agent SDK / pi-ai 驱动。模型支持 `provider/model` 写法，也可按 baseUrl
            或模型名前缀自动推断 provider。
          </p>
        </div>
        <a-button size="small" @click="restoreAgentDefaults">重置为默认</a-button>
      </div>

      <div class="grid grid-cols-1 gap-4">
        <a-input
          v-model:value="settings.baseUrl"
          placeholder="可选：覆盖默认 provider endpoint，例如 https://openrouter.ai/api/v1"
        ></a-input>
        <a-input
          v-model:value="settings.apiKey"
          placeholder="Provider API Key"
          type="password"
        ></a-input>
      </div>

      <template v-if="enableLocalMcpBridge">
        <div class="flex items-center justify-between">
          <div>
            <h4 class="text-sm font-medium dark:text-white">本地 MCP 桥接</h4>
            <p class="text-xs text-gray-500 dark:text-gray-400">
              手动启用 Native Messaging 后才可生效，关闭会停止自动探测。
            </p>
          </div>
          <a-switch
            :checked="mcpBridgeEnabled"
            @change="checked => onMcpBridgeToggle(Boolean(checked))"
          />
        </div>
        <div class="text-xs text-gray-500 dark:text-gray-400 space-y-1">
          <div>启用步骤：</div>
          <div>1. 运行：chmod +x scripts/mcp-bridge/server.js</div>
          <div>
            2. 生成 manifest：
            <span class="font-mono">
              node scripts/mcp-bridge/create-host-manifest.js --extension-id &lt;扩展 ID&gt;
              --host-path &quot;/绝对路径/scripts/mcp-bridge/server.js&quot;
            </span>
          </div>
          <div>3. 将 manifest 放到系统目录：</div>
          <div>macOS: ~/Library/Application Support/Google/Chrome/NativeMessagingHosts/</div>
          <div>Linux: ~/.config/google-chrome/NativeMessagingHosts/</div>
          <div>Windows: 注册表指向 manifest</div>
          <div>4. 重启浏览器或重载扩展</div>
        </div>
      </template>
      <div v-else class="text-xs text-amber-600 dark:text-amber-400">
        当前构建（--no-browser）已在编译期移除本地 MCP 桥接支持。
      </div>

      <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
        <a-input
          v-model:value="settings.taskModel"
          placeholder="任务模型，例如 anthropic/claude-sonnet-4-20250514"
        ></a-input>
        <a-input
          v-model:value="settings.reasoningModel"
          placeholder="思考模型（可留空沿用任务模型）"
        ></a-input>
        <a-input
          v-model:value="settings.imageModel"
          placeholder="图片转述模型（可留空沿用任务模型）"
        ></a-input>
      </div>
      <p class="text-xs text-gray-500 dark:text-gray-400 -mt-2">
        兼容提示：旧配置里的 `apiFlavor` 字段仍会保留，但 Pi 运行时只把它当作存量配置兼容字段，
        不再按旧的 provider 专有请求分支切换。
      </p>

      <div class="grid grid-cols-1 gap-4">
        <a-input-number
          v-model:value="settings.maxTokens"
          :min="1"
          :max="96000"
          class="w-full"
          placeholder="max_tokens（最大 96000）"
        />
      </div>

      <div class="grid grid-cols-1 gap-4">
        <a-textarea
          v-model:value="settings.masterSystemPrompt"
          :rows="3"
          placeholder="主系统提示词"
        />
      </div>

      <div class="flex items-center justify-between">
        <div>
          <h4 class="text-sm font-medium dark:text-white">思考模式</h4>
          <p class="text-xs text-gray-500 dark:text-gray-400">
            允许模型输出简短思考过程（会展示在时间线中）。
          </p>
        </div>
        <a-switch v-model:checked="settings.enableThoughts" />
      </div>
    </div>

    <div class="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4 space-y-4">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-base font-medium dark:text-white">MCP 配置</h3>
          <p class="text-xs text-gray-500 dark:text-gray-400">支持 SSE 或 Streamable HTTP。</p>
        </div>
        <a-switch v-model:checked="settings.enableMcp" />
      </div>

      <div v-if="settings.enableMcp" class="space-y-4">
        <div
          v-if="enableLocalMcpBridge"
          class="flex items-center justify-between rounded-md border border-gray-200 dark:border-gray-700 px-3 py-2"
        >
          <div class="text-xs text-gray-500 dark:text-gray-400">
            {{ mcpTestStatus || '点击测试，确认 MCP 桥接是否可连接。' }}
          </div>
          <a-button size="small" :loading="mcpTestLoading" @click="testMcpBridgeConnection">
            测试 MCP
          </a-button>
        </div>
        <div
          v-for="server in settings.mcpServers"
          :key="server.id"
          class="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3"
        >
          <div class="flex items-center justify-between">
            <a-input v-model:value="server.name" class="max-w-xs" placeholder="服务名称" />
            <div class="flex items-center gap-2">
              <a-switch v-model:checked="server.enabled" size="small" />
              <a-button size="small" danger @click="removeMcpServer(server.id)">删除</a-button>
            </div>
          </div>
          <a-input v-model:value="server.url" placeholder="https://mcp.example.com/stream" />
          <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
            <a-select v-model:value="server.transport">
              <a-select-option value="sse">SSE</a-select-option>
              <a-select-option value="streamable-http">Streamable HTTP</a-select-option>
            </a-select>
          </div>
          <div>
            <a-textarea
              v-model:value="headerDrafts[server.id]"
              :rows="3"
              placeholder='{"Authorization":"Bearer ..."}'
              @focus="syncHeaderDraft(server)"
              @blur="updateHeaders(server)"
            />
            <p v-if="headerErrors[server.id]" class="text-xs text-red-500 mt-1">
              {{ headerErrors[server.id] }}
            </p>
          </div>
          <div class="flex items-center justify-between">
            <div class="text-xs text-gray-500 dark:text-gray-400">
              {{ mcpServerStatus[server.id] || '点击测试，验证该 MCP 服务可用性。' }}
            </div>
            <a-button
              size="small"
              :loading="mcpServerLoading[server.id]"
              @click="testMcpServerConnection(server)"
            >
              测试该服务
            </a-button>
          </div>
        </div>

        <a-button type="dashed" block @click="addMcpServer">添加 MCP 服务</a-button>
      </div>
    </div>

    <div class="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4 space-y-4">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-base font-medium dark:text-white">文件夹访问</h3>
          <p class="text-xs text-gray-500 dark:text-gray-400">
            Agent 只能访问你在这里手动选择并授权的目录。执行时使用 `rootAlias + path`，
            路径必须是相对路径。
          </p>
        </div>
        <a-button size="small" :disabled="!folderAccessSupported" @click="addFolderRoot">
          添加文件夹
        </a-button>
      </div>

      <div v-if="!folderAccessSupported" class="text-xs text-amber-600 dark:text-amber-400">
        当前环境不支持 File System Access API，无法手动授权文件夹。
      </div>

      <template v-else>
        <div class="text-xs text-gray-500 dark:text-gray-400">
          默认建议先用只读模式验证工作流；关闭“只读”时会在当前点击里申请写入权限。
        </div>

        <div
          v-for="root in settings.folderRoots"
          :key="root.id"
          class="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3"
        >
          <div class="flex items-center justify-between gap-3">
            <a-input v-model:value="root.alias" class="max-w-xs" @blur="ensureFolderAlias(root)" />
            <div class="flex items-center gap-2">
              <a-switch v-model:checked="root.enabled" size="small" />
              <a-button size="small" danger @click="removeFolderRoot(root.id)">删除</a-button>
            </div>
          </div>

          <div class="text-xs text-gray-500 dark:text-gray-400">
            目录：{{ root.handleName || '未选择' }}
          </div>

          <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
            <a-switch
              :checked="root.readOnly"
              checked-children="只读"
              un-checked-children="可写"
              @change="value => onFolderReadOnlyChange(root, Boolean(value))"
            />
          </div>

          <div class="flex items-center justify-between gap-3">
            <div class="text-xs text-gray-500 dark:text-gray-400">
              {{ folderRootStatus[root.id] || '尚未校验权限状态。' }}
            </div>
            <div class="flex items-center gap-2">
              <a-button
                size="small"
                :loading="folderRootLoading[root.id]"
                @click="requestFolderRootPermission(root)"
              >
                重新授权
              </a-button>
              <a-button
                size="small"
                :loading="folderRootLoading[root.id]"
                @click="reselectFolderRoot(root)"
              >
                重新选择
              </a-button>
            </div>
          </div>
        </div>

        <div
          v-if="settings.folderRoots.length === 0"
          class="rounded-md border border-dashed border-gray-300 dark:border-gray-700 px-4 py-5 text-xs text-gray-500 dark:text-gray-400"
        >
          还没有配置任何可访问目录。添加后，Agent 才能使用 `list-files`、`read-file`、`write-file`。
        </div>
      </template>
    </div>

    <div class="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4 space-y-4">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-base font-medium dark:text-white">代理预设</h3>
          <p class="text-xs text-gray-500 dark:text-gray-400">
            为不同任务场景配置独立模型、提示词与权限。数据结构仍沿用“subagent”，但现在主要作为可切换预设使用。
          </p>
        </div>
        <div class="flex items-center gap-2">
          <a-button size="small" @click="addSubagent()">新增</a-button>
          <a-button size="small" @click="addPresetSubagent">新增预设</a-button>
        </div>
      </div>

      <div class="space-y-4">
        <div class="text-sm text-gray-600 dark:text-gray-300">
          默认预设：
          <a-select
            v-model:value="settings.defaultSubagentId"
            :options="subagentOptions"
            class="w-48 ml-2"
            placeholder="选择默认预设"
          />
        </div>
        <div
          v-for="agent in settings.subagents"
          :key="agent.id"
          class="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3"
        >
          <div class="flex items-center justify-between">
            <a-input v-model:value="agent.name" class="max-w-xs" />
            <div class="flex items-center gap-2">
              <a-switch v-model:checked="agent.enabled" size="small" />
              <a-button
                size="small"
                danger
                :disabled="agent.isPreset"
                @click="removeSubagent(agent.id)"
              >
                删除
              </a-button>
            </div>
          </div>

          <a-input v-model:value="agent.description" placeholder="描述（可选）" />
          <a-textarea v-model:value="agent.systemPrompt" :rows="3" placeholder="系统提示词" />

          <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
            <a-input v-model:value="agent.taskModel" placeholder="任务模型（可覆盖）" />
            <a-input v-model:value="agent.reasoningModel" placeholder="思考模型（可覆盖）" />
            <a-input v-model:value="agent.imageModel" placeholder="图片转述模型（可覆盖）" />
          </div>

          <div v-if="settings.enableMcp && settings.mcpServers.length > 0">
            <a-select
              v-model:value="agent.mcpServerIds"
              mode="multiple"
              placeholder="选择 MCP 服务"
              :options="settings.mcpServers.map(s => ({ label: s.name, value: s.id }))"
              class="w-full"
            />
          </div>

          <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
            <a-switch
              :checked="agent.permissions.click"
              @change="value => updatePermission(agent, 'click', value as boolean)"
              checked-children="点击"
              un-checked-children="点击"
            />
            <a-switch
              :checked="agent.permissions.scroll"
              @change="value => updatePermission(agent, 'scroll', value as boolean)"
              checked-children="滑动"
              un-checked-children="滑动"
            />
            <a-switch
              :checked="agent.permissions.touch"
              @change="value => updatePermission(agent, 'touch', value as boolean)"
              checked-children="触摸"
              un-checked-children="触摸"
            />
            <a-switch
              :checked="agent.permissions.screenshot"
              @change="value => updatePermission(agent, 'screenshot', value as boolean)"
              checked-children="截图"
              un-checked-children="截图"
            />
            <a-switch
              :checked="agent.permissions.navigate"
              @change="value => updatePermission(agent, 'navigate', value as boolean)"
              checked-children="切换URL"
              un-checked-children="切换URL"
            />
            <a-switch
              :checked="agent.permissions.clickDom"
              @change="value => updatePermission(agent, 'clickDom', value as boolean)"
              checked-children="点击DOM"
              un-checked-children="点击DOM"
            />
            <a-switch
              :checked="agent.permissions.input"
              @change="value => updatePermission(agent, 'input', value as boolean)"
              checked-children="输入"
              un-checked-children="输入"
            />
            <a-switch
              :checked="agent.permissions.fileAccess"
              @change="value => updatePermission(agent, 'fileAccess', value as boolean)"
              checked-children="文件夹"
              un-checked-children="文件夹"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Skills 配置 -->
    <SkillsSettings />
  </div>
</template>
