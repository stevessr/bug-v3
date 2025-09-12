interface AppSettings {
  imageScale: number
  gridColumns: number
  outputFormat: string
  forceMobileMode: boolean
  defaultGroup: string
  showSearchBar: boolean
}

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
