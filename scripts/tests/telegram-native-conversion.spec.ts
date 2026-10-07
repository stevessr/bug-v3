import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { expect, test } from '@playwright/test'

import { muxAnimatedWebp, webpFrameChunks } from '../../src/utils/telegram/nativeWebmConversion'

const fixture = readFileSync(new URL('./fixtures/telegram-colors.webm', import.meta.url))

async function installConverter(page: import('@playwright/test').Page) {
  const compiled = ts.transpileModule(
    readFileSync('src/utils/telegram/nativeWebmConversion.ts', 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }
  ).outputText
  await page.route('http://localhost/native-test', route =>
    route.fulfill({ body: '<html></html>', contentType: 'text/html' })
  )
  await page.goto('http://localhost/native-test')
  await page.addScriptTag({
    content: `window.nativeConverter = {}; (function(exports) { ${compiled} })(window.nativeConverter);`
  })
}

test('rejects malformed WebP frames and empty animations', () => {
  expect(() => webpFrameChunks(new Uint8Array(12))).toThrow('无效')
  expect(() => muxAnimatedWebp([], 32, 32)).toThrow('无效')
})

test('native WebM conversion preserves animated frames, timing and MIME', async ({ page }) => {
  await installConverter(page)
  const result = await page.evaluate(
    async bytes => {
      const converter = (window as any).nativeConverter
      const progress: string[] = []
      const { blob } = await converter.convertWebmInBrowser(
        new Blob([new Uint8Array(bytes)], { type: 'video/webm' }),
        'webp',
        {
          onProgress: (event: { message: string }) => progress.push(event.message)
        }
      )
      const decoder = new (window as any).ImageDecoder({
        data: await blob.arrayBuffer(),
        type: blob.type
      })
      await decoder.tracks.ready
      const count = decoder.tracks.selectedTrack.frameCount
      const colors: number[][] = []
      let duration = 0
      for (let i = 0; i < count; i++) {
        const { image } = await decoder.decode({ frameIndex: i })
        duration += image.duration
        if (i === 0 || i === count - 1) {
          const canvas = document.createElement('canvas')
          canvas.width = image.displayWidth
          canvas.height = image.displayHeight
          const ctx = canvas.getContext('2d')!
          ctx.drawImage(image, 0, 0)
          colors.push(Array.from(ctx.getImageData(0, 0, 1, 1).data))
        }
        image.close()
      }
      decoder.close()
      return { type: blob.type, count, duration, colors, progress: progress.length }
    },
    [...fixture]
  )
  expect(result.type).toBe('image/webp')
  expect(result.count).toBe(6)
  expect(result.duration).toBe(300000)
  expect(result.colors[0][0]).toBeGreaterThan(200)
  expect(result.colors[1][2]).toBeGreaterThan(200)
  expect(result.progress).toBe(6)
})

test('cancellation rejects and releases object URLs', async ({ page }) => {
  await installConverter(page)
  const result = await page.evaluate(
    async bytes => {
      const converter = (window as any).nativeConverter
      let created = 0
      let revoked = 0
      const create = URL.createObjectURL.bind(URL)
      const revoke = URL.revokeObjectURL.bind(URL)
      URL.createObjectURL = blob => {
        created++
        return create(blob)
      }
      URL.revokeObjectURL = url => {
        revoked++
        revoke(url)
      }
      const controller = new AbortController()
      try {
        await converter.convertWebmInBrowser(
          new Blob([new Uint8Array(bytes)], { type: 'video/webm' }),
          'webp',
          {
            signal: controller.signal,
            onProgress: () => controller.abort()
          }
        )
        return { error: '', created, revoked }
      } catch (error) {
        return { error: (error as Error).name, created, revoked }
      }
    },
    [...fixture]
  )
  expect(result.error).toBe('AbortError')
  expect(result.created).toBe(1)
  expect(result.revoked).toBe(1)
})

test('does not label unsupported Canvas PNG output as WebP', async ({ page }) => {
  await installConverter(page)
  const error = await page.evaluate(
    async bytes => {
      const original = HTMLCanvasElement.prototype.toBlob
      HTMLCanvasElement.prototype.toBlob = function (callback) {
        original.call(this, callback, 'image/png')
      }
      try {
        await (window as any).nativeConverter.convertWebmInBrowser(
          new Blob([new Uint8Array(bytes)], { type: 'video/webm' }),
          'webp'
        )
        return ''
      } catch (error) {
        return (error as Error).message
      }
    },
    [...fixture]
  )
  expect(error).toContain('不支持原生 WebP')
})

// These integration checks run against `pnpm build` output, including bundled WASM.
async function serveBuild(page: import('@playwright/test').Page) {
  await page.route('http://localhost/**', async route => {
    const path = new URL(route.request().url()).pathname
    try {
      const body = readFileSync(`dist${path === '/' ? '/index.html' : path}`)
      const contentType = path.endsWith('.js')
        ? 'text/javascript'
        : path.endsWith('.wasm')
          ? 'application/wasm'
          : path.endsWith('.css')
            ? 'text/css'
            : 'text/html'
      await route.fulfill({ body, contentType })
    } catch {
      await route.fulfill({ status: 404, body: '' })
    }
  })
}

