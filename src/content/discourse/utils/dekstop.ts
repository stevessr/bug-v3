import { isImageUrl } from '../../utils/isimage'

import { ensureDefaultIfEmpty, cachedState } from './ensure'
import { insertEmojiIntoEditor } from './editor'

export async function createDesktopEmojiPicker(): Promise<HTMLElement> {
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
      // --- hover preview (desktop only) ---
      // Only attach preview handlers if the global cached setting enables hover preview
      try {
        const shouldPreview = !!(cachedState && cachedState.settings && cachedState.settings.enableHoverPreview)
        if (shouldPreview) {
          img.addEventListener('mouseenter', (ev: MouseEvent) => {
            try {
              ensurePreview()
              showPreviewAtEvent(ev, emoji)
            } catch (err) {
              void err
            }
          })
          img.addEventListener('mousemove', (ev: MouseEvent) => {
            try {
              movePreviewToEvent(ev)
            } catch (err) {
              void err
            }
          })
          img.addEventListener('mouseleave', () => {
            try {
              removePreview()
            } catch (err) {
              void err
            }
          })
        }
      } catch (_e) {
        // ignore errors reading cachedState
      }
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
  // --- hover preview helpers (desktop picker) ---
  let _previewEl: HTMLDivElement | null = null
  let _fadeTimeout: number | null = null
  let _removeTimeout: number | null = null

  function ensurePreview() {
    if (_previewEl) return _previewEl
    const el = document.createElement('div')
    el.className = 'emoji-desktop-hover-preview'
    // minimal, neutral styling (no colored accents)
    el.style.position = 'fixed'
    el.style.pointerEvents = 'none'
    el.style.zIndex = '999999'
    el.style.padding = '6px'
    el.style.borderRadius = '6px'
    // neutral styling: transparent background, inherit text color, light border — avoid colored accents
    el.style.background = 'transparent'
    el.style.color = 'inherit'
    el.style.border = '1px solid rgba(0,0,0,0.08)'
    el.style.display = 'flex'
    el.style.flexDirection = 'column'
    el.style.alignItems = 'center'
    el.style.gap = '6px'
    el.style.maxWidth = '360px'
    el.style.maxHeight = '360px'
    el.style.overflow = 'hidden'

    const img = document.createElement('img')
    img.className = 'emoji-desktop-hover-preview-img'
    img.style.maxWidth = '320px'
    img.style.maxHeight = '320px'
    img.style.display = 'block'
    img.style.borderRadius = '4px'
    img.style.objectFit = 'contain'
    el.appendChild(img)

    const label = document.createElement('div')
    label.className = 'emoji-desktop-hover-preview-label'
    label.style.fontSize = '12px'
    label.style.lineHeight = '1'
    label.style.maxWidth = '320px'
    label.style.whiteSpace = 'nowrap'
    label.style.textOverflow = 'ellipsis'
    label.style.overflow = 'hidden'
    el.appendChild(label)

    document.body.appendChild(el)
    _previewEl = el
    // start fully opaque
    _previewEl.style.opacity = '1'
    // prepare transition (will be used when fade is triggered)
    _previewEl.style.transition = 'opacity 2s linear'
    return el
  }

  function showPreviewAtEvent(ev: MouseEvent, emoji: any) {
    const el = ensurePreview()
    const img = el.querySelector('img') as HTMLImageElement
    const label = el.querySelector('.emoji-desktop-hover-preview-label') as HTMLDivElement
    if (img) img.src = emoji.displayUrl || emoji.url || ''
    if (label) label.textContent = emoji.name || ''
    movePreviewToEvent(ev)
    // make sure visible and fully opaque
    el.style.display = ''
    el.style.opacity = '1'

    // clear any existing timers and schedule fade/remove for continuous display
    try {
      if (_fadeTimeout) {
        window.clearTimeout(_fadeTimeout)
        _fadeTimeout = null
      }
      if (_removeTimeout) {
        window.clearTimeout(_removeTimeout)
        _removeTimeout = null
      }
    } catch (_e) {
      /* ignore */
    }

    // after 5s, start fading (this sets opacity to 0 over 2s because of transition)
    _fadeTimeout = window.setTimeout(() => {
      try {
        if (_previewEl) _previewEl.style.opacity = '0'
      } catch (_e) {
        void _e
      }
    }, 5000) as unknown as number

    // after 7s, ensure removal
    _removeTimeout = window.setTimeout(() => {
      try {
        removePreview()
      } catch (_e) {
        void _e
      }
    }, 7000) as unknown as number
  }

  function movePreviewToEvent(ev: MouseEvent) {
    if (!_previewEl) return
    const margin = 12
    const width = _previewEl.offsetWidth
    const height = _previewEl.offsetHeight
    let x = ev.clientX + margin
    let y = ev.clientY + margin
    // avoid going off right/bottom edge
    const winW = window.innerWidth
    const winH = window.innerHeight
    if (x + width + margin > winW) x = Math.max(margin, ev.clientX - width - margin)
    if (y + height + margin > winH) y = Math.max(margin, ev.clientY - height - margin)
    _previewEl.style.left = `${x}px`
    _previewEl.style.top = `${y}px`
  }

  function removePreview() {
    if (!_previewEl) return
    try {
      // clear timers
      try {
        if (_fadeTimeout) {
          window.clearTimeout(_fadeTimeout)
          _fadeTimeout = null
        }
        if (_removeTimeout) {
          window.clearTimeout(_removeTimeout)
          _removeTimeout = null
        }
      } catch (_e) {
        /* ignore */
      }

      if (_previewEl.parentElement) _previewEl.parentElement.removeChild(_previewEl)
    } finally {
      _previewEl = null
    }
  }

  return picker
}
