import { chromium, expect, test, type Page } from '@playwright/test'
import { build } from 'vite'
import { deflateSync, strToU8 } from 'fflate'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

let output: string
const group = (id = 'fixture', count = 500) => ({
  id,
  name: '测试表情包😀',
  icon: '',
  detail: 'Telegram 贴纸包：FixturePack',
  order: 0,
  emojis: Array.from({ length: count }, (_, i) => ({
    id: `${id}_${i}`,
    name: `表情 ${i}`,
    groupId: id,
    url: `https://linux.do/uploads/default/original/3X/abc/fixture-${i}.webp`,
    short_url: `upload://fixture${i}.webp`,
    customOutput: `![表情 ${i}|32x32](upload://fixture${i}.webp)`,
    tags: ['动画', '😀']
  }))
})

test.beforeAll(async () => {
  output = await mkdtemp(path.join(tmpdir(), 'emoji-storage-test-'))
  await build({
    configFile: false,
    logLevel: 'error',
    resolve: { alias: { '@': path.resolve('src') } },
    build: {
      outDir: output,
      minify: false,
      lib: {
        entry: path.resolve('scripts/tests/emoji-group-storage.entry.ts'),
        formats: ['es'],
        fileName: () => 'entry.js'
      }
    }
  })
})
test.afterAll(async () => {
  await rm(output, { recursive: true, force: true })
})

async function fixture(page: Page) {
  await page.route('**/storage-fixture/**', async route => {
    const file = new URL(route.request().url()).pathname.split('/storage-fixture/')[1]
    await route.fulfill({
      body: await readFile(path.join(output, file)),
      contentType: 'text/javascript'
    })
  })
  await page.route('**/storage-test.html', route =>
    route.fulfill({ body: '<html></html>', contentType: 'text/html' })
  )
  await page.goto('http://localhost:4189/storage-test.html')
  await page.evaluate(async () => {
    localStorage.clear()
    const w = window as any
    w.createLogger = () => ({ info() {}, warn() {}, error() {}, debug() {} })
    w.raw = {}
    w.quota = Infinity
    w.writes = 0
    w.failWrite = false
    w.failRemove = false
    const storageListeners = new Set<(...args: any[]) => void>()
    const runtime: any = {}
    const get = (keys: any, callback?: any) => {
      const result =
        keys === null
          ? { ...w.raw }
          : Object.fromEntries(
              (Array.isArray(keys) ? keys : Object.keys(keys)).map((key: string) => [
                key,
                w.raw[key] ?? keys[key] ?? null
              ])
            )
      if (callback) {
        callback(result)
        return
      }
      return Promise.resolve(result)
    }
    w.chrome = {
      runtime,
      storage: {
        onChanged: {
          addListener(listener: (...args: any[]) => void) {
            storageListeners.add(listener)
          },
          removeListener(listener: (...args: any[]) => void) {
            storageListeners.delete(listener)
          }
        },
        local: {
          get,
          set(items: any, callback: any) {
            const candidate = { ...w.raw, ...items }
            const size = new TextEncoder().encode(JSON.stringify(candidate)).length
            if (size > w.quota || w.failWrite)
              runtime.lastError = { message: 'Resource::kQuotaBytes quota exceeded' }
            else {
              w.raw = candidate
              w.writes++
            }
            callback()
            delete runtime.lastError
          },
          remove(keys: string[], callback: any) {
            if (w.failRemove) runtime.lastError = { message: 'Removal failed' }
            else for (const key of keys) delete w.raw[key]
            callback()
            delete runtime.lastError
          }
        }
      },
      storageListeners
    }
    w.storage = await import('/storage-fixture/entry.js')
    await w.storage.initializeStorageCodec()
  })
}

