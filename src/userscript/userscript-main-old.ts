// Main userscript entry point - adapted from content script

// Compile-time flag injected by vite config: when true the build is the remote variant
declare const __USERSCRIPT_REMOTE_DEFAULTS__: boolean

import {
  loadDataFromLocalStorage,
  loadDataFromLocalStorageAsync,
} from './userscript-storage'
import { userscriptState } from './state'

// Import modular components
import { initOneClickAdd } from './modules/oneClickAdd'
import { attemptInjection, startPeriodicInjection } from './modules/toolbar'

// userscriptState is imported from ./state and initialized there

// Initialize from localStorage
async function initializeUserscriptData() {
  const data = await loadDataFromLocalStorageAsync().catch((err: any) => {
    console.warn(
      '[Userscript] loadDataFromLocalStorageAsync failed, falling back to sync loader',
      err
    )
    return loadDataFromLocalStorage()
  })
  userscriptState.emojiGroups = data.emojiGroups || []
  userscriptState.settings = data.settings || userscriptState.settings
}

// Function to check if current page should have emoji injection
function shouldInjectEmoji(): boolean {
  // Check for discourse meta tags
  const discourseMetaTags = document.querySelectorAll(
    'meta[name*="discourse"], meta[content*="discourse"], meta[property*="discourse"]'
  )
  if (discourseMetaTags.length > 0) {
    console.log('[Emoji Extension Userscript] Discourse detected via meta tags')
    return true
  }

  // Check for common forum/discussion platforms
  const generatorMeta = document.querySelector('meta[name="generator"]')
  if (generatorMeta) {
    const content = generatorMeta.getAttribute('content')?.toLowerCase() || ''
    if (content.includes('discourse') || content.includes('flarum') || content.includes('phpbb')) {
      console.log('[Emoji Extension Userscript] Forum platform detected via generator meta')
      return true
    }
  }

  // Check current domain - allow linux.do and other known sites
  const hostname = window.location.hostname.toLowerCase()
  const allowedDomains = ['linux.do', 'meta.discourse.org', 'pixiv.net']
  if (allowedDomains.some(domain => hostname.includes(domain))) {
    console.log('[Emoji Extension Userscript] Allowed domain detected:', hostname)
    return true
  }

  // Check for editor elements that suggest a discussion platform
  const editors = document.querySelectorAll(
    'textarea.d-editor-input, .ProseMirror.d-editor-input, .composer-input, .reply-area textarea'
  )
  if (editors.length > 0) {
    console.log('[Emoji Extension Userscript] Discussion editor detected')
    return true
  }

  console.log('[Emoji Extension Userscript] No compatible platform detected')
  return false
}

// Insert emoji into editor (adapted from content script)
function insertEmojiIntoEditor(emoji: any) {
  console.log('[Emoji Extension Userscript] Inserting emoji:', emoji)

  const textarea = document.querySelector('textarea.d-editor-input') as HTMLTextAreaElement | null
  const proseMirror = document.querySelector('.ProseMirror.d-editor-input') as HTMLElement | null

  if (!textarea && !proseMirror) {
    console.error('找不到输入框')
    return
  }

  // Extract dimensions from URL or use defaults
  const dimensionMatch = emoji.url?.match(/_(\d{3,})x(\d{3,})\./)
  let width = '500'
  let height = '500'

  if (dimensionMatch) {
    width = dimensionMatch[1]
    height = dimensionMatch[2]
  } else if (emoji.width && emoji.height) {
    width = emoji.width.toString()
    height = emoji.height.toString()
  }

  const scale = userscriptState.settings?.imageScale || 30
  const outputFormat = userscriptState.settings?.outputFormat || 'markdown'

  if (textarea) {
    let insertText = ''

    if (outputFormat === 'html') {
      const scaledWidth = Math.max(1, Math.round(Number(width) * (scale / 100)))
      const scaledHeight = Math.max(1, Math.round(Number(height) * (scale / 100)))
      insertText = `<img src="${emoji.url}" title=":${emoji.name}:" class="emoji only-emoji" alt=":${emoji.name}:" loading="lazy" width="${scaledWidth}" height="${scaledHeight}" style="aspect-ratio: ${scaledWidth} / ${scaledHeight};"> `
    } else {
      insertText = `![${emoji.name}|${width}x${height},${scale}%](${emoji.url}) `
    }

    const selectionStart = textarea.selectionStart
    const selectionEnd = textarea.selectionEnd
    textarea.value =
      textarea.value.substring(0, selectionStart) +
      insertText +
      textarea.value.substring(selectionEnd, textarea.value.length)
    textarea.selectionStart = textarea.selectionEnd = selectionStart + insertText.length
    textarea.focus()

    // Trigger input event
    const inputEvent = new Event('input', { bubbles: true, cancelable: true })
    textarea.dispatchEvent(inputEvent)
  } else if (proseMirror) {
    const imgWidth = Number(width) || 500
    const scaledWidth = Math.max(1, Math.round(imgWidth * (scale / 100)))
    const htmlContent = `<img src="${emoji.url}" alt="${emoji.name}" width="${width}" height="${height}" data-scale="${scale}" style="width: ${scaledWidth}px">`

    try {
      // Try clipboard approach first
      const dataTransfer = new DataTransfer()
      dataTransfer.setData('text/html', htmlContent)
      const pasteEvent = new ClipboardEvent('paste', { clipboardData: dataTransfer, bubbles: true })
      proseMirror.dispatchEvent(pasteEvent)
    } catch (error) {
      try {
        // Fallback to execCommand
        document.execCommand('insertHTML', false, htmlContent)
      } catch (fallbackError) {
        console.error('无法向富文本编辑器中插入表情', fallbackError)
      }
    }
  }
}

