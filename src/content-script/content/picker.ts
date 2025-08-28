import { cachedState } from './state'
import { getDefaultEmojis } from './default'
import type { emoji } from './types'
import { createContentScriptCommService } from '../../services/communication'

// 导入后台通信函数
interface BackgroundResponse {
  success: boolean
  data?: {
    groups?: any[]
    settings?: any
    ungroupedEmojis?: any[]
  }
  error?: string
}

function sendMessageToBackground(message: any): Promise<BackgroundResponse> {
  return new Promise((resolve) => {
    try {
      if (
        (window as any).chrome &&
        (window as any).chrome.runtime &&
        (window as any).chrome.runtime.sendMessage
      ) {
        ;(window as any).chrome.runtime.sendMessage(message, (response: BackgroundResponse) => {
          resolve(response)
        })
      } else {
        resolve({ success: false, error: 'chrome.runtime.sendMessage not available' })
      }
    } catch (e) {
      resolve({ success: false, error: e instanceof Error ? e.message : String(e) })
    }
  })
}

// 创建通信服务用于实时通知其他页面
const commService = createContentScriptCommService()

// 记录表情使用的函数
async function recordEmojiUsage(uuid: string): Promise<boolean> {
  try {
    console.log('[Emoji Usage] 记录表情使用:', uuid)

    // 通过后台通信更新使用计数
    const response = await sendMessageToBackground({
      type: 'RECORD_EMOJI_USAGE',
      uuid: uuid,
    })

    if (response && response.success) {
      console.log('[Emoji Usage] 成功更新使用计数')
      // 通知其他页面使用记录已更新
      commService.sendUsageRecorded(uuid)
      return true
    } else {
      console.warn('[Emoji Usage] 后台更新失败，尝试直接调用 recordUsageByUUID')

      // 回退方案：如果后台通信失败，尝试直接访问存储模块
      try {
        const { recordUsage } = await import('../../data/store/main')
        const result = recordUsage(uuid)
        if (result) {
          console.log('[Emoji Usage] 直接调用成功')
          commService.sendUsageRecorded(uuid)
          return true
        }
      } catch (error) {
        console.error('[Emoji Usage] 直接调用也失败:', error)
      }
    }
  } catch (error) {
    console.error('[Emoji Usage] 记录使用失败:', error)
  }

  return false
}

export function isMobile(): boolean {
  return (
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    window.innerWidth <= 768
  )
}

