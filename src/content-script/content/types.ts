// Import types from the main project
import type { emoji, EmojiGroup, Settings, UUID } from '../../data/type/main'

// Re-export the types for use in content-script
export type { emoji, EmojiGroup, Settings, UUID }

// Content script specific types
export interface ContentState {
  emojiGroups: EmojiGroup[]
  settings: Settings
  ungroupedEmojis: emoji[]
}

// Default settings matching the Settings interface
export const defaultSettings: Settings = {
  imageScale: 30,
  defaultEmojiGroupUUID: 'default-uuid',
  gridColumns: 4,
  outputFormat: 'markdown',
  MobileMode: false,
  sidebarCollapsed: false,
  lastModified: new Date(),
}

// Default emoji group structure
export const createDefaultEmojiGroup = (): EmojiGroup => ({
  icon: '😀',
  UUID: 'default-uuid' as UUID,
  displayName: '默认表情',
  emojis: [],
  order: 0,
})
