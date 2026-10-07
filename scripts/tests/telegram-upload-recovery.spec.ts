import { expect, test } from '@playwright/test'

import { getUploadRetryDelay, isUploadChallenge } from '../../src/utils/uploadRetry'
import { uploadLinuxDoMultipart } from '../../src/utils/discourseUpload'

test('reads Discourse wait metadata and both Retry-After formats', () => {
  const now = Date.parse('2026-10-07T00:00:00Z')
  expect(getUploadRetryDelay({ extras: { wait_seconds: '12' } })).toBe(12000)
  expect(getUploadRetryDelay({}, '7')).toBe(7000)
  expect(getUploadRetryDelay({}, 'Wed, 07 Oct 2026 00:01:00 GMT', now)).toBe(60000)
  expect(getUploadRetryDelay({}, 'garbage')).toBeNull()
  expect(getUploadRetryDelay({ extras: { wait_seconds: -1 } })).toBeNull()
  expect(getUploadRetryDelay({}, '0')).toBe(1000)
})

test('distinguishes ordinary 429 from verification HTML on either 403 or 429', () => {
  expect(isUploadChallenge(429, { errors: ['Too many requests'] })).toBe(false)
  expect(isUploadChallenge(429, { message: '<title>Just a moment...</title>' })).toBe(true)
  expect(isUploadChallenge(403, { message: 'cf-chl-platform' })).toBe(true)
  expect(isUploadChallenge(429, {}, 'challenge')).toBe(true)
  expect(isUploadChallenge(500, { message: 'Just a moment' })).toBe(false)
})

test('multipart failure preserves retry and verification headers for the page proxy', async () => {
  await expect(
    uploadLinuxDoMultipart({
      baseUrl: 'https://linux.do',
      file: new Blob(['fixture']),
      fileName: 'fixture.webp',
      fetchImpl: async () =>
        new Response('<title>Just a moment...</title>', {
          status: 429,
          headers: { 'Retry-After': '15', 'cf-mitigated': 'challenge' }
        })
    })
  ).rejects.toMatchObject({
    status: 429,
    isRateLimitError: true,
    waitTime: 15000,
    retryHeaders: { 'retry-after': '15', 'cf-mitigated': 'challenge' },
    details: { message: '<title>Just a moment...</title>' }
  })
})

// The service is exercised through its real proxy-response parser, without network or timers.
async function proxyFixture(
  responses: any[],
  run: (
    service: any,
    context: { messages: any[]; waits: number[]; advance: (ms: number) => void }
  ) => Promise<void>,
  recoverySuccess = true
) {
  const scope = globalThis as any
  const previous = {
    chrome: scope.chrome,
    location: scope.location,
    logger: scope.createLogger,
    now: Date.now
  }
  const messages: any[] = []
  const waits: number[] = []
  let time = Date.now()
  scope.createLogger = () => ({ debug() {}, info() {}, warn() {}, error() {} })
  scope.location = { protocol: 'chrome-extension:' }
  scope.chrome = {
    runtime: {
      sendMessage(message: any, callback: (response: any) => void) {
        messages.push(message)
        if (message.type === 'LINUX_DO_RECOVER_CHALLENGE')
          callback({ success: recoverySuccess, error: 'verification timed out' })
        else callback({ success: true, data: responses.shift() })
      }
    }
  }
  Date.now = () => time
  try {
    const { uploadServices } = await import('../../src/utils/uploadServices')
    await run(uploadServices['linux.do'], {
      messages,
      waits,
      advance: ms => {
        time += ms
      }
    })
  } finally {
    Date.now = previous.now
    for (const [key, value] of [
      ['chrome', previous.chrome],
      ['location', previous.location],
      ['createLogger', previous.logger]
    ] as const) {
      if (value === undefined) delete scope[key]
      else scope[key] = value
    }
  }
}
const success = {
  status: 200,
  ok: true,
  data: { url: '/uploads/fixture.webp', short_url: 'upload://fixture.webp' }
}
const fixtureFile = () => new File(['fixture'], 'fixture.webp', { type: 'image/webp' })

