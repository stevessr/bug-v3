// ==UserScript==
// @name         Discourse 话题预览按钮 (Topic Preview Button)
// @namespace    https://github.com/stevessr/bug-v3
// @version      1.0.0
// @description  为 Discourse 话题列表添加预览按钮功能 (Add preview button functionality to Discourse topic lists)
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
// @downloadURL  https://github.com/stevessr/bug-v3/releases/latest/download/preview-button.user.js
// @updateURL    https://github.com/stevessr/bug-v3/releases/latest/download/preview-button.user.js
// @run-at       document-end
// ==/UserScript==

(function () {
  'use strict'

  // ===== Utility Functions =====

  // createEl helper: safely create elements
  function createEl(tag, opts) {
    const el = document.createElement(tag)
    if (!opts) return el
    if (opts.width) el.style.width = opts.width
    if (opts.height) el.style.height = opts.height
    if (opts.className) el.className = opts.className
    if (opts.text) el.textContent = opts.text
    if (opts.placeholder && 'placeholder' in el) el.placeholder = opts.placeholder
    if (opts.type && 'type' in el) el.type = opts.type
    if (opts.value !== undefined && 'value' in el) el.value = opts.value
    if (opts.style) el.style.cssText = opts.style
    if (opts.src && 'src' in el) el.src = opts.src
    if (opts.attrs) for (const k in opts.attrs) el.setAttribute(k, opts.attrs[k])
    if (opts.dataset) for (const k in opts.dataset) el.dataset[k] = opts.dataset[k]
    if (opts.innerHTML) el.innerHTML = opts.innerHTML
    if (opts.title) el.title = opts.title
    if (opts.alt && 'alt' in el) el.alt = opts.alt
    if (opts.id) el.id = opts.id
    if (opts.on) {
      for (const [evt, handler] of Object.entries(opts.on)) {
        el.addEventListener(evt, handler)
      }
    }
    return el
  }

  // ensureStyleInjected helper
  function ensureStyleInjected(id, css) {
    if (document.getElementById(id)) return
    const style = document.createElement('style')
    style.id = id
    style.textContent = css
    document.documentElement.appendChild(style)
  }

  // ===== Preview Styles =====

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

  // ===== Preview Logic =====

  let overlay = null
  let iframeEl = null
  let currentTopicId = null
  let currentPage = 1
  let renderMode = 'iframe'
  let currentTopicSlug = null
  let jsonScrollAttached = false
  let jsonIsLoading = false
  let jsonReachedEnd = false

  function rawUrl(topicId, page) {
    return new URL(`/raw/${topicId}?page=${page}`, window.location.origin).toString()
  }

  function jsonUrl(topicId, page, slug) {
    const usedSlug = slug || currentTopicSlug || 'topic'
    return new URL(`/t/${usedSlug}/${topicId}.json?page=${page}`, window.location.origin).toString()
  }

  function createOverlay(topicId, startPage, mode, slug) {
    if (overlay) return
    currentTopicId = topicId
    currentPage = startPage || 1
    renderMode = mode || 'iframe'
    currentTopicSlug = slug || null

    overlay = createEl('div', { className: 'raw-preview-overlay' })
    const modal = createEl('div', { className: 'raw-preview-modal' })

    const header = createEl('div', { className: 'raw-preview-header' })
    const title = createEl('div', {
      className: 'raw-preview-title',
      text: `话题预览 ${topicId}`
    })
    const ctrls = createEl('div', { className: 'raw-preview-ctrls' })

    const modeLabel = createEl('span', {
      text: mode === 'markdown' ? '模式：Markdown' : '模式：原始'
    })
    const prevBtn = createEl('button', {
      className: 'raw-preview-small-btn',
      text: '◀ 上一页'
    })
    const nextBtn = createEl('button', {
      className: 'raw-preview-small-btn',
      text: '下一页 ▶'
    })
    const closeBtn = createEl('button', {
      className: 'raw-preview-small-btn',
      text: '关闭 ✖'
    })

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
    })

    modal.appendChild(header)
    modal.appendChild(iframeEl)
    overlay.appendChild(modal)

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) removeOverlay()
    })

    window.addEventListener('keydown', handleKeydown)

    document.body.appendChild(overlay)

    if (renderMode === 'iframe') {
      iframeEl.src = rawUrl(topicId, currentPage)
    } else {
      if (renderMode === 'markdown') {
        fetchAndRenderMarkdown(topicId, currentPage)
      } else if (renderMode === 'json') {
        fetchAndRenderJson(topicId, currentPage, currentTopicSlug).then(() => {
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
        try {
          const doc = getIframeDoc()
          const targetId = `json-page-${currentPage}`
          if (doc.getElementById(targetId)) {
            scrollToJsonPage(currentPage)
            return
          }
          const nodes = Array.from(doc.querySelectorAll('[id^="json-page-"]'))
          let maxLoaded = 0
          for (const n of nodes) {
            const m = n.id.match(/json-page-(\d+)/)
            if (m) maxLoaded = Math.max(maxLoaded, parseInt(m[1], 10))
          }
          let start = Math.max(1, maxLoaded + 1)
          for (let p = start; p <= currentPage; p++) {
            const added = await fetchAndRenderJson(currentTopicId, p, currentTopicSlug)
            if (added === 0) break
          }
          scrollToJsonPage(currentPage)
        } catch {
          fetchAndRenderJson(currentTopicId, currentPage, currentTopicSlug)
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

  function handleKeydown(e) {
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

  function createTriggerButtonFor(mode) {
    const text = mode === 'markdown' ? '预览 (MD)' : '预览'
    const btn = createEl('button', {
      className: `raw-preview-small-btn ${mode === 'markdown' ? 'md' : mode === 'json' ? 'json' : 'iframe'}`,
      text: mode === 'json' ? '预览 (JSON)' : text
    })
    btn.dataset.previewMode = mode
    return btn
  }

  // ===== Markdown rendering =====

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }

  function simpleMarkdownToHtml(md) {
    const lines = md.replace(/\r\n/g, '\n').split('\n')
    let inCode = false
    const out = []
    let listType = null
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i]

      const fenceMatch = line.match(/^```\s*(\S*)/)
      if (fenceMatch) {
        if (!inCode) {
          inCode = true
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

      const h = line.match(/^(#{1,6})\s+(.*)/)
      if (h) {
        out.push(`<h${h[1].length}>${escapeHtml(h[2])}</h${h[1].length}>`)
        continue
      }

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

      out.push(`<p>${inlineFormat(line)}</p>`)
    }

    if (listType === 'ul') out.push('</ul>')
    if (listType === 'ol') out.push('</ol>')

    return out.join('\n')
  }

  function inlineFormat(text) {
    let t = escapeHtml(text)
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

      return `<img src="${escapeHtml(url)}" alt="${alt}"${widthAttr}${heightAttr} />`
    })
    t = t.replace(/`([^`]+)`/g, '<code>$1</code>')
    t = t.replace(/~~([\s\S]+?)~~/g, '<del>$1</del>')
    t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    t = t.replace(/\*([^*]+)\*/g, '<em>$1</em>')
    t = t.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
    )
    return t
  }

  async function fetchAndRenderMarkdown(topicId, page) {
    if (!iframeEl) return
    const url = rawUrl(topicId, page)
    try {
      const res = await fetch(url, { credentials: 'include' })
      if (!res.ok) throw new Error('fetch failed ' + res.status)
      const text = await res.text()

      let html
      try {
        const md = await loadMarkdownIt()
        if (md) {
          try {
            const parser = md({ html: true, linkify: true })
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

      const doc = iframeEl.contentDocument || iframeEl.contentWindow?.document
      if (!doc) throw new Error('iframe document unavailable')

      // Custom CSS can be added here for preview styling
      const css = ``

      doc.open()
      doc.write(
        `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body>${html}</body></html>`
      )
      doc.close()
    } catch (err) {
      console.warn('[rawPreview] fetchAndRenderMarkdown failed', err)
      iframeEl.src = url
    }
  }

  function getIframeDoc() {
    const doc = iframeEl.contentDocument || iframeEl.contentWindow?.document
    if (!doc) throw new Error('iframe document unavailable')
    return doc
  }

  function ensureJsonSkeleton() {
    const doc = getIframeDoc()
    const existing = doc.getElementById('json-container')
    if (existing) return existing
    // Custom CSS can be added here for JSON preview styling
    const css = ``
    const baseHref = window.location.origin
    doc.open()
    doc.write(
      `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base href="${baseHref}/"><style>${css}</style></head><body><div id="json-container"></div></body></html>`
    )
    doc.close()
    return doc.getElementById('json-container')
  }

  async function fetchAndRenderJson(topicId, page, slug) {
    if (!iframeEl) return 0
    const url = jsonUrl(topicId, page, slug)
    try {
      const res = await fetch(url, { credentials: 'include' })
      if (!res.ok) throw new Error('fetch failed ' + res.status)
      const data = await res.json()
      const posts =
        data && data.post_stream && Array.isArray(data.post_stream.posts)
          ? data.post_stream.posts
          : []

      const parts = []
      for (const p of posts) {
        const cooked = typeof p.cooked === 'string' ? p.cooked : ''
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
      iframeEl.src = url
      return 0
    }
  }

  function scrollToJsonPage(page) {
    try {
      if (!iframeEl) return
      const doc = getIframeDoc()
      const el = doc.getElementById(`json-page-${page}`)
      if (!el) return
      const top = el.offsetTop
      const win = iframeEl.contentWindow || iframeEl.contentDocument?.defaultView
      if (win) win.scrollTo({ top, behavior: 'smooth' })
    } catch {}
  }

  function attachJsonAutoPager() {
    if (jsonScrollAttached || !iframeEl || renderMode !== 'json') return
    try {
      const win = iframeEl.contentWindow || iframeEl.contentDocument?.defaultView
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
            const added = await fetchAndRenderJson(currentTopicId, nextPage, currentTopicSlug)
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

  function loadMarkdownIt() {
    return new Promise((resolve, reject) => {
      try {
        const win = window
        if (win && win.markdownit) return resolve(win.markdownit)

        const src = 'https://cdn.jsdelivr.net/npm/markdown-it@13.0.1/dist/markdown-it.min.js'
        const existing = document.querySelector(`script[src="${src}"]`)
        if (existing) {
          const check = () => {
            if (window.markdownit) return resolve(window.markdownit)
            setTimeout(check, 50)
          }
          check()
          return
        }

        const s = document.createElement('script')
        s.src = src
        s.async = true
        s.onload = () => {
          const md = window.markdownit
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

  function uploadUrlPlugin(mdLib) {
    const defaultRender =
      mdLib.renderer.rules.image ||
      function (tokens, idx, options, _env, self) {
        return self.renderToken(tokens, idx, options)
      }

    mdLib.renderer.rules.image = function (tokens, idx, options, env, self) {
      try {
        const token = tokens[idx]
        if (token.attrs) {
          const srcIdx = token.attrIndex('src')
          if (srcIdx >= 0) {
            const srcVal = token.attrs[srcIdx][1]
            if (typeof srcVal === 'string' && srcVal.startsWith('upload://')) {
              const filename = srcVal.replace(/^upload:\/\//, '')
              token.attrs[srcIdx][1] = `${window.location.origin}/uploads/short-url/${filename}`
            }
          }

          const altIdx = token.attrIndex('alt')
          if (altIdx >= 0) {
            const altVal = token.attrs[altIdx][1] || ''
            const parts = String(altVal).split('|')
            if (parts.length > 1) {
              token.attrs[altIdx][1] = parts[0]
              const dim = parts[1].match(/(\d+)x(\d+)/)
              if (dim) {
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

  // ===== Injection Logic =====

  function injectIntoTopicList() {
    const rows = document.querySelectorAll('tr[data-topic-id]')
    rows.forEach((row) => {
      try {
        const topicId = row.dataset.topicId
        if (!topicId) return
        if (row.querySelector('.raw-preview-list-trigger')) return

        const titleLink = row.querySelector('a.title, a.raw-topic-link, a.raw-link')
        const btn = createTriggerButtonFor('iframe')
        btn.classList.add('raw-preview-list-trigger')
        btn.addEventListener('click', (e) => {
          e.preventDefault()
          e.stopPropagation()
          createOverlay(topicId, 1, 'iframe')
        })

        const jsonBtn = createTriggerButtonFor('json')
        jsonBtn.classList.add('raw-preview-list-trigger-json')
        jsonBtn.addEventListener('click', (e) => {
          e.preventDefault()
          e.stopPropagation()
          let slug
          const href = titleLink?.getAttribute('href') || ''
          const m = href.match(/\/t\/([^/]+)\/(\d+)/)
          if (m) slug = m[1]
          createOverlay(topicId, 1, 'json', slug)
        })

        if (titleLink && titleLink.parentElement) {
          titleLink.parentElement.appendChild(btn)
          titleLink.parentElement.appendChild(jsonBtn)
        } else {
          row.appendChild(btn)
          row.appendChild(jsonBtn)
        }
      } catch (err) {
        console.warn('[rawPreview] injectIntoTopicList error', err)
      }
    })
  }

  function initRawPreview() {
    try {
      injectIntoTopicList()
    } catch (e) {
      console.warn('[rawPreview] initial injection failed', e)
    }

    const observer = new MutationObserver(() => {
      injectIntoTopicList()
    })

    observer.observe(document.body, { childList: true, subtree: true })
  }

  // Check if current page is a Discourse site
  function isDiscoursePage() {
    const discourseMetaTags = document.querySelectorAll(
      'meta[name*="discourse"], meta[content*="discourse"], meta[property*="discourse"]'
    )
    if (discourseMetaTags.length > 0) {
      console.log('[Preview Button] Discourse detected via meta tags')
      return true
    }

    const generatorMeta = document.querySelector('meta[name="generator"]')
    if (generatorMeta) {
      const content = generatorMeta.getAttribute('content')?.toLowerCase() || ''
      if (content.includes('discourse')) {
        console.log('[Preview Button] Discourse detected via generator meta')
        return true
      }
    }

    const discourseElements = document.querySelectorAll(
      '#main-outlet, .ember-application, textarea.d-editor-input, .ProseMirror.d-editor-input'
    )
    if (discourseElements.length > 0) {
      console.log('[Preview Button] Discourse elements detected')
      return true
    }

    console.log('[Preview Button] Not a Discourse site')
    return false
  }

  // ===== Entry Point =====

  if (isDiscoursePage()) {
    console.log('[Preview Button] Discourse detected, initializing preview button feature')
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initRawPreview)
    } else {
      initRawPreview()
    }
  } else {
    console.log('[Preview Button] Not a Discourse site, skipping injection')
  }
})()
