export interface AppSettings {
  imageScale: number // 5 to 150
  defaultGroup: string
  showSearchBar: boolean
  gridColumns: number // 2 to 8
  outputFormat: 'markdown' | 'html' // 输出格式选择
  forceMobileMode?: boolean // 强制移动模式
  lastModified?: number // timestamp for sync comparison
  enableHoverPreview?: boolean // 控制在弹出式选择器中鼠标悬浮是否显示大图预览
  // New settings for X.com selectors
  enableXcomExtraSelectors?: boolean // 控制是否在 X.com 启用额外选择器
  enableCalloutSuggestions?: boolean // 在编辑器中启用 callout suggestions（'[' 触发）
  enableBatchParseImages?: boolean // 控制是否显示"一键解析并添加所有图片"按钮
  enableExperimentalFeatures?: boolean // 启用试验性特性开关（控制实验功能显示）
  enableChatMultiReactor?: boolean // 启用聊天多表情反应功能（在 Discourse 聊天消息旁添加批量发送表情按钮）
  chatMultiReactorEmojis?: string[] // 自定义聊天多表情反应的表情代码列表
  // Optional API key fields for third-party services
  geminiApiKey?: string
  imgbedToken?: string
  imgbedApiUrl?: string
  geminiApiUrl?: string
  geminiLanguage?: 'English' | 'Chinese'
  geminiModel?: string
  // Custom OpenAI provider settings
  useCustomOpenAI?: boolean
  customOpenAIEndpoint?: string
  customOpenAIKey?: string
  customOpenAIModel?: string
  aiConcurrency?: number // AI 请求并发数（1-10，默认 5）
  theme?: 'system' | 'light' | 'dark'
  // Custom theme colors
  customPrimaryColor?: string // 主题主色
  customColorScheme?: 'default' | 'blue' | 'green' | 'purple' | 'orange' | 'red' | 'custom'
  // Custom CSS injected into pages (managed in Options)
  customCssBlocks?: CustomCssBlock[] // Array of CSS blocks with toggle functionality
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
  highContrastMode?: boolean
  reduceMotion?: boolean
  useIndexedDBForImages?: boolean // 允许使用 IndexedDB 缓存图片显示（旧版开关，已被缓存策略替代）
  imageCacheStrategy?: 'auto' | 'force-indexeddb' | 'force-source' | 'adaptive' // 图片缓存策略
  enableContentImageCache?: boolean // 允许前端注入的 content script 使用本地缓存的图片显示
  enableSubmenuInjector?: boolean // 将功能按钮注入到 Discourse 下拉菜单中（试验性功能）
  cloudMarketDomain?: string // 云端市场域名配置（默认 s.pwsh.us.kg）
  enableLinuxDoSeeking?: boolean // 启用 LinuxDo 追觅功能（监控 linux.do 用户活动，显示侧边栏）
  linuxDoSeekingUsers?: string[] // LinuxDo 追觅功能的监控用户列表
  enableLinuxDoSeekingDanmaku?: boolean // 启用 LinuxDo 追觅弹幕通知
  enableLinuxDoSeekingSysNotify?: boolean // 启用 LinuxDo 追觅系统通知
  enableLinuxDoSeekingNtfy?: boolean // 启用 LinuxDo 追觅 ntfy 推送
  linuxDoSeekingNtfyTopic?: string // ntfy 主题
  linuxDoSeekingNtfyServer?: string // ntfy 服务器
  linuxDoSeekingRefreshIntervalMs?: number // 追觅轮询间隔（毫秒）
  linuxDoSeekingPosition?: 'left' | 'right' | 'top' | 'bottom' // 追觅侧边栏吸附位置
  linuxDoSeekingActionFilter?: '1' | '4' | '5' | '1,5' | '1,4,5' // 追觅动态过滤（1=互动，4=点赞，5=回复）
  // Discourse 路由刷新功能
  enableDiscourseRouterRefresh?: boolean // 启用 Discourse 周期性路由刷新
  discourseRouterRefreshInterval?: number // 刷新间隔（毫秒），默认 30000
  // Telegram WebM -> AVIF conversion backend
  telegramWebmToAvifEnabled?: boolean
  telegramWebmToAvifBackend?: string
  // LinuxDo Credit 积分显示
  enableLinuxDoCredit?: boolean // 启用 LinuxDo Credit 积分浮窗
  // LinuxDo 点赞计数器（试验性功能）
  enableLinuxDoLikeCounter?: boolean // 启用 LinuxDo 点赞计数器（显示当日剩余点赞次数）
  // 计划任务：定时点赞功能（试验性功能）
  enableScheduledLikes?: boolean // 启用计划任务点赞功能
  scheduledLikeTasks?: ScheduledLikeTask[] // 计划任务列表
  // 计划任务：自动浏览功能（试验性功能）
  enableScheduledBrowse?: boolean // 启用自动浏览功能
  scheduledBrowseTasks?: ScheduledBrowseTask[] // 自动浏览任务列表
}

