/**
 * Autonomous Discourse Content Script
 * Self-contained script for Discourse emoji functionality
 * No external dependencies - all utilities inlined
 * Includes proper Discourse-style emoji picker and upload menu
 */

// ===== INLINED UTILITIES =====

// Storage adapter (simplified version)
class SimpleStorageAdapter {
  async get(key: string): Promise<any> {
    // Try extension storage first
    if ((window as any).chrome?.storage?.local) {
      try {
        const result = await (window as any).chrome.storage.local.get({ [key]: null })
        const value = result[key]
        if (value !== null && value !== undefined) {
          // Handle both new storage format (with .data) and legacy format
          if (value && typeof value === 'object' && value.data !== undefined) {
            return value.data
          }
          return value
        }
      } catch (error) {
        console.warn(`[Discourse Storage] Extension storage failed for ${key}:`, error)
      }
    }

    // Fallback to localStorage
    try {
      if (typeof localStorage !== 'undefined') {
        const value = localStorage.getItem(key)
        if (value) {
          const parsed = JSON.parse(value)
          if (parsed !== null && parsed !== undefined) {
            if (parsed && typeof parsed === 'object' && parsed.data !== undefined) {
              return parsed.data
            }
            return parsed
          }
        }
      }
    } catch (error) {
      console.warn(`[Discourse Storage] localStorage failed for ${key}:`, error)
    }

    return null
  }

  async getAllEmojiGroups(): Promise<any[]> {
    // First try to get the group index
    const groupIndex = await this.get('emojiGroupIndex')

    if (groupIndex && Array.isArray(groupIndex) && groupIndex.length > 0) {
      const groups = []
      for (const groupInfo of groupIndex) {
        if (groupInfo && groupInfo.id) {
          const group = await this.get(`emojiGroup_${groupInfo.id}`)
          if (group) {
            let emojisArray = group.emojis
            if (group.emojis && typeof group.emojis === 'object' && !Array.isArray(group.emojis)) {
              emojisArray = Object.values(group.emojis)
            }

            if (emojisArray && Array.isArray(emojisArray)) {
              const processedGroup = { ...group, emojis: emojisArray, order: groupInfo.order || 0 }
              groups.push(processedGroup)
            } else if (groupInfo.id === 'favorites') {
              const favoritesGroup = {
                ...group,
                emojis: emojisArray && Array.isArray(emojisArray) ? emojisArray : [],
                order: groupInfo.order || 0
              }
              groups.push(favoritesGroup)
            }
          }
        }
      }

      if (groups.length > 0) {
        // Ensure favorites group is always first
        const favoritesGroup = groups.find(g => g.id === 'favorites')
        const otherGroups = groups
          .filter(g => g.id !== 'favorites')
          .sort((a, b) => a.order - b.order)
        return favoritesGroup ? [favoritesGroup, ...otherGroups] : otherGroups
      }
    }

    // Fallback to legacy emojiGroups key
    const legacyGroups = await this.get('emojiGroups')
    if (legacyGroups && Array.isArray(legacyGroups) && legacyGroups.length > 0) {
      const favoritesGroup = legacyGroups.find(g => g.id === 'favorites')
      const otherGroups = legacyGroups
        .filter(g => g.id !== 'favorites')
        .sort((a, b) => (a.order || 0) - (b.order || 0))
      return favoritesGroup ? [favoritesGroup, ...otherGroups] : otherGroups
    }

    return []
  }

  async getSettings(): Promise<any> {
    const settings = await this.get('appSettings')
    const defaultSettings = {
      outputFormat: 'markdown',
      forceMobileMode: false,
      gridColumns: 6
    }

    if (settings && typeof settings === 'object') {
      return { ...defaultSettings, ...settings }
    }

    return defaultSettings
  }
}

// ===== TOOLBAR UTILITIES =====

const TOOLBAR_SELECTORS = [
  '.d-editor-button-bar[role="toolbar"]', // Standard editor toolbar
  '.chat-composer__inner-container' // Chat composer
]

function findAllToolbars(): Element[] {
  const toolbars: Element[] = []
  for (const selector of TOOLBAR_SELECTORS) {
    const elements = document.querySelectorAll(selector)
    toolbars.push(...Array.from(elements))
  }
  return toolbars
}

// ===== DISCOURSE-STYLE EMOJI PICKER =====

