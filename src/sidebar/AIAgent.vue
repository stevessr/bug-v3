<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import {
  SettingOutlined,
  SendOutlined,
  LoadingOutlined,
  StopOutlined,
  DeleteOutlined,
  RobotOutlined,
  CameraOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  DownOutlined,
  RightOutlined,
  ThunderboltOutlined,
  PlusOutlined,
  ApiOutlined,
  ExpandOutlined,
  EditOutlined
} from '@ant-design/icons-vue'

import type { McpServerConfig } from '@/types/type'
import {
  runAgent,
  validateConfig,
  BUILTIN_TOOL_NAMES,
  type AgentConfig,
  type AgentStep,
  type AgentAction,
  type SubagentStatus,
  type AgentResumeState
} from '@/services/aiAgentService'
import { useEmojiStore } from '@/stores/emojiStore'
import { useI18n } from '@/utils/i18n'

const { t } = useI18n()

const emojiStore = useEmojiStore()

// Conversation state
const taskInput = ref('')
const isRunning = ref(false)
const currentStep = ref(0)
const currentThinking = ref('')
const currentAction = ref<AgentAction | null>(null)
const currentScreenshot = ref('')
const steps = ref<AgentStep[]>([])
const errorMessage = ref('')
const settingsActiveKey = ref<string[]>([])
const abortController = ref<AbortController | null>(null)
const expandedScreenshots = ref<Set<number>>(new Set())
const subagents = ref<SubagentStatus[]>([])
const expandedSubagents = ref<Set<string>>(new Set())
const currentResumeState = ref<AgentResumeState | null>(null)
const originalTask = ref('')

// Persistent conversation state
interface PersistedConversation {
  task: string
  steps: AgentStep[]
  currentStep: number
  isRunning: boolean
  timestamp: number
  config: AgentConfig
  subagents: SubagentStatus[]
  resumeState?: AgentResumeState
}

const STORAGE_KEY = 'ai_agent_conversation'
const CONVERSATION_TIMEOUT = 24 * 60 * 60 * 1000 // 24 hours

// Save conversation state to localStorage
const saveConversation = () => {
  try {
    // Strip screenshots from steps to reduce storage size
    const stepsWithoutScreenshots = steps.value.map(step => ({
      ...step,
      screenshot: undefined // Remove base64 screenshots to save space
    }))

    // Limit to last 20 steps to prevent quota issues
    const limitedSteps = stepsWithoutScreenshots.slice(-20)

    // Also strip screenshots from resumeState messages if present
    let cleanResumeState = currentResumeState.value
    if (cleanResumeState) {
      cleanResumeState = {
        ...cleanResumeState,
        messages: cleanResumeState.messages.slice(-10).map(msg => ({
          ...msg,
          content: Array.isArray(msg.content)
            ? msg.content.filter(c => c.type !== 'image').slice(-5)
            : msg.content
        })),
        steps: cleanResumeState.steps.slice(-20).map(s => ({ ...s, screenshot: undefined }))
      }
    }

    const conversation: PersistedConversation = {
      task: originalTask.value || steps.value[0]?.thinking?.replace(/^.*?: /, '') || '',
      steps: limitedSteps,
      currentStep: currentStep.value,
      isRunning: isRunning.value,
      timestamp: Date.now(),
      config: {
        apiKey: apiKey.value,
        baseUrl: baseUrl.value,
        model: model.value,
        imageModel: imageModel.value || undefined,
        maxTokens: maxTokens.value,
        mcpServers: mcpServers.value,
        enabledBuiltinTools: enabledBuiltinTools.value,
        enableMcpTools: enableMcpTools.value
      },
      subagents: subagents.value.slice(-5), // Limit subagents too
      resumeState: cleanResumeState || undefined
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversation))
  } catch (error) {
    console.error('Failed to save conversation:', error)
    // If still quota exceeded, try saving minimal state
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      try {
        const minimalConversation = {
          task: originalTask.value || '',
          steps: [],
          currentStep: currentStep.value,
          isRunning: isRunning.value,
          timestamp: Date.now(),
          config: {
            apiKey: apiKey.value,
            baseUrl: baseUrl.value,
            model: model.value
          }
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(minimalConversation))
      } catch {
        // Give up if even minimal save fails
        localStorage.removeItem(STORAGE_KEY)
      }
    }
  }
}

// Load conversation state from localStorage
const loadConversation = (): PersistedConversation | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return null

    const conversation: PersistedConversation = JSON.parse(stored)

    // Check if conversation is too old
    if (Date.now() - conversation.timestamp > CONVERSATION_TIMEOUT) {
      localStorage.removeItem(STORAGE_KEY)
      return null
    }

    return conversation
  } catch (error) {
    console.error('Failed to load conversation:', error)
    return null
  }
}

// Clear persisted conversation
const clearPersistedConversation = () => {
  localStorage.removeItem(STORAGE_KEY)
}

// Detect if conversation was interrupted
const wasInterrupted = ref(false)
const savedConversation = ref<PersistedConversation | null>(null)

const chatContainer = ref<HTMLElement | null>(null)

const apiKey = computed({
  get: () => emojiStore.settings.claudeApiKey || '',
  set: (value: string) => emojiStore.updateSettings({ claudeApiKey: value })
})

const baseUrl = computed({
  get: () => emojiStore.settings.claudeApiBaseUrl || 'https://api.anthropic.com',
  set: (value: string) => emojiStore.updateSettings({ claudeApiBaseUrl: value })
})

const model = computed({
  get: () => emojiStore.settings.claudeModel || 'claude-sonnet-4-20250514',
  set: (value: string) => emojiStore.updateSettings({ claudeModel: value })
})

const imageModel = computed({
  get: () => emojiStore.settings.claudeImageModel || '',
  set: (value: string) => emojiStore.updateSettings({ claudeImageModel: value })
})

