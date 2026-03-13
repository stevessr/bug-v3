import type { AgentUsage } from './agentUsage'
import type { AgentToolPayload } from './agentPayload'

export interface AgentStreamUpdate {
  message?: string
  thoughts?: string[]
  steps?: string[]
  actions?: AgentToolPayload['actions']
  parallelActions?: boolean
}

export interface AgentStreamResult {
  rawText: string
  parsed: AgentToolPayload | null
  toolUseId?: string
  toolInput?: AgentToolPayload
  toolUseIds: string[]
  toolInputs: AgentToolPayload[]
  usage: AgentUsage
}
