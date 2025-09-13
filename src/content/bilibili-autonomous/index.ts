/**
 * Bilibili Autonomous Content Script - Main Entry Point
 * 哔哩哔哩自治内容脚本主入口
 *
 * 这是重构后的模块化版本，将原来的bilibili-autonomous.ts分解为多个功能模块
 */

import { logger, debounce } from './utils'
import { shouldRunOnCurrentPage } from './detectors/page'
import { DOM_SELECTORS, CONSTANTS } from './config'
import { extractImageUrlFromPicture, extractNameFromUrl, processUrl } from './processors/url'
import type { AddEmojiButtonData, ImageProcessResult } from './types'

// ===== 按钮创建和管理 =====

function createFloatingButton(data: AddEmojiButtonData, targetElement: Element): HTMLElement {
  const button = document.createElement('button')
  button.className = 'bilibili-emoji-add-btn'
  button.type = 'button'
  button.title = '添加到表情包'
  button.innerHTML = '➕'

  // 应用样式
  button.style.cssText = `
    position: absolute;
    top: 8px;
    right: 8px;
    z-index: 9999;
    background: rgba(0, 0, 0, 0.8);
    color: white;
    border: none;
    border-radius: 6px;
    padding: 6px 8px;
    cursor: pointer;
    font-size: 14px;
    font-weight: bold;
    opacity: 0;
    transition: opacity 0.2s;
    backdrop-filter: blur(4px);
    box-shadow: rgba(0, 0, 0, 0.3) 0px 2px 8px;
    min-width: 28px;
    min-height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: auto;
  `

  // 设置点击事件
  setupButtonClick(button, data)

  // 设置悬停效果
  setupButtonHover(button, targetElement)

  return button
}

function setupButtonClick(button: HTMLElement, data: AddEmojiButtonData) {
  button.addEventListener('click', async e => {
    e.preventDefault()
    e.stopPropagation()

    const originalText = button.innerHTML
    const originalStyle = button.style.cssText

    try {
      button.innerHTML = '⏳'
      button.style.background = 'linear-gradient(135deg,#f59e0b,#d97706)'

      // 发送到后台处理
      const response = await sendToBackground({
        action: 'downloadAndUploadEmoji',
        url: data.url,
        name: data.name
      })

      if (response && response.success) {
        button.innerHTML = '✅'
        button.style.background = 'linear-gradient(135deg,#10b981,#059669)'

        setTimeout(() => {
          button.innerHTML = originalText
          button.style.cssText = originalStyle
        }, CONSTANTS.DEFAULTS.BUTTON_TIMEOUT)
      } else {
        throw new Error(response?.error || '上传失败')
      }
    } catch (error) {
      logger.error('添加表情失败:', error)
      button.innerHTML = '❌'
      button.style.background = 'linear-gradient(135deg,#ef4444,#dc2626)'

      setTimeout(() => {
        button.innerHTML = originalText
        button.style.cssText = originalStyle
      }, CONSTANTS.DEFAULTS.BUTTON_TIMEOUT)
    }
  })
}

function setupButtonHover(button: HTMLElement, targetElement: Element) {
  const showButton = () => {
    button.style.opacity = '1'
  }

  const hideButton = () => {
    button.style.opacity = '0'
  }

  // 监听目标元素的悬停
  targetElement.addEventListener('mouseenter', showButton)
  targetElement.addEventListener('mouseleave', hideButton)

  // 监听按钮本身的悬停
  button.addEventListener('mouseenter', showButton)
  button.addEventListener('mouseleave', hideButton)
}

// ===== 图片扫描和处理 =====

