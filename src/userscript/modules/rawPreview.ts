import { createEl } from '../utils/createEl'
import { ensureStyleInjected } from '../utils/injectStyles'

const RAW_PREVIEW_STYLES = `
.raw-preview-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2147483647;
}
.raw-preview-modal {
  width: 80%;
  height: 80%;
  background: var(--color-bg, #fff);
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.5);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.raw-preview-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(0,0,0,0.04);
  border-bottom: 1px solid rgba(0,0,0,0.06);
}
.raw-preview-title {
  flex: 1;
  font-weight: 600;
}
.raw-preview-ctrls button {
  margin-left: 6px;
}
.raw-preview-iframe {
  border: none;
  width: 100%;
  height: 100%;
  flex: 1 1 auto;
}
.raw-preview-small-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 2px 8px;
  margin-left: 6px;
  font-size: 12px;
  border-radius: 4px;
  border: 1px solid rgba(0,0,0,0.08);
  background: rgba(255,255,255,0.9);
  cursor: pointer;
}
.raw-preview-small-btn.md {
  background: linear-gradient(90deg,#fffbe6,#f0f7ff);
  border-color: rgba(3,102,214,0.12);
}
`

ensureStyleInjected('raw-preview-styles', RAW_PREVIEW_STYLES)

let overlay: HTMLElement | null = null
let iframeEl: HTMLIFrameElement | null = null
let currentTopicId: string | null = null
let currentPage = 1
let renderMode: 'iframe' | 'markdown' = 'iframe'

function rawUrl(topicId: string, page: number) {
  // Build the raw page url per site pattern
  return new URL(`/raw/${topicId}?page=${page}`, window.location.origin).toString()
}

function createOverlay(topicId: string, startPage = 1, mode: 'iframe' | 'markdown' = 'iframe') {
  if (overlay) return // already open
  currentTopicId = topicId
  currentPage = startPage
  renderMode = mode

  overlay = createEl('div', { className: 'raw-preview-overlay' }) as HTMLElement
  const modal = createEl('div', { className: 'raw-preview-modal' }) as HTMLDivElement

  const header = createEl('div', { className: 'raw-preview-header' }) as HTMLDivElement
  const title = createEl('div', {
    className: 'raw-preview-title',
    text: `话题预览 ${topicId}`
  }) as HTMLDivElement
  const ctrls = createEl('div', { className: 'raw-preview-ctrls' }) as HTMLDivElement

  const modeLabel = createEl('span', {
    text: mode === 'markdown' ? '模式：Markdown' : '模式：原始'
  }) as HTMLSpanElement
  const prevBtn = createEl('button', {
    className: 'raw-preview-small-btn',
    text: '◀ 上一页'
  }) as HTMLButtonElement
  const nextBtn = createEl('button', {
    className: 'raw-preview-small-btn',
    text: '下一页 ▶'
  }) as HTMLButtonElement
  const closeBtn = createEl('button', {
    className: 'raw-preview-small-btn',
    text: '关闭 ✖'
  }) as HTMLButtonElement

  prevBtn.addEventListener('click', () => {
    if (!currentTopicId) return
    if (currentPage > 1) {
      currentPage -= 1
      updateIframeSrc()
    }
  })
  nextBtn.addEventListener('click', () => {
    if (!currentTopicId) return
    currentPage += 1
    updateIframeSrc()
  })
  closeBtn.addEventListener('click', () => {
    removeOverlay()
  })

  ctrls.appendChild(modeLabel)
  ctrls.appendChild(prevBtn)
  ctrls.appendChild(nextBtn)
  ctrls.appendChild(closeBtn)

  header.appendChild(title)
  header.appendChild(ctrls)

  iframeEl = createEl('iframe', {
    className: 'raw-preview-iframe',
    attrs: { sandbox: 'allow-same-origin allow-scripts' }
  }) as HTMLIFrameElement

  modal.appendChild(header)
  modal.appendChild(iframeEl)
  overlay.appendChild(modal)

  // Close overlay by clicking backdrop
  overlay.addEventListener('click', e => {
    if (e.target === overlay) removeOverlay()
  })

  // keyboard navigation
  window.addEventListener('keydown', handleKeydown)

  document.body.appendChild(overlay)

  // Load initial content depending on mode
  if (renderMode === 'iframe') {
    iframeEl.src = rawUrl(topicId, currentPage)
  } else {
    // render markdown into iframe by fetching raw text
    fetchAndRenderMarkdown(topicId, currentPage)
  }
}

