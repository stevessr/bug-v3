import { initDiscourse } from '../discourse/discourse'

// logger removed: replaced with direct console usage

// oneClickAdd.ts - 仅保留一键添加核心逻辑，平台注入移至各自模块

// 添加 CSS 动画（仅用于批量按钮的加载动画）
const cssAnimation = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  .fk-d-menu-modal.emoji-picker-content .emoji-picker {
  {
    height: auto;
    width: auto;
  }
  .emoji-picker .emoji {
    width: 20%;
    height: 20%;
}
`

import { DEBI, DHA, createE } from '@/content/utils'

function injectCSSAnimation() {
  if (!DEBI('oneclick-add-styles')) {
    const style = createE('style', {
      id: 'oneclick-add-styles',
      text: cssAnimation
    })
    DHA(style)
  }
}

/**
 * 初始化一键添加模块（注入 CSS 并启动平台注入器）
 */
export function initOneClickAdd() {
  console.log('[OneClickAdd] 初始化一键添加表情核心')
  injectCSSAnimation()

  try {
    // initDiscourse is now async, but we don't need to wait for it
    initDiscourse().catch(e => {
      console.error('[OneClickAdd] initDiscourse failed', e)
    })
  } catch (e) {
    console.error('[OneClickAdd] initDiscourse failed', e)
  }
}
