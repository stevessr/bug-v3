// 导入各个功能模块
import { requestSettingFromBackground } from '../utils/requestSetting'

import { scanForMagnificPopup, observeMagnificPopup } from './utils/magnific-popup'
import { scanForCookedContent, observeCookedContent } from './utils/cooked-content'
import { isDiscoursePage } from './utils/page-detection'
import { setupDiscourseUploadHandler } from './utils/upload-handler'
import { initCalloutSuggestions } from './callout-suggestions'

export async function initDiscourse() {
  try {
    if (!isDiscoursePage()) {
      console.log('[DiscourseOneClick] skipping init: not a Discourse page')
      return
    }

    setTimeout(scanForMagnificPopup, 200)
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

    // save-last-discourse injection removed — no-op to avoid injecting UI into Discourse pages
  } catch (e) {
    console.error('[DiscourseOneClick] init failed', e)
  }
}
