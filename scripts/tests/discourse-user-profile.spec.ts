import { expect, test } from '@playwright/test'

test.describe('Discourse user profile area', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const sessionUser = {
        id: 1,
        username: 'steve',
        name: 'Steve',
        avatar_template: '/letter_avatar_proxy/v4/letter/s/7c8e57/{size}.png'
      }

      const userData = {
        user: {
          id: 1,
          username: 'steve',
          name: 'Steve',
          avatar_template: '/letter_avatar_proxy/v4/letter/s/7c8e57/{size}.png',
          title: '超级会员',
          location: '北京',
          trust_level: 2,
          created_at: '2025-01-01T00:00:00Z',
          last_seen_at: '2026-08-10T10:00:00Z',
          bio_cooked: '<p>喜欢设计和表情包。</p>',
          can_send_private_message_to_user: false,
          can_follow: true,
          is_followed: false,
          total_followers: 12,
          total_following: 3,
          badge_count: 2,
          profile_view_count: 99,
          admin: false,
          moderator: false,
          featured_topic: {
            id: 101,
            slug: 'featured-design',
            fancy_title: '置顶设计讨论',
            posts_count: 5
          }
        }
      }

      const summaryData = {
        user_summary: {
          likes_given: 40,
          likes_received: 88,
          topics_entered: 300,
          posts_read_count: 1200,
          days_visited: 210,
          topic_count: 7,
          post_count: 66,
          time_read: 7200,
          solved_count: 2,
          top_categories: [
            { id: 2, name: '设计', color: '663399', slug: 'design', topic_count: 3, post_count: 20 }
          ]
        },
        topics: [
          {
            id: 101,
            title: '置顶设计讨论',
            fancy_title: '置顶设计讨论',
            slug: 'featured-design',
            posts_count: 5,
            like_count: 12
          }
        ]
      }

      const badgesData = {
        badges: [
          { id: 1, name: '新人', description: '注册用户', image_url: '/uploads/badge-new.png' },
          { id: 2, name: '热心会员', description: '经常帮助他人' }
        ]
      }

      const followFeedData = {
        posts: [
          {
            id: 501,
            created_at: '2026-08-09T08:00:00Z',
            post_number: 1,
            excerpt: '关注动态摘要',
            user: { id: 2, username: 'alice' },
            topic: {
              id: 9,
              slug: 'design-thread',
              fancy_title: '设计串',
              title: '设计串'
            }
          }
        ],
        extras: { has_more: false }
      }

      const followingData = {
        users: [
          {
            id: 2,
            username: 'alice',
            name: 'Alice',
            avatar_template: '/letter_avatar_proxy/v4/letter/a/8491ac/{size}.png'
          }
        ]
      }

      const followersData = {
        users: [
          {
            id: 3,
            username: 'bob',
            name: 'Bob',
            avatar_template: '/letter_avatar_proxy/v4/letter/b/9a54a1/{size}.png'
          }
        ]
      }

      const reactionsData = [
        {
          id: 601,
          created_at: '2026-08-08T08:00:00Z',
          reaction: { reaction_value: '+1' },
          post: {
            username: 'alice',
            avatar_template: '/letter_avatar_proxy/v4/letter/a/8491ac/{size}.png',
            topic_id: 9,
            topic_slug: 'design-thread',
            topic_title: '设计串',
            post_number: 1,
            excerpt: '被反应的帖子内容'
          }
        }
      ]

      const messagesData = {
        topic_list: {
          topics: [
            {
              id: 701,
              title: '关于插件的私信',
              fancy_title: '关于插件的私信',
              slug: 'private-message-701',
              posts_count: 3,
              like_count: 1,
              unread: 2,
              new_posts: 0,
              created_at: '2026-08-07T08:00:00Z',
              last_posted_at: '2026-08-08T08:00:00Z',
              participants: [{ user_id: 2 }],
              allowed_user_count: 2
            }
          ],
          more_topics_url: null
        },
        users: [
          {
            id: 2,
            username: 'alice',
            avatar_template: '/letter_avatar_proxy/v4/letter/a/8491ac/{size}.png'
          }
        ]
      }

      const runtime = {
        lastError: null,
        sendMessage(request: any, callback: (response: any) => void) {
          if (request.type === 'GET_LINUX_DO_USER') {
            queueMicrotask(() => callback({ success: true, user: sessionUser }))
            return
          }

          const url = request?.options?.url || ''
          const method = request?.options?.method || 'GET'
          let data: any = {}
          if (url.includes('/u/steve.json')) {
            data = userData
          } else if (url.includes('/u/steve/summary.json')) {
            data = summaryData
          } else if (url.includes('/user-badges/steve.json')) {
            data = badgesData
          } else if (url.includes('/follow/posts/steve.json')) {
            data = followFeedData
          } else if (url.includes('/u/steve/follow/following.json')) {
            data = followingData
          } else if (url.includes('/u/steve/follow/followers.json')) {
            data = followersData
          } else if (url.includes('/u/steve/groups.json')) {
            data = { groups: [] }
          } else if (url.includes('/discourse-reactions/posts/reactions.json')) {
            data = reactionsData
          } else if (url.includes('/topics/created-by/steve.json')) {
            data = {
              topic_list: {
                topics: [
                  {
                    id: 102,
                    title: '我的作品集',
                    fancy_title: '我的作品集',
                    slug: 'my-portfolio',
                    posts_count: 1,
                    views: 10,
                    like_count: 3,
                    created_at: '2026-08-01T00:00:00Z'
                  }
                ],
                more_topics_url: null
              }
            }
          } else if (url.includes('/topics/messages/steve.json')) {
            data = messagesData
          } else if (url.includes('/user_actions.json')) {
            data = {
              user_actions: [
                {
                  action_type: 1,
                  post_id: 9,
                  topic_id: 9,
                  slug: 'design-thread',
                  username: 'alice',
                  name: 'Alice',
                  avatar_template: '/letter_avatar_proxy/v4/letter/a/8491ac/{size}.png',
                  title: '设计串',
                  excerpt: '动作摘要',
                  created_at: '2026-08-06T08:00:00Z'
                }
              ]
            }
          } else if (url.includes('/t/701/archive-message')) {
            if (method === 'PUT') {
              queueMicrotask(() => callback({ success: true, data: { status: 200, ok: true } }))
              return
            }
          } else {
            data = { topic_list: { topics: [] }, users: [] }
          }

          queueMicrotask(() => callback({ success: true, data: { status: 200, ok: true, data } }))
        },
        onMessage: {
          addListener() {},
          removeListener() {}
        }
      }

      const chromeApi = (globalThis as any).chrome || {}
      Object.defineProperty(chromeApi, 'runtime', {
        configurable: true,
        value: runtime
      })
      if (!(globalThis as any).chrome) {
        Object.defineProperty(globalThis, 'chrome', {
          configurable: true,
          value: chromeApi
        })
      }
    })
  })

  const openAddress = async (page: import('@playwright/test').Page, address: string) => {
    await page.goto('/discourse.html')
    await page.locator('.toolbar-address input').fill(address)
    await page.getByRole('button', { name: '打开地址' }).click()
  }

  test('renders the profile page with stats, badges preview and follow counts', async ({
    page
  }) => {
    await openAddress(page, 'https://linux.do/u/steve')

    await expect(page.getByRole('heading', { name: 'steve' })).toBeVisible()
    await expect(page.getByText('喜欢设计和表情包。')).toBeVisible()
    await expect(page.getByText('发布话题')).toBeVisible()
    await expect(page.getByText('收到赞')).toBeVisible()

    // Follow counts in header navigate to following/followers
    const followCount = page.getByRole('button', { name: '关注 3' })
    await expect(followCount).toBeVisible()
    await expect(page.getByRole('button', { name: '粉丝 12' })).toBeVisible()

    // Badges preview section with 查看全部
    await expect(page.getByRole('heading', { name: '徽章' })).toBeVisible()
    await expect(page.getByText('新人', { exact: true })).toBeVisible()
    await expect(page.getByText('热心会员', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: '查看全部' })).toBeVisible()
  })

  test('places active categories, hot topics, and account information side by side responsively', async ({
    page
  }) => {
    await page.setViewportSize({ width: 1440, height: 1000 })
    await openAddress(page, 'https://linux.do/u/steve')

    const summaryColumns = page.locator('.user-profile-summary-columns')
    const activeCategories = page.getByRole('heading', { name: '活跃分类' }).locator('..')
    const hotTopics = page.getByRole('heading', { name: '热门话题' }).locator('..')
    const accountInfo = page.getByRole('heading', { name: '账户信息' }).locator('..')

    await expect(summaryColumns).toBeVisible()
    await expect(activeCategories).toBeVisible()
    await expect(hotTopics).toBeVisible()
    await expect(accountInfo).toBeVisible()
    await expect(summaryColumns).toHaveCSS('grid-template-columns', /.+ .+ .+/)

    const [activeBox, topicsBox, accountBox] = await Promise.all([
      activeCategories.boundingBox(),
      hotTopics.boundingBox(),
      accountInfo.boundingBox()
    ])
    expect(activeBox).not.toBeNull()
    expect(topicsBox).not.toBeNull()
    expect(accountBox).not.toBeNull()
    expect(Math.abs(activeBox!.y - topicsBox!.y)).toBeLessThan(2)
    expect(Math.abs(activeBox!.y - accountBox!.y)).toBeLessThan(2)
    expect(activeBox!.x).toBeLessThan(topicsBox!.x)
    expect(topicsBox!.x).toBeLessThan(accountBox!.x)

    await page.setViewportSize({ width: 600, height: 1000 })
    await expect(summaryColumns).toHaveCSS('grid-template-columns', /^(?!.* ).+$/)

    const [mobileActiveBox, mobileTopicsBox, mobileAccountBox] = await Promise.all([
      activeCategories.boundingBox(),
      hotTopics.boundingBox(),
      accountInfo.boundingBox()
    ])
    expect(mobileActiveBox).not.toBeNull()
    expect(mobileTopicsBox).not.toBeNull()
    expect(mobileAccountBox).not.toBeNull()
    expect(mobileTopicsBox!.y).toBeGreaterThan(mobileActiveBox!.y)
    expect(mobileAccountBox!.y).toBeGreaterThan(mobileTopicsBox!.y)
  })

  test('switches between badges and follow tabs with follow feed, following and followers', async ({
    page
  }) => {
    await openAddress(page, 'https://linux.do/u/steve')

    // 徽章 tab shows the badge grid
    await page.getByRole('tab', { name: '徽章' }).click()
    await expect(page.getByText('新人', { exact: true })).toBeVisible()

    // 关注 tab shows subtabs
    await page.getByRole('tab', { name: '关注' }).click()
    await page.getByRole('button', { name: '关注动态', exact: true }).click()
    await expect(page.getByText('关注动态摘要')).toBeVisible()

    await page.getByRole('button', { name: '正在关注', exact: true }).click()
    await expect(page.getByText('Alice')).toBeVisible()

    await page.getByRole('button', { name: '关注者', exact: true }).click()
    await expect(page.getByText('Bob')).toBeVisible()
  })

  test('shows activity reactions and portfolio tabs', async ({ page }) => {
    await openAddress(page, 'https://linux.do/u/steve')

    await page.getByRole('tab', { name: '活动' }).click()
    await expect(page.getByText('动作摘要')).toBeVisible()

    // 反应 subtab renders reaction items
    const activityTabs = page.getByRole('tablist', { name: '动态类型' })
    await activityTabs.getByRole('tab', { name: '反应' }).click()
    await expect(page.getByText('被反应的帖子内容')).toBeVisible()
    await expect(page.getByText('反应于')).toBeVisible()

    // 作品集 subtab renders tagged topics
    await page.getByRole('tab', { name: '作品集', exact: true }).click()
    await expect(page.getByText('我的作品集')).toBeVisible()
  })

  test('lists private messages with archive action', async ({ page }) => {
    await openAddress(page, 'https://linux.do/u/steve')

    await page.getByRole('tab', { name: '消息' }).click()
    await expect(page.getByText('关于插件的私信')).toBeVisible()
    await expect(page.getByText('2 未读')).toBeVisible()
    await expect(page.getByRole('button', { name: '全部已读' })).toBeVisible()

    // Archive the private message
    await page.getByRole('button', { name: '归档此私信' }).click()
    await expect(page.getByText('已归档')).toBeVisible()
    await expect(page.getByRole('button', { name: '移回收件箱' })).toBeVisible()
  })
})
