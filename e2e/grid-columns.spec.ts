import { test, expect } from '@playwright/test'

function makePayload(gridColumns: number) {
  return {
    Settings: {
      imageScale: 30,
      defaultEmojiGroupUUID: '00000000-0000-0000-0000-000000000000',
      gridColumns,
      outputFormat: 'markdown',
      MobileMode: false,
      sidebarCollapsed: false,
      lastModified: new Date().toISOString(),
    },
    emojiGroups: [
      {
        UUID: 'g1',
        displayName: 'Group 1',
        emojis: [
          { UUID: 'e1', displayUrl: 'https://example.com/1.png' },
          { UUID: 'e2', displayUrl: 'https://example.com/2.png' },
        ],
      },
    ],
  }
}

test.describe('grid columns (Playwright)', () => {
  test('options.html uses gridColumns from settings on load', async ({ page }) => {
    const payload = makePayload(5)
    await page.addInitScript((p) => {
      try {
        localStorage.setItem('bugcopilot_settings_v1', JSON.stringify(p))
      } catch (e) {}
    }, payload)
    await page.goto('/options.html')
    await page.waitForSelector('.emoji-grid')
    const el = await page.locator('.emoji-grid').first()
    const inline = await el.getAttribute('style')
    expect(inline).toBeTruthy()
    expect(inline!.includes('repeat(5')).toBeTruthy()
  })

  test('popup.html reacts to settings changes', async ({ page }) => {
    const payload = makePayload(6)
    await page.addInitScript((p) => {
      try {
        localStorage.setItem('bugcopilot_settings_v1', JSON.stringify(p))
      } catch (e) {}
    }, payload)
    await page.goto('/popup.html')
    await page.waitForSelector('.emoji-grid')
    const el = await page.locator('.emoji-grid').first()
    const inline = await el.getAttribute('style')
    expect(inline).toBeTruthy()
    expect(inline!.includes('repeat(6')).toBeTruthy()
  })
})
