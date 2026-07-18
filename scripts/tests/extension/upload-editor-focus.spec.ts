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

// Simulate Discourse's composer hijacking the caret after each insert: it may
// move the live caret (e.g. append to the end of the editor) after we insert.
// The helper must NOT re-read that moved caret, or the insertion point would
// drift by one image, then two, then three — exactly the "焦点乱飞" bug.
function installCaretHijacker(page: Page): Promise<void> {
  return page.evaluate(() => {
    const editor = document.querySelector<HTMLElement>('.d-editor-input')!
    const moveToEnd = () => {
      const sel = window.getSelection()
      if (!sel) return
      const range = editor.ownerDocument.createRange()
      range.selectNodeContents(editor)
      range.collapse(false)
      sel.removeAllRanges()
      sel.addRange(range)
    }
    editor.addEventListener('input', moveToEnd, { once: false })
    ;(window as any).__stopCaretHijack = () => editor.removeEventListener('input', moveToEnd)
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
        editorB: editorB.value,
        fixedIndex: frozenTarget.start,
        insertionTail: frozenTarget.nextInsertionStart,
        visibleCaret: editorA.selectionStart
      }
    })

    expect(result).toEqual({
      firstInserted: true,
      secondInserted: true,
      editorA: 'aXYbc',
      editorB: 'xyz',
      fixedIndex: 1,
      insertionTail: 3,
      visibleCaret: 1
    })
  })

  test('replaces the original selection once while keeping its top index fixed', async ({
    page
  }) => {
    await loadEditorHelpers(
      page,
      `<textarea id="editor" class="d-editor-input">before SELECT after</textarea>`
    )

    const result = await page.evaluate(() => {
      const helpers = (window as any).UploadEditorFocusTest
      const editor = document.querySelector<HTMLTextAreaElement>('#editor')!
      editor.focus()
      editor.setSelectionRange(7, 13)
      editor.dispatchEvent(new Event('select', { bubbles: true }))
      const frozenTarget = helpers.captureEditorInsertionTarget()

      helpers.insertIntoEditor('A', frozenTarget)
      helpers.insertIntoEditor('B', frozenTarget)

      return {
        value: editor.value,
        fixedIndex: frozenTarget.start,
        fixedOriginalEnd: frozenTarget.end,
        insertionTail: frozenTarget.nextInsertionStart,
        visibleCaret: editor.selectionStart
      }
    })

    expect(result).toEqual({
      value: 'before AB after',
      fixedIndex: 7,
      fixedOriginalEnd: 13,
      insertionTail: 9,
      visibleCaret: 7
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

  test('does not drift when Discourse hijacks the caret after each insert', async ({ page }) => {
    await loadEditorHelpers(page, `<textarea id="editor" class="d-editor-input">start</textarea>`)
    await installCaretHijacker(page)

    const result = await page.evaluate(() => {
      const helpers = (window as any).UploadEditorFocusTest
      const editor = document.querySelector<HTMLTextAreaElement>('#editor')!
      editor.focus()
      editor.setSelectionRange(0, 0)
      editor.dispatchEvent(new Event('select', { bubbles: true }))
      const frozenTarget = helpers.captureEditorInsertionTarget()

      // Three images auto-filled in sequence, as the upload loop does.
      helpers.insertIntoEditor('![a](upload://a)', frozenTarget)
      helpers.insertIntoEditor('![b](upload://b)', frozenTarget)
      helpers.insertIntoEditor('![c](upload://c)', frozenTarget)
      return {
        value: editor.value,
        fixedIndex: (frozenTarget as any).start,
        insertionTail: (frozenTarget as any).nextInsertionStart,
        visibleCaret: editor.selectionStart
      }
    })

    const inserted = '![a](upload://a)![b](upload://b)![c](upload://c)start'
    expect(result.value).toBe(inserted)
    // The user's index/caret stays at the top of the inserted block. A separate
    // private tail advances so the next result appends instead of reversing.
    expect(result.fixedIndex).toBe(0)
    expect(result.visibleCaret).toBe(0)
    expect(result.insertionTail).toBe('![a](upload://a)![b](upload://b)![c](upload://c)'.length)
  })

  test('does not steal focus from the upload panel while auto-filling', async ({ page }) => {
    await loadEditorHelpers(
      page,
      `
        <textarea id="editor" class="d-editor-input">start</textarea>
        <button id="panel-btn" type="button">上传</button>
      `
    )

    const result = await page.evaluate(() => {
      const helpers = (window as any).UploadEditorFocusTest
      const editor = document.querySelector<HTMLTextAreaElement>('#editor')!
      const panelBtn = document.querySelector<HTMLButtonElement>('#panel-btn')!
      editor.focus()
      editor.setSelectionRange(0, 0)
      editor.dispatchEvent(new Event('select', { bubbles: true }))
      const frozenTarget = helpers.captureEditorInsertionTarget()

      // Focus stays on the panel (e.g. the progress dialog) during the upload.
      panelBtn.focus()
      helpers.insertIntoEditor('![a](upload://a)', frozenTarget)
      helpers.insertIntoEditor('![b](upload://b)', frozenTarget)
      return {
        activeId: document.activeElement?.id ?? null,
        value: editor.value,
        visibleCaret: editor.selectionStart,
        fixedIndex: frozenTarget.start,
        insertionTail: frozenTarget.nextInsertionStart
      }
    })

    expect(result.value).toBe('![a](upload://a)![b](upload://b)start')
    // The editor must not have grabbed focus on either insert.
    expect(result.activeId).toBe('panel-btn')
    expect(result.fixedIndex).toBe(0)
    expect(result.visibleCaret).toBe(0)
    expect(result.insertionTail).toBe('![a](upload://a)![b](upload://b)'.length)
  })

  test('restores the fixed textarea index after asynchronous Discourse focus updates', async ({
    page
  }) => {
    await loadEditorHelpers(
      page,
      `
        <textarea id="editor" class="d-editor-input">start</textarea>
        <button id="panel-btn" type="button">上传中</button>
      `
    )

    const result = await page.evaluate(async () => {
      const helpers = (window as any).UploadEditorFocusTest
      const editor = document.querySelector<HTMLTextAreaElement>('#editor')!
      const panelButton = document.querySelector<HTMLButtonElement>('#panel-btn')!
      const moveFocusAndCaretToEnd = () => {
        editor.focus()
        editor.setSelectionRange(editor.value.length, editor.value.length)
      }

      // Ember/Discourse may finish its controlled-input update after our
      // `input` dispatch, in a microtask, timer, or later render frame.
      editor.addEventListener('input', () => {
        queueMicrotask(moveFocusAndCaretToEnd)
        setTimeout(moveFocusAndCaretToEnd, 0)
        requestAnimationFrame(moveFocusAndCaretToEnd)
      })

      editor.focus()
      editor.setSelectionRange(0, 0)
      editor.dispatchEvent(new Event('select', { bubbles: true }))
      const frozenTarget = helpers.captureEditorInsertionTarget()
      panelButton.focus()

      helpers.insertIntoEditor('![a](upload://a)', frozenTarget)
      await new Promise<void>(resolve => {
        requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 0)))
      })

      return {
        activeId: document.activeElement?.id ?? null,
        value: editor.value,
        visibleCaret: editor.selectionStart,
        fixedIndex: frozenTarget.start,
        insertionTail: frozenTarget.nextInsertionStart
      }
    })

    expect(result).toEqual({
      activeId: 'panel-btn',
      value: '![a](upload://a)start',
      visibleCaret: 0,
      fixedIndex: 0,
      insertionTail: '![a](upload://a)'.length
    })
  })

  test('keeps focus out of the editor when the clicked upload button becomes disabled', async ({
    page
  }) => {
    await loadEditorHelpers(
      page,
      `
        <textarea id="editor" class="d-editor-input">start</textarea>
        <button id="upload-btn" type="button">上传</button>
      `
    )

    const result = await page.evaluate(async () => {
      const helpers = (window as any).UploadEditorFocusTest
      const editor = document.querySelector<HTMLTextAreaElement>('#editor')!
      const uploadButton = document.querySelector<HTMLButtonElement>('#upload-btn')!
      editor.focus()
      editor.setSelectionRange(0, 0)
      editor.dispatchEvent(new Event('select', { bubbles: true }))
      const frozenTarget = helpers.captureEditorInsertionTarget()

      // This mirrors regularPanel.ts: clicking Upload focuses the button, then
      // the handler disables it for the lifetime of the batch. Chromium moves
      // activeElement to body as soon as the focused button is disabled.
      uploadButton.focus()
      uploadButton.disabled = true
      editor.addEventListener('input', () => {
        requestAnimationFrame(() => {
          editor.focus()
          editor.setSelectionRange(editor.value.length, editor.value.length)
        })
      })

      helpers.insertIntoEditor('![a](upload://a)', frozenTarget)
      await new Promise<void>(resolve => setTimeout(resolve, 80))
      return {
        activeTag: document.activeElement?.tagName ?? null,
        value: editor.value,
        visibleCaret: editor.selectionStart
      }
    })

    expect(result).toEqual({
      activeTag: 'BODY',
      value: '![a](upload://a)start',
      visibleCaret: 0
    })
  })

  test('does not fight a real user caret change while a restore is pending', async ({ page }) => {
    await loadEditorHelpers(
      page,
      `<textarea id="editor" class="d-editor-input">start</textarea><button id="panel-btn">上传</button>`
    )

    await page.evaluate(() => {
      const helpers = (window as any).UploadEditorFocusTest
      const editor = document.querySelector<HTMLTextAreaElement>('#editor')!
      editor.focus()
      editor.setSelectionRange(0, 0)
      editor.dispatchEvent(new Event('select', { bubbles: true }))
      const frozenTarget = helpers.captureEditorInsertionTarget()
      document.querySelector<HTMLButtonElement>('#panel-btn')!.focus()
      helpers.insertIntoEditor('![a](upload://a)', frozenTarget)
    })

    // Playwright's pointer event is trusted, so the delayed stabilization must
    // yield to this intentional user focus/caret change.
    await page.locator('#editor').click()
    await page.evaluate(() => {
      document.querySelector<HTMLTextAreaElement>('#editor')!.setSelectionRange(5, 5)
    })
    await page.waitForTimeout(80)

    await expect(page.locator('#editor')).toBeFocused()
    expect(await page.locator('#editor').evaluate(editor => editor.selectionStart)).toBe(5)
  })

  test('ProseMirror: caret does not drift when Discourse appends to the end', async ({ page }) => {
    await loadEditorHelpers(
      page,
      `
        <div class="ProseMirror-container">
          <div id="editor" contenteditable="true" translate="no" class="ProseMirror d-editor-input"><p>start</p></div>
        </div>
        <button id="panel-btn" type="button">上传中</button>
      `
    )

    // Simulate the WYSIWYG paste pipeline: it inserts at the requested range,
    // then another composer callback moves the live caret to the editor end.
    await page.evaluate(() => {
      const editor = document.querySelector<HTMLElement>('#editor')!
      editor.addEventListener('paste', event => {
        event.preventDefault()
        const sel = window.getSelection()
        if (!sel || !sel.rangeCount) return
        const range = sel.getRangeAt(0)
        range.deleteContents()
        const textNode = editor.ownerDocument.createTextNode(
          event.clipboardData?.getData('text/plain') ?? ''
        )
        range.insertNode(textNode)
        range.setStartAfter(textNode)
        range.collapse(true)
        sel.removeAllRanges()
        sel.addRange(range)

        // This is the bug trigger: the live caret no longer describes the
        // upload session's insertion point after the page handles the paste.
        const endRange = editor.ownerDocument.createRange()
        endRange.selectNodeContents(editor)
        endRange.collapse(false)
        sel.removeAllRanges()
        sel.addRange(endRange)
      })
    })

    const result = await page.evaluate(() => {
      const helpers = (window as any).UploadEditorFocusTest
      const editor = document.querySelector<HTMLElement>('#editor')!
      const panelButton = document.querySelector<HTMLButtonElement>('#panel-btn')!
      editor.focus()
      const range = document.createRange()
      range.selectNodeContents(editor.querySelector('p')!)
      range.collapse(true)
      const sel = window.getSelection()!
      sel.removeAllRanges()
      sel.addRange(range)
      document.dispatchEvent(new Event('selectionchange'))

      const frozenTarget = helpers.captureEditorInsertionTarget()
      panelButton.focus()
      helpers.insertIntoEditor('![a](upload://a)', frozenTarget)
      helpers.insertIntoEditor('![b](upload://b)', frozenTarget)
      helpers.insertIntoEditor('![c](upload://c)', frozenTarget)
      const currentSelection = window.getSelection()!
      const caretRange = currentSelection.getRangeAt(0)
      const beforeCaret = document.createRange()
      beforeCaret.selectNodeContents(editor)
      beforeCaret.setEnd(caretRange.startContainer, caretRange.startOffset)
      return {
        html: editor.innerHTML,
        activeId: document.activeElement?.id ?? null,
        visibleCaretOffset: beforeCaret.toString().length,
        fixedIndex: frozenTarget.anchorTextOffset,
        insertionTail: frozenTarget.nextInsertionTextOffset
      }
    })

    // All three images sit together at the front (before "start"), proving the
    // caret advanced by one image each time instead of jumping to the end.
    expect(result.html).toContain('![a](upload://a)![b](upload://b)![c](upload://c)start')
    expect(result.activeId).toBe('panel-btn')
    expect(result.fixedIndex).toBe(0)
    expect(result.visibleCaretOffset).toBe(0)
    expect(result.insertionTail).toBe('![a](upload://a)![b](upload://b)![c](upload://c)'.length)
  })

  test('ProseMirror: restores panel focus and fixed index after an asynchronous paste update', async ({
    page
  }) => {
    await loadEditorHelpers(
      page,
      `
        <div class="ProseMirror-container">
          <div id="editor" contenteditable="true" translate="no" class="ProseMirror d-editor-input"><p>start</p></div>
        </div>
        <button id="panel-btn" type="button">上传中</button>
      `
    )

    const result = await page.evaluate(async () => {
      const helpers = (window as any).UploadEditorFocusTest
      const editor = document.querySelector<HTMLElement>('#editor')!
      const panelButton = document.querySelector<HTMLButtonElement>('#panel-btn')!

      const moveFocusAndCaretToEnd = () => {
        editor.focus()
        const selection = window.getSelection()
        if (!selection) return
        const endRange = document.createRange()
        endRange.selectNodeContents(editor)
        endRange.collapse(false)
        selection.removeAllRanges()
        selection.addRange(endRange)
      }

      editor.addEventListener('paste', event => {
        event.preventDefault()
        const selection = window.getSelection()
        if (!selection || !selection.rangeCount) return
        const range = selection.getRangeAt(0)
        range.deleteContents()
        const textNode = document.createTextNode(event.clipboardData?.getData('text/plain') ?? '')
        range.insertNode(textNode)
        range.setStartAfter(textNode)
        range.collapse(true)
        selection.removeAllRanges()
        selection.addRange(range)

        queueMicrotask(moveFocusAndCaretToEnd)
        setTimeout(moveFocusAndCaretToEnd, 0)
        requestAnimationFrame(moveFocusAndCaretToEnd)
      })

      editor.focus()
      const initialRange = document.createRange()
      initialRange.selectNodeContents(editor.querySelector('p')!)
      initialRange.collapse(true)
      const selection = window.getSelection()!
      selection.removeAllRanges()
      selection.addRange(initialRange)
      document.dispatchEvent(new Event('selectionchange'))
      const frozenTarget = helpers.captureEditorInsertionTarget()
      panelButton.focus()

      helpers.insertIntoEditor('![a](upload://a)', frozenTarget)
      await new Promise<void>(resolve => {
        requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 0)))
      })

      const caretRange = selection.getRangeAt(0)
      const beforeCaret = document.createRange()
      beforeCaret.selectNodeContents(editor)
      beforeCaret.setEnd(caretRange.startContainer, caretRange.startOffset)
      return {
        activeId: document.activeElement?.id ?? null,
        text: editor.textContent,
        visibleCaretOffset: beforeCaret.toString().length,
        fixedIndex: frozenTarget.anchorTextOffset,
        insertionTail: frozenTarget.nextInsertionTextOffset
      }
    })

    expect(result).toEqual({
      activeId: 'panel-btn',
      text: '![a](upload://a)start',
      visibleCaretOffset: 0,
      fixedIndex: 0,
      insertionTail: '![a](upload://a)'.length
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
