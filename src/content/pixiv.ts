import { logger, chromeAPIWrapper } from '../config/buildFlags'

interface AddEmojiButtonData {
  name: string
  url: string
}

// Duplicate minimal helpers here to avoid circular imports
function extractNameFromUrl(url: string): string {
  try {
    const urlObj = new URL(url)
    const pathname = urlObj.pathname
    const filename = pathname.split('/').pop() || ''

    const nameWithoutExt = filename.replace(/\.[^/.]+$/, '')
    const decoded = decodeURIComponent(nameWithoutExt)
    if (/^[0-9a-f]{8,}$/i.test(decoded) || decoded.length < 2) {
      return '表情'
    }
    return decoded || '表情'
  } catch {
    return '表情'
  }
}

// First try to use canvas to obtain the image binary in-page (avoids downloads API).
// If canvas is tainted by CORS or any step fails, the caller should fall back to
// asking background to perform a direct browser download (chrome.downloads) which
// bypasses CORS restrictions.
async function tryGetImageViaCanvas(
  url: string
): Promise<{ success: true; blob: Blob } | { success: false; error: any }> {
  return new Promise(resolve => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = async () => {
      try {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        canvas.width = img.naturalWidth || img.width
        canvas.height = img.naturalHeight || img.height
        if (!ctx) throw new Error('no-2d-context')
        ctx.drawImage(img, 0, 0)

        // Try to use toBlob first; if it throws due to taint, catch and fallback
        try {
          canvas.toBlob(b => {
            if (b) resolve({ success: true, blob: b })
            else resolve({ success: false, error: 'no-blob' })
          })
        } catch (e) {
          // toBlob may throw SecurityError if canvas is tainted
          try {
            const dataUrl = canvas.toDataURL()
            fetch(dataUrl)
              .then(r => r.blob())
              .then(b => resolve({ success: true, blob: b }))
              .catch(err => resolve({ success: false, error: err }))
          } catch (err2) {
            resolve({ success: false, error: err2 })
          }
        }
      } catch (err) {
        resolve({ success: false, error: err })
      }
    }
    img.onerror = () => resolve({ success: false, error: new Error('image load failed') })
    // assign src last to start loading
    img.src = url
  })
}

