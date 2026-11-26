import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'

const mp4Fixture = readFileSync(new URL('./fixtures/sample-colors.mp4', import.meta.url))

function getVideoServiceUrl() {
  const manifest = JSON.parse(readFileSync('dist/.vite/manifest.json', 'utf8'))
  const entry = manifest['src/utils/video/videoToAnimationService.ts']
  if (!entry?.file) {
    throw new Error(
      'Missing src/utils/video/videoToAnimationService.ts in dist/.vite/manifest.json'
    )
  }
  return `/${entry.file}`
}

async function serveBuild(
  page: import('@playwright/test').Page,
  extraHeaders: Record<string, string> = {}
) {
  await page.route(/^http:\/\/localhost(?::\d+)?\//, async route => {
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
      await route.fulfill({ body, contentType, headers: extraHeaders })
    } catch {
      await route.fulfill({ status: 404, body: '' })
    }
  })
}

async function decodeAnimationInBrowser(
  page: import('@playwright/test').Page,
  serviceModuleUrl: string,
  mp4Bytes: number[],
  format: 'gif' | 'apng' | 'webp' | 'avif',
  extraOptions: { startTime?: number; duration?: number; fps?: number } = {}
) {
  return await page.evaluate(
    async ({ moduleUrl, bytes, targetFormat, extra }) => {
      const { convertVideoToAnimation } = await import(moduleUrl)
      const file = new File([new Uint8Array(bytes)], 'sample-colors.mp4', { type: 'video/mp4' })
      const result = await convertVideoToAnimation(file, {
        format: targetFormat,
        fps: 12,
        maxWidth: 32,
        quality: 75,
        ...extra
      })
      const buffer = await result.blob.arrayBuffer()
      const raw = new Uint8Array(buffer)
      const decoder = new (window as any).ImageDecoder({
        data: buffer,
        type: result.blob.type
      })
      await decoder.tracks.ready
      const frameCount = decoder.tracks.selectedTrack.frameCount
      const colors: number[][] = []
      for (const index of [0, frameCount - 1]) {
        const { image } = await decoder.decode({ frameIndex: index })
        const canvas = document.createElement('canvas')
        canvas.width = image.displayWidth
        canvas.height = image.displayHeight
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(image, 0, 0)
        colors.push(Array.from(ctx.getImageData(0, 0, 1, 1).data))
        image.close()
      }
      decoder.close()
      return {
        type: result.blob.type,
        fileName: result.fileName,
        size: result.size,
        width: result.width,
        height: result.height,
        frameCount,
        colors,
        headerBytes: Array.from(raw.slice(0, 16)),
        rawBytes: Array.from(raw),
        hasActl:
          targetFormat === 'apng'
            ? raw.some(
                (_, i) =>
                  raw[i] === 0x61 &&
                  raw[i + 1] === 0x63 &&
                  raw[i + 2] === 0x54 &&
                  raw[i + 3] === 0x4c
              )
            : false,
        hasAnim:
          targetFormat === 'webp'
            ? raw.some(
                (_, i) =>
                  raw[i] === 0x41 &&
                  raw[i + 1] === 0x4e &&
                  raw[i + 2] === 0x49 &&
                  raw[i + 3] === 0x4d
              )
            : false
      }
    },
    { moduleUrl: serviceModuleUrl, bytes: mp4Bytes, targetFormat: format, extra: extraOptions }
  )
}

