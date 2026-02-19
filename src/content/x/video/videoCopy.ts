import { DOA, DQSA, createE } from '../../utils/dom/createEl'

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

function getVideoUrl(video: HTMLVideoElement): string | null {
  try {
    const source = video.querySelector('source') as HTMLSourceElement | null
    if (source && source.src) return source.src
    if (video.currentSrc) return video.currentSrc
    if ((video as HTMLVideoElement).src) return (video as HTMLVideoElement).src
  } catch {
    /* ignore */
  }
  return null
}

async function downloadBlob(url: string): Promise<void> {
  try {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`网络请求失败：${response.status} ${response.statusText}`)
    const blob = await response.blob()
    const downloadUrl = URL.createObjectURL(blob)
    const link = createE('a')
    link.href = downloadUrl
    // try to derive a sensible filename from the URL when possible
    try {
      let filename = `video_${Date.now()}.mp4`
      if (url && !url.startsWith('blob:')) {
        try {
          const u = new URL(url)
          const parts = u.pathname.split('/').filter(Boolean)
          const last = parts.length ? parts[parts.length - 1] : ''
          if (last) filename = decodeURIComponent(last)
          else if (u.search) {
            // attempt to find a filename-like query param
            const nameParam = u.searchParams.get('filename') || u.searchParams.get('name')
            if (nameParam) filename = nameParam
          }
        } catch {
          /* ignore URL parse errors and keep fallback */
        }
      }
      link.download = filename
    } catch {
      link.download = `video_${Date.now()}.mp4`
    }
    DOA(link)
    link.click()
    // remove by DOM method to be safe
    try {
      if (link.parentElement) link.parentElement.removeChild(link)
    } catch {
      /* ignore */
    }
    URL.revokeObjectURL(downloadUrl)
  } catch (error) {
    try {
      console.error('[XVideoCopy] 下载失败', error)
    } catch {
      /* ignore */
    }
    try {
      safeAlert(
        '下载失败：' +
          (error && (error as Error).message ? (error as Error).message : String(error))
      )
    } catch {
      /* ignore */
    }
    throw error
  }
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

function setupCopyClick(btn: HTMLElement, url: string) {
  btn.addEventListener('click', async e => {
    e.preventDefault()
    e.stopPropagation()
    const orig = btn.textContent || '📋'
    const origStyle = btn.style.background
    try {
      if (url.startsWith('blob:')) {
        btn.textContent = '下载中...'
        btn.style.background = 'linear-gradient(135deg,#3b82f6,#1d4ed8)'
        await downloadBlob(url)
        btn.textContent = '已下载'
        btn.style.background = 'linear-gradient(135deg,#10b981,#059669)'
        setTimeout(() => {
          btn.textContent = orig
          btn.style.background = origStyle
        }, 1400)
      } else {
        await navigator.clipboard.writeText(url)
        btn.textContent = '已复制'
        btn.style.background = 'linear-gradient(135deg,#10b981,#059669)'
        setTimeout(() => {
          btn.textContent = orig
          btn.style.background = origStyle
        }, 1400)
      }
    } catch (err) {
      console.error('[XVideoCopy] 操作失败', err)
      btn.textContent = '失败'
      btn.style.background = 'linear-gradient(135deg,#ef4444,#dc2626)'
      setTimeout(() => {
        btn.textContent = orig
        btn.style.background = origStyle
      }, 1400)
    }
  })
}

function setupDownloadClick(btn: HTMLElement, url: string) {
  btn.addEventListener('click', async e => {
    e.preventDefault()
    e.stopPropagation()
    const orig = btn.textContent || '⬇️'
    const origStyle = btn.style.background
    try {
      btn.textContent = '下载中...'
      btn.style.background = 'linear-gradient(135deg,#3b82f6,#1d4ed8)'
      await downloadBlob(url)
      btn.textContent = '已下载'
      btn.style.background = 'linear-gradient(135deg,#10b981,#059669)'
      setTimeout(() => {
        btn.textContent = orig
        btn.style.background = origStyle
      }, 1400)
    } catch (err) {
      console.error('[XVideoCopy] 下载失败', err)
      btn.textContent = '失败'
      btn.style.background = 'linear-gradient(135deg,#ef4444,#dc2626)'
      setTimeout(() => {
        btn.textContent = orig
        btn.style.background = origStyle
      }, 1400)
    }
  })
}

