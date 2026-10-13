import { DOA, DQSA, createE } from '../../utils/dom/createEl'

import { getXVideoContext } from './videoMetadata'

const COPY_ICON =
  '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>'
const DOWNLOAD_ICON =
  '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M5 20h14v-2H5v2zM11 2v10.17L7.41 8.59 6 10l6 6 6-6-1.41-1.41L13 12.17V2h-2z"/></svg>'
const CHECK_ICON =
  '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m9 16.17-3.88-3.88-1.41 1.42L9 19 21 7l-1.41-1.41z"/></svg>'
const ERROR_ICON =
  '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>'

let videoActionStylesInjected = false

function injectVideoActionStyles() {
  if (videoActionStylesInjected || document.getElementById('x-video-action-styles')) return
  const style = createE('style', {
    id: 'x-video-action-styles',
    text: `
      .x-video-action-host { position: relative !important; }
      .x-video-action-toolbar {
        position: absolute; top: 8px; right: 8px; z-index: 99999;
        display: flex; gap: 6px; opacity: 0; visibility: hidden;
        transform: translateY(-4px); transition: opacity 140ms ease, transform 140ms ease, visibility 140ms;
        pointer-events: none;
      }
      .x-video-action-host:hover .x-video-action-toolbar,
      .x-video-action-host:focus-within .x-video-action-toolbar {
        opacity: 1; visibility: visible; transform: translateY(0); pointer-events: auto;
      }
      .x-video-action-button {
        display: grid; place-items: center; width: 36px; height: 36px; padding: 0;
        border: 0; border-radius: 999px; color: #fff; background: rgba(15, 20, 25, .82);
        box-shadow: 0 1px 4px rgba(0,0,0,.28); cursor: pointer; opacity: .86;
        transition: opacity 120ms ease, background-color 120ms ease, transform 120ms ease;
      }
      .x-video-action-button:hover, .x-video-action-button:focus-visible {
        opacity: 1; background: rgba(15, 20, 25, .96); transform: scale(1.06);
      }
      .x-video-action-button:focus-visible, .x-video-inline-action:focus-visible {
        outline: 2px solid #1d9bf0; outline-offset: 2px;
      }
      .x-video-action-button svg { width: 18px; height: 18px; fill: currentColor; }
      .x-video-action-button[data-state="success"] { color: #00ba7c; }
      .x-video-action-button[data-state="error"] { color: #f4212e; }
      .x-video-inline-action {
        display: inline-grid; place-items: center; vertical-align: middle; width: 30px; height: 30px;
        margin-left: 6px; padding: 0; border: 0; border-radius: 999px; color: #fff;
        background: rgba(15, 20, 25, .78); cursor: pointer; opacity: 0; visibility: hidden;
        transition: opacity 140ms ease, visibility 140ms;
      }
      .x-video-inline-action-host:hover > .x-video-inline-action,
      .x-video-inline-action-host:focus-within > .x-video-inline-action { opacity: 1; visibility: visible; }
      .x-video-inline-action svg { width: 16px; height: 16px; fill: currentColor; }
      @media (hover: none) {
        .x-video-action-toolbar { opacity: 1; visibility: visible; transform: none; pointer-events: auto; }
        .x-video-inline-action { opacity: 1; visibility: visible; }
      }
      @media (prefers-reduced-motion: reduce) {
        .x-video-action-toolbar, .x-video-action-button, .x-video-inline-action { transition: none; }
      }
    `
  })
  DOA(style)
  videoActionStylesInjected = true
}

function setButtonState(btn: HTMLElement, state: 'success' | 'error' | '') {
  btn.dataset.state = state
  if (state === 'success') {
    btn.innerHTML = CHECK_ICON
    btn.title = '操作成功'
    btn.setAttribute('aria-label', '操作成功')
  } else if (state === 'error') {
    btn.innerHTML = ERROR_ICON
    btn.title = '操作失败'
    btn.setAttribute('aria-label', '操作失败')
  }
}

function resetButtonState(btn: HTMLElement, icon: string, label: string) {
  btn.innerHTML = icon
  btn.title = label
  btn.setAttribute('aria-label', label)
  delete btn.dataset.state
  btn.removeAttribute('disabled')
}

function isXPage(): boolean {
  try {
    const host = window.location.hostname.toLowerCase()
    return (
      host === 'x.com' ||
      host.endsWith('.twitter.com') ||
      host.includes('twitter.com') ||
      host === 'pbs.twimg.com' ||
      host.endsWith('.twimg.com') ||
      host.includes('twimg.com') ||
      host.includes('pbs.twimg')
    )
  } catch {
    return false
  }
}

