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
  background: var(--secondary);
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
  background: var(--secondary);
  color: var(--title-color);
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
  background: var(--d-button-primary-bg-color);
  cursor: pointer;
  color: var(--d-button-primary-text-color);
}
.raw-preview-small-btn.md {
  background: linear-gradient(90deg,#fffbe6,#f0f7ff);
  border-color: rgba(3,102,214,0.12);
}
.raw-preview-small-btn.json {
  background: var(--d-button-default-bg-color);
  border-color: rgba(0,128,96,0.12);
  color: var(--d-button-default-text-color);
}
`

ensureStyleInjected('raw-preview-styles', RAW_PREVIEW_STYLES)

let overlay: HTMLElement | null = null
let iframeEl: HTMLIFrameElement | null = null
let currentTopicId: string | null = null
let currentPage = 1
let renderMode: 'iframe' | 'markdown' | 'json' = 'iframe'
let currentTopicSlug: string | null = null
// auto paging state (for json mode)
let jsonScrollAttached = false
let jsonIsLoading = false
let jsonReachedEnd = false

function rawUrl(topicId: string, page: number) {
  // Build the raw page url per site pattern
  return new URL(`/raw/${topicId}?page=${page}`, window.location.origin).toString()
}

function jsonUrl(topicId: string, page: number, slug?: string) {
  const usedSlug = slug || currentTopicSlug || 'topic'
  return new URL(`/t/${usedSlug}/${topicId}.json?page=${page}`, window.location.origin).toString()
}

function createOverlay(
  topicId: string,
  startPage = 1,
  mode: 'iframe' | 'markdown' | 'json' = 'iframe',
  slug?: string
) {
  if (overlay) return // already open
  currentTopicId = topicId
  currentPage = startPage
  renderMode = mode
  currentTopicSlug = slug || null

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
    // render markdown/json into iframe by fetching
    if (renderMode === 'markdown') {
      fetchAndRenderMarkdown(topicId, currentPage)
    } else if (renderMode === 'json') {
      fetchAndRenderJson(topicId, currentPage, currentTopicSlug || undefined).then(() => {
        attachJsonAutoPager()
      })
    }
  }
}

async function updateIframeSrc() {
  if (!iframeEl || !currentTopicId) return
  if (renderMode === 'iframe') {
    iframeEl.src = rawUrl(currentTopicId, currentPage)
  } else {
    if (renderMode === 'markdown') {
      fetchAndRenderMarkdown(currentTopicId, currentPage)
    } else if (renderMode === 'json') {
      // If target page already exists, just scroll to it; otherwise append missing pages up to it.
      try {
        const doc = getIframeDoc()
        const targetId = `json-page-${currentPage}`
        if (doc.getElementById(targetId)) {
          scrollToJsonPage(currentPage)
          return
        }
        // find highest loaded page
        const nodes = Array.from(doc.querySelectorAll('[id^="json-page-"]')) as HTMLElement[]
        let maxLoaded = 0
        for (const n of nodes) {
          const m = n.id.match(/json-page-(\d+)/)
          if (m) maxLoaded = Math.max(maxLoaded, parseInt(m[1], 10))
        }
        let start = Math.max(1, maxLoaded + 1)
        for (let p = start; p <= currentPage; p++) {
          // eslint-disable-next-line no-await-in-loop
          const added = await fetchAndRenderJson(currentTopicId, p, currentTopicSlug || undefined)
          if (added === 0) break
        }
        scrollToJsonPage(currentPage)
      } catch {
        // fallback
        fetchAndRenderJson(currentTopicId, currentPage, currentTopicSlug || undefined)
      }
    }
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
  jsonScrollAttached = false
  jsonIsLoading = false
  jsonReachedEnd = false
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

function createTriggerButtonFor(mode: 'iframe' | 'markdown' | 'json') {
  const text = mode === 'markdown' ? '预览 (MD)' : '预览'
  const btn = createEl('button', {
    className: `raw-preview-small-btn ${mode === 'markdown' ? 'md' : mode === 'json' ? 'json' : 'iframe'}`,
    text: mode === 'json' ? '预览 (JSON)' : text
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

    const css = ``

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

function getIframeDoc(): Document {
  const doc =
    (iframeEl as HTMLIFrameElement).contentDocument || (iframeEl as any).contentWindow?.document
  if (!doc) throw new Error('iframe document unavailable')
  return doc
}

function ensureJsonSkeleton(): HTMLElement {
  const doc = getIframeDoc()
  const existing = doc.getElementById('json-container') as HTMLElement | null
  if (existing) return existing
  const css = ``
  const baseHref = window.location.origin
  doc.open()
  doc.write(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base href="${baseHref}/"><style>${css}</style></head><body><div id="json-container"></div></body></html>`
  )
  doc.close()
  return doc.getElementById('json-container') as HTMLElement
}

