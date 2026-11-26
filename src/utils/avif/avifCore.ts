import encode, { init as initAvifEncoder } from '@jsquash/avif/encode'
import type { EncodeOptions } from '@jsquash/avif/meta'

export type AvifEncodeOptions = Partial<EncodeOptions> & {
  bitDepth?: 8
}

const hasWasmMagic = (buffer: ArrayBuffer): boolean => {
  if (buffer.byteLength < 8) return false
  const bytes = new Uint8Array(buffer, 0, 4)
  return bytes[0] === 0x00 && bytes[1] === 0x61 && bytes[2] === 0x73 && bytes[3] === 0x6d
}

let initPromise: Promise<void> | null = null
let initializedUrl: string | null = null

export function ensureLocalAvifEncoderReady(wasmGzUrl: string): Promise<void> {
  if (initPromise && initializedUrl === wasmGzUrl) {
    return initPromise
  }

  initializedUrl = wasmGzUrl
  initPromise = (async () => {
    if (typeof DecompressionStream !== 'function') return

    let wasmBinary: Uint8Array | null = null
    try {
      const response = await fetch(wasmGzUrl)
      if (!response.ok || !response.body) return
      const buffer = await new Response(
        response.body.pipeThrough(new DecompressionStream('gzip'))
      ).arrayBuffer()
      if (!hasWasmMagic(buffer)) return
      wasmBinary = new Uint8Array(buffer)
    } catch {
      // Fall back to default uncompressed avif_enc.wasm in dev/watch builds.
      return
    }

    await initAvifEncoder({
      wasmBinary
    } as unknown as Parameters<typeof initAvifEncoder>[0])
  })().catch(error => {
    initPromise = null
    initializedUrl = null
    throw error
  })

  return initPromise
}

export async function encodeAvifInThread(
  data: ImageData,
  wasmGzUrl: string,
  options?: AvifEncodeOptions
): Promise<ArrayBuffer> {
  await ensureLocalAvifEncoderReady(wasmGzUrl)
  return options ? encode(data, options) : encode(data)
}

/**
 * Forces alpha to 255 in-place for single-track animated AVIF muxing and returns
 * whether any pixel originally had partial/full transparency.
 */
export function stripAlphaChannel(pixels: ImageData): boolean {
  const data = pixels.data
  let hasTransparency = false
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] !== 255) {
      hasTransparency = true
      data[i] = 255
    }
  }
  return hasTransparency
}
