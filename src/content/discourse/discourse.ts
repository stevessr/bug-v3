declare const chrome: any

interface AddEmojiButtonData {
  name: string
  url: string
}

function extractNameFromUrl(url: string): string {
  try {
    const urlObj = new URL(url)
    const pathname = urlObj.pathname
    const filename = pathname.split('/').pop() || ''
    const nameWithoutExt = filename.replace(/\.[^/.]+$/, '')
    const decoded = decodeURIComponent(nameWithoutExt)
    if (/^[0-9a-f]{8,}$/i.test(decoded) || decoded.length < 2) return '表情'
    return decoded || '表情'
  } catch {
    return '表情'
  }
}

function setupButtonClickHandler(button: HTMLElement, data: AddEmojiButtonData) {
  button.addEventListener('click', async e => {
    e.preventDefault()
    e.stopPropagation()
    const originalContent = button.innerHTML
    const originalStyle = button.style.cssText
    try {
      await chrome.runtime.sendMessage({ action: 'addEmojiFromWeb', emojiData: data })
      button.innerHTML = '已添加'
      button.style.background = 'linear-gradient(135deg, #10b981, #059669)'
      setTimeout(() => {
        button.innerHTML = originalContent
        button.style.cssText = originalStyle
      }, 2000)
    } catch (error) {
      console.error('[DiscourseOneClick] 添加表情失败:', error)
      button.innerHTML = '失败'
      button.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)'
      setTimeout(() => {
        button.innerHTML = originalContent
        button.style.cssText = originalStyle
      }, 2000)
    }
  })
}

// --- Magnific Popup ---
function isMagnificPopup(element: Element): boolean {
  return (
    element.classList &&
    element.classList.contains('mfp-wrap') &&
    element.classList.contains('mfp-gallery') &&
    element.querySelector('.mfp-img') !== null
  )
}

function extractEmojiDataFromMfp(
  imgElement: HTMLImageElement,
  titleContainer: Element
): AddEmojiButtonData | null {
  const src = imgElement.src
  if (!src || !src.startsWith('http')) return null
  let name = ''
  const titleText = titleContainer.textContent || ''
  const titleParts = titleText.split('·')
  if (titleParts.length > 0) name = titleParts[0].trim()
  if (!name || name.length < 2) name = imgElement.alt || imgElement.title || extractNameFromUrl(src)
  name = name.trim() || '表情'
  return { name, url: src }
}

function createMfpEmojiButton(data: AddEmojiButtonData): HTMLElement {
  const button = document.createElement('a')
  button.className = 'image-source-link emoji-add-link'
  button.style.cssText = `color:#fff;background:linear-gradient(135deg,#4f46e5,#7c3aed);border-radius:6px;padding:4px 8px;margin:0 2px;display:inline-flex;align-items:center;font-weight:600;`
  button.innerHTML = '添加表情'
  button.title = '添加到未分组表情'
  setupButtonClickHandler(button, data)
  return button
}

function addEmojiButtonToMfp(mfpContainer: Element) {
  if (mfpContainer.querySelector('.emoji-add-link')) return
  const imgElement = mfpContainer.querySelector('.mfp-img') as HTMLImageElement
  const titleContainer = mfpContainer.querySelector('.mfp-title')
  if (!imgElement || !titleContainer) return
  const emojiData = extractEmojiDataFromMfp(imgElement, titleContainer)
  if (!emojiData) return
  const addButton = createMfpEmojiButton(emojiData)
  const downloadLink = titleContainer.querySelector('a.image-source-link')
  if (downloadLink) {
    titleContainer.insertBefore(document.createTextNode(' · '), downloadLink)
    titleContainer.insertBefore(addButton, downloadLink)
  } else {
    titleContainer.appendChild(document.createTextNode(' · '))
    titleContainer.appendChild(addButton)
  }
}

function scanForMagnificPopup() {
  const mfpContainers = document.querySelectorAll('.mfp-wrap.mfp-gallery')
  mfpContainers.forEach(container => {
    if (isMagnificPopup(container)) addEmojiButtonToMfp(container)
  })
}

