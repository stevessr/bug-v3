/**
 * Bilibili 页面表情按钮注入功能
 * 主要初始化逻辑
 */

import { logger } from '../utils/buildFLagsV2'

import { isBilibiliOpusPage } from './utils/bilibili-utils'
import { scanAndInject, observeMutations } from './dom/bilibili-injection'

export function initBilibili() {
  try {
    if (!isBilibiliOpusPage()) {
      logger.log('[BiliOneClick] skipping init: not a Bilibili opus page')
      return
    }
    // initial scan and observe
    setTimeout(scanAndInject, 200)
    observeMutations()
    logger.log('[BiliOneClick] initialized')
  } catch (e) {
    logger.error('[BiliOneClick] init failed', e)
  }
}
