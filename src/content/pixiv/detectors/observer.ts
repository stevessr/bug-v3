import { CONSTANTS } from '../config'
import { logger, debounce } from '../utils'

import { getPageType } from './page'
import { scanForPixivViewer, scanForImagePage } from './scanner'

/**
 * DOM观察器 - 监听DOM变化并触发扫描
 */

type ScanCallback = () => void

// 创建防抖的扫描函数
function createDebouncedScanner(callback: ScanCallback): ScanCallback {
  return debounce(callback, CONSTANTS.DEFAULTS.OBSERVER_DELAY)
}

// 检查新增的节点是否需要触发扫描
function shouldTriggerScan(node: Node, pageType: 'main' | 'image' | 'unknown'): boolean {
  if (node.nodeType !== Node.ELEMENT_NODE) return false

  const element = node as Element

  if (pageType === 'image') {
    // 图片页面：检查是否有新的img元素
    return element.tagName === 'IMG' || (element.querySelector && !!element.querySelector('img'))
  } else {
    // 主站：检查是否有新的presentation元素或包含Pixiv图片的元素
    return (
      (element.getAttribute && element.getAttribute('role') === 'presentation') ||
      (element.querySelector && !!element.querySelector('img[src*="i.pximg.net"]'))
    )
  }
}

// 执行相应的扫描操作
function performScan(pageType: 'main' | 'image' | 'unknown'): void {
  try {
    if (pageType === 'image') {
      const images = scanForImagePage()
      logger.debug(`图片页面扫描完成，发现 ${images.length} 个图片`)
    } else {
      const viewers = scanForPixivViewer()
      logger.debug(`主站扫描完成，发现 ${viewers.length} 个查看器`)
    }
  } catch (error) {
    logger.error('扫描执行失败:', error)
  }
}

// 观察器回调函数
function createObserverCallback(): MutationCallback {
  const pageType = getPageType()
  const debouncedScan = createDebouncedScanner(() => performScan(pageType))

  return (mutations: MutationRecord[]) => {
    let shouldScan = false

    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        for (const node of mutation.addedNodes) {
          if (shouldTriggerScan(node, pageType)) {
            shouldScan = true
            break
          }
        }
        if (shouldScan) break
      }
    }

    if (shouldScan) {
      logger.debug('DOM变化触发扫描')
      debouncedScan()
    }
  }
}

// 启动DOM观察器
export function startDomObserver(): MutationObserver {
  const observer = new MutationObserver(createObserverCallback())

  observer.observe(document.body, {
    childList: true,
    subtree: true
  })

  logger.info('DOM观察器已启动')
  return observer
}

// 停止DOM观察器
export function stopDomObserver(observer: MutationObserver): void {
  observer.disconnect()
  logger.info('DOM观察器已停止')
}
