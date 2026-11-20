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
