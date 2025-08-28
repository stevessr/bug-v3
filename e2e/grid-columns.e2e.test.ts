import { test, expect, chromium } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'

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
  async function launchExtensionAndGetId() {
    const __filename = fileURLToPath(import.meta.url)
    const __dirname = path.dirname(__filename)
    const extensionPath = path.resolve(__dirname, '..', 'dist')
    const userDataDir = path.join(__dirname, '.tmp-user-data-grid')
    const context = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
    })
    // wait for extension to load
    await new Promise((r) => setTimeout(r, 1500))
    let extensionId: string | null = null
    for (const bg of context.backgroundPages()) {
      const url = bg.url()
      const match = url.match(/^chrome-extension:\/\/([a-z]+)\//)
      if (match) {
        extensionId = match[1]
        break
      }
    }
    if (!extensionId) {
      for (const t of context.serviceWorkers()) {
        const url = t.url()
        const match = url.match(/^chrome-extension:\/\/([a-z]+)\//)
        if (match) {
          extensionId = match[1]
          break
        }
      }
    }
    return { context, extensionId }
  }

  test('options.html uses gridColumns from settings on load', async () => {
    const payload = makePayload(5)
    const { context, extensionId } = await launchExtensionAndGetId()
    if (!extensionId) {
      await context.close()
      throw new Error('extension id not found')
    }
    const optionsUrl = `chrome-extension://${extensionId}/options.html`
    const page = await context.newPage()
    await page.addInitScript((p) => {
      try {
        localStorage.setItem('bugcopilot_settings_v1', JSON.stringify(p))
      } catch (e) {}
    }, payload)
    await page.goto(optionsUrl)

    await page.waitForSelector('.ant-collapse-header')
    await page.click('.ant-collapse-header')
    await page.waitForSelector('.emoji-grid')
    const el = await page.locator('.emoji-grid').first()
    const inline = await el.getAttribute('style')
    expect(inline).toBeTruthy()
    expect(inline!.includes('repeat(5')).toBeTruthy()

    await context.close()
  })

  test('popup.html reacts to settings changes', async () => {
    const payload = makePayload(6)
    const { context, extensionId } = await launchExtensionAndGetId()
    if (!extensionId) {
      await context.close()
      throw new Error('extension id not found')
    }
    const popupUrl = `chrome-extension://${extensionId}/popup.html`
    const page = await context.newPage()
    await page.addInitScript((p) => {
      try {
        localStorage.setItem('bugcopilot_settings_v1', JSON.stringify(p))
      } catch (e) {}
    }, payload)
    await page.goto(popupUrl)
    await page.waitForSelector('.emoji-grid')
    const el = await page.locator('.emoji-grid').first()
    const inline = await el.getAttribute('style')
    expect(inline).toBeTruthy()
    expect(inline!.includes('repeat(6')).toBeTruthy()

    await context.close()
  })
})
