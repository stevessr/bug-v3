// Standalone Callout Suggestions Script
// This script is injected into pages when enableCalloutSuggestions is enabled
// It provides auto-completion for Obsidian-style callout syntax when typing [!

import { initCalloutSuggestions } from './core'

// 自执行：页面加载时立即初始化
;(function () {
  try {
    // 检查是否已经初始化过（避免重复注入）
    if ((window as any).__CALLOUT_SUGGESTIONS_INITIALIZED__) {
      console.log('[CalloutSuggestions] Already initialized, skipping')
      return
    }

    console.log('[CalloutSuggestions] Initializing standalone script')
    initCalloutSuggestions()

    // 标记已初始化
    ;(window as any).__CALLOUT_SUGGESTIONS_INITIALIZED__ = true

    // 监听来自后台的禁用消息
    if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
        if (message.type === 'DISABLE_CALLOUT_SUGGESTIONS') {
          console.log('[CalloutSuggestions] Received disable message, cleaning up')
          // 简单地标记为未初始化，页面刷新后将不再自动加载
          ;(window as any).__CALLOUT_SUGGESTIONS_INITIALIZED__ = false

          // 隐藏建议框
          const suggestionBox = document.getElementById('callout-suggestion-box-en')
          if (suggestionBox) {
            suggestionBox.style.display = 'none'
          }
        }
      })
    }
  } catch (e) {
    console.error('[CalloutSuggestions] Initialization failed', e)
  }
})()
