import { test, expect, chromium } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// This test launches chromium with the unpacked extension located at the repository's `dist` folder.
// It requires Playwright to run locally and Chromium available on the host.

test('sync pipeline end-to-end (unpacked dist)', async () => {
  // adjust this path if your workspace differs
  const extensionPath = path.resolve(__dirname, '..', 'dist')

  const userDataDir = path.join(__dirname, '.tmp-user-data')

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  })

  // Wait a bit for extension to load
  await new Promise((resolve) => setTimeout(resolve, 2000))

  // Find extension id by inspecting background pages
  let extensionId: string | null = null
  for (const bg of context.backgroundPages()) {
    const url = bg.url()
    const match = url.match(/^chrome-extension:\/\/([a-z]+)\//)
    if (match) {
      extensionId = match[1]
      break
    }
  }

  // fallback: try service worker targets
  if (!extensionId) {
    // inspect service workers in context — may not be present in headless
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
    throw new Error('Could not find extension id; ensure extension loaded from dist')
  }

  const optionsUrl = `chrome-extension://${extensionId}/options.html`

  const page = await context.newPage()
  await page.goto(optionsUrl)

  // capture logs from the options page
  page.on('console', (msg) => console.log('options page console>', msg.text()))

  // Navigate to settings tab
  await page.waitForSelector('.ant-menu-item')
  await page.click('.ant-menu-item:has-text("设置")')

  // Wait for settings form to render
  await page.waitForSelector('.ant-form')

  // Change grid columns select to '5'
  const gridColumnsSelect = '.ant-form-item:has-text("列数") .ant-select'
  await page.click(gridColumnsSelect)
  await page.click('.ant-select-item:has-text("5")')
  // simpler: set select value via evaluate
  await page.evaluate(() => {
    try {
      // set gridColumns in localStorage fallback if Vue not ready
      const key = 'bugcopilot_settings_v1'
      const raw = window.localStorage.getItem(key)
      if (raw) {
        const obj = JSON.parse(raw)
        obj.Settings = obj.Settings || {}
        obj.Settings.gridColumns = 5
        window.localStorage.setItem(key, JSON.stringify(obj))
      }
    } catch (e) {}
  })

  // wait a little for background to pick up and sync
  await page.waitForTimeout(3000)

  // open a second tab to verify sessionStorage was applied
  const other = await context.newPage()
  await other.goto('https://example.com')
  // give content script a moment to receive the session sync
  await other.waitForTimeout(1500)

  const sessionValue = await other.evaluate(() => {
    try {
      return window.sessionStorage.getItem('bugcopilot_settings_v1')
    } catch (_) {
      return null
    }
  })

  expect(sessionValue).not.toBeNull()

  // check extended_payload in chrome.storage.local via both background pages and service workers
  const bgPages = [...context.backgroundPages(), ...context.serviceWorkers()]
  let extendedExists = false
  for (const bg of bgPages) {
    try {
      const val = await bg.evaluate(() => {
        return new Promise((resolve: any) => {
          try {
            // @ts-ignore - runtime chrome exists in extension background page or service worker
            chrome.storage.local.get(['extended_payload'], (res: any) =>
              resolve(Boolean(res?.extended_payload)),
            )
          } catch (e) {
            resolve(false)
          }
        })
      })
      if (val) {
        extendedExists = true
        break
      }
    } catch (_) {}
  }

  expect(extendedExists).toBe(true)

  await context.close()
})
