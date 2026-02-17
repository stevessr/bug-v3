import type { AgentAction } from './types'
import type { AgentToolPayload } from './agentPayload'

export type AgentMessageItem = {
  id: string
  type: 'agent_message'
  text: string
}

export type ReasoningItem = {
  id: string
  type: 'reasoning'
  text: string
}

export type TodoItem = {
  text: string
  completed: boolean
}

export type TodoListItem = {
  id: string
  type: 'todo_list'
  items: TodoItem[]
}

export type BrowserActionsItem = {
  id: string
  type: 'browser_actions'
  actions: AgentAction[]
  toolUseIds?: string[]
  toolInputs?: AgentToolPayload[]
  parallelActions?: boolean
}

export type ErrorItem = {
  id: string
  type: 'error'
  message: string
}

export type AgentThreadItem =
  | AgentMessageItem
  | ReasoningItem
  | TodoListItem
  | BrowserActionsItem
  | ErrorItem
