import { expect, test } from '@playwright/test'
import { resolveXVideoUrl } from '../../src/content/x/video/resolveVideo'
import { handleXVideoRequest } from '../../src/background/handlers/handleXVideoRequest'
import { getXVideoContext, selectXVideoVariant } from '../../src/content/x/video/videoMetadata'

if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
  test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } })
}

const low =
  'https://video.twimg.com/amplify_video/2107439918389555200/vid/avc1/320x568/low.mp4?tag=14'
const high =
  'https://video.twimg.com/amplify_video/2107439918389555200/vid/avc1/720x1280/high.mp4?tag=14'
const other = 'https://video.twimg.com/amplify_video/999/vid/avc1/1920x1080/other.mp4'

async function fixture(page: import('@playwright/test').Page) {
  await page.route('https://**/*', route => route.abort())
  await page.setContent(
    `<article><div data-testid="videoPlayer"><div data-testid="videoComponent"><video data-x-video-resolver="target" src="blob:https://x.com/a0974539-f94a-4843-bbbf-c99ae87e7674" poster="https://pbs.twimg.com/amplify_video_thumb/2107439918389555200/img/TlvsaZnk4sf-jfsF.jpg"></video></div></div></article>`
  )
}

test('blob player resolves highest bitrate MP4 for its own poster, not another video or HLS', async ({
  page
}) => {
  await fixture(page)
  await page.evaluate(
    ({ low, high, other }) => {
      const article = document.querySelector('article') as any
      article.__reactProps$fixture = {
        tweet: {
          extended_entities: {
            media: [
              {
                video_info: {
                  variants: [
                    { content_type: 'video/mp4', bitrate: 256000, url: low },
                    { content_type: 'video/mp4', bitrate: 2176000, url: high },
                    { content_type: 'application/x-mpegURL', url: 'https://video.twimg.com/a.m3u8' }
                  ]
                }
              },
              {
                video_info: {
                  variants: [{ content_type: 'video/mp4', bitrate: 99999999, url: other }]
                }
              }
            ]
          }
        }
      }
      article.__reactProps$fixture.cycle = article.__reactProps$fixture
    },
    { low, high, other }
  )
  expect(await page.evaluate(resolveXVideoUrl, 'target')).toBe(high)
})

test('React fiber props and poster matching work even when video URL media ID differs', async ({
  page
}) => {
  await fixture(page)
  await page.evaluate(high => {
    const video = document.querySelector('video') as any
    video.__reactFiber$fixture = {
      return: {
        memoizedProps: {
          media: {
            media_url_https: video.poster,
            video_info: {
              variants: [
                {
                  content_type: 'video/mp4',
                  url: high.replace('2107439918389555200', '123'),
                  bitrate: 100
                }
              ]
            }
          }
        }
      }
    }
  }, high)
  expect(await page.evaluate(resolveXVideoUrl, 'target')).toBe(
    high.replace('2107439918389555200', '123')
  )
})

test('missing variants and HLS-only player fail without returning blob', async ({ page }) => {
  await fixture(page)
  expect(await page.evaluate(resolveXVideoUrl, 'target')).toBeNull()
  await page.evaluate(() => {
    ;(document.querySelector('video') as any).__reactProps$fixture = {
      variants: [{ url: 'https://video.twimg.com/stream.m3u8' }]
    }
  })
  expect(await page.evaluate(resolveXVideoUrl, 'target')).toBeNull()
  expect(await page.evaluate(resolveXVideoUrl, 'missing')).toBeNull()
})

test('resolution uses live src after a player is recycled', async ({ page }) => {
  await fixture(page)
  await page.evaluate(low => {
    document.querySelector('video')!.src = low
  }, low)
  expect(await page.evaluate(resolveXVideoUrl, 'target')).toBe(low)
  await page.evaluate(high => {
    document.querySelector('video')!.src = high
  }, high)
  expect(await page.evaluate(resolveXVideoUrl, 'target')).toBe(high)
})

test('background resolves in sender frame MAIN world and starts MP4 download', async () => {
  let injection: any
  let download: any
  const global = globalThis as any
  const previous = global.chrome
  global.chrome = {
    scripting: {
      executeScript: async (options: any) => {
        injection = options
        return [{ result: high }]
      }
    },
    downloads: {
      download: async (options: any) => {
        download = options
        return 42
      }
    }
  }
  try {
    let response: any
    await handleXVideoRequest(
      { marker: 'target', download: true },
      { url: 'https://x.com/home', tab: { id: 7 }, frameId: 3 } as any,
      value => {
        response = value
      }
    )
    expect(injection.world).toBe('MAIN')
    expect(injection.target).toEqual({ tabId: 7, frameIds: [3] })
    expect(download.url).toBe(high)
    expect(download.filename).toMatch(/\.mp4$/)
    expect(response).toEqual({ success: true, url: high, downloadId: 42 })
    global.chrome.scripting.executeScript = async () => [
      { result: 'https://evil.example/video.mp4' }
    ]
    download = null
    await handleXVideoRequest(
      { marker: 'target', download: true },
      { url: 'https://x.com/home', tab: { id: 7 } } as any,
      value => {
        response = value
      }
    )
    expect(response.success).toBe(false)
    expect(download).toBeNull()
    global.chrome.downloads.download = async () => {
      throw new Error('download denied')
    }
    global.chrome.scripting.executeScript = async () => [{ result: high }]
    await handleXVideoRequest(
      { marker: 'target', download: true },
      { url: 'https://x.com/home', tab: { id: 7 } } as any,
      value => {
        response = value
      }
    )
    expect(response).toEqual({ success: false, error: 'download denied' })
  } finally {
    global.chrome = previous
  }
})

