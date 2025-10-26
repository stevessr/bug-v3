import { AppSettings } from '@/types/type'

// Shared mutable state for content scripts
export const cachedState: {
  emojiGroups: any[]
  settings: AppSettings
} = {
  emojiGroups: [],
  settings: {
    imageScale: 30,
    gridColumns: 4,
    outputFormat: 'markdown',
    forceMobileMode: false,
    defaultGroup: 'nachoneko',
    showSearchBar: true
  }
}
