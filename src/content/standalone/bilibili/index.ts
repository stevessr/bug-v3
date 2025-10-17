// Standalone Bilibili Script
// This script is injected into Bilibili pages for emoji features
// It provides one-click emoji addition functionality

import { initBilibili } from '../../bilibili/bilibili'

// 自执行：页面加载时立即初始化
;(function () {
  try {
    // 检查是否已经初始化过（避免重复注入）
    if ((window as any).__BILIBILI_FEATURES_INITIALIZED__) {
      console.log('[BilibiliFeatures] Already initialized, skipping')
      return
    }

    console.log('[BilibiliFeatures] Initializing standalone Bilibili script')
    initBilibili()

    // 标记已初始化
    ;(window as any).__BILIBILI_FEATURES_INITIALIZED__ = true

    // 监听来自后台的禁用消息
    if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
        if (message.type === 'DISABLE_BILIBILI_FEATURES') {
          console.log('[BilibiliFeatures] Received disable message')
          ;(window as any).__BILIBILI_FEATURES_INITIALIZED__ = false
        }
      })
    }
  } catch (e) {
    console.error('[BilibiliFeatures] Initialization failed', e)
  }
})()
