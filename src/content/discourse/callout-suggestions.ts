// 移植自 docs/referense/2mix.js — 将用户脚本逻辑封装为一个可初始化的模块
// 功能：在 textarea 输入 `[!` 时显示候选 Callout（英文），支持键盘和点击完成

import { ESI } from '@/content/utils/injectCustomCss'
import { createE, DOA, DEBI, DAEL } from '@/content/utils/dom/createEl'
import { ICONS, calloutKeywords } from '@/content/data/callout'

const DEFAULT_ICON = {
  icon: '📝',
  color: 'transparent', // 使用一个默认的背景色，与 docs/referense/2mix.js 保持一致
  svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor"><path d="M490.3 40.4C512.2 62.27 512.2 97.73 490.3 119.6L460.3 149.7 362.3 51.72 392.4 21.66C414.3-.2135 449.7-.2135 471.6 21.66L490.3 40.4zM172.4 241.7L339.7 74.34 437.7 172.3 270.3 339.6C264.2 345.8 256.7 350.4 248.4 352.1L159.6 372.9C152.1 374.7 144.3 373.1 138.6 367.4C132.9 361.7 131.3 353.9 133.1 346.4L153.9 257.6C155.6 249.3 160.2 241.8 166.4 235.7L172.4 241.7zM96 64C42.98 64 0 106.1 0 160V416C0 469 42.98 512 96 512H352C405 512 448 469 448 416V320H400V416C400 442.5 378.5 464 352 464H96C69.54 464 48 442.5 48 416V160C48 133.5 69.54 112 96 112H192V64H96z"/></svg>'
}

let suggestionBox: HTMLDivElement | null = null
let activeSuggestionIndex = 0

