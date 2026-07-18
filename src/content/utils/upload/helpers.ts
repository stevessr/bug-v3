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
      nextInsertionStart: number
      hasInserted: boolean
    }
  | {
      kind: 'prosemirror'
      element: HTMLElement
      range: Range
      insertionRange: Range
      anchorTextOffset: number | null
      nextInsertionTextOffset: number | null
      hasInserted: boolean
    }

let lastFocusedEditor: EditorInsertionTarget | null = null
let isTrackingEditorFocus = false
let trustedInteractionVersion = 0

type EditorRestorationState = {
  revision: number
  interactionVersion: number
  previouslyFocused: HTMLElement | null
  keepFocusOutsideEditor: boolean
}

const editorRestorationStates = new WeakMap<DiscourseEditorElement, EditorRestorationState>()

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
      direction: editor.selectionDirection ?? 'none',
      nextInsertionStart: editor.selectionStart ?? editor.value.length,
      hasInserted: false
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

  const anchorTextOffset = getEditorContentOffset(editor, range.startContainer, range.startOffset)
  return {
    kind: 'prosemirror',
    element: editor,
    range,
    insertionRange: range.cloneRange(),
    anchorTextOffset,
    nextInsertionTextOffset: anchorTextOffset,
    hasInserted: false
  }
}

function cloneEditorTarget(target: EditorInsertionTarget): EditorInsertionTarget {
  if (target.kind === 'textarea') {
    return { ...target }
  }

  return {
    kind: 'prosemirror',
    element: target.element,
    range: target.range.cloneRange(),
    insertionRange: target.insertionRange.cloneRange(),
    anchorTextOffset: target.anchorTextOffset,
    nextInsertionTextOffset: target.nextInsertionTextOffset,
    hasInserted: target.hasInserted
  }
}

function isEditorUsable(editor: DiscourseEditorElement): boolean {
  if (!editor.isConnected || !isStrictEditor(editor)) return false
  if (isStrictTextarea(editor) && (editor.disabled || editor.readOnly)) return false
  if (editor.closest('[hidden], [aria-hidden="true"]')) return false

  const style = editor.ownerDocument.defaultView?.getComputedStyle(editor)
  return style?.display !== 'none' && style?.visibility !== 'hidden'
}

function handleTrustedUserInteraction(event: Event): void {
  // Programmatic focus/selection updates from Discourse must not cancel an
  // anchor restore. Only an actual pointer/keyboard interaction means the user
  // intentionally chose a new focus or caret while a render was settling.
  if (event.isTrusted) trustedInteractionVersion++
}

function focusWithoutScroll(element: HTMLElement): void {
  try {
    element.focus({ preventScroll: true })
  } catch {
    element.focus()
  }
}

/**
 * Discourse updates both textarea and ProseMirror state asynchronously. Its
 * input/paste handlers can therefore move focus and the live caret again after
 * our synchronous restore. Keep the frozen session anchor stable through the
 * current microtask, timer queue and two render frames, but stop immediately if
 * the user performs a real pointer/keyboard action.
 */