for (const [name, response, expectedWait] of [
  ['bare 429', { status: 429, ok: false, data: {} }, 60000],
  ['header-only 429', { status: 429, ok: false, data: {}, headers: { 'retry-after': '4' } }, 4000],
  ['Discourse JSON 429', { status: 429, ok: false, data: { extras: { wait_seconds: 3 } } }, 3000]
] as const) {
  test(`${name} waits once then retries the same file`, async () => {
    await proxyFixture([response, success], async (service, context) => {
      const result = await service.uploadFileDetailed(
        fixtureFile(),
        undefined,
        async (ms: number) => {
          context.waits.push(ms)
          context.advance(ms) // callback owns the wait; no second timer should be scheduled
        }
      )
      expect(context.waits).toEqual([expectedWait])
      expect(result.short_url).toBe('upload://fixture.webp')
      expect(context.messages.map(item => item.type)).toEqual([
        'LINUX_DO_UPLOAD',
        'LINUX_DO_UPLOAD'
      ])
    })
  })
}

test('429 verification HTML opens the normal challenge page before retry, not a rate-limit timer', async () => {
  await proxyFixture(
    [{ status: 429, ok: false, data: { message: 'Just a moment...' } }, success],
    async (service, context) => {
      await service.uploadFileDetailed(fixtureFile(), undefined, async () => {
        throw new Error('must not enter rate-limit timer')
      })
      expect(context.messages.map(item => item.type)).toEqual([
        'LINUX_DO_UPLOAD',
        'LINUX_DO_RECOVER_CHALLENGE',
        'LINUX_DO_UPLOAD'
      ])
      expect(context.messages[1].options.url).toBe('https://linux.do/challenge')
    }
  )
})

test('persistent 429 continues beyond three attempts and eventually saves the same file', async () => {
  const limited = { status: 429, ok: false, data: {}, headers: { 'retry-after': '4' } }
  await proxyFixture([...Array(6).fill(limited), success], async (service, context) => {
    const result = await service.uploadFileDetailed(
      fixtureFile(),
      undefined,
      async (ms: number) => {
        context.waits.push(ms)
        context.advance(ms)
      }
    )
    expect(result.short_url).toBe('upload://fixture.webp')
    expect(context.messages).toHaveLength(7)
    expect(context.waits).toEqual(Array(6).fill(4000))
    expect(context.messages.every(item => item.type === 'LINUX_DO_UPLOAD')).toBe(true)
    expect(new Set(context.messages.map(item => JSON.stringify(item.options))).size).toBe(1)
  })
})

test('persistent 429 stops only when the user cancels a later countdown', async () => {
  const limited = { status: 429, ok: false, data: {} }
  await proxyFixture(Array(10).fill(limited), async (service, context) => {
    await expect(
      service.uploadFileDetailed(fixtureFile(), undefined, async (ms: number) => {
        context.waits.push(ms)
        if (context.waits.length === 5) throw new DOMException('Cancelled', 'AbortError')
        context.advance(ms)
      })
    ).rejects.toMatchObject({ name: 'AbortError' })
    expect(context.messages).toHaveLength(5)
    expect(context.waits).toHaveLength(5)
  })
})

test('cancelled wait never retries the current file', async () => {
  await proxyFixture([{ status: 429, ok: false, data: {} }, success], async (service, context) => {
    await expect(
      service.uploadFileDetailed(fixtureFile(), undefined, async () => {
        throw new DOMException('Cancelled', 'AbortError')
      })
    ).rejects.toMatchObject({ name: 'AbortError' })
    expect(context.messages).toHaveLength(1)
  })
})

test('verification timeout stops the import instead of opening tabs for each remaining sticker', async () => {
  await proxyFixture(
    [{ status: 403, ok: false, headers: { 'cf-mitigated': 'challenge' }, data: {} }],
    async (service, context) => {
      await expect(service.uploadFileDetailed(fixtureFile())).rejects.toMatchObject({
        shouldTerminateUploadFlow: true
      })
      expect(context.messages).toHaveLength(2)
    },
    false
  )
})