test('built videoToAnimationService converts MP4 to GIF, APNG, WebP, and AVIF offline', async ({
  page
}) => {
  test.setTimeout(120000)
  await serveBuild(page)
  await page.route('http://localhost/video-test', route =>
    route.fulfill({ body: '<html></html>', contentType: 'text/html' })
  )
  const serviceModuleUrl = getVideoServiceUrl()
  const externalRequests: string[] = []
  page.on('request', request => {
    if (!request.url().startsWith('http://localhost/') && !request.url().startsWith('blob:')) {
      externalRequests.push(request.url())
    }
  })

  await page.goto('http://localhost/video-test')
  const bytes = [...mp4Fixture]

  const gif = await decodeAnimationInBrowser(page, serviceModuleUrl, bytes, 'gif')
  expect(gif.type).toBe('image/gif')
  expect(gif.fileName).toBe('sample-colors.gif')
  expect(String.fromCharCode(...gif.headerBytes.slice(0, 6))).toBe('GIF89a')
  expect(gif.frameCount).toBeGreaterThanOrEqual(2)
  expect(gif.colors[0][0]).toBeGreaterThan(180)
  expect(gif.colors[1][2]).toBeGreaterThan(180)

  const trimmedGif = await decodeAnimationInBrowser(page, serviceModuleUrl, bytes, 'gif', {
    duration: 0.15
  })
  expect(trimmedGif.frameCount).toBeLessThan(gif.frameCount)
  expect(trimmedGif.colors[0][0]).toBeGreaterThan(180)
  expect(trimmedGif.colors[1][0]).toBeGreaterThan(180)
  expect(trimmedGif.colors[1][2]).toBeLessThan(80)

  const apng = await decodeAnimationInBrowser(page, serviceModuleUrl, bytes, 'apng')
  expect(apng.type).toBe('image/apng')
  expect(apng.fileName).toBe('sample-colors.png')
  expect(apng.headerBytes.slice(0, 4)).toEqual([0x89, 0x50, 0x4e, 0x47])
  expect(apng.hasActl).toBe(true)
  expect(apng.frameCount).toBeGreaterThanOrEqual(2)
  expect(apng.colors[0][0]).toBeGreaterThan(180)
  expect(apng.colors[1][2]).toBeGreaterThan(180)

  const webp = await decodeAnimationInBrowser(page, serviceModuleUrl, bytes, 'webp')
  expect(webp.type).toBe('image/webp')
  expect(webp.fileName).toBe('sample-colors.webp')
  expect(String.fromCharCode(...webp.headerBytes.slice(0, 4))).toBe('RIFF')
  expect(String.fromCharCode(...webp.headerBytes.slice(8, 12))).toBe('WEBP')
  expect(webp.hasAnim).toBe(true)
  expect(webp.frameCount).toBeGreaterThanOrEqual(2)
  expect(webp.colors[0][0]).toBeGreaterThan(180)
  expect(webp.colors[1][2]).toBeGreaterThan(180)

  const avif = await decodeAnimationInBrowser(page, serviceModuleUrl, bytes, 'avif')
  expect(avif.type).toBe('image/avif')
  expect(avif.fileName).toBe('sample-colors.avif')
  expect(avif.frameCount).toBeGreaterThanOrEqual(2)
  expect(avif.colors[0][0]).toBeGreaterThan(180)
  expect(avif.colors[1][2]).toBeGreaterThan(180)

  // Verify GIF -> AVIF fallback path via FFmpeg PNG extraction + AV1 IVF mux
  const gifToAvif = await page.evaluate(
    async ({ moduleUrl, gifBytes }) => {
      const { convertVideoToAnimation } = await import(moduleUrl)
      const gifFile = new File([new Uint8Array(gifBytes)], 'animated.gif', { type: 'image/gif' })
      const result = await convertVideoToAnimation(gifFile, {
        format: 'avif',
        fps: 12,
        maxWidth: 32,
        quality: 75
      })
      const buffer = await result.blob.arrayBuffer()
      const decoder = new (window as any).ImageDecoder({
        data: buffer,
        type: result.blob.type
      })
      await decoder.tracks.ready
      const frameCount = decoder.tracks.selectedTrack.frameCount
      const colors: number[][] = []
      for (const index of [0, frameCount - 1]) {
        const { image } = await decoder.decode({ frameIndex: index })
        const canvas = document.createElement('canvas')
        canvas.width = image.displayWidth
        canvas.height = image.displayHeight
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(image, 0, 0)
        colors.push(Array.from(ctx.getImageData(0, 0, 1, 1).data))
        image.close()
      }
      decoder.close()
      return { type: result.blob.type, fileName: result.fileName, frameCount, colors }
    },
    { moduleUrl: serviceModuleUrl, gifBytes: gif.rawBytes }
  )
  expect(gifToAvif.type).toBe('image/avif')
  expect(gifToAvif.fileName).toBe('animated.avif')
  expect(gifToAvif.frameCount).toBeGreaterThanOrEqual(2)
  expect(gifToAvif.colors[0][0]).toBeGreaterThan(180)
  expect(gifToAvif.colors[1][2]).toBeGreaterThan(180)

  expect(externalRequests).toEqual([])
})

