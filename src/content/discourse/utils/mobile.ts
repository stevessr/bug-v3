import { isImageUrl } from '../../utils/isimage'
import { createEl } from './element-factory'
import { ensureDefaultIfEmpty, cachedState } from './ensure'
import { insertEmojiIntoEditor } from './editor'

export async function createMobileEmojiPicker(): Promise<HTMLElement> {
  ensureDefaultIfEmpty()
  const groupsToUse = cachedState.emojiGroups

  const modal = createEl('div', {
    className: 'modal d-modal fk-d-menu-modal emoji-picker-content',
    attrs: {
      'data-keyboard': 'false',
      'aria-modal': 'true',
      role: 'dialog',
      'data-controller': 'emoji-picker'
    }
  })

  const modalContainerDiv = createEl('div', {
    className: 'd-modal__container'
  })

  const modalBody = createEl('div', {
    className: 'd-modal__body',
    attr: { tabIndex: '-1' }
  })

  const emojiPickerDiv = createEl('div', {
    className: 'emoji-picker'
  })

  const filterContainer = createEl('div', {
    className: 'emoji-picker__filter-container'
  })

  const filterInputContainer = createEl('div', {
    className: 'emoji-picker__filter filter-input-container'
  })

  const searchInput = createEl('input', {
    className: 'filter-input',
    props: {
      placeholder: '按表情符号名称和别名搜索…',
      type: 'text'
    }
  }) as HTMLInputElement
  filterInputContainer.appendChild(searchInput)

  const closeButton = createEl('button', {
    className: 'btn no-text btn-icon btn-transparent emoji-picker__close-btn',
    props: { type: 'button' },
    html: `<svg class="fa d-icon d-icon-xmark svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#xmark"></use></svg>`,
    on: {
      click: () => {
        const modalContainer = modal.closest('.modal-container')
        if (modalContainer) {
          modalContainer.remove()
        }
      }
    },
    innerHTML: `<svg class="fa d-icon d-icon-xmark svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#xmark"></use></svg>`
  }) as HTMLButtonElement

  filterContainer.appendChild(filterInputContainer)
  filterContainer.appendChild(closeButton)

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
    className: 'emoji-picker__sections',
    attrs: { role: 'button' }
  })

  groupsToUse.forEach((group: any, index: number) => {
    if (!group?.emojis?.length) return

    const navButton = createEl('button', {
      className: `btn no-text btn-flat emoji-picker__section-btn ${index === 0 ? 'active' : ''}`,
      attrs: {
        tabindex: '-1',
        'data-section': group.id
      },
      props: {
        type: 'button'
      },
      title: group.name,
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
      const img = createEl('img', {
        src: iconVal,
        alt: group.name || '',
        className: 'emoji',
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
      className: 'emoji-picker__section-title',
      attr: { textContent: group.name }
    })
    titleContainer.appendChild(title)

    const sectionEmojis = createEl('div', {
      className: 'emoji-picker__section-emojis'
    })

    group.emojis.forEach((emoji: any) => {
      if (!emoji || typeof emoji !== 'object' || !emoji.url || !emoji.name) return
      const img = createEl('img', {
        src: emoji.url,
        alt: emoji.name,
        className: 'emoji',
        width: '32px',
        height: '32px',
        tabIndex: 0,
        dataset: { emoji: emoji.name },
        title: `:${emoji.name}:`,
        loading: 'lazy',
        on: {
          click: () => {
            insertEmojiIntoEditor(emoji)
            const modalContainer = modal.closest('.modal-container')
            if (modalContainer) {
              modalContainer.remove()
            }
          },
          keydown: (e: KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              insertEmojiIntoEditor(emoji)
              const modalContainer = modal.closest('.modal-container')
              if (modalContainer) {
                modalContainer.remove()
              }
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
