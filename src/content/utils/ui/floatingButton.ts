// Floating button module for manual injection (content script version)

import { findAllToolbars, injectButton } from '../injector'
import { DOA, DQSA, createE } from '../dom/createEl'

import { ESI } from '@/content/utils/injectCustomCss'

// State management for floating button
let floatingButton: HTMLElement | null = null
let isButtonVisible = false

/** 存储所有 setTimeout ID 以便清理 */
const timeoutIds = new Set<ReturnType<typeof setTimeout>>()

/** 常量定义 */
const FEEDBACK_DISPLAY_MS = 1500
const HIDE_ANIMATION_MS = 300
const AUTO_SHOW_DELAY_MS = 2000

const BUTTON_STYLE_SUCCESS = 'linear-gradient(135deg, #56ab2f 0%, #a8e6cf 100%)'
const BUTTON_STYLE_ERROR = 'linear-gradient(135deg, #ff6b6b 0%, #ffa8a8 100%)'
const BUTTON_TRANSPARENT = 'transparent'

// Styles for floating button
const FLOATING_BUTTON_STYLES = `
.emoji-extension-floating-button {
  position: fixed !important;
  bottom: 20px !important;
  right: 20px !important;
  width: 56px !important;
  height: 56px !important;
  border-radius: 50% !important;
  background: transparent;
  border: none !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
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
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2) !important;
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

// Create and inject styles
function injectStyles() {
  ESI('emoji-extension-floating-button-styles', FLOATING_BUTTON_STYLES)
}

/**
 * 设置按钮反馈样式
 */
function setButtonFeedback(
  button: HTMLElement,
  icon: string,
  background: string,
  transform: string = 'scale(1)'
): void {
  button.textContent = icon
  button.style.background = background
  button.style.transform = transform

  const timeoutId = setTimeout(() => {
    button.textContent = '🐈‍⬛'
    button.style.background = BUTTON_TRANSPARENT
    button.style.transform = 'scale(1)'
  }, FEEDBACK_DISPLAY_MS)

  timeoutIds.add(timeoutId)
}

// Create floating button element
function createFloatingButton(): HTMLElement {
  const button = createE('button', {
    class: 'emoji-extension-floating-button',
    ti: '手动注入表情按钮 (Manual Emoji Injection)',
    text: '🐈‍⬛'
  })

  // Click handler for manual injection
  const clickHandler = async (e: Event) => {
    ;(e as MouseEvent).stopPropagation()
    ;(e as Event).preventDefault()

    // Visual feedback
    button.style.transform = 'scale(0.9)'
    button.textContent = '⏳'

    try {
      // Attempt manual injection
      const toolbars = findAllToolbars()
      let injectedCount = 0

      toolbars.forEach(toolbar => {
        if (
          !toolbar.querySelector('.emoji-extension-button') &&
          !toolbar.querySelector('.image-upload-button')
        ) {
          console.log('[Emoji Extension] Manual injection: Toolbar found, injecting buttons.')
          injectButton(toolbar)
          injectedCount++
        }
      })

      if (injectedCount > 0 || toolbars.length > 0) {
        // Success feedback
        setButtonFeedback(button, '✅', BUTTON_STYLE_SUCCESS)

        console.log(
          `[Emoji Extension] Manual injection successful: ${injectedCount} buttons injected into ${toolbars.length} toolbars`
        )
      } else {
        // No toolbars found feedback
        setButtonFeedback(button, '❌', BUTTON_STYLE_ERROR)

        console.log('[Emoji Extension] Manual injection failed: No compatible toolbars found')
      }
    } catch (error) {
      // Error feedback
      setButtonFeedback(button, '⚠️', BUTTON_STYLE_ERROR)

      console.error('[Emoji Extension] Manual injection error:', error)
    }
  }

  button.addEventListener('click', clickHandler)

  // 存储 cleanup 函数
  timeoutIds.add(
    setTimeout(() => {
      // 延迟存储 cleanup，确保组件销毁时能正确清理
      const cleanup = () => {
        button.removeEventListener('click', clickHandler)
      }
      button.addEventListener('remove', () => cleanup(), { once: true })
    }, 0)
  )

  return button
}

// Show floating button
export function showFloatingButton() {
  if (floatingButton) {
    return // Already shown
  }

  injectStyles()
  floatingButton = createFloatingButton()
  DOA(floatingButton)
  isButtonVisible = true

  console.log('[Emoji Extension] Floating manual injection button shown')
}

// Hide floating button
function hideFloatingButton() {
  if (floatingButton) {
    floatingButton.classList.add('hidden')

    const timeoutId = setTimeout(() => {
      if (floatingButton) {
        floatingButton.remove()
        floatingButton = null
        isButtonVisible = false
      }
    }, HIDE_ANIMATION_MS)

    timeoutIds.add(timeoutId)

    console.log('[Emoji Extension] Floating manual injection button hidden')
  }
}

// Auto-show floating button when no toolbars are found after multiple attempts
function autoShowFloatingButton() {
  // Only show if not already visible and if injection seems to be failing
  if (!isButtonVisible) {
    console.log('[Emoji Extension] Auto-showing floating button due to injection difficulties')
    showFloatingButton()
  }
}

// Check if floating button should be shown based on page state
export function checkAndShowFloatingButton() {
  // Show floating button if no emoji buttons are currently injected
  const existingButtons = DQSA('.emoji-extension-button, .image-upload-button')

  if (existingButtons.length === 0 && !isButtonVisible) {
    const timeoutId = setTimeout(() => {
      autoShowFloatingButton()
    }, AUTO_SHOW_DELAY_MS)
    timeoutIds.add(timeoutId)
  } else if (existingButtons.length > 0 && isButtonVisible) {
    hideFloatingButton() // Hide if buttons are now available
  }
}

/**
 * 清理函数 - 清理所有定时器和事件监听器
 */
export function cleanupFloatingButton(): void {
  // 清理所有 setTimeout
  timeoutIds.forEach(id => clearTimeout(id))
  timeoutIds.clear()

  // 移除浮动按钮
  if (floatingButton) {
    floatingButton.remove()
    floatingButton = null
    isButtonVisible = false
  }
}
