import { expect, test, type Page } from '@playwright/test'
import { build } from 'vite'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

let output: string
const picker = '#emoji-extension-slash-picker'
test.beforeAll(async () => {
  output = await mkdtemp(path.join(tmpdir(), 'slash-emoji-'))
  await build({
    configFile: false,
    logLevel: 'error',
    resolve: { alias: { '@': path.resolve('src') } },
    build: {
      outDir: output,
      minify: false,
      lib: {
        entry: path.resolve('scripts/tests/slash-emoji-picker.entry.ts'),
        formats: ['es'],
        fileName: () => 'entry.js'
      }
    }
  })
})
test.afterAll(async () => {
  await rm(output, { recursive: true, force: true })
})
async function fixture(page: Page, enabled = true) {
  await page.route('**/slash-fixture/**', async route => {
    const file = new URL(route.request().url()).pathname.split('/slash-fixture/')[1]
    await route.fulfill({
      body: await readFile(path.join(output, file)),
      contentType: 'text/javascript'
    })
  })
  await page.route('**/slash-test.html', route =>
    route.fulfill({
      body: '<textarea class="d-editor-input"></textarea><textarea class="chat-composer__input"></textarea><textarea id="ordinary"></textarea><div class="ProseMirror d-editor-input" contenteditable="true"></div>',
      contentType: 'text/html'
    })
  )
  await page.goto('http://localhost:4189/slash-test.html')
  await page.evaluate(async enabled => {
    const module = await import('/slash-fixture/entry.js')
    const w = window as any
    w.slash = module
    module.cachedState.settings = { enableSlashEmojiPicker: enabled, imageScale: 50 }
    module.cachedState.emojiGroups = [
      {
        id: 'cats',
        name: '猫猫',
        icon: '🐱',
        emojis: [
          {
            id: 'one',
            name: '开心',
            url: 'https://forum.example.com/a.webp',
            short_url: 'upload://happy.webp'
          },
          {
            id: 'two',
            name: '害羞',
            url: 'https://forum.example.com/b.webp',
            customOutput: ':shy:'
          }
        ]
      },
      {
        id: 'dogs',
        name: '狗狗',
        emojis: [
          {
            id: 'three',
            name: '旺旺',
            url: 'https://forum.example.com/c.webp',
            short_url: 'upload://dog.webp'
          }
        ]
      },
      { id: 'empty', name: '空分组', emojis: [] }
    ]
    w.cleanupSlash = module.initSlashEmojiPicker()
  }, enabled)
}

test('default off; disabling immediately dismisses an open picker', async ({ page }) => {
  await fixture(page, false)
  const editor = page.locator('textarea.d-editor-input')
  await editor.pressSequentially('/')
  await expect(page.locator(picker)).toHaveCount(0)
  await page.evaluate(() => {
    ;(window as any).slash.cachedState.settings.enableSlashEmojiPicker = true
  })
  await editor.fill('')
  await editor.pressSequentially('/')
  await expect(page.locator(picker)).toBeVisible()
  await page.evaluate(() => {
    ;(window as any).slash.cachedState.settings.enableSlashEmojiPicker = false
    window.dispatchEvent(new Event('emoji-extension-settings-changed'))
  })
  await expect(page.locator(picker)).toHaveCount(0)
  await expect(editor).toHaveValue('/')
})

test('keyboard chooses group then emoji and inserts only in the active forum editor', async ({
  page
}) => {
  await fixture(page)
  const editor = page.locator('.chat-composer__input')
  await editor.pressSequentially('hello /')
  await expect(page.locator(`${picker} [role=option]`)).toHaveCount(2)
  await editor.press('ArrowDown')
  await editor.press('Enter')
  await expect(page.locator(`${picker} [role=listbox]`)).toHaveAttribute('aria-label', '选择表情')
  await expect(page.locator(`${picker} [role=option]`)).toHaveAttribute('aria-label', '旺旺')
  await editor.press('Enter')
  await expect(editor).toHaveValue('hello ![旺旺|500x500,50%](upload://dog.webp) ')
  await expect(page.locator('textarea.d-editor-input')).toHaveValue('')
  await expect(page.locator(picker)).toHaveCount(0)
})

