// color-suggestions.ts - 在编辑输入 `[co` 时显示 `[color=...][/color]` 颜色自动补全菜单
// 结构与 callout-suggestions.ts 一致（document 捕获阶段 input/keydown 监听 + 光标镜像定位）。
// 功能：
//  - 补全菜单展示经典颜色色块（名称 + 中文 + 当前格式值）
//  - 「快捷插入」默认给出常用经典颜色色块，点击即插入
//  - 最近使用颜色记录（去重，上限 100，chrome.storage.local 持久化）
//  - 调色盘（原生 input[type=color]）、屏幕取色（EyeDropper API，支持时显示）
//  - HEX / RGB / HSL 插入格式切换（随最近使用一起持久化）

import { ESI } from '@/content/utils/injectCustomCss'
import { createE, DOA, DEBI, DAEL } from '@/content/utils/dom/createEl'
import { CLASSIC_COLORS, QUICK_INSERT_HEXES, MAX_RECENT_COLORS } from '@/content/data/colors'
import type { ClassicColor } from '@/content/data/colors'

type ColorFormat = 'hex' | 'rgb' | 'hsl'

// textarea（话题编辑器 / 聊天输入框）或 ProseMirror 编辑器
type EditorEl = HTMLTextAreaElement | HTMLElement

const STORAGE_KEY = 'emoji_ext_color_suggestions_v1'
const BOX_ID = 'color-suggestion-box'
const STYLES_ID = 'color-suggestion-styles'
const MIRROR_ID = 'color-suggestion-caret-mirror'
const COLOR_TRIGGER_PREFIX = 'co'

let recentColors: string[] = []
let currentFormat: ColorFormat = 'hex'

let suggestionBox: HTMLDivElement | null = null
let navItems: HTMLElement[] = []
// 菜单内全部可交互元素（格式按钮 / 色块 / 颜色行 / 工具按钮），按 DOM 顺序用于焦点遍历
let navSequence: HTMLElement[] = []
let activeIndex = 0
let activeEditor: EditorEl | null = null
let lastKeyword = ''

// ------------------------- 颜色转换 -------------------------