async function performPixivDownloadFlow(data: AddEmojiButtonData) {
  // Contract:
  // - input: { name, url }
  // - tries: proxy-from-storage -> canvas -> background directDownload -> open URL
  try {
    const baseName = data.name && data.name.length > 0 ? data.name : extractNameFromUrl(data.url)
    const filename = baseName.replace(/\.(webp|jpg|jpeg|png|gif)$/i, '').trim() || 'image'

    // helper to read proxy config from extension storage (sync then local)
    const readProxyFromStorage = () =>
      new Promise<any>(resolve => {
        if (chromeAPIWrapper.shouldSkip()) {
          resolve(null)
          return
        }
        
        try {
          const chromeAPI = (window as any).chrome
          if (
            chromeAPI &&
            chromeAPI.storage &&
            chromeAPI.storage.sync &&
            chromeAPI.storage.sync.get
          ) {
            chromeAPI.storage.sync.get(['proxy'], (res: any) => resolve(res?.proxy || null))
          } else if (
            chromeAPI &&
            chromeAPI.storage &&
            chromeAPI.storage.local &&
            chromeAPI.storage.local.get
          ) {
            chromeAPI.storage.local.get(['proxy'], (res: any) => resolve(res?.proxy || null))
          } else resolve(null)
        } catch (_e) {
          resolve(null)
        }
      })

    // 1) If storage proxy is enabled, ask background to use it and avoid loading image here
    let storedProxy: any = null
    try {
      storedProxy = await readProxyFromStorage()
      if (storedProxy && storedProxy.enabled && storedProxy.url) {
        // If chrome runtime is available, prefer asking the background to use the stored proxy.
        if (!chromeAPIWrapper.shouldSkip()) {
          try {
            const bgResp: any = await chromeAPIWrapper.sendMessage({
              action: 'downloadForUser',
              payload: {
                url: data.url,
                filename,
                directDownload: true,
                useStorageProxy: true
              }
            })

            if (bgResp && bgResp.success)
              return {
                success: true,
                source: 'background',
                downloadId: bgResp.downloadId
              }
            if (bgResp && bgResp.fallback && bgResp.arrayBuffer) {
              try {
                const arrayBuffer = bgResp.arrayBuffer as ArrayBuffer
                const mimeType = bgResp.mimeType || 'application/octet-stream'
                const blob = new Blob([new Uint8Array(arrayBuffer)], { type: mimeType })
                const objectUrl = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = objectUrl
                a.download = filename
                document.body.appendChild(a)
                a.click()
                document.body.removeChild(a)
                setTimeout(() => URL.revokeObjectURL(objectUrl), 5000)
                return { success: true, source: 'background-fallback' }
              } catch (_e) {
                // fall through
              }
            }
          } catch (err) {
            logger.error('[PixivOneClick] proxy background request failed', err)
            // fall through to other options
          }
        } else {
          // No chrome runtime (likely userscript). Fetch proxy directly from the page to avoid CORS.
          try {
            const proxyUrl = new URL(storedProxy.url)
            proxyUrl.searchParams.set('url', data.url)
            if (storedProxy.password) proxyUrl.searchParams.set('pw', storedProxy.password)

            const resp = await fetch(proxyUrl.toString(), { method: 'GET' })
            if (resp.ok) {
              const arrayBuffer = await resp.arrayBuffer()
              const mimeType = resp.headers.get('content-type') || 'application/octet-stream'
              const blob = new Blob([new Uint8Array(arrayBuffer)], { type: mimeType })
              const objectUrl = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = objectUrl
              a.download = filename
              document.body.appendChild(a)
              a.click()
              document.body.removeChild(a)
              setTimeout(() => URL.revokeObjectURL(objectUrl), 5000)
              return { success: true, source: 'proxy-direct' }
            } else {
              logger.error('[PixivOneClick] proxy direct fetch failed', { status: resp.status })
            }
          } catch (err) {
            logger.error('[PixivOneClick] proxy direct fetch error', err)
          }
        }
      }
    } catch (err) {
      logger.error('[PixivOneClick] read proxy failed', err)
    }

    // 2) Canvas attempt (best-effort) — will fail with tainted canvas if CORS
    try {
      const canvasResult = await tryGetImageViaCanvas(data.url)
      if (canvasResult.success) {
        const objectUrl = URL.createObjectURL(canvasResult.blob)
        const a = document.createElement('a')
        a.href = objectUrl
        a.download = filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        setTimeout(() => URL.revokeObjectURL(objectUrl), 5000)
        return { success: true, source: 'canvas' }
      }
    } catch (e) {
      logger.error('[PixivOneClick] canvas extraction failed', e)
    }

    // 3) Ask background to perform directDownload (may itself use proxy if configured there)
    try {
      if (!chromeAPIWrapper.shouldSkip()) {
        const bgResp: any = await chromeAPIWrapper.sendMessage({
          action: 'downloadForUser',
          payload: {
            url: data.url,
            filename,
            directDownload: true
          }
        })

        if (bgResp && bgResp.success)
          return {
            success: true,
            source: 'background',
            downloadId: bgResp.downloadId
          }
        if (bgResp && bgResp.fallback && bgResp.arrayBuffer) {
          try {
            const arrayBuffer = bgResp.arrayBuffer as ArrayBuffer
            const mimeType = bgResp.mimeType || 'application/octet-stream'
            const blob = new Blob([new Uint8Array(arrayBuffer)], { type: mimeType })
            const objectUrl = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = objectUrl
            a.download = filename
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            setTimeout(() => URL.revokeObjectURL(objectUrl), 5000)
            return { success: true, source: 'background-fallback' }
          } catch (e) {
            void e
          }
        }
      }
    } catch (e) {
      logger.error('[PixivOneClick] background directDownload attempt failed', e)
    }

    // 4) Final fallback: open in new tab
    try {
      window.open(data.url, '_blank')
      return { success: true, fallback: 'opened' }
    } catch (e) {
      logger.error('[PixivOneClick] failed to open url', e)
      return { success: false, error: e }
    }
  } catch (error) {
    logger.error('[PixivOneClick] performPixivDownloadFlow failed', error)
    return { success: false, error }
  }
}