// Find toolbars where we can inject buttons (copied from injector.ts)
const toolbarSelectors = ['.d-editor-button-bar[role="toolbar"]', '.chat-composer__inner-container']

function findAllToolbars(): HTMLElement[] {
  const toolbars: HTMLElement[] = []
  for (const selector of toolbarSelectors) {
    const elements = document.querySelectorAll(selector)
    toolbars.push(...(Array.from(elements) as HTMLElement[]))
  }
  return toolbars
}

// Check if URL is an image
// Mobile detection helper (userscript supports forcing mobile via settings)
function isMobileView(): boolean {
  try {
    // Mobile view is now controlled solely by the forceMobileMode setting in userscriptState
    return !!(
      userscriptState &&
      userscriptState.settings &&
      userscriptState.settings.forceMobileMode
    )
  } catch (e) {
    return false
  }
}

// Create emoji picker. When isMobile is true, build a full-screen modal similar to content/mobile.ts
async function createEmojiPicker(): Promise<HTMLElement> {
  const groups = userscriptState.emojiGroups
  const mobile = isMobileView()

  if (mobile) {
    // Build modal structure (simplified but compatible)
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

    const filterInput = document.createElement('input')
    filterInput.className = 'filter-input'
    filterInput.placeholder = '按表情符号名称搜索…'
    filterInput.type = 'text'
    filterInputContainer.appendChild(filterInput)

    const closeButton = document.createElement('button')
    closeButton.className = 'btn no-text btn-icon btn-transparent emoji-picker__close-btn'
    closeButton.type = 'button'
    closeButton.innerHTML = `<svg class="fa d-icon d-icon-xmark svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#xmark"></use></svg>`
    closeButton.addEventListener('click', () => {
      const container = modal.closest('.modal-container') || modal
      if (container) container.remove()
    })

    filterContainer.appendChild(filterInputContainer)
    filterContainer.appendChild(closeButton)

    const content = document.createElement('div')
    content.className = 'emoji-picker__content'

    const sectionsNav = document.createElement('div')
    sectionsNav.className = 'emoji-picker__sections-nav'
    // management and settings buttons for mobile modal
    const managementButton = document.createElement('button')
    managementButton.className = 'btn no-text btn-flat emoji-picker__section-btn management-btn'
    managementButton.setAttribute('tabindex', '-1')
    managementButton.type = 'button'
    managementButton.innerHTML = '⚙️'
    managementButton.title = '管理表情 - 点击打开完整管理界面'
    managementButton.style.borderRight = '1px solid #ddd'
    managementButton.addEventListener('click', () => {
      openManagementInterface()
    })
    sectionsNav.appendChild(managementButton)

    const settingsButton = document.createElement('button')
    settingsButton.className = 'btn no-text btn-flat emoji-picker__section-btn settings-btn'
    settingsButton.setAttribute('tabindex', '-1')
    settingsButton.type = 'button'
    settingsButton.innerHTML = '🔧'
    settingsButton.title = '设置'
    settingsButton.style.borderRight = '1px solid #ddd'
    settingsButton.addEventListener('click', () => {
      showSettingsModal()
    })
    sectionsNav.appendChild(settingsButton)

    const scrollableContent = document.createElement('div')
    scrollableContent.className = 'emoji-picker__scrollable-content'

    const sections = document.createElement('div')
    sections.className = 'emoji-picker__sections'
    sections.setAttribute('role', 'button')

    groups.forEach((group: any, index: number) => {
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
          insertEmojiIntoEditor(emoji)
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
            insertEmojiIntoEditor(emoji)
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

    filterInput.addEventListener('input', (e: any) => {
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

  // Desktop-style floating picker
  const picker = document.createElement('div')
  picker.className = 'fk-d-menu -animated -expanded'
  picker.setAttribute('data-identifier', 'emoji-picker')
  picker.setAttribute('role', 'dialog')
  picker.style.cssText = 'max-width: 400px; visibility: visible; z-index: 999999;'

  const innerContent = document.createElement('div')
  innerContent.className = 'fk-d-menu__inner-content'
  const emojiPickerDiv = document.createElement('div')
  emojiPickerDiv.className = 'emoji-picker'

  const filterContainer = document.createElement('div')
  filterContainer.className = 'emoji-picker__filter-container'
  const filterDiv = document.createElement('div')
  filterDiv.className = 'emoji-picker__filter filter-input-container'
  const searchInput = document.createElement('input')
  searchInput.className = 'filter-input'
  searchInput.placeholder = '按表情符号名称搜索…'
  searchInput.type = 'text'
  filterDiv.appendChild(searchInput)
  filterContainer.appendChild(filterDiv)

  const content = document.createElement('div')
  content.className = 'emoji-picker__content'
  const sectionsNav = document.createElement('div')
  sectionsNav.className = 'emoji-picker__sections-nav'
  // Add management and settings buttons at the start of sections nav (reuse existing functions)
  const managementButton = document.createElement('button')
  managementButton.className = 'btn no-text btn-flat emoji-picker__section-btn management-btn'
  managementButton.setAttribute('tabindex', '-1')
  managementButton.type = 'button'
  managementButton.innerHTML = '⚙️'
  managementButton.title = '管理表情 - 点击打开完整管理界面'
  managementButton.style.borderRight = '1px solid #ddd'
  managementButton.addEventListener('click', () => {
    openManagementInterface()
  })
  sectionsNav.appendChild(managementButton)

  const settingsButton = document.createElement('button')
  settingsButton.className = 'btn no-text btn-flat emoji-picker__section-btn settings-btn'
  settingsButton.setAttribute('tabindex', '-1')
  settingsButton.type = 'button'
  settingsButton.innerHTML = '🔧'
  settingsButton.title = '设置'
  settingsButton.style.borderRight = '1px solid #ddd'
  settingsButton.addEventListener('click', () => {
    showSettingsModal()
  })
  sectionsNav.appendChild(settingsButton)
  const scrollableContent = document.createElement('div')
  scrollableContent.className = 'emoji-picker__scrollable-content'
  const sections = document.createElement('div')
  sections.className = 'emoji-picker__sections'
  sections.setAttribute('role', 'button')

  groups.forEach((group: any, index: number) => {
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
      const img = document.createElement('img')
      img.src = iconVal
      img.alt = group.name || ''
      img.className = 'emoji-group-icon'
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

    let added = 0
    group.emojis.forEach((emoji: any) => {
      if (!emoji || typeof emoji !== 'object' || !emoji.url || !emoji.name) return
      const img = document.createElement('img')
      img.width = 32
      img.height = 32
      img.className = 'emoji'
      img.src = emoji.url
      img.setAttribute('tabindex', '0')
      img.setAttribute('data-emoji', emoji.name)
      img.alt = emoji.name
      img.title = `:${emoji.name}:`
      img.loading = 'lazy'
      img.addEventListener('click', () => {
        insertEmojiIntoEditor(emoji)
        picker.remove()
      })
      img.addEventListener('keydown', (e: any) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          insertEmojiIntoEditor(emoji)
          picker.remove()
        }
      })
      sectionEmojis.appendChild(img)
      added++
    })

    if (added === 0) {
      const msg = document.createElement('div')
      msg.textContent = `${group.name} 组暂无有效表情`
      msg.style.cssText = 'padding: 20px; text-align: center; color: #999;'
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

  return picker
}

// Open management interface
function openManagementInterface() {
  // ensure manager styles are injected
  injectManagerStyles()
  
  // Create modal wrapper
  const modal = document.createElement('div')
  modal.className = 'emoji-manager-wrapper'
  modal.setAttribute('role', 'dialog')
  modal.setAttribute('aria-modal', 'true')

  // Create main panel
  const panel = document.createElement('div')
  panel.className = 'emoji-manager-panel'

  // Left: groups list
  const left = document.createElement('div')
  left.className = 'emoji-manager-left'
  
  const leftHeader = document.createElement('div')
  leftHeader.className = 'emoji-manager-left-header'
  const title = document.createElement('h3')
  title.textContent = '表情管理器'
  const closeBtn = document.createElement('button')
  closeBtn.textContent = '×'
  closeBtn.className = 'btn'
  closeBtn.style.cssText = 'font-size:20px; background:none; border:none; cursor:pointer;'
  leftHeader.appendChild(title)
  leftHeader.appendChild(closeBtn)
  left.appendChild(leftHeader)

  const addGroupRow = document.createElement('div')
  addGroupRow.className = 'emoji-manager-addgroup-row'
  const addGroupInput = document.createElement('input')
  addGroupInput.placeholder = '新分组 id'
  addGroupInput.className = 'form-control'
  const addGroupBtn = document.createElement('button')
  addGroupBtn.textContent = '添加'
  addGroupBtn.className = 'btn'
  addGroupRow.appendChild(addGroupInput)
  addGroupRow.appendChild(addGroupBtn)
  left.appendChild(addGroupRow)

  const groupsList = document.createElement('div')
  groupsList.className = 'emoji-manager-groups-list'
  left.appendChild(groupsList)

  // Right: group detail and controls
  const right = document.createElement('div')
  right.className = 'emoji-manager-right'

  const rightHeader = document.createElement('div')
  rightHeader.className = 'emoji-manager-right-header'
  const groupTitle = document.createElement('h4')
  groupTitle.textContent = ''
  const deleteGroupBtn = document.createElement('button')
  deleteGroupBtn.textContent = '删除分组'
  deleteGroupBtn.className = 'btn'
  deleteGroupBtn.style.cssText =
    'background:#ef4444; color:#fff;'
  rightHeader.appendChild(groupTitle)
  rightHeader.appendChild(deleteGroupBtn)
  right.appendChild(rightHeader)

  const managerRightMain = document.createElement('div')
  managerRightMain.className = 'emoji-manager-right-main'
  
  // emojis grid
  const emojisContainer = document.createElement('div')
  emojisContainer.className = 'emoji-manager-emojis'
  managerRightMain.appendChild(emojisContainer)
  
  // Add emoji form
  const addEmojiForm = document.createElement('div')
  addEmojiForm.className = 'emoji-manager-add-emoji-form'
  const emojiUrlInput = document.createElement('input')
  emojiUrlInput.placeholder = '表情图片 URL'
  emojiUrlInput.className = 'form-control'
  const emojiNameInput = document.createElement('input')
  emojiNameInput.placeholder = '名称 (alias)'
  emojiNameInput.className = 'form-control'
  const addEmojiBtn = document.createElement('button')
  addEmojiBtn.textContent = '添加表情'
  addEmojiBtn.className = 'btn btn-primary'
  addEmojiForm.appendChild(emojiUrlInput)
  addEmojiForm.appendChild(emojiNameInput)
  addEmojiForm.appendChild(addEmojiBtn)
  managerRightMain.appendChild(addEmojiForm)
  
  right.appendChild(managerRightMain)

  // Footer actions
  const footer = document.createElement('div')
  footer.className = 'emoji-manager-footer'
  const exportBtn = document.createElement('button')
  exportBtn.textContent = '导出'
  exportBtn.className = 'btn'
  const importBtn = document.createElement('button')
  importBtn.textContent = '导入'
  importBtn.className = 'btn'
  const exitBtn = document.createElement('button')
  exitBtn.textContent = '退出'
  exitBtn.className = 'btn'
  exitBtn.addEventListener('click', () => modal.remove())
  const saveBtn = document.createElement('button')
  saveBtn.textContent = '保存'
  saveBtn.className = 'btn btn-primary'
  const syncBtn = document.createElement('button')
  syncBtn.textContent = '同步管理器'
  syncBtn.className = 'btn'
  footer.appendChild(syncBtn)
  footer.appendChild(exportBtn)
  footer.appendChild(importBtn)
  footer.appendChild(exitBtn)
  footer.appendChild(saveBtn)

  panel.appendChild(left)
  panel.appendChild(right)
  
  panel.appendChild(footer)
  modal.appendChild(panel)
  document.body.appendChild(modal)

  // state
  let selectedGroupId: string | null = null

  function renderGroups() {
    groupsList.innerHTML = ''
    // If no selection yet, default to first group (if any)
    if (!selectedGroupId && userscriptState.emojiGroups.length > 0) {
      selectedGroupId = userscriptState.emojiGroups[0].id
    }

    userscriptState.emojiGroups.forEach(g => {
      const row = document.createElement('div')
      row.style.cssText =
        'display:flex; justify-content:space-between; align-items:center; padding:6px; border-radius:4px; cursor:pointer;'
      row.tabIndex = 0
      // show friendly name when available
      row.textContent = `${g.name || g.id} (${(g.emojis || []).length})`
      row.dataset.groupId = g.id

      const selectGroup = () => {
        selectedGroupId = g.id
        // rerender left list so highlight is consistent
        renderGroups()
        renderSelectedGroup()
      }

      row.addEventListener('click', selectGroup)
      row.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          selectGroup()
        }
      })

      // highlight currently selected
      if (selectedGroupId === g.id) {
        row.style.background = '#f0f8ff'
      }

      groupsList.appendChild(row)
    })
  }

  // Keep track of currently edited emoji
  let editingContext: { groupId: string; index: number } | null = null

  function createEditorPopup(groupId: string, index: number) {
    const group = userscriptState.emojiGroups.find(g => g.id === groupId)
    if (!group) return
    const emo = group.emojis[index]
    if (!emo) return

    // Create popup backdrop
    const backdrop = document.createElement('div')
    backdrop.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.5);
      z-index: 1000000;
      display: flex;
      align-items: center;
      justify-content: center;
    `

    // Create editor panel
    const editorPanel = document.createElement('div')
    editorPanel.className = 'emoji-manager-editor-panel'
    
    const editorTitle = document.createElement('h3')
    editorTitle.textContent = '编辑表情'
    editorTitle.style.cssText = 'margin: 0 0 16px 0; text-align: center;'
    
    const editorPreview = document.createElement('img')
    editorPreview.className = 'emoji-manager-editor-preview'
    editorPreview.src = emo.url
    
    const editorNameInput = document.createElement('input')
    editorNameInput.className = 'form-control'
    editorNameInput.placeholder = '名称 (alias)'
    editorNameInput.value = emo.name || ''
    
    const editorUrlInput = document.createElement('input')
    editorUrlInput.className = 'form-control'
    editorUrlInput.placeholder = '表情图片 URL'
    editorUrlInput.value = emo.url || ''
    
    const buttonContainer = document.createElement('div')
    buttonContainer.style.cssText = 'display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px;'
    
    const editorSaveBtn = document.createElement('button')
    editorSaveBtn.textContent = '保存修改'
    editorSaveBtn.className = 'btn btn-primary'
    
    const editorCancelBtn = document.createElement('button')
    editorCancelBtn.textContent = '取消'
    editorCancelBtn.className = 'btn'
    
    buttonContainer.appendChild(editorCancelBtn)
    buttonContainer.appendChild(editorSaveBtn)
    
    editorPanel.appendChild(editorTitle)
    editorPanel.appendChild(editorPreview)
    editorPanel.appendChild(editorNameInput)
    editorPanel.appendChild(editorUrlInput)
    editorPanel.appendChild(buttonContainer)
    
    backdrop.appendChild(editorPanel)
    document.body.appendChild(backdrop)

    // Update preview when URL changes
    editorUrlInput.addEventListener('input', () => {
      editorPreview.src = editorUrlInput.value
    })

    // Handle save
    editorSaveBtn.addEventListener('click', () => {
      const newName = (editorNameInput.value || '').trim()
      const newUrl = (editorUrlInput.value || '').trim()
      if (!newName || !newUrl) {
        alert('名称和 URL 均不能为空')
        return
      }
      emo.name = newName
      emo.url = newUrl
      renderGroups()
      renderSelectedGroup()
      backdrop.remove()
    })

    // Handle cancel
    editorCancelBtn.addEventListener('click', () => {
      backdrop.remove()
    })

    // Handle backdrop click
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        backdrop.remove()
      }
    })
  }

  function showEditorFor(groupId: string, index: number) {
    createEditorPopup(groupId, index)
  }

  function renderSelectedGroup() {
    const group = userscriptState.emojiGroups.find(g => g.id === selectedGroupId) || null
    groupTitle.textContent = group ? group.name || group.id : ''
    emojisContainer.innerHTML = ''
    if (!group) return
    const emojis = Array.isArray(group.emojis) ? group.emojis : []
    emojis.forEach((emo: any, idx: number) => {
      const card = document.createElement('div')
      card.className = 'emoji-manager-card'
      // card styles come from CSS
      card.classList.add('emoji-manager-card')

      const img = document.createElement('img')
      img.src = emo.url
      img.alt = emo.name
      img.className = 'emoji-manager-card-img'

      const name = document.createElement('div')
      name.textContent = emo.name
      name.className = 'emoji-manager-card-name'

      const actions = document.createElement('div')
  actions.className = 'emoji-manager-card-actions'

      const edit = document.createElement('button')
      edit.textContent = '编辑'
      edit.className = 'btn btn-sm'
      edit.addEventListener('click', () => {
        showEditorFor(group.id, idx)
      })

      const del = document.createElement('button')
      del.textContent = '删除'
      del.className = 'btn btn-sm'
      del.addEventListener('click', () => {
        group.emojis.splice(idx, 1)
        renderGroups()
        renderSelectedGroup()
      })

      actions.appendChild(edit)
      actions.appendChild(del)

      card.appendChild(img)
      card.appendChild(name)
      card.appendChild(actions)
      emojisContainer.appendChild(card)
    })
  }

  // actions
  addGroupBtn.addEventListener('click', () => {
    const id = (addGroupInput.value || '').trim()
    if (!id) return alert('请输入分组 id')
    if (userscriptState.emojiGroups.find(g => g.id === id)) return alert('分组已存在')
    userscriptState.emojiGroups.push({ id, name: id, emojis: [] })
    addGroupInput.value = ''
    // select new group
    const newIdx = userscriptState.emojiGroups.findIndex(g => g.id === id)
    if (newIdx >= 0) selectedGroupId = userscriptState.emojiGroups[newIdx].id
    renderGroups()
    renderSelectedGroup()
  })

  addEmojiBtn.addEventListener('click', () => {
    if (!selectedGroupId) return alert('请先选择分组')
    const url = (emojiUrlInput.value || '').trim()
    const name = (emojiNameInput.value || '').trim()
    if (!url || !name) return alert('请输入 url 和 名称')
    const group = userscriptState.emojiGroups.find(g => g.id === selectedGroupId)
    if (!group) return
    group.emojis = group.emojis || []
    group.emojis.push({ url, name })
    emojiUrlInput.value = ''
    emojiNameInput.value = ''
    renderGroups()
    renderSelectedGroup()
  })

  deleteGroupBtn.addEventListener('click', () => {
    if (!selectedGroupId) return alert('请先选择分组')
    const idx = userscriptState.emojiGroups.findIndex(g => g.id === selectedGroupId)
    if (idx >= 0) {
      if (!confirm('确认删除该分组？该操作不可撤销')) return
      userscriptState.emojiGroups.splice(idx, 1)
      // choose next group if exists, otherwise previous, otherwise null
      if (userscriptState.emojiGroups.length > 0) {
        const next =
          userscriptState.emojiGroups[Math.min(idx, userscriptState.emojiGroups.length - 1)]
        selectedGroupId = next.id
      } else {
        selectedGroupId = null
      }
      renderGroups()
      renderSelectedGroup()
    }
  })

  exportBtn.addEventListener('click', () => {
    const data = exportUserscriptData()
    navigator.clipboard
      .writeText(data)
      .then(() => alert('已复制到剪贴板'))
      .catch(() => {
        const ta = document.createElement('textarea')
        ta.value = data
        document.body.appendChild(ta)
        ta.select()
      })
  })

  importBtn.addEventListener('click', () => {
    const ta = document.createElement('textarea')
    ta.placeholder = '粘贴 JSON 后点击确认'
    ta.style.cssText = 'width:100%;height:200px;margin-top:8px;'
    const ok = document.createElement('button')
    ok.textContent = '确认导入'
    ok.style.cssText = 'padding:6px 8px;margin-top:6px;'
    const container = document.createElement('div')
    container.appendChild(ta)
    container.appendChild(ok)
    const importModal = document.createElement('div')
    importModal.style.cssText =
      'position:fixed;left:0;top:0;right:0;bottom:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:1000001;'
    const box = document.createElement('div')
    box.style.cssText = 'background:#fff;padding:12px;border-radius:6px;width:90%;max-width:700px;'
    box.appendChild(container)
    importModal.appendChild(box)
    document.body.appendChild(importModal)
    ok.addEventListener('click', () => {
      try {
        const json = ta.value.trim()
        if (!json) return
        const okdata = importUserscriptData(json)
        if (okdata) {
          alert('导入成功，请保存以持久化')
          initializeUserscriptData()
          renderGroups()
          renderSelectedGroup()
        } else {
          alert('导入失败：格式错误')
        }
      } catch (e) {
        alert('导入异常：' + e)
      }
      importModal.remove()
    })
  })

  saveBtn.addEventListener('click', () => {
    try {
      saveDataToLocalStorage({ emojiGroups: userscriptState.emojiGroups })
      alert('已保存')
    } catch (e) {
      alert('保存失败：' + e)
    }
  })

  syncBtn.addEventListener('click', () => {
    try {
      const ok = syncFromManager()
      if (ok) {
        alert('同步成功，已导入管理器数据')
        initializeUserscriptData()
        renderGroups()
        renderSelectedGroup()
      } else {
        alert('同步未成功，未检测到管理器数据')
      }
    } catch (e) {
      alert('同步异常：' + e)
    }
  })

  closeBtn.addEventListener('click', () => modal.remove())
  modal.addEventListener('click', e => {
    if (e.target === modal) modal.remove()
  })

  // initial render
  renderGroups()
  if (userscriptState.emojiGroups.length > 0) {
    selectedGroupId = userscriptState.emojiGroups[0].id
    // highlight first
    const first = groupsList.firstChild as HTMLElement | null
    if (first) first.style.background = '#f0f8ff'
    renderSelectedGroup()
  }
}
// Show settings modal
function showSettingsModal() {
  const modal = document.createElement('div')
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.8);
    z-index: 999999;
    display: flex;
    align-items: center;
    justify-content: center;
  `

  const content = document.createElement('div')
  content.style.cssText = `
    background: white;
    border-radius: 8px;
    padding: 24px;
    max-width: 500px;
    max-height: 80vh;
    overflow-y: auto;
    position: relative;
  `

  content.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
      <h2 style="margin: 0; color: #333;">设置</h2>
      <button id="closeModal" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #999;">×</button>
    </div>
    
    <div style="margin-bottom: 16px;">
      <label style="display: block; margin-bottom: 8px; color: #555; font-weight: 500;">图片缩放比例: <span id="scaleValue">${userscriptState.settings.imageScale}%</span></label>
      <input type="range" id="scaleSlider" min="5" max="150" step="5" value="${userscriptState.settings.imageScale}" 
             style="width: 100%; margin-bottom: 8px;">
    </div>
    
    <div style="margin-bottom: 16px;">
      <label style="display: block; margin-bottom: 8px; color: #555; font-weight: 500;">输出格式:</label>
      <div style="display: flex; gap: 16px;">
        <label style="display: flex; align-items: center; color: #666;">
          <input type="radio" name="outputFormat" value="markdown" ${userscriptState.settings.outputFormat === 'markdown' ? 'checked' : ''} style="margin-right: 4px;">
          Markdown
        </label>
        <label style="display: flex; align-items: center; color: #666;">
          <input type="radio" name="outputFormat" value="html" ${userscriptState.settings.outputFormat === 'html' ? 'checked' : ''} style="margin-right: 4px;">
          HTML
        </label>
      </div>
    </div>
    
    <div style="margin-bottom: 16px;">
      <label style="display: flex; align-items: center; color: #555; font-weight: 500;">
        <input type="checkbox" id="showSearchBar" ${userscriptState.settings.showSearchBar ? 'checked' : ''} style="margin-right: 8px;">
        显示搜索栏
      </label>
    </div>
    
    <div style="margin-bottom: 16px;">
      <label style="display: flex; align-items: center; color: #555; font-weight: 500;">
        <input type="checkbox" id="forceMobileMode" ${userscriptState.settings.forceMobileMode ? 'checked' : ''} style="margin-right: 8px;">
        强制移动模式 (在不兼容检测时也注入移动版布局)
      </label>
    </div>
    
    <div style="display: flex; gap: 8px; justify-content: flex-end;">
      <button id="resetSettings" style="padding: 8px 16px; background: #f5f5f5; border: 1px solid #ddd; border-radius: 4px; cursor: pointer;">重置</button>
      <button id="saveSettings" style="padding: 8px 16px; background: #1890ff; color: white; border: none; border-radius: 4px; cursor: pointer;">保存</button>
    </div>
  `

  modal.appendChild(content)
  document.body.appendChild(modal)

  // Event listeners
  const scaleSlider = content.querySelector('#scaleSlider') as HTMLInputElement
  const scaleValue = content.querySelector('#scaleValue') as HTMLElement

  scaleSlider?.addEventListener('input', () => {
    if (scaleValue) {
      scaleValue.textContent = scaleSlider.value + '%'
    }
  })

  content.querySelector('#closeModal')?.addEventListener('click', () => {
    modal.remove()
  })

  content.querySelector('#resetSettings')?.addEventListener('click', () => {
    ;(async () => {
      const { requestConfirmation } = await import('../utils/confirmService')
      const ok = await requestConfirmation('重置设置', '确定要重置所有设置吗？')
      if (ok) {
        userscriptState.settings = {
          imageScale: 30,
          gridColumns: 4,
          outputFormat: 'markdown',
          forceMobileMode: false,
          defaultGroup: 'nachoneko',
          showSearchBar: true
        }
        modal.remove()
      }
    })()
  })

  content.querySelector('#saveSettings')?.addEventListener('click', () => {
    // Update settings
    userscriptState.settings.imageScale = parseInt(scaleSlider?.value || '30')

    const outputFormat = content.querySelector(
      'input[name="outputFormat"]:checked'
    ) as HTMLInputElement
    if (outputFormat) {
      userscriptState.settings.outputFormat = outputFormat.value as 'markdown' | 'html'
    }

    const showSearchBar = content.querySelector('#showSearchBar') as HTMLInputElement
    if (showSearchBar) {
      userscriptState.settings.showSearchBar = showSearchBar.checked
    }

    const forceMobileEl = content.querySelector('#forceMobileMode') as HTMLInputElement | null
    if (forceMobileEl) {
      userscriptState.settings.forceMobileMode = !!forceMobileEl.checked
    }

    // Save to localStorage
    saveDataToLocalStorage({ settings: userscriptState.settings })
    // Also persist remote config URL for remote variant
    try {
      const remoteInput = content.querySelector('#remoteConfigUrl') as HTMLInputElement | null
      if (remoteInput && remoteInput.value.trim()) {
        localStorage.setItem('emoji_extension_remote_config_url', remoteInput.value.trim())
      }
    } catch (e) {
      // ignore
    }
    alert('设置已保存')

    modal.remove()
  })

  // Close on outside click
  modal.addEventListener('click', e => {
    if (e.target === modal) {
      modal.remove()
    }
  })
}

let currentPicker: HTMLElement | null = null

function closeCurrentPicker() {
  if (currentPicker) {
    currentPicker.remove()
    currentPicker = null
  }
}

// Inject emoji button into toolbar
function injectEmojiButton(toolbar: HTMLElement) {
  if (toolbar.querySelector('.emoji-extension-button')) {
    return // Already injected
  }

  const isChatComposer = toolbar.classList.contains('chat-composer__inner-container')

  const button = document.createElement('button')
  button.classList.add(
    'btn',
    'no-text',
    'btn-icon',
    'toolbar__button',
    'nacho-emoji-picker-button',
    'emoji-extension-button'
  )

  if (isChatComposer) {
    button.classList.add(
      'fk-d-menu__trigger',
      'emoji-picker-trigger',
      'chat-composer-button',
      'btn-transparent',
      '-emoji'
    )
    button.setAttribute('aria-expanded', 'false')
    button.setAttribute('data-identifier', 'emoji-picker')
    button.setAttribute('data-trigger', '')
  }

  button.title = '表情包'
  button.type = 'button'
  button.innerHTML = '🐈‍⬛'

  button.addEventListener('click', async e => {
    e.stopPropagation()

    if (currentPicker) {
      closeCurrentPicker()
      return
    }

    currentPicker = await createEmojiPicker()
    if (!currentPicker) return

    document.body.appendChild(currentPicker)

    const buttonRect = button.getBoundingClientRect()
    // If mobile-style modal (full-screen) then keep default modal behavior.
    const isModal =
      currentPicker.classList.contains('modal') || currentPicker.className.includes('d-modal')

    if (isModal) {
      // Ensure modal fills or centers appropriately (modal CSS should handle layout)
      currentPicker.style.position = 'fixed'
      currentPicker.style.top = '0'
      currentPicker.style.left = '0'
      currentPicker.style.right = '0'
      currentPicker.style.bottom = '0'
      currentPicker.style.zIndex = '999999'
    } else {
      // Floating picker: position adaptively. Keep it inside viewport and prefer below button.
      currentPicker.style.position = 'fixed'
      // give the browser one paint to compute size
      const margin = 8
      const vpWidth = window.innerWidth
      const vpHeight = window.innerHeight

      // temporary place below to measure
      currentPicker.style.top = buttonRect.bottom + margin + 'px'
      currentPicker.style.left = buttonRect.left + 'px'

      // Measure after appended
      const pickerRect = currentPicker.getBoundingClientRect()
      const spaceBelow = vpHeight - buttonRect.bottom
      const neededHeight = pickerRect.height + margin
      let top = buttonRect.bottom + margin
      if (spaceBelow < neededHeight) {
        // place above the button
        top = Math.max(margin, buttonRect.top - pickerRect.height - margin)
      }
      // Keep left within viewport
      let left = buttonRect.left
      if (left + pickerRect.width + margin > vpWidth) {
        left = Math.max(margin, vpWidth - pickerRect.width - margin)
      }
      if (left < margin) left = margin

      currentPicker.style.top = top + 'px'
      currentPicker.style.left = left + 'px'
    }

    // Close on outside click
    setTimeout(() => {
      const handleClick = (e: Event) => {
        if (currentPicker && !currentPicker.contains(e.target as Node) && e.target !== button) {
          closeCurrentPicker()
          document.removeEventListener('click', handleClick)
        }
      }
      document.addEventListener('click', handleClick)
    }, 100)
  })

  try {
    // Try to insert in the right place
    if (isChatComposer) {
      const existingEmojiTrigger = toolbar.querySelector(
        '.emoji-picker-trigger:not(.emoji-extension-button)'
      )
      if (existingEmojiTrigger) {
        toolbar.insertBefore(button, existingEmojiTrigger)
      } else {
        toolbar.appendChild(button)
      }
    } else {
      toolbar.appendChild(button)
    }
  } catch (error) {
    console.error('[Emoji Extension Userscript] Failed to inject button:', error)
  }
}

// Initialize one-click add functionality for image lightboxes
function initOneClickAdd() {
  console.log('[Emoji Extension Userscript] Initializing one-click add functionality')

  function extractEmojiFromImage(img: HTMLImageElement, titleElement: HTMLElement) {
    const url = img.src
    if (!url || !url.startsWith('http')) return null

    let name = ''
    const titleText = titleElement.textContent || ''
    const parts = titleText.split('·')
    if (parts.length > 0) {
      name = parts[0].trim()
    }

    if (!name || name.length < 2) {
      name = img.alt || img.title || extractNameFromUrl(url)
    }

    name = name.trim()
    if (name.length === 0) {
      name = '表情'
    }

    return { name, url }
  }

  function extractNameFromUrl(url: string): string {
    try {
      const filename = new URL(url).pathname.split('/').pop() || ''
      const nameWithoutExt = filename.replace(/\.[^/.]+$/, '')
      const decoded = decodeURIComponent(nameWithoutExt)

      if (/^[0-9a-f]{8,}$/i.test(decoded) || decoded.length < 2) {
        return '表情'
      }

      return decoded || '表情'
    } catch {
      return '表情'
    }
  }

  function createAddButton(emojiData: { name: string; url: string }) {
    const link = document.createElement('a')
    link.className = 'image-source-link emoji-add-link'
    link.style.cssText = `
      color: #ffffff;
      text-decoration: none;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      font-size: inherit;
      font-family: inherit;
      background: linear-gradient(135deg, #4f46e5, #7c3aed);
      border: 2px solid #ffffff;
      border-radius: 6px;
      padding: 4px 8px;
      margin: 0 2px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
      transition: all 0.2s ease;
      font-weight: 600;
    `

    link.addEventListener('mouseenter', () => {
      if (!link.innerHTML.includes('已添加') && !link.innerHTML.includes('失败')) {
        link.style.background = 'linear-gradient(135deg, #3730a3, #5b21b6)'
        link.style.transform = 'scale(1.05)'
        link.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.3)'
      }
    })

    link.addEventListener('mouseleave', () => {
      if (!link.innerHTML.includes('已添加') && !link.innerHTML.includes('失败')) {
        link.style.background = 'linear-gradient(135deg, #4f46e5, #7c3aed)'
        link.style.transform = 'scale(1)'
        link.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.2)'
      }
    })

    link.innerHTML = `
      <svg class="fa d-icon d-icon-plus svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width: 1em; height: 1em; fill: currentColor; margin-right: 4px;">
        <path d="M12 4c.55 0 1 .45 1 1v6h6c.55 0 1 .45 1 1s-.45 1-1 1h-6v6c0 .55-.45 1-1 1s-1-.45-1-1v-6H5c-.55 0-1-.45-1-1s.45-1 1-1h6V5c0-.55.45-1 1-1z"/>
      </svg>添加表情
    `
    link.title = '添加到用户表情'

    link.addEventListener('click', async e => {
      e.preventDefault()
      e.stopPropagation()

      const originalHTML = link.innerHTML
      const originalStyle = link.style.cssText

      try {
        addEmojiToUserscript(emojiData)

        // Show upload queue dialog so user can see upload progress manually
        try {
          uploader.showProgressDialog()
        } catch (e) {
          console.warn('[Userscript] uploader.showProgressDialog failed:', e)
        }

        link.innerHTML = `
          <svg class="fa d-icon d-icon-check svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width: 1em; height: 1em; fill: currentColor; margin-right: 4px;">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
          </svg>已添加
        `
        link.style.background = 'linear-gradient(135deg, #10b981, #059669)'
        link.style.color = '#ffffff'
        link.style.border = '2px solid #ffffff'
        link.style.boxShadow = '0 2px 4px rgba(16, 185, 129, 0.3)'

        setTimeout(() => {
          link.innerHTML = originalHTML
          link.style.cssText = originalStyle
        }, 2000)
      } catch (error) {
        console.error('[Emoji Extension Userscript] Failed to add emoji:', error)

        link.innerHTML = `
          <svg class="fa d-icon d-icon-times svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width: 1em; height: 1em; fill: currentColor; margin-right: 4px;">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>失败
        `
        link.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)'
        link.style.color = '#ffffff'
        link.style.border = '2px solid #ffffff'
        link.style.boxShadow = '0 2px 4px rgba(239, 68, 68, 0.3)'

        setTimeout(() => {
          link.innerHTML = originalHTML
          link.style.cssText = originalStyle
        }, 2000)
      }
    })

    return link
  }

  function processLightbox(lightbox: HTMLElement) {
    if (lightbox.querySelector('.emoji-add-link')) return

    const img = lightbox.querySelector('.mfp-img') as HTMLImageElement | null
    const title = lightbox.querySelector('.mfp-title') as HTMLElement | null

    if (!img || !title) return

    const emojiData = extractEmojiFromImage(img, title)
    if (!emojiData) return

    const addButton = createAddButton(emojiData)
    const sourceLink = title.querySelector('a.image-source-link')

    if (sourceLink) {
      const separator = document.createTextNode(' · ')
      title.insertBefore(separator, sourceLink)
      title.insertBefore(addButton, sourceLink)
    } else {
      title.appendChild(document.createTextNode(' · '))
      title.appendChild(addButton)
    }
  }

  function processAllLightboxes() {
    document.querySelectorAll('.mfp-wrap.mfp-gallery').forEach(lightbox => {
      if (
        lightbox.classList.contains('mfp-wrap') &&
        lightbox.classList.contains('mfp-gallery') &&
        lightbox.querySelector('.mfp-img')
      ) {
        processLightbox(lightbox as HTMLElement)
      }
    })
  }

  // Initial processing
  setTimeout(processAllLightboxes, 500)

  // Watch for new lightboxes
  const observer = new MutationObserver(mutations => {
    let hasNewLightbox = false
    mutations.forEach(mutation => {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as HTMLElement
            if (element.classList && element.classList.contains('mfp-wrap')) {
              hasNewLightbox = true
            }
          }
        })
      }
    })

    if (hasNewLightbox) {
      setTimeout(processAllLightboxes, 100)
    }
  })

  observer.observe(document.body, { childList: true, subtree: true })

  // Also check when page becomes visible (for tab switching)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      setTimeout(processAllLightboxes, 200)
    }
  })
}

// Main initialization function
async function initializeEmojiFeature(maxAttempts: number = 10, delay: number = 1000) {
  console.log('[Emoji Extension Userscript] Initializing...')

  initializeUserscriptData()
  initOneClickAdd()
  // Pixiv specific injection (use content/pixiv implementation)
  try {
    //initPixiv()
  } catch (e) {
    console.warn('[Userscript] initPixiv failed', e)
  }

  let attempts = 0

  function attemptInjection() {
    attempts++

    const toolbars = findAllToolbars()
    let injectedCount = 0

    toolbars.forEach(toolbar => {
      if (!toolbar.querySelector('.emoji-extension-button')) {
        console.log('[Emoji Extension Userscript] Toolbar found, injecting button.')
        injectEmojiButton(toolbar)
        injectedCount++
      }
    })

    if (injectedCount > 0 || toolbars.length > 0) {
      return // Success
    }

    if (attempts < maxAttempts) {
      console.log(
        `[Emoji Extension Userscript] Toolbar not found, attempt ${attempts}/${maxAttempts}. Retrying in ${delay / 1000}s.`
      )
      setTimeout(attemptInjection, delay)
    } else {
      console.error('[Emoji Extension Userscript] Failed to find toolbar after multiple attempts.')
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attemptInjection)
  } else {
    attemptInjection()
  }

  // Periodic checks for new toolbars
  setInterval(() => {
    const toolbars = findAllToolbars()
    toolbars.forEach(toolbar => {
      if (!toolbar.querySelector('.emoji-extension-button')) {
        console.log('[Emoji Extension Userscript] New toolbar found, injecting button.')
        injectEmojiButton(toolbar)
      }
    })
  }, 30000)
}

// Entry point
if (shouldInjectEmoji()) {
  console.log('[Emoji Extension Userscript] Initializing emoji feature')
  initializeEmojiFeature()
} else {
  console.log('[Emoji Extension Userscript] Skipping injection - incompatible platform')
}

export {}
