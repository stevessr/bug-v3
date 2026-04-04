import { localAvifService, type LocalAvifProgress } from '@/utils/avif/localAvifService'
import { convertWebmToAvifViaBackend } from '@/utils/webmToAvifBackend'
import { renderTgsToPngFrames } from '@/utils/telegram/tgsToFrames'

export interface TelegramStickerConversionSettings {
  localAvifEnabled: boolean
  backendEnabled: boolean
  backendUrl: string
  signal?: AbortSignal
}

export interface TelegramStickerConversionResult {
  blob: Blob
  extension: string
  mimeType: string
  mode: 'original' | 'local-animated-avif' | 'local-static-avif' | 'backend-avif'
  warning?: string
}

const normalizeMimeType = (extension: string, blob: Blob): string => {
  if (blob.type && blob.type !== 'application/octet-stream') return blob.type
  if (extension === 'webp') return 'image/webp'
  if (extension === 'png') return 'image/png'
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg'
  if (extension === 'gif') return 'image/gif'
  if (extension === 'avif') return 'image/avif'
  if (extension === 'tgs') return 'application/json'
  return 'image/webp'
}

const originalResult = (blob: Blob, extension: string): TelegramStickerConversionResult => ({
  blob,
  extension,
  mimeType: normalizeMimeType(extension, blob),
  mode: 'original'
})

export async function convertTelegramStickerBlob(
  blob: Blob,
  extension: string,
  settings: TelegramStickerConversionSettings,
  onProgress?: (event: LocalAvifProgress) => void
): Promise<TelegramStickerConversionResult> {
  if (extension === 'webm') {
    if (settings.localAvifEnabled) {
      try {
        const animated = await localAvifService.convertWebmToAnimatedAvif(blob, {
          signal: settings.signal,
          onProgress
        })
        return {
          blob: animated,
          extension: 'avif',
          mimeType: 'image/avif',
          mode: 'local-animated-avif'
        }
      } catch (localAnimatedError) {
        try {
          const staticAvif = await localAvifService.encodeStaticAvifFromVideoFirstFrame(blob, {
            signal: settings.signal
          })
          return {
            blob: staticAvif,
            extension: 'avif',
            mimeType: 'image/avif',
            mode: 'local-static-avif',
            warning: `本地动画 AVIF 转换失败，已降级为静态 AVIF：${(localAnimatedError as Error).message}`
          }
        } catch {
          // continue to backend fallback
        }
      }
    }

    if (settings.backendEnabled && settings.backendUrl.trim()) {
      const backendBlob = await convertWebmToAvifViaBackend(blob, {
        backendUrl: settings.backendUrl,
        signal: settings.signal
      })
      return {
        blob: backendBlob,
        extension: 'avif',
        mimeType: 'image/avif',
        mode: 'backend-avif'
      }
    }

    throw new Error('WebM 贴纸无法转换：本地 AVIF 与后端转换都不可用')
  }

  if (extension === 'tgs') {
    if (!settings.localAvifEnabled) {
      throw new Error('TGS 贴纸需要启用本地 AVIF 转换')
    }

    const rendered = await renderTgsToPngFrames(blob, {
      signal: settings.signal
    })

    try {
      const animated = await localAvifService.convertPngFramesToAnimatedAvif(rendered.frames, rendered.fps, {
        signal: settings.signal,
        onProgress
      })
      return {
        blob: animated,
        extension: 'avif',
        mimeType: 'image/avif',
        mode: 'local-animated-avif'
      }
    } catch (animatedError) {
      const firstFrame = rendered.frames[0]
      if (!firstFrame) {
        throw animatedError
      }
      const staticAvif = await localAvifService.encodeStaticAvifFromBlob(firstFrame, {
        signal: settings.signal
      })
      return {
        blob: staticAvif,
        extension: 'avif',
        mimeType: 'image/avif',
        mode: 'local-static-avif',
        warning: `本地 TGS 动画 AVIF 转换失败，已降级为静态 AVIF：${(animatedError as Error).message}`
      }
    }
  }

  return originalResult(blob, extension)
}