test('fps 0 keeps the source frame rate for every output format', async ({ page }) => {
  test.setTimeout(120000)
  await serveBuild(page)
  await page.route('http://localhost/video-test', route =>
    route.fulfill({ body: '<html></html>', contentType: 'text/html' })
  )
  await page.goto('http://localhost/video-test')
  const serviceModuleUrl = getVideoServiceUrl()
  const bytes = [...mp4Fixture]

  // sample-colors.mp4 is 6 frames at 20 fps; keeping the source rate must keep all 6 frames.
  for (const format of ['gif', 'apng', 'webp', 'avif'] as const) {
    const result = await decodeAnimationInBrowser(page, serviceModuleUrl, bytes, format, {
      fps: 0
    })
    // libwebp_anim merges identical consecutive frames (3 red + 3 blue → 2 frames with
    // longer durations), so the visible timing is still the source rate.
    expect(result.frameCount, `${format} frame count`).toBe(format === 'webp' ? 2 : 6)
  }
})

test('handles empty/corrupt inputs, mid-flight aborts with clean recovery, and URL validation', async ({
  page
}) => {
  test.setTimeout(90000)
  await serveBuild(page)
  await page.route('http://localhost/video-test', route =>
    route.fulfill({ body: '<html></html>', contentType: 'text/html' })
  )
  await page.route('http://localhost/video-mock/html', route =>
    route.fulfill({ body: '<html>not a video</html>', contentType: 'text/html; charset=utf-8' })
  )
  await page.route('http://localhost/video-mock/oversized', route =>
    route.fulfill({
      status: 200,
      headers: {
        'content-type': 'video/mp4',
        'content-length': String(120 * 1024 * 1024)
      },
      body: Buffer.alloc(16)
    })
  )
  await page.route('http://localhost/video-mock/%ZZclip.mp4', route =>
    route.fulfill({
      status: 200,
      contentType: 'video/mp4',
      body: mp4Fixture
    })
  )

  const serviceModuleUrl = getVideoServiceUrl()
  await page.goto('http://localhost/video-test')

  const outcome = await page.evaluate(
    async ({ moduleUrl, bytes }) => {
      const { convertVideoToAnimation, fetchVideoFromUrl } = await import(moduleUrl)

      let emptyError = ''
      try {
        await convertVideoToAnimation(new File([], 'empty.mp4', { type: 'video/mp4' }), {
          format: 'gif'
        })
      } catch (err: any) {
        emptyError = err?.message || String(err)
      }

      let corruptError = ''
      try {
        await convertVideoToAnimation(
          new File([new Uint8Array([1, 2, 3, 4])], 'corrupt.mp4', { type: 'video/mp4' }),
          { format: 'gif' }
        )
      } catch (err: any) {
        corruptError = err?.message || String(err)
      }

      const abortController = new AbortController()
      let abortErrorName = ''
      try {
        await convertVideoToAnimation(
          new File([new Uint8Array(bytes)], 'sample-colors.mp4', { type: 'video/mp4' }),
          {
            format: 'gif',
            signal: abortController.signal,
            onProgress: event => {
              if (event.stage === 'palette') {
                abortController.abort(new DOMException('test abort', 'AbortError'))
              }
            }
          }
        )
      } catch (err: any) {
        abortErrorName = err?.name || String(err)
      }

      // Immediately recover with a fresh valid conversion after terminating worker
      const recovered = await convertVideoToAnimation(
        new File([new Uint8Array(bytes)], 'recovered.mp4', { type: 'video/mp4' }),
        { format: 'gif', fps: 12, maxWidth: 32 }
      )

      let htmlUrlError = ''
      try {
        await fetchVideoFromUrl('http://localhost/video-mock/html')
      } catch (err: any) {
        htmlUrlError = err?.message || String(err)
      }

      let oversizedUrlError = ''
      try {
        await fetchVideoFromUrl('http://localhost/video-mock/oversized')
      } catch (err: any) {
        oversizedUrlError = err?.message || String(err)
      }

      const validFetched = await fetchVideoFromUrl('http://localhost/video-mock/%ZZclip.mp4')

      return {
        emptyError,
        corruptError,
        abortErrorName,
        recoveredType: recovered.blob.type,
        recoveredSize: recovered.size,
        htmlUrlError,
        oversizedUrlError,
        validFetchedName: validFetched.name,
        validFetchedSize: validFetched.size
      }
    },
    { moduleUrl: serviceModuleUrl, bytes: [...mp4Fixture] }
  )

  expect(outcome.emptyError).toContain('为空')
  expect(outcome.corruptError).toContain('失败')
  expect(outcome.abortErrorName).toBe('AbortError')
  expect(outcome.recoveredType).toBe('image/gif')
  expect(outcome.recoveredSize).toBeGreaterThan(100)
  expect(outcome.htmlUrlError).toContain('text/html')
  expect(outcome.oversizedUrlError).toContain('MB')
  expect(outcome.validFetchedName).toBe('%ZZclip.mp4')
  expect(outcome.validFetchedSize).toBe(mp4Fixture.length)
})

