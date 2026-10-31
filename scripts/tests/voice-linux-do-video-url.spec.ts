import { expect, test } from '@playwright/test'
import { resolve } from 'node:path'

const USER_SCRIPT_PATH = resolve(process.cwd(), 'scripts/userjs/voice-linux-do.user.js')
const MEDIA_CASES = [
  {
    fileName: 'clip.mp4',
    mimeType: 'video/mp4',
    mediaType: 'MP4',
    upload: {
      url: 'https://linuxdo-uploads.s3.ldstatic.com/original/4X/a1/b2/c/clip.mp4.zip',
      short_url: 'upload://clip.mp4.zip',
      short_path: '/uploads/short-url/clip.mp4.zip',
      original_filename: 'clip.mp4.zip'
    }
  },
  {
    fileName: 'clip.webm',
    mimeType: 'video/webm',
    mediaType: 'WebM',
    upload: {
      url: 'https://linuxdo-uploads.s3.ldstatic.com/original/4X/a1/b2/c/clip.webm.zip',
      short_url: 'upload://clip.webm.zip',
      short_path: '/uploads/short-url/clip.webm.zip',
      original_filename: 'clip.webm.zip'
    }
  }
]

test('zip-workaround video uploads insert a downloadable attachment instead of an unplayable player', async ({
  page
}) => {
  const dialogs: string[] = []
  const pageErrors: string[] = []
  page.on('dialog', async dialog => {
    dialogs.push(dialog.message())
    await dialog.dismiss()
  })
  page.on('pageerror', error => pageErrors.push(error.message))
  let uploadIndex = 0

  await page.route('https://linux.do/**', async route => {
    const { pathname } = new URL(route.request().url())
    if (pathname === '/t/topic/123') {
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<meta name="csrf-token" content="csrf-test"><div class="d-editor"><div class="d-editor-button-bar"></div><div class="d-editor-textarea-wrapper"><textarea class="d-editor-input"></textarea></div></div>'
      })
      return
    }
    if (pathname === '/uploads.json') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MEDIA_CASES[uploadIndex++].upload)
      })
      return
    }
    await route.abort()
  })

  await page.goto('https://linux.do/t/topic/123')
  await page.addScriptTag({ path: USER_SCRIPT_PATH })

  const button = page.getByRole('button', {
    name: '上传 WebM/MP4 附件（文件名追加 .zip；下载后移除 .zip）'
  })
  await expect(button).toBeVisible()
  const input = page.locator('input[type="file"]')
  const textarea = page.locator('textarea.d-editor-input')
  for (const media of MEDIA_CASES) {
    await input.setInputFiles({
      name: media.fileName,
      mimeType: media.mimeType,
      buffer: Buffer.from(media.fileName)
    })
    await expect
      .poll(() => textarea.inputValue())
      .toContain(
        `[${media.fileName}.zip（原始 ${media.mediaType}，下载后移除 .zip 后缀）|attachment](${media.upload.short_url})`
      )
  }
  const inserted = await textarea.inputValue()

  for (const media of MEDIA_CASES) {
    expect(inserted).toContain(
      `[${media.fileName}.zip（原始 ${media.mediaType}，下载后移除 .zip 后缀）|attachment](${media.upload.short_url})`
    )
    expect(inserted).not.toContain(media.upload.url)
  }
  expect(inserted).not.toContain('<video')
  expect(inserted).not.toContain('<source')
  expect(inserted).not.toMatch(/video\/(mp4|webm)/)
  expect(dialogs).toEqual([])
  expect(pageErrors).toEqual([])
})

