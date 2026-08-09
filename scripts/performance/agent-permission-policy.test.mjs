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

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial))
  return {
    get length() {
      return values.size
    },
    clear() {
      values.clear()
    },
    getItem(key) {
      return values.has(key) ? values.get(key) : null
    },
    key(index) {
      return [...values.keys()][index] ?? null
    },
    removeItem(key) {
      values.delete(key)
    },
    setItem(key, value) {
      values.set(key, String(value))
    }
  }
}

const policy = loadTypeScriptModule('src/agent/permissionPolicy.ts')

test('approval mode defaults to auto and migrates the legacy bypass switch', () => {
  assert.equal(policy.readAgentApprovalMode(createStorage()), 'auto')
  assert.equal(
    policy.readAgentApprovalMode(
      createStorage({ [policy.LEGACY_BYPASS_MODE_STORAGE_KEY]: 'true' })
    ),
    'skip'
  )
  assert.equal(
    policy.readAgentApprovalMode(
      createStorage({ [policy.LEGACY_BYPASS_MODE_STORAGE_KEY]: 'false' })
    ),
    'manual'
  )

  const storage = createStorage({ [policy.LEGACY_BYPASS_MODE_STORAGE_KEY]: 'true' })
  policy.writeAgentApprovalMode('auto', storage)
  assert.equal(storage.getItem(policy.AGENT_APPROVAL_MODE_STORAGE_KEY), 'auto')
  assert.equal(storage.getItem(policy.LEGACY_BYPASS_MODE_STORAGE_KEY), null)
})

test('site permissions are normalized to origins and can be revoked', () => {
  const storage = createStorage()
  const site = policy.normalizeAgentSite('HTTPS://Example.COM/path?q=1')
  assert.deepEqual(site, {
    key: 'https://example.com',
    label: 'example.com',
    url: 'https://example.com',
    persistable: true
  })

  const allowed = policy.setAgentSitePermission(site, 'allow', storage)
  assert.equal(allowed.length, 1)
  assert.equal(policy.readAgentSitePermissions(storage)[0].decision, 'allow')
  assert.deepEqual(policy.removeAgentSitePermission(site.key, storage), [])
})

test('site decisions mirror to extension storage for scheduled workflow enforcement', async () => {
  const previousChrome = globalThis.chrome
  const mirrored = []
  globalThis.chrome = {
    storage: {
      local: {
        async set(value) {
          mirrored.push(value)
        }
      }
    }
  }
  try {
    const site = policy.normalizeAgentSite('https://blocked.example.com/path')
    policy.setAgentSitePermission(site, 'block', createStorage())
    await new Promise(resolve => setTimeout(resolve, 0))
    const last = mirrored.at(-1)
    assert.equal(last[policy.AGENT_SITE_PERMISSIONS_STORAGE_KEY][0].decision, 'block')
    assert.equal(
      last[policy.AGENT_SITE_PERMISSIONS_STORAGE_KEY][0].key,
      'https://blocked.example.com'
    )
  } finally {
    globalThis.chrome = previousChrome
  }
})

test('manual, auto, and skip modes enforce site decisions and protected actions', () => {
  const exampleSite = policy.normalizeAgentSite('https://example.com/page')
  const resolved = { sites: [exampleSite], unresolvedTargets: [] }
  const click = [{ id: 'click', type: 'click', selector: '#next' }]

  const manual = policy.assessAgentActionBatch({
    mode: 'manual',
    actions: click,
    resolved,
    sitePermissions: []
  })
  assert.equal(manual.status, 'approval-required')

  const unknownAuto = policy.assessAgentActionBatch({
    mode: 'auto',
    actions: click,
    resolved,
    sitePermissions: []
  })
  assert.equal(unknownAuto.status, 'approval-required')
  assert.equal(unknownAuto.canAlwaysAllow, true)

  const allowedAuto = policy.assessAgentActionBatch({
    mode: 'auto',
    actions: click,
    resolved,
    sitePermissions: [{ ...exampleSite, decision: 'allow', updatedAt: 1 }]
  })
  assert.equal(allowedAuto.status, 'allow')

  const skip = policy.assessAgentActionBatch({
    mode: 'skip',
    actions: click,
    resolved,
    sitePermissions: []
  })
  assert.equal(skip.status, 'allow')
  const unresolvedSkip = policy.assessAgentActionBatch({
    mode: 'skip',
    actions: click,
    resolved: { sites: [], unresolvedTargets: ['当前标签页'] },
    sitePermissions: []
  })
  assert.equal(unresolvedSkip.status, 'allow')

  const protectedAction = [{ id: 'write', type: 'write-file', path: 'notes.txt', content: 'x' }]
  const protectedSkip = policy.assessAgentActionBatch({
    mode: 'skip',
    actions: protectedAction,
    resolved: { sites: [], unresolvedTargets: [] },
    sitePermissions: []
  })
  assert.equal(protectedSkip.status, 'approval-required')
  assert.match(protectedSkip.reasons.join(' '), /写入本地文件/)

  const blocked = policy.assessAgentActionBatch({
    mode: 'skip',
    actions: click,
    resolved,
    sitePermissions: [{ ...exampleSite, decision: 'block', updatedAt: 1 }]
  })
  assert.equal(blocked.status, 'blocked')
})

