import { expect, test, type Page } from '@playwright/test'
import { build } from 'vite'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

let output: string
const box = '#callout-suggestion-box-en'

test.beforeAll(async () => {
  output = await mkdtemp(path.join(tmpdir(), 'callout-suggestions-'))
  await build({
    configFile: false,
    logLevel: 'error',
    resolve: {
      alias: [
        {
          find: '@/content/utils/injectCustomCss',
          replacement: path.resolve('scripts/tests/callout-suggestions.stub.ts')
        },
        { find: '@', replacement: path.resolve('src') }
      ]
    },
    build: {
      outDir: output,
      minify: false,
      lib: {
        entry: path.resolve('scripts/tests/callout-suggestions.entry.ts'),
        formats: ['es'],
        fileName: () => 'entry.js'
      }
    }
  })
})

test.afterAll(async () => {
  await rm(output, { recursive: true, force: true })
})

async function fixture(page: Page) {
  await page.route('**/callout-fixture/**', async route => {
    const file = new URL(route.request().url()).pathname.split('/callout-fixture/')[1]
    await route.fulfill({
      body: await readFile(path.join(output, file)),
      contentType: 'text/javascript'
    })
  })
  await page.route('**/callout-test.html', route =>
    route.fulfill({
      body: `
        <textarea id="plain-editor"></textarea>
        <div class="ProseMirror d-editor-input" contenteditable="true">
          <p id="plain-line">plain</p>
          <blockquote><p id="quote-line"><br /></p></blockquote>
        </div>
      `,
      contentType: 'text/html'
    })
  )
  await page.goto('http://localhost:4189/callout-test.html')
  await page.evaluate(async () => {
    const module = await import('/callout-fixture/entry.js')
    ;(window as any).callout = module
    module.initCalloutSuggestions()
  })
}

const suggestionsVisible = (page: Page) =>
  page.evaluate(() => {
    const element = document.querySelector('#callout-suggestion-box-en')
    return !!element && (element as HTMLElement).style.display !== 'none'
  })

test('plain text never opens the callout suggestions', async ({ page }) => {
  await fixture(page)
  const editor = page.locator('#plain-editor')
  await editor.pressSequentially('hello [!no')
  await expect.poll(() => suggestionsVisible(page)).toBe(false)
})

test('blockquote lines trigger the suggestions and complete the keyword', async ({ page }) => {
  await fixture(page)
  const editor = page.locator('#plain-editor')
  await editor.pressSequentially('> [!no')
  await expect.poll(() => suggestionsVisible(page)).toBe(true)
  await editor.press('Enter')
  await expect(editor).toHaveValue('> [!note]')

  await editor.fill('')
  await editor.pressSequentially(' > ［！no')
  await expect.poll(() => suggestionsVisible(page)).toBe(true)
  await editor.press('Escape')
  await expect.poll(() => suggestionsVisible(page)).toBe(false)
})

test('a blockquote line with leading text does not trigger', async ({ page }) => {
  await fixture(page)
  const editor = page.locator('#plain-editor')
  await editor.pressSequentially('> some text [!no')
  await expect.poll(() => suggestionsVisible(page)).toBe(false)
})

test('ProseMirror blockquotes trigger, ordinary blocks do not', async ({ page }) => {
  await fixture(page)
  const editor = page.locator('.ProseMirror')

  await page.click('#plain-line')
  await page.keyboard.press('End')
  await page.keyboard.type('[!no')
  await expect.poll(() => suggestionsVisible(page)).toBe(false)

  await page.click('#quote-line')
  await page.keyboard.type('[!no')
  await expect.poll(() => suggestionsVisible(page)).toBe(true)
  await page.keyboard.press('Enter')
  await expect(page.locator('#quote-line')).toHaveText('[!note]')
})