test('Brotli stores bytes without Base64 and reduces realistic group size losslessly', async ({
  page
}) => {
  await fixture(page)
  const original = group()
  const result = await page.evaluate(original => {
    const s = (window as any).storage
    const encoded = s.encodeStorageValue('emojiGroup_fixture', { data: original, timestamp: 1 })
    return {
      encoded,
      decoded: s.decodeStorageValue('emojiGroup_fixture', encoded),
      small: s.encodeStorageValue('telegramBotToken', 'fixture-token'),
      settings: s.decodeStorageValue('appSettings', { data: { theme: 'dark' }, timestamp: 1 })
    }
  }, original)
  expect(result.encoded[0]).toBe('br2')
  expect(Array.isArray(result.encoded[2])).toBe(true)
  expect(result.decoded).toEqual(original)
  expect(JSON.stringify(result.encoded).length).toBeLessThan(JSON.stringify(original).length * 0.2)
  const old =
    'eg1:' +
    Buffer.from(deflateSync(strToU8(JSON.stringify(original)), { level: 9 })).toString('base64')
  expect(JSON.stringify(result.encoded).length).toBeLessThan(JSON.stringify(old).length)
  const decodedLegacy = await page.evaluate(async old => {
    const w = window as any
    w.raw.emojiGroup_fixture = old
    const decoded = await w.storage.storageGet('emojiGroup_fixture')
    return { decoded, migrated: w.raw.emojiGroup_fixture }
  }, old)
  expect(decodedLegacy.decoded).toEqual(original)
  expect(decodedLegacy.migrated[0]).toBe('br2')
  expect(result.small).toBe('fixture-token')
  expect(result.settings).toEqual({ theme: 'dark' })
})

test('storage change subscribers receive decoded JSON values, never br2 envelopes', async ({
  page
}) => {
  await fixture(page)
  const original = group('event', 10)
  const result = await page.evaluate(async original => {
    const w = window as any
    const encoded = w.storage.encodeStorageValue('emojiGroup_event', original)
    let received: any
    const unsubscribe = w.storage.onStorageChanged((change: any) => (received = change))
    for (const listener of w.chrome.storageListeners) {
      listener({ emojiGroup_event: { oldValue: null, newValue: encoded } }, 'local')
    }
    await new Promise(resolve => setTimeout(resolve, 0))
    unsubscribe()
    return received
  }, original)
  expect(result).toEqual({ key: 'emojiGroup_event', oldValue: null, newValue: original })
})

test('single/batch reads auto-upgrade once; content adapter decodes compressed groups', async ({
  page
}) => {
  await fixture(page)
  const original = group()
  const result = await page.evaluate(async original => {
    const w = window as any,
      s = w.storage
    w.raw.emojiGroup_fixture = { data: original, timestamp: 1 }
    const first = await s.storageGet('emojiGroup_fixture')
    const encoded = w.raw.emojiGroup_fixture
    const writes = w.writes
    const second = await s.storageBatchGet(['emojiGroup_fixture'])
    const content = await new s.ContentStorageAdapter().get('emojiGroup_fixture')
    return {
      first,
      second: second.emojiGroup_fixture,
      content,
      encoded,
      writes,
      finalWrites: w.writes
    }
  }, original)
  expect(result.first).toEqual(original)
  expect(result.second).toEqual(original)
  expect(result.content).toEqual(original)
  expect(result.encoded[0]).toBe('br2')
  expect(result.finalWrites).toBe(result.writes)
})

test('failed migration preserves legacy data; compressed imports fit a quota plain JSON exceeds', async ({
  page
}) => {
  await fixture(page)
  const original = group()
  const result = await page.evaluate(async original => {
    const w = window as any,
      s = w.storage
    const legacy = { data: original, timestamp: 1 }
    w.raw.emojiGroup_fixture = legacy
    w.failWrite = true
    const decoded = await s.storageGet('emojiGroup_fixture')
    const preserved = JSON.stringify(w.raw.emojiGroup_fixture) === JSON.stringify(legacy)
    w.failWrite = false
    w.raw = {}
    w.quota = 20000
    await s.storageSet('emojiGroup_fixture', original)
    return { decoded, preserved, size: JSON.stringify(w.raw).length }
  }, original)
  expect(result.decoded).toEqual(original)
  expect(result.preserved).toBe(true)
  expect(result.size).toBeLessThan(20000)
  expect(JSON.stringify(original).length).toBeGreaterThan(20000)
})

test('archive commits then deletes active keys; delayed saves cannot resurrect them', async ({
  page
}) => {
  await fixture(page)
  const original = group()
  const result = await page.evaluate(async original => {
    const w = window as any,
      s = w.storage
    await s.setAllEmojiGroups([original])
    localStorage.setItem('emojiGroup_fixture', JSON.stringify(original))
    await s.archiveGroup(original)
    await s.setAllEmojiGroups([original]) // old pending save in a different surface
    return {
      archived: await s.getArchivedGroup(original.id),
      active: w.raw.emojiGroup_fixture,
      index: await s.getEmojiGroupIndex(),
      local: localStorage.getItem('emojiGroup_fixture')
    }
  }, original)
  expect(result.archived).toEqual(original)
  expect(result.active).toBeUndefined()
  expect(result.index).toEqual([])
  expect(result.local).toBeNull()
})

