import { logger } from '../../config/buildFlags'
import { downloadAndAddEmoji, type DownloadUploadOptions, type DownloadUploadResult } from './downloadUpload'
import { addEmojiToGroup, type EmojiData, type AddEmojiResult } from './emojiAddition'

export interface FileData {
  name: string
  data: ArrayBuffer | Uint8Array | string
  mimeType?: string
  size?: number
}

export interface FileReceptionOptions {
  targetGroupId?: string
  uploadOptions?: DownloadUploadOptions
  processImages?: boolean
}

/**
 * File reception + upload handler - handles receiving files from content scripts and uploading them
 */
export async function receiveAndProcessFile(
  fileData: FileData,
  options: FileReceptionOptions = {}
): Promise<DownloadUploadResult> {
  try {
    logger.log('[FileReception] Starting file reception and processing:', fileData.name)

    const { targetGroupId = 'ungrouped', uploadOptions, processImages = true } = options

    // Validate file data
    if (!fileData.name || !fileData.data) {
      return {
        success: false,
        error: '文件数据不完整'
      }
    }

    // Check file size (limit to 10MB)
    const maxSize = 10 * 1024 * 1024 // 10MB
    const fileSize = fileData.size || (
      typeof fileData.data === 'string' 
        ? fileData.data.length 
        : fileData.data.byteLength
    )

    if (fileSize > maxSize) {
      return {
        success: false,
        error: `文件过大（${Math.round(fileSize / 1024 / 1024)}MB），最大支持10MB`
      }
    }

    // Determine MIME type
    const mimeType = fileData.mimeType || getMimeTypeFromName(fileData.name)
    
    // Check if it's an image
    if (!mimeType.startsWith('image/')) {
      return {
        success: false,
        error: '只支持图片文件'
      }
    }

    // Convert file data to data URL for processing
    let dataUrl: string
    if (typeof fileData.data === 'string') {
      // Assume it's already a data URL or base64
      dataUrl = fileData.data.startsWith('data:') 
        ? fileData.data 
        : `data:${mimeType};base64,${fileData.data}`
    } else {
      // Convert ArrayBuffer/Uint8Array to base64
      const uint8Array = fileData.data instanceof ArrayBuffer 
        ? new Uint8Array(fileData.data)
        : fileData.data
      const base64 = arrayBufferToBase64(uint8Array)
      dataUrl = `data:${mimeType};base64,${base64}`
    }

    // Create emoji data
    const emojiData: EmojiData = {
      name: getNameWithoutExtension(fileData.name),
      url: dataUrl
    }

    // If processing images and upload options are available, try to upload
    if (processImages && uploadOptions && uploadOptions.discourseBase) {
      logger.log('[FileReception] Processing image with upload')
      return await downloadAndAddEmoji(emojiData, targetGroupId, uploadOptions)
    } else {
      // Add directly as data URL
      logger.log('[FileReception] Adding file as data URL')
      const result = await addEmojiToGroup(emojiData, targetGroupId)
      return {
        ...result,
        originalUrl: dataUrl,
        finalUrl: dataUrl,
        uploaded: false
      }
    }
  } catch (error) {
    logger.error('[FileReception] File reception and processing failed:', error)
    
    return {
      success: false,
      error: error instanceof Error ? error.message : '文件处理失败'
    }
  }
}

/**
 * Receive and process multiple files
 */
export async function receiveAndProcessFiles(
  filesData: FileData[],
  options: FileReceptionOptions = {}
): Promise<DownloadUploadResult> {
  try {
    logger.log('[FileReception] Starting batch file reception:', filesData.length, 'files')

    const results = []
    let successCount = 0
    let errorCount = 0
    let uploadedCount = 0

    for (const fileData of filesData) {
      const result = await receiveAndProcessFile(fileData, options)
      results.push(result)
      
      if (result.success) {
        successCount++
        if (result.uploaded) {
          uploadedCount++
        }
      } else {
        errorCount++
      }
    }

    return {
      success: successCount > 0,
      message: `成功处理 ${successCount} 个文件${uploadedCount > 0 ? `（上传 ${uploadedCount} 个）` : ''}${errorCount > 0 ? `，失败 ${errorCount} 个` : ''}`,
      uploaded: uploadedCount > 0,
      errorDetails: results
    }
  } catch (error) {
    logger.error('[FileReception] Batch file reception failed:', error)
    
    return {
      success: false,
      error: error instanceof Error ? error.message : '批量文件处理失败',
      uploaded: false
    }
  }
}

/**
 * Get MIME type from file name
 */
function getMimeTypeFromName(fileName: string): string {
  const ext = fileName.toLowerCase().split('.').pop()
  
  const mimeTypes: Record<string, string> = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'svg': 'image/svg+xml',
    'bmp': 'image/bmp',
    'ico': 'image/x-icon'
  }
  
  return mimeTypes[ext || ''] || 'image/png'
}

/**
 * Get file name without extension
 */
function getNameWithoutExtension(fileName: string): string {
  const lastDotIndex = fileName.lastIndexOf('.')
  return lastDotIndex > 0 ? fileName.substring(0, lastDotIndex) : fileName
}

/**
 * Convert ArrayBuffer to base64
 */
function arrayBufferToBase64(buffer: Uint8Array): string {
  let binary = ''
  const bytes = new Uint8Array(buffer)
  const len = bytes.byteLength
  
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  
  return btoa(binary)
}