function isMobileDevice(): boolean {
  const userAgent = navigator.userAgent
  const mobileKeywords = ['Android', 'iPhone', 'iPad', 'iPod', 'Windows Phone']
  return mobileKeywords.some(keyword => userAgent.includes(keyword))
}

async function createDiscourseStyleEmojiPicker(forceMobile: boolean = false): Promise<HTMLElement> {
  const storage = new SimpleStorageAdapter()
  const groups = await storage.getAllEmojiGroups()
  const settings = await storage.getSettings()

  const isMobile = forceMobile || isMobileDevice() || settings.forceMobileMode

  if (isMobile) {
    return createMobileEmojiPicker(groups, settings)
  }

  return createDesktopEmojiPicker(groups, settings)
}

async function createDesktopEmojiPicker(groups: any[], settings: any): Promise<HTMLElement> {
  // Create main picker container with Discourse styling
  const picker = document.createElement('div')
  picker.className = 'fk-d-menu -animated -expanded'
  picker.setAttribute('data-identifier', 'emoji-picker')
  picker.setAttribute('data-content', '')
  picker.setAttribute('aria-expanded', 'true')
  picker.setAttribute('role', 'dialog')
  picker.style.cssText = `
    max-width: 400px;
    visibility: visible;
    position: fixed;
    z-index: 10000;
  `
  picker.setAttribute('data-strategy', 'absolute')
  picker.setAttribute('data-placement', 'top')

  const innerContent = document.createElement('div')
  innerContent.className = 'fk-d-menu__inner-content'

  const emojiPickerDiv = document.createElement('div')
  emojiPickerDiv.className = 'emoji-picker'

  // Filter container
  const filterContainer = document.createElement('div')
  filterContainer.className = 'emoji-picker__filter-container'

  const filterDiv = document.createElement('div')
  filterDiv.className = 'emoji-picker__filter filter-input-container'

  const filterInput = document.createElement('input')
  filterInput.className = 'filter-input'
  filterInput.placeholder = '按表情符号名称和别名搜索…'
  filterInput.type = 'text'

  filterDiv.appendChild(filterInput)
  filterContainer.appendChild(filterDiv)

  // Content area
  const content = document.createElement('div')
  content.className = 'emoji-picker__content'

  // Sections navigation
  const sectionsNav = document.createElement('div')
  sectionsNav.className = 'emoji-picker__sections-nav'

  // Scrollable content
  const scrollableContent = document.createElement('div')
  scrollableContent.className = 'emoji-picker__scrollable-content'

  const sections = document.createElement('div')
  sections.className = 'emoji-picker__sections'
  sections.setAttribute('role', 'button')

  if (groups.length === 0) {
    const emptySection = document.createElement('div')
    emptySection.className = 'emoji-picker__section'
    emptySection.innerHTML =
      '<div style="text-align: center; color: #6b7280; padding: 40px;">暂无表情包</div>'
    sections.appendChild(emptySection)
  } else {
    groups.forEach((group, index) => {
      if (!group.emojis || group.emojis.length === 0) return

      // Create section button in nav
      const sectionBtn = document.createElement('button')
      sectionBtn.className = `btn no-text btn-flat emoji-picker__section-btn ${index === 0 ? 'active' : ''}`
      sectionBtn.setAttribute('tabindex', '-1')
      sectionBtn.setAttribute('data-section', group.id || `group-${index}`)
      sectionBtn.type = 'button'

      // Use first emoji as nav icon
      if (group.emojis[0] && group.emojis[0].url) {
        const navImg = document.createElement('img')
        navImg.width = 20
        navImg.height = 20
        navImg.src = group.emojis[0].url
        navImg.title = group.name || '分组'
        navImg.alt = group.name || '分组'
        navImg.className = 'emoji'
        sectionBtn.appendChild(navImg)
      }

      sectionsNav.appendChild(sectionBtn)

      // Create section content
      const section = document.createElement('div')
      section.className = 'emoji-picker__section'
      section.setAttribute('data-section', group.id || `group-${index}`)
      section.setAttribute('role', 'region')
      section.setAttribute('aria-label', group.name || '分组')

      // Section title
      const titleContainer = document.createElement('div')
      titleContainer.className = 'emoji-picker__section-title-container'

      const title = document.createElement('h2')
      title.className = 'emoji-picker__section-title'
      title.textContent = group.name || '未命名分组'

      titleContainer.appendChild(title)
      section.appendChild(titleContainer)

      // Section emojis
      const sectionEmojis = document.createElement('div')
      sectionEmojis.className = 'emoji-picker__section-emojis'

      group.emojis.forEach((emoji: any) => {
        if (emoji.url) {
          const img = document.createElement('img')
          img.width = 32
          img.height = 32
          img.className = 'emoji'
          img.src = emoji.url
          img.setAttribute('tabindex', '0')
          img.setAttribute('data-emoji', emoji.name || '')
          img.alt = emoji.name || ''
          img.title = `:${emoji.name || ''}:`
          img.loading = 'lazy'

          img.addEventListener('click', () => {
            insertEmojiIntoEditor(emoji, settings)
            picker.remove()
          })

          sectionEmojis.appendChild(img)
        }
      })

      section.appendChild(sectionEmojis)
      sections.appendChild(section)
    })
  }

  scrollableContent.appendChild(sections)
  content.appendChild(sectionsNav)
  content.appendChild(scrollableContent)
  emojiPickerDiv.appendChild(filterContainer)
  emojiPickerDiv.appendChild(content)
  innerContent.appendChild(emojiPickerDiv)
  picker.appendChild(innerContent)

  return picker
}

