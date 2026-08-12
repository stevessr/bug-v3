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
      target: ts.ScriptTarget.ES2020,
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

const vmModule = loadTypeScriptModule('src/agent/browserVm.ts', {
  './executeActions': { executeAgentActions: async () => [] }
})
const scriptModule = loadTypeScriptModule('src/agent/scriptRunner.ts', {
  './mcpClient': { callMcpTool: async () => ({ result: null }) },
  './browserVm': vmModule
})

const settings = {
  providerProfiles: [],
  baseUrl: '',
  apiKey: '',
  apiFlavor: 'messages',
  taskModel: '',
  reasoningModel: '',
  imageModel: '',
  maxTokens: 1024,
  masterSystemPrompt: '',
  enableThoughts: false,
  enableMcp: false,
  mcpServers: [],
  folderRoots: [],
  subagents: []
}

const permissions = {
  click: true,
  scroll: true,
  touch: false,
  screenshot: true,
  navigate: true,
  tabs: true,
  debugger: false,
  clickDom: true,
  input: true,
  fileAccess: false
}

test('browser VM keeps virtual files in WASM memory and never touches host files', async () => {
  const instance = new vmModule.BrowserVmInstance('test-vm')
  const write = await instance.operate(
    { operation: 'write-file', path: '/notes.txt', content: 'hello wasm' },
    permissions,
    settings
  )
  assert.equal(write.success, true)
  assert.equal(write.data.path, '/notes.txt')
  assert.ok(instance.memory instanceof WebAssembly.Memory)

  const read = await instance.operate(
    { operation: 'read-file', path: '/notes.txt' },
    permissions,
    settings
  )
  assert.equal(read.data.content, 'hello wasm')

  const snapshot = await instance.operate({ operation: 'snapshot' }, permissions, settings)
  assert.equal(snapshot.success, true)
  assert.equal(snapshot.data.files[0].path, '/notes.txt')
})

test('browser VM rejects traversal paths', async () => {
  const instance = new vmModule.BrowserVmInstance('safe-vm')
  const result = await instance.operate(
    { operation: 'write-file', path: '/../escape.txt', content: 'nope' },
    permissions,
    settings
  )
  assert.equal(result.success, false)
  assert.match(result.error, /不能包含/)
})

test('script skills receive the same VM instance instead of a host filesystem API', async () => {
  const result = await scriptModule.executeScript(
    "vm.writeFile('/skill.txt', 'from script'); return vm.readFile('/skill.txt').content;",
    { args: {}, sessionId: 'script-vm-test' },
    []
  )
  assert.equal(result.success, true)
  assert.equal(result.result, 'from script')
})