async function requestVideo(btn: HTMLElement, download = false): Promise<string> {
  // Resolve at click time: X recycles players and changes src after injection.
  const container = btn.closest('.x-video-action-host, .x-video-inline-action-host')
  const video = container?.querySelector<HTMLVideoElement | HTMLImageElement>(
    'video, img[src*="/tweet_video_thumb/"]'
  )
  if (!video) throw new Error('视频播放器已移除，请刷新后重试')
  const marker = video.getAttribute('data-x-video-resolver') || crypto.randomUUID()
  video.setAttribute('data-x-video-resolver', marker)
  const result = await chrome.runtime.sendMessage({
    type: 'X_VIDEO_RESOLVE',
    marker,
    download,
    ...getXVideoContext(video)
  })
  if (!result?.success || !result.url) throw new Error(result?.error || '无法解析 MP4 地址')
  return result.url
}

function safeAlert(message: string) {
  try {
    if (
      (window as any).chrome &&
      (window as any).chrome.runtime &&
      (window as any).chrome.runtime.sendMessage
    ) {
      try {
        ;(window as any).chrome.runtime.sendMessage({
          type: 'SHOW_NOTIFICATION',
          payload: { message }
        })
        return
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }
}

function setupCopyClick(btn: HTMLElement) {
  btn.addEventListener('click', async e => {
    e.preventDefault()
    e.stopPropagation()
    const icon = COPY_ICON
    const label = '复制视频地址'
    if (btn.hasAttribute('disabled')) return
    btn.setAttribute('disabled', 'true')
    try {
      await navigator.clipboard.writeText(await requestVideo(btn))
      setButtonState(btn, 'success')
    } catch (err) {
      console.error('[XVideoCopy] 操作失败', err)
      setButtonState(btn, 'error')
      btn.title = err instanceof Error ? err.message : '操作失败'
      safeAlert(btn.title)
    }
    setTimeout(() => resetButtonState(btn, icon, label), 1400)
  })
}

function setupDownloadClick(btn: HTMLElement) {
  btn.addEventListener('click', async e => {
    e.preventDefault()
    e.stopPropagation()
    const icon = DOWNLOAD_ICON
    const label = '下载视频'
    if (btn.hasAttribute('disabled')) return
    btn.setAttribute('disabled', 'true')
    try {
      btn.title = '下载中…'
      btn.setAttribute('aria-label', '下载中')
      await requestVideo(btn, true)
      setButtonState(btn, 'success')
    } catch (err) {
      console.error('[XVideoCopy] 下载失败', err)
      setButtonState(btn, 'error')
      btn.title = err instanceof Error ? err.message : '操作失败'
      safeAlert(btn.title)
    }
    setTimeout(() => resetButtonState(btn, icon, label), 1400)
  })
}

function createCopyBtn() {
  const btn = createE('button', {
    class: 'x-video-copy-btn x-video-action-button',
    type: 'button',
    ti: '复制视频地址',
    attrs: { 'aria-label': '复制视频地址' },
    in: COPY_ICON
  })
  setupCopyClick(btn)
  return btn
}

function createDownloadBtn(): HTMLElement {
  const btn = createE('button', {
    class: 'x-video-download-btn x-video-action-button',
    type: 'button',
    ti: '下载视频',
    attrs: { 'aria-label': '下载视频' },
    in: DOWNLOAD_ICON
  })
  setupDownloadClick(btn)
  return btn
}

function createInlineBtn(): HTMLElement {
  const btn = createE('button', {
    class: 'x-video-copy-inline-btn x-video-inline-action',
    type: 'button',
    ti: '复制视频地址',
    attrs: { 'aria-label': '复制视频地址' },
    in: COPY_ICON
  })
  setupCopyClick(btn)
  return btn
}

function addButtonToVideo(video: HTMLVideoElement | HTMLImageElement) {
  try {
    const parent =
      (video.closest('[data-testid="videoPlayer"]') as HTMLElement | null) ||
      video.parentElement ||
      video
    const container = parent as HTMLElement
    injectVideoActionStyles()
    const computed = window.getComputedStyle(container)
    if (computed.position === 'static' || !computed.position) container.style.position = 'relative'

    if (!container.classList.contains('x-video-action-host'))
      container.classList.add('x-video-action-host')
    let toolbar = Array.from(container.children).find(child =>
      child.classList.contains('x-video-action-toolbar')
    ) as HTMLElement | undefined
    if (!toolbar) {
      toolbar = createE('div', {
        class: 'x-video-action-toolbar',
        attrs: { role: 'group', 'aria-label': '视频操作' }
      })
      container.appendChild(toolbar)
    }

    if (!toolbar.querySelector('.x-video-copy-btn')) toolbar.appendChild(createCopyBtn())
    if (!toolbar.querySelector('.x-video-download-btn')) {
      toolbar.appendChild(createDownloadBtn())
    }

    try {
      addInlineButtonsToAncestors(video)
    } catch {
      /* ignore */
    }
  } catch {
    /* ignore */
  }
}

function addInlineButtonsToAncestors(video: HTMLVideoElement | HTMLImageElement) {
  let node: HTMLElement | null = video.parentElement
  const maxLevels = 4
  for (let i = 0; i < maxLevels && node; i++) {
    try {
      if (node.querySelector('.x-video-copy-inline-btn')) {
        node = node.parentElement
        continue
      }
      const tweetText = node.querySelector('[data-testid="tweetText"]') as HTMLElement | null
      if (tweetText) {
        if (!tweetText.querySelector('.x-video-copy-inline-btn')) {
          injectVideoActionStyles()
          tweetText.parentElement?.classList.add('x-video-inline-action-host')
          const inline = createInlineBtn()
          try {
            tweetText.insertAdjacentElement('afterend', inline)
          } catch {
            const parent = tweetText.parentElement
            if (parent) parent.appendChild(inline)
          }
        }
        return
      }
    } catch (e) {
      void e
    }
    if (!node) break
    const p = node.parentElement
    if (!p) break
    node = p
  }

  node = video.parentElement
  for (let i = 0; i < maxLevels && node; i++) {
    try {
      if (node.querySelector('.x-video-copy-inline-btn')) {
        node = node.parentElement
        continue
      }
      const hasTextChild = Array.from(node.childNodes).some(n => {
        if (n.nodeType === Node.TEXT_NODE) return !!(n.textContent && n.textContent.trim())
        if (n.nodeType === Node.ELEMENT_NODE) {
          const el = n as HTMLElement
          return !!(el.innerText && el.innerText.trim())
        }
        return false
      })
      if (hasTextChild) {
        injectVideoActionStyles()
        node.classList.add('x-video-inline-action-host')
        const inline = createInlineBtn()
        const children = Array.from(node.children)
        let inserted = false
        for (let j = 0; j < children.length; j++) {
          const c = children[j] as HTMLElement
          if (c.innerText && c.innerText.trim()) {
            c.insertAdjacentElement('afterend', inline)
            inserted = true
            break
          }
        }
        if (!inserted) node.appendChild(inline)
      }
    } catch (e) {
      void e
    }
    if (!node) break
    const p = node.parentElement
    if (!p) break
    node = p
  }
}

function scanAndInjectVideo() {
  const videos = Array.from(DQSA('video, img[src*="/tweet_video_thumb/"]')) as (
    HTMLVideoElement | HTMLImageElement
  )[]
  videos.forEach(v => {
    try {
      const rect = v.getBoundingClientRect()
      if (rect.width < 20 || rect.height < 20) return
    } catch (e) {
      void e
    }
    addButtonToVideo(v)
  })
}

function observeVideos(): () => void {
  const obs = new MutationObserver(ms => {
    let changed = false
    ms.forEach(m => {
      if (m.type === 'childList' || m.type === 'attributes') changed = true
    })
    if (changed) setTimeout(scanAndInjectVideo, 120)
  })
  obs.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['src', 'style', 'class']
  })

  // 返回 disconnect 函数以支持资源清理
  return () => {
    obs.disconnect()
    console.log('[XVideoCopy] MutationObserver disconnected')
  }
}

// 存储 disconnect 函数以便外部清理
let disconnectObserver: (() => void) | null = null

export function initVideoCopy() {
  try {
    if (!isXPage()) {
      console.log('[XVideoCopy] skipping init: not X/Twitter host')
      return
    }
    setTimeout(scanAndInjectVideo, 200)
    disconnectObserver = observeVideos()
    console.log('[XVideoCopy] initialized')
  } catch (e) {
    console.error('[XVideoCopy] init failed', e)
  }
}

/**
 * 清理函数 - 停止 MutationObserver 监听
 * 用于热更新或插件卸载时释放资源
 */
export function cleanupVideoCopy(): void {
  if (disconnectObserver) {
    disconnectObserver()
    disconnectObserver = null
  }
}
