// ==UserScript==
// @name         Discourse 颜色补全 ([co Color Suggestions)
// @namespace    https://github.com/stevessr/bug-v3
// @version      1.0.0
// @description  为 Discourse 编辑器添加 [co 触发的 [color=...][/color] 自动补全：色块菜单、最近使用、调色盘、屏幕取色与 HEX/RGB/HSL 格式切换 (Add [co-triggered color tag autocomplete to Discourse editors)
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
// @downloadURL  https://github.com/stevessr/bug-v3/releases/latest/download/color-suggestions.user.js
// @updateURL    https://github.com/stevessr/bug-v3/releases/latest/download/color-suggestions.user.js
// @run-at       document-end
// ==/UserScript==

;(function () {
  'use strict'

  // 防止同一页面重复注入（Discourse SPA 路由切换时脚本可能被再次执行）
  var INSTANCE_FLAG = '__colorSuggestionsUserscriptLoaded__'
  if (window[INSTANCE_FLAG]) {
    console.warn('[Color Suggestions] 检测到重复脚本实例，跳过初始化')
    return
  }
  window[INSTANCE_FLAG] = true

  // ===== 数据 =====
  // 经典颜色集合（CSS 命名色精选），全部以规范化小写 #rrggbb 存储
  var CLASSIC_COLORS = [
    { name: 'black', hex: '#000000', zh: '黑色' },
    { name: 'white', hex: '#ffffff', zh: '白色' },
    { name: 'red', hex: '#ff0000', zh: '红色' },
    { name: 'crimson', hex: '#dc143c', zh: '深红' },
    { name: 'orangered', hex: '#ff4500', zh: '橙红' },
    { name: 'coral', hex: '#ff7f50', zh: '珊瑚红' },
    { name: 'salmon', hex: '#fa8072', zh: '橙红' },
    { name: 'orange', hex: '#ffa500', zh: '橙色' },
    { name: 'gold', hex: '#ffd700', zh: '金色' },
    { name: 'yellow', hex: '#ffff00', zh: '黄色' },
    { name: 'khaki', hex: '#f0e68c', zh: '黄褐色' },
    { name: 'green', hex: '#008000', zh: '绿色' },
    { name: 'lime', hex: '#00ff00', zh: '青柠色' },
    { name: 'olive', hex: '#808000', zh: '橄榄色' },
    { name: 'teal', hex: '#008080', zh: '鸭绿色' },
    { name: 'cyan', hex: '#00ffff', zh: '青色' },
    { name: 'skyblue', hex: '#87ceeb', zh: '天蓝色' },
    { name: 'lightblue', hex: '#add8e6', zh: '浅蓝色' },
    { name: 'blue', hex: '#0000ff', zh: '蓝色' },
    { name: 'navy', hex: '#000080', zh: '藏青色' },
    { name: 'indigo', hex: '#4b0082', zh: '靛蓝色' },
    { name: 'purple', hex: '#800080', zh: '紫色' },
    { name: 'violet', hex: '#ee82ee', zh: '紫罗兰' },
    { name: 'magenta', hex: '#ff00ff', zh: '品红' },
    { name: 'pink', hex: '#ffc0cb', zh: '粉色' },
    { name: 'hotpink', hex: '#ff69b4', zh: '亮粉色' },
    { name: 'brown', hex: '#a52a2a', zh: '棕色' },
    { name: 'chocolate', hex: '#d2691e', zh: '巧克力色' },
    { name: 'silver', hex: '#c0c0c0', zh: '银色' },
    { name: 'dimgray', hex: '#696969', zh: '暗灰色' }
  ]

  // 「快捷插入」默认色块
  var QUICK_INSERT_HEXES = [
    '#ff0000',
    '#ff7f50',
    '#ffa500',
    '#ffd700',
    '#ffff00',
    '#00ff00',
    '#00ffff',
    '#0000ff',
    '#800080',
    '#ff69b4',
    '#000000',
    '#ffffff'
  ]

  var MAX_RECENT_COLORS = 100

  var STORAGE_KEY = 'emoji_ext_color_suggestions_v1' // 与扩展版本共享存储键
  var BOX_ID = 'color-suggestion-box'
  var STYLES_ID = 'color-suggestion-styles'
  var MIRROR_ID = 'color-suggestion-caret-mirror'
  var COLOR_TRIGGER_PREFIX = 'co'

  // ===== 状态 =====
  var recentColors = []
  var currentFormat = 'hex' // 'hex' | 'rgb' | 'hsl'
  var suggestionBox = null
  var navItems = [] // 可插入颜色的元素（快捷插入 + 最近使用 + 经典列表）
  var navSequence = [] // 菜单内全部可交互元素，用于焦点遍历
  var activeIndex = 0
  var activeEditor = null
  var lastKeyword = ''
  var paletteInput = null

  // ===== 存储持久化 =====
  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      var data = JSON.parse(raw)
      if (data && Array.isArray(data.colors)) {
        recentColors = data.colors
          .map(function (c) {
            return typeof c === 'string' ? normalizeToHex(c) : null
          })
          .filter(Boolean)
          .slice(0, MAX_RECENT_COLORS)
      }
      if (data && (data.format === 'hex' || data.format === 'rgb' || data.format === 'hsl')) {
        currentFormat = data.format
      }
    } catch (e) {
      console.warn('[Color Suggestions] 读取历史颜色失败:', e)
    }
  }

  function persistState() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ colors: recentColors, format: currentFormat })
      )
    } catch (e) {
      console.warn('[Color Suggestions] 保存历史颜色失败:', e)
    }
  }

  function recordRecent(hex) {
    var norm = normalizeToHex(hex)
    if (!norm) return
    recentColors = [norm].concat(
      recentColors.filter(function (c) {
        return c !== norm
      })
    )
    recentColors = recentColors.slice(0, MAX_RECENT_COLORS)
    persistState()
  }

  // ===== 颜色转换 =====
  // '#abc' / '#aabbcc' -> [r,g,b]，非法返回 null
  function parseHex(input) {
    var h = String(input || '')
      .trim()
      .toLowerCase()
    if (h.charAt(0) !== '#') return null
    h = h.slice(1)
    if (/^[0-9a-f]{3}$/.test(h)) {
      h = h
        .split('')
        .map(function (ch) {
          return ch + ch
        })
        .join('')
    } else if (!/^[0-9a-f]{6}$/.test(h)) {
      return null
    }
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
  }

  function rgbToHsl(r, g, b) {
    r /= 255
    g /= 255
    b /= 255
    var max = Math.max(r, g, b)
    var min = Math.min(r, g, b)
    var l = (max + min) / 2
    var h = 0
    var s = 0
    if (max !== min) {
      var d = max - min
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
      switch (max) {
        case r:
          h = (g - b) / d + (g < b ? 6 : 0)
          break
        case g:
          h = (b - r) / d + 2
          break
        default:
          h = (r - g) / d + 4
      }
      h *= 60
    }
    return [Math.round(h), Math.round(s * 100), Math.round(l * 100)]
  }

  // 任意 hex 输入规范化为小写 '#rrggbb'，非法返回 null
  function normalizeToHex(input) {
    var rgb = parseHex(input)
    if (!rgb) return null
    var out = '#'
    for (var i = 0; i < rgb.length; i++) {
      out += rgb[i].toString(16).padStart(2, '0')
    }
    return out
  }

  // 按当前格式把 hex 转为插入用字符串：#rrggbb | rgb(r, g, b) | hsl(h, s%, l%)
  function formatColor(hex, fmt) {
    var norm = normalizeToHex(hex) || '#000000'
    var rgb = parseHex(norm) || [0, 0, 0]
    if (fmt === 'rgb') {
      return 'rgb(' + rgb.join(', ') + ')'
    }
    if (fmt === 'hsl') {
      var hsl = rgbToHsl(rgb[0], rgb[1], rgb[2])
      return 'hsl(' + hsl[0] + ', ' + hsl[1] + '%, ' + hsl[2] + '%)'
    }
    return norm
  }

  // ===== 触发检测 =====
  // 光标前的文本匹配 `[coxxx`（仅字母，且必须以 co 开头）时触发。
  // 返回 start = '[' 在文本中的下标，keyword = 前缀 co 之后的过滤关键字。
  function matchColorTrigger(before, pos) {
    var m = before.match(/\[([a-zA-Z]{1,10})$/)
    if (!m) return null
    var token = m[1].toLowerCase()
    if (token.indexOf(COLOR_TRIGGER_PREFIX) !== 0) return null
    return { start: pos - m[0].length, keyword: token.slice(COLOR_TRIGGER_PREFIX.length) }
  }

  function getColorTriggerFromProseMirror() {
    var selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return null
    var range = selection.getRangeAt(0)
    if (!range.collapsed) return null
    var before = ((range.startContainer.textContent || '') + '').slice(0, range.startOffset)
    return matchColorTrigger(before, range.startOffset)
  }

  // ===== 颜色过滤 =====
  function filterClassicColors(keyword) {
    if (!keyword) return CLASSIC_COLORS.slice()
    var kw = keyword.toLowerCase()
    var starts = CLASSIC_COLORS.filter(function (c) {
      return c.name.toLowerCase().indexOf(kw) === 0
    })
    var contains = CLASSIC_COLORS.filter(function (c) {
      return c.name.toLowerCase().indexOf(kw) !== 0 && c.name.toLowerCase().indexOf(kw) !== -1
    })
    return starts.concat(contains)
  }

  // ===== 插入 =====
  function applyToTextarea(el, value) {
    var open = '[color=' + value + ']'
    var close = '[/color]'
    var pos = el.selectionStart != null ? el.selectionStart : el.value.length
    var trig = matchColorTrigger(el.value.slice(0, pos), pos)
    // 有触发符则替换 `[coxxx`，否则在光标处直接插入
    var start = trig ? trig.start : pos
    el.value = el.value.slice(0, start) + open + close + el.value.slice(pos)
    // 光标放在两组标签之间
    var caret = start + open.length
    el.selectionStart = caret
    el.selectionEnd = caret
    el.focus()
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }

  function applyToProseMirror(el, value) {
    try {
      var selection = window.getSelection()
      if (!selection || selection.rangeCount === 0) return false
      var range = selection.getRangeAt(0)
      var node = range.startContainer
      var offset = range.startOffset
      var trig = matchColorTrigger((node.textContent || '').slice(0, offset), offset)

      var openNode = document.createTextNode('[color=' + value + ']')
      var closeNode = document.createTextNode('[/color]')
      var workRange = document.createRange()
      if (trig) {
        // 删除从 '[' 到光标的触发文本
        workRange.setStart(node, trig.start)
        workRange.setEnd(node, offset)
      } else {
        workRange.setStart(node, offset)
        workRange.setEnd(node, offset)
      }
      workRange.deleteContents()
      // 先插 close 再插 open，最终顺序为 open -> close
      workRange.insertNode(closeNode)
      workRange.insertNode(openNode)

      // 光标放在两组标签之间
      var caret = document.createRange()
      caret.setStartAfter(openNode)
      caret.collapse(true)
      selection.removeAllRanges()
      selection.addRange(caret)

      el.dispatchEvent(new Event('input', { bubbles: true }))
      return true
    } catch (e) {
      console.error('[Color Suggestions] ProseMirror 插入失败', e)
      return false
    }
  }

  function insertColorFromHex(hex) {
    var norm = normalizeToHex(hex)
    if (!norm) return
    var editor = activeEditor
    if (!editor || !editor.isConnected) {
      hideSuggestionBox()
      return
    }
    var value = formatColor(norm, currentFormat)
    if (editor.tagName === 'TEXTAREA') {
      applyToTextarea(editor, value)
    } else if (!applyToProseMirror(editor, value)) {
      return
    }
    recordRecent(norm)
    hideSuggestionBox()
  }

  // ===== 光标定位（镜像法）=====
  function getCaretXY(editor) {
    if (editor.tagName === 'TEXTAREA') {
      var rect = editor.getBoundingClientRect()
      var mirror = document.getElementById(MIRROR_ID)
      if (!mirror) {
        mirror = document.createElement('div')
        mirror.id = MIRROR_ID
        document.body.appendChild(mirror)
      }
      var style = window.getComputedStyle(editor)
      var props = [
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
      for (var i = 0; i < props.length; i++) {
        mirror.style[props[i]] = style.getPropertyValue(props[i])
      }
      mirror.style.position = 'absolute'
      mirror.style.left = rect.left + window.scrollX + 'px'
      mirror.style.top = rect.top + window.scrollY + 'px'
      mirror.style.width = rect.width + 'px'
      mirror.style.height = rect.height + 'px'
      mirror.style.overflow = 'hidden'
      mirror.style.visibility = 'hidden'
      mirror.style.whiteSpace = 'pre-wrap'
      mirror.style.wordWrap = 'break-word'

      var selEnd = editor.selectionEnd != null ? editor.selectionEnd : 0
      mirror.textContent = editor.value.substring(0, selEnd)
      var span = document.createElement('span')
      span.textContent = '​'
      mirror.appendChild(span)

      var spanRect = span.getBoundingClientRect()
      return { x: spanRect.left, y: spanRect.top, bottom: spanRect.bottom }
    }

    // ProseMirror：直接使用选区矩形
    var selection = window.getSelection()
    if (selection && selection.rangeCount > 0) {
      var selRect = selection.getRangeAt(0).getBoundingClientRect()
      if (selRect.width || selRect.height || selRect.top || selRect.left) {
        return { x: selRect.left, y: selRect.top, bottom: selRect.bottom }
      }
    }
    var fallback = editor.getBoundingClientRect()
    return { x: fallback.left, y: fallback.top, bottom: fallback.bottom }
  }

  // ===== 菜单 UI =====
  function injectStyles() {
    var css =
      '#' +
      BOX_ID +
      ` {
      position: absolute;
      z-index: 99999;
      width: 300px;
      padding: 8px;
      background-color: var(--secondary, #fff);
      color: var(--primary-high, #222);
      border: 1px solid var(--primary-low-mid, #ccc);
      border-radius: 10px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
      font-size: 13px;
      display: none;
      user-select: none;
      /* 空白区域对点击穿透，避免菜单悬浮遮挡下方编辑器导致无法点击 */
      pointer-events: none;
    }
    #` +
      BOX_ID +
      ` .cs-chips,
    #` +
      BOX_ID +
      ` .cs-list,
    #` +
      BOX_ID +
      ` .cs-format-btn,
    #` +
      BOX_ID +
      ` .cs-tool {
      pointer-events: auto;
    }
    #` +
      BOX_ID +
      ` .cs-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 4px;
    }
    #` +
      BOX_ID +
      ` .cs-title { font-weight: 600; }
    #` +
      BOX_ID +
      ` .cs-formats {
      display: flex;
      border: 1px solid var(--primary-low-mid, #ddd);
      border-radius: 6px;
      overflow: hidden;
    }
    #` +
      BOX_ID +
      ` .cs-format-btn {
      padding: 2px 8px;
      border: none;
      background: transparent;
      color: inherit;
      font-size: 12px;
      cursor: pointer;
    }
    #` +
      BOX_ID +
      ` .cs-format-btn.active {
      background: var(--tertiary, #0088cc);
      color: #fff;
    }
    #` +
      BOX_ID +
      ` .cs-section-label {
      font-size: 11px;
      opacity: 0.65;
      margin: 6px 0 4px;
    }
    #` +
      BOX_ID +
      ` .cs-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      max-height: 78px;
      overflow-y: auto;
    }
    #` +
      BOX_ID +
      ` .cs-chip {
      width: 22px;
      height: 22px;
      padding: 0;
      border-radius: 5px;
      border: 1px solid rgba(128, 128, 128, 0.45);
      cursor: pointer;
    }
    #` +
      BOX_ID +
      ` .cs-list {
      max-height: 190px;
      overflow-y: auto;
    }
    #` +
      BOX_ID +
      ` .cs-row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 6px;
      border-radius: 6px;
      cursor: pointer;
      font-family: monospace;
      /* 行元素用 <button> 实现，保证键盘可聚焦/可激活 */
      width: 100%;
      background: none;
      border: none;
      color: inherit;
      text-align: left;
    }
    #` +
      BOX_ID +
      ` .cs-swatch {
      width: 16px;
      height: 16px;
      border-radius: 4px;
      border: 1px solid rgba(128, 128, 128, 0.45);
      flex: none;
    }
    #` +
      BOX_ID +
      ` .cs-name { white-space: nowrap; }
    #` +
      BOX_ID +
      ` .cs-zh {
      margin-left: auto;
      font-family: sans-serif;
      font-size: 12px;
      opacity: 0.55;
      white-space: nowrap;
    }
    #` +
      BOX_ID +
      ` .cs-val {
      font-size: 12px;
      opacity: 0.7;
      white-space: nowrap;
    }
    #` +
      BOX_ID +
      ` .cs-item.active {
      outline: 2px solid var(--tertiary, #0088cc);
      outline-offset: -2px;
      background-color: var(--primary-low, #eee);
    }
    #` +
      BOX_ID +
      ` .cs-item:focus-visible,
    #` +
      BOX_ID +
      ` .cs-format-btn:focus-visible,
    #` +
      BOX_ID +
      ` .cs-tool:focus-visible {
      outline: 2px solid var(--tertiary, #0088cc);
      outline-offset: -2px;
    }
    #` +
      BOX_ID +
      ` .cs-footer {
      display: flex;
      gap: 6px;
      margin-top: 8px;
      padding-top: 6px;
      border-top: 1px solid var(--primary-low, #eee);
    }
    #` +
      BOX_ID +
      ` .cs-tool {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 4px;
      border: 1px solid var(--primary-low-mid, #ddd);
      border-radius: 6px;
      background: var(--secondary, #fff);
      color: inherit;
      font-size: 12px;
      cursor: pointer;
    }
    #` +
      BOX_ID +
      ` .cs-tool:hover { background: var(--primary-low, #f0f0f0); }`
    var existing = document.getElementById(STYLES_ID)
    if (existing) existing.remove()
    var styleEl = document.createElement('style')
    styleEl.id = STYLES_ID
    styleEl.textContent = css
    document.head.appendChild(styleEl)
  }

  function createSuggestionBox() {
    if (suggestionBox) return
    suggestionBox = document.createElement('div')
    suggestionBox.id = BOX_ID
    document.body.appendChild(suggestionBox)
    injectStyles()
  }

  function hideSuggestionBox() {
    if (suggestionBox) suggestionBox.style.display = 'none'
  }

  function updateActiveItem() {
    if (!suggestionBox) return
    for (var i = 0; i < navItems.length; i++) {
      var it = navItems[i]
      if (i === activeIndex) {
        it.classList.add('active')
        it.scrollIntoView({ block: 'nearest' })
      } else {
        it.classList.remove('active')
      }
    }
  }

  // 清除高亮（进入焦点模式后改由 :focus-visible 提示位置）
  function clearHighlight() {
    if (!suggestionBox) return
    suggestionBox.querySelectorAll('.cs-item.active').forEach(function (el) {
      el.classList.remove('active')
    })
  }

  // 生成一排颜色快捷块 HTML
  function buildColorChips(hexes) {
    var html = ''
    for (var i = 0; i < hexes.length; i++) {
      var hex = hexes[i]
      html +=
        '<button type="button" class="cs-chip cs-item" data-hex="' +
        hex +
        '" title="' +
        hex +
        '" style="background:' +
        hex +
        '"></button>'
    }
    return html
  }

  function buildFormatButtons() {
    var formats = ['hex', 'rgb', 'hsl']
    var html = ''
    for (var i = 0; i < formats.length; i++) {
      var f = formats[i]
      var activeClass = f === currentFormat ? ' active' : ''
      html +=
        '<button type="button" class="cs-format-btn' +
        activeClass +
        '" data-fmt="' +
        f +
        '">' +
        f.toUpperCase() +
        '</button>'
    }
    return html
  }

  function buildClassicRows(classic) {
    var html = ''
    for (var i = 0; i < classic.length; i++) {
      var c = classic[i]
      html +=
        '<button type="button" class="cs-row cs-item" data-hex="' +
        c.hex +
        '"><span class="cs-swatch" style="background:' +
        c.hex +
        '"></span><span class="cs-name">' +
        c.name +
        '</span><span class="cs-zh">' +
        c.zh +
        '</span><span class="cs-val">' +
        formatColor(c.hex, currentFormat) +
        '</span></button>'
    }
    return html
  }

  function renderMenu(keyword) {
    if (!suggestionBox) return
    var classic = filterClassicColors(keyword)

    var recentSection = ''
    if (recentColors.length > 0) {
      recentSection =
        '<div class="cs-section-label">最近使用 (' +
        recentColors.length +
        '/' +
        MAX_RECENT_COLORS +
        ')</div><div class="cs-chips">' +
        buildColorChips(recentColors) +
        '</div>'
    }

    var dropperButtonHtml = ''
    if (window.EyeDropper) {
      dropperButtonHtml =
        '<button type="button" class="cs-tool" id="cs-eyedropper-btn">🎯 屏幕取色</button>'
    }

    suggestionBox.innerHTML =
      '<div class="cs-header">' +
      '<span class="cs-title">🎨 颜色补全</span>' +
      '<div class="cs-formats">' +
      buildFormatButtons() +
      '</div></div>' +
      '<div class="cs-section-label">快捷插入</div>' +
      '<div class="cs-chips">' +
      buildColorChips(QUICK_INSERT_HEXES) +
      '</div>' +
      recentSection +
      '<div class="cs-section-label">经典颜色</div>' +
      '<div class="cs-list">' +
      buildClassicRows(classic) +
      '</div>' +
      '<div class="cs-footer"><button type="button" class="cs-tool" id="cs-palette-btn">🎨 调色盘</button>' +
      dropperButtonHtml +
      '</div>'

    bindMenuEvents()
    navItems = Array.prototype.slice.call(suggestionBox.querySelectorAll('.cs-item'))
    navSequence = Array.prototype.slice.call(
      suggestionBox.querySelectorAll('.cs-format-btn, .cs-tool, .cs-item')
    )
    activeIndex = 0
  }

  function bindMenuEvents() {
    if (!suggestionBox) return

    // 格式切换：重渲染菜单并保持当前过滤关键字
    suggestionBox.querySelectorAll('.cs-format-btn').forEach(function (btn) {
      btn.addEventListener('mousedown', function (e) {
        e.preventDefault()
      })
      btn.addEventListener('click', function (e) {
        e.preventDefault()
        var fmt = btn.getAttribute('data-fmt')
        if (fmt !== 'hex' && fmt !== 'rgb' && fmt !== 'hsl') return
        currentFormat = fmt
        persistState()
        renderMenu(lastKeyword)
        updateActiveItem()
        // 键盘 Enter 激活时 DOM 已重建，恢复该按钮焦点以便继续纯键盘操作
        var box = suggestionBox
        var again = box ? box.querySelector('.cs-format-btn[data-fmt="' + fmt + '"]') : null
        if (!document.activeElement || document.activeElement === document.body) {
          if (again) again.focus()
        }
      })
    })

    // 颜色项（快捷插入 + 最近使用 + 经典列表）
    suggestionBox.querySelectorAll('.cs-item').forEach(function (item) {
      item.addEventListener('mousedown', function (e) {
        e.preventDefault()
      })
      item.addEventListener('click', function (e) {
        e.preventDefault()
        insertColorFromHex(item.getAttribute('data-hex') || '')
      })
    })

    // 调色盘
    var paletteBtn = suggestionBox.querySelector('#cs-palette-btn')
    if (paletteBtn) {
      paletteBtn.addEventListener('mousedown', function (e) {
        e.preventDefault()
      })
      paletteBtn.addEventListener('click', function (e) {
        e.preventDefault()
        openPalette()
      })
    }

    // 屏幕取色
    var dropperBtn = suggestionBox.querySelector('#cs-eyedropper-btn')
    if (dropperBtn) {
      dropperBtn.addEventListener('mousedown', function (e) {
        e.preventDefault()
      })
      dropperBtn.addEventListener('click', function (e) {
        e.preventDefault()
        openEyeDropper()
      })
    }
  }

  function positionSuggestionBox(editor) {
    if (!suggestionBox) return
    // 先以隐藏可见方式渲染以便测量尺寸
    suggestionBox.style.visibility = 'hidden'
    suggestionBox.style.display = 'block'
    var boxRect = suggestionBox.getBoundingClientRect()

    var caret = getCaretXY(editor)
    var margin = 6
    var viewportHeight = window.innerHeight
    var viewportWidth = window.innerWidth

    var top = caret.bottom + margin
    if (top + boxRect.height > viewportHeight - 8) {
      // 放不下则翻转到光标上方
      top = Math.max(8, caret.y - boxRect.height - margin)
    }
    var left = Math.min(Math.max(8, caret.x), Math.max(8, viewportWidth - boxRect.width - 8))

    // 转换为页面坐标定位（盒子挂在 body 下，position: absolute）
    suggestionBox.style.left = left + window.scrollX + 'px'
    suggestionBox.style.top = top + window.scrollY + 'px'
    suggestionBox.style.visibility = 'visible'
  }

  function showSuggestionBox(editor, keyword) {
    lastKeyword = keyword
    ensurePaletteInput()
    createSuggestionBox()
    renderMenu(keyword)
    if (navItems.length === 0) {
      hideSuggestionBox()
      return
    }
    positionSuggestionBox(editor)
    updateActiveItem()
  }

  // ===== 调色盘 / 取色器 =====
  function ensurePaletteInput() {
    if (paletteInput) return
    paletteInput = document.createElement('input')
    paletteInput.type = 'color'
    // 放到视口外但保持“已渲染”状态：display:none / opacity:0 的取色控件在部分
    // Chromium 版本中 showPicker()/click() 弹不出原生调色盘
    paletteInput.style.cssText =
      'position:fixed;left:-200px;top:-200px;width:24px;height:24px;margin:0;border:0;padding:0;'
    paletteInput.addEventListener('change', function () {
      var hex = normalizeToHex(paletteInput ? paletteInput.value : '')
      if (hex) insertColorFromHex(hex)
    })
    document.body.appendChild(paletteInput)
  }

  function openPalette() {
    ensurePaletteInput()
    if (!paletteInput) return
    // 打开时带上当前选中候选色作为初始值
    paletteInput.value =
      (navItems[activeIndex] && navItems[activeIndex].getAttribute('data-hex')) || '#ffffff'
    // showPicker() 显式弹出选择器且不要求元素可见；旧浏览器回退 click()
    try {
      paletteInput.showPicker()
    } catch (e) {
      paletteInput.click()
    }
  }

  function openEyeDropper() {
    if (!window.EyeDropper) return
    new window.EyeDropper()
      .open()
      .then(function (res) {
        var hex = normalizeToHex(res.sRGBHex || '')
        if (hex) insertColorFromHex(hex)
      })
      .catch(function () {
        // 用户取消取色，忽略
      })
  }

  // ===== 事件处理 =====
  function handleInput(event) {
    var target = event.target
    if (!target) return

    if (target.tagName === 'TEXTAREA') {
      var pos = target.selectionStart || 0
      var trig = matchColorTrigger(target.value.slice(0, pos), pos)
      if (!trig) {
        hideSuggestionBox()
        return
      }
      activeEditor = target
      showSuggestionBox(target, trig.keyword)
    } else if (target.classList && target.classList.contains('ProseMirror')) {
      var pmTrig = getColorTriggerFromProseMirror()
      if (!pmTrig) {
        hideSuggestionBox()
        return
      }
      activeEditor = target
      showSuggestionBox(target, pmTrig.keyword)
    }
  }

  // 从编辑器进入菜单焦点模式：落在当前高亮项（↓）或最后一个元素（↑）
  function enterMenuFocus(dir) {
    if (navSequence.length === 0) return
    var cur = navItems[activeIndex]
    var idx = cur ? navSequence.indexOf(cur) : -1
    if (idx === -1) idx = dir === 1 ? 0 : navSequence.length - 1
    clearHighlight()
    if (navSequence[idx]) navSequence[idx].focus()
  }

  // 在菜单内的可交互元素间移动真实 DOM 焦点
  function moveMenuFocus(current, dir) {
    if (navSequence.length === 0) return
    var idx = current ? navSequence.indexOf(current) : -1
    if (idx === -1) return
    var next = (idx + dir + navSequence.length) % navSequence.length
    if (navSequence[next]) navSequence[next].focus()
  }

  function handleKeydown(event) {
    if (!suggestionBox || suggestionBox.style.display === 'none') return
    var target = event.target

    // --- 焦点在菜单内：↑/↓ 移动焦点，Esc 关闭并回到编辑器；Enter/Space/Tab 走原生按钮行为 ---
    if (target && suggestionBox.contains(target)) {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        hideSuggestionBox()
        if (activeEditor) activeEditor.focus()
      } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        event.stopPropagation()
        moveMenuFocus(target, event.key === 'ArrowDown' ? 1 : -1)
      }
      return
    }

    // --- 焦点在编辑器：高亮导航；↓/↑ 同时把焦点移入菜单实现纯键盘操作 ---
    var focusedEditor =
      (target && target.tagName === 'TEXTAREA') ||
      (target && target.classList && target.classList.contains('ProseMirror'))
    if (!focusedEditor) return
    if (['ArrowDown', 'ArrowUp', 'Tab', 'Enter', 'Escape'].indexOf(event.key) === -1) return

    // 菜单打开期间拦截按键，避免 Enter 直接发送聊天消息等行为
    event.preventDefault()
    event.stopPropagation()

    switch (event.key) {
      case 'Escape':
        hideSuggestionBox()
        break
      case 'ArrowDown':
        enterMenuFocus(1)
        break
      case 'ArrowUp':
        enterMenuFocus(-1)
        break
      case 'Tab':
      case 'Enter': {
        var item = navItems[activeIndex]
        if (item) insertColorFromHex(item.getAttribute('data-hex') || '')
        else hideSuggestionBox()
        break
      }
    }
  }

  // ===== 初始化 =====
  function init() {
    try {
      loadState()
      createSuggestionBox()
      document.addEventListener('input', handleInput, true)
      document.addEventListener('keydown', handleKeydown, true)
      document.addEventListener(
        'click',
        function (e) {
          var t = e.target
          if (t && suggestionBox && suggestionBox.contains(t)) return
          if (t && t === paletteInput) return
          hideSuggestionBox()
        },
        true
      )
      console.log('[Color Suggestions] 已加载：编辑器中输入 [co 触发颜色补全')
    } catch (e) {
      // 不要抛出错误影响页面其它逻辑
      console.error('[Color Suggestions] 初始化失败', e)
    }
  }

  init()
})()
