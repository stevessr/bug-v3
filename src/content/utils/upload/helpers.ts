const TEXTAREA_EDITOR_SELECTOR = 'textarea.d-editor-input'
const PROSEMIRROR_EDITOR_SELECTOR =
  '.ProseMirror-container .ProseMirror.d-editor-input[contenteditable="true"]'
const STRICT_EDITOR_SELECTOR = `${TEXTAREA_EDITOR_SELECTOR}, ${PROSEMIRROR_EDITOR_SELECTOR}`

type DiscourseEditorElement = HTMLTextAreaElement | HTMLElement

export type EditorInsertionTarget =
  | {
      kind: 'textarea'
      element: HTMLTextAreaElement
      start: number
      end: number
      direction: 'forward' | 'backward' | 'none'
    }
  | {
      kind: 'prosemirror'
      element: HTMLElement
      range: Range
    }

let lastFocusedEditor: EditorInsertionTarget | null = null
let isTrackingEditorFocus = false

function isStrictTextarea(element: Element | null): element is HTMLTextAreaElement {
  return element instanceof HTMLTextAreaElement && element.matches(TEXTAREA_EDITOR_SELECTOR)
}

function isStrictProseMirror(element: Element | null): element is HTMLElement {
  return (
    element instanceof HTMLElement &&
    element.matches('.ProseMirror.d-editor-input[contenteditable="true"]') &&
    element.closest('.ProseMirror-container') !== null
  )
}

function isStrictEditor(element: Element | null): element is DiscourseEditorElement {
  return isStrictTextarea(element) || isStrictProseMirror(element)
}

function resolveStrictEditor(node: EventTarget | Node | null): DiscourseEditorElement | null {
  const element = node instanceof Element ? node : node instanceof Node ? node.parentElement : null

  if (!element) return null
  if (isStrictEditor(element)) return element

  const proseMirror = element.closest(PROSEMIRROR_EDITOR_SELECTOR)
  return isStrictProseMirror(proseMirror) ? proseMirror : null
}

function isNodeInsideEditor(editor: HTMLElement, node: Node): boolean {
  return node === editor || editor.contains(node)
}

function isRangeInsideEditor(editor: HTMLElement, range: Range): boolean {
  return (
    isNodeInsideEditor(editor, range.startContainer) &&
    isNodeInsideEditor(editor, range.endContainer)
  )
}

function createRangeAtEditorEnd(editor: HTMLElement): Range {
  const range = editor.ownerDocument.createRange()
  range.selectNodeContents(editor)
  range.collapse(false)
  return range
}

function readEditorTarget(editor: DiscourseEditorElement): EditorInsertionTarget {
  if (isStrictTextarea(editor)) {
    return {
      kind: 'textarea',
      element: editor,
      start: editor.selectionStart ?? editor.value.length,
      end: editor.selectionEnd ?? editor.value.length,
      direction: editor.selectionDirection ?? 'none'
    }
  }

  const selection = editor.ownerDocument.defaultView?.getSelection()
  const selectedRange = selection?.rangeCount ? selection.getRangeAt(0) : null
  const previousRange =
    lastFocusedEditor?.kind === 'prosemirror' && lastFocusedEditor.element === editor
      ? lastFocusedEditor.range
      : null

  const range =
    selectedRange && isRangeInsideEditor(editor, selectedRange)
      ? selectedRange.cloneRange()
      : previousRange && isRangeInsideEditor(editor, previousRange)
        ? previousRange.cloneRange()
        : createRangeAtEditorEnd(editor)

  return { kind: 'prosemirror', element: editor, range }
}

function cloneEditorTarget(target: EditorInsertionTarget): EditorInsertionTarget {
  if (target.kind === 'textarea') {
    return { ...target }
  }

  return {
    kind: 'prosemirror',
    element: target.element,
    range: target.range.cloneRange()
  }
}

function isEditorUsable(editor: DiscourseEditorElement): boolean {
  if (!editor.isConnected || !isStrictEditor(editor)) return false
  if (isStrictTextarea(editor) && (editor.disabled || editor.readOnly)) return false
  if (editor.closest('[hidden], [aria-hidden="true"]')) return false

  const style = editor.ownerDocument.defaultView?.getComputedStyle(editor)
  return style?.display !== 'none' && style?.visibility !== 'hidden'
}

