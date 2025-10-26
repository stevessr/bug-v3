// Main userscript entry point - refactored to use modular components

// Compile-time flag injected by vite config: when true the build is the remote variant
declare const __USERSCRIPT_REMOTE_DEFAULTS__: boolean

import { loadDataFromLocalStorage, loadDataFromLocalStorageAsync } from './userscript-storage'
import { userscriptState } from './state'
import { initOneClickAdd } from './modules/oneClickAdd'
import { initPhotoSwipeTopbarUserscript } from './modules/photoSwipeTopbar'
import { initCalloutSuggestionsUserscript } from './modules/calloutSuggestions'
import { attemptInjection, startPeriodicInjection } from './modules/toolbar'
import {
  showFloatingButton,
  checkAndShowFloatingButton,
  showAutoReadInMenu
} from './modules/floatingButton'
import { logPlatformInfo } from './utils/platformDetection'
import { autoReadAllv2 } from '../content/utils/autoReadReplies'

if(!(window as any).autoReadAllRepliesV2){
  (window as any).autoReadAllRepliesV2 = autoReadAllv2
}

// userscriptState is imported from ./state and initialized there

// Initialize from localStorage
async function initializeUserscriptData() {
  const data = await loadDataFromLocalStorageAsync().catch((err: any) => {
    console.warn(
      '[Userscript] loadDataFromLocalStorageAsync failed, falling back to sync loader',
      err
    )
    return loadDataFromLocalStorage()
  })
  userscriptState.emojiGroups = data.emojiGroups || []
  userscriptState.settings = data.settings || userscriptState.settings
}

// Function to check if current page is a Discourse site
function isDiscoursePage(): boolean {
  // Check for discourse meta tags
  const discourseMetaTags = document.querySelectorAll(
    'meta[name*="discourse"], meta[content*="discourse"], meta[property*="discourse"]'
  )
  if (discourseMetaTags.length > 0) {
    console.log('[Emoji Extension Userscript] Discourse detected via meta tags')
    return true
  }

  // Check for Discourse generator meta tag
  const generatorMeta = document.querySelector('meta[name="generator"]')
  if (generatorMeta) {
    const content = generatorMeta.getAttribute('content')?.toLowerCase() || ''
    if (content.includes('discourse')) {
      console.log('[Emoji Extension Userscript] Discourse detected via generator meta')
      return true
    }
  }

  // Check for Discourse-specific DOM elements
  const discourseElements = document.querySelectorAll(
    '#main-outlet, .ember-application, textarea.d-editor-input, .ProseMirror.d-editor-input'
  )
  if (discourseElements.length > 0) {
    console.log('[Emoji Extension Userscript] Discourse elements detected')
    return true
  }

  console.log('[Emoji Extension Userscript] Not a Discourse site')
  return false
}

// Main initialization function
async function initializeEmojiFeature(maxAttempts: number = 10, delay: number = 1000) {
  console.log('[Emoji Extension Userscript] Initializing...')

  // Log platform information
  logPlatformInfo()

  // Initialize data and features
  await initializeUserscriptData()
  // 仅在设置允许时初始化一键解析并添加图片功能
  try {
    if (userscriptState.settings?.enableBatchParseImages !== false) {
      initOneClickAdd()
      // 初始化 PhotoSwipe 顶部栏的添加表情按钮（Discourse 新版图片预览）
      initPhotoSwipeTopbarUserscript()
      console.log('[Userscript] One-click batch parse images enabled')
    } else {
      console.log('[Userscript] One-click batch parse images disabled by setting')
    }
  } catch (e) {
    console.warn('[Userscript] initOneClickAdd failed', e)
  }
  // Initialize callout suggestions (enabled by default for Discourse)
  try {
    // 默认启用，只有明确设置为 false 时才禁用
    if (userscriptState.settings?.enableCalloutSuggestions !== false) {
      initCalloutSuggestionsUserscript()
      console.log('[Userscript] Callout suggestions enabled')
    } else {
      console.log('[Userscript] Callout suggestions disabled by user setting')
    }
  } catch (e) {
    console.warn('[Userscript] initCalloutSuggestionsUserscript failed', e)
  }

  // Inject auto-read button into user menu (userscript-managed)
  try {
    void showAutoReadInMenu()
  } catch (e) {
    console.warn('[Userscript] showAutoReadInMenu failed', e)
  }

  // expose a simple wrapper so other userscripts/pages can trigger autoReadAllRepliesV2
  function exposeAutoReadWrapper() {
    try {
      // if content script or page already exposes autoReadAllRepliesV2, use it
      // @ts-ignore
      const existing = (window as any).autoReadAllRepliesV2
      if (existing && typeof existing === 'function') {
        // @ts-ignore
        ;(window as any).callAutoReadRepliesV2 = (topicId?: number) => {
          try {
            return existing(topicId)
          } catch (e) {
            console.warn('[Userscript] callAutoReadRepliesV2 invocation failed', e)
          }
        }
        console.log('[Userscript] callAutoReadRepliesV2 is exposed')
        return
      }

      // otherwise, set a dynamic wrapper that will try to call the page/content
      // exposed autoRead function at the time of invocation. This ensures that
      // if the content script or page exposes the function after userscript
      // initialization, calling the wrapper will still trigger auto-read and
      // its notifications.
      // @ts-ignore
      ;(window as any).callAutoReadRepliesV2 = (topicId?: number) => {
        try {
          // Prefer the up-to-date reference on window at call time
          // @ts-ignore
          const fn = (window as any).autoReadAllRepliesV2
          if (fn && typeof fn === 'function') {
            return fn(topicId)
          }
        } catch (e) {
          console.warn('[Userscript] callAutoReadRepliesV2 invocation failed', e)
        }
        console.warn('[Userscript] autoReadAllRepliesV2 not available on this page yet')
      }
    } catch (e) {
      console.warn('[Userscript] exposeAutoReadWrapper failed', e)
    }
  }

  exposeAutoReadWrapper()

  let attempts = 0

  function attemptToolbarInjection() {
    attempts++

    const result = attemptInjection()

    if (result.injectedCount > 0 || result.totalToolbars > 0) {
      console.log(
        `[Emoji Extension Userscript] Injection successful: ${result.injectedCount} buttons injected into ${result.totalToolbars} toolbars`
      )
      return // Success
    }

    if (attempts < maxAttempts) {
      console.log(
        `[Emoji Extension Userscript] Toolbar not found, attempt ${attempts}/${maxAttempts}. Retrying in ${delay / 1000}s.`
      )
      setTimeout(attemptToolbarInjection, delay)
    } else {
      console.error('[Emoji Extension Userscript] Failed to find toolbar after multiple attempts.')
      // Show floating button as fallback when injection fails
      console.log('[Emoji Extension Userscript] Showing floating button as fallback')
      showFloatingButton()
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attemptToolbarInjection)
  } else {
    attemptToolbarInjection()
  }

  // Start periodic checks for new toolbars
  startPeriodicInjection()

  // Check if floating button should be shown periodically
  setInterval(() => {
    checkAndShowFloatingButton()
  }, 5000)
}

// Entry point - only run on Discourse sites
if (isDiscoursePage()) {
  console.log('[Emoji Extension Userscript] Discourse detected, initializing emoji feature')
  initializeEmojiFeature()
} else {
  console.log('[Emoji Extension Userscript] Not a Discourse site, skipping injection')
}

export {}
