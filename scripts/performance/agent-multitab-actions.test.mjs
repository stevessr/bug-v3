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

const tabActions = loadTypeScriptModule('src/agent/tabActions.ts')
const debugActions = loadTypeScriptModule('src/agent/debugActions.ts', {
  './tabActions': tabActions
})
const executeActions = loadTypeScriptModule('src/agent/executeActions.ts', {
  './folderAccess': {
    executeFolderAction: async action => ({
      id: action.id,
      type: action.type,
      success: true
    })
  },
  './debugActions': debugActions,
  './tabActions': tabActions
})
const defaultSettingsModule = loadTypeScriptModule('src/agent/defaultSettings.ts', {
  './plugins': { defaultEnabledPluginIds: () => [] }
})
const storageModule = loadTypeScriptModule('src/agent/storage.ts', {
  './defaultSettings': defaultSettingsModule
})

const permissions = {
  click: true,
  scroll: true,
  touch: true,
  screenshot: true,
  navigate: true,
  tabs: true,
  debugger: true,
  clickDom: true,
  input: true,
  fileAccess: false
}

function makeTab(id, overrides = {}) {
  return {
    id,
    windowId: 1,
    index: id,
    title: `Tab ${id}`,
    url: `https://example.com/${id}`,
    active: id === 1,
    pinned: false,
    discarded: false,
    status: 'complete',
    ...overrides
  }
}

test('PI browser actions can enumerate, open, focus, group, and close tabs', async () => {
  const calls = []
  const tabsById = new Map([
    [1, makeTab(1)],
    [2, makeTab(2)]
  ])
  const chromeMock = {
    tabs: {
      async query(query) {
        calls.push(['query', query])
        return [...tabsById.values()]
      },
      async create(options) {
        calls.push(['create', options])
        const tab = makeTab(3, { active: options.active ?? true, url: options.url })
        tabsById.set(3, tab)
        return tab
      },
      async get(tabId) {
        const tab = tabsById.get(tabId)
        if (!tab) throw new Error('missing tab')
        return tab
      },
      async update(tabId, changes) {
        calls.push(['update', tabId, changes])
        const next = { ...tabsById.get(tabId), ...changes }
        tabsById.set(tabId, next)
        return next
      },
      async remove(tabId) {
        calls.push(['remove', tabId])
        tabsById.delete(tabId)
      },
      async group(options) {
        calls.push(['group', options])
        return 17
      },
      async ungroup(tabIds) {
        calls.push(['ungroup', tabIds])
      }
    },
    tabGroups: {
      async update(groupId, changes) {
        calls.push(['group-update', groupId, changes])
      }
    },
    windows: {
      async update(windowId, changes) {
        calls.push(['window-update', windowId, changes])
      }
    }
  }

  const listed = await tabActions.executeTabAction(chromeMock, { id: 'list', type: 'list-tabs' }, 1)
  assert.equal(listed.count, 2)
  assert.deepEqual(calls[0], ['query', { currentWindow: true }])

  const opened = await tabActions.executeTabAction(
    chromeMock,
    {
      id: 'open',
      type: 'open-tab',
      url: 'https://example.com/new',
      active: false,
      waitForLoad: false
    },
    1
  )
  assert.equal(opened.tab.id, 3)
  assert.equal(opened.tab.url, 'https://example.com/new')

  await tabActions.executeTabAction(
    chromeMock,
    { id: 'activate', type: 'activate-tab', tabId: 2 },
    1
  )
  assert.ok(calls.some(call => call[0] === 'update' && call[1] === 2 && call[2].active))

  const grouped = await tabActions.executeTabAction(
    chromeMock,
    {
      id: 'group',
      type: 'group-tabs',
      tabIds: [1, 2],
      title: 'Research',
      color: 'blue'
    },
    1
  )
  assert.deepEqual(grouped, { groupId: 17, tabIds: [1, 2] })
  assert.ok(
    calls.some(
      call =>
        call[0] === 'group-update' &&
        call[1] === 17 &&
        call[2].title === 'Research' &&
        call[2].color === 'blue'
    )
  )

  await tabActions.executeTabAction(chromeMock, { id: 'close', type: 'close-tab', tabId: 3 }, 1)
  assert.equal(tabsById.has(3), false)
})

