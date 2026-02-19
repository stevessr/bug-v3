// 导入各个功能模块
import { requestSettingsBatch } from '../utils/core/requestSetting'
import { contentImageCache, processEmojiImages } from '../utils/core/contentImageCache'

import { scanForMagnificPopup, observeMagnificPopup } from './utils/magnific-popup'
import { scanForCookedContent, observeCookedContent } from './utils/cooked-content'
import { isDiscoursePage } from './utils/page-detection'
import { setupDiscourseUploadHandler } from './utils/upload-handler'
import { initCalloutSuggestions } from './callout-suggestions'
import { initChatMultiReactor } from './utils/chat-multi-reactor'
import { initSubmenuInjector } from './utils/submenu-injector'
import { initLinuxDoSeeking } from './seeking'
import { initDiscourseRouterRefresh } from './utils/router-refresh'
import { initUserSummarySummonButton } from './utils/user-summary-summon'
import { initLinuxDoCredit } from './credit'
import { initLinuxDoLikeCounter } from './like-counter'

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
      'enableBatchParseImages',
      'enableCalloutSuggestions',
      'enableChatMultiReactor',
      'chatMultiReactorEmojis',
      'enableContentImageCache',
      'enableSubmenuInjector',
      'enableLinuxDoSeeking',
      'enableLinuxDoCredit',
      'enableExperimentalFeatures',
      'enableLinuxDoLikeCounter'
    ])

    // Batch parse images（默认启用）
    const enableBatchParseImages =
      typeof settings.enableBatchParseImages === 'boolean' ? settings.enableBatchParseImages : true
    if (enableBatchParseImages) {
      setTimeout(scanForCookedContent, 300)
      observeCookedContent()
    } else {
      console.log('[DiscourseOneClick] batch parse button disabled via settings')
    }

    // Callout suggestions（默认启用，只有明确设置为 false 时才禁用）
    if (settings.enableCalloutSuggestions !== false) {
      initCalloutSuggestions()
    } else {
      console.log('[DiscourseOneClick] callout suggestions disabled by user setting')
    }

    // 聊天多表情反应功能
    if (settings.enableChatMultiReactor === true) {
      const customEmojis = settings.chatMultiReactorEmojis
      initChatMultiReactor(Array.isArray(customEmojis) ? customEmojis : undefined)
      console.log('[DiscourseOneClick] chat multi-reactor enabled')
    }

    // 图片缓存功能（默认启用）
    if (settings.enableContentImageCache !== false) {
      try {
        await contentImageCache.init()
        setTimeout(async () => {
          try {
            const processedCount = await processEmojiImages()
            console.log(`[DiscourseOneClick] processed ${processedCount} images with cache`)
          } catch (e) {
            console.warn('[DiscourseOneClick] failed to process images with cache:', e)
          }
        }, 1000)
        console.log('[DiscourseOneClick] content image cache enabled')
      } catch (e) {
        console.warn('[DiscourseOneClick] failed to initialize content image cache:', e)
      }
    }

    // 子菜单注入（试验性功能）
    if (settings.enableSubmenuInjector === true) {
      initSubmenuInjector()
      console.log('[DiscourseOneClick] submenu injector enabled (experimental)')
    }

    // LinuxDo 追觅功能
    if (settings.enableLinuxDoSeeking === true) {
      initLinuxDoSeeking()
      console.log('[DiscourseOneClick] LinuxDo seeking enabled')
    }

    // Discourse 路由刷新功能
    try {
      await initDiscourseRouterRefresh()
    } catch (e) {
      console.warn('[DiscourseOneClick] failed to initialize router refresh:', e)
    }

    // 用户 summary 页面注入召唤按钮
    try {
      initUserSummarySummonButton()
    } catch (e) {
      console.warn('[DiscourseOneClick] failed to initialize user summary summon button', e)
    }

    // LinuxDo Credit 积分浮窗
    if (settings.enableLinuxDoCredit === true) {
      initLinuxDoCredit()
      console.log('[DiscourseOneClick] LinuxDo Credit widget enabled')
    }

    // LinuxDo 点赞计数器（试验性功能，需同时开启试验性特性开关）
    if (
      settings.enableExperimentalFeatures === true &&
      settings.enableLinuxDoLikeCounter === true
    ) {
      initLinuxDoLikeCounter()
      console.log('[DiscourseOneClick] LinuxDo Like Counter enabled (experimental)')
    }

    // save-last-discourse injection removed — no-op to avoid injecting UI into Discourse pages
  } catch (e) {
    console.error('[DiscourseOneClick] init failed', e)
  }
}
