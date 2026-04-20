import { createE, DOA } from '../../utils/dom/createEl'
import { animateExit } from '../../utils/dom/animation'

import { cachedState } from './ensure'
import { insertEmojiIntoEditor } from './editor'
import {
  createPickerImageObserver,
  getEmojiPickerImageUrl,
  getEmojiPickerPreviewUrl,
  loadPickerImage,
  PICKER_EAGER_IMAGE_COUNT,
  preparePickerImage,
  rafThrottle
} from './pickerPerformance'

import { isImageUrl } from '@/utils/isImageUrl'
import type { Emoji } from '@/types/type'

export async function createDesktopEmojiPicker(): Promise<HTMLElement> {
  // Data is already loaded via loadDataFromStorage() in initializeEmojiFeature()
  const groupsToUse = cachedState.emojiGroups

  // 用于事件委托的 emoji 数据映射
  const emojiDataMap = new Map<string, Emoji>()
  const allEmojiImages: HTMLImageElement[] = []
  const sectionStates: Array<{
    navButton: HTMLButtonElement
    section: HTMLDivElement
    titleContainer: HTMLDivElement
    images: HTMLImageElement[]
  }> = []
  let eagerImageCount = 0

  const picker = createE('div', {
    class: 'fk-d-menu -animated -expanded',
    attrs: {
      'data-identifier': 'emoji-picker',
      role: 'dialog'
    },
    style: 'max-width: 400px; visibility: visible; z-index: 8999999;'
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
    class: 'emoji-picker__scrollable-content',
    style: 'max-height: 400px; overflow-y: auto; overflow-x: hidden; contain: content;'
  })
  const imageObserver = createPickerImageObserver(scrollableContent as HTMLDivElement)
  const sections = createE('div', {
    class: 'emoji-picker__sections'
  })
  sections.setAttribute('role', 'button')

  groupsToUse.forEach((group: any, index: number) => {
    if (!group?.emojis?.length) return

    const navButton = createE('button', {
      class: `btn no-text btn-flat emoji-picker__section-btn ${index === 0 ? 'active' : ''}`,
      attrs: {
        tabindex: '-1',
        'data-section': group.id
      },
      type: 'button'
    })

    const iconVal = group.icon || '📁'
    if (isImageUrl(iconVal)) {
      const img = createE('img', {
        src: getEmojiPickerImageUrl({ url: iconVal }, 48),
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
      },
      style: 'content-visibility: auto; contain-intrinsic-size: 1px 160px;'
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
      class: 'emoji-picker__section-emojis',
      style: 'contain: layout paint;'
    })
    const sectionImages: HTMLImageElement[] = []

    let added = 0
    group.emojis.forEach((emoji: Emoji) => {
      if (!emoji || typeof emoji !== 'object' || !emoji.url || !emoji.name) return
      const thumbUrl = getEmojiPickerImageUrl(emoji)
      if (!thumbUrl) return
      const emojiKey = emoji.id || `${group.id}-${emoji.name}-${added}`

      // 存储 emoji 数据到 Map，用于事件委托
      emojiDataMap.set(emojiKey, emoji)

      const img = createE('img', {
        style: `
        cursor: pointer;
         width: 32px;
         height: 32px;
          object-fit: contain;`,
        class: 'emoji',
        alt: emoji.name,
        ti: `:${emoji.name}:`,
        attrs: {
          tabindex: '0',
          'data-emoji': emoji.name,
          'data-emoji-id': emojiKey,
          loading: 'lazy'
        }
      }) as HTMLImageElement
      preparePickerImage(img, thumbUrl, { eager: eagerImageCount < PICKER_EAGER_IMAGE_COUNT })
      eagerImageCount++
      imageObserver.observe(img)
      allEmojiImages.push(img)
      sectionImages.push(img)
      // hover preview 使用事件委托，不再在每个 img 上绑定
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
    sectionStates.push({
      navButton,
      section: section as HTMLDivElement,
      titleContainer: titleContainer as HTMLDivElement,
      images: sectionImages
    })
  })

  const cleanupPickerResources = () => {
    imageObserver.disconnect()
    removePreview()
  }

  const getEmojiFromTarget = (target: EventTarget | null): Emoji | null => {
    const img = (target as HTMLElement | null)?.closest?.(
      'img.emoji[data-emoji-id]'
    ) as HTMLImageElement | null
    if (!img) return null

    const emojiId = img.dataset.emojiId || ''
    return emojiDataMap.get(emojiId) || null
  }

  sections.addEventListener('click', event => {
    const emoji = getEmojiFromTarget(event.target)
    if (!emoji) return

    insertEmojiIntoEditor(emoji)
    cleanupPickerResources()
    animateExit(picker as HTMLElement, 'picker')
  })

  sections.addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return

    const emoji = getEmojiFromTarget(event.target)
    if (!emoji) return

    event.preventDefault()
    insertEmojiIntoEditor(emoji)
    cleanupPickerResources()
    animateExit(picker as HTMLElement, 'picker')
  })

  const applySearch = rafThrottle((query: string) => {
    const q = query.trim().toLowerCase()

    allEmojiImages.forEach(img => {
      const emojiName = (img.dataset.emoji || '').toLowerCase()
      const visible = q === '' || emojiName.includes(q)

      if (visible && q) loadPickerImage(img)
      img.style.display = visible ? '' : 'none'
    })

    sectionStates.forEach(({ navButton, section, titleContainer, images }) => {
      const hasVisible =
        q === ''
          ? images.length === 0 || images.some(img => img.style.display !== 'none')
          : images.some(img => img.style.display !== 'none')
      section.style.display = hasVisible ? '' : 'none'
      titleContainer.style.display = hasVisible ? '' : 'none'
      navButton.style.display = q === '' || hasVisible ? '' : 'none'
    })
  })

  searchInput.addEventListener('input', (e: Event) => {
    applySearch((e.target as HTMLInputElement).value || '')
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
        z-index: 8999999;
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

    DOA(el)
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
    const originalUrl = getEmojiPickerPreviewUrl(emoji)
    if (img) {
      img.src = originalUrl
    }
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

  // --- 使用事件委托处理 hover preview，减少事件监听器数量 ---
  try {
    const shouldPreview = !!(
      cachedState &&
      cachedState.settings &&
      cachedState.settings.enableHoverPreview
    )
    if (shouldPreview) {
      sections.addEventListener(
        'mouseenter',
        (ev: Event) => {
          const target = ev.target as HTMLElement
          if (target.tagName === 'IMG' && target.classList.contains('emoji')) {
            const emojiName = target.getAttribute('data-emoji')
            if (emojiName && emojiDataMap.has(emojiName)) {
              const emoji = emojiDataMap.get(emojiName)
              try {
                ensurePreview()
                showPreviewAtEvent(ev as MouseEvent, emoji)
              } catch (err) {
                void err
              }
            }
          }
        },
        true
      ) // 使用捕获阶段

      sections.addEventListener(
        'mousemove',
        (ev: Event) => {
          const target = ev.target as HTMLElement
          if (target.tagName === 'IMG' && target.classList.contains('emoji')) {
            try {
              movePreviewToEvent(ev as MouseEvent)
            } catch (err) {
              void err
            }
          }
        },
        true
      )

      sections.addEventListener(
        'mouseleave',
        (ev: Event) => {
          const target = ev.target as HTMLElement
          if (target.tagName === 'IMG' && target.classList.contains('emoji')) {
            try {
              removePreview()
            } catch (err) {
              void err
            }
          }
        },
        true
      )
    }
  } catch {
    // ignore errors reading cachedState
  }

  // 将 cleanup 方法附加到 picker 元素上，供外部在关闭时调用
  ;(picker as any).__cleanup = () => {
    cleanupPickerResources()
  }

  return picker
}
