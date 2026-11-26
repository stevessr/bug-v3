import { fetchFile } from '@ffmpeg/util'

import {
  buildApngArgs,
  buildGifTwoPassArgs,
  buildTrimInputArgs,
  buildVideoFilter,
  buildWebpArgs,
  clampFps,
  clampQuality,
  getOutputFormatMeta,
  isGifInput,
  MAX_URL_VIDEO_BYTES,
  MAX_VIDEO_INPUT_BYTES,
  resolveAnimationFileName,
  resolveInputExtension,
  validateAnimationOutputMagic,
  VIDEO_ANIMATION_PRESETS,
  type AnimationOutputFormat,
  type GifPaletteProfile,
  type VideoAnimationPresetId,
  type VideoConvertOptions,
  type VideoConvertProgress
} from './videoAnimationArgs'

import { localAvifService } from '@/utils/avif/localAvifService'
import {
  convertWebmInBrowser,
  createAv1Ivf,
  extractAvifSample
} from '@/utils/telegram/nativeWebmConversion'

export {
  getOutputFormatMeta,
  isGifInput,
  MAX_URL_VIDEO_BYTES,
  MAX_VIDEO_INPUT_BYTES,
  resolveAnimationFileName,
  resolveInputExtension,
  validateAnimationOutputMagic,
  VIDEO_ANIMATION_PRESETS,
  type AnimationOutputFormat,
  type GifPaletteProfile,
  type VideoAnimationPresetId,
  type VideoConvertOptions,
  type VideoConvertProgress
}

export interface VideoMetadata {
  width: number
  height: number
  duration: number
  size: number
}

export interface VideoConvertResult {
  blob: Blob
  file: File
  fileName: string
  mimeType: string
  format: AnimationOutputFormat
  width: number
  height: number
  size: number
  inputSize: number
  warning?: string
}

const DEFAULT_FFMPEG_TIMEOUT_MS = 180000
const DEFAULT_METADATA_TIMEOUT_MS = 15000
const DEFAULT_FETCH_TIMEOUT_MS = 60000
const MAX_ANIMATED_AVIF_FRAMES = 300
const INVALID_URL_MIME_TYPES = new Set([
  'text/html',
  'text/plain',
  'application/json',
  'application/xml',
  'text/xml'
])

const createJobId = () => `vid_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`

const safeReportProgress = (
  options: Pick<VideoConvertOptions, 'onProgress'>,
  progress: VideoConvertProgress
) => {
  try {
    options.onProgress?.(progress)
  } catch {
    // ignore progress callback errors
  }
}

const pickRelevantLog = (logs: string[]): string => {
  for (let i = logs.length - 1; i >= 0; i--) {
    const line = logs[i]
    if (/error|invalid|failed|unable|could not|no such|not found|unsupported/i.test(line)) {
      return line
    }
  }
  return logs[logs.length - 1] || ''
}

const createDeadlineController = (
  callerSignal: AbortSignal | undefined,
  timeoutMs: number,
  timeoutMessage: string
) => {
  const controller = new AbortController()
  const onAbort = () =>
    controller.abort(callerSignal?.reason ?? new DOMException('Operation aborted', 'AbortError'))

  if (callerSignal?.aborted) {
    onAbort()
  } else {
    callerSignal?.addEventListener('abort', onAbort, { once: true })
  }

  const timer = setTimeout(() => {
    controller.abort(new Error(timeoutMessage))
  }, timeoutMs)

  return {
    signal: controller.signal,
    dispose: () => {
      clearTimeout(timer)
      callerSignal?.removeEventListener('abort', onAbort)
    }
  }
}

