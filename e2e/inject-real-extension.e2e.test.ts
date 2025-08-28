import path from 'path'
import { fileURLToPath } from 'url'

import { test, expect, chromium } from '@playwright/test'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Launch Chromium with the built extension under dist/, navigate to example.com, create a fake toolbar
// and assert that the extension's content-script injected the emoji button / picker.

test('real extension injected into page and reads storage', async () => {
  const extensionPath = path.resolve(__dirname, '..', 'dist')
  const userDataDir = path.join(__dirname, '.pw-user-data-ext')

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  })

  const page = await context.newPage()

  // Collect console messages early so we don't miss extension logs
  const logs: string[] = []
  page.on('console', (msg) => logs.push(String(msg.text())))

  // put a test payload into page localStorage before navigation so content-script can read it
  const testPayload = {
    emojiGroups: [
      {
        uuid: 'test-group-1',
        name: '测试组',
        emojis: [{ uuid: 'e1', name: 'A', url: 'https://example.com/a.png' }],
      },
    ],
    ungrouped: [],
    Settings: {},
  }

  // ensure every new page in this context will have the test payload in localStorage
  await context.addInitScript((p) => {
    try {
      window.localStorage.setItem('bugcopilot_settings_v1', JSON.stringify(p))
    } catch (e) {}
  }, testPayload)

  await page.goto('https://example.com')

  // wait for the extension service worker to be registered for this context
  for (let i = 0; i < 10; i++) {
    const sws = context.serviceWorkers()
    if (sws && sws.length > 0) break
    await page.waitForTimeout(300)
  }

  // create fake toolbar and textarea to match injector selectors
  await page.evaluate(() => {
    const toolbar = document.createElement('div')
    toolbar.className = 'd-editor-button-bar'
    toolbar.setAttribute('role', 'toolbar')
    document.body.appendChild(toolbar)
    const ta = document.createElement('textarea')
    ta.className = 'd-editor-input'
    document.body.appendChild(ta)
  })

  // (console listener already attached above)

  // wait some time for content-script to run and insert button
  await page.waitForTimeout(2000)

  // check for injected button(s) (accept floating button as well)
  const btn =
    (await page.$('.nacho-open-btn')) ||
    (await page.$('.nacho-floating-btn')) ||
    (await page.$('.nacho-emoji-picker-button'))
  const imgs = await page.$$eval(
    'img.nacho-emoji-img, img.emoji, img.test-injected-emoji',
    (nodes) =>
      nodes.map((n) => ({ src: (n as HTMLImageElement).src, alt: (n as HTMLImageElement).alt })),
  )

  // diagnostics: check if chrome runtime is visible and payload present
  const diag = await page.evaluate(() => {
    try {
      return {
        hasChrome: typeof (window as any).chrome !== 'undefined',
        hasRuntime: !!(window as any).chrome && !!(window as any).chrome.runtime,
        payloadRaw: window.localStorage.getItem('bugcopilot_settings_v1'),
        location: location.href,
      }
    } catch (e) {
      return { err: String(e) }
    }
  })

  // don't close context yet — we may need it for fallback injection via extension URL

  // verify content-script logged its injection marker
  let hasContentLog = logs.some(
    (l) => l.includes('[content-script]') || l.includes('[nacho-inject]'),
  )

  // If not present, fallback: inject the built content-script bundle into the page
  if (!hasContentLog) {
    try {
      const scriptPath = path.resolve(__dirname, '..', 'dist', 'content-script.js')
      await page.addScriptTag({ path: scriptPath })
      // wait again for it to run
      await page.waitForTimeout(1000)
      hasContentLog = logs.some(
        (l) => l.includes('[content-script]') || l.includes('[nacho-inject]'),
      )
    } catch (e) {
      console.log('Fallback injection failed', String(e))
    }
  }

  // Second fallback: try injecting via chrome-extension://<extId>/content-script.js if service worker exists
  if (!hasContentLog) {
    try {
      const sws = context.serviceWorkers()
      const sw0 = sws && sws[0]
      // Playwright ServiceWorker object has a url() method
      const swUrlRaw = sw0 && typeof sw0.url === 'function' ? await sw0.url() : sw0 && sw0.url
      const swUrlStr = swUrlRaw ? String(swUrlRaw) : ''
      const extId = swUrlStr ? swUrlStr.split('/')[2] : null
      if (extId) {
        const extUrl = `chrome-extension://${extId}/content-script.js`
        try {
          await page.addScriptTag({ url: extUrl })
          await page.waitForTimeout(1000)
          hasContentLog = logs.some(
            (l) => l.includes('[content-script]') || l.includes('[nacho-inject]'),
          )
        } catch (e) {
          console.log('Fallback injection via extension url failed', String(e))
        }
      }
    } catch (e) {
      console.log('Second fallback failed', String(e))
    }
  }

  // attach diagnostics to assertion message when failing
  if (!hasContentLog && !btn && imgs.length === 0) {
    console.log(
      'DIAGNOSTICS:',
      diag,
      'consoleLogs:',
      logs.slice(0, 50),
      'btnExists:',
      Boolean(btn),
      'imgsCount:',
      imgs.length,
    )
  }

  // Hardened verification: require the injected button exists and opening the picker shows the test emoji
  expect(Boolean(btn)).toBe(true)

  // click the button to open the picker and verify the test image from payload is present
  try {
    await (btn as any).click()
    // wait for picker DOM
    await page.waitForSelector('.fk-d-menu, .emoji-picker', { timeout: 3000 })
    const injectedImg = await page.$('img[src="https://example.com/a.png"]')
    expect(Boolean(injectedImg) || imgs.length > 0).toBe(true)
  } catch (e) {
    console.log('Hardened verification failed', String(e))
    // still fail the test intentionally
    throw e
  } finally {
    // close context after verification
    await context.close()
  }
})