function updateIframeSrc() {
  if (!iframeEl || !currentTopicId) return
  if (renderMode === 'iframe') {
    iframeEl.src = rawUrl(currentTopicId, currentPage)
  } else {
    fetchAndRenderMarkdown(currentTopicId, currentPage)
  }
}

function removeOverlay() {
  if (!overlay) return
  window.removeEventListener('keydown', handleKeydown)
  overlay.remove()
  overlay = null
  iframeEl = null
  currentTopicId = null
  currentPage = 1
}

function handleKeydown(e: KeyboardEvent) {
  if (!overlay) return
  if (e.key === 'ArrowLeft') {
    if (currentPage > 1) {
      currentPage -= 1
      updateIframeSrc()
    }
  }
  if (e.key === 'ArrowRight') {
    currentPage += 1
    updateIframeSrc()
  }
  if (e.key === 'Escape') removeOverlay()
}

// (createTriggerButton removed - use createTriggerButtonFor instead)

function createTriggerButtonFor(mode: 'iframe' | 'markdown') {
  const text = mode === 'markdown' ? '预览(MD)' : '预览'
  const btn = createEl('button', {
    className: `raw-preview-small-btn ${mode === 'markdown' ? 'md' : 'iframe'}`,
    text
  }) as HTMLButtonElement
  ;(btn as any).dataset.previewMode = mode
  return btn
}

// --- Markdown rendering helper (lightweight) ---
function escapeHtml(str: string) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function simpleMarkdownToHtml(md: string) {
  // Very small markdown -> html converter: headings, lists, code fences, inline code, bold/italic, links
  const lines = md.replace(/\r\n/g, '\n').split('\n')
  let inCode = false
  const out: string[] = []
  let listType: 'ul' | 'ol' | null = null
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i]

    // code fence
    const fenceMatch = line.match(/^```\s*(\S*)/)
    if (fenceMatch) {
      if (!inCode) {
        inCode = true
        // codeLang is intentionally ignored for now
        out.push('<pre><code>')
      } else {
        inCode = false
        out.push('</code></pre>')
      }
      continue
    }

    if (inCode) {
      out.push(escapeHtml(line) + '\n')
      continue
    }

    // headings
    const h = line.match(/^(#{1,6})\s+(.*)/)
    if (h) {
      out.push(`<h${h[1].length}>${escapeHtml(h[2])}</h${h[1].length}>`)
      continue
    }

    // ordered list
    const ol = line.match(/^\s*\d+\.\s+(.*)/)
    if (ol) {
      if (listType !== 'ol') {
        if (listType === 'ul') out.push('</ul>')
        listType = 'ol'
        out.push('<ol>')
      }
      out.push(`<li>${inlineFormat(ol[1])}</li>`)
      continue
    }

    // unordered list
    const ul = line.match(/^\s*[-*]\s+(.*)/)
    if (ul) {
      if (listType !== 'ul') {
        if (listType === 'ol') out.push('</ol>')
        listType = 'ul'
        out.push('<ul>')
      }
      out.push(`<li>${inlineFormat(ul[1])}</li>`)
      continue
    }

    // blank line closes lists
    if (/^\s*$/.test(line)) {
      if (listType === 'ul') {
        out.push('</ul>')
        listType = null
      } else if (listType === 'ol') {
        out.push('</ol>')
        listType = null
      }
      out.push('<p></p>')
      continue
    }

    // paragraph
    out.push(`<p>${inlineFormat(line)}</p>`)
  }

  if (listType === 'ul') out.push('</ul>')
  if (listType === 'ol') out.push('</ol>')

  return out.join('\n')
}

function inlineFormat(text: string) {
  let t = escapeHtml(text)
  // images: ![alt|WxH](upload://filename.ext) -> map to /uploads/short-url/filename.ext
  t = t.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_m, altRaw, urlRaw) => {
    const altParts = (altRaw || '').split('|')
    const alt = escapeHtml(altParts[0] || '')
    let widthAttr = ''
    let heightAttr = ''
    if (altParts[1]) {
      const dim = altParts[1].match(/(\d+)x(\d+)/)
      if (dim) {
        widthAttr = ` width="${dim[1]}"`
        heightAttr = ` height="${dim[2]}"`
      }
    }

    const url = String(urlRaw || '')
    if (url.startsWith('upload://')) {
      const filename = url.replace(/^upload:\/\//, '')
      const src = `${window.location.origin}/uploads/short-url/${filename}`
      return `<img src="${src}" alt="${alt}"${widthAttr}${heightAttr} />`
    }

    // fallback: use provided url (escaped)
    return `<img src="${escapeHtml(url)}" alt="${alt}"${widthAttr}${heightAttr} />`
  })
  // inline code
  t = t.replace(/`([^`]+)`/g, '<code>$1</code>')
  // strikethrough ~~text~~
  t = t.replace(/~~([\s\S]+?)~~/g, '<del>$1</del>')
  // bold **text**
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  // italic *text*
  t = t.replace(/\*([^*]+)\*/g, '<em>$1</em>')
  // links [text](url)
  t = t.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
  )
  return t
}

