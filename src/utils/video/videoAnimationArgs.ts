export type AnimationOutputFormat = 'gif' | 'apng' | 'webp' | 'avif'

export type GifPaletteProfile = 'high' | 'classic' | 'small'

export type VideoAnimationPresetId = 'emoji' | 'balanced' | 'hd' | 'compact' | 'original'

export interface VideoConvertProgress {
  percent: number
  stage: string
  message: string
}

export interface VideoConvertOptions {
  format: AnimationOutputFormat
  fps?: number
  maxWidth?: number
  maxHeight?: number
  quality?: number
  startTime?: number
  duration?: number
  loop?: number
  gifProfile?: GifPaletteProfile
  webpLossless?: boolean
  fileName?: string
  timeoutMs?: number
  signal?: AbortSignal
  onProgress?: (progress: VideoConvertProgress) => void
}

export const MAX_VIDEO_INPUT_BYTES = 150 * 1024 * 1024
export const MAX_URL_VIDEO_BYTES = 100 * 1024 * 1024

export const VIDEO_ANIMATION_PRESETS: Record<
  VideoAnimationPresetId,
  { label: string; fps: number; maxWidth: number; quality: number }
> = {
  emoji: { label: '表情包', fps: 12, maxWidth: 320, quality: 78 },
  balanced: { label: '均衡', fps: 10, maxWidth: 360, quality: 75 },
  hd: { label: '高清动图', fps: 15, maxWidth: 480, quality: 85 },
  compact: { label: '极简小体积', fps: 8, maxWidth: 240, quality: 65 },
  original: { label: '原尺寸', fps: 15, maxWidth: 0, quality: 80 }
}

const SUPPORTED_INPUT_EXTENSIONS = new Set(['mp4', 'webm', 'mov', 'mkv', 'm4v', 'ogv', 'gif'])

const MIME_TO_INPUT_EXT: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'video/x-matroska': 'mkv',
  'video/x-m4v': 'm4v',
  'video/ogg': 'ogv',
  'image/gif': 'gif'
}

const OUTPUT_FORMAT_META: Record<
  AnimationOutputFormat,
  { ext: string; mimeType: string; label: string }
> = {
  gif: { ext: 'gif', mimeType: 'image/gif', label: 'GIF' },
  apng: { ext: 'png', mimeType: 'image/apng', label: 'APNG (.png)' },
  webp: { ext: 'webp', mimeType: 'image/webp', label: 'WebP 动图' },
  avif: { ext: 'avif', mimeType: 'image/avif', label: 'AVIF 动图' }
}

export const clampFps = (fps?: number): number => {
  if (typeof fps !== 'number' || !Number.isFinite(fps)) return 12
  return Math.min(30, Math.max(1, Math.round(fps)))
}

export const clampQuality = (quality?: number): number => {
  if (typeof quality !== 'number' || !Number.isFinite(quality)) return 75
  return Math.min(100, Math.max(1, Math.round(quality)))
}

export const clampLoop = (loop?: number): number => {
  if (typeof loop !== 'number' || !Number.isFinite(loop) || loop < 0) return 0
  return Math.floor(loop)
}

const clampDimension = (value?: number): number => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return 0
  return Math.min(4096, Math.max(2, Math.round(value)))
}

export const formatTrimSeconds = (value?: number): string | null => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null
  const clamped = Math.min(86400, value)
  const rounded = Number(clamped.toFixed(3))
  if (rounded <= 0) return null
  return String(rounded)
}

export const buildVideoFilter = (options: {
  fps?: number
  maxWidth?: number
  maxHeight?: number
}): string => {
  const filters = [`fps=${clampFps(options.fps)}`]
  const width = clampDimension(options.maxWidth)
  const height = clampDimension(options.maxHeight)

  if (width > 0 && height > 0) {
    filters.push(
      `scale='min(${width},iw)':'min(${height},ih)':force_original_aspect_ratio=decrease:flags=lanczos`
    )
  } else if (width > 0) {
    filters.push(`scale='min(${width},iw)':-2:flags=lanczos`)
  } else if (height > 0) {
    filters.push(`scale=-2:'min(${height},ih)':flags=lanczos`)
  }

  return filters.join(',')
}

export const buildTrimInputArgs = (
  inputPath: string,
  startTime?: number,
  duration?: number
): string[] => {
  const args: string[] = []
  const start = formatTrimSeconds(startTime)
  if (start) {
    args.push('-ss', start)
  }
  const dur = formatTrimSeconds(duration)
  if (dur) {
    args.push('-t', dur)
  }
  args.push('-i', inputPath)
  return args
}

const GIF_PROFILE_FILTERS: Record<GifPaletteProfile, { palettegen: string; paletteuse: string }> = {
  high: {
    palettegen: 'palettegen=stats_mode=full:reserve_transparent=1',
    paletteuse: 'paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle'
  },
  classic: {
    palettegen: 'palettegen=stats_mode=full:reserve_transparent=1',
    paletteuse: 'paletteuse=dither=floyd_steinberg:diff_mode=rectangle'
  },
  small: {
    palettegen: 'palettegen=max_colors=64:stats_mode=full:reserve_transparent=1',
    paletteuse: 'paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle'
  }
}

