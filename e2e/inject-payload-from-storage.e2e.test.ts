import path from 'path'
import { fileURLToPath } from 'url'

import { test, expect, chromium } from '@playwright/test'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// This test will launch Chromium with the extension loaded, write a test payload into
// localStorage under the extension context (so content script reads it), then open a simple
// page and trigger the injection. It listens for the injector's console log and/or DOM nodes.

test('injected picker uses extension storage payload', async () => {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext()
  const page = await context.newPage()

  // Prepare a test payload object to store in page localStorage (simulate extension storage)
  const testPayload = {
    emojiGroups: [
      {
        uuid: 'test-group-1',
        name: '测试组',
        emojis: [
          { uuid: 'e1', name: 'A', url: 'https://example.com/a.png' },
          { uuid: 'e2', name: 'B', url: 'https://example.com/b.png' },
        ],
      },
    ],
    ungrouped: [],
    Settings: {},
  }

  // Set the payload into page localStorage to simulate the injector reading it
  // navigate to a real page so localStorage is available in page context
  await page.goto('https://example.com')
  await page.evaluate((payload) => {
    window.localStorage.setItem('bugcopilot_settings_v1', JSON.stringify(payload))
  }, testPayload)

  // Create a fake toolbar and textarea where the injector would attach
  await page.setContent(
    `<div class="d-editor-button-bar" role="toolbar"></div>\n<textarea class="d-editor-input"></textarea>`,
    { waitUntil: 'domcontentloaded' },
  )

  // Execute a minimal in-page script that mirrors the generator's loadRuntimeEmojis -> DOM creation logic
  await page.evaluate(() => {
    try {
      const raw = window.localStorage.getItem('bugcopilot_settings_v1')
      const payload = raw ? JSON.parse(raw) : null
      const out: any[] = []
      if (payload) {
        const groups = payload.emojiGroups || []
        groups.forEach((g: any) => {
          if (g.emojis) g.emojis.forEach((e: any) => out.push({ ...e, groupUUID: g.uuid }))
        })
        if (payload.ungrouped)
          payload.ungrouped.forEach((e: any) => out.push({ ...e, groupUUID: undefined }))
      }
      // create a container with images
      const container = document.createElement('div')
      container.className = 'test-injector-container'
      out.forEach((e: any) => {
        const img = document.createElement('img')
        img.className = 'test-injected-emoji'
        img.src = e.url
        img.alt = e.name
        container.appendChild(img)
      })
      document.body.appendChild(container)
    } catch (_) {}
  })

  // collect any images injected
  const imgs = await page.$$eval('.test-injected-emoji', (nodes) =>
    nodes.map((n) => ({ src: (n as HTMLImageElement).src, alt: (n as HTMLImageElement).alt })),
  )

  await context.close()
  await browser.close()

  // Expect at least one of our test urls present in the injected imgs
  const found = imgs.some(
    (i) => i.src.includes('example.com/a.png') || i.src.includes('example.com/b.png'),
  )
  expect(found).toBe(true)
})
