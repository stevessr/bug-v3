import { expect, test } from '@playwright/test'

test.describe('Discourse topic metadata and public poll voters', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const requests: Array<{ url: string; method: string; body: string }> = []
      ;(globalThis as any).__topicMetadataRequests = requests

      const steve = {
        id: 1,
        username: 'steve',
        name: 'Steve',
        avatar_template: '/user_avatar/forum.example.test/steve/{size}/100_2.png'
      }
      const alice = {
        id: 2,
        username: 'alice',
        name: 'Alice',
        avatar_template: '/user_avatar/forum.example.test/alice/{size}/200_2.png'
      }
      const bob = {
        id: 3,
        username: 'bob',
        name: 'Bob',
        avatar_template: '/user_avatar/forum.example.test/bob/{size}/300_2.png'
      }

      const topic = () => ({
        id: 77,
        slug: 'public-poll-metadata',
        archetype: 'regular',
        title: '带有分区、标签和公开投票的话题',
        fancy_title: '带有分区、标签和公开投票的话题',
        posts_count: 1,
        highest_post_number: 1,
        views: 12,
        like_count: 0,
        category_id: 8,
        tags: [
          { name: 'ux', text: '用户体验', description: '体验相关讨论' },
          { slug: 'release', text: '发布' }
        ],
        created_at: '2026-08-11T01:00:00Z',
        post_stream: {
          stream: [7701],
          posts: [
            {
              id: 7701,
              topic_id: 77,
              post_number: 1,
              username: 'steve',
              user_id: 1,
              name: 'Steve',
              avatar_template: steve.avatar_template,
              created_at: '2026-08-11T01:00:00Z',
              cooked:
                '<div class="poll-outer" data-poll-name="feature-poll"><div class="poll" data-poll-name="feature-poll" data-poll-type="regular" data-poll-results="always"><div class="poll-title">是否支持这个功能？</div><ul><li data-poll-option-id="approve"><span class="option-text">支持</span></li><li data-poll-option-id="reject"><span class="option-text">暂不支持</span></li><li data-poll-option-id="restricted"><span class="option-text">仅管理员可见</span></li></ul></div></div>',
              reply_count: 0,
              like_count: 0,
              polls: [
                {
                  id: 701,
                  name: 'feature-poll',
                  type: 'regular',
                  results: 'always',
                  public: true,
                  voters: 3,
                  options: [
                    { id: 'approve', html: '支持', votes: 2 },
                    { id: 'reject', html: '暂不支持', votes: 0 },
                    { id: 'restricted', html: '仅管理员可见', votes: 1 }
                  ],
                  preloaded_voters: { approve: [alice] }
                }
              ]
            }
          ]
        },
        details: {
          created_by: steve,
          can_edit: true,
          notification_level: 1
        },
        suggested_topics: [],
        related_topics: []
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
                  discourse_reactions_enabled: false,
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

          const parsed = new URL(url || 'https://forum.example.test/')
          let data: any = {}
          let status = 200
          let ok = true
          if (parsed.pathname === '/latest.json') {
            data = { topic_list: { topics: [] }, users: [] }
          } else if (parsed.pathname === '/categories.json') {
            data = {
              category_list: {
                categories: [
                  {
                    id: 8,
                    name: '产品设计',
                    slug: 'product-design',
                    color: '0EA5E9',
                    text_color: 'FFFFFF',
                    icon: 'palette',
                    topic_count: 12
                  },
                  {
                    id: 9,
                    name: '设计子分区',
                    slug: 'design-lab',
                    color: 'A855F7',
                    text_color: 'FFFFFF',
                    emoji: '🎨',
                    parent_category_id: 8,
                    topic_count: 2
                  }
                ]
              }
            }
          } else if (parsed.pathname === '/t/77.json') {
            data = topic()
          } else if (parsed.pathname === '/t/77' && method === 'PUT') {
            const payload = JSON.parse(body)
            data = {
              id: 77,
              title: payload.title,
              fancy_title: payload.title,
              tags: payload.tags
            }
          } else if (parsed.pathname === '/polls/voters.json') {
            if (parsed.searchParams.get('option_id') === 'approve') {
              data = { voters: { approve: [alice, bob] } }
            } else {
              status = 403
              ok = false
              data = { errors: ['投票人列表不可用'] }
            }
          } else if (parsed.pathname === '/site.json') {
            data = { can_create_tag: true, post_action_types: [] }
          } else if (parsed.pathname === '/tags/filter/search') {
            data = { results: [] }
          } else if (parsed.pathname === '/emojis.json') {
            data = {}
          } else if (parsed.pathname === '/search.json') {
            data = { posts: [], topics: [], users: [] }
          } else if (parsed.pathname === '/topics/timings' && method === 'POST') {
            data = { success: 'OK' }
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

  test('shows category and tags above the title, keeps visuals in the editor, and reveals public voters', async ({
    page
  }) => {
    await page.goto('/discourse.html')
    await page
      .locator('.toolbar-address input')
      .fill('https://forum.example.test/t/public-poll-metadata/77')
    await page.getByRole('button', { name: '打开地址' }).click()
    await expect(
      page.getByRole('heading', { name: '带有分区、标签和公开投票的话题' })
    ).toBeVisible()

    const header = page.locator('.topic-header')
    const categoryBadge = header.locator('.topic-header__context-category')
    await expect(categoryBadge).toContainText('产品设计')
    await expect(categoryBadge).toHaveAttribute('data-category-color', '#0EA5E9')
    await expect(categoryBadge.locator('.topic-category-icon svg')).toHaveCount(1)
    await expect(header.getByText('用户体验', { exact: true })).toBeVisible()
    await expect(header.getByText('发布', { exact: true })).toBeVisible()

    const poll = page.locator('.poll-tsx')
    await expect(poll.getByText('是否支持这个功能？')).toBeVisible()
    await expect(poll.getByLabel('投票人 Alice (@alice)')).toBeVisible()
    await poll.getByRole('button', { name: '显示更多投票人：支持' }).click()
    await expect(poll.getByLabel('投票人 Bob (@bob)')).toBeVisible()
    await expect
      .poll(() =>
        page.evaluate(() =>
          (globalThis as any).__topicMetadataRequests.some(
            (request: any) =>
              request.url.includes('/polls/voters.json?') &&
              request.url.includes('post_id=7701') &&
              request.url.includes('poll_name=feature-poll') &&
              request.url.includes('option_id=approve')
          )
        )
      )
      .toBe(true)

    const restrictedVoters = poll.getByRole('button', { name: '显示投票人：仅管理员可见' })
    await restrictedVoters.click()
    await expect(restrictedVoters).toHaveCount(0)
    await expect(poll.locator('[aria-label="仅管理员可见 的投票人"]')).toHaveCount(0)

    await page.getByRole('button', { name: '编辑话题标题、分区与标签' }).click()
    const editor = page.locator('.topic-header__edit-form')
    await expect(editor.locator('.topic-header__selected-tag')).toHaveCount(2)
    await expect(editor.getByText('用户体验', { exact: true })).toBeVisible()
    await expect(editor.getByText('发布', { exact: true })).toBeVisible()

    await editor.locator('.ant-tree-select .ant-select-selector').click()
    const categoryOption = page
      .locator('.ant-select-dropdown:visible .topic-category-tree-option')
      .filter({ hasText: '产品设计' })
    await expect(categoryOption).toBeVisible()
    await expect(categoryOption).toHaveAttribute('data-category-color', '#0EA5E9')
    await expect(categoryOption.locator('.topic-category-icon svg')).toHaveCount(1)

    const tagInput = editor
      .locator('.topic-header__field')
      .filter({ hasText: '标签' })
      .locator('input')
      .last()
    await tagInput.fill('docs')
    await tagInput.press('Enter')
    await expect(editor.getByText('docs', { exact: true })).toBeVisible()

    await editor.getByRole('textbox', { name: '话题标题' }).fill('保存正确标签的话题')
    await editor.getByRole('button', { name: '保存', exact: true }).click()
    await expect(page.getByRole('heading', { name: '保存正确标签的话题' })).toBeVisible()

    const update = await page.evaluate(() =>
      (globalThis as any).__topicMetadataRequests.find(
        (request: any) => request.url.endsWith('/t/77') && request.method === 'PUT'
      )
    )
    expect(JSON.parse(update.body)).toEqual({
      title: '保存正确标签的话题',
      original_title: '带有分区、标签和公开投票的话题',
      tags: ['ux', 'release', 'docs']
    })
  })
})