async function fetchAndRenderMarkdown(topicId: string, page: number) {
  if (!iframeEl) return
  const url = rawUrl(topicId, page)
  try {
    const res = await fetch(url, { credentials: 'include' })
    if (!res.ok) throw new Error('fetch failed ' + res.status)
    const text = await res.text()

    // Try to dynamically load markdown-it from CDN and use it if available
    let html: string
    try {
      const md = await loadMarkdownIt()
      if (md) {
        try {
          const parser = md({ html: true, linkify: true })
          // register plugin to map upload:// and parse alt|WxH
          try {
            parser.use(uploadUrlPlugin)
          } catch (e) {
            // ignore plugin registration failure
          }
          html = parser.render(text)
        } catch (e) {
          console.warn('[rawPreview] markdown-it render failed, falling back', e)
          html = simpleMarkdownToHtml(text)
        }
      } else {
        html = simpleMarkdownToHtml(text)
      }
    } catch (e) {
      console.warn('[rawPreview] loadMarkdownIt failed, falling back to simple renderer', e)
      html = simpleMarkdownToHtml(text)
    }

    const doc = iframeEl.contentDocument || (iframeEl as any).contentWindow?.document
    if (!doc) throw new Error('iframe document unavailable')

    const css = `
      body{font-family: -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;padding:16px;color:#111}
      pre{background:#f6f8fa;padding:12px;border-radius:6px;overflow:auto}
      code{background:#f0f0f0;padding:2px 4px;border-radius:4px}
      h1,h2,h3,h4{margin:8px 0}
      p{margin:6px 0}
      a{color:#0366d6}
      ul,ol{margin:6px 0 6px 20px}
    `

    doc.open()
    doc.write(
      `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body>${html}</body></html>`
    )
    doc.close()
  } catch (err) {
    console.warn('[rawPreview] fetchAndRenderMarkdown failed', err)
    // fallback to setting iframe src when fetch/render fails
    iframeEl.src = url
  }
}

// Dynamic loader for markdown-it via CDN. Returns the global factory (window.markdownit)
function loadMarkdownIt(): Promise<any> {
  return new Promise((resolve, reject) => {
    try {
      const win = window as any
      if (win && win.markdownit) return resolve(win.markdownit)

      // Use jsDelivr CDN for markdown-it; pin to a reasonably recent version
      const src = 'https://cdn.jsdelivr.net/npm/markdown-it@13.0.1/dist/markdown-it.min.js'
      const existing = document.querySelector(`script[src="${src}"]`)
      if (existing) {
        // If script exists but markdownit not yet available, wait for it
        const check = () => {
          if ((window as any).markdownit) return resolve((window as any).markdownit)
          setTimeout(check, 50)
        }
        check()
        return
      }

      const s = document.createElement('script')
      s.src = src
      s.async = true
      s.onload = () => {
        const md = (window as any).markdownit
        if (md) resolve(md)
        else reject(new Error('markdownit not found after script load'))
      }
  s.onerror = () => reject(new Error('failed to load markdown-it script'))
      document.head.appendChild(s)
    } catch (e) {
      reject(e)
    }
  })
}

