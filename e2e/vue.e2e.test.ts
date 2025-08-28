import path from 'path'
import { fileURLToPath } from 'url'

import { test, expect, chromium } from '@playwright/test'

test('visits the extension popup', async () => {
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = path.dirname(__filename)
  const extensionPath = path.resolve(__dirname, '..', 'dist')
  const userDataDir = path.join(__dirname, '.tmp-user-data-vue')
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  })
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
  if (!extensionId) {
    await context.close()
    throw new Error('Could not find extension id')
  }
  const page = await context.newPage()
  await page.goto(`chrome-extension://${extensionId}/popup.html`)
  // lightweight assertion: popup should contain an element with class .emoji-grid or title
  await page.waitForSelector('.emoji-grid, h1', { timeout: 10000 })
  await context.close()
})
