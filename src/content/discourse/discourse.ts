// 导入各个功能模块
import { requestSettingFromBackground } from '../utils/requestSetting'
import { contentImageCache, processEmojiImages } from '../utils/contentImageCache'

import { scanForMagnificPopup, observeMagnificPopup } from './utils/magnific-popup'
import { scanForCookedContent, observeCookedContent } from './utils/cooked-content'
import { isDiscoursePage } from './utils/page-detection'
import { setupDiscourseUploadHandler } from './utils/upload-handler'
import { initCalloutSuggestions } from './callout-suggestions'
import { initChatMultiReactor } from './utils/chat-multi-reactor'
import { initSubmenuInjector } from './utils/submenu-injector'
import { initLinuxDoSeeking } from './utils/linuxdo-seeking'
import { initDiscourseRouterRefresh } from './utils/router-refresh'

export async function initDiscourse() {
  try {
    if (!isDiscoursePage()) {
      console.log('[DiscourseOneClick] skipping init: not a Discourse page')
      return
    }

    scanForMagnificPopup()
    observeMagnificPopup()
    setupDiscourseUploadHandler()

    let enableBatchParseImages = true
    try {
      const setting = await requestSettingFromBackground('enableBatchParseImages')
      if (typeof setting === 'boolean') enableBatchParseImages = setting
    } catch (e) {
      console.warn('[DiscourseOneClick] failed to get enableBatchParseImages setting', e)
    }

    if (enableBatchParseImages) {
      setTimeout(scanForCookedContent, 300)
      observeCookedContent()
    } else {
      console.log('[DiscourseOneClick] batch parse button disabled via settings')
    }

    // 集成 callout suggestions（在 textarea 输入 `[!` 时展示候选）
    // 检查是否启用了 callout suggestions
    try {
      const enableCalloutSuggestions = await requestSettingFromBackground(
        'enableCalloutSuggestions'
      )
      // 默认启用，只有明确设置为 false 时才禁用
      if (enableCalloutSuggestions !== false) {
        initCalloutSuggestions()
      } else {
        console.log('[DiscourseOneClick] callout suggestions disabled by user setting')
      }
    } catch (e) {
      console.warn(
        '[DiscourseOneClick] failed to get enableCalloutSuggestions setting, defaulting to enabled',
        e
      )
      initCalloutSuggestions()
    }

    // 集成聊天多表情反应功能
    try {
      const enableChatMultiReactor = await requestSettingFromBackground('enableChatMultiReactor')
      if (enableChatMultiReactor === true) {
        // 获取自定义表情列表
        const customEmojis = await requestSettingFromBackground('chatMultiReactorEmojis')
        initChatMultiReactor(Array.isArray(customEmojis) ? customEmojis : undefined)
        console.log('[DiscourseOneClick] chat multi-reactor enabled')
      }
    } catch (e) {
      console.warn('[DiscourseOneClick] failed to get enableChatMultiReactor setting', e)
    }

    // 集成图片缓存功能
    try {
      const enableContentImageCache = await requestSettingFromBackground('enableContentImageCache')
      if (enableContentImageCache !== false) {
        // 初始化图片缓存服务
        await contentImageCache.init()

        // 延迟处理页面中的图片，避免影响页面加载
        setTimeout(async () => {
          try {
            const processedCount = await processEmojiImages()
            console.log(`[DiscourseOneClick] processed ${processedCount} images with cache`)
          } catch (e) {
            console.warn('[DiscourseOneClick] failed to process images with cache:', e)
          }
        }, 1000)

        console.log('[DiscourseOneClick] content image cache enabled')
      }
    } catch (e) {
      console.warn('[DiscourseOneClick] failed to initialize content image cache:', e)
    }

    // 试验性功能：子菜单注入
    // 将功能按钮注入到 Discourse 工具栏的下拉菜单中，而不是传统的菜单栏
    try {
      const enableSubmenuInjector = await requestSettingFromBackground('enableSubmenuInjector')
      if (enableSubmenuInjector === true) {
        initSubmenuInjector()
        console.log('[DiscourseOneClick] submenu injector enabled (experimental)')
      }
    } catch (e) {
      console.warn('[DiscourseOneClick] failed to get enableSubmenuInjector setting', e)
    }

    // LinuxDo 追觅功能
    // 监控 Linux.do 用户活动，显示侧边栏
    try {
      const enableLinuxDoSeeking = await requestSettingFromBackground('enableLinuxDoSeeking')
      if (enableLinuxDoSeeking === true) {
        initLinuxDoSeeking()
        console.log('[DiscourseOneClick] LinuxDo seeking enabled')
      }
    } catch (e) {
      console.warn('[DiscourseOneClick] failed to get enableLinuxDoSeeking setting', e)
    }

    // Discourse 路由刷新功能
    // 周期性调用 Discourse 路由刷新以优化用户体验
    try {
      await initDiscourseRouterRefresh()
    } catch (e) {
      console.warn('[DiscourseOneClick] failed to initialize router refresh:', e)
    }

    // save-last-discourse injection removed — no-op to avoid injecting UI into Discourse pages
  } catch (e) {
    console.error('[DiscourseOneClick] init failed', e)
  }
}
