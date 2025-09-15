// Toolbar injection and button management module
import { createEmojiPicker } from './emojiPicker'

// Find toolbars where we can inject buttons
const toolbarSelectors = ['.d-editor-button-bar[role="toolbar"]', '.chat-composer__inner-container']

export function findAllToolbars(): HTMLElement[] {
  const toolbars: HTMLElement[] = []
  for (const selector of toolbarSelectors) {
    const elements = document.querySelectorAll(selector)
    toolbars.push(...(Array.from(elements) as HTMLElement[]))
  }
  return toolbars
}

// Current picker management
let currentPicker: HTMLElement | null = null

export function closeCurrentPicker() {
  if (currentPicker) {
    currentPicker.remove()
    currentPicker = null
  }
}

// Inject emoji button into toolbar
export function injectEmojiButton(toolbar: HTMLElement) {
  if (toolbar.querySelector('.emoji-extension-button')) {
    return // Already injected
  }

  const isChatComposer = toolbar.classList.contains('chat-composer__inner-container')

  const button = document.createElement('button')
  button.classList.add(
    'btn',
    'no-text',
    'btn-icon',
    'toolbar__button',
    'nacho-emoji-picker-button',
    'emoji-extension-button'
  )

  if (isChatComposer) {
    button.classList.add(
      'fk-d-menu__trigger',
      'emoji-picker-trigger',
      'chat-composer-button',
      'btn-transparent',
      '-emoji'
    )
    button.setAttribute('aria-expanded', 'false')
    button.setAttribute('data-identifier', 'emoji-picker')
    button.setAttribute('data-trigger', '')
  }

  button.title = '表情包'
  button.type = 'button'
  button.innerHTML = '🐈‍⬛'

  button.addEventListener('click', async e => {
    e.stopPropagation()

    if (currentPicker) {
      closeCurrentPicker()
      return
    }

    currentPicker = await createEmojiPicker()
    if (!currentPicker) return

    document.body.appendChild(currentPicker)

    const buttonRect = button.getBoundingClientRect()
    // If mobile-style modal (full-screen) then keep default modal behavior.
    const isModal =
      currentPicker.classList.contains('modal') || currentPicker.className.includes('d-modal')

    if (isModal) {
      // Ensure modal fills or centers appropriately (modal CSS should handle layout)
      currentPicker.style.position = 'fixed'
      currentPicker.style.top = '0'
      currentPicker.style.left = '0'
      currentPicker.style.right = '0'
      currentPicker.style.bottom = '0'
      currentPicker.style.zIndex = '999999'
    } else {
      // Floating picker: position adaptively. Keep it inside viewport and prefer below button.
      currentPicker.style.position = 'fixed'
      // give the browser one paint to compute size
      const margin = 8
      const vpWidth = window.innerWidth
      const vpHeight = window.innerHeight

      // temporary place below to measure
      currentPicker.style.top = buttonRect.bottom + margin + 'px'
      currentPicker.style.left = buttonRect.left + 'px'

      // Measure after appended
      const pickerRect = currentPicker.getBoundingClientRect()
      const spaceBelow = vpHeight - buttonRect.bottom
      const neededHeight = pickerRect.height + margin
      let top = buttonRect.bottom + margin
      if (spaceBelow < neededHeight) {
        // place above the button
        top = Math.max(margin, buttonRect.top - pickerRect.height - margin)
      }
      // Keep left within viewport
      let left = buttonRect.left
      if (left + pickerRect.width + margin > vpWidth) {
        left = Math.max(margin, vpWidth - pickerRect.width - margin)
      }
      if (left < margin) left = margin

      currentPicker.style.top = top + 'px'
      currentPicker.style.left = left + 'px'
    }

    // Close on outside click
    setTimeout(() => {
      const handleClick = (e: Event) => {
        if (currentPicker && !currentPicker.contains(e.target as Node) && e.target !== button) {
          closeCurrentPicker()
          document.removeEventListener('click', handleClick)
        }
      }
      document.addEventListener('click', handleClick)
    }, 100)
  })

  try {
    // Try to insert in the right place
    if (isChatComposer) {
      const existingEmojiTrigger = toolbar.querySelector(
        '.emoji-picker-trigger:not(.emoji-extension-button)'
      )
      if (existingEmojiTrigger) {
        toolbar.insertBefore(button, existingEmojiTrigger)
      } else {
        toolbar.appendChild(button)
      }
    } else {
      toolbar.appendChild(button)
    }
  } catch (error) {
    console.error('[Emoji Extension Userscript] Failed to inject button:', error)
  }
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
  }, 30000)
}
