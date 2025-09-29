import { isImageUrl } from '../../utils/isimage'
import { createE } from '../../utils/createEl'

import { ensureDefaultIfEmpty, cachedState } from './ensure'
import { insertEmojiIntoEditor } from './editor'

export async function createDesktopEmojiPicker(): Promise<HTMLElement> {
  ensureDefaultIfEmpty()
  const groupsToUse = cachedState.emojiGroups

  const picker = createE('div', {
    class: 'fk-d-menu -animated -expanded',
    attrs: {
      'data-identifier': 'emoji-picker',
      role: 'dialog'
    },
    style: 'max-width: 400px; visibility: visible; z-index: 999999;'
  })

  const innerContent = createE('div', {
    class: 'fk-d-menu__inner-content'
  })
  const emojiPickerDiv = createE('div', {
    class: 'emoji-picker'
  })

  const filterContainer = createE('div', {
    class: 'emoji-picker__filter-container'
  })
  const filterDiv = createE('div', {
    class: 'emoji-picker__filter filter-input-container'
  })
  const searchInput = createE('input', {
    class: 'filter-input',
    ph: '按表情符号名称搜索…',
    type: 'text'
  })
  filterDiv.appendChild(searchInput)
  filterContainer.appendChild(filterDiv)

  const content = createE('div', {
    class: 'emoji-picker__content'
  })
  const sectionsNav = createE('div', {
    class: 'emoji-picker__sections-nav'
  })
  const scrollableContent = createE('div', {
    class: 'emoji-picker__scrollable-content'
  })
  const sections = createE('div', {
    class: 'emoji-picker__sections'
  })
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
      const img = createE('img', {
        src: iconVal,
        alt: group.name || '',
        class: 'emoji-group-icon',
        style: `
          width: 18px;
          height: 18px;
          object-fit: contain;
        `
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

    const section = createE('div', {
      class: 'emoji-picker__section',
      attrs: {
        'data-section': group.id,
        role: 'region',
        'aria-label': group.name
      }
    })

    const titleContainer = createE('div', {
      class: 'emoji-picker__section-title-container'
    })
    const title = createE('h2', {
      class: 'emoji-picker__section-title'
    })
    title.textContent = group.name
    titleContainer.appendChild(title)

    const sectionEmojis = createE('div', {
      class: 'emoji-picker__section-emojis'
    })

    let added = 0
    group.emojis.forEach((emoji: any) => {
      if (!emoji || typeof emoji !== 'object' || !emoji.url || !emoji.name) return
      const img = createE('img', {
        style: `
        cursor: pointer;
         width: 32px; 
         height: 32px;
          object-fit: contain;`,
        class: 'emoji',
        src: emoji.url,
        alt: emoji.name,
        ti: `:${emoji.name}:`,
        attrs: {
          tabindex: '0',
          'data-emoji': emoji.name,
          loading: 'lazy'
        },
        on: {
          click: () => {
            insertEmojiIntoEditor(emoji)
            picker.remove()
          }
        }
      }) as HTMLImageElement
      img.addEventListener('keydown', (e: any) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          insertEmojiIntoEditor(emoji)
          picker.remove()
        }
      })
      // --- hover preview (desktop only) ---
      try {
        const shouldPreview = !!(
          cachedState &&
          cachedState.settings &&
          cachedState.settings.enableHoverPreview
        )
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
      } catch {
        // ignore errors reading cachedState
      }
      sectionEmojis.appendChild(img)
      added++
    })

    if (added === 0) {
      const msg = createE('div', {
        class: 'emoji-picker__no-emojis-message',
        attrs: { role: 'note', 'aria-live': 'polite' },
        text: `${group.name} 组暂无有效表情`,
        style: 'padding: 20px; text-align: center; color: #999;'
      })
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
    const el = createE('div', {
      class: 'emoji-desktop-hover-preview',
      style: `
        position: fixed;
        pointer-events: none;
        z-index: 999999;
        padding: 6px;
        border-radius: 6px;
        background: transparent;
        color: inherit;
        border: 1px solid rgba(0,0,0,0.08);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        max-width: 360px;
        max-height: 360px;
        overflow: hidden;
      `
    }) as HTMLDivElement

    const img = createE('img', {
      class: 'emoji-desktop-hover-preview-img',
      style: `
        max-width: 320px;
        max-height: 320px;
        display: block;
        border-radius: 4px;
        object-fit: contain;
      `
    }) as HTMLImageElement
    el.appendChild(img)

    const label = createE('div', {
      class: 'emoji-desktop-hover-preview-label',
      style: `
        font-size: 12px;
        line-height: 1;
        max-width: 320px;
        white-space: nowrap;
        text-overflow: ellipsis;
        overflow: hidden;
      `
    }) as HTMLDivElement
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
    } catch {
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
      } catch {
        /* ignore */
      }

      if (_previewEl.parentElement) _previewEl.parentElement.removeChild(_previewEl)
    } finally {
      _previewEl = null
    }
  }

  return picker
}
