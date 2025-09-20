// Floating button module for manual injection
import { createEl } from '../utils/createEl'
import { injectGlobalThemeStyles } from '../utils/themeSupport'

import { attemptInjection } from './toolbar'

// State management for floating button
let floatingButton: HTMLElement | null = null
let isButtonVisible = false

// Styles for floating button with centralized theme support
const FLOATING_BUTTON_STYLES = `
.emoji-extension-floating-container {
  position: fixed !important;
  bottom: 20px !important;
  right: 20px !important;
  display: flex !important;
  flex-direction: column !important;
  gap: 10px !important;
  z-index: 999999 !important;
}

.emoji-extension-floating-button {
  width: 56px !important;
  height: 56px !important;
  border-radius: 50% !important;
  background: transparent;
  border: none !important;
  box-shadow: 0 4px 12px var(--emoji-button-shadow) !important;
  cursor: pointer !important;
  font-size: 24px !important;
  color: white !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  transition: all 0.2s ease !important;
  opacity: 0.95 !important;
}

.emoji-extension-floating-button:hover { 
  transform: scale(1.05) !important;
 }
.emoji-extension-floating-button:active { transform: scale(0.95) !important; }

.emoji-extension-floating-button.secondary {
  background: linear-gradient(135deg, #56ab2f 0%, #a8e6cf 100%) !important;
}

.emoji-extension-floating-button.hidden {
  opacity: 0 !important;
  pointer-events: none !important;
  transform: translateY(20px) !important;
}

@media (max-width: 768px) {
  .emoji-extension-floating-button { 
  width: 48px !important; 
  height: 48px !important; 
  font-size: 20px !important; }
  .emoji-extension-floating-container { bottom: 15px !important; right: 15px !important; }
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
    attrs: {
      id: 'emoji-extension-floating-button-styles'
    },
    text: FLOATING_BUTTON_STYLES
  })

  document.head.appendChild(style)
}

// Create manual floating button (bottom-right)
function createManualButton(): HTMLElement {
  const button = createEl('button', {
    className: 'emoji-extension-floating-button',
    title: '手动注入表情按钮 (Manual Emoji Injection)',
    innerHTML: '🐈‍⬛'
  }) as HTMLButtonElement

  // Manual injection handler (preserve previous behavior)
  button.addEventListener('click', async e => {
    e.stopPropagation()
    e.preventDefault()

    button.style.transform = 'scale(0.9)'
    button.innerHTML = '⏳'

    try {
      const result = attemptInjection()
      if (result.injectedCount > 0) {
        button.innerHTML = '✅'
        setTimeout(() => {
          button.innerHTML = '🐈‍⬛'
          button.style.transform = 'scale(1)'
        }, 1500)
      } else {
        button.innerHTML = '❌'
        setTimeout(() => {
          button.innerHTML = '🐈‍⬛'
          button.style.transform = 'scale(1)'
        }, 1500)
      }
    } catch (error) {
      button.innerHTML = '⚠️'
      setTimeout(() => {
        button.innerHTML = '🐈‍⬛'
        button.style.transform = 'scale(1)'
      }, 1500)
      console.error('[Emoji Extension Userscript] Manual injection error:', error)
    }
  })

  return button
}

// Create auto-read menu button (to inject into user menu)
// Create auto-read menu <li> item to insert into the "其他服务" dropdown
function createAutoReadMenuItem(): HTMLElement {
  const li = createEl('li', {
    // include both submenu-item and sidebar wrapper classes so the element
    // inherits styles in both dropdown and sidebar contexts
    className: 'submenu-item emoji-extension-auto-read sidebar-section-link-wrapper',
    // ensure the default list marker is hidden when inserted into a plain UL
    style: 'list-style: none; padding-left: 0;'
  }) as HTMLElement

  // Create a sidebar-style button when injecting into sidebar lists
  const btn = createEl('button', {
    className:
      'fk-d-menu__trigger sidebar-more-section-trigger sidebar-section-link sidebar-more-section-links-details-summary sidebar-row --link-button sidebar-section-link sidebar-row',
    attrs: {
      type: 'button',
      title: '像插件一样自动阅读话题 (Auto-read topics)',
      'aria-expanded': 'false',
      'data-identifier': 'emoji-ext-auto-read',
      'data-trigger': ''
    },
    innerHTML: `
      <span class="sidebar-section-link-prefix icon">
        <svg class="fa d-icon d-icon-book svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#book"></use></svg>
      </span>
      <span class="sidebar-section-link-content-text">自动阅读</span>
    `,
    style: `
    background: transparent; 
    border: none;
    `
  }) as HTMLButtonElement

  btn.addEventListener('click', async (e: Event) => {
    e.preventDefault()
    e.stopPropagation()

    try {
      // Prefer page-level wrapper
      // @ts-ignore
      const fn = (window as any).callAutoReadRepliesV2 || (window as any).autoReadAllRepliesV2
      if (fn && typeof fn === 'function') {
        // call without arguments to let v2 discover anchors
        await fn()
      } else {
        console.warn('[Emoji Extension] autoRead function not available on window')
        userscriptNotify('自动阅读功能当前不可用', 'error')
      }
    } catch (err) {
      console.error('[Emoji Extension] auto-read menu invocation failed', err)
      userscriptNotify(
        '自动阅读调用失败: ' + (err && (err as any).message ? (err as any).message : String(err)),
        'error'
      )
    }
  })

  li.appendChild(btn)
  return li
}

// Lightweight userscript-side notification (fallback when page notify is not present)
function userscriptNotify(
  message: string,
  type: 'info' | 'success' | 'error' = 'info',
  timeout = 4000
) {
  try {
    let container = document.getElementById('emoji-ext-userscript-toast') as HTMLElement | null
    if (!container) {
      container = createEl('div', {
        attrs: { id: 'emoji-ext-userscript-toast' },
        style: `position: fixed; right: 12px; bottom: 12px; z-index: 2147483646; display:flex; flex-direction:column; gap:8px;`
      }) as HTMLElement
      document.body.appendChild(container)
    }

    const el = createEl('div', {
      text: message,
      style: `padding:8px 12px; border-radius:6px; color:#fff; font-size:13px; max-width:320px; word-break:break-word; opacity:1;`
    }) as HTMLElement

    if (type === 'success') el.style.background = '#16a34a'
    else if (type === 'error') el.style.background = '#dc2626'
    else el.style.background = '#0369a1'

    container.appendChild(el)
    const id = setTimeout(() => {
      el.remove()
      clearTimeout(id)
    }, timeout)
    return () => {
      el.remove()
      clearTimeout(id)
    }
  } catch (_e) {
    // ignore
    return () => {}
  }
}

