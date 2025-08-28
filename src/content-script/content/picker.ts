import { cachedState } from './state'
import { getDefaultEmojis } from './default'
import type { emoji } from './types'

export function isMobile(): boolean {
  return (
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    window.innerWidth <= 768
  )
}

export async function createEmojiPicker(isMobilePicker: boolean): Promise<HTMLElement> {
  const groups = cachedState.emojiGroups.length > 0 ? cachedState.emojiGroups : getDefaultEmojis()

  // Generate sections navigation HTML
  let sectionsNavHtml = ''
  let sectionsHtml = ''

  groups.forEach((group, groupIndex) => {
    if (group.emojis && Array.isArray(group.emojis)) {
      const groupId = group.UUID || `group-${groupIndex}`
      const groupIcon = group.icon || '😀'
      const groupName = group.displayName || `分组 ${groupIndex + 1}`
      const isActive = groupIndex === 0 ? 'active' : ''

      // Add navigation button for this group
      sectionsNavHtml += `
        <button class="btn no-text btn-flat emoji-picker__section-btn ${isActive}" tabindex="-1" data-section="${groupId}" type="button">
          <span style="font-size: 20px;">${groupIcon}</span>
        </button>
      `

      // Generate emoji images for this group
      let groupEmojisHtml = ''
      group.emojis.forEach((emojiData: emoji, index: number) => {
        const nameEsc = String(emojiData.displayName || '').replace(/"/g, '&quot;')
        const tabindex = index === 0 && groupIndex === 0 ? '0' : '-1'
        const dataEmoji = nameEsc
        const displayUrl = emojiData.displayUrl || emojiData.realUrl
        groupEmojisHtml += `<img width="32" height="32" class="emoji" src="${displayUrl}" tabindex="${tabindex}" data-emoji="${dataEmoji}" alt="${nameEsc}" title=":${nameEsc}:" loading="lazy" />\n`
      })

      // Add section for this group
      const sectionStyle = groupIndex === 0 ? '' : ' style="display: none;"'
      sectionsHtml += `
        <div class="emoji-picker__section" data-section="${groupId}" role="region" aria-label="${groupName}"${sectionStyle}>
          <div class="emoji-picker__section-title-container">
            <h2 class="emoji-picker__section-title">${groupName}</h2>
            <button class="btn no-text btn-icon btn-transparent" type="button">
              <svg class="fa d-icon d-icon-trash-can svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
                <use href="#trash-can"></use>
              </svg>
              <span aria-hidden="true">&ZeroWidthSpace;</span>
            </button>
          </div>
          <div class="emoji-picker__section-emojis">
            ${groupEmojisHtml}
          </div>
        </div>
      `
    }
  })

  // Create the picker element matching the target structure
  const picker = document.createElement('div')
  picker.className = 'fk-d-menu -animated -expanded'
  picker.setAttribute('data-identifier', 'emoji-picker')
  picker.setAttribute('data-content', '')
  picker.setAttribute('aria-labelledby', 'ember161')
  picker.setAttribute('aria-expanded', 'true')
  picker.setAttribute('role', 'dialog')

  if (isMobilePicker) {
    picker.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 90%;
      max-width: 400px;
      max-height: 80vh;
      background: white;
      border-radius: 12px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
      z-index: 10000;
      overflow-y: auto;
      visibility: visible;
    `
  } else {
    picker.style.cssText = `
      position: absolute;
      background: white;
      border: 1px solid #ddd;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 10000;
      min-width: 320px;
      max-width: 500px;
      max-height: 400px;
      overflow-y: auto;
      visibility: visible;
    `
  }

  picker.innerHTML = `
  <div class="fk-d-menu__inner-content">
    <div class="emoji-picker">
      <div class="emoji-picker__filter-container">
        <div class="emoji-picker__filter filter-input-container">
          <input class="filter-input" placeholder="按表情符号名称和别名搜索…" type="text" />
          <svg class="fa d-icon d-icon-magnifying-glass svg-icon -right svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
            <use href="#magnifying-glass"></use>
          </svg>
        </div>
        <button class="btn no-text fk-d-menu__trigger -trigger emoji-picker__diversity-trigger btn-transparent" aria-expanded="false" data-trigger="" type="button" id="ember162">
          <img width="20" height="20" src="/images/emoji/twemoji/clap.png" title="clap" alt="clap" class="emoji" />
        </button>
      </div>
      <div class="emoji-picker__content">
        <div class="emoji-picker__sections-nav">
          ${sectionsNavHtml}
        </div>
        <div class="emoji-picker__scrollable-content">
          <div class="emoji-picker__sections" role="button">
            ${sectionsHtml}
          </div>
        </div>
      </div>
    </div>
  </div>
  `

  // Add click handlers for emoji images
  const emojiImages = picker.querySelectorAll('.emoji-picker__section-emojis .emoji')
  emojiImages.forEach((img) => {
    img.addEventListener('click', () => {
      const emojiData: emoji = {
        id: img.getAttribute('data-emoji') || img.getAttribute('alt') || '',
        displayName: img.getAttribute('data-emoji') || img.getAttribute('alt') || '',
        realUrl: new URL(img.getAttribute('src') || ''),
        displayUrl: new URL(img.getAttribute('src') || ''),
        order: 0,
        UUID: crypto.randomUUID() as any,
      }
      insertEmoji(emojiData)
      picker.remove()
    })
  })

  // Add section navigation functionality
  const sectionButtons = picker.querySelectorAll('.emoji-picker__section-btn')
  const sections = picker.querySelectorAll('.emoji-picker__section')

  sectionButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const targetSection = button.getAttribute('data-section')

      // Remove active class from all buttons
      sectionButtons.forEach((btn) => btn.classList.remove('active'))
      // Add active class to clicked button
      button.classList.add('active')

      // Hide all sections
      sections.forEach((section) => {
        const sectionEl = section as HTMLElement
        sectionEl.style.display = 'none'
      })

      // Show target section
      const targetSectionEl = picker.querySelector(
        `[data-section="${targetSection}"]`,
      ) as HTMLElement
      if (targetSectionEl && targetSectionEl.classList.contains('emoji-picker__section')) {
        targetSectionEl.style.display = 'block'
      }
    })
  })

  // Add close functionality
  const closeBtn = picker.querySelector('.emoji-picker__section-title-container button')
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      picker.remove()
    })
  }

  // Add filter functionality
  const filterInput = picker.querySelector('.filter-input') as HTMLInputElement
  if (filterInput) {
    filterInput.addEventListener('input', (e) => {
      const searchTerm = (e.target as HTMLInputElement).value.toLowerCase()

      if (searchTerm.trim() === '') {
        // If search is empty, show only active section
        sections.forEach((section) => {
          const sectionEl = section as HTMLElement
          sectionEl.style.display = 'none'
        })
        const activeButton = picker.querySelector('.emoji-picker__section-btn.active')
        if (activeButton) {
          const activeSection = activeButton.getAttribute('data-section')
          const activeSectionEl = picker.querySelector(
            `[data-section="${activeSection}"].emoji-picker__section`,
          ) as HTMLElement
          if (activeSectionEl) {
            activeSectionEl.style.display = 'block'
          }
        }

        // Show all emojis in visible sections
        emojiImages.forEach((img) => {
          const htmlImg = img as HTMLElement
          htmlImg.style.display = 'block'
        })
      } else {
        // If searching, show all sections and filter emojis
        sections.forEach((section) => {
          const sectionEl = section as HTMLElement
          sectionEl.style.display = 'block'
        })

        emojiImages.forEach((img) => {
          const alt = img.getAttribute('alt') || ''
          const title = img.getAttribute('title') || ''
          const dataEmoji = img.getAttribute('data-emoji') || ''

          const shouldShow =
            alt.toLowerCase().includes(searchTerm) ||
            title.toLowerCase().includes(searchTerm) ||
            dataEmoji.toLowerCase().includes(searchTerm)

          const htmlImg = img as HTMLElement
          htmlImg.style.display = shouldShow ? 'block' : 'none'
        })
      }
    })
  }

  return picker
}

function insertEmoji(emojiData: emoji) {
  const activeElement = document.activeElement as HTMLElement

  if (activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'INPUT') {
    const input = activeElement as HTMLTextAreaElement | HTMLInputElement
    const start = input.selectionStart || 0
    const end = input.selectionEnd || 0
    const text = input.value

    let emojiText: string
    switch (cachedState.settings.outputFormat) {
      case 'html':
        emojiText = `<img src="${emojiData.realUrl.toString()}" alt="${emojiData.displayName}" />`
        break
      case 'bbcode':
        emojiText = `[img]${emojiData.realUrl.toString()}[/img]`
        break
      case 'markdown':
      default:
        emojiText = `![${emojiData.displayName}](${emojiData.realUrl.toString()})`
        break
    }

    input.value = text.substring(0, start) + emojiText + text.substring(end)
    input.selectionStart = input.selectionEnd = start + emojiText.length

    // Trigger input event
    input.dispatchEvent(new Event('input', { bubbles: true }))
  }
}
