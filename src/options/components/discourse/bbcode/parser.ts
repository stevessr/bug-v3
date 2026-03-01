import DOMPurify from 'dompurify'

/**
 * Parse BBCode to HTML
 * Supports common Discourse BBCode tags
 */
export function parseBBCode(bbcode: string): string {
  if (!bbcode) return ''

  let html = bbcode

  // Escape HTML entities first
  html = escapeHtml(html)

  // Parse tags in order (from most specific to least specific)

  // [code]...[/code] or [code=lang]...[/code] - Code blocks (must be parsed first to avoid parsing inside)
  html = html.replace(/\[code(?:=([^\]]+))?\]([\s\S]*?)\[\/code\]/g, (_, lang, code) => {
    const safeLang = lang ? escapeHtml(lang) : ''
    const dataAttr = safeLang ? ` data-code-wrap="${safeLang}"` : ''
    const classAttr = safeLang ? ` class="lang-${safeLang}"` : ''
    return `<pre${dataAttr}><code${classAttr}>${code.trim()}</code></pre>`
  })

  // [url=...]...[/url] - Links with URL
  html = html.replace(/\[url=([^\]]+)\]([^[]*?)\[\/url\]/g, (_, url, text) => {
    const safeUrl = escapeHtml(url)
    const safeText = escapeHtml(text)
    return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${safeText}</a>`
  })

  // [url]...[/url] - Links without URL parameter
  html = html.replace(/\[url\]([^[]*?)\[\/url\]/g, (_, url) => {
    const safeUrl = escapeHtml(url)
    return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${safeUrl}</a>`
  })

  // [img]...[/img] - Images
  html = html.replace(/\[img\]([^[]*?)\[\/img\]/g, (_, src) => {
    const safeSrc = escapeHtml(src)
    return `<img src="${safeSrc}" alt="image" loading="lazy" />`
  })

  // [quote]...[/quote] - Blockquotes
  html = html.replace(/\[quote\]([\s\S]*?)\[\/quote\]/g, (_, content) => {
    return `<blockquote>${content}</blockquote>`
  })

  // [quote=...]...[/quote] - Blockquotes with attribution
  html = html.replace(/\[quote=([^\]]+)\]([\s\S]*?)\[\/quote\]/g, (_, author, content) => {
    const safeAuthor = escapeHtml(author)
    return `<blockquote><cite>${safeAuthor}:</cite>${content}</blockquote>`
  })

  // [list]...[/list] - Lists
  html = html.replace(/\[list\]([\s\S]*?)\[\/list\]/g, (_, content) => {
    const items = content
      .split('[*]')
      .map((item: string) => item.trim())
      .filter(Boolean)
      .map((item: string) => `<li>${item}</li>`)
      .join('')
    return `<ul>${items}</ul>`
  })

  // [list=1]...[/list] - Ordered lists
  html = html.replace(/\[list=1\]([\s\S]*?)\[\/list\]/g, (_, content) => {
    const items = content
      .split('[*]')
      .map((item: string) => item.trim())
      .filter(Boolean)
      .map((item: string) => `<li>${item}</li>`)
      .join('')
    return `<ol>${items}</ol>`
  })

  // [color=...]...[/color] - Text color
  html = html.replace(/\[color=([^\]]+)\]([^[]*?)\[\/color\]/g, (_, color, text) => {
    const safeColor = escapeHtml(color)
    return `<span style="color: ${safeColor}">${text}</span>`
  })

  // [size=...]...[/size] - Text size
  html = html.replace(/\[size=([^\]]+)\]([^[]*?)\[\/size\]/g, (_, size, text) => {
    const safeSize = escapeHtml(size)
    return `<span style="font-size: ${safeSize}px">${text}</span>`
  })

  // [left]...[/left], [center]...[/center], [right]...[/right] - Text alignment
  html = html.replace(/\[left\]([^[]*?)\[\/left\]/g, '<div style="text-align: left">$1</div>')
  html = html.replace(/\[center\]([^[]*?)\[\/center\]/g, '<div style="text-align: center">$1</div>')
  html = html.replace(/\[right\]([^[]*?)\[\/right\]/g, '<div style="text-align: right">$1</div>')

  // [b]...[/b] - Bold
  html = html.replace(/\[b\]([^[]*?)\[\/b\]/g, '<b>$1</b>')

  // [i]...[/i] - Italic
  html = html.replace(/\[i\]([^[]*?)\[\/i\]/g, '<i>$1</i>')

  // [u]...[/u] - Underline
  html = html.replace(/\[u\]([^[]*?)\[\/u\]/g, '<u>$1</u>')

  // [s]...[/s] - Strikethrough
  html = html.replace(/\[s\]([^[]*?)\[\/s\]/g, '<s>$1</s>')

  // [sub]...[/sub] - Subscript
  html = html.replace(/\[sub\]([^[]*?)\[\/sub\]/g, '<sub>$1</sub>')

  // [sup]...[/sup] - Superscript
  html = html.replace(/\[sup\]([^[]*?)\[\/sup\]/g, '<sup>$1</sup>')

  // [spoiler]...[/spoiler] - Spoiler/blur
  html = html.replace(/\[spoiler\]([\s\S]*?)\[\/spoiler\]/g, (_, content) => {
    return `<div class="spoiled spoiler-blurred" dir="auto" role="button" tabindex="0" data-spoiler-state="blurred" aria-expanded="false" aria-label="显示隐藏内容" aria-live="polite"><p aria-hidden="true">${content}</p></div>`
  })

  // Convert newlines to <br> for non-block elements
  html = html.replace(/\n/g, '<br>')

  return html
}

/**
 * Escape HTML special characters
 */
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

/**
 * Sanitize HTML using DOMPurify
 */
export function sanitizeBBCode(html: string): string {
  return DOMPurify.sanitize(html, {
    ADD_TAGS: ['iframe', 'video', 'audio', 'source'],
    ADD_ATTR: [
      'target',
      'src',
      'href',
      'style',
      'class',
      'width',
      'height',
      'controls',
      'type',
      'allow',
      'allowfullscreen',
      'frameborder',
      'scrolling',
      'data-spoiler-state',
      'aria-hidden',
      'aria-expanded',
      'aria-label',
      'aria-live',
      'role',
      'tabindex',
      'dir'
    ],
    ALLOW_DATA_ATTR: true,
    FORBID_TAGS: ['script', 'style', 'object', 'embed', 'form'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onkeydown', 'onkeypress']
  })
}

/**
 * Render BBCode to sanitized HTML
 */
export function renderBBCode(bbcode: string): string {
  if (!bbcode) return ''
  const html = parseBBCode(bbcode)
  return sanitizeBBCode(html)
}