// Callouts only exist inside blockquotes, so the trigger must be a blockquote
// line whose content starts with the bracket: "> [!note]". Plain "[!note]"
// typed in normal text must not open the suggestions.
const TEXTAREA_TRIGGER = /^[ \t]*>[ \t]*[［【[](?:!|！)?([a-z]*)$/i
const PROSE_MIRROR_TRIGGER = /^[［【[](?:!|！)?([a-z]*)$/i
const PROSE_BLOCK_SELECTOR = 'p, li, h1, h2, h3, h4, h5, h6, pre, blockquote'

/** Position of the trigger bracket inside a line prefix, or -1. */
function getBracketIndex(linePrefix: string): number {
  return linePrefix.search(/[［【[]/)
}

/**
 * ProseMirror renders the blockquote as a real element, so "> " is not part of
 * the text. Accept the trigger when the caret sits inside a blockquote and the
 * bracket starts the current block's line.
 */
function getProseLinePrefix(range: Range): string | null {
  const startNode = range.startContainer
  const startElement =
    startNode.nodeType === Node.TEXT_NODE ? startNode.parentElement : (startNode as Element)
  if (!startElement?.closest('blockquote')) return null
  const block = startElement.closest(PROSE_BLOCK_SELECTOR) ?? startElement
  const prefixRange = document.createRange()
  prefixRange.selectNodeContents(block)
  try {
    prefixRange.setEnd(range.startContainer, range.startOffset)
  } catch {
    return null
  }
  return prefixRange.toString()
}

/** Convert a character offset inside an element's text into a DOM point. */
function offsetToPoint(root: Element, offset: number): { node: Node; offset: number } | null {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let remaining = offset
  let node = walker.nextNode()
  while (node) {
    const length = node.textContent?.length || 0
    if (remaining <= length) return { node, offset: remaining }
    remaining -= length
    node = walker.nextNode()
  }
  return null
}

function createSuggestionBox() {
  if (suggestionBox) return
  suggestionBox = createE('div', {
    id: 'callout-suggestion-box-en'
  })
  DOA(suggestionBox)
  injectStyles()
}

function injectStyles() {
  const id = 'callout-suggestion-styles'
  const css = `
    #callout-suggestion-box-en {
      position: absolute;
      background-color: var(--secondary);
      border: 1px solid #444;
      border-radius: 6px;
      box-shadow: 0 4px 8px rgba(0,0,0,0.2);
      z-index: 9999;
      padding: 5px;
      display: none;
      font-size: 14px;
      max-height: 200px;
      overflow-y: auto;
    }
    .suggestion-item-en {
      padding: 8px 12px;
      cursor: pointer;
      color: var(--primary-high);
      border-radius: 4px;
      font-family: monospace;
      display: flex;
      align-items: center;
    }
    .suggestion-item-en:hover, .suggestion-item-en.active {
      background-color: var(--primary-low) !important;
    }
    .suggestion-item-en svg {
      width: 1em;
      height: 1em;
      margin-right: 8px;
      color: var(--primary-medium);
    }
  `
  ESI(id, css)
}

function hideSuggestionBox() {
  if (suggestionBox) suggestionBox.style.display = 'none'
}

function updateActiveSuggestion() {
  if (!suggestionBox) return
  const items = suggestionBox.querySelectorAll<HTMLDivElement>('.suggestion-item-en')
  items.forEach((it, idx) => {
    it.classList.toggle('active', idx === activeSuggestionIndex)
    if (idx === activeSuggestionIndex) it.scrollIntoView({ block: 'nearest' })
  })
}

function applyCompletion(element: HTMLTextAreaElement | HTMLElement, selectedKeyword: string) {
  if (element instanceof HTMLTextAreaElement) {
    // Handle textarea
    const text = element.value
    const selectionStart = element.selectionStart || 0
    const textBeforeCursor = text.substring(0, selectionStart)

    // 触发符必须位于 "> " 引用行的开头
    const lineStart = textBeforeCursor.lastIndexOf('\n') + 1
    const bracketIndex = getBracketIndex(textBeforeCursor.slice(lineStart))
    if (bracketIndex === -1) return
    const triggerIndex = lineStart + bracketIndex

    const newText = `[!${selectedKeyword}]`
    const textAfter = text.substring(selectionStart)

    element.value = textBeforeCursor.substring(0, triggerIndex) + newText + textAfter

    const newCursorPos = triggerIndex + newText.length
    element.selectionStart = element.selectionEnd = newCursorPos
    element.dispatchEvent(new Event('input', { bubbles: true }))
  } else if (element.classList.contains('ProseMirror')) {
    // Handle ProseMirror
    const newText = `[!${selectedKeyword}]`
    try {
      // Get current selection
      const selection = window.getSelection()
      if (!selection || selection.rangeCount === 0) return

      const range = selection.getRangeAt(0)
      const startNode = range.startContainer
      const startElement =
        startNode.nodeType === Node.TEXT_NODE ? startNode.parentElement : (startNode as Element)
      if (!startElement?.closest('blockquote')) return
      const block = startElement.closest(PROSE_BLOCK_SELECTOR) ?? startElement
      const prefixRange = document.createRange()
      prefixRange.selectNodeContents(block)
      try {
        prefixRange.setEnd(range.startContainer, range.startOffset)
      } catch {
        return
      }
      const bracketIndex = getBracketIndex(prefixRange.toString())
      if (bracketIndex === -1) return
      const startPoint = offsetToPoint(block, bracketIndex)
      if (!startPoint) return

      // Delete from trigger to cursor
      const deleteRange = document.createRange()
      deleteRange.setStart(startPoint.node, startPoint.offset)
      deleteRange.setEnd(range.startContainer, range.startOffset)
      deleteRange.deleteContents()

      // Insert new text
      const textNode = document.createTextNode(newText)
      deleteRange.insertNode(textNode)

      // Move cursor to end
      const newRange = document.createRange()
      newRange.setStartAfter(textNode)
      newRange.collapse(true)
      selection.removeAllRanges()
      selection.addRange(newRange)

      // Trigger input event
      element.dispatchEvent(new Event('input', { bubbles: true }))
    } catch (e) {
      console.error('ProseMirror completion failed', e)
    }
  }
}

function getCursorXY(element: HTMLTextAreaElement | HTMLElement) {
  if (element instanceof HTMLTextAreaElement) {
    // Handle textarea
    // Create (or reuse) a hidden mirror div that exactly overlaps the textarea
    // and copy essential computed styles so that measuring the span gives an
    // accurate caret position in page coordinates. This approach handles
    // scrolling, transforms, zoom, and different box-sizing modes.
    const mirrorId = 'textarea-mirror-div-en'
    let mirror = DEBI(mirrorId)
    const rect = element.getBoundingClientRect()
    if (!mirror) {
      mirror = createE('div', {
        id: mirrorId
      })
      DOA(mirror)
    }

    const style = window.getComputedStyle(element)
    const props = [
      'boxSizing',
      'fontFamily',
      'fontSize',
      'fontWeight',
      'letterSpacing',
      'lineHeight',
      'textTransform',
      'textAlign',
      'direction',
      'paddingTop',
      'paddingRight',
      'paddingBottom',
      'paddingLeft',
      'borderTopWidth',
      'borderRightWidth',
      'borderBottomWidth',
      'borderLeftWidth'
    ] as const
    // apply styles to mirror
    const ms = mirror.style as any
    props.forEach(p => {
      ms[p] = style.getPropertyValue(p)
    })
    // make mirror overlap the textarea so getBoundingClientRect on children
    // returns absolute coordinates consistent with the visible textarea
    ms.position = 'absolute'
    ms.left = `${rect.left + window.scrollX}px`
    ms.top = `${rect.top + window.scrollY}px`
    ms.width = `${rect.width}px`
    ms.height = `${rect.height}px`
    ms.overflow = 'hidden'
    ms.visibility = 'hidden'
    ms.whiteSpace = 'pre-wrap'
    ms.wordWrap = 'break-word'
    ms.boxSizing = style.getPropertyValue('box-sizing') || 'border-box'

    // place text up to cursor, then a span to measure position
    const textUpToCursor = element.value.substring(0, element.selectionEnd)
    // Use textContent so characters are rendered as in the textarea. newlines
    // are preserved by pre-wrap.
    mirror.textContent = textUpToCursor
    const span = createE('span')
    // zero-width character ensures span has a position without visible glyphs
    span.textContent = '\u200b'
    mirror.appendChild(span)

    const spanRect = span.getBoundingClientRect()
    // return page coordinates (account for page scroll). Caller should use
    // these to position the suggestion box in the page coordinate space.
    return {
      x: spanRect.left + window.scrollX,
      y: spanRect.top + window.scrollY,
      bottom: spanRect.bottom + window.scrollY
    }
  } else {
    // Handle ProseMirror
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) {
      const rect = element.getBoundingClientRect()
      return {
        x: rect.left + window.scrollX,
        y: rect.top + window.scrollY,
        bottom: rect.bottom + window.scrollY
      }
    }

    const range = selection.getRangeAt(0)
    const rect = range.getBoundingClientRect()

    return {
      x: rect.left + window.scrollX,
      y: rect.top + window.scrollY,
      bottom: rect.bottom + window.scrollY
    }
  }
}

function updateSuggestionBox(element: HTMLTextAreaElement | HTMLElement, matches: string[]) {
  if (!suggestionBox || matches.length === 0) {
    hideSuggestionBox()
    return
  }
  const htmlContent = matches
    .map((keyword, index) => {
      const iconData = ICONS[keyword] || DEFAULT_ICON
      const backgroundColor = iconData.color == 'currentcolor' ? 'transparent' : iconData.color
      const iconColor = iconData.color
        ? iconData.color.replace('rgba', 'rgb').replace(/, [0-9.]+\)/, ')')
        : 'var(--primary-medium)'
      const coloredSvg = (iconData.svg || DEFAULT_ICON.svg).replace(
        '<svg',
        `<svg style="color: ${iconColor};"`
      )
      return `\n      <div class="suggestion-item-en" data-index="${index}" data-key="${keyword}" style="background-color:${backgroundColor}">\n        ${coloredSvg}\n        <span>${keyword}</span>\n      </div>`
    })
    .join('')

  suggestionBox.innerHTML = htmlContent

  suggestionBox.querySelectorAll('.suggestion-item-en').forEach(item => {
    item.addEventListener('mousedown', e => {
      e.preventDefault()
      const idx = (item as HTMLElement).dataset.key
      if (!idx) return
      applyCompletion(element, idx)
      hideSuggestionBox()
    })
  })

  const cursorPos = getCursorXY(element)
  // cursorPos now contains page coordinates. Position the suggestion box
  // relative to those coordinates. Prefer showing below the caret; if there
  // isn't enough space, flip above the caret.
  const margin = 6
  const boxRect = suggestionBox.getBoundingClientRect()
  const viewportHeight = window.innerHeight
  const spaceBelow = viewportHeight - (cursorPos.bottom - window.scrollY)

  // Default left aligned to cursor; if RTL textarea, developers can adjust
  const left = cursorPos.x
  let top = cursorPos.y + margin
  if (spaceBelow < boxRect.height + margin) {
    // flip above caret
    top = cursorPos.y - boxRect.height - margin
  }

  suggestionBox.style.left = `${left}px`
  suggestionBox.style.top = `${top}px`
  suggestionBox.style.display = 'block'
  activeSuggestionIndex = 0
  updateActiveSuggestion()
}

function handleInput(event: Event) {
  const target = event.target as Element
  if (!target) return

  // Support both textarea and ProseMirror
  if (target instanceof HTMLTextAreaElement) {
    const textarea = target as HTMLTextAreaElement
    const text = textarea.value
    const selectionStart = textarea.selectionStart || 0
    const textBeforeCursor = text.substring(0, selectionStart)
    // 仅当当前行以 "> "（引用）开头时才触发，支持半角/全角左括号，'!' 可选
    const linePrefix = textBeforeCursor.slice(textBeforeCursor.lastIndexOf('\n') + 1)
    const match = linePrefix.match(TEXTAREA_TRIGGER)
    if (match) {
      const keyword = match[1].toLowerCase()
      const filtered = calloutKeywords.filter(k => k.startsWith(keyword))
      if (filtered.length > 0) updateSuggestionBox(textarea, filtered)
      else hideSuggestionBox()
    } else {
      hideSuggestionBox()
    }
  } else if (target.classList?.contains('ProseMirror')) {
    // Handle ProseMirror editor
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) {
      hideSuggestionBox()
      return
    }

    const range = selection.getRangeAt(0)
    // 所见即所得编辑器里引用是 <blockquote> 元素，"[!" 必须位于引用块的行首
    const linePrefix = getProseLinePrefix(range)
    if (linePrefix === null) {
      hideSuggestionBox()
      return
    }
    const match = linePrefix.match(PROSE_MIRROR_TRIGGER)
    if (match) {
      const keyword = match[1].toLowerCase()
      const filtered = calloutKeywords.filter(k => k.startsWith(keyword))
      if (filtered.length > 0) updateSuggestionBox(target as HTMLElement, filtered)
      else hideSuggestionBox()
    } else {
      hideSuggestionBox()
    }
  }
}

