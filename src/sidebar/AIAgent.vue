<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'

import {
  runAgent,
  validateConfig,
  type AgentConfig,
  type AgentStep
} from '@/services/aiAgentService'
import { useEmojiStore } from '@/stores/emojiStore'
import { useI18n } from '@/utils/i18n'

const { t } = useI18n()

const emojiStore = useEmojiStore()

const taskInput = ref('')
const isRunning = ref(false)
const currentStep = ref(0)
const currentThinking = ref('')
const currentAction = ref('')
const currentScreenshot = ref('')
const steps = ref<AgentStep[]>([])
const errorMessage = ref('')
const showSettings = ref(false)
const abortController = ref<AbortController | null>(null)

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

async function startTask() {
  if (!canRun.value) return

  const config: AgentConfig = {
    apiKey: apiKey.value,
    baseUrl: baseUrl.value,
    model: model.value
  }

  isRunning.value = true
  errorMessage.value = ''
  steps.value = []
  currentStep.value = 0
  currentThinking.value = ''
  currentAction.value = ''
  currentScreenshot.value = ''

  abortController.value = new AbortController()

  const task = taskInput.value
  taskInput.value = ''

  steps.value.push({ thinking: `Task: ${task}` })

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
          currentAction.value = `${status.action.type}: ${JSON.stringify(status.action.params || {})}`
        }
        if (status.screenshot) {
          currentScreenshot.value = status.screenshot
        }
      },
      abortController.value.signal
    )

    steps.value = result.steps

    if (!result.success && result.error) {
      errorMessage.value = result.error
    }
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error)
  } finally {
    isRunning.value = false
    abortController.value = null
    currentThinking.value = ''
    currentAction.value = ''
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
}
</script>

