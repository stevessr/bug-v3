// ==UserScript==
// @name         Discourse Callout 建议 (Callout Suggestions)
// @namespace    https://github.com/stevessr/bug-v3
// @version      1.0.0
// @description  为 Discourse 论坛添加 Markdown Callout 自动建议功能 (Add Markdown callout autocomplete to Discourse forums)
// @author       stevessr
// @match        https://linux.do/*
// @match        https://meta.discourse.org/*
// @match        https://*.discourse.org/*
// @match        http://localhost:5173/*
// @exclude      https://linux.do/a/*
// @match        https://idcflare.com/*
// @grant        none
// @license      MIT
// @homepageURL  https://github.com/stevessr/bug-v3
// @supportURL   https://github.com/stevessr/bug-v3/issues
// @downloadURL  https://github.com/stevessr/bug-v3/releases/latest/download/callout-suggestions.user.js
// @updateURL    https://github.com/stevessr/bug-v3/releases/latest/download/callout-suggestions.user.js
// @run-at       document-end
// ==/UserScript==

(function () {
  'use strict'

  // ===== Settings Management =====
  const SETTINGS_KEY = 'emoji_extension_userscript_settings'

  function loadSettings() {
    try {
      const settingsData = localStorage.getItem(SETTINGS_KEY)
      if (settingsData) {
        const settings = JSON.parse(settingsData)
        return settings
      }
    } catch (e) {
      console.warn('[Callout Suggestions] Failed to load settings:', e)
    }
    return {}
  }

  // Check forceMobileMode setting - if enabled, script respects it
  function shouldRespectForceMobileMode() {
    const settings = loadSettings()
    return settings.forceMobileMode === true
  }

  // ===== Callout Keywords =====
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

  // ===== Icon Definitions =====
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

  const ALIASES = {
    summary: 'abstract',
    tldr: 'abstract',
    hint: 'tip',
    check: 'success',
    done: 'success',
    help: 'faq',
    caution: 'warning',
    attention: 'warning',
    fail: 'failure',
    missing: 'failure',
    error: 'danger',
    cite: 'quote'
  }

  const DEFAULT_ICON = {
    icon: '📝',
    color: 'var(--secondary-low)',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor"><path d="M490.3 40.4C512.2 62.27 512.2 97.73 490.3 119.6L460.3 149.7 362.3 51.72 392.4 21.66C414.3-.2135 449.7-.2135 471.6 21.66L490.3 40.4zM172.4 241.7L339.7 74.34 437.7 172.3 270.3 339.6C264.2 345.8 256.7 350.4 248.4 352.1L159.6 372.9C152.1 374.7 144.3 373.1 138.6 367.4C132.9 361.7 131.3 353.9 133.1 346.4L153.9 257.6C155.6 249.3 160.2 241.8 166.4 235.7L172.4 241.7zM96 64C42.98 64 0 106.1 0 160V416C0 469 42.98 512 96 512H352C405 512 448 469 448 416V320H400V416C400 442.5 378.5 464 352 464H96C69.54 464 48 442.5 48 416V160C48 133.5 69.54 112 96 112H192V64H96z"/></svg>'
  }

  function getIcon(key) {
    const alias = ALIASES[key]
    const iconKey = alias || key
    return ICONS[iconKey] || DEFAULT_ICON
  }

  // ===== Suggestion Box =====
  let suggestionBox = null
  let activeSuggestionIndex = 0

  function createSuggestionBox() {
    if (suggestionBox) return
    suggestionBox = document.createElement('div')
    suggestionBox.id = 'callout-suggestion-box'
    document.body.appendChild(suggestionBox)
    injectStyles()
  }

  function injectStyles() {
    const id = 'callout-suggestion-styles'
    if (document.getElementById(id)) return
    const style = document.createElement('style')
    style.id = id
    style.textContent = `
  #callout-suggestion-box {
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
  .callout-suggestion-item {
    padding: 8px 12px;
    cursor: pointer;
    color: var(--primary-high);
    border-radius: 4px;
    display: flex;
    align-items: center;
  }
  .callout-suggestion-item:hover, .callout-suggestion-item.active {
    background-color: var(--primary-low) !important;
  }
  `
    document.documentElement.appendChild(style)
  }

  function hideSuggestionBox() {
    if (suggestionBox) suggestionBox.style.display = 'none'
  }

  function updateActiveSuggestion() {
    if (!suggestionBox) return
    const items = suggestionBox.querySelectorAll('.callout-suggestion-item')
    items.forEach((it, idx) => {
      it.classList.toggle('active', idx === activeSuggestionIndex)
      if (idx === activeSuggestionIndex) it.scrollIntoView({ block: 'nearest' })
    })
  }

  function applyCompletion(element, selectedKeyword) {
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
    } else if (element.classList && element.classList.contains('ProseMirror')) {
      // Handle ProseMirror
      const newText = `[!${selectedKeyword}]`
      try {
        const selection = window.getSelection()
        if (!selection || selection.rangeCount === 0) return

        const range = selection.getRangeAt(0)
        const textBeforeCursor =
          range.startContainer.textContent && range.startContainer.textContent.substring(0, range.startOffset) || ''

        let triggerIndex = textBeforeCursor.lastIndexOf('[')
        if (triggerIndex === -1) triggerIndex = textBeforeCursor.lastIndexOf('［')
        if (triggerIndex === -1) triggerIndex = textBeforeCursor.lastIndexOf('【')

        if (triggerIndex === -1) return

        const deleteRange = document.createRange()
        deleteRange.setStart(range.startContainer, triggerIndex)
        deleteRange.setEnd(range.startContainer, range.startOffset)
        deleteRange.deleteContents()

        const textNode = document.createTextNode(newText)
        deleteRange.insertNode(textNode)

        const newRange = document.createRange()
        newRange.setStartAfter(textNode)
        newRange.collapse(true)
        selection.removeAllRanges()
        selection.addRange(newRange)

        element.dispatchEvent(new Event('input', { bubbles: true }))
      } catch (e) {
        console.error('[Callout Suggestions] ProseMirror completion failed', e)
      }
    }
  }

  function getCursorXY(element, position) {
    if (element instanceof HTMLTextAreaElement) {
      const mirrorId = 'callout-textarea-mirror-div'
      let mirror = document.getElementById(mirrorId)
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
      ]
      const ms = mirror.style
      props.forEach(p => {
        ms[p] = style.getPropertyValue(p)
      })
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

  function updateSuggestionBox(element, matches, triggerIndex) {
    if (!suggestionBox || matches.length === 0) {
      hideSuggestionBox()
      return
    }
    suggestionBox.innerHTML = matches
      .map((keyword, index) => {
        const iconData = getIcon(keyword)
        const backgroundColor = iconData.color || 'transparent'
        const iconColor = iconData.color
          ? iconData.color.replace('rgba', 'rgb').replace(/, [0-9.]+\)/, ')')
          : 'var(--primary-medium)'
        const coloredSvg = (iconData.svg || DEFAULT_ICON.svg).replace(
          '<svg',
          `<svg style="color: ${iconColor};"`
        )
        return `<div class="callout-suggestion-item" data-index="${index}" data-key="${keyword}" style="background-color:${backgroundColor}">${coloredSvg}<span style="margin-left:8px">${keyword}</span></div>`
      })
      .join('')

    suggestionBox.querySelectorAll('.callout-suggestion-item').forEach(item => {
      item.addEventListener('mousedown', e => {
        e.preventDefault()
        const idx = item.dataset.key
        if (!idx) return
        applyCompletion(element, idx)
        hideSuggestionBox()
      })
    })

    const cursorPos = getCursorXY(element, triggerIndex)
    const margin = 6
    const prevVisibility = suggestionBox.style.visibility
    suggestionBox.style.display = 'block'
    suggestionBox.style.visibility = 'hidden'
    const boxRect = suggestionBox.getBoundingClientRect()
    const viewportHeight = window.innerHeight
    const spaceBelow = viewportHeight - (cursorPos.bottom - window.scrollY)

    const left = cursorPos.x
    let top = cursorPos.y + margin
    if (spaceBelow < boxRect.height + margin) {
      top = cursorPos.y - boxRect.height - margin
    }

    const cursorViewportX = cursorPos.x - window.scrollX
    const viewportWidth = window.innerWidth
    const spaceRight = viewportWidth - cursorViewportX
    const spaceLeft = cursorViewportX
    let finalLeft = left
    if (spaceRight < boxRect.width + margin && spaceLeft >= boxRect.width + margin) {
      finalLeft = cursorPos.x - boxRect.width
    }

    const minLeft = window.scrollX + 0
    const maxLeft = window.scrollX + viewportWidth - boxRect.width - margin
    if (finalLeft < minLeft) finalLeft = minLeft
    if (finalLeft > maxLeft) finalLeft = maxLeft

    suggestionBox.style.left = `${finalLeft}px`
    suggestionBox.style.top = `${top}px`
    suggestionBox.style.visibility = prevVisibility || ''
    suggestionBox.style.display = 'block'
    activeSuggestionIndex = 0
    updateActiveSuggestion()
  }

  function handleInput(event) {
    const target = event.target
    if (!target) return

    if (target instanceof HTMLTextAreaElement) {
      const textarea = target
      const text = textarea.value
      const selectionStart = textarea.selectionStart || 0
      const textBeforeCursor = text.substring(0, selectionStart)
      const match = textBeforeCursor.match(/(?:\[|［|【])(?:!|！)?([a-z]*)$/i)
      if (match) {
        const keyword = match[1].toLowerCase()
        const filtered = calloutKeywords.filter(k => k.startsWith(keyword))
        const triggerIndex = selectionStart - match[0].length
        if (filtered.length > 0) updateSuggestionBox(textarea, filtered, triggerIndex)
        else hideSuggestionBox()
      } else {
        hideSuggestionBox()
      }
    } else if (target.classList && target.classList.contains('ProseMirror')) {
      const selection = window.getSelection()
      if (!selection || selection.rangeCount === 0) {
        hideSuggestionBox()
        return
      }

      const range = selection.getRangeAt(0)
      const textBeforeCursor =
        range.startContainer.textContent && range.startContainer.textContent.substring(0, range.startOffset) || ''
      const match = textBeforeCursor.match(/(?:\[|［|【])(?:!|！)?([a-z]*)$/i)
      if (match) {
        const keyword = match[1].toLowerCase()
        const filtered = calloutKeywords.filter(k => k.startsWith(keyword))
        const triggerIndex = range.startOffset - match[0].length
        if (filtered.length > 0) updateSuggestionBox(target, filtered, triggerIndex)
        else hideSuggestionBox()
      } else {
        hideSuggestionBox()
      }
    }
  }

  function handleKeydown(event) {
    if (!suggestionBox || suggestionBox.style.display === 'none') return
    const items = suggestionBox.querySelectorAll('.callout-suggestion-item')
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
        const selectedKey = items[activeSuggestionIndex] && items[activeSuggestionIndex].dataset.key
        if (selectedKey) {
          const focused = document.activeElement
          if (focused) {
            if (focused instanceof HTMLTextAreaElement) {
              applyCompletion(focused, selectedKey)
            } else if (focused.classList && focused.classList.contains('ProseMirror')) {
              applyCompletion(focused, selectedKey)
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

  function initCalloutSuggestions() {
    try {
      createSuggestionBox()
      da('input', handleInput, true)
      da('keydown', handleKeydown, true)
      da('click', e => {
        if (
          e.target && e.target.tagName !== 'TEXTAREA' &&
          !suggestionBox.contains(e.target)
        ) {
          hideSuggestionBox()
        }
      })
      console.log('[Callout Suggestions] Initialized successfully')
    } catch (e) {
      console.error('[Callout Suggestions] Initialization failed', e)
    }
  }

  // ===== Discourse Detection =====
  function isDiscoursePage() {
    const discourseMetaTags = document.querySelectorAll(
      'meta[name*="discourse"], meta[content*="discourse"], meta[property*="discourse"]'
    )
    if (discourseMetaTags.length > 0) {
      console.log('[Callout Suggestions] Discourse detected via meta tags')
      return true
    }

    const generatorMeta = document.querySelector('meta[name="generator"]')
    if (generatorMeta) {
      const content = generatorMeta.getAttribute('content')
      if (content && content.toLowerCase().includes('discourse')) {
        console.log('[Callout Suggestions] Discourse detected via generator meta')
        return true
      }
    }

    const discourseElements = document.querySelectorAll(
      '#main-outlet, .ember-application, textarea.d-editor-input, .ProseMirror.d-editor-input'
    )
    if (discourseElements.length > 0) {
      console.log('[Callout Suggestions] Discourse elements detected')
      return true
    }

    console.log('[Callout Suggestions] Not a Discourse site')
    return false
  }

  // ===== Entry Point =====
  if (isDiscoursePage()) {
    console.log('[Callout Suggestions] Discourse detected, initializing callout suggestions')
    // Check forceMobileMode setting (respects global setting)
    if (shouldRespectForceMobileMode()) {
      console.log('[Callout Suggestions] Force mobile mode is enabled - respecting global setting')
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initCalloutSuggestions)
    } else {
      initCalloutSuggestions()
    }
  } else {
    console.log('[Callout Suggestions] Not a Discourse site, skipping initialization')
  }
})()
