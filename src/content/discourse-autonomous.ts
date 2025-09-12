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

async function createDiscourseStyleEmojiPicker(isMobile: boolean = false): Promise<HTMLElement> {
  const storage = new SimpleStorageAdapter()
  const groups = await storage.getAllEmojiGroups()
  const settings = await storage.getSettings()

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
    const existingPicker = document.querySelector('.fk-d-menu[data-identifier="emoji-picker"]')
    if (existingPicker) {
      existingPicker.remove()
      return
    }

    // Create and show picker
    const picker = await createDiscourseStyleEmojiPicker()
    document.body.appendChild(picker)

    // Position picker relative to button
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
  })

  return button
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

    // Create file input
    const fileInput = document.createElement('input')
    fileInput.type = 'file'
    fileInput.accept = 'image/*'
    fileInput.multiple = true
    fileInput.style.display = 'none'

    fileInput.addEventListener('change', async event => {
      const files = (event.target as HTMLInputElement).files
      if (files && files.length > 0) {
        for (const file of Array.from(files)) {
          try {
            // Send to background script for processing
            if ((window as any).chrome?.runtime?.sendMessage) {
              const reader = new FileReader()
              reader.onload = () => {
                const base64 = reader.result as string
                ;(window as any).chrome.runtime.sendMessage({
                  action: 'uploadEmoji',
                  file: {
                    name: file.name,
                    data: base64,
                    type: file.type
                  }
                })
              }
              reader.readAsDataURL(file)
            }
          } catch (error) {
            console.error('[Discourse] Upload failed:', error)
          }
        }
      }
      document.body.removeChild(fileInput)
    })

    document.body.appendChild(fileInput)
    fileInput.click()
  })

  return button
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
