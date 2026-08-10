import { expect, test } from '@playwright/test'

test.describe('Discourse browser navigation and content safety', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const topic = (id: number, title: string, fancyTitle = title) => ({
        id,
        title,
        fancy_title: fancyTitle,
        slug: `topic-${id}`,
        posts_count: 2,
        reply_count: 1,
        views: id * 10,
        like_count: 0,
        created_at: '2026-08-09T08:00:00Z',
        last_posted_at: '2026-08-09T09:00:00Z',
        bumped_at: '2026-08-09T09:00:00Z',
        posters: [],
        tags: []
      })

      const latestTopics = Array.from({ length: 70 }, (_, index) =>
        topic(
          index + 1,
          `最新话题 ${index + 1}`,
          index === 0
            ? '<strong>安全标题</strong><img src="x" onerror="window.__discourseXss = 1"><script>window.__discourseXss = 2</script>'
            : `最新话题 ${index + 1}`
        )
      )
      const requests: string[] = []
      ;(globalThis as any).__discourseRequests = requests

      const runtime = {
        lastError: null,
        sendMessage(request: any, callback: (response: any) => void) {
          if (request.type === 'GET_LINUX_DO_USER') {
            queueMicrotask(() =>
              callback({
                success: true,
                user: {
                  id: 1,
                  username: 'steve',
                  name: 'Steve',
                  avatar_template: '/letter_avatar_proxy/v4/letter/s/7c8e57/{size}.png'
                }
              })
            )
            return
          }

          if (request.type === 'GET_DISCOURSE_ICON_SPRITE') {
            queueMicrotask(() => callback({ success: true, data: { symbols: [] } }))
            return
          }

          const url = request?.options?.url || ''
          requests.push(url)
          const parsed = new URL(url)
          let data: any = {}

          if (
            parsed.pathname === '/categories.json' ||
            parsed.pathname === '/categories_and_latest.json'
          ) {
            data = {
              category_list: {
                categories: [
                  {
                    id: 4,
                    name: '开发调优',
                    slug: 'develop',
                    color: '0088CC',
                    text_color: 'FFFFFF',
                    topic_count: 12,
                    uploaded_logo: {
                      url: '//linuxdo-uploads.s3.ldstatic.com/original/4X/7/2/5/725e864d7b0f17ece0b468d5f22140b7de497834.png'
                    }
                  }
                ]
              }
            }
          } else if (parsed.pathname === '/latest.json') {
            data = { topic_list: { topics: latestTopics }, users: [] }
          } else if (parsed.pathname === '/new.json') {
            data = { topic_list: { topics: [topic(1001, '新列表话题')] }, users: [] }
          } else if (parsed.pathname === '/top.json') {
            data = { topic_list: { topics: [topic(1002, '周排行话题')] }, users: [] }
          } else if (parsed.pathname === '/search.json') {
            data = { posts: [], topics: [], users: [], more_posts: false, more_topics: false }
          } else if (parsed.pathname === '/notifications.json') {
            data = {
              notifications: [
                {
                  id: requests.length,
                  notification_type: 5,
                  read: false,
                  created_at: '2026-08-09T09:00:00Z',
                  topic_id: 1,
                  post_number: 1,
                  data: { username: 'alice', topic_title: '最新点赞' }
                },
                {
                  id: requests.length + 1,
                  notification_type: 2,
                  read: true,
                  created_at: '2026-08-09T08:00:00Z',
                  topic_id: 2,
                  post_number: 2,
                  data: { username: 'bob', topic_title: '最新回复' }
                }
              ],
              users: [],
              unread_notifications: 1
            }
          } else if (parsed.pathname === '/c/parent/child/42.json') {
            data = {
              category: { id: 42, name: '嵌套分类', slug: 'child' },
              topic_list: { topics: [topic(2001, '分类话题')] },
              users: []
            }
          } else if (parsed.pathname === '/u/steve.json') {
            data = {
              user: {
                id: 1,
                username: 'steve',
                name: 'Steve',
                avatar_template: '/letter_avatar_proxy/v4/letter/s/7c8e57/{size}.png'
              }
            }
          } else if (parsed.pathname === '/topics/messages-sent/steve.json') {
            data = { topic_list: { topics: [topic(3001, '已发送私信')] }, users: [] }
          } else if (parsed.pathname === '/topics/messages-archive/steve.json') {
            data = { topic_list: { topics: [topic(3002, '归档私信')] }, users: [] }
          }

          queueMicrotask(() => callback({ success: true, data: { status: 200, ok: true, data } }))
        },
        onMessage: {
          addListener() {},
          removeListener() {}
        }
      }

      const chromeApi = (globalThis as any).chrome || {}
      Object.defineProperty(chromeApi, 'runtime', { configurable: true, value: runtime })
      if (!(globalThis as any).chrome) {
        Object.defineProperty(globalThis, 'chrome', {
          configurable: true,
          value: chromeApi
        })
      }
    })
  })

  test('keeps canonical history and restores the previous page scroll position', async ({
    page
  }) => {
    await page.goto('/discourse.html')
    await expect(page.getByRole('link', { name: '打开话题：最新话题 70' })).toBeVisible()

    const back = page.getByRole('button', { name: '后退' })
    await expect(back).toBeDisabled()

    const content = page.locator('.content-area')
    await content.evaluate(element => {
      element.scrollTop = 720
      element.dispatchEvent(new Event('scroll'))
    })
    await expect.poll(() => content.evaluate(element => element.scrollTop)).toBeGreaterThan(600)

    await page
      .getByRole('button', { name: '新', exact: true })
      .first()
      .evaluate(element => {
        ;(element as HTMLButtonElement).click()
      })
    await expect(page.locator('.toolbar-address input')).toHaveValue('https://linux.do/new')
    await expect(page.getByRole('link', { name: '打开话题：新列表话题' })).toBeVisible()
    await expect(back).toBeEnabled()

    await back.click()
    await expect(page.locator('.toolbar-address input')).toHaveValue('https://linux.do/')
    await expect(
      page.getByRole('link', { name: '打开话题：最新话题 1', exact: true })
    ).toBeVisible()
    await expect.poll(() => content.evaluate(element => element.scrollTop)).toBeGreaterThan(600)
  })

  test('uses plain address-bar text as search and supports nested category URLs', async ({
    page
  }) => {
    await page.goto('/discourse.html')
    await expect(
      page.getByRole('link', { name: '打开话题：最新话题 1', exact: true })
    ).toBeVisible()

    const address = page.locator('.toolbar-address input')
    await address.fill('emoji picker')
    await page.getByRole('button', { name: '打开地址' }).click()

    await expect(address).toHaveValue('https://linux.do/search?q=emoji+picker')
    await expect(page.getByRole('heading', { name: '搜索论坛' })).toBeVisible()
    await expect
      .poll(() =>
        page.evaluate(() =>
          (globalThis as any).__discourseRequests.some((url: string) =>
            url.includes('/search.json?q=emoji+picker')
          )
        )
      )
      .toBe(true)

    await address.fill('https://linux.do/top/weekly')
    await page.getByRole('button', { name: '打开地址' }).click()
    await expect(page.getByRole('link', { name: '打开话题：周排行话题' })).toBeVisible()
    await expect
      .poll(() =>
        page.evaluate(() =>
          (globalThis as any).__discourseRequests.includes(
            'https://linux.do/top.json?period=weekly'
          )
        )
      )
      .toBe(true)

    await address.fill('https://linux.do/c/parent/child/42/l/latest')
    await page.getByRole('button', { name: '打开地址' }).click()

    await expect(page.getByRole('heading', { name: '嵌套分类' })).toBeVisible()
    await expect
      .poll(() =>
        page.evaluate(() =>
          (globalThis as any).__discourseRequests.includes(
            'https://linux.do/c/parent/child/42.json'
          )
        )
      )
      .toBe(true)
  })

  test('keeps protocol-relative category logos on their CDN host', async ({ page }) => {
    await page.goto('/discourse.html')
    const address = page.locator('.toolbar-address input')
    await address.fill('https://linux.do/categories')
    await page.getByRole('button', { name: '打开地址' }).click()

    const logo = page.locator('.category-icon-img').first()
    await expect(logo).toHaveAttribute(
      'src',
      'https://linuxdo-uploads.s3.ldstatic.com/original/4X/7/2/5/725e864d7b0f17ece0b468d5f22140b7de497834.png'
    )
    await expect(logo).not.toHaveAttribute('src', /linux\.do\/\/linuxdo-uploads/)
  })

  test('sanitizes rich topic titles received from a remote forum', async ({ page }) => {
    await page.goto('/discourse.html')
    const title = page.locator('.topic-title').first()
    await expect(title.locator('strong')).toHaveText('安全标题')
    await expect(title.locator('script')).toHaveCount(0)
    await expect(title.locator('[onerror]')).toHaveCount(0)
    await expect.poll(() => page.evaluate(() => (globalThis as any).__discourseXss)).toBeUndefined()
  })

  test('loads and records private-message subroutes', async ({ page }) => {
    await page.goto('/discourse.html')
    const address = page.locator('.toolbar-address input')
    await address.fill('https://linux.do/u/steve/messages/sent')
    await page.getByRole('button', { name: '打开地址' }).click()

    await expect(page.getByRole('tab', { name: '已发送', selected: true })).toBeVisible()
    await expect(page.locator('.messages-topic-item__title')).toHaveText('已发送私信')
    await expect
      .poll(() =>
        page.evaluate(() =>
          (globalThis as any).__discourseRequests.includes(
            'https://linux.do/topics/messages-sent/steve.json'
          )
        )
      )
      .toBe(true)

    await page.getByRole('tab', { name: '归档' }).click()
    await expect(address).toHaveValue('https://linux.do/u/steve/messages/archive')
    await expect(page.getByRole('tab', { name: '归档', selected: true })).toBeVisible()
    await expect(page.locator('.messages-topic-item__title')).toHaveText('归档私信')
  })

  test('switches the active forum origin when traversing history', async ({ page }) => {
    await page.goto('/discourse.html')
    await expect(
      page.getByRole('link', { name: '打开话题：最新话题 1', exact: true })
    ).toBeVisible()

    const initialLinuxLatestRequests = await page.evaluate(
      () =>
        (globalThis as any).__discourseRequests.filter(
          (url: string) => url === 'https://linux.do/latest.json'
        ).length
    )
    const address = page.locator('.toolbar-address input')
    await address.fill('https://meta.discourse.org/new')
    await page.getByRole('button', { name: '打开地址' }).click()
    await expect(address).toHaveValue('https://meta.discourse.org/new')
    await expect
      .poll(() =>
        page.evaluate(() =>
          (globalThis as any).__discourseRequests.includes('https://meta.discourse.org/new.json')
        )
      )
      .toBe(true)

    await page.getByRole('button', { name: '后退' }).click()
    await expect(address).toHaveValue('https://linux.do/')
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (globalThis as any).__discourseRequests.filter(
              (url: string) => url === 'https://linux.do/latest.json'
            ).length
        )
      )
      .toBeGreaterThan(initialLinuxLatestRequests)
  })

  test('refreshes each notification filter once per dropdown opening', async ({ page }) => {
    await page.goto('/discourse.html')
    const notificationRequestCount = () =>
      page.evaluate(
        () =>
          (globalThis as any).__discourseRequests.filter(
            (url: string) => new URL(url).pathname === '/notifications.json'
          ).length
      )

    const before = await notificationRequestCount()
    const trigger = page.locator('.notifications-trigger')
    await trigger.click()
    const dropdown = page.locator('.notifications-dropdown')
    await expect(dropdown).toBeVisible()
    await expect.poll(notificationRequestCount).toBe(before + 1)

    await dropdown.getByRole('button', { name: '点赞' }).click()
    await expect.poll(notificationRequestCount).toBe(before + 2)
    await dropdown.getByRole('button', { name: '回复' }).click()
    await expect.poll(notificationRequestCount).toBe(before + 3)

    // Returning to a filter fetched in this same opening restores its snapshot.
    await dropdown.getByRole('button', { name: '点赞' }).click()
    await page.waitForTimeout(100)
    expect(await notificationRequestCount()).toBe(before + 3)

    await trigger.click()
    await expect(dropdown).toBeHidden()
    await trigger.click()
    await expect(dropdown).toBeVisible()
    await expect.poll(notificationRequestCount).toBe(before + 4)
  })

  test('opens the quick sidebar with complete static navigation shortcuts', async ({ page }) => {
    await page.goto('/discourse.html')
    await page.getByRole('button', { name: '打开快捷导航' }).click()

    const sidebar = page.getByRole('dialog', { name: '快捷导航' })
    await expect(sidebar).toBeVisible()
    for (const label of [
      '主页',
      '最新',
      '新话题',
      '未读',
      '分类',
      '标签',
      '聊天',
      '通知',
      '私信',
      '书签',
      '我的帖子'
    ]) {
      await expect(sidebar.getByRole('button', { name: label, exact: true })).toBeVisible()
    }

    await sidebar.getByRole('button', { name: '分类', exact: true }).click()
    await expect(sidebar).toBeHidden()
    await expect(page.locator('.toolbar-address input')).toHaveValue('https://linux.do/categories')
  })
})
