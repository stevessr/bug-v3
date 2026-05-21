<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { nanoid } from 'nanoid'
import { getProviders } from '@mariozechner/pi-ai'

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
import {
  discoverMcpOAuth,
  dynamicallyRegisterClient,
  getOAuthRedirectUri,
  runMcpOAuthFlow
} from '@/agent/mcpOAuth'
import { setMcpOAuthTokensUpdatedHandler } from '@/agent/mcpClient'
import {
  BUILTIN_AGENT_PLUGINS,
  defaultEnabledPluginIds,
  isPluginEnabled,
  type AgentPlugin,
  type PluginAvailabilityResult
} from '@/agent/plugins'
import type {
  AgentFolderRoot,
  AgentPermissions,
  McpOAuthConfig,
  McpOAuthTokens,
  McpServerConfig,
  SubAgentConfig
} from '@/agent/types'

const {
  settings,
  addSubagent,
  removeSubagent,
  restoreDefaults,
  activeProviderProfile,
  setActiveProvider,
  addProviderProfile,
  removeProviderProfile,
  updateActiveProfile
} = useAgentSettings()
const enableLocalMcpBridge = __ENABLE_LOCAL_MCP_BRIDGE__

// === 提供商切换 UI ===
// pi-ai 的 KnownProvider 列表（运行时获取，避免硬编码漂移）
const availableProviders = computed<string[]>(() => {
  try {
    return [...getProviders()].sort((a, b) => a.localeCompare(b))
  } catch {
    return []
  }
})

// 当前 active profile 在下拉中的选项（由 settings 驱动；写入交给 setActiveProvider）
const activeProviderId = computed({
  get: () => settings.value.activeProvider || activeProviderProfile.value?.provider || '',
  set: (value: string) => {
    if (value) setActiveProvider(value)
  }
})

// 新增 provider 的对话框状态
const addProviderModalOpen = ref(false)
const newProviderId = ref<string | undefined>(undefined)
const newProviderLabel = ref('')
const newProviderError = ref('')

const existingProviderIds = computed(
  () => new Set((settings.value.providerProfiles || []).map(p => p.provider))
)

const newProviderOptions = computed(() =>
  availableProviders.value
    .filter(provider => !existingProviderIds.value.has(provider))
    .map(provider => ({ label: provider, value: provider }))
)

const openAddProviderModal = () => {
  newProviderId.value = newProviderOptions.value[0]?.value
  newProviderLabel.value = ''
  newProviderError.value = ''
  addProviderModalOpen.value = true
}

const submitAddProvider = () => {
  const providerId = (newProviderId.value || '').trim()
  if (!providerId) {
    newProviderError.value = '请选择 provider'
    return
  }
  if (existingProviderIds.value.has(providerId)) {
    newProviderError.value = '该 provider 已存在'
    return
  }
  addProviderProfile({
    provider: providerId,
    label: newProviderLabel.value.trim() || providerId
  })
  addProviderModalOpen.value = false
}

const removeCurrentProvider = () => {
  const provider = settings.value.activeProvider
  if (!provider) return
  if ((settings.value.providerProfiles || []).length <= 1) return
  removeProviderProfile(provider)
}

// 推荐的 provider 默认 endpoint（仅作为说明文案，留空表示 pi-ai 内置默认即可）
const PROVIDER_HINTS: Record<string, string> = {
  anthropic: 'https://api.anthropic.com',
  openai: 'https://api.openai.com/v1',
  google: 'https://generativelanguage.googleapis.com',
  openrouter: 'https://openrouter.ai/api/v1',
  groq: 'https://api.groq.com/openai/v1',
  cerebras: 'https://api.cerebras.ai/v1',
  mistral: 'https://api.mistral.ai/v1',
  xai: 'https://api.x.ai/v1',
  zai: 'https://api.z.ai/v1',
  deepseek: 'https://api.deepseek.com',
  'moonshotai-cn': 'https://api.moonshot.cn/v1',
  moonshotai: 'https://api.moonshot.ai/v1'
}

const providerHint = computed(() => {
  const p = activeProviderProfile.value?.provider
  if (!p) return ''
  const hint = PROVIDER_HINTS[p]
  return hint
    ? `${p} 默认 endpoint：${hint}（baseUrl 留空即用默认）`
    : `${p}（自定义 baseUrl 可选）`
})