test('unplayed X GIF resolves from poster with no src, React props or network', async ({
  page
}) => {
  await fixture(page)
  await page.evaluate(() => {
    const video = document.querySelector('video')!
    video.removeAttribute('src')
    video.preload = 'none'
    video.poster = 'https://pbs.twimg.com/tweet_video_thumb/F6VBghYWoAAppSu.jpg?name=small'
    video.play = () => {
      throw new Error('Must not require playback')
    }
  })
  expect(await page.evaluate(resolveXVideoUrl, 'target')).toBe(
    'https://video.twimg.com/tweet_video/F6VBghYWoAAppSu.mp4'
  )
})

test('GIF thumbnail image also resolves to MP4 without a video element', async ({ page }) => {
  await page.route('https://**/*', route => route.abort())
  await page.setContent(
    '<article><img data-x-video-resolver="target" src="https://pbs.twimg.com/tweet_video_thumb/GIF_id-123.jpg"></article>'
  )
  expect(await page.evaluate(resolveXVideoUrl, 'target')).toBe(
    'https://video.twimg.com/tweet_video/GIF_id-123.mp4'
  )
})

test('player-local variants work with different thumbnail ID and non-enumerable React props', async ({
  page
}) => {
  await fixture(page)
  await page.evaluate(
    ({ low, high }) => {
      const player = document.querySelector('[data-testid="videoPlayer"]')!
      Object.defineProperty(player, '__reactProps$fixture', {
        value: {
          player: {
            source: {
              variants: [
                { type: 'video/mp4', src: low.replace('2107439918389555200', '222') },
                { type: 'video/mp4', src: high.replace('2107439918389555200', '222') },
                { type: 'application/x-mpegURL', src: 'https://video.twimg.com/stream.m3u8' }
              ]
            }
          }
        }
      })
    },
    { low, high }
  )
  expect(await page.evaluate(resolveXVideoUrl, 'target')).toBe(
    high.replace('2107439918389555200', '222')
  )
})

