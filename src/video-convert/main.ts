/**
 * Internal extension page that performs video → animation conversion for the
 * injected (forum page) uploader. Content scripts cannot spawn extension workers or
 * run the FFmpeg WASM core under a web page's origin, so they load this page in a
 * hidden iframe and talk to it over a private MessageChannel.
 */
import {
  VIDEO_CONVERT_INIT_MESSAGE,
  type VideoConvertPortRequest,
  type VideoConvertPortResponse
} from './protocol'

const controllers = new Map<string, AbortController>()

const attachPort = (port: MessagePort) => {
  const send = (message: VideoConvertPortResponse) => port.postMessage(message)

  port.onmessage = async (event: MessageEvent<VideoConvertPortRequest>) => {
    const request = event.data
    if (!request || typeof request !== 'object') return

    if (request.type === 'cancel') {
      controllers.get(request.id)?.abort(new DOMException('已取消', 'AbortError'))
      return
    }
    if (request.type !== 'convert' || !(request.file instanceof Blob)) return

    const { id, file, options } = request
    const controller = new AbortController()
    controllers.set(id, controller)
    try {
      const { convertVideoToAnimation } = await import('@/utils/video/videoToAnimationService')
      const result = await convertVideoToAnimation(file, {
        ...options,
        fileName: file instanceof File ? file.name : undefined,
        signal: controller.signal,
        onProgress: progress => send({ type: 'progress', id, progress })
      })
      send({ type: 'result', id, file: result.file, warning: result.warning })
    } catch (error) {
      const aborted = controller.signal.aborted || (error as Error)?.name === 'AbortError'
      send({
        type: 'error',
        id,
        aborted,
        message: error instanceof Error ? error.message : String(error)
      })
    } finally {
      controllers.delete(id)
    }
  }
  port.start()
  send({ type: 'ready' })
}

window.addEventListener('message', event => {
  // Only the embedding page may hand us a port; the port itself is the capability.
  if (event.source !== window.parent) return
  if (event.data?.type !== VIDEO_CONVERT_INIT_MESSAGE || !event.ports?.[0]) return
  attachPort(event.ports[0])
})
