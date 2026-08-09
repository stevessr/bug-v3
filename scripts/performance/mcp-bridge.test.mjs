import assert from 'node:assert/strict'
import net from 'node:net'
import path from 'node:path'
import { spawn } from 'node:child_process'
import test from 'node:test'

const repoRoot = path.resolve(import.meta.dirname, '../..')
const hostScript = path.join(repoRoot, 'scripts/mcp-bridge/server.js')

async function getFreePort() {
  const server = net.createServer()
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : 0
  await new Promise(resolve => server.close(resolve))
  return port
}

function frame(message) {
  const payload = Buffer.from(JSON.stringify(message), 'utf8')
  const header = Buffer.alloc(4)
  header.writeUInt32LE(payload.length, 0)
  return Buffer.concat([header, payload])
}

function startNativeHost() {
  const child = spawn(process.execPath, [hostScript], {
    cwd: repoRoot,
    stdio: ['pipe', 'pipe', 'pipe']
  })
  let buffer = Buffer.alloc(0)
  const messages = []
  const waiters = []

  const flush = () => {
    while (buffer.length >= 4) {
      const length = buffer.readUInt32LE(0)
      if (buffer.length < length + 4) return
      const payload = buffer.subarray(4, length + 4)
      buffer = buffer.subarray(length + 4)
      const message = JSON.parse(payload.toString('utf8'))
      messages.push(message)
      for (const waiter of [...waiters]) {
        if (!waiter.predicate(message)) continue
        waiters.splice(waiters.indexOf(waiter), 1)
        clearTimeout(waiter.timeout)
        waiter.resolve(message)
      }
    }
  }

  child.stdout.on('data', chunk => {
    buffer = Buffer.concat([buffer, chunk])
    flush()
  })
  // Native stdout is reserved for framed messages; consume stderr so a noisy
  // host cannot block the child during this smoke test.
  child.stderr.resume()

  const waitFor = (predicate, timeoutMs = 3000) => {
    const existing = messages.find(predicate)
    if (existing) return Promise.resolve(existing)
    return new Promise((resolve, reject) => {
      const waiter = {
        predicate,
        resolve,
        reject,
        timeout: setTimeout(() => {
          waiters.splice(waiters.indexOf(waiter), 1)
          reject(new Error('Timed out waiting for native host message'))
        }, timeoutMs)
      }
      waiters.push(waiter)
    })
  }

  return {
    child,
    send(message) {
      child.stdin.write(frame(message))
    },
    waitFor
  }
}

async function postRpc(url, payload) {
  const response = await fetch(`${url}/mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload)
  })
  return { response, body: response.status === 204 ? null : await response.json() }
}

test('native MCP host starts on extension config and serves Streamable HTTP', async () => {
  const port = await getFreePort()
  const bridge = startNativeHost()
  const url = `http://127.0.0.1:${port}`

  try {
    await bridge.waitFor(message => message.type === 'MCP_HOST_READY')
    bridge.send({ type: 'MCP_CONFIG', port })
    await bridge.waitFor(message => message.type === 'MCP_SERVER_STARTED')

    const health = await fetch(`${url}/health`)
    assert.equal(health.status, 200)
    const healthBody = await health.json()
    assert.equal(healthBody.ok, true)
    assert.equal(healthBody.transport, 'native-messaging')
    assert.equal(healthBody.extensionConnected, true)
    assert.equal(typeof healthBody.tools, 'number')

    const initialized = await postRpc(url, {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: '2024-11-05' }
    })
    assert.equal(initialized.response.status, 200)
    assert.equal(initialized.body.result.protocolVersion, '2024-11-05')

    const listed = await postRpc(url, { jsonrpc: '2.0', id: 2, method: 'tools/list' })
    assert.equal(listed.response.status, 200)
    assert.ok(listed.body.result.tools.length > 0)
    assert.ok('inputSchema' in listed.body.result.tools[0])
    const toolNames = new Set(listed.body.result.tools.map(tool => tool.name))
    assert.deepEqual(
      [
        'chrome.debug_start',
        'chrome.console_logs',
        'chrome.network_log',
        'chrome.debug_stop'
      ].filter(name => !toolNames.has(name)),
      []
    )

    const invalidProtocol = await postRpc(url, { jsonrpc: '1.0', id: 3, method: 'ping' })
    assert.equal(invalidProtocol.body.error.code, -32600)

    const notification = await postRpc(url, {
      jsonrpc: '2.0',
      method: 'notifications/initialized'
    })
    assert.equal(notification.response.status, 204)
  } finally {
    bridge.child.stdin.end()
    await new Promise(resolve => {
      const timeout = setTimeout(() => {
        bridge.child.kill('SIGTERM')
        resolve()
      }, 3000)
      bridge.child.once('exit', () => {
        clearTimeout(timeout)
        resolve()
      })
    })
  }
})
