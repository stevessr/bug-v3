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

test('persistent 429 has bounded retries and pauses the remaining import', async () => {
  const limited = { status: 429, ok: false, data: {} }
  await proxyFixture([limited, limited, limited], async (service, context) => {
    await expect(
      service.uploadFileDetailed(fixtureFile(), undefined, async (ms: number) => {
        context.waits.push(ms)
        context.advance(ms)
      })
    ).rejects.toMatchObject({ status: 429, shouldTerminateUploadFlow: true })
    expect(context.messages).toHaveLength(3)
    expect(context.waits).toHaveLength(2)
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

async function startWaitingImport(page: import('@playwright/test').Page) {
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
  await page.evaluate(async () => {
    const moduleUrl = '/js/uploadServices.js'
    const module = await import(moduleUrl)
    const services = Object.values(module).find(
      (value: any) => value?.['linux.do']?.uploadFileDetailed
    ) as any
    services['linux.do'].uploadFileDetailed = async (
      _file: File,
      _progress: unknown,
      onWait: (ms: number) => Promise<void>
    ) => {
      await onWait(2000)
      return { url: 'https://linux.do/uploads/fixture.png', short_url: 'upload://fixture.png' }
    }
  })
  release()
}

test('TG options shows the upload countdown and then returns after saving the same sticker', async ({
  page
}) => {
  await startWaitingImport(page)
  await expect(page.getByText('上传限流，等待 2 秒后重试当前贴纸...')).toBeVisible()
  await expect(page).toHaveURL(/#\/groups$/, { timeout: 10000 })
  const group = await page.evaluate(
    () => JSON.parse(localStorage.getItem('emojiGroup_telegram_wait')!).data
  )
  expect(group.emojis).toHaveLength(1)
  expect(group.emojis[0].short_url).toBe('upload://fixture.png')
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
