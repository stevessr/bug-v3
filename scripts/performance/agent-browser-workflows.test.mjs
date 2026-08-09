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

const permissionPolicy = loadTypeScriptModule('src/agent/permissionPolicy.ts')
const workflowsModule = loadTypeScriptModule('src/agent/browserWorkflows.ts', {
  './permissionPolicy': permissionPolicy
})
const backgroundWorkflows = loadTypeScriptModule('src/background/handlers/agentWorkflows.ts', {
  '@/agent/browserWorkflows': workflowsModule,
  '@/agent/executeActions': { executeAgentActions: async () => [] },
  '@/agent/permissionPolicy': permissionPolicy,
  '@/agent/tabActions': { waitForTabLoad: async () => ({ loadState: 'complete' }) }
})

const makeWorkflow = (overrides = {}) => ({
  id: 'workflow-1',
  name: 'Search forum',
  shortcut: 'search-forum',
  createdAt: 100,
  updatedAt: 100,
  startUrl: 'https://forum.example.com/latest',
  actions: [
    {
      id: 'input-1',
      type: 'input',
      selector: 'input[name="q"]',
      text: 'vite 8',
      clear: true,
      note: '填写搜索框'
    },
    {
      id: 'key-1',
      type: 'key',
      key: 'Enter',
      note: '提交搜索'
    }
  ],
  redactedFields: [],
  ...overrides
})

