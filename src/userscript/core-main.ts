// Core userscript entry point - emoji picker functionality only
// Management features (settings/import/export) are in the separate manager script

import { loadDataFromLocalStorage, loadDataFromLocalStorageAsync } from './userscript-storage'
import { userscriptState } from './state'
import { initOneClickAdd } from './modules/oneClickAdd'
import { initPhotoSwipeTopbarUserscript } from './modules/photoSwipeTopbar'
// Callout suggestions moved to standalone userscript (scripts/callout-suggestions.user.js)
// import { initCalloutSuggestionsUserscript } from './modules/calloutSuggestions'
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

// Initialize from localStorage
async function initializeUserscriptData() {
  const data = await loadDataFromLocalStorageAsync().catch((err: any) => {
    console.warn(
      '[Emoji Picker] loadDataFromLocalStorageAsync failed, falling back to sync loader',
      err
    )
    return loadDataFromLocalStorage()
  })
  userscriptState.emojiGroups = data.emojiGroups || []
  userscriptState.settings = data.settings || userscriptState.settings
}

// Function to check if current page is a Discourse site
function isDiscoursePage(): boolean {
  const discourseMetaTags = document.querySelectorAll(
    'meta[name*="discourse"], meta[content*="discourse"], meta[property*="discourse"]'
  )
  if (discourseMetaTags.length > 0) {
    console.log('[Emoji Picker] Discourse detected via meta tags')
    return true
  }

  const generatorMeta = document.querySelector('meta[name="generator"]')
  if (generatorMeta) {
    const content = generatorMeta.getAttribute('content')?.toLowerCase() || ''
    if (content.includes('discourse')) {
      console.log('[Emoji Picker] Discourse detected via generator meta')
      return true
    }
  }

  const discourseElements = document.querySelectorAll(
    '#main-outlet, .ember-application, textarea.d-editor-input, .ProseMirror.d-editor-input'
  )
  if (discourseElements.length > 0) {
    console.log('[Emoji Picker] Discourse elements detected')
    return true
  }

  console.log('[Emoji Picker] Not a Discourse site')
  return false
}

// Main initialization function
async function initializeEmojiFeature(maxAttempts: number = 10, delay: number = 1000) {
  console.log('[Emoji Picker] Initializing...')

  logPlatformInfo()
  
  await initializeUserscriptData()
  
  // 仅在设置允许时初始化一键解析并添加图片功能
  try {
    if (userscriptState.settings?.enableBatchParseImages !== false) {
      initOneClickAdd()
      initPhotoSwipeTopbarUserscript()
      console.log('[Emoji Picker] One-click batch parse images enabled')
    } else {
      console.log('[Emoji Picker] One-click batch parse images disabled by setting')
    }
  } catch (e) {
    console.warn('[Emoji Picker] initOneClickAdd failed', e)
  }
  
  // Callout suggestions moved to standalone userscript (scripts/callout-suggestions.user.js)
  // Initialize callout suggestions
  // try {
  //   if (userscriptState.settings?.enableCalloutSuggestions !== false) {
  //     initCalloutSuggestionsUserscript()
  //     console.log('[Emoji Picker] Callout suggestions enabled')
  //   } else {
  //     console.log('[Emoji Picker] Callout suggestions disabled by user setting')
  //   }
  // } catch (e) {
  //   console.warn('[Emoji Picker] initCalloutSuggestionsUserscript failed', e)
  // }

  // Inject auto-read button into user menu
  try {
    void showAutoReadInMenu()
  } catch (e) {
    console.warn('[Emoji Picker] showAutoReadInMenu failed', e)
  }

  // Expose auto-read wrapper
  function exposeAutoReadWrapper() {
    try {
      const existing = (window as any).autoReadAllRepliesV2
      if (existing && typeof existing === 'function') {
        ;(window as any).callAutoReadRepliesV2 = (topicId?: number) => {
          try {
            return existing(topicId)
          } catch (e) {
            console.warn('[Emoji Picker] callAutoReadRepliesV2 invocation failed', e)
          }
        }
        console.log('[Emoji Picker] callAutoReadRepliesV2 is exposed')
        return
      }

      ;(window as any).callAutoReadRepliesV2 = (topicId?: number) => {
        try {
          const fn = (window as any).autoReadAllRepliesV2
          if (fn && typeof fn === 'function') {
            return fn(topicId)
          }
        } catch (e) {
          console.warn('[Emoji Picker] callAutoReadRepliesV2 invocation failed', e)
        }
        console.warn('[Emoji Picker] autoReadAllRepliesV2 not available on this page yet')
      }
    } catch (e) {
      console.warn('[Emoji Picker] exposeAutoReadWrapper failed', e)
    }
  }

  exposeAutoReadWrapper()

  let attempts = 0

  function attemptToolbarInjection() {
    attempts++
    const result = attemptInjection()

    if (result.injectedCount > 0 || result.totalToolbars > 0) {
      console.log(
        `[Emoji Picker] Injection successful: ${result.injectedCount} buttons injected into ${result.totalToolbars} toolbars`
      )
      return
    }

    if (attempts < maxAttempts) {
      console.log(
        `[Emoji Picker] Toolbar not found, attempt ${attempts}/${maxAttempts}. Retrying in ${delay / 1000}s.`
      )
      setTimeout(attemptToolbarInjection, delay)
    } else {
      console.error('[Emoji Picker] Failed to find toolbar after multiple attempts.')
      console.log('[Emoji Picker] Showing floating button as fallback')
      showFloatingButton()
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attemptToolbarInjection)
  } else {
    attemptToolbarInjection()
  }

  startPeriodicInjection()

  setInterval(() => {
    checkAndShowFloatingButton()
  }, 5000)
}

// Entry point - only run on Discourse sites
if (isDiscoursePage()) {
  console.log('[Emoji Picker] Discourse detected, initializing emoji picker feature')
  initializeEmojiFeature()
} else {
  console.log('[Emoji Picker] Not a Discourse site, skipping injection')
}

export {}