function observeMagnificPopup() {
  const observer = new MutationObserver(mutations => {
    let changed = false
    mutations.forEach(m => {
      if (m.type === 'childList') {
        m.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as Element
            if (el.classList && el.classList.contains('mfp-wrap')) changed = true
          }
        })
      }
    })
    if (changed) setTimeout(scanForMagnificPopup, 100)
  })
  observer.observe(document.body, { childList: true, subtree: true })
}

// --- Cooked content (Discourse) ---
function isCookedContent(element: Element): boolean {
  return element.classList.contains('cooked') && element.querySelector('.lightbox-wrapper') !== null
}

function extractEmojiDataFromLightbox(lightboxWrapper: Element): AddEmojiButtonData[] {
  const results: AddEmojiButtonData[] = []
  const anchor = lightboxWrapper.querySelector('a.lightbox') as HTMLAnchorElement | null
  const img = lightboxWrapper.querySelector('img') as HTMLImageElement | null
  if (!anchor || !img) return results
  const title = anchor.getAttribute('title') || ''
  const originalUrl = anchor.getAttribute('href') || ''
  const downloadUrl = anchor.getAttribute('data-download-href') || ''
  const imgSrc = img.getAttribute('src') || ''
  let name = title || img.getAttribute('alt') || ''
  if (!name || name.length < 2) name = extractNameFromUrl(originalUrl || downloadUrl || imgSrc)
  name = name.replace(/\.(webp|jpg|jpeg|png|gif)$/i, '').trim() || '表情'
  const urlToUse = originalUrl || downloadUrl || imgSrc
  if (urlToUse && urlToUse.startsWith('http')) results.push({ name, url: urlToUse })
  return results
}

function createBatchParseButton(cookedElement: Element): HTMLElement {
  const button = document.createElement('button')
  button.className = 'emoji-batch-parse-button'
  button.style.cssText =
    'display:inline-flex;align-items:center;gap:6px;background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff;border-radius:8px;padding:8px 12px;margin:10px 0;font-weight:600;'
  button.innerHTML = '一键解析并添加所有图片'
  button.title = '解析当前内容中的所有图片并添加到未分组表情'
  button.addEventListener('click', async e => {
    e.preventDefault()
    e.stopPropagation()
    const originalContent = button.innerHTML
    const originalStyle = button.style.cssText
    try {
      button.innerHTML = '正在解析...'
      button.style.background = 'linear-gradient(135deg,#6b7280,#4b5563)'
      button.disabled = true
      const lightboxWrappers = cookedElement.querySelectorAll('.lightbox-wrapper')
      const allEmojiData: AddEmojiButtonData[] = []
      lightboxWrappers.forEach(wrapper => {
        const items = extractEmojiDataFromLightbox(wrapper)
        allEmojiData.push(...items)
      })
      if (allEmojiData.length === 0) throw new Error('未找到可解析的图片')
      let successCount = 0
      for (const emojiData of allEmojiData) {
        try {
          await chrome.runtime.sendMessage({ action: 'addEmojiFromWeb', emojiData })
          successCount++
        } catch (e) {
          console.error('[DiscourseOneClick] 添加图片失败', emojiData.name, e)
        }
      }
      button.innerHTML = `已处理 ${successCount}/${allEmojiData.length} 张图片`
      button.style.background = 'linear-gradient(135deg,#10b981,#059669)'
      setTimeout(() => {
        button.innerHTML = originalContent
        button.style.cssText = originalStyle
        button.disabled = false
      }, 3000)
    } catch (error) {
      console.error('[DiscourseOneClick] 批量解析失败:', error)
      button.innerHTML = '解析失败'
      button.style.background = 'linear-gradient(135deg,#ef4444,#dc2626)'
      setTimeout(() => {
        button.innerHTML = originalContent
        button.style.cssText = originalStyle
        button.disabled = false
      }, 3000)
    }
  })
  return button
}

function addBatchParseButtonToCooked(cookedElement: Element) {
  if (cookedElement.querySelector('.emoji-batch-parse-button')) return
  const lightboxWrappers = cookedElement.querySelectorAll('.lightbox-wrapper')
  if (lightboxWrappers.length === 0) return
  const button = createBatchParseButton(cookedElement)
  const firstChild = cookedElement.firstChild
  if (firstChild) cookedElement.insertBefore(button, firstChild)
  else cookedElement.appendChild(button)
}

function scanForCookedContent() {
  const cookedElements = document.querySelectorAll('.cooked')
  cookedElements.forEach(el => {
    if (isCookedContent(el)) addBatchParseButtonToCooked(el)
  })
}

