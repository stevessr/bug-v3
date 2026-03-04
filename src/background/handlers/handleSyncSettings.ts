import { getChromeAPI } from '../utils/main.ts'

import * as storage from '@/utils/simpleStorage'
import type { AppSettings } from '@/types/type'

const CONTENT_TAB_URL_PATTERNS = ['http://*/*', 'https://*/*']
const DISCOURSE_BASE_DOMAINS = ['linux.do', 'meta.discourse.org', 'idcflare.com']
const X_TAB_URL_PATTERNS = [
  '*://x.com/*',
  '*://*.x.com/*',
  '*://twitter.com/*',
  '*://*.twitter.com/*',
  '*://twimg.com/*',
  '*://*.twimg.com/*'
]

const GLOBAL_CONTENT_SYNC_SETTING_KEYS: Array<keyof AppSettings> = [
  'imageScale',
  'outputFormat',
  'forceMobileMode',
  'enableHoverPreview',
  'uploadMenuItems',
  'customCssBlocks'
]

const DISCOURSE_CONTENT_SYNC_SETTING_KEYS: Array<keyof AppSettings> = [
  'enableBatchParseImages',
  'enableCalloutSuggestions',
  'enableChatMultiReactor',
  'chatMultiReactorEmojis',
  'enableSubmenuInjector',
  'enableLinuxDoSeeking',
  'linuxDoSeekingUsers',
  'enableLinuxDoSeekingDanmaku',
  'enableLinuxDoSeekingSysNotify',
  'enableLinuxDoSeekingNtfy',
  'linuxDoSeekingNtfyTopic',
  'linuxDoSeekingNtfyServer',
  'linuxDoSeekingRefreshIntervalMs',
  'linuxDoSeekingPosition',
  'linuxDoSeekingActionFilter',
  'enableDiscourseRouterRefresh',
  'discourseRouterRefreshInterval',
  'enableLinuxDoCredit',
  'enableLinuxDoLikeCounter',
  'enableExperimentalFeatures'
]

const X_CONTENT_SYNC_SETTING_KEYS: Array<keyof AppSettings> = ['enableXcomExtraSelectors']

let cachedDiscourseTabUrlPatterns: string[] | null = null
let discoursePatternsCacheAt = 0
const DISCOURSE_PATTERNS_CACHE_TTL_MS = 60_000

function buildDomainUrlPatterns(domain: string): string[] {
  const normalized = String(domain || '')
    .trim()
    .toLowerCase()
  if (!normalized) return []

  return [`*://${normalized}/*`, `*://*.${normalized}/*`]
}

async function getDiscourseTabUrlPatterns(): Promise<string[]> {
  const now = Date.now()
  if (
    cachedDiscourseTabUrlPatterns &&
    now - discoursePatternsCacheAt < DISCOURSE_PATTERNS_CACHE_TTL_MS
  ) {
    return cachedDiscourseTabUrlPatterns
  }

  const patternSet = new Set<string>()

  DISCOURSE_BASE_DOMAINS.forEach(domain => {
    buildDomainUrlPatterns(domain).forEach(pattern => patternSet.add(pattern))
  })

  try {
    const domains = await storage.getDiscourseDomains()
    domains.forEach(entry => {
      buildDomainUrlPatterns(entry?.domain || '').forEach(pattern => patternSet.add(pattern))
    })
  } catch (error) {
    console.warn('[SyncSettings] Failed to load discourse domains for tab filtering:', error)
  }

  const patterns = Array.from(patternSet)
  cachedDiscourseTabUrlPatterns = patterns
  discoursePatternsCacheAt = now
  return patterns
}

async function resolveBroadcastPatterns(updates?: unknown): Promise<string[] | null> {
  if (!updates || typeof updates !== 'object') return CONTENT_TAB_URL_PATTERNS

  const keys = Object.keys(updates as Record<string, unknown>)
  if (keys.length === 0) return null

  const changedKeys = keys.map(key => key as keyof AppSettings)

  if (changedKeys.some(key => GLOBAL_CONTENT_SYNC_SETTING_KEYS.includes(key))) {
    return CONTENT_TAB_URL_PATTERNS
  }

  const patternSet = new Set<string>()

  if (changedKeys.some(key => DISCOURSE_CONTENT_SYNC_SETTING_KEYS.includes(key))) {
    const discoursePatterns = await getDiscourseTabUrlPatterns()
    discoursePatterns.forEach(pattern => patternSet.add(pattern))
  }

  if (changedKeys.some(key => X_CONTENT_SYNC_SETTING_KEYS.includes(key))) {
    X_TAB_URL_PATTERNS.forEach(pattern => patternSet.add(pattern))
  }

  return patternSet.size > 0 ? Array.from(patternSet) : null
}

export const handleSyncSettings = async (
  settings: any,
  _sendResponse: (_response: any) => void,
  updates?: any
) => {
  // mark callback as referenced
  void _sendResponse
  // no additional args expected here
  const chromeAPI = getChromeAPI()
  if (!chromeAPI || !chromeAPI.storage || !chromeAPI.tabs) {
    _sendResponse({ success: false, error: 'Chrome API not available' })
    return
  }

  try {
    // 保存为新的存储格式：{ data: {...}, timestamp: ... }
    const timestamp = Date.now()
    const appSettingsData = {
      data: { ...settings, lastModified: timestamp },
      timestamp: timestamp
    }

    await chromeAPI.storage.local.set({ appSettings: appSettingsData })

    // 仅当与 content script 相关的配置变更时才广播，且按域名范围过滤目标 tab
    const targetPatterns = await resolveBroadcastPatterns(updates)
    if (targetPatterns && targetPatterns.length > 0) {
      // 广播给可能注入 content script 的标签页，避免遍历所有标签页
      const tabs = await chromeAPI.tabs.query({ url: targetPatterns })
      const tabIds = tabs
        .map((tab: chrome.tabs.Tab) => tab.id)
        .filter((id: number | undefined): id is number => typeof id === 'number')

      if (tabIds.length > 0) {
        const payload: any = { type: 'SETTINGS_UPDATED' }
        if (updates) {
          payload.updates = updates
        }

        // 不阻塞响应，异步发送并吞掉单个 tab 的错误
        void Promise.allSettled(
          tabIds.map((tabId: number) => chromeAPI.tabs.sendMessage(tabId, payload))
        )
      }
    }

    _sendResponse({ success: true })
  } catch (error: any) {
    console.error('Failed to sync settings:', error)
    _sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
