import { expect, test, type Page } from '@playwright/test'
import { build } from 'vite'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

let output: string
test.beforeAll(async () => {
  output = await mkdtemp(path.join(tmpdir(), 'native-background-'))
  await build({
    configFile: false,
    logLevel: 'error',
    resolve: { alias: { '@': path.resolve('src') } },
    build: {
      outDir: output,
      minify: false,
      lib: {
        entry: path.resolve('scripts/tests/background-native-upload.entry.ts'),
        formats: ['es'],
        fileName: () => 'entry.js'
      }
    }
  })
})
test.afterAll(async () => {
  await rm(output, { recursive: true, force: true })
})

async function fixture(page: Page, enabled = true) {
  await page.route('**/native-fixture/**', async route => {
    const file = new URL(route.request().url()).pathname.split('/native-fixture/')[1]
    await route.fulfill({
      body: await readFile(path.join(output, file)),
      contentType: 'text/javascript'
    })
  })
  await page.route('**/js/discourse-native-upload.js', route =>
    route.fulfill({
      path: path.resolve('public/js/discourse-native-upload.js'),
      contentType: 'text/javascript'
    })
  )
  await page.route('**/native-test.html', route =>
    route.fulfill({
      body: '<meta name="csrf-token" content="fixture">',
      contentType: 'text/html'
    })
  )
  await page.goto('http://localhost:4189/native-test.html')
  await page.evaluate(async enabled => {
    const w = window as any
    w.createLogger = () => ({ info() {}, warn() {}, error() {}, debug() {} })
    localStorage.clear()
    localStorage.setItem(
      'appSettings',
      JSON.stringify({
        imageScale: 100,
        defaultGroup: '',
        showSearchBar: true,
        gridColumns: 4,
        useBackgroundNativeUpload: enabled
      })
    )
    w.chrome = {
      runtime: { getURL: (file: string) => '/' + file },
      tabs: {
        query: async () => [{ id: 1, url: location.origin + '/t/topic', active: true }],
        sendMessage: async (id: number, message: any) => {
          w.sent.push({ id, message })
          return {
            success: true,
            data: {
              ok: true,
              status: 200,
              data: {
                url: '/uploads/original.webp',
                short_url: 'upload://native.webp',
                short_path: '/uploads/short-url/native.webp',
                width: 80,
                height: 40
              }
            }
          }
        }
      }
    }
    w.sent = []
    w.module = await import('/native-fixture/entry.js')
    await w.module.getSettings()
  }, enabled)
}

test('enabled background upload uses exact-origin native page transport and preserves metadata', async ({
  page
}) => {
  await fixture(page)
  const result = await page.evaluate(async () => {
    const w = window as any
    w.fetch = () => {
      throw new Error('must not use API')
    }
    return new w.module.DiscourseUploadService(location.origin).uploadFileDetailed(
      new File(['fixture'], 'sticker.webp', { type: 'image/webp' })
    )
  })
  expect(result).toMatchObject({
    short_url: 'upload://native.webp',
    short_path: '/uploads/short-url/native.webp',
    width: 80
  })
  expect(await page.evaluate(() => (window as any).sent[0].message.options.nativeUpload)).toBe(true)
})

test('disabled option retains built-in API and never sends a native upload', async ({ page }) => {
  await fixture(page, false)
  const result = await page.evaluate(async () => {
    const w = window as any
    w.fetch = async () => new Response(JSON.stringify({ url: '/api.webp' }), { status: 200 })
    const result = await new w.module.DiscourseUploadService(location.origin).uploadFileDetailed(
      new File(['x'], 'a.webp')
    )
    return { result, sent: w.sent }
  })
  expect(result.sent.some((entry: any) => entry.message.type === 'PAGE_UPLOAD')).toBe(false)
  expect(result.result.url).toContain('/api.webp')
})

test('only explicitly unavailable tabs permit another attempt; accepted failures do not duplicate', async ({
  page
}) => {
  await fixture(page)
  const result = await page.evaluate(async () => {
    const w = window as any
    w.chrome.tabs.query = async () => [
      { id: 9, url: 'https://other.example/t/1' },
      { id: 1, url: location.origin + '/1' },
      { id: 2, url: location.origin + '/2' }
    ]
    const ids: number[] = []
    w.chrome.tabs.sendMessage = async (id: number) => {
      ids.push(id)
      return {
        success: true,
        data:
          id === 1
            ? { nativeUnavailable: true }
            : { ok: false, status: 500, data: { message: 'accepted upload failed' } }
      }
    }
    const response = await w.module.uploadNativeViaTab(location.origin, {})
    return { ids, response }
  })
  expect(result.ids).toEqual([1, 2])
  expect(result.response.data.status).toBe(500)
})

