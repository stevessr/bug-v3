// Userscript module: Add "Add Emoji" button into Discourse PhotoSwipe top bar (pswp__top-bar)
// Mirrors extension version in src/content/discourse/utils/magnific-popup.ts but adapted for userscript storage

import { createEl } from '../utils/createEl'
import { loadDataFromLocalStorage, saveDataToLocalStorage } from '../userscript-storage'

type EmojiData = { name: string; url: string }

function extractNameFromUrl(url: string): string {
  try {
    const filename = new URL(url).pathname.split('/').pop() || ''
    const nameWithoutExt = filename.replace(/\.[^/.]+$/, '')
    const decoded = decodeURIComponent(nameWithoutExt)
    if (/^[0-9a-f]{8,}$/i.test(decoded) || decoded.length < 2) return '表情'
    return decoded || '表情'
  } catch {
    return '表情'
  }
}

function createAddButton(data: EmojiData): HTMLAnchorElement {
  const button = createEl('a', {
    className: 'emoji-add-link',
    style: `
      color:#fff;
      border-radius:6px;
      padding:4px 8px;
      margin:0 2px;
      display:inline-flex;
      align-items:center;
      font-weight:600;
      text-decoration:none;
      border: 1px solid rgba(255,255,255,0.7);
      cursor: pointer;
    `,
    title: '添加到未分组表情'
  }) as HTMLAnchorElement

  button.innerHTML = `添加表情`

  function addToUngrouped(emoji: EmojiData) {
    const data = loadDataFromLocalStorage()
    let group = data.emojiGroups.find((g: any) => g.id === 'ungrouped')
    if (!group) {
      group = {
        id: 'ungrouped',
        name: '未分组',
        icon: '📦',
        order: 999,
        emojis: []
      }
      data.emojiGroups.push(group)
    }
    const exists = group.emojis.some((e: any) => e.url === emoji.url || e.name === emoji.name)
    if (!exists) {
      group.emojis.push({ packet: Date.now(), name: emoji.name, url: emoji.url })
      saveDataToLocalStorage({ emojiGroups: data.emojiGroups })
    }
  }

  button.addEventListener('click', e => {
    e.preventDefault()
    e.stopPropagation()
    try {
      addToUngrouped({ name: data.name, url: data.url })
      // brief visual feedback
      const original = button.textContent || ''
      button.textContent = '已添加'
      button.style.background = 'linear-gradient(135deg,#10b981,#059669)'
      setTimeout(() => {
        button.textContent = original || '添加表情'
        button.style.background = ''
      }, 1500)
    } catch (err) {
      console.warn('[Userscript] add emoji failed', err)
      const original = button.textContent || ''
      button.textContent = '失败'
      button.style.background = 'linear-gradient(135deg,#ef4444,#dc2626)'
      setTimeout(() => {
        button.textContent = original || '添加表情'
        button.style.background = 'linear-gradient(135deg, #4f46e5, #7c3aed)'
      }, 1500)
    }
  })

  return button
}

function addEmojiButtonToPswp(container: Element) {
  // Only handle pswp__top-bar structure
  const topBar =
    (container.querySelector('.pswp__top-bar') as Element | null) ||
    (container.classList.contains('pswp__top-bar') ? container : null)
  if (!topBar) return
  if (topBar.querySelector('.emoji-add-link')) return

  const originalBtn = topBar.querySelector(
    '.pswp__button--original-image'
  ) as HTMLAnchorElement | null
  const downloadBtn = topBar.querySelector(
    '.pswp__button--download-image'
  ) as HTMLAnchorElement | null

  let imgUrl = ''
  if (originalBtn?.href) imgUrl = originalBtn.href
  else if (downloadBtn?.href) imgUrl = downloadBtn.href
  if (!imgUrl) return

  // Prefer caption title
  let name = ''
  const captionTitle = document.querySelector('.pswp__caption-title')
  if (captionTitle?.textContent?.trim()) name = captionTitle.textContent.trim()

  // Fallbacks: button title or derive from URL
  if (!name) {
    if (originalBtn?.title) name = originalBtn.title
    else if (downloadBtn?.title) name = downloadBtn.title
  }
  if (!name || name.length < 2) name = extractNameFromUrl(imgUrl)
  name = name.trim() || '表情'

  const addButton = createAddButton({ name, url: imgUrl })

  if (downloadBtn?.parentElement)
    downloadBtn.parentElement.insertBefore(addButton, downloadBtn.nextSibling)
  else topBar.appendChild(addButton)
}

export function scanForPhotoSwipeTopBar() {
  const topBars = document.querySelectorAll('.pswp__top-bar')
  topBars.forEach(topBar => addEmojiButtonToPswp(topBar))
}

export function observePhotoSwipeTopBar(): MutationObserver {
  // initial scan
  scanForPhotoSwipeTopBar()

  function debounce<T extends (...args: any[]) => void>(fn: T, wait = 100) {
    let timer: number | null = null
    return (...args: Parameters<T>) => {
      if (timer !== null) window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        timer = null
        fn(...args)
      }, wait)
    }
  }

  const debouncedScan = debounce(scanForPhotoSwipeTopBar, 100)

  const observer = new MutationObserver(mutations => {
    for (const m of mutations) {
      if (m.type === 'childList' && (m.addedNodes.length > 0 || m.removedNodes.length > 0)) {
        debouncedScan()
        return
      }
      if (m.type === 'attributes') {
        debouncedScan()
        return
      }
    }
  })

  observer.observe(document.body, { childList: true, subtree: true, attributes: false })
  return observer
}

export function initPhotoSwipeTopbarUserscript() {
  scanForPhotoSwipeTopBar()
  observePhotoSwipeTopBar()
}
