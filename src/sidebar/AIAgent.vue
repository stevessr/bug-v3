<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
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
  PlusOutlined
} from '@ant-design/icons-vue'

import type { McpServerConfig } from '@/types/type'
import {
  runAgent,
  validateConfig,
  type AgentConfig,
  type AgentStep,
  type AgentAction
} from '@/services/aiAgentService'
import { useEmojiStore } from '@/stores/emojiStore'
import { useI18n } from '@/utils/i18n'

const { t } = useI18n()

const emojiStore = useEmojiStore()

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

// MCP Servers
const mcpServers = computed({
  get: () => emojiStore.settings.claudeMcpServers || [],
  set: (servers: McpServerConfig[]) => emojiStore.updateSettings({ claudeMcpServers: servers })
})

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
  mcpServers.value = mcpServers.value.map(s =>
    s.id === id ? { ...s, enabled: !s.enabled } : s
  )
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
    maxTokens: maxTokens.value
  }

  isRunning.value = true
  errorMessage.value = ''
  steps.value = []
  currentStep.value = 0
  currentThinking.value = ''
  currentAction.value = null
  currentScreenshot.value = ''
  expandedScreenshots.value = new Set()

  abortController.value = new AbortController()

  const task = taskInput.value
  taskInput.value = ''

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
      },
      abortController.value.signal,
      maxSteps.value
    )

    steps.value = [steps.value[0], ...result.steps]

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
}
</script>

<template>
  <div class="ai-agent-container">
    <!-- Header -->
    <div class="agent-header">
      <div class="header-title">
        <RobotOutlined class="header-icon" />
        <span>{{ t('aiAgentTitle') }}</span>
      </div>
      <a-button
        type="text"
        :class="['settings-btn', { active: showSettings }]"
        @click="showSettings = !showSettings"
      >
        <SettingOutlined />
      </a-button>
    </div>

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
                </div>
                <a-button
                  type="text"
                  danger
                  size="small"
                  @click="removeMcpServer(server.id)"
                >
                  <template #icon><DeleteOutlined /></template>
                </a-button>
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
              <a-select
                v-model:value="newMcpServer.type"
                size="small"
                class="mcp-select"
              >
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
</style>