test('emoji grid supports arrows, custom output and a native input event', async ({ page }) => {
  await fixture(page)
  const editor = page.locator('textarea.d-editor-input')
  await page.evaluate(() => {
    ;(window as any).inserted = 0
    document.querySelector('textarea')!.addEventListener('input', () => (window as any).inserted++)
  })
  await editor.pressSequentially('/')
  await editor.press('Enter')
  await editor.press('ArrowRight')
  await expect(editor).toHaveAttribute(
    'aria-activedescendant',
    'emoji-extension-slash-picker-option-1'
  )
  await editor.press('Enter')
  await expect(editor).toHaveValue(':shy:')
  expect(await page.evaluate(() => (window as any).inserted)).toBeGreaterThan(1)
})

test('filters both stages; Backspace returns to groups and Escape preserves typed text', async ({
  page
}) => {
  await fixture(page)
  const editor = page.locator('textarea.d-editor-input')
  await editor.pressSequentially('/狗')
  await expect(page.locator(`${picker} [role=option]`)).toHaveCount(1)
  await editor.press('Enter')
  await editor.pressSequentially('不存在')
  await expect(page.locator(picker)).toContainText('没有匹配')
  for (let i = 0; i < 3; i++) await editor.press('Backspace')
  await editor.press('Backspace')
  await expect(page.locator(`${picker} [role=listbox]`)).toHaveAttribute('aria-label', '选择分组')
  await editor.press('Escape')
  await expect(editor).toHaveValue('/狗')
  await expect(page.locator(picker)).toHaveCount(0)
})

test('does not activate for ordinary fields, URLs or pasted slashes; cleanup is idempotent', async ({
  page
}) => {
  await fixture(page)
  await page.locator('#ordinary').pressSequentially('/')
  await expect(page.locator(picker)).toHaveCount(0)
  const editor = page.locator('textarea.d-editor-input')
  await editor.pressSequentially('https://example.com/')
  await expect(page.locator(picker)).toHaveCount(0)
  await editor.evaluate(element => {
    const target = element as HTMLTextAreaElement
    target.value = '/'
    target.setSelectionRange(1, 1)
    target.dispatchEvent(
      new InputEvent('input', { bubbles: true, data: '/', inputType: 'insertFromPaste' })
    )
  })
  await expect(page.locator(picker)).toHaveCount(0)
  await page.evaluate(() => {
    ;(window as any).cleanupSlash()
    ;(window as any).cleanupSlash()
  })
  await editor.fill('')
  await editor.pressSequentially('/')
  await expect(page.locator(picker)).toHaveCount(0)
})

test('ProseMirror trigger range is replaced through paste/native editing', async ({ page }) => {
  await fixture(page)
  const editor = page.locator('.ProseMirror')
  await editor.pressSequentially('prefix /')
  await editor.press('Enter')
  await editor.press('ArrowRight')
  await editor.press('Enter')
  await expect(editor).toHaveText('prefix :shy:')
  await expect(page.locator(picker)).toHaveCount(0)
})

test('editor replacement and IME composition never insert stale selections', async ({ page }) => {
  await fixture(page)
  const editor = page.locator('textarea.d-editor-input')
  await editor.pressSequentially('/')
  await editor.dispatchEvent('compositionstart')
  await expect(page.locator(picker)).toHaveCount(0)
  await editor.dispatchEvent('compositionend')
  await editor.fill('')
  await editor.pressSequentially('/')
  await page.evaluate(() => {
    const old = document.querySelector('textarea.d-editor-input')!
    old.replaceWith(old.cloneNode())
  })
  await editor.focus()
  await editor.press('Enter')
  await expect(page.locator(picker)).toHaveCount(0)
})

test('options switch persists independently and can be turned off', async ({ page }) => {
  await page.route('https://s.pwsh.us.kg/**', route => route.fulfill({ status: 404 }))
  await page.addInitScript(() => {
    if (!localStorage.getItem('appSettings')) {
      localStorage.setItem(
        'appSettings',
        JSON.stringify({
          imageScale: 100,
          defaultGroup: 'fixture',
          showSearchBar: true,
          gridColumns: 4,
          enableSlashEmojiPicker: false
        })
      )
      localStorage.setItem('emojiGroupIndex', JSON.stringify([{ id: 'fixture', order: 0 }]))
      localStorage.setItem(
        'emojiGroup_fixture',
        JSON.stringify({ id: 'fixture', name: 'fixture', icon: '', order: 0, emojis: [] })
      )
    }
  })
  await page.goto('/?mode=options#/settings')
  await page.getByRole('tab', { name: '开关', exact: true }).click()
  const setting = page
    .locator('.flex.items-center.justify-between')
    .filter({ has: page.getByText('启用 / 快捷表情选取 (试验性功能)', { exact: true }) })
  const toggle = setting.getByRole('switch')
  await expect(toggle).toHaveAttribute('aria-checked', 'false')
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-checked', 'true')
  // Allow the store's debounced save to finish before reloading.
  await page.waitForTimeout(1000)
  await page.reload()
  await page.getByRole('tab', { name: '开关', exact: true }).click()
  await expect(toggle).toHaveAttribute('aria-checked', 'true')
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-checked', 'false')
})