async function createMobileEmojiPicker(groups: any[], settings: any): Promise<HTMLElement> {
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
    } else {
      modal.remove()
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

  if (groups.length === 0) {
    const emptySection = document.createElement('div')
    emptySection.className = 'emoji-picker__section'
    emptySection.innerHTML =
      '<div style="text-align: center; color: #6b7280; padding: 40px;">暂无表情包</div>'
    sections.appendChild(emptySection)
  } else {
    groups.forEach((group, index) => {
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
          insertEmojiIntoEditor(emoji, settings)
          const modalContainer = modal.closest('.modal-container')
          if (modalContainer) {
            modalContainer.remove()
          } else {
            modal.remove()
          }
        })
        img.addEventListener('keydown', (e: any) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            insertEmojiIntoEditor(emoji, settings)
            const modalContainer = modal.closest('.modal-container')
            if (modalContainer) {
              modalContainer.remove()
            } else {
              modal.remove()
            }
          }
        })
        sectionEmojis.appendChild(img)
      })

      section.appendChild(titleContainer)
      section.appendChild(sectionEmojis)
      sections.appendChild(section)
    })
  }

  // Enhanced search functionality with fuzzy matching
  searchInput.addEventListener('input', (e: any) => {
    const query = (e.target.value || '').toLowerCase().trim()

    sections.querySelectorAll('img').forEach(img => {
      const emojiName = (img.dataset.emoji || '').toLowerCase()
      let isVisible = false

      if (query === '') {
        isVisible = true
      } else {
        // Exact match
        if (emojiName.includes(query)) {
          isVisible = true
        } else if (settings.enableFuzzySearch !== false) {
          // Fuzzy matching - check if all characters in query exist in emoji name
          isVisible = fuzzyMatch(query, emojiName)
        }
      }

      ;(img as HTMLElement).style.display = isVisible ? '' : 'none'
    })

    // Hide/show sections based on visible emojis
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

// Fuzzy matching function
function fuzzyMatch(query: string, target: string): boolean {
  let queryIndex = 0
  let targetIndex = 0

  while (queryIndex < query.length && targetIndex < target.length) {
    if (query[queryIndex] === target[targetIndex]) {
      queryIndex++
    }
    targetIndex++
  }

  return queryIndex === query.length
}

function isImageUrl(value: string | null | undefined): boolean {
  if (!value || typeof value !== 'string') return false
  return value.startsWith('http') && /\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i.test(value)
}

// ===== EDITOR INSERTION =====

function insertEmojiIntoEditor(emoji: any, settings: any) {
  try {
    // Add to favorites
    if ((window as any).chrome?.runtime?.sendMessage) {
      ;(window as any).chrome.runtime.sendMessage({
        action: 'addToFavorites',
        emoji: emoji
      })
    }

    // Insert into editor
    const textArea = document.querySelector('textarea.d-editor-input') as HTMLTextAreaElement | null
    const richEle = document.querySelector('.ProseMirror.d-editor-input') as HTMLElement | null

    let text = ''
    if (settings.outputFormat === 'html' && emoji.url) {
      text = `<img src="${emoji.url}" alt="${emoji.name || ''}" width="24" height="24">`
    } else if (emoji.url) {
      text = `![${emoji.name || ''}](${emoji.url})`
    } else {
      text = emoji.name || ''
    }

    if (textArea) {
      const start = textArea.selectionStart
      const end = textArea.selectionEnd
      const value = textArea.value

      textArea.value = value.substring(0, start) + text + value.substring(end)
      textArea.setSelectionRange(start + text.length, start + text.length)
      textArea.focus()

      const event = new Event('input', { bubbles: true })
      textArea.dispatchEvent(event)
    } else if (richEle) {
      const selection = window.getSelection()
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0)
        const textNode = document.createTextNode(text)
        range.insertNode(textNode)

        range.setStartAfter(textNode)
        range.setEndAfter(textNode)
        selection.removeAllRanges()
        selection.addRange(range)
      }
      richEle.focus()
    }
  } catch (e) {
    console.error('[Discourse] Insert emoji failed:', e)
  }
}