function handleKeydown(event: KeyboardEvent) {
  if (!suggestionBox || suggestionBox.style.display === 'none') return
  const items = suggestionBox.querySelectorAll<HTMLDivElement>('.suggestion-item-en')
  if (items.length === 0) return
  if (['ArrowDown', 'ArrowUp', 'Tab', 'Enter', 'Escape'].includes(event.key)) {
    event.preventDefault()
    event.stopPropagation()
  }
  switch (event.key) {
    case 'ArrowDown':
      activeSuggestionIndex = (activeSuggestionIndex + 1) % items.length
      updateActiveSuggestion()
      break
    case 'ArrowUp':
      activeSuggestionIndex = (activeSuggestionIndex - 1 + items.length) % items.length
      updateActiveSuggestion()
      break
    case 'Tab':
    case 'Enter': {
      const selectedKey = items[activeSuggestionIndex]?.dataset.key
      if (selectedKey) {
        const focused = document.activeElement as Element
        if (focused) {
          if (focused instanceof HTMLTextAreaElement) {
            applyCompletion(focused, selectedKey)
          } else if (focused.classList?.contains('ProseMirror')) {
            applyCompletion(focused as HTMLElement, selectedKey)
          }
        }
      }
      hideSuggestionBox()
      break
    }
    case 'Escape':
      hideSuggestionBox()
      break
  }
}

export function initCalloutSuggestions() {
  try {
    createSuggestionBox()
    DAEL('input', handleInput, true)
    DAEL('keydown', handleKeydown, true)
    DAEL('click', (e: Event) => {
      if (
        (e.target as Element)?.tagName !== 'TEXTAREA' &&
        !suggestionBox?.contains(e.target as Node)
      )
        hideSuggestionBox()
    })
  } catch (e) {
    // 不要抛出错误影响页面其它逻辑

    console.error('initCalloutSuggestions failed', e)
  }
}