function rememberEditor(editor: DiscourseEditorElement): void {
  if (!isEditorUsable(editor)) return
  lastFocusedEditor = readEditorTarget(editor)
}

function handleTrackedEditorEvent(event: Event): void {
  const editor = resolveStrictEditor(event.target)
  if (editor) rememberEditor(editor)
}

function handleSelectionChange(): void {
  const activeEditor = resolveStrictEditor(document.activeElement)
  if (activeEditor) {
    rememberEditor(activeEditor)
    return
  }

  const selection = window.getSelection()
  const selectedEditor = resolveStrictEditor(selection?.anchorNode ?? null)
  if (selectedEditor) rememberEditor(selectedEditor)
}

const TRACKED_EDITOR_EVENTS = ['focusin', 'pointerup', 'keyup', 'input', 'select'] as const

/**
 * Track only the two supported Discourse editor roots. Focus moving to upload
 * controls or an unrelated contenteditable intentionally does not clear the
 * remembered editor/caret.
 */
export function startEditorFocusTracking(): void {
  if (isTrackingEditorFocus) return

  for (const eventName of TRACKED_EDITOR_EVENTS) {
    document.addEventListener(eventName, handleTrackedEditorEvent, true)
  }
  document.addEventListener('selectionchange', handleSelectionChange)
  isTrackingEditorFocus = true

  const activeEditor = resolveStrictEditor(document.activeElement)
  if (activeEditor) rememberEditor(activeEditor)
}

export function stopEditorFocusTracking(): void {
  if (!isTrackingEditorFocus) return

  for (const eventName of TRACKED_EDITOR_EVENTS) {
    document.removeEventListener(eventName, handleTrackedEditorEvent, true)
  }
  document.removeEventListener('selectionchange', handleSelectionChange)
  isTrackingEditorFocus = false
  lastFocusedEditor = null
}

/**
 * Freeze the editor and caret used by one upload session. If there are
 * multiple composers and none has been focused, do not guess between them.
 */
export function captureEditorInsertionTarget(): EditorInsertionTarget | null {
  startEditorFocusTracking()

  const activeEditor = resolveStrictEditor(document.activeElement)
  if (activeEditor) rememberEditor(activeEditor)

  if (lastFocusedEditor && isEditorUsable(lastFocusedEditor.element)) {
    return cloneEditorTarget(lastFocusedEditor)
  }
  lastFocusedEditor = null

  const candidates = Array.from(document.querySelectorAll(STRICT_EDITOR_SELECTOR)).filter(
    (element): element is DiscourseEditorElement =>
      isStrictEditor(element) && isEditorUsable(element)
  )

  if (candidates.length !== 1) return null

  rememberEditor(candidates[0])
  return lastFocusedEditor ? cloneEditorTarget(lastFocusedEditor) : null
}

function createInputEvent(text: string): Event {
  try {
    return new InputEvent('input', {
      bubbles: true,
      composed: true,
      inputType: 'insertText',
      data: text
    })
  } catch {
    return new Event('input', { bubbles: true, composed: true })
  }
}

function focusWithoutScrolling(editor: HTMLElement): void {
  try {
    editor.focus({ preventScroll: true })
  } catch {
    editor.focus()
  }
}

function insertIntoTextarea(
  text: string,
  target: Extract<EditorInsertionTarget, { kind: 'textarea' }>
) {
  const editor = target.element
  const valueLength = editor.value.length
  const start = Math.max(0, Math.min(target.start, valueLength))
  const end = Math.max(start, Math.min(target.end, valueLength))

  focusWithoutScrolling(editor)
  editor.setRangeText(text, start, end, 'end')

  const nextPosition = start + text.length
  editor.setSelectionRange(nextPosition, nextPosition, target.direction)
  target.start = nextPosition
  target.end = nextPosition
  target.direction = 'none'
  editor.dispatchEvent(createInputEvent(text))
  lastFocusedEditor = cloneEditorTarget(target)
}