// 连接有效性显示：基于 active profile 的填写情况
type ConnectionState = 'ok' | 'partial' | 'missing'
const connectionStatus = computed<{ state: ConnectionState; label: string; hint: string }>(() => {
  const profile = activeProviderProfile.value
  if (!profile) {
    return { state: 'missing', label: '未配置 provider', hint: '请先添加并选择一个 provider。' }
  }
  const hasKey = Boolean(profile.apiKey?.trim())
  const hasModel = Boolean(profile.taskModel?.trim())
  if (!hasKey && !hasModel) {
    return {
      state: 'missing',
      label: '未配置',
      hint: `${profile.provider}：请填写 API Key 与任务模型。`
    }
  }
  if (!hasKey) {
    return {
      state: 'partial',
      label: '缺少 API Key',
      hint: `${profile.provider}：已填写模型，但 API Key 为空。`
    }
  }
  if (!hasModel) {
    return {
      state: 'partial',
      label: '缺少任务模型',
      hint: `${profile.provider}：已填写 API Key，但任务模型为空。`
    }
  }
  return {
    state: 'ok',
    label: `已配置 · ${profile.provider}`,
    hint: `${profile.provider}：模型与 API Key 均已填写。`
  }
})

const connectionBadgeColor = computed(() => {
  switch (connectionStatus.value.state) {
    case 'ok':
      return 'green'
    case 'partial':
      return 'orange'
    default:
      return 'red'
  }
})

// === 插件能力探测 ===
const pluginList: AgentPlugin[] = [...BUILTIN_AGENT_PLUGINS]
const pluginEnabledMap = computed<Record<string, boolean>>(() => {
  const map: Record<string, boolean> = {}
  for (const plugin of pluginList) {
    map[plugin.id] = isPluginEnabled(settings.value, plugin)
  }
  return map
})
const togglePlugin = (pluginId: string, enabled: boolean) => {
  const current = Array.isArray(settings.value.enabledPluginIds)
    ? [...settings.value.enabledPluginIds]
    : defaultEnabledPluginIds()
  const next = enabled
    ? current.includes(pluginId)
      ? current
      : [...current, pluginId]
    : current.filter(id => id !== pluginId)
  settings.value = { ...settings.value, enabledPluginIds: next }
}
const resetPluginsToDefault = () => {
  settings.value = { ...settings.value, enabledPluginIds: defaultEnabledPluginIds() }
}
const enableAllPlugins = () => {
  settings.value = {
    ...settings.value,
    enabledPluginIds: pluginList.map(plugin => plugin.id)
  }
}
const disableAllPlugins = () => {
  settings.value = { ...settings.value, enabledPluginIds: [] }
}

const pluginAvailability = reactive<Record<string, PluginAvailabilityResult>>({})
const pluginAvailabilityLoading = reactive<Record<string, boolean>>({})

const refreshPluginAvailability = async (plugin: AgentPlugin) => {
  if (!plugin.checkAvailability) return
  pluginAvailabilityLoading[plugin.id] = true
  try {
    const result = await plugin.checkAvailability()
    pluginAvailability[plugin.id] = result
  } catch (err: any) {
    pluginAvailability[plugin.id] = {
      level: 'unknown',
      summary: err?.message || '探测失败',
      details: []
    }
  } finally {
    pluginAvailabilityLoading[plugin.id] = false
  }
}

const refreshAllPluginAvailability = async () => {
  await Promise.all(
    pluginList
      .filter(plugin => plugin.checkAvailability)
      .map(plugin => refreshPluginAvailability(plugin))
  )
}

const PLUGIN_LEVEL_COLOR: Record<PluginAvailabilityResult['level'], string> = {
  available: 'green',
  partial: 'orange',
  unavailable: 'red',
  unknown: 'default'
}

const PLUGIN_LEVEL_LABEL: Record<PluginAvailabilityResult['level'], string> = {
  available: '可用',
  partial: '部分可用',
  unavailable: '不可用',
  unknown: '未知'
}

const CAPABILITY_STATE_COLOR: Record<string, string> = {
  available: 'green',
  downloadable: 'gold',
  downloading: 'blue',
  unavailable: 'red',
  unknown: 'default'
}

const CAPABILITY_STATE_LABEL: Record<string, string> = {
  available: '就绪',
  downloadable: '待下载',
  downloading: '下载中',
  unavailable: '不可用',
  unknown: '未知'
}

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