function setupButtonClickHandler(button: HTMLElement, data: AddEmojiButtonData) {
  let running = false

  const handle = async (origEvent: Event) => {
    try {
      origEvent.preventDefault()
      origEvent.stopPropagation()
    } catch (_e) {
      void _e
    }
    if (running) return
    running = true

    // disable pointer events to avoid accidental double clicks
    const prevPointerEvents = button.style.pointerEvents
    button.style.pointerEvents = 'none'

    const originalContent = button.innerHTML
    const originalStyle = button.style.cssText

    try {
      await performPixivDownloadFlow(data)

      button.innerHTML = `\n        <svg class="fa d-icon d-icon-check svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width: 1em; height: 1em; fill: currentColor; margin-right: 4px;">\n          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>\n        </svg>已添加\n      `
      button.style.background = 'linear-gradient(135deg, #10b981, #059669)'
      button.style.color = '#ffffff'
      button.style.border = '2px solid #ffffff'
      button.style.boxShadow = '0 2px 4px rgba(16, 185, 129, 0.3)'

      setTimeout(() => {
        button.innerHTML = originalContent
        button.style.cssText = originalStyle
        button.style.pointerEvents = prevPointerEvents
        running = false
      }, 2000)
    } catch (error) {
      logger.error('[PixivOneClick] 添加表情失败:', error)
      button.innerHTML = `\n        <svg class="fa d-icon d-icon-times svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width: 1em; height: 1em; fill: currentColor; margin-right: 4px;">\n          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>\n        </svg>失败\n      `
      button.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)'
      button.style.color = '#ffffff'
      button.style.border = '2px solid #ffffff'
      button.style.boxShadow = '0 2px 4px rgba(239, 68, 68, 0.3)'

      setTimeout(() => {
        button.innerHTML = originalContent
        button.style.cssText = originalStyle
        button.style.pointerEvents = prevPointerEvents
        running = false
      }, 2000)
    }
  }

  // Attach both pointerdown and click to maximize reliability across Pixiv UI
  button.addEventListener('pointerdown', handle)
  button.addEventListener('click', handle)
}

/** Pixiv-specific logic **/
function isPixivViewer(element: Element): boolean {
  try {
    if (!element) return false
    if (element.getAttribute && element.getAttribute('role') === 'presentation') {
      return !!element.querySelector('img[src*="i.pximg.net"]')
    }
    return false
  } catch (_e) {
    return false
  }
}

function extractEmojiDataFromPixiv(container: Element): AddEmojiButtonData | null {
  // Find the image and prefer the surrounding anchor (the clickable link) which typically points to the original
  const img = container.querySelector('img[src*="i.pximg.net"]') as HTMLImageElement | null
  if (!img) return null

  let src = ''
  const anchor = img.closest('a') as HTMLAnchorElement | null
  if (anchor && anchor.href) {
    src = anchor.href
  } else if (img.src) {
    // fallback to the image src (may be master); the common Pixiv UI usually provides an anchor to original
    src = img.src
  }

  if (!src || !src.startsWith('http')) return null

  let name = (img?.alt || img?.getAttribute('title') || '')?.trim() || ''
  if (!name || name.length < 2) name = extractNameFromUrl(src)
  name = name.replace(/\.(webp|jpg|jpeg|png|gif)$/i, '').trim()
  if (name.length === 0) name = '表情'
  return { name, url: src }
}

