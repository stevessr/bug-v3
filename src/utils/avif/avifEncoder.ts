import {
  encodeAvifInThread,
  ensureLocalAvifEncoderReady,
  stripAlphaChannel,
  type AvifEncodeOptions
} from './avifCore'

export { stripAlphaChannel, type AvifEncodeOptions }

const AVIF_WASM_GZ_PATH = 'assets/avif_enc.wasm.gz'

const resolveAvifWasmGzUrl = (): string => {
  const getURL = typeof chrome !== 'undefined' ? chrome.runtime?.getURL : undefined
  if (typeof getURL === 'function') {
    return getURL(AVIF_WASM_GZ_PATH)
  }
  return new URL(AVIF_WASM_GZ_PATH, new URL(/* @vite-ignore */ '../', import.meta.url)).href
}

interface PendingJob {
  resolve: (buffer: ArrayBuffer | undefined) => void
  reject: (error: Error) => void
}

let avifWorker: Worker | null = null
let workerDisabled = false
let nextJobId = 1
const pendingJobs = new Map<number, PendingJob>()

function resetAvifWorker(reason?: unknown) {
  if (avifWorker) {
    try {
      avifWorker.terminate()
    } catch {
      // ignore terminate errors
    }
    avifWorker = null
  }

  const err =
    reason instanceof Error ? reason : new Error(String(reason || 'AVIF worker terminated'))
  for (const job of pendingJobs.values()) {
    job.reject(err)
  }
  pendingJobs.clear()
}

function getOrCreateAvifWorker(): Worker | null {
  if (workerDisabled || typeof Worker !== 'function') return null
  if (avifWorker) return avifWorker

  try {
    const worker = new Worker(new URL('./avifWorker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (
      event: MessageEvent<{ id: number; ok: boolean; buffer?: ArrayBuffer; error?: string }>
    ) => {
      const { id, ok, buffer, error } = event.data || {}
      const job = pendingJobs.get(id)
      if (!job) return
      pendingJobs.delete(id)
      if (ok) {
        job.resolve(buffer)
      } else {
        job.reject(new Error(error || 'AVIF worker encoding error'))
      }
    }
    worker.onerror = event => {
      // If the worker fails before completing any job (e.g., restricted test env),
      // disable worker mode so fallback executes cleanly.
      const hadPending = pendingJobs.size > 0
      if (!hadPending) {
        workerDisabled = true
      }
      resetAvifWorker(new Error(event.message || 'AVIF worker failed'))
    }
    avifWorker = worker
    return worker
  } catch {
    workerDisabled = true
    return null
  }
}

function postWorkerJob(
  worker: Worker,
  message: Record<string, unknown>,
  transfer: Transferable[] = [],
  signal?: AbortSignal
): Promise<ArrayBuffer | undefined> {
  signal?.throwIfAborted()
  const id = nextJobId++
  return new Promise<ArrayBuffer | undefined>((resolve, reject) => {
    const onAbort = () => {
      if (pendingJobs.delete(id)) {
        resetAvifWorker(signal?.reason ?? new DOMException('AVIF encoding aborted', 'AbortError'))
        reject(signal?.reason ?? new DOMException('AVIF encoding aborted', 'AbortError'))
      }
    }
    const cleanup = () => {
      signal?.removeEventListener('abort', onAbort)
    }

    pendingJobs.set(id, {
      resolve: buffer => {
        cleanup()
        resolve(buffer)
      },
      reject: err => {
        cleanup()
        reject(err)
      }
    })
    signal?.addEventListener('abort', onAbort, { once: true })

    try {
      worker.postMessage({ ...message, id }, transfer)
    } catch (error) {
      pendingJobs.delete(id)
      cleanup()
      reject(error instanceof Error ? error : new Error(String(error)))
    }
  })
}

export async function ensureAvifEncoderReady(): Promise<void> {
  const wasmGzUrl = resolveAvifWasmGzUrl()
  const worker = getOrCreateAvifWorker()
  if (worker) {
    try {
      await postWorkerJob(worker, { type: 'init', wasmGzUrl })
      return
    } catch {
      workerDisabled = true
      resetAvifWorker()
    }
  }
  await ensureLocalAvifEncoderReady(wasmGzUrl)
}

export async function encodeAvif(
  data: ImageData,
  options?: AvifEncodeOptions,
  signal?: AbortSignal
): Promise<ArrayBuffer> {
  signal?.throwIfAborted()
  const wasmGzUrl = resolveAvifWasmGzUrl()
  const worker = getOrCreateAvifWorker()
  if (worker) {
    // Copy pixel bytes into an owned ArrayBuffer so transferring does not detach caller's ImageData.
    const ownedBuffer =
      data.data.byteOffset === 0 && data.data.byteLength === data.data.buffer.byteLength
        ? data.data.buffer.slice(0)
        : new Uint8Array(data.data).buffer
    try {
      const encoded = await postWorkerJob(
        worker,
        {
          type: 'encode',
          wasmGzUrl,
          width: data.width,
          height: data.height,
          buffer: ownedBuffer,
          options
        },
        [ownedBuffer],
        signal
      )
      if (encoded) return encoded
    } catch (error) {
      if (signal?.aborted || (error instanceof DOMException && error.name === 'AbortError')) {
        throw error
      }
      workerDisabled = true
      resetAvifWorker()
    }
  }

  return encodeAvifInThread(data, wasmGzUrl, options)
}