function observeCookedContent() {
  const observer = new MutationObserver(mutations => {
    let shouldScan = false
    mutations.forEach(m => {
      if (m.type === 'childList') {
        m.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element
            if (element.classList && element.classList.contains('cooked')) shouldScan = true
            else if (element.querySelector && element.querySelector('.cooked')) shouldScan = true
          }
        })
      }
    })
    if (shouldScan) setTimeout(scanForCookedContent, 100)
  })
  observer.observe(document.body, { childList: true, subtree: true })
}

/**
 * 判断当前页面是否为 Discourse（通过显式 meta 标签检测）
 */
function isDiscoursePage(): boolean {
  try {
    // meta generator 中通常含有 Discourse
    const gen = document.querySelector('meta[name="generator"]')?.getAttribute('content') || ''
    if (gen.toLowerCase().includes('discourse')) return true

    // 存在以 discourse_ 开头的 meta 名称
    if (document.querySelector('meta[name^="discourse_"]')) return true

    // 某些站点会在 head 中放置 data-discourse-setup 的 meta（示例中有 id）
    if (document.getElementById('data-discourse-setup')) return true

    // 额外检测：discourse/config/environment
    if (document.querySelector('meta[name="discourse/config/environment"]')) return true

    return false
  } catch (e) {
    console.error('[DiscourseOneClick] isDiscoursePage check failed', e)
    return false
  }
}

function initDiscourse() {
  try {
    if (!isDiscoursePage()) {
      console.log('[DiscourseOneClick] skipping init: not a Discourse page')
      return
    }

    setTimeout(scanForMagnificPopup, 200)
    setTimeout(scanForCookedContent, 300)
    observeMagnificPopup()
    observeCookedContent()
    // save-last-discourse injection removed — no-op to avoid injecting UI into Discourse pages
  } catch (e) {
    console.error('[DiscourseOneClick] init failed', e)
  }
}
// 挂到 window 供 content wrapper 调用
; (window as any).__emoji_discourse_init = initDiscourse

// Listen for background messages instructing to upload a blob to Discourse
if ((window as any).chrome?.runtime?.onMessage) {
  ; (window as any).chrome.runtime.onMessage.addListener(async (message: any, _sender: any) => {
    if (message && message.action === 'uploadBlobToDiscourse') {
      try {
        const filename = message.filename || 'image.jpg'
        const mimeType = message.mimeType || 'image/jpeg'
        const arrayBuffer = message.arrayBuffer

        if (!arrayBuffer) throw new Error('no arrayBuffer')

        const blob = new Blob([new Uint8Array(arrayBuffer)], { type: mimeType })
        const file = new File([blob], filename, { type: mimeType })

        // Build form and upload to current discourse host or provided discourseBase
        const base = message.discourseBase || window.location.origin
        const form = new FormData()
        form.append('upload_type', 'composer')
        form.append('relativePath', 'null')
        form.append('name', file.name)
        form.append('type', file.type)
        form.append('file', file, file.name)

        // CSRF token
        const meta = document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement | null
        const csrf = meta
          ? meta.content
          : (document.cookie.match(/csrf_token=([^;]+)/) || [])[1] || ''

        const headers: Record<string, string> = {}
        if (csrf) headers['X-Csrf-Token'] = csrf
        if (document.cookie) headers['Cookie'] = document.cookie

        const uploadUrl = `${base.replace(/\/$/, '')}/uploads.json?client_id=f06cb5577ba9410d94b9faf94e48c2d8`
        const resp = await fetch(uploadUrl, {
          method: 'POST',
          headers,
          body: form,
          credentials: 'include'
        })
        if (!resp.ok) {
          const data = await resp.json().catch(() => null)
            ; (window as any).chrome.runtime.sendMessage({
              type: 'UPLOAD_RESULT',
              success: false,
              details: data
            })
        } else {
          const data = await resp.json()
            ; (window as any).chrome.runtime.sendMessage({
              type: 'UPLOAD_RESULT',
              success: true,
              data
            })
        }
      } catch (e) {
        ; (window as any).chrome.runtime.sendMessage({
          type: 'UPLOAD_RESULT',
          success: false,
          error: String(e)
        })
      }
    }
  })
}