test('custom players resolve Discourse short URLs, replace the video wrapper, and reject untrusted hosts', async ({
  page
}) => {
  const lookupRequests: Array<{ shortUrls: string[]; csrfToken: string | undefined }> = []
  await page.addInitScript(() => {
    const testWindow = window as Window & {
      __gmRequests: Array<{ url: string; responseType: string }>
      GM_xmlhttpRequest: (details: {
        url: string
        responseType: string
        onload: (response: { status: number; response: Blob }) => void
        onerror: () => void
      }) => { abort: () => void }
    }
    testWindow.__gmRequests = []
    testWindow.GM_xmlhttpRequest = details => {
      testWindow.__gmRequests.push({ url: details.url, responseType: details.responseType })
      window.setTimeout(() => {
        if (details.url.includes('clip-fail')) {
          details.onload({ status: 403, response: new Blob(['forbidden']) })
          return
        }
        details.onload({ status: 206, response: new Blob(['mock media bytes']) })
      }, 0)
      return { abort() {} }
    }
  })
  await page.route('https://linux.do/**', async route => {
    const { pathname } = new URL(route.request().url())
    if (pathname === '/t/topic/123') {
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<meta name="csrf-token" content="csrf-test"><div class="d-editor"><div class="d-editor-button-bar"></div><div class="d-editor-textarea-wrapper"><textarea class="d-editor-input"></textarea></div></div>'
      })
      return
    }
    if (pathname === '/uploads/lookup-urls') {
      const requestBody = route.request().postDataJSON() as { short_urls: string[] }
      lookupRequests.push({
        shortUrls: requestBody.short_urls,
        csrfToken: route.request().headers()['x-csrf-token']
      })
      const mappedUploads = [
        {
          short_url: 'upload://clipid.mp4.zip',
          url: 'https://linuxdo-uploads.s3.ldstatic.com/original/4X/a1/b2/c/resolved-clip.mp4.zip',
          short_path: '/uploads/short-url/clipid.mp4.zip'
        },
        {
          short_url: 'upload://clip.webm.zip',
          url: 'https://linuxdo-uploads.s3.ldstatic.com/original/4X/a1/b2/c/resolved-clip.webm.zip',
          short_path: '/uploads/short-url/clip.webm.zip'
        }
      ].filter(upload => requestBody.short_urls.includes(upload.short_url))
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mappedUploads)
      })
      return
    }
    await route.abort()
  })
  await page.goto('https://linux.do/t/topic/123')
  await page.addScriptTag({ path: USER_SCRIPT_PATH })
  await page.evaluate(() => {
    document.body.insertAdjacentHTML(
      'beforeend',
      '<div class="cooked"><div class="video-container"><video><source src="https://linuxdo-uploads.s3.ldstatic.com/original/4X/a1/b2/c/stale-clip.mp4.zip" data-orig-src="upload://clipid.mp4.zip" type="video/mp4"><a href="https://linuxdo-uploads.s3.ldstatic.com/original/4X/a1/b2/c/stale-clip.mp4.zip">clip.mp4.zip</a></video></div><p><a class="attachment" href="/uploads/short-url/clip.webm.zip">clip.webm.zip（原始 WebM，下载后移除 .zip 后缀）</a></p><p><a class="attachment" href="https://linuxdo-uploads.s3.ldstatic.com/original/4X/a1/b2/c/clip-fail.mp4.zip">clip-fail.mp4.zip</a></p><p><a class="attachment" href="https://evil.example/clip.mp4.zip">clip.mp4.zip</a></p><p><a class="attachment" href="/t/topic/clip.mp4.zip">clip.mp4.zip</a></p></div>'
    )
  })

  const players = page.locator('.ldv-video-player-host')
  await expect(players).toHaveCount(3)
  await expect(page.locator('.cooked .video-container')).toHaveCount(0)
  await expect(page.locator('.cooked a.attachment')).toHaveCount(4)
  const firstPlayerBox = await players.first().boundingBox()
  expect(firstPlayerBox?.height).toBeLessThan(600)
  expect(
    await players
      .first()
      .evaluate(element => element.parentElement?.classList.contains('video-container'))
  ).toBe(false)

  const cases = [
    {
      index: 0,
      url: 'https://linuxdo-uploads.s3.ldstatic.com/original/4X/a1/b2/c/resolved-clip.mp4.zip',
      fallbackUrl: 'https://linux.do/uploads/short-url/clipid.mp4.zip',
      mimeType: 'video/mp4'
    },
    {
      index: 1,
      url: 'https://linuxdo-uploads.s3.ldstatic.com/original/4X/a1/b2/c/resolved-clip.webm.zip',
      fallbackUrl: 'https://linux.do/uploads/short-url/clip.webm.zip',
      mimeType: 'video/webm'
    },
    {
      index: 2,
      url: 'https://linuxdo-uploads.s3.ldstatic.com/original/4X/a1/b2/c/clip-fail.mp4.zip',
      fallbackUrl: 'https://linuxdo-uploads.s3.ldstatic.com/original/4X/a1/b2/c/clip-fail.mp4.zip',
      mimeType: 'video/mp4'
    }
  ]
  for (const media of cases) {
    const player = players.nth(media.index)
    await player.getByRole('button', { name: '加载视频' }).click()
    const video = player.locator('video')
    await expect(player.locator('.ldv-video-player-fallback a')).toHaveAttribute(
      'href',
      media.fallbackUrl
    )
    if (media.index === 2) {
      await expect(player.locator('.ldv-video-player-error')).toContainText('HTTP 403')
      continue
    }
    await expect(video).toHaveAttribute('src', /^blob:/)
    expect(
      await video.evaluate(
        async element => (await (await fetch((element as HTMLVideoElement).src)).blob()).type
      )
    ).toBe(media.mimeType)
    if (media.index === 0) {
      await video.evaluate(element => {
        const target = element as HTMLVideoElement
        let paused = true
        let currentTime = 0
        Object.defineProperties(target, {
          paused: { configurable: true, get: () => paused },
          duration: { configurable: true, get: () => 12 },
          currentTime: {
            configurable: true,
            get: () => currentTime,
            set: value => {
              currentTime = Number(value)
            }
          }
        })
        target.play = async () => {
          paused = false
          target.dispatchEvent(new Event('play'))
        }
        target.pause = () => {
          paused = true
          target.dispatchEvent(new Event('pause'))
        }
        target.dispatchEvent(new Event('loadedmetadata'))
      })
      await player.getByRole('button', { name: '播放视频' }).click()
      await expect(player.getByRole('button', { name: '暂停视频' })).toBeVisible()
      await player.getByRole('button', { name: '暂停视频' }).click()
      await expect(player.getByRole('button', { name: '播放视频' })).toBeVisible()
      await player.locator('.ldv-video-player-seek').evaluate(element => {
        const range = element as HTMLInputElement
        range.value = '4'
        range.dispatchEvent(new Event('input', { bubbles: true }))
      })
      expect(await video.evaluate(element => (element as HTMLVideoElement).currentTime)).toBe(4)
    }
  }
  await expect(page.locator('.cooked a[href="https://evil.example/clip.mp4.zip"]')).toHaveCount(1)
  await expect(page.locator('.cooked a[href="/t/topic/clip.mp4.zip"]')).toHaveCount(1)
  expect(lookupRequests).toEqual([
    {
      shortUrls: ['upload://clipid.mp4.zip', 'upload://clip.webm.zip'],
      csrfToken: 'csrf-test'
    }
  ])
  const requests = await page.evaluate(() => {
    return (window as Window & { __gmRequests: Array<{ url: string; responseType: string }> })
      .__gmRequests
  })
  expect(requests).toEqual(cases.map(media => ({ url: media.url, responseType: 'blob' })))
})
