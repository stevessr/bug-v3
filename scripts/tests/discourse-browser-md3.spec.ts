import { expect, test } from '@playwright/test'

test.describe('Discourse browser MD3 shell', () => {
  test('renders the top app bar, tabs, and modal navigation drawer', async ({ page }) => {
    await page.goto('/discourse.html')

    const browser = page.locator('.discourse-browser')
    await expect(browser).toBeVisible()
    await expect(page.getByRole('banner')).toBeVisible()
    await expect(page.getByRole('search')).toBeVisible()
    await expect(page.getByRole('tab', { selected: true })).toBeVisible()

    const shape = await browser.evaluate(element =>
      getComputedStyle(element).getPropertyValue('--d-shape-xl').trim()
    )
    expect(shape).toBe('28px')

    const drawerTrigger = page.getByRole('button', { name: '打开快捷导航' })
    await drawerTrigger.click()

    const drawer = page.getByRole('dialog', { name: '快捷导航' })
    await expect(drawer).toBeVisible()
    await expect(page.getByRole('button', { name: '关闭侧栏' })).toBeFocused()

    await page.keyboard.press('Escape')
    await expect(drawer).toBeHidden()
    await expect(drawerTrigger).toBeFocused()
  })

  test('keeps the compact layout inside a phone viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/discourse.html')

    await expect(page.locator('.toolbar-address')).toBeVisible()
    await expect(page.getByRole('button', { name: '打开地址' })).toContainText('前往')

    const horizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    )
    expect(horizontalOverflow).toBe(0)
  })
})
