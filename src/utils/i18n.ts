/**
 * i18n 国际化工具函数
 * 使用 Chrome Extension API 的 chrome.i18n
 */
// 本地翻译数据缓存
const localTranslations: Record<string, Record<string, { message: string }>> = {}
const pendingTranslationLoads = new Map<string, Promise<void>>()
let currentLanguage = 'zh_CN'

const getChromeI18n = () => {
  const chromeAPI = (globalThis as any)?.chrome
  return chromeAPI?.i18n || null
}

const getNavigatorLanguage = () => {
  if (typeof navigator !== 'undefined') {
    return navigator.language || (navigator as any).userLanguage || ''
  }
  return ''
}

/**
 * 加载指定语言的翻译文件
 * @param language 语言代码
 */
async function loadTranslations(language: string): Promise<void> {
  if (localTranslations[language]) return
  const pendingLoad = pendingTranslationLoads.get(language)
  if (pendingLoad) return pendingLoad

  const load = (async () => {
    try {
      const response = await fetch(`/_locales/${language}/messages.json`)
      const data = await response.json()
      localTranslations[language] = data
    } catch (error) {
      console.warn(`Failed to load translations for ${language}:`, error)
    } finally {
      pendingTranslationLoads.delete(language)
    }
  })()

  pendingTranslationLoads.set(language, load)
  return load
}

/**
 * 获取本地化消息
 * @param messageName 消息名称
 * @param substitutions 替换参数
 * @returns 本地化后的字符串
 */
export function getMessage(
  messageName: string,
  substitutions?: string | string[] | Record<string, any>
): string {
  // 优先使用本地翻译
  if (localTranslations[currentLanguage] && localTranslations[currentLanguage][messageName]) {
    let message = localTranslations[currentLanguage][messageName].message
    if (substitutions) {
      if (typeof substitutions === 'string') {
        substitutions = [substitutions]
      } else if (Array.isArray(substitutions)) {
        // 处理数组格式 (Chrome i18n 格式)
        substitutions.forEach((substitution, index) => {
          message = message.replace(`$${index + 1}`, substitution)
        })
      } else {
        // 处理对象格式 ({key: value})
        Object.entries(substitutions).forEach(([key, value]) => {
          message = message.replace(`{${key}}`, String(value))
        })
      }
    }
    return message
  }

  // 回退到 Chrome i18n API
  const chromeI18n = getChromeI18n()
  if (chromeI18n && (Array.isArray(substitutions) || typeof substitutions === 'string')) {
    return chromeI18n.getMessage(messageName, substitutions) || messageName
  }
  // Chrome i18n API 不支持对象格式，直接返回消息名
  return messageName
}

/**
 * 获取当前语言环境
 * @returns 当前语言环境代码
 */
export function getUILanguage(): string {
  const chromeI18n = getChromeI18n()
  if (chromeI18n?.getUILanguage) return chromeI18n.getUILanguage()
  return getNavigatorLanguage()
}

/**
 * 检查是否为中文环境
 * @returns 是否为中文环境
 */
export function isChineseLocale(): boolean {
  const locale = getUILanguage()
  return locale.startsWith('zh') || locale.startsWith('cn')
}

/**
 * 获取本地化消息并替换参数
 * @param template 模板字符串，使用 {param} 格式
 * @param params 参数对象
 * @returns 替换后的字符串
 */
export function formatMessage(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    return params[key]?.toString() || match
  })
}

/**
 * 设置当前语言
 * @param language 语言代码
 */
export async function setLanguage(language: string): Promise<void> {
  currentLanguage = language
  await loadTranslations(language)
}

/**
 * 获取当前语言
 * @returns 当前语言代码
 */
export function getCurrentLanguage(): string {
  return currentLanguage
}

/**
 * 常用消息的快捷访问
 */
export const commonMessages = {
  emojiManagement: () => getMessage('emojiManagement'),
  settings: () => getMessage('settings'),
  favorites: () => getMessage('favorites'),
  confirm: () => getMessage('confirm'),
  cancel: () => getMessage('cancel'),
  close: () => getMessage('close'),
  save: () => getMessage('save'),
  edit: () => getMessage('edit'),
  remove: () => getMessage('remove'),
  delete: () => getMessage('delete'),
  refresh: () => getMessage('refresh'),
  search: () => getMessage('search'),
  loading: () => getMessage('loading'),
  noEmojis: () => getMessage('noEmojis'),
  linkCopiedToClipboard: () => getMessage('linkCopiedToClipboard')
} as const
