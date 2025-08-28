// content-script/content/picker/event-handlers.ts - 事件处理逻辑

import type { emoji } from '../types'
import { uploadQueue } from '../upload-queue'
import uploadQueueUI from '../upload-ui'

/**
 * 记录表情使用的函数
 */
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
      return true
    } else {
      console.warn('[Emoji Usage] 后台更新失败，尝试直接调用 recordUsageByUUID')

      // 回退方案：如果后台通信失败，尝试直接访问存储模块
      try {
        const { recordUsage } = await import('../../../data/store/main')
        const result = recordUsage(uuid)
        if (result) {
          console.log('[Emoji Usage] 直接调用成功')
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

/**
 * 后台通信函数
 */
function sendMessageToBackground(message: any): Promise<any> {
  return new Promise((resolve) => {
    try {
      if (
        (window as any).chrome &&
        (window as any).chrome.runtime &&
        (window as any).chrome.runtime.sendMessage
      ) {
        ;(window as any).chrome.runtime.sendMessage(message, (response: any) => {
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

/**
 * 插入表情到编辑器
 */
async function insertEmoji(emojiData: emoji): Promise<void> {
  try {
    // 直接实现表情插入逻辑，类似于main.ts中的实现
    const textArea = document.querySelector('textarea.d-editor-input') as HTMLTextAreaElement
    const richEle = document.querySelector('.ProseMirror.d-editor-input') as HTMLElement
    
    if (!textArea && !richEle) {
      console.warn('[表情插入] 未找到可用的文本输入框')
      return
    }

    // 获取表情数据
    const emojiText = `![${emojiData.displayName}](${emojiData.displayUrl || emojiData.realUrl}) `
    
    if (textArea) {
      // 处理普通文本框
      const startPos = textArea.selectionStart
      const endPos = textArea.selectionEnd
      textArea.value =
        textArea.value.substring(0, startPos) +
        emojiText +
        textArea.value.substring(endPos, textArea.value.length)
      textArea.selectionStart = textArea.selectionEnd = startPos + emojiText.length
      textArea.focus()
      const event = new Event('input', { bubbles: true, cancelable: true })
      textArea.dispatchEvent(event)
    } else if (richEle) {
      // 处理富文本编辑器
      const imgTemplate = `<img src="${emojiData.displayUrl || emojiData.realUrl}" title=":${emojiData.displayName}:" class="emoji only-emoji" alt=":${emojiData.displayName}:" loading="lazy">`
      try {
        const dt = new DataTransfer()
        dt.setData('text/html', imgTemplate)
        const evt = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true })
        richEle.dispatchEvent(evt)
      } catch (_) {
        try {
          document.execCommand('insertHTML', false, imgTemplate)
        } catch (err) {
          console.error('无法向富文本编辑器中插入表情', err)
          throw err
        }
      }
    }
  } catch (error) {
    console.error('[事件处理] 插入表情失败:', error)
    throw error
  }
}

/**
 * 专门处理表情选择器关闭的函数
 */
function closePicker(picker: HTMLElement, isMobilePicker: boolean): void {
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

/**
 * 设置表情点击事件处理器
 */
export function setupEmojiClickHandlers(picker: HTMLElement, isMobilePicker: boolean): void {
  const emojiImages = picker.querySelectorAll('.emoji-picker__section-emojis .emoji')
  
  emojiImages.forEach((img) => {
    img.addEventListener('click', async () => {
      const clickStartTime = performance.now()
      console.log('[异步点击] 表情点击开始')

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

      // 并行处理：记录使用统计 + 插入表情
      const tasks = []

      // 任务 1: 记录使用统计（如果有 UUID）
      if (originalUUID) {
        const usageTask = recordEmojiUsage(originalUUID)
          .then(() => {
            console.log('[异步点击] 成功记录表情使用:', originalUUID)
            return true
          })
          .catch((error) => {
            console.error('[异步点击] 记录表情使用失败:', error)
            return false
          })
        tasks.push(usageTask)
      } else {
        console.warn('[异步点击] 表情缺少 UUID 信息，无法记录使用统计')
        tasks.push(Promise.resolve(false))
      }

      // 任务 2: 插入表情
      const insertTask = insertEmoji(emojiData)
        .then(() => {
          console.log('[异步点击] 成功插入表情')
          return true
        })
        .catch((error) => {
          console.error('[异步点击] 插入表情失败:', error)
          return false
        })
      tasks.push(insertTask)

      // 等待所有任务完成
      try {
        const results = await Promise.allSettled(tasks)
        const clickDuration = performance.now() - clickStartTime

        console.log(`[异步点击] 所有任务完成，总耗时: ${Math.round(clickDuration)}ms`)
        console.log(
          '[异步点击] 任务结果:',
          results.map((r) => r.status),
        )

        // 只要插入成功就关闭选择器（不等待统计记录）
        const insertResult = results[1] // 插入结果是第二个任务
        if (insertResult.status === 'fulfilled') {
          closePicker(picker, isMobilePicker)
        } else {
          // 即使插入失败也关闭选择器，避免界面卡住
          console.warn('[异步点击] 插入失败，但仍然关闭选择器')
          closePicker(picker, isMobilePicker)
        }
      } catch (error) {
        console.error('[异步点击] 处理表情点击时出错:', error)
        // 即使出错也尝试关闭选择器
        closePicker(picker, isMobilePicker)
      }
    })
  })
}

/**
 * 设置分组导航事件处理器
 */
export function setupSectionNavigationHandlers(picker: HTMLElement): void {
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
}

/**
 * 设置关闭按钮事件处理器
 */
export function setupCloseHandlers(picker: HTMLElement, isMobilePicker: boolean): void {
  // Add close functionality for delete buttons (only exists in frequently used groups)
  const deleteButtons = picker.querySelectorAll('.emoji-picker__section-title-container button')
  deleteButtons.forEach((deleteBtn) => {
    deleteBtn.addEventListener('click', () => {
      closePicker(picker, isMobilePicker)
    })
  })

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
}

/**
 * 设置过滤器事件处理器
 */
export function setupFilterHandlers(picker: HTMLElement): void {
  const filterInput = picker.querySelector('.filter-input') as HTMLInputElement
  const sections = picker.querySelectorAll('.emoji-picker__section')
  const emojiImages = picker.querySelectorAll('.emoji-picker__section-emojis .emoji')

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
}

/**
 * 设置上传功能事件处理器
 */
export function setupUploadHandlers(picker: HTMLElement): void {
  const uploadButton = picker.querySelector('#emoji-upload-trigger') as HTMLButtonElement
  if (uploadButton) {
    // 创建隐藏的文件输入
    const fileInput = document.createElement('input')
    fileInput.type = 'file'
    fileInput.multiple = true
    fileInput.accept = 'image/*'
    fileInput.style.display = 'none'
    picker.appendChild(fileInput)

    // 上传按钮点击事件
    uploadButton.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      console.log('[上传功能] 点击上传按钮')
      
      // 显示上传队列UI
      uploadQueueUI.showPanel()
      
      // 触发文件选择
      fileInput.click()
    })

    // 文件选择事件
    fileInput.addEventListener('change', async (e) => {
      const target = e.target as HTMLInputElement
      const files = Array.from(target.files || [])
      
      if (files.length === 0) {
        console.log('[上传功能] 未选择文件')
        return
      }

      console.log(`[上传功能] 选择了 ${files.length} 个文件:`, files.map(f => f.name))
      
      try {
        // 检查是否要进行差分上传
        const activeTextArea = document.querySelector('textarea:focus, .d-editor-input:focus') as HTMLTextAreaElement
        let shouldUseDiffUpload = false
        let existingContent = ''
        
        if (activeTextArea && activeTextArea.value.trim()) {
          existingContent = activeTextArea.value
          shouldUseDiffUpload = confirm('检测到文本框中已有内容，是否只上传不存在的文件？\n\n点击"确定"进行差分上传（跳过已存在的文件）\n点击"取消"上传所有选择的文件')
        }

        // 根据选择进行上传
        if (shouldUseDiffUpload) {
          console.log('[上传功能] 执行差分上传')
          await uploadQueue.uploadDiffFiles(files, existingContent)
        } else {
          console.log('[上传功能] 执行批量上传')
          await uploadQueue.uploadBatchFiles(files)
        }
        
        console.log('[上传功能] 文件已加入上传队列')
      } catch (error) {
        console.error('[上传功能] 上传失败:', error)
        alert(`上传失败: ${error instanceof Error ? error.message : String(error)}`)
      } finally {
        // 重置文件输入
        target.value = ''
      }
    })
  }
}

/**
 * 设置常用表情组刷新事件监听器
 */
export function setupCommonGroupRefreshHandler(picker: HTMLElement): () => void {
  const commonGroupRefreshHandler = (event: CustomEvent) => {
    try {
      const updatedGroup = event.detail?.group
      if (updatedGroup && updatedGroup.UUID === 'common-emoji-group') {
        console.log('[表情选择器] 收到常用表情组刷新事件')

        // 找到常用表情组的容器
        const commonSection = picker.querySelector('[data-section="common-emoji-group"]')
        if (commonSection) {
          // 更新常用表情组的内容
          const emojisContainer = commonSection.querySelector('.emoji-picker__section-emojis')
          if (emojisContainer && Array.isArray(updatedGroup.emojis)) {
            let groupEmojisHtml = ''
            updatedGroup.emojis.forEach((emojiData: any, index: number) => {
              const nameEsc = String(emojiData.displayName || '').replace(/"/g, '&quot;')
              const tabindex = index === 0 ? '0' : '-1'
              const displayUrl = emojiData.displayUrl || emojiData.realUrl
              const emojiUUID = emojiData.UUID || ''
              groupEmojisHtml += `<img width="32" height="32" class="emoji" src="${displayUrl}" tabindex="${tabindex}" data-emoji="${nameEsc}" data-uuid="${emojiUUID}" alt="${nameEsc}" title=":${nameEsc}:" loading="lazy" />\n`
            })

            emojisContainer.innerHTML = groupEmojisHtml

            // 重新绑定新添加的表情的点击事件
            setupEmojiClickHandlers(picker, picker.classList.contains('modal-container'))

            console.log('[表情选择器] 常用表情组刷新完成')
          }
        } else {
          console.warn('[表情选择器] 未找到常用表情组容器')
        }
      }
    } catch (error) {
      console.error('[表情选择器] 处理常用表情组刷新事件失败:', error)
    }
  }

  // 添加监听器
  window.addEventListener(
    'emoji-common-group-refreshed',
    commonGroupRefreshHandler as EventListener,
  )

  // 返回清理函数
  return () => {
    console.log('[表情选择器] 移除常用表情组刷新监听器')
    window.removeEventListener(
      'emoji-common-group-refreshed',
      commonGroupRefreshHandler as EventListener,
    )
  }
}

export { closePicker }