import { logger } from './buildFlags'
import { initPixiv } from './pixiv'
import { initDiscourse } from './discourse'

// oneClickAdd.ts - 仅保留一键添加核心逻辑，平台注入移至各自模块
declare const chrome: any

// 添加CSS动画（仅用于批量按钮的加载动画）
const cssAnimation = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`

export function injectCSSAnimation() {
  if (!document.getElementById('oneclick-add-styles')) {
    const style = document.createElement('style')
    style.id = 'oneclick-add-styles'
    style.textContent = cssAnimation
    document.head.appendChild(style)
  }
}

/**
 * 初始化一键添加模块（注入CSS并启动平台注入器）
 */
export function initOneClickAdd() {
  logger.log('[OneClickAdd] 初始化一键添加表情核心')
  injectCSSAnimation()

  try {
    initDiscourse()
  } catch (e) {
    logger.error('[OneClickAdd] initDiscourse failed', e)
  }

  try {
    initPixiv()
  } catch (e) {
    logger.error('[OneClickAdd] initPixiv failed', e)
  }
}