test('group image icons render as bounded images with a fallback on failure', async ({ page }) => {
  await fixture(page)
  await page.route('https://icons.example/**', route =>
    route.request().url().endsWith('broken.webp')
      ? route.fulfill({ status: 404 })
      : route.fulfill({
          contentType: 'image/svg+xml',
          body: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"/>'
        })
  )
  await page.evaluate(() => {
    const groups = (window as any).slash.cachedState.emojiGroups
    groups[0].icon = 'https://icons.example/group.webp'
    groups[1].icon = 'https://icons.example/broken.webp'
  })
  await page.locator('textarea.d-editor-input').pressSequentially('/')
  const group = page.locator(picker).getByRole('option', { name: '猫猫' })
  const icon = group.locator('img')
  await expect(icon).toBeVisible()
  await expect
    .poll(() => icon.evaluate(image => (image as HTMLImageElement).naturalWidth))
    .toBe(200)
  await expect(group).toHaveText('猫猫')
  const size = await icon.boundingBox()
  expect(size!.width).toBe(28)
  expect(size!.height).toBe(28)
  await expect(page.locator(picker).getByRole('option', { name: '狗狗' })).toHaveText('📁狗狗')
  const overflow = await page
    .locator(picker + ' .slash-items')
    .first()
    .evaluate(list => list.scrollWidth > list.clientWidth)
  expect(overflow).toBe(false)
})

test('groups and corresponding emojis stay visible together, with search and quick navigation', async ({
  page
}) => {
  await fixture(page)
  await page.evaluate(() => {
    ;(window as any).slash.cachedState.emojiGroups[1].emojis[0].tags = ['小狗']
  })
  const editor = page.locator('textarea.d-editor-input')
  await editor.pressSequentially('/')
  await expect(page.locator(picker).getByRole('option', { name: '猫猫' })).toBeVisible()
  await expect(
    page.locator('.slash-group-preview').getByRole('button', { name: '开心' })
  ).toBeVisible()
  await editor.press('ArrowDown')
  await expect(
    page.locator('.slash-group-preview').getByRole('button', { name: '旺旺' })
  ).toBeVisible()
  await editor.press('ArrowRight')
  await expect(page.locator('.slash-group-nav').getByRole('button', { name: '猫猫' })).toBeVisible()
  await expect(page.locator(picker).getByRole('option', { name: '旺旺' })).toBeVisible()
  await page.locator(picker).getByRole('button', { name: '‹ 返回分组' }).click()
  await editor.pressSequentially('小狗')
  await expect(page.locator(picker).getByRole('option')).toHaveCount(1)
  await expect(page.locator(picker).getByRole('option')).toHaveText('📁狗狗')
  await editor.press('ArrowRight')
  await editor.press('Enter')
  await expect(editor).toHaveValue(/!\[旺旺/)
  await expect(page.locator(picker)).toHaveCount(0)
})

test('root emoji search preview can insert a result directly', async ({ page }) => {
  await fixture(page)
  await page.locator('textarea.d-editor-input').pressSequentially('/害羞')
  await expect(page.locator(picker).getByRole('option')).toHaveCount(1)
  await page.locator('.slash-group-preview').getByRole('button', { name: '害羞' }).click()
  await expect(page.locator('textarea.d-editor-input')).toHaveValue(':shy:')
})

test('typing group name and a space jumps straight to emoji search', async ({ page }) => {
  await fixture(page)
  const editor = page.locator('textarea.d-editor-input')
  await editor.pressSequentially('/猫猫 害羞')
  await expect(page.locator(picker).getByRole('option')).toHaveCount(1)
  await expect(page.locator(picker).getByRole('option')).toHaveAttribute('aria-label', '害羞')
  await expect(page.locator('.slash-group-nav')).toBeVisible()
  await editor.press('Enter')
  await expect(editor).toHaveValue(':shy:')
})
