import type { UUID } from '../uuid/main'

interface emoji {
  id: string
  displayName: string
  realUrl: URL
  displayUrl: URL
  order: number
}

interface HotEmoji extends emoji {
  groupURL: string
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
