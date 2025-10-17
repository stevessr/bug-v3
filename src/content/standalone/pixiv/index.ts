// Standalone Pixiv Script
// This script is injected into Pixiv pages for image features
// It provides one-click emoji addition functionality

import { initPixiv } from '../../pixiv/detector'

// 自执行：页面加载时立即初始化
;(function () {
  try {
    // 检查是否已经初始化过（避免重复注入）
    if ((window as any).__PIXIV_FEATURES_INITIALIZED__) {
      console.log('[PixivFeatures] Already initialized, skipping')
      return
    }

    console.log('[PixivFeatures] Initializing standalone Pixiv script')
    initPixiv()

    // 标记已初始化
    ;(window as any).__PIXIV_FEATURES_INITIALIZED__ = true

    // 监听来自后台的禁用消息
    if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
        if (message.type === 'DISABLE_PIXIV_FEATURES') {
          console.log('[PixivFeatures] Received disable message')
          ;(window as any).__PIXIV_FEATURES_INITIALIZED__ = false
        }
      })
    }
  } catch (e) {
    console.error('[PixivFeatures] Initialization failed', e)
  }
})()
