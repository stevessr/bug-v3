import { logger } from './buildFlags'

// oneClickAdd.ts - 一键添加表情功能（支持 Magnific Popup 和 cooked 内容区域）
declare const chrome: any

// 添加CSS动画
const cssAnimation = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`

// 注入CSS动画到页面
function injectCSSAnimation() {
  if (!document.getElementById('oneclick-add-styles')) {
    const style = document.createElement('style')
    style.id = 'oneclick-add-styles'
    style.textContent = cssAnimation
    document.head.appendChild(style)
  }
}

interface AddEmojiButtonData {
  name: string
  url: string
}

/**
 * 设置按钮点击事件处理器。
 * @param button 按钮元素
 * @param data 表情数据
 */
function setupButtonClickHandler(button: HTMLElement, data: AddEmojiButtonData) {
  button.addEventListener('click', async e => {
    e.preventDefault()
    e.stopPropagation()

    // 保存按钮原始内容和样式，用于操作完成后恢复
    const originalContent = button.innerHTML
    const originalStyle = button.style.cssText

    try {
      // 发送消息到background script，执行添加表情的操作
      await chrome.runtime.sendMessage({
        action: 'addEmojiFromWeb',
        emojiData: data
      })

      // 显示成功提示
      button.innerHTML = `
        <svg class="fa d-icon d-icon-check svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width: 1em; height: 1em; fill: currentColor; margin-right: 4px;">
          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
        </svg>已添加
      `
      button.style.background = 'linear-gradient(135deg, #10b981, #059669)'
      button.style.color = '#ffffff'
      button.style.border = '2px solid #ffffff'
      button.style.boxShadow = '0 2px 4px rgba(16, 185, 129, 0.3)'

      // 2秒后恢复按钮状态
      setTimeout(() => {
        button.innerHTML = originalContent
        button.style.cssText = originalStyle
      }, 2000)
    } catch (error) {
      logger.error('[OneClickAdd] 添加表情失败:', error)

      // 显示失败提示
      button.innerHTML = `
        <svg class="fa d-icon d-icon-times svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width: 1em; height: 1em; fill: currentColor; margin-right: 4px;">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
        </svg>失败
      `
      button.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)'
      button.style.color = '#ffffff' // 确保失败文本颜色为白色，以便看清
      button.style.border = '2px solid #ffffff'
      button.style.boxShadow = '0 2px 4px rgba(239, 68, 68, 0.3)'

      // 2秒后恢复按钮状态
      setTimeout(() => {
        button.innerHTML = originalContent
        button.style.cssText = originalStyle
      }, 2000)
    }
  })
}

/**
 * 从图片URL中提取文件名作为默认名称。
 * @param url 图片URL字符串
 * @returns 提取的名称或默认值 '表情'
 */
function extractNameFromUrl(url: string): string {
  try {
    const urlObj = new URL(url)
    const pathname = urlObj.pathname
    const filename = pathname.split('/').pop() || ''

    // 移除文件扩展名
    const nameWithoutExt = filename.replace(/\.[^/.]+$/, '')

    // 解码URL编码
    const decoded = decodeURIComponent(nameWithoutExt)

    // 如果是无意义的哈希值或短字符串，返回默认名称
    if (/^[0-9a-f]{8,}$/i.test(decoded) || decoded.length < 2) {
      return '表情'
    }

    return decoded || '表情'
  } catch {
    return '表情'
  }
}

/**
 * 从图片元素和标题容器中提取表情数据。
 * @param imgElement 图片元素
 * @param titleContainer 标题容器元素
 * @returns 包含名称和URL的表情数据对象，或 null
 */
function extractEmojiDataFromMfp(
  imgElement: HTMLImageElement,
  titleContainer: Element
): AddEmojiButtonData | null {
  const src = imgElement.src
  if (!src || !src.startsWith('http')) {
    return null
  }

  // 优先从title容器中获取名称
  let name = ''
  const titleText = titleContainer.textContent || ''

  // 解析标题，通常格式为："文件名 · 尺寸 大小 · 下载 · 原始图片"
  const titleParts = titleText.split('·')
  if (titleParts.length > 0) {
    name = titleParts[0].trim()
  }

  // 如果从标题获取不到有效名称，尝试使用 alt 或 title 属性，最后使用URL
  if (!name || name.length < 2) {
    name = imgElement.alt || imgElement.title || extractNameFromUrl(src)
  }

  // 清理名称
  name = name.trim()
  if (name.length === 0) {
    name = '表情'
  }

  return {
    name,
    url: src
  }
}

/**
 * 检查一个元素是否为 Magnific Popup 图片查看器容器。
 * @param element 要检查的元素
 * @returns 如果是则返回 true
 */
function isMagnificPopup(element: Element): boolean {
  // 检查 class 和 .mfp-img 元素，以确保这是正确的类型
  return (
    element.classList.contains('mfp-wrap') &&
    element.classList.contains('mfp-gallery') &&
    element.querySelector('.mfp-img') !== null
  )
}

/**
 * 创建一个符合 Magnific Popup 标题区域样式的“添加表情”按钮。
 * @param data 按钮绑定的表情数据
 * @returns 创建的按钮元素
 */
function createMfpEmojiButton(data: AddEmojiButtonData): HTMLElement {
  const button = document.createElement('a')
  button.className = 'image-source-link emoji-add-link'
  button.style.cssText = `
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

  // 添加hover效果
  button.addEventListener('mouseenter', () => {
    if (!button.innerHTML.includes('已添加') && !button.innerHTML.includes('失败')) {
      button.style.background = 'linear-gradient(135deg, #3730a3, #5b21b6)'
      button.style.transform = 'scale(1.05)'
      button.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.3)'
    }
  })

  button.addEventListener('mouseleave', () => {
    if (!button.innerHTML.includes('已添加') && !button.innerHTML.includes('失败')) {
      button.style.background = 'linear-gradient(135deg, #4f46e5, #7c3aed)'
      button.style.transform = 'scale(1)'
      button.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.2)'
    }
  })

  // 添加SVG图标和文字
  button.innerHTML = `
    <svg class="fa d-icon d-icon-plus svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width: 1em; height: 1em; fill: currentColor; margin-right: 4px;">
      <path d="M12 4c.55 0 1 .45 1 1v6h6c.55 0 1 .45 1 1s-.45 1-1 1h-6v6c0 .55-.45 1-1 1s-1-.45-1-1v-6H5c-.55 0-1-.45-1-1s.45-1 1-1h6V5c0-.55.45-1 1-1z"/>
    </svg>添加表情
  `

  button.title = '添加到未分组表情'

  // 添加点击事件
  setupButtonClickHandler(button, data)

  return button
}

