import { expect, test, type Page } from '@playwright/test'
import { build } from 'vite'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

let output: string
const box = '#color-suggestion-box'

test.beforeAll(async () => {
  output = await mkdtemp(path.join(tmpdir(), 'color-suggestions-'))
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
        entry: path.resolve('scripts/tests/color-suggestions.entry.ts'),
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
  await page.route('**/color-fixture/**', async route => {
    const file = new URL(route.request().url()).pathname.split('/color-fixture/')[1]
    await route.fulfill({
      body: await readFile(path.join(output, file)),
      contentType: 'text/javascript'
    })
  })
  await page.route('**/color-test.html', route =>
    route.fulfill({
      body: `
        <textarea id="plain-editor"></textarea>
        <div class="ProseMirror d-editor-input" contenteditable="true">
          <p id="rich-line">rich</p>
          <pre><code id="code-line">code</code></pre>
        </div>
      `,
      contentType: 'text/html'
    })
  )
  await page.goto('http://localhost:4189/color-test.html')
  await page.evaluate(async () => {
    const module = await import('/color-fixture/entry.js')
    ;(window as any).color = module
    module.initColorSuggestions()
  })
}

const menuVisible = (page: Page) =>
  page.evaluate(() => {
    const element = document.querySelector('#color-suggestion-box')
    return !!element && (element as HTMLElement).style.display !== 'none'
  })

const caret = (page: Page, selector = '#plain-editor') =>
  page.evaluate(sel => {
    const element = document.querySelector(sel) as HTMLTextAreaElement
    return [element.selectionStart, element.selectionEnd]
  }, selector)

test('inserts a color pair, keeps the caret between tags and stays undoable', async ({ page }) => {
  await fixture(page)
  const editor = page.locator('#plain-editor')
  await editor.pressSequentially('[co')
  await expect.poll(() => menuVisible(page)).toBe(true)
  await editor.press('Enter')
  await expect(editor).toHaveValue('[color=#ff0000][/color]')
  await expect.poll(() => caret(page)).toEqual([15, 15])
  await expect.poll(() => menuVisible(page)).toBe(false)
  await editor.press('Control+z')
  await expect(editor).toHaveValue('[co')
})

test('editing inside an existing color updates the tag instead of nesting', async ({ page }) => {
  await fixture(page)
  const editor = page.locator('#plain-editor')
  await editor.fill('[color=#000000]hello[/color]')
  await page.evaluate(() => {
    const element = document.querySelector('#plain-editor') as HTMLTextAreaElement
    element.focus()
    element.setSelectionRange(15, 15)
  })
  await editor.pressSequentially('[co')
  await expect.poll(() => menuVisible(page)).toBe(true)
  await editor.press('Enter')
  await expect(editor).toHaveValue('[color=#ff0000]hello[/color]')
})

test('wraps the current selection and honors the HEX/RGB/HSL switch', async ({ page }) => {
  await fixture(page)
  const editor = page.locator('#plain-editor')
  await editor.fill('[cohello')
  await page.evaluate(() => {
    const element = document.querySelector('#plain-editor') as HTMLTextAreaElement
    element.focus()
    element.setSelectionRange(3, 3)
    element.dispatchEvent(
      new InputEvent('input', { bubbles: true, inputType: 'insertText', data: 'o' })
    )
  })
  await expect.poll(() => menuVisible(page)).toBe(true)
  await page.locator(box).locator('.cs-format-btn[data-fmt="rgb"]').click()
  await page.evaluate(() => {
    const element = document.querySelector('#plain-editor') as HTMLTextAreaElement
    element.setSelectionRange(3, 8)
  })
  await editor.press('Enter')
  await expect(editor).toHaveValue('[color=rgb(255, 0, 0)]hello[/color]')
})

test('ProseMirror inserts, wraps and never triggers inside code blocks', async ({ page }) => {
  await fixture(page)
  const editor = page.locator('.ProseMirror')

  await page.click('#rich-line')
  await page.keyboard.press('End')
  await page.keyboard.type(' [co')
  await expect.poll(() => menuVisible(page)).toBe(true)
  await page.keyboard.press('Enter')
  await expect(page.locator('#rich-line')).toHaveText('rich [color=#ff0000][/color]')

  await page.click('#code-line')
  await page.keyboard.press('End')
  await page.keyboard.type(' [co')
  await expect.poll(() => menuVisible(page)).toBe(false)
})
