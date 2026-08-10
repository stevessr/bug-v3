import { expect, test } from '@playwright/test'

test.describe('Discourse topic actions and private messages', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const requests: Array<{ url: string; method: string; body: string }> = []
      ;(globalThis as any).__topicActionRequests = requests
      ;(globalThis as any).__sharedTopic = null

      const steve = {
        id: 1,
        username: 'steve',
        name: 'Steve',
        avatar_template: '/user_avatar/linux.do/steve/{size}/100_2.gif'
      }
      const alice = {
        id: 2,
        username: 'alice',
        name: 'Alice',
        avatar_template: '/user_avatar/linux.do/alice/{size}/200_2.gif'
      }
      const bob = {
        id: 3,
        username: 'bob',
        name: 'Bob',
        avatar_template: '/user_avatar/linux.do/bob/{size}/300_2.gif'
      }
      const allowedUsers = [steve, alice]

      const makeTopic = () => ({
        id: 42,
        slug: 'private-reactions',
        archetype: 'private_message',
        title: '私信与反应测试',
        fancy_title: '私信与反应测试',
        posts_count: 2,
        highest_post_number: 2,
        views: 12,
        like_count: 9,
        created_at: '2026-08-10T01:00:00Z',
        can_assign: true,
        post_stream: {
          stream: [4201, 4202],
          posts: [
            {
              id: 4201,
              topic_id: 42,
              post_number: 1,
              username: 'steve',
              user_id: 1,
              name: 'Steve',
              avatar_template: steve.avatar_template,
              created_at: '2026-08-10T01:00:00Z',
              cooked: '<p>这是自己的帖子</p>',
              reply_count: 0,
              like_count: 1,
              can_assign: true,
              reactions: [{ id: 'heart', count: 1 }],
              reaction_users_count: 1
            },
            {
              id: 4202,
              topic_id: 42,
              post_number: 2,
              username: 'alice',
              user_id: 2,
              name: 'Alice',
              avatar_template: alice.avatar_template,
              created_at: '2026-08-10T01:05:00Z',
              cooked: '<p>这是可反应的帖子</p>',
              reply_count: 0,
              like_count: 4,
              can_assign: true,
              reactions: [
                { id: 'heart', count: 4 },
                { id: 'laughing', count: 3 },
                { id: 'tada', count: 2 },
                { id: 'eyes', count: 1 }
              ],
              reaction_users_count: 10
            }
          ]
        },
        details: {
          created_by: steve,
          participants: allowedUsers.map(user => ({ user, post_count: 1 })),
          allowed_users: [...allowedUsers],
          allowed_groups: [],
          can_invite_to: true,
          can_remove_allowed_users: true,
          can_assign: true,
          notification_level: 1
        },
        suggested_topics: [],
        related_topics: []
      })

      Object.defineProperty(navigator, 'share', {
        configurable: true,
        value: async (payload: any) => {
          ;(globalThis as any).__sharedTopic = payload
        }
      })

      const runtime = {
        lastError: null,
        sendMessage(request: any, callback: (response: any) => void) {
          if (request.type === 'GET_LINUX_DO_USER') {
            queueMicrotask(() => callback({ success: true, user: steve }))
            return
          }
          if (request.type === 'GET_DISCOURSE_ICON_SPRITE') {
            queueMicrotask(() => callback({ success: true, data: { symbols: [] } }))
            return
          }
          if (request.type === 'GET_DISCOURSE_SITE_SETTINGS') {
            queueMicrotask(() =>
              callback({
                success: true,
                settings: {
                  discourse_reactions_enabled: true,
                  discourse_reactions_enabled_reactions: 'heart|laughing|tada',
                  discourse_reactions_reaction_for_like: 'heart',
                  discourse_reactions_allow_any_emoji: false
                }
              })
            )
            return
          }

          const url = String(request?.options?.url || '')
          const method = String(request?.options?.method || 'GET').toUpperCase()
          const body = String(request?.options?.body || '')
          if (request.type === 'PAGE_FETCH') requests.push({ url, method, body })

          const parsed = new URL(url || 'https://linux.do/')
          let data: any = {}
          if (parsed.pathname === '/latest.json') {
            data = { topic_list: { topics: [] }, users: [] }
          } else if (
            parsed.pathname === '/categories.json' ||
            parsed.pathname === '/categories_and_latest.json'
          ) {
            data = { category_list: { categories: [] } }
          } else if (parsed.pathname === '/t/42.json') {
            data = makeTopic()
          } else if (parsed.pathname === '/t/42/view-stats.json') {
            data = { views: [{ count: 12 }], users: [{ count: 2 }] }
          } else if (parsed.pathname === '/search.json') {
            data = { posts: [], topics: [], users: [] }
          } else if (parsed.pathname === '/emojis.json') {
            data = {
              smileys: [
                { id: 'heart', name: 'heart', url: '/images/emoji/twitter/heart.png' },
                { id: 'laughing', name: 'laughing', url: '/images/emoji/twitter/laughing.png' }
              ],
              celebrations: [{ id: 'tada', name: 'tada', url: '/images/emoji/twitter/tada.png' }],
              extras: [{ id: 'eyes', name: 'eyes', url: '/images/emoji/twitter/eyes.png' }]
            }
          } else if (parsed.pathname === '/u/bob.json') {
            data = { user: bob }
          } else if (parsed.pathname === '/t/42/invite' && method === 'POST') {
            if (!allowedUsers.some(user => user.username === 'bob')) allowedUsers.push(bob)
            data = { user: bob }
          } else if (parsed.pathname === '/t/42/remove-allowed-user' && method === 'PUT') {
            const username = new URLSearchParams(body).get('username')
            const index = allowedUsers.findIndex(user => user.username === username)
            if (index >= 0) allowedUsers.splice(index, 1)
            data = { success: 'OK' }
          } else if (parsed.pathname === '/assign/assign' && method === 'PUT') {
            data = { success: 'OK' }
          } else if (
            parsed.pathname === '/discourse-reactions/posts/4202/reactions-users-list.json'
          ) {
            data = {
              users: [
                {
                  ...bob,
                  reaction: parsed.searchParams.get('reaction_value') || 'heart'
                }
              ],
              total_rows: 1
            }
          } else if (parsed.pathname === '/topics/timings' && method === 'POST') {
            data = { success: 'OK' }
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
        Object.defineProperty(globalThis, 'chrome', { configurable: true, value: chromeApi })
      }
    })
  })

  const openTopic = async (page: import('@playwright/test').Page) => {
    await page.goto('/discourse.html')
    await page.locator('.toolbar-address input').fill('https://linux.do/t/private-reactions/42')
    await page.getByRole('button', { name: '打开地址' }).click()
    await expect(page.getByRole('heading', { name: '私信与反应测试' })).toBeVisible()
  }

  test('limits reactions, blocks own-post reactions, and opens detailed statistics', async ({
    page
  }) => {
    await openTopic(page)

    const ownPost = page.locator('[data-post-number="1"]')
    const otherPost = page.locator('[data-post-number="2"]')
    await expect(ownPost.locator('.reaction-item--add')).toHaveCount(0)
    await expect(
      otherPost.locator('.reaction-item:not(.reaction-item--total):not(.reaction-item--add)')
    ).toHaveCount(3)
    await expect(otherPost.locator('.reaction-item--total')).toHaveText('共 10')
    await expect(otherPost.getByLabel(/:eyes:/)).toHaveCount(0)

    await otherPost.getByLabel(/:heart: 共 4 次/).click()
    const details = page.getByRole('dialog', { name: ':heart: 反应详情' })
    await expect(details.getByText('@bob')).toBeVisible()
    await expect
      .poll(() =>
        page.evaluate(() =>
          (globalThis as any).__topicActionRequests.some(
            (request: any) =>
              request.url.includes('/discourse-reactions/posts/4202/reactions-users-list.json?') &&
              request.url.includes('reaction_value=heart')
          )
        )
      )
      .toBe(true)
    await page.locator('.reaction-details-modal-wrap .ant-modal-close').click()
    await expect(details).toBeHidden()

    await otherPost.getByLabel('从站点表情中选择反应').click()
    const picker = page.getByRole('dialog', { name: '选择反应' })
    await expect(picker).toBeVisible()
    await expect(picker.getByRole('heading', { name: 'smileys' })).toBeVisible()
    await expect(picker.getByRole('heading', { name: 'celebrations' })).toBeVisible()
    await expect(picker.getByLabel(':eyes:')).toHaveCount(0)
    await expect
      .poll(() => picker.evaluate(element => Number(getComputedStyle(element).zIndex)))
      .toBeGreaterThan(2_000_000_000)
  })

  test('uses the official Post assignment payload and shares the canonical topic URL', async ({
    page
  }) => {
    await openTopic(page)
    page.once('dialog', dialog => void dialog.accept('bob'))

    const secondPost = page.locator('[data-post-number="2"]')
    await secondPost.getByTitle('帖子管理员操作').click()
    await page.getByRole('menuitem', { name: '指定' }).click()

    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (globalThis as any).__topicActionRequests.find((request: any) =>
              request.url.endsWith('/assign/assign')
            )?.body
        )
      )
      .toBe(JSON.stringify({ username: 'bob', target_id: 4202, target_type: 'Post' }))

    await page.getByRole('button', { name: /分\s*享/ }).click()
    await expect
      .poll(() => page.evaluate(() => (globalThis as any).__sharedTopic?.url))
      .toBe('https://linux.do/t/private-reactions/42')
  })

  test('shows participant count and adds or removes private-message users', async ({ page }) => {
    await openTopic(page)
    const panel = page.getByRole('region', { name: '私信参与者' })
    await expect(panel.getByText('2 人')).toBeVisible()

    await panel.getByLabel('新参与者用户名').fill('bob')
    await panel.getByRole('button', { name: '添加', exact: true }).click()
    await expect(panel.getByText('3 人')).toBeVisible()
    const invite = await page.evaluate(() =>
      (globalThis as any).__topicActionRequests.find((request: any) =>
        request.url.endsWith('/t/42/invite')
      )
    )
    expect(invite.method).toBe('POST')
    expect(new URLSearchParams(invite.body).get('user')).toBe('bob')

    page.once('dialog', dialog => void dialog.accept())
    await panel.getByRole('button', { name: '移除 @bob' }).click()
    await expect
      .poll(() =>
        page.evaluate(() =>
          (globalThis as any).__topicActionRequests.some(
            (request: any) =>
              request.url.endsWith('/t/42/remove-allowed-user') && request.method === 'PUT'
          )
        )
      )
      .toBe(true)
  })

  test('opens the custom right-click menu with current and new-tab actions', async ({ page }) => {
    await openTopic(page)
    await page.locator('[data-post-number="2"] .post-author-name').click({ button: 'right' })

    const menu = page.getByRole('menu', { name: '链接操作' })
    await expect(menu).toBeVisible()
    await expect(menu).toContainText('https://linux.do/u/alice')
    await expect(menu.getByRole('menuitem', { name: '在当前标签页打开' })).toBeVisible()
    await expect(menu.getByRole('menuitem', { name: '在新论坛标签页打开' })).toBeVisible()
    await expect(menu.getByRole('menuitem', { name: '在浏览器新标签页打开' })).toBeVisible()
  })
})
