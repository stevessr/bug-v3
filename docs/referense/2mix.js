// ==UserScript==
// @name         Markdown Callout English Autocomplete with Icons & Colors
// @namespace    http://tampermonkey.net/
// @version      2.4
// @description  在输入 [! 后，根据英文关键词提供带图标和背景色的悬浮候选项并支持 Tab/Enter 键自动填充为 Obsidian 风格的 Callout。
// @match        https://linux.do/*
// @grant        GM_addStyle
// @author       Gemini
// ==/UserScript==

;(function () {
  'use strict'

  // 1. 定义标准的英文 Callout 关键词列表
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
  ].sort() // 按字母排序，方便查看

  // 1.1 定义 Callout 图标和颜色
  const ICONS = {
    info: {
      icon: 'ℹ️',
      color: 'rgba(2, 122, 255, 0.1)',
      svg: '<svg class="fa d-icon d-icon-far-lightbulb svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#far-lightbulb"></use></svg>'
    },
    tip: {
      icon: '💡',
      color: 'rgba(0, 191, 188, 0.1)',
      svg: '<svg class="fa d-icon d-icon-fire-flame-curved svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#fire-flame-curved"></use></svg>'
    },
    faq: {
      icon: '❓',
      color: 'rgba(236, 117, 0, 0.1)',
      svg: '<svg class="fa d-icon d-icon-far-circle-question svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#far-circle-question"></use></svg>'
    },
    question: {
      icon: '🤔',
      color: 'rgba(236, 117, 0, 0.1)',
      svg: '<svg class="fa d-icon d-icon-far-circle-question svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#far-circle-question"></use></svg>'
    },
    note: {
      icon: '📝',
      color: 'rgba(8, 109, 221, 0.1)',
      svg: '<svg class="fa d-icon d-icon-far-pen-to-square svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#far-pen-to-square"></use></svg>'
    },
    abstract: {
      icon: '📋',
      color: 'rgba(0, 191, 188, 0.1)',
      svg: '<svg class="fa d-icon d-icon-far-clipboard svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#far-clipboard"></use></svg>'
    },
    todo: {
      icon: '☑️',
      color: 'rgba(2, 122, 255, 0.1)',
      svg: '<svg class="fa d-icon d-icon-far-circle-check svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#far-circle-check"></use></svg>'
    },
    success: {
      icon: '🎉',
      color: 'rgba(68, 207, 110, 0.1)',
      svg: '<svg class="fa d-icon d-icon-check svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#check"></use></svg>'
    },
    warning: {
      icon: '⚠️',
      color: 'rgba(236, 117, 0, 0.1)',
      svg: '<svg class="fa d-icon d-icon-triangle-exclamation svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#triangle-exclamation"></use></svg>'
    },
    failure: {
      icon: '❌',
      color: 'rgba(233, 49, 71, 0.1)',
      svg: '<svg class="fa d-icon d-icon-xmark svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#xmark"></use></svg>'
    },
    danger: {
      icon: '☠️',
      color: 'rgba(233, 49, 71, 0.1)',
      svg: '<svg class="fa d-icon d-icon-bolt svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#bolt"></use></svg>'
    },
    bug: {
      icon: '🐛',
      color: 'rgba(233, 49, 71, 0.1)',
      svg: '<svg class="fa d-icon d-icon-bug svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#bug"></use></svg>'
    },
    example: {
      icon: '🔎',
      color: 'rgba(120, 82, 238, 0.1)',
      svg: '<svg class="fa d-icon d-icon-list svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#list"></use></svg>'
    },
    quote: {
      icon: '💬',
      color: 'rgba(158, 158, 158, 0.1)',
      svg: '<svg class="fa d-icon d-icon-quote-left svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#quote-left"></use></svg>'
    }
  }

  // 为别名设置相同的图标和颜色
  ICONS.summary = ICONS.tldr = ICONS.abstract
  ICONS.hint = ICONS.tip
  ICONS.check = ICONS.done = ICONS.success
  ICONS.help = ICONS.faq
  ICONS.caution = ICONS.attention = ICONS.warning
  ICONS.fail = ICONS.missing = ICONS.failure
  ICONS.error = ICONS.danger
  ICONS.cite = ICONS.quote

  const DEFAULT_ICON = {
    icon: '📝',
    color: 'var(--secondary-low)', // 使用一个默认的背景色
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor"><path d="M490.3 40.4C512.2 62.27 512.2 97.73 490.3 119.6L460.3 149.7 362.3 51.72 392.4 21.66C414.3-.2135 449.7-.2135 471.6 21.66L490.3 40.4zM172.4 241.7L339.7 74.34 437.7 172.3 270.3 339.6C264.2 345.8 256.7 350.4 248.4 352.1L159.6 372.9C152.1 374.7 144.3 373.1 138.6 367.4C132.9 361.7 131.3 353.9 133.1 346.4L153.9 257.6C155.6 249.3 160.2 241.8 166.4 235.7L172.4 241.7zM96 64C42.98 64 0 106.1 0 160V416C0 469 42.98 512 96 512H352C405 512 448 469 448 416V320H400V416C400 442.5 378.5 464 352 464H96C69.54 464 48 442.5 48 416V160C48 133.5 69.54 112 96 112H192V64H96z"/></svg>'
  }

  // 2. 创建并管理提示框 UI
  let suggestionBox = null
  let activeSuggestionIndex = 0

  function createSuggestionBox() {
    if (suggestionBox) return
    suggestionBox = document.createElement('div')
    suggestionBox.id = 'callout-suggestion-box-en'
    document.body.appendChild(suggestionBox)
  }

  // 3. 定义提示框的样式
  GM_addStyle(`
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
    `)

  // 4. 更新和显示/隐藏提示框
  function updateSuggestionBox(textarea, matches) {
    if (!suggestionBox || matches.length === 0) {
      hideSuggestionBox()
      return
    }

    // 生成候选项 HTML
    suggestionBox.innerHTML = matches
      .map((keyword, index) => {
        const iconData = ICONS[keyword] || DEFAULT_ICON
        const backgroundColor = iconData.color || 'transparent' // 获取背景颜色

        // 将 rgba 背景色转换为不透明的 rgb 颜色用于 SVG 图标
        const iconColor = iconData.color
          ? iconData.color.replace('rgba', 'rgb').replace(/, [0-9.]+\)/, ')')
          : 'var(--primary-medium)'

        // 将颜色作为内联样式添加到 SVG 标签
        const coloredSvg = iconData.svg.replace('<svg', `<svg style="color: ${iconColor};"`)

        return `
                <div class="suggestion-item-en"
                     data-index="${index}"
                     data-key="${keyword}"
                     style="background-color: ${backgroundColor};">
                    ${coloredSvg}
                    <span>${keyword}</span>
                </div>
            `
      })
      .join('')

    // 重新绑定点击事件
    suggestionBox.querySelectorAll('.suggestion-item-en').forEach(item => {
      item.addEventListener('mousedown', e => {
        e.preventDefault() // 防止 textarea 失焦
        applyCompletion(textarea, item.dataset.key)
        hideSuggestionBox()
      })
    })

    // 定位提示框
    const rect = textarea.getBoundingClientRect()
    const cursorPosition = getCursorXY(textarea)
    suggestionBox.style.left = `${rect.left + window.scrollX + cursorPosition.x}px`
    suggestionBox.style.top = `${rect.top + window.scrollY + cursorPosition.y + 20}px` // 在光标下方显示
    suggestionBox.style.display = 'block'

    activeSuggestionIndex = 0
    updateActiveSuggestion()
  }

  function hideSuggestionBox() {
    if (suggestionBox) {
      suggestionBox.style.display = 'none'
    }
  }

  function updateActiveSuggestion() {
    suggestionBox.querySelectorAll('.suggestion-item-en').forEach((item, index) => {
      item.classList.toggle('active', index === activeSuggestionIndex)
      if (index === activeSuggestionIndex) {
        // 确保活动项在可视区域内
        item.scrollIntoView({ block: 'nearest' })
      }
    })
  }

  // 5. 应用自动填充
  function applyCompletion(textarea, selectedKeyword) {
    const text = textarea.value
    const selectionStart = textarea.selectionStart

    // 找到触发词的起始位置
    const textBeforeCursor = text.substring(0, selectionStart)
    const triggerIndex = textBeforeCursor.lastIndexOf('[!')
    if (triggerIndex === -1) return

    // 构建新的文本
    const newText = `[!${selectedKeyword}] `
    const textAfter = text.substring(selectionStart)

    textarea.value = textBeforeCursor.substring(0, triggerIndex) + newText + textAfter

    // 更新光标位置到填充后
    const newCursorPos = triggerIndex + newText.length
    textarea.selectionStart = textarea.selectionEnd = newCursorPos

    // 触发 input 事件，确保页面能监听到变化
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
  }

  // 6. 核心事件监听
  function handleInput(event) {
    const textarea = event.target
    if (textarea.tagName !== 'TEXTAREA') return

    const text = textarea.value
    const selectionStart = textarea.selectionStart
    const textBeforeCursor = text.substring(0, selectionStart)

    // 匹配触发格式： "[!english"
    const match = textBeforeCursor.match(/\[!([a-z]*)$/i) // 使用 i 标志进行不区分大小写匹配

    if (match) {
      const keyword = match[1].toLowerCase() // 统一转为小写进行匹配
      const filteredKeywords = calloutKeywords.filter(k => k.startsWith(keyword))

      if (filteredKeywords.length > 0) {
        updateSuggestionBox(textarea, filteredKeywords)
      } else {
        hideSuggestionBox()
      }
    } else {
      hideSuggestionBox()
    }
  }

  function handleKeydown(event) {
    if (!suggestionBox || suggestionBox.style.display === 'none') {
      return
    }

    const items = suggestionBox.querySelectorAll('.suggestion-item-en')
    if (items.length === 0) return

    // 只在提示框可见时才阻止默认行为
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
      case 'Enter':
        const selectedKey = items[activeSuggestionIndex]?.dataset.key
        if (selectedKey) {
          applyCompletion(event.target, selectedKey)
        }
        hideSuggestionBox()
        break
      case 'Escape':
        hideSuggestionBox()
        break
    }
  }

  // 7. 辅助函数：获取光标在 textarea 中的像素位置（简化版）
  function getCursorXY(textarea) {
    const mirrorDivId = 'textarea-mirror-div-en'
    let mirrorDiv = document.getElementById(mirrorDivId)
    if (!mirrorDiv) {
      mirrorDiv = document.createElement('div')
      mirrorDiv.id = mirrorDivId
      document.body.appendChild(mirrorDiv)
    }
    const style = window.getComputedStyle(textarea)
    ;[
      'border',
      'boxSizing',
      'fontFamily',
      'fontSize',
      'fontWeight',
      'height',
      'letterSpacing',
      'lineHeight',
      'marginBottom',
      'marginLeft',
      'marginRight',
      'marginTop',
      'outline',
      'paddingBottom',
      'paddingLeft',
      'paddingRight',
      'paddingTop',
      'textAlign',
      'textDecoration',
      'textIndent',
      'textTransform',
      'whiteSpace',
      'wordSpacing',
      'wordWrap'
    ].forEach(prop => {
      mirrorDiv.style[prop] = style[prop]
    })
    mirrorDiv.style.position = 'absolute'
    mirrorDiv.style.left = '-9999px'
    mirrorDiv.style.top = '-9999px'
    mirrorDiv.style.width = style.width

    const textUpToCursor = textarea.value.substring(0, textarea.selectionEnd)
    mirrorDiv.textContent = textUpToCursor

    const span = document.createElement('span')
    span.textContent = '.'
    mirrorDiv.appendChild(span)

    return {
      x: span.offsetLeft - textarea.scrollLeft,
      y: span.offsetTop - textarea.scrollTop
    }
  }

  // 8. 启动脚本
  function init() {
    createSuggestionBox()
    document.addEventListener('input', handleInput, true)
    document.addEventListener('keydown', handleKeydown, true)
    document.addEventListener('click', e => {
      if (e.target.tagName !== 'TEXTAREA' && !suggestionBox?.contains(e.target)) {
        hideSuggestionBox()
      }
    })
  }

  init()
})()
