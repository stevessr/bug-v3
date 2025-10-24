// Callout suggestions for userscript: trigger on '[' and insert `[!keyword]`
// 移植自 src/content/discourse/callout-suggestions.ts，做了少量模块化调整
// Internal shorthand for document.addEventListener
const da = document.addEventListener
const calloutKeywords = [
  'note',
  'abstract',
  'summary',
  'tldr',
  'info',
  'todo',
  'tip',
  'hint',
  'success',
  'check',
  'done',
  'question',
  'help',
  'faq',
  'warning',
  'caution',
  'attention',
  'failure',
  'fail',
  'missing',
  'danger',
  'error',
  'bug',
  'example',
  'quote',
  'cite'
].sort()

import { getIcon } from '../utils/sharedIcons'

const DEFAULT_ICON = {
  icon: '📝',
  color: 'var(--secondary-low)',
  svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor"><path d="M490.3 40.4C512.2 62.27 512.2 97.73 490.3 119.6L460.3 149.7 362.3 51.72 392.4 21.66C414.3-.2135 449.7-.2135 471.6 21.66L490.3 40.4zM172.4 241.7L339.7 74.34 437.7 172.3 270.3 339.6C264.2 345.8 256.7 350.4 248.4 352.1L159.6 372.9C152.1 374.7 144.3 373.1 138.6 367.4C132.9 361.7 131.3 353.9 133.1 346.4L153.9 257.6C155.6 249.3 160.2 241.8 166.4 235.7L172.4 241.7zM96 64C42.98 64 0 106.1 0 160V416C0 469 42.98 512 96 512H352C405 512 448 469 448 416V320H400V416C400 442.5 378.5 464 352 464H96C69.54 464 48 442.5 48 416V160C48 133.5 69.54 112 96 112H192V64H96z"/></svg>'
}

let suggestionBox: HTMLDivElement | null = null
let activeSuggestionIndex = 0

function createSuggestionBox() {
  if (suggestionBox) return
  suggestionBox = document.createElement('div')
  suggestionBox.id = 'userscript-callout-suggestion-box'
  document.body.appendChild(suggestionBox)
  injectStyles()
}

import { ensureStyleInjected } from '../utils/injectStyles'

function injectStyles() {
  const id = 'userscript-callout-suggestion-styles'
  const css = `
  #userscript-callout-suggestion-box {
    position: absolute;
    background-color: var(--secondary);
    border: 1px solid #444;
    border-radius: 6px;
    box-shadow: 0 4px 8px rgba(0,0,0,0.2);
    z-index: 999999;
    padding: 5px;
    display: none;
    font-size: 14px;
    max-height: 200px;
    overflow-y: auto;
  }
  .userscript-suggestion-item {
    padding: 8px 12px;
    cursor: pointer;
    color: var(--primary-high);
    border-radius: 4px;
    display: flex;
    align-items: center;
  }
  .userscript-suggestion-item:hover, .userscript-suggestion-item.active {
    background-color: var(--primary-low) !important;
  }
  `
  ensureStyleInjected(id, css)
}

function hideSuggestionBox() {
  if (suggestionBox) suggestionBox.style.display = 'none'
}

function updateActiveSuggestion() {
  if (!suggestionBox) return
  const items = suggestionBox.querySelectorAll<HTMLDivElement>('.userscript-suggestion-item')
  items.forEach((it, idx) => {
    it.classList.toggle('active', idx === activeSuggestionIndex)
    if (idx === activeSuggestionIndex) it.scrollIntoView({ block: 'nearest' })
  })
}

