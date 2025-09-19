// 移植自 docs/referense/2mix.js — 将用户脚本逻辑封装为一个可初始化的模块
// 功能：在 textarea 输入 `[!` 时显示候选 Callout（英文），支持键盘和点击完成

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
  color: 'var(--secondary-low)', // 使用一个默认的背景色，与 docs/referense/2mix.js 保持一致
  svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor"><path d="M490.3 40.4C512.2 62.27 512.2 97.73 490.3 119.6L460.3 149.7 362.3 51.72 392.4 21.66C414.3-.2135 449.7-.2135 471.6 21.66L490.3 40.4zM172.4 241.7L339.7 74.34 437.7 172.3 270.3 339.6C264.2 345.8 256.7 350.4 248.4 352.1L159.6 372.9C152.1 374.7 144.3 373.1 138.6 367.4C132.9 361.7 131.3 353.9 133.1 346.4L153.9 257.6C155.6 249.3 160.2 241.8 166.4 235.7L172.4 241.7zM96 64C42.98 64 0 106.1 0 160V416C0 469 42.98 512 96 512H352C405 512 448 469 448 416V320H400V416C400 442.5 378.5 464 352 464H96C69.54 464 48 442.5 48 416V160C48 133.5 69.54 112 96 112H192V64H96z"/></svg>'
}

// 为别名设置相同的图标和颜色（与 docs/referense/2mix.js 保持一致）
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
  suggestionBox.id = 'callout-suggestion-box-en'
  document.body.appendChild(suggestionBox)
  injectStyles()
}

function injectStyles() {
  const id = 'callout-suggestion-styles'
  if (document.getElementById(id)) return
  const style = document.createElement('style')
  style.id = id
  style.textContent = `
    #callout-suggestion-box-en {
      position: absolute;
      background-color: var(--secondary);
      border: 1px solid #444;
      border-radius: 6px;
      box-shadow: 0 4px 8px rgba(0,0,0,0.2);
      z-index: 9999;
      padding: 5px;
      display: none; /* 默认隐藏 */
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
      background-color: var(--primary-low) !important; /* 使用 !important 确保覆盖行内样式 */
    }
    .suggestion-item-en svg {
      width: 1em;
      height: 1em;
      margin-right: 8px;
      /* 默认颜色被内联样式覆盖 */
      color: var(--primary-medium);
    }
  `
  document.head.appendChild(style)
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

function applyCompletion(textarea: HTMLTextAreaElement, selectedKeyword: string) {
  const text = textarea.value
  const selectionStart = textarea.selectionStart || 0
  const textBeforeCursor = text.substring(0, selectionStart)
  // 查找最近的左括号触发符（半角或全角），插入时统一使用半角 '[!'
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
  const mirrorId = 'textarea-mirror-div-en'
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
      return `\n      <div class="suggestion-item-en" data-index="${index}" data-key="${keyword}" style="background-color:${backgroundColor}">\n        ${coloredSvg}\n        <span>${keyword}</span>\n      </div>`
    })
    .join('')

  suggestionBox.querySelectorAll('.suggestion-item-en').forEach(item => {
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
  // 支持半角/全角触发符：当输入左括号（半角 '['、全角 '［' 或 '【'）即可触发，'!' 可选
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

export function initCalloutSuggestions() {
  try {
    createSuggestionBox()
    document.addEventListener('input', handleInput, true)
    document.addEventListener('keydown', handleKeydown, true)
    document.addEventListener('click', e => {
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
