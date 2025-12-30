/**
 * i18n 国际化工具函数
 * 使用 Chrome Extension API 的 chrome.i18n
 */

/**
 * 获取本地化消息
 * @param messageName 消息名称
 * @param substitutions 替换参数
 * @returns 本地化后的字符串
 */
export function getMessage(messageName: string, substitutions?: string | string[]): string {
  return chrome.i18n.getMessage(messageName, substitutions) || messageName
}

/**
 * 获取当前语言环境
 * @returns 当前语言环境代码
 */
export function getUILanguage(): string {
  return chrome.i18n.getUILanguage()
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
 * Vue 组合式函数 - 使用 i18n
 * @returns i18n 相关函数
 */
export function useI18n() {
  return {
    t: getMessage,
    locale: getUILanguage,
    isChinese: isChineseLocale,
    format: formatMessage
  }
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
