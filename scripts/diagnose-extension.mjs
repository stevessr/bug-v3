import path from 'path'
import os from 'os'

import { chromium } from 'playwright'
;(async () => {
  const extensionPath = path.resolve('./dist')
  const userDataDir = path.resolve('./.pw-user-data-ext-diag')
  console.log('extensionPath', extensionPath)
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  })

  console.log('context launched')
  // wait a bit for extension to register
  await new Promise((r) => setTimeout(r, 2000))

  const bgPages = context.backgroundPages()
  console.log('backgroundPages count:', bgPages.length)
  for (const p of bgPages) console.log('bg page url:', p.url())

  const sws = context.serviceWorkers()
  console.log('serviceWorkers count:', sws.length)
  for (const sw of sws) console.log('service worker url:', sw.url())

  const pages = context.pages()
  console.log('pages count:', pages.length)
  for (const p of pages) console.log('page url:', p.url())

  // list targets via CDP might help, but keeping it minimal

  await context.close()
  console.log('done')
  process.exit(0)
})()