function restoreProseMirrorRange(
  target: Extract<EditorInsertionTarget, { kind: 'prosemirror' }>
): Range {
  const editor = target.element
  const range = isRangeInsideEditor(editor, target.range)
    ? target.range.cloneRange()
    : createRangeAtEditorEnd(editor)
  const selection = editor.ownerDocument.defaultView?.getSelection()

  focusWithoutScrolling(editor)
  selection?.removeAllRanges()
  selection?.addRange(range)
  return range
}

function tryProseMirrorPaste(editor: HTMLElement, text: string): boolean {
  if (typeof DataTransfer !== 'function' || typeof ClipboardEvent !== 'function') return false

  try {
    const data = new DataTransfer()
    data.setData('text/plain', text)
    const event = new ClipboardEvent('paste', {
      bubbles: true,
      cancelable: true,
      composed: true,
      clipboardData: data
    })
    const htmlBefore = editor.innerHTML
    editor.dispatchEvent(event)
    return editor.innerHTML !== htmlBefore
  } catch {
    return false
  }
}

function updateProseMirrorTarget(
  target: Extract<EditorInsertionTarget, { kind: 'prosemirror' }>
): void {
  const selection = target.element.ownerDocument.defaultView?.getSelection()
  const range = selection?.rangeCount ? selection.getRangeAt(0) : null
  target.range =
    range && isRangeInsideEditor(target.element, range)
      ? range.cloneRange()
      : createRangeAtEditorEnd(target.element)
  lastFocusedEditor = cloneEditorTarget(target)
}

function insertIntoProseMirror(
  text: string,
  target: Extract<EditorInsertionTarget, { kind: 'prosemirror' }>
): void {
  const editor = target.element
  restoreProseMirrorRange(target)

  if (tryProseMirrorPaste(editor, text)) {
    updateProseMirrorTarget(target)
    return
  }

  // Synthetic paste has no browser default action. Restore the frozen range
  // before each fallback so a page handler cannot redirect insertion elsewhere.
  restoreProseMirrorRange(target)
  const htmlBefore = editor.innerHTML
  try {
    editor.ownerDocument.execCommand('insertText', false, text)
  } catch {
    // Fall through to a range insertion scoped to the strict editor root.
  }

  if (editor.innerHTML === htmlBefore) {
    const range = restoreProseMirrorRange(target)
    range.deleteContents()
    const textNode = editor.ownerDocument.createTextNode(text)
    range.insertNode(textNode)
    range.setStartAfter(textNode)
    range.collapse(true)

    const selection = editor.ownerDocument.defaultView?.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
    editor.dispatchEvent(createInputEvent(text))
  }

  updateProseMirrorTarget(target)
}

// Function to parse image filenames from markdown text
export function parseImageFilenamesFromMarkdown(markdownText: string): string[] {
  const imageRegex = /!\[([^\]]*)\]\([^)]+\)/g
  const filenames: string[] = []
  let match

  while ((match = imageRegex.exec(markdownText)) !== null) {
    const filename = match[1]
    if (filename && filename.trim()) {
      filenames.push(filename.trim())
    }
  }

  return filenames
}

/**
 * Insert only into the remembered Discourse composer root. Supplying a target
 * pins the whole async upload session to that editor and caret; it will never
 * fall through to document.activeElement, a generic textarea, or an arbitrary
 * contenteditable element.
 */
export function insertIntoEditor(
  text: string,
  insertionTarget?: EditorInsertionTarget | null
): boolean {
  if (!text) return false

  const target = insertionTarget === undefined ? captureEditorInsertionTarget() : insertionTarget
  if (!target || !isEditorUsable(target.element)) {
    console.warn('[Image Uploader] Remembered Discourse editor is unavailable; insertion skipped')
    return false
  }

  if (target.kind === 'textarea' && isStrictTextarea(target.element)) {
    insertIntoTextarea(text, target)
    return true
  }

  if (target.kind === 'prosemirror' && isStrictProseMirror(target.element)) {
    insertIntoProseMirror(text, target)
    return true
  }

  console.warn('[Image Uploader] Refusing to insert into a non-Discourse editor element')
  return false
}
