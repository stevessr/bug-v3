import { AppSettings } from '@/types/type'
import { defaultSettings } from '@/types/defaultSettings'

// Shared mutable state for content scripts
export const cachedState: {
  emojiGroups: any[]
  settings: AppSettings
} = {
  emojiGroups: [],
  settings: defaultSettings
}
