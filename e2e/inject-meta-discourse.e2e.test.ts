import { test, expect, chromium } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// This test requires manual login. It launches Chromium with a persistent userDataDir so
// your login session persists across runs. It navigates to meta.discourse.org and waits
// for you to log in and open the "New Topic" composer. The test then checks for content-script
// injection by listening to console messages that the content script emits (e.g. '[nacho-content]').

// Usage notes:
// - Run with: npx playwright test e2e/inject-meta-discourse.spec.ts --project=chromium
// - The test will pause and print instructions; open the launched browser, sign into meta.discourse.org
//   manually, then click the page to start a new topic. After you see the composer open, switch back
//   to the test terminal and press Enter to continue.
// - userDataDir is persisted under e2e/.meta-user-data so your login is preserved.

test('injects into meta.discourse.org new topic composer (manual login)', async () => {
  const extensionPath = path.resolve(__dirname, '..', 'dist')
  const userDataDir = path.join(__dirname, '.meta-user-data')

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  })

  const page = await context.newPage()
  await page.goto('https://meta.discourse.org/')

  console.log('\n--- Manual step required ---')
  console.log(
    '1) If not logged in, please log into https://meta.discourse.org in the opened browser.',
  )
  console.log('2) Click "New Topic" (或类似按钮) to open the composer.')
  console.log('3) When composer is open, press Enter here to continue the test.')

  // wait for user to press Enter in this terminal before proceeding
  await new Promise<void>((resolve) => {
    process.stdin.resume()
    process.stdin.once('data', () => {
      process.stdin.pause()
      resolve()
    })
  })

  // Wait briefly for the content script to run after composer opens
  await page.waitForTimeout(1500)

  // Listen to page console messages for injection markers
  const logs: string[] = []
  page.on('console', (msg) => {
    try {
      const text = String(msg.text())
      logs.push(text)
    } catch (_) {}
  })

  // Give some time for injection logs to appear
  await page.waitForTimeout(1500)

  // Look for known injection markers
  const found = logs.some((l) => l.includes('[nacho-content]') || l.includes('[content-script]'))

  // cleanup
  await context.close()

  expect(found).toBe(true)
})