test('page handler uses real native bridge and serializes same-name uploads without API fallback', async ({
  page
}) => {
  await fixture(page)
  const results = await page.evaluate(async () => {
    const w = window as any
    const events = new Map<string, Set<Function>>()
    let active = 0
    let maxActive = 0
    const appEvents = {
      has: () => true,
      on: (name: string, fn: Function) => {
        if (!events.has(name)) events.set(name, new Set())
        events.get(name)!.add(fn)
      },
      off: (name: string, fn: Function) => events.get(name)?.delete(fn),
      trigger: (name: string, file: File) => {
        if (name !== 'composer:add-files') return
        maxActive = Math.max(maxActive, ++active)
        setTimeout(() => {
          --active
          events
            .get('composer:upload-success')
            ?.forEach(fn =>
              fn(file.name, { url: '/native.webp', short_url: 'upload://native.webp' })
            )
        }, 10)
      }
    }
    w.Discourse = { __container__: { lookup: () => appEvents } }
    w.fetch = () => {
      throw new Error('must not use API')
    }
    const request = () =>
      new Promise(resolve =>
        w.module.pageUploadHandler(
          {
            type: 'PAGE_UPLOAD',
            options: {
              url: location.origin + '/uploads.json',
              nativeUpload: true,
              fileData: [1, 2],
              fileName: 'same.webp',
              mimeType: 'image/webp'
            }
          },
          {},
          resolve
        )
      )
    const results = await Promise.all([request(), request()])
    return { results, maxActive }
  })
  expect(results.maxActive).toBe(1)
  expect(results.results).toEqual([
    {
      success: true,
      data: {
        ok: true,
        status: 200,
        data: { url: '/native.webp', short_url: 'upload://native.webp' }
      }
    },
    {
      success: true,
      data: {
        ok: true,
        status: 200,
        data: { url: '/native.webp', short_url: 'upload://native.webp' }
      }
    }
  ])
})

test('native option reports missing forum tabs instead of falling back to API', async ({
  page
}) => {
  await fixture(page)
  const message = await page.evaluate(async () => {
    const w = window as any
    w.chrome.tabs.query = async () => []
    w.fetch = () => {
      throw new Error('must not use API')
    }
    try {
      await new w.module.DiscourseUploadService(location.origin).uploadFileDetailed(
        new File(['x'], 'a.webp')
      )
    } catch (error) {
      return (error as Error).message
    }
  })
  expect(message).toContain('请先打开并登录')
})

test('native uploader unavailable and cross-origin requests fail without built-in API', async ({
  page
}) => {
  await fixture(page)
  const results = await page.evaluate(async () => {
    const w = window as any
    w.fetch = () => {
      throw new Error('must not use API')
    }
    const request = (origin: string) =>
      new Promise(resolve =>
        w.module.pageUploadHandler(
          {
            type: 'PAGE_UPLOAD',
            options: {
              url: origin + '/uploads.json',
              nativeUpload: true,
              fileData: [1],
              fileName: 'a.webp'
            }
          },
          {},
          resolve
        )
      )
    return [await request('https://wrong.example'), await request(location.origin)]
  })
  expect(results[0]).toMatchObject({ success: false })
  expect(results[1]).toMatchObject({ success: true, data: { ok: false, nativeUnavailable: true } })
})

test('native 429 preserves wait metadata and retries the same file', async ({ page }) => {
  await fixture(page)
  const result = await page.evaluate(async () => {
    const w = window as any
    let attempts = 0
    const waits: number[] = []
    const files: string[] = []
    w.chrome.tabs.sendMessage = async (_id: number, message: any) => {
      files.push(message.options.fileName)
      if (++attempts === 1)
        return {
          success: true,
          data: {
            ok: false,
            status: 429,
            data: { message: 'Too many requests', extras: { wait_seconds: 1 } }
          }
        }
      return { success: true, data: { ok: true, status: 200, data: { url: '/native.webp' } } }
    }
    const upload = await new w.module.DiscourseUploadService(location.origin).uploadFileDetailed(
      new File(['x'], 'same.webp'),
      undefined,
      async (ms: number) => {
        waits.push(ms)
      }
    )
    return { waits, files, upload }
  })
  expect(result.waits).toEqual([1000])
  expect(result.files).toEqual(['same.webp', 'same.webp'])
  expect(result.upload.url).toContain('/native.webp')
})

test('background native setting is independently persisted and defaults off', async ({ page }) => {
  await page.route('https://s.pwsh.us.kg/**', route => route.fulfill({ status: 404 }))
  await page.addInitScript(() => {
    if (!localStorage.getItem('appSettings')) {
      localStorage.setItem(
        'appSettings',
        JSON.stringify({
          imageScale: 100,
          defaultGroup: 'fixture',
          showSearchBar: true,
          gridColumns: 4,
          useDiscourseNativeUpload: true
        })
      )
      localStorage.setItem('emojiGroupIndex', JSON.stringify([{ id: 'fixture', order: 0 }]))
      localStorage.setItem(
        'emojiGroup_fixture',
        JSON.stringify({
          id: 'fixture',
          name: 'fixture',
          icon: '',
          order: 0,
          emojis: []
        })
      )
    }
  })
  await page.goto('/?mode=options#/settings')
  await page.getByRole('tab', { name: '开关', exact: true }).click()
  const toggle = page
    .locator('.setting-switch')
    .filter({
      has: page.getByText('后台使用原生上传器', { exact: true })
    })
    .getByRole('switch')
  await expect(toggle).toHaveAttribute('aria-checked', 'false')
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-checked', 'true')
  await page.waitForTimeout(1000)
  await page.reload()
  await page.getByRole('tab', { name: '开关', exact: true }).click()
  await expect(toggle).toHaveAttribute('aria-checked', 'true')
  await expect(
    page
      .locator('.setting-switch')
      .filter({
        has: page.getByText('使用 Discourse 原生上传器', { exact: true })
      })
      .getByRole('switch')
  ).toHaveAttribute('aria-checked', 'true')
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-checked', 'false')
})
