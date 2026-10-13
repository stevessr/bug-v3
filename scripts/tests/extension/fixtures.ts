import { chromium, expect, test as base, type BrowserContext, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'path'

type ExtensionFixtures = {
  context: BrowserContext
  page: Page
  extensionId: string
}

export const test = base.extend<ExtensionFixtures>({
  context: async ({}, use) => {
    const extensionPath = path.resolve(process.env.EXTENSION_DIST || 'dist')
    const executablePath =
      process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ||
      ['/usr/bin/chromium', '/usr/bin/chromium-browser'].find(candidate => fs.existsSync(candidate))
    const context = await chromium.launchPersistentContext('', {
      headless: process.env.PLAYWRIGHT_HEADLESS !== 'false',
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--disable-web-security',
        '--no-sandbox'
      ],
      ...(executablePath ? { executablePath } : { channel: 'chromium' })
    })

    await use(context)
    await context.close()
  },
  page: async ({ context }, use) => {
    const page = await context.newPage()
    await use(page)
    await page.close()
  },
  extensionId: async ({ context }, use) => {
    const serviceWorker =
      context.serviceWorkers()[0] || (await context.waitForEvent('serviceworker'))
    await use(new URL(serviceWorker.url()).host)
  }
})

export { expect }
export type { Page }