export const buildGifTwoPassArgs = (
  inputPath: string,
  palettePath: string,
  outputPath: string,
  options: Omit<VideoConvertOptions, 'format'> = {}
): { pass1: string[]; pass2: string[] } => {
  const trimArgs = buildTrimInputArgs(inputPath, options.startTime, options.duration)
  const vf = buildVideoFilter(options)
  const profile =
    (options.gifProfile ? GIF_PROFILE_FILTERS[options.gifProfile] : undefined) ??
    GIF_PROFILE_FILTERS.high

  return {
    pass1: [
      ...trimArgs,
      '-an',
      '-sn',
      '-dn',
      '-vf',
      `${vf},${profile.palettegen}`,
      '-y',
      palettePath
    ],
    pass2: [
      ...trimArgs,
      '-i',
      palettePath,
      '-filter_complex',
      `[0:v]${vf}[x];[x][1:v]${profile.paletteuse}`,
      '-an',
      '-sn',
      '-dn',
      '-loop',
      String(clampLoop(options.loop)),
      '-f',
      'gif',
      '-y',
      outputPath
    ]
  }
}

export const buildApngArgs = (
  inputPath: string,
  outputPath: string,
  options: Omit<VideoConvertOptions, 'format'> = {}
): string[] => {
  const trimArgs = buildTrimInputArgs(inputPath, options.startTime, options.duration)
  const vf = buildVideoFilter(options)
  return [
    ...trimArgs,
    '-vf',
    vf,
    '-an',
    '-sn',
    '-dn',
    '-plays',
    String(clampLoop(options.loop)),
    '-pred',
    'mixed',
    '-f',
    'apng',
    '-y',
    outputPath
  ]
}

export const buildWebpArgs = (
  inputPath: string,
  outputPath: string,
  options: Omit<VideoConvertOptions, 'format'> = {}
): string[] => {
  const trimArgs = buildTrimInputArgs(inputPath, options.startTime, options.duration)
  const vf = buildVideoFilter(options)
  return [
    ...trimArgs,
    '-vf',
    vf,
    '-c:v',
    'libwebp_anim',
    '-loop',
    String(clampLoop(options.loop)),
    '-lossless',
    options.webpLossless ? '1' : '0',
    '-q:v',
    String(clampQuality(options.quality)),
    '-compression_level',
    '4',
    '-preset',
    'default',
    '-an',
    '-sn',
    '-dn',
    '-f',
    'webp',
    '-y',
    outputPath
  ]
}

export const getOutputFormatMeta = (format: AnimationOutputFormat) => OUTPUT_FORMAT_META[format]

const stripControlChars = (value: string): string => {
  let result = ''
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i)
    if (code >= 32 && code !== 127) {
      result += value[i]
    }
  }
  return result
}

export const resolveAnimationFileName = (
  inputName: string | undefined,
  format: AnimationOutputFormat
): string => {
  const meta = getOutputFormatMeta(format)
  const raw = stripControlChars(inputName || 'animation')
    .split(/[/\\]/)
    .pop()
    ?.trim()
  const baseName =
    (raw || '')
      .replace(/\.[^/.]+$/, '')
      .replace(/^\.+/, '')
      .trim() || 'animation'
  return `${baseName}.${meta.ext}`
}

export const isGifInput = (fileName?: string, mimeType?: string): boolean => {
  const cleanMime = mimeType?.split(';')[0]?.trim().toLowerCase()
  if (cleanMime === 'image/gif') return true
  const ext = fileName?.trim().split('.').pop()?.toLowerCase()
  return ext === 'gif'
}

export const validateAnimationOutputMagic = (
  bytes: Uint8Array,
  format: AnimationOutputFormat
): boolean => {
  if (!(bytes instanceof Uint8Array)) return false
  switch (format) {
    case 'gif': {
      if (bytes.byteLength < 6) return false
      const header = String.fromCharCode(...bytes.subarray(0, 6))
      return header === 'GIF87a' || header === 'GIF89a'
    }
    case 'apng': {
      if (bytes.byteLength < 8) return false
      const pngSig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
      return pngSig.every((byte, idx) => bytes[idx] === byte)
    }
    case 'webp': {
      if (bytes.byteLength < 12) return false
      const riff = String.fromCharCode(...bytes.subarray(0, 4))
      const webp = String.fromCharCode(...bytes.subarray(8, 12))
      return riff === 'RIFF' && webp === 'WEBP'
    }
    case 'avif': {
      if (bytes.byteLength < 12) return false
      const ftyp = String.fromCharCode(...bytes.subarray(4, 8))
      return ftyp === 'ftyp'
    }
    default:
      return false
  }
}

export const resolveInputExtension = (fileName?: string, mimeType?: string): string => {
  const ext = fileName?.split('.').pop()?.toLowerCase()
  if (ext && SUPPORTED_INPUT_EXTENSIONS.has(ext)) {
    return ext
  }
  if (mimeType) {
    const cleanMime = mimeType.split(';')[0]?.trim().toLowerCase()
    if (cleanMime && MIME_TO_INPUT_EXT[cleanMime]) {
      return MIME_TO_INPUT_EXT[cleanMime]
    }
  }
  return 'mp4'
}