function stabilizeEditorAnchor(
  editor: DiscourseEditorElement,
  restoreAnchor: () => void,
  previouslyFocused: HTMLElement | null,
  interactionVersion: number
): void {
  const previousState = editorRestorationStates.get(editor)
  const revision = (previousState?.revision ?? 0) + 1
  const focusWasOutsideEditor =
    previouslyFocused !== null && resolveStrictEditor(previouslyFocused) !== editor
  const canReusePreviousState = previousState?.interactionVersion === interactionVersion
  const focusToRestore = focusWasOutsideEditor
    ? previouslyFocused
    : canReusePreviousState
      ? previousState.previouslyFocused
      : null

  editorRestorationStates.set(editor, {
    revision,
    interactionVersion,
    previouslyFocused: focusToRestore,
    keepFocusOutsideEditor:
      focusWasOutsideEditor ||
      Boolean(canReusePreviousState && previousState?.keepFocusOutsideEditor)
  })

  const restoreIfCurrent = () => {
    const state = editorRestorationStates.get(editor)
    if (
      !state ||
      state.revision !== revision ||
      state.interactionVersion !== trustedInteractionVersion ||
      !isEditorUsable(editor)
    ) {
      return
    }

    restoreAnchor()

    // Restore panel focus only when Discourse moved it into this editor. Never
    // override focus that has moved to some other control in the meantime.
    const activeElement = editor.ownerDocument.activeElement
    const editorHasFocus = activeElement === editor || resolveStrictEditor(activeElement) === editor
    if (state.keepFocusOutsideEditor && editorHasFocus) {
      if (state.previouslyFocused?.isConnected) {
        focusWithoutScroll(state.previouslyFocused)
      }

      // The regular upload button is disabled while the batch runs, so the
      // browser often reports <body> as the previous active element. Neither a
      // disabled button nor body is guaranteed to accept focus; explicitly
      // blur the composer if focus restoration did not take effect.
      const restoredActiveElement = editor.ownerDocument.activeElement
      if (
        restoredActiveElement === editor ||
        resolveStrictEditor(restoredActiveElement) === editor
      ) {
        editor.blur()
      }
    }
  }

  // Run once now for synchronous handlers and again at every scheduling layer
  // used by Ember/ProseMirror to commit controlled editor updates.
  restoreIfCurrent()
  queueMicrotask(restoreIfCurrent)
  window.setTimeout(restoreIfCurrent, 0)
  window.setTimeout(restoreIfCurrent, 50)
  window.requestAnimationFrame(() => {
    restoreIfCurrent()
    window.requestAnimationFrame(restoreIfCurrent)
  })
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
const TRUSTED_INTERACTION_EVENTS = ['pointerdown', 'keydown', 'touchstart'] as const

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
  for (const eventName of TRUSTED_INTERACTION_EVENTS) {
    document.addEventListener(eventName, handleTrustedUserInteraction, true)
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
  for (const eventName of TRUSTED_INTERACTION_EVENTS) {
    document.removeEventListener(eventName, handleTrustedUserInteraction, true)
  }
  document.removeEventListener('selectionchange', handleSelectionChange)
  isTrackingEditorFocus = false
  lastFocusedEditor = null
  trustedInteractionVersion++
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
  const previouslyFocused = editor.ownerDocument.activeElement as HTMLElement | null
  const interactionVersion = trustedInteractionVersion
  const valueLength = editor.value.length
  const insertionStart = target.hasInserted ? target.nextInsertionStart : target.start
  const insertionEnd = target.hasInserted ? insertionStart : target.end
  const start = Math.max(0, Math.min(insertionStart, valueLength))
  const end = Math.max(start, Math.min(insertionEnd, valueLength))

  // Do NOT focus() the editor here — that steals focus from the upload panel
  // on every image and makes the caret appear to "drift". Setting the range
  // and dispatching `input` is enough for Discourse to react.
  editor.setRangeText(text, start, end, 'end')

  // Advance only the private insertion tail. The user's original index stays
  // fixed, while every later upload is appended after the previous inserted
  // markdown instead of being written in reverse order at the same index.
  const nextPosition = start + text.length
  target.nextInsertionStart = nextPosition
  target.hasInserted = true

  const anchorPosition = Math.max(0, Math.min(target.start, editor.value.length))
  placeCaretInTextarea(editor, anchorPosition, 'none')
  editor.dispatchEvent(createInputEvent(text))

  // Discourse listeners may move the live caret while handling `input`.
  // Restore the fixed user index after they finish without stealing focus from
  // the upload panel.
  placeCaretInTextarea(editor, anchorPosition, 'none')
  lastFocusedEditor = cloneEditorTarget(target)
  stabilizeEditorAnchor(
    editor,
    () => {
      placeCaretInTextarea(editor, anchorPosition, 'none')
      lastFocusedEditor = cloneEditorTarget(target)
    },
    previouslyFocused,
    interactionVersion
  )
}

/**
 * Restore the private insertion tail without consulting the live selection.
 * The visible user caret is restored separately after the insert.
 */
function restoreProseMirrorRange(
  target: Extract<EditorInsertionTarget, { kind: 'prosemirror' }>
): Range {
  const editor = target.element
  const range =
    !target.hasInserted && isRangeInsideEditor(editor, target.range)
      ? target.range.cloneRange()
      : target.nextInsertionTextOffset !== null
        ? createRangeAtEditorContentOffset(editor, target.nextInsertionTextOffset)
        : isRangeInsideEditor(editor, target.insertionRange)
          ? target.insertionRange.cloneRange()
          : createRangeAtEditorEnd(editor)
  const selection = editor.ownerDocument.defaultView?.getSelection()

  selection?.removeAllRanges()
  selection?.addRange(range)
  return range
}

function restoreProseMirrorAnchor(
  target: Extract<EditorInsertionTarget, { kind: 'prosemirror' }>
): void {
  const editor = target.element
  const range =
    target.anchorTextOffset !== null
      ? createRangeAtEditorContentOffset(editor, target.anchorTextOffset)
      : isRangeInsideEditor(editor, target.range)
        ? target.range.cloneRange()
        : createRangeAtEditorEnd(editor)

  // The upload replaces an initial selection once, then keeps the visible
  // caret collapsed at that selection's top/index for the entire batch.
  range.collapse(true)
  target.range = range.cloneRange()

  const selection = editor.ownerDocument.defaultView?.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)
}

