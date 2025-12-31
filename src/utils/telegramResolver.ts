// Helper to interact with Telegram API
import { storageGet, storageSet, storageRemove } from './simpleStorage'

// We need a persistent storage for the bot token
export const getTelegramBotToken = async (): Promise<string | null> => {
  return await storageGet<string>('telegramBotToken')
}

export const setTelegramBotToken = async (token: string) => {
  if (token) {
    await storageSet('telegramBotToken', token)
  } else {
    await storageRemove('telegramBotToken')
  }
}

export interface TelegramFileInfo {
  file_id: string
  file_unique_id: string
  file_size?: number
  file_path?: string
}

export interface TelegramSticker {
  width: number
  height: number
  emoji: string
  set_name: string
  is_animated: boolean
  is_video: boolean
  type: 'regular' | 'mask' | 'custom_emoji'
  thumbnail?: {
    file_id: string
    file_unique_id: string
    file_size: number
    width: number
    height: number
  }
  thumb?: {
    file_id: string
    file_unique_id: string
    file_size: number
    width: number
    height: number
  }
  file_id: string
  file_unique_id: string
  file_size: number
}

export interface TelegramStickerSet {
  name: string
  title: string
  is_animated: boolean
  is_video: boolean
  stickers: TelegramSticker[]
}

/**
 * Checks if a URL is a Telegram sticker set URL
 */
export const isTelegramStickerUrl = (url: string): boolean => {
  if (!url) return false
  return (
    url.startsWith('https://t.me/addstickers/') ||
    url.startsWith('https://telegram.me/addstickers/') ||
    url.startsWith('tg://addstickers?set=')
  )
}

/**
 * Extracts the sticker set name from a URL
 */
export const extractStickerSetName = (url: string): string | null => {
  if (!url) return null

  if (url.startsWith('https://t.me/addstickers/')) {
    return url.replace('https://t.me/addstickers/', '').split('?')[0].split('#')[0]
  }

  if (url.startsWith('https://telegram.me/addstickers/')) {
    return url.replace('https://telegram.me/addstickers/', '').split('?')[0].split('#')[0]
  }

  if (url.startsWith('tg://addstickers?set=')) {
    return url.replace('tg://addstickers?set=', '').split('&')[0]
  }

  // Also support plain set names (alphanumeric + underscore)
  if (/^[a-zA-Z0-9_]+$/.test(url)) {
    return url
  }

  return null
}

/**
 * Fetches information about a file from Telegram API
 */
export const getFile = async (fileId: string, botToken: string): Promise<TelegramFileInfo> => {
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`
    )
    const data = await response.json()

    // Handle 429 Too Many Requests
    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('Retry-After') || '60')
      const error: any = new Error(data.description || 'Too many requests')
      error.retryAfter = retryAfter
      error.code = 429
      throw error
    }

    if (data.ok) {
      return data.result
    } else {
      throw new Error(data.description || 'Failed to get file info')
    }
  } catch (error) {
    console.error('Error getting file info:', error)
    throw error
  }
}

/**
 * Gets a sticker set from Telegram API
 */
export const getStickerSet = async (
  name: string,
  botToken: string
): Promise<TelegramStickerSet> => {
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/getStickerSet?name=${name}`
    )
    const data = await response.json()

    // Handle 429 Too Many Requests
    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('Retry-After') || '60')
      const error: any = new Error(data.description || 'Too many requests')
      error.retryAfter = retryAfter
      error.code = 429
      throw error
    }

    if (data.ok) {
      return data.result
    } else {
      throw new Error(data.description || 'Failed to get sticker set')
    }
  } catch (error) {
    console.error('Error getting sticker set:', error)
    throw error
  }
}

/**
 * Creates a direct download URL for a file path
 * Note: Use the proxy if you need to bypass CORS
 */
export const createFileUrl = (filePath: string, botToken: string): string => {
  return `https://api.telegram.org/file/bot${botToken}/${filePath}`
}

/**
 * Creates a proxied download URL for a file path to avoid CORS issues
 */
export const createProxyUrl = (filePath: string, botToken: string): string => {
  return `https://api.telegram.org/file/bot${botToken}/${filePath}`
}

/**
 * Downloads a file from a URL and returns it as a Blob
 */
export const downloadFileAsBlob = async (url: string): Promise<Blob> => {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`)
  return await res.blob()
}

/**
 * Processes a list of Telegram sticker URLs/names and converts them to File objects
 * Skips WebM (video) stickers as requested
 */
export const processTelegramStickers = async (
  input: string,
  botToken: string,
  onProgress?: (processed: number, total: number, message: string) => void
): Promise<File[]> => {
  const setName = extractStickerSetName(input)
  if (!setName) {
    throw new Error('Invalid Telegram sticker set URL or name')
  }

  if (onProgress) onProgress(0, 0, 'Fetching sticker set info...')

  const stickerSet = await getStickerSet(setName, botToken)
  const stickers = stickerSet.stickers
  const total = stickers.length

  const resultFiles: File[] = []
  let processed = 0

  for (const sticker of stickers) {
    processed++

    // Skip video stickers (webm) or animated if needed
    // The requirement says "skip webm", which are usually video stickers or animated ones
    if (sticker.is_video) {
      if (onProgress)
        onProgress(processed, total, `Skipping video sticker ${processed}/${total}...`)
      continue
    }

    // For animated stickers (.tgs), they are Lottie JSON
    // For regular stickers, they are usually .webp
    // We'll prioritize static stickers or regular webp

    try {
      if (onProgress) onProgress(processed, total, `Processing sticker ${processed}/${total}...`)

      console.log(`[TelegramResolver] Getting file info for sticker ${sticker.file_id}`)
      const fileInfo = await getFile(sticker.file_id, botToken)
      console.log(`[TelegramResolver] File info:`, fileInfo)

      if (!fileInfo.file_path) {
        console.warn(`[TelegramResolver] No file_path for sticker ${sticker.file_id}`)
        continue
      }

      const extension = fileInfo.file_path.split('.').pop()?.toLowerCase() || ''
      console.log(`[TelegramResolver] File extension: ${extension}`)

      // Skip webm explicitly as requested
      if (extension === 'webm') {
        console.log(`[TelegramResolver] Skipping webm sticker`)
        continue
      }

      // Construct proxy URL to download
      const proxyUrl = createProxyUrl(fileInfo.file_path, botToken)
      console.log(`[TelegramResolver] Downloading from: ${proxyUrl}`)
      const blob = await downloadFileAsBlob(proxyUrl)
      console.log(`[TelegramResolver] Downloaded blob size: ${blob.size} bytes, type: ${blob.type}`)

      // Determine correct MIME type based on extension
      let mimeType = blob.type
      if (!mimeType || mimeType === 'application/octet-stream') {
        if (extension === 'webp') mimeType = 'image/webp'
        else if (extension === 'png') mimeType = 'image/png'
        else if (extension === 'jpg' || extension === 'jpeg') mimeType = 'image/jpeg'
        else if (extension === 'gif') mimeType = 'image/gif'
        else if (extension === 'tgs')
          mimeType = 'application/json' // Lottie animation
        else mimeType = 'image/webp' // default for stickers
      }

      // Create file object with correct MIME type
      const filename = `${sticker.file_id}.${extension}`
      const file = new File([blob], filename, { type: mimeType })
      console.log(`[TelegramResolver] Created file: ${filename}, type: ${mimeType}`)

      resultFiles.push(file)
    } catch (err) {
      console.error(`[TelegramResolver] Failed to process sticker ${sticker.file_id}:`, err)
    }
  }

  return resultFiles
}
