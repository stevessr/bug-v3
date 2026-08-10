import { expect, test } from '@playwright/test'

test('shows live request totals while a Discourse page is loading', async ({ page }) => {
  await page.addInitScript(() => {
    const pending: Array<{ url: string; callback: (response: any) => void }> = []
    ;(globalThis as any).__releaseDiscourseRequests = () => {
      pending.splice(0).forEach(({ url, callback }) => {
        const pathname = new URL(url).pathname
        const data =
          pathname === '/latest.json'
            ? { topic_list: { topics: [] }, users: [] }
            : { category_list: { categories: [] } }
        callback({ success: true, data: { status: 200, ok: true, data } })
      })
    }

    const runtime = {
      lastError: null,
      sendMessage(request: any, callback: (response: any) => void) {
        if (request.type === 'GET_LINUX_DO_USER') {
          queueMicrotask(() => callback({ success: false }))
          return
        }
        if (request.type === 'GET_DISCOURSE_ICON_SPRITE') {
          queueMicrotask(() => callback({ success: true, data: { symbols: [] } }))
          return
        }
        if (request.type === 'PAGE_FETCH') {
          pending.push({ url: request.options.url, callback })
          return
        }
        queueMicrotask(() => callback({ success: false }))
      },
      onMessage: {
        addListener() {},
        removeListener() {}
      }
    }

    const chromeApi = (globalThis as any).chrome || {}
    Object.defineProperty(chromeApi, 'runtime', { configurable: true, value: runtime })
    if (!(globalThis as any).chrome) {
      Object.defineProperty(globalThis, 'chrome', { configurable: true, value: chromeApi })
    }
  })

  await page.goto('/discourse.html')
  const status = page.getByRole('status').filter({ hasText: '正在打开页面' })
  await expect(status).toBeVisible()
  await expect(status).toContainText('请求 0 / 2')
  await expect(status).toContainText('正在处理 2 个')
  await expect(status.locator('.browser-state__progress-track > span')).toHaveAttribute(
    'style',
    /width:\s*0%/
  )

  await page.evaluate(() => (globalThis as any).__releaseDiscourseRequests())
  await expect(status).toBeHidden()
  await expect(page.locator('.content-area')).not.toHaveAttribute('aria-busy', 'true')
})

test('shows request progress while infinite scrolling loads the next page', async ({ page }) => {
  await page.addInitScript(() => {
    let releaseNextPage: (() => void) | null = null
    ;(globalThis as any).__releaseNextDiscoursePage = () => releaseNextPage?.()

    const makeTopic = (id: number) => ({
      id,
      title: `滚动话题 ${id}`,
      fancy_title: `滚动话题 ${id}`,
      slug: `scroll-topic-${id}`,
      posts_count: 2,
      reply_count: 1,
      views: id,
      like_count: 0,
      created_at: '2026-08-10T00:00:00Z',
      last_posted_at: '2026-08-10T00:00:00Z',
      bumped_at: '2026-08-10T00:00:00Z',
      posters: [],
      tags: []
    })

    const runtime = {
      lastError: null,
      sendMessage(request: any, callback: (response: any) => void) {
        if (request.type === 'GET_LINUX_DO_USER') {
          queueMicrotask(() => callback({ success: false }))
          return
        }
        if (request.type === 'GET_DISCOURSE_ICON_SPRITE') {
          queueMicrotask(() => callback({ success: true, data: { symbols: [] } }))
          return
        }
        if (request.type !== 'PAGE_FETCH') {
          queueMicrotask(() => callback({ success: false }))
          return
        }

        const parsed = new URL(request.options.url)
        const respond = (data: any) =>
          callback({ success: true, data: { status: 200, ok: true, data } })
        if (
          parsed.pathname === '/categories.json' ||
          parsed.pathname === '/categories_and_latest.json'
        ) {
          queueMicrotask(() => respond({ category_list: { categories: [] } }))
          return
        }
        if (parsed.pathname === '/latest.json' && parsed.searchParams.get('page') === '1') {
          releaseNextPage = () =>
            respond({ topic_list: { topics: [makeTopic(41)], more_topics_url: null }, users: [] })
          return
        }
        if (parsed.pathname === '/latest.json') {
          queueMicrotask(() =>
            respond({
              topic_list: {
                topics: Array.from({ length: 40 }, (_, index) => makeTopic(index + 1)),
                more_topics_url: '/latest?page=1'
              },
              users: []
            })
          )
          return
        }
        queueMicrotask(() => respond({}))
      },
      onMessage: {
        addListener() {},
        removeListener() {}
      }
    }

    const chromeApi = (globalThis as any).chrome || {}
    Object.defineProperty(chromeApi, 'runtime', { configurable: true, value: runtime })
    if (!(globalThis as any).chrome) {
      Object.defineProperty(globalThis, 'chrome', { configurable: true, value: chromeApi })
    }
  })

  await page.goto('/discourse.html')
  await expect(page.getByRole('link', { name: '打开话题：滚动话题 40' })).toBeVisible()
  await page.locator('.content-area').evaluate(element => {
    element.scrollTop = element.scrollHeight
    element.dispatchEvent(new Event('scroll'))
  })

  const progress = page.locator('.browser-load-more-progress')
  await expect(progress).toBeVisible()
  await expect(progress).toContainText(/请求 \d+ \/ \d+ · 处理 1/)
  const requestProgress = await progress.locator('small').innerText()
  const requestCounts = requestProgress.match(/请求 (\d+) \/ (\d+)/)
  expect(requestCounts).not.toBeNull()
  expect(Number(requestCounts?.[2])).toBeGreaterThan(0)
  expect(Number(requestCounts?.[1])).toBeLessThan(Number(requestCounts?.[2]))
  await expect(page.locator('.content-area')).toHaveAttribute('aria-busy', 'true')

  await page.evaluate(() => (globalThis as any).__releaseNextDiscoursePage())
  await expect(page.getByRole('link', { name: '打开话题：滚动话题 41' })).toBeVisible()
  await expect(progress).toBeHidden()
  await expect(page.locator('.content-area')).not.toHaveAttribute('aria-busy', 'true')
})