function createPixivEmojiButton(data: AddEmojiButtonData): HTMLElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'emoji-add-link-pixiv'
  // Use absolute positioning with a very high z-index so the button floats above Pixiv's UI/overlays
  // and remains clickable. Keep visual styles similar but remove inline margin and inline flow.
  button.style.cssText = `
    position: absolute;
    left: 12px;
    top: 12px;
    z-index: 100000;
    color: #ffffff;
    background: linear-gradient(135deg, #ef4444, #f97316);
    border: 2px solid rgba(255,255,255,0.95);
    border-radius: 6px;
    padding: 6px 10px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    pointer-events: auto;
  `
  button.innerHTML = `\n    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">\n      <path d="M12 4c.55 0 1 .45 1 1v6h6c.55 0 1 .45 1 1s-.45 1-1 1h-6v6c0 .55-.45 1-1 1s-1-.45-1-1v-6H5c-.55 0-1-.45-1-1s.45-1 1-1h6V5c0-.55.45-1 1-1z"/>\n    </svg>\n    一键下载\n  `
  button.title = '一键下载'
  // store data as dataset for robustness
  try {
    button.dataset.emojiName = data.name
    button.dataset.emojiUrl = data.url
  } catch (_e) {
    void _e
  }
  setupButtonClickHandler(button, data)
  return button
}

function addEmojiButtonToPixiv(pixivContainer: Element) {
  if (!pixivContainer) return
  if (pixivContainer.querySelector('.emoji-add-link-pixiv')) return
  const emojiData = extractEmojiDataFromPixiv(pixivContainer)
  if (!emojiData) return
  const addButton = createPixivEmojiButton(emojiData)
  // Ensure the container can be the positioning context for our absolute button
  try {
    const parentEl = pixivContainer as HTMLElement
    const computed = window.getComputedStyle(parentEl)
    if (computed.position === 'static' || !computed.position) parentEl.style.position = 'relative'
  } catch (_e) {
    // ignore
  }

  // Append the absolute-positioned button directly into the pixiv container so it floats above overlays
  pixivContainer.appendChild(addButton)
}

function scanForPixivViewer() {
  const candidates = document.querySelectorAll('[role="presentation"]')
  candidates.forEach(c => {
    if (isPixivViewer(c)) addEmojiButtonToPixiv(c)
  })
}

function observePixivViewer() {
  const observer = new MutationObserver(mutations => {
    let shouldScan = false
    mutations.forEach(m => {
      if (m.type === 'childList') {
        m.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as Element
            if (el.getAttribute && el.getAttribute('role') === 'presentation') {
              shouldScan = true
            } else if (el.querySelector && el.querySelector('img[src*="i.pximg.net"]')) {
              shouldScan = true
            }
          }
        })
      }
    })
    if (shouldScan) setTimeout(scanForPixivViewer, 120)
  })
  observer.observe(document.body, { childList: true, subtree: true })
}

export function initPixiv() {
  // 初始扫描与观察器（仅当页面为 Pixiv 时）
  try {
    if (!isPixivPage()) {
      logger.log('[PixivOneClick] skipping init: not a Pixiv page')
      return
    }

    setTimeout(scanForPixivViewer, 100)
    observePixivViewer()
    // inject lightweight proxy settings UI for testing/config
    try {
      createProxySettingsUI()
    } catch (_e) {
      void _e
    }
  } catch (e) {
    logger.error('[PixivOneClick] init failed', e)
  }
}

/**
 * 简单判断当前页面是否为 Pixiv：
 * - title 包含 pixiv
 * - meta[property="og:site_name"] 内容为 pixiv
 * - canonical 链接指向 pixiv.net
 * - meta[property="twitter:site"] 或 meta[property="twitter:site"] 包含 pixiv
 */
