// One-click add functionality for image lightboxes and cooked content
import { addEmojiToUserscript } from '../userscript-storage'
import { createEl } from '../utils/createEl'

// Extract emoji data from image
function extractEmojiFromImage(img: HTMLImageElement, titleElement: HTMLElement) {
  const url = img.src
  if (!url || !url.startsWith('http')) return null

  let name = ''
  const titleText = titleElement.textContent || ''
  const parts = titleText.split('·')
  if (parts.length > 0) {
    name = parts[0].trim()
  }

  if (!name || name.length < 2) {
    name = img.alt || img.title || extractNameFromUrl(url)
  }

  name = name.trim()
  if (name.length === 0) {
    name = '表情'
  }

  return { name, url }
}

// Extract emoji data from lightbox wrapper (for batch processing)
function extractEmojiDataFromLightboxWrapper(lightboxWrapper: Element): Array<{
  name: string
  url: string
}> {
  const results: Array<{ name: string; url: string }> = []
  const anchor = lightboxWrapper.querySelector('a.lightbox') as HTMLAnchorElement | null
  const img = lightboxWrapper.querySelector('img') as HTMLImageElement | null

  if (!anchor || !img) return results

  const title = anchor.getAttribute('title') || ''
  const originalUrl = anchor.getAttribute('href') || ''
  const downloadUrl = anchor.getAttribute('data-download-href') || ''
  const imgSrc = img.getAttribute('src') || ''

  let name = title || img.getAttribute('alt') || ''
  if (!name || name.length < 2) {
    name = extractNameFromUrl(originalUrl || downloadUrl || imgSrc)
  }

  name = name.replace(/\\.(webp|jpg|jpeg|png|gif)$/i, '').trim() || '表情'

  const urlToUse = originalUrl || downloadUrl || imgSrc
  if (urlToUse && urlToUse.startsWith('http')) {
    results.push({ name, url: urlToUse })
  }

  return results
}

// Extract name from URL
function extractNameFromUrl(url: string): string {
  try {
    const filename = new URL(url).pathname.split('/').pop() || ''
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

// Create add button
function createAddButton(emojiData: { name: string; url: string }) {
  const link = createEl('a', {
    className: 'image-source-link emoji-add-link',
    style: `
    color: #ffffff;
    text-decoration: none;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    font-size: inherit;
    font-family: inherit;
    background: linear-gradient(135deg, #4f46e5, #7c3aed);
    border: 2px solid #ffffff;
    border-radius: 6px;
    padding: 4px 8px;
    margin: 0 2px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    transition: all 0.2s ease;
    font-weight: 600;
  `
  }) as HTMLAnchorElement

  link.addEventListener('mouseenter', () => {
    if (!link.innerHTML.includes('已添加') && !link.innerHTML.includes('失败')) {
      link.style.background = 'linear-gradient(135deg, #3730a3, #5b21b6)'
      link.style.transform = 'scale(1.05)'
      link.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.3)'
    }
  })

  link.addEventListener('mouseleave', () => {
    if (!link.innerHTML.includes('已添加') && !link.innerHTML.includes('失败')) {
      link.style.background = 'linear-gradient(135deg, #4f46e5, #7c3aed)'
      link.style.transform = 'scale(1)'
      link.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.2)'
    }
  })

  link.innerHTML = `
    <svg class="fa d-icon d-icon-plus svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width: 1em; height: 1em; fill: currentColor; margin-right: 4px;">
      <path d="M12 4c.55 0 1 .45 1 1v6h6c.55 0 1 .45 1 1s-.45 1-1 1h-6v6c0 .55-.45 1-1 1s-1-.45-1-1v-6H5c-.55 0-1-.45-1-1s.45-1 1-1h6V5c0-.55.45-1 1-1z"/>
    </svg>添加表情
  `
  link.title = '添加到用户表情'

  link.addEventListener('click', async e => {
    e.preventDefault()
    e.stopPropagation()

    const originalHTML = link.innerHTML
    const originalStyle = link.style.cssText

    try {
      addEmojiToUserscript(emojiData)

      link.innerHTML = `
        <svg class="fa d-icon d-icon-check svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width: 1em; height: 1em; fill: currentColor; margin-right: 4px;">
          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
        </svg>已添加
      `
      link.style.background = 'linear-gradient(135deg, #10b981, #059669)'
      link.style.color = '#ffffff'
      link.style.border = '2px solid #ffffff'
      link.style.boxShadow = '0 2px 4px rgba(16, 185, 129, 0.3)'

      setTimeout(() => {
        link.innerHTML = originalHTML
        link.style.cssText = originalStyle
      }, 2000)
    } catch (error) {
      console.error('[Emoji Extension Userscript] Failed to add emoji:', error)

      link.innerHTML = `
        <svg class="fa d-icon d-icon-times svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width: 1em; height: 1em; fill: currentColor; margin-right: 4px;">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
        </svg>失败
      `
      link.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)'
      link.style.color = '#ffffff'
      link.style.border = '2px solid #ffffff'
      link.style.boxShadow = '0 2px 4px rgba(239, 68, 68, 0.3)'

      setTimeout(() => {
        link.innerHTML = originalHTML
        link.style.cssText = originalStyle
      }, 2000)
    }
  })

  return link
}

