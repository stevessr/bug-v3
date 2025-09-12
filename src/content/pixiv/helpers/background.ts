import type {
  BackgroundMessage,
  BackgroundResponse,
  EmojiAddResponse,
  AddEmojiButtonData
} from '../types'
import { logger, createErrorResponse } from '../utils'

import { extractNameFromUrl, sanitizeFilename } from './url'
import { getImageBlob, validateImageBlob } from './image'

/**
 * 后台通信相关工具函数
 */

// 检查Chrome扩展API是否可用
function isChromeApiAvailable(): boolean {
  const chromeAPI = (window as any).chrome
  return !!(chromeAPI && chromeAPI.runtime && chromeAPI.runtime.sendMessage)
}

// 发送消息到后台脚本
async function sendMessageToBackground(message: BackgroundMessage): Promise<BackgroundResponse> {
  return new Promise(resolve => {
    try {
      const chromeAPI = (window as any).chrome
      chromeAPI.runtime.sendMessage(message, (response: BackgroundResponse) => {
        resolve(response || { success: false, error: '后台脚本无响应' })
      })
    } catch (error) {
      resolve({
        success: false,
        error: '发送消息失败',
        details: error instanceof Error ? error.message : String(error)
      })
    }
  })
}

// 将Blob转换为数组数据
async function blobToArrayData(blob: Blob): Promise<number[]> {
  const arrayBuffer = await blob.arrayBuffer()
  const uint8Array = new Uint8Array(arrayBuffer)
  return Array.from(uint8Array)
}

// 发送表情数据到后台处理
export async function sendEmojiToBackground(
  blob: Blob,
  emojiName: string,
  filename: string
): Promise<EmojiAddResponse> {
  try {
    if (!isChromeApiAvailable()) {
      throw new Error('Chrome扩展API不可用')
    }

    if (!validateImageBlob(blob)) {
      throw new Error('无效的图片数据')
    }

    logger.info('准备发送表情到后台:', {
      name: emojiName,
      filename,
      size: blob.size,
      type: blob.type
    })

    const arrayData = await blobToArrayData(blob)

    logger.debug('已将Blob转换为数组数据:', {
      originalBlobSize: blob.size,
      arrayDataLength: arrayData.length
    })

    const message: BackgroundMessage = {
      action: 'uploadAndAddEmoji',
      payload: {
        arrayData,
        filename: sanitizeFilename(filename),
        mimeType: blob.type,
        name: emojiName
      }
    }

    const response = await sendMessageToBackground(message)

    if (response && response.success) {
      logger.info('表情添加成功:', response)
      return {
        success: true,
        source: 'uploaded',
        url: response.url,
        added: !!response.added,
        message: '表情已成功添加到未分组'
      }
    } else {
      logger.error('后台处理失败:', response)
      return createErrorResponse(
        '后台处理失败',
        response?.details || response?.error,
        'BACKGROUND_PROCESSING_FAILED'
      )
    }
  } catch (error) {
    logger.error('发送到后台失败:', error)
    return createErrorResponse(
      '发送数据到后台失败',
      error instanceof Error ? error.message : String(error),
      'BACKGROUND_SEND_FAILED'
    )
  }
}

// 执行完整的表情添加流程
export async function performEmojiAddFlow(data: AddEmojiButtonData): Promise<EmojiAddResponse> {
  try {
    const baseName = data.name && data.name.length > 0 ? data.name : extractNameFromUrl(data.url)
    const filename = baseName.replace(/\.(webp|jpg|jpeg|png|gif)$/i, '').trim() || 'image'

    logger.info('开始表情添加流程:', { name: baseName, url: data.url })

    // 尝试获取图片
    const imageResult = await getImageBlob(data.url)

    if (imageResult.success) {
      logger.info('图片获取成功，发送到后台处理')
      return await sendEmojiToBackground(imageResult.blob, baseName, filename)
    }

    // 如果获取失败，尝试在新标签页打开
    logger.warn('图片获取失败，尝试在新标签页打开:', imageResult.error)

    try {
      window.open(data.url, '_blank')
      return {
        success: true,
        source: 'opened',
        message: '已在新标签页打开图片，请在图片页面重试添加表情'
      }
    } catch (openError) {
      logger.error('无法打开图片页面:', openError)
      return createErrorResponse('无法下载图片或打开图片页面', openError, 'OPEN_FAILED')
    }
  } catch (error) {
    logger.error('表情添加流程失败:', error)
    return createErrorResponse('添加表情失败', error, 'ADD_FLOW_FAILED')
  }
}