async function startWaitingImport(page: import('@playwright/test').Page, rateLimitCount = 0) {
  await page.addInitScript(() => {
    localStorage.setItem('telegramBotToken', JSON.stringify('fixture-token'))
    localStorage.setItem('emojiGroupIndex', JSON.stringify([{ id: 'telegram_wait', order: 0 }]))
    localStorage.setItem(
      'emojiGroup_telegram_wait',
      JSON.stringify({
        id: 'telegram_wait',
        name: 'Waiting fixture',
        icon: '',
        order: 0,
        detail: 'Telegram 贴纸包：WaitFixture',
        emojis: []
      })
    )
  })
  let release!: () => void
  const ready = new Promise<void>(resolve => {
    release = resolve
  })
  await page.route('https://s.pwsh.us.kg/**', route => route.fulfill({ status: 404 }))
  await page.route('https://api.telegram.org/**', async route => {
    const url = route.request().url()
    if (url.includes('getStickerSet')) {
      await ready
      await route.fulfill({
        json: {
          ok: true,
          result: {
            name: 'WaitFixture',
            title: 'Waiting fixture',
            stickers: [
              {
                file_id: 'fixture-file',
                file_unique_id: 'fixture-unique',
                width: 1,
                height: 1,
                is_animated: false,
                is_video: false,
                type: 'regular'
              }
            ]
          }
        }
      })
    } else if (url.includes('getFile')) {
      await route.fulfill({ json: { ok: true, result: { file_path: 'fixture.png' } } })
    } else {
      await route.fulfill({
        body: Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==',
          'base64'
        ),
        contentType: 'image/png'
      })
    }
  })
  await page.goto(
    'http://localhost:4189/?mode=options#/import?source=telegram&tgGroupId=telegram_wait&tgInput=WaitFixture&tgAuto=1'
  )
  await page.evaluate(async rateLimitCount => {
    const moduleUrl = '/js/uploadServices.js'
    const module = await import(moduleUrl)
    const services = Object.values(module).find(
      (value: any) => value?.['linux.do']?.uploadFileDetailed
    ) as any
    if (rateLimitCount) {
      const w = window as any
      w.uploadAttempts = 0
      w.uploadedNames = []
      services['linux.do'].attemptUploadDetailed = async (file: File) => {
        w.uploadAttempts++
        w.uploadedNames.push(file.name)
        if (w.uploadAttempts <= rateLimitCount) {
          throw Object.assign(new Error('上传请求过于频繁，等待后重试'), {
            status: 429,
            isRateLimitError: true,
            waitTime: 1000
          })
        }
        return { url: 'https://linux.do/uploads/fixture.png', short_url: 'upload://fixture.png' }
      }
      return
    }
    services['linux.do'].uploadFileDetailed = async (
      _file: File,
      _progress: unknown,
      onWait: (ms: number) => Promise<void>
    ) => {
      await onWait(2000)
      return { url: 'https://linux.do/uploads/fixture.png', short_url: 'upload://fixture.png' }
    }
  }, rateLimitCount)
  release()
}

