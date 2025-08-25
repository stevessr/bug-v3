import type { UUID } from '../uuid/main'

interface emoji {
  id: string
  displayName: string
  realUrl: URL
  displayUrl: URL
  order: number
  UUID: UUID
}

interface HotEmoji extends emoji {
  groupUUID: UUID
  usageCount: number
  lastUsed: number
}

interface UngroupedEmoji extends emoji {
  addedAt: number
}

interface EmojiGroup {
  icon: string | URL
  UUID: UUID
  displayName: string
  emojis: emoji[]
  order: number
}
export type { emoji, EmojiGroup, HotEmoji, UngroupedEmoji }
