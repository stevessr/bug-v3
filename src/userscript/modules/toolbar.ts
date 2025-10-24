// Toolbar injection and button management module
import { getPlatformToolbarSelectors } from '../utils/platformDetection'
import { injectEmojiButton } from './uiComponents'
import { 
  setupForceMobileMenuTriggers, 
  setupForceMobileToolbarListeners, 
  shouldSkipToolbarInjection,
  startAllForceMobileIntervals
} from './forceMobileMode'

// Find toolbars where we can inject buttons using platform-specific selectors
export function findAllToolbars(): HTMLElement[] {
  // Skip toolbar injection if force mobile mode with d-menu-portals is active
  if (shouldSkipToolbarInjection()) {
    console.log('[Emoji Extension Userscript] Force mobile mode with #d-menu-portals detected, skipping toolbar injection')
    return []
  }

  const toolbars: HTMLElement[] = []
  const selectors = getPlatformToolbarSelectors()

  for (const selector of selectors) {
    const elements = document.querySelectorAll(selector)
    toolbars.push(...(Array.from(elements) as HTMLElement[]))
  }
  return toolbars
}

// Injection attempt function
export function attemptInjection() {
  const toolbars = findAllToolbars()
  let injectedCount = 0

  toolbars.forEach(toolbar => {
    if (!toolbar.querySelector('.emoji-extension-button')) {
      console.log('[Emoji Extension Userscript] Toolbar found, injecting button.')
      injectEmojiButton(toolbar)
      injectedCount++
    }
  })

  // Setup force mobile mode menu triggers if enabled
  setupForceMobileMenuTriggers()
  // Also setup toolbar trigger listeners for force mobile mode (attach per-toolbar)
  try {
    setupForceMobileToolbarListeners()
    // Start all force mobile mode intervals (1s injection, 10s button existence check)
    try {
      startAllForceMobileIntervals()
    } catch (e) {
      // ignore
    }
  } catch (e) {
    // ignore
  }

  // No header panel injection when force mobile mode is active

  return { injectedCount, totalToolbars: toolbars.length }
}

// Periodic toolbar checking
export function startPeriodicInjection() {
  setInterval(() => {
    const toolbars = findAllToolbars()
    toolbars.forEach(toolbar => {
      if (!toolbar.querySelector('.emoji-extension-button')) {
        console.log('[Emoji Extension Userscript] New toolbar found, injecting button.')
        injectEmojiButton(toolbar)
      }
    })

    // Also check for force mobile mode menu triggers
    setupForceMobileMenuTriggers()
    // Periodically ensure per-toolbar listeners are attached when forceMobileMode is enabled
    try {
      setupForceMobileToolbarListeners()
      startAllForceMobileIntervals() // Start all intervals (1s injection, 10s button check)
    } catch (e) {
      // ignore
    }
  }, 30000)
}