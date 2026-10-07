// Browser video decoding + Canvas encoding. No FFmpeg or conversion server.
// Animated WebP framing follows https://developers.google.com/speed/webp/docs/riff_container.
export type NativeWebmFormat = 'webp' | 'avif' | 'animated-avif' | 'disabled'

const join = (parts: Uint8Array[]): Uint8Array<ArrayBuffer> => {
  const result = new Uint8Array(parts.reduce((size, part) => size + part.length, 0))
  let offset = 0
  for (const part of parts) {
    result.set(part, offset)
    offset += part.length
  }
  return result
}
const ascii = (value: string) => new TextEncoder().encode(value)
const uint24 = (value: number) =>
  new Uint8Array([value & 255, (value >> 8) & 255, (value >> 16) & 255])
const uint32 = (value: number) => {
  const bytes = new Uint8Array(4)
  new DataView(bytes.buffer).setUint32(0, value, true)
  return bytes
}
const chunk = (name: string, data: Uint8Array) =>
  join([ascii(name), uint32(data.length), data, new Uint8Array(data.length % 2)])

// Only image chunks belong inside ANMF; strip VP8X/metadata from Canvas output.
export const webpFrameChunks = (bytes: Uint8Array): Uint8Array<ArrayBuffer> => {
  const tag = (offset: number) => new TextDecoder().decode(bytes.subarray(offset, offset + 4))
  if (tag(0) !== 'RIFF' || tag(8) !== 'WEBP') throw new Error('无效的 WebP 帧')
  const parts: Uint8Array[] = []
  let hasImage = false
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const name = tag(offset)
    const size = new DataView(bytes.buffer, bytes.byteOffset + offset + 4, 4).getUint32(0, true)
    const end = offset + 8 + size + (size % 2)
    if (end > bytes.length) throw new Error('WebP 帧数据不完整')
    if (name === 'ALPH' || name === 'VP8 ' || name === 'VP8L') {
      parts.push(bytes.subarray(offset, end))
      if (name !== 'ALPH') hasImage = true
    }
    offset = end
  }
  if (!hasImage) throw new Error('WebP 帧缺少图像数据')
  return join(parts)
}

export const muxAnimatedWebp = (
  frames: { bytes: Uint8Array; durationMs: number }[],
  width: number,
  height: number
): Blob => {
  if (!frames.length || width < 1 || height < 1 || width > 16383 || height > 16383) {
    throw new Error('无效的 WebP 动画尺寸或帧数')
  }
  const imageChunks = frames.map(frame => webpFrameChunks(frame.bytes))
  const hasAlpha = imageChunks.some(data => {
    const name = new TextDecoder().decode(data.subarray(0, 4))
    return name === 'ALPH' || (name === 'VP8L' && data.length >= 13 && (data[12] & 0x10) !== 0)
  })
  const extended = chunk(
    'VP8X',
    join([
      new Uint8Array([0x02 | (hasAlpha ? 0x10 : 0), 0, 0, 0]),
      uint24(width - 1),
      uint24(height - 1)
    ])
  )
  const animation = chunk('ANIM', new Uint8Array(6)) // transparent background, loop forever
  const frameChunks = frames.map((frame, index) =>
    chunk(
      'ANMF',
      join([
        uint24(0),
        uint24(0),
        uint24(width - 1),
        uint24(height - 1),
        uint24(Math.max(1, Math.round(frame.durationMs))),
        new Uint8Array([2]), // replace, no blend
        imageChunks[index]
      ])
    )
  )
  const payload = join([ascii('WEBP'), extended, animation, ...frameChunks])
  return new Blob([join([ascii('RIFF'), uint32(payload.length), payload])], { type: 'image/webp' })
}

const encodeCanvas = (canvas: HTMLCanvasElement, type: string): Promise<Blob> =>
  new Promise((resolve, reject) =>
    canvas.toBlob(
      blob => {
        if (!blob) reject(new Error('浏览器图像编码失败'))
        else resolve(blob)
      },
      type,
      0.85
    )
  )

