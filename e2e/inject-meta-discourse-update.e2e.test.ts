import path from 'path'
import { fileURLToPath } from 'url'

import { test, expect, chromium } from '@playwright/test'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

test('frontend updates when backend adds emoji group & emoji', async () => {
  const extensionPath = path.resolve(__dirname, '..', 'dist')
  const userDataDir = path.join(__dirname, '.meta-user-data')

  // initial payload without the new emoji
  const initial = {
    Settings: { imageScale: 30, outputFormat: 'markdown' },
    emojiGroups: [],
    ungrouped: [],
  }

  const newEmojiUrl = 'https://linux.do/user_avatar/linux.do/stevessr/96/534587_2.png'

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  })

  await context.addInitScript((p) => {
    try {
      window.localStorage.setItem('bugcopilot_settings_v1', JSON.stringify(p))
    } catch (e) {}
  }, initial)

  const page = await context.newPage()
  await page.goto('https://meta.discourse.org/')

  await page.waitForSelector('#create-topic', { timeout: 30000 })
  await page.click('#create-topic')

  const emojiButtonSelector = '.nacho-emoji-picker-button'
  await page.waitForSelector(emojiButtonSelector, { timeout: 15000 })

  // Now simulate backend adding a group+emoji by updating localStorage and dispatching the groups-changed event
  const addedGroup = {
    UUID: 'group-backend-1',
    name: 'backend-added',
    emojis: [
      {
        UUID: 'emoji-backend-1',
        name: 'backend-emoji',
        url: newEmojiUrl,
      },
    ],
  }

  await page.evaluate((g) => {
    try {
      const raw = window.localStorage.getItem('bugcopilot_settings_v1')
      const obj = raw ? JSON.parse(raw) : { Settings: {}, emojiGroups: [], ungrouped: [] }
      obj.emojiGroups = obj.emojiGroups || []
      obj.emojiGroups.push(g)
      window.localStorage.setItem('bugcopilot_settings_v1', JSON.stringify(obj))
      // dispatch groups/ settings changed so in-page listeners pick it up
      try {
        window.dispatchEvent(new CustomEvent('app:groups-changed', { detail: obj.emojiGroups }))
      } catch (e) {}
      try {
        window.dispatchEvent(new CustomEvent('app:settings-changed', { detail: obj.Settings }))
      } catch (e) {}
    } catch (e) {}
  }, addedGroup)

  // Click emoji button to open picker and verify new emoji exists
  const injected = await page.$(emojiButtonSelector)
  expect(injected).not.toBeNull()
  await injected!.click()

  const pickerSelector = '.nacho-emoji-picker, .emoji-picker, [data-identifier="emoji-picker"]'
  await page.waitForSelector(pickerSelector, { timeout: 5000 })

  const pickerHtml = await page.$eval(pickerSelector, (el) => el.outerHTML)
  expect(pickerHtml).toContain('534587_2.png')

  await context.close()
})
