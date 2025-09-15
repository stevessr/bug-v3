// Emoji picker creation and management module
import { userscriptState } from '../state'

import { isImageUrl } from '@/utils/isImageUrl'

// Mobile detection helper
export function isMobileView(): boolean {
  try {
    return !!(
      userscriptState &&
      userscriptState.settings &&
      userscriptState.settings.forceMobileMode
    )
  } catch (e) {
    return false
  }
}

// Insert emoji into editor
export function insertEmojiIntoEditor(emoji: any) {
  console.log('[Emoji Extension Userscript] Inserting emoji:', emoji)

  const textarea = document.querySelector('textarea.d-editor-input') as HTMLTextAreaElement | null
  const proseMirror = document.querySelector('.ProseMirror.d-editor-input') as HTMLElement | null

  if (!textarea && !proseMirror) {
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
  }
}

// Create mobile-style emoji picker modal
function createMobileEmojiPicker(groups: any[]): HTMLElement {
  const modal = document.createElement('div')
  modal.className = 'modal d-modal fk-d-menu-modal emoji-picker-content'
  modal.setAttribute('data-keyboard', 'false')
  modal.setAttribute('aria-modal', 'true')
  modal.setAttribute('role', 'dialog')
  modal.setAttribute('data-identifier', 'emoji-picker')

  const modalContainerDiv = document.createElement('div')
  modalContainerDiv.className = 'd-modal__container'

  const modalBody = document.createElement('div')
  modalBody.className = 'd-modal__body'
  modalBody.tabIndex = -1

  const emojiPickerDiv = document.createElement('div')
  emojiPickerDiv.className = 'emoji-picker'

  const filterContainer = document.createElement('div')
  filterContainer.className = 'emoji-picker__filter-container'

  const filterInputContainer = document.createElement('div')
  filterInputContainer.className = 'emoji-picker__filter filter-input-container'

  const filterInput = document.createElement('input')
  filterInput.className = 'filter-input'
  filterInput.placeholder = '按表情符号名称搜索…'
  filterInput.type = 'text'
  filterInputContainer.appendChild(filterInput)

  const closeButton = document.createElement('button')
  closeButton.className = 'btn no-text btn-icon btn-transparent emoji-picker__close-btn'
  closeButton.type = 'button'
  closeButton.innerHTML = `<svg class="fa d-icon d-icon-xmark svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#xmark"></use></svg>`
  closeButton.addEventListener('click', () => {
    const container = modal.closest('.modal-container') || modal
    if (container) container.remove()
  })

  filterContainer.appendChild(filterInputContainer)
  filterContainer.appendChild(closeButton)

  const content = document.createElement('div')
  content.className = 'emoji-picker__content'

  const sectionsNav = document.createElement('div')
  sectionsNav.className = 'emoji-picker__sections-nav'

  // Add management and settings buttons
  const managementButton = document.createElement('button')
  managementButton.className = 'btn no-text btn-flat emoji-picker__section-btn management-btn'
  managementButton.setAttribute('tabindex', '-1')
  managementButton.type = 'button'
  managementButton.innerHTML = '⚙️'
  managementButton.title = '管理表情 - 点击打开完整管理界面'
  managementButton.style.borderRight = '1px solid #ddd'
  managementButton.addEventListener('click', () => {
    // Import manager module dynamically
    import('./manager').then(({ openManagementInterface }) => {
      openManagementInterface()
    })
  })
  sectionsNav.appendChild(managementButton)

  const settingsButton = document.createElement('button')
  settingsButton.className = 'btn no-text btn-flat emoji-picker__section-btn settings-btn'
  settingsButton.setAttribute('tabindex', '-1')
  settingsButton.type = 'button'
  settingsButton.innerHTML = '🔧'
  settingsButton.title = '设置'
  settingsButton.style.borderRight = '1px solid #ddd'
  settingsButton.addEventListener('click', () => {
    // Import settings module dynamically
    import('./settings').then(({ showSettingsModal }) => {
      showSettingsModal()
    })
  })
  sectionsNav.appendChild(settingsButton)

  const scrollableContent = document.createElement('div')
  scrollableContent.className = 'emoji-picker__scrollable-content'

  const sections = document.createElement('div')
  sections.className = 'emoji-picker__sections'
  sections.setAttribute('role', 'button')

  groups.forEach((group: any, index: number) => {
    if (!group?.emojis?.length) return

    const navButton = document.createElement('button')
    navButton.className = `btn no-text btn-flat emoji-picker__section-btn ${index === 0 ? 'active' : ''}`
    navButton.setAttribute('tabindex', '-1')
    navButton.setAttribute('data-section', group.id)
    navButton.type = 'button'

    const iconVal = group.icon || '📁'
    if (isImageUrl(iconVal)) {
      const img = document.createElement('img')
      img.src = iconVal
      img.alt = group.name || ''
      img.className = 'emoji'
      img.style.width = '18px'
      img.style.height = '18px'
      img.style.objectFit = 'contain'
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

    const section = document.createElement('div')
    section.className = 'emoji-picker__section'
    section.setAttribute('data-section', group.id)
    section.setAttribute('role', 'region')
    section.setAttribute('aria-label', group.name)

    const titleContainer = document.createElement('div')
    titleContainer.className = 'emoji-picker__section-title-container'
    const title = document.createElement('h2')
    title.className = 'emoji-picker__section-title'
    title.textContent = group.name
    titleContainer.appendChild(title)

    const sectionEmojis = document.createElement('div')
    sectionEmojis.className = 'emoji-picker__section-emojis'

    group.emojis.forEach((emoji: any) => {
      if (!emoji || typeof emoji !== 'object' || !emoji.url || !emoji.name) return
      const img = document.createElement('img')
      img.width = 32
      img.height = 32
      img.className = 'emoji'
      img.src = emoji.url
      img.tabIndex = 0
      img.dataset.emoji = emoji.name
      img.alt = emoji.name
      img.title = `:${emoji.name}:`
      img.loading = 'lazy'
      img.addEventListener('click', () => {
        insertEmojiIntoEditor(emoji)
        const modalContainer = modal.closest('.modal-container')
        if (modalContainer) {
          modalContainer.remove()
        } else {
          modal.remove()
        }
      })
      img.addEventListener('keydown', (e: any) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          insertEmojiIntoEditor(emoji)
          const modalContainer = modal.closest('.modal-container')
          if (modalContainer) {
            modalContainer.remove()
          } else {
            modal.remove()
          }
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
  const picker = document.createElement('div')
  picker.className = 'fk-d-menu -animated -expanded'
  picker.setAttribute('data-identifier', 'emoji-picker')
  picker.setAttribute('role', 'dialog')
  picker.style.cssText = 'max-width: 400px; visibility: visible; z-index: 999999;'

  const innerContent = document.createElement('div')
  innerContent.className = 'fk-d-menu__inner-content'
  const emojiPickerDiv = document.createElement('div')
  emojiPickerDiv.className = 'emoji-picker'

  const filterContainer = document.createElement('div')
  filterContainer.className = 'emoji-picker__filter-container'
  const filterDiv = document.createElement('div')
  filterDiv.className = 'emoji-picker__filter filter-input-container'
  const searchInput = document.createElement('input')
  searchInput.className = 'filter-input'
  searchInput.placeholder = '按表情符号名称搜索…'
  searchInput.type = 'text'
  filterDiv.appendChild(searchInput)
  filterContainer.appendChild(filterDiv)

  const content = document.createElement('div')
  content.className = 'emoji-picker__content'
  const sectionsNav = document.createElement('div')
  sectionsNav.className = 'emoji-picker__sections-nav'

  // Add management and settings buttons
  const managementButton = document.createElement('button')
  managementButton.className = 'btn no-text btn-flat emoji-picker__section-btn management-btn'
  managementButton.setAttribute('tabindex', '-1')
  managementButton.type = 'button'
  managementButton.innerHTML = '⚙️'
  managementButton.title = '管理表情 - 点击打开完整管理界面'
  managementButton.style.borderRight = '1px solid #ddd'
  managementButton.addEventListener('click', () => {
    import('./manager').then(({ openManagementInterface }) => {
      openManagementInterface()
    })
  })
  sectionsNav.appendChild(managementButton)

  const settingsButton = document.createElement('button')
  settingsButton.className = 'btn no-text btn-flat emoji-picker__section-btn settings-btn'
  settingsButton.setAttribute('tabindex', '-1')
  settingsButton.type = 'button'
  settingsButton.innerHTML = '🔧'
  settingsButton.title = '设置'
  settingsButton.style.borderRight = '1px solid #ddd'
  settingsButton.addEventListener('click', () => {
    import('./settings').then(({ showSettingsModal }) => {
      showSettingsModal()
    })
  })
  sectionsNav.appendChild(settingsButton)

  const scrollableContent = document.createElement('div')
  scrollableContent.className = 'emoji-picker__scrollable-content'
  const sections = document.createElement('div')
  sections.className = 'emoji-picker__sections'
  sections.setAttribute('role', 'button')

  groups.forEach((group: any, index: number) => {
    if (!group?.emojis?.length) return

    const navButton = document.createElement('button')
    navButton.className = `btn no-text btn-flat emoji-picker__section-btn ${
      index === 0 ? 'active' : ''
    }`
    navButton.setAttribute('tabindex', '-1')
    navButton.setAttribute('data-section', group.id)
    navButton.type = 'button'

    const iconVal = group.icon || '📁'
    if (isImageUrl(iconVal)) {
      const img = document.createElement('img')
      img.src = iconVal
      img.alt = group.name || ''
      img.className = 'emoji-group-icon'
      img.style.width = '18px'
      img.style.height = '18px'
      img.style.objectFit = 'contain'
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

    const section = document.createElement('div')
    section.className = 'emoji-picker__section'
    section.setAttribute('data-section', group.id)
    section.setAttribute('role', 'region')
    section.setAttribute('aria-label', group.name)

    const titleContainer = document.createElement('div')
    titleContainer.className = 'emoji-picker__section-title-container'
    const title = document.createElement('h2')
    title.className = 'emoji-picker__section-title'
    title.textContent = group.name
    titleContainer.appendChild(title)

    const sectionEmojis = document.createElement('div')
    sectionEmojis.className = 'emoji-picker__section-emojis'

    let added = 0
    group.emojis.forEach((emoji: any) => {
      if (!emoji || typeof emoji !== 'object' || !emoji.url || !emoji.name) return
      const img = document.createElement('img')
      img.width = 32
      img.height = 32
      img.className = 'emoji'
      img.src = emoji.url
      img.setAttribute('tabindex', '0')
      img.setAttribute('data-emoji', emoji.name)
      img.alt = emoji.name
      img.title = `:${emoji.name}:`
      img.loading = 'lazy'
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
      const msg = document.createElement('div')
      msg.textContent = `${group.name} 组暂无有效表情`
      msg.style.cssText = 'padding: 20px; text-align: center; color: #999;'
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
        (titleContainer as HTMLElement).style.display = visibleEmojis.length > 0 ? '' : 'none'
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

  if (mobile) {
    return createMobileEmojiPicker(groups)
  } else {
    return createDesktopEmojiPicker(groups)
  }
}