/**
 * 为特定的 Magnific Popup 实例添加表情按钮。
 * @param mfpContainer Magnific Popup 的根容器元素
 */
function addEmojiButtonToMfp(mfpContainer: Element) {
  // 检查是否已经添加过按钮，避免重复注入
  if (mfpContainer.querySelector('.emoji-add-link')) {
    return
  }

  const imgElement = mfpContainer.querySelector('.mfp-img') as HTMLImageElement
  const titleContainer = mfpContainer.querySelector('.mfp-title')

  // 如果找不到图片或标题容器，则退出
  if (!imgElement || !titleContainer) {
    return
  }

  const emojiData = extractEmojiDataFromMfp(imgElement, titleContainer)
  if (!emojiData) {
    return
  }

  // 创建添加表情按钮
  const addButton = createMfpEmojiButton(emojiData)

  // 在标题文本和现有链接之间添加按钮。
  // 这里的关键是找到标题文本的末尾，并插入按钮。
  const downloadLink = titleContainer.querySelector('a.image-source-link')

  if (downloadLink) {
    // 如果找到了下载链接，就将按钮插入到它前面
    const separator = document.createTextNode(' · ')
    titleContainer.insertBefore(separator, downloadLink)
    titleContainer.insertBefore(addButton, downloadLink)
  } else {
    // 如果没有找到链接，直接添加到末尾
    titleContainer.appendChild(document.createTextNode(' · '))
    titleContainer.appendChild(addButton)
  }
}

/**
 * 扫描页面中所有 Magnific Popup 实例，并为它们添加按钮。
 */
function scanForMagnificPopup() {
  const mfpContainers = document.querySelectorAll('.mfp-wrap.mfp-gallery')

  mfpContainers.forEach(container => {
    if (isMagnificPopup(container)) {
      addEmojiButtonToMfp(container)
    }
  })
}

/**
 * 监听 DOM 变化，当 Magnific Popup 出现时自动执行扫描。
 */