test('sensitive fields, consequential clicks, and secret URLs require approval', () => {
  for (const action of [
    { id: 'password', type: 'input', selector: 'input[type=password]', text: 'secret' },
    { id: 'delete', type: 'click', selector: '#delete-account' },
    { id: 'secret-url', type: 'navigate', url: 'https://example.com/?access_token=secret' },
    { id: 'close', type: 'close-tab', tabId: 7 }
  ]) {
    assert.ok(policy.classifyProtectedAgentAction(action), action.id)
  }
  assert.equal(
    policy.classifyProtectedAgentAction({
      id: 'search',
      type: 'input',
      selector: '#search',
      text: 'x'
    }),
    null
  )
  assert.ok(
    policy.classifyProtectedAgentAction({
      id: 'email',
      type: 'input',
      selector: 'input[type=email]',
      text: 'person@example.com'
    })
  )
})

test('prohibited actions are blocked in every mode and cannot be persistently allowed', () => {
  const site = policy.normalizeAgentSite('https://shop.example.com/checkout')
  const cases = [
    { id: 'purchase', type: 'click-dom', selector: '#place-order', note: '确认订单并支付' },
    { id: 'account', type: 'click', selector: '#signup', note: '创建账户' },
    { id: 'delete', type: 'key', key: 'Enter', note: '永久删除邮件' },
    { id: 'trade', type: 'click-dom', selector: '#trade', note: '买入股票' },
    {
      id: 'identity',
      type: 'input',
      selector: 'input[name="credit-card-number"]',
      text: '4111111111111111'
    }
  ]

  for (const action of cases) {
    const assessment = policy.assessAgentActionBatch({
      mode: 'skip',
      actions: [action],
      resolved: { sites: [site], unresolvedTargets: [] },
      sitePermissions: [{ ...site, decision: 'allow', updatedAt: 1 }]
    })
    assert.equal(assessment.status, 'blocked', action.id)
    assert.equal(assessment.prohibitedActions.length, 1, action.id)
    assert.equal(assessment.canAlwaysAllow, false, action.id)
  }
})

test('action site resolution combines destination URLs and exact tab targets', async () => {
  const chromeMock = {
    tabs: {
      async get(tabId) {
        if (tabId === 8) return { id: 8, url: 'https://docs.example.org/page' }
        if (tabId === 9) return { id: 9, url: 'chrome://settings/' }
        throw new Error('missing tab')
      }
    }
  }
  const resolved = await policy.resolveAgentActionSites(
    chromeMock,
    [
      { id: 'navigate', type: 'navigate', url: 'https://example.com/path', tabId: 7 },
      { id: 'dom', type: 'getDOM', tabId: 8 },
      { id: 'group', type: 'group-tabs', tabIds: [8, 9, 10] }
    ],
    1
  )

  assert.deepEqual(resolved.sites.map(site => site.key).sort(), [
    'chrome://settings',
    'https://docs.example.org',
    'https://example.com'
  ])
  assert.deepEqual(resolved.unresolvedTargets, ['标签页 10'])
})

test('the side panel reassesses every follow-up batch instead of bypassing later actions', () => {
  const source = fs.readFileSync(path.join(repoRoot, 'src/sidebar/Agent.vue'), 'utf8')
  assert.doesNotMatch(source, /\bbypassMode\b/)
  assert.match(source, /const assessment = await assessPendingActions\(\)/)
  assert.match(source, /assessment\?\.status === 'blocked'\) break/)
  assert.match(source, /assessment\?\.status !== 'allow'\) break/)
  assert.match(source, /pendingAssessment\.value\?\.status === 'blocked'/)
  assert.match(source, /runActionsAndContinue\(\{ approveCurrent: true \}\)/)
  assert.match(source, /runActionsAndContinue\(\{ deniedReason: reason \}\)/)
  for (const mode of ['manual', 'auto', 'skip']) {
    assert.match(source, new RegExp(`value: '${mode}'`))
  }
})
