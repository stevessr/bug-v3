import type { EmojiGroup } from '../emoji/emoji'
import type { UUID } from '../uuid/main'
import type { aiSetting } from '../ai/main'

interface Settings {
  imageScale: number
  defaultEmojiGroupUUID: UUID
  gridColumns: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11
  outputFormat: 'html' | 'markdown' | 'bbcode'
  MobileMode: boolean
  // whether the options sidebar is collapsed
  sidebarCollapsed?: boolean
  lastModified: Date
}

interface exportSettings {
  version: number
  exportDate: Date
  emojiGroups: EmojiGroup[]
  Settings: Settings
  aiSetting: aiSetting
}

export type { exportSettings, Settings }
