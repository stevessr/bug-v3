import { expect, test } from '@playwright/test'

test.describe('Discourse management MD3 views', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const sessionUser = {
        id: 1,
        username: 'steve',
        name: 'Steve',
        avatar_template: '/letter_avatar_proxy/v4/letter/s/7c8e57/{size}.png'
      }

      const reviewData = {
        reviewables: [
          {
            id: 42,
            version: 1,
            type: 'ReviewablePost',
            status: 0,
            created_at: '2026-08-09T08:00:00Z',
            fancy_title: '需要审核的设计讨论',
            cooked: '<p>这里是一段等待审核的内容。</p>',
            topic_id: 9,
            topic_url: '/t/design/9',
            category_id: 2,
            score: 4,
            target_created_by: {
              id: 2,
              username: 'alice',
              avatar_template: '/letter_avatar_proxy/v4/letter/a/8491ac/{size}.png'
            },
            reviewable_scores: [],
            bundled_actions: [
              {
                label: '处理',
                actions: [
                  {
                    id: 1,
                    label: '通过',
                    server_action: 'approve',
                    confirm_message: '确认通过这条内容？'
                  }
                ]
              }
            ],
            editable_fields: []
          }
        ],
        users: [],
        meta: {
          total_rows_reviewables: 1,
          reviewable_count: 1,
          unseen_reviewable_count: 1
        }
      }

      const invitesData = {
        can_see_invite_details: true,
        counts: { pending: 1, redeemed: 2, expired: 1 },
        invites: [
          {
            id: 88,
            email: 'guest@example.com',
            link: 'https://linux.do/invites/example',
            description: '设计评审邀请',
            created_at: '2026-08-09T08:00:00Z',
            expires_at: '2026-08-16T08:00:00Z',
            emailed: true,
            can_delete_invite: true
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
          let data: any = {}
          if (url.includes('/review?')) {
            data = reviewData
          } else if (url.includes('/u/steve/invited.json')) {
            data = invitesData
          } else if (url.includes('/latest')) {
            data = { topic_list: { topics: [] }, users: [] }
          } else if (url.includes('/categories')) {
            data = { category_list: { categories: [] } }
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

  test('exposes accessible review tabs and confirmation dialog', async ({ page }) => {
    await page.goto('/discourse.html')
    await page.locator('.toolbar-address input').fill('https://linux.do/review')
    await page.getByRole('button', { name: '打开地址' }).click()

    await expect(page.getByRole('heading', { name: '审核队列' })).toBeVisible()
    await expect(page.getByRole('tab', { name: '待处理', selected: true })).toBeVisible()
    await expect(page.getByRole('article')).toContainText('需要审核的设计讨论')

    const approve = page.getByRole('button', { name: '通过' })
    await approve.click()
    const dialog = page.getByRole('dialog', { name: '确认通过这条内容？' })
    await expect(dialog).toBeVisible()
    await expect(dialog).toBeFocused()

    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(approve).toBeFocused()
  })

  test('renders the responsive invite manager and its native form flow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/discourse.html')
    await page.locator('.toolbar-address input').fill('https://linux.do/invites')
    await page.getByRole('button', { name: '打开地址' }).click()

    await expect(page.getByRole('heading', { name: '创建新邀请' })).toHaveCount(0)
    await expect(page.getByRole('tab', { name: /待使用/, selected: true })).toBeVisible()
    await expect(page.getByRole('article')).toContainText('guest@example.com')

    const create = page.locator('.invites-create-btn')
    await expect(create).toContainText('创建邀请')
    await create.click()
    await expect(create).toHaveAttribute('aria-expanded', 'true')
    await expect(page.getByRole('heading', { name: '创建新邀请' })).toBeVisible()

    const horizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    )
    expect(horizontalOverflow).toBe(0)
  })
})