test('page actions honor per-action tabId and enforce derived permissions', async () => {
  const sent = []
  const updated = []
  const chromeMock = {
    runtime: {
      lastError: null,
      sendMessage(_message, callback) {
        callback({ success: true, data: 'screenshot' })
      }
    },
    tabs: {
      async query() {
        return [makeTab(1)]
      },
      async update(tabId, changes) {
        updated.push([tabId, changes])
        return makeTab(tabId, changes)
      },
      sendMessage(tabId, message, callback) {
        sent.push([tabId, message])
        callback({ success: true, data: { tabId } })
      }
    }
  }

  const previousChrome = globalThis.chrome
  globalThis.chrome = chromeMock
  try {
    const results = await executeActions.executeAgentActions(
      [
        {
          id: 'dom-7',
          type: 'getDOM',
          tabId: 7,
          options: { includeMarkdown: true }
        },
        {
          id: 'navigate-8',
          type: 'navigate',
          tabId: 8,
          url: 'https://example.com/next',
          waitForLoad: false
        }
      ],
      permissions,
      1
    )

    assert.equal(
      results.every(result => result.success),
      true
    )
    assert.equal(sent[0][0], 7)
    assert.equal(updated[0][0], 8)

    const denied = await executeActions.executeAgentActions(
      [{ id: 'double', type: 'double-click', selector: '#submit' }],
      { ...permissions, click: false },
      1
    )
    assert.equal(denied[0].success, false)
    assert.match(denied[0].error, /click/)

    const tabDenied = await executeActions.executeAgentActions(
      [{ id: 'tabs', type: 'list-tabs' }],
      { ...permissions, tabs: false },
      1
    )
    assert.equal(tabDenied[0].success, false)
    assert.match(tabDenied[0].error, /tabs/)

    const debugDenied = await executeActions.executeAgentActions(
      [{ id: 'debug', type: 'read-console' }],
      { ...permissions, debugger: false },
      1
    )
    assert.equal(debugDenied[0].success, false)
    assert.match(debugDenied[0].error, /debugger/)
  } finally {
    globalThis.chrome = previousChrome
  }
})

test('legacy agent presets inherit a safe multi-tab permission', () => {
  const previousLocalStorage = globalThis.localStorage
  const legacySettings = structuredClone(defaultSettingsModule.defaultAgentSettings)
  delete legacySettings.subagents[0].permissions.tabs
  delete legacySettings.subagents[0].permissions.debugger
  legacySettings.subagents[0].permissions.navigate = false

  globalThis.localStorage = {
    getItem(key) {
      return key === 'ai-agent-settings-v1' ? JSON.stringify(legacySettings) : null
    },
    setItem() {},
    removeItem() {},
    clear() {},
    key() {
      return null
    },
    length: 1
  }

  try {
    const loaded = storageModule.loadAgentSettings()
    assert.equal(loaded.subagents[0].permissions.tabs, false)
    assert.equal(loaded.subagents[0].permissions.debugger, true)
  } finally {
    globalThis.localStorage = previousLocalStorage
  }
})

test('targeted screenshot activates the requested tab and restores the previous tab', async () => {
  const updates = []
  const captures = []
  const chromeMock = {
    runtime: { lastError: null },
    tabs: {
      async get(tabId) {
        return makeTab(tabId, { active: false, windowId: 9 })
      },
      async query(query) {
        assert.deepEqual(query, { active: true, windowId: 9 })
        return [makeTab(1, { active: true, windowId: 9 })]
      },
      async update(tabId, changes) {
        updates.push([tabId, changes])
        return makeTab(tabId, { ...changes, windowId: 9 })
      },
      captureVisibleTab(windowId, options, callback) {
        captures.push([windowId, options])
        callback('data:image/png;base64,target')
      }
    }
  }
  const screenshotModule = loadTypeScriptModule(
    'src/background/handlers/handleCaptureScreenshot.ts',
    {
      '../utils/main': { getChromeAPI: () => chromeMock }
    }
  )

  let response
  await screenshotModule.handleCaptureScreenshot(
    'png',
    value => {
      response = value
    },
    2
  )

  assert.deepEqual(captures, [[9, { format: 'png' }]])
  assert.deepEqual(updates, [
    [2, { active: true }],
    [1, { active: true }]
  ])
  assert.deepEqual(response, { success: true, data: 'data:image/png;base64,target' })
})

test('browser action schema and manifest expose the multi-tab contract', () => {
  const payloadSource = fs.readFileSync(path.join(repoRoot, 'src/agent/agentPayload.ts'), 'utf8')
  const promptSource = fs.readFileSync(path.join(repoRoot, 'src/agent/piSupport.ts'), 'utf8')
  const manifest = JSON.parse(fs.readFileSync(path.join(repoRoot, 'public/manifest.json'), 'utf8'))

  for (const actionType of [
    'list-tabs',
    'open-tab',
    'activate-tab',
    'close-tab',
    'reload-tab',
    'go-back',
    'go-forward',
    'group-tabs',
    'ungroup-tabs',
    'debug-start',
    'read-console',
    'read-network',
    'debug-stop'
  ]) {
    assert.match(payloadSource, new RegExp(`'${actionType}'`))
    assert.match(promptSource, new RegExp(actionType))
  }
  assert.ok(manifest.permissions.includes('tabs'))
  assert.ok(manifest.permissions.includes('tabGroups'))
  assert.ok(manifest.permissions.includes('debugger'))
  assert.ok(manifest.permissions.includes('alarms'))
})