// === MCP OAuth ===
const oauthRedirectUri = computed(() => getOAuthRedirectUri())
const oauthStatus = reactive<Record<string, string>>({})
const oauthLoading = reactive<Record<string, boolean>>({})
const oauthAdvancedOpen = reactive<Record<string, boolean>>({})

/** 把当前 MCP server 写回 settings，触发 useAgentSettings 自动保存。 */
const persistMcpServer = (server: McpServerConfig) => {
  const idx = settings.value.mcpServers.findIndex(s => s.id === server.id)
  if (idx === -1) return
  const next = [...settings.value.mcpServers]
  next[idx] = { ...server }
  settings.value = { ...settings.value, mcpServers: next }
}

const ensureOauthConfig = (server: McpServerConfig): McpOAuthConfig => {
  if (!server.oauth) server.oauth = {}
  return server.oauth
}

const updateOauthConfig = <K extends keyof McpOAuthConfig>(
  server: McpServerConfig,
  key: K,
  value: McpOAuthConfig[K]
) => {
  ensureOauthConfig(server)[key] = value
  persistMcpServer(server)
}

const discoverServerOAuth = async (server: McpServerConfig) => {
  oauthLoading[server.id] = true
  oauthStatus[server.id] = '探测中…'
  try {
    const discovered = await discoverMcpOAuth(server.url, server.oauth)
    server.oauth = discovered
    persistMcpServer(server)
    if (discovered.authorizationEndpoint && discovered.tokenEndpoint) {
      oauthStatus[server.id] = '已完成 OAuth metadata 发现'
    } else {
      oauthStatus[server.id] = '探测完成，但端点不完整，请手动补全'
      oauthAdvancedOpen[server.id] = true
    }
  } catch (err: any) {
    oauthStatus[server.id] = err?.message || '探测失败'
    oauthAdvancedOpen[server.id] = true
  } finally {
    oauthLoading[server.id] = false
  }
}

const authorizeServer = async (server: McpServerConfig) => {
  oauthLoading[server.id] = true
  oauthStatus[server.id] = '准备授权…'
  try {
    let oauth = server.oauth || {}
    if (!oauth.authorizationEndpoint || !oauth.tokenEndpoint) {
      oauth = await discoverMcpOAuth(server.url, oauth)
      server.oauth = oauth
    }
    if (!oauth.authorizationEndpoint || !oauth.tokenEndpoint) {
      throw new Error('OAuth 端点不完整，请先完成 metadata 发现或手动填写。')
    }
    if (!oauth.clientId) {
      if (oauth.registrationEndpoint) {
        oauthStatus[server.id] = '正在执行 DCR 客户端注册…'
        const reg = await dynamicallyRegisterClient(oauth, oauthRedirectUri.value)
        oauth.clientId = reg.clientId
        if (reg.clientSecret) oauth.clientSecret = reg.clientSecret
        server.oauth = oauth
      } else {
        throw new Error('缺少 client_id，且 authorization server 未提供 registration_endpoint')
      }
    }
    oauthStatus[server.id] = '打开授权窗口…'
    const tokens = await runMcpOAuthFlow(oauth, { redirectUri: oauthRedirectUri.value })
    server.oauthTokens = tokens
    persistMcpServer(server)
    oauthStatus[server.id] = '授权成功'
  } catch (err: any) {
    oauthStatus[server.id] = err?.message || '授权失败'
  } finally {
    oauthLoading[server.id] = false
  }
}

const logoutServer = (server: McpServerConfig) => {
  server.oauthTokens = undefined
  persistMcpServer(server)
  oauthStatus[server.id] = '已清除当前 OAuth tokens'
}

const oauthBadge = (server: McpServerConfig) => {
  const tokens = server.oauthTokens
  if (!tokens?.accessToken) return { color: 'default', text: '未授权' }
  if (tokens.expiresAt && Date.now() > tokens.expiresAt) {
    return { color: 'orange', text: '已过期' }
  }
  return { color: 'green', text: '已授权' }
}

const oauthExpiryText = (tokens: McpOAuthTokens | undefined): string => {
  if (!tokens?.expiresAt) return tokens?.accessToken ? '无过期信息' : ''
  const diffMs = tokens.expiresAt - Date.now()
  if (diffMs <= 0) return '已过期'
  const minutes = Math.round(diffMs / 60000)
  return `约 ${minutes} 分钟后过期`
}

