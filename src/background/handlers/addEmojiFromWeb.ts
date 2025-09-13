import { logger } from '../../config/buildFlags'
import { downloadAndAddEmoji } from './downloadUpload'
import { addEmojiToGroup } from './emojiAddition'
import { receiveAndProcessFile, type FileData } from './fileReception'

/**
 * Main handler for adding emojis from web - delegates to appropriate specialized handlers
 */
export async function handleAddEmojiFromWeb(emojiData: any, sendResponse: any) {
  // reference the callback to avoid unused-var lint in some configurations
  void sendResponse

  try {
    logger.log('[AddEmojiFromWeb] Starting emoji addition:', emojiData)

    // Determine the type of emoji addition request
    const requestType = determineRequestType(emojiData)
    logger.log('[AddEmojiFromWeb] Request type:', requestType)

    let result

    switch (requestType) {
      case 'file':
        // Handle file data from content script
        result = await handleFileData(emojiData)
        break

      case 'download':
        // Handle URL that needs downloading/uploading (e.g., Pixiv images)
        result = await handleDownloadableUrl(emojiData)
        break

      case 'direct':
        // Handle direct URL addition
        result = await handleDirectUrl(emojiData)
        break

      default:
        result = {
          success: false,
          error: '未知的请求类型'
        }
    }

    // Send response
    if (result.success) {
      sendResponse({
        success: true,
        message: result.message || '表情已添加',
        added: result.added || false,
        url: (result as any).finalUrl || emojiData.url
      })
    } else {
      sendResponse({
        success: false,
        error: result.error || '添加失败',
        errorDetails: result.errorDetails
      })
    }
  } catch (error) {
    logger.error('[AddEmojiFromWeb] 添加表情失败:', error)

    const errorDetails = {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined
    }

    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : '添加失败',
      errorDetails
    })
  }
}

/**
 * Determine the type of emoji addition request
 */
function determineRequestType(emojiData: any): 'file' | 'download' | 'direct' {
  // Check if it's file data
  if (emojiData.fileData || emojiData.data) {
    return 'file'
  }

  // Check if it's a URL that needs downloading/uploading
  if (emojiData.url && typeof emojiData.url === 'string') {
    if (emojiData.url.includes('i.pximg.net') || emojiData.url.startsWith('data:')) {
      return 'download'
    }
  }

  // Default to direct URL addition
  return 'direct'
}

/**
 * Handle file data from content script
 */
async function handleFileData(emojiData: any) {
  const fileData: FileData = {
    name: emojiData.name || 'image',
    data: emojiData.fileData || emojiData.data,
    mimeType: emojiData.mimeType,
    size: emojiData.size
  }

  return await receiveAndProcessFile(fileData, {
    targetGroupId: emojiData.groupId || 'ungrouped',
    processImages: true
  })
}

/**
 * Handle URL that needs downloading/uploading
 */
async function handleDownloadableUrl(emojiData: any) {
  return await downloadAndAddEmoji(
    {
      name: emojiData.name,
      url: emojiData.url,
      groupId: emojiData.groupId
    },
    emojiData.groupId || 'ungrouped'
  )
}

/**
 * Handle direct URL addition
 */
async function handleDirectUrl(emojiData: any) {
  return await addEmojiToGroup(
    {
      name: emojiData.name,
      url: emojiData.url,
      groupId: emojiData.groupId
    },
    emojiData.groupId || 'ungrouped'
  )
}
