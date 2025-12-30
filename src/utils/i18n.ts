/**
 * i18n 国际化工具函数
 * 使用 Chrome Extension API 的 chrome.i18n
 */
import { ref, onMounted, onUnmounted } from 'vue'

// 本地翻译数据缓存
let localTranslations: Record<string, Record<string, string>> = {}
let currentLanguage = 'zh_CN'

/**
 * 加载指定语言的翻译文件
 * @param language 语言代码
 */
async function loadTranslations(language: string): Promise<void> {
  if (localTranslations[language]) return

  try {
    const response = await fetch(`/_locales/${language}/messages.json`)
    const data = await response.json()
    localTranslations[language] = data
  } catch (error) {
    console.warn(`Failed to load translations for ${language}:`, error)
  }
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
  if (Array.isArray(substitutions) || typeof substitutions === 'string') {
    return chrome.i18n.getMessage(messageName, substitutions) || messageName
  } else {
    // Chrome i18n API 不支持对象格式，直接返回消息名
    return messageName
  }
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
 * 初始化 i18n 系统
 */
export async function initI18n(): Promise<void> {
  // 从 localStorage 获取保存的语言设置
  const savedLanguage = localStorage.getItem('emoji-extension-language')
  if (savedLanguage) {
    currentLanguage = savedLanguage
  } else {
    // 使用浏览器语言
    const browserLocale = getUILanguage()
    if (browserLocale.startsWith('zh') || browserLocale.startsWith('cn')) {
      currentLanguage = 'zh_CN'
    } else {
      currentLanguage = 'en'
    }
  }

  await loadTranslations(currentLanguage)
  // 标记 i18n 已就绪
  isReady.value = true
}

// 响应式的 i18n 就绪状态
const isReady = ref(false)

/**
 * Vue 组合式函数 - 使用 i18n
 * @returns i18n 相关函数
 */
export function useI18n() {
  // 创建响应式的语言状态
  const language = ref(currentLanguage)

  // 监听语言变化事件
  const updateLanguage = (event: CustomEvent) => {
    currentLanguage = event.detail
    language.value = event.detail
  }

  // 在组件挂载时添加事件监听器
  onMounted(() => {
    window.addEventListener('languageChanged', updateLanguage as EventListener)
  })

  // 在组件卸载时移除事件监听器
  onUnmounted(() => {
    window.removeEventListener('languageChanged', updateLanguage as EventListener)
  })

  return {
    t: getMessage,
    locale: () => language.value,
    isChinese: () => language.value.startsWith('zh'),
    format: formatMessage,
    setLanguage,
    initI18n,
    isReady
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
