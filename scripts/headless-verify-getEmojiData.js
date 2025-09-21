// Headless verification script for GET_EMOJI_DATA filtering
// Usage: node scripts/headless-verify-getEmojiData.js
// This uses Playwright to load the unpacked extension in a Chromium instance

const path = require('path')
const { chromium } = require('playwright')

;(async () => {
  const extensionPath = path.resolve(__dirname, '..', 'dist')
  console.log('Using extension at', extensionPath)

  const userDataDir = path.join(__dirname, '.profile-' + Date.now())

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: true, // headless
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`
    ]
  })

  try {
    // Wait for background page / service worker
    const targets = context.backgroundPages()
    // backgroundPages() may be empty for MV3; use service workers via targets
    const pages = context.pages()

    console.log('Initial pages count:', pages.length)

    // Enumerate background/service worker targets
    const serviceWorkers = context.serviceWorkers()
    console.log('Service workers count:', serviceWorkers.length)

    // We'll execute in the extension's background context by evaluating chrome.runtime.sendMessage
    // Find an extension page to run runtime message; fallback to evaluating in any page

    const page = pages.length ? pages[0] : await context.newPage()

    // Helper that runs in page context to call chrome.runtime.sendMessage
    const sendMessage = async (msg) => {
      return await page.evaluate(async (message) => {
        return new Promise((resolve) => {
          try {
            // eslint-disable-next-line no-undef
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

    // send a message with sourceDomain that likely doesn't exist
    const testDomain = 'example-headless.local'
    const msg = { type: 'GET_EMOJI_DATA', sourceDomain: testDomain }
    console.log('Sending message to extension background:', msg)
    const result = await sendMessage(msg)
    console.log('Runtime.sendMessage result:', result)

    // Now read storage.discourseDomains via chrome.storage (evaluate in page)
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

    console.log('Storage discourseDomains:', stored)

    await context.close()
    console.log('Done')
  } catch (e) {
    console.error('Error during headless verify:', e)
    try { await context.close() } catch (_) {}
    process.exit(1)
  }
})()