test('startup cleans old archive duplicates even at full quota; unarchive failure keeps the archive', async ({
  page
}) => {
  await fixture(page)
  const original = group()
  const result = await page.evaluate(async original => {
    const w = window as any,
      s = w.storage
    await s.archiveGroup(original)
    w.raw.emojiGroup_fixture = { data: original, timestamp: 1 }
    w.raw.emojiGroupIndex = { data: [{ id: original.id, order: 0 }], timestamp: 1 }
    w.quota = 20000
    const groups = await s.getAllEmojiGroups()
    const removed = !w.raw.emojiGroup_fixture
    w.failWrite = true
    let error = ''
    try {
      await s.unarchiveGroup(original.id)
    } catch (e) {
      error = String(e)
    }
    const stillArchived = await s.getArchivedGroup(original.id)
    w.failWrite = false
    const restored = await s.unarchiveGroup(original.id)
    return {
      groups,
      removed,
      error,
      stillArchived,
      restored,
      archiveAfter: await s.getArchivedGroup(original.id),
      active: await s.getEmojiGroup(original.id)
    }
  }, original)
  expect(result.groups).toEqual([])
  expect(result.removed).toBe(true)
  expect(result.error).toContain('kQuotaBytes')
  expect(result.stillArchived).toEqual(original)
  expect(result.restored).toEqual(original)
  expect(result.active).toEqual(original)
  expect(result.archiveAfter).toBeNull()
})

test('storage deletion errors propagate; unindexed legacy groups auto-upgrade on startup', async ({
  page
}) => {
  await fixture(page)
  const result = await page.evaluate(async original => {
    const w = window as any,
      s = w.storage
    w.raw.emojiGroup_orphan = { data: original, timestamp: 1 }
    await s.getAllEmojiGroups()
    const encoded = w.raw.emojiGroup_orphan
    w.failRemove = true
    let error = ''
    try {
      await s.storageRemove('emojiGroup_orphan')
    } catch (e) {
      error = String(e)
    }
    return { encoded, error, preserved: !!w.raw.emojiGroup_orphan }
  }, group('orphan'))
  expect(result.encoded[0]).toBe('br2')
  expect(result.error).toContain('Removal failed')
  expect(result.preserved).toBe(true)
})

test('migration snapshot check does not overwrite a concurrent group update', async ({ page }) => {
  await fixture(page)
  const result = await page.evaluate(async original => {
    const w = window as any,
      s = w.storage
    w.raw.emojiGroup_fixture = { data: original, timestamp: 1 }
    const updated = { ...original, name: 'Concurrent edit' }
    const get = w.chrome.storage.local.get
    let reads = 0
    w.chrome.storage.local.get = (keys: any, callback: any) => {
      if (++reads === 2)
        w.raw.emojiGroup_fixture = s.encodeStorageValue('emojiGroup_fixture', updated)
      return get(keys, callback)
    }
    await s.storageGet('emojiGroup_fixture')
    return {
      saved: s.decodeStorageValue('emojiGroup_fixture', w.raw.emojiGroup_fixture),
      writes: w.writes
    }
  }, group())
  expect(result.saved.name).toBe('Concurrent edit')
  expect(result.writes).toBe(0)
})

test('aborted archive transaction never removes the active group', async ({ page }) => {
  await fixture(page)
  const original = group()
  const result = await page.evaluate(async original => {
    const w = window as any,
      s = w.storage
    await s.setAllEmojiGroups([original])
    const put = IDBObjectStore.prototype.put
    IDBObjectStore.prototype.put = function (...args: Parameters<typeof put>) {
      const request = put.apply(this, args)
      this.transaction.abort()
      return request
    }
    let error = ''
    try {
      await s.archiveGroup(original)
    } catch (e) {
      error = String(e)
    }
    IDBObjectStore.prototype.put = put
    return {
      error,
      active: await s.getEmojiGroup(original.id),
      archive: await s.getArchivedGroup(original.id)
    }
  }, original)
  expect(result.error).not.toBe('')
  expect(result.active).toEqual(original)
  expect(result.archive).toBeNull()
})