// 专门处理表情选择器关闭的函数
function closePicker(picker: HTMLElement, isMobilePicker: boolean) {
  if (isMobilePicker) {
    // 移动端模式：保留modal-container但清空其内容
    const modalContainer = picker.closest('.modal-container') as HTMLElement
    if (modalContainer) {
      // 清空modal-container内容，但保留容器本身
      modalContainer.innerHTML = ''
      console.log('[Emoji Picker] 清空移动端模态容器内容')
    } else {
      // 如果找不到modal-container，则使用传统方式
      picker.remove()
    }
  } else {
    // 桌面端模式：直接移除
    picker.remove()
  }
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
        const emojiUUID = emojiData.UUID || ''
        // 添加 data-uuid 属性来保留原始 UUID 信息
        groupEmojisHtml += `<img width="32" height="32" class="emoji" src="${displayUrl}" tabindex="${tabindex}" data-emoji="${dataEmoji}" data-uuid="${emojiUUID}" alt="${nameEsc}" title=":${nameEsc}:" loading="lazy" />\n`
      })

      // Check if this is a "frequently used" or "favorite" group that should have delete button
      const isFrequentlyUsedGroup =
        groupName.includes('常用') ||
        groupName.includes('收藏') ||
        groupName.includes('最近') ||
        groupId === 'default-uuid' ||
        groupId.includes('frequent') ||
        groupId.includes('favorite')

      // Generate delete button only for frequently used groups
      const deleteButtonHtml = isFrequentlyUsedGroup
        ? `
        <button class="btn no-text btn-icon btn-transparent" type="button">
          <svg class="fa d-icon d-icon-trash-can svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
            <use href="#trash-can"></use>
          </svg>
          <span aria-hidden="true">&ZeroWidthSpace;</span>
        </button>
      `
        : ''

      // Add section for this group - always visible
      sectionsHtml += `
        <div class="emoji-picker__section" data-section="${groupId}" role="region" aria-label="${groupName}">
          <div class="emoji-picker__section-title-container">
            <h2 class="emoji-picker__section-title">${groupName}</h2>
            ${deleteButtonHtml}
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

  if (isMobilePicker) {
    // 移动端模式：使用modal-container结构
    picker.className = 'modal-container'
    picker.innerHTML = `
      <div class="modal d-modal fk-d-menu-modal emoji-picker-content" data-keyboard="false" aria-modal="true" role="dialog" data-identifier="emoji-picker" data-content="">
        <div class="d-modal__container">
          <div class="d-modal__body" tabindex="-1">
            <div class="emoji-picker">
              <div class="emoji-picker__filter-container">
                <div class="emoji-picker__filter filter-input-container">
                  <input class="filter-input" placeholder="按表情符号名称和别名搜索…" type="text" />
                  <svg class="fa d-icon d-icon-magnifying-glass svg-icon -right svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
                    <use href="#magnifying-glass"></use>
                  </svg>
                </div>
                <button class="btn no-text fk-d-menu__trigger -trigger emoji-picker__diversity-trigger btn-transparent" aria-expanded="false" data-trigger="" type="button" id="ember85">
                  <img width="20" height="20" src="/images/emoji/twemoji/clap.png" title="clap" alt="clap" class="emoji" />
                </button>
                <button class="btn no-text btn-icon btn-transparent emoji-picker__close-btn" type="button">
                  <svg class="fa d-icon d-icon-xmark svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
                    <use href="#xmark"></use>
                  </svg>
                  <span aria-hidden="true">&ZeroWidthSpace;</span>
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
        </div>
      </div>
      <div class="d-modal__backdrop"></div>
    `
  } else {
    // 桌面端模式：使用原有的fk-d-menu结构
    picker.className = 'fk-d-menu -animated -expanded'
    picker.setAttribute('data-identifier', 'emoji-picker')
    picker.setAttribute('data-content', '')
    picker.setAttribute('aria-labelledby', 'ember161')
    picker.setAttribute('aria-expanded', 'true')
    picker.setAttribute('role', 'dialog')

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
  }

  // Add click handlers for emoji images
  const emojiImages = picker.querySelectorAll('.emoji-picker__section-emojis .emoji')
  emojiImages.forEach((img) => {
    img.addEventListener('click', async () => {
      // 获取原始 UUID 信息
      const originalUUID = img.getAttribute('data-uuid') || ''

      const emojiData: emoji = {
        id: img.getAttribute('data-emoji') || img.getAttribute('alt') || '',
        displayName: img.getAttribute('data-emoji') || img.getAttribute('alt') || '',
        realUrl: new URL(img.getAttribute('src') || ''),
        displayUrl: new URL(img.getAttribute('src') || ''),
        order: 0,
        UUID: (originalUUID as any) || (crypto.randomUUID() as any),
      }

      // 先记录使用统计（如果有原始 UUID）
      if (originalUUID) {
        try {
          await recordEmojiUsage(originalUUID)
          console.log('[Emoji Picker] 成功记录表情使用:', originalUUID)
        } catch (error) {
          console.error('[Emoji Picker] 记录表情使用失败:', error)
        }
      } else {
        console.warn('[Emoji Picker] 表情缺少 UUID 信息，无法记录使用统计')
      }

      // 插入表情
      insertEmoji(emojiData)
        .then(() => {
          closePicker(picker, isMobilePicker)
        })
        .catch((error) => {
          console.error('[Emoji Insert] 插入表情失败:', error)
          closePicker(picker, isMobilePicker)
        })
    })
  })

  // Add section navigation functionality - scroll to target section
  const sectionButtons = picker.querySelectorAll('.emoji-picker__section-btn')
  const sections = picker.querySelectorAll('.emoji-picker__section')
  const scrollableContent = picker.querySelector('.emoji-picker__scrollable-content') as HTMLElement

  sectionButtons.forEach((button) => {
    button.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()

      const targetSection = button.getAttribute('data-section')
      console.log('[Emoji Picker] Navigation button clicked, target:', targetSection)

      // Remove active class from all buttons
      sectionButtons.forEach((btn) => btn.classList.remove('active'))
      // Add active class to clicked button
      button.classList.add('active')

      // Find target section
      const targetSectionEl = picker.querySelector(
        `[data-section="${targetSection}"].emoji-picker__section`,
      ) as HTMLElement

      if (targetSectionEl && scrollableContent) {
        console.log('[Emoji Picker] Found target section, scrolling...', targetSectionEl)

        // Calculate the position of target section relative to scrollable container
        const containerRect = scrollableContent.getBoundingClientRect()
        const targetRect = targetSectionEl.getBoundingClientRect()
        const scrollTop = scrollableContent.scrollTop

        // Calculate target scroll position
        const targetScrollTop = scrollTop + (targetRect.top - containerRect.top)

        // Smooth scroll to target position
        scrollableContent.scrollTo({
          top: targetScrollTop,
          behavior: 'smooth',
        })

        console.log('[Emoji Picker] Scrolled to position:', targetScrollTop)
      } else {
        console.warn('[Emoji Picker] Target section or scrollable content not found')
      }
    })
  })

  // Add close functionality for delete buttons (only exists in frequently used groups)
  const deleteButtons = picker.querySelectorAll('.emoji-picker__section-title-container button')
  deleteButtons.forEach((deleteBtn) => {
    deleteBtn.addEventListener('click', () => {
      closePicker(picker, isMobilePicker)
    })
  })

  // Add mobile-specific close functionality
  if (isMobilePicker) {
    // Add close button functionality
    const closeButton = picker.querySelector('.emoji-picker__close-btn')
    if (closeButton) {
      closeButton.addEventListener('click', () => {
        closePicker(picker, isMobilePicker)
      })
    }

    // Add backdrop click to close functionality
    const backdrop = picker.querySelector('.d-modal__backdrop')
    if (backdrop) {
      backdrop.addEventListener('click', () => {
        closePicker(picker, isMobilePicker)
      })
    }

    // Prevent modal content clicks from bubbling to backdrop
    const modalContent = picker.querySelector('.d-modal__container')
    if (modalContent) {
      modalContent.addEventListener('click', (e) => {
        e.stopPropagation()
      })
    }
  }

  // Add filter functionality
  const filterInput = picker.querySelector('.filter-input') as HTMLInputElement
  if (filterInput) {
    filterInput.addEventListener('input', (e) => {
      const searchTerm = (e.target as HTMLInputElement).value.toLowerCase()

      if (searchTerm.trim() === '') {
        // If search is empty, show all sections normally
        sections.forEach((section) => {
          const sectionEl = section as HTMLElement
          sectionEl.style.display = 'block'
        })

        // Show all emojis
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

async function insertEmoji(emojiData: emoji) {
  // 首先尝试主动查找文本框（参考simple.js的实现）
  const textArea = document.querySelector('textarea.d-editor-input') as HTMLTextAreaElement | null
  const richEle = document.querySelector('.ProseMirror.d-editor-input') as HTMLElement | null

  if (!textArea && !richEle) {
    console.error('找不到输入框')
    return
  }

  // 获取图片尺寸信息
  let width = '500'
  let height = '500'
  const imgSrc = emojiData.realUrl.toString()

  // 尝试从URL中提取尺寸
  const match = imgSrc.match(/_(\d{3,})x(\d{3,})\./)
  if (match) {
    width = match[1]
    height = match[2]
  }

  // 实时从后端获取最新设置
  let currentSettings = cachedState.settings // 默认使用缓存设置作为备用
  try {
    console.log('[Emoji Insert] 实时获取最新设置...')
    const response = await sendMessageToBackground({ type: 'GET_EMOJI_DATA' })
    if (response && response.success && response.data && response.data.settings) {
      currentSettings = { ...cachedState.settings, ...response.data.settings }
      console.log('[Emoji Insert] 成功获取最新设置:', currentSettings)
    } else {
      console.warn('[Emoji Insert] 获取最新设置失败，使用缓存设置')
    }
  } catch (error) {
    console.error('[Emoji Insert] 获取设置时出错:', error)
  }

  // 获取缩放比例
  const imageScale = currentSettings.imageScale || 30

  if (textArea) {
    // 对于普通文本框，根据输出格式生成不同的文本
    let emojiText: string
    switch (currentSettings.outputFormat) {
      case 'html':
        const scaledWidth = Math.round((parseInt(width) * imageScale) / 100)
        const scaledHeight = Math.round((parseInt(height) * imageScale) / 100)
        // 使用指定的HTML格式，包含完整的属性
        emojiText = `<img src="${imgSrc}" title=":${emojiData.displayName}:" class="emoji only-emoji" alt=":${emojiData.displayName}:" loading="lazy" width="${scaledWidth}" height="${scaledHeight}" style="aspect-ratio: ${scaledWidth} / ${scaledHeight};">`
        break
      case 'bbcode':
        emojiText = `[img]${imgSrc}[/img]`
        break
      case 'markdown':
      default:
        // 使用类似simple.js的格式：![alt|widthxheight,scale%](url)
        emojiText = `![${emojiData.displayName}|${width}x${height},${imageScale}%](${imgSrc}) `
        break
    }

    const start = textArea.selectionStart || 0
    const end = textArea.selectionEnd || 0
    const text = textArea.value

    textArea.value = text.substring(0, start) + emojiText + text.substring(end)
    textArea.selectionStart = textArea.selectionEnd = start + emojiText.length
    textArea.focus()

    // Trigger input event
    textArea.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }))
  } else if (richEle) {
    // 对于富文本编辑器，使用HTML模板（参考simple.js的实现）
    const scaledWidth = Math.round((parseInt(width) * imageScale) / 100)
    const scaledHeight = Math.round((parseInt(height) * imageScale) / 100)
    // 使用指定的HTML格式，包含完整的属性
    const imgTemplate = `<img src="${imgSrc}" title=":${emojiData.displayName}:" class="emoji only-emoji" alt=":${emojiData.displayName}:" loading="lazy" width="${scaledWidth}" height="${scaledHeight}" style="aspect-ratio: ${scaledWidth} / ${scaledHeight};">`

    try {
      const dt = new DataTransfer()
      dt.setData('text/html', imgTemplate)
      const evt = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true })
      richEle.dispatchEvent(evt)
    } catch (_) {
      try {
        document.execCommand('insertHTML', false, imgTemplate)
      } catch (e) {
        console.error('无法向富文本编辑器中插入表情', e)
      }
    }
  }
}
