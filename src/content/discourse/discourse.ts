// 导入各个功能模块
import { scanForMagnificPopup, observeMagnificPopup } from './utils/magnific-popup'
import { scanForCookedContent, observeCookedContent } from './utils/cooked-content'
import { isDiscoursePage } from './utils/page-detection'
import { setupDiscourseUploadHandler } from './utils/upload-handler'
import { initCalloutSuggestions } from './callout-suggestions'

export function initDiscourse() {
  try {
    if (!isDiscoursePage()) {
      console.log('[DiscourseOneClick] skipping init: not a Discourse page')
      return
    }

    setTimeout(scanForMagnificPopup, 200)
    setTimeout(scanForCookedContent, 300)
    observeMagnificPopup()
    observeCookedContent()
    setupDiscourseUploadHandler()
    // 集成 callout suggestions（在 textarea 输入 `[!` 时展示候选）
    initCalloutSuggestions()
    // save-last-discourse injection removed — no-op to avoid injecting UI into Discourse pages
  } catch (e) {
    console.error('[DiscourseOneClick] init failed', e)
  }
}
