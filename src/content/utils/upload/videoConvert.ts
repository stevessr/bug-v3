import { notify } from '../ui/notify'

import {
  loadVideoConvertSettings,
  type VideoConvertSettings
} from '@/utils/video/videoConvertSettings'
import type { VideoConvertProgress } from '@/utils/video/videoAnimationArgs'
import {
  VIDEO_CONVERT_INIT_MESSAGE,
  type VideoConvertPortRequest,
  type VideoConvertPortResponse
} from '@/video-convert/protocol'

/**
 * Converts videos picked in the injected uploader into the animation format the user
 * configured in the options page (BufferPage → 视频转动图). The conversion itself runs
 * in a hidden extension iframe (video-convert.html); this module only talks to it.
 */
const IDLE_TEARDOWN_MS = 60_000
const READY_TIMEOUT_MS = 20_000
const CONVERT_TIMEOUT_MS = 6 * 60_000

interface ConverterSession {
  iframe: HTMLIFrameElement
  port: MessagePort
}

let sessionPromise: Promise<ConverterSession> | null = null
let activeJobs = 0
let idleTimer: ReturnType<typeof setTimeout> | null = null

const teardownSession = () => {
  const pending = sessionPromise
  sessionPromise = null
  void pending?.then(
    session => {
      session.port.close()
      session.iframe.remove()
    },
    () => undefined
  )
}

const scheduleIdleTeardown = () => {
  if (idleTimer) clearTimeout(idleTimer)
  idleTimer = setTimeout(() => {
    if (activeJobs === 0) teardownSession()
  }, IDLE_TEARDOWN_MS)
}

const createSession = (): Promise<ConverterSession> =>
  new Promise((resolve, reject) => {
    const runtime = (globalThis as { chrome?: typeof chrome }).chrome?.runtime
    if (!runtime?.getURL) {
      reject(new Error('扩展上下文不可用，无法转换视频'))
      return
    }

    const url = runtime.getURL('video-convert.html')
    const iframe = document.createElement('iframe')
    iframe.src = url
    iframe.setAttribute('aria-hidden', 'true')
    iframe.tabIndex = -1
    iframe.style.cssText =
      'position:fixed;left:-9999px;top:0;width:1px;height:1px;border:0;opacity:0;pointer-events:none;'

    const channel = new MessageChannel()
    const fail = (error: Error) => {
      clearTimeout(timer)
      channel.port1.close()
      iframe.remove()
      reject(error)
    }
    const timer = setTimeout(() => fail(new Error('视频转换模块加载超时')), READY_TIMEOUT_MS)

    channel.port1.onmessage = (event: MessageEvent<VideoConvertPortResponse>) => {
      if (event.data?.type !== 'ready') return
      clearTimeout(timer)
      channel.port1.onmessage = null
      resolve({ iframe, port: channel.port1 })
    }
    iframe.addEventListener(
      'load',
      () => {
        try {
          const origin = new URL(url).origin
          iframe.contentWindow?.postMessage({ type: VIDEO_CONVERT_INIT_MESSAGE }, origin, [
            channel.port2
          ])
        } catch (error) {
          fail(error instanceof Error ? error : new Error(String(error)))
        }
      },
      { once: true }
    )
    iframe.addEventListener('error', () => fail(new Error('视频转换模块加载失败')), { once: true })
    document.documentElement.appendChild(iframe)
  })

const getSession = (): Promise<ConverterSession> => {
  if (!sessionPromise) {
    sessionPromise = createSession()
    sessionPromise.catch(() => {
      sessionPromise = null
    })
  }
  return sessionPromise
}

const runConversion = async (
  file: File,
  settings: VideoConvertSettings,
  onProgress?: (progress: VideoConvertProgress) => void
): Promise<File> => {
  const session = await getSession()
  const id = `vc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

  return await new Promise<File>((resolve, reject) => {
    const done = (finish: () => void) => {
      clearTimeout(timer)
      session.port.removeEventListener('message', listener)
      finish()
    }
    const listener = (event: Event) => {
      const data = (event as MessageEvent<VideoConvertPortResponse>).data
      if (!data || data.type === 'ready' || !('id' in data) || data.id !== id) return
      if (data.type === 'progress') {
        onProgress?.(data.progress)
      } else if (data.type === 'result') {
        if (data.warning) notify(data.warning, 'info')
        done(() => resolve(data.file))
      } else if (data.type === 'error') {
        done(() => reject(new Error(data.message)))
      }
    }
    const timer = setTimeout(() => {
      const cancel: VideoConvertPortRequest = { type: 'cancel', id }
      session.port.postMessage(cancel)
      done(() => reject(new Error('视频转换超时')))
    }, CONVERT_TIMEOUT_MS)

    session.port.addEventListener('message', listener)
    session.port.start()

    const request: VideoConvertPortRequest = {
      type: 'convert',
      id,
      file,
      options: {
        format: settings.format,
        fps: settings.fps,
        maxWidth: settings.maxWidth,
        quality: settings.quality,
        gifProfile: settings.gifProfile,
        webpLossless: settings.webpLossless
      }
    }
    session.port.postMessage(request)
  })
}

/**
 * Convert a video with the saved settings. Resolves to the original file untouched when
 * auto-conversion is turned off in the options page.
 */
export async function convertVideoForUpload(
  file: File,
  onProgress?: (progress: VideoConvertProgress) => void
): Promise<File> {
  const settings = await loadVideoConvertSettings()
  if (!settings.autoConvertOnUpload) return file

  activeJobs++
  if (idleTimer) clearTimeout(idleTimer)
  notify(`正在将视频「${file.name}」转换为 ${settings.format.toUpperCase()}...`, 'info')
  try {
    return await runConversion(file, settings, onProgress)
  } finally {
    activeJobs--
    if (activeJobs === 0) scheduleIdleTeardown()
  }
}
