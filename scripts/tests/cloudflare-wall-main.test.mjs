// cloudflare-wall-main 的主世界过盾逻辑冒烟测试：
// 按 Cloudflare 真实行为（cf-mitigated 表头、疑似盾响应、全页盾识别）验证
// 网络钩子识别、默认收起小窗、点击展开、过盾后自动关闭与刷新。
// 直接读取 TS 源码并剥离类型后在模拟 DOM 沙箱中运行。
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import vm from 'node:vm'
import assert from 'node:assert/strict'
import { test } from 'node:test'

const SRC = new URL('../../src/content/cloudflare-wall-main.ts', import.meta.url)
const IFRAME_ID = 'emoji-ext-cf-challenge-iframe'
const TOAST_ID = 'emoji-ext-cf-challenge-toast'

let nowMs = 1_700_000_000_000

function makeElement(tag) {
  const el = {
    tagName: tag,
    style: {},
    children: [],
    parent: null,
    listeners: {},
    id: '',
    title: '',
    innerText: '',
    isConnected: true,
    src: '',
    contentWindow: undefined,
    appendChild(child) {
      child.parent = el
      el.children.push(child)
      return child
    },
    remove() {
      if (el.parent) {
        const idx = el.parent.children.indexOf(el)
        if (idx >= 0) el.parent.children.splice(idx, 1)
        el.parent = null
      }
      const disconnect = node => {
        node.isConnected = false
        node.children.forEach(disconnect)
      }
      disconnect(el)
    },
    addEventListener(type, fn) {
      ;(el.listeners[type] = el.listeners[type] || []).push(fn)
    },
    fire(type, event) {
      for (const fn of el.listeners[type] || []) fn(event)
    }
  }
  return el
}

function findById(root, id) {
  if (root.id === id) return root
  for (const child of root.children) {
    const found = findById(child, id)
    if (found) return found
  }
  return null
}

function findByTag(root, tag) {
  if (root.tagName === tag) return root
  for (const child of root.children) {
    const found = findByTag(child, tag)
    if (found) return found
  }
  return null
}

function createEnv({ title = 'LINUX DO', chlOpt } = {}) {
  const fetchCalls = []
  const reloads = []
  let nextResponse = null

  const body = makeElement('body')
  const location = {
    pathname: '/t/topic/123',
    href: 'https://linux.do/t/topic/123',
    reload: () => reloads.push(1)
  }
  const fetchImpl = input => {
    fetchCalls.push(typeof input === 'string' ? input : input && input.url)
    if (!nextResponse) throw new Error('no scripted response')
    return Promise.resolve(nextResponse)
  }
  const windowStub = {
    fetch: fetchImpl,
    location,
    _cf_chl_opt: chlOpt,
    setInterval: fn => {
      let ticks = 0
      const id = setInterval(() => {
        ticks += 1
        if (ticks > 50) {
          clearInterval(id)
          return
        }
        fn()
      }, 10)
      return id
    },
    clearInterval
  }
  const documentStub = {
    readyState: 'complete',
    title,
    body,
    addEventListener() {},
    getElementById(id) {
      return findById(body, id)
    },
    querySelector() {
      return null
    },
    createElement: makeElement
  }

  const sandbox = {
    window: windowStub,
    document: documentStub,
    __ENABLE_LOGGING__: false,
    console,
    Date: { now: () => nowMs },
    setTimeout,
    clearTimeout,
    // 加速轮询：真实 1s 间隔压到 10ms，并设 tick 上限模拟超时，避免用例挂起
    setInterval: fn => {
      let ticks = 0
      const id = setInterval(() => {
        ticks += 1
        if (ticks > 50) {
          clearInterval(id)
          return
        }
        fn()
      }, 10)
      return id
    },
    clearInterval
  }

  const source = stripTypeScriptTypes(readFileSync(SRC, 'utf8'))
  vm.runInNewContext(source, sandbox, { filename: 'cloudflare-wall-main.ts' })

  return {
    windowStub,
    fetchCalls,
    reloads,
    popup() {
      return findById(body, IFRAME_ID)
    },
    toast() {
      return findById(body, TOAST_ID)
    },
    panelBodyOf(popupEl) {
      return popupEl.children.find(c => findByTag(c, 'iframe'))
    },
    respond(status, headers) {
      nextResponse = {
        status,
        headers: {
          get: name => {
            const v = headers[String(name).toLowerCase()]
            return v === undefined ? null : v
          }
        }
      }
    }
  }
}

const flush = () => new Promise(r => setTimeout(r, 15))
const sleep = ms => new Promise(r => setTimeout(r, ms))

test('疑似盾响应（403 + cloudflare + text/html，无特殊表头）触发默认收起的小窗', async () => {
  const env = createEnv()
  env.respond(403, { server: 'cloudflare', 'content-type': 'text/html; charset=utf-8' })
  const resp = await env.windowStub.fetch('/session/current.json')
  await flush()
  const popup = env.popup()
  assert.ok(resp, 'fetch 应原样返回响应（不破坏页面）')
  assert.ok(popup, '疑似盾响应应触发小窗')
  assert.strictEqual(env.panelBodyOf(popup).style.display, 'none', '默认应收起（iframe 隐藏）')
  assert.strictEqual(popup.style.width, '170px', '收起态应为小窗尺寸')
})

