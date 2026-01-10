import type { AppSettings } from './type'
// Central default for uploadMenuItems used by content scripts and options
export const DEFAULT_UPLOAD_MENU_ITEMS = {
  autoItems: [
    // ['AI 生成图片', '🎨', 'https://gemini-image.smnet.studio/'],
    ['学习 xv6', '🖥︎', 'https://pwsh.edu.deal/'],
    ['connect', '🔗', 'https://connect.linux.do/'],
    ['idcalre', '📅', 'https://idcflare.com/']
  ] as Array<[string, string, string]>,
  iframes: [
    ['过盾', '🛡', 'https://linux.do/challenge', 'emoji-extension-passwall-iframe']
  ] as Array<[string, string, string, string]>,
  sides: [
    [
      '视频转 gif(iframe)',
      '🎞️',
      'https://s.pwsh.us.kg/',
      'emoji-extension-video2gif-iframe'
    ]
  ] as Array<[string, string, string, string]>
}

export const defaultSettings: AppSettings = {
  imageScale: 100,
  defaultGroup: 'nachoneko',
  showSearchBar: true,
  gridColumns: 4,
  outputFormat: 'markdown', // 默认使用 markdown 格式
  forceMobileMode: false, // 默认不强制移动模式
  enableHoverPreview: true, // 默认启用悬浮预览
  enableXcomExtraSelectors: false, // 默认不启用 X.com 额外选择器
  enableCalloutSuggestions: true, // 默认启用 callout suggestions
  enableBatchParseImages: true, // 默认启用一键解析图片按钮
  enableChatMultiReactor: false, // 默认禁用聊天多表情反应功能
  chatMultiReactorEmojis: [], // 默认空数组，使用模块内置的默认表情列表
  geminiApiUrl: '', // Default empty (uses official API)
  geminiLanguage: 'Chinese', // 默认 AI 命名语言
  customColorScheme: 'default', // 默认配色方案
  customPrimaryColor: '#1890ff', // 默认主色（Ant Design 蓝色）
  // Default: keep legacy conservative behavior for backward compatibility
  // (set to true if you prefer selected variant to always override displayUrl)
  syncVariantToDisplayUrl: true,
  useIndexedDBForImages: false,
  enableContentImageCache: false, // 默认禁用前端图片缓存（试验性功能）
  uploadMenuItems: DEFAULT_UPLOAD_MENU_ITEMS,
  cloudMarketDomain: 's.pwsh.us.kg', // 云端市场默认域名
  enableLinuxDoSeeking: false, // 默认禁用 LinuxDo 追觅功能
  linuxDoSeekingUsers: [], // 默认空监控列表
  enableLinuxDoSeekingDanmaku: true, // 默认启用弹幕通知
  enableLinuxDoSeekingSysNotify: true, // 默认启用系统通知
  // Discourse 路由刷新功能
  enableDiscourseRouterRefresh: false, // 默认禁用周期性路由刷新
  discourseRouterRefreshInterval: 30000, // 默认 30 秒刷新一次
  // Claude AI Agent settings
  claudeApiKey: '', // Claude API Key
  claudeApiBaseUrl: 'https://api.anthropic.com', // Claude API Base URL
  claudeModel: 'claude-sonnet-4-20250514', // Claude model
  claudeImageModel: '', // Claude model for image description (empty = use main model)
  claudeMaxSteps: 30, // Maximum steps for AI Agent
  claudeMaxTokens: 8192, // Maximum tokens for AI response
  claudeMcpServers: [] // MCP server configurations
}
