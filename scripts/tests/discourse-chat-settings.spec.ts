import { expect, test } from '@playwright/test'

test.describe('Discourse chat channel settings', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const requestLog: Array<{ url: string; method: string; body: string }> = []
      ;(globalThis as any).__chatSettingsRequests = requestLog

      const membership = {
        id: 701,
        chat_channel_id: 7,
        following: true,
        muted: false,
        notification_level: 'mention',
        starred: false,
        unread_count: 3,
        last_read_message_id: 99,
        last_viewed_at: '2026-08-09T08:00:00Z',
        last_viewed_pins_at: null,
        has_unseen_pins: true
      }

      const channel: Record<string, any> = {
        id: 7,
        title: '产品交流',
        unicode_title: '产品交流',
        slug: 'product-chat',
        description: '分享产品进展',
        emoji: 'speech_balloon',
        chatable_type: 'Category',
        chatable_id: 12,
        chatable_url: '/c/product/12',
        chatable: { id: 12, name: '产品', slug: 'product' },
        status: 'open',
        auto_join_users: false,
        allow_channel_wide_mentions: true,
        threading_enabled: false,
        memberships_count: 2,
        pinned_messages_count: 1,
        total_messages: 42,
        archived_messages: 4,
        archive_completed: true,
        archive_failed: false,
        archive_topic_id: 88,
        last_message_id: 101,
        last_message_sent_at: '2026-08-09T08:00:00Z',
        current_user_membership: membership,
        meta: {
          can_moderate: true,
          can_remove_members: true,
          can_manage_pins: true,
          can_delete_self: true,
          can_delete_others: true,
          can_flag: true,
          can_join_chat_channel: true,
          user_silenced: false
        }
      }

      // `last_viewed_at` and unread state intentionally look newer than the
      // real last message. They must not pull an empty channel above channels
      // which actually have messages.
      const olderChannel: Record<string, any> = {
        ...channel,
        id: 18,
        title: '历史消息频道',
        unicode_title: '历史消息频道',
        slug: 'older-chat',
        last_message_id: 88,
        last_message_sent_at: '2026-08-08T08:00:00Z',
        current_user_membership: {
          ...membership,
          id: 718,
          chat_channel_id: 18,
          unread_count: 0,
          last_viewed_at: '2026-08-11T08:00:00Z'
        }
      }
      const emptyChannel: Record<string, any> = {
        ...channel,
        id: 19,
        title: '暂无消息频道',
        unicode_title: '暂无消息频道',
        slug: 'empty-chat',
        last_message_id: null,
        last_message_sent_at: null,
        last_message: null,
        current_user_membership: {
          ...membership,
          id: 719,
          chat_channel_id: 19,
          unread_count: 9,
          last_viewed_at: '2026-08-11T12:00:00Z'
        }
      }

      const users = [
        {
          id: 1,
          username: 'steve',
          name: 'Steve',
          avatar_template: '/letter_avatar_proxy/v4/letter/s/8491ac/{size}.png'
        },
        {
          id: 2,
          username: 'alice',
          name: 'Alice',
          avatar_template: '/letter_avatar_proxy/v4/letter/a/8491ac/{size}.png'
        }
      ]
      const groupMembership = {
        id: 801,
        chat_channel_id: 8,
        following: true,
        muted: false,
        notification_level: 'mention',
        starred: false,
        unread_count: 0
      }
      // No moderator flag is supplied: normal group-DM participants should
      // still be able to edit the group fields unless the API explicitly
      // denies it with can_edit_direct_channel: false.
      const groupChannel: Record<string, any> = {
        id: 8,
        title: '项目群聊',
        unicode_title: '项目群聊',
        slug: 'project-group',
        description: '多人协作讨论',
        emoji: 'speech_balloon',
        channelType: 'direct',
        chatable_type: 'DirectMessage',
        chatable: { id: 8, users, group: true },
        direct_message_users: users,
        status: 'open',
        threading_enabled: false,
        current_user_membership: groupMembership,
        meta: {}
      }
      const searchableUser = {
        id: 3,
        username: 'bob',
        name: 'Bob',
        avatar_template: '/letter_avatar_proxy/v4/letter/b/8491ac/{size}.png',
        can_chat: true,
        has_chat_enabled: true
      }
      const chatDisabledUser = {
        id: 4,
        username: 'eve',
        name: 'Eve',
        avatar_template: '/letter_avatar_proxy/v4/letter/e/8491ac/{size}.png',
        can_chat: true,
        has_chat_enabled: false
      }
      const chatPermissionFixture = {
        currentUser: {
          staff: true,
          can_chat: true,
          can_direct_message: true,
          has_chat_enabled: true
        },
        settings: {
          chat_enabled: true,
          enable_public_channels: true,
          max_chat_auto_joined_users: 100
        }
      }
      ;(globalThis as any).__chatPermissionFixture = chatPermissionFixture

      const readChannelForm = (body: string) => {
        const params = new URLSearchParams(body)
        const result: Record<string, any> = {}
        for (const [key, value] of params.entries()) {
          const match = key.match(/^channel\[(.+)]$/)
          if (!match) continue
          result[match[1]] = value === 'true' ? true : value === 'false' ? false : value
        }
        return result
      }

      const runtime = {
        lastError: null,
        sendMessage(request: any, callback: (response: any) => void) {
          if (request.type === 'GET_LINUX_DO_USER') {
            queueMicrotask(() =>
              callback({
                success: true,
                user: { ...users[0], ...chatPermissionFixture.currentUser }
              })
            )
            return
          }
          if (request.type === 'GET_DISCOURSE_SITE_SETTINGS') {
            const settings = Object.fromEntries(
              (request.keys || [])
                .filter((key: string) => key in chatPermissionFixture.settings)
                .map((key: string) => [
                  key,
                  chatPermissionFixture.settings[key as keyof typeof chatPermissionFixture.settings]
                ])
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

          if (url.includes('/chat/api/me/channels')) {
            data = {
              channels: [channel, olderChannel, emptyChannel],
              direct_message_channels: [groupChannel]
            }
          } else if (url.includes('/emojis.json')) {
            data = {
              emojis: {
                custom: [
                  {
                    id: 'party_blob',
                    name: 'party_blob',
                    url: 'https://cdn3.ldstatic.com/party_blob.png'
                  }
                ]
              }
            }
          } else if (url.includes('/chat/api/channels/7/messages')) {
            data = {
              messages: [
                {
                  id: 101,
                  cooked: '<p>欢迎进入产品频道</p>',
                  created_at: '2026-08-09T08:00:00Z',
                  chat_channel_id: 7,
                  user_id: 2,
                  username: 'alice',
                  user: users[1],
                  reactions: [],
                  blocks: []
                }
              ],
              meta: { can_load_more_past: false }
            }
          } else if (url.includes('/chat/api/channels/8/messages')) {
            data = { messages: [], meta: { can_load_more_past: false } }
          } else if (url.includes('/chat/api/channels/7/memberships?') && method === 'GET') {
            data = {
              memberships: users.map((user, index) => ({
                id: 701 + index,
                user,
                muted: index === 0 ? membership.muted : false,
                notification_level: index === 0 ? membership.notification_level : 'mention'
              })),
              meta: { total_rows: users.length }
            }
          } else if (url.endsWith('/chat/api/channels/7/memberships') && method === 'POST') {
            if (!users.some(user => user.id === searchableUser.id)) users.push(searchableUser)
            channel.memberships_count = users.length
            data = { success: 'OK' }
          } else if (url.endsWith('/chat/api/channels/7/memberships/2') && method === 'DELETE') {
            const index = users.findIndex(user => user.id === 2)
            if (index >= 0) users.splice(index, 1)
            channel.memberships_count = users.length
            data = { success: 'OK' }
          } else if (
            url.endsWith('/chat/api/channels/7/notifications-settings/me') &&
            method === 'PUT'
          ) {
            const parsed = body.startsWith('{')
              ? JSON.parse(body).notifications_settings
              : Object.fromEntries(
                  [...new URLSearchParams(body).entries()].map(([key, value]) => [
                    key.replace(/^notifications_settings\[|]$/g, ''),
                    value === 'true' ? true : value === 'false' ? false : value
                  ])
                )
            Object.assign(membership, parsed)
            data = { membership: { ...membership } }
          } else if (
            url.endsWith('/chat/api/channels/7/memberships/me/follows') &&
            method === 'DELETE'
          ) {
            membership.following = false
            data = { membership: { ...membership } }
          } else if (url.endsWith('/chat/api/channels/7/memberships/me') && method === 'POST') {
            membership.following = true
            data = { membership: { ...membership } }
          } else if (url.endsWith('/chat/api/channels/7/memberships/me') && method === 'PUT') {
            const parsed = body.startsWith('{')
              ? JSON.parse(body)
              : Object.fromEntries(new URLSearchParams(body).entries())
            membership.starred = parsed.starred === true || parsed.starred === 'true'
            data = { membership: { ...membership } }
          } else if (url.endsWith('/chat/api/channels/7/status') && method === 'PUT') {
            const parsed = body.startsWith('{')
              ? JSON.parse(body)
              : Object.fromEntries(new URLSearchParams(body).entries())
            channel.status = parsed.status
            data = { channel: { ...channel } }
          } else if (url.endsWith('/chat/api/channels/7') && method === 'PUT') {
            const parsed = body.startsWith('{') ? JSON.parse(body).channel : readChannelForm(body)
            Object.assign(channel, parsed)
            if (parsed.name) {
              channel.title = parsed.name
              channel.unicode_title = parsed.name
            }
            data = { channel: { ...channel } }
          } else if (url.endsWith('/chat/api/channels/8') && method === 'PUT') {
            // Group direct-message settings use their dedicated endpoint;
            // make the caller exercise its documented fallback sequence.
            ok = false
            status = 404
            data = { errors: ['频道不存在'] }
          } else if (url.endsWith('/chat/api/direct-message-channels/8') && method === 'PUT') {
            const parsed = body.startsWith('{') ? JSON.parse(body).channel : readChannelForm(body)
            Object.assign(groupChannel, parsed)
            if (parsed.name) {
              groupChannel.title = parsed.name
              groupChannel.unicode_title = parsed.name
            }
            data = { channel: { ...groupChannel } }
          } else if (url.endsWith('/chat/api/direct-message-channels') && method === 'POST') {
            const parsed = body.startsWith('{')
              ? JSON.parse(body)
              : {
                  target_usernames: new URLSearchParams(body).getAll('target_usernames[]'),
                  upsert: new URLSearchParams(body).get('upsert') === 'true',
                  name: new URLSearchParams(body).get('name') || undefined
                }
            const selectedUsers = [searchableUser, chatDisabledUser].filter(user =>
              parsed.target_usernames.includes(user.username)
            )
            data = {
              channel: {
                id: 9,
                title: parsed.name || selectedUsers.map(user => user.name).join(', '),
                channelType: 'direct',
                chatable_type: 'DirectMessage',
                direct_message_users: selectedUsers,
                current_user_membership: { chat_channel_id: 9, unread_count: 0 }
              }
            }
          } else if (url.endsWith('/chat/api/channels') && method === 'POST') {
            const parsed = body.startsWith('{') ? JSON.parse(body).channel : readChannelForm(body)
            data = {
              channel: {
                id: 10,
                title: parsed.name,
                unicode_title: parsed.name,
                channelType: 'public',
                chatable_type: 'Category',
                chatable_id: Number(parsed.chatable_id),
                chatable: { id: Number(parsed.chatable_id), name: '设计', slug: 'design' },
                description: parsed.description,
                slug: parsed.slug,
                emoji: parsed.emoji,
                auto_join_users: parsed.auto_join_users,
                threading_enabled: parsed.threading_enabled,
                current_user_membership: { chat_channel_id: 10, unread_count: 0 }
              }
            }
          } else if (url.includes('/chat/api/chatables')) {
            data = {
              users: [searchableUser, chatDisabledUser].map(user => ({
                identifier: `u-${user.id}`,
                model: user,
                type: 'user',
                match_quality: 1
              })),
              groups: []
            }
          } else if (url.includes('/latest')) {
            data = { topic_list: { topics: [] }, users: [] }
          } else if (url.includes('/categories')) {
            data = {
              category_list: {
                categories: [
                  {
                    id: 12,
                    name: '产品',
                    slug: 'product',
                    color: '0f6cbd',
                    text_color: 'ffffff',
                    topic_count: 3
                  },
                  {
                    id: 13,
                    name: '设计',
                    slug: 'design',
                    color: '8e44ad',
                    text_color: 'ffffff',
                    topic_count: 2
                  }
                ]
              }
            }
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

  const openSettings = async (page: import('@playwright/test').Page) => {
    await page.goto('/discourse.html')
    await page.locator('.toolbar-address input').fill('https://linux.do/chat')
    await page.getByRole('button', { name: '打开地址' }).click()
    await expect(page.locator('.chat-main-title')).toHaveText('产品交流')
    await page.getByRole('button', { name: /管理/ }).click()
    await expect(page.getByRole('dialog', { name: '产品交流' })).toBeVisible()
  }

  const openChat = async (page: import('@playwright/test').Page) => {
    await page.goto('/discourse.html')
    await page.locator('.toolbar-address input').fill('https://linux.do/chat')
    await page.getByRole('button', { name: '打开地址' }).click()
    await expect(page.locator('.chat-main-title')).toHaveText('产品交流')
  }

  test('keeps empty channels at the bottom and syncs the selected channel URL', async ({
    page
  }) => {
    await openChat(page)

    await expect(page.locator('[data-chat-channel-group="public"] .chat-channel-title')).toHaveText(
      ['产品交流', '历史消息频道', '暂无消息频道']
    )

    await page.getByRole('button', { name: '暂无消息频道' }).click()
    await expect(page.locator('.toolbar-address input')).toHaveValue(
      'https://linux.do/chat/c/empty-chat/19'
    )
    await expect(page.locator('.chat-main-title')).toHaveText('暂无消息频道')
  })

  test('creates permission-aware direct and public chat channels without refreshing', async ({
    page
  }) => {
    await openChat(page)

    await expect(page.getByRole('button', { name: '发起聊天' })).toBeVisible()
    await expect(page.getByRole('button', { name: '创建公开频道' })).toBeVisible()

    await page.getByRole('button', { name: '发起聊天' }).click()
    const directDialog = page.getByRole('dialog', { name: '发起聊天' })
    await expect(directDialog).toBeVisible()
    await directDialog.getByLabel('搜索用户（可选择一人或多人）').fill('bo')

    const bob = directDialog.locator('.chat-group-modal__result').filter({ hasText: '@bob' })
    const eve = directDialog.locator('.chat-group-modal__result').filter({ hasText: '@eve' })
    await expect(bob).toBeEnabled()
    await expect(eve).toBeDisabled()
    await expect(eve).toContainText('对方已关闭聊天')

    const chatablesRequest = await page.evaluate(() =>
      (globalThis as any).__chatSettingsRequests.find((request: any) =>
        request.url.includes('/chat/api/chatables')
      )
    )
    const chatablesUrl = new URL(chatablesRequest.url)
    expect(chatablesUrl.searchParams.get('term')).toBe('bo')
    expect(chatablesUrl.searchParams.has('filter')).toBe(false)
    expect(chatablesUrl.searchParams.get('include_users')).toBe('true')
    expect(chatablesUrl.searchParams.get('include_groups')).toBe('false')
    expect(chatablesUrl.searchParams.get('include_category_channels')).toBe('false')
    expect(chatablesUrl.searchParams.get('include_direct_message_channels')).toBe('false')

    await bob.click()
    await directDialog.getByRole('button', { name: /创建聊天.*1 人/ }).click()
    await expect(page.locator('.chat-main-title')).toHaveText('Bob')
    await expect(page.locator('.toolbar-address input')).toHaveValue('https://linux.do/chat/c/-/9')
    await expect(directDialog).toHaveCount(0)

    const directRequest = await page.evaluate(() =>
      (globalThis as any).__chatSettingsRequests.find(
        (request: any) =>
          request.url.endsWith('/chat/api/direct-message-channels') && request.method === 'POST'
      )
    )
    expect(JSON.parse(directRequest.body)).toEqual({
      target_usernames: ['bob'],
      upsert: true
    })

    await page.getByRole('button', { name: '创建公开频道' }).click()
    const publicDialog = page.getByRole('dialog', { name: '创建公开频道' })
    await publicDialog.getByLabel('所属分类').selectOption('13')
    await publicDialog.getByLabel('频道名称').fill('设计协作')
    await publicDialog.getByLabel('描述（可选）').fill('设计师与产品协作频道')
    await publicDialog.getByLabel('Slug（可选）').fill('design-chat')
    await publicDialog.getByLabel('频道表情（可选）').fill(':art:')
    await publicDialog.getByText('启用消息串', { exact: true }).click()
    await publicDialog.getByText('用户自动加入', { exact: true }).click()
    await publicDialog.getByRole('button', { name: '创建频道', exact: true }).click()

    await expect(page.locator('.chat-main-title')).toHaveText('设计协作')
    await expect(page.locator('.toolbar-address input')).toHaveValue(
      'https://linux.do/chat/c/design-chat/10'
    )
    await expect(publicDialog).toHaveCount(0)
    const publicRequest = await page.evaluate(() =>
      (globalThis as any).__chatSettingsRequests.find(
        (request: any) => request.url.endsWith('/chat/api/channels') && request.method === 'POST'
      )
    )
    expect(JSON.parse(publicRequest.body)).toEqual({
      channel: {
        name: '设计协作',
        chatable_id: 13,
        slug: 'design-chat',
        description: '设计师与产品协作频道',
        emoji: 'art',
        auto_join_users: true,
        threading_enabled: true
      }
    })
  })

  test('hides creation controls when the site disables chat', async ({ page }) => {
    await page.goto('/discourse.html')
    await page.evaluate(() => {
      ;(globalThis as any).__chatPermissionFixture.settings.chat_enabled = false
    })
    await page.locator('.toolbar-address input').fill('https://linux.do/chat')
    await page.getByRole('button', { name: '打开地址' }).click()
    await expect(page.locator('.chat-main-title')).toHaveText('产品交流')
    await expect(page.getByRole('button', { name: '发起聊天' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: '创建公开频道' })).toHaveCount(0)
  })

  test('shows and saves every channel and personal setting through the correct APIs', async ({
    page
  }) => {
    await openSettings(page)

    await expect(page.getByRole('tab', { name: '设置' })).toHaveAttribute('aria-selected', 'true')
    for (const label of [
      '将频道设为免打扰',
      '通知级别',
      '收藏频道',
      '关注频道',
      '标题',
      '描述',
      'Slug',
      '频道表情',
      '启用消息串',
      '用户自动加入',
      '允许全频道提及',
      '频道状态',
      '危险操作'
    ]) {
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible()
    }

    await page.locator('#chat-setting-name').fill('产品与设计')
    await page.locator('#chat-setting-description').fill('跟进产品和设计协作')
    await page.locator('#chat-setting-slug').fill('product-design')
    await page.getByRole('button', { name: '选择频道表情' }).click()
    const emojiPicker = page.getByRole('dialog', { name: '插入站点表情短码' })
    await expect(emojiPicker).toBeVisible()
    await emojiPicker.getByRole('button', { name: ':party_blob:' }).click()
    await expect(page.locator('#chat-setting-emoji')).toHaveValue('party_blob')
    await page.getByRole('switch', { name: '启用消息串' }).click()
    await page.getByRole('switch', { name: '用户自动加入' }).click()
    await page.getByRole('switch', { name: '允许全频道提及' }).click()
    await page.getByRole('button', { name: '保存频道信息' }).click()

    await expect
      .poll(async () => {
        return await page.evaluate(
          () =>
            (globalThis as any).__chatSettingsRequests.filter(
              (request: any) =>
                request.url.endsWith('/chat/api/channels/7') && request.method === 'PUT'
            ).length
        )
      })
      .toBe(1)

    const channelRequest = await page.evaluate(() =>
      (globalThis as any).__chatSettingsRequests.find(
        (request: any) => request.url.endsWith('/chat/api/channels/7') && request.method === 'PUT'
      )
    )
    const channelParams = new URLSearchParams(channelRequest.body)
    expect(channelParams.get('channel[name]')).toBe('产品与设计')
    expect(channelParams.get('channel[description]')).toBe('跟进产品和设计协作')
    expect(channelParams.get('channel[slug]')).toBe('product-design')
    expect(channelParams.get('channel[emoji]')).toBe('party_blob')
    expect(channelParams.get('channel[threading_enabled]')).toBe('true')
    expect(channelParams.get('channel[auto_join_users]')).toBe('true')
    expect(channelParams.get('channel[allow_channel_wide_mentions]')).toBe('false')

    const notificationRow = page.locator('.chat-settings-row').filter({ hasText: '通知级别' })
    const notificationSelect = notificationRow.getByRole('combobox', { name: '通知级别' })
    await notificationRow.locator('.ant-select-selector').click()
    await notificationSelect.press('ArrowUp')
    await notificationSelect.press('Enter')
    await expect
      .poll(async () => {
        return await page.evaluate(
          () =>
            (globalThis as any).__chatSettingsRequests.filter((request: any) =>
              request.url.endsWith('/notifications-settings/me')
            ).length
        )
      })
      .toBe(1)
    const levelRequest = await page.evaluate(
      () =>
        (globalThis as any).__chatSettingsRequests.filter((request: any) =>
          request.url.endsWith('/notifications-settings/me')
        )[0]
    )
    expect(JSON.parse(levelRequest.body)).toEqual({
      notifications_settings: { notification_level: 'always' }
    })

    await page.getByRole('switch', { name: '将频道设为免打扰' }).click()
    await expect
      .poll(async () => {
        return await page.evaluate(
          () =>
            (globalThis as any).__chatSettingsRequests.filter((request: any) =>
              request.url.endsWith('/notifications-settings/me')
            ).length
        )
      })
      .toBe(2)
    const muteRequest = await page.evaluate(
      () =>
        (globalThis as any).__chatSettingsRequests.filter((request: any) =>
          request.url.endsWith('/notifications-settings/me')
        )[1]
    )
    expect(JSON.parse(muteRequest.body)).toEqual({
      notifications_settings: { muted: true }
    })

    await page.getByRole('switch', { name: '收藏频道' }).click()
    await expect
      .poll(async () => {
        return await page.evaluate(() =>
          (globalThis as any).__chatSettingsRequests.some(
            (request: any) => request.url.endsWith('/memberships/me') && request.method === 'PUT'
          )
        )
      })
      .toBe(true)
    const starredRequest = await page.evaluate(() =>
      (globalThis as any).__chatSettingsRequests.find(
        (request: any) => request.url.endsWith('/memberships/me') && request.method === 'PUT'
      )
    )
    expect(JSON.parse(starredRequest.body)).toEqual({ starred: true })

    await page.getByRole('switch', { name: '关注频道' }).click()
    await expect
      .poll(async () => {
        return await page.evaluate(() =>
          (globalThis as any).__chatSettingsRequests.some(
            (request: any) =>
              request.url.endsWith('/memberships/me/follows') && request.method === 'DELETE'
          )
        )
      })
      .toBe(true)

    const statusRow = page.locator('.chat-settings-card').filter({ hasText: '频道状态' })
    const statusSelect = statusRow.getByRole('combobox')
    await statusRow.locator('.ant-select-selector').click()
    await statusSelect.press('ArrowDown')
    await statusSelect.press('Enter')
    await expect
      .poll(async () => {
        return await page.evaluate(() =>
          (globalThis as any).__chatSettingsRequests.some((request: any) =>
            request.url.endsWith('/chat/api/channels/7/status')
          )
        )
      })
      .toBe(true)
    const statusRequest = await page.evaluate(() =>
      (globalThis as any).__chatSettingsRequests.find((request: any) =>
        request.url.endsWith('/chat/api/channels/7/status')
      )
    )
    expect(JSON.parse(statusRequest.body)).toEqual({ status: 'closed' })
    await expect(page.locator('.toolbar-address input')).toHaveValue(
      'https://linux.do/chat/c/product-design/7'
    )
  })

  test('allows a group direct-message participant to edit every channel field', async ({
    page
  }) => {
    await openChat(page)
    await page.getByRole('tab', { name: /直接消息/ }).click()
    await page.getByRole('button', { name: '项目群聊' }).click()
    await expect(page.locator('.toolbar-address input')).toHaveValue(
      'https://linux.do/chat/c/project-group/8'
    )

    await page.getByRole('button', { name: /管理/ }).click()
    const dialog = page.getByRole('dialog', { name: '项目群聊' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('可编辑', { exact: true })).toBeVisible()
    await expect(dialog.locator('#chat-setting-name')).toBeEnabled()
    await expect(dialog.locator('#chat-setting-description')).toBeEnabled()
    await expect(dialog.locator('#chat-setting-slug')).toBeEnabled()
    await expect(dialog.locator('#chat-setting-emoji')).toBeEnabled()

    await dialog.locator('#chat-setting-name').fill('项目计划群')
    await dialog.locator('#chat-setting-description').fill('计划、设计和开发协作')
    await dialog.locator('#chat-setting-slug').fill('project-planning')
    await dialog.getByRole('button', { name: '选择频道表情' }).click()
    const emojiPicker = page.getByRole('dialog', { name: '插入站点表情短码' })
    await emojiPicker.getByRole('button', { name: ':party_blob:' }).click()
    await dialog.getByRole('switch', { name: '启用消息串' }).click()
    await dialog.getByRole('button', { name: '保存频道信息' }).click()

    await expect
      .poll(async () =>
        page.evaluate(() =>
          (globalThis as any).__chatSettingsRequests.some(
            (request: any) =>
              request.url.endsWith('/chat/api/direct-message-channels/8') &&
              request.method === 'PUT'
          )
        )
      )
      .toBe(true)
    const updateRequest = await page.evaluate(() =>
      (globalThis as any).__chatSettingsRequests.find(
        (request: any) =>
          request.url.endsWith('/chat/api/direct-message-channels/8') && request.method === 'PUT'
      )
    )
    const params = new URLSearchParams(updateRequest.body)
    expect(params.get('channel[name]')).toBe('项目计划群')
    expect(params.get('channel[description]')).toBe('计划、设计和开发协作')
    expect(params.get('channel[slug]')).toBe('project-planning')
    expect(params.get('channel[emoji]')).toBe('party_blob')
    expect(params.get('channel[threading_enabled]')).toBe('true')
    await expect(page.locator('.toolbar-address input')).toHaveValue(
      'https://linux.do/chat/c/project-planning/8'
    )
  })

  test('renders members, archive details, membership values, permissions, and raw JSON', async ({
    page
  }) => {
    await openSettings(page)

    await page.getByRole('tab', { name: /成员 2/ }).click()
    const membersRegion = page.getByRole('region', { name: '频道成员' })
    await expect(membersRegion.getByText('Steve（我）', { exact: true })).toBeVisible()
    await expect(membersRegion.getByText('Alice', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: '添加成员' }).click()
    await page.getByPlaceholder('搜索用户添加…').fill('bob')
    await page.locator('.chat-manage-modal__add-result').filter({ hasText: '@bob' }).click()
    await expect(membersRegion.getByText('Bob', { exact: true })).toBeVisible()
    const addRequest = await page.evaluate(() =>
      (globalThis as any).__chatSettingsRequests.find(
        (request: any) =>
          request.url.endsWith('/chat/api/channels/7/memberships') && request.method === 'POST'
      )
    )
    expect(JSON.parse(addRequest.body)).toEqual({ usernames: ['bob'] })

    await membersRegion.getByRole('button', { name: '移除 alice' }).click()
    const removeDialog = page.locator('.ant-modal-confirm').filter({ hasText: '移除成员' })
    await removeDialog.getByRole('button', { name: /移\s*除/ }).click()
    await expect(membersRegion.getByText('Alice', { exact: true })).toHaveCount(0)
    await expect
      .poll(async () => {
        return await page.evaluate(() =>
          (globalThis as any).__chatSettingsRequests.some(
            (request: any) =>
              request.url.endsWith('/chat/api/channels/7/memberships/2') &&
              request.method === 'DELETE'
          )
        )
      })
      .toBe(true)

    await page.getByRole('tab', { name: '信息' }).click()
    await expect(page.getByText('频道标识', { exact: true })).toBeVisible()
    await expect(page.getByText('功能与状态', { exact: true })).toBeVisible()
    await expect(page.getByText('历史与归档', { exact: true })).toBeVisible()
    await expect(page.getByText('我的成员资料', { exact: true })).toBeVisible()
    await expect(page.getByText('当前权限', { exact: true })).toBeVisible()
    await expect(page.getByText('总消息数', { exact: true })).toBeVisible()
    await expect(page.getByText('42', { exact: true })).toBeVisible()
    await expect(page.getByText('can_manage_pins', { exact: true })).toBeVisible()
    await expect(page.getByText('查看完整频道 JSON', { exact: true })).toBeVisible()
  })

  test('keeps the complete settings panel inside a mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await openSettings(page)

    const panel = page.getByRole('dialog', { name: '产品交流' })
    const box = await panel.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.x).toBeGreaterThanOrEqual(0)
    expect(box!.x + box!.width).toBeLessThanOrEqual(390)
    expect(box!.y + box!.height).toBeLessThanOrEqual(844)
    await expect(page.getByRole('tab', { name: '设置' })).toBeVisible()
    await expect(page.getByRole('button', { name: '完成' })).toBeVisible()
  })

  test('confirms leave and delete actions and calls their dedicated endpoints', async ({
    page
  }) => {
    await openSettings(page)
    await page.getByRole('button', { name: '退出频道', exact: true }).click()
    const leaveDialog = page.locator('.ant-modal-confirm').filter({ hasText: '退出频道' })
    await leaveDialog.getByRole('button', { name: /退\s*出/ }).click()
    await expect
      .poll(async () => {
        return await page.evaluate(() =>
          (globalThis as any).__chatSettingsRequests.some(
            (request: any) =>
              request.url.endsWith('/chat/api/channels/7/memberships/me') &&
              request.method === 'DELETE'
          )
        )
      })
      .toBe(true)
    await expect(page.getByRole('dialog', { name: '产品交流' })).toHaveCount(0)

    await openSettings(page)
    await page.getByRole('button', { name: '删除频道', exact: true }).click()
    const deleteDialog = page.locator('.ant-modal-confirm').filter({ hasText: '删除频道' })
    await deleteDialog.getByRole('button', { name: /删\s*除/ }).click()
    await expect
      .poll(async () => {
        return await page.evaluate(() =>
          (globalThis as any).__chatSettingsRequests.some(
            (request: any) =>
              request.url.endsWith('/chat/api/channels/7') && request.method === 'DELETE'
          )
        )
      })
      .toBe(true)
    await expect(page.getByRole('dialog', { name: '产品交流' })).toHaveCount(0)
  })

  test('opens MD3 floating chat and lets channel categories collapse with spacing', async ({
    page
  }) => {
    await page.goto('/discourse.html')
    await page.getByRole('button', { name: '打开聊天悬浮窗' }).click()

    const floating = page.locator('.floating-chat')
    await expect(floating).toBeVisible()
    await expect(floating.getByText('Discourse Chat')).toBeVisible()
    await expect(
      floating.locator('.chat-channel-item').filter({ hasText: '产品交流' })
    ).toContainText('产品交流')

    const section = floating.locator('.chat-channel-section').filter({ hasText: '频道' })
    await expect(section).toHaveAttribute('aria-expanded', 'true')
    await expect
      .poll(() =>
        floating.locator('.chat-channel-list').evaluate(element => getComputedStyle(element).gap)
      )
      .toBe('14px')

    await section.click()
    await expect(section).toHaveAttribute('aria-expanded', 'false')
    await expect(floating.locator('.chat-channel-item')).toHaveCount(0)

    await section.click()
    await expect(
      floating.locator('.chat-channel-item').filter({ hasText: '产品交流' })
    ).toBeVisible()

    await floating.getByRole('button', { name: '最小化聊天' }).click()
    await expect(floating).toHaveClass(/is-minimized/)
    await expect(floating.locator('.floating-chat__body')).toBeHidden()
  })
})