export interface EmojiGroup {
  id: string
  name: string
  icon: string
  order: number
  emojis: Emoji[]
  detail?: string // Optional markdown-formatted detail description
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
  // Reference to another emoji (for deduplication)
  referenceId?: string // If set, this emoji references another emoji by ID
  perceptualHash?: string // Perceptual hash for similarity detection
  customOutput?: string // Custom string to insert/copy when clicking emoji (overrides markdown/html format)
  tags?: string[] // 标签数组（可选，为空时不存储）
}

export interface DefaultEmojiData {
  groups: EmojiGroup[]
  settings: AppSettings
}

// Custom CSS block interface
export interface CustomCssBlock {
  id: string
  name: string
  content: string
  enabled: boolean
  createdAt: number
  updatedAt: number
}

// Tag interface
export interface Tag {
  id: string
  name: string
  color?: string // 标签颜色
  createdAt: number
  usageCount?: number // 标签使用次数
}

// 计划任务：定时点赞任务
export interface ScheduledLikeTask {
  id: string
  username: string // 目标用户名
  baseUrl: string // Discourse 站点 URL (如 https://linux.do)
  enabled: boolean // 是否启用
  cronExpression?: string // Cron 表达式（预留，暂不使用）
  intervalMinutes: number // 执行间隔（分钟）
  maxLikesPerRun: number // 每次执行最多点赞数
  lastRunAt?: number // 上次执行时间戳
  nextRunAt?: number // 下次执行时间戳
  totalLikes: number // 累计点赞数
  createdAt: number
  updatedAt: number
}

// 浏览策略
export type BrowseStrategy = 'latest' | 'new' | 'unread' | 'top'

// 计划任务：自动浏览任务
export interface ScheduledBrowseTask {
  id: string
  name: string // 任务名称
  baseUrl: string // Discourse 站点 URL
  enabled: boolean
  intervalMinutes: number // 执行间隔（分钟）
  browseStrategy: BrowseStrategy // 浏览策略
  minTopicsPerRun: number // 每次最少浏览话题数
  maxTopicsPerRun: number // 每次最多浏览话题数
  minReadTime: number // 每个话题最小阅读时间（秒）
  maxReadTime: number // 每个话题最大阅读时间（秒）
  // 点赞设置
  enableRandomLike: boolean // 是否启用随机点赞
  likeChance: number // 点赞概率 0-100
  maxLikesPerRun: number // 每次执行最多点赞数
  // 延迟设置
  minDelayBetweenTopics: number // 话题间最小延迟（秒）
  maxDelayBetweenTopics: number // 话题间最大延迟（秒）
  // 统计
  lastRunAt?: number
  nextRunAt?: number
  totalTopicsRead: number // 累计浏览话题数
  totalLikes: number // 累计点赞数
  createdAt: number
  updatedAt: number
}
