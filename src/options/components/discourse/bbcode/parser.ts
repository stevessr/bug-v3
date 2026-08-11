import DOMPurify from 'dompurify'

import { findEmojiByName } from './emojiShortcode'

/**
 * BBCode 解析器（对齐官方 Discourse 渲染结构）
 *
 * 特性：
 * - 递归解析，支持任意嵌套与多行内容
 * - 块级标签：quote / details / wrap / spoiler / poll / tabs / table /
 *   code / list / center / left / right / video / audio / youtube /
 *   tip / note / warning
 * - 行内标签：b / i / u / s / ins / del / sub / sup / mark / size /
 *   color / url / img / mention / emoji / footnote / tab / hr
 * - 容器内容支持行内 Markdown（**加粗**、*斜体*、~~删除~~、`代码`、
 *   [链接](url)、![图片](url)、^[脚注]、:表情:）
 * - fenced code 块（```lang ... ```）保护
 * - 输出结构与官方 Discourse markdown-it 插件一致
 *   （aside.quote / details+summary / div.spoiler / div.d-wrap-* /
 *    pre[data-code-wrap] 等）
 */

// ============ 标签集合 ============

/** 块级标签：内容按块处理（换行 → <br>，清理首尾 <br>） */
const BLOCK_TAGS = new Set([
  'quote',
  'details',
  'wrap',
  'spoiler',
  'poll',
  'tabs',
  'table',
  'code',
  'list',
  'center',
  'left',
  'right',
  'video',
  'audio',
  'youtube',
  'tip',
  'note',
  'warning'
])

/** 行内标签 */
const INLINE_TAGS = new Set([
  'b',
  'i',
  'u',
  's',
  'ins',
  'del',
  'sub',
  'sup',
  'mark',
  'size',
  'color',
  'url',
  'img',
  'mention',
  'emoji',
  'footnote',
  'tab',
  'hr'
])

/** code 块内容按原样输出（保留换行，不解析任何标签） */
const RAW_TAGS = new Set(['code'])

/** 自闭合标签：无闭合标签时直接渲染（[video=url]、[emoji=x]、[mention=u]、[hr] 等） */
const SELF_CLOSING_TAGS = new Set(['video', 'audio', 'youtube', 'img', 'emoji', 'mention', 'hr'])

const TAG_RE = /^\[(\/?)([a-zA-Z]+)(?:=([^\]]*?))?\]/
const CLOSING_RE = (tag: string) => new RegExp(`^\\[/${tag}\\]`, 'i')