function observeMagnificPopup() {
  const observer = new MutationObserver(mutations => {
    let hasMfpChanges = false

    mutations.forEach(mutation => {
      if (mutation.type === 'childList') {
        // 检查是否有新的节点被添加，并且是 Magnific Popup 相关的
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element
            if (element.classList && element.classList.contains('mfp-wrap')) {
              hasMfpChanges = true
            }
          }
        })
      }
    })

    if (hasMfpChanges) {
      // 短暂延迟以确保DOM完全更新，然后执行扫描
      setTimeout(scanForMagnificPopup, 100)
    }
  })

  // 监听 body 的子节点变化，包括子树
  observer.observe(document.body, {
    childList: true,
    subtree: true
  })
}

/**
 * 检查一个元素是否为带有 cooked 类的内容区域。
 * @param element 要检查的元素
 * @returns 如果是则返回 true
 */
function isCookedContent(element: Element): boolean {
  return element.classList.contains('cooked') && element.querySelector('.lightbox-wrapper') !== null
}

/**
 * 从 lightbox-wrapper 中解析图片数据。
 * @param lightboxWrapper lightbox-wrapper 元素
 * @returns 包含名称和URL的表情数据数组
 */
function extractEmojiDataFromLightbox(lightboxWrapper: Element): AddEmojiButtonData[] {
  const results: AddEmojiButtonData[] = []

  const anchor = lightboxWrapper.querySelector('a.lightbox') as HTMLAnchorElement | null
  const img = lightboxWrapper.querySelector('img') as HTMLImageElement | null

  if (!anchor || !img) return results

  const title = anchor.getAttribute('title') || ''
  const originalUrl = anchor.getAttribute('href') || ''
  const downloadUrl = anchor.getAttribute('data-download-href') || ''
  const imgSrc = img.getAttribute('src') || ''

  // 提取图片名称
  let name = title || img.getAttribute('alt') || ''
  if (!name || name.length < 2) {
    // 从URL中提取文件名
    const urlToUse = originalUrl || downloadUrl || imgSrc
    name = extractNameFromUrl(urlToUse)
  }

  // 清理名称，移除文件扩展名
  name = name.replace(/\.(webp|jpg|jpeg|png|gif)$/i, '').trim()
  if (name.length === 0) {
    name = '表情'
  }

  // 优先使用原始URL，然后是下载URL，最后是图片src
  const urlToUse = originalUrl || downloadUrl || imgSrc
  if (urlToUse && urlToUse.startsWith('http')) {
    results.push({
      name,
      url: urlToUse
    })
  }

  return results
}

/**
 * 创建一键解析按钮。
 * @param cookedElement cooked 元素
 * @returns 创建的按钮元素
 */
function createBatchParseButton(cookedElement: Element): HTMLElement {
  const button = document.createElement('button')
  button.className = 'emoji-batch-parse-button'
  button.style.cssText = `
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: linear-gradient(135deg, #f59e0b, #d97706);
    color: #ffffff;
    border: none;
    border-radius: 8px;
    padding: 8px 12px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    margin: 10px 0;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    transition: all 0.2s ease;
    z-index: 1000;
    position: relative;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `

  button.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
    </svg>
    一键解析并添加所有图片
  `

  button.title = '解析当前内容中的所有图片并添加到未分组表情'

  // 添加hover效果
  button.addEventListener('mouseenter', () => {
    if (!button.innerHTML.includes('已处理') && !button.innerHTML.includes('失败')) {
      button.style.background = 'linear-gradient(135deg, #d97706, #b45309)'
      button.style.transform = 'translateY(-1px)'
      button.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.15)'
    }
  })

  button.addEventListener('mouseleave', () => {
    if (!button.innerHTML.includes('已处理') && !button.innerHTML.includes('失败')) {
      button.style.background = 'linear-gradient(135deg, #f59e0b, #d97706)'
      button.style.transform = 'translateY(0)'
      button.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)'
    }
  })

  // 添加点击事件
  button.addEventListener('click', async e => {
    e.preventDefault()
    e.stopPropagation()

    // 保存按钮原始内容和样式
    const originalContent = button.innerHTML
    const originalStyle = button.style.cssText

    try {
      // 显示处理中状态
      button.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="animation: spin 1s linear infinite;">
          <path d="M12,4V2A10,10 0 0,0 2,12H4A8,8 0 0,1 12,4Z"/>
        </svg>
        正在解析...
      `
      button.style.background = 'linear-gradient(135deg, #6b7280, #4b5563)'
      button.disabled = true

      // 查找所有lightbox-wrapper
      const lightboxWrappers = cookedElement.querySelectorAll('.lightbox-wrapper')
      const allEmojiData: AddEmojiButtonData[] = []

      lightboxWrappers.forEach(wrapper => {
        const emojiDataArray = extractEmojiDataFromLightbox(wrapper)
        allEmojiData.push(...emojiDataArray)
      })

      if (allEmojiData.length === 0) {
        throw new Error('未找到可解析的图片')
      }

      // 批量添加表情
      let successCount = 0
      let failCount = 0

      for (const emojiData of allEmojiData) {
        try {
          await chrome.runtime.sendMessage({
            action: 'addEmojiFromWeb',
            emojiData: emojiData
          })
          successCount++
        } catch (error) {
          logger.error('[OneClickAdd] 添加表情失败:', emojiData.name, error)
          failCount++
        }
      }

      // 显示成功状态
      button.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
        </svg>
        已处理 ${successCount}/${allEmojiData.length} 张图片
      `
      button.style.background = 'linear-gradient(135deg, #10b981, #059669)'
      button.style.color = '#ffffff'

      // 3秒后恢复按钮状态
      setTimeout(() => {
        button.innerHTML = originalContent
        button.style.cssText = originalStyle
        button.disabled = false
      }, 3000)
    } catch (error) {
      logger.error('[OneClickAdd] 批量解析失败:', error)

      // 显示失败状态
      button.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
        </svg>
        解析失败
      `
      button.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)'
      button.style.color = '#ffffff'

      // 3秒后恢复按钮状态
      setTimeout(() => {
        button.innerHTML = originalContent
        button.style.cssText = originalStyle
        button.disabled = false
      }, 3000)
    }
  })

  return button
}

