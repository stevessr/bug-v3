import { readFileSync } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'

import { expect, test } from '@playwright/test'
import { build } from 'vite'

import {
  formatUploadPackageMarkdown,
  normalizeUploadPackageFormat
} from '../../src/utils/emojiMarkdown'

const testAssetDirectory = path.resolve('dist/test-assets-upload-package')
const testAssetName = 'upload-package-format.iife.js'

async function serveBuild(page: import('@playwright/test').Page) {
  await page.route(/^http:\/\/localhost(?::\d+)?\//, async route => {
    const pathname = new URL(route.request().url()).pathname
    try {
      const body = readFileSync(`dist${pathname === '/' ? '/index.html' : pathname}`)
      const contentType = pathname.endsWith('.js')
        ? 'text/javascript'
        : pathname.endsWith('.wasm')
          ? 'application/wasm'
          : pathname.endsWith('.css')
            ? 'text/css'
            : 'text/html'
      await route.fulfill({ body, contentType })
    } catch {
      await route.fulfill({ status: 404, body: '' })
    }
  })
}

test.describe('upload package format setting & insertion', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async () => {
    await fs.rm(testAssetDirectory, { recursive: true, force: true })
    await build({
      configFile: false,
      logLevel: 'silent',
      publicDir: false,
      resolve: {
        alias: {
          '@': path.resolve('src')
        }
      },
      build: {
        target: 'es2020',
        minify: false,
        sourcemap: false,
        emptyOutDir: true,
        outDir: testAssetDirectory,
        lib: {
          entry: path.resolve('scripts/tests/upload-package-format.entry.ts'),
          name: 'UploadPackageFormatTest',
          formats: ['iife'],
          fileName: () => testAssetName
        }
      }
    })
  })

  test.afterAll(async () => {
    await fs.rm(testAssetDirectory, { recursive: true, force: true })
  })

  test('formatUploadPackageMarkdown formats none, grid-carousel, grid, and spoiler', () => {
    expect(normalizeUploadPackageFormat(undefined)).toBe('none')
    expect(normalizeUploadPackageFormat('invalid')).toBe('none')
    expect(normalizeUploadPackageFormat('grid-carousel')).toBe('grid-carousel')
    expect(normalizeUploadPackageFormat('grid')).toBe('grid')
    expect(normalizeUploadPackageFormat('spoiler')).toBe('spoiler')

    const items = ['![a.png|10x10](upload://a)', '![b.png|20x20](upload://b)']

    expect(formatUploadPackageMarkdown(items, 'none')).toBe(
      '![a.png|10x10](upload://a)\n![b.png|20x20](upload://b)'
    )
    expect(formatUploadPackageMarkdown(items, 'grid-carousel')).toBe(
      '[grid mode=carousel]\n![a.png|10x10](upload://a)\n![b.png|20x20](upload://b)\n[/grid]'
    )
    expect(formatUploadPackageMarkdown(items, 'grid')).toBe(
      '[grid]\n![a.png|10x10](upload://a)\n![b.png|20x20](upload://b)\n[/grid]'
    )
    expect(formatUploadPackageMarkdown(items, 'spoiler')).toBe(
      '[spoiler]![a.png|10x10](upload://a)[/spoiler]\n[spoiler]![b.png|20x20](upload://b)[/spoiler]'
    )
    expect(formatUploadPackageMarkdown([], 'grid')).toBe('')
  })

  test('SettingsPage persists uploadPackageFormat across reloads', async ({ page }) => {
    await serveBuild(page)
    await page.goto('http://localhost/?mode=options#/settings')

    await page.getByRole('tab', { name: '开关' }).click()
    const trigger = page.getByTestId('upload-package-format-trigger')
    await trigger.scrollIntoViewIfNeeded()
    await expect(trigger).toContainText('无包装（默认）')

    const selectOption = async (menuText: string, expectedValue: string, expectedLabel: string) => {
      await trigger.click()
      await page.locator('.ant-dropdown-menu-item', { hasText: menuText }).click()
      await expect(trigger).toContainText(expectedLabel)
      await expect
        .poll(async () =>
          page.evaluate(() => {
            const raw = localStorage.getItem('appSettings')
            if (!raw) return null
            const parsed = JSON.parse(raw)
            return (parsed.data || parsed).uploadPackageFormat
          })
        )
        .toBe(expectedValue)
    }

    await selectOption('[grid mode=carousel]...[/grid]', 'grid-carousel', '轮播网格')
    await selectOption('[grid]...[/grid]', 'grid', '网格 [grid]')
    await selectOption('[spoiler]...[/spoiler]', 'spoiler', '独立剧透')

    await page.reload()
    await page.getByRole('tab', { name: '开关' }).click()
    await expect(page.getByTestId('upload-package-format-trigger')).toContainText('独立剧透')
  })

  test('uploadAndInsert wraps uploaded batch according to cachedState.settings.uploadPackageFormat', async ({
    page
  }) => {
    await page.route(/^http:\/\/localhost(?::\d+)?\//, async route => {
      const url = new URL(route.request().url())
      if (url.pathname === '/t/topic/1') {
        await route.fulfill({
          status: 200,
          contentType: 'text/html',
          body: `
            <meta name="csrf-token" content="test-csrf" />
            <div id="reply-control">
              <div class="d-editor-textarea-wrapper">
                <textarea class="d-editor-input"></textarea>
              </div>
            </div>
          `
        })
        return
      }
      if (url.pathname === '/uploads.json') {
        const bodyText = route.request().postData() || ''
        const isSecond = bodyText.includes('b.png')
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(
            isSecond
              ? {
                  url: 'https://localhost/uploads/b.png',
                  short_url: 'upload://b',
                  width: 20,
                  height: 20
                }
              : {
                  url: 'https://localhost/uploads/a.png',
                  short_url: 'upload://a',
                  width: 10,
                  height: 10
                }
          )
        })
        return
      }
      await route.fulfill({ status: 404, body: '' })
    })

    await page.goto('http://localhost/t/topic/1')
    await page.addScriptTag({ path: path.join(testAssetDirectory, testAssetName) })

    const runCase = async (format: 'none' | 'grid-carousel' | 'grid' | 'spoiler') => {
      return await page.evaluate(async packageFormat => {
        const api = (window as any).UploadPackageFormatTest
        const textarea = document.querySelector<HTMLTextAreaElement>('textarea.d-editor-input')!
        textarea.value = ''
        textarea.focus()
        textarea.setSelectionRange(0, 0)

        api.cachedState.settings = {
          ...api.cachedState.settings,
          useDiscourseNativeUpload: false,
          uploadPackageFormat: packageFormat
        }
        api.startEditorFocusTracking()
        const target = api.captureEditorInsertionTarget()
        const files = [
          new File([new Uint8Array([1, 2, 3])], 'a.png', { type: 'image/png' }),
          new File([new Uint8Array([4, 5, 6])], 'b.png', { type: 'image/png' })
        ]
        await api.uploadAndInsert(
          files,
          () => {},
          () => {},
          'topic',
          target
        )
        return textarea.value
      }, format)
    }

    expect(await runCase('none')).toBe('![a.png|10x10](upload://a)![b.png|20x20](upload://b)')
    expect(await runCase('grid-carousel')).toBe(
      '[grid mode=carousel]\n![a.png|10x10](upload://a)\n![b.png|20x20](upload://b)\n[/grid]'
    )
    expect(await runCase('grid')).toBe(
      '[grid]\n![a.png|10x10](upload://a)\n![b.png|20x20](upload://b)\n[/grid]'
    )
    expect(await runCase('spoiler')).toBe(
      '[spoiler]![a.png|10x10](upload://a)[/spoiler]\n[spoiler]![b.png|20x20](upload://b)[/spoiler]'
    )
  })
})
