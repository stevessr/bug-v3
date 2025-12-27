import { isImageUrl } from '../../utils/isimage'
import { createE } from '../../utils/createEl'
import { getCachedImageUrl } from '../../utils/contentImageCache'

import { cachedState } from './ensure'
import { insertEmojiIntoEditor } from './editor'

/**
 * 异步替换图片元素的 src 为缓存版本
 */
async function replaceWithCachedImage(
  imgElement: HTMLImageElement,
  originalUrl: string
): Promise<void> {
  try {
    const cachedUrl = await getCachedImageUrl(originalUrl)
    if (cachedUrl && cachedUrl !== originalUrl) {
      imgElement.src = cachedUrl
      imgElement.setAttribute('data-original-url', originalUrl)
      imgElement.setAttribute('data-cached', 'true')
    }
  } catch (error) {
    // 如果缓存获取失败，保持原始 URL
    console.warn('[Mobile Emoji Picker] Failed to get cached image:', error)
  }
}

export async function createMobileEmojiPicker(): Promise<HTMLElement> {
  // Data is already loaded via loadDataFromStorage() in initializeEmojiFeature()
  const groupsToUse = cachedState.emojiGroups

  const modal = createE('div', {
    class: 'modal d-modal fk-d-menu-modal emoji-picker-content',
    role: 'dialog',
    attrs: {
      'data-keyboard': 'false',
      'aria-modal': 'true',
      'data-controller': 'emoji-picker'
    }
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

  const closeButton = createE('button', {
    class: 'btn no-text btn-icon btn-transparent emoji-picker__close-btn',
    type: 'button',
    in: `<svg class="fa d-icon d-icon-xmark svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#xmark"></use></svg>`,
    on: {
      click: () => {
        modal.remove()
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
    style: 'max-height: 60vh; overflow-y: auto; overflow-x: hidden;'
  })

  const sections = createE('div', {
    class: 'emoji-picker__sections',
    attrs: { role: 'button' }
  })

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
        src: iconVal,
        alt: group.name || '',
        class: 'emoji',
        style: `
          width: 18px,
          height: 18px,
          objectFit: contain
        `,
        attrs: {
          'data-original-url': iconVal
        }
      }) as HTMLImageElement
      // 异步替换为缓存版本
      replaceWithCachedImage(img, iconVal)
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
      }
    })

    const titleContainer = createE('div', {
      class: 'emoji-picker__section-title-container'
    })
    const title = createE('h2', {
      class: 'emoji-picker__section-title',
      attrs: { textContent: group.name }
    })
    titleContainer.appendChild(title)

    const sectionEmojis = createE('div', {
      class: 'emoji-picker__section-emojis'
    })

    group.emojis.forEach((emoji: any) => {
      if (!emoji || typeof emoji !== 'object' || !emoji.url || !emoji.name) return
      const originalUrl = emoji.displayUrl || emoji.url
      const img = createE('img', {
        src: originalUrl,
        alt: emoji.name,
        class: 'emoji',
        style: `
          width: 32px,
          height: 32px,
          object-fit: contain;
        `,
        tabIndex: 0,
        dataset: { emoji: emoji.name },
        ti: `:${emoji.name}:`,
        ld: 'lazy',
        attrs: {
          'data-original-url': originalUrl
        },
        on: {
          click: () => {
            insertEmojiIntoEditor(emoji)
            modal.remove()
          },
          keydown: (e: KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              insertEmojiIntoEditor(emoji)
              modal.remove()
            }
          }
        }
      }) as HTMLImageElement

      // 异步替换为缓存版本
      replaceWithCachedImage(img, originalUrl)

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
