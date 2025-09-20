// Callout suggestions for userscript: trigger on '[' and insert `[!keyword]`
// 移植自 src/content/discourse/callout-suggestions.ts，做了少量模块化调整
export const da = document.addEventListener
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

function getCursorXY(textarea: HTMLTextAreaElement) {
  const mirrorId = 'userscript-textarea-mirror-div'
  let mirror = document.getElementById(mirrorId) as HTMLDivElement | null
  if (!mirror) {
    mirror = document.createElement('div')
    mirror.id = mirrorId
    document.body.appendChild(mirror)
  }
  const style = window.getComputedStyle(textarea)
  const props = [
    'border',
    'boxSizing',
    'fontFamily',
    'fontSize',
    'fontWeight',
    'height',
    'letterSpacing',
    'lineHeight',
    'outline',
    'paddingBottom',
    'paddingLeft',
    'paddingRight',
    'paddingTop',
    'textAlign',
    'textIndent',
    'whiteSpace'
  ] as const
  props.forEach(p => {
    ;(mirror as any).style[p] = style.getPropertyValue(p)
  })
  mirror.style.position = 'absolute'
  mirror.style.left = '-9999px'
  mirror.style.top = '-9999px'
  mirror.style.width = style.width
  const textUpToCursor = textarea.value.substring(0, textarea.selectionEnd)
  mirror.textContent = textUpToCursor
  const span = document.createElement('span')
  span.textContent = '.'
  mirror.appendChild(span)
  return { x: span.offsetLeft - textarea.scrollLeft, y: span.offsetTop - textarea.scrollTop }
}

function updateSuggestionBox(textarea: HTMLTextAreaElement, matches: string[]) {
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

  const rect = textarea.getBoundingClientRect()
  const cursorPos = getCursorXY(textarea)
  suggestionBox.style.left = `${rect.left + window.scrollX + cursorPos.x}px`
  suggestionBox.style.top = `${rect.top + window.scrollY + cursorPos.y + 20}px`
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
    if (filtered.length > 0) updateSuggestionBox(textarea, filtered)
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
