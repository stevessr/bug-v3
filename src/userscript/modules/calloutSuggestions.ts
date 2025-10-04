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

const ICONS: Record<string, { icon?: string; color?: string; svg?: string }> = {
  info: {
    icon: 'ℹ️',
    color: 'rgba(2, 122, 255, 0.06)',
    svg: '<svg class="fa d-icon d-icon-far-lightbulb svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#far-lightbulb"></use></svg>'
  },
  tip: {
    icon: '💡',
    color: 'rgba(0, 191, 188, 0.06)',
    svg: '<svg class="fa d-icon d-icon-fire-flame-curved svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#fire-flame-curved"></use></svg>'
  },
  faq: {
    icon: '❓',
    color: 'rgba(236, 117, 0, 0.06)',
    svg: '<svg class="fa d-icon d-icon-far-circle-question svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#far-circle-question"></use></svg>'
  },
  question: {
    icon: '🤔',
    color: 'rgba(236, 117, 0, 0.06)',
    svg: '<svg class="fa d-icon d-icon-far-circle-question svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#far-circle-question"></use></svg>'
  },
  note: {
    icon: '📝',
    color: 'rgba(8, 109, 221, 0.06)',
    svg: '<svg class="fa d-icon d-icon-far-pen-to-square svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#far-pen-to-square"></use></svg>'
  },
  abstract: {
    icon: '📋',
    color: 'rgba(0, 191, 188, 0.06)',
    svg: '<svg class="fa d-icon d-icon-far-clipboard svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#far-clipboard"></use></svg>'
  },
  todo: {
    icon: '☑️',
    color: 'rgba(2, 122, 255, 0.06)',
    svg: '<svg class="fa d-icon d-icon-far-circle-check svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#far-circle-check"></use></svg>'
  },
  success: {
    icon: '🎉',
    color: 'rgba(68, 207, 110, 0.06)',
    svg: '<svg class="fa d-icon d-icon-check svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#check"></use></svg>'
  },
  warning: {
    icon: '⚠️',
    color: 'rgba(236, 117, 0, 0.06)',
    svg: '<svg class="fa d-icon d-icon-triangle-exclamation svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#triangle-exclamation"></use></svg>'
  },
  failure: {
    icon: '❌',
    color: 'rgba(233, 49, 71, 0.06)',
    svg: '<svg class="fa d-icon d-icon-xmark svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#xmark"></use></svg>'
  },
  danger: {
    icon: '☠️',
    color: 'rgba(233, 49, 71, 0.06)',
    svg: '<svg class="fa d-icon d-icon-bolt svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#bolt"></use></svg>'
  },
  bug: {
    icon: '🐛',
    color: 'rgba(233, 49, 71, 0.06)',
    svg: '<svg class="fa d-icon d-icon-bug svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#bug"></use></svg>'
  },
  example: {
    icon: '🔎',
    color: 'rgba(120, 82, 238, 0.06)',
    svg: '<svg class="fa d-icon d-icon-list svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#list"></use></svg>'
  },
  quote: {
    icon: '💬',
    color: 'rgba(158, 158, 158, 0.06)',
    svg: '<svg class="fa d-icon d-icon-quote-left svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#quote-left"></use></svg>'
  }
}

const DEFAULT_ICON = {
  icon: '📝',
  color: 'var(--secondary-low)',
  svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor"><path d="M490.3 40.4C512.2 62.27 512.2 97.73 490.3 119.6L460.3 149.7 362.3 51.72 392.4 21.66C414.3-.2135 449.7-.2135 471.6 21.66L490.3 40.4zM172.4 241.7L339.7 74.34 437.7 172.3 270.3 339.6C264.2 345.8 256.7 350.4 248.4 352.1L159.6 372.9C152.1 374.7 144.3 373.1 138.6 367.4C132.9 361.7 131.3 353.9 133.1 346.4L153.9 257.6C155.6 249.3 160.2 241.8 166.4 235.7L172.4 241.7zM96 64C42.98 64 0 106.1 0 160V416C0 469 42.98 512 96 512H352C405 512 448 469 448 416V320H400V416C400 442.5 378.5 464 352 464H96C69.54 464 48 442.5 48 416V160C48 133.5 69.54 112 96 112H192V64H96z"/></svg>'
}

