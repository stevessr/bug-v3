import { expect, test } from '@playwright/test'

test.describe('Discourse chat floating controls', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const channels = {
        channels: [
          {
            id: 7,
            title: '设计讨论',
            slug: 'design',
            chatable_type: 'Category',
            threading_enabled: true,
            current_user_membership: {
              chat_channel_id: 7,
              unread_count: 0,
              starred: true
            },
            last_message_sent_at: '2026-08-09T08:00:00Z'
          }
        ]
      }

      const messages = {
        messages: [
          {
            id: 101,
            cooked:
              '<p>悬浮操作现在会自己关闭吗？<img src="/uploads/default/original/already-rendered.png" alt="已渲染图片"></p>',
            created_at: '2026-08-09T07:58:00Z',
            chat_channel_id: 7,
            user_id: 2,
            username: 'alice',
            name: 'Alice',
            avatar_template: '/letter_avatar_proxy/v4/letter/a/8491ac/{size}.png',
            user: {
              id: 2,
              username: 'alice',
              name: 'Alice',
              avatar_template: '/letter_avatar_proxy/v4/letter/a/8491ac/{size}.png'
            },
            reactions: [{ emoji: 'heart', count: 2, reacted: false }],
            blocks: [],
            uploads: [
              {
                id: 1,
                short_url: '/uploads/default/original/already-rendered.png',
                original_filename: 'already-rendered.png',
                mime_type: 'image/png'
              },
              {
                id: 2,
                short_url: '/uploads/default/original/attachment-only.png',
                original_filename: 'attachment-only.png',
                mime_type: 'image/png'
              }
            ],
            thread: {
              id: 501,
              title: '悬浮消息串',
              reply_count: 1,
              preview: {
                reply_count: 1,
                last_reply_excerpt: '保持主页面不变'
              }
            }
          }
        ],
        meta: { can_load_more_past: false }
      }

      const thread = {
        id: 501,
        title: '悬浮消息串',
        channel_id: 7,
        reply_count: 1,
        original_message: messages.messages[0],
        current_user_membership: { notification_level: 2 }
      }

      const runtime = {
        lastError: null,
        sendMessage(request: any, callback: (response: any) => void) {
          if (request.type === 'GET_LINUX_DO_USER') {
            queueMicrotask(() => callback({ success: true, user: { id: 1, username: 'steve' } }))
            return
          }

          const url = request?.options?.url || ''
          let data: any = {}
          if (url.includes('/chat/api/me/channels')) {
            data = channels
          } else if (url.includes('/chat/api/channels/7/threads/501/messages')) {
            data = {
              messages: [
                {
                  id: 102,
                  cooked: '<p>保持主页面不变</p>',
                  created_at: '2026-08-09T07:59:00Z',
                  chat_channel_id: 7,
                  thread_id: 501,
                  user_id: 1,
                  username: 'steve',
                  user: { id: 1, username: 'steve', name: 'Steve' },
                  reactions: [],
                  blocks: []
                }
              ],
              meta: { can_load_more_past: false }
            }
          } else if (url.includes('/chat/api/channels/7/threads/501')) {
            data = { thread }
          } else if (url.includes('/chat/api/channels/7/messages')) {
            data = messages
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

  test('opens only on click and closes on outside click, Escape, and mouse leave', async ({
    page
  }) => {
    await page.goto('/discourse.html')
    await page.locator('.toolbar-address input').fill('https://linux.do/chat')
    await page.getByRole('button', { name: '打开地址' }).click()

    const message = page.locator('.chat-message-item').first()
    const trigger = message.getByRole('button', { name: '更多消息操作' })
    const menu = message.getByRole('menu', { name: '消息操作' })

    await expect(message).toBeVisible()
    await expect(menu).toHaveCount(0)

    await message.hover()
    await expect(menu).toHaveCount(0)

    await trigger.click()
    await expect(menu).toBeVisible()
    await expect(trigger).toHaveAttribute('aria-expanded', 'true')

    await page.locator('.chat-main-header').click()
    await expect(menu).toHaveCount(0)

    await message.hover()
    await trigger.click()
    await expect(menu).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(menu).toHaveCount(0)

    await message.hover()
    await trigger.click()
    await expect(menu).toBeVisible()
    await message.dispatchEvent('mouseleave')
    await expect(menu).toHaveCount(0)
  })

  test('renders upload-only images once and keeps reactions beside their action buttons', async ({
    page
  }) => {
    await page.goto('/discourse.html')
    await page.locator('.toolbar-address input').fill('https://linux.do/chat')
    await page.getByRole('button', { name: '打开地址' }).click()

    const message = page.locator('.chat-message-item').first()
    await expect(message.locator('img[src*="already-rendered.png"]')).toHaveCount(1)
    await expect(
      message.locator('.chat-message-attachments img[src*="attachment-only.png"]')
    ).toHaveCount(1)

    const reactionRail = message.locator('.chat-message-reaction-rail')
    const hoverActions = message.locator('.chat-message-hover-actions')
    await expect(reactionRail.getByRole('button', { name: /heart.*2 个反应/ })).toBeVisible()
    await message.hover()
    await expect(hoverActions).toHaveCSS('opacity', '1')

    const geometry = await message.evaluate(element => {
      const rail = element.querySelector<HTMLElement>('.chat-message-reaction-rail')
      const actions = element.querySelector<HTMLElement>('.chat-message-hover-actions')
      const side = element.querySelector<HTMLElement>('.chat-message-side-controls')
      if (!rail || !actions || !side) return null
      const railBox = rail.getBoundingClientRect()
      const actionBox = actions.getBoundingClientRect()
      const sideBox = side.getBoundingClientRect()
      return {
        actionsStartAfterRail: actionBox.left >= railBox.right - 1,
        sideHeight: sideBox.height,
        reactionHeight: railBox.height
      }
    })
    expect(geometry?.actionsStartAfterRail).toBe(true)
    expect(geometry?.reactionHeight).toBeGreaterThanOrEqual(34)
    expect(geometry?.sideHeight).toBeLessThanOrEqual((geometry?.reactionHeight || 0) + 1)
  })

  test('keeps the active browser tab and URL unchanged when a floating chat opens a thread', async ({
    page
  }) => {
    await page.goto('/discourse.html')
    const address = page.locator('.toolbar-address input')
    await address.fill('https://linux.do/latest')
    await page.getByRole('button', { name: '打开地址' }).click()

    const tabs = page.getByRole('tablist', { name: '已打开页面' })
    await expect(tabs.getByRole('tab')).toHaveCount(1)
    await page.getByRole('button', { name: '打开聊天悬浮窗' }).click()

    const floatingChat = page.locator('.floating-chat')
    await expect(floatingChat).toBeVisible()
    await floatingChat.getByRole('link', { name: '打开消息串，共 1 条回复' }).click()
    await expect(floatingChat.getByRole('region', { name: '消息串：悬浮消息串' })).toBeVisible()

    await expect(address).toHaveValue('https://linux.do/latest')
    await expect(tabs.getByRole('tab')).toHaveCount(1)
  })
})