function isPixivPage(): boolean {
  try {
    // Only inspect meta tags in <head>
    const ogSite =
      document.querySelector('meta[property="og:site_name"]')?.getAttribute('content') || ''
    if (ogSite.toLowerCase().includes('pixiv')) return true

    const twitterMeta =
      document.querySelector('meta[property="twitter:site"]') ||
      document.querySelector('meta[name="twitter:site"]')
    const twitterSite = (twitterMeta && twitterMeta.getAttribute('content')) || ''
    if (twitterSite.toLowerCase().includes('pixiv')) return true

    const desc = document.querySelector('meta[name="description"]')?.getAttribute('content') || ''
    if (desc.toLowerCase().includes('pixiv')) return true

    // og:image may point to embed.pixiv.net or pximg.net
    const ogImage =
      document.querySelector('meta[property="og:image"]')?.getAttribute('content') || ''
    if (
      ogImage.includes('pixiv.net') ||
      ogImage.includes('pximg.net') ||
      ogImage.includes('embed.pixiv.net')
    ) {
      return true
    }

    return false
  } catch (e) {
    logger.error('[PixivOneClick] isPixivPage check failed', e)
    return false
  }
}

// --- In-page proxy settings UI (simple, stored in chrome.storage) ---
function createProxySettingsUI() {
  try {
    const chromeAPI = (window as any).chrome
    if (!chromeAPI) return

    // avoid duplicate UI
    if (document.getElementById('pixiv-proxy-open-btn')) return

    // styles
    const style = document.createElement('style')
    style.id = 'pixiv-proxy-style'
    style.textContent = `
      #pixiv-proxy-open-btn { position: fixed; right: 12px; top: 12px; z-index: 200000; width:36px; height:36px; border-radius:6px; background:#111827; color:#fff; display:flex; align-items:center; justify-content:center; cursor:pointer; box-shadow:0 4px 12px rgba(0,0,0,0.4); }
      #pixiv-proxy-panel { position: fixed; right: 12px; top: 56px; z-index: 200000; width:320px; max-width:calc(100vw - 24px); background:#fff; color:#111827; border-radius:8px; box-shadow:0 8px 24px rgba(0,0,0,0.35); padding:12px; font-family: system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; }
      #pixiv-proxy-panel input[type="text"], #pixiv-proxy-panel input[type="password"] { width:100%; box-sizing:border-box; padding:6px; margin:6px 0 10px 0; }
      #pixiv-proxy-panel label { font-size:12px; }
      #pixiv-proxy-panel .row { display:flex; gap:8px; align-items:center; }
      #pixiv-proxy-panel button { margin-top:6px; padding:6px 10px; cursor:pointer; }
    `
    document.head.appendChild(style)

    // open button (gear)
    const openBtn = document.createElement('button')
    openBtn.id = 'pixiv-proxy-open-btn'
    openBtn.title = 'Proxy 设置'
    openBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path fill="currentColor" d="M12 15.5A3.5 3.5 0 1 0 12 8.5a3.5 3.5 0 0 0 0 7z"/>
        <path fill="currentColor" d="M19.43 12.98a7.5 7.5 0 0 0 0-1.96l2.11-1.65a.5.5 0 0 0 .12-.62l-2-3.46a.5.5 0 0 0-.6-.22l-2.49 1a7.7 7.7 0 0 0-1.7-.98L14.5 2.5a.5.5 0 0 0-.5-.5h-4a.5.5 0 0 0-.5.5l-.38 2.39c-.6.24-1.17.55-1.7.98l-2.49-1a.5.5 0 0 0-.6.22l-2 3.46a.5.5 0 0 0 .12.62L4.57 11a7.5 7.5 0 0 0 0 1.96L2.46 14.6a.5.5 0 0 0-.12.62l2 3.46c.15.26.46.36.74.26l2.49-1c.53.43 1.1.74 1.7.98l.38 2.39c.07.32.35.55.68.55h4c.33 0 .61-.23.68-.55l.38-2.39c.6-.24 1.17-.55 1.7-.98l2.49 1c.28.1.59 0 .74-.26l2-3.46a.5.5 0 0 0-.12-.62l-2.11-1.62z"/>
      </svg>
    `
    document.body.appendChild(openBtn)

    // panel (hidden initially)
    const panel = document.createElement('div')
    panel.id = 'pixiv-proxy-panel'
    panel.style.display = 'none'
    panel.innerHTML = `
      <div style="font-weight:700;margin-bottom:6px">Proxy 设置</div>
      <label><input id="pixiv-proxy-enabled" type="checkbox"> 启用代理</label>
      <div style="margin-top:6px"><label>Proxy URL</label><input id="pixiv-proxy-url" type="text" placeholder="https://your-proxy.example/" /></div>
      <div><label>Password (可选)</label><input id="pixiv-proxy-pw" type="password" placeholder="密码" /></div>
      <div class="row"><button id="pixiv-proxy-save">保存</button><button id="pixiv-proxy-close">关闭</button></div>
      <div id="pixiv-proxy-msg" style="margin-top:8px;font-size:12px;color:#666"></div>
    `
    document.body.appendChild(panel)

    const togglePanel = (show?: boolean) => {
      if (typeof show === 'boolean') {
        panel.style.display = show ? 'block' : 'none'
        return
      }
      panel.style.display = panel.style.display === 'none' ? 'block' : 'none'
    }

    openBtn.addEventListener('click', () => togglePanel())
    panel.querySelector('#pixiv-proxy-close')?.addEventListener('click', () => togglePanel(false))

    const saveBtn = panel.querySelector('#pixiv-proxy-save') as HTMLButtonElement
    const msgEl = panel.querySelector('#pixiv-proxy-msg') as HTMLElement

    const load = () =>
      new Promise(resolve => {
        try {
          if (chromeAPI.storage && chromeAPI.storage.sync && chromeAPI.storage.sync.get) {
            chromeAPI.storage.sync.get(['proxy'], (res: any) => resolve(res?.proxy || null))
          } else if (chromeAPI.storage && chromeAPI.storage.local && chromeAPI.storage.local.get) {
            chromeAPI.storage.local.get(['proxy'], (res: any) => resolve(res?.proxy || null))
          } else resolve(null)
        } catch (_e) {
          resolve(null)
        }
      })

    const save = (cfg: any) =>
      new Promise(resolve => {
        try {
          if (chromeAPI.storage && chromeAPI.storage.sync && chromeAPI.storage.sync.set) {
            chromeAPI.storage.sync.set({ proxy: cfg }, () => resolve(true))
          } else if (chromeAPI.storage && chromeAPI.storage.local && chromeAPI.storage.local.set) {
            chromeAPI.storage.local.set({ proxy: cfg }, () => resolve(true))
          } else resolve(false)
        } catch (_e) {
          resolve(false)
        }
      })

    // populate
    ;(async () => {
      const cfg: any = await load()
      const enabled = panel.querySelector('#pixiv-proxy-enabled') as HTMLInputElement
      const url = panel.querySelector('#pixiv-proxy-url') as HTMLInputElement
      const pw = panel.querySelector('#pixiv-proxy-pw') as HTMLInputElement
      if (cfg) {
        enabled.checked = !!cfg.enabled
        url.value = cfg.url || ''
        pw.value = cfg.password || ''
      }
    })()

    saveBtn.addEventListener('click', async () => {
      const enabled = (panel.querySelector('#pixiv-proxy-enabled') as HTMLInputElement).checked
      const url = (panel.querySelector('#pixiv-proxy-url') as HTMLInputElement).value.trim()
      const pw = (panel.querySelector('#pixiv-proxy-pw') as HTMLInputElement).value
      const cfg = { enabled: !!enabled, url, password: pw }
      const ok: any = await save(cfg)
      msgEl.textContent = ok ? '已保存' : '保存失败'
      setTimeout(() => (msgEl.textContent = ''), 2000)
    })
  } catch (_e) {
    // non-fatal
  }
}
