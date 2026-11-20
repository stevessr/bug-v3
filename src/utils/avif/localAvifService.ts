import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile } from '@ffmpeg/util'
import classWorkerURL from '@ffmpeg/ffmpeg/worker?worker&url'
import coreURL from '@ffmpeg/core?url'
import wasmURL from '@ffmpeg/core/wasm?url'

import { encodeAvif } from './avifEncoder'
// 包体积优化：构建脚本（scripts/build.js）把 ~31MB 的 ffmpeg-core.wasm 预压缩为
// ffmpeg-core.wasm.gz（gzip -9 后约 10MB）。运行时用 DecompressionStream 解压成
// Blob URL 再交给 ffmpeg——全本地解压、离线可用，行为不变。
// dev server / watch 构建下 gz 不存在，回退到 ?url 直出的未压缩 wasm。
const FFMPEG_WASM_GZ_PATH = 'assets/ffmpeg-core.wasm.gz'
const FFMPEG_LOAD_TIMEOUT_MS = 60000

const hasWasmMagic = (buffer: ArrayBuffer): boolean => {
  if (buffer.byteLength < 8) return false
  const bytes = new Uint8Array(buffer, 0, 4)
  return bytes[0] === 0x00 && bytes[1] === 0x61 && bytes[2] === 0x73 && bytes[3] === 0x6d
}

const isWorkerCompromisedError = (error: unknown): boolean => {
  if (error instanceof DOMException && error.name === 'AbortError') return true
  const name =
    error && typeof error === 'object' && 'name' in error ? String((error as any).name) : ''
  if (name === 'AbortError' || name === 'TimeoutError') return true
  const message =
    error instanceof Error ? error.message : typeof error === 'string' ? error : String(error ?? '')
  return /abort|timeout|超时|terminate|RuntimeError|out of memory|memory access out of bounds|unreachable|not loaded/i.test(
    message
  )
}

const resolveWasmUrl = async (): Promise<string> => {
  try {
    if (typeof DecompressionStream !== 'function') {
      return wasmURL
    }
    // 扩展上下文（options 页）提供 chrome.runtime.getURL；
    // 非扩展环境（如构建产物 HTTP 测试）尝试同源 .wasm.gz，不存在则回退未压缩 wasm
    const getURL = typeof chrome !== 'undefined' ? chrome.runtime?.getURL : undefined
    const gzUrl = typeof getURL === 'function' ? getURL(FFMPEG_WASM_GZ_PATH) : `${wasmURL}.gz`
    const response = await fetch(gzUrl)
    if (!response.ok || !response.body) {
      return wasmURL
    }
    const buffer = await new Response(
      response.body.pipeThrough(new DecompressionStream('gzip'))
    ).arrayBuffer()
    if (!hasWasmMagic(buffer)) {
      return wasmURL
    }
    return URL.createObjectURL(new Blob([buffer], { type: 'application/wasm' }))
  } catch {
    // gz 缺失或解压 API 不可用：回退到未压缩 wasm URL
    return wasmURL
  }
}

export interface LocalAvifProgress {
  message: string
}

const DEFAULT_TIMEOUT_MS = 180000
const DEFAULT_STATIC_QUALITY = 62

const uint8ArrayToBlob = (bytes: Uint8Array, type: string): Blob => {
  const copied = new Uint8Array(bytes.byteLength)
  copied.set(bytes)
  return new Blob([copied], { type })
}