export async function convertWebmInBrowser(
  blob: Blob,
  format: 'webp' | 'avif' | 'animated-avif',
  options: { signal?: AbortSignal; onProgress?: (event: { message: string }) => void } = {}
): Promise<{ blob: Blob; warning?: string }> {
  const controller = new AbortController()
  const onAbort = () => controller.abort(options.signal?.reason)
  options.signal?.addEventListener('abort', onAbort, { once: true })
  if (options.signal?.aborted) onAbort()
  const timer = setTimeout(() => controller.abort(new Error('浏览器转换超时')), 45000)
  const signal = controller.signal
  const check = () => signal.throwIfAborted()
  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.preload = 'auto'
  const url = URL.createObjectURL(blob)
  const waitFor = (event: string, action: () => void) =>
    new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        video.removeEventListener(event, done)
        video.removeEventListener('error', failed)
        signal.removeEventListener('abort', aborted)
      }
      const done = () => {
        cleanup()
        resolve()
      }
      const failed = () => {
        cleanup()
        reject(new Error('浏览器无法解码此 WebM'))
      }
      const aborted = () => {
        cleanup()
        reject(signal.reason)
      }
      if (signal.aborted) {
        reject(signal.reason)
        return
      }
      video.addEventListener(event, done, { once: true })
      video.addEventListener('error', failed, { once: true })
      signal.addEventListener('abort', aborted, { once: true })
      action()
    })
  try {
    check()
    await waitFor('loadeddata', () => {
      video.src = url
    })
    const duration = video.duration
    // TG video stickers are at most 3s; bound memory/runtime for malformed input.
    if (!Number.isFinite(duration) || duration <= 0 || duration > 10) {
      throw new Error('WebM 时长无效或超过 10 秒限制')
    }
    const canvas = document.createElement('canvas')
    const scale = Math.min(1, 512 / Math.max(video.videoWidth, video.videoHeight))
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale))
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale))
    const context = canvas.getContext('2d', { alpha: true })
    if (!context) throw new Error('浏览器不支持 Canvas 2D')
    const draw = () => {
      context.clearRect(0, 0, canvas.width, canvas.height)
      context.drawImage(video, 0, 0, canvas.width, canvas.height)
    }
    if (format === 'avif') {
      draw()
      options.onProgress?.({ message: '正在本地编码 AVIF 静态首帧...' })
      const native = await encodeCanvas(canvas, 'image/avif')
      check()
      if (native.type === 'image/avif')
        return { blob: native, warning: 'AVIF 首帧模式为静态图片，不保留动画' }
      // Canvas silently returns PNG when AVIF encoding isn't implemented.
      const { encode } = await import('@jsquash/avif')
      const bytes = await encode(context.getImageData(0, 0, canvas.width, canvas.height), {
        quality: 62
      })
      check()
      return {
        blob: new Blob([bytes], { type: 'image/avif' }),
        warning: '浏览器不支持原生 AVIF 编码，已用本地 WASM 编码静态首帧（无动画）'
      }
    }
    const fps = 20
    const count = Math.ceil(duration * fps)
    const frames: { bytes: Uint8Array; durationMs: number }[] = []
    let hasTransparency = false
    const avifEncoder = format === 'animated-avif' ? (await import('@jsquash/avif')).encode : null
    for (let i = 0; i < count; i++) {
      check()
      const time = i / fps
      if (i > 0)
        await waitFor('seeked', () => {
          video.currentTime = time
        })
      draw()
      if (avifEncoder) {
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height)
        // The single color track muxer currently doesn't support an auxiliary alpha track.
        for (let pixel = 3; pixel < pixels.data.length; pixel += 4) {
          if (pixels.data[pixel] !== 255) hasTransparency = true
          pixels.data[pixel] = 255
        }
        const encoded = new Uint8Array(await avifEncoder(pixels, { quality: 62, speed: 8 }))
        frames.push({
          bytes: extractAvifSample(encoded),
          durationMs: Math.min(1 / fps, duration - time) * 1000
        })
        check()
        options.onProgress?.({ message: `浏览器内动画 AVIF 编码 ${i + 1}/${count}...` })
        continue
      }
      const frame = await encodeCanvas(canvas, 'image/webp')
      check()
      if (frame.type !== 'image/webp') throw new Error('此浏览器不支持原生 WebP 编码')
      frames.push({
        bytes: new Uint8Array(await frame.arrayBuffer()),
        durationMs: Math.min(1 / fps, duration - time) * 1000
      })
      options.onProgress?.({ message: `浏览器原生动画 WebP 编码 ${i + 1}/${count}...` })
    }
    check()
    if (avifEncoder) {
      const { localAvifService } = await import('@/utils/avif/localAvifService')
      const output = await localAvifService.muxAv1ToAnimatedAvif(
        createAv1Ivf(frames, canvas.width, canvas.height),
        { signal, onProgress: options.onProgress }
      )
      return {
        blob: output,
        warning: hasTransparency
          ? '动画 AVIF 暂不保留透明通道；需要透明背景请选择动画 WebP'
          : undefined
      }
    }
    return { blob: muxAnimatedWebp(frames, canvas.width, canvas.height) }
  } finally {
    clearTimeout(timer)
    options.signal?.removeEventListener('abort', onAbort)
    video.pause()
    video.removeAttribute('src')
    video.load()
    URL.revokeObjectURL(url)
  }
}

// jsquash produces a single opaque AV1 image; extract its compressed sample without decoding.
const extractAvifSample = (bytes: Uint8Array): Uint8Array => {
  for (let offset = 0; offset + 8 <= bytes.length;) {
    const size = new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0)
    if (size < 8 || offset + size > bytes.length) throw new Error('AVIF 帧容器无效')
    const name = new TextDecoder().decode(bytes.subarray(offset + 4, offset + 8))
    if (name === 'mdat') return bytes.slice(offset + 8, offset + size)
    offset += size
  }
  throw new Error('AVIF 帧没有 AV1 数据')
}

const createAv1Ivf = (
  frames: { bytes: Uint8Array; durationMs: number }[],
  width: number,
  height: number
): Blob => {
  const header = new Uint8Array(32)
  header.set(ascii('DKIF'))
  const view = new DataView(header.buffer)
  view.setUint16(6, 32, true)
  header.set(ascii('AV01'), 8)
  view.setUint16(12, width, true)
  view.setUint16(14, height, true)
  view.setUint32(16, 1000, true)
  view.setUint32(20, 1, true)
  view.setUint32(24, frames.length, true)
  let timestamp = 0
  const samples = frames.map(frame => {
    const prefix = new Uint8Array(12)
    const data = new DataView(prefix.buffer)
    data.setUint32(0, frame.bytes.length, true)
    data.setBigUint64(4, BigInt(Math.round(timestamp)), true)
    timestamp += frame.durationMs
    return join([prefix, frame.bytes])
  })
  return new Blob([join([header, ...samples])], { type: 'video/x-ivf' })
}
