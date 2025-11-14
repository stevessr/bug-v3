import { AppSettings } from '@/types/type'

// Shared mutable state for content scripts
// Settings will be loaded from background, not from defaults
export const cachedState: {
  emojiGroups: any[]
  settings: AppSettings
} = {
  emojiGroups: [],
  settings: {} as AppSettings
}
