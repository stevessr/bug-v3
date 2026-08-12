import { expect, test } from '@playwright/test'

test.describe('Discourse category browse page', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const requests: string[] = []
      ;(globalThis as any).__categoryBrowseRequests = requests

      const topic = (id: number, title: string) => ({
        id,
        title,
        fancy_title: title,
        slug: `category-topic-${id}`,
        posts_count: 2,
        reply_count: 1,
        views: 20,
        like_count: 1,
        created_at: '2026-08-11T08:00:00Z',
        last_posted_at: '2026-08-11T09:00:00Z',
        bumped_at: '2026-08-11T09:00:00Z',
        posters: [],
        tags: []
      })

      const subcategories = [
        {
          id: 35,
          name: '搞七捻三，Lv1',
          slug: 'gossip-lv1',
          color: '0088CC',
          text_color: 'FFFFFF',
          topic_count: 12,
          parent_category_id: 11,
          icon: 'droplet',
          read_restricted: true,
          description_text: '此处为 1级用户 可见空间。'
        },
        {
          id: 89,
          name: '搞七捻三，Lv2',
          slug: 'gossip-lv2',
          color: '874EFE',
          text_color: 'FFFFFF',
          topic_count: 8,
          parent_category_id: 11,
          icon: 'droplet',
          read_restricted: true,
          description_text: '此处为 2级用户 可见空间。'
        },
        {
          id: 21,
          name: '搞七捻三，Lv3',
          slug: 'gossip-lv3',
          color: 'FF0000',
          text_color: 'FFFFFF',
          topic_count: 4,
          parent_category_id: 11,
          icon: 'droplet',
          read_restricted: true,
          description_text: '此处为 3级用户 可见空间。'
        }
      ]

      const gossipCategory = {
        id: 11,
        name: '搞七捻三',
        slug: 'gossip',
        color: '3AB54A',
        text_color: '000000',
        topic_count: 42,
        icon: 'droplet',
        uploaded_logo: { url: '/uploads/default/original/gossip-logo.png' },
        description_text: '闲聊吹水的板块。不得讨论政治、色情等违规内容。',
        subcategory_list: subcategories
      }

      // `/categories_and_latest.json` can deliberately keep these rows
      // compact. The browser must enrich their icon/logo from the same site
      // metadata Discourse has in data-preloaded (or `/site.json` fallback).
      const siteMetadataCategories = [
        {
          id: 777,
          name: '预载 Logo 分类',
          slug: 'preloaded-logo',
          color: '4488CC',
          text_color: 'FFFFFF',
          icon: 'sparkles',
          uploaded_logo: { url: '/uploads/default/original/preloaded-logo.png' },
          uploaded_logo_dark: { url: '/uploads/default/original/preloaded-logo-dark.png' }
        },
        {
          id: 778,
          name: '预载图标分类',
          slug: 'preloaded-icon',
          color: '6B5BD6',
          text_color: 'FFFFFF',
          icon: 'preloaded-icon',
          uploaded_logo: null,
          uploaded_logo_dark: null
        }
      ]

      const compactMetadataCategories = siteMetadataCategories.map(category => ({
        id: category.id,
        name: category.name,
        slug: category.slug,
        color: category.color,
        text_color: category.text_color,
        topic_count: 1
      }))

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

          const url = String(request?.options?.url || '')
          requests.push(url)
          const parsed = new URL(url)
          let data: any = { users: [] }

          if (parsed.pathname === '/latest.json') {
            data = { topic_list: { topics: [topic(1, '首页话题')] }, users: [] }
          } else if (parsed.pathname === '/site.json') {
            data = { categories: siteMetadataCategories }
          } else if (parsed.pathname === '/categories.json') {
            data = {
              category_list: {
                categories: parsed.searchParams.has('parent_category_id')
                  ? subcategories
                  : [gossipCategory]
              }
            }
          } else if (parsed.pathname === '/categories_and_latest.json') {
            data = {
              category_list: { categories: compactMetadataCategories },
              topic_list: { topics: [] },
              users: []
            }
          } else if (parsed.pathname === '/c/gossip/11.json') {
            data = {
              category: gossipCategory,
              topic_list: { topics: [topic(1101, '分类最新话题')] },
              users: []
            }
          } else if (parsed.pathname === '/c/gossip/11/l/new.json') {
            data = {
              category: gossipCategory,
              topic_list: { topics: [topic(1102, '分类新话题')] },
              users: []
            }
          } else if (parsed.pathname === '/c/gossip-lv1/35.json') {
            data = {
              category: subcategories[0],
              topic_list: { topics: [topic(3501, 'Lv1 分类话题')] },
              users: []
            }
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

  test('renders the full category header, direct subcategories, and scoped list routes', async ({
    page
  }) => {
    await page.goto('/discourse.html')

    const address = page.locator('.toolbar-address input')
    await address.fill('https://linux.do/c/gossip/11')
    await page.getByRole('button', { name: '打开地址' }).click()

    await expect(address).toHaveValue('https://linux.do/c/gossip/11')
    await expect(page.getByRole('heading', { name: '搞七捻三' })).toBeVisible()
    await expect(page.getByText('闲聊吹水的板块。不得讨论政治、色情等违规内容。')).toBeVisible()
    await expect(page.locator('.category-page-hero__logo img')).toHaveAttribute(
      'src',
      'https://linux.do/uploads/default/original/gossip-logo.png'
    )

    const cards = page.locator('.category-page-subcategory-grid .category-card')
    await expect(cards).toHaveCount(3)
    await expect(page.getByText('此处为 1级用户 可见空间。')).toBeVisible()
    await expect(page.getByText('此处为 2级用户 可见空间。')).toBeVisible()
    await expect(page.getByText('此处为 3级用户 可见空间。')).toBeVisible()
    await expect(page.locator('.category-page-tabs__item', { hasText: '已读' })).toBeVisible()

    await page.getByRole('button', { name: '新', exact: true }).click()
    await expect(address).toHaveValue('https://linux.do/c/gossip/11/l/new')
    await expect(page.getByText('分类新话题')).toBeVisible()
    await expect
      .poll(() =>
        page.evaluate(() =>
          (globalThis as any).__categoryBrowseRequests.includes(
            'https://linux.do/c/gossip/11/l/new.json'
          )
        )
      )
      .toBe(true)

    await page
      .locator('.category-page-subcategory-grid .category-card__primary', {
        hasText: '搞七捻三，Lv1'
      })
      .click()
    await expect(address).toHaveValue('https://linux.do/c/gossip-lv1/35')
    await expect(page.getByRole('heading', { name: '搞七捻三，Lv1' })).toBeVisible()
  })

  test('uses the full browse layout when entering a nested /c/gossip/* list URL directly', async ({
    page
  }) => {
    await page.goto('/discourse.html')
    const address = page.locator('.toolbar-address input')
    await address.fill('https://linux.do/c/gossip/11/l/new')
    await page.getByRole('button', { name: '打开地址' }).click()

    await expect(address).toHaveValue('https://linux.do/c/gossip/11/l/new')
    await expect(page.getByRole('heading', { name: '搞七捻三' })).toBeVisible()
    await expect(page.locator('.category-page-subcategory-grid .category-card')).toHaveCount(3)
    await expect(page.getByText('分类新话题')).toBeVisible()
    await expect
      .poll(() =>
        page.evaluate(() =>
          (globalThis as any).__categoryBrowseRequests.includes(
            'https://linux.do/c/gossip/11/l/new.json'
          )
        )
      )
      .toBe(true)
  })

  test('enriches compact category rows with live preloaded site icons and logos', async ({
    page
  }) => {
    await page.goto('/discourse.html')
    await expect(page.getByRole('link', { name: '打开话题：首页话题' })).toBeVisible()

    const address = page.locator('.toolbar-address input')
    await address.fill('https://linux.do/categories')
    await page.getByRole('button', { name: '打开地址' }).click()

    const logoCard = page.locator('.category-directory-row').filter({ hasText: '预载 Logo 分类' })
    await expect(logoCard).toBeVisible()
    await expect(logoCard.locator('.category-icon-img')).toHaveAttribute(
      'src',
      'https://linux.do/uploads/default/original/preloaded-logo.png'
    )

    const iconCard = page.locator('.category-directory-row').filter({ hasText: '预载图标分类' })
    await expect(iconCard).toBeVisible()
    await expect(iconCard.locator('use')).toHaveAttribute('href', '#preloaded-icon')

    await expect
      .poll(() =>
        page.evaluate(() =>
          (globalThis as any).__categoryBrowseRequests.includes('https://linux.do/site.json')
        )
      )
      .toBe(true)
  })
})