// FFmpeg 5's copy muxer emits an invalid optional still-image pixi property
// (zero planes). Keep the valid sequence track only, and fix absolute offsets.
// Sequence-only AVIF is defined by the avis brand; no primary still item is required.
const normalizeAvifSequence = (input: Uint8Array): Uint8Array => {
  const bytes = input.slice()
  const view = new DataView(bytes.buffer)
  const tag = (offset: number) => new TextDecoder().decode(bytes.subarray(offset, offset + 4))
  let removed = 0
  const top: { offset: number; size: number; type: string }[] = []
  for (let offset = 0; offset + 8 <= bytes.length;) {
    const rawSize = view.getUint32(offset)
    const size = rawSize === 0 ? bytes.length - offset : rawSize
    if (size < 8 || offset + size > bytes.length) throw new Error('Invalid AVIF sequence container')
    const type = tag(offset + 4)
    top.push({ offset, size, type })
    if (type === 'meta') removed += size
    offset += size
  }
  const fixOffsets = (start: number, end: number) => {
    for (let offset = start; offset + 8 <= end;) {
      const rawSize = view.getUint32(offset)
      const size = rawSize === 0 ? end - offset : rawSize
      if (size < 8 || offset + size > end) throw new Error('Invalid AVIF track box')
      const type = tag(offset + 4)
      if (type === 'stco') {
        const count = view.getUint32(offset + 12)
        for (let i = 0; i < count; i++) {
          const position = offset + 16 + i * 4
          if (position + 4 > offset + size) throw new Error('Invalid AVIF chunk offsets')
          const oldOffset = view.getUint32(position)
          if (oldOffset < removed) throw new Error('Invalid AVIF chunk offset underflow')
          view.setUint32(position, oldOffset - removed)
        }
      } else if (['moov', 'trak', 'mdia', 'minf', 'stbl'].includes(type)) {
        fixOffsets(offset + 8, offset + size)
      }
      offset += size
    }
  }
  for (const box of top) {
    if (box.type === 'moov') fixOffsets(box.offset, box.offset + box.size)
    if (box.type === 'ftyp') {
      for (let offset = box.offset + 8; offset + 4 <= box.offset + box.size; offset += 4) {
        const brand = tag(offset)
        if (brand === 'avif') bytes.set(new TextEncoder().encode('avis'), offset)
        if (brand === 'mif1') bytes.set(new TextEncoder().encode('msf1'), offset)
      }
    }
  }
  const output = new Uint8Array(bytes.length - removed)
  let position = 0
  for (const box of top) {
    if (box.type === 'meta') continue
    output.set(bytes.subarray(box.offset, box.offset + box.size), position)
    position += box.size
  }
  return output
}

const encodeBufferToBlob = (buffer: ArrayBuffer, type: string): Blob => new Blob([buffer], { type })

const toArrayBuffer = (value: ArrayBufferLike): ArrayBuffer => {
  if (value instanceof ArrayBuffer) {
    return value
  }

  const copied = new Uint8Array(value.byteLength)
  copied.set(new Uint8Array(value))
  return copied.buffer
}

const objectUrlToImage = async (url: string, signal?: AbortSignal): Promise<HTMLImageElement> => {
  if (signal?.aborted) {
    throw new DOMException('Image loading aborted', 'AbortError')
  }
  return await new Promise((resolve, reject) => {
    const image = new Image()
    const onAbort = () => {
      cleanup()
      reject(new DOMException('Image loading aborted', 'AbortError'))
    }
    const cleanup = () => {
      image.onload = null
      image.onerror = null
      signal?.removeEventListener('abort', onAbort)
    }

    image.onload = () => {
      cleanup()
      resolve(image)
    }
    image.onerror = () => {
      cleanup()
      reject(new Error('Failed to load image blob for AVIF encoding'))
    }

    signal?.addEventListener('abort', onAbort, { once: true })
    image.src = url
  })
}

const ensureHtmlVideoElement = (source: CanvasImageSource): source is HTMLVideoElement =>
  typeof HTMLVideoElement !== 'undefined' && source instanceof HTMLVideoElement

const ensureImageBitmap = (source: CanvasImageSource): source is ImageBitmap =>
  typeof ImageBitmap !== 'undefined' && source instanceof ImageBitmap

const ensureHtmlImageElement = (source: CanvasImageSource): source is HTMLImageElement =>
  typeof HTMLImageElement !== 'undefined' && source instanceof HTMLImageElement

const ensureHtmlCanvasElement = (source: CanvasImageSource): source is HTMLCanvasElement =>
  typeof HTMLCanvasElement !== 'undefined' && source instanceof HTMLCanvasElement

const ensureOffscreenCanvas = (source: CanvasImageSource): source is OffscreenCanvas =>
  typeof OffscreenCanvas !== 'undefined' && source instanceof OffscreenCanvas

const ensureVideoFrame = (source: CanvasImageSource): source is VideoFrame =>
  typeof VideoFrame !== 'undefined' && source instanceof VideoFrame

