// Main userscript entry point - refactored to use modular components

// Compile-time flag injected by vite config: when true the build is the remote variant
declare const __USERSCRIPT_REMOTE_DEFAULTS__: boolean
declare const __USERSCRIPT_PLATFORM__: string

import { loadDataFromLocalStorage, loadDataFromLocalStorageAsync } from './userscript-storage'
import { userscriptState } from './state'
import { initOneClickAdd } from './modules/oneClickAdd'
import { attemptInjection, startPeriodicInjection } from './modules/toolbar'
import { showFloatingButton, checkAndShowFloatingButton } from './modules/floatingButton'
import { logPlatformInfo } from './utils/platformDetection'

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

// Function to check if current page should have emoji injection
function shouldInjectEmoji(): boolean {
  // Check for discourse meta tags
  const discourseMetaTags = document.querySelectorAll(
    'meta[name*="discourse"], meta[content*="discourse"], meta[property*="discourse"]'
  )
  if (discourseMetaTags.length > 0) {
    console.log('[Emoji Extension Userscript] Discourse detected via meta tags')
    return true
  }

  // Check for common forum/discussion platforms
  const generatorMeta = document.querySelector('meta[name="generator"]')
  if (generatorMeta) {
    const content = generatorMeta.getAttribute('content')?.toLowerCase() || ''
    if (content.includes('discourse') || content.includes('flarum') || content.includes('phpbb')) {
      console.log('[Emoji Extension Userscript] Forum platform detected via generator meta')
      return true
    }
  }

  // Check current domain - allow linux.do and other known sites
  const hostname = window.location.hostname.toLowerCase()
  const allowedDomains = ['linux.do', 'meta.discourse.org', 'pixiv.net']
  if (allowedDomains.some(domain => hostname.includes(domain))) {
    console.log('[Emoji Extension Userscript] Allowed domain detected:', hostname)
    return true
  }

  // Check for editor elements that suggest a discussion platform
  const editors = document.querySelectorAll(
    'textarea.d-editor-input, .ProseMirror.d-editor-input, .composer-input, .reply-area textarea'
  )
  if (editors.length > 0) {
    console.log('[Emoji Extension Userscript] Discussion editor detected')
    return true
  }

  console.log('[Emoji Extension Userscript] No compatible platform detected')
  return false
}

// Main initialization function
async function initializeEmojiFeature(maxAttempts: number = 10, delay: number = 1000) {
  console.log('[Emoji Extension Userscript] Initializing...')

  // Log platform information
  logPlatformInfo()

  // Initialize data and features
  await initializeUserscriptData()
  initOneClickAdd()

  // Pixiv specific injection (use content/pixiv implementation)
  try {
    //initPixiv()
  } catch (e) {
    console.warn('[Userscript] initPixiv failed', e)
  }

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

// Entry point
if (shouldInjectEmoji()) {
  console.log('[Emoji Extension Userscript] Initializing emoji feature')
  initializeEmojiFeature()
} else {
  console.log('[Emoji Extension Userscript] Skipping injection - incompatible platform')
}

export {}
