import { CONSTANTS } from './config'
import { logger } from './utils'
import { createPixivEmojiButton } from './button'
import {
  isPixivPage,
  getPageType,
  scanForPixivViewer,
  scanForImagePage,
  extractEmojiDataFromPixiv,
  hasEmojiButton,
  ensureRelativePositioning,
  startDomObserver
} from './detectors'
import { extractNameFromUrl } from './helpers/url'

/**
 * 主要的初始化和检测逻辑
 */

// 为Pixiv容器添加表情按钮
function addEmojiButtonToPixiv(pixivContainer: Element): void {
  if (!pixivContainer || hasEmojiButton(pixivContainer)) {
    return
  }

  const emojiData = extractEmojiDataFromPixiv(pixivContainer)
  if (!emojiData) {
    return
  }

  const addButton = createPixivEmojiButton(emojiData)

  // 确保容器有相对定位
  ensureRelativePositioning(pixivContainer)

  pixivContainer.appendChild(addButton)
  logger.debug('已添加表情按钮到容器')
}

// 为图片页面添加表情按钮
function addEmojiButtonToImage(img: Element): void {
  const imgElement = img as HTMLImageElement

  if (
    !imgElement.src ||
    (!imgElement.src.includes('i.pximg.net') && !imgElement.src.includes('pximg.net'))
  ) {
    return
  }

  const container = imgElement.parentElement || document.body
  if (container.querySelector('.emoji-add-link-pixiv')) {
    return
  }

  const imageUrl = imgElement.src
  const imageName = extractNameFromUrl(imageUrl)

  logger.debug('在图片页面发现图片:', { url: imageUrl, name: imageName })

  const emojiData = {
    name: imageName,
    url: imageUrl
  }

  const button = createPixivEmojiButton(emojiData)

  // 确保容器有相对定位
  ensureRelativePositioning(container)

  container.appendChild(button)
  logger.debug('已添加按钮到图片页面')
}

// 执行初始扫描
function performInitialScan(): void {
  const pageType = getPageType()

  if (pageType === 'image') {
    // 图片页面：扫描图片元素
    const images = scanForImagePage()
    images.forEach(addEmojiButtonToImage)
  } else {
    // 主站：扫描查看器
    const viewers = scanForPixivViewer()
    viewers.forEach(addEmojiButtonToPixiv)
  }
}

// 主初始化函数
export function initPixiv(): void {
  try {
    if (!isPixivPage()) {
      logger.info('跳过初始化：非Pixiv页面')
      return
    }

    logger.info('开始初始化Pixiv表情添加功能')

    // 延迟执行初始扫描
    setTimeout(() => {
      performInitialScan()
    }, CONSTANTS.DEFAULTS.SCAN_DELAY)

    // 启动DOM观察器
    startDomObserver()

    logger.info('Pixiv表情添加功能初始化完成')
  } catch (error) {
    logger.error('初始化失败', error)
  }
}
