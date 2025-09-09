import { logger } from '../config/buildFLagsV2'

declare const chrome: any

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

async function performPixivAddEmojiFlow(data: AddEmojiButtonData) {
  // New flow: download emoji -> send binary to background -> upload to linux.do -> add emoji
  try {
    const baseName = data.name && data.name.length > 0 ? data.name : extractNameFromUrl(data.url)
    const filename = baseName.replace(/\.(webp|jpg|jpeg|png|gif)$/i, '').trim() || 'image'

    const chromeAPI = (window as any).chrome

    logger.log('[PixivAddEmoji] Starting add emoji flow for:', { name: baseName, url: data.url })

    // Step 1: Try to download image using canvas (primary method)
    try {
      const canvasResult = await tryGetImageViaCanvas(data.url)
      if (canvasResult.success) {
        logger.log('[PixivAddEmoji] Canvas download successful, sending to background')
        return await sendEmojiToBackground(canvasResult.blob, baseName, filename)
      }
    } catch (e) {
      logger.warn('[PixivAddEmoji] Canvas method failed:', e)
    }

    // Step 2: If canvas fails, try background download as fallback
    try {
      if (chromeAPI && chromeAPI.runtime && chromeAPI.runtime.sendMessage) {
        logger.log('[PixivAddEmoji] Trying background download as fallback')
        const bgResp: any = await new Promise(resolve => {
          try {
            chromeAPI.runtime.sendMessage(
              {
                action: 'downloadForUser',
                payload: {
                  url: data.url,
                  filename,
                  directDownload: false // We want the arrayBuffer, not file download
                }
              },
              (r: any) => resolve(r)
            )
          } catch (e) {
            resolve(null)
          }
        })

        if (bgResp && bgResp.success && bgResp.fallback && bgResp.arrayBuffer) {
          const arrayBuffer = bgResp.arrayBuffer as ArrayBuffer
          const mimeType = bgResp.mimeType || 'application/octet-stream'
          const blob = new Blob([new Uint8Array(arrayBuffer)], { type: mimeType })
          logger.log('[PixivAddEmoji] Background download successful, sending emoji to background')
          return await sendEmojiToBackground(blob, baseName, filename)
        }
      }
    } catch (e) {
      logger.warn('[PixivAddEmoji] Background download failed:', e)
    }

    // Step 3: Final fallback - open image URL and inject download there
    logger.log('[PixivAddEmoji] Direct methods failed, opening image URL for injection')
    try {
      window.open(data.url, '_blank')
      // TODO: We could inject a content script into the opened tab to try downloading there
      return {
        success: true,
        source: 'opened',
        message: '已在新标签页打开图片，请在图片页面重试添加表情'
      }
    } catch (e) {
      logger.error('[PixivAddEmoji] Failed to open image URL:', e)
      return { success: false, error: '无法下载图片或打开图片页面', details: e }
    }
  } catch (error) {
    logger.error('[PixivAddEmoji] Add emoji flow failed:', error)
    return { success: false, error: '添加表情失败', details: error }
  }
}

