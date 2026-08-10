import { expect, test } from '@playwright/test'

test.describe('Discourse chat message threads', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const requestLog: Array<{ url: string; method: string; body: string }> = []
      ;(globalThis as any).__chatThreadRequests = requestLog

      const steve = {
        id: 1,
        username: 'steve',
        name: 'Steve',
        avatar_template: '/letter_avatar_proxy/v4/letter/s/8491ac/{size}.png',
        staff: true,
        can_chat: true,
        can_direct_message: true,
        has_chat_enabled: true
      }
      ;(globalThis as any).__chatThreadCurrentUser = steve
      ;(globalThis as any).__threadTitleUpdateAllowed = true
      const alice = {
        id: 2,
        username: 'alice',
        name: 'Alice',
        avatar_template: '/letter_avatar_proxy/v4/letter/a/8491ac/{size}.png'
      }
      const bob = {
        id: 3,
        username: 'bob',
        name: 'Bob',
        avatar_template: '/letter_avatar_proxy/v4/letter/b/8491ac/{size}.png'
      }

      const original = {
        id: 100,
        message: '这个发布方案怎么样？',
        cooked: '<p>这个发布方案怎么样？</p>',
        created_at: '2026-08-10T01:00:00Z',
        chat_channel_id: 7,
        thread_id: 501,
        user: alice,
        reactions: [],
        blocks: []
      }
      const plainMessage = {
        id: 110,
        message: '还没有消息串的消息',
        cooked: '<p>还没有消息串的消息</p>',
        created_at: '2026-08-10T01:10:00Z',
        chat_channel_id: 7,
        user: bob,
        reactions: [],
        blocks: []
      }
      const legacyReplyMessage = {
        id: 120,
        message: '普通引用回复目标',
        cooked: '<p>普通引用回复目标</p>',
        created_at: '2026-08-10T01:15:00Z',
        chat_channel_id: 7,
        user: alice,
        reactions: [],
        blocks: []
      }
      const threadReplies = [
        {
          id: 201,
          message: '较早的消息串回复',
          cooked: '<p>较早的消息串回复</p>',
          created_at: '2026-08-10T01:20:00Z',
          chat_channel_id: 7,
          thread_id: 501,
          thread_title: '发布方案讨论',
          user: bob,
          reactions: [],
          blocks: []
        },
        {
          id: 202,
          message: '可以先灰度发布',
          cooked: '<p>可以先灰度发布</p>',
          created_at: '2026-08-10T01:30:00Z',
          chat_channel_id: 7,
          thread_id: 501,
          thread_title: '发布方案讨论',
          user: alice,
          reactions: [],
          blocks: []
        },
        {
          id: 203,
          message: '我来补充回滚步骤',
          cooked: '<p>我来补充回滚步骤</p>',
          created_at: '2026-08-10T01:40:00Z',
          chat_channel_id: 7,
          thread_id: 501,
          thread_title: '发布方案讨论',
          user: bob,
          reactions: [{ emoji: 'heart', count: 1, reacted: false, users: [alice] }],
          blocks: []
        }
      ]
      const secondThreadOriginal = {
        id: 130,
        message: '文档迁移计划',
        cooked: '<p>文档迁移计划</p>',
        created_at: '2026-08-10T01:45:00Z',
        chat_channel_id: 7,
        thread_id: 601,
        user: bob,
        reactions: [],
        blocks: []
      }
      const secondThreadReplies = [
        {
          id: 211,
          message: '我来整理迁移清单',
          cooked: '<p>我来整理迁移清单</p>',
          created_at: '2026-08-10T01:50:00Z',
          chat_channel_id: 7,
          thread_id: 601,
          thread_title: '文档迁移',
          user: alice,
          reactions: [],
          blocks: []
        }
      ]
      const thread501: Record<string, any> = {
        id: 501,
        title: '发布方案讨论',
        status: 'open',
        channel_id: 7,
        reply_count: 3,
        last_message_id: 203,
        original_message: { ...original },
        current_user_membership: {
          id: 9001,
          notification_level: 'tracking',
          last_read_message_id: 201,
          unread_count: 2
        },
        preview: {
          last_reply_created_at: threadReplies[2].created_at,
          last_reply_excerpt: '我来补充回滚步骤',
          last_reply_id: 203,
          last_reply_user: bob,
          participant_count: 2,
          participant_users: [alice, bob],
          reply_count: 3
        }
      }
      const thread601: Record<string, any> = {
        id: 601,
        title: '文档迁移',
        status: 'open',
        channel_id: 7,
        reply_count: 1,
        last_message_id: 211,
        original_message: { ...secondThreadOriginal },
        current_user_membership: {
          id: 9002,
          notification_level: 1,
          last_read_message_id: 211,
          unread_count: 0
        },
        preview: {
          last_reply_created_at: secondThreadReplies[0].created_at,
          last_reply_excerpt: '我来整理迁移清单',
          last_reply_id: 211,
          last_reply_user: alice,
          participant_count: 2,
          participant_users: [alice, bob],
          reply_count: 1
        }
      }
      const mainMessages: any[] = [
        { ...original, thread: thread501 },
        plainMessage,
        legacyReplyMessage
      ]
      const threads = new Map<number, any>([
        [501, thread501],
        [601, thread601]
      ])
      const replies = new Map<number, any[]>([
        [501, threadReplies],
        [601, secondThreadReplies]
      ])
      let nextMessageId = 300
      let nextThreadId = 502

      const channel: Record<string, any> = {
        id: 7,
        title: '产品交流',
        slug: 'product-chat',
        channelType: 'public',
        chatable_type: 'Category',
        chatable_id: 12,
        chatable: { id: 12, name: '产品', slug: 'product' },
        status: 'open',
        threading_enabled: true,
        current_user_membership: {
          chat_channel_id: 7,
          unread_count: 0,
          watched_threads_unread_count: 2
        },
        meta: { can_moderate: true, can_flag: true, user_silenced: false }
      }
      ;(globalThis as any).__chatThreadFixture = { channel, mainMessages, threads, replies }

      const parseBody = (body: string) =>
        body.startsWith('{')
          ? JSON.parse(body)
          : Object.fromEntries(new URLSearchParams(body).entries())

      const runtime = {
        lastError: null,
        sendMessage(request: any, callback: (response: any) => void) {
          if (request.type === 'GET_LINUX_DO_USER') {
            queueMicrotask(() =>
              callback({
                success: true,
                user: {
                  ...steve,
                  staff: !(globalThis as any).__chatThreadForceNonStaff
                }
              })
            )
            return
          }
          if (request.type === 'GET_DISCOURSE_SITE_SETTINGS') {
            const values: Record<string, any> = {
              chat_enabled: true,
              enable_public_channels: true,
              max_chat_auto_joined_users: 100
            }
            const settings = Object.fromEntries(
              (request.keys || [])
                .filter((key: string) => key in values)
                .map((key: string) => [key, values[key]])
            )
            queueMicrotask(() => callback({ success: true, settings }))
            return
          }

          const url = String(request?.options?.url || '')
          const method = String(request?.options?.method || 'GET').toUpperCase()
          const body = String(request?.options?.body || '')
          if (request.type === 'PAGE_FETCH') requestLog.push({ url, method, body })

          let data: any = {}
          let status = 200
          let ok = true

          const threadMessagesMatch = url.match(
            /\/chat\/api\/channels\/7\/threads\/(\d+)\/messages(?:\?|$)/
          )
          const threadShowMatch = url.match(/\/chat\/api\/channels\/7\/threads\/(\d+)$/)
          const threadReadMatch = url.match(
            /\/chat\/api\/channels\/7\/threads\/(\d+)\/read(?:\?|$)/
          )
          const threadNotificationMatch = url.match(
            /\/chat\/api\/channels\/7\/threads\/(\d+)\/notifications-settings\/me$/
          )

          if (url.includes('/chat/api/me/channels')) {
            data = { channels: [channel] }
          } else if (new URL(url).pathname === '/chat/api/search' && method === 'GET') {
            const searchUrl = new URL(url)
            const query = searchUrl.searchParams.get('query') || ''
            const offset = Number(searchUrl.searchParams.get('offset') || 0)
            const withChannel = (message: any) => ({ ...message, channel })
            if (query === '灰度') {
              data = {
                messages: [withChannel(threadReplies[1])],
                meta: { has_more: false, limit: 20, offset }
              }
            } else if (offset === 0) {
              data = {
                messages: [withChannel(plainMessage), withChannel(threadReplies[1])],
                meta: { has_more: true, limit: 20, offset }
              }
            } else {
              data = {
                messages: [withChannel(legacyReplyMessage)],
                meta: { has_more: false, limit: 20, offset }
              }
            }
          } else if (url.includes('/chat/api/me/threads') && method === 'GET') {
            const offset = Number(new URL(url).searchParams.get('offset') || 0)
            if (offset === 0) {
              data = {
                threads: [{ ...thread501, channel }],
                tracking: {
                  501: {
                    channel_id: 7,
                    unread_count: 2,
                    mention_count: 0,
                    watched_threads_unread_count: 0
                  }
                },
                meta: { load_more_url: '/chat/api/me/threads?limit=1&offset=1' }
              }
            } else {
              data = {
                threads: [{ ...thread601, channel }],
                tracking: {
                  601: {
                    channel_id: 7,
                    unread_count: 0,
                    mention_count: 0,
                    watched_threads_unread_count: 0
                  }
                },
                meta: { load_more_url: null }
              }
            }
          } else if (new URL(url).pathname === '/chat/api/channels/7/threads' && method === 'GET') {
            const offset = Number(new URL(url).searchParams.get('offset') || 0)
            if (offset === 0) {
              data = {
                threads: [
                  {
                    ...thread501,
                    channel,
                    current_user_membership: {
                      ...thread501.current_user_membership,
                      notification_level: 3
                    }
                  }
                ],
                tracking: {
                  501: {
                    channel_id: 7,
                    unread_count: 0,
                    mention_count: 0,
                    watched_threads_unread_count: 2
                  }
                },
                meta: {
                  channel_id: 7,
                  load_more_url: '/chat/api/channels/7/threads?offset=1'
                }
              }
            } else {
              data = {
                threads: [{ ...thread601, channel }],
                tracking: {
                  601: {
                    channel_id: 7,
                    unread_count: 0,
                    mention_count: 0,
                    watched_threads_unread_count: 0
                  }
                },
                meta: { channel_id: 7, load_more_url: null }
              }
            }
          } else if (threadMessagesMatch && method === 'GET') {
            const threadId = Number(threadMessagesMatch[1])
            const messageUrl = new URL(url)
            const targetId = Number(messageUrl.searchParams.get('target_message_id') || 0)
            const direction = messageUrl.searchParams.get('direction')
            const allReplies = replies.get(threadId) || []
            if (threadId === 501 && !targetId) {
              data = {
                messages: allReplies.filter(message => message.id >= 202),
                meta: { can_load_more_past: true }
              }
            } else if (threadId === 501 && targetId === 202 && direction === 'past') {
              data = {
                messages: allReplies.filter(message => message.id < 202),
                meta: { can_load_more_past: false }
              }
            } else if (threadId === 501 && targetId === 202) {
              data = {
                messages: allReplies,
                meta: { can_load_more_past: false, can_load_more_future: false }
              }
            } else {
              const thread = threads.get(threadId)
              data = {
                messages: [thread?.original_message, ...allReplies].filter(Boolean),
                meta: { can_load_more_past: false }
              }
            }
          } else if (threadReadMatch && method === 'PUT') {
            data = { success: 'OK' }
          } else if (threadNotificationMatch && method === 'PUT') {
            const threadId = Number(threadNotificationMatch[1])
            const parsed = parseBody(body)
            const notificationLevel = Number(parsed.notification_level)
            const thread = threads.get(threadId)
            if (thread?.current_user_membership) {
              thread.current_user_membership.notification_level = notificationLevel
            }
            data = {
              membership: {
                ...(thread?.current_user_membership || {}),
                thread_id: threadId,
                notification_level: notificationLevel
              }
            }
          } else if (threadShowMatch && method === 'PUT') {
            const threadId = Number(threadShowMatch[1])
            const parsed = parseBody(body)
            const thread = threads.get(threadId)
            if (!(globalThis as any).__threadTitleUpdateAllowed) {
              ok = false
              status = 403
              data = { errors: ['没有编辑消息串标题的权限'] }
            } else if (!thread) {
              ok = false
              status = 404
              data = { errors: ['消息串不存在'] }
            } else if (String(parsed.title || '').length > 100) {
              ok = false
              status = 400
              data = { errors: ['标题不能超过 100 个字符'] }
            } else {
              thread.title = String(parsed.title || '')
              data = { success: 'OK' }
            }
          } else if (threadShowMatch && method === 'GET') {
            const thread = threads.get(Number(threadShowMatch[1]))
            if (thread) {
              data = { thread }
            } else {
              ok = false
              status = 404
              data = { errors: ['消息串不存在'] }
            }
          } else if (url.endsWith('/chat/api/channels/7/threads') && method === 'POST') {
            const parsed = parseBody(body)
            const originalMessageId = Number(parsed.original_message_id)
            const originalMessage = mainMessages.find(message => message.id === originalMessageId)
            const thread = {
              id: nextThreadId++,
              title: null,
              status: 'open',
              channel_id: 7,
              reply_count: 0,
              last_message_id: originalMessageId,
              original_message: { ...originalMessage },
              preview: { reply_count: 0, participant_users: [] }
            }
            threads.set(thread.id, thread)
            replies.set(thread.id, [])
            if (originalMessage) {
              originalMessage.thread_id = thread.id
              originalMessage.thread = thread
            }
            data = thread
          } else if (/\/chat\/api\/channels\/7\/messages(?:\?|$)/.test(url)) {
            data = { messages: mainMessages, meta: { can_load_more_past: false } }
          } else if (/\/chat\/7(?:\.json)?$/.test(url) && method === 'POST') {
            const parsed = parseBody(body)
            const threadId = Number(parsed.thread_id || 0)
            const created = {
              id: nextMessageId++,
              message: parsed.message,
              cooked: `<p>${parsed.message}</p>`,
              created_at: new Date().toISOString(),
              chat_channel_id: 7,
              ...(threadId ? { thread_id: threadId } : {}),
              ...(parsed.in_reply_to_id
                ? {
                    in_reply_to: [...mainMessages, ...(replies.get(threadId) || [])].find(
                      message => message.id === Number(parsed.in_reply_to_id)
                    )
                  }
                : {}),
              user: steve,
              reactions: [],
              blocks: []
            }
            if (threadId) {
              replies.get(threadId)?.push(created)
            } else {
              mainMessages.push(created)
            }
            data = { chat_message: created, message_id: created.id }
          } else if (/\/chat\/7\/react\/\d+(?:\.json)?$/.test(url) && method === 'PUT') {
            data = { success: 'OK' }
          } else if (url.includes('/latest')) {
            data = { topic_list: { topics: [] }, users: [] }
          } else if (url.includes('/categories')) {
            data = { category_list: { categories: [] } }
          }

          queueMicrotask(() => callback({ success: true, data: { status, ok, data } }))
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
  })

  const openChat = async (page: import('@playwright/test').Page) => {
    await page.goto('/discourse.html')
    await page.locator('.toolbar-address input').fill('https://linux.do/chat')
    await page.getByRole('button', { name: '打开地址' }).click()
    await expect(page.locator('.chat-main-title')).toHaveText('产品交流')
    await expect(page.getByText('这个发布方案怎么样？', { exact: true })).toBeVisible()
  }

  test('opens, paginates and replies inside an official Discourse thread without refreshing', async ({
    page
  }) => {
    await openChat(page)

    const threadLink = page.getByRole('link', { name: '打开消息串，共 3 条回复' })
    await expect(threadLink).toHaveAttribute('href', 'https://linux.do/chat/c/-/7/t/501')
    await threadLink.click()
    const panel = page.getByRole('region', { name: '消息串：发布方案讨论' })
    await expect(panel).toBeVisible()
    await expect(panel.getByText('可以先灰度发布', { exact: true })).toBeVisible()
    await expect(panel.getByText('较早的消息串回复', { exact: true })).toHaveCount(0)
    await expect
      .poll(async () =>
        page.evaluate(() =>
          (globalThis as any).__chatThreadRequests.some(
            (request: any) =>
              request.method === 'PUT' && request.url.includes('/threads/501/read?message_id=203')
          )
        )
      )
      .toBe(true)

    await panel.getByRole('button', { name: '加载更早消息' }).click()
    await expect(panel.getByText('较早的消息串回复', { exact: true })).toBeVisible()

    const paginationRequest = await page.evaluate(() =>
      (globalThis as any).__chatThreadRequests.find(
        (request: any) =>
          request.url.includes('/threads/501/messages') &&
          request.url.includes('target_message_id=202')
      )
    )
    expect(paginationRequest).toBeTruthy()

    const targetMessage = panel.locator('.chat-message-item').filter({
      hasText: '我来补充回滚步骤'
    })
    await targetMessage.locator('.chat-message-reaction').click()
    await expect(targetMessage.locator('.chat-message-reaction-count')).toHaveText('2')
    await expect
      .poll(async () =>
        page.evaluate(() =>
          (globalThis as any).__chatThreadRequests.some(
            (request: any) =>
              request.method === 'PUT' && /\/chat\/7\/react\/203\.json$/.test(request.url)
          )
        )
      )
      .toBe(true)

    await targetMessage.hover()
    await targetMessage.getByRole('button', { name: '更多消息操作' }).click()
    await targetMessage.getByRole('menuitem', { name: '回复' }).click()
    await expect(panel.getByText(/回复 @bob/)).toBeVisible()
    await panel.getByRole('textbox', { name: '回复消息...' }).fill('已补充监控检查项')
    await panel.getByRole('button', { name: '发送' }).click()

    await expect(panel.getByText('已补充监控检查项', { exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: '打开消息串，共 4 条回复' })).toBeVisible()

    const sendRequest = await page.evaluate(() =>
      (globalThis as any).__chatThreadRequests.find(
        (request: any) =>
          /\/chat\/7(?:\.json)?$/.test(request.url) &&
          new URLSearchParams(request.body).get('message') === '已补充监控检查项'
      )
    )
    const sendParams = new URLSearchParams(sendRequest.body)
    expect(sendParams.get('thread_id')).toBe('501')
    expect(sendParams.get('in_reply_to_id')).toBe('203')

    const channelMessageLoads = await page.evaluate(
      () =>
        (globalThis as any).__chatThreadRequests.filter((request: any) =>
          /\/chat\/api\/channels\/7\/messages(?:\?|$)/.test(request.url)
        ).length
    )
    expect(channelMessageLoads).toBe(1)

    await panel.getByRole('button', { name: '关闭消息串' }).click()
    await expect(panel).toHaveCount(0)
  })

  test('creates a thread on first reply and keeps a non-thread reply in_reply_to payload', async ({
    page
  }) => {
    await openChat(page)

    const plainMessage = page.locator('.chat-message-item').filter({
      hasText: '还没有消息串的消息'
    })
    await plainMessage.hover()
    await plainMessage.getByRole('button', { name: '更多消息操作' }).click()
    await plainMessage.getByRole('menuitem', { name: '在消息串中回复' }).click()

    const panel = page.getByRole('region', { name: '消息串：消息串' })
    await expect(panel).toBeVisible()
    const createRequest = await page.evaluate(() =>
      (globalThis as any).__chatThreadRequests.find(
        (request: any) =>
          request.url.endsWith('/chat/api/channels/7/threads') && request.method === 'POST'
      )
    )
    expect(new URLSearchParams(createRequest.body).get('original_message_id')).toBe('110')

    await panel.getByRole('textbox', { name: '输入消息，回车发送' }).fill('第一条消息串回复')
    await panel.getByRole('button', { name: '发送' }).click()
    await expect(panel.getByText('第一条消息串回复', { exact: true })).toBeVisible()
    await panel.getByRole('button', { name: '关闭消息串' }).click()
    await expect(page.getByRole('link', { name: '打开消息串，共 1 条回复' })).toBeVisible()

    await page.evaluate(() => {
      ;(globalThis as any).__chatThreadFixture.channel.threading_enabled = false
    })
    await page.locator('.toolbar-address input').fill('https://linux.do/chat')
    await page.getByRole('button', { name: '打开地址' }).click()

    const nonThreadMessage = page.locator('.chat-message-item').filter({
      hasText: '普通引用回复目标'
    })
    await nonThreadMessage.hover()
    await nonThreadMessage.getByRole('button', { name: '更多消息操作' }).click()
    await nonThreadMessage.getByRole('menuitem', { name: '回复' }).click()
    await page.getByRole('textbox', { name: '回复消息...' }).fill('普通引用回复')
    await page.getByRole('button', { name: '发送' }).click()

    const replyRequest = await page.evaluate(() =>
      (globalThis as any).__chatThreadRequests.find(
        (request: any) =>
          /\/chat\/7(?:\.json)?$/.test(request.url) &&
          new URLSearchParams(request.body).get('message') === '普通引用回复'
      )
    )
    const replyParams = new URLSearchParams(replyRequest.body)
    expect(replyParams.get('in_reply_to_id')).toBe('120')
    expect(replyParams.get('thread_id')).toBeNull()
    expect(replyParams.get('message')).toBe('普通引用回复')
  })

  test('loads, collapses and paginates My Threads and updates official tracking settings', async ({
    page
  }) => {
    await openChat(page)

    const section = page.locator('[data-chat-sidebar-section="my-threads"]')
    await expect(section).toBeVisible()
    await expect(section.getByText('发布方案讨论', { exact: true })).toBeVisible()
    await expect(section.locator('.chat-thread-list__item-unread')).toHaveText('2')

    const firstThreadHref = 'https://linux.do/chat/c/product-chat/7/t/501'
    const firstThreadLink = section.locator(`a[href="${firstThreadHref}"]`)
    await expect(firstThreadLink).toBeVisible()

    const initialThreadLoads = await page.evaluate(
      () =>
        (globalThis as any).__chatThreadRequests.filter(
          (request: any) => request.method === 'GET' && request.url.includes('/chat/api/me/threads')
        ).length
    )
    expect(initialThreadLoads).toBe(1)

    const toggle = section.locator('.chat-thread-list__toggle')
    await toggle.click()
    await expect(firstThreadLink).toBeHidden()
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await toggle.click()
    await expect(firstThreadLink).toBeVisible()
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')

    const loadsAfterToggle = await page.evaluate(
      () =>
        (globalThis as any).__chatThreadRequests.filter(
          (request: any) => request.method === 'GET' && request.url.includes('/chat/api/me/threads')
        ).length
    )
    expect(loadsAfterToggle).toBe(initialThreadLoads)

    await section.getByRole('button', { name: '加载更多消息串' }).click()
    await expect(section.getByText('文档迁移', { exact: true })).toBeVisible()
    await expect
      .poll(async () =>
        page.evaluate(() =>
          (globalThis as any).__chatThreadRequests.some(
            (request: any) =>
              request.method === 'GET' &&
              request.url === 'https://linux.do/chat/api/me/threads?limit=1&offset=1'
          )
        )
      )
      .toBe(true)

    await firstThreadLink.click()
    const panel = page.getByRole('region', { name: '消息串：发布方案讨论' })
    await expect(panel).toBeVisible()
    await expect(firstThreadLink).toHaveClass(/active/)
    await expect(firstThreadLink.locator('.chat-thread-list__item-unread')).toHaveCount(0)

    const trackingSelect = panel.getByRole('combobox', { name: '消息串通知级别' })
    await expect(trackingSelect).toHaveValue('2')
    await trackingSelect.selectOption('3')
    await expect(trackingSelect).toHaveValue('3')

    const notificationRequest = await page.evaluate(() =>
      (globalThis as any).__chatThreadRequests.find(
        (request: any) =>
          request.method === 'PUT' && request.url.endsWith('/threads/501/notifications-settings/me')
      )
    )
    expect(notificationRequest).toBeTruthy()
    expect(new URLSearchParams(notificationRequest.body).get('notification_level')).toBe('3')
  })

  test('edits a permitted thread title in place and keeps every cached list synchronized', async ({
    page
  }) => {
    await openChat(page)

    const channelLoadsBefore = await page.evaluate(
      () =>
        (globalThis as any).__chatThreadRequests.filter((request: any) =>
          /\/chat\/api\/channels\/7\/messages(?:\?|$)/.test(request.url)
        ).length
    )
    const channelThreadsButton = page.getByTitle('查看频道消息串')
    await channelThreadsButton.click()
    const channelThreadsPanel = page.getByRole('region', { name: '频道消息串：产品交流' })
    const channelThreadLink = channelThreadsPanel.locator(
      'a[href="https://linux.do/chat/c/product-chat/7/t/501"]'
    )
    await channelThreadLink.click()

    const panel = page.getByRole('region', { name: '消息串：发布方案讨论' })
    await panel.getByRole('button', { name: '编辑消息串标题' }).click()
    const titleInput = panel.getByRole('textbox', { name: '消息串标题' })
    await expect(titleInput).toHaveValue('发布方案讨论')

    await page.evaluate(() => {
      ;(globalThis as any).__threadTitleUpdateAllowed = false
    })
    await titleInput.fill('不会被保存的标题')
    await panel.getByRole('button', { name: '保存消息串标题' }).click()
    await expect(page.getByText('没有编辑消息串标题的权限').last()).toBeVisible()
    await expect(titleInput).toHaveValue('不会被保存的标题')

    await page.evaluate(() => {
      ;(globalThis as any).__threadTitleUpdateAllowed = true
    })
    await titleInput.fill('灰度发布与回滚')
    await panel.getByRole('button', { name: '保存消息串标题' }).click()

    const renamedPanel = page.getByRole('region', { name: '消息串：灰度发布与回滚' })
    await expect(renamedPanel).toBeVisible()
    const successfulUpdate = await page.evaluate(() =>
      (globalThis as any).__chatThreadRequests.find(
        (request: any) =>
          request.method === 'PUT' &&
          request.url.endsWith('/chat/api/channels/7/threads/501') &&
          new URLSearchParams(request.body).get('title') === '灰度发布与回滚'
      )
    )
    expect(successfulUpdate).toBeTruthy()

    await expect(
      page
        .locator('[data-chat-sidebar-section="my-threads"]')
        .getByText('灰度发布与回滚', { exact: true })
    ).toBeVisible()
    await renamedPanel.getByRole('button', { name: '关闭消息串' }).click()
    await channelThreadsButton.click()
    await expect(
      page
        .getByRole('region', { name: '频道消息串：产品交流' })
        .getByText('灰度发布与回滚', { exact: true })
    ).toBeVisible()

    expect(
      await page.evaluate(
        () =>
          (globalThis as any).__chatThreadRequests.filter(
            (request: any) =>
              request.method === 'GET' &&
              new URL(request.url).pathname === '/chat/api/channels/7/threads'
          ).length
      )
    ).toBe(1)
    expect(
      await page.evaluate(
        () =>
          (globalThis as any).__chatThreadRequests.filter((request: any) =>
            /\/chat\/api\/channels\/7\/messages(?:\?|$)/.test(request.url)
          ).length
      )
    ).toBe(channelLoadsBefore)
  })

  test('hides thread title editing from a non-staff non-author', async ({ page }) => {
    await page.addInitScript(() => {
      ;(globalThis as any).__chatThreadForceNonStaff = true
    })
    await page.goto('/discourse.html')
    await page.locator('.toolbar-address input').fill('https://linux.do/chat/c/-/7/t/501')
    await page.getByRole('button', { name: '打开地址' }).click()

    const panel = page.getByRole('region', { name: '消息串：发布方案讨论' })
    await expect(panel).toBeVisible()
    await expect(panel.getByRole('button', { name: '编辑消息串标题' })).toHaveCount(0)
  })

  test('searches all chats with official scope, sorting and pagination parameters', async ({
    page
  }) => {
    await openChat(page)

    await page.getByRole('button', { name: '搜索聊天消息' }).click()
    const searchPanel = page.getByRole('region', { name: '聊天消息搜索' })
    await expect(searchPanel).toBeVisible()
    await searchPanel.getByRole('searchbox', { name: '搜索聊天消息' }).fill('方案')
    await searchPanel.getByRole('searchbox', { name: '搜索聊天消息' }).press('Enter')

    const channelResult = searchPanel.locator(
      'a[href="https://linux.do/chat/c/product-chat/7/110"]'
    )
    const threadResult = searchPanel.locator(
      'a[href="https://linux.do/chat/c/product-chat/7/t/501/202"]'
    )
    await expect(channelResult).toBeVisible()
    await expect(threadResult).toBeVisible()
    await expect(searchPanel.getByText('消息串：发布方案讨论')).toBeVisible()

    const firstRequest = await page.evaluate(() =>
      (globalThis as any).__chatThreadRequests.find(
        (request: any) =>
          request.method === 'GET' && new URL(request.url).pathname === '/chat/api/search'
      )
    )
    const firstSearchUrl = new URL(firstRequest.url)
    expect(firstSearchUrl.searchParams.get('query')).toBe('方案')
    expect(firstSearchUrl.searchParams.get('sort')).toBe('relevance')
    expect(firstSearchUrl.searchParams.get('offset')).toBe('0')
    expect(firstSearchUrl.searchParams.get('limit')).toBe('20')
    expect(firstSearchUrl.searchParams.has('channel_id')).toBe(false)

    await searchPanel.getByRole('combobox', { name: '聊天搜索排序' }).selectOption('latest')
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (globalThis as any).__chatThreadRequests.filter((request: any) => {
              const url = new URL(request.url)
              return (
                url.pathname === '/chat/api/search' && url.searchParams.get('sort') === 'latest'
              )
            }).length
        )
      )
      .toBe(1)

    await searchPanel.getByRole('button', { name: '加载更多结果' }).click()
    await expect(searchPanel.getByText('普通引用回复目标', { exact: true })).toBeVisible()
    const paginatedRequest = await page.evaluate(() =>
      (globalThis as any).__chatThreadRequests.find((request: any) => {
        const url = new URL(request.url)
        return url.pathname === '/chat/api/search' && url.searchParams.get('offset') === '2'
      })
    )
    expect(paginatedRequest).toBeTruthy()
  })

  test('scopes search to the current channel and jumps to an exact thread message', async ({
    page
  }) => {
    await openChat(page)

    await page.getByTitle('在当前频道搜索').click()
    const searchPanel = page.getByRole('region', { name: '聊天消息搜索' })
    await expect(searchPanel.getByRole('combobox', { name: '聊天搜索范围' })).toHaveValue('7')
    await searchPanel.getByRole('searchbox', { name: '搜索聊天消息' }).fill('灰度')
    await searchPanel.getByRole('searchbox', { name: '搜索聊天消息' }).press('Enter')

    const result = searchPanel.locator('a[href="https://linux.do/chat/c/product-chat/7/t/501/202"]')
    await expect(result).toBeVisible()
    const scopedRequest = await page.evaluate(() =>
      (globalThis as any).__chatThreadRequests.find((request: any) => {
        const url = new URL(request.url)
        return url.pathname === '/chat/api/search' && url.searchParams.get('query') === '灰度'
      })
    )
    expect(new URL(scopedRequest.url).searchParams.get('channel_id')).toBe('7')

    await result.click()
    await expect(page.locator('.toolbar-address input')).toHaveValue(
      'https://linux.do/chat/c/product-chat/7/t/501/202'
    )
    const threadPanel = page.getByRole('region', { name: '消息串：发布方案讨论' })
    const targetMessage = threadPanel.locator(
      '.chat-message-item.is-search-target[data-chat-message-id="202"]'
    )
    await expect(targetMessage).toBeVisible()
    await expect(targetMessage.getByText('可以先灰度发布', { exact: true })).toBeVisible()

    const aroundTargetRequest = await page.evaluate(() =>
      (globalThis as any).__chatThreadRequests.find((request: any) => {
        const url = new URL(request.url)
        return (
          url.pathname === '/chat/api/channels/7/threads/501/messages' &&
          url.searchParams.get('target_message_id') === '202' &&
          !url.searchParams.has('direction')
        )
      })
    )
    expect(aroundTargetRequest).toBeTruthy()
  })

  test('loads and highlights an exact channel message deep link around its target', async ({
    page
  }) => {
    await page.goto('/discourse.html')
    await page.locator('.toolbar-address input').fill('https://linux.do/chat/c/product-chat/7/110')
    await page.getByRole('button', { name: '打开地址' }).click()

    const targetMessage = page.locator(
      '.chat-message-item.is-search-target[data-chat-message-id="110"]'
    )
    await expect(targetMessage).toBeVisible()
    await expect(targetMessage.getByText('还没有消息串的消息', { exact: true })).toBeVisible()
    const aroundTargetRequest = await page.evaluate(() =>
      (globalThis as any).__chatThreadRequests.find((request: any) => {
        const url = new URL(request.url)
        return (
          url.pathname === '/chat/api/channels/7/messages' &&
          url.searchParams.get('target_message_id') === '110' &&
          !url.searchParams.has('direction')
        )
      })
    )
    expect(aroundTargetRequest).toBeTruthy()
  })

  test('keeps chat message search usable in a mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await openChat(page)

    await page.getByRole('button', { name: '搜索聊天消息' }).click()
    const searchPanel = page.getByRole('region', { name: '聊天消息搜索' })
    await expect(searchPanel).toBeVisible()
    await expect(searchPanel.getByRole('searchbox', { name: '搜索聊天消息' })).toBeVisible()
    await expect(searchPanel.getByRole('combobox', { name: '聊天搜索范围' })).toBeVisible()
    await expect(searchPanel.getByRole('combobox', { name: '聊天搜索排序' })).toBeVisible()

    const bounds = await searchPanel.boundingBox()
    expect(bounds).not.toBeNull()
    expect(bounds!.x).toBeGreaterThanOrEqual(0)
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390)
  })

  test('opens and paginates the official current-channel thread list without reloading chat', async ({
    page
  }) => {
    await openChat(page)

    const openButton = page.getByTitle('查看频道消息串')
    await expect(openButton).toBeVisible()
    await expect(openButton).toHaveAccessibleName('查看频道消息串，2 条未读')
    await openButton.click()

    const panel = page.getByRole('region', { name: '频道消息串：产品交流' })
    await expect(panel).toBeVisible()
    const firstThreadLink = panel.locator('a[href="https://linux.do/chat/c/product-chat/7/t/501"]')
    await expect(firstThreadLink).toBeVisible()
    await expect(firstThreadLink.locator('.chat-thread-list__item-unread')).toHaveText('2')
    await expect(firstThreadLink).toHaveClass(/is-urgent/)

    const channelThreadRequestCount = () =>
      page.evaluate(
        () =>
          (globalThis as any).__chatThreadRequests.filter(
            (request: any) =>
              request.method === 'GET' &&
              new URL(request.url).pathname === '/chat/api/channels/7/threads'
          ).length
      )
    await expect.poll(channelThreadRequestCount).toBe(1)

    await panel.getByRole('button', { name: '关闭频道消息串' }).click()
    await expect(panel).toHaveCount(0)
    await openButton.click()
    await expect(panel).toBeVisible()
    expect(await channelThreadRequestCount()).toBe(1)

    await panel.getByRole('button', { name: '加载更多频道消息串' }).click()
    await expect(panel.getByText('文档迁移', { exact: true })).toBeVisible()
    await expect
      .poll(() =>
        page.evaluate(() =>
          (globalThis as any).__chatThreadRequests.some(
            (request: any) =>
              request.method === 'GET' &&
              request.url === 'https://linux.do/chat/api/channels/7/threads?offset=1'
          )
        )
      )
      .toBe(true)

    const channelLoadsBeforeOpen = await page.evaluate(
      () =>
        (globalThis as any).__chatThreadRequests.filter((request: any) =>
          /\/chat\/api\/channels\/7\/messages(?:\?|$)/.test(request.url)
        ).length
    )
    await firstThreadLink.click()
    await expect(panel).toHaveCount(0)
    await expect(page.getByRole('region', { name: '消息串：发布方案讨论' })).toBeVisible()
    await expect(openButton).toHaveAccessibleName('查看频道消息串')
    expect(
      await page.evaluate(
        () =>
          (globalThis as any).__chatThreadRequests.filter((request: any) =>
            /\/chat\/api\/channels\/7\/messages(?:\?|$)/.test(request.url)
          ).length
      )
    ).toBe(channelLoadsBeforeOpen)
  })

  test('parses an official /chat/c/.../t/... URL as channel and thread ids', async ({ page }) => {
    await page.goto('/discourse.html')
    await page.locator('.toolbar-address input').fill('https://linux.do/chat/c/-/7/t/501/203')
    await page.getByRole('button', { name: '打开地址' }).click()

    await expect(page.locator('.chat-main-title')).toHaveText('产品交流')
    await expect(page.getByRole('region', { name: '消息串：发布方案讨论' })).toBeVisible()

    const requests = await page.evaluate(() => (globalThis as any).__chatThreadRequests)
    expect(
      requests.some(
        (request: any) =>
          request.method === 'GET' && request.url.endsWith('/chat/api/channels/7/threads/501')
      )
    ).toBe(true)
    expect(requests.some((request: any) => request.url.includes('/channels/501/messages'))).toBe(
      false
    )
  })
})