function applyCompletion(
  element: HTMLTextAreaElement | HTMLElement,
  selectedKeyword: string
) {
  if (element instanceof HTMLTextAreaElement) {
    // Handle textarea
    const text = element.value
    const selectionStart = element.selectionStart || 0
    const textBeforeCursor = text.substring(0, selectionStart)
    let triggerIndex = textBeforeCursor.lastIndexOf('[')
    if (triggerIndex === -1) triggerIndex = textBeforeCursor.lastIndexOf('［')
    if (triggerIndex === -1) triggerIndex = textBeforeCursor.lastIndexOf('【')
    if (triggerIndex === -1) return
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
      const textBeforeCursor = range.startContainer.textContent?.substring(0, range.startOffset) || ''

      // 压缩搜索：查找最近的半角或全角左括号触发符
      let triggerIndex = textBeforeCursor.lastIndexOf('[')
      if (triggerIndex === -1) triggerIndex = textBeforeCursor.lastIndexOf('［')
      if (triggerIndex === -1) triggerIndex = textBeforeCursor.lastIndexOf('【')

      if (triggerIndex === -1) return

      // Delete from trigger to cursor
      const deleteRange = document.createRange()
      deleteRange.setStart(range.startContainer, triggerIndex)
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

function getCursorXY(element: HTMLTextAreaElement | HTMLElement, position?: number) {
  if (element instanceof HTMLTextAreaElement) {
    // Handle textarea
    // Use the more robust mirror approach from the content version to get
    // page-coordinates for the caret. This handles scrolling, transforms and
    // zoom correctly.
    const mirrorId = 'userscript-textarea-mirror-div'
    let mirror = document.getElementById(mirrorId) as HTMLDivElement | null
    const rect = element.getBoundingClientRect()
    if (!mirror) {
      mirror = document.createElement('div')
      mirror.id = mirrorId
      document.body.appendChild(mirror)
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

    const cursorPosition = position !== undefined ? position : element.selectionEnd
    const textUpToCursor = element.value.substring(0, cursorPosition)
    mirror.textContent = textUpToCursor
    const span = document.createElement('span')
    span.textContent = '\u200b'
    mirror.appendChild(span)

    const spanRect = span.getBoundingClientRect()
    // span.offsetLeft is relative to the mirror which is positioned at
    // textarea's page coordinates (rect.left + scrollX). Use that to
    // compute offsets inside the textarea, useful for anchoring.
    const offsetX = span.offsetLeft - element.scrollLeft
    const offsetY = span.offsetTop - element.scrollTop

    return {
      x: spanRect.left + window.scrollX,
      y: spanRect.top + window.scrollY,
      bottom: spanRect.bottom + window.scrollY,
      offsetX,
      offsetY
    }
  } else {
    // Handle ProseMirror
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) {
      const rect = element.getBoundingClientRect()
      return {
        x: rect.left + window.scrollX,
        y: rect.top + window.scrollY,
        bottom: rect.bottom + window.scrollY,
        offsetX: 0,
        offsetY: 0
      }
    }

    const range = selection.getRangeAt(0)
    const rect = range.getBoundingClientRect()

    return {
      x: rect.left + window.scrollX,
      y: rect.top + window.scrollY,
      bottom: rect.bottom + window.scrollY,
      offsetX: 0,
      offsetY: 0
    }
  }
}

function updateSuggestionBox(
  element: HTMLTextAreaElement | HTMLElement,
  matches: string[],
  triggerIndex: number
) {
  if (!suggestionBox || matches.length === 0) {
    hideSuggestionBox()
    return
  }
  suggestionBox.innerHTML = matches
    .map((keyword, index) => {
      const iconData = getIcon(keyword) || DEFAULT_ICON
      const backgroundColor = iconData.color || 'transparent'
      const iconColor = iconData.color
        ? iconData.color.replace('rgba', 'rgb').replace(/, [0-9.]+\)/, ')')
        : 'var(--primary-medium)'
      const coloredSvg = (iconData.svg || DEFAULT_ICON.svg).replace(
        '<svg',
        `<svg style="color: ${iconColor};"`
      )
      return `\n      <div class="userscript-suggestion-item" data-index="${index}" data-key="${keyword}" style="background-color:${backgroundColor}">\n        ${coloredSvg}\n        <span style="margin-left:8px">${keyword}</span>\n      </div>`
    })
    .join('')

  suggestionBox.querySelectorAll('.userscript-suggestion-item').forEach(item => {
    item.addEventListener('mousedown', e => {
      e.preventDefault()
      const idx = (item as HTMLElement).dataset.key
      if (!idx) return
      applyCompletion(element, idx)
      hideSuggestionBox()
    })
  })

  const cursorPos = getCursorXY(element, triggerIndex)
  // cursorPos contains page coordinates. Position the suggestion box relative
  // to those coordinates and flip above if there's no space below.
  const margin = 6
  // Ensure we can measure the box size even if it was previously display:none.
  const prevVisibility = suggestionBox.style.visibility
  suggestionBox.style.display = 'block'
  suggestionBox.style.visibility = 'hidden'
  const boxRect = suggestionBox.getBoundingClientRect()
  const viewportHeight = window.innerHeight
  const spaceBelow = viewportHeight - (cursorPos.bottom - window.scrollY)

  // Use caret page coordinates for anchoring: this ensures we place the box
  // exactly where the caret is on the page.
  const left = cursorPos.x
  let top = cursorPos.y + margin
  if (spaceBelow < boxRect.height + margin) {
    top = cursorPos.y - boxRect.height - margin
  }

  // Horizontal: prefer left-aligned to caret, but if there's not enough
  // space to the right, align the box's right edge to the caret (flip to left).
  const cursorViewportX = cursorPos.x - window.scrollX
  const viewportWidth = window.innerWidth
  const spaceRight = viewportWidth - cursorViewportX
  const spaceLeft = cursorViewportX
  let finalLeft = left
  if (spaceRight < boxRect.width + margin && spaceLeft >= boxRect.width + margin) {
    // Flip: position box so its right edge is at the caret
    finalLeft = cursorPos.x - boxRect.width
  }

  // Clamp to viewport (page coordinates)
  const minLeft = window.scrollX + 0
  const maxLeft = window.scrollX + viewportWidth - boxRect.width - margin
  if (finalLeft < minLeft) finalLeft = minLeft
  if (finalLeft > maxLeft) finalLeft = maxLeft

  suggestionBox.style.left = `${finalLeft}px`
  suggestionBox.style.top = `${top}px`
  // Restore visibility/display
  suggestionBox.style.visibility = prevVisibility || ''
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
    const match = textBeforeCursor.match(/(?:\[|［|【])(?:!|！)?([a-z]*)$/i)
    if (match) {
      const keyword = match[1].toLowerCase()
      const filtered = calloutKeywords.filter(k => k.startsWith(keyword))
      // 计算触发字符 '[' 的位置
      const triggerIndex = selectionStart - match[0].length
      if (filtered.length > 0) updateSuggestionBox(textarea, filtered, triggerIndex)
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
    const textBeforeCursor = range.startContainer.textContent?.substring(0, range.startOffset) || ''
    const match = textBeforeCursor.match(/(?:\[|［|【])(?:!|！)?([a-z]*)$/i)
    if (match) {
      const keyword = match[1].toLowerCase()
      const filtered = calloutKeywords.filter(k => k.startsWith(keyword))
      // 计算触发字符 '[' 的位置
      const triggerIndex = range.startOffset - match[0].length
      if (filtered.length > 0) updateSuggestionBox(target as HTMLElement, filtered, triggerIndex)
      else hideSuggestionBox()
    } else {
      hideSuggestionBox()
    }
  }
}

function handleKeydown(event: KeyboardEvent) {
  if (!suggestionBox || suggestionBox.style.display === 'none') return
  const items = suggestionBox.querySelectorAll<HTMLDivElement>('.userscript-suggestion-item')
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

export function initCalloutSuggestionsUserscript() {
  try {
    createSuggestionBox()
    da('input', handleInput, true)
    da('keydown', handleKeydown, true)
    da('click', e => {
      if (
        (e.target as Element)?.tagName !== 'TEXTAREA' &&
        !suggestionBox?.contains(e.target as Node)
      ) {
        hideSuggestionBox()
      }
    })
  } catch (e) {
    console.error('initCalloutSuggestionsUserscript failed', e)
  }
}