// Plugin to map upload:// URLs to site uploads and extract alt|WxH sizing
function uploadUrlPlugin(mdLib: any) {
  const defaultRender = mdLib.renderer.rules.image || function(tokens: any, idx: number, options: any, _env: any, self: any) {
    return self.renderToken(tokens, idx, options)
  }

  mdLib.renderer.rules.image = function(tokens: any, idx: number, options: any, env: any, self: any) {
    try {
      const token = tokens[idx]
      // token.attrs is array of [name, value]
      if (token.attrs) {
        // handle src
        const srcIdx = token.attrIndex('src')
        if (srcIdx >= 0) {
          const srcVal = token.attrs[srcIdx][1]
          if (typeof srcVal === 'string' && srcVal.startsWith('upload://')) {
            const filename = srcVal.replace(/^upload:\/\//, '')
            token.attrs[srcIdx][1] = `${window.location.origin}/uploads/short-url/${filename}`
          }
        }

        // handle alt|WxH inside alt attribute
        const altIdx = token.attrIndex('alt')
        if (altIdx >= 0) {
          const altVal = token.attrs[altIdx][1] || ''
          const parts = String(altVal).split('|')
          if (parts.length > 1) {
            token.attrs[altIdx][1] = parts[0]
            const dim = parts[1].match(/(\d+)x(\d+)/)
            if (dim) {
              // set width/height attrs
              token.attrSet('width', dim[1])
              token.attrSet('height', dim[2])
            }
          }
        }
      }
    } catch (e) {
      console.warn('[rawPreview] uploadUrlPlugin error', e)
    }
    return defaultRender(tokens, idx, options, env, self)
  }
}

function injectOnTopicPage() {
  const m = window.location.pathname.match(/\/t\/(?:[^\/]+)\/(\d+)(?:\/|$)/)
  if (!m) return
  const topicId = m[1]

  // Avoid duplicate insertion
  if (document.querySelector('.raw-preview-page-trigger')) return

  const btn = createTriggerButtonFor('iframe')
  btn.classList.add('raw-preview-page-trigger')
  btn.addEventListener('click', () => createOverlay(topicId, 1, 'iframe'))
  // markdown variant
  const mdBtn = createTriggerButtonFor('markdown')
  mdBtn.classList.add('raw-preview-page-trigger-md')
  mdBtn.addEventListener('click', () => createOverlay(topicId, 1, 'markdown'))

  // Try to insert into topic header area; fallback to body append
  const headerSelectors = [
    '.topic-map',
    '.topic-main',
    '.topic-footer',
    '.topic-header',
    '.topic-title'
  ]
  let placed = false
  for (const sel of headerSelectors) {
    const el = document.querySelector(sel) as HTMLElement | null
    if (el) {
      el.appendChild(btn)
      el.appendChild(mdBtn)
      placed = true
      break
    }
  }
  if (!placed) {
    // fixed small buttons at top-right as fallback
    btn.style.position = 'fixed'
    btn.style.top = '16px'
    btn.style.right = '96px'
    btn.style.zIndex = '999999'
    mdBtn.style.position = 'fixed'
    mdBtn.style.top = '16px'
    mdBtn.style.right = '16px'
    mdBtn.style.zIndex = '999999'
    document.body.appendChild(btn)
    document.body.appendChild(mdBtn)
  }
}

function injectIntoTopicList() {
  // Find all rows with data-topic-id and inject a small button near the title link
  const rows = document.querySelectorAll('tr[data-topic-id]')
  rows.forEach(row => {
    try {
      const topicId = (row as HTMLElement).dataset.topicId
      if (!topicId) return
      // Avoid duplicate
      if (row.querySelector('.raw-preview-list-trigger')) return

      const titleLink = row.querySelector(
        'a.title, a.raw-topic-link, a.raw-link'
      ) as HTMLElement | null
      const btn = createTriggerButtonFor('iframe')
      btn.classList.add('raw-preview-list-trigger')
      btn.addEventListener('click', (e: Event) => {
        e.preventDefault()
        e.stopPropagation()
        createOverlay(topicId, 1, 'iframe')
      })
      const mdBtn = createTriggerButtonFor('markdown')
      mdBtn.classList.add('raw-preview-list-trigger-md')
      mdBtn.addEventListener('click', (e: Event) => {
        e.preventDefault()
        e.stopPropagation()
        createOverlay(topicId, 1, 'markdown')
      })

      if (titleLink && titleLink.parentElement) {
        // insert after the title link
        titleLink.parentElement.appendChild(btn)
        titleLink.parentElement.appendChild(mdBtn)
      } else {
        // append to the row as fallback
        ;(row as HTMLElement).appendChild(btn)
        ;(row as HTMLElement).appendChild(mdBtn)
      }
    } catch (err) {
      // ignore bad rows
      console.warn('[rawPreview] injectIntoTopicList error', err)
    }
  })
}

export function initRawPreview() {
  // Run initial injections
  try {
    injectOnTopicPage()
    injectIntoTopicList()
  } catch (e) {
    console.warn('[rawPreview] initial injection failed', e)
  }

  // Observe for dynamic list updates (infinite scroll or navigation)
  const observer = new MutationObserver(() => {
    injectOnTopicPage()
    injectIntoTopicList()
  })

  observer.observe(document.body, { childList: true, subtree: true })
}

export default initRawPreview
