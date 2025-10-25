import type { AppSettings } from './type'

import { loadDefaultEmojiGroups } from '@/types/defaultEmojiGroups.loader'

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
      'https://video2gif-pages.pages.dev/',
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
  enableLinuxDoInjection: true, // 默认启用 linux.do 注入
  enableXcomExtraSelectors: false, // 默认不启用 X.com 额外选择器
  enableCalloutSuggestions: true, // 默认启用 callout suggestions
  enableBatchParseImages: true, // 默认启用一键解析图片按钮
  customColorScheme: 'default', // 默认配色方案
  customPrimaryColor: '#1890ff', // 默认主色（Ant Design 蓝色）
  customCss: '',
  // Default: keep legacy conservative behavior for backward compatibility
  // (set to true if you prefer selected variant to always override displayUrl)
  syncVariantToDisplayUrl: true,
  uploadMenuItems: DEFAULT_UPLOAD_MENU_ITEMS
}

// Runtime loader for default emoji groups
export { loadDefaultEmojiGroups }
