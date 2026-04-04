import { localAvifService, type LocalAvifProgress } from '@/utils/avif/localAvifService'
import { renderTgsToPngFrames } from '@/utils/telegram/tgsToFrames'
import { convertWebmToAvifViaBackend } from '@/utils/webmToAvifBackend'

export interface TelegramStickerConversionSettings {
  localAvifEnabled: boolean
  backendEnabled: boolean
  backendUrl: string
  signal?: AbortSignal
  animatedTimeoutMs?: number
}

export interface TelegramStickerConversionResult {
  blob: Blob
  extension: string
  mimeType: string
  mode: 'original' | 'local-animated-avif' | 'local-static-avif' | 'backend-avif'
  warning?: string
}

export const TELEGRAM_STAGE_HINTS = {
  download: '正在从 Telegram 拉取源文件...',
  localAnimated: '正在本地编码动画 AVIF，这一步主要消耗本地 CPU，网络面板可能不会继续变化。',
  localStatic: '正在本地编码静态 AVIF...',
  backend: '正在请求后端转换 AVIF...',
  upload: '正在上传到图床，若长时间无响应通常是图床接口等待或限流。'
} as const

export const TELEGRAM_DEFAULT_ANIMATED_TIMEOUT_MS = 45000

const modeLabelMap: Record<TelegramStickerConversionResult['mode'], string> = {
  original: '原始格式',
  'local-animated-avif': '本地动画 AVIF',
  'local-static-avif': '本地静态 AVIF',
  'backend-avif': '后端 AVIF'
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

const getAnimatedTimeoutMs = (timeoutMs?: number) =>
  timeoutMs && timeoutMs > 0 ? timeoutMs : TELEGRAM_DEFAULT_ANIMATED_TIMEOUT_MS

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | null = null
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), timeoutMs)
      })
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export const getTelegramStickerConversionModeLabel = (
  mode: TelegramStickerConversionResult['mode']
): string => modeLabelMap[mode]

export const describeTelegramStickerConversionResult = (
  result: TelegramStickerConversionResult
): string => `${getTelegramStickerConversionModeLabel(result.mode)} · ${result.extension.toUpperCase()} · ${(result.blob.size / 1024).toFixed(1)} KB`

export const getTelegramStickerErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error)

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
  const animatedTimeoutMs = getAnimatedTimeoutMs(settings.animatedTimeoutMs)

  if (extension === 'webm') {
    if (settings.localAvifEnabled) {
      try {
        onProgress?.({ message: TELEGRAM_STAGE_HINTS.localAnimated })
        const animated = await withTimeout(
          localAvifService.convertWebmToAnimatedAvif(blob, {
            signal: settings.signal,
            onProgress
          }),
          animatedTimeoutMs,
          `WEBM 本地动画转换超时（>${Math.round(animatedTimeoutMs / 1000)} 秒）`
        )
        return {
          blob: animated,
          extension: 'avif',
          mimeType: 'image/avif',
          mode: 'local-animated-avif'
        }
      } catch (localAnimatedError) {
        try {
          onProgress?.({ message: TELEGRAM_STAGE_HINTS.localStatic })
          const staticAvif = await localAvifService.encodeStaticAvifFromVideoFirstFrame(blob, {
            signal: settings.signal
          })
          return {
            blob: staticAvif,
            extension: 'avif',
            mimeType: 'image/avif',
            mode: 'local-static-avif',
            warning: `本地动画 AVIF 转换失败，已降级为静态 AVIF：${getTelegramStickerErrorMessage(localAnimatedError)}`
          }
        } catch {
          // continue to backend fallback
        }
      }
    }

    if (settings.backendEnabled && settings.backendUrl.trim()) {
      onProgress?.({ message: TELEGRAM_STAGE_HINTS.backend })
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
      onProgress?.({ message: TELEGRAM_STAGE_HINTS.localAnimated })
      const animated = await withTimeout(
        localAvifService.convertPngFramesToAnimatedAvif(rendered.frames, rendered.fps, {
          signal: settings.signal,
          onProgress
        }),
        animatedTimeoutMs,
        `TGS 本地动画转换超时（>${Math.round(animatedTimeoutMs / 1000)} 秒）`
      )
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
      onProgress?.({ message: TELEGRAM_STAGE_HINTS.localStatic })
      const staticAvif = await localAvifService.encodeStaticAvifFromBlob(firstFrame, {
        signal: settings.signal
      })
      return {
        blob: staticAvif,
        extension: 'avif',
        mimeType: 'image/avif',
        mode: 'local-static-avif',
        warning: `本地 TGS 动画 AVIF 转换失败，已降级为静态 AVIF：${getTelegramStickerErrorMessage(animatedError)}`
      }
    }
  }

  return originalResult(blob, extension)
}
