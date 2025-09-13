import { logger } from '../../config/buildFlags'
import { getChromeAPI } from '../utils'
import { downloadAndUploadDirect } from '../downloadAndSend'
import { addEmojiToGroup, type EmojiData, type AddEmojiResult } from './emojiAddition'

export interface DownloadUploadOptions {
  discourseBase?: string
  cookie?: string
  csrf?: string
  mimeType?: string
}

export interface DownloadUploadResult extends AddEmojiResult {
  originalUrl?: string
  finalUrl?: string
  uploaded?: boolean
}

/**
 * Download and upload handler - handles background downloading and uploading of external images
 */
export async function downloadAndAddEmoji(
  emojiData: EmojiData, 
  targetGroupId: string = 'ungrouped',
  uploadOptions?: DownloadUploadOptions
): Promise<DownloadUploadResult> {
  try {
    logger.log('[DownloadUpload] Starting download and upload process:', emojiData)

    const originalUrl = emojiData.url
    let finalUrl = originalUrl
    let uploaded = false

    // Check if this is a Pixiv image that needs downloading and uploading
    if (originalUrl && originalUrl.includes('i.pximg.net')) {
      logger.log('[DownloadUpload] Detected Pixiv image, attempting upload')

      // Get upload options from storage if not provided
      let options = uploadOptions
      if (!options) {
        options = await getLastDiscourseConfig()
      }

      if (options && options.discourseBase) {
        try {
          const uploadResult = await downloadAndUploadDirect(
            originalUrl,
            emojiData.name || 'image.png',
            {
              discourseBase: options.discourseBase,
              cookie: options.cookie,
              csrf: options.csrf,
              mimeType: options.mimeType
            }
          )

          if (uploadResult && uploadResult.url) {
            finalUrl = uploadResult.url
            uploaded = true
            logger.log('[DownloadUpload] Successfully uploaded image:', finalUrl)
          }
        } catch (error) {
          logger.warn('[DownloadUpload] Upload failed, using original URL:', error)
          // Continue with original URL as fallback
        }
      } else {
        logger.warn('[DownloadUpload] No Discourse config available, using original URL')
      }
    }

    // Create emoji data with final URL
    const processedEmojiData: EmojiData = {
      ...emojiData,
      url: finalUrl
    }

    // Add emoji to group using the pure addition handler
    const result = await addEmojiToGroup(processedEmojiData, targetGroupId)

    return {
      ...result,
      originalUrl,
      finalUrl,
      uploaded
    }
  } catch (error) {
    logger.error('[DownloadUpload] Download and upload process failed:', error)
    
    return {
      success: false,
      error: error instanceof Error ? error.message : '下载上传失败',
      originalUrl: emojiData.url,
      finalUrl: emojiData.url,
      uploaded: false
    }
  }
}

/**
 * Get last used Discourse configuration from storage
 */
async function getLastDiscourseConfig(): Promise<DownloadUploadOptions | null> {
  try {
    const chromeAPI = getChromeAPI()
    if (!chromeAPI || !chromeAPI.storage || !chromeAPI.storage.local) {
      return null
    }

    const stored = await new Promise<any>(resolve => {
      chromeAPI.storage.local.get(['lastDiscourse'], (res: any) => resolve(res))
    })

    const last = stored && stored.lastDiscourse ? stored.lastDiscourse : null
    if (last && last.base) {
      return {
        discourseBase: last.base,
        cookie: last.cookie,
        csrf: last.csrf
      }
    }

    return null
  } catch (error) {
    logger.error('[DownloadUpload] Failed to get Discourse config:', error)
    return null
  }
}

/**
 * Save Discourse configuration for future use
 */
export async function saveDiscourseConfig(config: DownloadUploadOptions): Promise<boolean> {
  try {
    const chromeAPI = getChromeAPI()
    if (!chromeAPI || !chromeAPI.storage || !chromeAPI.storage.local) {
      return false
    }

    await new Promise<void>((resolve, reject) => {
      chromeAPI.storage.local.set({
        lastDiscourse: {
          base: config.discourseBase,
          cookie: config.cookie,
          csrf: config.csrf
        }
      }, () => {
        if (chromeAPI.runtime.lastError) {
          reject(chromeAPI.runtime.lastError)
        } else {
          resolve()
        }
      })
    })

    logger.log('[DownloadUpload] Saved Discourse config')
    return true
  } catch (error) {
    logger.error('[DownloadUpload] Failed to save Discourse config:', error)
    return false
  }
}

/**
 * Batch download and upload multiple images
 */
export async function downloadAndAddEmojis(
  emojisData: EmojiData[],
  targetGroupId: string = 'ungrouped',
  uploadOptions?: DownloadUploadOptions
): Promise<DownloadUploadResult> {
  try {
    logger.log('[DownloadUpload] Starting batch download and upload:', emojisData.length, 'emojis')

    const results = []
    let successCount = 0
    let errorCount = 0
    let uploadedCount = 0

    for (const emojiData of emojisData) {
      const result = await downloadAndAddEmoji(emojiData, targetGroupId, uploadOptions)
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
      message: `成功处理 ${successCount} 个表情${uploadedCount > 0 ? `（上传 ${uploadedCount} 个）` : ''}${errorCount > 0 ? `，失败 ${errorCount} 个` : ''}`,
      uploaded: uploadedCount > 0,
      errorDetails: results
    }
  } catch (error) {
    logger.error('[DownloadUpload] Batch download and upload failed:', error)
    
    return {
      success: false,
      error: error instanceof Error ? error.message : '批量下载上传失败',
      uploaded: false
    }
  }
}