// aliases
ICONS.summary = ICONS.tldr = ICONS.abstract
ICONS.hint = ICONS.tip
ICONS.check = ICONS.done = ICONS.success
ICONS.help = ICONS.faq
ICONS.caution = ICONS.attention = ICONS.warning
ICONS.fail = ICONS.missing = ICONS.failure
ICONS.error = ICONS.danger
ICONS.cite = ICONS.quote

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

function applyCompletion(textarea: HTMLTextAreaElement, selectedKeyword: string) {
  const text = textarea.value
  const selectionStart = textarea.selectionStart || 0
  const textBeforeCursor = text.substring(0, selectionStart)
  let triggerIndex = textBeforeCursor.lastIndexOf('[')
  if (triggerIndex === -1) triggerIndex = textBeforeCursor.lastIndexOf('［')
  if (triggerIndex === -1) triggerIndex = textBeforeCursor.lastIndexOf('【')
  if (triggerIndex === -1) return
  const newText = `[!${selectedKeyword}]`
  const textAfter = text.substring(selectionStart)
  textarea.value = textBeforeCursor.substring(0, triggerIndex) + newText + textAfter
  const newCursorPos = triggerIndex + newText.length
  textarea.selectionStart = textarea.selectionEnd = newCursorPos
  textarea.dispatchEvent(new Event('input', { bubbles: true }))
}

function getCursorXY(textarea: HTMLTextAreaElement, position?: number) {
  // Use the more robust mirror approach from the content version to get
  // page-coordinates for the caret. This handles scrolling, transforms and
  // zoom correctly.
  const mirrorId = 'userscript-textarea-mirror-div'
  let mirror = document.getElementById(mirrorId) as HTMLDivElement | null
  const rect = textarea.getBoundingClientRect()
  if (!mirror) {
    mirror = document.createElement('div')
    mirror.id = mirrorId
    document.body.appendChild(mirror)
  }

  const style = window.getComputedStyle(textarea)
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

  const cursorPosition = position !== undefined ? position : textarea.selectionEnd
  const textUpToCursor = textarea.value.substring(0, cursorPosition)
  mirror.textContent = textUpToCursor
  const span = document.createElement('span')
  span.textContent = '\u200b'
  mirror.appendChild(span)

  const spanRect = span.getBoundingClientRect()
  // span.offsetLeft is relative to the mirror which is positioned at
  // textarea's page coordinates (rect.left + scrollX). Use that to
  // compute offsets inside the textarea, useful for anchoring.
  const offsetX = span.offsetLeft - textarea.scrollLeft
  const offsetY = span.offsetTop - textarea.scrollTop

  return {
    x: spanRect.left + window.scrollX,
    y: spanRect.top + window.scrollY,
    bottom: spanRect.bottom + window.scrollY,
    offsetX,
    offsetY
  }
}

function updateSuggestionBox(textarea: HTMLTextAreaElement, matches: string[], triggerIndex: number) {
  if (!suggestionBox || matches.length === 0) {
    hideSuggestionBox()
    return
  }
  suggestionBox.innerHTML = matches
    .map((keyword, index) => {
      const iconData = ICONS[keyword] || DEFAULT_ICON
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
      applyCompletion(textarea, idx)
      hideSuggestionBox()
    })
  })

  const cursorPos = getCursorXY(textarea, triggerIndex)
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
  if (!target || !(target instanceof HTMLTextAreaElement)) return
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
        if (focused && focused instanceof HTMLTextAreaElement) applyCompletion(focused, selectedKey)
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
