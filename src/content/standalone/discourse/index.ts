// Standalone Discourse Script
// This script is injected into Discourse and similar forum pages
// It provides emoji picker, button injection, and other forum-specific features

import { initializeEmojiFeature } from '../../utils/init'
import { initDiscourse } from '../../discourse/discourse'

// 自执行：页面加载时立即初始化
;(function () {
  try {
    // 检查是否已经初始化过（避免重复注入）
    if ((window as any).__DISCOURSE_FEATURES_INITIALIZED__) {
      console.log('[DiscourseFeatures] Already initialized, skipping')
      return
    }

    console.log('[DiscourseFeatures] Initializing standalone Discourse script')

    // 初始化表情选择器功能
    initializeEmojiFeature()

    // 初始化 Discourse 特定功能
    initDiscourse()

    // 标记已初始化
    ;(window as any).__DISCOURSE_FEATURES_INITIALIZED__ = true

    // 监听来自后台的禁用消息
    if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
        if (message.type === 'DISABLE_DISCOURSE_FEATURES') {
          console.log('[DiscourseFeatures] Received disable message')
          ;(window as any).__DISCOURSE_FEATURES_INITIALIZED__ = false
          // 可以在这里添加清理逻辑
        }
      })
    }
  } catch (e) {
    console.error('[DiscourseFeatures] Initialization failed', e)
  }
})()