// Process lightbox
function processLightbox(lightbox: HTMLElement) {
  if (lightbox.querySelector('.emoji-add-link')) return

  const img = lightbox.querySelector('.mfp-img') as HTMLImageElement | null
  const title = lightbox.querySelector('.mfp-title') as HTMLElement | null

  if (!img || !title) return

  const emojiData = extractEmojiFromImage(img, title)
  if (!emojiData) return

  const addButton = createAddButton(emojiData)
  const sourceLink = title.querySelector('a.image-source-link')

  if (sourceLink) {
    const separator = document.createTextNode(' · ')
    title.insertBefore(separator, sourceLink)
    title.insertBefore(addButton, sourceLink)
  } else {
    title.appendChild(document.createTextNode(' · '))
    title.appendChild(addButton)
  }
}

// Process all lightboxes
function processAllLightboxes() {
  document.querySelectorAll('.mfp-wrap.mfp-gallery').forEach(lightbox => {
    if (
      lightbox.classList.contains('mfp-wrap') &&
      lightbox.classList.contains('mfp-gallery') &&
      lightbox.querySelector('.mfp-img')
    ) {
      processLightbox(lightbox as HTMLElement)
    }
  })
}

// Initialize one-click add functionality
export function initOneClickAdd() {
  console.log('[Emoji Extension Userscript] Initializing one-click add functionality')

  // Initial processing
  setTimeout(processAllLightboxes, 500)

  // Watch for new lightboxes
  const observer = new MutationObserver(mutations => {
    let hasNewLightbox = false
    mutations.forEach(mutation => {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as HTMLElement
            if (element.classList && element.classList.contains('mfp-wrap')) {
              hasNewLightbox = true
            }
          }
        })
      }
    })

    if (hasNewLightbox) {
      setTimeout(processAllLightboxes, 100)
    }
  })

  observer.observe(document.body, { childList: true, subtree: true })

  // Also check when page becomes visible (for tab switching)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      setTimeout(processAllLightboxes, 200)
    }
  })

  // Initialize batch parse buttons for cooked content
  initBatchParseButtons()
}

