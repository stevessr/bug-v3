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
