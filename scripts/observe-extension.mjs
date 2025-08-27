import { chromium } from 'playwright'
import path from 'path'

;(async () => {
  const extensionPath = path.resolve('./dist')
  const userDataDir = path.resolve('./.pw-user-data-observe')
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  })

  const page = await context.newPage()
  const logs = []
  page.on('console', (m) => {
    try {
      const text = String(m.text())
      logs.push(text)
      console.log('[PAGE LOG]', text)
    } catch (e) {
      console.log('[PAGE LOG] error reading console message', e)
    }
  })

  console.log('navigating to example.com')
  await page.goto('https://example.com')

  console.log('waiting 5s for content script to run...')
  await new Promise((r) => setTimeout(r, 5000))

  console.log('--- collected logs ---')
  console.log(logs.slice(0, 200))

  const btnExists = await page.$('.nacho-open-btn')
  console.log('button exists:', !!btnExists)

  await context.close()
  process.exit(0)
})()