test('BufferPage VideoToAnimation tab converts MP4 and queues result to upload without duplicates', async ({
  page
}) => {
  test.setTimeout(90000)
  await serveBuild(page)
  await page.goto('http://localhost/?mode=options#/buffer')

  const videoTab = page.getByRole('tab', { name: '视频转动图' })
  await expect(videoTab).toBeVisible({ timeout: 15000 })
  await videoTab.click()

  const fileInput = page.getByTestId('video-file-input')
  await fileInput.setInputFiles({
    name: 'sample-colors.mp4',
    mimeType: 'video/mp4',
    buffer: mp4Fixture
  })

  const convertButton = page.getByTestId('start-video-convert')
  await expect(convertButton).toBeEnabled()
  await convertButton.click()

  const resultCard = page.getByTestId('converted-animation-card').first()
  await expect(resultCard).toBeVisible({ timeout: 60000 })
  await expect(resultCard).toContainText('sample-colors.gif')

  await page.getByTestId('queue-single-converted').first().click()
  await expect(page.getByRole('heading', { name: '待上传文件 (1)' })).toBeVisible({
    timeout: 10000
  })
  await expect(page.getByText('sample-colors.gif').first()).toBeVisible()

  // Switch back and queue the same item a second time; count must remain 1 cleanly
  await videoTab.click()
  await page.getByTestId('queue-single-converted').first().click()
  await expect(page.getByRole('heading', { name: '待上传文件 (1)' })).toBeVisible({
    timeout: 10000
  })
})