// Create batch parse button for cooked content
function createBatchParseButton(cookedElement: Element): HTMLElement {
  const button = createEl('button', {
    className: 'emoji-batch-parse-button',
    style: `
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: linear-gradient(135deg, #f59e0b, #d97706);
      color: #fff;
      border-radius: 8px;
      padding: 8px 12px;
      margin: 10px 0;
      font-weight: 600;
      cursor: pointer;
      border: none;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
      transition: all 0.2s ease;
    `
  }) as HTMLButtonElement

  button.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width: 1em; height: 1em; fill: currentColor;">
      <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
    </svg>
    一键解析并添加所有图片
  `
  button.title = '解析当前内容中的所有图片并添加到用户表情'

  button.addEventListener('mouseenter', () => {
    if (!button.disabled) {
      button.style.background = 'linear-gradient(135deg, #d97706, #b45309)'
      button.style.transform = 'scale(1.02)'
    }
  })

  button.addEventListener('mouseleave', () => {
    if (!button.disabled && !button.innerHTML.includes('已处理')) {
      button.style.background = 'linear-gradient(135deg, #f59e0b, #d97706)'
      button.style.transform = 'scale(1)'
    }
  })

  button.addEventListener('click', async e => {
    e.preventDefault()
    e.stopPropagation()

    const originalHTML = button.innerHTML
    const originalStyle = button.style.cssText

    try {
      button.innerHTML = '正在解析...'
      button.style.background = 'linear-gradient(135deg, #6b7280, #4b5563)'
      button.disabled = true

      const lightboxWrappers = cookedElement.querySelectorAll('.lightbox-wrapper')
      const allEmojiData: Array<{ name: string; url: string }> = []

      lightboxWrappers.forEach(wrapper => {
        const items = extractEmojiDataFromLightboxWrapper(wrapper)
        allEmojiData.push(...items)
      })

      if (allEmojiData.length === 0) {
        throw new Error('未找到可解析的图片')
      }

      let successCount = 0
      for (const emojiData of allEmojiData) {
        try {
          addEmojiToUserscript(emojiData)
          successCount++
        } catch (e) {
          console.error('[Userscript OneClick] 添加图片失败', emojiData.name, e)
        }
      }

      button.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width: 1em; height: 1em; fill: currentColor;">
          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
        </svg>
        已处理 ${successCount}/${allEmojiData.length} 张图片
      `
      button.style.background = 'linear-gradient(135deg, #10b981, #059669)'

      setTimeout(() => {
        button.innerHTML = originalHTML
        button.style.cssText = originalStyle
        button.disabled = false
      }, 3000)
    } catch (error) {
      console.error('[Userscript OneClick] Batch parse failed:', error)

      button.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width: 1em; height: 1em; fill: currentColor;">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
        </svg>
        解析失败
      `
      button.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)'

      setTimeout(() => {
        button.innerHTML = originalHTML
        button.style.cssText = originalStyle
        button.disabled = false
      }, 3000)
    }
  })

  return button
}

// Process cooked content elements
function processCookedContent(cookedElement: Element) {
  // Skip if already processed or no lightbox-wrapper
  if (cookedElement.querySelector('.emoji-batch-parse-button')) return
  if (!cookedElement.querySelector('.lightbox-wrapper')) return

  const batchButton = createBatchParseButton(cookedElement)

  // Insert button at the beginning of cooked content
  cookedElement.insertBefore(batchButton, cookedElement.firstChild)
}

// Scan and process all cooked content
function processCookedContents() {
  document.querySelectorAll('.cooked').forEach(element => {
    if (element.classList.contains('cooked') && element.querySelector('.lightbox-wrapper')) {
      processCookedContent(element)
    }
  })
}

// Initialize batch parse buttons
function initBatchParseButtons() {
  // Initial processing
  setTimeout(processCookedContents, 500)

  // Watch for new cooked content
  const observer = new MutationObserver(mutations => {
    let hasNewCooked = false
    mutations.forEach(mutation => {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as HTMLElement
            if (element.classList && element.classList.contains('cooked')) {
              hasNewCooked = true
            }
            // Also check descendants
            if (element.querySelectorAll && element.querySelectorAll('.cooked').length > 0) {
              hasNewCooked = true
            }
          }
        })
      }
    })

    if (hasNewCooked) {
      setTimeout(processCookedContents, 100)
    }
  })

  observer.observe(document.body, { childList: true, subtree: true })
}