function createCopyBtn(url: string) {
  const btn = createE('button', {
    class: 'x-video-copy-btn',
    type: 'button',
    ti: url.startsWith('blob:') ? '下载视频' : '复制视频地址',
    text: '📋',
    style:
      'position:absolute;right:6px;top:6px;z-index:99999;cursor:pointer;border-radius:6px;padding:6px 8px;background:rgba(0,0,0,0.6);color:#fff;border:none;font-weight:700;'
  })
  setupCopyClick(btn, url)
  return btn
}

function createDownloadBtn(url: string) {
  const btn = createE('button', {
    class: 'x-video-download-btn',
    type: 'button',
    ti: '下载视频',
    text: '⬇️',
    style:
      'position:absolute;right:40px;top:6px;z-index:99999;cursor:pointer;border-radius:6px;padding:6px 8px;background:rgba(0,0,0,0.6);color:#fff;border:none;font-weight:700;'
  })
  setupDownloadClick(btn, url)
  return btn
}

function createInlineBtn(url: string) {
  const btn = createE('button', {
    class: 'x-video-copy-inline-btn',
    type: 'button',
    ti: url.startsWith('blob:') ? '下载视频' : '复制视频地址',
    text: '📋',
    style:
      'display:inline-block;vertical-align:middle;margin-left:8px;cursor:pointer;border-radius:6px;padding:2px 6px;background:rgba(0,0,0,0.06);color:var(--text-color,#0f1419);border:1px solid rgba(0,0,0,0.08);font-weight:600;'
  })
  setupCopyClick(btn, url)
  return btn
}

function addButtonToVideo(video: HTMLVideoElement) {
  try {
    // If we've already attached buttons for this video, try to ensure both buttons exist.
    try {
      const el = video as HTMLElement & { dataset: DOMStringMap }
      if (el.dataset && el.dataset.xVideoCopyAttached === '1') {
        const parent = video.parentElement || video
        try {
          // if download button missing, add it
          if (!(parent as Element).querySelector('.x-video-download-btn')) {
            const url = getVideoUrl(video)
            if (url) {
              const container = parent as HTMLElement
              const dbtn = createDownloadBtn(url)
              container.appendChild(dbtn)
            }
          }
        } catch {
          /* ignore */
        }
        return
      }
    } catch {
      /* ignore dataset read errors */
    }
    const parent = video.parentElement || video
    // if parent already has copy button, assume already handled
    if ((parent as Element).querySelector('.x-video-copy-btn')) return
    const url = getVideoUrl(video)
    if (!url) return
    const container = parent as HTMLElement
    const computed = window.getComputedStyle(container)
    if (computed.position === 'static' || !computed.position) container.style.position = 'relative'
    const btn = createCopyBtn(url)
    container.appendChild(btn)
    // also add a download button next to the copy button
    try {
      const dbtn = createDownloadBtn(url)
      container.appendChild(dbtn)
    } catch {
      /* ignore */
    }
    // mark the video so subsequent scans won't add duplicate buttons
    try {
      const el = video as HTMLElement & { dataset: DOMStringMap }
      if (el.dataset) el.dataset.xVideoCopyAttached = '1'
    } catch {
      /* ignore */
    }
    try {
      addInlineButtonsToAncestors(video, url)
    } catch {
      /* ignore */
    }
  } catch {
    /* ignore */
  }
}

function addInlineButtonsToAncestors(video: HTMLVideoElement, url: string) {
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
          const inline = createInlineBtn(url)
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
        const inline = createInlineBtn(url)
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
  const videos = Array.from(DQSA('video')) as HTMLVideoElement[]
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