// ===== BUTTON CREATION =====

function createEmojiButton(): HTMLElement {
  const button = document.createElement('button')
  button.className = 'btn no-text btn-icon emoji-picker-btn'
  button.type = 'button'
  button.title = '表情包'
  button.setAttribute('aria-label', '表情包')

  // Create emoji icon
  const icon = document.createElement('span')
  icon.textContent = '😀'
  icon.style.fontSize = '16px'
  button.appendChild(icon)

  button.addEventListener('click', async e => {
    e.preventDefault()
    e.stopPropagation()

    // Remove existing picker
    const existingPicker = document.querySelector(
      '.fk-d-menu[data-identifier="emoji-picker"], .modal[data-identifier="emoji-picker"]'
    )
    if (existingPicker) {
      existingPicker.remove()
      return
    }

    // Create and show picker
    const picker = await createDiscourseStyleEmojiPicker()

    // Check if it's a mobile modal
    if (picker.classList.contains('modal')) {
      // Mobile view - create modal container and add to body
      const modalContainer = document.createElement('div')
      modalContainer.className = 'modal-container'
      modalContainer.appendChild(picker)
      document.body.appendChild(modalContainer)

      // Add backdrop click handler
      modalContainer.addEventListener('click', event => {
        if (event.target === modalContainer) {
          modalContainer.remove()
        }
      })
    } else {
      // Desktop view - position relative to button
      document.body.appendChild(picker)

      const rect = button.getBoundingClientRect()
      picker.style.left = `${rect.left}px`
      picker.style.bottom = `${window.innerHeight - rect.top + 10}px`

      // Close picker when clicking outside
      const closeHandler = (event: Event) => {
        if (!picker.contains(event.target as Node)) {
          picker.remove()
          document.removeEventListener('click', closeHandler)
        }
      }
      setTimeout(() => document.addEventListener('click', closeHandler), 100)
    }
  })

  return button
}

// ===== UPLOAD MENU CREATION =====

interface UploadItem {
  id: string
  file: File
  name: string
  status: 'pending' | 'uploading' | 'success' | 'error'
  progress: number
  error?: string
  url?: string
  retryCount: number
}

