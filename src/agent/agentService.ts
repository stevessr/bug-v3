import { nanoid } from 'nanoid'

import type { AgentAction, AgentMessage, AgentSettings, SubAgentConfig } from './types'

interface AgentRunResult {
  message?: AgentMessage
  actions?: AgentAction[]
  error?: string
}

const SDK_IMPORT_PATH = '@anthropic-ai/claude-agent-sdk'

async function loadSdkClient() {
  try {
    const mod: any = await import(SDK_IMPORT_PATH)
    return mod
  } catch (error) {
    console.warn('[AgentService] Failed to load Claude Agent SDK:', error)
    return null
  }
}

export async function runAgentMessage(
  input: string,
  settings: AgentSettings,
  subagent?: SubAgentConfig
): Promise<AgentRunResult> {
  if (!settings.apiKey || !settings.baseUrl) {
    return {
      error: '请先在设置中填写 Claude Agent 的 baseUrl 和 apiKey。'
    }
  }

  const sdk = await loadSdkClient()
  if (!sdk) {
    return {
      error: 'Claude Agent SDK 未加载，请确认依赖已安装。'
    }
  }

  // Placeholder integration: wire up SDK based on actual API surface.
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const client = sdk?.createClient?.({
    apiKey: settings.apiKey,
    baseUrl: settings.baseUrl
  })

  if (!client) {
    return {
      error: 'Claude Agent SDK 初始化失败。'
    }
  }

  const mcpServers = settings.enableMcp
    ? settings.mcpServers.filter(server => {
        if (!server.enabled) return false
        const scope = subagent?.mcpServerIds
        if (scope && scope.length > 0) return scope.includes(server.id)
        return true
      })
    : []

  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const response = await client.run({
      input,
      taskModel: subagent?.taskModel || settings.taskModel,
      reasoningModel: subagent?.reasoningModel || settings.reasoningModel,
      imageModel: subagent?.imageModel || settings.imageModel,
      systemPrompt: subagent?.systemPrompt || '',
      mcp: mcpServers,
      subagent
    })

    const message: AgentMessage = {
      id: nanoid(),
      role: 'assistant',
      content: response?.message || '',
      actions: response?.actions || []
    }

    return {
      message,
      actions: response?.actions || []
    }
  } catch (error: any) {
    return {
      error: error?.message || 'Claude Agent 请求失败。'
    }
  }
}