const maxSteps = computed({
  get: () => emojiStore.settings.claudeMaxSteps || 30,
  set: (value: number) => emojiStore.updateSettings({ claudeMaxSteps: value })
})

const maxTokens = computed({
  get: () => emojiStore.settings.claudeMaxTokens || 8192,
  set: (value: number) => emojiStore.updateSettings({ claudeMaxTokens: value })
})

// MCP Servers - use stable reference to avoid unnecessary updates
const mcpServers = computed({
  get: () => {
    const servers = emojiStore.settings.claudeMcpServers
    return servers || []
  },
  set: (servers: McpServerConfig[]) => emojiStore.updateSettings({ claudeMcpServers: servers })
})

// Tools configuration
const enableMcpTools = computed({
  get: () => emojiStore.settings.claudeEnableMcpTools !== false, // Default to true
  set: (value: boolean) => emojiStore.updateSettings({ claudeEnableMcpTools: value })
})

// Use a stable reference for enabled tools to avoid unnecessary reactivity
const enabledBuiltinTools = computed({
  get: () => {
    const tools = emojiStore.settings.claudeEnabledBuiltinTools
    // If not set or empty, use all tools but return a stable reference
    return tools && Array.isArray(tools) && tools.length > 0 ? tools : BUILTIN_TOOL_NAMES
  },
  set: (tools: string[]) => emojiStore.updateSettings({ claudeEnabledBuiltinTools: tools })
})

const allBuiltinTools = BUILTIN_TOOL_NAMES

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

  mcpServers.value = [...mcpServers.value, server]

  // Reset form
  newMcpServer.value = { name: '', url: '', type: 'sse', apiKey: '' }
}

function removeMcpServer(id: string) {
  mcpServers.value = mcpServers.value.filter(s => s.id !== id)
}

