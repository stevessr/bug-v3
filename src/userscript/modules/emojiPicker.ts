// Emoji picker creation and management module
import { userscriptState } from '../state'
import { trackEmojiUsage } from '../userscript-storage'
import { createEl } from '../utils/createEl'
import { getEffectivePlatform } from '../utils/platformDetection'
import { ensureHoverPreview } from '../utils/hoverPreview'

import { injectEmojiPickerStyles } from './emojiPickerStyles'

import { isImageUrl } from '@/utils/isImageUrl'

// Mobile detection helper - now uses platform detection
export function isMobileView(): boolean {
  try {
    const platform = getEffectivePlatform()
    return (
      platform === 'mobile' ||
      !!(userscriptState && userscriptState.settings && userscriptState.settings.forceMobileMode)
    )
  } catch (e) {
    return false
  }
}

// Insert emoji into editor
export function insertEmojiIntoEditor(emoji: any) {
  console.log('[Emoji Extension Userscript] Inserting emoji:', emoji)

  // Track emoji usage
  if (emoji.name && emoji.url) {
    trackEmojiUsage(emoji.name, emoji.url)
  }

  // Try several selectors as fallback targets to support chat composer variants
  const selectors = [
    'textarea.d-editor-input',
    'textarea.ember-text-area',
    '#channel-composer',
    '.chat-composer__input',
    'textarea.chat-composer__input'
  ]

  const proseMirror = document.querySelector('.ProseMirror.d-editor-input') as HTMLElement | null

  let textarea: HTMLTextAreaElement | null = null
  for (const s of selectors) {
    const el = document.querySelector(s) as HTMLTextAreaElement | null
    if (el) {
      textarea = el
      break
    }
  }

  const contentEditable = document.querySelector('[contenteditable="true"]') as HTMLElement | null

  if (!textarea && !proseMirror && !contentEditable) {
    console.error('找不到输入框')
    return
  }

  // Extract dimensions from URL or use defaults
  const dimensionMatch = emoji.url?.match(/_(\d{3,})x(\d{3,})\./)
  let width = '500'
  let height = '500'

  if (dimensionMatch) {
    width = dimensionMatch[1]
    height = dimensionMatch[2]
  } else if (emoji.width && emoji.height) {
    width = emoji.width.toString()
    height = emoji.height.toString()
  }

  const scale = userscriptState.settings?.imageScale || 30
  const outputFormat = userscriptState.settings?.outputFormat || 'markdown'

  if (textarea) {
    let insertText = ''

    if (outputFormat === 'html') {
      const scaledWidth = Math.max(1, Math.round(Number(width) * (scale / 100)))
      const scaledHeight = Math.max(1, Math.round(Number(height) * (scale / 100)))
      insertText = `<img src="${emoji.url}" title=":${emoji.name}:" class="emoji only-emoji" alt=":${emoji.name}:" loading="lazy" width="${scaledWidth}" height="${scaledHeight}" style="aspect-ratio: ${scaledWidth} / ${scaledHeight};"> `
    } else {
      insertText = `![${emoji.name}|${width}x${height},${scale}%](${emoji.url}) `
    }

    const selectionStart = textarea.selectionStart
    const selectionEnd = textarea.selectionEnd
    textarea.value =
      textarea.value.substring(0, selectionStart) +
      insertText +
      textarea.value.substring(selectionEnd, textarea.value.length)
    textarea.selectionStart = textarea.selectionEnd = selectionStart + insertText.length
    textarea.focus()

    // Trigger input event
    const inputEvent = new Event('input', { bubbles: true, cancelable: true })
    textarea.dispatchEvent(inputEvent)
  } else if (proseMirror) {
    const imgWidth = Number(width) || 500
    const scaledWidth = Math.max(1, Math.round(imgWidth * (scale / 100)))
    const htmlContent = `<img src="${emoji.url}" alt="${emoji.name}" width="${width}" height="${height}" data-scale="${scale}" style="width: ${scaledWidth}px">`

    try {
      // Try clipboard approach first
      const dataTransfer = new DataTransfer()
      dataTransfer.setData('text/html', htmlContent)
      const pasteEvent = new ClipboardEvent('paste', { clipboardData: dataTransfer, bubbles: true })
      proseMirror.dispatchEvent(pasteEvent)
    } catch (error) {
      try {
        // Fallback to execCommand
        document.execCommand('insertHTML', false, htmlContent)
      } catch (fallbackError) {
        console.error('无法向富文本编辑器中插入表情', fallbackError)
      }
    }
  } else if (contentEditable) {
    try {
      if (outputFormat === 'html') {
        const imgWidth = Number(width) || 500
        const scaledWidth = Math.max(1, Math.round(imgWidth * (scale / 100)))
        const htmlContent = `<img src="${emoji.url}" alt="${emoji.name}" width="${width}" height="${height}" data-scale="${scale}" style="width: ${scaledWidth}px"> `
        const sel = window.getSelection()
        if (sel && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0)
          const frag = document.createRange().createContextualFragment(htmlContent)
          range.deleteContents()
          range.insertNode(frag)
          range.collapse(false)
          sel.removeAllRanges()
          sel.addRange(range)
        } else {
          contentEditable.insertAdjacentHTML('beforeend', htmlContent)
        }
      } else {
        const insertText = `![${emoji.name}|${width}x${height},${scale}%](${emoji.url}) `
        const textNode = document.createTextNode(insertText)
        const sel = window.getSelection()
        if (sel && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0)
          range.deleteContents()
          range.insertNode(textNode)
          range.setStartAfter(textNode)
          range.collapse(true)
          sel.removeAllRanges()
          sel.addRange(range)
        } else {
          contentEditable.appendChild(textNode)
        }
      }
      const inputEvent = new Event('input', { bubbles: true, cancelable: true })
      contentEditable.dispatchEvent(inputEvent)
    } catch (e) {
      console.error('无法向 contenteditable 插入表情', e)
    }
  }
}