<template>
  <div class="ai-agent-container">
    <!-- Header -->
    <div class="agent-header">
      <div class="header-title">
        <span class="icon">🤖</span>
        <span>{{ t('aiAgentTitle') }}</span>
      </div>
      <button
        class="settings-btn"
        :class="{ active: showSettings }"
        @click="showSettings = !showSettings"
        :title="t('settings')"
      >
        ⚙️
      </button>
    </div>

    <!-- Settings Panel -->
    <div v-if="showSettings" class="settings-panel">
      <div class="setting-item">
        <label>{{ t('aiAgentApiKey') }}</label>
        <a-input-password
          v-model:value="apiKey"
          :placeholder="t('aiAgentApiKeyPlaceholder')"
          size="small"
        />
      </div>
      <div class="setting-item">
        <label>{{ t('aiAgentBaseUrl') }}</label>
        <a-input
          v-model:value="baseUrl"
          :placeholder="t('aiAgentBaseUrlPlaceholder')"
          size="small"
        />
      </div>
      <div class="setting-item">
        <label>{{ t('aiAgentModel') }}</label>
        <a-input v-model:value="model" :placeholder="t('aiAgentModelPlaceholder')" size="small" />
      </div>
      <div class="setting-hint">
        {{ t('aiAgentSettingsHint') }}
      </div>
    </div>

    <!-- Status Bar -->
    <div v-if="isRunning" class="status-bar">
      <div class="status-indicator">
        <span class="spinner"></span>
        <span>{{ t('aiAgentStep', [currentStep]) }}</span>
      </div>
      <button class="stop-btn" @click="stopTask">
        {{ t('aiAgentStop') }}
      </button>
    </div>

    <!-- Chat Area -->
    <div ref="chatContainer" class="chat-container">
      <!-- Config Warning -->
      <div v-if="!isConfigured && !showSettings" class="config-warning">
        <span class="warning-icon">⚠️</span>
        <span>{{ t('aiAgentNotConfigured') }}</span>
        <button class="config-btn" @click="showSettings = true">
          {{ t('aiAgentConfigure') }}
        </button>
      </div>

      <!-- Steps -->
      <template v-for="(step, index) in steps" :key="index">
        <div v-if="step.thinking" class="message thinking">
          <div class="message-header">
            <span class="avatar">🤖</span>
            <span class="label">{{ t('aiAgentThinking') }}</span>
          </div>
          <div class="message-content">{{ step.thinking }}</div>
        </div>

        <div v-if="step.action" class="message action">
          <div class="message-header">
            <span class="avatar">⚡</span>
            <span class="label">{{ t('aiAgentAction') }}</span>
          </div>
          <div class="message-content action-content">
            <span class="action-type">{{ step.action.type }}</span>
            <span v-if="step.action.params" class="action-params">
              {{ JSON.stringify(step.action.params) }}
            </span>
          </div>
        </div>

        <div v-if="step.result" class="message result">
          <div class="message-header">
            <span class="avatar">✅</span>
            <span class="label">{{ t('aiAgentResult') }}</span>
          </div>
          <div class="message-content">{{ step.result }}</div>
        </div>

        <div v-if="step.screenshot" class="message screenshot">
          <div class="message-header">
            <span class="avatar">📷</span>
            <span class="label">{{ t('aiAgentScreenshot') }}</span>
          </div>
          <div class="screenshot-preview">
            <img :src="`data:image/png;base64,${step.screenshot}`" alt="Screenshot" />
          </div>
        </div>

        <div v-if="step.error" class="message error">
          <div class="message-header">
            <span class="avatar">❌</span>
            <span class="label">{{ t('aiAgentError') }}</span>
          </div>
          <div class="message-content">{{ step.error }}</div>
        </div>
      </template>

      <!-- Current Activity -->
      <template v-if="isRunning">
        <div v-if="currentThinking" class="message thinking current">
          <div class="message-header">
            <span class="avatar">🤖</span>
            <span class="label">{{ t('aiAgentThinking') }}</span>
            <span class="typing-indicator">...</span>
          </div>
          <div class="message-content">{{ currentThinking }}</div>
        </div>

        <div v-if="currentAction" class="message action current">
          <div class="message-header">
            <span class="avatar">⚡</span>
            <span class="label">{{ t('aiAgentExecuting') }}</span>
          </div>
          <div class="message-content">{{ currentAction }}</div>
        </div>

        <div v-if="currentScreenshot" class="message screenshot">
          <div class="screenshot-preview">
            <img :src="`data:image/png;base64,${currentScreenshot}`" alt="Current Screenshot" />
          </div>
        </div>
      </template>

      <!-- Error Message -->
      <div v-if="errorMessage" class="message error final">
        <div class="message-header">
          <span class="avatar">❌</span>
          <span class="label">{{ t('aiAgentError') }}</span>
        </div>
        <div class="message-content">{{ errorMessage }}</div>
      </div>

      <!-- Empty State -->
      <div v-if="steps.length === 0 && !isRunning && isConfigured" class="empty-state">
        <div class="empty-icon">🤖</div>
        <div class="empty-title">{{ t('aiAgentWelcome') }}</div>
        <div class="empty-hint">{{ t('aiAgentHint') }}</div>
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
        />
        <button class="send-btn" :disabled="!canRun" @click="startTask">
          {{ isRunning ? '...' : '▶' }}
        </button>
      </div>
      <div class="input-actions">
        <button
          v-if="steps.length > 0"
          class="clear-btn"
          @click="clearHistory"
          :disabled="isRunning"
        >
          {{ t('aiAgentClear') }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ai-agent-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-color, #fff);
}

.agent-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color, #e5e7eb);
  background: var(--header-bg, #f9fafb);
}

.header-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 14px;
}

.header-title .icon {
  font-size: 18px;
}

.settings-btn {
  padding: 4px 8px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
  transition: all 0.2s;
}

