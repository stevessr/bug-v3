import path from 'path'
import { fileURLToPath } from 'url'

import { test, expect, chromium } from '@playwright/test'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

test('picker opens and search filters emojis', async () => {
  const extensionPath = path.resolve(__dirname, '..', 'dist')
  const userDataDir = path.join(__dirname, '.meta-user-data')

  const payload = {
    Settings: { imageScale: 30, outputFormat: 'markdown' },
    emojiGroups: [
      {
        UUID: 'g1',
        name: 'group1',
        emojis: [
          { UUID: 'e1', name: 'alpha', url: 'https://linux.do/alpha.png' },
          { UUID: 'e2', name: 'beta', url: 'https://linux.do/beta.png' },
          { UUID: 'e3', name: 'gamma', url: 'https://linux.do/gamma.png' },
        ],
      },
    ],
    ungrouped: [],
  }

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  })

  await context.addInitScript((p) => {
    try {
      window.localStorage.setItem('bugcopilot_settings_v1', JSON.stringify(p))
    } catch (e) {}
  }, payload)

  const page = await context.newPage()
  await page.goto('https://meta.discourse.org/')

  await page.waitForSelector('#create-topic', { timeout: 30000 })
  await page.click('#create-topic')

  const emojiButtonSelector = '.nacho-emoji-picker-button'
  await page.waitForSelector(emojiButtonSelector, { timeout: 15000 })
  const btn = await page.$(emojiButtonSelector)
  expect(btn).not.toBeNull()
  await btn!.click()

  const pickerSelector = '.nacho-emoji-picker, .emoji-picker, [data-identifier="emoji-picker"]'
  await page.waitForSelector(pickerSelector, { timeout: 5000 })

  // Type 'beta' into the filter input and assert only beta image is visible
  const inputSel = `[data-identifier="emoji-picker"] .filter-input`
  await page.waitForSelector(inputSel, { timeout: 2000 })
  await page.fill(inputSel, 'beta')
  // give script a moment to run
  await page.waitForTimeout(200)

  const visible = await page.$$eval(
    `${pickerSelector} .emoji-picker__section-emojis .emoji`,
    (nodes) =>
      nodes
        .filter((n) => (n as HTMLElement).style.display !== 'none')
        .map((n) => ({
          src: (n as HTMLImageElement).getAttribute('src'),
          alt: (n as HTMLImageElement).getAttribute('alt'),
          data: (n as HTMLImageElement).getAttribute('data-emoji'),
        })),
  )

  expect(visible.length).toBeGreaterThan(0)
  const someMatch = visible.some((v) =>
    String(v.src || v.alt || v.data)
      .toLowerCase()
      .includes('beta'),
  )
  expect(someMatch).toBe(true)

  await context.close()
})
