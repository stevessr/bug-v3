import { isImageUrl } from '../../utils/isimage'
import { createEl } from './element-factory'
import { ensureDefaultIfEmpty, cachedState } from './ensure'
import { insertEmojiIntoEditor } from './editor'

export async function createDesktopEmojiPicker(): Promise<HTMLElement> {
  ensureDefaultIfEmpty()
  const groupsToUse = cachedState.emojiGroups

  const picker = createEl('div', {
    className: 'fk-d-menu -animated -expanded',
    attrs: {
      'data-identifier': 'emoji-picker',
      role: 'dialog'
    },
    style: 'max-width: 400px; visibility: visible; z-index: 999999;'
  })

  const innerContent = createEl('div', {
    className: 'fk-d-menu__inner-content'
  })
  const emojiPickerDiv = createEl('div', {
    className: 'emoji-picker'
  })

  const filterContainer = createEl('div', {
    className: 'emoji-picker__filter-container'
  })
  const filterDiv = createEl('div', {
    className: 'emoji-picker__filter filter-input-container'
  })
  const searchInput = createEl('input', {
    className: 'filter-input',
    placeholder: '按表情符号名称搜索…',
    type: 'text'
  })
  filterDiv.appendChild(searchInput)
  filterContainer.appendChild(filterDiv)

  const content = createEl('div', {
    className: 'emoji-picker__content'
  })
  const sectionsNav = createEl('div', {
    className: 'emoji-picker__sections-nav'
  })
  const scrollableContent = createEl('div', {
    className: 'emoji-picker__scrollable-content'
  })
  const sections = createEl('div', {
    className: 'emoji-picker__sections'
  })
  sections.setAttribute('role', 'button')

  groupsToUse.forEach((group: any, index: number) => {
    if (!group?.emojis?.length) return

    const navButton = document.createElement('button')
    navButton.className = `btn no-text btn-flat emoji-picker__section-btn ${index === 0 ? 'active' : ''
      }`
    navButton.setAttribute('tabindex', '-1')
    navButton.setAttribute('data-section', group.id)
    navButton.type = 'button'

    const iconVal = group.icon || '📁'
    if (isImageUrl(iconVal)) {
      const img = createEl('img', {
        src: iconVal,
        alt: group.name || '',
        className: 'emoji-group-icon',
        style: {
          width: '18px',
          height: '18px',
          objectFit: 'contain'
        }
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
    })

    const titleContainer = createEl('div', {
      className: 'emoji-picker__section-title-container'
    })
    const title = createEl('h2', {
      className: 'emoji-picker__section-title'
    })
    title.textContent = group.name
    titleContainer.appendChild(title)

    const sectionEmojis = createEl('div', {
      className: 'emoji-picker__section-emojis'
    })

    let added = 0
    group.emojis.forEach((emoji: any) => {
      if (!emoji || typeof emoji !== 'object' || !emoji.url || !emoji.name) return
      const img = createEl('img', {
        style: { cursor: 'pointer' },
        width: '32',
        height: '32',
        className: 'emoji',
        src: emoji.url,
        alt: emoji.name,
        title: `:${emoji.name}:`,
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
      } catch (_e) {
        // ignore errors reading cachedState
      }
      sectionEmojis.appendChild(img)
      added++
    })

    if (added === 0) {
      const msg = createEl('div', {
        className: 'emoji-picker__no-emojis-message',
        attrs: { role: 'note', 'aria-live': 'polite' },
        textContent: `${group.name} 组暂无有效表情`,
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
        ; (img as HTMLElement).style.display = q === '' || emojiName.includes(q) ? '' : 'none'
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
    const el = createEl('div', {
      className: 'emoji-desktop-hover-preview',
      style: {
        position: 'fixed',
        pointerEvents: 'none',
        zIndex: '999999',
        padding: '6px',
        borderRadius: '6px',
        // neutral styling: transparent background, inherit text color, light border — avoid colored accents
        background: 'transparent',
        color: 'inherit',
        border: '1px solid rgba(0,0,0,0.08)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '6px',
        maxWidth: '360px',
        maxHeight: '360px',
        overflow: 'hidden'
      }
    }) as HTMLDivElement

    const img = createEl('img', {
      className: 'emoji-desktop-hover-preview-img',
      style: {
        maxWidth: '320px',
        maxHeight: '320px',
        display: 'block',
        borderRadius: '4px',
        objectFit: 'contain'
      },
    }) as HTMLImageElement
    el.appendChild(img)

    const label = createEl('div', {
      className: 'emoji-desktop-hover-preview-label',
      style: {
        fontSize: '12px',
        lineHeight: '1',
        maxWidth: '320px',
        whiteSpace: 'nowrap',
        textOverflow: 'ellipsis',
        overflow: 'hidden'
      }
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
