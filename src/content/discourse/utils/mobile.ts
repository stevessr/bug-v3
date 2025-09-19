import { isImageUrl } from '../../utils/isimage'
import { createE } from '../../utils/createEl'

import { ensureDefaultIfEmpty, cachedState } from './ensure'
import { insertEmojiIntoEditor } from './editor'

export async function createMobileEmojiPicker(): Promise<HTMLElement> {
  ensureDefaultIfEmpty()
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
    class: 'emoji-picker__scrollable-content'
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
      const img = createE('img', {
        src: emoji.url,
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
