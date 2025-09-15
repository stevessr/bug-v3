import type { UserscriptStorage } from './userscript-storage'

export const userscriptState: UserscriptStorage = {
  emojiGroups: [],
  settings: {
    imageScale: 30,
    gridColumns: 4,
    outputFormat: 'markdown',
    forceMobileMode: false,
    defaultGroup: 'nachoneko',
    showSearchBar: true,
    enableFloatingPreview: true
  },
  emojiUsageStats: {}
}
