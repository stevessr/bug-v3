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
      const imageProxyRequests: string[] = []
      ;(globalThis as any).__discourseRequests = requests
      ;(globalThis as any).__discourseImageProxyRequests = imageProxyRequests

      const runtime = {
        lastError: null,
        sendMessage(request: any, callback: (response: any) => void) {
          if (request.type === 'PROXY_IMAGE') {
            imageProxyRequests.push(String(request.url || ''))
            const transparentPng = [
              137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1,
              8, 6, 0, 0, 0, 31, 21, 196, 137, 0, 0, 0, 13, 73, 68, 65, 84, 8, 215, 99, 248, 207,
              192, 240, 31, 0, 5, 0, 1, 255, 137, 153, 61, 29, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66,
              96, 130
            ]
            queueMicrotask(() =>
              callback({ success: true, data: transparentPng, mimeType: 'image/png' })
            )
            return
          }
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
                  data: { username: 'alice', topic_title: '最新点赞 :party_blob:' }
                },
                {
                  id: requests.length + 1,
                  notification_type: 2,
                  read: true,
                  created_at: '2026-08-09T08:00:00Z',
                  topic_id: 2,
                  post_number: 2,
                  data: { username: 'bob', topic_title: '最新回复' }
                },
                {
                  id: requests.length + 2,
                  notification_type: 6,
                  read: false,
                  created_at: '2026-08-09T07:00:00Z',
                  topic_id: 77,
                  post_number: 4,
                  slug: 'private-message-77',
                  data: { username: 'carol', topic_title: '定位私信消息' }
                }
              ],
              users: [],
              unread_notifications: 1
            }
          } else if (parsed.pathname === '/emojis.json') {
            data = {
              emojis: {
                custom: [
                  {
                    id: 'party_blob',
                    name: 'party_blob',
                    url: 'https://cdn.ldstatic.com/images/emoji/party_blob.png'
                  }
                ]
              }
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
                avatar_template: '/letter_avatar_proxy/v4/letter/s/7c8e57/{size}.png',
                trust_level: 3,
                created_at: '2024-01-01T00:00:00Z',
                profile_background_upload_url:
                  '//cdn3.ldstatic.com/original/4X/profile-background.png',
                card_background_upload_url:
                  '//linuxdo-uploads.s3.ldstatic.com/original/4X/card-background.png'
              }
            }
          } else if (parsed.pathname === '/u/steve/summary.json') {
            data = {
              user_summary: {
                likes_given: 2,
                likes_received: 3,
                topics_entered: 4,
                posts_read_count: 5,
                days_visited: 6,
                topic_count: 7,
                post_count: 8,
                time_read: 3600,
                topic_ids: [],
                top_categories: [],
                most_liked_by_users: [],
                most_liked_users: [],
                most_replied_to_users: []
              },
              topics: []
            }
          } else if (parsed.pathname === '/topics/messages/steve.json') {
            data = { topic_list: { topics: [topic(3000, '收件箱私信')] }, users: [] }
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

  test('loads UI images directly and only uses the image proxy after a native failure', async ({
    page
  }) => {
    const imageUrl = 'https://assets.example.test/direct-first.png'
    let directRequestSeen = false
    let proxyStartedBeforeNativeFailure = false
    await page.route(imageUrl, async route => {
      directRequestSeen = true
      proxyStartedBeforeNativeFailure = await page.evaluate(
        url => (globalThis as any).__discourseImageProxyRequests.includes(url),
        imageUrl
      )
      await route.abort('failed')
    })

    await page.goto('/discourse.html')
    await page.evaluate(url => {
      const image = document.createElement('img')
      image.id = 'direct-first-image'
      image.alt = 'direct first fallback test'
      image.src = url
      document.querySelector('.discourse-browser')?.append(image)
    }, imageUrl)

    await expect.poll(() => directRequestSeen).toBe(true)
    expect(proxyStartedBeforeNativeFailure).toBe(false)
    await expect
      .poll(() =>
        page.evaluate(
          url => (globalThis as any).__discourseImageProxyRequests.includes(url),
          imageUrl
        )
      )
      .toBe(true)

    const image = page.locator('#direct-first-image')
    await expect(image).toHaveAttribute('data-discourse-image-source', 'proxy')
    await expect(image).toHaveAttribute('src', /^blob:/)
    await expect
      .poll(() =>
        page.evaluate(
          url =>
            (globalThis as any).__discourseRequests.filter(
              (requestUrl: string) => requestUrl === url
            ).length,
          imageUrl
        )
      )
      .toBe(0)
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

  test('resolves /my/messages to the current user inbox', async ({ page }) => {
    await page.goto('/discourse.html')
    const address = page.locator('.toolbar-address input')
    await address.fill('https://linux.do/my/messages')
    await page.getByRole('button', { name: '打开地址' }).click()

    await expect(address).toHaveValue('https://linux.do/u/steve/messages')
    await expect(page.getByRole('tab', { name: '全部', selected: true })).toBeVisible()
    await expect(page.locator('.messages-topic-item__title')).toHaveText('收件箱私信')
    await expect
      .poll(() =>
        page.evaluate(() =>
          (globalThis as any).__discourseRequests.includes(
            'https://linux.do/topics/messages/steve.json'
          )
        )
      )
      .toBe(true)
  })

  test('uses the profile background and exposes all own-profile modules', async ({ page }) => {
    await page.goto('/discourse.html')
    const address = page.locator('.toolbar-address input')
    await address.fill('https://linux.do/u/steve/summary')
    await page.getByRole('button', { name: '打开地址' }).click()

    const header = page.locator('.user-profile-header')
    await expect(header).toHaveCSS(
      'background-image',
      /cdn3\.ldstatic\.com\/original\/4X\/profile-background\.png/
    )
    const tabs = page.getByRole('tablist', { name: '用户页面' })
    for (const label of [
      '总结',
      '活动',
      '通知',
      '消息',
      '邀请',
      '徽章',
      '作品集',
      '关注',
      '结算',
      '偏好设置'
    ]) {
      await expect(tabs.getByRole('tab', { name: label, exact: true })).toBeVisible()
    }

    await tabs.getByRole('tab', { name: '作品集', exact: true }).click()
    await expect(address).toHaveValue('https://linux.do/u/steve/activity/portfolio')
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
    await expect
      .poll(() =>
        page.evaluate(() =>
          (globalThis as any).__discourseRequests.some(
            (url: string) =>
              new URL(url).pathname === '/notifications.json' &&
              new URL(url).searchParams.get('filter') === 'likes'
          )
        )
      )
      .toBe(true)
    await dropdown.getByRole('button', { name: '回复' }).click()
    await expect.poll(notificationRequestCount).toBe(before + 3)
    await expect
      .poll(() =>
        page.evaluate(() =>
          (globalThis as any).__discourseRequests.some(
            (url: string) =>
              new URL(url).pathname === '/notifications.json' &&
              new URL(url).searchParams.get('filter') === 'replies'
          )
        )
      )
      .toBe(true)

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

  test('renders notification shortcodes and opens a private-message notification at its post', async ({
    page
  }) => {
    await page.goto('/discourse.html')
    await page.locator('.notifications-trigger').click()
    const dropdown = page.locator('.notifications-dropdown')
    await expect(dropdown).toBeVisible()
    await expect(dropdown.locator('.ntf-title img[alt="party_blob"]')).toBeVisible()

    await dropdown.locator('.ntf-item').filter({ hasText: '定位私信消息' }).click()
    await expect(page.locator('.toolbar-address input')).toHaveValue(
      'https://linux.do/t/private-message-77/77/4'
    )
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
