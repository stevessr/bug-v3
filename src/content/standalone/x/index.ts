// Standalone X/Twitter Script
// This script is injected into X/Twitter pages for image/media features
// It provides one-click emoji addition functionality

import { initX } from '../../x/init'

// 自执行：页面加载时立即初始化
;(function () {
  try {
    // 检查是否已经初始化过（避免重复注入）
    if ((window as any).__X_FEATURES_INITIALIZED__) {
      console.log('[XFeatures] Already initialized, skipping')
      return
    }

    console.log('[XFeatures] Initializing standalone X/Twitter script')
    
    // Initialize immediately (utils are now inlined in x/utils.ts)
    initX()
    ;(window as any).__X_FEATURES_INITIALIZED__ = true

    // 监听来自后台的禁用消息
    if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
        if (message.type === 'DISABLE_X_FEATURES') {
          console.log('[XFeatures] Received disable message')
          ;(window as any).__X_FEATURES_INITIALIZED__ = false
        }
      })
    }
  } catch (e) {
    console.error('[XFeatures] Initialization failed', e)
  }
})()