const getSourceDimensions = (source: CanvasImageSource): { width: number; height: number } => {
  if (ensureHtmlVideoElement(source)) {
    return { width: source.videoWidth, height: source.videoHeight }
  }
  if (ensureImageBitmap(source)) {
    return { width: source.width, height: source.height }
  }
  if (ensureHtmlImageElement(source)) {
    return {
      width: source.naturalWidth || source.width,
      height: source.naturalHeight || source.height
    }
  }
  if (ensureHtmlCanvasElement(source) || ensureOffscreenCanvas(source)) {
    return { width: source.width, height: source.height }
  }
  if (ensureVideoFrame(source)) {
    return {
      width: source.displayWidth || source.codedWidth,
      height: source.displayHeight || source.codedHeight
    }
  }

  return { width: 512, height: 512 }
}

const drawCanvasImageSource = (
  context: CanvasRenderingContext2D,
  source: CanvasImageSource,
  width: number,
  height: number
) => {
  if (ensureHtmlVideoElement(source)) {
    context.drawImage(source, 0, 0, width, height)
    return
  }
  if (ensureImageBitmap(source)) {
    context.drawImage(source, 0, 0, width, height)
    return
  }
  if (ensureHtmlImageElement(source)) {
    context.drawImage(source, 0, 0, width, height)
    return
  }
  if (ensureHtmlCanvasElement(source)) {
    context.drawImage(source, 0, 0, width, height)
    return
  }
  if (ensureOffscreenCanvas(source)) {
    context.drawImage(source, 0, 0, width, height)
    return
  }
  if (ensureVideoFrame(source)) {
    context.drawImage(source, 0, 0, width, height)
    return
  }

  throw new Error('Unsupported image source for AVIF encoding')
}

const createJobId = () => `tg_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`

class LocalAvifService {
  private ffmpeg: FFmpeg | null = null
  private ffmpegLoadPromise: Promise<void> | null = null
  private ffmpegJobChain: Promise<void> = Promise.resolve()

  private getFfmpeg(): FFmpeg {
    if (!this.ffmpeg) {
      this.ffmpeg = new FFmpeg()
    }
    return this.ffmpeg
  }

  resetFfmpegWorker(): void {
    try {
      this.ffmpeg?.terminate()
    } catch {
      // ignore terminate errors
    }
    this.ffmpeg = null
    this.ffmpegLoadPromise = null
  }

  async ensureFfmpegLoaded(signal?: AbortSignal): Promise<void> {
    signal?.throwIfAborted()
    if (this.ffmpeg?.loaded) return

    if (this.ffmpegLoadPromise) {
      await this.ffmpegLoadPromise
      if (this.ffmpeg?.loaded) return
      this.ffmpegLoadPromise = null
    }

    const ffmpeg = this.getFfmpeg()
    const loadController = new AbortController()
    const onAbort = () => loadController.abort(signal?.reason)
    signal?.addEventListener('abort', onAbort, { once: true })
    const timer = setTimeout(
      () => loadController.abort(new Error('FFmpeg WASM 加载超时，请重试')),
      FFMPEG_LOAD_TIMEOUT_MS
    )

    this.ffmpegLoadPromise = (async () => {
      if (ffmpeg.loaded) return
      const wasmObjectUrl = await resolveWasmUrl()
      try {
        loadController.signal.throwIfAborted()
        await ffmpeg.load(
          { classWorkerURL, coreURL, wasmURL: wasmObjectUrl },
          { signal: loadController.signal }
        )
      } finally {
        // 解压产生的 Blob URL 用完即回收；静态 ?url 资源路径不回收
        if (wasmObjectUrl.startsWith('blob:')) {
          URL.revokeObjectURL(wasmObjectUrl)
        }
      }
    })()
      .catch(error => {
        this.resetFfmpegWorker()
        throw error
      })
      .finally(() => {
        clearTimeout(timer)
        signal?.removeEventListener('abort', onAbort)
      })

    return this.ffmpegLoadPromise
  }

