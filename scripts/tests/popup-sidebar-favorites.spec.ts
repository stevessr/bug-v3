import { test, expect, type Page } from '@playwright/test'

async function seed(page: Page, defaultGroup: string) {
  await page.addInitScript(defaultGroup => {
    localStorage.clear()
    localStorage.setItem('emoji-extension-language', 'zh_CN')
    localStorage.setItem('theme', JSON.stringify('dark'))
    localStorage.setItem(
      'appSettings',
      JSON.stringify({ imageScale: 100, defaultGroup, showSearchBar: true, gridColumns: 4 })
    )
    localStorage.setItem(
      'emojiGroupIndex',
      JSON.stringify([
        { id: 'favorites', order: 0 },
        { id: 'owner', order: 1 }
      ])
    )
    localStorage.setItem(
      'emojiGroup_owner',
      JSON.stringify({
        id: 'owner',
        name: '源分组',
        icon: '',
        order: 1,
        emojis: [
          {
            id: 'one',
            groupId: 'owner',
            name: '开心',
            url: 'https://example.com/one.webp',
            customOutput: ':happy:'
          },
          { id: 'two', groupId: 'owner', name: '害羞', url: 'https://example.com/two.webp' }
        ]
      })
    )
    localStorage.setItem(
      'emojiGroup_favorites',
      JSON.stringify({
        id: 'favorites',
        name: '常用表情',
        icon: '⭐',
        order: 0,
        emojis: [
          { id: 'one', sourceGroupId: 'owner', sourceEmojiId: 'one', usageCount: 2, lastUsed: 1 }
        ]
      })
    )
    localStorage.setItem('favorites', JSON.stringify(['one']))
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async () => {} }
    })
  }, defaultGroup)
  await page.route('https://s.pwsh.us.kg/**', route => route.fulfill({ status: 404 }))
  await page.route('https://example.com/**', route => route.fulfill({ status: 404 }))
}

test('popup renders one favorite, increments its badge immediately and does not create copies', async ({
  page
}) => {
  await seed(page, 'favorites')
  await page.goto('/?mode=popup')
  await expect(page.locator('.emoji-item')).toHaveCount(1)
  await expect(page.locator('.emoji-item-badge')).toHaveText('2')
  await page.locator('.emoji-item').click()
  await expect(page.locator('.emoji-item-badge')).toHaveText('3')
  await expect(page.locator('.emoji-item')).toHaveCount(1)
  await expect(page.locator('.popup-title')).not.toHaveText('emojiManagement')
})

test('sidebar names and placeholders are translated and all-emojis excludes favorite copies', async ({
  page
}) => {
  await seed(page, 'all-emojis')
  await page.goto('/?mode=sidebar')
  await expect(page.locator('.sidebar-title')).toHaveText('表情选择器')
  await expect(page.getByPlaceholder('搜索表情名称或标签...')).toBeVisible()
  await expect(page.locator('.sidebar-search-result-info')).toContainText('共 2 个表情')
  await expect(page.locator('.emoji-item')).toHaveCount(2)
  await expect(page.locator('.emoji-item-badge')).toHaveText('2')
  await expect(page.locator('body')).not.toContainText('virtualGroup')
  await expect(page.locator('body')).not.toContainText('{count}')
})

test('dark settings labels remain visible and have contrasting theme colors', async ({ page }) => {
  await seed(page, 'owner')
  await page.goto('/?mode=options#/settings')
  await page.getByRole('tab', { name: '开关', exact: true }).click()
  const label = page.locator('.setting-switch label').filter({ hasText: '快捷表情选取' })
  await expect(label).toBeVisible()
  const colors = await label.evaluate(element => ({
    text: getComputedStyle(element).color,
    background: getComputedStyle(document.querySelector('.options-root')!).backgroundColor
  }))
  expect(colors.text).not.toBe(colors.background)
  expect(colors.text).not.toBe('rgba(0, 0, 0, 0)')
})
