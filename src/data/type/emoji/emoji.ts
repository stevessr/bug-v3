import type { UUID } from '../uuid/main'

interface emoji {
  id: string
  displayName: string
  realUrl: URL | string
  displayUrl: URL
  order: number
  UUID: UUID
  usageCount?: number
  lastUsed?: number
}

interface HotEmoji extends emoji {
  groupUUID: UUID
}

interface UngroupedEmoji extends emoji {
  addedAt: number
}

interface EmojiGroup {
  icon: string | URL
  UUID: UUID
  id?: string
  displayName: string
  emojis: emoji[]
  order: number
  originalId?: string
}
interface ungrouped {
  emojis: UngroupedEmoji[]
}
export type { emoji, EmojiGroup, HotEmoji, UngroupedEmoji, ungrouped }
