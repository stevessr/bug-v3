import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'

const bridgeSource = fs.readFileSync('public/js/discourse-native-upload.js', 'utf8')
const channel = 'emoji-extension:discourse-native-upload:v1'

class FakeAppEvents {
  listeners = new Map()

  on(name, callback) {
    const callbacks = this.listeners.get(name) || new Set()
    callbacks.add(callback)
    this.listeners.set(name, callbacks)
  }

  off(name, callback) {
    this.listeners.get(name)?.delete(callback)
  }

  has(name) {
    return Boolean(this.listeners.get(name)?.size)
  }

  trigger(name, ...args) {
    for (const callback of [...(this.listeners.get(name) || [])]) {
      callback(...args)
    }
  }
}

function createBridgeHarness({ appEvents = new FakeAppEvents(), chatInput = null } = {}) {
  const messageListeners = new Set()
  const responses = []
  const window = {
    location: { origin: 'https://forum.example', pathname: '/t/example/1' },
    Discourse: {
      __container__: {
        lookup(name) {
          return name === 'service:app-events' ? appEvents : null
        }
      }
    },
    addEventListener(name, callback) {
      if (name === 'message') messageListeners.add(callback)
    },
    postMessage(data) {
      if (data.direction === 'response') responses.push(data)
      queueMicrotask(() => {
        for (const callback of [...messageListeners]) {
          callback({ source: window, origin: window.location.origin, data })
        }
      })
    },
    setTimeout,
    clearTimeout
  }

  const document = {
    querySelector(selector) {
      if (selector.includes('.chat-composer:not')) return null
      if (chatInput && selector.includes('file-uploader')) return chatInput
      return null
    }
  }

  class FakeDataTransfer {
    files = []
    items = {
      add: file => {
        this.files.push(file)
      }
    }
  }

  class FakeEvent {
    constructor(type, options) {
      this.type = type
      Object.assign(this, options)
    }
  }

  vm.runInNewContext(bridgeSource, {
    window,
    document,
    DataTransfer: FakeDataTransfer,
    Event: FakeEvent,
    Promise,
    queueMicrotask,
    setTimeout,
    clearTimeout
  })

  async function request(file, routeContext = 'composer') {
    const id = `request-${Math.random()}`
    window.postMessage({
      channel,
      direction: 'request',
      action: 'upload',
      id,
      routeContext,
      file
    })

    for (let attempt = 0; attempt < 50; attempt++) {
      const response = responses.find(item => item.id === id)
      if (response) return response
      await new Promise(resolve => setTimeout(resolve, 0))
    }

    throw new Error(`No bridge response for ${id}`)
  }

  return { appEvents, request, window }
}

test('composer requests use Discourse appEvents with duplicate insertion disabled', async () => {
  const appEvents = new FakeAppEvents()
  let nativeRequest
  appEvents.on('composer:add-files', (file, options) => {
    nativeRequest = { file, options }
    appEvents.trigger('composer:upload-started', file.name)
    appEvents.trigger('composer:upload-success', file.name, {
      id: 7,
      url: '/uploads/default/original/example.png',
      short_url: 'upload://example'
    })
  })

  const harness = createBridgeHarness({ appEvents })
  const file = new File(['image'], 'example.png', { type: 'image/png' })
  const response = await harness.request(file)

  assert.equal(response.status, 'uploaded')
  assert.equal(response.upload.id, 7)
  assert.equal(nativeRequest.file.name, 'example.png')
  assert.equal(nativeRequest.options.skipPlaceholder, true)
  assert.deepEqual(Object.keys(nativeRequest.options), ['skipPlaceholder'])
})

test('composer requests report native Uppy errors without asking for a direct retry', async () => {
  const appEvents = new FakeAppEvents()
  appEvents.on('composer:add-files', file => {
    const error = Object.assign(new Error('rate limited by site uploader'), { status: 429 })
    appEvents.trigger('composer:upload-error', { name: file.name, meta: { error } })
  })

  const harness = createBridgeHarness({ appEvents })
  const response = await harness.request(new File(['image'], 'limited.png'))

  assert.equal(response.status, 'error')
  assert.equal(response.error.message, 'rate limited by site uploader')
  assert.equal(response.error.status, 429)
  assert.equal(response.error.errorType, 'rate_limit')
})

test('chat requests are handed to the active route file input', async () => {
  let dispatchedEvent
  const chatInput = {
    disabled: false,
    isConnected: true,
    files: null,
    dispatchEvent(event) {
      dispatchedEvent = event
      return true
    }
  }
  const harness = createBridgeHarness({ chatInput })
  harness.window.location.pathname = '/chat/c/example/1'

  const file = new File(['image'], 'chat.png', { type: 'image/png' })
  const response = await harness.request(file, 'chat')

  assert.equal(response.status, 'delegated')
  assert.equal(response.route, 'chat')
  assert.equal(chatInput.files[0].name, 'chat.png')
  assert.equal(dispatchedEvent.type, 'change')
  assert.equal(dispatchedEvent.bubbles, true)
})

test('the bridge only reports unavailable before a native uploader accepts the file', async () => {
  const harness = createBridgeHarness()
  const response = await harness.request(new File(['image'], 'fallback.png'))

  assert.equal(response.status, 'unavailable')
  assert.match(response.reason, /not ready/)
})

test('injected upload core tries the route uploader before direct multipart fallback', () => {
  const source = fs.readFileSync('src/content/utils/upload/core.ts', 'utf8')
  const nativeCall = source.indexOf('await uploadThroughDiscourseRoute(file, routeContext)')
  const linuxDoFallback = source.indexOf(
    'isLinuxDoDiscourseBase(window.location.origin)',
    nativeCall
  )
  const genericFallback = source.indexOf("formData.append('upload_type', 'composer')", nativeCall)

  assert.ok(nativeCall >= 0)
  assert.ok(linuxDoFallback > nativeCall)
  assert.ok(genericFallback > nativeCall)
})
