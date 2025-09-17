// Autonomous Pixiv Platform Script
// Self-contained script for Pixiv, includes all necessary functions inline

;(function () {
  'use strict'

  // ==== Platform Detection ====
  function isPixivPage(): boolean {
    try {
      const hostname = window.location.hostname.toLowerCase()

      // Direct pixiv domains
      if (hostname.includes('i.pximg.net') || hostname.includes('pximg.net')) {
        return true
      }

      if (hostname.includes('pixiv.net')) {
        return true
      }

      // Check meta tags
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
      console.error('[PixivScript] Platform detection failed', e)
      return false
    }
  }

  // ==== Utility Functions ====
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

          try {
            canvas.toBlob(b => {
              if (b) {
                resolve({ success: true, blob: b })
              } else {
                resolve({ success: false, error: 'no-blob' })
              }
            })
          } catch (e) {
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
      img.src = url
    })
  }

  // ==== Chrome Extension Communication ====
  function sendToBackground(message: any): Promise<any> {
    return new Promise(resolve => {
      try {
        const chromeAPI = (window as any).chrome
        if (chromeAPI && chromeAPI.runtime && chromeAPI.runtime.sendMessage) {
          chromeAPI.runtime.sendMessage(message, (response: any) => {
            resolve(response || { success: false, error: 'No response' })
          })
        } else {
          console.warn('[PixivScript] Chrome runtime not available')
          resolve({ success: false, error: 'Chrome runtime not available' })
        }
      } catch (e) {
        console.error('[PixivScript] Failed to send message to background', e)
        resolve({ success: false, error: e.message })
      }
    })
  }

  async function sendEmojiToBackground(
    blob: Blob,
    emojiName: string,
    filename: string,
    originUrl?: string
  ) {
    try {
      const chromeAPI = (window as any).chrome

      if (!chromeAPI || !chromeAPI.runtime || !chromeAPI.runtime.sendMessage) {
        throw new Error('Chrome extension API not available')
      }

      const arrayBuffer = await blob.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)
      const arrayData = Array.from(uint8Array)

      const bgResp: any = await new Promise(resolve => {
        try {
          chromeAPI.runtime.sendMessage(
            {
              action: 'uploadAndAddEmoji',
              payload: {
                arrayData,
                filename,
                mimeType: blob.type,
                name: emojiName,
                originUrl: originUrl
              }
            },
            (r: any) => resolve(r)
          )
        } catch (e) {
          resolve({ success: false, error: 'Failed to send message to background' })
        }
      })

      if (bgResp && bgResp.success) {
        return {
          success: true,
          source: 'uploaded',
          url: bgResp.url,
          added: !!bgResp.added,
          message: '表情已成功添加到未分组'
        }
      } else {
        return {
          success: false,
          error: '后台处理失败',
          details: bgResp?.error || bgResp?.details
        }
      }
    } catch (error) {
      return {
        success: false,
        error: '发送数据到后台失败',
        details: error instanceof Error ? error.message : String(error)
      }
    }
  }

  async function performPixivAddEmojiFlow(data: { name: string; url: string }) {
    try {
      const baseName = data.name && data.name.length > 0 ? data.name : extractNameFromUrl(data.url)
      const filename = baseName.replace(/\.(webp|jpg|jpeg|png|gif)$/i, '').trim() || 'image'

      // Try canvas first for CORS images
      try {
        const canvasResult = await tryGetImageViaCanvas(data.url)
        if (canvasResult.success) {
          return await sendEmojiToBackground(canvasResult.blob, baseName, filename, data.url)
        }
      } catch (e) {
        console.warn('[PixivScript] Canvas method failed', e)
      }

      // Try fetch with pixiv headers
      try {
        const response = await fetch(data.url, {
          method: 'GET',
          headers: {
            Referer: 'https://www.pixiv.net/',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          },
          credentials: 'omit'
        })

        if (response.ok) {
          const blob = await response.blob()
          return await sendEmojiToBackground(blob, baseName, filename, data.url)
        }
      } catch (e) {
        console.warn('[PixivScript] Fetch failed', e)
      }

      // Fallback: open in new tab
      try {
        window.open(data.url, '_blank')
        return {
          success: true,
          source: 'opened',
          message: '已在新标签页打开图片，请在图片页面重试添加表情'
        }
      } catch (e) {
        return { success: false, error: '无法下载图片或打开图片页面', details: e }
      }
    } catch (error) {
      return { success: false, error: '添加表情失败', details: error }
    }
  }

  // ==== Button Creation ====
  function createPixivEmojiButton(data: { name: string; url: string }): HTMLElement {
    const btn = document.createElement('button')
    btn.className = 'emoji-add-link-pixiv'
    btn.type = 'button'
    btn.title = `添加 "${data.name}" 到未分组表情`
    btn.innerHTML = '➕'

    btn.style.cssText = `
    position: absolute;
    top: 8px;
    right: 8px;
    z-index: 10000;
    cursor: pointer;
    border-radius: 6px;
    padding: 6px 8px;
    background: rgba(0, 0, 0, 0.6);
    color: #fff;
    border: none;
    font-weight: 700;
    font-size: 14px;
    transition: all 0.2s ease;
    backdrop-filter: blur(4px);
  `

    btn.addEventListener('mouseenter', () => {
      btn.style.background = 'rgba(0, 150, 255, 0.8)'
    })

    btn.addEventListener('mouseleave', () => {
      btn.style.background = 'rgba(0, 0, 0, 0.6)'
    })

    btn.addEventListener('click', async e => {
      e.preventDefault()
      e.stopPropagation()

      const originalContent = btn.innerHTML
      const originalTitle = btn.title

      try {
        btn.innerHTML = '⏳'
        btn.title = '正在添加...'
        btn.style.background = 'rgba(100, 100, 100, 0.8)'

        const result = await performPixivAddEmojiFlow(data)

        if (result.success) {
          btn.innerHTML = '✅'
          btn.title = result.message || '添加成功'
          btn.style.background = 'rgba(34, 197, 94, 0.8)'
        } else {
          btn.innerHTML = '❌'
          btn.title = result.error || '添加失败'
          btn.style.background = 'rgba(239, 68, 68, 0.8)'
        }

        setTimeout(() => {
          btn.innerHTML = originalContent
          btn.title = originalTitle
          btn.style.background = 'rgba(0, 0, 0, 0.6)'
        }, 3000)
      } catch (error) {
        console.error('[PixivScript] Button click error', error)
        btn.innerHTML = '❌'
        btn.title = '添加失败'
        btn.style.background = 'rgba(239, 68, 68, 0.8)'

        setTimeout(() => {
          btn.innerHTML = originalContent
          btn.title = originalTitle
          btn.style.background = 'rgba(0, 0, 0, 0.6)'
        }, 3000)
      }
    })

    return btn
  }

  // ==== Content Processing ====
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

  function extractEmojiDataFromPixiv(container: Element): { name: string; url: string } | null {
    const img = container.querySelector('img[src*="i.pximg.net"]') as HTMLImageElement | null
    if (!img) return null

    let src = ''
    const anchor = img.closest('a') as HTMLAnchorElement | null
    if (anchor && anchor.href) {
      src = anchor.href
    } else if (img.src) {
      src = img.src
    }

    if (!src || !src.startsWith('http')) return null

    let name = (img?.alt || img?.getAttribute('title') || '')?.trim() || ''
    if (!name || name.length < 2) name = extractNameFromUrl(src)
    name = name.replace(/\.(webp|jpg|jpeg|png|gif)$/i, '').trim()
    if (name.length === 0) name = '表情'

    return { name, url: src }
  }

  function addEmojiButtonToPixiv(pixivContainer: Element) {
    if (!pixivContainer) return
    if (pixivContainer.querySelector('.emoji-add-link-pixiv')) return

    const emojiData = extractEmojiDataFromPixiv(pixivContainer)
    if (!emojiData) return

    const addButton = createPixivEmojiButton(emojiData)

    try {
      const parentEl = pixivContainer as HTMLElement
      const computed = window.getComputedStyle(parentEl)
      if (computed.position === 'static' || !computed.position) {
        parentEl.style.position = 'relative'
      }
    } catch (_e) {
      // ignore
    }

    pixivContainer.appendChild(addButton)
  }

  // ==== Scanning Functions ====
  function scanForPixivViewer() {
    const candidates = document.querySelectorAll('[role="presentation"]')
    candidates.forEach(c => {
      if (isPixivViewer(c)) addEmojiButtonToPixiv(c)
    })
  }

  function scanForImagePage() {
    const hostname = window.location.hostname.toLowerCase()
    if (!hostname.includes('i.pximg.net') && !hostname.includes('pximg.net')) {
      return
    }

    const images = document.querySelectorAll('img')

    for (const img of images) {
      if (img.parentElement?.querySelector('.emoji-add-link-pixiv')) {
        continue
      }

      if (img.src && (img.src.includes('i.pximg.net') || img.src.includes('pximg.net'))) {
        const imageUrl = img.src
        const imageName = extractNameFromUrl(imageUrl)

        const emojiData = {
          name: imageName,
          url: imageUrl
        }

        const button = createPixivEmojiButton(emojiData)

        const imgContainer = img.parentElement || document.body
        const computedStyle = window.getComputedStyle(imgContainer)
        if (computedStyle.position === 'static') {
          ;(imgContainer as HTMLElement).style.position = 'relative'
        }

        imgContainer.appendChild(button)
        break
      }
    }
  }

  // ==== DOM Observer ====
  function observePixivViewer() {
    const hostname = window.location.hostname.toLowerCase()
    const isImageDomain = hostname.includes('i.pximg.net') || hostname.includes('pximg.net')

    const observer = new MutationObserver(mutations => {
      let shouldScan = false

      mutations.forEach(m => {
        if (m.type === 'childList') {
          m.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const el = node as Element

              if (isImageDomain) {
                if (el.tagName === 'IMG' || (el.querySelector && el.querySelector('img'))) {
                  shouldScan = true
                }
              } else {
                if (el.getAttribute && el.getAttribute('role') === 'presentation') {
                  shouldScan = true
                } else if (el.querySelector && el.querySelector('img[src*="i.pximg.net"]')) {
                  shouldScan = true
                }
              }
            }
          })
        }
      })

      if (shouldScan) {
        setTimeout(() => {
          if (isImageDomain) {
            scanForImagePage()
          } else {
            scanForPixivViewer()
          }
        }, 120)
      }
    })

    observer.observe(document.body, { childList: true, subtree: true })
  }

  // ==== Main Initialization ====
  function initPixivScript() {
    try {
      console.log('[PixivScript] Initializing...')

      if (!isPixivPage()) {
        console.log('[PixivScript] Not a Pixiv page, skipping initialization')
        return
      }

      console.log('[PixivScript] Pixiv page detected, starting feature injection')

      const hostname = window.location.hostname.toLowerCase()
      const isImageDomain = hostname.includes('i.pximg.net') || hostname.includes('pximg.net')

      if (isImageDomain) {
        setTimeout(scanForImagePage, 100)
      } else {
        setTimeout(scanForPixivViewer, 100)
      }

      observePixivViewer()

      console.log('[PixivScript] Initialization complete')
    } catch (e) {
      console.error('[PixivScript] Initialization failed', e)
    }
  }

  // ==== Auto-injection Detection and Request ====
  function requestBackendInjection() {
    try {
      // This function can be used to notify the background script
      // that this autonomous script is ready and functional
      sendToBackground({
        type: 'AUTONOMOUS_SCRIPT_READY',
        platform: 'pixiv',
        url: window.location.href,
        timestamp: Date.now()
      })
    } catch (e) {
      console.error('[PixivScript] Failed to request backend injection', e)
    }
  }

  // ==== Entry Point ====
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPixivScript)
  } else {
    initPixivScript()
  }

  // Request backend injection
  requestBackendInjection()
})()
