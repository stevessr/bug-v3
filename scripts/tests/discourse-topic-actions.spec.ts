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
      const interactionPermissions = { aliceCanChat: true }
      ;(globalThis as any).__interactionPermissions = interactionPermissions

      const makeTopic = () => {
        const title = String((globalThis as any).__topicActionTitle || '私信与反应测试')
        return {
          id: 42,
          slug: 'private-reactions',
          archetype: 'private_message',
          title,
          fancy_title: title,
          posts_count: 2,
          highest_post_number: 2,
          views: 12,
          like_count: 9,
          created_at: '2026-08-10T01:00:00Z',
          can_assign: true,
          valid_reactions: ['heart', 'laughing', 'tada'],
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
                cooked: String(
                  (globalThis as any).__topicActionSecondCooked ||
                    '<p>这是可反应的帖子</p><aside class="quote" data-post="1" data-topic="2561686"><div class="title">debug</div><blockquote><p>抱怀里就开始自动的响，不</p></blockquote></aside>'
                ),
                reply_count: 0,
                like_count: 4,
                can_assign: true,
                reactions: [
                  { id: 'heart', count: 4 },
                  { id: 'laughing', count: 3 },
                  { id: 'tada', count: 2 },
                  { id: 'eyes', count: 1 }
                ],
                reaction_users_count: 10,
                can_boost: true,
                boosts: [
                  {
                    id: 801,
                    cooked: '<p>自己的 Boost</p>',
                    can_delete: true,
                    can_flag: false,
                    user_flag_status: null,
                    user: steve
                  },
                  {
                    id: 802,
                    cooked: '<p>需要举报的 Boost</p>',
                    can_delete: false,
                    can_flag: true,
                    user_flag_status: null,
                    available_flags: ['spam', 'inappropriate'],
                    user: alice
                  }
                ]
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
            can_edit: true,
            can_assign: true,
            notification_level: 1
          },
          suggested_topics: [],
          related_topics: []
        }
      }

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
          } else if (
            parsed.pathname === '/t/2561686.json' ||
            parsed.pathname === '/t/2561686/1.json'
          ) {
            data = {
              id: 2561686,
              slug: 'quoted-topic',
              title: '被引用的主题',
              fancy_title: '被引用的主题',
              posts_count: 1,
              highest_post_number: 1,
              created_at: '2026-08-10T00:00:00Z',
              post_stream: {
                stream: [25616861],
                posts: [
                  {
                    id: 25616861,
                    topic_id: 2561686,
                    post_number: 1,
                    username: 'codeboom',
                    user_id: 4,
                    name: 'codeboom',
                    avatar_template: bob.avatar_template,
                    created_at: '2026-08-10T00:00:00Z',
                    cooked: '<p>被引用的原楼层</p>',
                    reply_count: 0,
                    like_count: 0
                  }
                ]
              },
              details: { created_by: bob },
              suggested_topics: [],
              related_topics: []
            }
          } else if (parsed.pathname === '/posts/by_number/2561686/1.json') {
            data = {
              id: 25616861,
              topic_id: 2561686,
              post_number: 1,
              cooked: '<p>这是被引用楼层的完整内容，含有更多上下文。</p>'
            }
          } else if (parsed.pathname === '/t/42' && method === 'PUT') {
            const payload = JSON.parse(body)
            data = { id: 42, title: payload.title, fancy_title: payload.title }
          } else if (parsed.pathname === '/t/42/view-stats.json') {
            data = { views: [{ count: 12 }], users: [{ count: 2 }] }
          } else if (parsed.pathname === '/search.json') {
            data = { posts: [], topics: [], users: [] }
          } else if (parsed.pathname === '/emojis.json') {
            data = {
              'smileys_&_emotion': [
                { id: 'heart', name: 'heart', url: '/images/emoji/twemoji/heart.png?v=15' },
                {
                  id: 'laughing',
                  name: 'laughing',
                  url: '/images/emoji/twemoji/laughing.png?v=15'
                }
              ],
              activities: [
                { id: 'tada', name: 'tada', url: '/images/emoji/twemoji/tada.png?v=15' }
              ],
              extras: [{ id: 'eyes', name: 'eyes', url: '/images/emoji/twemoji/eyes.png?v=15' }]
            }
          } else if (parsed.pathname === '/emojis/search-aliases.json') {
            data = { heart: ['love'], laughing: ['happy'], tada: ['party'] }
          } else if (parsed.pathname === '/discourse_templates' && method === 'GET') {
            data = {
              templates: [
                {
                  id: 900,
                  title: '问题反馈模板',
                  slug: 'issue-template',
                  content: '[b]问题描述[/b]\n\n环境：',
                  tags: ['反馈', 'bug'],
                  usages: 4
                },
                {
                  id: 901,
                  title: '功能建议模板',
                  slug: 'feature-template',
                  content: '目标用户：\n期望行为：',
                  tags: ['建议'],
                  usages: 2
                }
              ]
            }
          } else if (parsed.pathname === '/discourse_templates/900/use' && method === 'POST') {
            data = { id: 900, usages: 5 }
          } else if (parsed.pathname === '/site.json') {
            data = {
              post_action_types: [
                {
                  id: 3,
                  name_key: 'spam',
                  name: '垃圾广告',
                  description: '垃圾广告或恶意推广',
                  is_flag: true,
                  enabled: true,
                  require_message: false,
                  applies_to: ['DiscourseBoosts::Boost']
                },
                {
                  id: 4,
                  name_key: 'inappropriate',
                  name: '不当内容',
                  description: '违反社区规范',
                  is_flag: true,
                  enabled: true,
                  require_message: true,
                  applies_to: ['DiscourseBoosts::Boost']
                }
              ]
            }
          } else if (parsed.pathname === '/u/alice/card.json') {
            data = {
              user: {
                ...alice,
                title: '测试用户',
                bio_cooked: '<p>Alice 的简介</p>',
                location: '香港',
                can_send_private_messages: true,
                can_send_private_message_to_user: true,
                can_chat_user: interactionPermissions.aliceCanChat,
                can_follow: true,
                is_followed: false,
                total_followers: 12,
                total_following: 7
              }
            }
          } else if (parsed.pathname === '/u/alice.json') {
            data = {
              user: {
                ...alice,
                trust_level: 2,
                created_at: '2025-01-01T00:00:00Z',
                title: '测试用户',
                bio_cooked: '<p>Alice 的简介</p>',
                can_send_private_messages: true,
                can_send_private_message_to_user: true,
                can_chat_user: interactionPermissions.aliceCanChat,
                can_follow: true,
                is_followed: false,
                total_followers: 12,
                total_following: 7,
                profile_background_upload_url:
                  '//cdn3.ldstatic.com/original/4X/alice-profile-background.png'
              }
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
            parsed.pathname ===
              '/discourse-reactions/posts/4202/custom-reactions/tada/toggle.json' &&
            method === 'PUT'
          ) {
            data = {
              reactions: [
                { id: 'heart', count: 4 },
                { id: 'laughing', count: 3 },
                { id: 'tada', count: 3, reacted: true },
                { id: 'eyes', count: 1 }
              ],
              current_user_reaction: { id: 'tada', type: 'emoji' },
              reaction_users_count: 11
            }
          } else if (
            parsed.pathname === '/discourse-boosts/posts/4202/boosts' &&
            method === 'POST'
          ) {
            data = {
              id: 803,
              cooked: `<p>${body ? JSON.parse(body).raw : ''}</p>`,
              can_delete: true,
              can_flag: false,
              user_flag_status: null,
              user: steve
            }
          } else if (parsed.pathname === '/discourse-boosts/boosts/801' && method === 'DELETE') {
            data = { success: 'OK' }
          } else if (
            parsed.pathname === '/discourse-boosts/boosts/802/flags' &&
            method === 'POST'
          ) {
            data = { success: 'OK' }
          } else if (parsed.pathname === '/follow/alice.json' && method === 'PUT') {
            data = { success: 'OK' }
          } else if (
            parsed.pathname === '/discourse-reactions/posts/4202/reactions-users-list.json'
          ) {
            const requestedReaction = parsed.searchParams.get('reaction_value')
            data = {
              users: requestedReaction
                ? [{ ...bob, reaction: requestedReaction }]
                : [
                    { ...bob, reaction: 'heart' },
                    { ...steve, reaction: 'laughing' },
                    { ...alice, reaction: 'tada' },
                    { ...bob, reaction: 'eyes' }
                  ],
              total_rows: requestedReaction ? 1 : 10
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

  const selectPostText = async (page: import('@playwright/test').Page, text: string) => {
    await page.locator('[data-post-number="2"] .post-content').evaluate((element, selectedText) => {
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
      let node: Text | null = walker.nextNode() as Text | null
      while (node) {
        const start = node.data.indexOf(String(selectedText))
        if (start >= 0) {
          const range = document.createRange()
          range.setStart(node, start)
          range.setEnd(node, start + String(selectedText).length)
          const selection = window.getSelection()
          selection?.removeAllRanges()
          selection?.addRange(range)
          return
        }
        node = walker.nextNode() as Text | null
      }
      throw new Error(`Could not select ${String(selectedText)}`)
    }, text)
  }

  test('renders forum emoji shortcodes inline in topic titles', async ({ page }) => {
    await page.goto('/discourse.html')
    await page.evaluate(() => {
      ;(globalThis as any).__topicActionTitle = ':heart: 标题内联表情'
    })
    await page.locator('.toolbar-address input').fill('https://linux.do/t/private-reactions/42')
    await page.getByRole('button', { name: '打开地址' }).click()

    const title = page.locator('.topic-header__title')
    const emoji = title.locator('img.emoji-inline[alt="heart"]')
    await expect(title).toContainText('标题内联表情')
    await expect(emoji).toHaveAttribute(
      'src',
      'https://cdn.ldstatic.com/images/emoji/twemoji/heart.png?v=15'
    )
    await expect(emoji).toHaveCSS('display', 'inline-block')
    await expect(title.locator('.discourse-emoji-title > div')).toHaveCount(0)
  })

  test('renders the allow-listed Spotify player but drops arbitrary iframes', async ({ page }) => {
    await page.addInitScript(() => {
      ;(globalThis as any).__topicActionSecondCooked =
        '<p>音乐：</p><iframe src="https://open.spotify.com/embed/track/45h9XBwzKkxYucjgfV0Fts"></iframe><iframe src="https://example.test/embed/unsafe"></iframe>'
    })
    await openTopic(page)

    const post = page.locator('[data-post-number="2"] .post-content')
    const spotify = post.locator('iframe.spotify-embed')
    await expect(spotify).toHaveCount(1)
    await expect(spotify).toHaveAttribute(
      'src',
      'https://open.spotify.com/embed/track/45h9XBwzKkxYucjgfV0Fts'
    )
    await expect(spotify).toHaveAttribute('loading', 'lazy')
    await expect(post.locator('iframe[src*="example.test"]')).toHaveCount(0)
  })

  test('expands quoted posts, jumps to their topic, and quotes selected post text', async ({
    page
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: async (value: string) => {
            ;(globalThis as any).__copiedTopicQuote = value
          }
        }
      })
    })
    await openTopic(page)

    const post = page.locator('[data-post-number="2"]')
    const quote = post.locator('aside.quote')
    const expand = quote.locator('button.quote-toggle')
    await expect(quote.getByRole('button', { name: '跳转到引用的第 1 楼' })).toBeVisible()
    await expect(expand).toHaveText('⌄')

    await expand.click()
    await expect(quote).toHaveAttribute('data-expanded', 'true')
    await expect(expand).toHaveAttribute('aria-label', '收起完整引用')
    await expect(expand).toHaveText('⌃')
    await expect(quote).toContainText('这是被引用楼层的完整内容，含有更多上下文。')
    await expect
      .poll(() =>
        page.evaluate(() =>
          (globalThis as any).__topicActionRequests.some((request: any) =>
            request.url.endsWith('/posts/by_number/2561686/1.json')
          )
        )
      )
      .toBe(true)

    await expand.click()
    await expect(quote).toHaveAttribute('data-expanded', 'false')
    await expect(expand).toHaveAttribute('aria-label', '展开完整引用')
    await expect(quote).toContainText('抱怀里就开始自动的响，不')

    await selectPostText(page, '这是可反应的帖子')
    await post.locator('.post-content').dispatchEvent('contextmenu', {
      button: 2,
      clientX: 160,
      clientY: 180
    })
    const selectionMenu = page.getByRole('menu', { name: '文字操作' })
    await expect(selectionMenu.getByRole('menuitem', { name: '引用到回复' })).toBeVisible()
    await expect(selectionMenu.getByRole('menuitem', { name: '复制引用' })).toBeVisible()
    await selectionMenu.getByRole('menuitem', { name: '复制引用' }).click()
    await expect
      .poll(() => page.evaluate(() => (globalThis as any).__copiedTopicQuote || ''))
      .toBe('[quote="alice, post:2, topic:42, username:alice"]\n这是可反应的帖子\n[/quote]')

    await selectPostText(page, '这是可反应的帖子')
    await post.locator('.post-content').dispatchEvent('contextmenu', {
      button: 2,
      clientX: 160,
      clientY: 180
    })
    await page
      .getByRole('menu', { name: '文字操作' })
      .getByRole('menuitem', { name: '引用到回复' })
      .click()
    const composer = page.locator('.floating-composer')
    await expect(composer).toBeVisible()
    await expect(composer.locator('textarea')).toHaveValue(
      '[quote="alice, post:2, topic:42, username:alice"]\n这是可反应的帖子\n[/quote]'
    )

    await composer.getByRole('button', { name: '关闭回复编辑器' }).click()
    await expect(composer).toBeHidden()
    await quote.getByRole('button', { name: '跳转到引用的第 1 楼' }).click()
    await expect(page.getByRole('heading', { name: '被引用的主题' })).toBeVisible()
    await expect(page.locator('.toolbar-address input')).toHaveValue('https://linux.do/t/2561686/1')
  })

  test('groups every reaction, blocks own-post reactions, and opens detailed statistics', async ({
    page
  }) => {
    await openTopic(page)

    const ownPost = page.locator('[data-post-number="1"]')
    const otherPost = page.locator('[data-post-number="2"]')
    await expect(ownPost.locator('.reaction-item--add')).toHaveCount(0)
    await expect(
      otherPost.locator('.reaction-item:not(.reaction-item--total):not(.reaction-item--add)')
    ).toHaveCount(4)
    await expect(otherPost.locator('.reaction-item--total')).toHaveText('共 10')
    await expect(otherPost.getByLabel(/:eyes: 共 1 次/)).toHaveCount(1)

    await otherPost.getByLabel(/:heart: 共 4 次/).click()
    const details = page.getByRole('dialog', { name: ':heart: 反应详情' })
    await expect(details.getByText('@bob')).toBeVisible()
    await expect(details.locator('.reaction-details-popover__summary-title img')).toHaveAttribute(
      'src',
      'https://cdn.ldstatic.com/images/emoji/twemoji/heart.png?v=15'
    )
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

    await otherPost.getByLabel('查看全部 10 人次反应').click()
    const groupedDetails = page.getByRole('dialog', { name: '全部反应 反应详情' })
    await expect(groupedDetails.locator('.reaction-details-popover__group')).toHaveCount(4)
    await expect(groupedDetails.getByText(':heart:', { exact: true })).toBeVisible()
    await expect(groupedDetails.getByText(':laughing:', { exact: true })).toBeVisible()
    await expect(groupedDetails.getByText(':tada:', { exact: true })).toBeVisible()
    await expect(groupedDetails.getByText(':eyes:', { exact: true })).toBeVisible()
    await expect(groupedDetails.getByText('@steve')).toBeVisible()
    await groupedDetails.getByRole('button', { name: '关闭' }).click()

    await otherPost.getByLabel('从站点表情中选择反应').click()
    const picker = page.getByRole('dialog', { name: '选择反应' })
    await expect(picker).toBeVisible()
    await expect(picker.getByRole('heading', { name: '笑脸与情感' })).toBeVisible()
    await expect(picker.getByRole('heading', { name: '活动' })).toBeVisible()
    await expect(picker.getByLabel(':eyes:')).toHaveCount(0)
    await expect
      .poll(() => picker.evaluate(element => Number(getComputedStyle(element).zIndex)))
      .toBeGreaterThan(2_000_000_000)

    await picker.getByLabel(':tada:').click()
    await expect
      .poll(() =>
        page.evaluate(() =>
          (globalThis as any).__topicActionRequests.some(
            (request: any) =>
              request.url.endsWith(
                '/discourse-reactions/posts/4202/custom-reactions/tada/toggle.json'
              ) && request.method === 'PUT'
          )
        )
      )
      .toBe(true)
    await expect(otherPost.getByLabel(/:tada: 共 3 次/)).toHaveClass(/active/)
  })

  test('edits a permitted topic title without reloading the topic', async ({ page }) => {
    await openTopic(page)
    const before = await page.evaluate(
      () =>
        (globalThis as any).__topicActionRequests.filter((request: any) =>
          request.url.endsWith('/t/42.json')
        ).length
    )

    await page.getByRole('button', { name: '编辑话题标题' }).click()
    const input = page.getByRole('textbox', { name: '话题标题' })
    await input.fill('修改后的标题')
    await page.getByRole('button', { name: '保存', exact: true }).click()
    await expect(page.getByRole('heading', { name: '修改后的标题' })).toBeVisible()

    const update = await page.evaluate(() =>
      (globalThis as any).__topicActionRequests.find(
        (request: any) => request.url.endsWith('/t/42') && request.method === 'PUT'
      )
    )
    expect(JSON.parse(update.body)).toEqual({
      title: '修改后的标题',
      original_title: '私信与反应测试'
    })
    expect(
      await page.evaluate(
        () =>
          (globalThis as any).__topicActionRequests.filter((request: any) =>
            request.url.endsWith('/t/42.json')
          ).length
      )
    ).toBe(before)
  })

  test('portals reply composer menus without changing the editor layout', async ({ page }) => {
    await openTopic(page)

    const otherPost = page.locator('[data-post-number="2"]')
    await otherPost.getByRole('button', { name: '回复 @alice 发布的帖子 #2' }).click()

    const composer = page.locator('.floating-composer')
    const editor = composer.locator('.prosemirror-editor-wrapper')
    await expect(composer).toBeVisible()
    await expect(editor).toBeVisible()
    const heightBefore = (await editor.boundingBox())?.height

    await composer.getByRole('button', { name: '论坛表情' }).click()
    const forumPicker = page.getByRole('dialog', { name: '论坛表情菜单' })
    await expect(forumPicker).toBeVisible()
    await expect(page.locator('.floating-composer .forum-emoji-menu')).toHaveCount(0)
    await expect(page.locator('body > .forum-emoji-menu')).toHaveCount(1)
    expect(
      Math.abs(((await editor.boundingBox())?.height || 0) - (heightBefore || 0))
    ).toBeLessThan(1)

    const pluginButton = composer.getByRole('button', { name: '插件表情' })
    await expect(pluginButton).toHaveText('🐟')
    await pluginButton.click()
    await expect(page.getByRole('dialog', { name: '插件表情菜单' })).toBeVisible()
    await expect(page.locator('.floating-composer .forum-emoji-menu')).toHaveCount(0)

    await composer.getByRole('button', { name: '高级语法' }).click()
    const advancedMenu = page.getByRole('menu', { name: '高级语法' })
    await expect(advancedMenu).toBeVisible()
    await expect(page.locator('.floating-composer .advanced-syntax-menu')).toHaveCount(0)
    await expect(page.locator('body > .advanced-syntax-menu')).toHaveCount(1)
  })

  test('loads, searches, and inserts a forum template without resizing the composer', async ({
    page
  }) => {
    await openTopic(page)

    const otherPost = page.locator('[data-post-number="2"]')
    await otherPost.getByRole('button', { name: '回复 @alice 发布的帖子 #2' }).click()

    const composer = page.locator('.floating-composer')
    const editor = composer.locator('.prosemirror-editor-wrapper')
    const textarea = composer.locator('textarea.prosemirror-editor-textarea')
    await textarea.fill('已有草稿')
    await textarea.focus()
    await textarea.evaluate(element => {
      const textareaElement = element as HTMLTextAreaElement
      textareaElement.setSelectionRange(4, 4)
    })
    const heightBefore = (await editor.boundingBox())?.height || 0

    await composer.getByRole('button', { name: '高级语法' }).click()
    await expect(page.getByRole('menu', { name: '高级语法' })).toBeVisible()
    await page
      .getByRole('menu', { name: '高级语法' })
      .getByRole('menuitem', { name: '插入论坛模板' })
      .click()

    const picker = page.getByRole('dialog', { name: '插入论坛模板' })
    await expect(picker).toBeVisible()
    await expect(picker.getByRole('textbox', { name: '搜索论坛模板' })).toBeVisible()
    await expect(picker.getByText('问题反馈模板', { exact: true })).toBeVisible()
    await expect(page.locator('.floating-composer .forum-template-picker')).toHaveCount(0)
    expect(Math.abs(((await editor.boundingBox())?.height || 0) - heightBefore)).toBeLessThan(1)

    await picker.getByRole('textbox', { name: '搜索论坛模板' }).fill('反馈')
    await expect(picker.getByText('问题反馈模板', { exact: true })).toBeVisible()
    await expect(picker.getByText('功能建议模板', { exact: true })).toHaveCount(0)
    await picker.getByRole('button', { name: '插入模板：问题反馈模板' }).click()

    await expect(textarea).toHaveValue('已有草稿\n\n[b]问题描述[/b]\n\n环境：')
    await expect(picker).toBeHidden()
    await expect
      .poll(() =>
        page.evaluate(() =>
          (globalThis as any).__topicActionRequests.some(
            (request: any) =>
              request.url.endsWith('/discourse_templates/900/use') && request.method === 'POST'
          )
        )
      )
      .toBe(true)

    await textarea.focus()
    await page.keyboard.press('Control+Shift+I')
    await expect(page.getByRole('dialog', { name: '插入论坛模板' })).toBeVisible()
  })

  test('makes forum templates available from the WYSIWYG advanced menu', async ({ page }) => {
    await openTopic(page)
    await page
      .locator('[data-post-number="2"]')
      .getByRole('button', { name: '回复 @alice 发布的帖子 #2' })
      .click()

    const composer = page.locator('.floating-composer')
    await composer.getByRole('button', { name: '所见即所得' }).click()
    const wysiwyg = composer.locator('.wysiwyg-editor')
    const content = wysiwyg.locator('.wysiwyg-editor-content')
    await content.click()
    await page.keyboard.type('当前草稿')

    await composer.getByRole('button', { name: '高级功能' }).click()
    const menu = page.getByRole('menu', { name: '高级功能' })
    await menu.getByRole('menuitem', { name: /论坛模板.*插入论坛可复用模板/ }).click()

    const picker = page.getByRole('dialog', { name: '插入论坛模板' })
    await expect(picker).toBeVisible()
    await picker.getByRole('button', { name: '插入模板：问题反馈模板' }).click()
    await expect(content).toContainText('问题描述')
    await expect(picker).toBeHidden()
  })

  test('keeps WYSIWYG extras in portal menus and creates Discourse helper blocks', async ({
    page
  }) => {
    await openTopic(page)
    await page
      .locator('[data-post-number="2"]')
      .getByRole('button', { name: '回复 @alice 发布的帖子 #2' })
      .click()

    const composer = page.locator('.floating-composer')
    await composer.getByRole('button', { name: '所见即所得' }).click()
    const wysiwyg = composer.locator('.wysiwyg-editor')
    const toolbar = composer.locator('.prosemirror-toolbar')
    await expect(wysiwyg).toBeVisible()
    const heightBefore = (await wysiwyg.boundingBox())?.height || 0

    await toolbar.getByRole('button', { name: '标题级别' }).click()
    const headingMenu = page.getByRole('menu', { name: '标题级别' })
    await expect(headingMenu).toBeVisible()
    await expect(wysiwyg.locator('.advanced-syntax-menu')).toHaveCount(0)
    await headingMenu.getByRole('menuitem', { name: /二级标题.*内容分段/ }).click()

    await toolbar.getByRole('button', { name: '高级功能' }).click()
    const advancedMenu = page.getByRole('menu', { name: '高级功能' })
    await expect(advancedMenu).toBeVisible()
    await expect(page.locator('body > .advanced-syntax-menu')).toHaveCount(1)
    expect(Math.abs(((await wysiwyg.boundingBox())?.height || 0) - heightBefore)).toBeLessThan(1)

    await advancedMenu.getByRole('menuitem', { name: /制表.*行列和表头辅助/ }).click()
    const tableDialog = page.locator('.editor-modal-card').filter({ hasText: '制表辅助' })
    await expect(tableDialog).toBeVisible()
    await tableDialog.getByRole('button', { name: '插入表格' }).click()
    await expect(wysiwyg.locator('table.wysiwyg-table-draft')).toHaveCount(1)

    await toolbar.getByRole('button', { name: '高级功能' }).click()
    await page
      .getByRole('menu', { name: '高级功能' })
      .getByRole('menuitem', { name: /详细信息/ })
      .click()
    const detailsBody = wysiwyg.locator('.wysiwyg-details-content')
    await expect(detailsBody).toBeVisible()
    expect((await detailsBody.boundingBox())?.height || 0).toBeGreaterThanOrEqual(20)

    await toolbar.getByRole('button', { name: '高级功能' }).click()
    await page
      .getByRole('menu', { name: '高级功能' })
      .getByRole('menuitem', { name: /剧透/ })
      .click()
    const spoiler = wysiwyg.locator('.wysiwyg-spoiler-draft')
    await spoiler.click()
    await page.keyboard.press('Enter')
    await expect(wysiwyg.locator('.wysiwyg-spoiler-draft')).toHaveCount(1)

    await toolbar.getByRole('button', { name: '高级功能' }).click()
    await page
      .getByRole('menu', { name: '高级功能' })
      .getByRole('menuitem', { name: /投票/ })
      .click()
    const pollDialog = page.locator('.editor-modal-card').filter({ hasText: 'Discourse 投票制作' })
    await pollDialog.locator('input').first().fill('要发布哪个方案？')
    await pollDialog.locator('textarea').first().fill('方案 A\n方案 B')
    await pollDialog.getByRole('button', { name: '插入投票' }).click()
    await expect(wysiwyg.locator('.discourse-poll-draft')).toHaveCount(1)

    await toolbar.getByRole('button', { name: '高级功能' }).click()
    await page
      .getByRole('menu', { name: '高级功能' })
      .getByRole('menuitem', { name: /公式/ })
      .click()
    const formulaDialog = page.locator('.editor-modal-card').filter({ hasText: '公式辅助' })
    await formulaDialog.locator('textarea').fill('a^2 + b^2 = c^2')
    await formulaDialog.getByRole('button', { name: '插入公式' }).click()
    await expect(wysiwyg.locator('.discourse-formula-draft')).toHaveCount(1)

    await composer.getByRole('button', { name: /^回\s*复$/ }).click()
    const raw = await page.evaluate(() => {
      const request = (globalThis as any).__topicActionRequests.find(
        (item: any) => item.method === 'POST' && new URL(item.url).pathname === '/posts'
      )
      return request ? new URLSearchParams(request.body).get('raw') : ''
    })
    expect(raw).toContain('[table]')
    expect(raw).toContain('[details="详细信息"]')
    expect(raw).toContain('[spoiler]')
    expect(raw).toContain('[poll type=regular results=always chartType=bar]')
    expect(raw).toContain('$a^2 + b^2 = c^2$')
    expect(raw).not.toContain('data-discourse-source')
  })

  test('updates Boosts in place, confirms delete, and submits a selected flag reason', async ({
    page
  }) => {
    await openTopic(page)
    const topicFetchCount = () =>
      page.evaluate(
        () =>
          (globalThis as any).__topicActionRequests.filter((request: any) =>
            request.url.endsWith('/t/42.json')
          ).length
      )
    const before = await topicFetchCount()
    const secondPost = page.locator('[data-post-number="2"]')

    await secondPost.getByRole('button', { name: '添加 Boost' }).click()
    const boostComposer = page.getByRole('dialog', { name: '添加 Boost' })
    const boostText = boostComposer.getByRole('textbox', { name: 'Boost 内容' })
    await boostText.fill('后台更新 Boost')
    await boostComposer.getByRole('button', { name: '插入站点表情短码' }).click()
    const emojiPicker = page.getByRole('dialog', { name: '插入站点表情短码' })
    await expect(emojiPicker).toBeVisible()
    await emojiPicker.getByRole('button', { name: ':heart:' }).click()
    await expect(boostComposer).toBeVisible()
    await expect(boostText).toHaveValue('后台更新 Boost :heart:')
    await secondPost.getByRole('button', { name: '发送 Boost' }).click()
    await expect(secondPost.getByText('后台更新 Boost')).toBeVisible()
    expect(await topicFetchCount()).toBe(before)

    await expect(secondPost.getByRole('button', { name: '删除 Boost' })).toHaveCount(0)
    await expect(secondPost.getByRole('button', { name: '举报 Boost' })).toHaveCount(0)
    await secondPost.locator('.boost-panel__item').filter({ hasText: '自己的 Boost' }).click()
    page.once('dialog', dialog => void dialog.accept())
    await secondPost.getByRole('button', { name: '删除 Boost' }).first().click()
    await expect(secondPost.getByText('自己的 Boost')).toHaveCount(0)
    expect(await topicFetchCount()).toBe(before)

    await secondPost.locator('.boost-panel__item').filter({ hasText: '需要举报的 Boost' }).click()
    await secondPost.getByRole('button', { name: '举报 Boost' }).click()
    const flagDialog = page.getByRole('dialog', { name: '举报 Boost' })
    await expect(flagDialog.getByText('垃圾广告', { exact: true })).toBeVisible()
    await flagDialog.getByLabel('举报补充说明').fill('这是一条测试举报')
    await flagDialog.getByRole('button', { name: '提交举报' }).click()

    const flagRequest = await page.evaluate(() =>
      (globalThis as any).__topicActionRequests.find((request: any) =>
        request.url.endsWith('/discourse-boosts/boosts/802/flags')
      )
    )
    const payload = new URLSearchParams(flagRequest.body)
    expect(payload.get('flag_type_id')).toBe('3')
    expect(payload.get('message')).toBe('这是一条测试举报')
    expect(payload.get('take_action')).toBe('false')
    expect(payload.get('queue_for_review')).toBe('false')
    expect(await topicFetchCount()).toBe(before)
  })

  test('opens an official-style user card and prefills a private message target', async ({
    page
  }) => {
    await openTopic(page)
    await page.locator('[data-post-number="2"] .post-author-avatar-button').click()

    const card = page.getByRole('dialog', { name: 'alice 的用户卡片' })
    await expect(card.getByText('Alice 的简介')).toBeVisible()
    await expect(card.getByRole('button', { name: '私信' })).toBeVisible()
    await expect(card.getByRole('button', { name: '聊天' })).toBeVisible()
    await expect(card.getByRole('button', { name: '关注', exact: true })).toBeVisible()

    await card.getByRole('button', { name: '关注', exact: true }).click()
    await expect(card.getByRole('button', { name: '已关注' })).toBeVisible()
    await card.getByRole('button', { name: '私信' }).click()
    await expect(page.getByText('新建私信', { exact: true })).toBeVisible()
    await expect(page.locator('.composer-recipient-chip')).toHaveText(/@alice/)
  })

  test('keeps private-message, chat, and follow actions on another user profile', async ({
    page
  }) => {
    await openTopic(page)
    await page.locator('[data-post-number="2"] .post-author-avatar-button').click()
    const card = page.getByRole('dialog', { name: 'alice 的用户卡片' })
    await card.getByRole('button', { name: '主页', exact: true }).click()

    const profile = page.locator('.user-profile')
    await expect(profile.getByRole('button', { name: '私信' })).toBeVisible()
    await expect(profile.getByRole('button', { name: '聊天' })).toBeVisible()
    await expect(profile.getByRole('button', { name: '关注', exact: true })).toBeVisible()
    await expect(profile.locator('.user-profile-header')).toHaveCSS(
      'background-image',
      /cdn3\.ldstatic\.com\/original\/4X\/alice-profile-background\.png/
    )
  })

  test('does not offer chat when the other user has disabled it', async ({ page }) => {
    await openTopic(page)
    await page.evaluate(() => {
      ;(globalThis as any).__interactionPermissions.aliceCanChat = false
    })
    await page.locator('[data-post-number="2"] .post-author-avatar-button').click()

    const card = page.getByRole('dialog', { name: 'alice 的用户卡片' })
    await expect(card.getByRole('button', { name: '私信' })).toBeVisible()
    await expect(card.getByRole('button', { name: '聊天' })).toHaveCount(0)

    await card.getByRole('button', { name: '主页', exact: true }).click()
    const profile = page.locator('.user-profile')
    await expect(profile.getByRole('button', { name: '私信' })).toBeVisible()
    await expect(profile.getByRole('button', { name: '聊天' })).toHaveCount(0)
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
    await expect(
      panel.locator('xpath=ancestor::aside[contains(@class, "topic-aside")]')
    ).toHaveCount(1)

    await expect(panel.getByRole('button', { name: /参与者 2 人/ })).toHaveAttribute(
      'aria-expanded',
      'false'
    )
    await panel.getByRole('button', { name: /参与者 2 人/ }).click()
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

    // The topic refresh after inviting reinstates the compact, collapsed
    // participant list; reopen it before operating on the new member.
    await expect(panel.getByRole('button', { name: /参与者 3 人/ })).toHaveAttribute(
      'aria-expanded',
      'false'
    )
    await panel.getByRole('button', { name: /参与者 3 人/ }).click()
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

  test('shows detailed official-style topic notification choices', async ({ page }) => {
    await openTopic(page)
    await page.getByRole('button', { name: '话题通知等级' }).click()

    const menu = page.locator('.topic-notification-menu')
    await expect(menu).toBeVisible()
    for (const [label, description] of [
      ['忽略', '完全静音，不再收到此话题的提醒。'],
      ['常规', '仅在被提及或直接回复时通知。'],
      ['追踪', '显示未读数量，不为每条回复推送提醒。'],
      ['关注', '每条新回复都会通知你。'],
      ['仅关注首帖', '仅在新增首帖内容时通知。']
    ]) {
      const item = menu
        .locator('.topic-notification-menu__item')
        .filter({ has: page.getByText(label, { exact: true }) })
      await expect(item).toContainText(description)
      await expect(item.locator('.topic-notification-menu__icon .anticon')).toHaveCount(1)
    }

    await menu.getByText('关注', { exact: true }).click()
    await expect(page.getByRole('button', { name: '话题通知等级' })).toContainText('关注')
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