  /** Serialize FFmpeg jobs so concurrent callers never collide in the single worker MEMFS. */
  async runExclusiveFfmpegJob<T>(
    task: (ffmpeg: FFmpeg) => Promise<T>,
    options: { signal?: AbortSignal } = {}
  ): Promise<T> {
    options.signal?.throwIfAborted()
    const run = async (): Promise<T> => {
      options.signal?.throwIfAborted()
      await this.ensureFfmpegLoaded(options.signal)
      options.signal?.throwIfAborted()
      try {
        return await task(this.getFfmpeg())
      } catch (error) {
        if (options.signal?.aborted || isWorkerCompromisedError(error)) {
          this.resetFfmpegWorker()
        }
        throw error
      }
    }
    const resultPromise = this.ffmpegJobChain.then(run, run)
    this.ffmpegJobChain = resultPromise.then(
      () => undefined,
      () => undefined
    )
    return resultPromise
  }

  async convertWebmToAnimatedAvif(
    blob: Blob,
    options: {
      signal?: AbortSignal
      timeoutMs?: number
      onProgress?: (event: LocalAvifProgress) => void
    } = {}
  ): Promise<Blob> {
    const { convertWebmInBrowser } = await import('@/utils/telegram/nativeWebmConversion')
    return (await convertWebmInBrowser(blob, 'animated-avif', options)).blob
  }

  async muxAv1ToAnimatedAvif(
    blob: Blob,
    options: {
      signal?: AbortSignal
      timeoutMs?: number
      onProgress?: (event: LocalAvifProgress) => void
    } = {}
  ): Promise<Blob> {
    return await this.runExclusiveFfmpegJob(
      async ffmpeg => {
        const jobId = createJobId()
        const inputPath = `${jobId}-input.ivf`
        const outputPath = `${jobId}-output.avif`

        options.onProgress?.({ message: '正在初始化浏览器内 AVIF 封装器...' })
        options.signal?.throwIfAborted()
        await ffmpeg.writeFile(inputPath, await fetchFile(blob), { signal: options.signal })

        try {
          options.onProgress?.({ message: '正在浏览器内封装动画 AVIF...' })
          options.signal?.throwIfAborted()
          const exitCode = await ffmpeg.exec(
            ['-i', inputPath, '-c:v', 'copy', '-f', 'avif', outputPath],
            options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
            { signal: options.signal }
          )

          if (exitCode !== 0) {
            throw new Error(`ffmpeg exited with code ${exitCode}`)
          }

          options.signal?.throwIfAborted()
          const data = await ffmpeg.readFile(outputPath, undefined, { signal: options.signal })
          const bytes = data instanceof Uint8Array ? data : new Uint8Array()
          if (bytes.byteLength === 0) {
            throw new Error('Local animated AVIF output is empty')
          }

          return uint8ArrayToBlob(normalizeAvifSequence(bytes), 'image/avif')
        } finally {
          if (!options.signal?.aborted) {
            await this.safeDeleteFile(inputPath)
            await this.safeDeleteFile(outputPath)
          }
        }
      },
      { signal: options.signal }
    )
  }

  async convertPngFramesToAnimatedAvif(
    frames: Blob[],
    fps: number,
    options: {
      signal?: AbortSignal
      timeoutMs?: number
      onProgress?: (event: LocalAvifProgress) => void
    } = {}
  ): Promise<Blob> {
    if (frames.length === 0) {
      throw new Error('No TGS frames available for AVIF conversion')
    }

    return await this.runExclusiveFfmpegJob(
      async ffmpeg => {
        const jobId = createJobId()
        const outputPath = `${jobId}-tgs.avif`
        const inputNames: string[] = []

        try {
          options.onProgress?.({ message: '正在写入 TGS 帧到浏览器内 WASM 编码器...' })
          for (let i = 0; i < frames.length; i++) {
            options.signal?.throwIfAborted()
            const frameName = `${jobId}-frame_${String(i).padStart(4, '0')}.png`
            inputNames.push(frameName)
            await ffmpeg.writeFile(frameName, await fetchFile(frames[i]), {
              signal: options.signal
            })
          }

          options.onProgress?.({ message: '正在浏览器内转换 TGS 为动画 AVIF...' })
          options.signal?.throwIfAborted()
          const exitCode = await ffmpeg.exec(
            [
              '-framerate',
              String(Math.max(1, fps)),
              '-i',
              `${jobId}-frame_%04d.png`,
              '-c:v',
              'libaom-av1',
              '-pix_fmt',
              'yuv420p',
              '-crf',
              '32',
              '-b:v',
              '0',
              '-f',
              'avif',
              outputPath
            ],
            options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
            { signal: options.signal }
          )

          if (exitCode !== 0) {
            throw new Error(`ffmpeg exited with code ${exitCode}`)
          }

          options.signal?.throwIfAborted()
          const data = await ffmpeg.readFile(outputPath, undefined, { signal: options.signal })
          const bytes = data instanceof Uint8Array ? data : new Uint8Array()
          if (bytes.byteLength === 0) {
            throw new Error('Local animated AVIF output is empty')
          }

          return uint8ArrayToBlob(bytes, 'image/avif')
        } finally {
          if (!options.signal?.aborted) {
            await Promise.all(inputNames.map(name => this.safeDeleteFile(name)))
            await this.safeDeleteFile(outputPath)
          }
        }
      },
      { signal: options.signal }
    )
  }

