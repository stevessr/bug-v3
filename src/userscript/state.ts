import type { UserscriptStorage } from './userscript-storage'
import { DEFAULT_USER_SETTINGS } from './userscript-storage'

export const userscriptState: UserscriptStorage = {
  emojiGroups: [],
  settings: { ...DEFAULT_USER_SETTINGS },
  emojiUsageStats: {}
}