async function probeImageDimensions(
  blob: Blob,
  timeoutMs = 10000
): Promise<{ width: number; height: number }> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(blob)
      try {
        return { width: bitmap.width, height: bitmap.height }
      } finally {
        bitmap.close()
      }
    } catch {
      // Fallback to <img> element below if ImageBitmap rejects animated container.
    }
  }

  if (typeof Image === 'undefined') {
    return { width: 0, height: 0 }
  }

  const url = URL.createObjectURL(blob)
  try {
    return await new Promise<{ width: number; height: number }>(resolve => {
      const img = new Image()
      let settled = false
      const timer = setTimeout(() => {
        finish({ width: 0, height: 0 })
      }, timeoutMs)

      const finish = (dims: { width: number; height: number }) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        img.onload = null
        img.onerror = null
        resolve(dims)
      }

      img.onload = () =>
        finish({ width: img.naturalWidth || img.width, height: img.naturalHeight || img.height })
      img.onerror = () => finish({ width: 0, height: 0 })
      img.src = url
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}

async function probeGifDurationSeconds(blob: Blob): Promise<number> {
  const ImageDecoderCtor = (globalThis as Record<string, any>).ImageDecoder
  if (typeof ImageDecoderCtor !== 'function') return 0

  let decoder: any = null
  try {
    const buffer = await blob.arrayBuffer()
    decoder = new ImageDecoderCtor({ data: buffer, type: 'image/gif' })
    await decoder.tracks.ready
    const track = decoder.tracks.selectedTrack
    const frameCount = Math.min(Number(track?.frameCount || 0), MAX_ANIMATED_AVIF_FRAMES)
    if (!Number.isFinite(frameCount) || frameCount <= 0) return 0

    let totalUs = 0
    for (let i = 0; i < frameCount; i++) {
      const { image } = await decoder.decode({ frameIndex: i })
      try {
        if (typeof image.duration === 'number' && image.duration > 0) {
          totalUs += image.duration
        }
      } finally {
        image.close()
      }
    }
    return totalUs > 0 ? totalUs / 1_000_000 : 0
  } catch {
    return 0
  } finally {
    try {
      decoder?.close()
    } catch {
      // ignore close errors
    }
  }
}

export async function probeVideoMetadata(
  source: Blob | File,
  options: { signal?: AbortSignal; timeoutMs?: number } = {}
): Promise<VideoMetadata> {
  options.signal?.throwIfAborted()

  const sourceName = source instanceof File ? source.name : undefined
  if (isGifInput(sourceName, source.type)) {
    const [dims, duration] = await Promise.all([
      probeImageDimensions(source),
      probeGifDurationSeconds(source)
    ])
    options.signal?.throwIfAborted()
    if (dims.width <= 0 || dims.height <= 0) {
      throw new Error('无法读取 GIF 尺寸，请确认文件格式有效')
    }
    return {
      width: dims.width,
      height: dims.height,
      duration,
      size: source.size
    }
  }

  const url = URL.createObjectURL(source)
  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.preload = 'metadata'
  const timeoutMs = options.timeoutMs ?? DEFAULT_METADATA_TIMEOUT_MS

  try {
    return await new Promise<VideoMetadata>((resolve, reject) => {
      let settled = false
      const cleanup = () => {
        clearTimeout(timer)
        video.onloadedmetadata = null
        video.onerror = null
        options.signal?.removeEventListener('abort', onAbort)
      }
      const onAbort = () => {
        if (settled) return
        settled = true
        cleanup()
        reject(options.signal?.reason ?? new DOMException('已取消读取视频元数据', 'AbortError'))
      }
      const timer = setTimeout(() => {
        if (settled) return
        settled = true
        cleanup()
        reject(new Error('读取视频元数据超时，请确认视频格式有效'))
      }, timeoutMs)

      video.onloadedmetadata = () => {
        if (settled) return
        settled = true
        cleanup()
        resolve({
          width: video.videoWidth || 0,
          height: video.videoHeight || 0,
          duration: Number.isFinite(video.duration) ? video.duration : 0,
          size: source.size
        })
      }
      video.onerror = () => {
        if (settled) return
        settled = true
        cleanup()
        reject(new Error('无法读取视频元数据，请确认视频格式有效'))
      }

      if (options.signal?.aborted) {
        onAbort()
        return
      }
      options.signal?.addEventListener('abort', onAbort, { once: true })
      video.src = url
    })
  } finally {
    video.removeAttribute('src')
    video.load()
    URL.revokeObjectURL(url)
  }
}

export async function fetchVideoFromUrl(
  url: string,
  signalOrOptions?:
    | AbortSignal
    | {
        signal?: AbortSignal
        timeoutMs?: number
        maxBytes?: number
      }
): Promise<File> {
  let parsed: URL
  try {
    parsed = new URL(url.trim())
  } catch {
    throw new Error('请输入有效的视频链接')
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('仅支持 http 或 https 视频链接')
  }

  const opts =
    signalOrOptions && 'aborted' in signalOrOptions
      ? { signal: signalOrOptions }
      : (signalOrOptions ?? {})
  const callerSignal = opts.signal
  const timeoutMs = opts.timeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS
  const maxBytes = opts.maxBytes ?? MAX_URL_VIDEO_BYTES
  const maxMb = Math.round(maxBytes / 1024 / 1024)

  callerSignal?.throwIfAborted()
  const deadline = createDeadlineController(
    callerSignal,
    timeoutMs,
    `下载视频链接超时（${Math.round(timeoutMs / 1000)}秒）`
  )

  try {
    let response: Response
    try {
      response = await fetch(parsed.href, { signal: deadline.signal })
    } catch (error) {
      if (deadline.signal.aborted) {
        throw deadline.signal.reason
      }
      if (error instanceof TypeError) {
        throw new Error('无法下载视频链接（可能受跨域 CORS 限制或网络不可用）')
      }
      throw error
    }

    if (response.type === 'opaque') {
      throw new Error('视频链接返回 opaque 响应（跨域受限），无法读取内容')
    }
    if (!response.ok) {
      throw new Error(`下载视频失败（HTTP ${response.status}）`)
    }

    const contentType =
      response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() || ''
    if (INVALID_URL_MIME_TYPES.has(contentType)) {
      throw new Error(`链接返回的不是视频文件（实际类型：${contentType}），请提供视频直链`)
    }

    const contentLengthRaw = response.headers.get('content-length')
    if (contentLengthRaw) {
      const contentLength = Number(contentLengthRaw)
      if (Number.isFinite(contentLength) && contentLength > maxBytes) {
        throw new Error(`远程视频超过 ${maxMb} MB 大小限制`)
      }
    }

    let blob: Blob
    if (response.body) {
      const reader = response.body.getReader()
      const chunks: Uint8Array<ArrayBuffer>[] = []
      let totalBytes = 0
      try {
        while (true) {
          deadline.signal.throwIfAborted()
          const { done, value } = await reader.read()
          if (done) break
          if (!value || value.byteLength === 0) continue
          totalBytes += value.byteLength
          if (totalBytes > maxBytes) {
            const limitError = new Error(`远程视频超过 ${maxMb} MB 大小限制`)
            await reader.cancel(limitError).catch(() => undefined)
            throw limitError
          }
          chunks.push(new Uint8Array(value))
        }
      } finally {
        reader.releaseLock()
      }
      blob = new Blob(chunks, { type: contentType || 'video/mp4' })
    } else {
      blob = await response.blob()
      if (blob.size > maxBytes) {
        throw new Error(`远程视频超过 ${maxMb} MB 大小限制`)
      }
    }

    if (blob.size === 0) {
      throw new Error('下载的视频内容为空')
    }

    const rawPathSegment = parsed.pathname.split('/').pop() || ''
    let decodedSegment = rawPathSegment
    try {
      decodedSegment = decodeURIComponent(rawPathSegment)
    } catch {
      decodedSegment = rawPathSegment
    }
    const baseSegment = decodedSegment.split('?')[0]?.split('#')[0]?.trim() || 'video'
    const mimeType = contentType || blob.type || 'video/mp4'
    const ext = resolveInputExtension(baseSegment, mimeType)
    const fileName = /\.[a-z0-9]+$/i.test(baseSegment) ? baseSegment : `${baseSegment}.${ext}`
    return new File([blob], fileName, { type: mimeType })
  } finally {
    deadline.dispose()
  }
}

async function encodeAnimatedAvifViaFfmpeg(
  input: File | Blob,
  options: VideoConvertOptions,
  inExt: string,
  jobSignal: AbortSignal
): Promise<{ blob: Blob; warning?: string }> {
  // fps === 0 → detect the source frame rate via FFmpeg and keep it (capped at 30).
  let fps = options.fps === 0 ? 30 : clampFps(options.fps)
  const keepSourceFps = options.fps === 0
  const timeoutMs = options.timeoutMs ?? DEFAULT_FFMPEG_TIMEOUT_MS
  const boundedDuration = Math.min(options.duration ?? 15, 15)
  const jobId = createJobId()
  const inputPath = `${jobId}-in.${inExt}`
  const framePattern = `${jobId}-f_%04d.png`

  safeReportProgress(options, {
    percent: 8,
    stage: 'avif',
    message: '正在使用 FFmpeg 解码并提取帧序列...'
  })

  const extractedBlobs = await localAvifService.runExclusiveFfmpegJob(
    async ffmpeg => {
      const lastLogs: string[] = []
      const onFfmpegLog = ({ message }: { message: string }) => {
        const trimmed = message?.trim()
        if (!trimmed) return
        lastLogs.push(trimmed)
        if (lastLogs.length > 15) lastLogs.shift()
      }
      const safeDelete = async (path: string) => {
        try {
          await ffmpeg.deleteFile(path)
        } catch {
          // ignore cleanup errors
        }
      }

      ffmpeg.on('log', onFfmpegLog)
      const createdFrameNames: string[] = []

      try {
        jobSignal.throwIfAborted()
        await ffmpeg.writeFile(inputPath, await fetchFile(input), { signal: jobSignal })
        if (keepSourceFps) {
          // `ffmpeg -i file` exits non-zero but logs the stream info including "NN fps".
          lastLogs.length = 0
          await ffmpeg.exec(['-hide_banner', '-i', inputPath], 15000, { signal: jobSignal })
          const match = lastLogs.join('\n').match(/,\s*(\d+(?:\.\d+)?)\s*fps/)
          const detected = match ? Number(match[1]) : NaN
          if (Number.isFinite(detected) && detected > 0) {
            fps = clampFps(Math.min(30, detected))
          }
          lastLogs.length = 0
        }
        const trimArgs = buildTrimInputArgs(inputPath, options.startTime, boundedDuration)
        const vf = buildVideoFilter({
          fps,
          maxWidth: options.maxWidth,
          maxHeight: options.maxHeight
        })
        const extractArgs = [
          ...trimArgs,
          '-vf',
          vf,
          '-an',
          '-sn',
          '-dn',
          '-frames:v',
          String(MAX_ANIMATED_AVIF_FRAMES),
          '-f',
          'image2',
          '-y',
          framePattern
        ]
        jobSignal.throwIfAborted()
        const exitCode = await ffmpeg.exec(extractArgs, timeoutMs, { signal: jobSignal })
        if (exitCode !== 0) {
          const detail = pickRelevantLog(lastLogs)
          throw new Error(
            detail
              ? `FFmpeg 提帧失败（退出码 ${exitCode}）：${detail}`
              : `FFmpeg 提帧失败（退出码 ${exitCode}）`
          )
        }

        const dirEntries = await ffmpeg.listDir('.')
        const frameFiles = dirEntries
          .filter(
            entry =>
              !entry.isDir && entry.name.startsWith(`${jobId}-f_`) && entry.name.endsWith('.png')
          )
          .map(entry => entry.name)
          .sort()

        if (frameFiles.length === 0) {
          throw new Error('未能从输入文件提取出任何视频帧')
        }
        createdFrameNames.push(...frameFiles)

        const blobs: Blob[] = []
        for (const frameName of frameFiles) {
          jobSignal.throwIfAborted()
          const raw = await ffmpeg.readFile(frameName, undefined, { signal: jobSignal })
          if (raw instanceof Uint8Array && raw.byteLength > 0) {
            const copy = new Uint8Array(raw.byteLength)
            copy.set(raw)
            blobs.push(new Blob([copy], { type: 'image/png' }))
          }
        }
        if (blobs.length === 0) {
          throw new Error('提取的视频帧为空')
        }
        return blobs
      } finally {
        ffmpeg.off('log', onFfmpegLog)
        if (!jobSignal.aborted) {
          await safeDelete(inputPath)
          await Promise.all(createdFrameNames.map(name => safeDelete(name)))
        }
      }
    },
    { signal: jobSignal }
  )

  jobSignal.throwIfAborted()
  const { encodeAvif, stripAlphaChannel } = await import('@/utils/avif/avifEncoder')
  const encodeQuality = clampQuality(options.quality)
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d', { alpha: true, willReadFrequently: true })
  if (!context) {
    throw new Error('浏览器不支持 Canvas 2D')
  }

  const encodedFrames: { bytes: Uint8Array; durationMs: number }[] = []
  let hasTransparency = false
  let frameWidth = 0
  let frameHeight = 0

  const decodeFrameToPixels = async (blob: Blob, isFirst: boolean): Promise<ImageData> => {
    const bitmap = await createImageBitmap(blob)
    try {
      if (isFirst) {
        frameWidth = Math.max(1, bitmap.width)
        frameHeight = Math.max(1, bitmap.height)
        canvas.width = frameWidth
        canvas.height = frameHeight
      }
      context.clearRect(0, 0, canvas.width, canvas.height)
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    } finally {
      bitmap.close()
    }

    const pixels = context.getImageData(0, 0, canvas.width, canvas.height)
    if (stripAlphaChannel(pixels)) {
      hasTransparency = true
    }
    return pixels
  }

  let nextPixelsPromise: Promise<ImageData> | null =
    extractedBlobs.length > 0 ? decodeFrameToPixels(extractedBlobs[0], true) : null

  for (let i = 0; i < extractedBlobs.length; i++) {
    jobSignal.throwIfAborted()
    if (!nextPixelsPromise) break
    const pixels = await nextPixelsPromise
    // Overlap decoding the next PNG frame while the AVIF worker encodes the current frame.
    nextPixelsPromise =
      i + 1 < extractedBlobs.length ? decodeFrameToPixels(extractedBlobs[i + 1], false) : null

    const encoded = new Uint8Array(
      await encodeAvif(pixels, { quality: encodeQuality, speed: 8 }, jobSignal)
    )
    encodedFrames.push({
      bytes: extractAvifSample(encoded),
      durationMs: Math.round(1000 / fps)
    })

    const percent = Math.round(35 + ((i + 1) / extractedBlobs.length) * 50)
    safeReportProgress(options, {
      percent,
      stage: 'avif',
      message: `浏览器内动画 AVIF 编码 ${i + 1}/${extractedBlobs.length}...`
    })
  }

  jobSignal.throwIfAborted()
  safeReportProgress(options, {
    percent: 90,
    stage: 'avif',
    message: '正在封装动画 AVIF 容器...'
  })

  const avifBlob = await localAvifService.muxAv1ToAnimatedAvif(
    createAv1Ivf(encodedFrames, frameWidth, frameHeight),
    {
      signal: jobSignal,
      timeoutMs,
      onProgress: event =>
        safeReportProgress(options, { percent: 94, stage: 'avif', message: event.message })
    }
  )

  return {
    blob: avifBlob,
    warning: hasTransparency
      ? '动画 AVIF 暂不保留透明通道；需要透明背景请选择 APNG 或动画 WebP'
      : undefined
  }
}

export async function convertVideoToAnimation(
  input: File | Blob,
  options: VideoConvertOptions
): Promise<VideoConvertResult> {
  options.signal?.throwIfAborted()

  if (!input || input.size <= 0) {
    throw new Error('输入视频文件为空')
  }
  if (input.size > MAX_VIDEO_INPUT_BYTES) {
    throw new Error(
      `视频文件过大（最大支持 ${Math.round(MAX_VIDEO_INPUT_BYTES / 1024 / 1024)} MB）`
    )
  }
  if (
    options.startTime !== undefined &&
    (!Number.isFinite(options.startTime) || options.startTime < 0)
  ) {
    throw new Error('起始时间必须为大于等于 0 的有效数字')
  }
  if (
    options.duration !== undefined &&
    (!Number.isFinite(options.duration) || options.duration <= 0)
  ) {
    throw new Error('裁剪时长必须大于 0 秒')
  }

  const inputName = input instanceof File ? input.name : options.fileName
  const inExt = resolveInputExtension(inputName, input.type)
  const outputName = resolveAnimationFileName(options.fileName || inputName, options.format)
  const meta = getOutputFormatMeta(options.format)
  const timeoutMs = options.timeoutMs ?? DEFAULT_FFMPEG_TIMEOUT_MS

  if (options.format === 'avif') {
    safeReportProgress(options, {
      percent: 5,
      stage: 'avif',
      message: '正在提取视频帧并编码 AVIF...'
    })

    const avifDeadline = createDeadlineController(
      options.signal,
      timeoutMs + 5000,
      'AVIF 转换超时，请尝试缩短裁剪时长或降低分辨率'
    )
    try {
      let converted: { blob: Blob; warning?: string }
      if (isGifInput(inputName, input.type) || options.fps === 0) {
        converted = await encodeAnimatedAvifViaFfmpeg(input, options, inExt, avifDeadline.signal)
      } else {
        try {
          converted = await convertWebmInBrowser(input, 'animated-avif', {
            fps: options.fps,
            maxWidth: options.maxWidth,
            startTime: options.startTime,
            duration: options.duration,
            quality: options.quality,
            signal: avifDeadline.signal,
            onProgress: event =>
              safeReportProgress(options, { percent: 55, stage: 'avif', message: event.message })
          })
        } catch (err) {
          if (
            !avifDeadline.signal.aborted &&
            err instanceof Error &&
            err.message.includes('浏览器无法解码此视频')
          ) {
            converted = await encodeAnimatedAvifViaFfmpeg(
              input,
              options,
              inExt,
              avifDeadline.signal
            )
          } else {
            throw err
          }
        }
      }

      avifDeadline.signal.throwIfAborted()
      const outputBytes = new Uint8Array(await converted.blob.arrayBuffer())
      if (!validateAnimationOutputMagic(outputBytes, 'avif')) {
        throw new Error('转换输出格式校验失败（AVIF 动图）')
      }

      const file = new File([converted.blob], outputName, { type: meta.mimeType })
      const dims = await probeImageDimensions(converted.blob)
      safeReportProgress(options, { percent: 100, stage: 'done', message: '转换完成' })
      return {
        blob: converted.blob,
        file,
        fileName: outputName,
        mimeType: meta.mimeType,
        format: options.format,
        width: dims.width,
        height: dims.height,
        size: converted.blob.size,
        inputSize: input.size,
        warning: converted.warning
      }
    } finally {
      avifDeadline.dispose()
    }
  }

  const jobId = createJobId()
  const inputPath = `${jobId}-in.${inExt}`
  const palettePath = `${jobId}-palette.png`
  const outputPath = `${jobId}-out.${meta.ext}`
  const deadline = createDeadlineController(
    options.signal,
    timeoutMs + 5000,
    '视频转换超时，请尝试缩短裁剪时长或降低分辨率'
  )
  const jobSignal = deadline.signal

  safeReportProgress(options, {
    percent: 2,
    stage: 'load',
    message: '正在加载本地 FFmpeg WASM 核心...'
  })

  try {
    return await localAvifService.runExclusiveFfmpegJob(
      async ffmpeg => {
        jobSignal.throwIfAborted()

        let progressStart = 10
        let progressEnd = 95
        let progressStage: string = options.format
        let progressLabel = `正在转码为 ${meta.label}...`
        const lastLogs: string[] = []

        const onFfmpegProgress = ({ progress }: { progress: number }) => {
          if (!Number.isFinite(progress)) return
          const clamped = Math.min(1, Math.max(0, progress))
          const percent = Math.round(progressStart + (progressEnd - progressStart) * clamped)
          safeReportProgress(options, {
            percent,
            stage: progressStage,
            message: `${progressLabel} ${Math.round(clamped * 100)}%`
          })
        }

        const onFfmpegLog = ({ message }: { message: string }) => {
          const trimmed = message?.trim()
          if (!trimmed) return
          lastLogs.push(trimmed)
          if (lastLogs.length > 15) lastLogs.shift()
        }

        ffmpeg.on('progress', onFfmpegProgress)
        ffmpeg.on('log', onFfmpegLog)

        const safeDelete = async (path: string) => {
          try {
            await ffmpeg.deleteFile(path)
          } catch {
            // ignore cleanup errors
          }
        }

        const throwExecError = (actionLabel: string, code: number): never => {
          const detail = pickRelevantLog(lastLogs)
          throw new Error(
            detail
              ? `${actionLabel}（退出码 ${code}）：${detail}`
              : `${actionLabel}（退出码 ${code}）`
          )
        }

        try {
          safeReportProgress(options, {
            percent: 5,
            stage: 'write',
            message: '正在写入视频到 WASM 内存...'
          })
          jobSignal.throwIfAborted()
          await ffmpeg.writeFile(inputPath, await fetchFile(input), { signal: jobSignal })

          if (options.format === 'gif') {
            const { pass1, pass2 } = buildGifTwoPassArgs(
              inputPath,
              palettePath,
              outputPath,
              options
            )

            progressStart = 8
            progressEnd = 45
            progressStage = 'palette'
            progressLabel = 'GIF 第 1 步：分析并生成调色板...'
            safeReportProgress(options, {
              percent: progressStart,
              stage: progressStage,
              message: progressLabel
            })
            jobSignal.throwIfAborted()
            const pass1Code = await ffmpeg.exec(pass1, timeoutMs, { signal: jobSignal })
            if (pass1Code !== 0) {
              throwExecError('FFmpeg 调色板生成失败', pass1Code)
            }

            progressStart = 45
            progressEnd = 95
            progressStage = 'gif'
            progressLabel = 'GIF 第 2 步：应用调色板编码...'
            safeReportProgress(options, {
              percent: progressStart,
              stage: progressStage,
              message: progressLabel
            })
            jobSignal.throwIfAborted()
            const pass2Code = await ffmpeg.exec(pass2, timeoutMs, { signal: jobSignal })
            if (pass2Code !== 0) {
              throwExecError('FFmpeg GIF 编码失败', pass2Code)
            }
          } else if (options.format === 'apng') {
            progressStart = 10
            progressEnd = 95
            progressStage = 'apng'
            progressLabel = '正在编码 APNG 动图...'
            safeReportProgress(options, {
              percent: progressStart,
              stage: progressStage,
              message: progressLabel
            })
            jobSignal.throwIfAborted()
            const exitCode = await ffmpeg.exec(
              buildApngArgs(inputPath, outputPath, options),
              timeoutMs,
              {
                signal: jobSignal
              }
            )
            if (exitCode !== 0) {
              throwExecError('FFmpeg APNG 编码失败', exitCode)
            }
          } else {
            progressStart = 10
            progressEnd = 95
            progressStage = 'webp'
            progressLabel = '正在编码 WebP 动图...'
            safeReportProgress(options, {
              percent: progressStart,
              stage: progressStage,
              message: progressLabel
            })
            jobSignal.throwIfAborted()
            const exitCode = await ffmpeg.exec(
              buildWebpArgs(inputPath, outputPath, options),
              timeoutMs,
              {
                signal: jobSignal
              }
            )
            if (exitCode !== 0) {
              throwExecError('FFmpeg WebP 编码失败', exitCode)
            }
          }

          jobSignal.throwIfAborted()
          const data = await ffmpeg.readFile(outputPath, undefined, { signal: jobSignal })
          if (!(data instanceof Uint8Array) || data.byteLength === 0) {
            throw new Error(`转换输出为空（${meta.label}）`)
          }

          const copied = new Uint8Array(data.byteLength)
          copied.set(data)
          if (!validateAnimationOutputMagic(copied, options.format)) {
            throw new Error(`转换输出格式校验失败（${meta.label}）`)
          }

          const blob = new Blob([copied], { type: meta.mimeType })
          const file = new File([blob], outputName, { type: meta.mimeType })
          const dims = await probeImageDimensions(blob)

          safeReportProgress(options, { percent: 100, stage: 'done', message: '转换完成' })
          return {
            blob,
            file,
            fileName: outputName,
            mimeType: meta.mimeType,
            format: options.format,
            width: dims.width,
            height: dims.height,
            size: blob.size,
            inputSize: input.size
          }
        } finally {
          ffmpeg.off('progress', onFfmpegProgress)
          ffmpeg.off('log', onFfmpegLog)
          if (jobSignal.aborted) {
            localAvifService.resetFfmpegWorker()
          } else {
            await Promise.all([
              safeDelete(inputPath),
              safeDelete(palettePath),
              safeDelete(outputPath)
            ])
          }
        }
      },
      { signal: jobSignal }
    )
  } finally {
    deadline.dispose()
  }
}