// ============ 工具函数 ============

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }
  return text.replace(/[&<>"']/g, m => map[m])
}

/** 转义属性值 */
const escapeAttr = escapeHtml

/** 去掉块级内容首尾的 <br> 噪音 */
const cleanEdges = (html: string) => html.replace(/^(<br>)+/i, '').replace(/(<br>)+$/i, '')

/** 去掉 [tag=...] 属性两侧的引号 */
const unquote = (value: string) => value.replace(/^["']|["']$/g, '').trim()

// ============ 行内渲染 ============

/**
 * 渲染行内 Markdown 语法（输入已 HTML 转义）
 * 输出顺序：代码 → 图片 → 链接 → 脚注 → 粗体 → 斜体 → 删除线
 */
function renderInline(text: string): string {
  let html = text

  // 行内代码 `code`
  html = html.replace(/`([^`\n]+)`/g, '<code>$1</code>')

  // 图片 ![alt](url) / ![alt|WxH](url)
  html = html.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;[^&]*&quot;)?\)/g, (_m, alt, url) => {
    const sizeMatch = /^(.*?)\|(\d+)x(\d+)$/.exec(alt)
    const altText = sizeMatch ? sizeMatch[1] : alt
    const sizeAttr = sizeMatch ? ` width="${sizeMatch[2]}" height="${sizeMatch[3]}"` : ''
    return `<img src="${url}" alt="${altText}"${sizeAttr} loading="lazy">`
  })

  // 链接 [text](url)
  html = html.replace(
    /\[([^\]]+)\]\(([^)\s]+)\)/g,
    '<a href="$2" rel="noopener nofollow ugc">$1</a>'
  )

  // 行内脚注 ^[内容]
  html = html.replace(/\^\[([^\]]+)\]/g, (_m, t) => `<span class="footnote">${t}</span>`)

  // 粗体 **text**
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')

  // 斜体 *text* / _text_
  html = html.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
  html = html.replace(/(^|[^_])_([^_\n]+)_/g, '$1<em>$2</em>')

  // 删除线 ~~text~~
  html = html.replace(/~~([^~]+)~~/g, '<s>$1</s>')

  return html
}

/**
 * 渲染纯文本节点：转义 → 表情短码 → 行内 Markdown → 换行
 */
function renderText(text: string): string {
  let html = escapeHtml(text)

  // 表情短码 :name: → <img class="emoji">
  html = html.replace(
    /(^|[^\\]):([a-zA-Z0-9_\u4e00-\u9fa5]+):($|[^\\])/g,
    (match, before, name, after) => {
      const emoji = findEmojiByName(name)
      if (emoji) {
        return `${before}<img class="emoji" alt=":${name}:" src="${escapeAttr(emoji.url)}" loading="lazy">${after}`
      }
      return match
    }
  )

  html = renderInline(html)

  // 换行 → <br>
  html = html.replace(/\n/g, '<br>')

  return html
}

// ============ 递归解析 ============

/**
 * 在 input 中从 from 位置开始查找与 tag 匹配的闭合标签位置
 * 支持同名标签嵌套（深度计数）
 */
function findClosingTag(input: string, from: number, tag: string): number {
  let depth = 0
  let i = from
  while (i < input.length) {
    const idx = input.indexOf('[', i)
    if (idx === -1) return -1
    const m = TAG_RE.exec(input.slice(idx))
    if (m && m[2].toLowerCase() === tag) {
      if (m[1] === '/') {
        if (depth === 0) return idx
        depth--
      } else {
        depth++
      }
    }
    i = idx + 1
  }
  return -1
}

/**
 * 块级解析主循环：扫描 [tag]，已知标签递归渲染，未知标签与文本原样输出
 */
function parseBlocks(input: string): string {
  let out = ''
  let i = 0

  while (i < input.length) {
    const open = input.indexOf('[', i)
    if (open === -1) {
      out += renderText(input.slice(i))
      break
    }
    // 若 `[` 前是 `^`（行内脚注 ^[...]）或 `!`（markdown 图片 ![alt](url)），
    // 前缀字符留给对应段落一起处理，避免重复/丢失
    const prefixChar = open > 0 ? input[open - 1] : ''
    const isPrefix = prefixChar === '^' || prefixChar === '!'
    out += renderText(input.slice(i, isPrefix ? open - 1 : open))

    const m = TAG_RE.exec(input.slice(open))
    const tag = m ? m[2].toLowerCase() : ''
    const attr = m ? (m[3] ?? '') : ''
    const isKnown = tag ? BLOCK_TAGS.has(tag) || INLINE_TAGS.has(tag) || RAW_TAGS.has(tag) : false

    // 非已知标签（含 markdown 链接 [text](url) / 图片 ![alt](url) 与行内脚注 ^[text]）
    if (!m || m[1] === '/' || !isKnown) {
      const rest = input.slice(open)
      const linkMatch = /^\[[^\]]*\]\([^)\s]+\)/.exec(rest)
      if (linkMatch) {
        const start = prefixChar === '!' ? open - 1 : open
        out += renderText(input.slice(start, open + linkMatch[0].length))
        i = open + linkMatch[0].length
        continue
      }
      if (prefixChar === '^') {
        const closeBracket = input.indexOf(']', open)
        if (closeBracket !== -1) {
          out += renderText(input.slice(open - 1, closeBracket + 1))
          i = closeBracket + 1
          continue
        }
        // ^[ 未闭合：补回 ^ 与 [
        out += '^['
        i = open + 1
        continue
      }
      // 补回被前缀处理排除的字符
      out += prefixChar === '!' ? '![' : '['
      i = open + 1
      continue
    }

    const closePos = findClosingTag(input, open + m[0].length, tag)
    if (closePos === -1) {
      // 自闭合标签（[video=url] / [emoji=x] / [mention=u] / [hr]）直接渲染
      if (SELF_CLOSING_TAGS.has(tag) && (attr !== '' || tag === 'hr')) {
        out += isPrefix ? prefixChar : ''
        out += renderTag(tag, attr, '')
        i = open + m[0].length
        continue
      }
      // 未闭合：按文本输出
      out += isPrefix ? `${prefixChar}[` : '['
      i = open + 1
      continue
    }

    const rawContent = input.slice(open + m[0].length, closePos)
    const endMatch = CLOSING_RE(tag).exec(input.slice(closePos))
    const endLen = endMatch ? endMatch[0].length : 0

    // 渲染内容：code 原样保留，其余递归解析
    let content: string
    if (RAW_TAGS.has(tag)) {
      content = escapeHtml(rawContent)
    } else if (BLOCK_TAGS.has(tag)) {
      content = cleanEdges(parseBlocks(rawContent))
    } else {
      content = parseBlocks(rawContent)
    }

    out += isPrefix ? prefixChar : ''
    out += renderTag(tag, attr, content)
    i = closePos + endLen
  }

  return out
}

// ============ 标签渲染 ============

/**
 * 将标签渲染为官方 Discourse 风格的 HTML
 * @param tag 标签名（小写）
 * @param attr 属性（[tag=attr] 形式，未解码）
 * @param content 已递归解析的内容
 */
function renderTag(tag: string, attr: string, content: string): string {
  switch (tag) {
    case 'b':
      return `<b>${content}</b>`
    case 'i':
      return `<i>${content}</i>`
    case 'u':
      return `<u>${content}</u>`
    case 's':
      return `<s>${content}</s>`
    case 'ins':
      return `<ins>${content}</ins>`
    case 'del':
      return `<del>${content}</del>`
    case 'sub':
      return `<sub>${content}</sub>`
    case 'sup':
      return `<sup>${content}</sup>`
    case 'mark':
      return `<mark>${content}</mark>`
    case 'hr':
      return '<hr>'

    case 'code': {
      const lang = unquote(attr)
      const code = content.replace(/\n$/, '')
      const dataAttr = lang ? ` data-code-wrap="${escapeAttr(lang)}"` : ''
      const classAttr = lang ? ` class="lang-${escapeAttr(lang)}"` : ''
      return `<pre${dataAttr}><code${classAttr}>${code}</code></pre>`
    }

    case 'url': {
      const href = attr ? unquote(attr) : content.trim()
      if (!href) return content
      return `<a href="${escapeAttr(href)}" rel="noopener nofollow ugc">${content}</a>`
    }

    case 'img': {
      const src = unquote(attr || content)
      if (!src) return content
      return `<img src="${escapeAttr(src)}" alt="" loading="lazy">`
    }

    case 'quote': {
      // [quote="作者, post:1, topic:2, username:foo"] 或 [quote]
      let author = ''
      let post = ''
      let topic = ''
      let username = ''
      if (attr) {
        const clean = unquote(attr)
        const parts = clean.split(',').map(p => p.trim())
        author = parts[0] || ''
        for (const p of parts.slice(1)) {
          const pm = /^post:(\d+)$/i.exec(p)
          if (pm) post = pm[1]
          const tm = /^topic:(\d+)$/i.exec(p)
          if (tm) topic = tm[1]
          const um = /^username:(.+)$/i.exec(p)
          if (um) username = um[1].trim()
        }
      }
      const dataAttrs = [
        post ? `data-post="${post}"` : '',
        topic ? `data-topic="${topic}"` : '',
        username ? `data-quote-username="${escapeAttr(username)}"` : ''
      ]
        .filter(Boolean)
        .join(' ')
      const label = author || username
      const title = label
        ? `<div class="title"><span class="quote-title__text-content">${escapeHtml(label)}</span><div class="quote-controls"></div></div>`
        : '<div class="title"><div class="quote-controls"></div></div>'
      return `<aside class="quote"${dataAttrs ? ` ${dataAttrs}` : ''}>${title}<blockquote>${content}</blockquote></aside>`
    }

    case 'list': {
      const items = splitListItems(content)
      const type = attr ? /^([1aAiI])/.exec(unquote(attr))?.[1] : ''
      if (type && type !== '1') {
        return `<ol type="${type}">${items}</ol>`
      }
      if (type === '1') return `<ol>${items}</ol>`
      return `<ul>${items}</ul>`
    }

    case 'spoiler':
      return `<div class="spoiler"><p>${content}</p></div>`

    case 'details': {
      const summary = attr ? unquote(attr) : '详细信息'
      return `<details><summary>${escapeHtml(summary)}</summary>${content}</details>`
    }

    case 'wrap': {
      const name = unquote(attr)
      return `<div class="d-wrap${name ? ` d-wrap-${name}` : ''}">${content}</div>`
    }

    case 'poll': {
      const items = content
        .split(/<br>/i)
        .map(line => line.trim())
        .filter(line => /^[-*]/.test(line))
        .map(line => `<li>${line.replace(/^[-*]\s*/, '')}</li>`)
        .join('')
      return `<div class="poll"><ol>${items}</ol></div>`
    }

    case 'tabs':
      return `<div class="tabs">${content}</div>`

    case 'tab': {
      const name = unquote(attr)
      return `<div class="tab"><div class="tab-header">${escapeHtml(name)}</div><div class="tab-content">${content}</div></div>`
    }

    case 'table':
      return renderTable(content)

    case 'center':
      return `<div style="text-align:center">${content}</div>`
    case 'left':
      return `<div style="text-align:left">${content}</div>`
    case 'right':
      return `<div style="text-align:right">${content}</div>`

    case 'size': {
      const size = unquote(attr)
      const num = Number.parseInt(size, 10)
      const fontSize = Number.isNaN(num) ? size : `${num}px`
      return `<span style="font-size:${escapeAttr(fontSize)}">${content}</span>`
    }

    case 'color':
      return `<span style="color:${escapeAttr(unquote(attr))}">${content}</span>`

    case 'video': {
      const src = unquote(attr || content)
      if (!src) return content
      return `<video controls preload="metadata" src="${escapeAttr(src)}"></video>`
    }

    case 'audio': {
      const src = unquote(attr || content)
      if (!src) return content
      return `<audio controls preload="metadata" src="${escapeAttr(src)}"></audio>`
    }

    case 'youtube': {
      const id = unquote(attr || content)
      if (!id) return content
      return `<div class="onebox youtube-onebox"><a href="https://www.youtube.com/watch?v=${escapeAttr(id)}" rel="noopener nofollow ugc">YouTube: ${escapeAttr(id)}</a></div>`
    }

    case 'tip':
      return `<div class="alert alert-info">${content}</div>`
    case 'note':
      return `<div class="alert alert-success">${content}</div>`
    case 'warning':
      return `<div class="alert alert-warning">${content}</div>`

    case 'footnote':
      return `<span class="footnote">${content}</span>`

    case 'mention': {
      const name = unquote(attr || content).replace(/^@/, '')
      if (!name) return content
      return `<a class="mention">@${escapeHtml(name)}</a>`
    }

    case 'emoji': {
      const name = unquote(attr || content)
      const emoji = findEmojiByName(name)
      if (emoji) {
        return `<img class="emoji" alt=":${escapeAttr(name)}:" src="${escapeAttr(emoji.url)}" loading="lazy">`
      }
      return content || `:${escapeHtml(name)}:`
    }

    default:
      return content
  }
}

/** 从 [list] 内容中拆分列表项（支持 [*] 与每行 * / - 两种写法） */
function splitListItems(content: string): string {
  let parts: string[]
  if (content.includes('[*]')) {
    parts = content.split('[*]')
  } else {
    parts = content
      .split(/<br>/i)
      .map(line => line.trim())
      .filter(line => /^[-*]/.test(line))
      .map(line => line.replace(/^[-*]\s*/, ''))
  }
  return parts
    .map(item =>
      item
        .replace(/^(<br>)+/i, '')
        .replace(/(<br>)+$/i, '')
        .trim()
    )
    .filter(Boolean)
    .map(item => `<li>${item}</li>`)
    .join('')
}

/** 渲染 [table] 内容（支持 markdown 风格 | 分隔表格） */
function renderTable(content: string): string {
  const lines = content
    .split(/<br>/i)
    .map(line => line.trim())
    .filter(Boolean)

  const rows: string[][] = []
  for (const line of lines) {
    const cells = line
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map(cell => cell.trim())
    if (cells.length > 1) rows.push(cells)
  }

  if (!rows.length) return '<table></table>'

  // 检测分隔行 | --- | --- |
  const sepIndex = rows.findIndex(row => row.every(cell => /^:?-{3,}:?$/.test(cell)))

  let header: string[] | null = null
  let body = rows
  if (sepIndex >= 0) {
    header = rows[sepIndex - 1] ?? null
    body = rows.slice(sepIndex + 1)
  }

  const renderRow = (cells: string[], cellTag: 'th' | 'td') =>
    `<tr>${cells.map(cell => `<${cellTag}>${cell}</${cellTag}>`).join('')}</tr>`

  const thead = header ? `<thead>${renderRow(header, 'th')}</thead>` : ''
  const tbody = body.length
    ? `<tbody>${body.map(row => renderRow(row, 'td')).join('')}</tbody>`
    : ''

  return `<table>${thead}${tbody}</table>`
}

// ============ 入口 ============

/**
 * 解析 BBCode 为 HTML
 * 支持官方 Discourse 常用 BBCode 标签、嵌套、多行与行内 Markdown
 */
export function parseBBCode(bbcode: string): string {
  if (!bbcode) return ''

  // 1. 保护 fenced code 块（```lang ... ```），内部原样保留（消费前导换行）
  const codeBlocks: string[] = []
  const source = bbcode.replace(
    /\n?```([a-zA-Z0-9_+-]*)[^\n]*\n?([\s\S]*?)```/g,
    (_m, lang, code) => {
      const id = codeBlocks.length
      const langAttr = lang
        ? ` data-code-wrap="${escapeAttr(lang)}" class="lang-${escapeAttr(lang)}"`
        : ''
      const langClass = lang ? ` class="lang-${escapeAttr(lang)}"` : ''
      codeBlocks.push(
        `<pre${langAttr}><code${langClass}>${escapeHtml(code.replace(/\n$/, ''))}</code></pre>`
      )
      return `\n@@CODE_${id}@@\n`
    }
  )

  // 2. 递归解析
  let html = parseBlocks(source)

  // 3. 还原 fenced code 占位符
  html = html.replace(/@@CODE_(\d+)@@/g, (_m, index) => codeBlocks[Number(index)] ?? '')

  return html
}

/**
 * 使用 DOMPurify 清理 HTML
 * 白名单覆盖 Discourse 渲染结构所需的全部标签与属性
 */
export function sanitizeBBCode(html: string): string {
  return DOMPurify.sanitize(html, {
    ADD_TAGS: [
      'iframe',
      'video',
      'audio',
      'source',
      'details',
      'summary',
      'table',
      'thead',
      'tbody',
      'tr',
      'th',
      'td',
      'mark',
      'ins',
      'del',
      'math',
      'semantics',
      'mrow',
      'mi',
      'mn',
      'mo',
      'annotation',
      'annotation-xml',
      'svg',
      'path'
    ],
    ADD_ATTR: [
      'target',
      'src',
      'href',
      'style',
      'class',
      'width',
      'height',
      'controls',
      'preload',
      'type',
      'start',
      'allow',
      'allowfullscreen',
      'frameborder',
      'scrolling',
      'rel',
      'loading',
      'data-code-wrap',
      'data-post',
      'data-topic',
      'viewBox'
    ],
    ALLOW_DATA_ATTR: true,
    FORBID_TAGS: ['script', 'style', 'object', 'embed', 'form'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onkeydown', 'onkeypress']
  })
}

/**
 * 渲染 BBCode 为已清理的 HTML
 */
export function renderBBCode(bbcode: string): string {
  if (!bbcode) return ''
  const html = parseBBCode(bbcode)
  return sanitizeBBCode(html)
}
