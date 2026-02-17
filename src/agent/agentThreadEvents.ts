import type { AgentThreadItem } from './agentThreadItems'
import type { AgentUsage } from './agentUsage'

export type ThreadStartedEvent = {
  type: 'thread.started'
  thread_id: string
}

export type TurnStartedEvent = {
  type: 'turn.started'
}

export type Usage = AgentUsage

export type TurnCompletedEvent = {
  type: 'turn.completed'
  usage: Usage
}

export type TurnFailedEvent = {
  type: 'turn.failed'
  error: {
    message: string
  }
}

export type ItemStartedEvent = {
  type: 'item.started'
  item: AgentThreadItem
}

export type ItemUpdatedEvent = {
  type: 'item.updated'
  item: AgentThreadItem
}

export type ItemCompletedEvent = {
  type: 'item.completed'
  item: AgentThreadItem
}

export type ErrorEvent = {
  type: 'error'
  message: string
}

export type AgentThreadEvent =
  | ThreadStartedEvent
  | TurnStartedEvent
  | TurnCompletedEvent
  | TurnFailedEvent
  | ItemStartedEvent
  | ItemUpdatedEvent
  | ItemCompletedEvent
  | ErrorEvent
