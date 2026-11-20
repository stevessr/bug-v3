import {
  VIDEO_ANIMATION_PRESETS,
  type AnimationOutputFormat,
  type GifPaletteProfile,
  type VideoAnimationPresetId
} from './videoAnimationArgs.ts'

/**
 * Persisted "video → animation" conversion parameters. Shared by the options page
 * (BufferPage → 视频转动图) and the in-page injected uploader, which auto-converts
 * selected videos with exactly these parameters.
 */
export const VIDEO_CONVERT_SETTINGS_KEY = 'videoAnimationSettings'

export interface VideoConvertSettings {
  format: AnimationOutputFormat
  preset: VideoAnimationPresetId | 'custom'
  /** 0 = keep the source frame rate */
  fps: number
  /** 0 = keep the source size */
  maxWidth: number
  quality: number
  gifProfile: GifPaletteProfile
  webpLossless: boolean
  /** Auto-convert videos picked in the injected (forum page) uploader. */
  autoConvertOnUpload: boolean
}

const FORMATS: AnimationOutputFormat[] = ['gif', 'apng', 'webp', 'avif']
const GIF_PROFILES: GifPaletteProfile[] = ['high', 'classic', 'small']

export const DEFAULT_VIDEO_CONVERT_SETTINGS: VideoConvertSettings = {
  format: 'gif',
  preset: 'emoji',
  fps: VIDEO_ANIMATION_PRESETS.emoji.fps,
  maxWidth: VIDEO_ANIMATION_PRESETS.emoji.maxWidth,
  quality: VIDEO_ANIMATION_PRESETS.emoji.quality,
  gifProfile: 'high',
  webpLossless: false,
  autoConvertOnUpload: true
}

const finiteNumber = (value: unknown, fallback: number, min: number, max: number): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, Math.round(value)))
}

/** Validate untrusted/stale stored data; never throws, always returns a usable object. */
export const normalizeVideoConvertSettings = (raw: unknown): VideoConvertSettings => {
  const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const defaults = DEFAULT_VIDEO_CONVERT_SETTINGS
  const preset =
    source.preset === 'custom' ||
    (typeof source.preset === 'string' && source.preset in VIDEO_ANIMATION_PRESETS)
      ? (source.preset as VideoConvertSettings['preset'])
      : defaults.preset

  return {
    format: FORMATS.includes(source.format as AnimationOutputFormat)
      ? (source.format as AnimationOutputFormat)
      : defaults.format,
    preset,
    fps: finiteNumber(source.fps, defaults.fps, 0, 30),
    maxWidth: finiteNumber(source.maxWidth, defaults.maxWidth, 0, 4096),
    quality: finiteNumber(source.quality, defaults.quality, 1, 100),
    gifProfile: GIF_PROFILES.includes(source.gifProfile as GifPaletteProfile)
      ? (source.gifProfile as GifPaletteProfile)
      : defaults.gifProfile,
    webpLossless:
      typeof source.webpLossless === 'boolean' ? source.webpLossless : defaults.webpLossless,
    autoConvertOnUpload:
      typeof source.autoConvertOnUpload === 'boolean'
        ? source.autoConvertOnUpload
        : defaults.autoConvertOnUpload
  }
}

const getExtensionStorage = (): chrome.storage.LocalStorageArea | null => {
  try {
    const area = (globalThis as { chrome?: typeof chrome }).chrome?.storage?.local
    return area ?? null
  } catch {
    return null
  }
}

export async function loadVideoConvertSettings(): Promise<VideoConvertSettings> {
  try {
    const area = getExtensionStorage()
    if (area) {
      const result = await area.get({ [VIDEO_CONVERT_SETTINGS_KEY]: null })
      return normalizeVideoConvertSettings(result[VIDEO_CONVERT_SETTINGS_KEY])
    }
    if (typeof localStorage !== 'undefined') {
      const text = localStorage.getItem(VIDEO_CONVERT_SETTINGS_KEY)
      return normalizeVideoConvertSettings(text ? JSON.parse(text) : null)
    }
  } catch {
    // Corrupt/unavailable storage must never block conversion; fall through to defaults.
  }
  return { ...DEFAULT_VIDEO_CONVERT_SETTINGS }
}

export async function saveVideoConvertSettings(
  settings: VideoConvertSettings
): Promise<VideoConvertSettings> {
  const normalized = normalizeVideoConvertSettings(settings)
  try {
    const area = getExtensionStorage()
    if (area) {
      await area.set({ [VIDEO_CONVERT_SETTINGS_KEY]: normalized })
    } else if (typeof localStorage !== 'undefined') {
      localStorage.setItem(VIDEO_CONVERT_SETTINGS_KEY, JSON.stringify(normalized))
    }
  } catch (error) {
    console.warn('[VideoConvertSettings] Failed to persist settings:', error)
  }
  return normalized
}