test('localStorage quota errors propagate and partial unarchive is rolled back', async ({
  page
}) => {
  await fixture(page)
  const original = group()
  const result = await page.evaluate(async original => {
    const w = window as any,
      s = w.storage
    await s.archiveGroup(original)
    w.chrome = undefined
    const set = Storage.prototype.setItem
    Storage.prototype.setItem = function (key, value) {
      if (key === 'emojiGroupIndex') throw new DOMException('Quota exceeded', 'QuotaExceededError')
      return set.call(this, key, value)
    }
    let error = ''
    try {
      await s.unarchiveGroup(original.id)
    } catch (e) {
      error = String(e)
    }
    Storage.prototype.setItem = set
    return {
      error,
      active: localStorage.getItem('emojiGroup_fixture'),
      archive: await s.getArchivedGroup(original.id)
    }
  }, original)
  expect(result.error).toContain('Quota')
  expect(result.active).toBeNull()
  expect(result.archive).toEqual(original)
})

test('all managed config keys upgrade losslessly, without data/timestamp envelopes', async ({
  page
}) => {
  await fixture(page)
  const result = await page.evaluate(async () => {
    const w = window as any,
      s = w.storage
    const configs = {
      appSettings: {
        imageScale: 32,
        enableHoverPreview: false,
        customCssBlocks: Array(100).fill({ css: '.emoji { color: red; }', enabled: true })
      },
      archivedGroupIds: Array.from({ length: 500 }, (_, i) => `telegram_archived_${i}`),
      discourseDomains: Array.from({ length: 100 }, (_, i) => ({
        domain: `forum${i}.example.org`,
        enabledGroups: ['😀', 'fixture']
      })),
      emojiGroupIndex: Array.from({ length: 500 }, (_, i) => ({
        id: `telegram_group_${i}`,
        order: i
      })),
      favorites: ['😀', 'a', 'b'],
      telegramBotToken: 'fixture-token'
    }
    for (const [key, data] of Object.entries(configs)) w.raw[key] = { data, timestamp: 1 }
    const read = await s.storageBatchGet(Object.keys(configs))
    const encoded = { ...w.raw }
    await s.storageBatchSet(read)
    return { configs, read, encoded, reread: await s.storageBatchGet(Object.keys(configs)) }
  })
  expect(result.read).toEqual(result.configs)
  expect(result.reread).toEqual(result.configs)
  expect(result.encoded.telegramBotToken).toBe('fixture-token')
  expect(result.encoded.favorites).toEqual(['😀', 'a', 'b'])
  for (const key of ['appSettings', 'archivedGroupIds', 'discourseDomains', 'emojiGroupIndex']) {
    expect(result.encoded[key][0]).toBe('br2')
    expect(JSON.stringify(result.encoded[key]).length).toBeLessThan(
      JSON.stringify(result.configs[key]).length
    )
  }
})

test('packaged extension initializes Brotli under MV3 CSP and migrates real chrome storage', async () => {
  const profile = await mkdtemp(path.join(tmpdir(), 'emoji-extension-storage-'))
  const extension = path.resolve('dist')
  const context = await chromium.launchPersistentContext(profile, {
    channel: 'chromium',
    headless: true,
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`]
  })
  try {
    const worker = context.serviceWorkers()[0] || (await context.waitForEvent('serviceworker'))
    const id = worker.url().split('/')[2]
    await worker.evaluate(async original => {
      await chrome.storage.local.set({
        emojiGroup_fixture: { data: original, timestamp: 1 },
        emojiGroupIndex: { data: [{ id: original.id, order: 0 }], timestamp: 1 },
        telegramBotToken: { data: 'fixture-token', timestamp: 1 }
      })
    }, group())
    const page = await context.newPage()
    await page.goto(`chrome-extension://${id}/index.html?mode=options#/import?source=telegram`)
    await page.getByRole('tab', { name: 'Telegram 配置', exact: true }).click()
    await expect(page.getByPlaceholder('输入 Telegram Bot Token')).toHaveValue('fixture-token')
    await page.getByPlaceholder('输入 Telegram Bot Token').fill('new-fixture-token')
    await page.getByRole('button', { name: /^保\s*存$/ }).click()
    await expect
      .poll(async () =>
        worker.evaluate(async () => {
          const raw = await chrome.storage.local.get(['emojiGroup_fixture', 'telegramBotToken'])
          return { groupVersion: raw.emojiGroup_fixture?.[0], token: raw.telegramBotToken }
        })
      )
      .toEqual({ groupVersion: 'br2', token: 'new-fixture-token' })
  } finally {
    await context.close()
    await rm(profile, { recursive: true, force: true })
  }
})
