// Auto Playwright launcher: tries to find system Chrome/Chromium and use it to run headless verify
// Usage: node scripts/headless-verify-getEmojiData-auto.cjs

const fs = require('fs')
const path = require('path')
const { chromium } = require('playwright')

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/snap/bin/chromium',
    '/usr/bin/google-chrome-unstable',
    '/opt/google/chrome/chrome'
  ].filter(Boolean)

  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return p
    } catch (e) {}
  }
  return null
}

;(async () => {
  const chromePath = findChrome()
  if (!chromePath) {
    console.error('No system Chrome/Chromium found. Try setting CHROME_PATH env var to your Chrome executable.')
    process.exit(1)
  }
  console.log('Found Chrome executable at', chromePath)

  const extensionPath = path.resolve(__dirname, '..', 'dist')
  console.log('Using extension at', extensionPath)

  const userDataDir = path.join(__dirname, '.profile-' + Date.now())

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: true,
    executablePath: chromePath,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--no-sandbox',
      '--disable-setuid-sandbox'
    ]
  })

  try {
    // Try to find an extension background page first
    const bgPages = context.backgroundPages()
    console.log('backgroundPages count:', bgPages.length)
    bgPages.forEach((p, i) => console.log(`bgPage[${i}] url:`, p.url()))

    // Try service workers
    const sws = context.serviceWorkers()
    console.log('serviceWorkers count:', sws.length)
    sws.forEach((w, i) => console.log(`serviceWorker[${i}] url:`, w.url()))

    let execContext = null

    if (bgPages.length) {
      execContext = { type: 'page', ctx: bgPages[0] }
    } else if (sws.length) {
      execContext = { type: 'worker', ctx: sws[0] }
    } else {
      // fallback to a normal page (may not have chrome.*)
      const pages = context.pages()
      execContext = { type: 'page', ctx: pages.length ? pages[0] : await context.newPage() }
    }

    // small delay to allow extension background to initialize
    await new Promise(r => setTimeout(r, 1000))

    const testDomain = 'example-headless.local'
    const msg = { type: 'GET_EMOJI_DATA', sourceDomain: testDomain }
    console.log('Sending message to extension background via', execContext.type, 'ctx')

    let result
    if (execContext.type === 'page') {
      result = await execContext.ctx.evaluate(async (message) => {
        return new Promise((resolve) => {
          try {
            if (!chrome || !chrome.runtime || !chrome.runtime.sendMessage) {
              resolve({ error: 'chrome.runtime.sendMessage not available in this context' })
              return
            }
            chrome.runtime.sendMessage(message, (resp) => { resolve({ resp, lastError: chrome.runtime.lastError || null }) })
          } catch (e) {
            resolve({ error: String(e) })
          }
        })
      }, msg)
    } else {
      // service worker
      result = await execContext.ctx.evaluate(async (message) => {
        try {
          // In service worker context, chrome.runtime is available
          return await (async () => new Promise((resolve) => {
            try {
              chrome.runtime.sendMessage(message, (resp) => { resolve({ resp, lastError: chrome.runtime.lastError || null }) })
            } catch (e) { resolve({ error: String(e) }) }
          }))()
        } catch (e) {
          return { error: String(e) }
        }
      }, msg)
    }

    console.log('Runtime.sendMessage result:', JSON.stringify(result, null, 2))

    let stored
    if (execContext.type === 'page') {
      stored = await execContext.ctx.evaluate(async () => {
        return new Promise((resolve) => {
          try {
            chrome.storage.local.get(['discourseDomains'], (items) => {
              resolve({ err: chrome.runtime.lastError || null, items })
            })
          } catch (e) {
            resolve({ error: String(e) })
          }
        })
      })
    } else {
      // service worker: try to read via chrome.storage directly
      stored = await execContext.ctx.evaluate(async () => {
        return new Promise((resolve) => {
          try {
            chrome.storage.local.get(['discourseDomains'], (items) => {
              resolve({ err: chrome.runtime.lastError || null, items })
            })
          } catch (e) {
            resolve({ error: String(e) })
          }
        })
      })
    }

    console.log('Storage discourseDomains:', JSON.stringify(stored, null, 2))

    await context.close()
    console.log('Done')
  } catch (e) {
    console.error('Error during headless verify:', e)
    try { await context.close() } catch (_) {}
    process.exit(1)
  }
})()
