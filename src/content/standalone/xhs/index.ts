// Standalone XHS (小红书) Script
// This script is injected into Xiaohongshu pages for image features
// It provides one-click emoji addition functionality

import { initXhs } from '../../xhs/init'

// 自执行：页面加载时立即初始化
;(function () {
  try {
    // 检查是否已经初始化过（避免重复注入）
    if ((window as any).__XHS_FEATURES_INITIALIZED__) {
      console.log('[XhsFeatures] Already initialized, skipping')
      return
    }

    console.log('[XhsFeatures] Initializing standalone XHS script')
    initXhs()

    // 标记已初始化
    ;(window as any).__XHS_FEATURES_INITIALIZED__ = true

    // 监听来自后台的禁用消息
    if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
        if (message.type === 'DISABLE_XHS_FEATURES') {
          console.log('[XhsFeatures] Received disable message')
          ;(window as any).__XHS_FEATURES_INITIALIZED__ = false
        }
      })
    }
  } catch (e) {
    console.error('[XhsFeatures] Initialization failed', e)
  }
})()
