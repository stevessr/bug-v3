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
    ['视频转 gif(iframe)', '🎞️', 'https://s.pwsh.us.kg/', 'emoji-extension-video2gif-iframe']
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
  enableExperimentalFeatures: false, // 默认关闭试验性特性
  enableChatMultiReactor: false, // 默认禁用聊天多表情反应功能
  chatMultiReactorEmojis: [], // 默认空数组，使用模块内置的默认表情列表
  geminiApiUrl: '', // Default empty (uses official API)
  geminiLanguage: 'Chinese', // 默认 AI 命名语言
  md3ColorScheme: 'default', // 默认 MD3 配色方案
  md3SeedColor: '#1890ff', // 默认 MD3 种子色
  // Default: keep legacy conservative behavior for backward compatibility
  // (set to true if you prefer selected variant to always override displayUrl)
  syncVariantToDisplayUrl: true,
  imageCacheStrategy: 'auto', // 图片缓存策略：auto/force-indexeddb/force-source/adaptive
  uploadMenuItems: DEFAULT_UPLOAD_MENU_ITEMS,
  cloudMarketDomain: 's.pwsh.us.kg', // 云端市场默认域名
  enableLinuxDoSeeking: false, // 默认禁用 LinuxDo 追觅功能
  linuxDoSeekingUsers: [], // 默认空监控列表
  enableLinuxDoSeekingDanmaku: true, // 默认启用弹幕通知
  enableLinuxDoSeekingSysNotify: true, // 默认启用系统通知
  enableLinuxDoSeekingNtfy: false, // 默认禁用 ntfy 推送
  linuxDoSeekingNtfyTopic: '', // 默认空主题
  linuxDoSeekingNtfyServer: 'https://ntfy.sh', // 默认 ntfy 公共服务
  linuxDoSeekingRefreshIntervalMs: 60000, // 默认 60 秒轮询
  linuxDoSeekingPosition: 'left', // 默认左侧吸附
  linuxDoSeekingActionFilter: '1,5', // 默认互动 + 回复
  telegramWebmToAvifEnabled: false,
  telegramWebmToAvifBackend: '',
  telegramLocalAvifEnabled: false,
  // Discourse 路由刷新功能
  enableDiscourseRouterRefresh: false, // 默认禁用周期性路由刷新
  discourseRouterRefreshInterval: 30000, // 默认 30 秒刷新一次
  // LinuxDo Credit 积分显示
  enableLinuxDoCredit: false, // 默认禁用 LinuxDo Credit 积分浮窗
  // LinuxDo 点赞计数器
  enableLinuxDoLikeCounter: false, // 默认禁用 LinuxDo 点赞计数器
  // 计划任务：定时点赞功能（试验性功能）
  enableScheduledLikes: false, // 默认禁用计划任务点赞
  scheduledLikeTasks: [], // 默认空任务列表
  // 计划任务：自动浏览功能（试验性功能）
  enableScheduledBrowse: false, // 默认禁用自动浏览
  scheduledBrowseTasks: [] // 默认空任务列表
}
