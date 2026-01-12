import { defaultAgentSettings } from './defaultSettings'
import type { AgentSettings } from './types'

const STORAGE_KEY = 'ai-agent-settings-v1'

export function loadAgentSettings(): AgentSettings {
  if (typeof localStorage === 'undefined') return { ...defaultAgentSettings }

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...defaultAgentSettings }
    const parsed = JSON.parse(raw) as AgentSettings
    return {
      ...defaultAgentSettings,
      ...parsed,
      mcpServers: parsed.mcpServers || [],
      subagents: parsed.subagents || defaultAgentSettings.subagents,
      maxTokens: parsed.maxTokens || defaultAgentSettings.maxTokens,
      masterSystemPrompt: parsed.masterSystemPrompt || defaultAgentSettings.masterSystemPrompt,
      enableThoughts:
        typeof parsed.enableThoughts === 'boolean'
          ? parsed.enableThoughts
          : defaultAgentSettings.enableThoughts
    }
  } catch {
    return { ...defaultAgentSettings }
  }
}

export function saveAgentSettings(settings: AgentSettings): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}

export function resetAgentSettings(): AgentSettings {
  const settings = { ...defaultAgentSettings }
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  }
  return settings
}
