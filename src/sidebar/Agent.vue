<script setup lang="ts">
import { computed, ref } from 'vue'
import { nanoid } from 'nanoid'

import { useAgentSettings } from '@/agent/useAgentSettings'
import { runAgentMessage } from '@/agent/agentService'
import { executeAgentActions } from '@/agent/executeActions'
import type { AgentAction, AgentActionResult, AgentMessage } from '@/agent/types'

const { settings, activeSubagent, setActiveSubagent } = useAgentSettings()

const inputValue = ref('')
const isSending = ref(false)
const messages = ref<AgentMessage[]>([])
const pendingActions = ref<AgentAction[]>([])
const actionResults = ref<Record<string, AgentActionResult>>({})

const hasConnection = computed(() => {
  return Boolean(settings.value.baseUrl && settings.value.apiKey)
})

const enabledSubagents = computed(() => {
  const list = settings.value.subagents.filter(agent => agent.enabled)
  return list.length > 0 ? list : settings.value.subagents
})

const activePermissions = computed(() => {
  const agent = activeSubagent.value
  if (!agent) return []
  const labels: Array<{ key: keyof typeof agent.permissions; label: string }> = [
    { key: 'click', label: '点击' },
    { key: 'scroll', label: '滑动' },
    { key: 'touch', label: '触摸' },
    { key: 'screenshot', label: '截图' },
    { key: 'navigate', label: '切换 URL' },
    { key: 'clickDom', label: '点击 DOM' },
    { key: 'input', label: '输入' }
  ]
  return labels.filter(item => agent.permissions[item.key])
})

const mcpSummary = computed(() => {
  if (!settings.value.enableMcp) return '未启用 MCP'
  const scope = activeSubagent.value?.mcpServerIds
  const enabled = settings.value.mcpServers.filter(server => {
    if (!server.enabled) return false
    if (scope && scope.length > 0) return scope.includes(server.id)
    return true
  })
  return enabled.length > 0 ? `MCP ${enabled.length} 个` : 'MCP 未配置'
})

const openAgentSettings = () => {
  if (!chrome?.runtime?.getURL || !chrome?.tabs?.create) return
  const url = chrome.runtime.getURL('index.html?type=options&tabs=settings&subtab=ai-agent')
  chrome.tabs.create({ url })
}

const appendMessage = (message: AgentMessage) => {
  messages.value.push(message)
}

const runActions = async () => {
  if (!activeSubagent.value || pendingActions.value.length === 0) return
  const results = await executeAgentActions(pendingActions.value, activeSubagent.value.permissions)
  for (const result of results) {
    actionResults.value[result.id] = result
  }
}

const sendMessage = async () => {
  const content = inputValue.value.trim()
  if (!content || isSending.value) return

  const userMessage: AgentMessage = {
    id: nanoid(),
    role: 'user',
    content
  }
  appendMessage(userMessage)
  inputValue.value = ''
  isSending.value = true

  const result = await runAgentMessage(content, settings.value, activeSubagent.value)
  if (result.error) {
    appendMessage({
      id: nanoid(),
      role: 'assistant',
      content: result.error,
      error: result.error
    })
    isSending.value = false
    return
  }

  if (result.message) {
    appendMessage(result.message)
  }

  pendingActions.value = result.actions || []
  actionResults.value = {}
  isSending.value = false
}

const clearMessages = () => {
  messages.value = []
  pendingActions.value = []
  actionResults.value = {}
}
</script>