.settings-btn:hover,
.settings-btn.active {
  background: var(--hover-bg, #f3f4f6);
  border-color: var(--border-color, #e5e7eb);
}

.settings-panel {
  padding: 12px 16px;
  background: var(--panel-bg, #f9fafb);
  border-bottom: 1px solid var(--border-color, #e5e7eb);
}

.setting-item {
  margin-bottom: 12px;
}

.setting-item label {
  display: block;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary, #6b7280);
  margin-bottom: 4px;
}

.setting-hint {
  font-size: 11px;
  color: var(--text-tertiary, #9ca3af);
  line-height: 1.4;
}

.status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  background: var(--status-bg, #eff6ff);
  border-bottom: 1px solid var(--status-border, #bfdbfe);
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--status-text, #1d4ed8);
}

.spinner {
  width: 14px;
  height: 14px;
  border: 2px solid var(--spinner-bg, #bfdbfe);
  border-top-color: var(--spinner-color, #1d4ed8);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.stop-btn {
  padding: 4px 12px;
  font-size: 12px;
  background: var(--stop-bg, #fee2e2);
  color: var(--stop-text, #dc2626);
  border: 1px solid var(--stop-border, #fecaca);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.stop-btn:hover {
  background: var(--stop-hover-bg, #fecaca);
}

.chat-container {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.config-warning {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 24px;
  background: var(--warning-bg, #fffbeb);
  border: 1px solid var(--warning-border, #fde68a);
  border-radius: 8px;
  text-align: center;
}

.warning-icon {
  font-size: 24px;
}

.config-btn {
  margin-top: 8px;
  padding: 6px 16px;
  background: var(--primary-color, #3b82f6);
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.2s;
}

.config-btn:hover {
  background: var(--primary-hover, #2563eb);
}

.message {
  background: var(--message-bg, #f9fafb);
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 13px;
}

.message.current {
  border: 1px solid var(--current-border, #bfdbfe);
  background: var(--current-bg, #eff6ff);
}

.message.error {
  background: var(--error-bg, #fef2f2);
  border: 1px solid var(--error-border, #fecaca);
}

.message.action {
  background: var(--action-bg, #f0fdf4);
  border: 1px solid var(--action-border, #bbf7d0);
}

.message-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}

.message-header .avatar {
  font-size: 14px;
}

.message-header .label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--label-color, #6b7280);
}

.typing-indicator {
  color: var(--typing-color, #3b82f6);
  animation: blink 1s infinite;
}

@keyframes blink {
  0%,
  50% {
    opacity: 1;
  }
  51%,
  100% {
    opacity: 0;
  }
}

.message-content {
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

.action-content {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}

.action-type {
  font-weight: 600;
  color: var(--action-type-color, #059669);
}

.action-params {
  font-size: 12px;
  color: var(--params-color, #6b7280);
  font-family: monospace;
}

.screenshot-preview {
  margin-top: 8px;
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid var(--screenshot-border, #e5e7eb);
}

.screenshot-preview img {
  max-width: 100%;
  height: auto;
  display: block;
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 32px;
  color: var(--empty-color, #9ca3af);
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 12px;
}

.empty-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--empty-title-color, #6b7280);
  margin-bottom: 8px;
}

.empty-hint {
  font-size: 13px;
  line-height: 1.5;
  max-width: 280px;
}

.input-area {
  padding: 12px 16px;
  border-top: 1px solid var(--border-color, #e5e7eb);
  background: var(--input-area-bg, #fff);
}

.input-row {
  display: flex;
  gap: 8px;
  align-items: flex-end;
}

.input-row :deep(.ant-input) {
  flex: 1;
  resize: none;
  border-radius: 8px;
}

.send-btn {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--primary-color, #3b82f6);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.send-btn:hover:not(:disabled) {
  background: var(--primary-hover, #2563eb);
}

.send-btn:disabled {
  background: var(--disabled-bg, #e5e7eb);
  color: var(--disabled-color, #9ca3af);
  cursor: not-allowed;
}

.input-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
}

.clear-btn {
  padding: 4px 10px;
  font-size: 12px;
  background: transparent;
  color: var(--clear-color, #6b7280);
  border: 1px solid var(--clear-border, #e5e7eb);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.clear-btn:hover:not(:disabled) {
  background: var(--clear-hover-bg, #f3f4f6);
}

.clear-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Dark mode support */
:global(.dark) .ai-agent-container {
  --bg-color: #1f2937;
  --header-bg: #111827;
  --border-color: #374151;
  --hover-bg: #374151;
  --panel-bg: #111827;
  --text-secondary: #9ca3af;
  --text-tertiary: #6b7280;
  --status-bg: #1e3a5f;
  --status-border: #2563eb;
  --status-text: #93c5fd;
  --spinner-bg: #1e40af;
  --spinner-color: #93c5fd;
  --stop-bg: #7f1d1d;
  --stop-text: #fca5a5;
  --stop-border: #991b1b;
  --message-bg: #374151;
  --current-bg: #1e3a5f;
  --current-border: #2563eb;
  --error-bg: #7f1d1d;
  --error-border: #991b1b;
  --action-bg: #14532d;
  --action-border: #166534;
  --label-color: #9ca3af;
  --action-type-color: #4ade80;
  --params-color: #9ca3af;
  --screenshot-border: #374151;
  --empty-color: #6b7280;
  --empty-title-color: #9ca3af;
  --input-area-bg: #1f2937;
  --disabled-bg: #374151;
  --disabled-color: #6b7280;
  --clear-color: #9ca3af;
  --clear-border: #374151;
  --clear-hover-bg: #374151;
  --warning-bg: #422006;
  --warning-border: #854d0e;
}
</style>
