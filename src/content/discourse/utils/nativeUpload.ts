export type DiscourseUploadRouteContext = 'auto' | 'composer' | 'chat'

export type NativeDiscourseUploadAttempt =
  | { status: 'unavailable'; reason: string }
  | { status: 'uploaded'; upload: Record<string, unknown> }
  | { status: 'delegated'; route: 'chat' }

type NativeUploadBridgeResponse = {
  channel?: string
  direction?: string
  id?: string
  status?: 'unavailable' | 'uploaded' | 'delegated' | 'error'
  reason?: string
  route?: string
  upload?: unknown
  error?: {
    message?: string
    status?: number
    errorType?: string
    waitSeconds?: number
  }
}

const BRIDGE_CHANNEL = 'emoji-extension:discourse-native-upload:v1'
const BRIDGE_SCRIPT_PATH = 'js/discourse-native-upload.js'
const BRIDGE_LOAD_TIMEOUT_MS = 3000
const NATIVE_UPLOAD_TIMEOUT_MS = 5 * 60 * 1000 + 5000

let bridgeLoadPromise: Promise<boolean> | null = null

function createRequestId(): string {
  return globalThis.crypto?.randomUUID?.() || `upload-${Date.now()}-${Math.random().toString(36)}`
}

function pageOrigin(): string {
  return window.location.origin === 'null' ? '*' : window.location.origin
}

function ensureNativeUploadBridge(): Promise<boolean> {
  if (bridgeLoadPromise) return bridgeLoadPromise

  bridgeLoadPromise = new Promise(resolve => {
    const chromeAPI = globalThis.chrome
    if (!chromeAPI?.runtime?.getURL || !document.documentElement) {
      resolve(false)
      return
    }

    const script = document.createElement('script')
    script.src = chromeAPI.runtime.getURL(BRIDGE_SCRIPT_PATH)
    script.dataset.emojiExtensionBridge = 'discourse-native-upload'

    let settled = false
    const finish = (loaded: boolean) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      script.remove()
      resolve(loaded)
    }

    const timeout = window.setTimeout(() => finish(false), BRIDGE_LOAD_TIMEOUT_MS)
    script.addEventListener('load', () => finish(true), { once: true })
    script.addEventListener('error', () => finish(false), { once: true })
    ;(document.head || document.documentElement).appendChild(script)
  })

  return bridgeLoadPromise
}

function createNativeUploadError(response: NativeUploadBridgeResponse): Error {
  const message = response.error?.message || 'Discourse native upload failed'
  const error = new Error(message) as Error & {
    errors: string[]
    error_type: string
    status?: number
    extras?: { wait_seconds: number }
  }
  error.name = 'NativeDiscourseUploadError'
  error.errors = [message]
  error.error_type = response.error?.errorType || 'upload_failed'
  error.status = response.error?.status
  if (
    typeof response.error?.waitSeconds === 'number' &&
    Number.isFinite(response.error.waitSeconds) &&
    response.error.waitSeconds > 0
  ) {
    error.extras = { wait_seconds: response.error.waitSeconds }
  }
  return error
}

/**
 * Ask the page's MAIN world to use the uploader owned by the active Discourse
 * route. Only an explicit `unavailable` result is safe to fall back from: once
 * Discourse accepts a file, retrying it through `/uploads.json` could duplicate
 * the upload.
 */
export async function uploadThroughDiscourseRoute(
  file: File,
  routeContext: DiscourseUploadRouteContext = 'auto'
): Promise<NativeDiscourseUploadAttempt> {
  if (!(await ensureNativeUploadBridge())) {
    return { status: 'unavailable', reason: 'Discourse native upload bridge is unavailable' }
  }

  const id = createRequestId()

  return new Promise((resolve, reject) => {
    let settled = false

    const cleanup = () => {
      clearTimeout(timeout)
      window.removeEventListener('message', onMessage)
    }

    const finish = (callback: () => void) => {
      if (settled) return
      settled = true
      cleanup()
      callback()
    }

    const onMessage = (event: MessageEvent<NativeUploadBridgeResponse>) => {
      if (event.source !== window) return
      const response = event.data
      if (
        !response ||
        response.channel !== BRIDGE_CHANNEL ||
        response.direction !== 'response' ||
        response.id !== id
      ) {
        return
      }

      if (response.status === 'unavailable') {
        finish(() =>
          resolve({
            status: 'unavailable',
            reason: response.reason || 'Native uploader unavailable'
          })
        )
        return
      }

      if (response.status === 'uploaded') {
        if (!response.upload || typeof response.upload !== 'object') {
          finish(() => reject(new Error('Discourse native uploader returned no upload result')))
          return
        }
        finish(() =>
          resolve({ status: 'uploaded', upload: response.upload as Record<string, unknown> })
        )
        return
      }

      if (response.status === 'delegated' && response.route === 'chat') {
        finish(() => resolve({ status: 'delegated', route: 'chat' }))
        return
      }

      finish(() => reject(createNativeUploadError(response)))
    }

    const timeout = window.setTimeout(() => {
      finish(() => reject(new Error(`Timed out waiting for Discourse to upload ${file.name}`)))
    }, NATIVE_UPLOAD_TIMEOUT_MS)

    window.addEventListener('message', onMessage)
    window.postMessage(
      {
        channel: BRIDGE_CHANNEL,
        direction: 'request',
        action: 'upload',
        id,
        routeContext,
        file
      },
      pageOrigin()
    )
  })
}