test('built AVIF path encodes a real decodable static image locally', async ({ page }) => {
  await serveBuild(page)
  await page.goto('http://localhost/')
  const result = await page.evaluate(
    async bytes => {
      const moduleUrl = '/js/nativeWebmConversion.js'
      const { convertWebmInBrowser } = await import(moduleUrl)
      const { blob, warning } = await convertWebmInBrowser(
        new Blob([new Uint8Array(bytes)], { type: 'video/webm' }),
        'avif'
      )
      const bitmap = await createImageBitmap(blob)
      const size = [bitmap.width, bitmap.height]
      bitmap.close()
      return { type: blob.type, size, warning }
    },
    [...fixture]
  )
  expect(result.type).toBe('image/avif')
  expect(result.size).toEqual([32, 32])
  expect(result.warning).toContain('静态')
})

test('group-triggered successful update returns to groups after persistence', async ({ page }) => {
  await serveBuild(page)
  await page.addInitScript(() => {
    localStorage.setItem('telegramBotToken', JSON.stringify('fixture-token'))
    localStorage.setItem('emojiGroupIndex', JSON.stringify([{ id: 'telegram_fixture', order: 0 }]))
    localStorage.setItem(
      'emojiGroup_telegram_fixture',
      JSON.stringify({
        id: 'telegram_fixture',
        name: 'Fixture pack',
        icon: '',
        order: 0,
        detail: 'Telegram 贴纸包：FixturePack',
        emojis: []
      })
    )
  })
  await page.route('https://api.telegram.org/**', route =>
    route.fulfill({
      json: {
        ok: true,
        result: {
          name: 'FixturePack',
          title: 'Fixture pack',
          sticker_type: 'regular',
          stickers: []
        }
      }
    })
  )
  await page.goto(
    'http://localhost/?mode=options#/import?source=telegram&tgGroupId=telegram_fixture&tgInput=FixturePack&tgAuto=1'
  )
  await expect(page).toHaveURL(/#\/groups$/, { timeout: 15000 })
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('emojiGroup_telegram_fixture')!)
  )
  expect(saved.data.id).toBe('telegram_fixture')
})

test('failed group update stays on the import page', async ({ page }) => {
  await serveBuild(page)
  await page.addInitScript(() => {
    localStorage.setItem('telegramBotToken', JSON.stringify('fixture-token'))
  })
  await page.route('https://api.telegram.org/**', route =>
    route.fulfill({
      json: { ok: false, description: 'Fixture fetch failed' }
    })
  )
  await page.goto(
    'http://localhost/?mode=options#/import?source=telegram&tgGroupId=telegram_fixture&tgInput=FixturePack&tgAuto=1'
  )
  await expect(page.getByText('获取失败：Fixture fetch failed').first()).toBeVisible()
  expect(page.url()).toContain('#/import?')
})

test('animated AVIF is encoded entirely in browser WASM without a conversion server', async ({
  page
}) => {
  test.setTimeout(90000)
  await serveBuild(page)
  await page.route('http://localhost:4189/native-test', route =>
    route.fulfill({ body: '<html></html>', contentType: 'text/html' })
  )
  await page.goto('http://localhost:4189/native-test')
  const externalRequests: string[] = []
  page.on('request', request => {
    if (!request.url().startsWith('http://localhost:4189/') && !request.url().startsWith('blob:'))
      externalRequests.push(request.url())
  })
  const result = await page
    .evaluate(
      async bytes => {
        const moduleUrl = '/js/nativeWebmConversion.js'
        const { convertWebmInBrowser } = await import(moduleUrl)
        const { blob } = await convertWebmInBrowser(
          new Blob([new Uint8Array(bytes)], { type: 'video/webm' }),
          'animated-avif'
        )
        const decoder = new (window as any).ImageDecoder({
          data: await blob.arrayBuffer(),
          type: 'image/avif'
        })
        await decoder.tracks.ready
        const count = decoder.tracks.selectedTrack.frameCount
        let duration = 0
        const colors: number[][] = []
        for (let i = 0; i < count; i++) {
          const { image } = await decoder.decode({ frameIndex: i })
          duration += image.duration
          if (i === 0 || i === count - 1) {
            const canvas = document.createElement('canvas')
            canvas.width = image.displayWidth
            canvas.height = image.displayHeight
            const ctx = canvas.getContext('2d')!
            ctx.drawImage(image, 0, 0)
            colors.push(Array.from(ctx.getImageData(0, 0, 1, 1).data))
          }
          image.close()
        }
        decoder.close()
        return { type: blob.type, count, duration, colors }
      },
      [...fixture]
    )
    .catch(async error => {
      const bytes = await page.evaluate(() => (window as any).avifBytes)
      if (bytes) writeFileSync('/tmp/browser-animated-debug.avif', Buffer.from(bytes))
      throw error
    })
  expect(result.type).toBe('image/avif')
  expect(result.count).toBe(6)
  expect(result.duration).toBe(300000)
  expect(result.colors[0][0]).toBeGreaterThan(200)
  expect(result.colors[1][2]).toBeGreaterThan(200)
  expect(externalRequests).toEqual([])
})
