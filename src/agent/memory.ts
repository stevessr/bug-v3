const STORAGE_KEY = 'ai-agent-memory-v1'
const MAX_ENTRIES = 50

export type AgentMemory = Record<string, string>

export function loadMemory(): AgentMemory {
  if (typeof localStorage === 'undefined') return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return {}
    return parsed as AgentMemory
  } catch {
    return {}
  }
}

export function saveMemory(memory: AgentMemory): void {
  if (typeof localStorage === 'undefined') return
  const entries = Object.entries(memory)
  const trimmed = entries.slice(-MAX_ENTRIES)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(trimmed)))
}

export function updateMemory(update: { set?: Record<string, string>; remove?: string[] }) {
  const memory = loadMemory()
  if (update.set) {
    for (const [key, value] of Object.entries(update.set)) {
      if (!key) continue
      memory[key] = String(value)
    }
  }
  if (update.remove) {
    for (const key of update.remove) {
      delete memory[key]
    }
  }
  saveMemory(memory)
}

export function memoryToPrompt(): string {
  const memory = loadMemory()
  const entries = Object.entries(memory)
  if (entries.length === 0) return ''
  return `可读写记忆（JSON）：${JSON.stringify(memory)}`
}