// Show floating button
export function showFloatingButton() {
  if (floatingButton) {
    return // Already shown
  }

  injectStyles()
  // create and append manual floating button to bottom-right
  const manual = createManualButton()
  const wrapper = createEl('div', {
    className: 'emoji-extension-floating-container'
  }) as HTMLElement
  wrapper.appendChild(manual)
  document.body.appendChild(wrapper)
  floatingButton = wrapper
  isButtonVisible = true
  console.log('[Emoji Extension Userscript] Floating manual injection button shown (bottom-right)')
}

async function injectIntoUserMenu(el: HTMLElement) {
  const SELECTOR_SIDEBAR = '#sidebar-section-content-community'
  const SELECTOR_OTHER_ANCHOR = 'a.menu-item[title="其他服务"], a.menu-item.vdm[title="其他服务"]'
  const SELECTOR_OTHER_DROPDOWN = '.d-header-dropdown .d-dropdown-menu'
  const SELECTOR_TOP = '.menu-tabs-container .top-tabs'
  const SELECTOR_CONTAINER = '.menu-tabs-container'

  for (;;) {
    // 0) Try to inject into the "其他服务" dropdown if present
    const otherAnchor = document.querySelector(SELECTOR_OTHER_ANCHOR) as HTMLElement | null
    if (otherAnchor) {
      const dropdown = otherAnchor.querySelector(SELECTOR_OTHER_DROPDOWN) as HTMLElement | null
      if (dropdown) {
        // If the element to insert is a <li>, append directly; otherwise wrap in li
        if (el.tagName.toLowerCase() === 'li') {
          dropdown.appendChild(el)
        } else {
          const wrapper = createEl('li', { className: 'submenu-item' }) as HTMLElement
          wrapper.appendChild(el)
          dropdown.appendChild(wrapper)
        }
        isButtonVisible = true
        console.log('[Emoji Extension Userscript] Auto-read injected into 其他服务 dropdown')
        return
      }
    }

    // 1) Priority: try the sidebar ul with id sidebar-section-content-community
    const sidebar = document.querySelector(SELECTOR_SIDEBAR) as HTMLElement | null
    if (sidebar) {
      // If the element to insert is a <li>, append directly; otherwise wrap in li
      if (el.tagName.toLowerCase() === 'li') {
        sidebar.appendChild(el)
      } else {
        const wrapper = createEl('li', { className: 'sidebar-section-link-wrapper' }) as HTMLElement
        wrapper.appendChild(el)
        sidebar.appendChild(wrapper)
      }
      isButtonVisible = true
      console.log(
        '[Emoji Extension Userscript] Auto-read injected into sidebar #sidebar-section-content-community'
      )
      return
    }

    // 2) Fallback: try top-tabs
    const top = document.querySelector(SELECTOR_TOP) as HTMLElement | null
    if (top) {
      top.appendChild(el)
      isButtonVisible = true
      console.log('[Emoji Extension Userscript] Floating button injected into top-tabs')
      return
    }

    // 3) Fallback: try container
    const container = document.querySelector(SELECTOR_CONTAINER) as HTMLElement | null
    if (container) {
      container.appendChild(el)
      isButtonVisible = true
      console.log('[Emoji Extension Userscript] Floating button injected into menu-tabs-container')
      return
    }

    // wait 500ms then retry
    await new Promise(resolve => setTimeout(resolve, 500))
  }
}

// Show auto-read button inside user menu (polls every 500ms until inserted)
export async function showAutoReadInMenu() {
  injectStyles()
  // Prefer inserting a menu-style item into the "其他服务" dropdown
  const menuItem = createAutoReadMenuItem()
  try {
    await injectIntoUserMenu(menuItem)
    return
  } catch (e) {
    console.warn('[Emoji Extension Userscript] injecting menu item failed', e)
  }
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