test('video-convert iframe page converts a File sent over a private MessageChannel', async ({
  page
}) => {
  test.setTimeout(90000)
  await serveBuild(page)
  await page.route('http://localhost/host', route =>
    route.fulfill({
      body: '<html><body><iframe id="f" src="/video-convert.html"></iframe></body></html>',
      contentType: 'text/html'
    })
  )
  await page.goto('http://localhost/host')

  const outcome = await page.evaluate(
    async bytes => {
      const iframe = document.getElementById('f') as HTMLIFrameElement
      await new Promise<void>(resolve => {
        if (iframe.contentDocument?.readyState === 'complete') resolve()
        else iframe.addEventListener('load', () => resolve(), { once: true })
      })
      const channel = new MessageChannel()
      const ready = new Promise<void>(resolve => {
        channel.port1.onmessage = event => event.data?.type === 'ready' && resolve()
      })
      iframe.contentWindow!.postMessage(
        { type: 'EMOJI_VIDEO_CONVERT_INIT' },
        window.location.origin,
        [channel.port2]
      )
      await ready

      return await new Promise<{ type: string; name: string; size: number; error?: string }>(
        resolve => {
          channel.port1.onmessage = event => {
            const data = event.data
            if (data.type === 'result') {
              resolve({ type: data.file.type, name: data.file.name, size: data.file.size })
            } else if (data.type === 'error') {
              resolve({ type: '', name: '', size: 0, error: data.message })
            }
          }
          channel.port1.postMessage({
            type: 'convert',
            id: 'job-1',
            file: new File([new Uint8Array(bytes)], 'sample-colors.mp4', { type: 'video/mp4' }),
            options: {
              format: 'webp',
              fps: 0,
              maxWidth: 0,
              quality: 75,
              gifProfile: 'high',
              webpLossless: false
            }
          })
        }
      )
    },
    [...mp4Fixture]
  )

  expect(outcome.error).toBeUndefined()
  expect(outcome.type).toBe('image/webp')
  expect(outcome.name).toBe('sample-colors.webp')
  expect(outcome.size).toBeGreaterThan(50)
})

test('BufferPage video converter remembers its parameters across reloads', async ({ page }) => {
  test.setTimeout(90000)
  await serveBuild(page)
  await page.goto('http://localhost/?mode=options#/buffer')
  await page.getByRole('tab', { name: '视频转动图' }).click()

  const webpRadio = page.locator('.ant-radio-button-wrapper', { hasText: 'WebP 动图' })
  await webpRadio.scrollIntoViewIfNeeded()
  await webpRadio.click()
  await page.getByRole('button', { name: '原尺寸' }).click()
  await page.getByTestId('auto-convert-switch').click()

  await expect
    .poll(async () =>
      page.evaluate(() => JSON.parse(localStorage.getItem('videoAnimationSettings') || 'null'))
    )
    .toMatchObject({
      format: 'webp',
      preset: 'original',
      fps: 0,
      maxWidth: 0,
      autoConvertOnUpload: false
    })

  await page.reload()
  await page.getByRole('tab', { name: '视频转动图' }).click()
  await expect(webpRadio).toHaveClass(/ant-radio-button-wrapper-checked/)
  await expect(page.getByTestId('auto-convert-switch')).not.toBeChecked()
})

test('MP4 to AVIF succeeds even when SharedArrayBuffer/threads() detection is enabled', async ({
  page
}) => {
  test.setTimeout(90000)
  const coiHeaders = {
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Embedder-Policy': 'require-corp',
    'Cross-Origin-Resource-Policy': 'same-origin'
  }
  await serveBuild(page, coiHeaders)
  await page.route('http://localhost/video-test-coi', route =>
    route.fulfill({
      body: '<html></html>',
      contentType: 'text/html',
      headers: coiHeaders
    })
  )
  await page.goto('http://localhost/video-test-coi')

  const isCrossOriginIsolated = await page.evaluate(() => ({
    crossOriginIsolated: window.crossOriginIsolated,
    hasSharedArrayBuffer: typeof SharedArrayBuffer === 'function'
  }))
  expect(isCrossOriginIsolated.crossOriginIsolated).toBe(true)
  expect(isCrossOriginIsolated.hasSharedArrayBuffer).toBe(true)

  const avif = await decodeAnimationInBrowser(page, getVideoServiceUrl(), [...mp4Fixture], 'avif')
  expect(avif.type).toBe('image/avif')
  expect(avif.fileName).toBe('sample-colors.avif')
  expect(avif.frameCount).toBeGreaterThanOrEqual(2)
  expect(avif.colors[0][0]).toBeGreaterThan(180)
  expect(avif.colors[1][2]).toBeGreaterThan(180)
})