test('TG options shows the upload countdown and then returns after saving the same sticker', async ({
  page
}) => {
  await startWaitingImport(page)
  await expect(page.getByText('上传限流，等待 2 秒后重试当前贴纸...')).toBeVisible()
  await expect(page).toHaveURL(/#\/groups$/, { timeout: 10000 })
  const group = await page.evaluate(() => {
    const value = JSON.parse(localStorage.getItem('emojiGroup_telegram_wait')!)
    return value.data || value
  })
  expect(group.emojis).toHaveLength(1)
  expect(group.emojis[0].short_url).toBe('upload://fixture.png')
})

test('TG UI survives four consecutive upload 429 responses and returns only after success', async ({
  page
}) => {
  await startWaitingImport(page, 4)
  await expect(page.getByText('上传限流，等待 1 秒后重试当前贴纸...')).toBeVisible()
  await expect(page).toHaveURL(/#\/groups$/, { timeout: 15000 })
  const result = await page.evaluate(() => {
    const w = window as any
    return {
      attempts: w.uploadAttempts,
      names: w.uploadedNames,
      saved: JSON.parse(localStorage.getItem('emojiGroup_telegram_wait')!)
    }
  })
  expect(result.attempts).toBe(5)
  expect(new Set(result.names).size).toBe(1)
  expect((result.saved.data || result.saved).emojis).toHaveLength(1)
  await expect(page.getByText(/上传已暂停/)).toHaveCount(0)
})

test('cancelling the TG upload countdown resolves the pending wait without success navigation', async ({
  page
}) => {
  await startWaitingImport(page)
  await expect(page.getByText('上传限流，等待 2 秒后重试当前贴纸...')).toBeVisible()
  await page.getByRole('button', { name: '取消导入' }).click()
  await expect(page.getByText('已取消导入（已处理 0 个贴纸）')).toBeVisible()
  expect(page.url()).toContain('#/import?')
})

async function seedAutoUpdate(page: import('@playwright/test').Page, token = true) {
  await page.addInitScript(
    ({ token }) => {
      if (token) localStorage.setItem('telegramBotToken', JSON.stringify('fixture-token'))
      localStorage.setItem(
        'emojiGroupIndex',
        JSON.stringify([
          { id: 'telegram_renamed', order: 0 },
          { id: 'telegram_title_match', order: 1 }
        ])
      )
      localStorage.setItem(
        'emojiGroup_telegram_renamed',
        JSON.stringify({
          id: 'telegram_renamed',
          name: 'Renamed fixture',
          icon: '📦',
          order: 0,
          emojis: [],
          detail: 'My notes\n\nTelegram 贴纸包：https://t.me/addstickers/CanonicalPack'
        })
      )
      localStorage.setItem(
        'emojiGroup_telegram_title_match',
        JSON.stringify({
          id: 'telegram_title_match',
          name: 'Original pack title',
          icon: '📦',
          order: 1,
          emojis: [],
          detail: 'Untouched'
        })
      )
    },
    { token }
  )
  await page.route('https://s.pwsh.us.kg/**', route => route.fulfill({ status: 404 }))
  let requests = 0
  await page.route('https://api.telegram.org/**', route => {
    requests++
    return route.fulfill({
      json: {
        ok: true,
        result: { name: 'CanonicalPack', title: 'Original pack title', stickers: [] }
      }
    })
  })
  return () => requests
}

async function verifyCorrectTarget(page: import('@playwright/test').Page) {
  await expect(page).toHaveURL(/#\/groups$/, { timeout: 10000 })
  const groups = await page.evaluate(() =>
    ['telegram_renamed', 'telegram_title_match'].map(id => {
      const value = JSON.parse(localStorage.getItem(`emojiGroup_${id}`)!)
      return value.data || value
    })
  )
  expect(groups[0].name).toBe('Renamed fixture')
  expect(groups[0].detail).toBe('My notes\n\nTelegram 贴纸包：CanonicalPack')
  expect(groups[1].detail).toBe('Untouched')
}

test('actual group update menu automatically updates the clicked renamed group, not a title match', async ({
  page
}) => {
  const requests = await seedAutoUpdate(page)
  await page.goto('http://localhost:4189/?mode=options#/groups')
  const group = page.locator('.group-item').filter({ hasText: 'Renamed fixture' })
  await group.getByRole('button', { name: '更多操作' }).click()
  await page.getByText('更新（Telegram）', { exact: true }).click()
  await verifyCorrectTarget(page)
  expect(requests()).toBe(1)
})

test('same import component responds to a later automatic-update route request', async ({
  page
}) => {
  const requests = await seedAutoUpdate(page)
  await page.goto('http://localhost:4189/?mode=options#/import?source=telegram')
  await page.getByRole('tab', { name: 'Telegram 配置', exact: true }).click()
  await expect(page.getByPlaceholder('输入 Telegram Bot Token')).toHaveValue('fixture-token')
  await page.evaluate(() => {
    location.hash =
      '/import?source=telegram&tgAuto=1&tgGroupId=telegram_renamed&tgInput=CanonicalPack'
  })
  await verifyCorrectTarget(page)
  expect(requests()).toBe(1)
})

test('saving a missing Bot Token resumes automatic update, without fetching on each keystroke', async ({
  page
}) => {
  const requests = await seedAutoUpdate(page, false)
  await page.goto(
    'http://localhost:4189/?mode=options#/import?source=telegram&tgAuto=1&tgGroupId=telegram_renamed&tgInput=CanonicalPack'
  )
  await expect(
    page.getByText('未检测到 Telegram Bot Token，请先保存 Token，随后会自动更新')
  ).toBeVisible()
  await page.getByPlaceholder('输入 Telegram Bot Token').fill('fixture-token')
  expect(requests()).toBe(0)
  await page.getByRole('button', { name: /^保\s*存$/ }).click()
  await verifyCorrectTarget(page)
  expect(requests()).toBe(1)
})

test('buffer modal persists pack provenance for the next group-menu auto update', async ({
  page
}) => {
  await page.addInitScript(() => {
    localStorage.setItem('telegramBotToken', JSON.stringify('fixture-token'))
    if (!localStorage.getItem('emojiGroupIndex'))
      localStorage.setItem('emojiGroupIndex', JSON.stringify([]))
  })
  await page.route('https://s.pwsh.us.kg/**', route => route.fulfill({ status: 404 }))
  await page.route('https://api.telegram.org/**', route =>
    route.fulfill({
      json: {
        ok: true,
        result: { name: 'CanonicalPack', title: 'Buffer fixture pack', stickers: [] }
      }
    })
  )
  await page.goto('http://localhost:4189/?mode=options#/buffer')
  await page.getByRole('button', { name: 'Telegram 贴纸导入' }).click()
  const modal = page.getByRole('dialog')
  await modal
    .getByPlaceholder('例如：https://t.me/addstickers/xxx 或 xxx')
    .fill('https://t.me/addstickers/CanonicalPack')
  await modal.getByRole('button', { name: /预\s*览/ }).click()
  await modal.getByRole('button', { name: '开始导入' }).click()
  await expect(modal).not.toBeVisible()
  const detail = await page.evaluate(() => {
    const values = Object.keys(localStorage)
      .filter(key => key.startsWith('emojiGroup_'))
      .map(key => {
        const value = JSON.parse(localStorage.getItem(key)!)
        return value.data || value
      })
    return values.find(group => group.name === 'Buffer fixture pack')?.detail
  })
  expect(detail).toBe('Telegram 贴纸包：CanonicalPack')
  await page.goto('http://localhost:4189/?mode=options#/groups')
  const group = page.locator('.group-item').filter({ hasText: 'Buffer fixture pack' })
  await group.getByRole('button', { name: '更多操作' }).click()
  await page.getByText('更新（Telegram）', { exact: true }).click()
  await expect(page).toHaveURL(/#\/groups$/, { timeout: 10000 })
})

test('legacy group without source can supply it once and immediately finish the requested update', async ({
  page
}) => {
  const requests = await seedAutoUpdate(page)
  await page.addInitScript(() => {
    const group = JSON.parse(localStorage.getItem('emojiGroup_telegram_renamed')!)
    group.detail = 'My notes'
    localStorage.setItem('emojiGroup_telegram_renamed', JSON.stringify(group))
  })
  await page.goto(
    'http://localhost:4189/?mode=options#/import?source=telegram&tgAuto=1&tgGroupId=telegram_renamed'
  )
  await expect(
    page.getByText('此旧分组未保存贴纸包来源，请输入链接并预览；本次会自动更新并保存来源')
  ).toBeVisible()
  await page
    .getByPlaceholder('例如：https://t.me/addstickers/xxx 或 xxx', { exact: true })
    .fill('https://t.me/addstickers/CanonicalPack')
  await page.getByRole('button', { name: /预\s*览/ }).click()
  await verifyCorrectTarget(page)
  expect(requests()).toBe(1)
})

test('buffer modal can cancel a rate-limit countdown and saves completed stickers', async ({
  page
}) => {
  await page.addInitScript(() => {
    localStorage.setItem('telegramBotToken', JSON.stringify('fixture-token'))
    localStorage.setItem('emojiGroupIndex', JSON.stringify([]))
  })
  await page.route('https://s.pwsh.us.kg/**', route => route.fulfill({ status: 404 }))
  await page.route('https://api.telegram.org/**', route => {
    const url = route.request().url()
    if (url.includes('getStickerSet'))
      return route.fulfill({
        json: {
          ok: true,
          result: {
            name: 'CancelPack',
            title: 'Cancelled buffer fixture',
            stickers: [1, 2].map(i => ({
              file_id: `fixture${i}`,
              file_unique_id: `fixture${i}`,
              emoji: '😀',
              width: 1,
              height: 1,
              is_animated: false,
              is_video: false,
              type: 'regular'
            }))
          }
        }
      })
    if (url.includes('getFile'))
      return route.fulfill({ json: { ok: true, result: { file_path: 'fixture.png' } } })
    return route.fulfill({
      body: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==',
        'base64'
      ),
      contentType: 'image/png'
    })
  })
  await page.goto('http://localhost:4189/?mode=options#/buffer')
  await page.evaluate(async () => {
    const module = await import('/js/uploadServices.js')
    const services = Object.values(module).find(
      (value: any) => value?.['linux.do']?.uploadFileDetailed
    ) as any
    const w = window as any
    w.uploadAttempts = 0
    services['linux.do'].attemptUploadDetailed = async () => {
      if (++w.uploadAttempts === 1)
        return { url: 'https://linux.do/uploads/fixture.png', short_url: 'upload://fixture.png' }
      throw Object.assign(new Error('Too many requests'), {
        status: 429,
        isRateLimitError: true,
        waitTime: 60000
      })
    }
  })
  await page.getByRole('button', { name: 'Telegram 贴纸导入' }).click()
  const modal = page.getByRole('dialog')
  await modal.getByPlaceholder('例如：https://t.me/addstickers/xxx 或 xxx').fill('CancelPack')
  await modal.getByRole('button', { name: /预\s*览/ }).click()
  await modal.getByRole('button', { name: '开始导入' }).click()
  await expect(modal.getByText(/上传限流，等待/)).toBeVisible()
  await modal.getByRole('button', { name: '取消导入', exact: true }).click()
  await expect(modal.getByRole('button', { name: /^取\s*消$/ })).toBeEnabled()
  expect(await page.evaluate(() => (window as any).uploadAttempts)).toBe(2)
  const saved = await page.evaluate(() =>
    Object.keys(localStorage)
      .filter(key => key.startsWith('emojiGroup_'))
      .map(key => {
        const raw = JSON.parse(localStorage.getItem(key)!)
        return raw.data || raw
      })
      .find(group => group.name === 'Cancelled buffer fixture')
  )
  expect(saved.emojis).toHaveLength(1)
  expect(saved.emojis[0].short_url).toBe('upload://fixture.png')
  await expect(modal).toBeVisible()
})

test('Telegram config is in a separate subtab; import state survives switching tabs', async ({
  page
}) => {
  await seedAutoUpdate(page)
  await page.goto('http://localhost:4189/?mode=options#/import?source=telegram')
  const input = page.getByPlaceholder('例如：https://t.me/addstickers/xxx 或 xxx', { exact: true })
  await input.fill('DraftPack')
  await expect(page.getByPlaceholder('输入 Telegram Bot Token')).not.toBeVisible()
  await page.getByRole('tab', { name: 'Telegram 配置', exact: true }).click()
  await expect(page.getByPlaceholder('输入 Telegram Bot Token')).toHaveValue('fixture-token')
  await expect(page.getByText('上传服务', { exact: true })).toBeVisible()
  await page.evaluate(() => document.documentElement.classList.add('dark'))
  await page.evaluate(() => document.documentElement.classList.add('dark'))
  const idleRadio = page.locator('.telegram-upload-radio .ant-radio-button-wrapper').nth(1)
  await expect
    .poll(() => idleRadio.evaluate(element => getComputedStyle(element).backgroundColor))
    .toBe('rgb(24, 24, 27)')
  await expect(input).not.toBeVisible()
  await page.getByRole('tab', { name: '贴纸导入', exact: true }).click()
  await expect(input).toHaveValue('DraftPack')
})

test('custom Discourse upload domains are normalized, authenticated and can upload', async () => {
  const scope = globalThis as any
  const previous = {
    fetch: scope.fetch,
    location: scope.location,
    chrome: scope.chrome,
    logger: scope.createLogger
  }
  const calls: any[] = []
  scope.createLogger = () => ({ debug() {}, info() {}, warn() {}, error() {} })
  scope.location = { protocol: 'https:' }
  scope.chrome = undefined
  scope.fetch = async (url: string, options: any) => {
    calls.push({ url, credentials: options.credentials, headers: options.headers })
    return new Response(
      JSON.stringify({ url: '/uploads/fixture.png', short_url: 'upload://fixture.png' }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' }
      }
    )
  }
  try {
    const { createDiscourseUploadService: create } = await import('../../src/utils/uploadServices')
    const service = create('https://forum.example.com/')
    const upload = await service.uploadFileDetailed(
      new File(['fixture'], 'fixture.png', { type: 'image/png' })
    )
    expect(upload.url).toBe('https://forum.example.com/uploads/fixture.png')
    expect(upload.short_url).toBe('upload://fixture.png')
    expect(calls[0].url).toBe('https://forum.example.com/uploads.json')
    expect(calls[0].credentials).toBe('include')
    expect(calls[0].url).not.toContain('client_id=')
    expect(() => create('http://forum.example.com')).toThrow()
    expect(() => create('https://forum.example.com/category')).toThrow()
  } finally {
    scope.fetch = previous.fetch
    scope.location = previous.location
    scope.chrome = previous.chrome
    scope.createLogger = previous.logger
  }
})

test('Telegram update subtab lists saved pack sources and launches the selected update', async ({
  page
}) => {
  const requests = await seedAutoUpdate(page)
  await page.goto('http://localhost:4189/?mode=options#/import?source=telegram')
  await page.getByRole('tab', { name: '更新', exact: true }).click()
  const entry = page.getByText('Renamed fixture', { exact: true })
  await expect(entry).toBeVisible()
  await expect(page.getByText('CanonicalPack', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '更新此分组' }).click()
  await expect(page).toHaveURL(/#\/groups$/, { timeout: 10000 })
  expect(requests()).toBe(1)
})

test('upload service radio buttons follow dark mode and custom domain persists', async ({
  page
}) => {
  await seedAutoUpdate(page)
  await page.goto('http://localhost:4189/?mode=options#/import?source=telegram')
  await page.getByRole('tab', { name: 'Telegram 配置', exact: true }).click()
  await page.evaluate(() => document.documentElement.classList.add('dark'))
  const idleRadio = page.locator('.telegram-upload-radio .ant-radio-button-wrapper').nth(1)
  await expect
    .poll(() =>
      idleRadio.evaluate(element => {
        const style = getComputedStyle(element)
        return { background: style.backgroundColor, color: style.color }
      })
    )
    .toEqual({ background: 'rgb(24, 24, 27)', color: 'rgb(229, 231, 235)' })
  await page
    .getByRole('textbox', { name: '自定义 Discourse 实例域名' })
    .fill('https://forum.example.com/')
  await page.getByRole('button', { name: '添加并使用此实例' }).click()
  await expect(page.getByRole('radio', { name: /forum\.example\.com/ })).toBeChecked()
  await expect(page.getByText('当前自定义实例：https://forum.example.com')).toBeVisible()
})