// use shared ensureHoverPreview from utils/hoverPreview.ts

// Create mobile-style emoji picker modal
function createMobileEmojiPicker(groups: any[]): HTMLElement {
  const modal = createEl('div', {
    className: 'modal d-modal fk-d-menu-modal emoji-picker-content',
    attrs: {
      'data-identifier': 'emoji-picker',
      'data-keyboard': 'false',
      'aria-modal': 'true',
      role: 'dialog'
    }
  }) as HTMLDivElement

  const modalContainerDiv = createEl('div', { className: 'd-modal__container' }) as HTMLDivElement

  const modalBody = createEl('div', { className: 'd-modal__body' }) as HTMLDivElement
  modalBody.tabIndex = -1

  const emojiPickerDiv = createEl('div', { className: 'emoji-picker' }) as HTMLDivElement

  const filterContainer = createEl('div', {
    className: 'emoji-picker__filter-container'
  }) as HTMLDivElement

  const filterInputContainer = createEl('div', {
    className: 'emoji-picker__filter filter-input-container'
  }) as HTMLDivElement

  const filterInput = createEl('input', {
    className: 'filter-input',
    placeholder: '按表情符号名称搜索…',
    type: 'text'
  }) as HTMLInputElement
  filterInputContainer.appendChild(filterInput)

  const closeButton = createEl('button', {
    className: 'btn no-text btn-icon btn-transparent emoji-picker__close-btn',
    type: 'button',
    innerHTML: `<svg class="fa d-icon d-icon-xmark svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#xmark"></use></svg>`,
    on: {
      click: () => {
        ;(modal.closest('.modal-container') || modal)?.remove()
        document.querySelector('.d-modal__backdrop')?.remove()
      }
    }
  }) as HTMLButtonElement

  filterContainer.appendChild(filterInputContainer)
  filterContainer.appendChild(closeButton)

  const content = createEl('div', { className: 'emoji-picker__content' }) as HTMLDivElement

  const sectionsNav = createEl('div', { className: 'emoji-picker__sections-nav' }) as HTMLDivElement

  const scrollableContent = createEl('div', {
    className: 'emoji-picker__scrollable-content'
  }) as HTMLDivElement

  const sections = createEl('div', {
    className: 'emoji-picker__sections',
    attrs: { role: 'button' }
  }) as HTMLDivElement

  groups.forEach((group: any, index: number) => {
    if (!group?.emojis?.length) return

    const navButton = createEl('button', {
      className: `btn no-text btn-flat emoji-picker__section-btn ${index === 0 ? 'active' : ''}`,
      attrs: { tabindex: '-1', 'data-section': group.id, type: 'button' }
    }) as HTMLButtonElement

    const iconVal = group.icon || '📁'
    if (isImageUrl(iconVal)) {
      const img = createEl('img', {
        src: iconVal,
        alt: group.name || '',
        className: 'emoji',
        style: 'width: 18px; height: 18px; object-fit: contain;'
      }) as HTMLImageElement
      navButton.appendChild(img)
    } else {
      navButton.textContent = String(iconVal)
    }
    navButton.title = group.name
    navButton.addEventListener('click', () => {
      sectionsNav
        .querySelectorAll('.emoji-picker__section-btn')
        .forEach(btn => btn.classList.remove('active'))
      navButton.classList.add('active')
      const target = sections.querySelector(`[data-section="${group.id}"]`)
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
    sectionsNav.appendChild(navButton)

    const section = createEl('div', {
      className: 'emoji-picker__section',
      attrs: { 'data-section': group.id, role: 'region', 'aria-label': group.name }
    }) as HTMLDivElement

    const titleContainer = createEl('div', {
      className: 'emoji-picker__section-title-container'
    }) as HTMLDivElement

    titleContainer.appendChild(
      createEl('h2', {
        className: 'emoji-picker__section-title',
        text: group.name
      })
    )

    const sectionEmojis = createEl('div', {
      className: 'emoji-picker__section-emojis'
    }) as HTMLDivElement

    group.emojis.forEach((emoji: any) => {
      if (!emoji || typeof emoji !== 'object' || !emoji.url || !emoji.name) return
      const img = createEl('img', {
        src: emoji.url,
        alt: emoji.name,
        className: 'emoji',
        title: `:${emoji.name}:`,
        style: 'width: 32px; height: 32px; object-fit: contain;',
        attrs: { 'data-emoji': emoji.name, tabindex: '0', loading: 'lazy' }
      }) as HTMLImageElement
      // hover preview bindings
      ;(function bindHover(imgEl: HTMLImageElement, emo: any) {
        // Only create preview if setting is enabled
        if (!userscriptState.settings?.enableFloatingPreview) return

        const preview = ensureHoverPreview()
        const previewImg = preview.querySelector('img') as HTMLImageElement
        const previewLabel = preview.querySelector('.emoji-picker-hover-label') as HTMLDivElement
        let fadeTimer: number | null = null

        function onEnter(e: MouseEvent) {
          previewImg.src = emo.url
          previewLabel.textContent = emo.name || ''
          preview.style.display = 'block'
          preview.style.opacity = '1'
          preview.style.transition = 'opacity 0.12s ease, transform 0.12s ease'

          // Clear any existing fade timer
          if (fadeTimer) {
            clearTimeout(fadeTimer)
            fadeTimer = null
          }

          // Start 5-second fade timer
          fadeTimer = window.setTimeout(() => {
            preview.style.opacity = '0'
            setTimeout(() => {
              if (preview.style.opacity === '0') {
                preview.style.display = 'none'
              }
            }, 300)
          }, 5000)

          move(e)
        }
        function move(e: MouseEvent) {
          const pad = 12
          const vw = window.innerWidth
          const vh = window.innerHeight
          const rect = preview.getBoundingClientRect()
          let left = e.clientX + pad
          let top = e.clientY + pad
          if (left + rect.width > vw) left = e.clientX - rect.width - pad
          if (top + rect.height > vh) top = e.clientY - rect.height - pad
          preview.style.left = left + 'px'
          preview.style.top = top + 'px'
        }
        function onLeave() {
          // Clear fade timer and hide immediately on mouse leave
          if (fadeTimer) {
            clearTimeout(fadeTimer)
            fadeTimer = null
          }
          preview.style.display = 'none'
        }
        imgEl.addEventListener('mouseenter', onEnter)
        imgEl.addEventListener('mousemove', move)
        imgEl.addEventListener('mouseleave', onLeave)
      })(img, emoji)
      img.addEventListener('click', () => {
        insertEmojiIntoEditor(emoji)
        // Only remove the modal element itself; keep surrounding `.modal-container`
        if (modal.parentElement) modal.parentElement.removeChild(modal)
      })
      img.addEventListener('keydown', (e: any) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          insertEmojiIntoEditor(emoji)
          // Only remove the modal element itself; keep surrounding `.modal-container`
          if (modal.parentElement) modal.parentElement.removeChild(modal)
        }
      })
      sectionEmojis.appendChild(img)
    })

    section.appendChild(titleContainer)
    section.appendChild(sectionEmojis)
    sections.appendChild(section)
  })

  filterInput.addEventListener('input', (e: any) => {
    const q = (e.target.value || '').toLowerCase()
    sections.querySelectorAll('img').forEach(img => {
      const emojiName = (img.dataset.emoji || '').toLowerCase()
      ;(img as HTMLElement).style.display = q === '' || emojiName.includes(q) ? '' : 'none'
    })
    sections.querySelectorAll('.emoji-picker__section').forEach(section => {
      const visibleEmojis = section.querySelectorAll('img:not([style*="display: none"])')
      ;(section as HTMLElement).style.display = visibleEmojis.length > 0 ? '' : 'none'
    })
  })

  scrollableContent.appendChild(sections)
  content.appendChild(sectionsNav)
  content.appendChild(scrollableContent)
  emojiPickerDiv.appendChild(filterContainer)
  emojiPickerDiv.appendChild(content)
  modalBody.appendChild(emojiPickerDiv)
  modalContainerDiv.appendChild(modalBody)
  modal.appendChild(modalContainerDiv)

  return modal
}

