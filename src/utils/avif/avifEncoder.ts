import encode, { init as initAvifEncoder } from '@jsquash/avif/encode'
import type { EncodeOptions } from '@jsquash/avif/meta'

const AVIF_WASM_GZ_PATH = 'assets/avif_enc.wasm.gz'

export type AvifEncodeOptions = Partial<EncodeOptions> & {
  bitDepth?: 8
}

const resolveAvifWasmGzUrl = (): string => {
  const getURL = typeof chrome !== 'undefined' ? chrome.runtime?.getURL : undefined
  if (typeof getURL === 'function') {
    return getURL(AVIF_WASM_GZ_PATH)
  }
  return new URL(AVIF_WASM_GZ_PATH, new URL(/* @vite-ignore */ '../', import.meta.url)).href
}

const hasWasmMagic = (buffer: ArrayBuffer): boolean => {
  if (buffer.byteLength < 8) return false
  const bytes = new Uint8Array(buffer, 0, 4)
  return bytes[0] === 0x00 && bytes[1] === 0x61 && bytes[2] === 0x73 && bytes[3] === 0x6d
}

let initPromise: Promise<void> | null = null

export function ensureAvifEncoderReady(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      if (typeof DecompressionStream !== 'function') return

      let wasmBinary: Uint8Array | null = null
      try {
        const response = await fetch(resolveAvifWasmGzUrl())
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
      throw error
    })
  }
  return initPromise
}

export async function encodeAvif(
  data: ImageData,
  options?: AvifEncodeOptions
): Promise<ArrayBuffer> {
  await ensureAvifEncoderReady()
  return options ? encode(data, options) : encode(data)
}
