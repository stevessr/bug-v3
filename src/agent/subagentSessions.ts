import type { SubAgentConfig } from './types'

const STORAGE_KEY = 'ai-agent-subagent-sessions-v1'
const MAX_SESSIONS = 20

export type SubagentSessionItem = {
  id: string
  name?: string
  prompt: string
  status: 'pending' | 'completed' | 'failed'
  output?: string
  error?: string
}

export type SubagentSession = {
  id: string
  createdAt: string
  rootInput: string
  items: SubagentSessionItem[]
}

function loadSessions(): SubagentSession[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as SubagentSession[]) : []
  } catch {
    return []
  }
}

function saveSessions(sessions: SubagentSession[]) {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions.slice(0, MAX_SESSIONS)))
}

export function createSubagentSession(
  id: string,
  rootInput: string,
  calls: Array<{ id?: string; name?: string; prompt: string }>
) {
  const session: SubagentSession = {
    id,
    createdAt: new Date().toISOString(),
    rootInput,
    items: calls.map(call => ({
      id: call.id || '',
      name: call.name,
      prompt: call.prompt,
      status: 'pending'
    }))
  }
  const sessions = loadSessions()
  saveSessions([session, ...sessions])
}

export function updateSubagentSessionItem(
  sessionId: string,
  identifier: { id?: string; name?: string },
  result: { output?: string; error?: string }
) {
  const sessions = loadSessions()
  const session = sessions.find(item => item.id === sessionId)
  if (!session) return
  const target = session.items.find(item =>
    identifier.id ? item.id === identifier.id : identifier.name ? item.name === identifier.name : false
  )
  if (!target) return
  if (result.error) {
    target.status = 'failed'
    target.error = result.error
  } else {
    target.status = 'completed'
    target.output = result.output
  }
  saveSessions(sessions)
}

export function resolveSubagent(
  subagents: SubAgentConfig[],
  target: { id?: string; name?: string }
): SubAgentConfig | undefined {
  if (target.id) {
    return subagents.find(agent => agent.id === target.id && agent.enabled)
  }
  if (target.name) {
    return subagents.find(agent => agent.name === target.name && agent.enabled)
  }
  return undefined
}
