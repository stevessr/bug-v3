import { encodeAvifInThread, ensureLocalAvifEncoderReady, type AvifEncodeOptions } from './avifCore'

type AvifWorkerRequest =
  | {
      type: 'init'
      id: number
      wasmGzUrl: string
    }
  | {
      type: 'encode'
      id: number
      wasmGzUrl: string
      width: number
      height: number
      buffer: ArrayBuffer
      options?: AvifEncodeOptions
    }

self.onmessage = async (event: MessageEvent<AvifWorkerRequest>) => {
  const payload = event.data
  if (!payload) return

  try {
    if (payload.type === 'init') {
      await ensureLocalAvifEncoderReady(payload.wasmGzUrl)
      self.postMessage({ id: payload.id, ok: true })
      return
    }

    const pixels = new ImageData(
      new Uint8ClampedArray(payload.buffer),
      payload.width,
      payload.height
    )
    const encoded = await encodeAvifInThread(pixels, payload.wasmGzUrl, payload.options)
    self.postMessage({ id: payload.id, ok: true, buffer: encoded }, { transfer: [encoded] })
  } catch (error) {
    self.postMessage({
      id: payload.id,
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    })
  }
}