// '#abc' / '#aabbcc' -> [r,g,b]，非法返回 null
function parseHex(input: string): [number, number, number] | null {
  let h = String(input ?? '')
    .trim()
    .toLowerCase()
  if (!h.startsWith('#')) return null
  h = h.slice(1)
  if (/^[0-9a-f]{3}$/.test(h)) {
    h = h
      .split('')
      .map(ch => ch + ch)
      .join('')
  } else if (!/^[0-9a-f]{6}$/.test(h)) {
    return null
  }
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  let h = 0
  let s = 0
  if (max !== min) {
    const d = max - min
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
function normalizeToHex(input: string): string | null {
  const rgb = parseHex(input)
  if (!rgb) return null
  let out = '#'
  for (const v of rgb) {
    out += v.toString(16).padStart(2, '0')
  }
  return out
}

// 按当前格式把 hex 转为插入用字符串：#rrggbb | rgb(r, g, b) | hsl(h, s%, l%)
function formatColor(hex: string, fmt: ColorFormat): string {
  const norm = normalizeToHex(hex) ?? '#000000'
  const rgb = parseHex(norm) ?? [0, 0, 0]
  if (fmt === 'rgb') {
    return `rgb(${rgb.join(', ')})`
  }
  if (fmt === 'hsl') {
    const [h, s, l] = rgbToHsl(rgb[0], rgb[1], rgb[2])
    return `hsl(${h}, ${s}%, ${l}%)`
  }
  return norm
}

// ------------------------- 状态持久化 -------------------------

interface StoredColorState {
  colors?: unknown
  format?: unknown
}

function isStoredColorState(value: unknown): value is StoredColorState {
  return typeof value === 'object' && value !== null
}

function hydrate(raw: StoredColorState | null) {
  if (raw && Array.isArray(raw.colors)) {
    recentColors = (raw.colors as unknown[])
      .map(c => (typeof c === 'string' ? normalizeToHex(c) : null))
      .filter((c): c is string => !!c)
      .slice(0, MAX_RECENT_COLORS)
  }
  if (raw && (raw.format === 'hex' || raw.format === 'rgb' || raw.format === 'hsl')) {
    currentFormat = raw.format
  }
}

async function loadState() {
  const chromeAPI = window.chrome
  if (chromeAPI?.storage?.local) {
    try {
      const res: unknown = await chromeAPI.storage.local.get(STORAGE_KEY)
      const record = isRecordOfStringKey(res) ? res[STORAGE_KEY] : undefined
      hydrate(isStoredColorState(record) ? record : null)
      return
    } catch {
      // 读取失败则回退到 localStorage
    }
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw)
      hydrate(isStoredColorState(JSON.parse(raw)) ? (JSON.parse(raw) as StoredColorState) : null)
  } catch {
    // ignore
  }
}

function isRecordOfStringKey(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function persistState() {
  const payload = { colors: recentColors, format: currentFormat }
  const chromeAPI = window.chrome
  if (chromeAPI?.storage?.local) {
    try {
      void chromeAPI.storage.local.set({ [STORAGE_KEY]: payload })
      return
    } catch {
      // 写入失败则回退到 localStorage
    }
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // ignore
  }
}

function recordRecent(hex: string) {
  const norm = normalizeToHex(hex)
  if (!norm) return
  recentColors = [norm, ...recentColors.filter(c => c !== norm)].slice(0, MAX_RECENT_COLORS)
  persistState()
}

// ------------------------- 触发检测 -------------------------

// 光标前的文本匹配 `[coxxx`（仅字母，且必须以 co 开头）时触发。
// 返回 start = '[' 在文本中的下标，keyword = 前缀 co 之后的过滤关键字。
function matchColorTrigger(before: string, pos: number): { start: number; keyword: string } | null {
  const m = before.match(/\[([a-zA-Z]{1,10})$/)
  if (!m) return null
  const token = m[1].toLowerCase()
  if (!token.startsWith(COLOR_TRIGGER_PREFIX)) return null
  return { start: pos - m[0].length, keyword: token.slice(COLOR_TRIGGER_PREFIX.length) }
}

function getColorTriggerFromProseMirror(): { start: number; keyword: string } | null {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return null
  const range = selection.getRangeAt(0)
  if (!range.collapsed) return null
  const before = (range.startContainer.textContent || '').slice(0, range.startOffset)
  return matchColorTrigger(before, range.startOffset)
}

// ------------------------- 颜色过滤 -------------------------

function filterClassicColors(keyword: string): ClassicColor[] {
  if (!keyword) return CLASSIC_COLORS.slice()
  const kw = keyword.toLowerCase()
  const starts = CLASSIC_COLORS.filter(c => c.name.toLowerCase().startsWith(kw))
  const contains = CLASSIC_COLORS.filter(
    c => !c.name.toLowerCase().startsWith(kw) && c.name.toLowerCase().includes(kw)
  )
  return [...starts, ...contains]
}

// ------------------------- 插入 -------------------------

function applyToTextarea(el: HTMLTextAreaElement, value: string) {
  const open = `[color=${value}]`
  const close = '[/color]'
  const pos = el.selectionStart ?? el.value.length
  const trig = matchColorTrigger(el.value.slice(0, pos), pos)
  // 有触发符则替换 `[cxxx`，否则在光标处直接插入
  const start = trig ? trig.start : pos
  el.value = el.value.slice(0, start) + open + close + el.value.slice(pos)
  // 光标放在两组标签之间
  const caret = start + open.length
  el.selectionStart = el.selectionEnd = caret
  el.focus()
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

function applyToProseMirror(el: HTMLElement, value: string): boolean {
  try {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return false
    const range = selection.getRangeAt(0)
    const node = range.startContainer
    const offset = range.startOffset
    const trig = matchColorTrigger((node.textContent || '').slice(0, offset), offset)

    const openNode = document.createTextNode(`[color=${value}]`)
    const closeNode = document.createTextNode('[/color]')
    const workRange = document.createRange()
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
    const caret = document.createRange()
    caret.setStartAfter(openNode)
    caret.collapse(true)
    selection.removeAllRanges()
    selection.addRange(caret)

    el.dispatchEvent(new Event('input', { bubbles: true }))
    return true
  } catch (e) {
    console.error('[DiscourseOneClick] color completion (ProseMirror) failed', e)
    return false
  }
}

function insertColorFromHex(hex: string) {
  const norm = normalizeToHex(hex)
  if (!norm) return
  const editor = activeEditor
  if (!editor || !editor.isConnected) {
    hideSuggestionBox()
    return
  }
  const value = formatColor(norm, currentFormat)
  if (editor instanceof HTMLTextAreaElement) {
    applyToTextarea(editor, value)
  } else if (!applyToProseMirror(editor, value)) {
    return
  }
  recordRecent(norm)
  hideSuggestionBox()
}

// ------------------------- 光标定位（镜像法） -------------------------

// 返回视口坐标系中的插入点位置
function getCaretXY(editor: EditorEl) {
  if (editor instanceof HTMLTextAreaElement) {
    const rect = editor.getBoundingClientRect()
    let mirror = DEBI(MIRROR_ID)
    if (!mirror) {
      mirror = createE('div', { id: MIRROR_ID })
      DOA(mirror)
    }
    const style = window.getComputedStyle(editor)
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
    // CSSStyleDeclaration 缺少字符串索引签名，这里统一按字符串键赋值
    const ms = mirror.style as unknown as Record<string, string>
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

    mirror.textContent = editor.value.substring(0, editor.selectionEnd ?? 0)
    const span = createE('span')
    span.textContent = '​'
    mirror.appendChild(span)

    const spanRect = span.getBoundingClientRect()
    return { x: spanRect.left, y: spanRect.top, bottom: spanRect.bottom }
  }

  // ProseMirror：直接使用选区矩形
  const selection = window.getSelection()
  if (selection && selection.rangeCount > 0) {
    const rect = selection.getRangeAt(0).getBoundingClientRect()
    if (rect.width || rect.height || rect.top || rect.left) {
      return { x: rect.left, y: rect.top, bottom: rect.bottom }
    }
  }
  const fallback = editor.getBoundingClientRect()
  return { x: fallback.left, y: fallback.top, bottom: fallback.bottom }
}

// ------------------------- 菜单 UI -------------------------

function injectStyles() {
  const css = `
    #${BOX_ID} {
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
    #${BOX_ID} .cs-chips,
    #${BOX_ID} .cs-list,
    #${BOX_ID} .cs-format-btn,
    #${BOX_ID} .cs-tool {
      pointer-events: auto;
    }
    #${BOX_ID} .cs-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 4px;
    }
    #${BOX_ID} .cs-title { font-weight: 600; }
    #${BOX_ID} .cs-formats {
      display: flex;
      border: 1px solid var(--primary-low-mid, #ddd);
      border-radius: 6px;
      overflow: hidden;
    }
    #${BOX_ID} .cs-format-btn {
      padding: 2px 8px;
      border: none;
      background: transparent;
      color: inherit;
      font-size: 12px;
      cursor: pointer;
    }
    #${BOX_ID} .cs-format-btn.active {
      background: var(--tertiary, #0088cc);
      color: #fff;
    }
    #${BOX_ID} .cs-section-label {
      font-size: 11px;
      opacity: 0.65;
      margin: 6px 0 4px;
    }
    #${BOX_ID} .cs-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      max-height: 78px;
      overflow-y: auto;
    }
    #${BOX_ID} .cs-chip {
      width: 22px;
      height: 22px;
      padding: 0;
      border-radius: 5px;
      border: 1px solid rgba(128, 128, 128, 0.45);
      cursor: pointer;
    }
    #${BOX_ID} .cs-list {
      max-height: 190px;
      overflow-y: auto;
    }
    #${BOX_ID} .cs-row {
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
    #${BOX_ID} .cs-swatch {
      width: 16px;
      height: 16px;
      border-radius: 4px;
      border: 1px solid rgba(128, 128, 128, 0.45);
      flex: none;
    }
    #${BOX_ID} .cs-name { white-space: nowrap; }
    #${BOX_ID} .cs-zh {
      margin-left: auto;
      font-family: sans-serif;
      font-size: 12px;
      opacity: 0.55;
      white-space: nowrap;
    }
    #${BOX_ID} .cs-val {
      font-size: 12px;
      opacity: 0.7;
      white-space: nowrap;
    }
    #${BOX_ID} .cs-item.active {
      outline: 2px solid var(--tertiary, #0088cc);
      outline-offset: -2px;
      background-color: var(--primary-low, #eee);
    }
    #${BOX_ID} .cs-footer {
      display: flex;
      gap: 6px;
      margin-top: 8px;
      padding-top: 6px;
      border-top: 1px solid var(--primary-low, #eee);
    }
    #${BOX_ID} .cs-item:focus-visible,
    #${BOX_ID} .cs-format-btn:focus-visible,
    #${BOX_ID} .cs-tool:focus-visible {
      outline: 2px solid var(--tertiary, #0088cc);
      outline-offset: -2px;
    }
    #${BOX_ID} .cs-tool {
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
    #${BOX_ID} .cs-tool:hover { background: var(--primary-low, #f0f0f0); }
  `
  ESI(STYLES_ID, css)
}

function createSuggestionBox() {
  if (suggestionBox) return
  suggestionBox = createE('div', { id: BOX_ID })
  DOA(suggestionBox)
  injectStyles()
}

function hideSuggestionBox() {
  if (suggestionBox) suggestionBox.style.display = 'none'
}

function updateActiveItem() {
  if (!suggestionBox) return
  navItems.forEach((it, idx) => {
    it.classList.toggle('active', idx === activeIndex)
    if (idx === activeIndex) it.scrollIntoView({ block: 'nearest' })
  })
}

// 生成一排颜色快捷块 HTML
function buildColorChips(hexes: string[]): string {
  let html = ''
  for (const hex of hexes) {
    html += `<button type="button" class="cs-chip cs-item" data-hex="${hex}" title="${hex}" style="background:${hex}"></button>`
  }
  return html
}

function buildFormatButtons(): string {
  const formats: ColorFormat[] = ['hex', 'rgb', 'hsl']
  let html = ''
  for (const f of formats) {
    const activeClass = f === currentFormat ? ' active' : ''
    html += `<button type="button" class="cs-format-btn${activeClass}" data-fmt="${f}">${f.toUpperCase()}</button>`
  }
  return html
}

function buildClassicRows(classic: ClassicColor[]): string {
  let html = ''
  for (const c of classic) {
    html += `<button type="button" class="cs-row cs-item" data-hex="${c.hex}"><span class="cs-swatch" style="background:${c.hex}"></span><span class="cs-name">${c.name}</span><span class="cs-zh">${c.zh}</span><span class="cs-val">${formatColor(c.hex, currentFormat)}</span></button>`
  }
  return html
}

function renderMenu(keyword: string) {
  if (!suggestionBox) return
  const classic = filterClassicColors(keyword)

  const recentSection =
    recentColors.length > 0
      ? `<div class="cs-section-label">最近使用 (${recentColors.length}/${MAX_RECENT_COLORS})</div><div class="cs-chips">${buildColorChips(recentColors)}</div>`
      : ''

  const eyeDropperSupported = Boolean(window.EyeDropper)
  const dropperButtonHtml = eyeDropperSupported
    ? '<button type="button" class="cs-tool" id="cs-eyedropper-btn">🎯 屏幕取色</button>'
    : ''

  suggestionBox.innerHTML = `
    <div class="cs-header">
      <span class="cs-title">🎨 颜色补全</span>
      <div class="cs-formats">${buildFormatButtons()}</div>
    </div>
    <div class="cs-section-label">快捷插入</div>
    <div class="cs-chips">${buildColorChips(QUICK_INSERT_HEXES)}</div>
    ${recentSection}
    <div class="cs-section-label">经典颜色</div>
    <div class="cs-list">${buildClassicRows(classic)}</div>
    <div class="cs-footer">
      <button type="button" class="cs-tool" id="cs-palette-btn">🎨 调色盘</button>
      ${dropperButtonHtml}
    </div>
  `

  bindMenuEvents()
  navItems = Array.from(suggestionBox.querySelectorAll<HTMLElement>('.cs-item'))
  navSequence = Array.from(
    suggestionBox.querySelectorAll<HTMLElement>('.cs-format-btn, .cs-tool, .cs-item')
  )
  activeIndex = 0
}

function bindMenuEvents() {
  if (!suggestionBox) return

  // 格式切换：重渲染菜单并保持当前过滤关键字
  suggestionBox.querySelectorAll<HTMLButtonElement>('.cs-format-btn').forEach(btn => {
    btn.addEventListener('mousedown', e => e.preventDefault())
    btn.addEventListener('click', e => {
      e.preventDefault()
      const fmt = btn.dataset.fmt
      if (fmt !== 'hex' && fmt !== 'rgb' && fmt !== 'hsl') return
      currentFormat = fmt
      persistState()
      renderMenu(lastKeyword)
      updateActiveItem()
      // 键盘 Enter 激活时 DOM 已重建，恢复该按钮焦点以便继续纯键盘操作
      const box = suggestionBox
      const again = box?.querySelector<HTMLButtonElement>(`.cs-format-btn[data-fmt="${fmt}"]`)
      if (!document.activeElement || document.activeElement === document.body) again?.focus()
    })
  })

  // 颜色项（快捷插入 + 最近使用 + 经典列表）
  suggestionBox.querySelectorAll<HTMLElement>('.cs-item').forEach(item => {
    item.addEventListener('mousedown', e => e.preventDefault())
    item.addEventListener('click', e => {
      e.preventDefault()
      insertColorFromHex(item.dataset.hex || '')
    })
  })

  // 调色盘
  const paletteBtn = suggestionBox.querySelector<HTMLButtonElement>('#cs-palette-btn')
  if (paletteBtn) {
    paletteBtn.addEventListener('mousedown', e => e.preventDefault())
    paletteBtn.addEventListener('click', e => {
      e.preventDefault()
      openPalette()
    })
  }

  // 屏幕取色
  const dropperBtn = suggestionBox.querySelector<HTMLButtonElement>('#cs-eyedropper-btn')
  if (dropperBtn) {
    dropperBtn.addEventListener('mousedown', e => e.preventDefault())
    dropperBtn.addEventListener('click', e => {
      e.preventDefault()
      openEyeDropper()
    })
  }
}

function positionSuggestionBox(editor: EditorEl) {
  if (!suggestionBox) return
  // 先以隐藏可见方式渲染以便测量尺寸
  suggestionBox.style.visibility = 'hidden'
  suggestionBox.style.display = 'block'
  const boxRect = suggestionBox.getBoundingClientRect()

  const caret = getCaretXY(editor)
  const margin = 6
  const viewportHeight = window.innerHeight
  const viewportWidth = window.innerWidth

  let top = caret.bottom + margin
  if (top + boxRect.height > viewportHeight - 8) {
    // 放不下则翻转到光标上方
    top = Math.max(8, caret.y - boxRect.height - margin)
  }
  const left = Math.min(Math.max(8, caret.x), Math.max(8, viewportWidth - boxRect.width - 8))

  // 转换为页面坐标定位（盒子挂在 body 下，position: absolute）
  suggestionBox.style.left = `${left + window.scrollX}px`
  suggestionBox.style.top = `${top + window.scrollY}px`
  suggestionBox.style.visibility = 'visible'
}

function showSuggestionBox(editor: EditorEl, keyword: string) {
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

// ------------------------- 调色盘 / 取色器 -------------------------

let paletteInput: HTMLInputElement | null = null

function ensurePaletteInput() {
  if (paletteInput) return
  paletteInput = createE('input', { type: 'color' })
  // 放到视口外但保持“已渲染”状态：display:none / opacity:0 的取色控件在部分
  // Chromium 版本中 showPicker()/click() 弹不出原生调色盘
  paletteInput.style.cssText =
    'position:fixed;left:-200px;top:-200px;width:24px;height:24px;margin:0;border:0;padding:0;'
  paletteInput.addEventListener('change', () => {
    const hex = normalizeToHex(paletteInput?.value || '')
    if (hex) insertColorFromHex(hex)
  })
  DOA(paletteInput)
}

function openPalette() {
  ensurePaletteInput()
  if (!paletteInput) return
  // 打开时带上当前选中候选色作为初始值
  paletteInput.value = navItems[activeIndex]?.dataset.hex || '#ffffff'
  // showPicker() 显式弹出选择器且不要求元素可见；旧浏览器回退 click()
  try {
    paletteInput.showPicker()
  } catch {
    paletteInput.click()
  }
}

function openEyeDropper() {
  const EyeDropperCtor = window.EyeDropper
  if (!EyeDropperCtor) return
  new EyeDropperCtor()
    .open()
    .then(res => {
      const hex = normalizeToHex(res.sRGBHex || '')
      if (hex) insertColorFromHex(hex)
    })
    .catch(() => {
      // 用户取消取色，忽略
    })
}

// ------------------------- 事件处理 -------------------------

function handleInput(event: Event) {
  const target = event.target as Element | null
  if (!target) return

  if (target instanceof HTMLTextAreaElement) {
    const pos = target.selectionStart || 0
    const trig = matchColorTrigger(target.value.slice(0, pos), pos)
    if (!trig) {
      hideSuggestionBox()
      return
    }
    activeEditor = target
    showSuggestionBox(target, trig.keyword)
  } else if (target instanceof HTMLElement && target.classList.contains('ProseMirror')) {
    const trig = getColorTriggerFromProseMirror()
    if (!trig) {
      hideSuggestionBox()
      return
    }
    activeEditor = target
    showSuggestionBox(target, trig.keyword)
  }
}

// 清除高亮（进入焦点模式后改由 :focus-visible 提示位置）
function clearHighlight() {
  if (!suggestionBox) return
  suggestionBox.querySelectorAll('.cs-item.active').forEach(el => {
    el.classList.remove('active')
  })
}

// 从编辑器进入菜单焦点模式：落在当前高亮项（↓）或最后一个元素（↑）
function enterMenuFocus(dir: 1 | -1) {
  if (navSequence.length === 0) return
  const cur = navItems[activeIndex]
  let idx = cur ? navSequence.indexOf(cur) : -1
  if (idx === -1) idx = dir === 1 ? 0 : navSequence.length - 1
  clearHighlight()
  navSequence[idx]?.focus()
}

// 在菜单内的可交互元素间移动真实 DOM 焦点
function moveMenuFocus(current: HTMLElement | null, dir: 1 | -1) {
  if (navSequence.length === 0) return
  const idx = current ? navSequence.indexOf(current) : -1
  if (idx === -1) return
  const next = (idx + dir + navSequence.length) % navSequence.length
  navSequence[next]?.focus()
}

function handleKeydown(event: KeyboardEvent) {
  if (!suggestionBox || suggestionBox.style.display === 'none') return
  const target = event.target as Element | null

  // --- 焦点在菜单内：↑/↓ 移动焦点，Esc 关闭并回到编辑器；Enter/Space/Tab 走原生按钮行为 ---
  if (target && suggestionBox.contains(target)) {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      hideSuggestionBox()
      activeEditor?.focus()
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      event.stopPropagation()
      moveMenuFocus(
        target instanceof HTMLElement ? target : null,
        event.key === 'ArrowDown' ? 1 : -1
      )
    }
    return
  }

  // --- 焦点在编辑器：高亮导航；↓/↑ 同时把焦点移入菜单实现纯键盘操作 ---
  const focusedEditor =
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLElement && target.classList.contains('ProseMirror'))
  if (!focusedEditor) return
  if (!['ArrowDown', 'ArrowUp', 'Tab', 'Enter', 'Escape'].includes(event.key)) return

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
      const item = navItems[activeIndex]
      if (item) insertColorFromHex(item.dataset.hex || '')
      else hideSuggestionBox()
      break
    }
  }
}

// ------------------------- 初始化 -------------------------

export function initColorSuggestions() {
  try {
    void loadState()
    createSuggestionBox()
    DAEL('input', handleInput, true)
    DAEL('keydown', handleKeydown, true)
    DAEL(
      'click',
      (e: Event) => {
        const t = e.target as Element | null
        if (t && suggestionBox?.contains(t)) return
        if (t && t === paletteInput) return
        hideSuggestionBox()
      },
      true
    )
  } catch (e) {
    // 不要抛出错误影响页面其它逻辑
    console.error('initColorSuggestions failed', e)
  }
}
