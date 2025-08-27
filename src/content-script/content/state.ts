// State management for cached emoji data
import type { ContentState } from './types'

export const cachedState: ContentState = {
  emojiGroups: [],
  settings: {
    imageScale: 30,
    defaultEmojiGroupUUID: 'default-uuid',
    gridColumns: 4,
    outputFormat: 'markdown',
    MobileMode: false,
    sidebarCollapsed: false,
    lastModified: new Date()
  },
  ungroupedEmojis: []
}