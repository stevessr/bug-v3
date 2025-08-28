import path from 'path'
import { fileURLToPath } from 'url'

import { test, expect, chromium } from '@playwright/test'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

test('automated: injects and opens emoji picker on meta.discourse', async () => {
  const extensionPath = path.resolve(__dirname, '..', 'dist')
  const userDataDir = path.join(__dirname, '.meta-user-data')

  // Prepare a payload that should be shown by the picker. We'll write it to localStorage
  // before the page loads so the content-script/ picker will read the stored payload.
  const payload = {
    Settings: { imageScale: 50, outputFormat: 'markdown' },
    emojiGroups: [
      {
        UUID: 'group-1',
        name: 'test-group',
        emojis: [
          {
            UUID: 'emoji-1',
            name: 'test-emoji',
            url: 'https://linux.do/uploads/default/optimized/4X/5/9/f/59ffbc2c53dd2a07dc30d4368bd5c9e01ca57d80_2_490x500.jpeg',
          },
        ],
      },
    ],
    ungrouped: [],
  }

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  })

  // Ensure the page has the payload available before any script runs
  await context.addInitScript((p) => {
    try {
      window.localStorage.setItem('bugcopilot_settings_v1', JSON.stringify(p))
    } catch (e) {
      // ignore
    }
  }, payload)

  const page = await context.newPage()
  await page.goto('https://meta.discourse.org/')

  // Wait for the create topic button and click it
  await page.waitForSelector('#create-topic', { timeout: 30000 })
  await page.click('#create-topic')

  // Wait some time for extension injection to run and add the emoji button
  const emojiButtonSelector = '.nacho-emoji-picker-button'
  await page.waitForSelector(emojiButtonSelector, { timeout: 15000 })

  // Verify the injected button exists
  const injected = await page.$(emojiButtonSelector)
  expect(injected).not.toBeNull()

  // Click the injected button to open the picker
  await injected!.click()

  // Wait for emoji picker to appear (class used by the injected template)
  const pickerSelector = '.nacho-emoji-picker, .emoji-picker, [data-identifier="emoji-picker"]'
  await page.waitForSelector(pickerSelector, { timeout: 5000 })

  // Verify picker shows the emoji we put into localStorage by checking the picker's HTML
  await page.waitForSelector(`${pickerSelector} img`, { timeout: 5000 })
  const pickerHtml = await page.$eval(pickerSelector, (el) => el.outerHTML)
  expect(pickerHtml).toContain('59ffbc2c53dd2')

  await context.close()
})
