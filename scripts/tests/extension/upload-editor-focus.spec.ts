import fs from 'node:fs/promises'
import path from 'node:path'

import { expect, test, type Page } from '@playwright/test'
import { build } from 'vite'

const testAssetDirectory = path.resolve('dist/test-assets')
const testAssetName = 'upload-editor-focus.iife.js'

async function loadEditorHelpers(page: Page, html: string): Promise<void> {
  await page.goto('/')
  await page.setContent(html)
  await page.addScriptTag({ url: `/test-assets/${testAssetName}` })
  await page.evaluate(() => {
    ;(window as any).UploadEditorFocusTest.startEditorFocusTracking()
  })
}

test.describe('uploaded image editor targeting', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async () => {
    await fs.rm(testAssetDirectory, { recursive: true, force: true })
    await build({
      configFile: false,
      logLevel: 'silent',
      publicDir: false,
      build: {
        target: 'es2020',
        minify: false,
        sourcemap: false,
        emptyOutDir: true,
        outDir: testAssetDirectory,
        lib: {
          entry: path.resolve('src/content/utils/upload/helpers.ts'),
          name: 'UploadEditorFocusTest',
          formats: ['iife'],
          fileName: () => testAssetName
        }
      }
    })
  })

  test('restores the remembered ProseMirror caret instead of the current contenteditable', async ({
    page
  }) => {
    await loadEditorHelpers(
      page,
      `
        <div class="ProseMirror-container">
          <div id="editor" contenteditable="true" translate="no" class="ProseMirror d-editor-input"><p>alpha beta</p></div>
        </div>
        <div id="rogue" contenteditable="true"><div>do not change</div></div>
      `
    )

    const result = await page.evaluate(() => {
      const editor = document.querySelector<HTMLElement>('#editor')!
      const editorText = editor.querySelector('p')!.firstChild!
      editor.focus()
      const rememberedRange = document.createRange()
      rememberedRange.setStart(editorText, 5)
      rememberedRange.collapse(true)
      const selection = window.getSelection()!
      selection.removeAllRanges()
      selection.addRange(rememberedRange)
      document.dispatchEvent(new Event('selectionchange'))

      const rogue = document.querySelector<HTMLElement>('#rogue')!
      const rogueText = rogue.querySelector('div')!.firstChild!
      rogue.focus()
      const currentRange = document.createRange()
      currentRange.setStart(rogueText, 2)
      currentRange.collapse(true)
      selection.removeAllRanges()
      selection.addRange(currentRange)
      document.dispatchEvent(new Event('selectionchange'))

      // A page listener is allowed to move the live selection while handling
      // paste; the helper must restore the frozen editor range afterwards.
      document.addEventListener(
        'paste',
        () => {
          rogue.focus()
          selection.removeAllRanges()
          selection.addRange(currentRange)
        },
        { once: true }
      )

      const inserted = (window as any).UploadEditorFocusTest.insertIntoEditor(
        '![photo](upload://abc)'
      )
      return { inserted, editor: editor.textContent, rogue: rogue.textContent }
    })

    expect(result).toEqual({
      inserted: true,
      editor: 'alpha![photo](upload://abc) beta',
      rogue: 'do not change'
    })
  })

  test('uses the remembered d-editor-input textarea when several textareas exist', async ({
    page
  }) => {
    await loadEditorHelpers(
      page,
      `
        <textarea id="first" class="d-editor-input">first</textarea>
        <textarea id="editor" class="ember-text-area ember-view d-editor-input --markdown-monospace">hello world</textarea>
        <textarea id="upload-control">panel value</textarea>
      `
    )

    const result = await page.evaluate(() => {
      const editor = document.querySelector<HTMLTextAreaElement>('#editor')!
      editor.focus()
      editor.setSelectionRange(6, 6)
      editor.dispatchEvent(new Event('select', { bubbles: true }))

      const uploadControl = document.querySelector<HTMLTextAreaElement>('#upload-control')!
      uploadControl.focus()
      uploadControl.setSelectionRange(2, 2)
      uploadControl.dispatchEvent(new Event('select', { bubbles: true }))

      const inserted = (window as any).UploadEditorFocusTest.insertIntoEditor('![x](upload://x)')
      return {
        inserted,
        first: (document.querySelector('#first') as HTMLTextAreaElement).value,
        editor: editor.value,
        uploadControl: uploadControl.value
      }
    })

    expect(result).toEqual({
      inserted: true,
      first: 'first',
      editor: 'hello ![x](upload://x)world',
      uploadControl: 'panel value'
    })
  })

  test('keeps one captured upload session pinned across later editor focus changes', async ({
    page
  }) => {
    await loadEditorHelpers(
      page,
      `
        <textarea id="editor-a" class="d-editor-input">abc</textarea>
        <textarea id="editor-b" class="d-editor-input">xyz</textarea>
      `
    )

    const result = await page.evaluate(() => {
      const helpers = (window as any).UploadEditorFocusTest
      const editorA = document.querySelector<HTMLTextAreaElement>('#editor-a')!
      const editorB = document.querySelector<HTMLTextAreaElement>('#editor-b')!

      editorA.focus()
      editorA.setSelectionRange(1, 1)
      editorA.dispatchEvent(new Event('select', { bubbles: true }))
      const frozenTarget = helpers.captureEditorInsertionTarget()

      editorB.focus()
      editorB.setSelectionRange(1, 1)
      editorB.dispatchEvent(new Event('select', { bubbles: true }))

      const firstInserted = helpers.insertIntoEditor('X', frozenTarget)
      const secondInserted = helpers.insertIntoEditor('Y', frozenTarget)
      return {
        firstInserted,
        secondInserted,
        editorA: editorA.value,
        editorB: editorB.value
      }
    })

    expect(result).toEqual({
      firstInserted: true,
      secondInserted: true,
      editorA: 'aXYbc',
      editorB: 'xyz'
    })
  })

  test('refuses generic textareas and contenteditable divs', async ({ page }) => {
    await loadEditorHelpers(
      page,
      `
        <textarea id="generic-textarea">textarea value</textarea>
        <div id="generic-editable" contenteditable="true">editable value</div>
        <div id="unwrapped-prosemirror" contenteditable="true" class="ProseMirror d-editor-input">unwrapped value</div>
      `
    )

    const result = await page.evaluate(() => {
      const genericEditable = document.querySelector<HTMLElement>('#generic-editable')!
      genericEditable.focus()
      const inserted = (window as any).UploadEditorFocusTest.insertIntoEditor('DO-NOT-INSERT')
      return {
        inserted,
        textarea: (document.querySelector('#generic-textarea') as HTMLTextAreaElement).value,
        editable: genericEditable.textContent,
        unwrapped: document.querySelector('#unwrapped-prosemirror')!.textContent
      }
    })

    expect(result).toEqual({
      inserted: false,
      textarea: 'textarea value',
      editable: 'editable value',
      unwrapped: 'unwrapped value'
    })
  })

  test('does not retarget when the captured editor is removed', async ({ page }) => {
    await loadEditorHelpers(
      page,
      `
        <textarea id="editor-a" class="d-editor-input">abc</textarea>
        <textarea id="editor-b" class="d-editor-input">xyz</textarea>
      `
    )

    const result = await page.evaluate(() => {
      const helpers = (window as any).UploadEditorFocusTest
      const editorA = document.querySelector<HTMLTextAreaElement>('#editor-a')!
      const editorB = document.querySelector<HTMLTextAreaElement>('#editor-b')!

      editorA.focus()
      editorA.setSelectionRange(1, 1)
      editorA.dispatchEvent(new Event('select', { bubbles: true }))
      const frozenTarget = helpers.captureEditorInsertionTarget()
      editorA.remove()

      editorB.focus()
      editorB.setSelectionRange(1, 1)
      editorB.dispatchEvent(new Event('select', { bubbles: true }))
      const inserted = helpers.insertIntoEditor('DO-NOT-INSERT', frozenTarget)
      return { inserted, editorB: editorB.value }
    })

    expect(result).toEqual({ inserted: false, editorB: 'xyz' })
  })
})
