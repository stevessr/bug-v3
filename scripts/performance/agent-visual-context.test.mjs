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

const images = loadTypeScriptModule('src/agent/imageAttachments.ts')
const tinyPng =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='

test('visual context validates image data URLs and summaries never retain pixels', () => {
  const parsed = images.parseAgentImageDataUrl(tinyPng)
  assert.equal(parsed.mimeType, 'image/png')
  assert.ok(parsed.estimatedBytes > 0)
  assert.equal(images.parseAgentImageDataUrl('data:text/plain;base64,SGVsbG8='), null)
  assert.equal(images.parseAgentImageDataUrl('https://example.com/image.png'), null)

  const summary = images.summarizeAgentImageAttachment({
    id: 'image-1',
    name: 'page.png',
    mimeType: 'image/png',
    size: parsed.estimatedBytes,
    width: 1,
    height: 1,
    source: 'screenshot',
    dataUrl: tinyPng
  })
  assert.equal('dataUrl' in summary, false)
  assert.equal(summary.name, 'page.png')
})

test('AgentThread forwards mixed text and images to the PI runtime without flattening pixels', async () => {
  let received
  const threadModule = loadTypeScriptModule('src/agent/agentThread.ts', {
    './agentService': {
      async runAgentMessage(input, _settings, _subagent, _context, options) {
        received = { input, options }
        return {
          threadId: options.sessionId,
          message: { id: 'answer', role: 'assistant', content: 'ok' },
          actions: []
        }
      },
      async runAgentFollowup() {
        return { message: { id: 'followup', role: 'assistant', content: 'ok' }, actions: [] }
      }
    }
  })
  const thread = new threadModule.AgentCodex({ settings: {} }).startThread()
  const result = await thread.runRaw([
    { type: 'text', text: 'Inspect this region' },
    { type: 'image', dataUrl: tinyPng, name: 'region.png' }
  ])

  assert.equal(received.input, 'Inspect this region')
  assert.deepEqual(received.options.images, [tinyPng])
  assert.equal(result.message.content, 'ok')
})

test('browser AI runtime sends image blocks but strips pixel data from persisted thread state', () => {
  const runtimeSource = fs.readFileSync(path.join(repoRoot, 'src/agent/piRuntime.ts'), 'utf8')
  const sidebarSource = fs.readFileSync(path.join(repoRoot, 'src/sidebar/Agent.vue'), 'utf8')
  assert.match(runtimeSource, /completeBrowserAi/)
  assert.match(runtimeSource, /原始数据未持久化/)
  assert.doesNotMatch(runtimeSource, new RegExp('@' + 'mariozechner'))
  assert.doesNotMatch(runtimeSource, new RegExp('@' + 'anthropic-ai/sdk'))
  assert.match(sidebarSource, /summarizeAgentImageAttachment/)
  assert.match(sidebarSource, /AgentImageCropModal/)
})