  async encodeStaticAvifFromBlob(
    blob: Blob,
    options: {
      quality?: number
      signal?: AbortSignal
    } = {}
  ): Promise<Blob> {
    const imageData = await this.blobToImageData(blob, options.signal)
    const encoded = await encodeAvif(imageData, {
      quality: options.quality ?? DEFAULT_STATIC_QUALITY
    })
    return encodeBufferToBlob(toArrayBuffer(encoded), 'image/avif')
  }

  async encodeStaticAvifFromVideoFirstFrame(
    blob: Blob,
    options: {
      quality?: number
      signal?: AbortSignal
    } = {}
  ): Promise<Blob> {
    const imageData = await this.extractVideoFirstFrame(blob, options.signal)
    const encoded = await encodeAvif(imageData, {
      quality: options.quality ?? DEFAULT_STATIC_QUALITY
    })
    return encodeBufferToBlob(toArrayBuffer(encoded), 'image/avif')
  }

  private async blobToImageData(blob: Blob, signal?: AbortSignal): Promise<ImageData> {
    if (typeof createImageBitmap === 'function') {
      const bitmap = await createImageBitmap(blob)
      try {
        return this.imageSourceToImageData(bitmap, signal)
      } finally {
        bitmap.close()
      }
    }

    const objectUrl = URL.createObjectURL(blob)
    try {
      const image = await objectUrlToImage(objectUrl, signal)
      return this.imageSourceToImageData(image, signal)
    } finally {
      URL.revokeObjectURL(objectUrl)
    }
  }

  private async extractVideoFirstFrame(blob: Blob, signal?: AbortSignal): Promise<ImageData> {
    const video = document.createElement('video')
    video.muted = true
    video.playsInline = true
    video.preload = 'auto'

    const objectUrl = URL.createObjectURL(blob)
    video.src = objectUrl

    try {
      await new Promise<void>((resolve, reject) => {
        const cleanup = () => {
          video.removeEventListener('loadeddata', onLoaded)
          video.removeEventListener('error', onError)
          signal?.removeEventListener('abort', onAbort)
        }
        const onAbort = () => {
          cleanup()
          reject(new DOMException('Video frame extraction aborted', 'AbortError'))
        }
        const onLoaded = () => {
          cleanup()
          resolve()
        }
        const onError = () => {
          cleanup()
          reject(new Error('Failed to decode WebM first frame locally'))
        }

        signal?.addEventListener('abort', onAbort, { once: true })
        video.addEventListener('loadeddata', onLoaded, { once: true })
        video.addEventListener('error', onError, { once: true })
      })

      return this.imageSourceToImageData(video, signal)
    } finally {
      URL.revokeObjectURL(objectUrl)
      video.pause()
      video.removeAttribute('src')
      video.load()
    }
  }

  private imageSourceToImageData(source: CanvasImageSource, signal?: AbortSignal): ImageData {
    if (signal?.aborted) {
      throw new DOMException('Image encoding aborted', 'AbortError')
    }

    const { width, height } = getSourceDimensions(source)
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, width)
    canvas.height = Math.max(1, height)
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) {
      throw new Error('Failed to create canvas context for AVIF encoding')
    }
    drawCanvasImageSource(context, source, canvas.width, canvas.height)
    return context.getImageData(0, 0, canvas.width, canvas.height)
  }

  private async safeDeleteFile(path: string): Promise<void> {
    if (!this.ffmpeg?.loaded) return
    try {
      await this.ffmpeg.deleteFile(path)
    } catch {
      // ignore cleanup errors
    }
  }
}

export const localAvifService = new LocalAvifService()