// The rich composer renders uploads and other embeds as atomic nodes that hold
// no text — an image is a `contenteditable="false"` span. Measuring caret
// positions purely by text length therefore collapses every image to zero
// width, so a caret sitting after N images resolves back to text offset 0: the
// very front of the composer. That is exactly the "光标后移" bug. Count each
// image atom as one unit alongside text so a frozen anchor/tail keeps pointing
// at the right place across a whole upload batch.
const IMAGE_ATOM_SELECTOR = '.composer-image-node'
// Discourse injects non-editable chrome (the grid layout switch and the remove
// button) inside an image grid. That chrome is not part of the post markdown,
// so it must never shift a measured offset — skip it entirely.
const GRID_CHROME_SELECTOR =
  '.composer-image-gallery__mode-buttons, .composer-image-grid__remove-btn'

function isImageAtom(node: Node): node is HTMLElement {
  return node instanceof HTMLElement && node.matches(IMAGE_ATOM_SELECTOR)
}

function isGridChrome(node: Node): boolean {
  return node instanceof HTMLElement && node.matches(GRID_CHROME_SELECTOR)
}

type ContentUnit = { kind: 'text'; node: Text } | { kind: 'atom'; node: HTMLElement }

/**
 * Visit the editor's content in document order as a flat sequence of units:
 * one per text run (measured by its character length) and one per atomic embed.
 * Image atoms are not descended into and grid chrome is skipped, so neither the
 * atom's inner markup nor Discourse's UI can perturb a measured offset.
 */
function forEachContentUnit(editor: HTMLElement, visit: (unit: ContentUnit) => void): void {
  const walk = (parent: Node): void => {
    for (let child = parent.firstChild; child; child = child.nextSibling) {
      if (child.nodeType === Node.TEXT_NODE) {
        visit({ kind: 'text', node: child as Text })
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        if (isGridChrome(child)) continue
        if (isImageAtom(child)) {
          visit({ kind: 'atom', node: child })
          continue
        }
        walk(child)
      }
    }
  }
  walk(editor)
}

/**
 * Convert a DOM range boundary to a content offset: text characters plus one
 * unit per image atom that lies before the boundary. Unlike a pure text offset,
 * this survives a composer whose content is entirely (or mostly) images.
 */
function getEditorContentOffset(
  editor: HTMLElement,
  container: Node,
  offset: number
): number | null {
  if (!isNodeInsideEditor(editor, container)) return null

  const boundary = editor.ownerDocument.createRange()
  boundary.setStart(editor, 0)
  try {
    boundary.setEnd(container, offset)
  } catch {
    return null
  }

  let total = 0
  let reachedBoundary = false
  forEachContentUnit(editor, unit => {
    if (reachedBoundary) return
    if (unit.kind === 'text') {
      if (unit.node === container) {
        total += Math.max(0, Math.min(offset, unit.node.data.length))
        reachedBoundary = true
      } else if (boundary.comparePoint(unit.node, unit.node.data.length) <= 0) {
        total += unit.node.data.length
      } else {
        reachedBoundary = true
      }
    } else {
      const parent = unit.node.parentNode
      if (!parent) return
      const indexAfterAtom = Array.from(parent.childNodes).indexOf(unit.node) + 1
      if (boundary.comparePoint(parent, indexAfterAtom) <= 0) {
        total += 1
      } else {
        reachedBoundary = true
      }
    }
  })

  return total
}

