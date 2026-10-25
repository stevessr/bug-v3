// cloudflare-wall-main 的主世界过盾逻辑冒烟测试：
// 按 Cloudflare 真实行为（cf-mitigated 表头、疑似盾响应、全页盾识别）验证
// 网络钩子识别、默认收起小窗、点击展开、过盾后自动关闭并经 Discourse 路由
// 函数软刷新（不整页 reload）、Discourse 主题变量样式注入、防嵌套触发。
// 直接读取 TS 源码并剥离类型后在模拟 DOM 沙箱中运行。
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import vm from 'node:vm'
import assert from 'node:assert/strict'
import { test } from 'node:test'

const SRC = new URL('../../src/content/cloudflare-wall-main.ts', import.meta.url)
const IFRAME_ID = 'emoji-ext-cf-challenge-iframe'
const USERJS_IFRAME_ID = 'linuxdo-cf-challenge-iframe'
const TOAST_ID = 'emoji-ext-cf-challenge-toast'

let nowMs = 1_700_000_000_000

function makeElement(tag) {
  const classes = new Set()
  const el = {
    tagName: tag,
    style: {},
    classList: {
      toggle(cls, force) {
        if (force === undefined) {
          if (classes.has(cls)) {
            classes.delete(cls)
            return false
          }
          classes.add(cls)
          return true
        }
        if (force) classes.add(cls)
        else classes.delete(cls)
        return Boolean(force)
      },
      contains(cls) {
        return classes.has(cls)
      }
    },
    children: [],
    parent: null,
    listeners: {},
    id: '',
    title: '',
    innerText: '',
    isConnected: true,
    src: '',
    contentWindow: undefined,
    contentDocument: undefined,
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

function createEnv({
  title = 'LINUX DO',
  chlOpt,
  pathname = '/t/topic/123',
  nested = false,
  discourseTransitionTo = null
} = {}) {
  const fetchCalls = []
  const reloads = []
  const noticeMessages = []
  const transitionCalls = []
  let observedCount = 0
  let nextResponse = null
  const windowMessageListeners = []

  const body = makeElement('body')
  const head = makeElement('head')
  const location = {
    pathname,
    href: `https://linux.do${pathname}`,
    origin: 'https://linux.do',
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
    addEventListener(type, listener) {
      if (type === 'message') windowMessageListeners.push(listener)
    },
    postMessage: (message, targetOrigin) => noticeMessages.push({ message, targetOrigin }),
    // 脚本使用 window.setInterval/clearInterval（DOM 类型返回 number）
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
  windowStub.top = nested ? { fakeTop: true } : windowStub
  if (discourseTransitionTo) {
    // 模拟 Discourse 页面应用暴露的路由器（与「周期刷新」功能调用的函数一致）
    windowStub.Discourse = {
      router: {
        transitionTo: path => {
          transitionCalls.push(path)
          return discourseTransitionTo(path)
        }
      }
    }
  }
  const documentStub = {
    readyState: 'complete',
    title,
    body,
    head,
    documentElement: makeElement('html'),
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
    head,
    body,
    location,
    fetchCalls,
    reloads,
    noticeMessages,
    transitionCalls,
    updateWallSetting(enabled) {
      const event = {
        source: windowStub,
        origin: location.origin,
        data: {
          source: 'emoji-extension-cloudflare-wall-main',
          type: 'settings-updated',
          enabled
        }
      }
      for (const listener of windowMessageListeners) listener(event)
    },
    get observedCount() {
      return observedCount
    },
    popup() {
      return findById(body, IFRAME_ID)
    },
    toast() {
      return findById(body, TOAST_ID)
    },
    panelBodyOf(popupEl) {
      return popupEl.children.find(c => findByTag(c, 'iframe'))
    },
    injectedStyles() {
      return head.children.filter(c => c.tagName === 'style').map(c => c.textContent)
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

function assertExtensionSuccessNotice(env) {
  assert.strictEqual(env.noticeMessages.length, 1, '应发送一次扩展 notice 事件')
  assert.strictEqual(
    env.noticeMessages[0].message.source,
    'emoji-extension-cloudflare-wall-main',
    'notice 应来自主世界过盾脚本'
  )
  assert.strictEqual(env.noticeMessages[0].message.type, 'challenge-solved')
  assert.strictEqual(env.noticeMessages[0].targetOrigin, env.location.origin)
}

const flush = () => new Promise(r => setTimeout(r, 15))
const sleep = ms => new Promise(r => setTimeout(r, ms))

test('疑似盾响应（403 + cloudflare + text/html）触发默认收起小窗并注入 Discourse 主题变量样式', async () => {
  const env = createEnv()
  env.respond(403, { server: 'cloudflare', 'content-type': 'text/html; charset=utf-8' })
  const resp = await env.windowStub.fetch('/session/current.json')
  await flush()
  const popup = env.popup()
  assert.ok(resp, 'fetch 应原样返回响应（不破坏页面）')
  assert.ok(popup, '疑似盾响应应触发小窗')
  assert.ok(!popup.classList.contains('expanded'), '默认应收起')
  assert.ok(env.panelBodyOf(popup), '弹窗内应有 iframe 容器')
  const styles = env.injectedStyles()
  assert.ok(
    styles.some(css => css.includes('var(--secondary')),
    '应注入 Discourse 主题变量样式'
  )
  assert.ok(
    styles.every(css => !css.includes('#ff4d4f') || css.includes('var(--danger')),
    '不应依赖硬编码配色'
  )
})

test('过盾开关关闭时不弹窗，重新开启时立即生效', async () => {
  const env = createEnv()
  env.updateWallSetting(false)
  env.respond(403, { 'cf-mitigated': 'challenge' })
  await env.windowStub.fetch('/posts.json')
  await flush()
  assert.equal(env.popup(), null, '关闭开关后不应弹出过盾窗口')

  env.updateWallSetting(true)
  await env.windowStub.fetch('/posts.json')
  await flush()
  assert.ok(env.popup(), '重新开启后应立即检测并弹出过盾窗口')

  env.updateWallSetting(false)
  assert.equal(env.popup(), null, '关闭开关也应关闭已经打开的过盾窗口')
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

test('点击小窗展开/收起；过盾后关闭并调用扩展 notice，不整页 reload', async () => {
  const env = createEnv()
  env.respond(403, { 'cf-mitigated': 'challenge', 'content-type': 'text/html' })
  await env.windowStub.fetch('/posts.json')
  await flush()
  const popup = env.popup()
  assert.ok(popup, '小窗应存在')
  assert.ok(!popup.classList.contains('expanded'), '默认收起')

  popup.fire('click', { target: {} })
  assert.ok(popup.classList.contains('expanded'), '点击后应展开')

  popup.fire('click', { target: {} })
  assert.ok(!popup.classList.contains('expanded'), '再次点击应收起')

  popup.fire('click', { target: {} }) // 保持展开做验证流程
  const iframe = findByTag(popup, 'iframe')
  assert.ok(iframe, '弹窗内应有 iframe')
  iframe.contentWindow = { location: { pathname: '/challenge' } }
  await sleep(80)
  assert.ok(env.popup(), '验证未完成（仍在 /challenge）弹窗应保留')

  iframe.contentWindow.location.pathname = '/t/topic/123' // 验证通过，跳回原页面
  await sleep(80)
  assert.ok(!env.popup(), '检测到过盾完成后应自动关闭')
  assertExtensionSuccessNotice(env)
  env.respond(200, { 'content-type': 'application/json' })
  const nextResponse = await env.windowStub.fetch('/session/current.json')
  assert.strictEqual(nextResponse.status, 200, '过盾后页面仍可继续发请求')
  assert.strictEqual(env.location.href, 'https://linux.do/t/topic/123', '不应导航离开当前页面')
  assert.strictEqual(env.reloads.length, 0, '过盾成功后不应整页 reload')
  assert.deepStrictEqual(
    env.transitionCalls,
    [],
    '无 Discourse 路由器（应用未挂载）时应静默跳过路由刷新'
  )
})

test('过盾成功后调用 Discourse 路由函数软刷新当前路由（同「周期刷新」），不整页 reload', async () => {
  const env = createEnv({ discourseTransitionTo: () => {} })
  env.respond(403, { 'cf-mitigated': 'challenge', 'content-type': 'text/html' })
  await env.windowStub.fetch('/posts.json')
  await flush()
  const popup = env.popup()
  assert.ok(popup, '小窗应存在')

  const iframe = findByTag(popup, 'iframe')
  iframe.contentWindow = { location: { pathname: '/t/topic/123' } } // 后台自动过盾成功
  await sleep(80)
  assert.ok(!env.popup(), '过盾完成后弹窗应自动关闭')
  assertExtensionSuccessNotice(env)
  assert.deepStrictEqual(
    env.transitionCalls,
    ['/t/topic/123'],
    '应调用 Discourse.router.transitionTo(当前路径) 软刷新当前路由'
  )
  assert.strictEqual(env.location.href, 'https://linux.do/t/topic/123', '当前页面地址应保持不变')
  assert.strictEqual(env.reloads.length, 0, '不应做整页 reload')
})

test('收起态后台过盾成功也自动关闭并通知，不整页 reload', async () => {
  const env = createEnv()
  env.respond(403, { 'cf-mitigated': 'challenge', 'content-type': 'text/html' })
  await env.windowStub.fetch('/posts.json')
  await flush()
  const popup = env.popup()
  assert.ok(popup, '小窗应存在')
  assert.ok(!popup.classList.contains('expanded'), '保持收起')

  const iframe = findByTag(popup, 'iframe')
  iframe.contentWindow = { location: { pathname: '/t/topic/123' } } // 后台自动过盾成功
  await sleep(80)
  assert.ok(!env.popup(), '收起态过盾完成也应自动关闭')
  assertExtensionSuccessNotice(env)
  assert.strictEqual(env.location.href, 'https://linux.do/t/topic/123', '当前页面地址应保持不变')
  assert.strictEqual(env.reloads.length, 0, '过盾成功后不应整页 reload')
})

test('/challenge 渲染出 Discourse 404 页即视为过盾完成，只关闭并通知，不整页 reload', async () => {
  const env = createEnv()
  env.respond(403, { 'cf-mitigated': 'challenge', 'content-type': 'text/html' })
  await env.windowStub.fetch('/posts.json')
  await flush()
  const popup = env.popup()
  const iframe = findByTag(popup, 'iframe')
  iframe.contentWindow = { location: { pathname: '/challenge' } }
  iframe.contentDocument = { body: { innerText: '糟糕！该页面不存在或者是一个不公开页面。' } }
  await sleep(80)
  assert.ok(!env.popup(), '出现 404 页（过盾完成）应自动关闭')
  assertExtensionSuccessNotice(env)
  assert.strictEqual(env.location.href, 'https://linux.do/t/topic/123', '当前页面地址应保持不变')
  assert.strictEqual(env.reloads.length, 0, '过盾成功后不应整页 reload')
})

test('验证未完成（仍在 /challenge 且无 404 文案）弹窗保留', async () => {
  const env = createEnv()
  env.respond(403, { 'cf-mitigated': 'challenge', 'content-type': 'text/html' })
  await env.windowStub.fetch('/posts.json')
  await flush()
  const popup = env.popup()
  const iframe = findByTag(popup, 'iframe')
  iframe.contentWindow = { location: { pathname: '/challenge' } }
  iframe.contentDocument = { body: { innerText: 'Checking your browser…' } }
  await sleep(80)
  assert.ok(env.popup(), '验证未完成弹窗应保留')
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

test('防嵌套：嵌套窗口（iframe 内实例）不装钩子、不弹窗', async () => {
  const env = createEnv({ nested: true })
  const originalFetch = env.windowStub.fetch
  env.respond(403, { 'cf-mitigated': 'challenge', 'content-type': 'text/html' })
  await env.windowStub.fetch('/posts.json')
  await flush()
  assert.ok(!env.popup(), '嵌套窗口不应弹窗')
  assert.strictEqual(env.windowStub.fetch, originalFetch, '嵌套窗口不应挂载 fetch 钩子')
})

test('防嵌套：/challenge 页面（含过盾后的 404 页）不运行', async () => {
  const env = createEnv({ pathname: '/challenge' })
  const originalFetch = env.windowStub.fetch
  env.respond(403, { 'cf-mitigated': 'challenge', 'content-type': 'text/html' })
  await env.windowStub.fetch('/challenge?redirect=x')
  await flush()
  assert.ok(!env.popup(), '/challenge 页面内不应弹窗')
  assert.strictEqual(env.windowStub.fetch, originalFetch, '/challenge 页面内不应挂载钩子')
})

test('防嵌套：用户脚本版弹窗已存在时不重复弹', async () => {
  const env = createEnv()
  env.respond(403, { 'cf-mitigated': 'challenge', 'content-type': 'text/html' })
  await env.windowStub.fetch('/posts.json')
  await flush()
  assert.ok(env.popup(), '基准：插件版弹窗应存在')
  env.popup().remove()
  nowMs += 31_000

  const userjsPopup = makeElement('div')
  userjsPopup.id = USERJS_IFRAME_ID
  env.body.appendChild(userjsPopup)

  await env.windowStub.fetch('/posts.json')
  await flush()
  assert.ok(!env.popup(), '用户脚本版弹窗已存在时插件版不应再弹')
})
