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

    // Inject CSS fixes for button styling
    injectBilibiliButtonStyles()

    // initial scan and observe
    setTimeout(scanAndInject, 200)
    observeMutations()
    logger.log('[BiliOneClick] initialized')
  } catch (e) {
    logger.error('[BiliOneClick] init failed', e)
  }
}

/**
 * 注入按钮样式修复CSS
 */
function injectBilibiliButtonStyles() {
  // Check if styles are already injected
  if (document.getElementById('bilibili-emoji-button-fixes')) {
    return
  }

  const css = `
    /* Bilibili Button Styling Fixes */
    .bili-album__watch__control__option.add-emoji {
      background: inherit !important;
      color: inherit !important;
      font-size: inherit !important;
      font-weight: inherit !important;
      padding: inherit !important;
      border-radius: inherit !important;
      transition: inherit !important;
      display: flex !important;
      align-items: center !important;
      gap: 4px !important;
      cursor: pointer !important;
      user-select: none !important;
    }

    .bili-album__watch__control__option.add-emoji:hover {
      background: inherit !important;
      color: inherit !important;
    }

    .bili-album__watch__control__option.add-emoji svg {
      fill: currentColor !important;
      width: 14px !important;
      height: 14px !important;
    }

    .bili-album__watch__control__option.add-emoji span {
      color: inherit !important;
      font-size: inherit !important;
      font-weight: inherit !important;
    }

    .pswp__button.bili-emoji-add-btn {
      position: relative !important;
      display: block !important;
      width: 44px !important;
      height: 44px !important;
      background: none !important;
      border: none !important;
      cursor: pointer !important;
      overflow: visible !important;
      appearance: none !important;
      box-shadow: none !important;
      opacity: 0.75 !important;
      transition: opacity 0.2s !important;
      color: #fff !important;
      font-size: 18px !important;
      line-height: 44px !important;
      text-align: center !important;
    }

    .pswp__button.bili-emoji-add-btn:hover {
      opacity: 1 !important;
    }
  `

  const style = document.createElement('style')
  style.id = 'bilibili-emoji-button-fixes'
  style.textContent = css
  document.head.appendChild(style)
}