// Create desktop-style floating emoji picker
function createDesktopEmojiPicker(groups: any[]): HTMLElement {
  const picker = createEl('div', {
    className: 'fk-d-menu -animated -expanded',
    style: 'max-width: 400px; visibility: visible; z-index: 999999;',
    attrs: { 'data-identifier': 'emoji-picker', role: 'dialog' }
  }) as HTMLDivElement

  const innerContent = createEl('div', { className: 'fk-d-menu__inner-content' }) as HTMLDivElement
  const emojiPickerDiv = createEl('div', { className: 'emoji-picker' }) as HTMLDivElement

  const filterContainer = createEl('div', {
    className: 'emoji-picker__filter-container'
  }) as HTMLDivElement
  const filterDiv = createEl('div', {
    className: 'emoji-picker__filter filter-input-container'
  }) as HTMLDivElement
  const searchInput = createEl('input', {
    className: 'filter-input',
    placeholder: '按表情符号名称搜索…',
    type: 'text'
  }) as HTMLInputElement
  filterDiv.appendChild(searchInput)
  filterContainer.appendChild(filterDiv)

  const content = createEl('div', { className: 'emoji-picker__content' }) as HTMLDivElement
  const sectionsNav = createEl('div', { className: 'emoji-picker__sections-nav' }) as HTMLDivElement

  const scrollableContent = createEl('div', {
    className: 'emoji-picker__scrollable-content'
  }) as HTMLDivElement
  const sections = createEl('div', {
    className: 'emoji-picker__sections',
    attrs: { role: 'button' }
  }) as HTMLDivElement

  groups.forEach((group: any, index: number) => {
    if (!group?.emojis?.length) return

    const navButton = createEl('button', {
      className: `btn no-text btn-flat emoji-picker__section-btn ${index === 0 ? 'active' : ''}`,
      attrs: { tabindex: '-1', 'data-section': group.id },
      type: 'button'
    }) as HTMLButtonElement

    const iconVal = group.icon || '📁'
    if (isImageUrl(iconVal)) {
      const img = createEl('img', {
        src: iconVal,
        alt: group.name || '',
        className: 'emoji-group-icon',
        style: 'width: 18px; height: 18px; object-fit: contain;'
      }) as HTMLImageElement
      navButton.appendChild(img)
    } else {
      navButton.textContent = String(iconVal)
    }
    navButton.title = group.name
    navButton.addEventListener('click', () => {
      sectionsNav
        .querySelectorAll('.emoji-picker__section-btn')
        .forEach(btn => btn.classList.remove('active'))
      navButton.classList.add('active')
      const target = sections.querySelector(`[data-section="${group.id}"]`)
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
    sectionsNav.appendChild(navButton)

    const section = createEl('div', {
      className: 'emoji-picker__section',
      attrs: {
        'data-section': group.id,
        role: 'region',
        'aria-label': group.name
      }
    }) as HTMLDivElement

    const titleContainer = createEl('div', {
      className: 'emoji-picker__section-title-container'
    }) as HTMLDivElement
    const title = createEl('h2', {
      className: 'emoji-picker__section-title',
      text: group.name
    }) as HTMLHeadingElement
    titleContainer.appendChild(title)

    const sectionEmojis = createEl('div', {
      className: 'emoji-picker__section-emojis'
    }) as HTMLDivElement

    let added = 0
    group.emojis.forEach((emoji: any) => {
      if (!emoji || typeof emoji !== 'object' || !emoji.url || !emoji.name) return
      const img = createEl('img', {
        width: '32px',
        height: '32px',
        className: 'emoji',
        src: emoji.url,
        alt: emoji.name,
        title: `:${emoji.name}:`,
        attrs: {
          'data-emoji': emoji.name,
          tabindex: '0',
          loading: 'lazy'
        }
      }) as HTMLImageElement
      // hover preview bindings (desktop picker)
      ;(function bindHover(imgEl: HTMLImageElement, emo: any) {
        // Only create preview if setting is enabled
        if (!userscriptState.settings?.enableFloatingPreview) return

        const preview = ensureHoverPreview()
        const previewImg = preview.querySelector('img') as HTMLImageElement
        const previewLabel = preview.querySelector('.emoji-picker-hover-label') as HTMLDivElement
        let fadeTimer: number | null = null

        function onEnter(e: MouseEvent) {
          previewImg.src = emo.url
          previewLabel.textContent = emo.name || ''
          preview.style.display = 'block'
          preview.style.opacity = '1'
          preview.style.transition = 'opacity 0.12s ease, transform 0.12s ease'

          // Clear any existing fade timer
          if (fadeTimer) {
            clearTimeout(fadeTimer)
            fadeTimer = null
          }

          // Start 5-second fade timer
          fadeTimer = window.setTimeout(() => {
            preview.style.opacity = '0'
            setTimeout(() => {
              if (preview.style.opacity === '0') {
                preview.style.display = 'none'
              }
            }, 300)
          }, 5000)

          move(e)
        }
        function move(e: MouseEvent) {
          const pad = 12
          const vw = window.innerWidth
          const vh = window.innerHeight
          const rect = preview.getBoundingClientRect()
          let left = e.clientX + pad
          let top = e.clientY + pad
          if (left + rect.width > vw) left = e.clientX - rect.width - pad
          if (top + rect.height > vh) top = e.clientY - rect.height - pad
          preview.style.left = left + 'px'
          preview.style.top = top + 'px'
        }
        function onLeave() {
          // Clear fade timer and hide immediately on mouse leave
          if (fadeTimer) {
            clearTimeout(fadeTimer)
            fadeTimer = null
          }
          preview.style.display = 'none'
        }
        imgEl.addEventListener('mouseenter', onEnter)
        imgEl.addEventListener('mousemove', move)
        imgEl.addEventListener('mouseleave', onLeave)
      })(img, emoji)
      img.addEventListener('click', () => {
        insertEmojiIntoEditor(emoji)
        picker.remove()
      })
      img.addEventListener('keydown', (e: any) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          insertEmojiIntoEditor(emoji)
          picker.remove()
        }
      })
      sectionEmojis.appendChild(img)
      added++
    })

    if (added === 0) {
      const msg = createEl('div', {
        text: `${group.name} 组暂无有效表情`,
        style: 'padding: 20px; text-align: center; color: #999;'
      }) as HTMLDivElement
      sectionEmojis.appendChild(msg)
    }

    section.appendChild(titleContainer)
    section.appendChild(sectionEmojis)
    sections.appendChild(section)
  })

  searchInput.addEventListener('input', (e: any) => {
    const q = (e.target.value || '').toLowerCase()
    const allImages = sections.querySelectorAll('img')
    allImages.forEach((img: any) => {
      const emojiName = img.getAttribute('data-emoji')?.toLowerCase() || ''
      ;(img as HTMLElement).style.display = q === '' || emojiName.includes(q) ? '' : 'none'
    })
    sections.querySelectorAll('.emoji-picker__section').forEach(section => {
      const visibleEmojis = section.querySelectorAll('img:not([style*="none"])')
      const titleContainer = section.querySelector('.emoji-picker__section-title-container')
      if (titleContainer)
        (titleContainer as HTMLHeadingElement).style.display =
          visibleEmojis.length > 0 ? '' : 'none'
    })
  })

  scrollableContent.appendChild(sections)
  content.appendChild(sectionsNav)
  content.appendChild(scrollableContent)
  emojiPickerDiv.appendChild(filterContainer)
  emojiPickerDiv.appendChild(content)
  innerContent.appendChild(emojiPickerDiv)
  picker.appendChild(innerContent)

  return picker
}

// Main emoji picker creation function
export async function createEmojiPicker(): Promise<HTMLElement> {
  const groups = userscriptState.emojiGroups
  const mobile = isMobileView()

  // ensure styles for hover preview are injected
  try {
    injectEmojiPickerStyles()
  } catch (e) {
    console.warn('injectEmojiPickerStyles failed', e)
  }

  if (mobile) {
    return createMobileEmojiPicker(groups)
  } else {
    return createDesktopEmojiPicker(groups)
  }
}
