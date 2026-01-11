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

const enabledSubagents = computed(() => {
  const list = settings.value.subagents.filter(agent => agent.enabled)
  return list.length > 0 ? list : settings.value.subagents
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
</script>

<template>
  <div class="flex flex-col h-full">
    <div class="p-3 border-b border-gray-100 dark:border-gray-700">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="text-xs text-gray-500 dark:text-gray-400">Subagent</span>
          <a-select
            v-model:value="settings.defaultSubagentId"
            :options="enabledSubagents.map(a => ({ label: a.name, value: a.id }))"
            class="w-40"
            @change="value => setActiveSubagent(String(value))"
          />
        </div>
        <a-button size="small" @click="openAgentSettings">设置</a-button>
      </div>
      <div class="mt-2 text-xs text-gray-500 dark:text-gray-400">
        任务模型：{{ activeSubagent?.taskModel || settings.taskModel }}
      </div>
    </div>

    <div class="flex-1 overflow-auto p-3 space-y-3">
      <div v-if="messages.length === 0" class="text-sm text-gray-500 dark:text-gray-400">
        先描述你要自动化的任务，例如“打开当前页面的登录按钮并填写账号信息”。
      </div>
      <div
        v-for="message in messages"
        :key="message.id"
        class="rounded-lg px-3 py-2 text-sm"
        :class="
          message.role === 'user'
            ? 'bg-gray-900 text-white ml-auto'
            : 'bg-gray-100 dark:bg-gray-800 dark:text-gray-100'
        "
      >
        {{ message.content }}
        <div v-if="message.actions && message.actions.length" class="mt-2 text-xs text-gray-500">
          返回 {{ message.actions.length }} 个动作待执行
        </div>
      </div>

      <div v-if="pendingActions.length" class="border border-dashed border-gray-300 rounded-lg p-3">
        <div class="flex items-center justify-between mb-2">
          <div class="text-xs text-gray-500 dark:text-gray-400">待执行动作</div>
          <a-button size="small" @click="runActions">执行动作</a-button>
        </div>
        <div class="space-y-2">
          <div
            v-for="action in pendingActions"
            :key="action.id"
            class="text-xs flex items-center justify-between"
          >
            <span>{{ action.type }} {{ action.note || '' }}</span>
            <span
              :class="
                actionResults[action.id]?.success
                  ? 'text-green-500'
                  : actionResults[action.id]?.error
                    ? 'text-red-500'
                    : 'text-gray-400'
              "
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

    <div class="p-3 border-t border-gray-100 dark:border-gray-700">
      <div class="flex items-center gap-2">
        <a-input
          v-model:value="inputValue"
          placeholder="输入任务指令..."
          @pressEnter="sendMessage"
        />
        <a-button type="primary" :loading="isSending" @click="sendMessage">发送</a-button>
      </div>
    </div>
  </div>
</template>