<template>
  <div class="agent-shell">
    <div class="agent-header">
      <div class="flex items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <div class="agent-avatar">C</div>
          <div>
            <div class="text-sm font-semibold text-gray-900 dark:text-white">Claude Task Agent</div>
            <div class="text-[11px] text-gray-400">
              {{ hasConnection ? '已连接' : '未连接' }} · {{ mcpSummary }}
            </div>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <a-button size="small" @click="clearMessages">清空</a-button>
          <a-button size="small" @click="openAgentSettings">设置</a-button>
        </div>
      </div>
      <div class="agent-config">
        <div class="flex items-center gap-2">
          <span class="text-[11px] text-gray-500 dark:text-gray-400">Subagent</span>
          <a-select
            v-model:value="settings.defaultSubagentId"
            :options="enabledSubagents.map(a => ({ label: a.name, value: a.id }))"
            class="w-44"
            @change="value => setActiveSubagent(String(value))"
          />
        </div>
        <div class="text-[11px] text-gray-500 dark:text-gray-400">
          任务模型：{{ activeSubagent?.taskModel || settings.taskModel }}
        </div>
      </div>
      <div class="agent-tags">
        <span
          v-for="item in activePermissions"
          :key="item.key"
          class="agent-tag"
        >
          {{ item.label }}
        </span>
      </div>
    </div>

    <div class="agent-body">
      <div v-if="messages.length === 0" class="agent-empty">
        <div class="agent-empty-title">Claude 已准备好</div>
        <div class="agent-empty-sub">
          描述你要自动化的任务，例如“打开当前页面的登录按钮并填写账号信息”。
        </div>
        <div class="agent-suggestion-row">
          <button class="agent-suggestion" @click="inputValue = '总结当前页面重点'">
            总结页面
          </button>
          <button class="agent-suggestion" @click="inputValue = '定位页面中的搜索框并输入关键词'">
            定位搜索框
          </button>
          <button class="agent-suggestion" @click="inputValue = '自动滚动并提取主要列表'">
            提取列表
          </button>
        </div>
      </div>

      <div v-for="message in messages" :key="message.id" class="agent-message">
        <div class="agent-message-role" :data-role="message.role">
          {{ message.role === 'user' ? '你' : 'Claude' }}
        </div>
        <div
          class="agent-message-bubble"
          :class="message.role === 'user' ? 'agent-user' : 'agent-assistant'"
        >
          {{ message.content }}
          <div v-if="message.actions && message.actions.length" class="agent-action-hint">
            返回 {{ message.actions.length }} 个动作待执行
          </div>
        </div>
      </div>

      <div v-if="pendingActions.length" class="agent-actions">
        <div class="agent-actions-header">
          <div class="text-xs text-gray-500 dark:text-gray-400">待执行动作</div>
          <a-button size="small" @click="runActions">执行全部</a-button>
        </div>
        <div class="agent-actions-list">
          <div v-for="action in pendingActions" :key="action.id" class="agent-action-item">
            <div class="agent-action-text">
              <span class="agent-action-type">{{ action.type }}</span>
              <span class="text-gray-500">{{ action.note || '自动化操作' }}</span>
            </div>
            <span
              :class="
                actionResults[action.id]?.success
                  ? 'text-green-500'
                  : actionResults[action.id]?.error
                    ? 'text-red-500'
                    : 'text-gray-400'
              "
              class="text-xs"
            >
              {{
                actionResults[action.id]?.success
                  ? '已完成'
                  : actionResults[action.id]?.error
                    ? actionResults[action.id]?.error
                    : '待执行'
              }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <div class="agent-input">
      <div class="agent-input-inner">
        <a-textarea
          v-model:value="inputValue"
          :auto-size="{ minRows: 1, maxRows: 4 }"
          placeholder="描述任务，支持多步指令..."
          class="agent-textarea"
          @pressEnter="sendMessage"
        />
        <a-button type="primary" :loading="isSending" @click="sendMessage">发送</a-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.agent-shell {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: linear-gradient(180deg, rgba(248, 250, 252, 0.9) 0%, #ffffff 60%);
  font-family: 'IBM Plex Sans', 'Segoe UI', sans-serif;
}

.agent-header {
  padding: 12px 14px 10px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.2);
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(8px);
}

.agent-avatar {
  width: 36px;
  height: 36px;
  border-radius: 12px;
  background: #111827;
  color: #f8fafc;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
}

.agent-config {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 10px;
}

.agent-tags {
  margin-top: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.agent-tag {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.06);
  color: #475569;
}

.agent-body {
  flex: 1 1 auto;
  overflow: auto;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.agent-empty {
  border: 1px dashed rgba(148, 163, 184, 0.5);
  border-radius: 16px;
  padding: 16px;
  background: rgba(248, 250, 252, 0.6);
}

.agent-empty-title {
  font-size: 14px;
  font-weight: 600;
  color: #0f172a;
}

.agent-empty-sub {
  margin-top: 6px;
  font-size: 12px;
  color: #64748b;
}

.agent-suggestion-row {
  margin-top: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.agent-suggestion {
  border: 1px solid rgba(148, 163, 184, 0.4);
  background: white;
  font-size: 12px;
  padding: 6px 10px;
  border-radius: 999px;
  color: #0f172a;
  cursor: pointer;
}

.agent-message {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.agent-message-role {
  font-size: 11px;
  color: #94a3b8;
}

.agent-message-role[data-role='user'] {
  align-self: flex-end;
}

.agent-message-bubble {
  max-width: 90%;
  padding: 10px 12px;
  border-radius: 14px;
  font-size: 13px;
  line-height: 1.5;
}

.agent-user {
  align-self: flex-end;
  background: #0f172a;
  color: #f8fafc;
  border-bottom-right-radius: 4px;
}

.agent-assistant {
  background: #f1f5f9;
  color: #0f172a;
  border-bottom-left-radius: 4px;
}

.agent-action-hint {
  margin-top: 6px;
  font-size: 11px;
  color: #64748b;
}

.agent-actions {
  border: 1px solid rgba(148, 163, 184, 0.35);
  border-radius: 14px;
  padding: 12px;
  background: white;
}

.agent-actions-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.agent-actions-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.agent-action-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
}

.agent-action-text {
  display: flex;
  gap: 6px;
  align-items: center;
}

.agent-action-type {
  font-weight: 600;
  color: #0f172a;
}

.agent-input {
  border-top: 1px solid rgba(148, 163, 184, 0.2);
  padding: 12px;
  background: rgba(248, 250, 252, 0.9);
}

.agent-input-inner {
  display: flex;
  gap: 8px;
}

.agent-textarea :deep(textarea) {
  border-radius: 12px;
  font-size: 13px;
}

@media (prefers-color-scheme: dark) {
  .agent-shell {
    background: linear-gradient(180deg, rgba(15, 23, 42, 0.92) 0%, #0b1120 60%);
  }
  .agent-header {
    background: rgba(15, 23, 42, 0.9);
    border-bottom-color: rgba(51, 65, 85, 0.5);
  }
  .agent-tag {
    background: rgba(148, 163, 184, 0.18);
    color: #cbd5f5;
  }
  .agent-empty {
    background: rgba(15, 23, 42, 0.5);
  }
  .agent-empty-title {
    color: #f8fafc;
  }
  .agent-empty-sub {
    color: #94a3b8;
  }
  .agent-suggestion {
    background: rgba(15, 23, 42, 0.6);
    color: #e2e8f0;
    border-color: rgba(148, 163, 184, 0.3);
  }
  .agent-assistant {
    background: rgba(30, 41, 59, 0.7);
    color: #e2e8f0;
  }
  .agent-actions {
    background: rgba(15, 23, 42, 0.8);
    border-color: rgba(51, 65, 85, 0.6);
  }
  .agent-input {
    background: rgba(15, 23, 42, 0.9);
    border-top-color: rgba(51, 65, 85, 0.5);
  }
}
</style>
