import { createE } from '../../utils/dom/createEl'
import { animateExit, ANIMATION_DURATION, injectAnimationStyles } from '../../utils/dom/animation'

import { cachedState } from './ensure'
import { insertEmojiIntoEditor } from './editor'
import {
  createPickerImageObserver,
  getEmojiPickerImageUrl,
  isMotionHeavyEmoji,
  loadPickerImage,
  PICKER_EAGER_IMAGE_COUNT,
  PICKER_EMOJI_SIZE,
  PICKER_MOTION_HEAVY_EMOJI_SIZE,
  preparePickerImage,
  rafThrottle
} from './pickerPerformance'

import { isImageUrl } from '@/utils/isImageUrl'
import type { Emoji } from '@/types/type'

export async function createMobileEmojiPicker(): Promise<HTMLElement> {
  // Ensure animation styles are injected first
  injectAnimationStyles()

  // Data is already loaded via loadDataFromStorage() in initializeEmojiFeature()
  const groupsToUse = cachedState.emojiGroups

  // Create modal with initial animation class for slide-up effect
  const modal = createE('div', {
    class: 'modal d-modal fk-d-menu-modal emoji-picker-content emoji-modal-enter',
    role: 'dialog',
    attrs: {
      'data-keyboard': 'false',
      'aria-modal': 'true',
      'data-controller': 'emoji-picker'
    }
  })

  // Schedule animation trigger after element is added to DOM
  requestAnimationFrame(() => {
    // Force reflow
    void (modal as HTMLElement).offsetHeight
    // Trigger animation
    modal.classList.remove('emoji-modal-enter')
    modal.classList.add('emoji-modal-enter-active')
    // Clean up after animation
    setTimeout(() => {
      modal.classList.remove('emoji-modal-enter-active')
    }, ANIMATION_DURATION)
  })

  const modalContainerDiv = createE('div', {
    class: 'd-modal__container'
  })

  const modalBody = createE('div', {
    class: 'd-modal__body',
    attrs: { tabIndex: '-1' }
  })

  const emojiPickerDiv = createE('div', {
    class: 'emoji-picker'
  })

  const filterContainer = createE('div', {
    class: 'emoji-picker__filter-container'
  })

  const filterInputContainer = createE('div', {
    class: 'emoji-picker__filter filter-input-container'
  })

  const searchInput = createE('input', {
    class: 'filter-input',
    ph: '按表情符号名称和别名搜索…',
    type: 'text'
  }) as HTMLInputElement
  filterInputContainer.appendChild(searchInput)

  // Helper to close modal and also remove sibling backdrop with animation
  const cleanupPickerResources = () => {
    imageObserver.disconnect()
  }

  const closeModal = () => {
    cleanupPickerResources()
    const parent = modal.parentElement
    if (parent) {
      const backdrop = parent.querySelector('.d-modal__backdrop') as HTMLElement | null
      if (backdrop) {
        animateExit(backdrop, 'backdrop')
      }
    }
    animateExit(modal as HTMLElement, 'modal')
  }

  const closeButton = createE('button', {
    class: 'btn no-text btn-icon btn-transparent emoji-picker__close-btn',
    type: 'button',
    in: `<svg class="fa d-icon d-icon-xmark svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#xmark"></use></svg>`,
    on: {
      click: () => {
        closeModal()
      }
    }
  }) as HTMLButtonElement

  filterContainer.appendChild(filterInputContainer)
  filterContainer.appendChild(closeButton)

  const content = createE('div', {
    class: 'emoji-picker__content'
  })

  const sectionsNav = createE('div', {
    class: 'emoji-picker__sections-nav'
  })

  const scrollableContent = createE('div', {
    class: 'emoji-picker__scrollable-content',
    style: 'contain: content;'
  })
  const imageObserver = createPickerImageObserver(scrollableContent as HTMLDivElement)

  const sections = createE('div', {
    class: 'emoji-picker__sections',
    attrs: { role: 'button' }
  })
  const emojiDataMap = new Map<string, Emoji>()
  const allEmojiImages: HTMLImageElement[] = []
  const sectionStates: Array<{
    navButton: HTMLButtonElement
    section: HTMLDivElement
    titleContainer: HTMLDivElement
    images: HTMLImageElement[]
  }> = []
  let eagerImageCount = 0

  groupsToUse.forEach((group: any, index: number) => {
    if (!group?.emojis?.length) return

    const navButton = createE('button', {
      class: `btn no-text btn-flat emoji-picker__section-btn ${index === 0 ? 'active' : ''}`,
      attrs: {
        tabindex: '-1',
        'data-section': group.id
      },
      type: 'button',
      ti: group.name,
      on: {
        click: () => {
          sectionsNav
            .querySelectorAll('.emoji-picker__section-btn')
            .forEach(btn => btn.classList.remove('active'))
          navButton.classList.add('active')
          const target = sections.querySelector(`[data-section="${group.id}"]`)
          if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      }
    }) as HTMLButtonElement

    const iconVal = group.icon || '📁'
    if (isImageUrl(iconVal)) {
      const img = createE('img', {
        src: getEmojiPickerImageUrl({ url: iconVal }, 48),
        alt: group.name || '',
        class: 'emoji',
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
    sectionsNav.appendChild(navButton)

    const section = createE('div', {
      class: 'emoji-picker__section',
      role: 'region',
      attrs: {
        'data-section': group.id,
        'aria-label': group.name
      },
      style: 'content-visibility: auto; contain-intrinsic-size: 1px 160px;'
    })

    const titleContainer = createE('div', {
      class: 'emoji-picker__section-title-container'
    })
    const title = createE('h2', {
      class: 'emoji-picker__section-title',
      text: group.name
    })
    titleContainer.appendChild(title)

    const sectionEmojis = createE('div', {
      class: 'emoji-picker__section-emojis',
      style: 'contain: layout paint;'
    })
    const sectionImages: HTMLImageElement[] = []

    group.emojis.forEach((emoji: Emoji) => {
      if (!emoji || typeof emoji !== 'object' || !emoji.url || !emoji.name) return
      const thumbUrl = getEmojiPickerImageUrl(emoji)
      if (!thumbUrl) return
      const emojiKey = emoji.id || `${group.id}-${emoji.name}-${sectionImages.length}`
      const emojiSize = isMotionHeavyEmoji(emoji)
        ? PICKER_MOTION_HEAVY_EMOJI_SIZE
        : PICKER_EMOJI_SIZE
      emojiDataMap.set(emojiKey, emoji)
      const img = createE('img', {
        alt: emoji.name,
        class: 'emoji',
        style: `
          width: ${emojiSize}px;
          height: ${emojiSize}px;
          object-fit: contain;
        `,
        tabIndex: 0,
        dataset: { emoji: emoji.name, emojiId: emojiKey },
        ti: `:${emoji.name}:`,
        ld: 'lazy'
      }) as HTMLImageElement
      preparePickerImage(img, thumbUrl, {
        eager: eagerImageCount < PICKER_EAGER_IMAGE_COUNT,
        width: emojiSize,
        height: emojiSize
      })
      eagerImageCount++
      imageObserver.observe(img)
      allEmojiImages.push(img)
      sectionImages.push(img)

      sectionEmojis.appendChild(img)
    })

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
    closeModal()
  })

  sections.addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return

    const emoji = getEmojiFromTarget(event.target)
    if (!emoji) return

    event.preventDefault()
    insertEmojiIntoEditor(emoji)
    closeModal()
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
  modalBody.appendChild(emojiPickerDiv)
  modalContainerDiv.appendChild(modalBody)
  modal.appendChild(modalContainerDiv)
  ;(modal as any).__cleanup = () => {
    cleanupPickerResources()
  }

  return modal
}
