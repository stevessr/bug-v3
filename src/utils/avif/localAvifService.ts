import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile } from '@ffmpeg/util'
import { encode as encodeAvif } from '@jsquash/avif'
import classWorkerURL from '@ffmpeg/ffmpeg/worker?url'
import coreURL from '@ffmpeg/core?url'
import wasmURL from '@ffmpeg/core/wasm?url'
import coreMtURL from '@ffmpeg/core-mt?url'
import wasmMtURL from '@ffmpeg/core-mt/wasm?url'
import workerMtURL from '@ffmpeg/core-mt/worker?url'

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
  return await new Promise((resolve, reject) => {
    const image = new Image()
    const cleanup = () => {
      image.onload = null
      image.onerror = null
    }
    const onAbort = () => {
      cleanup()
      reject(new DOMException('Image loading aborted', 'AbortError'))
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

const createJobId = () =>
  `tg_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`

class LocalAvifService {
  private ffmpeg: FFmpeg | null = null
  private ffmpegLoadPromise: Promise<void> | null = null

  private canUseMultiThreadCore(): boolean {
    return typeof SharedArrayBuffer !== 'undefined' && globalThis.crossOriginIsolated === true
  }

  private getFfmpeg(): FFmpeg {
    if (!this.ffmpeg) {
      this.ffmpeg = new FFmpeg()
    }
    return this.ffmpeg
  }

  async ensureFfmpegLoaded(): Promise<void> {
    if (this.ffmpegLoadPromise) {
      return this.ffmpegLoadPromise
    }

    const ffmpeg = this.getFfmpeg()
    this.ffmpegLoadPromise = (async () => {
      if (ffmpeg.loaded) return

      const useMultiThreadCore = this.canUseMultiThreadCore()
      await ffmpeg.load({
        classWorkerURL,
        coreURL: useMultiThreadCore ? coreMtURL : coreURL,
        wasmURL: useMultiThreadCore ? wasmMtURL : wasmURL,
        workerURL: useMultiThreadCore ? workerMtURL : undefined
      })
    })().catch(error => {
      this.ffmpegLoadPromise = null
      throw error
    })

    return this.ffmpegLoadPromise
  }

  async convertWebmToAnimatedAvif(
    blob: Blob,
    options: {
      signal?: AbortSignal
      timeoutMs?: number
      onProgress?: (event: LocalAvifProgress) => void
    } = {}
  ): Promise<Blob> {
    await this.ensureFfmpegLoaded()

    const ffmpeg = this.getFfmpeg()
    const jobId = createJobId()
    const inputPath = `${jobId}-input.webm`
    const outputPath = `${jobId}-output.avif`

    options.onProgress?.({ message: '正在初始化本地 AVIF 编码器...' })
    await ffmpeg.writeFile(inputPath, await fetchFile(blob), { signal: options.signal })

    try {
      options.onProgress?.({ message: '正在本地转换 WebM 为动画 AVIF...' })
      const exitCode = await ffmpeg.exec(
        [
          '-i',
          inputPath,
          '-an',
          '-map',
          '0:v:0',
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

      const data = await ffmpeg.readFile(outputPath, undefined, { signal: options.signal })
      const bytes = data instanceof Uint8Array ? data : new Uint8Array()
      if (bytes.byteLength === 0) {
        throw new Error('Local animated AVIF output is empty')
      }

      return uint8ArrayToBlob(bytes, 'image/avif')
    } finally {
      await this.safeDeleteFile(inputPath, options.signal)
      await this.safeDeleteFile(outputPath, options.signal)
    }
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

    await this.ensureFfmpegLoaded()
    const ffmpeg = this.getFfmpeg()
    const jobId = createJobId()
    const outputPath = `${jobId}-tgs.avif`
    const inputNames: string[] = []

    try {
      options.onProgress?.({ message: '正在写入 TGS 帧到本地编码器...' })
      for (let i = 0; i < frames.length; i++) {
        const frameName = `${jobId}-frame_${String(i).padStart(4, '0')}.png`
        inputNames.push(frameName)
        await ffmpeg.writeFile(frameName, await fetchFile(frames[i]), { signal: options.signal })
      }

      options.onProgress?.({ message: '正在本地转换 TGS 为动画 AVIF...' })
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

      const data = await ffmpeg.readFile(outputPath, undefined, { signal: options.signal })
      const bytes = data instanceof Uint8Array ? data : new Uint8Array()
      if (bytes.byteLength === 0) {
        throw new Error('Local animated AVIF output is empty')
      }

      return uint8ArrayToBlob(bytes, 'image/avif')
    } finally {
      await Promise.all(inputNames.map(name => this.safeDeleteFile(name, options.signal)))
      await this.safeDeleteFile(outputPath, options.signal)
    }
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

  private async safeDeleteFile(path: string, signal?: AbortSignal): Promise<void> {
    try {
      await this.getFfmpeg().deleteFile(path, { signal })
    } catch {
      // ignore cleanup errors
    }
  }
}

export const localAvifService = new LocalAvifService()