function createUploadMenu(): HTMLElement {
  const menu = document.createElement('div')
  menu.className = 'fk-d-menu -animated -expanded upload-menu'
  menu.setAttribute('data-identifier', 'upload-menu')
  menu.setAttribute('role', 'dialog')
  menu.style.cssText = `
    max-width: 500px;
    visibility: visible;
    position: fixed;
    z-index: 10000;
    background: white;
    border-radius: 8px;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
  `

  const innerContent = document.createElement('div')
  innerContent.className = 'fk-d-menu__inner-content'

  const uploadDiv = document.createElement('div')
  uploadDiv.className = 'upload-container'
  uploadDiv.style.cssText = `
    padding: 20px;
    min-height: 200px;
  `

  // Header
  const header = document.createElement('div')
  header.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid #e5e7eb;
  `

  const title = document.createElement('h3')
  title.textContent = '上传表情'
  title.style.cssText = `
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: #374151;
  `

  const closeButton = document.createElement('button')
  closeButton.innerHTML = '✕'
  closeButton.style.cssText = `
    background: none;
    border: none;
    font-size: 16px;
    cursor: pointer;
    color: #6b7280;
    padding: 4px;
    border-radius: 4px;
  `
  closeButton.addEventListener('click', () => menu.remove())

  header.appendChild(title)
  header.appendChild(closeButton)

  // Upload options
  const optionsDiv = document.createElement('div')
  optionsDiv.style.cssText = `
    display: flex;
    gap: 12px;
    margin-bottom: 16px;
  `

  const uploadButton = document.createElement('button')
  uploadButton.className = 'btn btn-primary'
  uploadButton.textContent = '选择文件'
  uploadButton.style.cssText = `
    flex: 1;
    padding: 8px 16px;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
  `

  const parseButton = document.createElement('button')
  parseButton.className = 'btn btn-secondary'
  parseButton.textContent = '差分上传'
  parseButton.style.cssText = `
    flex: 1;
    padding: 8px 16px;
    background: #6b7280;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
  `

  optionsDiv.appendChild(uploadButton)
  optionsDiv.appendChild(parseButton)

  // Upload list
  const uploadList = document.createElement('div')
  uploadList.className = 'upload-list'
  uploadList.style.cssText = `
    max-height: 300px;
    overflow-y: auto;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    padding: 8px;
    background: #f9fafb;
  `

  const emptyState = document.createElement('div')
  emptyState.className = 'empty-state'
  emptyState.textContent = '拖拽文件到此处或点击上方按钮选择文件'
  emptyState.style.cssText = `
    text-align: center;
    color: #6b7280;
    padding: 40px 20px;
    font-size: 14px;
  `
  uploadList.appendChild(emptyState)

  uploadDiv.appendChild(header)
  uploadDiv.appendChild(optionsDiv)
  uploadDiv.appendChild(uploadList)
  innerContent.appendChild(uploadDiv)
  menu.appendChild(innerContent)

  // Setup event handlers
  setupUploadMenuHandlers(menu, uploadButton, parseButton, uploadList)

  return menu
}

function createUploadButton(): HTMLElement {
  const button = document.createElement('button')
  button.className = 'btn no-text btn-icon upload-emoji-btn'
  button.type = 'button'
  button.title = '上传表情'
  button.setAttribute('aria-label', '上传表情')

  // Create upload icon
  const icon = document.createElement('span')
  icon.textContent = '📤'
  icon.style.fontSize = '16px'
  button.appendChild(icon)

  button.addEventListener('click', e => {
    e.preventDefault()
    e.stopPropagation()

    // Remove existing menu
    const existingMenu = document.querySelector('.upload-menu')
    if (existingMenu) {
      existingMenu.remove()
      return
    }

    // Create and show upload menu
    const menu = createUploadMenu()
    document.body.appendChild(menu)

    // Position menu relative to button
    const rect = button.getBoundingClientRect()
    menu.style.left = `${rect.left}px`
    menu.style.bottom = `${window.innerHeight - rect.top + 10}px`

    // Close menu when clicking outside
    const closeHandler = (event: Event) => {
      if (!menu.contains(event.target as Node)) {
        menu.remove()
        document.removeEventListener('click', closeHandler)
      }
    }
    setTimeout(() => document.addEventListener('click', closeHandler), 100)
  })

  return button
}

// ===== UPLOAD MENU HANDLERS =====

let uploadItems: UploadItem[] = []
let uploadIdCounter = 0

function setupUploadMenuHandlers(
  menu: HTMLElement,
  uploadButton: HTMLElement,
  parseButton: HTMLElement,
  uploadList: HTMLElement
) {
  // File upload handler
  uploadButton.addEventListener('click', () => {
    const fileInput = document.createElement('input')
    fileInput.type = 'file'
    fileInput.accept = 'image/*'
    fileInput.multiple = true
    fileInput.style.display = 'none'

    fileInput.addEventListener('change', event => {
      const files = (event.target as HTMLInputElement).files
      if (files) {
        handleFileUpload(Array.from(files), uploadList)
      }
      document.body.removeChild(fileInput)
    })

    document.body.appendChild(fileInput)
    fileInput.click()
  })

  // Parse upload handler (差分上传)
  parseButton.addEventListener('click', () => {
    const textArea = document.querySelector('textarea.d-editor-input') as HTMLTextAreaElement
    if (textArea) {
      const content = textArea.value
      const imageUrls = extractImageUrlsFromMarkdown(content)
      if (imageUrls.length > 0) {
        handleParseUpload(imageUrls, uploadList)
      } else {
        showNotification('未找到可解析的图片链接', 'warning')
      }
    }
  })

  // Drag and drop support
  uploadList.addEventListener('dragover', e => {
    e.preventDefault()
    uploadList.style.backgroundColor = '#e5e7eb'
  })

  uploadList.addEventListener('dragleave', () => {
    uploadList.style.backgroundColor = '#f9fafb'
  })

  uploadList.addEventListener('drop', e => {
    e.preventDefault()
    uploadList.style.backgroundColor = '#f9fafb'

    const files = Array.from(e.dataTransfer?.files || [])
    const imageFiles = files.filter(file => file.type.startsWith('image/'))
    if (imageFiles.length > 0) {
      handleFileUpload(imageFiles, uploadList)
    }
  })

  // Paste support
  document.addEventListener('paste', e => {
    if (!menu.contains(document.activeElement)) return

    const items = e.clipboardData?.items
    if (items) {
      const files: File[] = []
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file) files.push(file)
        }
      }
      if (files.length > 0) {
        handleFileUpload(files, uploadList)
      }
    }
  })
}

function handleFileUpload(files: File[], uploadList: HTMLElement) {
  const emptyState = uploadList.querySelector('.empty-state')
  if (emptyState) emptyState.remove()

  files.forEach(file => {
    const uploadItem: UploadItem = {
      id: `upload-${++uploadIdCounter}`,
      file,
      name: file.name.replace(/\.[^/.]+$/, ''), // Remove extension
      status: 'pending',
      progress: 0,
      retryCount: 0
    }

    uploadItems.push(uploadItem)
    addUploadItemToList(uploadItem, uploadList)
    startUpload(uploadItem, uploadList)
  })
}

function handleParseUpload(imageUrls: string[], uploadList: HTMLElement) {
  const emptyState = uploadList.querySelector('.empty-state')
  if (emptyState) emptyState.remove()

  imageUrls.forEach(url => {
    const uploadItem: UploadItem = {
      id: `parse-${++uploadIdCounter}`,
      file: null as any, // Will be downloaded
      name: extractImageNameFromUrl(url),
      status: 'pending',
      progress: 0,
      retryCount: 0
    }

    uploadItems.push(uploadItem)
    addUploadItemToList(uploadItem, uploadList)
    startParseUpload(uploadItem, url, uploadList)
  })
}

function extractImageUrlsFromMarkdown(content: string): string[] {
  const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g
  const urls: string[] = []
  let match

  while ((match = imageRegex.exec(content)) !== null) {
    const url = match[2]
    if (url && (url.startsWith('http') || url.startsWith('https'))) {
      urls.push(url)
    }
  }

  return urls
}

function extractImageNameFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname
    const filename = pathname.split('/').pop() || 'image'
    return filename.replace(/\.[^/.]+$/, '') // Remove extension
  } catch {
    return 'image'
  }
}

// ===== UPLOAD LIST MANAGEMENT =====

function addUploadItemToList(item: UploadItem, uploadList: HTMLElement) {
  const itemDiv = document.createElement('div')
  itemDiv.className = 'upload-item'
  itemDiv.id = item.id
  itemDiv.style.cssText = `
    display: flex;
    align-items: center;
    padding: 8px 12px;
    margin-bottom: 8px;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    font-size: 14px;
  `

  const nameSpan = document.createElement('span')
  nameSpan.className = 'upload-name'
  nameSpan.textContent = item.name
  nameSpan.style.cssText = `
    flex: 1;
    margin-right: 12px;
    font-weight: 500;
  `

  const statusSpan = document.createElement('span')
  statusSpan.className = 'upload-status'
  statusSpan.textContent = '等待中...'
  statusSpan.style.cssText = `
    margin-right: 12px;
    color: #6b7280;
    font-size: 12px;
  `

  const progressBar = document.createElement('div')
  progressBar.className = 'upload-progress'
  progressBar.style.cssText = `
    width: 60px;
    height: 4px;
    background: #e5e7eb;
    border-radius: 2px;
    margin-right: 12px;
    overflow: hidden;
  `

  const progressFill = document.createElement('div')
  progressFill.className = 'upload-progress-fill'
  progressFill.style.cssText = `
    width: 0%;
    height: 100%;
    background: #3b82f6;
    transition: width 0.3s ease;
  `
  progressBar.appendChild(progressFill)

  const retryButton = document.createElement('button')
  retryButton.className = 'upload-retry'
  retryButton.textContent = '重试'
  retryButton.style.cssText = `
    display: none;
    padding: 4px 8px;
    background: #f59e0b;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
  `

  retryButton.addEventListener('click', () => {
    item.retryCount = 0
    item.status = 'pending'
    updateUploadItemStatus(item, uploadList)
    if (item.file) {
      startUpload(item, uploadList)
    }
  })

  itemDiv.appendChild(nameSpan)
  itemDiv.appendChild(statusSpan)
  itemDiv.appendChild(progressBar)
  itemDiv.appendChild(retryButton)
  uploadList.appendChild(itemDiv)
}

function updateUploadItemStatus(item: UploadItem, uploadList: HTMLElement) {
  const itemDiv = uploadList.querySelector(`#${item.id}`)
  if (!itemDiv) return

  const statusSpan = itemDiv.querySelector('.upload-status') as HTMLElement
  const progressFill = itemDiv.querySelector('.upload-progress-fill') as HTMLElement
  const retryButton = itemDiv.querySelector('.upload-retry') as HTMLElement

  progressFill.style.width = `${item.progress}%`

  switch (item.status) {
    case 'pending':
      statusSpan.textContent = '等待中...'
      statusSpan.style.color = '#6b7280'
      retryButton.style.display = 'none'
      break
    case 'uploading':
      statusSpan.textContent = '上传中...'
      statusSpan.style.color = '#3b82f6'
      retryButton.style.display = 'none'
      break
    case 'success':
      statusSpan.textContent = '成功'
      statusSpan.style.color = '#10b981'
      retryButton.style.display = 'none'
      progressFill.style.background = '#10b981'
      break
    case 'error':
      statusSpan.textContent = item.error || '失败'
      statusSpan.style.color = '#ef4444'
      retryButton.style.display = 'inline-block'
      progressFill.style.background = '#ef4444'
      break
  }
}