/** Total content length of the editor, using the same units as the offsets. */
function getEditorContentLength(editor: HTMLElement): number {
  let total = 0
  forEachContentUnit(editor, unit => {
    total += unit.kind === 'text' ? unit.node.data.length : 1
  })
  return total
}

/**
 * Resolve a content offset back to a DOM range without consulting the live
 * selection. Discourse's WYSIWYG editor may append the live caret to the end of
 * the composer after handling our synthetic paste; the content offset stays
 * tied to the original insertion point, landing before/after image atoms.
 */
function createRangeAtEditorContentOffset(editor: HTMLElement, offset: number): Range {
  const doc = editor.ownerDocument
  let remaining = Math.max(0, offset)
  let result: Range | null = null
  let afterLastAtom: Range | null = null

  forEachContentUnit(editor, unit => {
    if (result) return
    if (unit.kind === 'text') {
      const length = unit.node.data.length
      if (remaining <= length) {
        const range = doc.createRange()
        range.setStart(unit.node, remaining)
        range.collapse(true)
        result = range
      } else {
        remaining -= length
      }
    } else {
      const parent = unit.node.parentNode
      if (!parent) return
      const index = Array.from(parent.childNodes).indexOf(unit.node)
      if (remaining <= 0) {
        const range = doc.createRange()
        range.setStart(parent, index)
        range.collapse(true)
        result = range
      } else {
        remaining -= 1
        const range = doc.createRange()
        range.setStart(parent, index + 1)
        range.collapse(true)
        afterLastAtom = range
      }
    }
  })

  return result ?? afterLastAtom ?? createRangeAtEditorEnd(editor)
}

/**
 * Advance only the private insertion tail so the next result lands immediately
 * after what we just inserted. The tail is derived from the content-length
 * delta, never from the live selection: Discourse's paste handler is free to
 * move the live caret (e.g. to the composer end) without retargeting the batch.
 * `target.range` remains the fixed user anchor and is restored separately.
 */
function advanceProseMirrorTarget(
  target: Extract<EditorInsertionTarget, { kind: 'prosemirror' }>,
  tailOffset: number
): void {
  const editor = target.element
  target.nextInsertionTextOffset = tailOffset
  target.insertionRange = createRangeAtEditorContentOffset(editor, tailOffset)
  target.hasInserted = true
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
  const interactionVersion = trustedInteractionVersion

  const focusEditor = () => {
    try {
      editor.focus({ preventScroll: true })
    } catch {
      editor.focus()
    }
  }

  // A synthetic paste event can be dispatched to the strict editor root
  // without focusing it. Try that first so the common native Discourse path
  // never causes even a momentary jump away from the upload panel.
  const insertionRange = restoreProseMirrorRange(target)
  // The end of the insertion point in content units. Content after it is left
  // untouched by an insert/replace, so the new tail can be derived from the
  // total length delta — see commitInsertion — without reading the live caret.
  const insertionEndOffset =
    getEditorContentOffset(editor, insertionRange.endContainer, insertionRange.endOffset) ??
    target.nextInsertionTextOffset ??
    getEditorContentLength(editor)
  const lengthBefore = getEditorContentLength(editor)

  const commitInsertion = () => {
    const lengthAfter = getEditorContentLength(editor)
    const tail = Math.max(insertionEndOffset, lengthAfter - lengthBefore + insertionEndOffset)
    advanceProseMirrorTarget(target, tail)
    restoreProseMirrorAnchor(target)
    lastFocusedEditor = cloneEditorTarget(target)
    stabilizeEditorAnchor(
      editor,
      () => {
        restoreProseMirrorAnchor(target)
        lastFocusedEditor = cloneEditorTarget(target)
      },
      previouslyFocused,
      interactionVersion
    )
  }

  if (tryProseMirrorPaste(editor, text)) {
    commitInsertion()
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

  commitInsertion()
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
