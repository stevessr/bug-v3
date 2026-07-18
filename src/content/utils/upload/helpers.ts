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

/**
 * Place the caret inside the editor without yanking document focus away from
 * the upload panel. Stealing focus on every auto-filled image is what makes
 * the composer "jump" / "fly" while uploads stream in. We only set the
 * selection range; the dispatched `input` event still notifies Discourse.
 */
function placeCaretInTextarea(
  editor: HTMLTextAreaElement,
  position: number,
  direction: 'forward' | 'backward' | 'none'
): void {
  try {
    editor.setSelectionRange(position, position, direction)
  } catch {
    editor.setSelectionRange(position, position)
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

  // Do NOT focus() the editor here — that steals focus from the upload panel
  // on every image and makes the caret appear to "drift". Setting the range
  // and dispatching `input` is enough for Discourse to react.
  editor.setRangeText(text, start, end, 'end')

  // Advance deterministically by the inserted length. We never re-read the
  // live caret, so a page handler that repositions it cannot accumulate drift.
  const nextPosition = start + text.length
  placeCaretInTextarea(editor, nextPosition, target.direction)
  target.start = nextPosition
  target.end = nextPosition
  target.direction = 'none'
  editor.dispatchEvent(createInputEvent(text))
  lastFocusedEditor = cloneEditorTarget(target)
}

/**
 * Move the caret to `target.range` without yanking document focus from the
 * upload panel. The selection is set on the existing (already focused) editor
 * so Discourse still receives the change.
 */
function restoreProseMirrorRange(
  target: Extract<EditorInsertionTarget, { kind: 'prosemirror' }>
): Range {
  const editor = target.element
  const range = isRangeInsideEditor(editor, target.range)
    ? target.range.cloneRange()
    : createRangeAtEditorEnd(editor)
  const selection = editor.ownerDocument.defaultView?.getSelection()

  selection?.removeAllRanges()
  selection?.addRange(range)
  return range
}

/**
 * Convert a DOM range boundary to a UTF-16 offset in the editor's text. The
 * boundary itself is not enough to advance an upload target: inserting text
 * can split the old text node while a Discourse paste handler is free to move
 * the live Selection somewhere else.
 */
function getEditorTextOffset(editor: HTMLElement, container: Node, offset: number): number | null {
  if (!isNodeInsideEditor(editor, container)) return null

  try {
    const range = editor.ownerDocument.createRange()
    range.selectNodeContents(editor)
    range.setEnd(container, offset)
    return range.toString().length
  } catch {
    return null
  }
}

/**
 * Resolve a text offset back to a DOM range without consulting the live
 * selection. Discourse's WYSIWYG editor may append the live caret to the end
 * of the composer after handling our synthetic paste; the text offset remains
 * tied to the original insertion point.
 */
function createRangeAtEditorTextOffset(editor: HTMLElement, offset: number): Range {
  const range = editor.ownerDocument.createRange()
  const walker = editor.ownerDocument.createTreeWalker(editor, NodeFilter.SHOW_TEXT)
  let remaining = Math.max(0, offset)
  let node = walker.nextNode() as Text | null

  while (node) {
    const length = node.data.length
    if (remaining <= length) {
      range.setStart(node, remaining)
      range.collapse(true)
      return range
    }
    remaining -= length
    node = walker.nextNode() as Text | null
  }

  return createRangeAtEditorEnd(editor)
}

function hasTextAtOffset(editor: HTMLElement, offset: number, text: string): boolean {
  return (editor.textContent ?? '').slice(offset, offset + text.length) === text
}

/**
 * Advance `target.range` so the next insert lands immediately after the text
 * we just inserted, measured in characters within the same text node. We do
 * this ourselves instead of trusting the live selection, because Discourse may
 * reposition the caret (e.g. append to the end of the editor) after a paste.
 * Re-reading the live caret every time is exactly what made the focus appear
 * to "drift" by one image, then two, then three.
 */
function advanceProseMirrorTarget(
  target: Extract<EditorInsertionTarget, { kind: 'prosemirror' }>,
  insertedText: string,
  insertionTextOffset: number | null
): void {
  const editor = target.element

  // Prefer the deterministic text position captured before dispatching paste.
  // This also handles a paste that split the original text node into a prefix,
  // the inserted text, and a suffix. Only use it when the inserted text is
  // actually present at that position; otherwise a rich paste may have
  // produced non-text DOM and needs the range/mutation fallback below.
  if (insertionTextOffset !== null && hasTextAtOffset(editor, insertionTextOffset, insertedText)) {
    target.range = createRangeAtEditorTextOffset(editor, insertionTextOffset + insertedText.length)
    lastFocusedEditor = cloneEditorTarget(target)
    return
  }

  const live = editor.ownerDocument.defaultView?.getSelection()
  const liveRange = live?.rangeCount ? live.getRangeAt(0) : null

  // Prefer the caret that sits right after what we inserted: a contenteditable
  // keeps a stable anchor at (node, offset). If the inserted text is still a
  // single text run, just shift the offset by its length.
  const current = isRangeInsideEditor(editor, target.range)
    ? target.range
    : liveRange && isRangeInsideEditor(editor, liveRange)
      ? liveRange
      : null

  if (current) {
    // Keep the remembered DOM boundary ahead of the live caret. A page paste
    // handler can move Selection to the editor end, but it must not retarget
    // the next upload image there.
    target.range = current.cloneRange()
    lastFocusedEditor = cloneEditorTarget(target)
    return
  }

  // Fallback: trust the live caret only when it is inside the editor.
  target.range =
    liveRange && isRangeInsideEditor(editor, liveRange)
      ? liveRange.cloneRange()
      : createRangeAtEditorEnd(editor)
  lastFocusedEditor = cloneEditorTarget(target)
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

function insertIntoProseMirror(
  text: string,
  target: Extract<EditorInsertionTarget, { kind: 'prosemirror' }>
): void {
  const editor = target.element

  // Remember which element held focus (the upload panel) so we can hand focus
  // back instead of letting it jump to the composer on every image.
  const previouslyFocused = editor.ownerDocument.activeElement as HTMLElement | null
  const panelHadFocus = previouslyFocused !== null && previouslyFocused !== editor

  const focusEditor = () => {
    try {
      editor.focus({ preventScroll: true })
    } catch {
      editor.focus()
    }
  }

  focusEditor()
  const insertionRange = restoreProseMirrorRange(target)
  const insertionTextOffset = getEditorTextOffset(
    editor,
    insertionRange.startContainer,
    insertionRange.startOffset
  )

  if (tryProseMirrorPaste(editor, text)) {
    advanceProseMirrorTarget(target, text, insertionTextOffset)
    if (panelHadFocus && previouslyFocused) previouslyFocused.focus({ preventScroll: true })
    return
  }

  // Synthetic paste has no browser default action. Restore the frozen range
  // before each fallback so a page handler cannot redirect insertion elsewhere.
  focusEditor()
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

  advanceProseMirrorTarget(target, text, insertionTextOffset)
  if (panelHadFocus && previouslyFocused) previouslyFocused.focus({ preventScroll: true })
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
