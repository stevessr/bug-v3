import { requestSettingsBatch } from '../utils/core/requestSetting'
import { cachedState } from '../data/state'

import { scanForMagnificPopup, observeMagnificPopup } from './utils/magnific-popup'
import { isDiscoursePage } from './utils/page-detection'
import { setupDiscourseUploadHandler } from './utils/upload-handler'

let slashPickerInitialized = false
let slashPickerListenerAttached = false

async function maybeInitSlashEmojiPicker(enabled: boolean) {
  if (!enabled || slashPickerInitialized) return
  slashPickerInitialized = true
  try {
    const { initSlashEmojiPicker } = await import('./slash-emoji-picker')
    initSlashEmojiPicker()
  } catch (e) {
    slashPickerInitialized = false
    console.warn('[DiscourseOneClick] failed to initialize slash emoji picker', e)
  }
}

export async function initDiscourse() {
  try {
    if (!isDiscoursePage()) {
      console.log('[DiscourseOneClick] skipping init: not a Discourse page')
      return
    }

    scanForMagnificPopup()
    observeMagnificPopup()
    setupDiscourseUploadHandler()

    // 批量获取所有需要的设置（单次消息往返，替代 8+ 次顺序请求）
    const settings = await requestSettingsBatch([
      'enableSlashEmojiPicker',
      'enableBatchParseImages',
      'enableCalloutSuggestions',
      'enableColorSuggestions',
      'enableChatMultiReactor',
      'chatMultiReactorEmojis',
      'enableSubmenuInjector',
      'enableLinuxDoSeeking',
      'enableDiscourseRouterRefresh',
      'enableLinuxDoCredit',
      'enableExperimentalFeatures',
      'enableLinuxDoLikeCounter'
    ])

    if (settings.enableSlashEmojiPicker === true) {
      void maybeInitSlashEmojiPicker(true)
    } else if (!slashPickerListenerAttached) {
      slashPickerListenerAttached = true
      const onSettingsChanged = () => {
        if (cachedState.settings?.enableSlashEmojiPicker === true) {
          window.removeEventListener('emoji-extension-settings-changed', onSettingsChanged)
          void maybeInitSlashEmojiPicker(true)
        }
      }
      window.addEventListener('emoji-extension-settings-changed', onSettingsChanged)
    }

    // Batch parse images（默认启用）
    const enableBatchParseImages =
      typeof settings.enableBatchParseImages === 'boolean' ? settings.enableBatchParseImages : true
    if (enableBatchParseImages) {
      void import('./utils/cooked-content').then(
        ({ scanForCookedContent, observeCookedContent }) => {
          setTimeout(scanForCookedContent, 300)
          observeCookedContent()
        }
      )
    } else {
      console.log('[DiscourseOneClick] batch parse button disabled via settings')
    }

    // Callout suggestions（默认启用，只有明确设置为 false 时才禁用）
    if (settings.enableCalloutSuggestions !== false) {
      void import('./callout-suggestions').then(({ initCalloutSuggestions }) =>
        initCalloutSuggestions()
      )
    } else {
      console.log('[DiscourseOneClick] callout suggestions disabled by user setting')
    }

    // 颜色自动补全（默认启用，只有明确设置为 false 时才禁用）
    if (settings.enableColorSuggestions !== false) {
      void import('./color-suggestions').then(({ initColorSuggestions }) => initColorSuggestions())
    } else {
      console.log('[DiscourseOneClick] color suggestions disabled by user setting')
    }

    // 聊天多表情反应功能
    if (settings.enableChatMultiReactor === true) {
      const customEmojis = settings.chatMultiReactorEmojis
      void import('./utils/chat-multi-reactor').then(({ initChatMultiReactor }) => {
        initChatMultiReactor(Array.isArray(customEmojis) ? customEmojis : undefined)
        console.log('[DiscourseOneClick] chat multi-reactor enabled')
      })
    }

    // 子菜单注入（试验性功能）
    if (settings.enableSubmenuInjector === true) {
      void import('./utils/submenu-injector').then(({ initSubmenuInjector }) => {
        initSubmenuInjector()
        console.log('[DiscourseOneClick] submenu injector enabled (experimental)')
      })
    }

    // LinuxDo 追觅功能
    if (settings.enableLinuxDoSeeking === true) {
      void import('./seeking').then(({ initLinuxDoSeeking }) => {
        initLinuxDoSeeking()
        console.log('[DiscourseOneClick] LinuxDo seeking enabled')
      })
    }

    // Discourse 路由刷新功能
    if (settings.enableDiscourseRouterRefresh === true) {
      try {
        const { initDiscourseRouterRefresh } = await import('./utils/router-refresh')
        await initDiscourseRouterRefresh()
      } catch (e) {
        console.warn('[DiscourseOneClick] failed to initialize router refresh:', e)
      }
    }

    // 用户 summary 页面注入召唤按钮
    try {
      const { initUserSummarySummonButton } = await import('./utils/user-summary-summon')
      initUserSummarySummonButton()
    } catch (e) {
      console.warn('[DiscourseOneClick] failed to initialize user summary summon button', e)
    }

    // LinuxDo Credit 积分浮窗
    if (settings.enableLinuxDoCredit === true) {
      void import('./credit').then(({ initLinuxDoCredit }) => {
        initLinuxDoCredit()
        console.log('[DiscourseOneClick] LinuxDo Credit widget enabled')
      })
    }

    // LinuxDo 点赞计数器（试验性功能，需同时开启试验性特性开关）
    if (
      settings.enableExperimentalFeatures === true &&
      settings.enableLinuxDoLikeCounter === true
    ) {
      void import('./like-counter').then(({ initLinuxDoLikeCounter }) => {
        initLinuxDoLikeCounter()
        console.log('[DiscourseOneClick] LinuxDo Like Counter enabled (experimental)')
      })
    }

    // save-last-discourse injection removed — no-op to avoid injecting UI into Discourse pages
  } catch (e) {
    console.error('[DiscourseOneClick] init failed', e)
  }
}