function toggleMcpServer(id: string) {
  mcpServers.value = mcpServers.value.map(s => (s.id === id ? { ...s, enabled: !s.enabled } : s))
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

  mcpServers.value = mcpServers.value.map(s =>
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
      Accept: 'text/event-stream, application/json'
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

    if (!response.ok) {
      mcpTestResults.value.set(server.id, {
        success: false,
        message: `HTTP ${response.status}`
      })
      return
    }

    const contentType = response.headers.get('content-type') || ''

    // For SSE responses, try to read the first event
    if (contentType.includes('text/event-stream') && response.body) {
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let receivedData = ''

      // Try to read the first chunk with a timeout
      const readTimeout = setTimeout(() => {
        reader.cancel()
      }, 5000)

      try {
        const { value, done } = await reader.read()
        clearTimeout(readTimeout)

        if (value) {
          receivedData = decoder.decode(value)
        }

        // Cancel the stream after reading first chunk
        reader.cancel()

        // Check if we received valid SSE data (event: or data:)
        if (receivedData.includes('event:') || receivedData.includes('data:')) {
          // Extract event type if present
          const eventMatch = receivedData.match(/event:\s*(\w+)/)
          const eventType = eventMatch ? eventMatch[1] : 'data'
          mcpTestResults.value.set(server.id, {
            success: true,
            message: `SSE OK (${eventType})`
          })
        } else if (done && !receivedData) {
          mcpTestResults.value.set(server.id, {
            success: false,
            message: 'No SSE data'
          })
        } else {
          mcpTestResults.value.set(server.id, {
            success: true,
            message: 'SSE Connected'
          })
        }
      } catch (readError) {
        clearTimeout(readTimeout)
        // If read was cancelled due to timeout but connection was established
        mcpTestResults.value.set(server.id, {
          success: true,
          message: 'SSE OK (slow)'
        })
      }
    } else {
      // Non-SSE response (JSON or other)
      mcpTestResults.value.set(server.id, {
        success: true,
        message: `OK (${response.status})`
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

const isConfigured = computed(() => {
  const validation = validateConfig({
    apiKey: apiKey.value,
    baseUrl: baseUrl.value,
    model: model.value
  })
  return validation.valid
})

const canRun = computed(() => {
  return isConfigured.value && taskInput.value.trim() !== '' && !isRunning.value
})

watch([currentStep, currentThinking, currentScreenshot], () => {
  nextTick(() => {
    if (chatContainer.value) {
      chatContainer.value.scrollTop = chatContainer.value.scrollHeight
    }
  })
})

// Watch steps and save to localStorage when changed (debounced to avoid excessive saves)
let saveTimeout: ReturnType<typeof setTimeout> | null = null
watch(
  [steps, currentStep, isRunning, subagents, currentResumeState],
  () => {
    if (steps.value.length > 0 || currentResumeState.value) {
      // Debounce saves to avoid triggering too frequently
      if (saveTimeout) clearTimeout(saveTimeout)
      saveTimeout = setTimeout(() => {
        saveConversation()
      }, 500)
    }
  },
  { deep: true }
)

// Initialize: Check for interrupted conversation and capture target tab
onMounted(async () => {
  // Capture the current active tab ID for sidebar mode
  // This ensures we always operate on the correct tab even if focus changes
  if (typeof chrome !== 'undefined' && chrome.tabs) {
    try {
      const [activeTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true })
      if (activeTab?.id && !activeTab.url?.startsWith('chrome-extension://')) {
        capturedTabId.value = activeTab.id
        console.log('[AIAgent] Captured target tab ID:', activeTab.id, activeTab.url)
      }
    } catch (e) {
      console.error('[AIAgent] Failed to capture target tab:', e)
    }
  }

  const saved = loadConversation()
  if (saved && saved.isRunning) {
    // Conversation was interrupted
    savedConversation.value = saved

    // If we have a resume state with messages, automatically resume
    if (saved.resumeState && saved.resumeState.messages.length > 0) {
      // Auto-resume after a short delay to allow UI to render
      setTimeout(() => {
        resumeConversation()
      }, 500)
    } else {
      // No resume state, just show the notice
      wasInterrupted.value = true
    }
  }
})

// Cleanup: Mark conversation as completed when unmounting
onBeforeUnmount(() => {
  if (isRunning.value) {
    // Save final state before unmounting
    saveConversation()
  }
})

// Resume interrupted conversation
const resumeConversation = async () => {
  if (!savedConversation.value) return

  const saved = savedConversation.value

  // Restore state
  steps.value = saved.steps
  currentStep.value = saved.currentStep
  subagents.value = saved.subagents
  originalTask.value = saved.task

  // Continue from where we left off
  wasInterrupted.value = false

  // If we have a resume state, actually continue the agent execution
  if (saved.resumeState && saved.resumeState.messages.length > 0) {
    const config: AgentConfig = {
      apiKey: saved.config.apiKey || apiKey.value,
      baseUrl: saved.config.baseUrl || baseUrl.value,
      model: saved.config.model || model.value,
      imageModel: saved.config.imageModel || imageModel.value || undefined,
      maxTokens: saved.config.maxTokens || maxTokens.value,
      mcpServers: saved.config.mcpServers || mcpServers.value,
      targetTabId: targetTabId.value,
      enabledBuiltinTools: saved.config.enabledBuiltinTools || enabledBuiltinTools.value,
      enableMcpTools: saved.config.enableMcpTools ?? enableMcpTools.value
    }

    isRunning.value = true
    errorMessage.value = ''
    abortController.value = new AbortController()

    try {
      const result = await runAgent(
        config,
        saved.task,
        status => {
          currentStep.value = status.step
          if (status.thinking) {
            currentThinking.value = status.thinking
          }
          if (status.action) {
            currentAction.value = status.action
          }
          if (status.screenshot) {
            currentScreenshot.value = status.screenshot
          }
          if (status.subagents) {
            subagents.value = status.subagents
          }
        },
        abortController.value.signal,
        maxSteps.value,
        saved.resumeState
      )

      // Merge steps - keep the first step (task), then add result steps
      steps.value = [steps.value[0], ...result.steps]

      // Update resume state for next potential interruption
      if (result.resumeState) {
        currentResumeState.value = result.resumeState
      }

      if (!result.success && result.error) {
        errorMessage.value = result.error
      }
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : String(error)
    } finally {
      isRunning.value = false
      abortController.value = null
      currentThinking.value = ''
      currentAction.value = null
      // Clear persisted conversation on successful completion
      if (!errorMessage.value) {
        clearPersistedConversation()
      }
    }
  } else {
    // No resume state available, just show the history
    errorMessage.value = '对话历史已恢复，但无法继续执行。请重新提交任务。'
  }
}

// Dismiss the interrupted conversation notice
const dismissInterrupted = () => {
  wasInterrupted.value = false
  savedConversation.value = null
  clearPersistedConversation()
}

// 格式化操作参数为易读格式
function formatActionParams(action: AgentAction): string {
  if (!action.params || Object.keys(action.params).length === 0) return ''
  const entries = Object.entries(action.params)
  return entries
    .map(([key, value]) => {
      if (typeof value === 'string' && value.length > 30) {
        return `${key}: "${value.slice(0, 30)}..."`
      }
      return `${key}: ${JSON.stringify(value)}`
    })
    .join(', ')
}

// Settings panel toggle
const showSettings = computed({
  get: () => settingsActiveKey.value.includes('settings'),
  set: (value: boolean) => {
    settingsActiveKey.value = value ? ['settings'] : []
  }
})

// 切换截图展开状态
function toggleScreenshot(index: number) {
  if (expandedScreenshots.value.has(index)) {
    expandedScreenshots.value.delete(index)
  } else {
    expandedScreenshots.value.add(index)
  }
  expandedScreenshots.value = new Set(expandedScreenshots.value)
}

async function startTask() {
  if (!canRun.value) return

  const config: AgentConfig = {
    apiKey: apiKey.value,
    baseUrl: baseUrl.value,
    model: model.value,
    imageModel: imageModel.value || undefined,
    maxTokens: maxTokens.value,
    mcpServers: mcpServers.value,
    targetTabId: targetTabId.value, // Pass target tab ID for popup window mode
    enabledBuiltinTools: enabledBuiltinTools.value,
    enableMcpTools: enableMcpTools.value
  }

  isRunning.value = true
  errorMessage.value = ''
  steps.value = []
  currentStep.value = 0
  currentThinking.value = ''
  currentAction.value = null
  currentScreenshot.value = ''
  expandedScreenshots.value = new Set()
  currentResumeState.value = null

  abortController.value = new AbortController()

  const task = taskInput.value
  taskInput.value = ''
  originalTask.value = task

  // 添加任务作为第一个步骤
  steps.value.push({ thinking: `${t('aiAgentTask')}: ${task}` })

  try {
    const result = await runAgent(
      config,
      task,
      status => {
        currentStep.value = status.step
        if (status.thinking) {
          currentThinking.value = status.thinking
        }
        if (status.action) {
          currentAction.value = status.action
        }
        if (status.screenshot) {
          currentScreenshot.value = status.screenshot
        }
        if (status.subagents) {
          subagents.value = status.subagents
        }
      },
      abortController.value.signal,
      maxSteps.value
    )

    steps.value = [steps.value[0], ...result.steps]

    // Update resume state for potential future resumption
    if (result.resumeState) {
      currentResumeState.value = result.resumeState
    }

    if (!result.success && result.error) {
      errorMessage.value = result.error
    }
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error)
  } finally {
    isRunning.value = false
    abortController.value = null
    currentThinking.value = ''
    currentAction.value = null
    // Only clear persisted conversation on successful completion
    if (!errorMessage.value) {
      clearPersistedConversation()
      currentResumeState.value = null
      originalTask.value = ''
    }
  }
}

function stopTask() {
  if (abortController.value) {
    abortController.value.abort()
  }
}

function clearHistory() {
  steps.value = []
  errorMessage.value = ''
  currentScreenshot.value = ''
  expandedScreenshots.value = new Set()
  subagents.value = []
  expandedSubagents.value = new Set()
}

// Toggle subagent expansion
function toggleSubagent(id: string) {
  if (expandedSubagents.value.has(id)) {
    expandedSubagents.value.delete(id)
  } else {
    expandedSubagents.value.add(id)
  }
  expandedSubagents.value = new Set(expandedSubagents.value)
}

// Check if running in popup window mode
const isPopupWindow = computed(() => {
  return window.location.search.includes('type=agent-popup')
})

// Target tab ID for operations
// For popup window: from URL params
// For sidebar: captured on mount
const capturedTabId = ref<number | undefined>(undefined)

const targetTabId = computed(() => {
  // First check URL params (for popup window mode)
  const params = new URLSearchParams(window.location.search)
  const tabId = params.get('targetTabId')
  if (tabId) {
    return parseInt(tabId, 10)
  }
  // For sidebar mode, use captured tab ID
  return capturedTabId.value
})

// Open AI Agent in a separate popup window
async function openInPopupWindow() {
  const width = 500
  const height = 700
  const left = window.screen.width - width - 50
  const top = 100

  // Use chrome.windows.create for extension popup
  if (typeof chrome !== 'undefined' && chrome.windows && chrome.tabs) {
    // Get the current active tab to remember which tab to control
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true })
    const targetTabId = activeTab?.id

    await chrome.windows.create({
      url: `index.html?type=agent-popup&targetTabId=${targetTabId}`,
      type: 'popup',
      width,
      height,
      left,
      top,
      focused: true
    })
  } else {
    // Fallback for non-extension context
    window.open(
      'index.html?type=agent-popup',
      'ai-agent-popup',
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
    )
  }
}
</script>

<template>
  <div class="ai-agent-container">
    <!-- Header -->
    <div class="agent-header">
      <div class="header-title">
        <RobotOutlined class="header-icon" />
        <span>{{ t('aiAgentTitle') }}</span>
        <a-tag v-if="isPopupWindow && targetTabId" color="blue" size="small" class="target-tab-tag">
          Tab #{{ targetTabId }}
        </a-tag>
      </div>
      <div class="header-actions">
        <a-tooltip v-if="!isPopupWindow" :title="t('aiAgentOpenPopup')">
          <a-button type="text" class="header-btn" @click="openInPopupWindow">
            <ExpandOutlined />
          </a-button>
        </a-tooltip>
        <a-button
          type="text"
          :class="['settings-btn', { active: showSettings }]"
          @click="showSettings = !showSettings"
        >
          <SettingOutlined />
        </a-button>
      </div>
    </div>

    <!-- Interrupted Conversation Notice -->
    <a-alert
      v-if="wasInterrupted && savedConversation"
      type="info"
      closable
      @close="dismissInterrupted"
      style="margin: 12px"
    >
      <template #message>
        <div style="display: flex; align-items: center; justify-content: space-between">
          <span>检测到上次对话意外中断 ({{ new Date(savedConversation.timestamp).toLocaleString() }})</span>
          <a-button type="primary" size="small" @click="resumeConversation">
            恢复对话
          </a-button>
        </div>
      </template>
      <template #description>
        对话包含 {{ savedConversation.steps.length }} 个步骤。点击"恢复对话"查看历史记录。
      </template>
    </a-alert>

    <!-- Settings Panel -->
    <a-collapse v-model:active-key="settingsActiveKey" :bordered="false" class="settings-collapse">
      <a-collapse-panel key="settings" :show-arrow="false">
        <template #header><span></span></template>
        <a-form layout="vertical" class="settings-form" size="small">
          <a-form-item :label="t('aiAgentApiKey')">
            <a-input-password v-model:value="apiKey" :placeholder="t('aiAgentApiKeyPlaceholder')" />
          </a-form-item>
          <a-form-item :label="t('aiAgentBaseUrl')">
            <a-input v-model:value="baseUrl" :placeholder="t('aiAgentBaseUrlPlaceholder')" />
          </a-form-item>
          <a-form-item :label="t('aiAgentModel')">
            <a-input v-model:value="model" :placeholder="t('aiAgentModelPlaceholder')" />
          </a-form-item>
          <a-form-item :label="t('aiAgentImageModel')">
            <a-input v-model:value="imageModel" :placeholder="t('aiAgentImageModelPlaceholder')" />
          </a-form-item>
          <a-form-item :label="t('aiAgentMaxSteps')">
            <a-input-number
              v-model:value="maxSteps"
              :min="5"
              :max="1000"
              :step="5"
              style="width: 100%"
            />
          </a-form-item>
          <a-form-item :label="t('aiAgentMaxTokens')">
            <a-input-number
              v-model:value="maxTokens"
              :min="1024"
              :max="32768"
              :step="1024"
              style="width: 100%"
            />
          </a-form-item>

          <!-- Built-in Tools Configuration -->
          <a-form-item :label="t('aiAgentBuiltinTools') || 'Built-in Tools'">
            <a-select
              v-model:value="enabledBuiltinTools"
              mode="multiple"
              :placeholder="t('aiAgentSelectTools') || 'Select tools to enable'"
              size="small"
              style="width: 100%"
              :max-tag-count="3"
            >
              <a-select-option v-for="tool in allBuiltinTools" :key="tool" :value="tool">
                {{ tool }}
              </a-select-option>
            </a-select>
            <a-typography-text
              type="secondary"
              style="font-size: 11px; display: block; margin-top: 4px"
            >
              {{
                t('aiAgentBuiltinToolsHint') ||
                'Select which built-in tools the agent can use. Leave empty to enable all.'
              }}
            </a-typography-text>
          </a-form-item>

          <!-- MCP Tools Toggle -->
          <a-form-item :label="t('aiAgentEnableMcpTools') || 'Enable MCP Tools'">
            <a-switch v-model:checked="enableMcpTools" size="small" />
            <a-typography-text
              type="secondary"
              style="font-size: 11px; display: block; margin-top: 4px"
            >
              {{
                t('aiAgentEnableMcpToolsHint') ||
                'Allow the agent to use tools provided by MCP servers'
              }}
            </a-typography-text>
          </a-form-item>

          <!-- MCP Servers Section -->
          <a-form-item :label="t('aiAgentMcpServers')">
            <div class="mcp-servers-list">
              <div v-if="mcpServers.length === 0" class="mcp-no-servers">
                {{ t('aiAgentMcpNoServers') }}
              </div>
              <div v-for="server in mcpServers" :key="server.id" class="mcp-server-item">
                <div class="mcp-server-info">
                  <a-switch
                    :checked="server.enabled"
                    size="small"
                    @change="toggleMcpServer(server.id)"
                  />
                  <span class="mcp-server-name" :class="{ disabled: !server.enabled }">
                    {{ server.name }}
                  </span>
                  <a-tag size="small">{{ server.type }}</a-tag>
                  <!-- Test Result -->
                  <a-tag
                    v-if="mcpTestResults.get(server.id)"
                    :color="mcpTestResults.get(server.id)?.success ? 'success' : 'error'"
                    size="small"
                  >
                    {{ mcpTestResults.get(server.id)?.message }}
                  </a-tag>
                </div>
                <div class="mcp-server-actions">
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
                    {{
                      mcpTestingIds.has(server.id) ? t('aiAgentMcpTesting') : t('aiAgentMcpTest')
                    }}
                  </a-button>
                  <a-button type="text" danger size="small" @click="removeMcpServer(server.id)">
                    <template #icon><DeleteOutlined /></template>
                  </a-button>
                </div>
              </div>
            </div>

            <!-- Add MCP Server Form -->
            <div class="mcp-add-form">
              <a-input
                v-model:value="newMcpServer.name"
                :placeholder="t('aiAgentMcpServerName')"
                size="small"
                class="mcp-input"
              />
              <a-input
                v-model:value="newMcpServer.url"
                :placeholder="t('aiAgentMcpServerUrl')"
                size="small"
                class="mcp-input"
              />
              <a-select v-model:value="newMcpServer.type" size="small" class="mcp-select">
                <a-select-option value="sse">SSE</a-select-option>
                <a-select-option value="streamable-http">Streamable HTTP</a-select-option>
              </a-select>
              <a-input-password
                v-model:value="newMcpServer.apiKey"
                :placeholder="t('aiAgentMcpServerApiKey')"
                size="small"
                class="mcp-input"
              />
              <a-button
                type="primary"
                size="small"
                :disabled="!newMcpServer.name.trim() || !newMcpServer.url.trim()"
                @click="addMcpServer"
              >
                <template #icon><PlusOutlined /></template>
                {{ t('aiAgentMcpAddServer') }}
              </a-button>
            </div>
          </a-form-item>

          <a-typography-text type="secondary" class="settings-hint">
            {{ t('aiAgentSettingsHint') }}
          </a-typography-text>
        </a-form>
      </a-collapse-panel>
    </a-collapse>

    <!-- Status Bar -->
    <div v-if="isRunning" class="status-bar">
      <div class="status-indicator">
        <LoadingOutlined spin class="status-spinner" />
        <span>{{ t('aiAgentStep', [currentStep]) }}</span>
      </div>
      <a-button type="primary" danger size="small" @click="stopTask">
        <template #icon><StopOutlined /></template>
        {{ t('aiAgentStop') }}
      </a-button>
    </div>

    <!-- Chat Area -->
    <div ref="chatContainer" class="chat-container">
      <!-- Config Warning -->
      <a-alert
        v-if="!isConfigured && !showSettings"
        type="warning"
        show-icon
        class="config-warning"
      >
        <template #icon><WarningOutlined /></template>
        <template #message>{{ t('aiAgentNotConfigured') }}</template>
        <template #description>
          <a-button type="primary" size="small" class="config-btn" @click="showSettings = true">
            {{ t('aiAgentConfigure') }}
          </a-button>
        </template>
      </a-alert>

      <!-- Steps -->
      <template v-for="(step, index) in steps" :key="index">
        <a-card :class="['step-card', { 'has-error': step.error }]" :bordered="true" size="small">
          <!-- Step Number Badge -->
          <template #title v-if="index > 0">
            <a-badge :count="index" :number-style="{ backgroundColor: '#d97706' }" />
          </template>

          <!-- Thinking Section -->
          <div v-if="step.thinking" class="step-section thinking-section">
            <div class="section-header">
              <ThunderboltOutlined class="section-icon thinking-icon" />
              <span class="section-label">
                {{ index === 0 ? t('aiAgentTask') : t('aiAgentThinking') }}
              </span>
            </div>
            <div class="thinking-text">{{ step.thinking.replace(/^.*?: /, '') }}</div>
          </div>

          <!-- Action Section -->
          <div v-if="step.action" class="step-section action-section">
            <div class="section-header">
              <ThunderboltOutlined class="section-icon action-icon" />
              <a-tag color="orange">{{ step.action.type }}</a-tag>
            </div>
            <a-typography-text v-if="step.action.params" code class="action-params">
              {{ formatActionParams(step.action) }}
            </a-typography-text>
          </div>

          <!-- Result Section -->
          <div v-if="step.result" class="step-section result-section">
            <div class="section-header">
              <CheckCircleOutlined class="section-icon result-icon" />
              <span class="section-label">{{ t('aiAgentResult') }}</span>
            </div>
            <a-typography-text type="success" class="result-text">
              {{ step.result }}
            </a-typography-text>
          </div>

          <!-- Error Section -->
          <div v-if="step.error" class="step-section error-section">
            <div class="section-header">
              <CloseCircleOutlined class="section-icon error-icon" />
              <span class="section-label">{{ t('aiAgentError') }}</span>
            </div>
            <a-typography-text type="danger" class="error-text">{{ step.error }}</a-typography-text>
          </div>

          <!-- Screenshot Section (Collapsible) -->
          <div v-if="step.screenshot" class="step-section screenshot-section">
            <a-button type="text" class="screenshot-toggle" @click="toggleScreenshot(index)">
              <CameraOutlined />
              <span>{{ t('aiAgentScreenshot') }}</span>
              <DownOutlined v-if="expandedScreenshots.has(index)" class="toggle-icon" />
              <RightOutlined v-else class="toggle-icon" />
            </a-button>
            <div v-if="expandedScreenshots.has(index)" class="screenshot-preview">
              <a-image :src="`data:image/png;base64,${step.screenshot}`" alt="Screenshot" />
            </div>
          </div>
        </a-card>
      </template>

      <!-- Current Activity -->
      <a-card
        v-if="isRunning && (currentThinking || currentAction)"
        class="step-card current"
        :bordered="true"
        size="small"
      >
        <template #title>
          <a-badge
            :count="currentStep"
            :number-style="{ backgroundColor: '#d97706' }"
            status="processing"
          />
        </template>

        <!-- Current Thinking -->
        <div v-if="currentThinking" class="step-section thinking-section">
          <div class="section-header">
            <LoadingOutlined spin class="section-icon thinking-icon" />
            <span class="section-label">{{ t('aiAgentThinking') }}</span>
          </div>
          <div class="thinking-text">{{ currentThinking }}</div>
        </div>

        <!-- Current Action -->
        <div v-if="currentAction" class="step-section action-section">
          <div class="section-header">
            <LoadingOutlined spin class="section-icon action-icon" />
            <a-tag color="processing">{{ currentAction.type }}</a-tag>
            <a-tag>{{ t('aiAgentExecuting') }}...</a-tag>
          </div>
          <a-typography-text v-if="currentAction.params" code class="action-params">
            {{ formatActionParams(currentAction) }}
          </a-typography-text>
        </div>

        <!-- Current Screenshot -->
        <div v-if="currentScreenshot" class="step-section screenshot-section">
          <div class="screenshot-preview">
            <a-image :src="`data:image/png;base64,${currentScreenshot}`" alt="Current Screenshot" />
          </div>
        </div>
      </a-card>

      <!-- Error Message -->
      <a-alert v-if="errorMessage" type="error" show-icon class="error-alert">
        <template #icon><CloseCircleOutlined /></template>
        <template #message>{{ t('aiAgentError') }}</template>
        <template #description>{{ errorMessage }}</template>
      </a-alert>

      <!-- Subagents Panel -->
      <div v-if="subagents.length > 0" class="subagents-panel">
        <div class="subagents-header">
          <RobotOutlined class="subagents-icon" />
          <span>{{ t('aiAgentSubagents') }} ({{ subagents.length }})</span>
        </div>
        <div class="subagents-list">
          <div
            v-for="subagent in subagents"
            :key="subagent.id"
            class="subagent-card"
            :class="{ expanded: expandedSubagents.has(subagent.id) }"
          >
            <div class="subagent-header" @click="toggleSubagent(subagent.id)">
              <div class="subagent-info">
                <a-badge
                  :status="
                    subagent.status === 'running'
                      ? 'processing'
                      : subagent.status === 'completed'
                        ? 'success'
                        : 'error'
                  "
                />
                <span class="subagent-id">{{ subagent.id }}</span>
                <a-tag
                  :color="
                    subagent.status === 'running'
                      ? 'processing'
                      : subagent.status === 'completed'
                        ? 'success'
                        : 'error'
                  "
                  size="small"
                >
                  {{ subagent.status }}
                </a-tag>
              </div>
              <DownOutlined v-if="expandedSubagents.has(subagent.id)" class="expand-icon" />
              <RightOutlined v-else class="expand-icon" />
            </div>
            <div class="subagent-task">{{ subagent.task }}</div>
            <div v-if="expandedSubagents.has(subagent.id)" class="subagent-details">
              <div v-if="subagent.result" class="subagent-result">
                <CheckCircleOutlined class="result-icon" />
                <span>{{ subagent.result }}</span>
              </div>
              <div v-if="subagent.error" class="subagent-error">
                <CloseCircleOutlined class="error-icon" />
                <span>{{ subagent.error }}</span>
              </div>
              <div v-if="subagent.steps.length > 0" class="subagent-steps">
                <div class="steps-label">{{ t('aiAgentSteps') }}: {{ subagent.steps.length }}</div>
                <div v-for="(step, idx) in subagent.steps" :key="idx" class="subagent-step">
                  <a-badge
                    :count="idx + 1"
                    :number-style="{ backgroundColor: '#d97706', fontSize: '10px' }"
                  />
                  <span v-if="step.action" class="step-action">{{ step.action.type }}</span>
                  <span v-if="step.result" class="step-result">
                    {{ step.result.slice(0, 50) }}{{ step.result.length > 50 ? '...' : '' }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-if="steps.length === 0 && !isRunning && isConfigured" class="empty-state">
        <RobotOutlined class="empty-icon" />
        <a-typography-title :level="4" class="empty-title">
          {{ t('aiAgentWelcome') }}
        </a-typography-title>
        <a-typography-paragraph type="secondary" class="empty-hint">
          {{ t('aiAgentHint') }}
        </a-typography-paragraph>
      </div>
    </div>

    <!-- Input Area -->
    <div class="input-area">
      <div class="input-row">
        <a-textarea
          v-model:value="taskInput"
          :placeholder="t('aiAgentInputPlaceholder')"
          :auto-size="{ minRows: 1, maxRows: 4 }"
          :disabled="isRunning || !isConfigured"
          @keydown.enter.exact.prevent="startTask"
          class="task-input"
        />
        <a-button
          type="primary"
          class="send-btn"
          :disabled="!canRun"
          :loading="isRunning"
          @click="startTask"
        >
          <template #icon><SendOutlined /></template>
        </a-button>
      </div>
      <div class="input-actions">
        <a-button
          v-if="steps.length > 0"
          type="text"
          size="small"
          danger
          @click="clearHistory"
          :disabled="isRunning"
        >
          <template #icon><DeleteOutlined /></template>
          {{ t('aiAgentClear') }}
        </a-button>
      </div>
    </div>
  </div>

  <!-- Edit MCP Server Modal -->
  <a-modal
    v-model:open="showEditModal"
    :title="t('aiAgentMcpEditServer')"
    @ok="saveEditedServer"
    @cancel="cancelEdit"
    :ok-button-props="{ disabled: !editForm.name.trim() || !editForm.url.trim() }"
  >
    <div class="space-y-4 py-4">
      <div>
        <label class="block text-sm font-medium mb-2">{{ t('aiAgentMcpServerName') }}:</label>
        <a-input v-model:value="editForm.name" :placeholder="t('aiAgentMcpServerName')" />
      </div>
      <div>
        <label class="block text-sm font-medium mb-2">{{ t('aiAgentMcpServerUrl') }}:</label>
        <a-input v-model:value="editForm.url" :placeholder="t('aiAgentMcpServerUrl')" />
      </div>
      <div>
        <label class="block text-sm font-medium mb-2">{{ t('aiAgentMcpServerType') }}:</label>
        <a-select v-model:value="editForm.type" class="w-full">
          <a-select-option value="sse">SSE</a-select-option>
          <a-select-option value="streamable-http">Streamable HTTP</a-select-option>
        </a-select>
      </div>
      <div>
        <label class="block text-sm font-medium mb-2">{{ t('aiAgentMcpServerApiKey') }}:</label>
        <a-input-password
          v-model:value="editForm.apiKey"
          :placeholder="t('aiAgentMcpServerApiKey')"
        />
      </div>
    </div>
  </a-modal>
</template>

<style scoped>
.ai-agent-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-color, #faf9f7);
}

/* Header - Anthropic style */
.agent-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color, #e8e5e0);
  background: var(--header-bg, #fff);
}

.header-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 600;
  font-size: 15px;
  color: var(--text-primary, #1a1a1a);
}

.header-icon {
  font-size: 20px;
  color: var(--accent-color, #d97706);
}

.target-tab-tag {
  margin-left: 8px;
  font-size: 11px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.header-btn {
  color: var(--text-secondary, #6b6b6b);
}

.header-btn:hover {
  color: var(--accent-color, #d97706);
}

.settings-btn {
  color: var(--text-secondary, #6b6b6b);
}

.settings-btn.active {
  color: var(--accent-color, #d97706);
  background: var(--accent-bg, #fef3e2);
}

/* Settings Panel */
.settings-collapse {
  background: var(--panel-bg, #fff);
}

.settings-collapse :deep(.ant-collapse-header) {
  display: none !important;
}

.settings-collapse :deep(.ant-collapse-content-box) {
  padding: 16px 20px !important;
  border-bottom: 1px solid var(--border-color, #e8e5e0);
}

.settings-form :deep(.ant-form-item) {
  margin-bottom: 12px;
}

.settings-form :deep(.ant-form-item-label > label) {
  color: var(--text-secondary, #6b6b6b);
  font-size: 12px;
}

.settings-hint {
  font-size: 12px;
  line-height: 1.5;
}

/* MCP Servers */
.mcp-servers-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}

.mcp-no-servers {
  font-size: 12px;
  color: var(--text-secondary, #6b6b6b);
  padding: 8px;
  text-align: center;
  background: var(--code-bg, #f5f4f2);
  border-radius: 6px;
}

.mcp-server-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  background: var(--code-bg, #f5f4f2);
  border-radius: 6px;
}

.mcp-server-info {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.mcp-server-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary, #1a1a1a);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mcp-server-name.disabled {
  color: var(--text-secondary, #6b6b6b);
  text-decoration: line-through;
}

.mcp-server-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.mcp-add-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.mcp-input {
  width: 100%;
}

.mcp-select {
  width: 100%;
}

/* Status Bar - Anthropic orange accent */
.status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 20px;
  background: linear-gradient(135deg, #fef3e2 0%, #fff7ed 100%);
  border-bottom: 1px solid var(--accent-border, #fed7aa);
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  font-weight: 500;
  color: var(--accent-dark, #c2410c);
}

.status-spinner {
  color: var(--accent-color, #d97706);
  font-size: 16px;
}

/* Chat Container */
.chat-container {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.config-warning {
  border-radius: 12px;
}

.config-btn {
  margin-top: 8px;
  background: var(--accent-color, #d97706);
  border-color: var(--accent-color, #d97706);
}

.config-btn:hover {
  background: var(--accent-hover, #b45309) !important;
  border-color: var(--accent-hover, #b45309) !important;
}

/* Step Card - Anthropic style */
.step-card {
  border-radius: 12px;
  border-color: var(--card-border, #e8e5e0);
  background: var(--card-bg, #fff);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.step-card :deep(.ant-card-head) {
  min-height: auto;
  padding: 8px 16px;
  border-bottom: none;
}

.step-card :deep(.ant-card-body) {
  padding: 12px 16px;
}

.step-card.current {
  border-color: var(--accent-color, #d97706);
  box-shadow: 0 0 0 2px var(--accent-bg, #fef3e2);
}

.step-card.has-error {
  border-color: var(--error-color, #ef4444);
  background: var(--error-bg, #fef2f2);
}

/* Step Sections */
.step-section {
  margin-bottom: 10px;
}

.step-section:last-child {
  margin-bottom: 0;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.section-icon {
  font-size: 14px;
}

.thinking-icon {
  color: var(--accent-color, #d97706);
}

.action-icon {
  color: var(--accent-color, #d97706);
}

.result-icon {
  color: var(--success-color, #22c55e);
}

.error-icon {
  color: var(--error-color, #ef4444);
}

.section-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary, #6b6b6b);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.thinking-text {
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-primary, #1a1a1a);
  white-space: pre-wrap;
  word-break: break-word;
}

.action-params {
  font-size: 11px;
  background: var(--code-bg, #f5f4f2) !important;
  border-radius: 6px;
  padding: 4px 8px;
  display: inline-block;
  margin-top: 4px;
}

.result-text,
.error-text {
  font-size: 13px;
  line-height: 1.5;
}

/* Screenshot Section */
.screenshot-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text-secondary, #6b6b6b);
  padding: 4px 8px;
}

.toggle-icon {
  font-size: 10px;
  margin-left: 4px;
}

.screenshot-preview {
  margin-top: 8px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--border-color, #e8e5e0);
}

.screenshot-preview :deep(.ant-image-img) {
  max-width: 100%;
  display: block;
}

/* Error Alert */
.error-alert {
  border-radius: 12px;
}

/* Empty State */
.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 40px 20px;
}

.empty-icon {
  font-size: 56px;
  color: var(--accent-color, #d97706);
  margin-bottom: 16px;
}

.empty-title {
  color: var(--text-primary, #1a1a1a) !important;
  margin-bottom: 8px !important;
}

.empty-hint {
  max-width: 280px;
  line-height: 1.6;
}

/* Input Area */
.input-area {
  padding: 16px 20px;
  border-top: 1px solid var(--border-color, #e8e5e0);
  background: var(--input-bg, #fff);
}

.input-row {
  display: flex;
  gap: 10px;
  align-items: flex-end;
}

.task-input {
  flex: 1;
  border-radius: 12px !important;
}

.task-input :deep(.ant-input) {
  border-radius: 12px;
}

.send-btn {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: var(--accent-color, #d97706);
  border-color: var(--accent-color, #d97706);
}

.send-btn:hover:not(:disabled) {
  background: var(--accent-hover, #b45309) !important;
  border-color: var(--accent-hover, #b45309) !important;
}

.send-btn:disabled {
  background: var(--disabled-bg, #e8e5e0);
  border-color: var(--disabled-bg, #e8e5e0);
}

.input-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
}

/* Dark mode support - Anthropic dark theme */
:global(.dark) .ai-agent-container {
  --bg-color: #1c1917;
  --header-bg: #292524;
  --panel-bg: #292524;
  --border-color: #44403c;
  --card-bg: #292524;
  --card-border: #44403c;
  --text-primary: #fafaf9;
  --text-secondary: #a8a29e;
  --accent-color: #f59e0b;
  --accent-hover: #d97706;
  --accent-bg: rgba(245, 158, 11, 0.15);
  --accent-border: rgba(245, 158, 11, 0.3);
  --accent-dark: #fbbf24;
  --code-bg: #1c1917;
  --input-bg: #292524;
  --disabled-bg: #44403c;
  --success-color: #4ade80;
  --error-color: #f87171;
  --error-bg: rgba(248, 113, 113, 0.1);
}

:global(.dark) .status-bar {
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(217, 119, 6, 0.1) 100%);
}

:global(.dark) .step-card.current {
  box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.2);
}

:global(.dark) .settings-collapse :deep(.ant-collapse-content-box) {
  border-bottom-color: var(--border-color);
}

/* Subagents Panel */
.subagents-panel {
  background: var(--card-bg, #fff);
  border: 1px solid var(--accent-border, #fed7aa);
  border-radius: 12px;
  overflow: hidden;
}

.subagents-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: linear-gradient(135deg, #fef3e2 0%, #fff7ed 100%);
  border-bottom: 1px solid var(--accent-border, #fed7aa);
  font-weight: 500;
  color: var(--accent-dark, #c2410c);
}

:global(.dark) .subagents-header {
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(217, 119, 6, 0.1) 100%);
}

.subagents-icon {
  color: var(--accent-color, #d97706);
}

.subagents-list {
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.subagent-card {
  background: var(--code-bg, #f5f4f2);
  border-radius: 8px;
  padding: 10px 12px;
  transition: all 0.2s;
}

.subagent-card.expanded {
  background: var(--card-bg, #fff);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.subagent-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
}

.subagent-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.subagent-id {
  font-weight: 500;
  font-size: 12px;
  color: var(--text-primary, #1a1a1a);
}

.expand-icon {
  font-size: 10px;
  color: var(--text-secondary, #6b6b6b);
}

.subagent-task {
  font-size: 12px;
  color: var(--text-secondary, #6b6b6b);
  margin-top: 6px;
  line-height: 1.4;
}

.subagent-details {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--border-color, #e8e5e0);
}

.subagent-result {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  color: var(--success-color, #22c55e);
  font-size: 12px;
  margin-bottom: 8px;
}

.subagent-error {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  color: var(--error-color, #ef4444);
  font-size: 12px;
  margin-bottom: 8px;
}

.subagent-steps {
  margin-top: 8px;
}

.steps-label {
  font-size: 11px;
  font-weight: 500;
  color: var(--text-secondary, #6b6b6b);
  margin-bottom: 6px;
  text-transform: uppercase;
}

.subagent-step {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  font-size: 11px;
}

.step-action {
  font-weight: 500;
  color: var(--accent-color, #d97706);
}

.step-result {
  color: var(--text-secondary, #6b6b6b);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