function scanForImages(): ImageProcessResult[] {
  const results: ImageProcessResult[] = []

  try {
    // 扫描常规图片容器
    const allSelectors = [...DOM_SELECTORS.imageContainers, ...DOM_SELECTORS.largeImages]

    const imageContainers = document.querySelectorAll(allSelectors.join(', '))

    imageContainers.forEach(container => {
      // 跳过已处理的
      if (container.querySelector('.bilibili-emoji-add-btn')) {
        return
      }

      // 过滤掉头像
      if (isAvatarImage(container)) {
        return
      }

      const imageUrl = extractImageUrlFromContainer(container)
      if (!imageUrl) {
        return
      }

      const urlResult = processUrl(imageUrl)
      if (!urlResult.isValid || !urlResult.normalizedUrl) {
        return
      }

      const name = extractNameFromUrl(urlResult.normalizedUrl)

      results.push({
        element: container,
        url: urlResult.normalizedUrl,
        name,
        container: findAppropriateContainer(container)
      })
    })

    logger.debug(`扫描到 ${results.length} 个有效图片`)
  } catch (error) {
    logger.error('图片扫描失败:', error)
  }

  return results
}

function isAvatarImage(container: Element): boolean {
  return DOM_SELECTORS.avatarFilters.some(selector => {
    return container.closest(selector) || container.matches(selector)
  })
}

function extractImageUrlFromContainer(container: Element): string | null {
  if (container.tagName.toLowerCase() === 'img') {
    const imgElement = container as HTMLImageElement
    // 对于pswp__img，直接使用src
    if (container.classList.contains('pswp__img')) {
      return imgElement.src
    } else {
      return (
        imgElement.src ||
        imgElement.getAttribute('data-src') ||
        imgElement.getAttribute('src') ||
        null
      )
    }
  } else {
    return extractImageUrlFromPicture(container)
  }
}

function findAppropriateContainer(element: Element): Element {
  return element.parentElement || element
}

// ===== DOM注入逻辑 =====

function injectButtons() {
  const imageResults = scanForImages()

  imageResults.forEach(result => {
    try {
      const data: AddEmojiButtonData = {
        name: result.name,
        url: result.url
      }

      const button = createFloatingButton(data, result.element)

      // 确保容器有相对定位
      const container = result.container as HTMLElement
      if (container.style.position === 'static' || !container.style.position) {
        container.style.position = 'relative'
      }

      container.appendChild(button)
    } catch (error) {
      logger.error('按钮注入失败:', error)
    }
  })
}

// ===== 后台通信 =====

async function sendToBackground(message: any): Promise<any> {
  return new Promise((resolve, reject) => {
    try {
      if ((window as any).chrome?.runtime?.sendMessage) {
        ;(window as any).chrome.runtime.sendMessage(message, (response: any) => {
          if ((window as any).chrome.runtime.lastError) {
            reject(new Error((window as any).chrome.runtime.lastError.message))
          } else {
            resolve(response)
          }
        })
      } else {
        reject(new Error('Chrome runtime not available'))
      }
    } catch (error) {
      reject(error)
    }
  })
}

// ===== DOM观察器 =====

const debouncedInject = debounce(injectButtons, CONSTANTS.DEFAULTS.OBSERVER_DELAY)

function observeMutations() {
  const observer = new MutationObserver(mutations => {
    let shouldScan = false

    mutations.forEach(mutation => {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element
            if (
              element.matches(
                '.bili-album__watch__content, .opus-module-content, .bili-dyn-item, .pswp__img'
              ) ||
              element.querySelector(
                '.bili-album__watch__content, .opus-module-content, .bili-dyn-item, .pswp__img'
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
      debouncedInject()
    }
  })

  observer.observe(document.body, {
    childList: true,
    subtree: true
  })

  logger.debug('DOM观察器已启动')
}

// ===== 主初始化函数 =====

export function initBilibiliAutonomous(): void {
  try {
    if (!shouldRunOnCurrentPage()) {
      logger.info('跳过初始化：不是支持的哔哩哔哩页面')
      return
    }

    logger.info('开始初始化哔哩哔哩表情添加功能')

    // 延迟执行初始扫描
    setTimeout(() => {
      injectButtons()
    }, CONSTANTS.DEFAULTS.SCAN_DELAY)

    // 启动DOM观察器
    observeMutations()

    logger.info('哔哩哔哩表情添加功能初始化完成')
  } catch (error) {
    logger.error('初始化失败:', error)
  }
}

// 自动初始化
try {
  initBilibiliAutonomous()
} catch (error) {
  console.error('[Bilibili] Auto-initialization failed:', error)
}
