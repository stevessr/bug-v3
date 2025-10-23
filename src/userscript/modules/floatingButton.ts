// Floating button module for manual injection
import { createEl } from '../utils/createEl'
import { injectGlobalThemeStyles } from '../utils/themeSupport'
import { userscriptNotify } from '../utils/notify'
import { userscriptState } from '../state'

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
import { ensureStyleInjected } from '../utils/injectStyles'

function injectStyles() {
  // Inject global theme variables first
  injectGlobalThemeStyles()
  ensureStyleInjected('emoji-extension-floating-button-styles', FLOATING_BUTTON_STYLES)
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

// invokeAutoRead: shared logic to call page-level auto-read function
async function invokeAutoRead(showNotify = false) {
  try {
    // Prefer page-level wrapper
    // @ts-ignore
    const fn = (window as any).callAutoReadRepliesV2 || (window as any).autoReadAllRepliesV2
    console.log(
      '[Emoji Extension] invokeAutoRead: found fn=',
      !!fn,
      ' typeof=',
      typeof fn,
      ' showNotify=',
      showNotify
    )
    if (fn && typeof fn === 'function') {
      // call without arguments to let v2 discover anchors
      const res = await fn()
      console.log('[Emoji Extension] invokeAutoRead: fn returned', res)
      // if caller requested a visible notify on success, show one
      if (showNotify) userscriptNotify('自动阅读已触发', 'success')
    } else {
      console.warn('[Emoji Extension] autoRead function not available on window')
      // always log and attempt to notify so we can verify userscriptNotify path
      console.log('[Emoji Extension] invokeAutoRead: attempting userscriptNotify fallback')
      userscriptNotify('自动阅读功能当前不可用', 'error')
    }
  } catch (err) {
    console.error('[Emoji Extension] auto-read menu invocation failed', err)
    if (showNotify)
      userscriptNotify(
        '自动阅读调用失败: ' + (err && (err as any).message ? (err as any).message : String(err)),
        'error'
      )
  }
}

// Create auto-read menu item. Variant controls output shape:
// 'dropdown' -> <li><a class="submenu-link">...</a></li>
// 'sidebar'  -> <li class="...sidebar-section-link-wrapper"><button ...>...</button></li>
function createAutoReadMenuItem(variant: 'dropdown' | 'sidebar' = 'dropdown'): HTMLElement {
  if (variant === 'dropdown') {
    const li = createEl('li', {
      className: 'submenu-item emoji-extension-auto-read'
    }) as HTMLElement

    const a = createEl('a', {
      className: 'submenu-link',
      attrs: {
        href: '#',
        title: '像插件一样自动阅读话题 (Auto-read topics)'
      },
      innerHTML: `
      <svg class="fa d-icon d-icon-book svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#book"></use></svg>
      自动阅读
    `
    }) as HTMLAnchorElement

    a.addEventListener('click', async (e: Event) => {
      e.preventDefault()
      e.stopPropagation()
      await invokeAutoRead(true)
    })

    li.appendChild(a)
    return li
  }

  // sidebar variant
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
    await invokeAutoRead(true)
  })

  li.appendChild(btn)
  return li
}

// Lightweight userscript-side notification (fallback when page notify is not present)
// userscriptNotify provided by utils/notify

// Show floating button
export function showFloatingButton() {
  // Don't show floating button if force mobile mode with d-menu-portals is active
  const forceMobileMode = userscriptState.settings?.forceMobileMode || false
  if (forceMobileMode) {
    const portalContainer = document.querySelector('#d-menu-portals')
    if (portalContainer) {
      console.log('[Emoji Extension Userscript] Force mobile mode with #d-menu-portals detected, skipping floating button')
      return
    }
  }

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

async function injectIntoUserMenu() {
  const SELECTOR_SIDEBAR = '#sidebar-section-content-community'
  const SELECTOR_OTHER_ANCHOR = 'a.menu-item[title="其他服务"], a.menu-item.vdm[title="其他服务"]'
  const SELECTOR_OTHER_DROPDOWN = '.d-header-dropdown .d-dropdown-menu'

  for (;;) {
    // 0) Try to inject into the "其他服务" dropdown if present
    const otherAnchor = document.querySelector(SELECTOR_OTHER_ANCHOR) as HTMLElement | null
    if (otherAnchor) {
      const dropdown = otherAnchor.querySelector(SELECTOR_OTHER_DROPDOWN) as HTMLElement | null
      if (dropdown) {
        dropdown.appendChild(createAutoReadMenuItem('dropdown'))
        isButtonVisible = true
        console.log('[Emoji Extension Userscript] Auto-read injected into 其他服务 dropdown')
        return
      }
    }

    // 1) Priority: try the sidebar ul with id sidebar-section-content-community
    const sidebar = document.querySelector(SELECTOR_SIDEBAR) as HTMLElement | null
    if (sidebar) {
      sidebar.appendChild(createAutoReadMenuItem('sidebar'))
      isButtonVisible = true
      console.log(
        '[Emoji Extension Userscript] Auto-read injected into sidebar #sidebar-section-content-community'
      )
      return
    }

    // wait 500ms then retry
    await new Promise(resolve => setTimeout(resolve, 500))
  }
}

// Show auto-read button inside user menu (polls every 500ms until inserted)
export async function showAutoReadInMenu() {
  injectStyles()
  try {
    await injectIntoUserMenu()
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
  // Don't show floating button if force mobile mode with d-menu-portals is active
  const forceMobileMode = userscriptState.settings?.forceMobileMode || false
  if (forceMobileMode) {
    const portalContainer = document.querySelector('#d-menu-portals')
    if (portalContainer) {
      // Hide floating button if it's currently visible
      if (isButtonVisible) {
        hideFloatingButton()
      }
      return
    }
  }

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
