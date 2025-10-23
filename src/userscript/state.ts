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
    enableFloatingPreview: true,
    // 是否在 textarea 中启用 callout suggestions（当输入 '[' 时触发）
    enableCalloutSuggestions: true,
    // 控制是否注入“一键解析并添加所有图片”按钮
    enableBatchParseImages: true
  },
  emojiUsageStats: {}
}
