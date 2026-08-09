import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { createRequire } from 'node:module'

import ts from 'typescript'

const repoRoot = path.resolve(import.meta.dirname, '../..')
const nodeRequire = createRequire(import.meta.url)

function loadTypeScriptModule(relativePath, dependencies = {}) {
  const source = fs.readFileSync(path.join(repoRoot, relativePath), 'utf8')
  const output = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true
    },
    fileName: relativePath
  }).outputText
  const module = { exports: {} }
  const localRequire = specifier => {
    if (Object.hasOwn(dependencies, specifier)) return dependencies[specifier]
    return nodeRequire(specifier)
  }
  new Function('require', 'module', 'exports', output)(localRequire, module, module.exports)
  return module.exports
}

function createChromeEvent() {
  const listeners = []
  return {
    addListener(listener) {
      listeners.push(listener)
    },
    emit(...args) {
      for (const listener of listeners) listener(...args)
    }
  }
}

test('debugger collector captures sanitized console and network evidence', async () => {
  const commands = []
  const attachments = []
  const detachments = []
  const onEvent = createChromeEvent()
  const onDetach = createChromeEvent()
  const onRemoved = createChromeEvent()
  const chromeMock = {
    tabs: { onRemoved },
    debugger: {
      onEvent,
      onDetach,
      async attach(target, version) {
        attachments.push([target, version])
      },
      async sendCommand(target, method, params) {
        commands.push([target, method, params])
        return {}
      },
      async detach(target) {
        detachments.push(target)
      }
    }
  }
  const debuggerModule = loadTypeScriptModule('src/background/handlers/agentDebugger.ts', {
    '../utils/main': { getChromeAPI: () => chromeMock }
  })

  const started = await debuggerModule.startAgentDebugSession(
    42,
    { captureConsole: true, captureNetwork: true },
    chromeMock
  )
  assert.equal(started.attached, true)
  assert.deepEqual(attachments, [[{ tabId: 42 }, '1.3']])
  assert.deepEqual(
    commands.map(command => command[1]),
    ['Runtime.enable', 'Log.enable', 'Network.enable']
  )

  onEvent.emit({ tabId: 42 }, 'Runtime.consoleAPICalled', {
    type: 'warning',
    timestamp: 1000,
    args: [
      { type: 'string', value: 'retrying' },
      { type: 'number', value: 2 }
    ],
    stackTrace: {
      callFrames: [
        {
          url: 'https://example.com/app.js?token=secret',
          lineNumber: 12,
          columnNumber: 4
        }
      ]
    }
  })
  onEvent.emit({ tabId: 42 }, 'Log.entryAdded', {
    entry: {
      level: 'error',
      source: 'network',
      text: 'Failed to load resource',
      timestamp: 1001,
      url: 'https://example.com/api?api_key=secret'
    }
  })

  onEvent.emit({ tabId: 42 }, 'Network.requestWillBeSent', {
    requestId: 'request-1',
    timestamp: 10,
    wallTime: 2_000,
    type: 'Fetch',
    request: {
      method: 'POST',
      url: 'https://example.com/api?token=secret&view=full'
    }
  })
  onEvent.emit({ tabId: 42 }, 'Network.responseReceived', {
    requestId: 'request-1',
    type: 'Fetch',
    response: {
      url: 'https://example.com/api?token=secret&view=full',
      status: 500,
      statusText: 'Server Error',
      mimeType: 'application/json',
      fromDiskCache: false,
      fromServiceWorker: true
    }
  })
  onEvent.emit({ tabId: 42 }, 'Network.loadingFinished', {
    requestId: 'request-1',
    timestamp: 10.25,
    encodedDataLength: 512
  })

  const consoleResult = debuggerModule.readAgentConsole(42)
  assert.equal(consoleResult.entries.length, 2)
  assert.equal(consoleResult.entries[0].text, 'retrying 2')
  assert.match(consoleResult.entries[0].url, /token=%3Credacted%3E/)
  assert.match(consoleResult.entries[1].url, /api_key=%3Credacted%3E/)

  const networkResult = debuggerModule.readAgentNetwork(42)
  assert.equal(networkResult.entries.length, 1)
  assert.equal(networkResult.entries[0].status, 500)
  assert.equal(networkResult.entries[0].durationMs, 250)
  assert.equal(networkResult.entries[0].encodedDataLength, 512)
  assert.equal(networkResult.entries[0].fromServiceWorker, true)
  assert.match(networkResult.entries[0].url, /token=%3Credacted%3E/)
  assert.equal('protocolStartedAt' in networkResult.entries[0], false)

  const cleared = debuggerModule.readAgentConsole(42, { clear: true })
  assert.equal(cleared.entries.length, 2)
  assert.equal(debuggerModule.readAgentConsole(42).entries.length, 0)

  await debuggerModule.stopAgentDebugSession(42, chromeMock)
  assert.deepEqual(detachments, [{ tabId: 42 }])

  await debuggerModule.startAgentDebugSession(43, {}, chromeMock)
  onRemoved.emit(43)
  assert.throws(() => debuggerModule.readAgentConsole(43), /尚未启动/)
})

test('PI debug actions route the selected tab through the background service', async () => {
  const tabActions = loadTypeScriptModule('src/agent/tabActions.ts')
  const debugActions = loadTypeScriptModule('src/agent/debugActions.ts', {
    './tabActions': tabActions
  })
  const messages = []
  const chromeMock = {
    runtime: {
      lastError: null,
      sendMessage(message, callback) {
        messages.push(message)
        callback({ success: true, data: { entries: [] } })
      }
    }
  }

  const result = await debugActions.executeDebugAction(
    chromeMock,
    { id: 'console', type: 'read-console', tabId: 9, clear: true, limit: 25 },
    1
  )
  assert.deepEqual(result, { entries: [] })
  assert.deepEqual(messages, [
    {
      type: 'AGENT_DEBUG_READ_CONSOLE',
      tabId: 9,
      clear: true,
      limit: 25
    }
  ])
})