async function startUpload(item: UploadItem, uploadList: HTMLElement) {
  item.status = 'uploading'
  item.progress = 10
  updateUploadItemStatus(item, uploadList)

  try {
    // Convert file to base64
    const base64 = await fileToBase64(item.file)
    item.progress = 30
    updateUploadItemStatus(item, uploadList)

    // Send to background script
    const response = await sendToBackground({
      action: 'uploadEmoji',
      file: {
        name: item.name,
        data: base64,
        type: item.file.type
      }
    })

    item.progress = 100
    if (response && response.success) {
      item.status = 'success'
      item.url = response.url

      // Insert markdown into textarea
      insertMarkdownIntoEditor(item.name, response.url)
    } else {
      throw new Error(response?.error || '上传失败')
    }
  } catch (error) {
    item.error = error instanceof Error ? error.message : '上传失败'
    item.status = 'error'
    item.retryCount++

    // Auto retry up to 2 times
    if (item.retryCount < 3) {
      setTimeout(() => {
        startUpload(item, uploadList)
      }, 1000 * item.retryCount)
      return
    }
  }

  updateUploadItemStatus(item, uploadList)
  checkUploadCompletion(uploadList)
}

async function startParseUpload(item: UploadItem, url: string, uploadList: HTMLElement) {
  item.status = 'uploading'
  item.progress = 10
  updateUploadItemStatus(item, uploadList)

  try {
    // Send URL to background for processing
    const response = await sendToBackground({
      action: 'downloadAndUploadEmoji',
      url: url,
      name: item.name
    })

    item.progress = 100
    if (response && response.success) {
      item.status = 'success'
      item.url = response.url

      // Insert markdown into textarea
      insertMarkdownIntoEditor(item.name, response.url)
    } else {
      throw new Error(response?.error || '处理失败')
    }
  } catch (error) {
    item.error = error instanceof Error ? error.message : '处理失败'
    item.status = 'error'
    item.retryCount++

    // Auto retry up to 2 times
    if (item.retryCount < 3) {
      setTimeout(() => {
        startParseUpload(item, url, uploadList)
      }, 1000 * item.retryCount)
      return
    }
  }

  updateUploadItemStatus(item, uploadList)
  checkUploadCompletion(uploadList)
}