test('cf-mitigated: challenge 特殊表头触发小窗，且自动触发有 30s 节流', async () => {
  const env = createEnv()
  env.respond(403, { 'cf-mitigated': 'challenge', 'content-type': 'text/html' })
  await env.windowStub.fetch('/posts.json')
  await flush()
  assert.ok(env.popup(), '特殊表头应触发小窗')

  env.popup().remove()
  nowMs += 5_000
  await env.windowStub.fetch('/posts.json')
  await flush()
  assert.ok(!env.popup(), '节流期内（5s）不应再次弹窗')

  nowMs += 31_000
  await env.windowStub.fetch('/posts.json')
  await flush()
  assert.ok(env.popup(), '节流期后（31s）应再次弹窗')
})

test('cf-mitigated: block（WAF 拦截页）不弹窗', async () => {
  const env = createEnv()
  env.respond(403, { 'cf-mitigated': 'block', 'content-type': 'text/html', server: 'cloudflare' })
  await env.windowStub.fetch('/t/1.json')
  await flush()
  assert.ok(!env.popup(), 'WAF block 无法过盾解决，不应弹窗')
})

test('Discourse 自身 JSON 403（经 CF 代理）不弹窗', async () => {
  const env = createEnv()
  env.respond(403, { 'content-type': 'application/json', server: 'cloudflare' })
  await env.windowStub.fetch('/session/current.json')
  await flush()
  assert.ok(!env.popup(), 'JSON 403 不应触发弹窗')
})

test('200 正常响应不弹窗', async () => {
  const env = createEnv()
  env.respond(200, { 'content-type': 'application/json', server: 'cloudflare' })
  await env.windowStub.fetch('/session/current.json')
  await flush()
  assert.ok(!env.popup(), '正常响应不应触发弹窗')
})

test('点击小窗展开/收起；展开态过盾成功后自动关闭 + toast + 刷新', async () => {
  const env = createEnv()
  env.respond(403, { 'cf-mitigated': 'challenge', 'content-type': 'text/html' })
  await env.windowStub.fetch('/posts.json')
  await flush()
  const popup = env.popup()
  assert.ok(popup, '小窗应存在')
  assert.strictEqual(env.panelBodyOf(popup).style.display, 'none', '默认收起')

  popup.fire('click', { target: {} })
  assert.strictEqual(env.panelBodyOf(popup).style.display, 'flex', '点击后应展开 iframe')
  assert.strictEqual(popup.style.width, '400px', '展开态应为面板尺寸')

  popup.fire('click', { target: {} })
  assert.strictEqual(env.panelBodyOf(popup).style.display, 'none', '再次点击应收起')

  popup.fire('click', { target: {} }) // 保持展开做验证流程
  const iframe = findByTag(popup, 'iframe')
  assert.ok(iframe, '弹窗内应有 iframe')
  iframe.contentWindow = { location: { pathname: '/challenge' } }
  await sleep(80)
  assert.ok(env.popup(), '验证未完成（仍在 /challenge）弹窗应保留')

  iframe.contentWindow.location.pathname = '/t/topic/123' // 验证通过，跳回原页面
  await sleep(80)
  assert.ok(!env.popup(), '检测到过盾完成后应自动关闭')
  assert.ok(env.toast(), '应显示验证通过提示')
  await sleep(1000)
  assert.strictEqual(env.reloads.length, 1, '验证通过后应自动刷新页面')
})

test('收起态（用户从未点击）后台过盾成功也自动关闭并刷新', async () => {
  const env = createEnv()
  env.respond(403, { 'cf-mitigated': 'challenge', 'content-type': 'text/html' })
  await env.windowStub.fetch('/posts.json')
  await flush()
  const popup = env.popup()
  assert.ok(popup, '小窗应存在')
  assert.strictEqual(env.panelBodyOf(popup).style.display, 'none', '保持收起')

  const iframe = findByTag(popup, 'iframe')
  iframe.contentWindow = { location: { pathname: '/t/topic/123' } } // 后台自动过盾成功
  await sleep(80)
  assert.ok(!env.popup(), '收起态过盾完成也应自动关闭')
  await sleep(1000)
  assert.strictEqual(env.reloads.length, 1, '应自动刷新页面')
})

test('全页 challenge（Just a moment... 标题）不弹窗', async () => {
  const env = createEnv({ title: 'Just a moment...' })
  env.respond(403, { 'cf-mitigated': 'challenge', 'content-type': 'text/html' })
  await env.windowStub.fetch('/posts.json')
  await flush()
  assert.ok(!env.popup(), '全页盾自行验证，不应叠一层弹窗')
})

test('jsd 探测（cType=jsd，正常页面）不被误判为全页盾', async () => {
  const env = createEnv({ chlOpt: { cType: 'jsd' } })
  env.respond(403, { 'cf-mitigated': 'challenge', 'content-type': 'text/html' })
  await env.windowStub.fetch('/posts.json')
  await flush()
  assert.ok(env.popup(), 'jsd 页面应正常触发小窗')
})

test('_cf_chl_opt.cType=managed（全页盾）时不弹窗', async () => {
  const env = createEnv({ chlOpt: { cType: 'managed' } })
  env.respond(403, { 'cf-mitigated': 'challenge', 'content-type': 'text/html' })
  await env.windowStub.fetch('/posts.json')
  await flush()
  assert.ok(!env.popup(), 'managed 全页盾不应弹窗')
})
