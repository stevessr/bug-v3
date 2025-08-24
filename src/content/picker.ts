import { cachedState } from './state'
import { insertEmojiIntoEditor } from './editor'
import { ensureDefaultIfEmpty } from './storage'
import { logger } from './buildFlags'

// Inline isImageUrl function to avoid external import
function isImageUrl(value: string | null | undefined): boolean {
  if (!value || typeof value !== 'string') return false
  try {
    const url = new URL(value)
    const pathname = url.pathname.toLowerCase()
    return /\.(jpg|jpeg|png|gif|bmp|webp|svg|ico)(\?.*)?$/i.test(pathname)
  } catch {
    return false
  }
}
export const isMobile = (): boolean => {
  const userAgent = navigator.userAgent
  const mobileKeywords = ['Android', 'iPhone', 'iPad', 'iPod', 'Windows Phone']
  return mobileKeywords.some(keyword => userAgent.includes(keyword))
}

export async function createEmojiPicker(isMobileView: boolean): Promise<HTMLElement> {
  logger.log('[Emoji Extension] Creating picker for isMobileView:', isMobileView)
  if (isMobileView) {
    return createMobileEmojiPicker()
  }
  return createDesktopEmojiPicker()
}

async function createDesktopEmojiPicker(): Promise<HTMLElement> {
  ensureDefaultIfEmpty()
  const groupsToUse = cachedState.emojiGroups

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
  const scrollableContent = document.createElement('div')
  scrollableContent.className = 'emoji-picker__scrollable-content'
  const sections = document.createElement('div')
  sections.className = 'emoji-picker__sections'
  sections.setAttribute('role', 'button')

  groupsToUse.forEach((group: any, index: number) => {
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

async function createMobileEmojiPicker(): Promise<HTMLElement> {
  ensureDefaultIfEmpty()
  const groupsToUse = cachedState.emojiGroups

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

  const searchInput = document.createElement('input')
  searchInput.className = 'filter-input'
  searchInput.placeholder = '按表情符号名称和别名搜索…'
  searchInput.type = 'text'
  filterInputContainer.appendChild(searchInput)

  const closeButton = document.createElement('button')
  closeButton.className = 'btn no-text btn-icon btn-transparent emoji-picker__close-btn'
  closeButton.type = 'button'
  closeButton.innerHTML = `<svg class="fa d-icon d-icon-xmark svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#xmark"></use></svg>`
  closeButton.addEventListener('click', () => {
    const modalContainer = modal.closest('.modal-container')
    if (modalContainer) {
      modalContainer.remove()
    }
  })

  filterContainer.appendChild(filterInputContainer)
  filterContainer.appendChild(closeButton)

  const content = document.createElement('div')
  content.className = 'emoji-picker__content'

  const sectionsNav = document.createElement('div')
  sectionsNav.className = 'emoji-picker__sections-nav'

  const scrollableContent = document.createElement('div')
  scrollableContent.className = 'emoji-picker__scrollable-content'

  const sections = document.createElement('div')
  sections.className = 'emoji-picker__sections'
  sections.setAttribute('role', 'button')

  groupsToUse.forEach((group: any, index: number) => {
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
        }
      })
      img.addEventListener('keydown', (e: any) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          insertEmojiIntoEditor(emoji)
          const modalContainer = modal.closest('.modal-container')
          if (modalContainer) {
            modalContainer.remove()
          }
        }
      })
      sectionEmojis.appendChild(img)
    })

    section.appendChild(titleContainer)
    section.appendChild(sectionEmojis)
    sections.appendChild(section)
  })

  searchInput.addEventListener('input', (e: any) => {
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
