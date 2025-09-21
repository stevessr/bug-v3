// Headless verification script for GET_EMOJI_DATA filtering (CommonJS version)
// Usage: node scripts/headless-verify-getEmojiData.cjs

const path = require('path')
const { chromium } = require('playwright')

;(async () => {
  const extensionPath = path.resolve(__dirname, '..', 'dist')
  console.log('Using extension at', extensionPath)

  const userDataDir = path.join(__dirname, '.profile-' + Date.now())

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: true,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`
    ]
  })

  try {
    const pages = context.pages()
    console.log('Initial pages count:', pages.length)

    const page = pages.length ? pages[0] : await context.newPage()

    const sendMessage = async (msg) => {
      return await page.evaluate(async (message) => {
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
    }

    const testDomain = 'example-headless.local'
    const msg = { type: 'GET_EMOJI_DATA', sourceDomain: testDomain }
    console.log('Sending message to extension background:', msg)
    const result = await sendMessage(msg)
    console.log('Runtime.sendMessage result:', JSON.stringify(result, null, 2))

    const stored = await page.evaluate(async () => {
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

    console.log('Storage discourseDomains:', JSON.stringify(stored, null, 2))

    await context.close()
    console.log('Done')
  } catch (e) {
    console.error('Error during headless verify:', e)
    try { await context.close() } catch (_) {}
    process.exit(1)
  }
})()