async function sendEmojiToBackground(blob: Blob, emojiName: string, filename: string) {
  try {
    const arrayBuffer = await blob.arrayBuffer()
    const chromeAPI = (window as any).chrome

    if (!chromeAPI || !chromeAPI.runtime || !chromeAPI.runtime.sendMessage) {
      throw new Error('Chrome extension API not available')
    }

    logger.log('[PixivAddEmoji] Sending emoji to background:', {
      name: emojiName,
      filename,
      size: arrayBuffer.byteLength,
      type: blob.type
    })

    const bgResp: any = await new Promise(resolve => {
      try {
        chromeAPI.runtime.sendMessage(
          {
            action: 'uploadAndAddEmoji',
            payload: {
              arrayBuffer,
              filename,
              mimeType: blob.type,
              name: emojiName
            }
          },
          (r: any) => resolve(r)
        )
      } catch (e) {
        resolve({ success: false, error: 'Failed to send message to background' })
      }
    })

    if (bgResp && bgResp.success) {
      logger.log('[PixivAddEmoji] Emoji successfully added:', bgResp)
      return {
        success: true,
        source: 'uploaded',
        url: bgResp.url,
        added: !!bgResp.added,
        message: '表情已成功添加到未分组'
      }
    } else {
      logger.error('[PixivAddEmoji] Background upload failed:', JSON.stringify(bgResp, null, 2))
      return {
        success: false,
        error: '上传到linux.do失败',
        details: bgResp?.error || bgResp?.details
      }
    }
  } catch (error) {
    logger.error('[PixivAddEmoji] Failed to send emoji to background:', error)
    return {
      success: false,
      error: '发送数据到后台失败',
      details: error
    }
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

    // Show loading state
    button.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style="animation: spin 1s linear infinite;">
        <style>
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        </style>
        <path d="M12,4V2A10,10 0 0,0 2,12H4A8,8 0 0,1 12,4Z"/>
      </svg>
      添加中...
    `
    button.style.background = 'linear-gradient(135deg, #f59e0b, #d97706)'

    try {
      const resp = await performPixivAddEmojiFlow(data)

      if (resp && resp.success) {
        logger.log('[PixivAddEmoji] Successfully added emoji:', resp)

        // Show success state
        button.innerHTML = `
          <svg class="fa d-icon d-icon-check svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width: 1em; height: 1em; fill: currentColor; margin-right: 4px;">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
          </svg>已添加
        `
        button.style.background = 'linear-gradient(135deg, #10b981, #059669)'
        button.style.color = '#ffffff'
        button.style.border = '2px solid #ffffff'
        button.style.boxShadow = '0 2px 4px rgba(16, 185, 129, 0.3)'

        // If it was just opened in new tab, show different message
        if (resp.source === 'opened') {
          button.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M14,3V5H17.59L7.76,14.83L9.17,16.24L19,6.41V10H21V3M19,19H5V5H12V3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V12H19V19Z"/>
            </svg>已打开
          `
          button.style.background = 'linear-gradient(135deg, #3b82f6, #2563eb)'
        }
      } else {
        // Handle different types of failures
        const errorMessage =
          typeof resp === 'object' && resp !== null
            ? (resp as any).error || (resp as any).message || '添加表情失败'
            : '添加表情失败'
        throw new Error(String(errorMessage))
      }

      setTimeout(() => {
        button.innerHTML = originalContent
        button.style.cssText = originalStyle
        button.style.pointerEvents = prevPointerEvents
        running = false
      }, 3000)
    } catch (error) {
      logger.error('[PixivAddEmoji] 添加表情失败:', error)

      // Show error state
      button.innerHTML = `
        <svg class="fa d-icon d-icon-times svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width: 1em; height: 1em; fill: currentColor; margin-right: 4px;">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
        </svg>失败
      `
      button.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)'
      button.style.color = '#ffffff'
      button.style.border = '2px solid #ffffff'
      button.style.boxShadow = '0 2px 4px rgba(239, 68, 68, 0.3)'

      setTimeout(() => {
        button.innerHTML = originalContent
        button.style.cssText = originalStyle
        button.style.pointerEvents = prevPointerEvents
        running = false
      }, 3000)
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
    background: linear-gradient(135deg, #8b5cf6, #7c3aed);
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
  button.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
    </svg>
    添加表情
  `
  button.title = '添加表情到收藏'
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

function scanForImagePage() {
  // Special handling for i.pximg.net image pages
  const hostname = window.location.hostname.toLowerCase()
  if (!hostname.includes('i.pximg.net') && !hostname.includes('pximg.net')) {
    return
  }

  logger.log('[PixivAddEmoji] Scanning image page:', window.location.href)

  // Look for the main image on the page
  const images = document.querySelectorAll('img')

  for (const img of images) {
    // Skip if already has button
    if (img.parentElement?.querySelector('.emoji-add-link-pixiv')) {
      continue
    }

    // Check if this is likely the main image
    if (img.src && (img.src.includes('i.pximg.net') || img.src.includes('pximg.net'))) {
      // Extract image info
      const imageUrl = img.src
      const imageName = extractNameFromUrl(imageUrl)

      logger.log('[PixivAddEmoji] Found image on image page:', { url: imageUrl, name: imageName })

      // Create emoji data
      const emojiData: AddEmojiButtonData = {
        name: imageName,
        url: imageUrl
      }

      // Create and add button
      const button = createPixivEmojiButton(emojiData)

      // Position button relative to the image
      const imgContainer = img.parentElement || document.body
      const computedStyle = window.getComputedStyle(imgContainer)
      if (computedStyle.position === 'static') {
        ;(imgContainer as HTMLElement).style.position = 'relative'
      }

      imgContainer.appendChild(button)

      logger.log('[PixivAddEmoji] Added button to image page')
      break // Only add button to the first suitable image
    }
  }
}

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
              // For image domains, look for new images
              if (el.tagName === 'IMG' || (el.querySelector && el.querySelector('img'))) {
                shouldScan = true
              }
            } else {
              // For main Pixiv site, look for presentation elements
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

export function initPixiv() {
  // 初始扫描与观察器（仅当页面为 Pixiv 时）
  try {
    if (!isPixivPage()) {
      logger.log('[PixivAddEmoji] skipping init: not a Pixiv page')
      return
    }

    const hostname = window.location.hostname.toLowerCase()
    const isImageDomain = hostname.includes('i.pximg.net') || hostname.includes('pximg.net')

    if (isImageDomain) {
      // For image pages, scan immediately and set up observation
      setTimeout(scanForImagePage, 100)
    } else {
      // For main Pixiv site, use the standard viewer scanning
      setTimeout(scanForPixivViewer, 100)
    }

    observePixivViewer()
  } catch (e) {
    logger.error('[PixivAddEmoji] init failed', e)
  }
}

/**
 * 判断当前页面是否为 Pixiv 相关页面：
 * - pixiv.net 主站
 * - i.pximg.net 图片域名
 * - meta 标签包含 pixiv 信息
 */
function isPixivPage(): boolean {
  try {
    const hostname = window.location.hostname.toLowerCase()

    // Check if it's the image domain
    if (hostname.includes('i.pximg.net') || hostname.includes('pximg.net')) {
      logger.log('[PixivAddEmoji] Detected Pixiv image domain:', hostname)
      return true
    }

    // Check if it's the main Pixiv site
    if (hostname.includes('pixiv.net')) {
      logger.log('[PixivAddEmoji] Detected Pixiv main site:', hostname)
      return true
    }

    // Only inspect meta tags in <head> for other domains
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
    logger.error('[PixivAddEmoji] isPixivPage check failed', e)
    return false
  }
}
