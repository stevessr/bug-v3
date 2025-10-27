import { DOA, DQSA, createE } from '../../utils/createEl'

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
    link.download = `video_${Date.now()}.mp4`
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
    const orig = btn.innerHTML
    const origStyle = btn.style.background
    try {
      if (url.startsWith('blob:')) {
        btn.innerHTML = '下载中...'
        btn.style.background = 'linear-gradient(135deg,#3b82f6,#1d4ed8)'
        await downloadBlob(url)
        btn.innerHTML = '已下载'
        btn.style.background = 'linear-gradient(135deg,#10b981,#059669)'
        setTimeout(() => {
          btn.innerHTML = orig
          btn.style.background = origStyle
        }, 1400)
      } else {
        await navigator.clipboard.writeText(url)
        btn.innerHTML = '已复制'
        btn.style.background = 'linear-gradient(135deg,#10b981,#059669)'
        setTimeout(() => {
          btn.innerHTML = orig
          btn.style.background = origStyle
        }, 1400)
      }
    } catch (err) {
      console.error('[XVideoCopy] 操作失败', err)
      btn.innerHTML = '失败'
      btn.style.background = 'linear-gradient(135deg,#ef4444,#dc2626)'
      setTimeout(() => {
        btn.innerHTML = orig
        btn.style.background = origStyle
      }, 1400)
    }
  })
}

function createCopyBtn(url: string) {
  const btn = document.createElement('button')
  btn.className = 'x-video-copy-btn'
  btn.type = 'button'
  btn.title = url.startsWith('blob:') ? '下载视频' : '复制视频地址'
  btn.innerHTML = '📋'
  btn.style.cssText =
    'position:absolute;right:6px;top:6px;z-index:99999;cursor:pointer;border-radius:6px;padding:6px 8px;background:rgba(0,0,0,0.6);color:#fff;border:none;font-weight:700;'
  setupCopyClick(btn, url)
  return btn
}

function createInlineBtn(url: string) {
  const btn = document.createElement('button')
  btn.className = 'x-video-copy-inline-btn'
  btn.type = 'button'
  btn.title = url.startsWith('blob:') ? '下载视频' : '复制视频地址'
  btn.innerHTML = '📋'
  btn.style.cssText =
    'display:inline-block;vertical-align:middle;margin-left:8px;cursor:pointer;border-radius:6px;padding:2px 6px;background:rgba(0,0,0,0.06);color:var(--text-color,#0f1419);border:1px solid rgba(0,0,0,0.08);font-weight:600;'
  setupCopyClick(btn, url)
  return btn
}

function addButtonToVideo(video: HTMLVideoElement) {
  try {
    const parent = video.parentElement || video
    if ((parent as Element).querySelector('.x-video-copy-btn')) return
    const url = getVideoUrl(video)
    if (!url) return
    const container = parent as HTMLElement
    const computed = window.getComputedStyle(container)
    if (computed.position === 'static' || !computed.position) container.style.position = 'relative'
    const btn = createCopyBtn(url)
    container.appendChild(btn)
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

function observeVideos() {
  const obs = new MutationObserver(ms => {
    let changed = false
    ms.forEach(m => {
      if (m.type === 'childList' || m.type === 'attributes') changed = true
    })
    if (changed) setTimeout(scanAndInjectVideo, 120)
  })
  obs.observe(document.body, { childList: true, subtree: true, attributes: true })
}

export function initVideoCopy() {
  try {
    if (!isXPage()) {
      console.log('[XVideoCopy] skipping init: not X/Twitter host')
      return
    }
    setTimeout(scanAndInjectVideo, 200)
    observeVideos()
    console.log('[XVideoCopy] initialized')
  } catch (e) {
    console.error('[XVideoCopy] init failed', e)
  }
}