function checkUploadCompletion(uploadList: HTMLElement) {
  const allCompleted = uploadItems.every(
    item => item.status === 'success' || item.status === 'error'
  )

  const hasErrors = uploadItems.some(item => item.status === 'error')

  if (allCompleted && !hasErrors) {
    // All successful, auto-close after 2 seconds
    setTimeout(() => {
      const menu = uploadList.closest('.upload-menu')
      if (menu) menu.remove()
      uploadItems = [] // Clear items
    }, 2000)
  }
}

// ===== UTILITY FUNCTIONS =====

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function sendToBackground(message: any): Promise<any> {
  return new Promise(resolve => {
    if ((window as any).chrome?.runtime?.sendMessage) {
      ;(window as any).chrome.runtime.sendMessage(message, resolve)
    } else {
      resolve({ success: false, error: 'Chrome runtime not available' })
    }
  })
}

function insertMarkdownIntoEditor(name: string, url: string) {
  const textArea = document.querySelector('textarea.d-editor-input') as HTMLTextAreaElement
  if (textArea) {
    const markdown = `![${name}](${url})`
    const start = textArea.selectionStart
    const end = textArea.selectionEnd
    const value = textArea.value

    textArea.value = value.substring(0, start) + markdown + value.substring(end)
    textArea.setSelectionRange(start + markdown.length, start + markdown.length)
    textArea.focus()

    // Trigger input event
    const event = new Event('input', { bubbles: true })
    textArea.dispatchEvent(event)
  }
}