/**
 * 为 cooked 内容区域添加一键解析按钮。
 * @param cookedElement cooked 元素
 */
function addBatchParseButtonToCooked(cookedElement: Element) {
  // 检查是否已经添加过按钮，避免重复注入
  if (cookedElement.querySelector('.emoji-batch-parse-button')) {
    return
  }

  // 检查是否有lightbox-wrapper
  const lightboxWrappers = cookedElement.querySelectorAll('.lightbox-wrapper')
  if (lightboxWrappers.length === 0) {
    return
  }

  // 创建按钮
  const button = createBatchParseButton(cookedElement)

  // 在cooked元素的开头插入按钮
  const firstChild = cookedElement.firstChild
  if (firstChild) {
    cookedElement.insertBefore(button, firstChild)
  } else {
    cookedElement.appendChild(button)
  }
}

/**
 * 扫描页面中所有 cooked 内容区域，并为它们添加一键解析按钮。
 */
function scanForCookedContent() {
  const cookedElements = document.querySelectorAll('.cooked')

  cookedElements.forEach(element => {
    if (isCookedContent(element)) {
      addBatchParseButtonToCooked(element)
    }
  })
}

/**
 * 监听 DOM 变化，当 cooked 内容出现时自动执行扫描。
 */
function observeCookedContent() {
  const observer = new MutationObserver(mutations => {
    let hasCookedChanges = false

    mutations.forEach(mutation => {
      if (mutation.type === 'childList') {
        // 检查是否有新的节点被添加，并且是 cooked 相关的
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element
            // 检查元素本身或其子元素是否包含cooked
            if (element.classList && element.classList.contains('cooked')) {
              hasCookedChanges = true
            } else if (element.querySelector && element.querySelector('.cooked')) {
              hasCookedChanges = true
            }
          }
        })
      }
    })

    if (hasCookedChanges) {
      // 短暂延迟以确保DOM完全更新，然后执行扫描
      setTimeout(scanForCookedContent, 100)
    }
  })

  // 监听 body 的子节点变化，包括子树
  observer.observe(document.body, {
    childList: true,
    subtree: true
  })
}

/**
 * 初始化一键添加功能。
 */
export function initOneClickAdd() {
  logger.log('[OneClickAdd] 初始化一键添加表情功能（支持 Magnific Popup 和 cooked 内容）')

  // 注入CSS动画
  injectCSSAnimation()

  // 初始扫描 Magnific Popup
  setTimeout(scanForMagnificPopup, 500)

  // 初始扫描 cooked 内容
  setTimeout(scanForCookedContent, 600)

  // 监听 DOM 变化
  observeMagnificPopup()
  observeCookedContent()

  // 监听页面可见性变化，当页面重新变为可见时再次扫描
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      setTimeout(scanForMagnificPopup, 200)
      setTimeout(scanForCookedContent, 300)
    }
  })
}