async function fetchAndRenderJson(topicId: string, page: number, slug?: string): Promise<number> {
  if (!iframeEl) return 0
  const url = jsonUrl(topicId, page, slug)
  try {
    const res = await fetch(url, { credentials: 'include' })
    if (!res.ok) throw new Error('fetch failed ' + res.status)
    const data = await res.json()
    const posts =
      data && data.post_stream && Array.isArray(data.post_stream.posts)
        ? (data.post_stream.posts as Array<any>)
        : []

    // Build simple HTML by concatenating cooked per post (楼层顺序)
    const parts: string[] = []
    for (const p of posts) {
      const cooked = typeof p.cooked === 'string' ? p.cooked : ''
      // optional header for each floor
      const header = `<div class="json-post-header" style="font: 500 13px/1.4 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#555;margin:8px 0 4px;">#${p.post_number || ''} @${p.username || ''} <span style="color:#999;">${p.created_at || ''}</span></div>`
      parts.push(
        `<article class="json-post" style="padding:8px 0;border-bottom:1px solid #eee;">${header}<div class="json-post-body">${cooked}</div></article>`
      )
    }

    const container = ensureJsonSkeleton()
    const wrapper = `<div class="json-page" id="json-page-${page}">${parts.join('\n')}</div>`
    container.insertAdjacentHTML('beforeend', wrapper)
    return posts.length
  } catch (err) {
    console.warn('[rawPreview] fetchAndRenderJson failed', err)
    // fallback to setting iframe src to the JSON url (not ideal for UX)
    iframeEl.src = url
    return 0
  }
}

function scrollToJsonPage(page: number) {
  try {
    if (!iframeEl) return
    const doc = getIframeDoc()
    const el = doc.getElementById(`json-page-${page}`)
    if (!el) return
    const top = (el as HTMLElement).offsetTop
    const win = (iframeEl.contentWindow ||
      (iframeEl as any).contentDocument?.defaultView) as Window | null
    if (win) win.scrollTo({ top, behavior: 'smooth' })
  } catch {}
}

function attachJsonAutoPager() {
  if (jsonScrollAttached || !iframeEl || renderMode !== 'json') return
  try {
    const win = (iframeEl.contentWindow ||
      (iframeEl as any).contentDocument?.defaultView) as Window | null
    if (!win) return
    const onScroll = async () => {
      if (jsonIsLoading || jsonReachedEnd) return
      const doc = win.document
      const scrollTop = win.scrollY || doc.documentElement.scrollTop || doc.body.scrollTop
      const ih = win.innerHeight
      const sh = doc.documentElement.scrollHeight || doc.body.scrollHeight
      if (scrollTop + ih >= sh - 200) {
        jsonIsLoading = true
        try {
          const nextPage = currentPage + 1
          const added = await fetchAndRenderJson(
            currentTopicId!,
            nextPage,
            currentTopicSlug || undefined
          )
          if (added > 0) {
            currentPage = nextPage
          } else {
            jsonReachedEnd = true
          }
        } catch (e) {
          jsonReachedEnd = true
        } finally {
          jsonIsLoading = false
        }
      }
    }
    win.addEventListener('scroll', onScroll, { passive: true })
    jsonScrollAttached = true
  } catch (e) {
    // ignore
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
  const defaultRender =
    mdLib.renderer.rules.image ||
    function (tokens: any, idx: number, options: any, _env: any, self: any) {
      return self.renderToken(tokens, idx, options)
    }

  mdLib.renderer.rules.image = function (
    tokens: any,
    idx: number,
    options: any,
    env: any,
    self: any
  ) {
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

// Note: per requirement, we no longer inject buttons on individual topic pages.

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

      // markdown variant
      //const mdBtn = createTriggerButtonFor('markdown')
      //mdBtn.classList.add('raw-preview-list-trigger-md')
      //mdBtn.addEventListener('click', (e: Event) => {e.preventDefault()e.stopPropagation()createOverlay(topicId, 1, 'markdown')})

      // json variant
      const jsonBtn = createTriggerButtonFor('json')
      jsonBtn.classList.add('raw-preview-list-trigger-json')
      jsonBtn.addEventListener('click', (e: Event) => {
        e.preventDefault()
        e.stopPropagation()
        // parse slug from title link href like /t/<slug>/<id>
        let slug: string | undefined
        const href = (titleLink as HTMLAnchorElement | null)?.getAttribute('href') || ''
        const m = href.match(/\/t\/([^/]+)\/(\d+)/)
        if (m) slug = m[1]
        createOverlay(topicId, 1, 'json', slug)
      })

      if (titleLink && titleLink.parentElement) {
        // insert after the title link
        titleLink.parentElement.appendChild(btn)
        //titleLink.parentElement.appendChild(mdBtn)
        titleLink.parentElement.appendChild(jsonBtn)
      } else {
        // append to the row as fallback
        ;(row as HTMLElement).appendChild(btn)
        //;(row as HTMLElement).appendChild(mdBtn)
        ;(row as HTMLElement).appendChild(jsonBtn)
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
    injectIntoTopicList()
  } catch (e) {
    console.warn('[rawPreview] initial injection failed', e)
  }

  // Observe for dynamic list updates (infinite scroll or navigation)
  const observer = new MutationObserver(() => {
    injectIntoTopicList()
  })

  observer.observe(document.body, { childList: true, subtree: true })
}

export default initRawPreview