function showNotification(message: string, type: 'success' | 'error' | 'warning' = 'success') {
  const notification = document.createElement('div')
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 16px;
    border-radius: 6px;
    color: white;
    font-size: 14px;
    z-index: 10001;
    background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#f59e0b'};
  `
  notification.textContent = message
  document.body.appendChild(notification)

  setTimeout(() => {
    notification.remove()
  }, 3000)
}

// ===== TOOLBAR INJECTION =====

function injectButtonsIntoToolbar(toolbar: Element) {
  if (toolbar.querySelector('.emoji-picker-btn') || toolbar.querySelector('.upload-emoji-btn')) {
    return // Already injected
  }

  const emojiButton = createEmojiButton()
  const uploadButton = createUploadButton()

  // Find insertion point (usually after existing buttons)
  const lastButton = toolbar.querySelector('button:last-of-type')
  if (lastButton) {
    lastButton.parentNode?.insertBefore(emojiButton, lastButton.nextSibling)
    lastButton.parentNode?.insertBefore(uploadButton, emojiButton.nextSibling)
  } else {
    toolbar.appendChild(emojiButton)
    toolbar.appendChild(uploadButton)
  }
}

function scanAndInjectButtons() {
  try {
    const toolbars = findAllToolbars()
    toolbars.forEach(toolbar => {
      injectButtonsIntoToolbar(toolbar)
    })
  } catch (e) {
    console.error('[Discourse] Scan and inject failed:', e)
  }
}

// ===== MUTATION OBSERVER =====

function observeForToolbars() {
  try {
    const observer = new MutationObserver(mutations => {
      let shouldScan = false

      mutations.forEach(mutation => {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as Element
              // Check if new toolbar was added
              if (
                element.matches(
                  '.d-editor-button-bar[role="toolbar"], .chat-composer__inner-container'
                ) ||
                element.querySelector(
                  '.d-editor-button-bar[role="toolbar"], .chat-composer__inner-container'
                )
              ) {
                shouldScan = true
                break
              }
            }
          }
        }
      })

      if (shouldScan) {
        setTimeout(scanAndInjectButtons, 100)
      }
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true
    })
  } catch (e) {
    console.error('[Discourse] Observer setup failed:', e)
  }
}

// ===== INITIALIZATION =====

function initDiscourse() {
  try {
    console.log('[Discourse] Initializing autonomous content script')

    // Initial scan and setup observer
    setTimeout(scanAndInjectButtons, 200)
    observeForToolbars()

    console.log('[Discourse] Autonomous content script initialized')
  } catch (e) {
    console.error('[Discourse] Initialization failed:', e)
  }
}

// Auto-initialize when script loads
try {
  initDiscourse()
} catch (e) {
  console.error('[Discourse] Auto-initialization failed:', e)
}
