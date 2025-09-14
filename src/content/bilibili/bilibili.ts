/**
 * Bilibili 页面表情按钮注入功能
 * 主要初始化逻辑
 */

import { isBilibiliOpusPage } from './utils/bilibili-helper'
import { scanAndInject, observeMutations } from './utils/bilibili-injection'
import { injectBilibiliButtonStyles } from './utils/bilibili-css'

export function initBilibili() {
  try {
    if (!isBilibiliOpusPage()) {
      console.log('[BiliOneClick] skipping init: not a Bilibili opus page')
      return
    }

    // Inject CSS fixes for button styling
    injectBilibiliButtonStyles()

    // initial scan and observe
    setTimeout(scanAndInject, 200)
    observeMutations()
    console.log('[BiliOneClick] initialized')
  } catch (e) {
    console.error('[BiliOneClick] init failed', e)
  }
}
