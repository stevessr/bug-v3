export interface AppSettings {
  imageScale: number // 5 to 150
  defaultGroup: string
  showSearchBar: boolean
  gridColumns: number // 2 to 8
  outputFormat: 'markdown' | 'html' // 输出格式选择
  forceMobileMode?: boolean // 强制移动模式
  lastModified?: number // timestamp for sync comparison
  enableHoverPreview?: boolean // 控制在弹出式选择器中鼠标悬浮是否显示大图预览
  // New settings for linux.do injection and X.com selectors
  enableLinuxDoInjection?: boolean // 控制是否在 linux.do 注入脚本
  enableXcomExtraSelectors?: boolean // 控制是否在 X.com 启用额外选择器
  enableCalloutSuggestions?: boolean // 在编辑器中启用 callout suggestions（'[' 触发）
  enableBatchParseImages?: boolean // 控制是否显示“一键解析并添加所有图片”按钮
  // Optional API key fields for third-party services
  tenorApiKey?: string
  theme?: 'system' | 'light' | 'dark'
  // Custom theme colors
  customPrimaryColor?: string // 主题主色
  customColorScheme?: 'default' | 'blue' | 'green' | 'purple' | 'orange' | 'red' | 'custom'
  // Custom CSS injected into pages (managed in Options)
  customCss?: string
  // Optional UI config for content-script upload menu (auto items, iframe modals, side iframes)
  uploadMenuItems?: {
    autoItems?: Array<[string, string, string]>
    iframes?: Array<[string, string, string, string]>
    sides?: Array<[string, string, string, string]>
  }
  // When true, selecting a variant in the import dialog will always set the
  // parsed item's displayUrl to the selected variant URL. When false, the
  // displayUrl will only be populated if it was previously empty.
  syncVariantToDisplayUrl?: boolean
}

export interface EmojiGroup {
  id: string
  name: string
  icon: string
  order: number
  emojis: Emoji[]
}

export interface Emoji {
  id: string
  packet: number
  name: string
  url: string
  originUrl?: string // 原始来源链接（例如 Pixiv 原图 URL）
  displayUrl?: string // Optional display URL, different from output URL
  width?: number
  height?: number
  groupId: string
  // Favorites usage tracking fields
  usageCount?: number
  lastUsed?: number // timestamp
  addedAt?: number // timestamp when first added to favorites
}

export interface DefaultEmojiData {
  groups: EmojiGroup[]
  settings: AppSettings
}
