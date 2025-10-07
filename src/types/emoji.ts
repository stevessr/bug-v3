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
  // Optional API key fields for third-party services
  tenorApiKey?: string
  theme?: 'system' | 'light' | 'dark'
  // Custom theme colors
  customPrimaryColor?: string // 主题主色
  customColorScheme?: 'default' | 'blue' | 'green' | 'purple' | 'orange' | 'red' | 'custom'
  // Custom CSS injected into pages (managed in Options)
  customCss?: string
  // When true, selecting a variant in the import dialog will always set the
  // parsed item's displayUrl to the selected variant URL. When false, the
  // displayUrl will only be populated if it was previously empty.
  syncVariantToDisplayUrl?: boolean
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface DefaultEmojiData {
  groups: EmojiGroup[]
  settings: AppSettings
}

// Emoji validation function
export function validateEmojiArray(data: any[]): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (!Array.isArray(data)) {
    return { valid: false, errors: ['数据必须是数组格式'] }
  }

  if (data.length === 0) {
    return { valid: false, errors: ['数组不能为空'] }
  }

  data.forEach((emoji, index) => {
    const prefix = `第${index + 1}个表情`

    // 检查必需字段
    if (!emoji.id || typeof emoji.id !== 'string') {
      errors.push(`${prefix}: id 字段必须是非空字符串`)
    }

    if (!emoji.name || typeof emoji.name !== 'string') {
      errors.push(`${prefix}: name 字段必须是非空字符串`)
    }

    if (!emoji.url || typeof emoji.url !== 'string') {
      errors.push(`${prefix}: url 字段必须是非空字符串`)
    } else if (!isValidUrl(emoji.url)) {
      errors.push(`${prefix}: url 格式无效`)
    }

    if (!emoji.groupId || typeof emoji.groupId !== 'string') {
      errors.push(`${prefix}: groupId 字段必须是非空字符串`)
    }

    // 检查 packet 字段
    if (emoji.packet !== undefined && (!Number.isInteger(emoji.packet) || emoji.packet < 0)) {
      errors.push(`${prefix}: packet 字段必须是非负整数`)
    }

    // 检查可选的 width 和 height 字段
    if (emoji.width !== undefined && (!Number.isInteger(emoji.width) || emoji.width <= 0)) {
      errors.push(`${prefix}: width 字段必须是正整数`)
    }

    if (emoji.height !== undefined && (!Number.isInteger(emoji.height) || emoji.height <= 0)) {
      errors.push(`${prefix}: height 字段必须是正整数`)
    }
  })

  return { valid: errors.length === 0, errors }
}

function isValidUrl(string: string): boolean {
  try {
    new URL(string)
    return true
  } catch {
    return false
  }
}

import { loadDefaultEmojiGroups } from '@/types/defaultEmojiGroups.loader'

const defaultSettings: AppSettings = {
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
  customColorScheme: 'default', // 默认配色方案
  customPrimaryColor: '#1890ff', // 默认主色（Ant Design 蓝色）
  customCss: '',
  // Default: keep legacy conservative behavior for backward compatibility
  // (set to true if you prefer selected variant to always override displayUrl)
  syncVariantToDisplayUrl: true
}
export { defaultSettings }

// Runtime loader for default emoji groups
export { loadDefaultEmojiGroups }
