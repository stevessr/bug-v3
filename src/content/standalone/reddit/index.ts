// Standalone Reddit Script
// This script is injected into Reddit pages for image features
// It provides one-click emoji addition functionality

import { initReddit } from '../../reddit/reddit'

// 自执行：页面加载时立即初始化
;(function () {
  try {
    // 检查是否已经初始化过（避免重复注入）
    if ((window as any).__REDDIT_FEATURES_INITIALIZED__) {
      console.log('[RedditFeatures] Already initialized, skipping')
      return
    }

    console.log('[RedditFeatures] Initializing standalone Reddit script')
    initReddit()

    // 标记已初始化
    ;(window as any).__REDDIT_FEATURES_INITIALIZED__ = true

    // 监听来自后台的禁用消息
    if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
        if (message.type === 'DISABLE_REDDIT_FEATURES') {
          console.log('[RedditFeatures] Received disable message')
          ;(window as any).__REDDIT_FEATURES_INITIALIZED__ = false
        }
      })
    }
  } catch (e) {
    console.error('[RedditFeatures] Initialization failed', e)
  }
})()
