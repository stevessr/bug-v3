// 导入各个功能模块
import { requestSettingFromBackground } from '../utils/requestSetting'

import { scanForMagnificPopup, observeMagnificPopup } from './utils/magnific-popup'
import { scanForCookedContent, observeCookedContent } from './utils/cooked-content'
import { isDiscoursePage } from './utils/page-detection'
import { setupDiscourseUploadHandler } from './utils/upload-handler'

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

    // Callout suggestions 现在通过独立脚本由后台注入
    // 不再在这里直接调用 initCalloutSuggestions()

    // save-last-discourse injection removed — no-op to avoid injecting UI into Discourse pages
  } catch (e) {
    console.error('[DiscourseOneClick] init failed', e)
  }
}
