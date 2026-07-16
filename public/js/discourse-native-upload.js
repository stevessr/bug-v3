;(function () {
  const bridgeFlag = '__EMOJI_EXTENSION_DISCOURSE_NATIVE_UPLOAD_BRIDGE__'
  const channel = 'emoji-extension:discourse-native-upload:v1'
  const uploadTimeoutMs = 5 * 60 * 1000

  if (window[bridgeFlag]) return
  window[bridgeFlag] = true

  function targetOrigin() {
    return window.location.origin === 'null' ? '*' : window.location.origin
  }

  function respond(id, status, payload) {
    window.postMessage(
      {
        channel,
        direction: 'response',
        id,
        status,
        ...(payload || {})
      },
      targetOrigin()
    )
  }

  function getAppEvents() {
    try {
      return window.Discourse?.__container__?.lookup?.('service:app-events') || null
    } catch {
      return null
    }
  }

  function hasComposerUploader(appEvents) {
    if (!appEvents) return false

    try {
      if (typeof appEvents.has === 'function') {
        return appEvents.has('composer:add-files')
      }
    } catch {
      // Older Discourse versions may not expose Evented#has consistently.
    }

    return Boolean(
      document.querySelector(
        'textarea.d-editor-input, .d-editor-input[contenteditable="true"], #reply-control.open'
      )
    )
  }

  function isUsableFile(value) {
    return Boolean(
      value &&
      typeof value.name === 'string' &&
      typeof value.size === 'number' &&
      typeof value.arrayBuffer === 'function'
    )
  }

  function matchesFileName(value, expectedName) {
    const name = value?.name || value?.data?.name
    return typeof name === 'string' && name === expectedName
  }

  function serializeError(value, fallbackMessage) {
    const candidate = value?.meta?.error || value?.error || value
    const message =
      (typeof candidate === 'string' && candidate) ||
      candidate?.message ||
      value?.message ||
      fallbackMessage
    const status =
      candidate?.status ||
      candidate?.statusCode ||
      candidate?.response?.status ||
      value?.response?.status

    return {
      message: String(message || 'Discourse native upload failed'),
      status: typeof status === 'number' ? status : undefined,
      errorType: status === 429 ? 'rate_limit' : 'upload_failed'
    }
  }

  function findChatFileInput() {
    const activeComposer = document.querySelector(
      '.chat-composer:not([hidden]), .chat-composer__inner-container:not([hidden])'
    )
    const selectors = [
      '#channel-file-uploader',
      '#thread-file-uploader',
      'input[type="file"][id$="-file-uploader"]'
    ]

    for (const selector of selectors) {
      const scoped = activeComposer?.querySelector?.(selector)
      if (scoped && !scoped.disabled && scoped.isConnected) return scoped

      const candidate = document.querySelector(selector)
      if (candidate && !candidate.disabled && candidate.isConnected) return candidate
    }

    return null
  }

  function delegateToChat(file) {
    const input = findChatFileInput()
    if (!input || typeof DataTransfer !== 'function') {
      return false
    }

    const transfer = new DataTransfer()
    transfer.items.add(file)
    input.files = transfer.files
    input.dispatchEvent(new Event('change', { bubbles: true, composed: true }))
    return true
  }

  function uploadThroughComposer(file) {
    return new Promise(resolve => {
      const appEvents = getAppEvents()
      if (!hasComposerUploader(appEvents)) {
        resolve({ status: 'unavailable', reason: 'Discourse composer uploader is not ready' })
        return
      }

      let settled = false
      let started = false

      const cleanup = () => {
        clearTimeout(timeout)
        appEvents.off('composer:upload-started', onStarted)
        appEvents.off('composer:upload-success', onSuccess)
        appEvents.off('composer:upload-error', onError)
        appEvents.off('composer:uploads-aborted', onAborted)
        appEvents.off('composer:uploads-cancelled', onCancelled)
      }

      const finish = result => {
        if (settled) return
        settled = true
        cleanup()
        resolve(result)
      }

      const onStarted = fileName => {
        if (fileName === file.name) started = true
      }

      const onSuccess = (fileName, upload) => {
        if (fileName !== file.name) return
        finish({ status: 'uploaded', upload })
      }

      const onError = uppyFile => {
        if (!matchesFileName(uppyFile, file.name)) return
        finish({
          status: 'error',
          error: serializeError(uppyFile, `Discourse failed to upload ${file.name}`)
        })
      }

      const onAborted = () => {
        finish({
          status: 'error',
          error: {
            message: `Discourse rejected ${file.name} before upload`,
            errorType: 'upload_rejected'
          }
        })
      }

      const onCancelled = () => {
        finish({
          status: 'error',
          error: {
            message: `Discourse cancelled ${file.name}`,
            errorType: 'upload_cancelled'
          }
        })
      }

      const timeout = window.setTimeout(() => {
        finish({
          status: 'error',
          error: {
            message: started
              ? `Discourse timed out while uploading ${file.name}`
              : `Discourse did not accept ${file.name}`,
            errorType: 'upload_timeout'
          }
        })
      }, uploadTimeoutMs)

      appEvents.on('composer:upload-started', onStarted)
      appEvents.on('composer:upload-success', onSuccess)
      appEvents.on('composer:upload-error', onError)
      appEvents.on('composer:uploads-aborted', onAborted)
      appEvents.on('composer:uploads-cancelled', onCancelled)

      try {
        // The extension keeps its own insertion/diff semantics, so Discourse
        // should run validation, preprocessing and transport without adding a
        // second composer placeholder.
        appEvents.trigger('composer:add-files', file, { skipPlaceholder: true })
      } catch (error) {
        finish({
          status: 'error',
          error: serializeError(error, `Could not hand ${file.name} to Discourse`)
        })
      }
    })
  }

  async function handleUploadRequest(data) {
    const { id, file } = data
    const routeContext = ['composer', 'chat'].includes(data.routeContext)
      ? data.routeContext
      : 'auto'

    if (!isUsableFile(file)) {
      respond(id, 'error', {
        error: { message: 'The native upload bridge received an invalid file', errorType: 'input' }
      })
      return
    }

    const chatRouteIsActive =
      routeContext === 'chat' ||
      (routeContext === 'auto' &&
        (window.location.pathname.startsWith('/chat') || Boolean(findChatFileInput())))

    if (chatRouteIsActive) {
      try {
        if (delegateToChat(file)) {
          respond(id, 'delegated', { route: 'chat', fileName: file.name })
        } else {
          respond(id, 'unavailable', { reason: 'Discourse chat uploader is not ready' })
        }
      } catch (error) {
        respond(id, 'error', {
          error: serializeError(error, `Could not hand ${file.name} to Discourse chat`)
        })
      }
      return
    }

    const result = await uploadThroughComposer(file)
    respond(id, result.status, result)
  }

  let requestQueue = Promise.resolve()

  window.addEventListener('message', event => {
    if (event.source !== window) return

    const data = event.data
    if (
      !data ||
      data.channel !== channel ||
      data.direction !== 'request' ||
      data.action !== 'upload' ||
      typeof data.id !== 'string'
    ) {
      return
    }

    requestQueue = requestQueue
      .then(() => handleUploadRequest(data))
      .catch(error => {
        respond(data.id, 'error', {
          error: serializeError(error, 'Unexpected Discourse native upload bridge error')
        })
      })
  })
})()
