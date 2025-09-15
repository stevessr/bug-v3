// Floating button module for manual injection
import { createEl } from '../utils/createEl'
import { injectGlobalThemeStyles } from '../utils/themeSupport'

import { attemptInjection } from './toolbar'

// State management for floating button
let floatingButton: HTMLElement | null = null
let isButtonVisible = false

// Styles for floating button with centralized theme support
const FLOATING_BUTTON_STYLES = `
.emoji-extension-floating-button {
  position: fixed !important;
  bottom: 20px !important;
  right: 20px !important;
  width: 56px !important;
  height: 56px !important;
  border-radius: 50% !important;
  background: linear-gradient(135deg, var(--emoji-button-gradient-start) 0%, var(--emoji-button-gradient-end) 100%) !important;
  border: none !important;
  box-shadow: 0 4px 12px var(--emoji-button-shadow) !important;
  cursor: pointer !important;
  z-index: 999999 !important;
  font-size: 24px !important;
  color: white !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  transition: all 0.3s ease !important;
  opacity: 0.9 !important;
  line-height: 1 !important;
}

.emoji-extension-floating-button:hover {
  transform: scale(1.1) !important;
  opacity: 1 !important;
  box-shadow: 0 6px 16px var(--emoji-button-hover-shadow) !important;
}

.emoji-extension-floating-button:active {
  transform: scale(0.95) !important;
}

.emoji-extension-floating-button.hidden {
  opacity: 0 !important;
  pointer-events: none !important;
  transform: translateY(20px) !important;
}

@media (max-width: 768px) {
  .emoji-extension-floating-button {
    bottom: 15px !important;
    right: 15px !important;
    width: 48px !important;
    height: 48px !important;
    font-size: 20px !important;
  }
}
`

// Create and inject styles with platform-specific sizing
function injectStyles() {
  if (document.getElementById('emoji-extension-floating-button-styles')) {
    return // Already injected
  }

  // Inject global theme variables first
  injectGlobalThemeStyles()

  const style = createEl('style', {
    id: 'emoji-extension-floating-button-styles',
    textContent: getFloatingButtonStyles()
  })

  document.head.appendChild(style)
}

// Create floating button element
function createFloatingButton(): HTMLElement {
  const button = createEl('button', {
    className: 'emoji-extension-floating-button',
    title: '手动注入表情按钮 (Manual Emoji Injection)',
    innerHTML: '🐈‍⬛'
  }) as HTMLButtonElement

  // Click handler for manual injection
  button.addEventListener('click', async e => {
    e.stopPropagation()
    e.preventDefault()

    // Visual feedback
    button.style.transform = 'scale(0.9)'
    button.innerHTML = '⏳'

    try {
      // Attempt manual injection
      const result = attemptInjection()

      if (result.injectedCount > 0 || result.totalToolbars > 0) {
        // Success feedback
        button.innerHTML = '✅'
        button.style.background = 'linear-gradient(135deg, #56ab2f 0%, #a8e6cf 100%)'

        setTimeout(() => {
          button.innerHTML = '🐈‍⬛'
          button.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
          button.style.transform = 'scale(1)'
        }, 1500)

        console.log(
          `[Emoji Extension Userscript] Manual injection successful: ${result.injectedCount} buttons injected into ${result.totalToolbars} toolbars`
        )
      } else {
        // No toolbars found feedback
        button.innerHTML = '❌'
        button.style.background = 'linear-gradient(135deg, #ff6b6b 0%, #ffa8a8 100%)'

        setTimeout(() => {
          button.innerHTML = '🐈‍⬛'
          button.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
          button.style.transform = 'scale(1)'
        }, 1500)

        console.log(
          '[Emoji Extension Userscript] Manual injection failed: No compatible toolbars found'
        )
      }
    } catch (error) {
      // Error feedback
      button.innerHTML = '⚠️'
      button.style.background = 'linear-gradient(135deg, #ff6b6b 0%, #ffa8a8 100%)'

      setTimeout(() => {
        button.innerHTML = '🐈‍⬛'
        button.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
        button.style.transform = 'scale(1)'
      }, 1500)

      console.error('[Emoji Extension Userscript] Manual injection error:', error)
    }
  })

  return button
}

// Show floating button
export function showFloatingButton() {
  if (floatingButton) {
    return // Already shown
  }

  injectStyles()
  floatingButton = createFloatingButton()
  document.body.appendChild(floatingButton)
  isButtonVisible = true

  console.log('[Emoji Extension Userscript] Floating manual injection button shown')
}

// Hide floating button
export function hideFloatingButton() {
  if (floatingButton) {
    floatingButton.classList.add('hidden')

    setTimeout(() => {
      if (floatingButton) {
        floatingButton.remove()
        floatingButton = null
        isButtonVisible = false
      }
    }, 300)

    console.log('[Emoji Extension Userscript] Floating manual injection button hidden')
  }
}

// Toggle floating button visibility
export function toggleFloatingButton() {
  if (isButtonVisible) {
    hideFloatingButton()
  } else {
    showFloatingButton()
  }
}

// Auto-show floating button when no toolbars are found after multiple attempts
export function autoShowFloatingButton() {
  // Only show if not already visible and if injection seems to be failing
  if (!isButtonVisible) {
    console.log(
      '[Emoji Extension Userscript] Auto-showing floating button due to injection difficulties'
    )
    showFloatingButton()
  }
}

// Check if floating button should be shown based on page state
export function checkAndShowFloatingButton() {
  // Show floating button if no emoji buttons are currently injected
  const existingButtons = document.querySelectorAll('.emoji-extension-button')

  if (existingButtons.length === 0 && !isButtonVisible) {
    setTimeout(() => {
      autoShowFloatingButton()
    }, 2000) // Show after 2 seconds if still no buttons
  } else if (existingButtons.length > 0 && isButtonVisible) {
    hideFloatingButton() // Hide if buttons are now available
  }
}