test('workflow URLs redact credentials, sensitive query values, and token fragments', () => {
  const sanitized = workflowsModule.sanitizeAgentWorkflowUrl(
    'https://user:pass@example.com/path?access_token=secret&view=list#session=private'
  )

  assert.equal(sanitized.redacted, true)
  assert.doesNotMatch(sanitized.url, /user|pass|secret|private/)
  assert.match(sanitized.url, /access_token=%5BREDACTED%5D/)
  assert.match(sanitized.url, /#\[REDACTED\]/)
})

test('recording sanitization accepts replay actions and strips captured tab ids', () => {
  const session = workflowsModule.sanitizeRecordingSession({
    id: 'recording-1',
    tabId: 7,
    startedAt: 100,
    updatedAt: 110,
    startUrl: 'https://example.com/?token=private',
    lastUrl: 'https://example.com/next',
    actions: [
      { id: 'click', type: 'click-dom', selector: '#search', tabId: 99 },
      { id: 'unsupported', type: 'write-file', path: 'secret.txt', text: 'nope' }
    ],
    redactedFields: []
  })

  assert.equal(session.actions.length, 1)
  assert.equal('tabId' in session.actions[0], false)
  assert.doesNotMatch(session.startUrl, /private/)
})

test('schedule eligibility permits deterministic safe workflows and blocks risky ones', () => {
  const safe = workflowsModule.assessWorkflowScheduleEligibility(makeWorkflow())
  assert.equal(safe.eligible, true)
  assert.deepEqual(safe.origins, ['https://forum.example.com'])

  const schedule = workflowsModule.createAgentWorkflowSchedule(makeWorkflow(), 30, 1_000)
  assert.equal(schedule.cadence, 'interval')
  assert.equal(schedule.intervalMinutes, 30)
  assert.equal(schedule.anchorAt, 1_801_000)
  assert.equal(schedule.nextRunAt, 1_801_000)
  assert.deepEqual(schedule.allowedOrigins, ['https://forum.example.com'])
  assert.equal(schedule.closeTabWhenDone, true)

  const redacted = workflowsModule.assessWorkflowScheduleEligibility(
    makeWorkflow({
      redactedFields: [
        { selector: '#password', label: '密码', url: 'https://forum.example.com', recordedAt: 1 }
      ]
    })
  )
  assert.equal(redacted.eligible, false)
  assert.match(redacted.reasons.join(' '), /敏感字段/)

  const destructive = workflowsModule.assessWorkflowScheduleEligibility(
    makeWorkflow({
      actions: [{ id: 'delete', type: 'click-dom', selector: '#delete', note: '删除账号' }]
    })
  )
  assert.equal(destructive.eligible, false)
  assert.match(destructive.reasons.join(' '), /不可逆/)
})

test('calendar schedules preserve their anchor across month ends and leap years', () => {
  const january31 = new Date(2024, 0, 31, 9, 30, 0, 0).getTime()
  const monthly = workflowsModule.createAgentWorkflowSchedule(
    makeWorkflow(),
    { cadence: 'monthly', firstRunAt: january31 },
    january31 - 60_000
  )
  assert.equal(monthly.cadence, 'monthly')
  assert.equal(monthly.anchorAt, january31)

  const february29 = new Date(2024, 1, 29, 9, 30, 0, 0).getTime()
  const march31 = new Date(2024, 2, 31, 9, 30, 0, 0).getTime()
  assert.equal(workflowsModule.computeNextAgentWorkflowRun(monthly, january31), february29)
  assert.equal(workflowsModule.computeNextAgentWorkflowRun(monthly, february29), march31)

  const leapDay = new Date(2024, 1, 29, 8, 0, 0, 0).getTime()
  const yearly = workflowsModule.createAgentWorkflowSchedule(
    makeWorkflow(),
    { cadence: 'yearly', firstRunAt: leapDay },
    leapDay - 60_000
  )
  assert.equal(
    workflowsModule.computeNextAgentWorkflowRun(yearly, leapDay),
    new Date(2025, 1, 28, 8, 0, 0, 0).getTime()
  )
  assert.equal(
    workflowsModule.computeNextAgentWorkflowRun(yearly, new Date(2027, 1, 28, 8).getTime()),
    new Date(2028, 1, 29, 8, 0, 0, 0).getTime()
  )
})

test('legacy interval schedules migrate safely and alarms use one-shot calendar triggers', () => {
  const legacy = workflowsModule.sanitizeAgentWorkflowSchedule({
    id: 'legacy-schedule',
    workflowId: 'workflow-1',
    enabled: true,
    intervalMinutes: 60,
    nextRunAt: 10_000,
    allowedOrigins: ['https://forum.example.com'],
    createdAt: 1,
    updatedAt: 1
  })
  assert.equal(legacy.cadence, 'interval')
  assert.equal(legacy.anchorAt, 10_000)

  const backgroundSource = fs.readFileSync(
    path.join(repoRoot, 'src/background/handlers/agentWorkflows.ts'),
    'utf8'
  )
  assert.doesNotMatch(backgroundSource, /periodInMinutes:/)
  assert.match(backgroundSource, /computeNextAgentWorkflowRun\(schedule, finishedAt\)/)
  assert.match(backgroundSource, /advanceSchedule: false/)
})

test('workflow replay starts from the recorded page and regenerates action ids', () => {
  const workflow = makeWorkflow()
  const actions = workflowsModule.buildWorkflowReplayActions(
    workflow,
    'https://elsewhere.example.com/'
  )

  assert.equal(actions[0].type, 'navigate')
  assert.equal(actions[0].url, workflow.startUrl)
  assert.equal(actions.length, workflow.actions.length + 1)
  assert.notEqual(actions[1].id, workflow.actions[0].id)

  const alreadyThere = workflowsModule.buildWorkflowReplayActions(workflow, workflow.startUrl)
  assert.equal(alreadyThere.length, workflow.actions.length)
})

test('workflow storage fallback persists lists and disambiguates duplicate shortcuts', async () => {
  const previousStorage = globalThis.localStorage
  const values = new Map()
  globalThis.localStorage = {
    getItem(key) {
      return values.get(key) ?? null
    },
    setItem(key, value) {
      values.set(key, String(value))
    },
    removeItem(key) {
      values.delete(key)
    },
    clear() {
      values.clear()
    },
    key(index) {
      return [...values.keys()][index] ?? null
    },
    get length() {
      return values.size
    }
  }

  try {
    await workflowsModule.saveAgentBrowserWorkflows([makeWorkflow()])
    const second = makeWorkflow({ id: 'workflow-2', name: 'Search again' })
    const stored = await workflowsModule.upsertAgentBrowserWorkflow(second)
    assert.equal(stored.length, 2)
    assert.notEqual(stored[0].shortcut, stored[1].shortcut)
    assert.equal((await workflowsModule.loadAgentBrowserWorkflows()).length, 2)
  } finally {
    globalThis.localStorage = previousStorage
  }
})

test('background recording sessions persist across messages and compact input updates', async () => {
  const previousChrome = globalThis.chrome
  const sessionValues = new Map()
  const localValues = new Map()
  const makeStorageArea = values => ({
    async get(key) {
      return { [key]: values.get(key) }
    },
    async set(input) {
      for (const [key, value] of Object.entries(input)) values.set(key, value)
    },
    async remove(key) {
      values.delete(key)
    }
  })
  const sentToTabs = []
  globalThis.chrome = {
    runtime: { lastError: null },
    storage: {
      session: makeStorageArea(sessionValues),
      local: makeStorageArea(localValues)
    },
    tabs: {
      async get(tabId) {
        return {
          id: tabId,
          url: 'https://forum.example.com/login?access_token=private',
          title: 'Forum login'
        }
      },
      sendMessage(tabId, message, callback) {
        sentToTabs.push([tabId, message])
        callback({ success: true })
      }
    }
  }

  const send = async (message, sender = {}) => {
    let response
    await backgroundWorkflows.handleAgentWorkflowRequest(message, sender, value => {
      response = value
    })
    return response
  }

  try {
    const started = await send({ type: 'AGENT_RECORDING_START', tabId: 5 })
    assert.equal(started.success, true)
    assert.doesNotMatch(JSON.stringify(started), /private/)
    assert.equal(started.data.redactedFields.length, 1)
    assert.deepEqual(sentToTabs[0], [5, { type: 'AGENT_RECORDING_SET_STATE', active: true }])

    for (const text of ['v', 'vite', 'vite 8']) {
      await send(
        {
          type: 'AGENT_RECORDING_EVENT',
          event: {
            kind: 'action',
            action: {
              id: `input-${text}`,
              type: 'input',
              selector: '#search',
              text,
              clear: true
            }
          }
        },
        { tab: { id: 5 } }
      )
    }

    const status = await send({ type: 'AGENT_RECORDING_STATUS', tabId: 5 })
    assert.equal(status.data.actions.length, 1)
    assert.equal(status.data.actions[0].text, 'vite 8')

    const stopped = await send({ type: 'AGENT_RECORDING_STOP', tabId: 5 })
    assert.equal(stopped.success, true)
    assert.equal(stopped.data.actions.length, 1)
    assert.deepEqual(sentToTabs.at(-1), [5, { type: 'AGENT_RECORDING_SET_STATE', active: false }])
    const empty = await send({ type: 'AGENT_RECORDING_STATUS' })
    assert.equal(empty.data, null)
  } finally {
    globalThis.chrome = previousChrome
  }
})