onMounted(() => {
  // 注册全局回调：mcpClient 刷新 token 后写回 settings，实现持久化
  setMcpOAuthTokensUpdatedHandler(async (serverId, tokens) => {
    const idx = settings.value.mcpServers.findIndex(s => s.id === serverId)
    if (idx === -1) return
    const next = [...settings.value.mcpServers]
    next[idx] = { ...next[idx], oauthTokens: tokens }
    settings.value = { ...settings.value, mcpServers: next }
  })
})

onMounted(() => {
  loadMcpBridgeState()
})

onMounted(() => {
  void refreshAllFolderRoots()
})

onMounted(() => {
  void refreshAllPluginAvailability()
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
        <div class="flex items-center gap-2">
          <a-tag :color="connectionBadgeColor">
            <a-tooltip :title="connectionStatus.hint">
              {{ connectionStatus.label }}
            </a-tooltip>
          </a-tag>
          <a-button size="small" @click="restoreAgentDefaults">重置为默认</a-button>
        </div>
      </div>

      <div class="space-y-3">
        <div class="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto_auto]">
          <a-select
            v-model:value="activeProviderId"
            :options="
              (settings.providerProfiles || []).map(p => ({
                label: p.label || p.provider,
                value: p.provider
              }))
            "
            placeholder="选择当前 provider"
            show-search
          />
          <a-button @click="openAddProviderModal">添加 provider</a-button>
          <a-button
            danger
            :disabled="(settings.providerProfiles || []).length <= 1"
            @click="removeCurrentProvider"
          >
            删除当前
          </a-button>
        </div>
        <p class="text-xs text-gray-500 dark:text-gray-400">
          每个 provider 独立保存 API Key / endpoint / 默认模型，切换不会丢配置。{{ providerHint }}
        </p>
      </div>

      <template v-if="activeProviderProfile">
        <a-input
          :value="activeProviderProfile.apiKey"
          placeholder="该 provider 的 API Key"
          type="password"
          @update:value="(v: string) => updateActiveProfile('apiKey', v)"
        />

        <a-input
          :value="activeProviderProfile.baseUrl || ''"
          placeholder="可选：覆盖默认 endpoint，例如 https://openrouter.ai/api/v1"
          @update:value="(v: string) => updateActiveProfile('baseUrl', v)"
        />
      </template>
      <div v-else class="text-xs text-amber-600 dark:text-amber-400">
        当前没有 provider profile。点击「添加 provider」开始配置。
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

      <template v-if="activeProviderProfile">
        <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
          <a-input
            :value="activeProviderProfile.taskModel || ''"
            :placeholder="`任务模型 id（不含 ${activeProviderProfile.provider}/ 前缀）`"
            @update:value="(v: string) => updateActiveProfile('taskModel', v)"
          />
          <a-input
            :value="activeProviderProfile.reasoningModel || ''"
            placeholder="思考模型（可留空沿用任务模型）"
            @update:value="(v: string) => updateActiveProfile('reasoningModel', v)"
          />
          <a-input
            :value="activeProviderProfile.imageModel || ''"
            placeholder="图片转述模型（可留空沿用任务模型）"
            @update:value="(v: string) => updateActiveProfile('imageModel', v)"
          />
        </div>
        <p class="text-xs text-gray-500 dark:text-gray-400 -mt-2">
          以上模型 id 会自动加上
          <code>{{ activeProviderProfile.provider }}/</code>
          前缀传给 Pi runtime；subagent 仍可用完整
          <code>provider/model</code>
          字符串覆盖。
        </p>
      </template>

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

          <div class="border-t border-dashed border-gray-200 dark:border-gray-700 pt-3 space-y-2">
            <div class="flex items-center justify-between gap-2 flex-wrap">
              <div class="flex items-center gap-2">
                <span class="text-xs font-medium dark:text-white">OAuth 2.1</span>
                <a-tag :color="oauthBadge(server).color" class="text-xs">
                  {{ oauthBadge(server).text }}
                </a-tag>
                <span
                  v-if="server.oauthTokens?.accessToken"
                  class="text-[11px] text-gray-500 dark:text-gray-400"
                >
                  {{ oauthExpiryText(server.oauthTokens) }}
                </span>
              </div>
              <div class="flex items-center gap-2">
                <a-button
                  size="small"
                  :loading="oauthLoading[server.id]"
                  @click="discoverServerOAuth(server)"
                >
                  发现 metadata
                </a-button>
                <a-button
                  size="small"
                  type="primary"
                  :loading="oauthLoading[server.id]"
                  @click="authorizeServer(server)"
                >
                  授权
                </a-button>
                <a-button
                  size="small"
                  danger
                  :disabled="!server.oauthTokens?.accessToken"
                  @click="logoutServer(server)"
                >
                  登出
                </a-button>
              </div>
            </div>
            <div v-if="oauthStatus[server.id]" class="text-xs text-gray-500 dark:text-gray-400">
              {{ oauthStatus[server.id] }}
            </div>
            <a-collapse
              :active-key="oauthAdvancedOpen[server.id] ? ['adv'] : []"
              @change="keys => (oauthAdvancedOpen[server.id] = (keys as string[]).includes('adv'))"
              ghost
            >
              <a-collapse-panel key="adv" header="高级 OAuth 设置">
                <div class="space-y-2">
                  <div class="text-[11px] text-gray-500 dark:text-gray-400">
                    redirect_uri（由 Chrome 自动管理）：
                    <code class="break-all">{{ oauthRedirectUri }}</code>
                    <br />
                    把这个 URL 加入你 OAuth 应用的允许列表。
                  </div>
                  <a-input
                    :value="server.oauth?.authorizationEndpoint || ''"
                    placeholder="authorization_endpoint"
                    @update:value="
                      (v: string) => updateOauthConfig(server, 'authorizationEndpoint', v)
                    "
                  />
                  <a-input
                    :value="server.oauth?.tokenEndpoint || ''"
                    placeholder="token_endpoint"
                    @update:value="(v: string) => updateOauthConfig(server, 'tokenEndpoint', v)"
                  />
                  <a-input
                    :value="server.oauth?.registrationEndpoint || ''"
                    placeholder="registration_endpoint（可选，用于 DCR）"
                    @update:value="
                      (v: string) => updateOauthConfig(server, 'registrationEndpoint', v)
                    "
                  />
                  <div class="grid grid-cols-1 gap-2 md:grid-cols-2">
                    <a-input
                      :value="server.oauth?.clientId || ''"
                      placeholder="client_id"
                      @update:value="(v: string) => updateOauthConfig(server, 'clientId', v)"
                    />
                    <a-input
                      :value="server.oauth?.clientSecret || ''"
                      placeholder="client_secret（PKCE 通常不需要）"
                      type="password"
                      @update:value="(v: string) => updateOauthConfig(server, 'clientSecret', v)"
                    />
                  </div>
                  <a-input
                    :value="server.oauth?.scopes || ''"
                    placeholder="scopes（空格分隔）"
                    @update:value="(v: string) => updateOauthConfig(server, 'scopes', v)"
                  />
                  <a-input
                    :value="server.oauth?.resource || ''"
                    placeholder="resource（OAuth 2.1 资源标识符，可选）"
                    @update:value="(v: string) => updateOauthConfig(server, 'resource', v)"
                  />
                </div>
              </a-collapse-panel>
            </a-collapse>
          </div>
        </div>

        <a-button type="dashed" block @click="addMcpServer">添加 MCP 服务</a-button>
      </div>
    </div>

    <div class="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4 space-y-4">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-base font-medium dark:text-white">可选插件</h3>
          <p class="text-xs text-gray-500 dark:text-gray-400">
            扩展 Pi Agent 的能力。可单独启用或关闭；插件在 piRuntime 中按需加载 tools 或追加 system
            prompt。徽章显示该插件在当前浏览器中的能力探测结果。
          </p>
        </div>
        <div class="flex items-center gap-2">
          <a-button size="small" @click="refreshAllPluginAvailability">重新探测</a-button>
          <a-button size="small" @click="enableAllPlugins">全部启用</a-button>
          <a-button size="small" @click="disableAllPlugins">全部关闭</a-button>
          <a-button size="small" @click="resetPluginsToDefault">恢复默认</a-button>
        </div>
      </div>

      <div class="space-y-3">
        <div
          v-for="plugin in pluginList"
          :key="plugin.id"
          class="flex items-start justify-between gap-3 border border-gray-200 dark:border-gray-700 rounded-lg p-3"
        >
          <div class="space-y-1 flex-1">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-sm font-medium dark:text-white">{{ plugin.name }}</span>
              <a-tag color="default" class="text-xs">{{ plugin.id }}</a-tag>
              <a-tag v-if="plugin.defaultEnabled" color="blue" class="text-xs">默认开启</a-tag>
              <template v-if="plugin.checkAvailability">
                <a-popover v-if="pluginAvailability[plugin.id]" trigger="click" placement="bottom">
                  <template #title>
                    <span class="text-xs">
                      能力状态 ·
                      {{ PLUGIN_LEVEL_LABEL[pluginAvailability[plugin.id].level] }}
                    </span>
                  </template>
                  <template #content>
                    <div class="space-y-2 max-w-xs">
                      <div class="text-xs text-gray-600 dark:text-gray-300">
                        {{ pluginAvailability[plugin.id].summary }}
                      </div>
                      <div v-if="pluginAvailability[plugin.id].details?.length" class="space-y-1">
                        <div
                          v-for="detail in pluginAvailability[plugin.id].details"
                          :key="detail.label"
                          class="flex items-center justify-between gap-2 text-xs"
                        >
                          <span class="text-gray-700 dark:text-gray-200">
                            {{ detail.label }}
                          </span>
                          <a-tag
                            :color="CAPABILITY_STATE_COLOR[detail.state] || 'default'"
                            class="m-0"
                          >
                            {{ CAPABILITY_STATE_LABEL[detail.state] || detail.state }}
                          </a-tag>
                        </div>
                        <div
                          v-for="detail in pluginAvailability[plugin.id].details?.filter(
                            d => d.hint
                          )"
                          :key="`hint-${detail.label}`"
                          class="text-[11px] text-gray-500 dark:text-gray-400 pl-1"
                        >
                          · {{ detail.label }}：{{ detail.hint }}
                        </div>
                      </div>
                      <a-button
                        size="small"
                        :loading="pluginAvailabilityLoading[plugin.id]"
                        @click="refreshPluginAvailability(plugin)"
                      >
                        重新探测
                      </a-button>
                    </div>
                  </template>
                  <a-tag
                    :color="PLUGIN_LEVEL_COLOR[pluginAvailability[plugin.id].level]"
                    class="cursor-pointer text-xs"
                  >
                    {{ PLUGIN_LEVEL_LABEL[pluginAvailability[plugin.id].level] }} ·
                    {{ pluginAvailability[plugin.id].summary }}
                  </a-tag>
                </a-popover>
                <a-tag
                  v-else
                  color="default"
                  class="cursor-pointer text-xs"
                  @click="refreshPluginAvailability(plugin)"
                >
                  {{ pluginAvailabilityLoading[plugin.id] ? '探测中…' : '点击探测' }}
                </a-tag>
              </template>
            </div>
            <p class="text-xs text-gray-500 dark:text-gray-400">{{ plugin.description }}</p>
          </div>
          <a-switch
            :checked="pluginEnabledMap[plugin.id]"
            size="small"
            @change="(v: unknown) => togglePlugin(plugin.id, Boolean(v))"
          />
        </div>
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

    <a-modal
      v-model:open="addProviderModalOpen"
      title="添加 provider"
      ok-text="添加"
      cancel-text="取消"
      @ok="submitAddProvider"
    >
      <div class="space-y-3">
        <div>
          <div class="text-xs text-gray-500 dark:text-gray-400 mb-1">Provider</div>
          <a-select
            v-model:value="newProviderId"
            :options="newProviderOptions"
            placeholder="选择 pi-ai 支持的 provider"
            show-search
            class="w-full"
          />
          <div v-if="newProviderOptions.length === 0" class="text-xs text-amber-600 mt-1">
            当前可用 provider 已全部添加，可先删除不用的再添加。
          </div>
        </div>
        <div>
          <div class="text-xs text-gray-500 dark:text-gray-400 mb-1">显示名（可选）</div>
          <a-input v-model:value="newProviderLabel" placeholder="留空则使用 provider id" />
        </div>
        <div v-if="newProviderError" class="text-xs text-red-500">
          {{ newProviderError }}
        </div>
      </div>
    </a-modal>
  </div>
</template>