test('background fetches public tweet metadata when an unplayed blob player has no accessible props', async () => {
  const global = globalThis as any
  const previousChrome = global.chrome
  const previousFetch = global.fetch
  let endpoint: URL | undefined
  let downloaded: any
  global.chrome = {
    scripting: { executeScript: async () => [{ result: null }] },
    downloads: {
      download: async (options: any) => {
        downloaded = options
        return 55
      }
    }
  }
  global.fetch = async (url: URL) => {
    endpoint = url
    return new Response(
      JSON.stringify({
        mediaDetails: [
          {
            type: 'video',
            media_url_https:
              'https://pbs.twimg.com/amplify_video_thumb/2107439918389555200/img/TlvsaZnk4sf-jfsF.jpg',
            video_info: {
              variants: [
                { content_type: 'video/mp4', bitrate: 256000, url: low },
                { content_type: 'video/mp4', bitrate: 2176000, url: high }
              ]
            }
          },
          {
            type: 'video',
            media_url_https: 'https://pbs.twimg.com/amplify_video_thumb/999/img/other.jpg',
            video_info: { variants: [{ content_type: 'video/mp4', bitrate: 99999999, url: other }] }
          }
        ]
      }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  }
  try {
    let response: any
    await handleXVideoRequest(
      {
        marker: 'target',
        download: true,
        tweetId: '2107439918389555201',
        poster:
          'https://pbs.twimg.com/amplify_video_thumb/2107439918389555200/img/TlvsaZnk4sf-jfsF.jpg?name=small',
        mediaIndex: 0,
        mediaCount: 2
      },
      { url: 'https://x.com/home', tab: { id: 7 } } as any,
      value => {
        response = value
      }
    )
    expect(endpoint?.hostname).toBe('cdn.syndication.twimg.com')
    expect(endpoint?.searchParams.get('id')).toBe('2107439918389555201')
    expect(endpoint?.searchParams.get('token')).toBeTruthy()
    expect(downloaded.url).toBe(high)
    expect(response.success).toBe(true)
    global.fetch = async () => new Response('{}')
    downloaded = null
    await handleXVideoRequest(
      { marker: 'target', download: true, tweetId: '2107439918389555201' },
      { url: 'https://x.com/home', tab: { id: 7 } } as any,
      value => {
        response = value
      }
    )
    expect(response.success).toBe(false)
    expect(response.error).not.toContain('播放')
    expect(downloaded).toBeNull()
  } finally {
    global.chrome = previousChrome
    global.fetch = previousFetch
  }
})

test('injected GIF download works before playback through content → background → MP4 download', async ({
  page
}) => {
  const { build } = await import('vite')
  const { mkdtemp, readFile, rm } = await import('node:fs/promises')
  const { tmpdir } = await import('node:os')
  const path = await import('node:path')
  const output = await mkdtemp(path.join(tmpdir(), 'x-video-fixture-'))
  const global = globalThis as any
  const previous = global.chrome
  let downloaded: any
  try {
    await build({
      configFile: false,
      logLevel: 'error',
      build: {
        outDir: output,
        lib: {
          entry: path.resolve('src/content/x/video/videoCopy.ts'),
          formats: ['iife'],
          name: 'XVideoFixture',
          fileName: () => 'fixture.js'
        }
      }
    })
    global.chrome = {
      scripting: {
        executeScript: async (options: any) => [
          { result: await page.evaluate(resolveXVideoUrl, options.args[0]) }
        ]
      },
      downloads: {
        download: async (options: any) => {
          downloaded = options
          return 88
        }
      }
    }
    await page.exposeBinding(
      'xVideoRequest',
      async (_source, message) =>
        new Promise(resolve => {
          void handleXVideoRequest(
            message,
            { url: 'https://x.com/home', tab: { id: 7 } } as any,
            resolve
          )
        })
    )
    await page.route('https://**/*', route => {
      if (route.request().url() === 'https://x.com/home')
        return route.fulfill({
          contentType: 'text/html',
          body: '<article><a href="/someone/status/2107439918389555201"><time>now</time></a><div data-testid="videoPlayer" style="width:300px;height:200px"><video preload="none" poster="https://pbs.twimg.com/tweet_video_thumb/GIF_id-123.jpg" style="width:300px;height:200px"></video></div></article>'
        })
      return route.abort()
    })
    await page.goto('https://x.com/home')
    await page.evaluate(() => {
      ;(window as any).chrome = {
        runtime: { sendMessage: (message: any) => (window as any).xVideoRequest(message) }
      }
      document.querySelector('video')!.play = () => {
        throw new Error('Playback must never be required')
      }
    })
    await page.addScriptTag({ content: await readFile(path.join(output, 'fixture.js'), 'utf8') })
    await page.evaluate(() => (window as any).XVideoFixture.initVideoCopy())
    await page.locator('[data-testid="videoPlayer"]').hover()
    await page.getByRole('button', { name: '下载视频', exact: true }).click()
    await expect
      .poll(() => downloaded?.url)
      .toBe('https://video.twimg.com/tweet_video/GIF_id-123.mp4')
    await expect(page.locator('.x-video-download-btn')).toHaveAttribute('data-state', 'success')
    expect(await page.locator('video').evaluate((video: HTMLVideoElement) => video.paused)).toBe(
      true
    )
  } finally {
    await page.evaluate(() => (window as any).XVideoFixture?.cleanupVideoCopy()).catch(() => {})
    global.chrome = previous
    await rm(output, { recursive: true, force: true })
  }
})

test('metadata fallback uses this tweet permalink and media index, not the current page tweet', async ({
  page
}) => {
  await fixture(page)
  await page.evaluate(() => {
    const article = document.querySelector('article')!
    article.insertAdjacentHTML(
      'afterbegin',
      '<a href="https://x.com/user/status/2107439918389555201"><time>now</time></a>'
    )
    const second = document.createElement('video')
    second.setAttribute('data-x-video-resolver', 'second')
    article.appendChild(second)
  })
  const context = await page.evaluate(
    getXVideoContext,
    (await page.locator('video[data-x-video-resolver="second"]').elementHandle()) as any
  )
  expect(context.tweetId).toBe('2107439918389555201')
  expect(context.mediaIndex).toBe(1)
  expect(context.mediaCount).toBe(2)
})

test('syndication video src/type schema selects highest resolution and rejects unrelated groups', () => {
  expect(
    selectXVideoVariant(
      {
        video: {
          variants: [
            { type: 'video/mp4', src: low },
            { type: 'video/mp4', src: high },
            { type: 'application/x-mpegURL', src: 'https://video.twimg.com/stream.m3u8' }
          ]
        }
      },
      { poster: '', mediaIndex: 0, mediaCount: 1 }
    )
  ).toBe(high)
  expect(
    selectXVideoVariant(
      {
        mediaDetails: [
          { video_info: { variants: [{ url: low }] } },
          { video_info: { variants: [{ url: other }] } }
        ]
      },
      { poster: 'https://pbs.twimg.com/unknown.jpg', mediaIndex: 0, mediaCount: 1 }
    )
  ).toBeNull()
})
